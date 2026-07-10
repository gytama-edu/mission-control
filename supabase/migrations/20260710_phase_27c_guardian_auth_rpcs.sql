-- Phase 27C: Guardian Portal authentication and read-only dashboard RPCs
--
-- Depends on:
--   20260710_phase_27b_guardian_database_foundation.sql
--
-- Scope:
-- - Add a non-secret credential lookup key.
-- - Add Guardian session begin/fetch/end RPCs.
-- - Keep all Guardian tables inaccessible through direct browser queries.
-- - Return only an explicit read-only, one-student dashboard payload.

begin;

-- A short non-secret lookup segment lets the login RPC find exactly one
-- credential before checking its slow password hash. The future teacher
-- credential generator will create a 20-character code whose first eight
-- normalized characters are stored here.
alter table public.guardian_access_credentials
  add column if not exists lookup_key text;

do $$
begin
  if exists (
    select 1
    from public.guardian_access_credentials
    where lookup_key is null
  ) then
    raise exception using
      message = 'Phase 27C cannot continue: guardian credentials without lookup_key exist.',
      hint = 'Audit or remove unexpected pre-27C guardian credential rows before applying this migration.';
  end if;
end;
$$;

alter table public.guardian_access_credentials
  alter column lookup_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'guardian_access_credentials_lookup_key_format'
      and conrelid = 'public.guardian_access_credentials'::regclass
  ) then
    alter table public.guardian_access_credentials
      add constraint guardian_access_credentials_lookup_key_format
      check (lookup_key ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$');
  end if;
end;
$$;

create unique index if not exists guardian_access_credentials_lookup_key_unique_idx
  on public.guardian_access_credentials (lookup_key);

comment on column public.guardian_access_credentials.lookup_key is
  'Non-secret first eight characters of the normalized Guardian code. Used only to locate one credential before password-hash verification.';

-- ============================================================================
-- guardian_begin_session
-- ============================================================================

create or replace function public.guardian_begin_session(
  p_class_code text,
  p_guardian_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class_code text;
  v_secret text;
  v_lookup_key text;
  v_credential record;
  v_secret_matches boolean := false;
  v_failed_attempts integer;
  v_session_token text;
  v_session_hash text;
  v_expires_at timestamptz;
begin
  -- Hard input bounds prevent oversized values from reaching regex/hash work.
  if p_class_code is null
     or p_guardian_secret is null
     or length(p_class_code) > 64
     or length(p_guardian_secret) > 128 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  v_class_code := upper(btrim(p_class_code));
  v_secret := upper(regexp_replace(btrim(p_guardian_secret), '[[:space:]-]+', '', 'g'));

  if v_class_code = ''
     or length(v_secret) <> 20
     or v_secret !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{20}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  v_lookup_key := left(v_secret, 8);

  select
    gac.id as credential_id,
    gac.secret_hash,
    gac.is_active,
    gac.expires_at as credential_expires_at,
    gac.failed_attempts,
    gac.locked_until,
    s.id as student_id,
    c.id as class_id,
    c.is_archived
  into v_credential
  from public.guardian_access_credentials gac
  join public.students s on s.id = gac.student_id
  join public.classes c on c.id = s.class_id
  where gac.lookup_key = v_lookup_key
    and upper(c.join_code) = v_class_code
  for update of gac;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  if not v_credential.is_active
     or coalesce(v_credential.is_archived, false)
     or (
       v_credential.credential_expires_at is not null
       and v_credential.credential_expires_at <= now()
     ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  -- A completed lock window resets before the next password attempt.
  if v_credential.locked_until is not null
     and v_credential.locked_until <= now() then
    update public.guardian_access_credentials
    set failed_attempts = 0,
        locked_until = null
    where id = v_credential.credential_id;

    v_credential.failed_attempts := 0;
    v_credential.locked_until := null;
  end if;

  if v_credential.locked_until is not null
     and v_credential.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  begin
    v_secret_matches :=
      extensions.crypt(v_secret, v_credential.secret_hash) = v_credential.secret_hash;
  exception
    when others then
      -- A malformed stored hash must fail closed without leaking an internal error.
      v_secret_matches := false;
  end;

  if not v_secret_matches then
    v_failed_attempts := coalesce(v_credential.failed_attempts, 0) + 1;

    update public.guardian_access_credentials
    set failed_attempts = v_failed_attempts,
        locked_until = case
          when v_failed_attempts >= 5 then now() + interval '15 minutes'
          else null
        end
    where id = v_credential.credential_id;

    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  -- Never persist the raw token. The browser receives it once and the database
  -- retains only its SHA-256 digest.
  v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_session_hash := encode(
    extensions.digest(convert_to(v_session_token, 'UTF8'), 'sha256'),
    'hex'
  );
  v_expires_at := now() + interval '12 hours';

  update public.guardian_access_credentials
  set failed_attempts = 0,
      locked_until = null,
      last_used_at = now()
  where id = v_credential.credential_id;

  insert into public.guardian_sessions (
    credential_id,
    session_hash,
    expires_at,
    last_used_at
  )
  values (
    v_credential.credential_id,
    v_session_hash,
    v_expires_at,
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'sessionToken', v_session_token,
    'expiresAt', v_expires_at
  );
end;
$$;

revoke all on function public.guardian_begin_session(text, text) from public;
grant execute on function public.guardian_begin_session(text, text) to anon, authenticated;

comment on function public.guardian_begin_session(text, text) is
  'Validates class code plus Guardian code, applies per-credential lockout, and returns a 12-hour opaque session token.';

-- ============================================================================
-- guardian_fetch_dashboard
-- ============================================================================

create or replace function public.guardian_fetch_dashboard(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_session_hash text;
  v_session record;
  v_badges jsonb := '[]'::jsonb;
  v_tasks jsonb := '[]'::jsonb;
  v_recent_progress jsonb := '[]'::jsonb;
  v_display_mode text;
begin
  if p_session_token is null or length(p_session_token) > 128 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;

  v_token := lower(btrim(p_session_token));

  if length(v_token) <> 64 or v_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;

  v_session_hash := encode(
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
    'hex'
  );

  select
    gs.id as session_id,
    gs.expires_at as session_expires_at,
    gs.revoked_at,
    gac.id as credential_id,
    gac.is_active,
    gac.expires_at as credential_expires_at,
    gac.locked_until,
    s.id as student_id,
    s.name as student_name,
    s.nickname as student_nickname,
    s.points,
    s.lives,
    c.id as class_id,
    c.name as class_name,
    c.level as class_level,
    c.class_category,
    c.is_archived
  into v_session
  from public.guardian_sessions gs
  join public.guardian_access_credentials gac on gac.id = gs.credential_id
  join public.students s on s.id = gac.student_id
  join public.classes c on c.id = s.class_id
  where gs.session_hash = v_session_hash
  for update of gs;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;

  if v_session.revoked_at is not null
     or v_session.session_expires_at <= now()
     or not v_session.is_active
     or coalesce(v_session.is_archived, false)
     or (
       v_session.credential_expires_at is not null
       and v_session.credential_expires_at <= now()
     )
     or (
       v_session.locked_until is not null
       and v_session.locked_until > now()
     ) then
    update public.guardian_sessions
    set revoked_at = coalesce(revoked_at, now())
    where id = v_session.session_id;

    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;

  update public.guardian_sessions
  set last_used_at = now()
  where id = v_session.session_id;

  v_display_mode := case
    when v_session.class_category = 'private' then 'lives'
    else 'points'
  end;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'name', bd.name,
          'description', nullif(btrim(bd.description), ''),
          'icon', nullif(btrim(bd.icon), ''),
          'awardedAt', sb.awarded_at
        )
      )
      order by sb.awarded_at desc
    ),
    '[]'::jsonb
  )
  into v_badges
  from public.student_badges sb
  join public.badge_definitions bd on bd.id = sb.badge_id
  where sb.student_id = v_session.student_id
    and sb.class_id = v_session.class_id;

  select coalesce(
    jsonb_agg(task_item order by sort_due nulls last, sort_created desc),
    '[]'::jsonb
  )
  into v_tasks
  from (
    select
      t.due_at as sort_due,
      t.created_at as sort_created,
      jsonb_strip_nulls(
        jsonb_build_object(
          'title', t.title,
          'description', nullif(btrim(left(t.description, 1000)), ''),
          'taskType', t.task_type,
          'dueAt', t.due_at,
          'status', case
            when sub.status is not null then sub.status
            when t.status = 'closed' then 'closed'
            else 'not_submitted'
          end,
          'awardedPoints', sub.awarded_points,
          'teacherFeedback', nullif(btrim(sub.teacher_feedback), ''),
          'submittedAt', sub.created_at,
          'reviewedAt', sub.reviewed_at
        )
      ) as task_item
    from public.tasks t
    left join lateral (
      select
        ts.status,
        ts.awarded_points,
        ts.teacher_feedback,
        ts.created_at,
        ts.reviewed_at
      from public.task_submissions ts
      where ts.task_id = t.id
        and ts.class_id = v_session.class_id
        and (
          (
            t.task_type = 'individual'
            and ts.student_id = v_session.student_id
            and ts.task_group_id is null
          )
          or
          (
            t.task_type = 'group'
            and ts.task_group_id in (
              select tgm.task_group_id
              from public.task_group_members tgm
              where tgm.task_id = t.id
                and tgm.student_id = v_session.student_id
            )
          )
        )
      order by ts.updated_at desc
      limit 1
    ) sub on true
    where t.class_id = v_session.class_id
      and t.status in ('published', 'closed')
      and (
        t.task_type = 'individual'
        or exists (
          select 1
          from public.task_group_members tgm
          where tgm.task_id = t.id
            and tgm.student_id = v_session.student_id
        )
      )
  ) guardian_tasks;

  select coalesce(
    jsonb_agg(progress_item order by occurred_at desc),
    '[]'::jsonb
  )
  into v_recent_progress
  from (
    select
      al.created_at as occurred_at,
      jsonb_strip_nulls(
        jsonb_build_object(
          'occurredAt', al.created_at,
          'label', case al.action_type
            when 'points_addition' then 'Points added'
            when 'points_subtraction' then 'Points adjusted'
            when 'lives_addition' then 'Life restored'
            when 'lives_subtraction' then 'Life adjusted'
            when 'individual_submission_submitted' then 'Individual task submitted'
            when 'individual_submission_resubmitted' then 'Individual task resubmitted'
            when 'group_task_submitted' then 'Group task submitted'
            when 'group_submission_resubmitted' then 'Group task resubmitted'
            when 'task_reviewed' then 'Teacher reviewed a task'
            when 'group_task_reviewed' then 'Teacher reviewed a group task'
            when 'individual_submission_returned' then 'Task returned for revision'
            when 'group_submission_returned' then 'Group task returned for revision'
            when 'badge_awarded' then 'Badge earned'
            when 'badge_auto_awarded' then 'Badge earned'
            else 'Progress updated'
          end,
          'pointsDelta', case
            when v_display_mode = 'points' then nullif(coalesce(al.points_delta, 0), 0)
            else null
          end,
          'livesDelta', case
            when v_display_mode = 'lives' then nullif(coalesce(al.lives_delta, 0), 0)
            else null
          end
        )
      ) as progress_item
    from public.activity_logs al
    where al.class_id = v_session.class_id
      and al.student_id = v_session.student_id
      and coalesce(al.undone, false) = false
      and al.action_type in (
        'points_addition',
        'points_subtraction',
        'lives_addition',
        'lives_subtraction',
        'individual_submission_submitted',
        'individual_submission_resubmitted',
        'group_task_submitted',
        'group_submission_resubmitted',
        'task_reviewed',
        'group_task_reviewed',
        'individual_submission_returned',
        'group_submission_returned',
        'badge_awarded',
        'badge_auto_awarded'
      )
    order by al.created_at desc
    limit 30
  ) guardian_progress;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'access', jsonb_build_object(
        'expiresAt', v_session.session_expires_at
      ),
      'class', jsonb_strip_nulls(
        jsonb_build_object(
          'name', v_session.class_name,
          'level', nullif(btrim(v_session.class_level), ''),
          'category', v_session.class_category,
          'displayMode', v_display_mode
        )
      ),
      'student', jsonb_strip_nulls(
        jsonb_build_object(
          'displayName', v_session.student_name,
          'nickname', nullif(btrim(v_session.student_nickname), ''),
          'points', case when v_display_mode = 'points' then v_session.points else null end,
          'lives', case when v_display_mode = 'lives' then v_session.lives else null end
        )
      ),
      'badges', v_badges,
      'tasks', v_tasks,
      'recentProgress', v_recent_progress
    )
  );
end;
$$;

revoke all on function public.guardian_fetch_dashboard(text) from public;
grant execute on function public.guardian_fetch_dashboard(text) to anon, authenticated;

comment on function public.guardian_fetch_dashboard(text) is
  'Validates a Guardian session and returns an explicit one-student read-only payload with no IDs, PINs, roster, rank, attachments, raw logs, or AI data.';

-- ============================================================================
-- guardian_end_session
-- ============================================================================

create or replace function public.guardian_end_session(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_session_hash text;
begin
  -- Logout is intentionally idempotent and never confirms whether a token existed.
  if p_session_token is null or length(p_session_token) > 128 then
    return jsonb_build_object('ok', true);
  end if;

  v_token := lower(btrim(p_session_token));

  if length(v_token) <> 64 or v_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', true);
  end if;

  v_session_hash := encode(
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
    'hex'
  );

  update public.guardian_sessions
  set revoked_at = coalesce(revoked_at, now())
  where session_hash = v_session_hash;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.guardian_end_session(text) from public;
grant execute on function public.guardian_end_session(text) to anon, authenticated;

comment on function public.guardian_end_session(text) is
  'Idempotently revokes a Guardian session without revealing whether the supplied token existed.';

commit;
