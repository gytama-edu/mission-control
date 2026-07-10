-- Phase 27B: Guardian Portal database foundation
--
-- Scope:
-- - Credential and session storage only
-- - No guardian login RPCs
-- - No teacher controls
-- - No frontend or routing changes
--
-- Security model:
-- - Reusable guardian secrets are stored only as password hashes.
-- - Session tokens are stored only as one-way hashes.
-- - Direct access is denied to anon and authenticated roles.
-- - Future SECURITY DEFINER RPCs will be the only supported access path.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.guardian_access_credentials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  secret_hash text not null,
  secret_hint text,
  is_active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rotated_at timestamptz,

  constraint guardian_access_credentials_student_unique unique (student_id),
  constraint guardian_access_credentials_secret_hash_not_blank
    check (length(btrim(secret_hash)) >= 20),
  constraint guardian_access_credentials_secret_hint_safe
    check (
      secret_hint is null
      or (
        length(btrim(secret_hint)) between 2 and 8
        and secret_hint = upper(secret_hint)
        and secret_hint !~ '[[:space:]]'
      )
    ),
  constraint guardian_access_credentials_failed_attempts_nonnegative
    check (failed_attempts >= 0),
  constraint guardian_access_credentials_expiry_after_creation
    check (expires_at is null or expires_at > created_at),
  constraint guardian_access_credentials_lock_after_creation
    check (locked_until is null or locked_until > created_at)
);

create table if not exists public.guardian_sessions (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null
    references public.guardian_access_credentials(id) on delete cascade,
  session_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,

  constraint guardian_sessions_session_hash_unique unique (session_hash),
  constraint guardian_sessions_session_hash_not_blank
    check (length(btrim(session_hash)) >= 32),
  constraint guardian_sessions_expiry_after_creation
    check (expires_at > created_at),
  constraint guardian_sessions_revoked_after_creation
    check (revoked_at is null or revoked_at >= created_at),
  constraint guardian_sessions_last_used_after_creation
    check (last_used_at is null or last_used_at >= created_at)
);

comment on table public.guardian_access_credentials is
  'One credential per student for read-only Guardian Portal access. Stores only a password hash, never the reusable secret.';

comment on column public.guardian_access_credentials.secret_hint is
  'Non-sensitive teacher-facing hint, normally the last four normalized secret characters. Never sufficient for authentication.';

comment on table public.guardian_sessions is
  'Short-lived Guardian Portal sessions. Stores only a one-way token hash.';

create index if not exists guardian_access_credentials_active_state_idx
  on public.guardian_access_credentials (student_id, expires_at, locked_until)
  where is_active = true;

create index if not exists guardian_sessions_active_credential_idx
  on public.guardian_sessions (credential_id, expires_at)
  where revoked_at is null;

create index if not exists guardian_sessions_expiry_cleanup_idx
  on public.guardian_sessions (expires_at);

alter table public.guardian_access_credentials enable row level security;
alter table public.guardian_sessions enable row level security;

-- No direct policies are intentionally created. With RLS enabled and no policies,
-- anon/authenticated requests cannot read or mutate these tables.
revoke all on table public.guardian_access_credentials from public;
revoke all on table public.guardian_access_credentials from anon;
revoke all on table public.guardian_access_credentials from authenticated;

revoke all on table public.guardian_sessions from public;
revoke all on table public.guardian_sessions from anon;
revoke all on table public.guardian_sessions from authenticated;

create or replace function public.guardian_revoke_sessions_for_credential(
  p_credential_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_revoked_count integer := 0;
begin
  if p_credential_id is null then
    return 0;
  end if;

  update public.guardian_sessions
  set revoked_at = coalesce(revoked_at, now())
  where credential_id = p_credential_id
    and revoked_at is null;

  get diagnostics v_revoked_count = row_count;
  return v_revoked_count;
end;
$$;

comment on function public.guardian_revoke_sessions_for_credential(uuid) is
  'Internal helper used by trusted Guardian Portal RPCs and triggers to revoke every active session for one credential.';

revoke all on function public.guardian_revoke_sessions_for_credential(uuid) from public;
revoke all on function public.guardian_revoke_sessions_for_credential(uuid) from anon;
revoke all on function public.guardian_revoke_sessions_for_credential(uuid) from authenticated;

create or replace function public.guardian_credential_before_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();

  if new.secret_hash is distinct from old.secret_hash then
    if new.rotated_at is null or new.rotated_at is not distinct from old.rotated_at then
      new.rotated_at := now();
    end if;
  end if;

  if (
    new.secret_hash is distinct from old.secret_hash
    or new.is_active is distinct from old.is_active
    or new.expires_at is distinct from old.expires_at
    or new.rotated_at is distinct from old.rotated_at
  ) then
    perform public.guardian_revoke_sessions_for_credential(old.id);
  end if;

  return new;
end;
$$;

revoke all on function public.guardian_credential_before_update() from public;
revoke all on function public.guardian_credential_before_update() from anon;
revoke all on function public.guardian_credential_before_update() from authenticated;

drop trigger if exists guardian_credential_before_update_trigger
  on public.guardian_access_credentials;

create trigger guardian_credential_before_update_trigger
before update on public.guardian_access_credentials
for each row
execute function public.guardian_credential_before_update();

create or replace function public.guardian_cleanup_expired_sessions(
  p_retention interval default interval '7 days'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_count integer := 0;
  v_retention interval := greatest(
    coalesce(p_retention, interval '7 days'),
    interval '0 seconds'
  );
begin
  delete from public.guardian_sessions
  where expires_at < now() - v_retention
     or (
       revoked_at is not null
       and revoked_at < now() - v_retention
     );

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

comment on function public.guardian_cleanup_expired_sessions(interval) is
  'Internal maintenance helper. Deletes expired or revoked guardian sessions after the requested retention period.';

revoke all on function public.guardian_cleanup_expired_sessions(interval) from public;
revoke all on function public.guardian_cleanup_expired_sessions(interval) from anon;
revoke all on function public.guardian_cleanup_expired_sessions(interval) from authenticated;

commit;
