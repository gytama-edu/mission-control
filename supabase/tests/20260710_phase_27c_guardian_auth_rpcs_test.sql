-- Phase 27C verification script
--
-- Prerequisites:
-- 1. Apply Phase 27B.
-- 2. Apply Phase 27C.
-- 3. Run this as a database owner in a non-production environment.
--
-- All fixture data is rolled back.

begin;

do $$
declare
  v_suffix text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_join_code text;
  v_class_id uuid;
  v_student_id uuid;
  v_other_student_id uuid;
  v_credential_id uuid;
  v_task_id uuid;
  v_badge_id uuid;
  v_secret text := 'ABCDEFGHJKLMNPQRSTUV';
  v_formatted_secret text := 'ABCDEFGH-JKLM-NPQR-STUV';
  v_rotated_secret text := 'ABCDEFGHJKLMNPQRSTWX';
  v_formatted_rotated_secret text := 'ABCDEFGH-JKLM-NPQR-STWX';
  v_response jsonb;
  v_dashboard jsonb;
  v_session_token text;
  v_second_session_token text;
  v_session_hash text;
  v_failed_attempts integer;
  v_revoked_at timestamptz;
begin
  v_join_code := 'G27C' || v_suffix;

  if has_table_privilege('anon', 'public.guardian_access_credentials', 'select') then
    raise exception 'anon unexpectedly has direct SELECT on guardian_access_credentials';
  end if;

  if has_table_privilege('authenticated', 'public.guardian_sessions', 'select') then
    raise exception 'authenticated unexpectedly has direct SELECT on guardian_sessions';
  end if;

  if not has_function_privilege('anon', 'public.guardian_begin_session(text,text)', 'execute')
     or not has_function_privilege('anon', 'public.guardian_fetch_dashboard(text)', 'execute')
     or not has_function_privilege('anon', 'public.guardian_end_session(text)', 'execute') then
    raise exception 'anon is missing an expected Guardian RPC execute grant';
  end if;

  insert into public.classes (
    name, level, max_lives, join_code, teacher_id, is_archived, class_category
  )
  values (
    'Guardian 27C Test Class', 'Test', 5, v_join_code, null, false, 'regular'
  )
  returning id into v_class_id;

  insert into public.students (class_id, name, nickname, pin, lives, points)
  values (v_class_id, 'Guardian Test Student', 'Pilot', '7319', 5, 73)
  returning id into v_student_id;

  insert into public.students (class_id, name, nickname, pin, lives, points)
  values (v_class_id, 'FORBIDDEN OTHER STUDENT 27C', 'Hidden', '8462', 5, 9999)
  returning id into v_other_student_id;

  insert into public.guardian_access_credentials (
    student_id,
    lookup_key,
    secret_hash,
    secret_hint,
    is_active
  )
  values (
    v_student_id,
    left(v_secret, 8),
    extensions.crypt(v_secret, extensions.gen_salt('bf', 10)),
    right(v_secret, 4),
    true
  )
  returning id into v_credential_id;

  insert into public.tasks (
    class_id,
    title,
    description,
    task_type,
    status,
    reward_points,
    allow_text_submission
  )
  values (
    v_class_id,
    'Guardian-safe test task',
    'Visible task description',
    'individual',
    'published',
    10,
    true
  )
  returning id into v_task_id;

  insert into public.task_submissions (
    task_id,
    class_id,
    student_id,
    submitted_by_student_id,
    submission_text,
    status,
    teacher_feedback,
    awarded_points,
    reviewed_at
  )
  values (
    v_task_id,
    v_class_id,
    v_student_id,
    v_student_id,
    'PRIVATE SUBMISSION TEXT MUST NOT LEAK',
    'reviewed',
    'Good progress.',
    9,
    now()
  );

  insert into public.badge_definitions (
    class_id, name, description, icon, badge_type, is_active
  )
  values (
    v_class_id, 'Test Badge', 'Safe badge description', 'star', 'manual', true
  )
  returning id into v_badge_id;

  insert into public.student_badges (
    badge_id, class_id, student_id, source, awarded_reason
  )
  values (
    v_badge_id, v_class_id, v_student_id, 'manual', 'INTERNAL REASON MUST NOT LEAK'
  );

  insert into public.activity_logs (
    class_id,
    student_id,
    action_type,
    points_delta,
    reason,
    metadata
  )
  values (
    v_class_id,
    v_student_id,
    'points_changed',
    3,
    'PRIVATE TEACHER REASON MUST NOT LEAK',
    jsonb_build_object('private_key', 'PRIVATE METADATA MUST NOT LEAK')
  );

  -- Wrong credentials remain generic and increment only the located credential.
  v_response := public.guardian_begin_session(v_join_code, 'ABCDEFGH-JKLM-NPQR-STUX');
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Wrong Guardian secret unexpectedly succeeded';
  end if;

  select failed_attempts into v_failed_attempts
  from public.guardian_access_credentials
  where id = v_credential_id;

  if v_failed_attempts <> 1 then
    raise exception 'Wrong secret did not increment failed_attempts exactly once';
  end if;

  v_response := public.guardian_begin_session('WRONGCLASS', v_formatted_secret);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Wrong class code unexpectedly succeeded';
  end if;

  update public.guardian_access_credentials
  set locked_until = now() + interval '15 minutes'
  where id = v_credential_id;

  v_response := public.guardian_begin_session(v_join_code, v_formatted_secret);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Locked credential unexpectedly succeeded';
  end if;

  update public.guardian_access_credentials
  set locked_until = null,
      failed_attempts = 0
  where id = v_credential_id;

  -- Successful login returns a raw token once; dashboard returns only allowlisted data.
  v_response := public.guardian_begin_session(lower(v_join_code), lower(v_formatted_secret));
  if not coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Valid Guardian login failed: %', v_response;
  end if;

  v_session_token := v_response->>'sessionToken';
  if v_session_token is null or length(v_session_token) <> 64 then
    raise exception 'Guardian login returned an invalid session token';
  end if;

  v_dashboard := public.guardian_fetch_dashboard(v_session_token);
  if not coalesce((v_dashboard->>'ok')::boolean, false) then
    raise exception 'Valid Guardian session could not fetch dashboard: %', v_dashboard;
  end if;

  if v_dashboard #>> '{data,student,displayName}' <> 'Guardian Test Student' then
    raise exception 'Guardian dashboard returned the wrong student';
  end if;

  if v_dashboard #>> '{data,class,displayMode}' <> 'points' then
    raise exception 'Regular class did not resolve to points display mode';
  end if;

  if position('FORBIDDEN OTHER STUDENT 27C' in v_dashboard::text) > 0
     or position('PRIVATE SUBMISSION TEXT MUST NOT LEAK' in v_dashboard::text) > 0
     or position('INTERNAL REASON MUST NOT LEAK' in v_dashboard::text) > 0
     or position('PRIVATE TEACHER REASON MUST NOT LEAK' in v_dashboard::text) > 0
     or position('PRIVATE METADATA MUST NOT LEAK' in v_dashboard::text) > 0 then
    raise exception 'Guardian dashboard leaked denylisted data: %', v_dashboard;
  end if;

  if v_dashboard #> '{data,class,id}' is not null
     or v_dashboard #> '{data,student,id}' is not null
     or v_dashboard #> '{data,student,pin}' is not null then
    raise exception 'Guardian dashboard leaked an internal ID or PIN';
  end if;

  if jsonb_array_length(v_dashboard #> '{data,tasks}') <> 1
     or jsonb_array_length(v_dashboard #> '{data,badges}') <> 1
     or jsonb_array_length(v_dashboard #> '{data,recentProgress}') <> 1 then
    raise exception 'Guardian dashboard did not return expected allowlisted progress data';
  end if;

  -- Logout is idempotent and invalidates the token.
  perform public.guardian_end_session(v_session_token);
  perform public.guardian_end_session(v_session_token);

  v_response := public.guardian_fetch_dashboard(v_session_token);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Revoked Guardian session unexpectedly remained valid';
  end if;

  -- Archived classes invalidate existing sessions without exposing the reason.
  v_response := public.guardian_begin_session(v_join_code, v_formatted_secret);
  v_second_session_token := v_response->>'sessionToken';

  update public.classes set is_archived = true where id = v_class_id;

  v_response := public.guardian_fetch_dashboard(v_second_session_token);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Archived class Guardian session unexpectedly remained valid';
  end if;

  v_session_hash := encode(
    extensions.digest(convert_to(lower(v_second_session_token), 'UTF8'), 'sha256'),
    'hex'
  );

  select revoked_at into v_revoked_at
  from public.guardian_sessions
  where session_hash = v_session_hash;

  if v_revoked_at is null then
    raise exception 'Archived-class session was rejected but not revoked';
  end if;

  update public.classes set is_archived = false where id = v_class_id;

  -- Expired sessions are rejected and revoked.
  v_response := public.guardian_begin_session(v_join_code, v_formatted_secret);
  v_session_token := v_response->>'sessionToken';
  v_session_hash := encode(
    extensions.digest(convert_to(lower(v_session_token), 'UTF8'), 'sha256'),
    'hex'
  );

  update public.guardian_sessions
  set created_at = now() - interval '2 days',
      expires_at = now() - interval '1 day'
  where session_hash = v_session_hash;

  v_response := public.guardian_fetch_dashboard(v_session_token);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Expired Guardian session unexpectedly remained valid';
  end if;

  select revoked_at into v_revoked_at
  from public.guardian_sessions
  where session_hash = v_session_hash;

  if v_revoked_at is null then
    raise exception 'Expired Guardian session was rejected but not revoked';
  end if;

  -- Disabling a credential immediately revokes its active sessions.
  v_response := public.guardian_begin_session(v_join_code, v_formatted_secret);
  v_session_token := v_response->>'sessionToken';

  update public.guardian_access_credentials
  set is_active = false
  where id = v_credential_id;

  v_response := public.guardian_fetch_dashboard(v_session_token);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Disabled Guardian credential left an active session valid';
  end if;

  update public.guardian_access_credentials
  set is_active = true
  where id = v_credential_id;

  -- Rotating the password hash revokes old sessions and invalidates the old code.
  v_response := public.guardian_begin_session(v_join_code, v_formatted_secret);
  v_session_token := v_response->>'sessionToken';

  update public.guardian_access_credentials
  set secret_hash = extensions.crypt(v_rotated_secret, extensions.gen_salt('bf', 10)),
      secret_hint = right(v_rotated_secret, 4)
  where id = v_credential_id;

  v_response := public.guardian_fetch_dashboard(v_session_token);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Credential rotation left an old Guardian session valid';
  end if;

  v_response := public.guardian_begin_session(v_join_code, v_formatted_secret);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Old Guardian code unexpectedly worked after rotation';
  end if;

  v_response := public.guardian_begin_session(v_join_code, v_formatted_rotated_secret);
  if not coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Rotated Guardian code did not authenticate';
  end if;
  perform public.guardian_end_session(v_response->>'sessionToken');

  -- Expired credentials fail generically.
  update public.guardian_access_credentials
  set created_at = now() - interval '2 days',
      expires_at = now() - interval '1 day'
  where id = v_credential_id;

  v_response := public.guardian_begin_session(v_join_code, v_formatted_rotated_secret);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Expired Guardian credential unexpectedly succeeded';
  end if;

  update public.guardian_access_credentials
  set created_at = now(),
      expires_at = null
  where id = v_credential_id;
end;
$$;

rollback;
