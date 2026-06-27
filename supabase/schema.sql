-- Supabase Schema for Mission Control Remastered

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text,
  max_lives integer NOT NULL CHECK (max_lives >= 1 AND max_lives <= 20),
  join_code text UNIQUE NOT NULL,
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
-- PHASE 4: TEMPORARY PROTOTYPE POLICIES
-- ==============================================================================
-- WARNING: These policies allow full anonymous access for cloud-sync testing.
-- They are NOT secure for production. Phase 5 will introduce teacher 
-- authentication and stricter RLS policies to lock down access.
-- ==============================================================================

-- Classes temporary policies
CREATE POLICY "Enable all access for anon users on classes"
  ON classes FOR ALL USING (true) WITH CHECK (true);

-- Students temporary policies
CREATE POLICY "Enable all access for anon users on students"
  ON students FOR ALL USING (true) WITH CHECK (true);

-- Meetings temporary policies
CREATE POLICY "Enable all access for anon users on meetings"
  ON meetings FOR ALL USING (true) WITH CHECK (true);
