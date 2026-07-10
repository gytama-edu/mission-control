-- Phase 27D: Teacher-owned Guardian credential controls
--
-- Depends on:
--   20260710_phase_27b_guardian_database_foundation.sql
--   20260710_phase_27c_guardian_auth_rpcs.sql
--
-- Scope:
-- - List Guardian credential status for students in one teacher-owned class.
-- - Create a Guardian code and return the plaintext value once.
-- - Rotate a Guardian code and return the new plaintext value once.
-- - Enable or disable Guardian access.
-- - Keep credential rows inaccessible through direct browser queries.

begin;

-- Generate a cryptographically random 20-character secret from a 32-character
-- alphabet. Because the alphabet length is exactly 32, mapping each random byte
-- with modulo 32 does not introduce distribution bias.
create or replace function public.guardian_generate_secret_internal()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_random_bytes bytea;
  v_secret text;
  v_attempt integer;
  v_index integer;
begin
  for v_attempt in 1..32 loop
    v_random_bytes := extensions.gen_random_bytes(20);
    v_secret := '';

    for v_index in 0..19 loop
      v_secret := v_secret || substr(
        v_alphabet,
        (get_byte(v_random_bytes, v_index) % 32) + 1,
        1
      );
    end loop;

    if not exists (
      select 1
      from public.guardian_access_credentials gac
      where gac.lookup_key = left(v_secret, 8)
    ) then
      return v_secret;
    end if;
  end loop;

  raise exception 'Unable to allocate a unique Guardian credential lookup key';
end;
$$;

revoke all on function public.guardian_generate_secret_internal() from public;
revoke all on function public.guardian_generate_secret_internal() from anon;
revoke all on function public.guardian_generate_secret_internal() from authenticated;

comment on function public.guardian_generate_secret_internal() is
  'Internal cryptographic Guardian-code generator. Never granted to browser roles.';

-- Format a normalized 20-character secret for one-time teacher display.
create or replace function public.guardian_format_secret_internal(
  p_secret text
)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select substr(p_secret, 1, 8)
    || '-' || substr(p_secret, 9, 4)
    || '-' || substr(p_secret, 13, 4)
    || '-' || substr(p_secret, 17, 4)
$$;

revoke all on function public.guardian_format_secret_internal(text) from public;
revoke all on function public.guardian_format_secret_internal(text) from anon;
revoke all on function public.guardian_format_secret_internal(text) from authenticated;

-- ============================================================================
-- guardian_teacher_list_credentials
-- ============================================================================

create or replace function public.guardian_teacher_list_credentials(
  p_class_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_students jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and c.teacher_id = auth.uid()
  ) then
    raise exception 'Class not found or not owned by teacher' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'studentId', s.id,
        'studentName', s.name,
        'studentNickname', nullif(btrim(s.nickname), ''),
        'credentialState', case
          when gac.id is null then 'not_configured'
          when not gac.is_active then 'disabled'
          when gac.expires_at is not null and gac.expires_at <= now() then 'expired'
          when gac.locked_until is not null and gac.locked_until > now() then 'locked'
          else 'active'
        end,
        'isActive', coalesce(gac.is_active, false),
        'secretHint', gac.secret_hint,
        'expiresAt', gac.expires_at,
        'lastUsedAt', gac.last_used_at,
        'lockedUntil', case
          when gac.locked_until is not null and gac.locked_until > now()
            then gac.locked_until
          else null
        end,
        'createdAt', gac.created_at,
        'rotatedAt', gac.rotated_at,
        'activeSessionCount', coalesce(session_counts.active_session_count, 0)
      )
      order by lower(s.name), s.id
    ),
    '[]'::jsonb
  )
  into v_students
  from public.students s
  left join public.guardian_access_credentials gac
    on gac.student_id = s.id
  left join lateral (
    select count(*)::integer as active_session_count
    from public.guardian_sessions gs
    where gs.credential_id = gac.id
      and gs.revoked_at is null
      and gs.expires_at > now()
      and gac.is_active = true
      and (gac.expires_at is null or gac.expires_at > now())
      and (gac.locked_until is null or gac.locked_until <= now())
  ) session_counts on true
  where s.class_id = p_class_id;

  return jsonb_build_object(
    'ok', true,
    'students', v_students
  );
end;
$$;

revoke all on function public.guardian_teacher_list_credentials(uuid) from public;
grant execute on function public.guardian_teacher_list_credentials(uuid) to authenticated;

comment on function public.guardian_teacher_list_credentials(uuid) is
  'Returns Guardian credential status for students in one class owned by the authenticated teacher. Never returns reusable secrets or hashes.';

-- ============================================================================
-- guardian_teacher_create_credential
-- ============================================================================

