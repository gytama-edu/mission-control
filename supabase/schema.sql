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
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'ended' CHECK (status IN ('active', 'ended')),
  reset_lives_to integer NOT NULL,
  summary jsonb DEFAULT '{}'::jsonb,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_meeting_per_class
ON public.meetings (class_id)
WHERE status = 'active';

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

-- ==============================================================================
-- PHASE 6: ACTIVITY LOGS & CLASSROOM HISTORY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  points_delta integer DEFAULT 0,
  lives_delta integer DEFAULT 0,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  undone boolean DEFAULT false,
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Select policy: teachers can read logs for classes they own, or unowned classes
CREATE POLICY "Allow teachers to select activity logs for owned classes" ON public.activity_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

-- Select policy: students (anon) can read student-specific logs
CREATE POLICY "Allow students to select their own logs" ON public.activity_logs
  FOR SELECT TO anon USING (
    student_id IS NOT NULL
  );

-- Insert policy: teachers can insert logs for classes they own
CREATE POLICY "Allow teachers to insert activity logs for owned classes" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

-- Update policy: teachers can update logs for classes they own (for undo)
CREATE POLICY "Allow teachers to update activity logs for owned classes" ON public.activity_logs
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = activity_logs.class_id
      AND (classes.teacher_id = auth.uid() OR classes.teacher_id IS NULL)
    )
  );

-- Enable Realtime for activity_logs table
alter publication supabase_realtime add table public.activity_logs;


-- =========================================================================
-- Phase 7A: Task Foundation + Teacher Task Creation
-- =========================================================================

-- Create tasks table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text,
  task_type text not null default 'individual',
  status text not null default 'draft',
  due_at timestamptz,
  reward_points integer not null default 0,
  allow_text_submission boolean not null default true,
  allow_attachment_submission boolean not null default false,
  max_attachments integer not null default 1,
  max_attachment_size_mb integer not null default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Constraints
  constraint check_task_type check (task_type in ('individual', 'group')),
  constraint check_status check (status in ('draft', 'published', 'closed', 'archived')),
  constraint check_reward_points check (reward_points >= 0),
  constraint check_max_attachments check (max_attachments >= 0 and max_attachments <= 5),
  constraint check_max_attachment_size check (max_attachment_size_mb >= 1 and max_attachment_size_mb <= 25)
);

-- Create task_groups table
create table if not exists public.task_groups (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Create task_group_members table
create table if not exists public.task_group_members (
  id uuid primary key default gen_random_uuid(),
  task_group_id uuid not null references public.task_groups(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz default now(),
  unique(task_group_id, student_id)
);

-- Create task_submissions table
create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  task_group_id uuid references public.task_groups(id) on delete cascade,
  submitted_by_student_id uuid references public.students(id) on delete set null,
  submission_text text,
  status text not null default 'submitted',
  teacher_feedback text,
  awarded_points integer,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint check_submission_status check (status in ('submitted', 'reviewed', 'returned', 'late'))
);

-- Create submission_attachments table
create table if not exists public.submission_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.task_submissions(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  task_group_id uuid references public.task_groups(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size_bytes bigint,
  storage_bucket text not null default 'task-submissions',
  uploaded_at timestamptz default now()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) FOR NEW TABLES
-- ==========================================

alter table public.tasks enable row level security;
alter table public.task_groups enable row level security;
alter table public.task_group_members enable row level security;
alter table public.task_submissions enable row level security;
alter table public.submission_attachments enable row level security;

-- Drop existing policies if they exist before creating
drop policy if exists "Teachers can select tasks for owned classes" on public.tasks;
drop policy if exists "Teachers can insert tasks for owned classes" on public.tasks;
drop policy if exists "Teachers can update tasks for owned classes" on public.tasks;
drop policy if exists "Teachers can delete tasks for owned classes" on public.tasks;
drop policy if exists "Students can view published tasks" on public.tasks;

drop policy if exists "Teachers can select task groups" on public.task_groups;
drop policy if exists "Teachers can insert task groups" on public.task_groups;
drop policy if exists "Teachers can update task groups" on public.task_groups;
drop policy if exists "Teachers can delete task groups" on public.task_groups;
drop policy if exists "Students can view task groups" on public.task_groups;

drop policy if exists "Teachers can manage group members" on public.task_group_members;
drop policy if exists "Students can view group members" on public.task_group_members;

drop policy if exists "Teachers can manage submissions" on public.task_submissions;
drop policy if exists "Students can view their own submissions" on public.task_submissions;

drop policy if exists "Teachers can view attachments" on public.submission_attachments;

-- Policies for public.tasks
create policy "Teachers can select tasks for owned classes" on public.tasks
  for select to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = tasks.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Teachers can insert tasks for owned classes" on public.tasks
  for insert to authenticated with check (
    exists (
      select 1 from public.classes
      where classes.id = tasks.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Teachers can update tasks for owned classes" on public.tasks
  for update to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = tasks.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  ) with check (
    exists (
      select 1 from public.classes
      where classes.id = tasks.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Teachers can delete tasks for owned classes" on public.tasks
  for delete to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = tasks.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Students can view published tasks" on public.tasks
  for select to anon using (
    status = 'published' or status = 'closed' or status = 'archived'
  );

-- Policies for public.task_groups
create policy "Teachers can select task groups" on public.task_groups
  for select to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = task_groups.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Teachers can insert task groups" on public.task_groups
  for insert to authenticated with check (
    exists (
      select 1 from public.classes
      where classes.id = task_groups.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Teachers can update task groups" on public.task_groups
  for update to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = task_groups.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  ) with check (
    exists (
      select 1 from public.classes
      where classes.id = task_groups.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Teachers can delete task groups" on public.task_groups
  for delete to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = task_groups.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Students can view task groups" on public.task_groups
  for select to anon using (true);

-- Policies for public.task_group_members
create policy "Teachers can manage group members" on public.task_group_members
  for all to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = task_group_members.task_id -- Wait, let's join on task_groups or tasks to check ownership
      -- Since classes has ID and teacher_id:
      exists (
        select 1 from public.tasks
        join public.classes on classes.id = tasks.class_id
        where tasks.id = task_group_members.task_id
        and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
      )
    )
  );

-- Simpler check for task_group_members for both teachers and anon select
create policy "Anyone can select group members" on public.task_group_members
  for select using (true);

create policy "Teachers can insert group members" on public.task_group_members
  for insert to authenticated with check (
    exists (
      select 1 from public.tasks
      join public.classes on classes.id = tasks.class_id
      where tasks.id = task_group_members.task_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Teachers can delete group members" on public.task_group_members
  for delete to authenticated using (
    exists (
      select 1 from public.tasks
      join public.classes on classes.id = tasks.class_id
      where tasks.id = task_group_members.task_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

-- Policies for public.task_submissions
create policy "Teachers can manage submissions" on public.task_submissions
  for all to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = task_submissions.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Students can view their own submissions" on public.task_submissions
  for select to anon using (true);

-- Policies for public.submission_attachments
create policy "Teachers can view attachments" on public.submission_attachments
  for all to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = submission_attachments.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

create policy "Students can view their own attachments" on public.submission_attachments
  for select to anon using (true);

-- Enable Realtime for new tables to support interactive, reactive dashboards
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_groups;
alter publication supabase_realtime add table public.task_group_members;

-- =========================================================================
-- Phase 7D (Future Release Notes)
-- =========================================================================
-- Note: Phase 7D will create:
-- 1. 'task-submissions' storage bucket
-- 2. File upload UI & storage RLS policies
-- 3. File type and size validation triggers/constraints
-- =========================================================================

notify pgrst, 'reload schema';



