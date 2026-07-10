-- Phase 27D verification script
--
-- Prerequisites:
-- 1. Apply Phase 27B.
-- 2. Apply Phase 27C.
-- 3. Apply Phase 27D.
-- 4. Run as a database owner in a non-production environment.
--
-- All fixture data is rolled back.

begin;

do $$
declare
  v_teacher_id uuid := gen_random_uuid();
  v_other_teacher_id uuid := gen_random_uuid();
  v_class_id uuid;
  v_other_class_id uuid;
  v_student_id uuid;
  v_second_student_id uuid;
  v_other_student_id uuid;
  v_join_code text := 'G27D' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_other_join_code text := 'X27D' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_response jsonb;
  v_status jsonb;
  v_guardian_code text;
  v_rotated_code text;
  v_session_token text;
  v_normalized_code text;
  v_lookup_key text;
  v_secret_hash text;
  v_hint text;
  v_revoked_at timestamptz;
begin
  if has_function_privilege('anon', 'public.guardian_teacher_list_credentials(uuid)', 'execute')
     or has_function_privilege('anon', 'public.guardian_teacher_create_credential(uuid)', 'execute')
     or has_function_privilege('anon', 'public.guardian_teacher_rotate_credential(uuid)', 'execute')
     or has_function_privilege('anon', 'public.guardian_teacher_set_credential_active(uuid,boolean)', 'execute') then
    raise exception 'anon unexpectedly has execute access to a teacher Guardian RPC';
  end if;

  if not has_function_privilege('authenticated', 'public.guardian_teacher_list_credentials(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.guardian_teacher_create_credential(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.guardian_teacher_rotate_credential(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.guardian_teacher_set_credential_active(uuid,boolean)', 'execute') then
    raise exception 'authenticated is missing a Phase 27D RPC execute grant';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      v_teacher_id,
      'authenticated',
      'authenticated',
      'phase27d-teacher@example.test',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_other_teacher_id,
      'authenticated',
      'authenticated',
      'phase27d-other@example.test',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );

  insert into public.classes (
    name, level, max_lives, join_code, teacher_id, is_archived, class_category
  )
  values (
    'Guardian Teacher Control Test', 'Test', 5, v_join_code, v_teacher_id, false, 'regular'
  )
  returning id into v_class_id;

  insert into public.classes (
    name, level, max_lives, join_code, teacher_id, is_archived, class_category
  )
  values (
    'Forbidden Other Teacher Class', 'Test', 5, v_other_join_code, v_other_teacher_id, false, 'regular'
  )
  returning id into v_other_class_id;

  insert into public.students (class_id, name, nickname, pin, lives, points)
  values (v_class_id, 'Teacher-Owned Student', 'Owned', '2711', 5, 50)
  returning id into v_student_id;

  insert into public.students (class_id, name, nickname, pin, lives, points)
  values (v_class_id, 'Second Owned Student', null, '2712', 5, 50)
  returning id into v_second_student_id;

  insert into public.students (class_id, name, nickname, pin, lives, points)
  values (v_other_class_id, 'Forbidden Other Student', null, '2713', 5, 50)
  returning id into v_other_student_id;

  perform set_config('request.jwt.claim.sub', v_teacher_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Initial status returns both owned students and no secrets.
  v_status := public.guardian_teacher_list_credentials(v_class_id);
  if not coalesce((v_status->>'ok')::boolean, false) then
    raise exception 'Teacher could not list Guardian credential status: %', v_status;
  end if;

  if jsonb_array_length(v_status->'students') <> 2 then
    raise exception 'Teacher status list did not return exactly the owned class roster';
  end if;

  if position('guardianCode' in v_status::text) > 0
     or position('secret_hash' in v_status::text) > 0
     or position('lookup_key' in v_status::text) > 0
     or position('Forbidden Other Student' in v_status::text) > 0 then
    raise exception 'Teacher status list leaked a secret field or another class student: %', v_status;
  end if;

  -- Cross-teacher class listing is rejected.
  begin
    perform public.guardian_teacher_list_credentials(v_other_class_id);
    raise exception 'Teacher unexpectedly listed another teacher class';
  exception
    when sqlstate '42501' then null;
  end;

  -- Create returns a one-time formatted code.
  v_response := public.guardian_teacher_create_credential(v_student_id);
  if not coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Teacher could not create Guardian credential: %', v_response;
  end if;

  v_guardian_code := v_response->>'guardianCode';
  if v_guardian_code is null
     or v_guardian_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$' then
    raise exception 'Created Guardian code has an invalid format: %', v_guardian_code;
  end if;

  v_normalized_code := replace(v_guardian_code, '-', '');

  select lookup_key, secret_hash, secret_hint
  into v_lookup_key, v_secret_hash, v_hint
  from public.guardian_access_credentials
  where student_id = v_student_id;

  if v_lookup_key <> left(v_normalized_code, 8)
     or v_hint <> right(v_normalized_code, 4)
     or v_secret_hash = v_normalized_code
     or extensions.crypt(v_normalized_code, v_secret_hash) <> v_secret_hash then
    raise exception 'Created credential was not stored with the expected lookup/hash/hint model';
  end if;

  -- Creating twice does not reveal or replace the existing code.
  v_response := public.guardian_teacher_create_credential(v_student_id);
  if coalesce((v_response->>'ok')::boolean, false)
     or v_response->>'reason' <> 'already_configured'
     or v_response ? 'guardianCode' then
    raise exception 'Duplicate creation did not fail safely: %', v_response;
  end if;

  -- Cross-teacher creation is rejected.
  begin
    perform public.guardian_teacher_create_credential(v_other_student_id);
    raise exception 'Teacher unexpectedly created access for another teacher student';
  exception
    when sqlstate '42501' then null;
  end;

  -- Generated code integrates with the Phase 27C login surface.
  v_response := public.guardian_begin_session(lower(v_join_code), lower(v_guardian_code));
  if not coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Generated Guardian code did not authenticate: %', v_response;
  end if;
  v_session_token := v_response->>'sessionToken';

  -- Disabling revokes existing sessions and changes list status.
  v_response := public.guardian_teacher_set_credential_active(v_student_id, false);
  if not coalesce((v_response->>'ok')::boolean, false)
     or v_response->>'credentialState' <> 'disabled' then
    raise exception 'Teacher could not disable Guardian access: %', v_response;
  end if;

  v_response := public.guardian_fetch_dashboard(v_session_token);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Disabled credential left an existing Guardian session active';
  end if;

  v_status := public.guardian_teacher_list_credentials(v_class_id);
  if not exists (
    select 1
    from jsonb_array_elements(v_status->'students') item
    where item->>'studentId' = v_student_id::text
      and item->>'credentialState' = 'disabled'
  ) then
    raise exception 'Disabled state was not reflected in the teacher status list: %', v_status;
  end if;

  -- Enabling keeps the same code but old sessions remain revoked.
  v_response := public.guardian_teacher_set_credential_active(v_student_id, true);
  if not coalesce((v_response->>'ok')::boolean, false)
     or v_response->>'credentialState' <> 'active' then
    raise exception 'Teacher could not enable Guardian access: %', v_response;
  end if;

  v_response := public.guardian_begin_session(v_join_code, v_guardian_code);
  if not coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Re-enabled Guardian code did not authenticate: %', v_response;
  end if;
  v_session_token := v_response->>'sessionToken';

  -- Rotation returns a different code, revokes old sessions, and invalidates the old code.
  v_response := public.guardian_teacher_rotate_credential(v_student_id);
  if not coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Teacher could not rotate Guardian access: %', v_response;
  end if;

  v_rotated_code := v_response->>'guardianCode';
  if v_rotated_code is null or v_rotated_code = v_guardian_code then
    raise exception 'Rotation did not return a new one-time Guardian code';
  end if;

  v_response := public.guardian_fetch_dashboard(v_session_token);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Rotation left an old Guardian session active';
  end if;

  v_response := public.guardian_begin_session(v_join_code, v_guardian_code);
  if coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Old Guardian code unexpectedly authenticated after rotation';
  end if;

  v_response := public.guardian_begin_session(v_join_code, v_rotated_code);
  if not coalesce((v_response->>'ok')::boolean, false) then
    raise exception 'Rotated Guardian code did not authenticate: %', v_response;
  end if;
  perform public.guardian_end_session(v_response->>'sessionToken');

  -- A student without a credential cannot be rotated or enabled.
  v_response := public.guardian_teacher_rotate_credential(v_second_student_id);
  if coalesce((v_response->>'ok')::boolean, false)
     or v_response->>'reason' <> 'not_configured' then
    raise exception 'Rotation of an unconfigured student did not fail safely: %', v_response;
  end if;

  v_response := public.guardian_teacher_set_credential_active(v_second_student_id, true);
  if coalesce((v_response->>'ok')::boolean, false)
     or v_response->>'reason' <> 'not_configured' then
    raise exception 'Enable of an unconfigured student did not fail safely: %', v_response;
  end if;

  -- Status after rotation contains a hint only and never the new code.
  v_status := public.guardian_teacher_list_credentials(v_class_id);
  if position(v_rotated_code in v_status::text) > 0
     or position(replace(v_rotated_code, '-', '') in v_status::text) > 0
     or position('secret_hash' in v_status::text) > 0 then
    raise exception 'Teacher status list exposed a reusable Guardian secret after rotation: %', v_status;
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_status->'students') item
    where item->>'studentId' = v_student_id::text
      and item->>'credentialState' = 'active'
      and item->>'secretHint' = right(replace(v_rotated_code, '-', ''), 4)
  ) then
    raise exception 'Rotated credential hint or active state was not reflected in status: %', v_status;
  end if;
end;
$$;

rollback;
