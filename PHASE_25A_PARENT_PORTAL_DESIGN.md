# Phase 25A: Parent Portal / Guardian Access Design

## 1. Product Philosophy
The core philosophy for Mission Control Remastered is:
* **Teacher** controls the classroom.
* **Student** completes tasks and receives feedback.
* **Parent/Guardian** views progress only.

The Parent Portal (or Guardian Access) must be **strictly read-only**. Parents should monitor progress, not control the classroom or engage in competitive comparisons. The design avoids framing this as "Parental Control".

## 2. Parent Access Model
**Proposed MVP:** Parent Access Code per student.
* Parents log in using two credentials:
  1. **Class Code** (same as the student uses).
  2. **Parent Access Code** (unique to the parent, per student).
* This ensures parents only see their specific child's data.
* *Alternative considered:* Email invite/account system. This is deferred for MVP simplicity and to minimize PII requirements.

## 3. Data Visibility Rules
* Parents can see **only their own child/student**.
* Parents **must not see**:
  * Other students.
  * Class leaderboards or rank (even if the student's class shows rank, parents shouldn't see it by default to avoid undue pressure).
  * Class rosters.
  * Other students' submissions or activity logs.
  * Internal teacher analytics or private teacher notes (unless explicitly marked "visible to parents" in the future).

## 4. Parent Dashboard MVP Scope
Recommended MVP sections for the Parent Dashboard:
* **Student Overview:** Student name, class name, level, points, badges, and lives (only if appropriate/not overly punitive).
* **Task Progress:** Task title, task status (Not Submitted, Submitted, Reviewed), and teacher-reviewed feedback.
* **Recent Activity:** Point activity, tasks completed, submissions reviewed, badges earned. Gentle wording should be used for negative activities.
* **Session Summary:** Recent class sessions, points earned during sessions, tasks completed.

## 5. Wording Rules
The wording should be growth-focused, not punishment-focused.
* **Avoid:** "bad behavior", "punishment", "rank", "leaderboard", "failed".
* **Prefer:** "Progress", "Needs attention", "Language habit reminder", "Practice focus", "Teacher feedback", "Learning activity".

## 6. Database Changes Needed Later
The safest approach is additive.
* **Add:** `parent_access_code` (or `guardian_access_code`) to the `students` table.
* **Requirements:**
  * Nullable or auto-generated for new/existing students.
  * No reset of existing student PINs.
  * Parent code must be distinct from the student PIN.
* This will be implemented in a future phase using a safe, non-destructive SQL migration.

## 7. Route and UI Design
* **Suggested Route:** `/parent` or `/guardian` (handled via the same `viewMode` state architecture in `App.tsx` as `landing`, `teacher`, `student`, and now `parent`).
* **Login Screen:** Prompts for Class Code and Parent Access Code.
* **UI Layout:** A clean, dashboard-like view emphasizing progress and recent positive milestones.

## 8. Teacher Controls Needed Later
Teachers will need tools to manage parent access:
* Generate/regenerate parent access code.
* Reset parent access code.
* Copy parent login instructions (to send home).
* Enable/disable parent access per student.

## 9. AI Feedback Future Integration Rules
AI features are deferred in Phase 25A, but future AI integration must adhere to strict safety guidelines:
* Parents **only** see AI-assisted feedback **after** teacher approval.
* Raw AI suggestions remain teacher-only.
* AI feedback must never automatically affect points, lives, rank, or parent reports.

## 10. Implementation Roadmap
* **Phase 25A:** Parent Portal Design & Architecture (Current Phase)
* **Phase 25B:** Parent Access Code Foundation (Database migration and API updates)
* **Phase 25C:** Parent Dashboard MVP (Login and read-only views)
* **Phase 25D:** Teacher Parent Access Controls (UI in Teacher Dashboard)
* **Phase 26A:** AI Feedback Design
* **Phase 26B:** AI Feedback Safe Implementation
