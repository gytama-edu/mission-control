-- Phase 18J-C: Restore Student RPC Functions
-- Apply this in the Supabase SQL Editor if student login fails after RLS lockdown.

-- Ensure the functions exist with exactly the required parameters.

CREATE OR REPLACE FUNCTION public.student_login_by_code_and_pin(
  p_class_code text,
  p_student_pin text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_class record;
  v_student record;
  v_students_json jsonb;
  v_meetings_json jsonb;
BEGIN
  -- Find class
  SELECT * INTO v_class
  FROM classes
  WHERE upper(join_code) = upper(trim(p_class_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  END IF;

  IF v_class.is_archived THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'archived_class');
  END IF;

  -- Find student
  SELECT * INTO v_student
  FROM students
  WHERE class_id = v_class.id
    AND trim(pin) = trim(p_student_pin);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  END IF;

  -- Get class students (omit PINs of others to prevent leakage)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'nickname', s.nickname,
      'lives', s.lives,
      'points', s.points,
      'joinedAt', s.created_at,
      'pin', CASE WHEN s.id = v_student.id THEN s.pin ELSE null END
    ) ORDER BY s.points DESC
  ), '[]'::jsonb)
  INTO v_students_json
  FROM students s
  WHERE s.class_id = v_class.id;

  -- Get class meetings
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'class_id', m.class_id,
      'startedAt', m.started_at,
      'endedAt', m.ended_at,
      'status', m.status,
      'resetLivesTo', m.reset_lives_to,
      'summary', m.summary,
      'teacherId', m.teacher_id
    ) ORDER BY m.started_at DESC
  ), '[]'::jsonb)
  INTO v_meetings_json
  FROM meetings m
  WHERE m.class_id = v_class.id;

  -- Return payload
  RETURN jsonb_build_object(
    'ok', true,
    'classData', jsonb_build_object(
      'id', v_class.id,
      'name', v_class.name,
      'level', v_class.level,
      'maxLives', v_class.max_lives,
      'joinCode', v_class.join_code,
      'teacherId', v_class.teacher_id,
      'createdAt', v_class.created_at,
      'isArchived', coalesce(v_class.is_archived, false),
      'students', v_students_json,
      'meetings', v_meetings_json
    ),
    'studentData', jsonb_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'nickname', v_student.nickname,
      'lives', v_student.lives,
      'points', v_student.points,
      'pin', v_student.pin,
      'joinedAt', v_student.created_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.student_login_by_code_and_pin(text, text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.student_fetch_dashboard_data(
  p_class_id uuid,
  p_student_id uuid,
  p_student_pin text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_class record;
  v_student record;
  v_students_json jsonb;
  v_meetings_json jsonb;
  v_tasks_json jsonb;
  v_task_groups_json jsonb;
  v_group_members_json jsonb;
  v_submissions_json jsonb;
  v_attachments_json jsonb;
  v_badges_json jsonb;
  v_logs_json jsonb;
  v_group_ids uuid[];
BEGIN
  -- Find class
  SELECT * INTO v_class
  FROM classes
  WHERE id = p_class_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  IF v_class.is_archived THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'archived_class');
  END IF;

  -- Find student
  SELECT * INTO v_student
  FROM students
  WHERE class_id = v_class.id
    AND id = p_student_id
    AND trim(pin) = trim(p_student_pin);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  -- Students
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'nickname', s.nickname,
      'lives', s.lives,
      'points', s.points,
      'joinedAt', s.created_at,
      'pin', CASE WHEN s.id = v_student.id THEN s.pin ELSE null END
    ) ORDER BY s.points DESC
  ), '[]'::jsonb)
  INTO v_students_json
  FROM students s
  WHERE s.class_id = v_class.id;

  -- Meetings
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'class_id', m.class_id,
      'startedAt', m.started_at,
      'endedAt', m.ended_at,
      'status', m.status,
      'resetLivesTo', m.reset_lives_to,
      'summary', m.summary,
      'teacherId', m.teacher_id
    ) ORDER BY m.started_at DESC
  ), '[]'::jsonb)
  INTO v_meetings_json
  FROM meetings m
  WHERE m.class_id = v_class.id;

  -- Tasks (published or closed)
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_tasks_json
  FROM tasks t
  WHERE t.class_id = v_class.id
    AND t.status IN ('published', 'closed');

  -- Task group memberships for this student
  SELECT coalesce(array_agg(tgm.task_group_id), ARRAY[]::uuid[])
  INTO v_group_ids
  FROM task_group_members tgm
  WHERE tgm.student_id = v_student.id;

  -- Get task groups the student belongs to
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'task_id', tgm.task_id,
    'task_group_id', tgm.task_group_id,
    'name', tg.name
  )), '[]'::jsonb)
  INTO v_task_groups_json
  FROM task_group_members tgm
  JOIN task_groups tg ON tg.id = tgm.task_group_id
  WHERE tgm.student_id = v_student.id;

  -- Get members of those groups
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'task_group_id', tgm.task_group_id,
    'student_name', s.name,
    'student_nickname', s.nickname
  )), '[]'::jsonb)
  INTO v_group_members_json
  FROM task_group_members tgm
  JOIN students s ON s.id = tgm.student_id
  WHERE tgm.task_group_id = ANY(v_group_ids);

  -- Submissions
  SELECT coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  INTO v_submissions_json
  FROM task_submissions sub
  WHERE sub.class_id = v_class.id
    AND (sub.student_id = v_student.id OR sub.task_group_id = ANY(v_group_ids));

  -- Attachments
  SELECT coalesce(jsonb_agg(to_jsonb(att)), '[]'::jsonb)
  INTO v_attachments_json
  FROM submission_attachments att
  WHERE att.class_id = v_class.id
    AND (att.student_id = v_student.id OR att.task_group_id = ANY(v_group_ids));

  -- Badges
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', sb.id,
    'badge_id', sb.badge_id,
    'class_id', sb.class_id,
    'student_id', sb.student_id,
    'awarded_by', sb.awarded_by,
    'awarded_reason', sb.awarded_reason,
    'source', sb.source,
    'metadata', sb.metadata,
    'awarded_at', sb.awarded_at,
    'badge', to_jsonb(bd)
  )), '[]'::jsonb)
  INTO v_badges_json
  FROM student_badges sb
  JOIN badge_definitions bd ON bd.id = sb.badge_id
  WHERE sb.student_id = v_student.id;

  -- Logs
  SELECT coalesce(jsonb_agg(to_jsonb(log)), '[]'::jsonb)
  INTO v_logs_json
  FROM activity_logs log
  WHERE log.class_id = v_class.id
    AND log.student_id = v_student.id
  ORDER BY log.created_at DESC;

  RETURN jsonb_build_object(
    'ok', true,
    'classData', jsonb_build_object(
      'id', v_class.id,
      'name', v_class.name,
      'level', v_class.level,
      'maxLives', v_class.max_lives,
      'joinCode', v_class.join_code,
      'teacherId', v_class.teacher_id,
      'createdAt', v_class.created_at,
      'isArchived', coalesce(v_class.is_archived, false),
      'students', v_students_json,
      'meetings', v_meetings_json
    ),
    'studentData', jsonb_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'nickname', v_student.nickname,
      'lives', v_student.lives,
      'points', v_student.points,
      'pin', v_student.pin,
      'joinedAt', v_student.created_at
    ),
    'tasks', v_tasks_json,
    'taskGroups', v_task_groups_json,
    'groupMembers', v_group_members_json,
    'submissions', v_submissions_json,
    'attachments', v_attachments_json,
    'badges', v_badges_json,
    'logs', v_logs_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.student_fetch_dashboard_data(uuid, uuid, text) TO anon, authenticated;

-- Reload schema cache so PostgREST picks up the definitions/grants
NOTIFY pgrst, 'reload schema';
