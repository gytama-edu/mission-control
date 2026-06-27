-- Supabase Schema for Mission Control Remastered

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text,
  max_lives integer NOT NULL CHECK (max_lives >= 1 AND max_lives <= 20),
  join_code text UNIQUE NOT NULL,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  nickname text,
  pin text NOT NULL,
  lives integer NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, pin)
);

CREATE TABLE meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  reset_lives_to integer NOT NULL
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- PHASE 5: SECURE TEACHER AUTHENTICATION & CLASS OWNERSHIP RLS POLICIES
-- ==============================================================================

-- Classes: Read access for everyone (students look up by class code; teachers view owned classes).
-- Write access restricted to authenticated teachers owning the class or claiming an unowned class.
CREATE POLICY "Allow select for everyone" ON classes
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated teachers to insert classes" ON classes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Allow teachers to update owned or unowned classes" ON classes
  FOR UPDATE TO authenticated USING (auth.uid() = teacher_id OR teacher_id IS NULL) WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Allow teachers to delete owned classes" ON classes
  FOR DELETE TO authenticated USING (auth.uid() = teacher_id);


-- Students: Read access for everyone (so student dashboards can load details).
-- Write access restricted to authenticated teachers who own the class.
CREATE POLICY "Allow select students for everyone" ON students
  FOR SELECT USING (true);

CREATE POLICY "Allow teachers to manage students of owned classes" ON students
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = students.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = students.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );


-- Meetings: Read access for everyone.
-- Write access restricted to authenticated teachers who own the class.
CREATE POLICY "Allow select meetings for everyone" ON meetings
  FOR SELECT USING (true);

CREATE POLICY "Allow teachers to manage meetings of owned classes" ON meetings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = meetings.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = meetings.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );


-- Enable Realtime for the tables (required for postgres_changes subscription)
alter publication supabase_realtime add table public.classes;
alter publication supabase_realtime add table public.students;
alter publication supabase_realtime add table public.meetings;

