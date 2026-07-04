# Phase 25C: Parent Dashboard MVP

## Overview
This phase builds upon the Guardian Access foundation (Phase 25B) to provide a read-only, safe, and progress-focused Parent Dashboard. After a parent successfully authenticates with the correct Class Code and Guardian Code, they are presented with a focused view of a single student's learning progress.

## Features Implemented
### 1. Secure Data Fetching
- Implemented a dedicated RPC `guardian_fetch_dashboard_data` which strictly enforces privacy boundaries at the database level.
- The RPC returns only the authenticated student's data: points, lives, tasks assigned to their class, their own submissions (including saved teacher feedback), their badges, and their personal activity logs.
- Class rosters, peer comparisons, leaderboard, and rank data are strictly omitted from the API response.

### 2. Dashboard Layout
- **Header:** Displays the student's name, class name, level, and a "Learning Progress Overview" subtitle.
- **Progress Summary Cards:**
  - Total Points
  - Health/Lives (Only displayed if the class scoring system is "lives")
  - Badges Earned count
- **Task Progress Section:**
  - Lists all assigned tasks.
  - Displays statuses (Not Started, Submitted, Needs Attention, Reviewed).
  - Shows points awarded for completed tasks.
  - **Teacher Feedback:** Displays *only* the official, finalized feedback provided by the teacher upon review.
- **Recent Progress:**
  - Shows a gentle, chronological feed of the student's recent activity (up to 5 items).
  - Replaces harsh punitive language with constructive terms (e.g., negative point actions are described as "Needs attention (points updated)").
- **Badges Section:**
  - Visually displays the badges earned by the student.

### 3. Privacy & Boundary Enforcement
- **No Leaderboard/Rank:** Absolute prohibition of comparative metrics, regardless of classroom settings. Parents only see their child's independent trajectory.
- **Read-Only:** Parents have no controls to award points, submit tasks, edit profiles, or manage the class.
- **AI Feedback Isolation:** Raw AI drafts and generative capabilities remain completely hidden. Parents only see feedback that teachers have explicitly approved and saved.
- **Data Filtering:** Only the specific student's submissions and logs are fetched and rendered.

## Technical Details
- Added `guardian_fetch_dashboard_data` RPC in `supabase/schema.sql`.
- Replaced the placeholder success state in `GuardianAccess.tsx` with a fully interactive dashboard.
- Included an embedded "Refresh" button for parents to pull the latest progress without reloading the browser.
- Continued usage of Lucide icons (`CheckCircle`, `Clock`, `MessageSquare`, `Trophy`) for friendly visual cues.

## Deferred / Future Enhancements
- Actionable messaging/notifications directly with the teacher.
- Detailed visual analytics over time (e.g., charts of point accumulation).
- Full printable/PDF progress reports.
