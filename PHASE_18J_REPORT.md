# Phase 18J: Apply RLS Lockdown Report

## 1. Policies Reviewed
All public/anonymous SELECT policies across the 11 key classroom tables were reviewed. The authenticated teacher policies were also audited to ensure they properly restrict access by `teacher_id` (via `classes.teacher_id = auth.uid()`).

## 2. Policies Removed
The following broad anonymous SELECT policies are slated for removal (and have been removed from the application's `schema.sql`):
* `"Allow select for everyone"` ON `classes`
* `"Allow select students for everyone"` ON `students`
* `"Allow select meetings for everyone"` ON `meetings`
* `"Students can view published tasks"` ON `tasks`
* `"Students can view task groups"` ON `task_groups`
* `"Anyone can select group members"` ON `task_group_members`
* `"Students can view their own submissions"` ON `task_submissions`
* `"Students can view their own attachments"` ON `submission_attachments`
* `"Allow students to select their own logs"` ON `activity_logs`
* `"Anyone can select badge_definitions (read-only for students/public)"` ON `badge_definitions`
* `"Anyone can select student_badges (read-only for students/public)"` ON `student_badges`

## 3. Policies Added or Verified
* **Added:** `"Teachers can select owned classes"` ON `classes` FOR SELECT TO authenticated USING (`teacher_id = auth.uid()`).
* **Fixed:** `"Teachers can manage group members"` ON `task_group_members` was updated to properly join through the `tasks` table to verify `classes.teacher_id`, as the previous policy incorrectly attempted to join `classes.id` directly to `task_group_members.task_id`.
* **Verified:** All other tables already possessed strict authenticated teacher-owned RLS policies (`FOR ALL TO authenticated USING (...)`).

## 4. Rollback SQL Prepared
Yes. `supabase/rollback_phase_18j.sql` has been created. It contains the DROP statements for the new teacher policy and CREATE statements to restore all 11 anonymous SELECT policies if an emergency rollback is required.

## 5. SQL Files Changed
* `supabase/schema.sql` (Mainline schema updated)
* `supabase/phase_18j_lockdown.sql` (Dedicated migration script for this phase)
* `supabase/rollback_phase_18j.sql` (Emergency rollback script)

## 6. Supabase SQL Applied Status
**Pending Manual Execution.** 
Because this environment does not have direct database admin credentials (`DATABASE_URL`), the SQL must be executed manually. Please open your Supabase SQL Editor and run the contents of `supabase/phase_18j_lockdown.sql`.

## 7-13. Test Results
* **Teacher A/B isolation test result:** Pending SQL application. (Code level review confirms policies strictly enforce `auth.uid() = teacher_id`).
* **Teacher workflow regression result:** Pending SQL application.
* **Student login test result:** Pending SQL application. (RPC `student_login_by_code_and_pin` is `SECURITY DEFINER` and will bypass RLS).
* **Student dashboard test result:** Pending SQL application. (RPC `student_fetch_dashboard_data` is `SECURITY DEFINER` and will bypass RLS).
* **Student session restore test result:** Pending SQL application.
* **Student submission/attachment test result:** Pending SQL application. (Submission RPCs are `SECURITY DEFINER` and will bypass RLS).
* **Security direct-anon-query test result:** Pending SQL application. (Once applied, all direct `SELECT` queries from unauthenticated clients will return 0 rows).

## 14. Bugs Found
* The RLS policy `"Teachers can manage group members"` on `task_group_members` had an invalid join condition (`classes.id = task_group_members.task_id`).

## 15. Fixes Applied
* Fixed the `"Teachers can manage group members"` policy to correctly join: `classes.id = tasks.class_id` where `tasks.id = task_group_members.task_id`.

## 16. Whether Rollback Was Needed
No, rollback has not been used.

## 17. Confirmation that storage policies were not changed
Confirmed. No storage policies were modified.

## 18. Confirmation that student RPCs still work
Confirmed at the code level. All student RPCs (`student_login_by_code_and_pin`, `student_fetch_dashboard_data`, `submit_individual_task`, `submit_group_task`, `add_individual_submission_attachment_metadata`, `add_group_submission_attachment_metadata`) are designated as `SECURITY DEFINER`. They will continue to operate with elevated privileges, bypassing the locked-down RLS policies to deliver strictly validated data to the students.

## 19. Confirmation that protected logic was preserved
Confirmed. No teacher workflows, task mechanics, points logic, or badge logic were altered.

## 20. Final Status
**RLS lockdown blocked before apply** 
(Requires user to execute `supabase/phase_18j_lockdown.sql` in the Supabase Dashboard SQL Editor to finalize the lockdown).
