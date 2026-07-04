const fs = require('fs');
let content = fs.readFileSync('supabase/schema.sql', 'utf8');

const target2 = `  -- 1. Find class
  SELECT * INTO v_class
  FROM classes
  WHERE class_code = UPPER(p_class_code);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- 2. Find student
  SELECT * INTO v_student
  FROM students
  WHERE class_id = v_class.id
    AND guardian_access_code = UPPER(p_guardian_code);

  IF NOT FOUND THEN`;

const replacement2 = `  -- 1. Find class
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

  IF NOT FOUND THEN`;

content = content.replace(target2, replacement2);

// Also we need to fix the return in guardian_fetch_dashboard_data which might reference v_class.scoring_system

const target3 = `    'classData', jsonb_build_object(
      'id', v_class.id,
      'name', v_class.name,
      'level', v_class.level,
      'category', v_class.category,
      'scoring_system', v_class.scoring_system,
      'meetings', v_meetings_json
    ),`;

const replacement3 = `    'classData', jsonb_build_object(
      'id', v_class.id,
      'name', v_class.name,
      'level', v_class.level,
      'category', v_class.class_category,
      'meetings', v_meetings_json
    ),`;

content = content.replace(target3, replacement3);

// wait let's check exactly how it's formatted
fs.writeFileSync('supabase/schema.sql', content);
