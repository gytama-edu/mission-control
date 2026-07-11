-- Phase 27F Guardian browser fixture
--
-- Run only against the disposable local Supabase database created by the
-- Guardian validation workflow. The database is destroyed after the job.

begin;

do $$
declare
  v_class_id uuid;
  v_student_id uuid;
  v_task_id uuid;
  v_badge_id uuid;
  v_secret constant text := 'ABCDEFGHJKLMNPQRSTUV';
begin
  insert into public.classes (
    name,
    level,
    max_lives,
    join_code,
    teacher_id,
    is_archived,
    class_category
  )
  values (
    'Guardian Validation Class',
    'Pre-Intermediate',
    5,
    'G27FTEST',
    null,
    false,
    'regular'
  )
  returning id into v_class_id;

  insert into public.students (
    class_id,
    name,
    nickname,
    pin,
    lives,
    points
  )
  values (
    v_class_id,
    'Guardian Validation Student',
    'Nova',
    '7319',
    5,
    73
  )
  returning id into v_student_id;

  insert into public.students (
    class_id,
    name,
    nickname,
    pin,
    lives,
    points
  )
  values (
    v_class_id,
    'FORBIDDEN OTHER STUDENT 27F',
    'Hidden',
    '8462',
    5,
    9999
  );

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
  );

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
    'Guardian Browser Validation Task',
    'A safe published task visible only for the selected student.',
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
    'PRIVATE BROWSER FIXTURE SUBMISSION MUST NOT LEAK',
    'reviewed',
    'Great improvement. Keep building on this progress.',
    9,
    now()
  );

  insert into public.badge_definitions (
    class_id,
    name,
    description,
    icon,
    badge_type,
    is_active
  )
  values (
    v_class_id,
    'Consistency Star',
    'Awarded for steady learning progress.',
    '⭐',
    'manual',
    true
  )
  returning id into v_badge_id;

  insert into public.student_badges (
    badge_id,
    class_id,
    student_id,
    source,
    awarded_reason
  )
  values (
    v_badge_id,
    v_class_id,
    v_student_id,
    'manual',
    'PRIVATE BADGE REASON MUST NOT LEAK'
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
end;
$$;

commit;
