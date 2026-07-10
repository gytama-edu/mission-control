-- Phase 27C rollback: Guardian authentication RPCs
-- Run only when intentionally reverting Phase 27C.

begin;

drop function if exists public.guardian_end_session(text);
drop function if exists public.guardian_fetch_dashboard(text);
drop function if exists public.guardian_begin_session(text, text);

-- Restore the Phase 27B trigger function before removing lookup_key.
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

drop index if exists public.guardian_access_credentials_lookup_key_unique_idx;

alter table public.guardian_access_credentials
  drop constraint if exists guardian_access_credentials_lookup_key_format;

alter table public.guardian_access_credentials
  drop column if exists lookup_key;

commit;
