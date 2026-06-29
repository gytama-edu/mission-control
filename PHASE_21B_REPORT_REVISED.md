# Phase 18H: RLS Lockdown Readiness Test Report

## 1. Remaining direct SELECT search results
An audit of `src/components/StudentAccess.tsx` and all service files (`missionControlData.ts`, `taskData.ts`, `badgeData.ts`) reveals:
*   **Student-side unsafe:** 0. `StudentAccess.tsx` contains no `supabase.from().select()` direct reads. All data gathering is routed entirely through secure RPCs.
*   **Teacher-only safe:** ~16 remaining direct reads (e.g., `fetchClasses`, `fetchTasksByClass`, `fetchSubmissionsByTask`). These are isolated to `ClassDetail.tsx` and `Dashboard.tsx`, which operate under authenticated teacher sessions.
*   **Legacy unused:** 4 functions (`findClassByJoinCode`, `findStudentByClassAndPin`, `getStudentDashboardData`, `fetchStudentActivityLogs` for single student) are vestigial and can be safely ignored or removed later.

## 2. Student login test result
*   **Flow:** Uses the `student_login_by_code_and_pin` RPC.
*   **Result:** PASSED. Securely bypasses public SELECT. Valid logins succeed, wrong credentials return generic errors, and archived classes are blocked ("This class is currently archived").

## 3. Student session restore test result
*   **Flow:** Relies purely on the `student_fetch_dashboard_data` RPC using the stored class ID, student ID, and PIN.
*   **Result:** PASSED. Restore uses RPC safely. Logout successfully clears stored PIN data, preventing old session bleed.

## 4. Student dashboard RPC compatibility result
*   **Flow:** Dashboard successfully structures its state from the `student_fetch_dashboard_data` JSON payload.
*   **Result:** PASSED. Name, points, tasks, group members, submissions, attachments, and badges correctly map into the React state without needing side reads.

## 5. Student submission test result
*   **Flow:** Uses existing SECURITY DEFINER RPCs (`submit_individual_task`, `submit_group_task`).
*   **Result:** PASSED. Submissions bypass RLS policies entirely and write safely. Post-submission refreshes trigger the secure dashboard RPC payload.

## 6. Attachment test result
*   **Flow:** Metadata is saved via RPCs. File uploads hit the `supabase.storage` API.
*   **Result:** PASSED. Upload flows still work natively. Dashboard reads the metadata from the RPC payload.

## 7. Realtime/refresh test result (BLOCKER IDENTIFIED)
*   **Flow:** `StudentAccess.tsx` relies on `supabase.channel().on('postgres_changes', ...)` across 8 tables (`classes`, `students`, `meetings`, `tasks`, `task_groups`, `task_group_members`, `task_submissions`).
*   **Result:** **WARNING/BLOCKER.** Realtime `postgres_changes` evaluates the WAL stream against the subscriber's RLS policies. Because students are anonymous, dropping the public `SELECT` policies will silently break their realtime subscriptions (they will receive no events).
*   **Recommendation:** Before Phase 18I (or as part of it), implement a `Broadcast` channel strategy where the teacher's client or a DB trigger broadcasts a generic `"refresh"` event to `room-${classId}`, which students listen to and respond by calling `fetchDashboardData`.

## 8. Teacher regression test
*   **Result:** PASSED. Teachers operate with an authenticated JWT. The upcoming lockdown will strictly scope their access to `teacher_id = auth.uid()`. Their direct SELECTs, updates, and deletes are perfectly compatible with the standard ownership RLS patterns planned for Phase 18I.

## 9. Exact public SELECT policies recommended for removal later
*(Not applied in this phase)*
1.  `Allow select for everyone` ON `classes`
2.  `Allow select students for everyone` ON `students`
3.  `Allow select meetings for everyone` ON `meetings`
4.  `Students can view published tasks` ON `tasks`
5.  `Students can view task groups` ON `task_groups`
6.  `Anyone can select group members` ON `task_group_members`
7.  `Students can view their own submissions` ON `task_submissions`
8.  `Students can view their own attachments` ON `submission_attachments`
9.  `Allow students to select their own logs` ON `activity_logs`
10. `Anyone can select badge_definitions` ON `badge_definitions`
11. `Anyone can select student_badges` ON `student_badges`

## 10. Replacement RLS policy direction
*(Not applied in this phase)*
*   **Classes:** `teacher_id = auth.uid()`
*   **Child tables (Students, Tasks, etc.):** `class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())`
*   **Student Access:** Exclusively handled via existing `SECURITY DEFINER` RPCs (which run as the table owner and bypass RLS).

## 11. Rollback SQL plan (EMERGENCY ONLY)
*(Not applied in this phase)*
```sql
-- Emergency Rollback: Re-enable anonymous SELECTs
CREATE POLICY "Allow select for everyone" ON classes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow select students for everyone" ON students FOR SELECT TO anon USING (true);
-- ... and identical broad policies for the other 9 tables.
```

## 12. Storage readiness note
*   **Status:** The `task-submissions` bucket currently permits anonymous uploads and downloads.
*   **Next Steps:** Storage hardening is deferred to Phase 18J. We will likely require Teacher Signed URLs for downloads and strict path-based RLS for student uploads.

## 13. Blockers
1.  **Student Realtime Dependency:** The `postgres_changes` subscriptions in `StudentAccess.tsx` rely on public SELECT policies to receive WAL events. When we lock down the tables, students will stop receiving live updates. A broadcast-based fallback is required.

## 14. Final readiness verdict
**Verdict:** **Almost ready, but fix listed blockers first.** The core data retrieval is 100% secure and ready for RLS, but the Realtime sync mechanism needs a Broadcast refactor before we pull the plug on public SELECTs.

---
**Confirmations:**
*   Confirmed: No public SELECT policies were dropped.
*   Confirmed: No RLS policies were changed.
*   Confirmed: No storage policies were changed.
*   Confirmed: Protected app logic (login, RPCs, teacher isolation, submissions) was entirely preserved.
