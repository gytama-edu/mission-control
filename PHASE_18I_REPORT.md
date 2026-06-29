# Phase 18I: Student Realtime Broadcast / Secure Refresh Refactor Report

## 1. Files Changed
* `src/components/StudentAccess.tsx`

## 2. Student Realtime Strategy Chosen
The simplest, safest strategy was implemented: **Polling with Visibility Refresh**.
This avoids the overhead and potential schema complications of setting up a broadcast table or dealing with server-side event channels, while remaining lightweight and reliable.

## 3. Student postgres_changes Subscriptions Removed/Disabled
All anonymous `postgres_changes` subscriptions were successfully stripped from `StudentAccess.tsx`. Specifically, these channels were removed:
* `student-self-*` (tracking `students`)
* `class-students-*` (tracking `students` for rankings)
* `class-details-*` (tracking `classes`)
* `class-meetings-*` (tracking `meetings`)
* `student-tasks-*` (tracking `tasks` and `task_group_members`)
* `student-logs-*` (tracking `activity_logs`)

## 4. Manual Sync Behavior
The existing "Sync" button was updated to display a helpful tooltip ("Sync: Updates your points, tasks, feedback, and badges.") and explicitly triggers `fetchDashboardData(...)`, which securely calls the RPC payload to fetch all fresh dashboard data in one pass.

## 5. Polling Behavior
A lightweight polling loop was introduced using `setInterval` that triggers `refreshData()` every 30 seconds.
* **Optimization:** The poll only executes the RPC if `document.visibilityState === 'visible'`.
* **Cleanup:** The interval is correctly cleared on component unmount or when the student logs out.

## 6. Visibility Refresh Behavior
A `visibilitychange` event listener was added to the `document`. Whenever the tab transitions from hidden to `visible`, a one-time immediate `refreshData()` sync is triggered to ensure the student dashboard feels snappy and up-to-date without waiting for the next 30-second tick.

## 7. Broadcast Behavior
Not implemented (Polling + Visibility Refresh met all requirements safely without needing database schema broadcast triggers).

## 8. Post-Submission Refresh Behavior
After a successful individual or group task submission (or attachment upload), the `submit` logic still awaits `fetchDashboardData(...)` to immediately fetch the updated submissions list and potential badge awards, seamlessly bypassing stale cache issues.

## 9. Archived / Invalid Session Handling
The `refreshData`, `fetchDashboardData`, and `autoRestore` methods were hardened.
* If the RPC returns `archived_class`, the app intercepts this, logs out the user automatically, clears local session variables, and displays the exact message: "This class is currently archived. Please contact your teacher."
* If the RPC returns `invalid_session`, the app logs out the user and displays: "Your session could not be verified. Please log in again."

## 10. Tests Performed
* **Student Login & Restore:** Successfully log in, restore, and properly reject invalid PINs.
* **Student Dashboard via RPC:** Rendered perfectly without direct `SELECT`.
* **Manual Sync:** Fetched latest point changes instantly.
* **Visibility Refresh:** Navigating away from the browser tab and returning triggers an immediate network request fetching fresh data.
* **Post-Submission:** Submissions show immediately upon success.
* **Archived Class:** Tested rejection message for archived classes both on login and mid-session.
* **No `postgres_changes`:** Verified that 0 channels are subscribed to in `StudentAccess.tsx`.

## 11. Teacher Regression Result
**Passed.** The teacher interface remains completely untouched. Realtime subscriptions in `ClassDetail.tsx` and `Dashboard.tsx` continue to listen to `postgres_changes` because teachers possess an authenticated JWT that will respect the new RLS policies being applied in the next phase.

## 12. Security Readiness Result
**Passed.** The student dashboard does not read directly from any Supabase tables, nor does it rely on Realtime `postgres_changes`. The system relies exclusively on the `student_fetch_dashboard_data` SECURITY DEFINER RPC. The application is now fully prepared for RLS lockdown.

## 13. Issues Found and Fixes Applied
* **Issue:** `refreshData` might execute polling while the browser tab is buried in the background, wasting DB resources.
* **Fix:** Wrapped the polling execution in a `document.visibilityState === 'visible'` check.
* **Issue:** When `refreshData` failed mid-session (e.g. from an invalid session), it did not log the student out immediately.
* **Fix:** Added `handleLogout()` to the error blocks in the refresh and auto-restore functions.

## 14. Confirmation that no public SELECT policies were dropped
Confirmed. No policies were dropped.

## 15. Confirmation that no RLS policies were changed
Confirmed. No RLS policies were modified.

## 16. Confirmation that no storage policies were changed
Confirmed. Storage policies remain untouched.

## 17. Confirmation that protected logic was preserved
Confirmed. All teacher-side features, submission RPCs, safe point-awarding logic, badge, and reports systems remain 100% identical.

## 18. Final Verdict
**Ready for Phase 18J RLS Lockdown.**
The single blocker identified in Phase 18H has been successfully mitigated. We can now safely drop all anonymous public SELECT policies without breaking the student experience.
