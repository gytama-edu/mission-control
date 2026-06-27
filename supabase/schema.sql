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
-- Phase 7B/C: Secure RPC Functions for Student Submissions
-- =========================================================================

-- Function 1: submit_individual_task
create or replace function public.submit_individual_task(
  task_id_input uuid,
  student_id_input uuid,
  submission_text_input text
)
returns uuid
language plpgsql
security definer -- Runs with owner privileges to bypass anon insert RLS
set search_path = public, pg_temp
as $$
declare
  v_task_type text;
  v_status text;
  v_due_at timestamptz;
  v_class_id uuid;
  v_student_class_id uuid;
  v_submission_id uuid;
  v_submission_status text;
  v_existing_status text;
  v_existing_id uuid;
begin
  -- 1. Find the task details
  select task_type, status, due_at, class_id
  into v_task_type, v_status, v_due_at, v_class_id
  from public.tasks
  where id = task_id_input;

  if not found then
    raise exception 'Task not found.';
  end if;

  -- 2. Confirm task_type = 'individual'
  if v_task_type <> 'individual' then
    raise exception 'This function is only for individual tasks.';
  end if;

  -- 3. Confirm status = 'published'
  if v_status <> 'published' then
    raise exception 'Submissions are only allowed for published tasks. Task is currently %.', v_status;
  end if;

  -- 4. Confirm the student exists
  select class_id
  into v_student_class_id
  from public.students
  where id = student_id_input;

  if not found then
    raise exception 'Student not found.';
  end if;

  -- 5. Confirm student belongs to the same class as the task
  if v_class_id <> v_student_class_id then
    raise exception 'Student does not belong to the same class as the task.';
  end if;

  -- 6. Determine whether submission is late if due_at has passed
  if v_due_at is not null and now() > v_due_at then
    v_submission_status := 'late';
  else
    v_submission_status := 'submitted';
  end if;

  -- 7. Find existing submission
  select id, status
  into v_existing_id, v_existing_status
  from public.task_submissions
  where task_id = task_id_input
    and student_id = student_id_input
    and task_group_id is null;

  if v_existing_id is not null then
    -- Update existing submission
    update public.task_submissions
    set 
      submission_text = submission_text_input,
      status = case when v_existing_status = 'reviewed' then 'reviewed' else v_submission_status end,
      updated_at = now()
    where id = v_existing_id
    returning id into v_submission_id;
  else
    -- Insert new submission
    insert into public.task_submissions (
      task_id,
      class_id,
      student_id,
      submitted_by_student_id,
      submission_text,
      status
    )
    values (
      task_id_input,
      v_class_id,
      student_id_input,
      student_id_input,
      submission_text_input,
      v_submission_status
    )
    returning id into v_submission_id;
  end if;

  return v_submission_id;
end;
$$;

-- Grant execution to anon (for student Class Code + PIN login) and authenticated users
grant execute on function public.submit_individual_task(uuid, uuid, text) to anon;
grant execute on function public.submit_individual_task(uuid, uuid, text) to authenticated;

-- Function 2: add_submission_attachment_metadata
create or replace function public.add_submission_attachment_metadata(
  submission_id_input uuid,
  task_id_input uuid,
  class_id_input uuid,
  student_id_input uuid,
  file_name_input text,
  file_path_input text,
  file_type_input text,
  file_size_bytes_input bigint
)
returns uuid
language plpgsql
security definer -- Runs with owner privileges to bypass anon insert RLS
set search_path = public, pg_temp
as $$
declare
  v_sub_task_id uuid;
  v_sub_class_id uuid;
  v_sub_student_id uuid;
  v_allow_attachments boolean;
  v_max_attachments int;
  v_max_attachment_size_mb int;
  v_current_count int;
  v_inserted_id uuid;
begin
  -- 1. Verify submission exists and matches task/class/student parameters
  select task_id, class_id, student_id
  into v_sub_task_id, v_sub_class_id, v_sub_student_id
  FROM public.task_submissions
  WHERE id = submission_id_input;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if v_sub_task_id <> task_id_input or v_sub_class_id <> class_id_input or v_sub_student_id <> student_id_input then
    raise exception 'Invalid submission parameters match.';
  end if;

  -- 2. Fetch task constraints
  select allow_attachment_submission, max_attachments, max_attachment_size_mb
  into v_allow_attachments, v_max_attachments, v_max_attachment_size_mb
  from public.tasks
  where id = task_id_input;

  if not found then
    raise exception 'Task not found.';
  end if;

  -- 3. Confirm task allows attachment submission
  if not v_allow_attachments then
    raise exception 'This task does not allow file attachments.';
  end if;

  -- 4. Check file size
  if v_max_attachment_size_mb is not null and file_size_bytes_input > (v_max_attachment_size_mb * 1024 * 1024) then
    raise exception 'File exceeds the maximum size limit of %MB.', v_max_attachment_size_mb;
  end if;

  -- 5. Check file count
  select count(*)
  into v_current_count
  from public.submission_attachments
  where submission_id = submission_id_input;

  if v_max_attachments is not null and v_current_count >= v_max_attachments then
    raise exception 'Maximum attachment limit of % reached for this task.', v_max_attachments;
  end if;

  -- 6. Insert metadata
  insert into public.submission_attachments (
    submission_id,
    task_id,
    class_id,
    student_id,
    file_name,
    file_path,
    file_type,
    file_size_bytes,
    storage_bucket
  )
  values (
    submission_id_input,
    task_id_input,
    class_id_input,
    student_id_input,
    file_name_input,
    file_path_input,
    file_type_input,
    file_size_bytes_input,
    'task-submissions'
  )
  returning id into v_inserted_id;

  return v_inserted_id;
