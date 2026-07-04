# Phase 25B: Parent Access Code Foundation

## Overview
This phase introduces a secure, read-only foundation for Guardian Access. We established a mechanism for generating unique Guardian Access Codes, updated the teacher roster to manage them, and created a secure gateway for parents to log in using these credentials.

## Database Changes
To safely store Guardian Access Codes without disrupting existing student data, we performed an additive schema migration.

**SQL Migration:**
```sql
-- Add the guardian access code column to the students table
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS guardian_access_code text;

-- RPC for securely fetching minimal student data for guardian login
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
  v_class_id uuid;
  v_class_name text;
  v_category text;
  v_scoring_system text;
  v_student_id uuid;
  v_student_name text;
  v_student_nickname text;
  v_student_points integer;
  v_student_lives integer;
  v_result json;
BEGIN
  -- Find the class
  SELECT id, name, category, scoring_system 
  INTO v_class_id, v_class_name, v_category, v_scoring_system
  FROM classes
  WHERE class_code = UPPER(p_class_code);

  IF v_class_id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- Find the student
  SELECT id, name, nickname, points, lives
  INTO v_student_id, v_student_name, v_student_nickname, v_student_points, v_student_lives
  FROM students
  WHERE class_id = v_class_id
    AND guardian_access_code = UPPER(p_guardian_code);

  IF v_student_id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- Return preview data
  v_result := json_build_object(
    'ok', true,
    'classData', json_build_object(
      'id', v_class_id,
      'name', v_class_name,
      'category', v_category,
      'scoring_system', v_scoring_system
    ),
    'studentData', json_build_object(
      'id', v_student_id,
      'name', v_student_name,
      'nickname', v_student_nickname,
      'points', v_student_points,
      'lives', v_student_lives
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardian_verify_access(text, text) TO anon, authenticated;
```

## Features Implemented
### 1. Code Generation
- New students automatically receive a 6-character, uppercase alphanumeric `guardian_access_code`.
- The generation avoids ambiguous characters (`O`, `0`, `I`, `1`) to ensure readability.
- The Guardian code is kept entirely distinct from the student PIN.

### 2. Teacher Controls (Class Roster)
- The Teacher Roster UI (`ClassDetail.tsx`) now exposes Guardian Access management options.
- The Guardian Code is visible alongside the student PIN.
- The **"Copy Guardian Info"** button copies a parent-friendly login text securely.
- The **"Reset Guardian Code"** button immediately revokes the old code and generates a new one.

### 3. Guardian Login Validation (`GuardianAccess.tsx`)
- The placeholder component in `App.tsx` was replaced with a fully functional login interface.
- It requires both the `Class Code` and the `Guardian Code`.
- Validation is fully delegated to the secure Supabase RPC (`guardian_verify_access`), which returns only the required preview details (no class roster, no rankings, no AI feedback data).
- Invalid credentials yield a generic fallback error to prevent probing.

### 4. Minimal Success State
- Once successfully logged in, Guardians see a minimal, read-only preview showing:
  - The student's display name and class name.
  - Their total points and lives (if applicable).
  - A friendly `Dashboard Being Prepared` notice, outlining what features are coming in Phase 25C.

## Privacy & Security Confirmations
- **No Class Roster Exposure**: Guardians only receive their specific student's data. They cannot view classmates.
- **No Rank/Leaderboard Exposure**: Peer-comparative metadata is intentionally stripped.
- **No Writing Features**: Guardian access is strictly read-only.
- **No AI Feedback / Raw AI Draft Exposure**: AI feedback drafts and history are currently walled off and isolated to the teacher module.
- **No Disruption to Existing Data**: `guardian_access_code` is purely additive. `students` data and student PINs are untouched. 

## Next Steps (Deferred for Phase 25C)
- Development of the full Parent Dashboard.
- Exposing granular task progress, submissions, and finalized teacher reviews.
- Exposing completed teacher feedback.
