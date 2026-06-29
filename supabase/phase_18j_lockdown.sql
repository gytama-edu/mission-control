-- Phase 18J: RLS Lockdown
-- Apply this in the Supabase SQL Editor.

-- 1. classes
DROP POLICY IF EXISTS "Allow select for everyone" ON public.classes;
CREATE POLICY "Teachers can select owned classes" ON public.classes
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());

-- 2. students
DROP POLICY IF EXISTS "Allow select students for everyone" ON public.students;

-- 3. meetings
DROP POLICY IF EXISTS "Allow select meetings for everyone" ON public.meetings;

-- 4. tasks
DROP POLICY IF EXISTS "Students can view published tasks" ON public.tasks;

-- 5. task_groups
DROP POLICY IF EXISTS "Students can view task groups" ON public.task_groups;

-- 6. task_group_members
DROP POLICY IF EXISTS "Anyone can select group members" ON public.task_group_members;
DROP POLICY IF EXISTS "Teachers can manage group members" ON public.task_group_members;
CREATE POLICY "Teachers can manage group members" ON public.task_group_members
  FOR ALL TO authenticated USING (
    exists (
      select 1 from public.tasks
      join public.classes on classes.id = tasks.class_id
      where tasks.id = task_group_members.task_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  ) WITH CHECK (
    exists (
      select 1 from public.tasks
      join public.classes on classes.id = tasks.class_id
      where tasks.id = task_group_members.task_id
      and (classes.teacher_id = auth.uid() or classes.teacher_id is null)
    )
  );

-- 7. task_submissions
DROP POLICY IF EXISTS "Students can view their own submissions" ON public.task_submissions;

-- 8. submission_attachments
DROP POLICY IF EXISTS "Students can view their own attachments" ON public.submission_attachments;

-- 9. activity_logs
DROP POLICY IF EXISTS "Allow students to select their own logs" ON public.activity_logs;

-- 10. badge_definitions
DROP POLICY IF EXISTS "Anyone can select badge_definitions (read-only for students/public)" ON public.badge_definitions;

-- 11. student_badges
DROP POLICY IF EXISTS "Anyone can select student_badges (read-only for students/public)" ON public.student_badges;

-- Note: All student dashboard read operations now utilize the securely defined
-- `student_fetch_dashboard_data` RPC function instead of these public SELECT policies.