create or replace function public.guardian_teacher_create_credential(
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class_id uuid;
  v_secret text;
  v_attempt integer;
  v_inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select s.class_id
  into v_class_id
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.id = p_student_id
    and c.teacher_id = auth.uid()
  for update of s;

  if not found then
    raise exception 'Student not found or not owned by teacher' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.guardian_access_credentials gac
    where gac.student_id = p_student_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_configured');
  end if;

  for v_attempt in 1..16 loop
    v_secret := public.guardian_generate_secret_internal();

    begin
      insert into public.guardian_access_credentials (
        student_id,
        lookup_key,
        secret_hash,
        secret_hint,
        is_active,
        failed_attempts,
        locked_until,
        created_by
      )
      values (
        p_student_id,
        left(v_secret, 8),
        extensions.crypt(v_secret, extensions.gen_salt('bf', 10)),
        right(v_secret, 4),
        true,
        0,
        null,
        auth.uid()
      )
      returning id into v_inserted_id;

      exit;
    exception
      when unique_violation then
        if exists (
          select 1
          from public.guardian_access_credentials gac
          where gac.student_id = p_student_id
        ) then
          return jsonb_build_object('ok', false, 'reason', 'already_configured');
        end if;
    end;
  end loop;

  if v_inserted_id is null then
    raise exception 'Unable to create a unique Guardian credential';
  end if;

  return jsonb_build_object(
    'ok', true,
    'studentId', p_student_id,
    'guardianCode', public.guardian_format_secret_internal(v_secret),
    'secretHint', right(v_secret, 4),
    'credentialState', 'active'
  );
end;
$$;

revoke all on function public.guardian_teacher_create_credential(uuid) from public;
grant execute on function public.guardian_teacher_create_credential(uuid) to authenticated;

comment on function public.guardian_teacher_create_credential(uuid) is
  'Creates one Guardian credential for a teacher-owned student and returns the plaintext code exactly once.';

-- ============================================================================
-- guardian_teacher_rotate_credential
-- ============================================================================

create or replace function public.guardian_teacher_rotate_credential(
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_credential_id uuid;
  v_secret text;
  v_attempt integer;
  v_updated boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gac.id
  into v_credential_id
  from public.guardian_access_credentials gac
  join public.students s on s.id = gac.student_id
  join public.classes c on c.id = s.class_id
  where gac.student_id = p_student_id
    and c.teacher_id = auth.uid()
  for update of gac;

  if not found then
    if exists (
      select 1
      from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = p_student_id
        and c.teacher_id = auth.uid()
    ) then
      return jsonb_build_object('ok', false, 'reason', 'not_configured');
    end if;

    raise exception 'Student not found or not owned by teacher' using errcode = '42501';
  end if;

  for v_attempt in 1..16 loop
    v_secret := public.guardian_generate_secret_internal();

    begin
      update public.guardian_access_credentials
      set lookup_key = left(v_secret, 8),
          secret_hash = extensions.crypt(v_secret, extensions.gen_salt('bf', 10)),
          secret_hint = right(v_secret, 4),
          is_active = true,
          expires_at = null,
          failed_attempts = 0,
          locked_until = null,
          rotated_at = now()
      where id = v_credential_id;

      v_updated := true;
      exit;
    exception
      when unique_violation then
        v_updated := false;
    end;
  end loop;

  if not v_updated then
    raise exception 'Unable to rotate to a unique Guardian credential';
  end if;

  return jsonb_build_object(
    'ok', true,
    'studentId', p_student_id,
    'guardianCode', public.guardian_format_secret_internal(v_secret),
    'secretHint', right(v_secret, 4),
    'credentialState', 'active'
  );
end;
$$;

revoke all on function public.guardian_teacher_rotate_credential(uuid) from public;
grant execute on function public.guardian_teacher_rotate_credential(uuid) to authenticated;

comment on function public.guardian_teacher_rotate_credential(uuid) is
  'Rotates and re-enables a teacher-owned student Guardian credential, clears any old expiry, revokes old sessions through the credential trigger, and returns the new code exactly once.';

-- ============================================================================
-- guardian_teacher_set_credential_active
-- ============================================================================

create or replace function public.guardian_teacher_set_credential_active(
  p_student_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_credential_id uuid;
  v_state text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_is_active is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_state');
  end if;

  select gac.id
  into v_credential_id
  from public.guardian_access_credentials gac
  join public.students s on s.id = gac.student_id
  join public.classes c on c.id = s.class_id
  where gac.student_id = p_student_id
    and c.teacher_id = auth.uid()
  for update of gac;

  if not found then
    if exists (
      select 1
      from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = p_student_id
        and c.teacher_id = auth.uid()
    ) then
      return jsonb_build_object('ok', false, 'reason', 'not_configured');
    end if;

    raise exception 'Student not found or not owned by teacher' using errcode = '42501';
  end if;

  update public.guardian_access_credentials
  set is_active = p_is_active,
      failed_attempts = case when p_is_active then 0 else failed_attempts end,
      locked_until = case when p_is_active then null else locked_until end
  where id = v_credential_id;

  select case
    when not gac.is_active then 'disabled'
    when gac.expires_at is not null and gac.expires_at <= now() then 'expired'
    when gac.locked_until is not null and gac.locked_until > now() then 'locked'
    else 'active'
  end
  into v_state
  from public.guardian_access_credentials gac
  where gac.id = v_credential_id;

  return jsonb_build_object(
    'ok', true,
    'studentId', p_student_id,
    'credentialState', v_state,
    'isActive', p_is_active
  );
end;
$$;

revoke all on function public.guardian_teacher_set_credential_active(uuid, boolean) from public;
grant execute on function public.guardian_teacher_set_credential_active(uuid, boolean) to authenticated;

comment on function public.guardian_teacher_set_credential_active(uuid, boolean) is
  'Enables or disables a teacher-owned student Guardian credential. State changes revoke existing sessions through the credential trigger.';

notify pgrst, 'reload schema';

commit;
