const fs = require('fs');
let content = fs.readFileSync('supabase/schema.sql', 'utf8');

const regex = /CREATE OR REPLACE FUNCTION public\.verify_guardian_access\([\s\S]*?END;\n\$\$;\n\nGRANT EXECUTE ON FUNCTION public\.verify_guardian_access\(text, text\) TO anon, authenticated;/g;

const newFunc = `CREATE OR REPLACE FUNCTION public.verify_guardian_access(
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

  -- 5. Submissions (only this student)
  SELECT coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  INTO v_submissions_json
  FROM task_submissions sub
  WHERE sub.class_id = v_class.id
    AND sub.student_id = v_student.id;

  -- 6. Badges
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', sb.id,
    'badge_id', sb.badge_id,
    'awarded_reason', sb.awarded_reason,
    'awarded_at', sb.awarded_at,
    'badge', to_jsonb(bd)
  )), '[]'::jsonb)
  INTO v_badges_json
  FROM student_badges sb
  JOIN badge_definitions bd ON bd.id = sb.badge_id
  WHERE sb.student_id = v_student.id;

  -- 7. Logs (only for this student)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', log.id,
    'action_type', log.action_type,
    'points_delta', log.points_delta,
    'lives_delta', log.lives_delta,
    'created_at', log.created_at,
    'metadata', log.metadata
  )), '[]'::jsonb)
  INTO v_logs_json
  FROM (
    SELECT *
    FROM activity_logs
    WHERE class_id = v_class.id
      AND student_id = v_student.id
    ORDER BY created_at DESC
    LIMIT 100
  ) log;

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
      'lives', v_student.lives,
      'badges_count', (SELECT count(*) FROM student_badges WHERE student_id = v_student.id)
    ),
    'tasks', v_tasks_json,
    'submissions', v_submissions_json,
    'badges', v_badges_json,
    'logs', v_logs_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_guardian_access(text, text) TO anon, authenticated;`;

if (content.match(regex)) {
  content = content.replace(regex, newFunc);
  fs.writeFileSync('supabase/schema.sql', content);
  fs.writeFileSync('supabase/migrations/20260704_verify_guardian_access.sql', newFunc);
  console.log('Replaced successfully.');
} else {
  console.log('regex not matched');
}