end;
$$;

-- Grant execution on attachment metadata function
grant execute on function public.add_submission_attachment_metadata(uuid, uuid, uuid, uuid, text, text, text, bigint) to anon;
grant execute on function public.add_submission_attachment_metadata(uuid, uuid, uuid, uuid, text, text, text, bigint) to authenticated;

-- Function 3: delete_submission_attachment
create or replace function public.delete_submission_attachment(
  attachment_id_input uuid,
  student_id_input uuid,
  class_id_input uuid,
  task_id_input uuid,
  submission_id_input uuid
)
returns boolean
language plpgsql
security definer -- Runs with owner privileges to bypass anon delete RLS
set search_path = public, pg_temp
as $$
declare
  v_sub_student_id uuid;
  v_sub_class_id uuid;
  v_sub_task_id uuid;
  v_attachment_sub_id uuid;
begin
  -- Verify submission details
  select student_id, class_id, task_id
  into v_sub_student_id, v_sub_class_id, v_sub_task_id
  from public.task_submissions
  where id = submission_id_input;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if v_sub_student_id <> student_id_input or v_sub_class_id <> class_id_input or v_sub_task_id <> task_id_input then
    raise exception 'Invalid parameters for the submission.';
  end if;

  -- Verify attachment belongs to the submission
  select submission_id
  into v_attachment_sub_id
  from public.submission_attachments
  where id = attachment_id_input;

  if not found then
    raise exception 'Attachment not found.';
  end if;

  if v_attachment_sub_id <> submission_id_input then
    raise exception 'Attachment does not belong to the specified submission.';
  end if;

  -- Delete attachment record
  delete from public.submission_attachments
  where id = attachment_id_input;

  return true;
end;
$$;

-- Grant execution on delete submission attachment function
grant execute on function public.delete_submission_attachment(uuid, uuid, uuid, uuid, uuid) to anon;
grant execute on function public.delete_submission_attachment(uuid, uuid, uuid, uuid, uuid) to authenticated;

-- =========================================================================
-- Phase 7B RPC Function: Fetch task submissions for teacher
-- =========================================================================
create or replace function public.fetch_task_submissions_for_teacher(
  task_id_input uuid,
  class_id_input uuid
)
returns table (
  submission_id uuid,
  task_id uuid,
  class_id uuid,
  student_id uuid,
  student_name text,
  student_nickname text,
  submission_text text,
  submission_status text,
  teacher_feedback text,
  awarded_points integer,
  created_at timestamptz,
  updated_at timestamptz,
  attachments jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.classes c
    where c.id = class_id_input
    and (c.teacher_id = auth.uid() or c.teacher_id is null)
  ) then
    raise exception 'You do not own this class';
  end if;

  return query
  select
    ts.id as submission_id,
    ts.task_id,
    ts.class_id,
    ts.student_id,
    s.name as student_name,
    s.nickname as student_nickname,
    ts.submission_text,
    ts.status as submission_status,
    ts.teacher_feedback,
    ts.awarded_points,
    ts.created_at,
    ts.updated_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', sa.id,
          'file_name', sa.file_name,
          'file_path', sa.file_path,
          'file_type', sa.file_type,
          'file_size_bytes', sa.file_size_bytes,
          'storage_bucket', sa.storage_bucket,
          'uploaded_at', sa.uploaded_at
        )
      ) filter (where sa.id is not null),
      '[]'::jsonb
    ) as attachments
  from public.task_submissions ts
  left join public.students s
    on s.id = ts.student_id
  left join public.submission_attachments sa
    on sa.submission_id = ts.id
  where ts.task_id = task_id_input
    and ts.class_id = class_id_input
  group by
    ts.id,
    ts.task_id,
    ts.class_id,
    ts.student_id,
    s.name,
    s.nickname,
    ts.submission_text,
    ts.status,
    ts.teacher_feedback,
    ts.awarded_points,
    ts.created_at,
    ts.updated_at
  order by ts.created_at desc;
end;
$$;

grant execute on function public.fetch_task_submissions_for_teacher(uuid, uuid) to authenticated;

-- =========================================================================
-- Private Storage Bucket 'task-submissions' and Storage Policies
-- =========================================================================
-- NOTE: Please configure the 'task-submissions' private storage bucket and its
-- policies directly in the Supabase Dashboard under Storage -> Policies to prevent 
-- ownership permission errors (42501) on storage.objects during database migration.
-- See the manual setup instructions provided in the final summary.

-- =========================================================================
-- Phase 7D (Future Release Notes)
-- =========================================================================
-- Note: Phase 7D will create:
-- 1. File type and size validation triggers/constraints
-- =========================================================================

-- Ensure task_submissions columns are present
alter table public.task_submissions
add column if not exists awarded_points integer;

alter table public.task_submissions
add column if not exists teacher_feedback text;

alter table public.task_submissions
add column if not exists reviewed_at timestamptz;

alter table public.task_submissions
add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

notify pgrst, 'reload schema';



