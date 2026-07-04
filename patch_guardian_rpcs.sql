CREATE OR REPLACE FUNCTION public.guardian_verify_access(
  p_class_code text,
  p_guardian_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class record;
  v_student record;
  v_result json;
BEGIN
  -- 1. Find the class
  SELECT *
  INTO v_class
  FROM classes
  WHERE upper(join_code) = upper(trim(p_class_code));

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- 2. Find the student
  SELECT *
  INTO v_student
  FROM students
  WHERE class_id = v_class.id
    AND upper(guardian_access_code) = upper(trim(p_guardian_code));

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- 3. Return preview data
  v_result := json_build_object(
    'ok', true,
    'classData', json_build_object(
      'id', v_class.id,
      'name', v_class.name,
      'category', v_class.class_category
    ),
    'studentData', json_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'nickname', v_student.nickname,
      'points', v_student.points,
      'lives', v_student.lives
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardian_verify_access(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guardian_fetch_dashboard_data(
  p_class_code text,
  p_guardian_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_class record;
  v_student record;
  v_meetings_json jsonb;
  v_tasks_json jsonb;
  v_submissions_json jsonb;
  v_badges_json jsonb;
  v_logs_json jsonb;
BEGIN
  -- 1. Find class
  SELECT * INTO v_class
  FROM classes
  WHERE upper(join_code) = upper(trim(p_class_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- 2. Find student
  SELECT * INTO v_student
  FROM students
  WHERE class_id = v_class.id
    AND upper(guardian_access_code) = upper(trim(p_guardian_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- 3. Meetings (Recent sessions)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'startedAt', m.started_at,
      'endedAt', m.ended_at,
      'status', m.status,
      'summary', m.summary
    ) ORDER BY m.started_at DESC
  ), '[]'::jsonb)
  INTO v_meetings_json
  FROM meetings m
  WHERE m.class_id = v_class.id;

  -- 4. Tasks (published or closed)
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_tasks_json
  FROM tasks t
  WHERE t.class_id = v_class.id AND t.status IN ('published', 'closed');

  -- 5. Submissions (for this student)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'task_id', s.task_id,
      'student_id', s.student_id,
      'status', s.status,
      'content', s.content,
      'submitted_at', s.submitted_at,
      'teacher_feedback', s.teacher_feedback,
      'points_awarded', s.points_awarded,
      'attachments', (
        SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
        FROM submission_attachments a
        WHERE a.submission_id = s.id
      )
    )
  ), '[]'::jsonb)
  INTO v_submissions_json
  FROM individual_submissions s
  WHERE s.student_id = v_student.id;

  -- 6. Badges (for this student)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sb.id,
      'badge_id', sb.badge_id,
      'awarded_at', sb.awarded_at,
      'awarded_reason', sb.awarded_reason,
      'source', sb.source,
      'badge', jsonb_build_object(
        'id', b.id,
        'title', b.title,
        'description', b.description,
        'icon_name', b.icon_name,
        'color_theme', b.color_theme,
        'points_value', b.points_value
      )
    )
  ), '[]'::jsonb)
  INTO v_badges_json
  FROM student_badges sb
  JOIN badges b ON sb.badge_id = b.id
  WHERE sb.student_id = v_student.id;

  -- 7. Logs (only relevant ones for this student/class)
  SELECT coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
  INTO v_logs_json
  FROM activity_logs l
  WHERE l.class_id = v_class.id
    AND (l.student_id = v_student.id OR l.student_id IS NULL)
    AND l.action_type IN ('points_changed', 'lives_changed', 'badge_awarded', 'task_submitted', 'task_reviewed', 'student_added', 'meeting_started', 'meeting_ended')
  ORDER BY l.created_at DESC
  LIMIT 50;

  -- Return aggregated data
  RETURN jsonb_build_object(
    'ok', true,
    'classData', jsonb_build_object(
      'id', v_class.id,
      'name', v_class.name,
      'level', v_class.level,
      'category', v_class.class_category,
      'meetings', v_meetings_json
    ),
    'studentData', jsonb_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'nickname', v_student.nickname,
      'points', v_student.points,
      'lives', v_student.lives
    ),
    'tasks', v_tasks_json,
    'submissions', v_submissions_json,
    'badges', v_badges_json,
    'logs', v_logs_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardian_fetch_dashboard_data(text, text) TO anon, authenticated;

-- Ensure PostgREST cache is reloaded
NOTIFY pgrst, 'reload schema';
