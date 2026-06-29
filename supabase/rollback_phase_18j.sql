-- EMERGENCY ROLLBACK ONLY
-- Re-enable broad anonymous SELECTs if RLS lockdown breaks production.

CREATE POLICY "Allow select for everyone" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Allow select students for everyone" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow select meetings for everyone" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Students can view published tasks" ON public.tasks FOR SELECT TO anon USING (status = 'published' or status = 'closed' or status = 'archived');
CREATE POLICY "Students can view task groups" ON public.task_groups FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can select group members" ON public.task_group_members FOR SELECT USING (true);
CREATE POLICY "Students can view their own submissions" ON public.task_submissions FOR SELECT TO anon USING (true);
CREATE POLICY "Students can view their own attachments" ON public.submission_attachments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow students to select their own logs" ON public.activity_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can select badge_definitions (read-only for students/public)" ON public.badge_definitions FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can select student_badges (read-only for students/public)" ON public.student_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Teachers can select owned classes" ON public.classes;
