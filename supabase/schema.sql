-- Supabase Schema for Mission Control Remastered

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text,
  max_lives integer NOT NULL CHECK (max_lives >= 1 AND max_lives <= 20),
  join_code text UNIQUE NOT NULL,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_archived boolean NOT NULL DEFAULT false,
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

-- Classes: Read access restricted to owned classes.
-- Write access restricted to authenticated teachers owning the class or claiming an unowned class.
CREATE POLICY "Teachers can select owned classes" ON classes
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());

CREATE POLICY "Allow authenticated teachers to insert classes" ON classes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Allow teachers to update owned or unowned classes" ON classes
  FOR UPDATE TO authenticated USING (auth.uid() = teacher_id OR teacher_id IS NULL) WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Allow teachers to delete owned classes" ON classes
  FOR DELETE TO authenticated USING (auth.uid() = teacher_id);


-- Students: Read access restricted to authenticated teachers who own the class.

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


-- Meetings: Read access restricted to authenticated teachers who own the class.

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

-- Select policy: students (anon) can read student-specific logs via RPC

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
  allow_resubmission boolean not null default true,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id) on delete set null,
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

-- Students can view tasks via RPC

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

-- Students can view task groups via RPC

-- Policies for public.task_group_members
create policy "Teachers can manage group members" on public.task_group_members
  for all to authenticated using (
    exists (
      select 1 from public.tasks
      join public.classes on classes.id = tasks.class_id
      where tasks.id = task_group_members.task_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.tasks
      join public.classes on classes.id = tasks.class_id
      where tasks.id = task_group_members.task_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

-- Simpler check for task_group_members for both teachers and anon select handled via RPC

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

-- Students view submissions via RPC

-- Policies for public.submission_attachments
create policy "Teachers can view attachments" on public.submission_attachments
  for all to authenticated using (
    exists (
      select 1 from public.classes
      where classes.id = submission_attachments.class_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

-- Students view attachments via RPC

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
  v_allow_resubmission boolean;
  v_meeting_id uuid;
begin
  -- 1. Find the task details
  select task_type, status, due_at, class_id, allow_resubmission
  into v_task_type, v_status, v_due_at, v_class_id, v_allow_resubmission
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

  -- Fetch active meeting id if any
  select id into v_meeting_id
  from public.meetings
  where class_id = v_class_id and status = 'active'
  limit 1;

  if v_existing_id is not null then
    -- Check allow_resubmission
    if not v_allow_resubmission and v_existing_status <> 'returned' then
      raise exception 'Resubmission is not allowed for this task.';
    end if;

    -- Update existing submission
    update public.task_submissions
    set 
      submission_text = submission_text_input,
      status = case when v_existing_status = 'returned' then v_submission_status else (case when v_existing_status = 'reviewed' then 'reviewed' else v_submission_status end) end,
      updated_at = now()
    where id = v_existing_id
    returning id into v_submission_id;

    -- Log resubmission
    insert into public.activity_logs (
      class_id,
      student_id,
      meeting_id,
      action_type,
      points_delta,
      reason,
      metadata
    )
    values (
      v_class_id,
      student_id_input,
      v_meeting_id,
      'individual_submission_resubmitted',
      0,
      'Individual task submission resubmitted',
      jsonb_build_object(
        'task_id', task_id_input,
        'submission_id', v_submission_id,
        'student_id', student_id_input
      )
    );
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

    -- Log submission
    insert into public.activity_logs (
      class_id,
      student_id,
      meeting_id,
      action_type,
      points_delta,
      reason,
      metadata
    )
    values (
      v_class_id,
      student_id_input,
      v_meeting_id,
      'individual_submission_submitted',
      0,
      'Individual task submission submitted',
      jsonb_build_object(
        'task_id', task_id_input,
        'submission_id', v_submission_id,
        'student_id', student_id_input
      )
    );
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

-- =========================================================================
-- Phase 7B RPC Function: Review individual submission and award points
-- =========================================================================
create or replace function public.review_individual_submission(
  submission_id_input uuid,
  awarded_points_input integer,
  teacher_feedback_input text
)
returns table (
  submission_id uuid,
  student_id uuid,
  task_id uuid,
  class_id uuid,
  previous_awarded_points integer,
  new_awarded_points integer,
  points_delta integer,
  new_student_points integer,
  submission_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_record public.task_submissions%rowtype;
  task_record public.tasks%rowtype;
  class_record public.classes%rowtype;
  student_record public.students%rowtype;
  old_points integer := 0;
  new_points integer := 0;
  delta_points integer := 0;
  final_student_points integer := 0;
begin
  if awarded_points_input is null then
    new_points := 0;
  else
    new_points := greatest(0, awarded_points_input);
  end if;

  select *
  into submission_record
  from public.task_submissions
  where id = submission_id_input;

  if not found then
    raise exception 'Submission not found';
  end if;

  select *
  into task_record
  from public.tasks
  where id = submission_record.task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  if task_record.task_type <> 'individual' then
    raise exception 'Only individual submissions can be reviewed by this function';
  end if;

  select *
  into class_record
  from public.classes
  where id = submission_record.class_id;

  if not found then
    raise exception 'Class not found';
  end if;

  if class_record.teacher_id is not null and class_record.teacher_id <> auth.uid() then
    raise exception 'You do not own this class';
  end if;

  if submission_record.student_id is null then
    raise exception 'Submission has no student_id';
  end if;

  select *
  into student_record
  from public.students
  where id = submission_record.student_id;

  if not found then
    raise exception 'Student not found';
  end if;

  old_points := coalesce(submission_record.awarded_points, 0);
  delta_points := new_points - old_points;

  update public.task_submissions
  set
    awarded_points = new_points,
    teacher_feedback = teacher_feedback_input,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    status = 'reviewed',
    updated_at = now()
  where id = submission_id_input;

  update public.students
  set points = coalesce(points, 0) + delta_points
  where id = submission_record.student_id
  returning points into final_student_points;

  insert into public.activity_logs (
    teacher_id,
    class_id,
    student_id,
    action_type,
    points_delta,
    reason,
    metadata,
    created_at
  )
  values (
    auth.uid(),
    submission_record.class_id,
    submission_record.student_id,
    'task_reviewed',
    delta_points,
    'Task submission reviewed',
    jsonb_build_object(
      'task_id', submission_record.task_id,
      'submission_id', submission_id_input,
      'task_title', task_record.title,
      'previous_awarded_points', old_points,
      'new_awarded_points', new_points
    ),
    now()
  );

  return query
  select
    submission_id_input,
    submission_record.student_id,
    submission_record.task_id,
    submission_record.class_id,
    old_points,
    new_points,
    delta_points,
    final_student_points,
    'reviewed'::text;
end;
$$;

grant execute on function public.review_individual_submission(uuid, integer, text) to authenticated;

-- =========================================================================
-- Phase 7C: Group Submissions & Group Review Support
-- =========================================================================

-- Ensure metadata columns exist
alter table public.task_submissions
add column if not exists review_metadata jsonb default '{}'::jsonb;

-- Prevent duplicate submissions for the same group and task
create unique index if not exists one_group_submission_per_task_group
on public.task_submissions (task_id, task_group_id)
where task_group_id is not null;

-- RPC 1: submit_group_task
create or replace function public.submit_group_task(
  task_id_input uuid,
  task_group_id_input uuid,
  submitted_by_student_id_input uuid,
  submission_text_input text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task_type text;
  v_status text;
  v_due_at timestamptz;
  v_class_id uuid;
  v_group_class_id uuid;
  v_group_task_id uuid;
  v_student_class_id uuid;
  v_is_member boolean;
  v_submission_id uuid;
  v_submission_status text;
  v_existing_status text;
  v_existing_id uuid;
  v_meeting_id uuid;
  v_is_resubmission boolean := false;
  v_allow_resubmission boolean;
begin
  -- 1. Find the task details
  select task_type, status, due_at, class_id, allow_resubmission
  into v_task_type, v_status, v_due_at, v_class_id, v_allow_resubmission
  from public.tasks
  where id = task_id_input;

  if not found then
    raise exception 'Task not found.';
  end if;

  -- 2. Confirm task_type = 'group'
  if v_task_type <> 'group' then
    raise exception 'This task is not a group task.';
  end if;

  -- 3. Confirm status = 'published'
  if v_status <> 'published' then
    raise exception 'Submissions are only allowed for published tasks.';
  end if;

  -- 4. Confirm task group exists and belongs to the correct class and task
  select class_id, task_id
  into v_group_class_id, v_group_task_id
  from public.task_groups
  where id = task_group_id_input;

  if not found then
    raise exception 'Group not found.';
  end if;

  if v_group_class_id <> v_class_id then
    raise exception 'Group class does not match task class.';
  end if;

  if v_group_task_id <> task_id_input then
    raise exception 'Group is not assigned to this task.';
  end if;

  -- 5. Confirm student exists and belongs to the same class
  select class_id
  into v_student_class_id
  from public.students
  where id = submitted_by_student_id_input;

  if not found then
    raise exception 'Student not found.';
  end if;

  if v_student_class_id <> v_class_id then
    raise exception 'Student class does not match task class.';
  end if;

  -- 6. Confirm student is a member of the group
  select exists (
    select 1
    from public.task_group_members
    where task_group_id = task_group_id_input
      and student_id = submitted_by_student_id_input
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not assigned to this group.';
  end if;

  -- 7. Determine late status if due_at has passed
  if v_due_at is not null and now() > v_due_at then
    v_submission_status := 'late';
  else
    v_submission_status := 'submitted';
  end if;

  -- 8. Fetch active meeting id for log
  select id into v_meeting_id
  from public.meetings
  where class_id = v_class_id and status = 'active'
  limit 1;

  -- 9. Find existing submission
  select id, status
  into v_existing_id, v_existing_status
  from public.task_submissions
  where task_id = task_id_input
    and task_group_id = task_group_id_input;

  if v_existing_id is not null then
    v_is_resubmission := true;
    -- Check allow_resubmission
    if not v_allow_resubmission and v_existing_status <> 'returned' then
      raise exception 'Resubmission is not allowed for this task.';
    end if;

    -- Update existing submission
    update public.task_submissions
    set 
      submission_text = submission_text_input,
      submitted_by_student_id = submitted_by_student_id_input,
      status = case when v_existing_status = 'returned' then v_submission_status else (case when v_existing_status = 'reviewed' then 'reviewed' else v_submission_status end) end,
      updated_at = now()
    where id = v_existing_id
    returning id into v_submission_id;
  else
    -- Insert new submission
    insert into public.task_submissions (
      task_id,
      class_id,
      task_group_id,
      submitted_by_student_id,
      submission_text,
      status
    )
    values (
      task_id_input,
      v_class_id,
      task_group_id_input,
      submitted_by_student_id_input,
      submission_text_input,
      v_submission_status
    )
    returning id into v_submission_id;
  end if;

  -- 10. Log the activity
  insert into public.activity_logs (
    class_id,
    student_id,
    meeting_id,
    action_type,
    points_delta,
    reason,
    metadata
  )
  values (
    v_class_id,
    submitted_by_student_id_input,
    v_meeting_id,
    case when v_is_resubmission then 'group_submission_resubmitted' else 'group_task_submitted' end,
    0,
    case when v_is_resubmission then 'Group task resubmitted' else 'Group task submitted' end,
    jsonb_build_object(
      'task_id', task_id_input,
      'submission_id', v_submission_id,
      'task_group_id', task_group_id_input,
      'submitted_by_student_id', submitted_by_student_id_input
    )
  );

  return v_submission_id;
end;
$$;

grant execute on function public.submit_group_task(uuid, uuid, uuid, text) to anon;
grant execute on function public.submit_group_task(uuid, uuid, uuid, text) to authenticated;


-- RPC 2: add_group_submission_attachment_metadata
create or replace function public.add_group_submission_attachment_metadata(
  submission_id_input uuid,
  task_id_input uuid,
  class_id_input uuid,
  submitted_by_student_id_input uuid,
  task_group_id_input uuid,
  file_name_input text,
  file_path_input text,
  file_type_input text,
  file_size_bytes_input bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub_task_id uuid;
  v_sub_class_id uuid;
  v_sub_task_group_id uuid;
  v_allow_attachments boolean;
  v_max_attachments int;
  v_max_attachment_size_mb int;
  v_current_count int;
  v_inserted_id uuid;
  v_is_member boolean;
  v_task_status text;
  v_meeting_id uuid;
begin
  -- 1. Verify submission exists and matches task/class/group parameters
  select task_id, class_id, task_group_id
  into v_sub_task_id, v_sub_class_id, v_sub_task_group_id
  from public.task_submissions
  where id = submission_id_input;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if v_sub_task_id <> task_id_input or v_sub_class_id <> class_id_input or v_sub_task_group_id <> task_group_id_input then
    raise exception 'Submission metadata parameter mismatch.';
  end if;

  -- 2. Fetch task constraints and status
  select allow_attachment_submission, max_attachments, max_attachment_size_mb, status
  into v_allow_attachments, v_max_attachments, v_max_attachment_size_mb, v_task_status
  from public.tasks
  where id = task_id_input;

  if not found then
    raise exception 'Task not found.';
  end if;

  -- 3. Reject closed/archived
  if v_task_status <> 'published' then
    raise exception 'This task is not open for submission attachments.';
  end if;

  -- 4. Confirm task allows attachment submission
  if not v_allow_attachments then
    raise exception 'This task does not allow file attachments.';
  end if;

  -- 5. Confirm student belongs to the group
  select exists (
    select 1
    from public.task_group_members
    where task_group_id = task_group_id_input
      and student_id = submitted_by_student_id_input
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this group.';
  end if;

  -- 6. Check file size
  if v_max_attachment_size_mb is not null and file_size_bytes_input > (v_max_attachment_size_mb * 1024 * 1024) then
    raise exception 'File exceeds the maximum size limit of %MB.', v_max_attachment_size_mb;
  end if;

  -- 7. Check file count
  select count(*)
  into v_current_count
  from public.submission_attachments
  where submission_id = submission_id_input;

  if v_max_attachments is not null and v_current_count >= v_max_attachments then
    raise exception 'Maximum attachment limit of % reached for this task.', v_max_attachments;
  end if;

  -- 8. Fetch active meeting id for log
  select id into v_meeting_id
  from public.meetings
  where class_id = class_id_input and status = 'active'
  limit 1;

  -- 9. Insert metadata
  insert into public.submission_attachments (
    submission_id,
    task_id,
    class_id,
    student_id,
    task_group_id,
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
    submitted_by_student_id_input,
    task_group_id_input,
    file_name_input,
    file_path_input,
    file_type_input,
    file_size_bytes_input,
    'task-submissions'
  )
  returning id into v_inserted_id;

  -- 10. Log the activity
  insert into public.activity_logs (
    class_id,
    student_id,
    meeting_id,
    action_type,
    points_delta,
    reason,
    metadata
  )
  values (
    class_id_input,
    submitted_by_student_id_input,
    v_meeting_id,
    'group_task_attachment_uploaded',
    0,
    'Group task attachment uploaded',
    jsonb_build_object(
      'task_id', task_id_input,
      'submission_id', submission_id_input,
      'task_group_id', task_group_id_input,
      'file_name', file_name_input,
      'attachment_id', v_inserted_id
    )
  );

  return v_inserted_id;
end;
$$;

grant execute on function public.add_group_submission_attachment_metadata(uuid, uuid, uuid, uuid, uuid, text, text, text, bigint) to anon;
grant execute on function public.add_group_submission_attachment_metadata(uuid, uuid, uuid, uuid, uuid, text, text, text, bigint) to authenticated;


-- RPC 3: fetch_group_task_submissions_for_teacher
create or replace function public.fetch_group_task_submissions_for_teacher(
  task_id_input uuid,
  class_id_input uuid
)
returns table (
  group_id uuid,
  group_name text,
  group_members jsonb,
  submission_id uuid,
  task_id uuid,
  class_id uuid,
  submitted_by_student_id uuid,
  submitted_by_student_name text,
  submitted_by_student_nickname text,
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
      and c.teacher_id = auth.uid()
  ) then
    raise exception 'You do not own this class';
  end if;

  return query
  select
    tg.id as group_id,
    tg.name as group_name,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'student_id', s.id,
            'name', s.name,
            'nickname', s.nickname
          )
          order by s.name
        )
        from public.task_group_members tgm
        join public.students s
          on s.id = tgm.student_id
        where tgm.task_group_id = tg.id
      ),
      '[]'::jsonb
    ) as group_members,
    ts.id as submission_id,
    ts.task_id,
    tg.class_id,
    ts.submitted_by_student_id,
    submitter.name as submitted_by_student_name,
    submitter.nickname as submitted_by_student_nickname,
    ts.submission_text,
    ts.status as submission_status,
    ts.teacher_feedback,
    ts.awarded_points,
    ts.created_at,
    ts.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sa.id,
            'file_name', sa.file_name,
            'file_path', sa.file_path,
            'file_type', sa.file_type,
            'file_size_bytes', sa.file_size_bytes,
            'storage_bucket', sa.storage_bucket,
            'uploaded_at', sa.uploaded_at
          )
          order by sa.uploaded_at desc
        )
        from public.submission_attachments sa
        where sa.submission_id = ts.id
      ),
      '[]'::jsonb
    ) as attachments
  from public.task_groups tg
  left join public.task_submissions ts
    on ts.task_group_id = tg.id
    and ts.task_id = task_id_input
  left join public.students submitter
    on submitter.id = ts.submitted_by_student_id
  where tg.task_id = task_id_input
    and tg.class_id = class_id_input
  order by tg.created_at asc;
end;
$$;

grant execute on function public.fetch_group_task_submissions_for_teacher(uuid, uuid) to authenticated;


-- RPC 4: review_group_submission
create or replace function public.review_group_submission(
  submission_id_input uuid,
  awarded_points_input integer,
  teacher_feedback_input text
)
returns table (
  submission_id uuid,
  task_group_id uuid,
  task_id uuid,
  class_id uuid,
  previous_awarded_points integer,
  new_awarded_points integer,
  points_delta integer,
  awarded_member_count integer,
  submission_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission_record public.task_submissions%rowtype;
  v_task_record public.tasks%rowtype;
  v_class_record public.classes%rowtype;
  v_group_record public.task_groups%rowtype;
  v_old_points integer := 0;
  v_new_points integer := 0;
  v_delta_points integer := 0;
  v_member_ids uuid[];
  v_member_count integer := 0;
  v_meeting_id uuid;
begin
  if awarded_points_input is null then
    v_new_points := 0;
  else
    v_new_points := greatest(0, awarded_points_input);
  end if;

  -- 1. Get submission
  select *
  into v_submission_record
  from public.task_submissions
  where id = submission_id_input;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if v_submission_record.task_group_id is null then
    raise exception 'This submission is not a group submission.';
  end if;

  -- 2. Get task
  select *
  into v_task_record
  from public.tasks
  where id = v_submission_record.task_id;

  if not found then
    raise exception 'Task not found.';
  end if;

  if v_task_record.task_type <> 'group' then
    raise exception 'Task must be a group task.';
  end if;

  -- 3. Get class & ownership check
  select *
  into v_class_record
  from public.classes
  where id = v_submission_record.class_id;

  if not found then
    raise exception 'Class not found.';
  end if;

  if v_class_record.teacher_id is not null and v_class_record.teacher_id <> auth.uid() then
    raise exception 'You do not own this class.';
  end if;

  -- 4. Get group record & active members
  select *
  into v_group_record
  from public.task_groups
  where id = v_submission_record.task_group_id;

  if not found then
    raise exception 'Group not found.';
  end if;

  -- Get list of current group members
  select array_agg(student_id)
  into v_member_ids
  from public.task_group_members
  where task_group_id = v_submission_record.task_group_id;

  v_member_count := coalesce(cardinality(v_member_ids), 0);

  -- 5. Calculate points delta
  v_old_points := coalesce(v_submission_record.awarded_points, 0);
  v_delta_points := v_new_points - v_old_points;

  -- 6. Update submission
  update public.task_submissions
  set
    awarded_points = v_new_points,
    teacher_feedback = teacher_feedback_input,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    status = 'reviewed',
    updated_at = now(),
    review_metadata = jsonb_build_object(
      'awarded_member_ids', to_jsonb(v_member_ids),
      'previous_awarded_points', v_old_points,
      'group_member_count', v_member_count,
      'review_type', 'group'
    )
  where id = submission_id_input;

  -- 7. Add delta points to each current group member
  if v_member_count > 0 then
    update public.students
    set points = coalesce(points, 0) + v_delta_points
    where id = any(v_member_ids);
  end if;

  -- 8. Fetch active meeting id
  select id into v_meeting_id
  from public.meetings
  where class_id = v_submission_record.class_id and status = 'active'
  limit 1;

  -- 9. Insert activity logs for each student
  if v_member_count > 0 then
    insert into public.activity_logs (
      teacher_id,
      class_id,
      student_id,
      meeting_id,
      action_type,
      points_delta,
      reason,
      metadata
    )
    select
      auth.uid(),
      v_submission_record.class_id,
      s_id,
      v_meeting_id,
      'group_task_reviewed',
      v_delta_points,
      'Group task submission reviewed',
      jsonb_build_object(
        'task_id', v_submission_record.task_id,
        'submission_id', submission_id_input,
        'task_group_id', v_submission_record.task_group_id,
        'group_name', v_group_record.name,
        'previous_awarded_points', v_old_points,
        'new_awarded_points', v_new_points
      )
    from unnest(v_member_ids) as s_id;
  end if;

  return query
  select
    submission_id_input,
    v_submission_record.task_group_id,
    v_submission_record.task_id,
    v_submission_record.class_id,
    v_old_points,
    v_new_points,
    v_delta_points,
    v_member_count,
    'reviewed'::text;
end;
$$;

grant execute on function public.review_group_submission(uuid, integer, text) to authenticated;

-- RPC 3: close_task_for_teacher
create or replace function public.close_task_for_teacher(task_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_teacher_id uuid;
  v_title text;
  v_meeting_id uuid;
begin
  -- Find task details
  select class_id, title
  into v_class_id, v_title
  from public.tasks
  where id = task_id_input;

  if not found then
    raise exception 'Task not found';
  end if;

  -- Confirm teacher owns the class
  select teacher_id
  into v_teacher_id
  from public.classes
  where id = v_class_id;

  if v_teacher_id is not null and v_teacher_id <> auth.uid() then
    raise exception 'You do not own this class';
  end if;

  -- Update task status
  update public.tasks
  set
    status = 'closed',
    closed_at = now(),
    closed_by = auth.uid(),
    updated_at = now()
  where id = task_id_input;

  -- Fetch active meeting id if any
  select id into v_meeting_id
  from public.meetings
  where class_id = v_class_id and status = 'active'
  limit 1;

  -- Log the activity
  insert into public.activity_logs (
    teacher_id,
    class_id,
    meeting_id,
    action_type,
    points_delta,
    reason,
    metadata
  )
  values (
    auth.uid(),
    v_class_id,
    v_meeting_id,
    'task_closed',
    0,
    'Task closed: ' || v_title,
    jsonb_build_object(
      'task_id', task_id_input,
      'title', v_title
    )
  );
end;
$$;

grant execute on function public.close_task_for_teacher(uuid) to authenticated;

-- RPC 4: reopen_task_for_teacher
create or replace function public.reopen_task_for_teacher(task_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_teacher_id uuid;
  v_title text;
  v_meeting_id uuid;
begin
  -- Find task details
  select class_id, title
  into v_class_id, v_title
  from public.tasks
  where id = task_id_input;

  if not found then
    raise exception 'Task not found';
  end if;

  -- Confirm teacher owns the class
  select teacher_id
  into v_teacher_id
  from public.classes
  where id = v_class_id;

  if v_teacher_id is not null and v_teacher_id <> auth.uid() then
    raise exception 'You do not own this class';
  end if;

  -- Update task status to published
  update public.tasks
  set
    status = 'published',
    reopened_at = now(),
    reopened_by = auth.uid(),
    updated_at = now()
  where id = task_id_input;

  -- Fetch active meeting id if any
  select id into v_meeting_id
  from public.meetings
  where class_id = v_class_id and status = 'active'
  limit 1;

  -- Log the activity
  insert into public.activity_logs (
    teacher_id,
    class_id,
    meeting_id,
    action_type,
    points_delta,
    reason,
    metadata
  )
  values (
    auth.uid(),
    v_class_id,
    v_meeting_id,
    'task_reopened',
    0,
    'Task reopened: ' || v_title,
    jsonb_build_object(
      'task_id', task_id_input,
      'title', v_title
    )
  );
end;
$$;

grant execute on function public.reopen_task_for_teacher(uuid) to authenticated;

-- RPC 5: return_individual_submission
create or replace function public.return_individual_submission(
  submission_id_input uuid,
  teacher_feedback_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_teacher_id uuid;
  v_task_id uuid;
  v_title text;
  v_student_id uuid;
  v_meeting_id uuid;
begin
  -- Find submission details
  select class_id, task_id, student_id
  into v_class_id, v_task_id, v_student_id
  from public.task_submissions
  where id = submission_id_input;

  if not found then
    raise exception 'Submission not found';
  end if;

  -- Find task details
  select title
  into v_title
  from public.tasks
  where id = v_task_id;

  -- Confirm teacher owns the class
  select teacher_id
  into v_teacher_id
  from public.classes
  where id = v_class_id;

  if v_teacher_id is not null and v_teacher_id <> auth.uid() then
    raise exception 'You do not own this class';
  end if;

  -- Update submission status to returned
  update public.task_submissions
  set
    status = 'returned',
    teacher_feedback = teacher_feedback_input,
    updated_at = now()
  where id = submission_id_input;

  -- Fetch active meeting id if any
  select id into v_meeting_id
  from public.meetings
  where class_id = v_class_id and status = 'active'
  limit 1;

  -- Log the activity
  insert into public.activity_logs (
    teacher_id,
    class_id,
    student_id,
    meeting_id,
    action_type,
    points_delta,
    reason,
    metadata
  )
  values (
    auth.uid(),
    v_class_id,
    v_student_id,
    v_meeting_id,
    'individual_submission_returned',
    0,
    'Task submission returned: ' || v_title,
    jsonb_build_object(
      'task_id', v_task_id,
      'submission_id', submission_id_input,
      'student_id', v_student_id,
      'title', v_title
    )
  );
end;
$$;

grant execute on function public.return_individual_submission(uuid, text) to authenticated;

-- RPC 6: return_group_submission
create or replace function public.return_group_submission(
  submission_id_input uuid,
  teacher_feedback_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_teacher_id uuid;
  v_task_id uuid;
  v_title text;
  v_task_group_id uuid;
  v_submitted_by_student_id uuid;
  v_member_ids uuid[];
  v_group_record public.task_groups%rowtype;
  v_meeting_id uuid;
begin
  -- Find submission details
  select class_id, task_id, task_group_id, submitted_by_student_id
  into v_class_id, v_task_id, v_task_group_id, v_submitted_by_student_id
  from public.task_submissions
  where id = submission_id_input;

  if not found then
    raise exception 'Submission not found';
  end if;

  -- Find task details
  select title
  into v_title
  from public.tasks
  where id = v_task_id;

  -- Confirm teacher owns the class
  select teacher_id
  into v_teacher_id
  from public.classes
  where id = v_class_id;

  if v_teacher_id is not null and v_teacher_id <> auth.uid() then
    raise exception 'You do not own this class';
  end if;

  -- Get group details
  select *
  into v_group_record
  from public.task_groups
  where id = v_task_group_id;

  -- Get member student IDs
  select array_agg(student_id)
  into v_member_ids
  from public.task_group_members
  where task_group_id = v_task_group_id;

  -- Update submission status to returned
  update public.task_submissions
  set
    status = 'returned',
    teacher_feedback = teacher_feedback_input,
    updated_at = now()
  where id = submission_id_input;

  -- Fetch active meeting id if any
  select id into v_meeting_id
  from public.meetings
  where class_id = v_class_id and status = 'active'
  limit 1;

  -- Log the activity for each group member
  if v_member_ids is not null then
    insert into public.activity_logs (
      teacher_id,
      class_id,
      student_id,
      meeting_id,
      action_type,
      points_delta,
      reason,
      metadata
    )
    select
      auth.uid(),
      v_class_id,
      s_id,
      v_meeting_id,
      'group_submission_returned',
      0,
      'Group task submission returned: ' || v_title,
      jsonb_build_object(
        'task_id', v_task_id,
        'submission_id', submission_id_input,
        'task_group_id', v_task_group_id,
        'group_name', v_group_record.name,
        'title', v_title
      )
    from unnest(v_member_ids) as s_id;
  end if;
end;
$$;

grant execute on function public.return_group_submission(uuid, text) to authenticated;

-- Phase 8: Badges and Achievements
create table if not exists public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  name text not null,
  description text,
  icon text,
  badge_type text not null default 'manual',
  trigger_key text,
  points_threshold integer,
  task_count_threshold integer,
  group_task_count_threshold integer,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.student_badges (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badge_definitions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  awarded_by uuid references auth.users(id) on delete set null,
  awarded_reason text,
  source text not null default 'manual',
  metadata jsonb default '{}'::jsonb,
  awarded_at timestamptz default now(),
  unique (badge_id, student_id)
);

-- Enable RLS
alter table public.badge_definitions enable row level security;
alter table public.student_badges enable row level security;

-- Policies for badge_definitions
create policy "Teachers can manage badge_definitions for their classes"
  on public.badge_definitions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.classes
      where classes.id = badge_definitions.class_id
        and classes.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classes
      where classes.id = badge_definitions.class_id
        and classes.teacher_id = auth.uid()
    )
  );

-- Students view badge definitions via RPC

-- Policies for student_badges
create policy "Teachers can manage student_badges for their classes"
  on public.student_badges
  for all
  to authenticated
  using (
    exists (
      select 1 from public.classes
      where classes.id = student_badges.class_id
        and classes.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classes
      where classes.id = student_badges.class_id
        and classes.teacher_id = auth.uid()
    )
  );

-- Students view student badges via RPC

-- RPC 1: award_badge_to_student
create or replace function public.award_badge_to_student(
  badge_id_input uuid,
  student_id_input uuid,
  reason_input text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_class_id uuid;
  v_teacher_id uuid;
  v_badge_name text;
  v_student_name text;
  v_award_id uuid;
begin
  select class_id, teacher_id, name into v_class_id, v_teacher_id, v_badge_name
  from public.badge_definitions
  where id = badge_id_input;

  if v_class_id is null then
    raise exception 'Badge definition not found';
  end if;

  if auth.uid() != v_teacher_id then
    raise exception 'Unauthorized to award this badge';
  end if;

  select name into v_student_name
  from public.students
  where id = student_id_input and class_id = v_class_id;

  if v_student_name is null then
    raise exception 'Student does not belong to this class';
  end if;

  insert into public.student_badges (
    badge_id,
    class_id,
    student_id,
    awarded_by,
    awarded_reason,
    source
  ) values (
    badge_id_input,
    v_class_id,
    student_id_input,
    auth.uid(),
    reason_input,
    'manual'
  )
  on conflict (badge_id, student_id) do nothing
  returning id into v_award_id;

  if v_award_id is not null then
    insert into public.activity_logs (
      class_id,
      action_type,
      student_id,
      points_delta,
      lives_delta,
      reason,
      metadata
    ) values (
      v_class_id,
      'badge_awarded',
      student_id_input,
      0,
      0,
      'Awarded badge: ' || v_badge_name || coalesce(' - ' || reason_input, ''),
      jsonb_build_object(
        'badge_id', badge_id_input,
        'badge_name', v_badge_name,
        'reason', reason_input,
        'student_name', v_student_name
      )
    );
  end if;

  return v_award_id;
end;
$$;

grant execute on function public.award_badge_to_student(uuid, uuid, text) to authenticated;

-- RPC 2: check_and_award_automatic_badges
create or replace function public.check_and_award_automatic_badges(
  student_id_input uuid,
  class_id_input uuid
)
returns table (
  badge_id uuid,
  badge_name text,
  badge_icon text
)
language plpgsql
security definer
as $$
declare
  v_student_points integer;
  v_individual_count integer;
  v_group_count integer;
  v_first_sub_count integer;
  v_first_reviewed_count integer;
  v_rec record;
  v_award_id uuid;
  v_student_name text;
begin
  select points, name into v_student_points, v_student_name
  from public.students
  where id = student_id_input and class_id = class_id_input;

  if v_student_name is null then
    return;
  end if;

  -- 1. Points Threshold Check
  for v_rec in 
    select id, name, icon, points_threshold 
    from public.badge_definitions
    where class_id = class_id_input
      and is_active = true
      and badge_type = 'automatic'
      and trigger_key = 'points_threshold'
      and points_threshold is not null
      and v_student_points >= points_threshold
      and not exists (
        select 1 from public.student_badges
        where student_id = student_id_input
          and badge_id = badge_definitions.id
      )
  loop
    insert into public.student_badges (
      badge_id, class_id, student_id, source, awarded_reason
    ) values (
      v_rec.id, class_id_input, student_id_input, 'automatic', 
      'Reached ' || v_rec.points_threshold || ' points milestone!'
    )
    on conflict (badge_id, student_id) do nothing
    returning id into v_award_id;

    if v_award_id is not null then
      insert into public.activity_logs (
        class_id, action_type, student_id, points_delta, lives_delta, reason, metadata
      ) values (
        class_id_input, 'badge_auto_awarded', student_id_input, 0, 0,
        'Automatically awarded badge: ' || v_rec.name,
        jsonb_build_object('badge_id', v_rec.id, 'badge_name', v_rec.name, 'trigger_key', 'points_threshold', 'student_name', v_student_name)
      );

      badge_id := v_rec.id;
      badge_name := v_rec.name;
      badge_icon := v_rec.icon;
      return next;
    end if;
  end loop;

  -- 2. First Submission Check
  select count(*) into v_first_sub_count
  from (
    select 1 from public.submissions where student_id = student_id_input
    union all
    select 1 from public.group_submissions gs
    join public.task_group_members tgm on gs.task_group_id = tgm.task_group_id
    where tgm.student_id = student_id_input
  ) as combined_subs;

  if v_first_sub_count > 0 then
    for v_rec in 
      select id, name, icon 
      from public.badge_definitions
      where class_id = class_id_input
        and is_active = true
        and badge_type = 'automatic'
        and trigger_key = 'first_submission'
        and not exists (
          select 1 from public.student_badges
          where student_id = student_id_input
            and badge_id = badge_definitions.id
        )
    loop
      insert into public.student_badges (
        badge_id, class_id, student_id, source, awarded_reason
      ) values (
        v_rec.id, class_id_input, student_id_input, 'automatic', 
        'Completed your very first mission submission!'
      )
      on conflict (badge_id, student_id) do nothing
      returning id into v_award_id;

      if v_award_id is not null then
        insert into public.activity_logs (
          class_id, action_type, student_id, points_delta, lives_delta, reason, metadata
        ) values (
          class_id_input, 'badge_auto_awarded', student_id_input, 0, 0,
          'Automatically awarded badge: ' || v_rec.name,
          jsonb_build_object('badge_id', v_rec.id, 'badge_name', v_rec.name, 'trigger_key', 'first_submission', 'student_name', v_student_name)
        );

        badge_id := v_rec.id;
        badge_name := v_rec.name;
        badge_icon := v_rec.icon;
        return next;
      end if;
    end loop;
  end if;

  -- 3. First Reviewed Task Check
  select count(*) into v_first_reviewed_count
  from (
    select 1 from public.submissions where student_id = student_id_input and status = 'reviewed'
    union all
    select 1 from public.group_submissions gs
    join public.task_group_members tgm on gs.task_group_id = tgm.task_group_id
    where tgm.student_id = student_id_input and gs.status = 'reviewed'
  ) as combined_reviewed;

  if v_first_reviewed_count > 0 then
    for v_rec in 
      select id, name, icon 
      from public.badge_definitions
      where class_id = class_id_input
        and is_active = true
        and badge_type = 'automatic'
        and trigger_key = 'first_reviewed_task'
        and not exists (
          select 1 from public.student_badges
          where student_id = student_id_input
            and badge_id = badge_definitions.id
        )
    loop
      insert into public.student_badges (
        badge_id, class_id, student_id, source, awarded_reason
      ) values (
        v_rec.id, class_id_input, student_id_input, 'automatic', 
        'Had your first mission successfully reviewed!'
      )
      on conflict (badge_id, student_id) do nothing
      returning id into v_award_id;

      if v_award_id is not null then
        insert into public.activity_logs (
          class_id, action_type, student_id, points_delta, lives_delta, reason, metadata
        ) values (
          class_id_input, 'badge_auto_awarded', student_id_input, 0, 0,
          'Automatically awarded badge: ' || v_rec.name,
          jsonb_build_object('badge_id', v_rec.id, 'badge_name', v_rec.name, 'trigger_key', 'first_reviewed_task', 'student_name', v_student_name)
        );

        badge_id := v_rec.id;
        badge_name := v_rec.name;
        badge_icon := v_rec.icon;
        return next;
      end if;
    end loop;
  end if;

  -- 4. Individual Tasks Completed Check
  select count(*) into v_individual_count
  from public.submissions
  where student_id = student_id_input and status = 'reviewed';

  for v_rec in 
    select id, name, icon, task_count_threshold 
    from public.badge_definitions
    where class_id = class_id_input
      and is_active = true
      and badge_type = 'automatic'
      and trigger_key = 'individual_tasks_completed'
      and task_count_threshold is not null
      and v_individual_count >= task_count_threshold
      and not exists (
        select 1 from public.student_badges
        where student_id = student_id_input
          and badge_id = badge_definitions.id
      )
  loop
    insert into public.student_badges (
      badge_id, class_id, student_id, source, awarded_reason
    ) values (
      v_rec.id, class_id_input, student_id_input, 'automatic', 
      'Successfully completed ' || v_rec.task_count_threshold || ' individual missions!'
    )
    on conflict (badge_id, student_id) do nothing
    returning id into v_award_id;

    if v_award_id is not null then
      insert into public.activity_logs (
        class_id, action_type, student_id, points_delta, lives_delta, reason, metadata
      ) values (
        class_id_input, 'badge_auto_awarded', student_id_input, 0, 0,
        'Automatically awarded badge: ' || v_rec.name,
        jsonb_build_object('badge_id', v_rec.id, 'badge_name', v_rec.name, 'trigger_key', 'individual_tasks_completed', 'student_name', v_student_name)
      );

      badge_id := v_rec.id;
      badge_name := v_rec.name;
      badge_icon := v_rec.icon;
      return next;
    end if;
  end loop;

  -- 5. Group Tasks Completed Check
  select count(*) into v_group_count
  from public.group_submissions gs
  join public.task_group_members tgm on gs.task_group_id = tgm.task_group_id
  where tgm.student_id = student_id_input and gs.status = 'reviewed';

  for v_rec in 
    select id, name, icon, group_task_count_threshold 
    from public.badge_definitions
    where class_id = class_id_input
      and is_active = true
      and badge_type = 'automatic'
      and trigger_key = 'group_tasks_completed'
      and group_task_count_threshold is not null
      and v_group_count >= group_task_count_threshold
      and not exists (
        select 1 from public.student_badges
        where student_id = student_id_input
          and badge_id = badge_definitions.id
      )
  loop
    insert into public.student_badges (
      badge_id, class_id, student_id, source, awarded_reason
    ) values (
      v_rec.id, class_id_input, student_id_input, 'automatic', 
      'Successfully completed ' || v_rec.group_task_count_threshold || ' group missions as a team!'
    )
    on conflict (badge_id, student_id) do nothing
    returning id into v_award_id;

    if v_award_id is not null then
      insert into public.activity_logs (
        class_id, action_type, student_id, points_delta, lives_delta, reason, metadata
      ) values (
        class_id_input, 'badge_auto_awarded', student_id_input, 0, 0,
        'Automatically awarded badge: ' || v_rec.name,
        jsonb_build_object('badge_id', v_rec.id, 'badge_name', v_rec.name, 'trigger_key', 'group_tasks_completed', 'student_name', v_student_name)
      );

      badge_id := v_rec.id;
      badge_name := v_rec.name;
      badge_icon := v_rec.icon;
      return next;
    end if;
  end loop;

  -- 6. Comeback from Zero Lives Check
  if exists (
    select 1 from public.activity_logs 
    where student_id = student_id_input 
      and class_id = class_id_input 
      and action_type = 'lives_subtraction' 
      and (reason like '%0%' or reason like '%zero%')
  ) then
    for v_rec in 
      select id, name, icon 
      from public.badge_definitions
      where class_id = class_id_input
        and is_active = true
        and badge_type = 'automatic'
        and trigger_key = 'comeback_from_zero_lives'
        and not exists (
          select 1 from public.student_badges
          where student_id = student_id_input
            and badge_id = badge_definitions.id
        )
    loop
      insert into public.student_badges (
        badge_id, class_id, student_id, source, awarded_reason
      ) values (
        v_rec.id, class_id_input, student_id_input, 'automatic', 
        'Successfully recovered and flew back into action after losing all lives!'
      )
      on conflict (badge_id, student_id) do nothing
      returning id into v_award_id;

      if v_award_id is not null then
        insert into public.activity_logs (
          class_id, action_type, student_id, points_delta, lives_delta, reason, metadata
        ) values (
          class_id_input, 'badge_auto_awarded', student_id_input, 0, 0,
          'Automatically awarded badge: ' || v_rec.name,
          jsonb_build_object('badge_id', v_rec.id, 'badge_name', v_rec.name, 'trigger_key', 'comeback_from_zero_lives', 'student_name', v_student_name)
        );

        badge_id := v_rec.id;
        badge_name := v_rec.name;
        badge_icon := v_rec.icon;
        return next;
      end if;
    end loop;
  end if;

  -- 7. Perfect Meeting Check
  if exists (
    select 1 from public.meetings m
    where m.class_id = class_id_input
      and m.status = 'ended'
      and not exists (
        select 1 from public.activity_logs al
        where al.meeting_id = m.id
          and al.student_id = student_id_input
          and al.action_type = 'lives_subtraction'
      )
      and exists (
        select 1 from public.activity_logs al
        where al.meeting_id = m.id
      )
  ) then
    for v_rec in 
      select id, name, icon 
      from public.badge_definitions
      where class_id = class_id_input
        and is_active = true
        and badge_type = 'automatic'
        and trigger_key = 'no_lives_lost_meeting'
        and not exists (
          select 1 from public.student_badges
          where student_id = student_id_input
            and badge_id = badge_definitions.id
        )
    loop
      insert into public.student_badges (
        badge_id, class_id, student_id, source, awarded_reason
      ) values (
        v_rec.id, class_id_input, student_id_input, 'automatic', 
        'Finished a full class meeting without losing a single life! Perfect flight!'
      )
      on conflict (badge_id, student_id) do nothing
      returning id into v_award_id;

      if v_award_id is not null then
        insert into public.activity_logs (
          class_id, action_type, student_id, points_delta, lives_delta, reason, metadata
        ) values (
          class_id_input, 'badge_auto_awarded', student_id_input, 0, 0,
          'Automatically awarded badge: ' || v_rec.name,
          jsonb_build_object('badge_id', v_rec.id, 'badge_name', v_rec.name, 'trigger_key', 'no_lives_lost_meeting', 'student_name', v_student_name)
        );

        badge_id := v_rec.id;
        badge_name := v_rec.name;
        badge_icon := v_rec.icon;
        return next;
      end if;
    end loop;
  end if;

end;
$$;

grant execute on function public.check_and_award_automatic_badges(uuid, uuid) to authenticated, anon;

notify pgrst, 'reload schema';

-- =========================================================================
-- Phase 18E: Secure Student RPC Foundation
-- =========================================================================

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

-- =========================================================================
-- Phase 18G: Secure Student Dashboard Fetch RPC
-- =========================================================================

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



