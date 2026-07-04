# Phase 26C.3: Student Dashboard Task Sorting Hotfix

## Changed Files
- `src/components/StudentAccess.tsx`

## Sorting Rule Used
Tasks on the student dashboard are now dynamically sorted using a non-destructive `sortedTasks` array computed before rendering. The sorting logic applies three progressive priorities:
1. **Active State**: Tasks marked as `closed` are pushed to the very bottom of the feed.
2. **Relevance / Actionable Status**: 
   - **Priority 1 (Top)**: `Not Submitted` or `Needs Revision`. These require immediate student action.
   - **Priority 2 (Middle)**: `Needs Review` or `Submitted (Late)`. These are submitted but pending teacher grading.
   - **Priority 3 (Lower)**: `Reviewed`. These are completed and graded.
3. **Chronological Fallback**: Within the exact same priority bucket, tasks are sorted by `created_at` in descending order so that the absolute newest assignments appear first.

## Safety Confirmations
- **Display-Only**: The sorting is entirely transient and computed locally during the render cycle. It **does not** mutate database records, timestamps, or state payloads.
- **Reviewed Feedback Preservation**: Because the core data (`studentSubmissions` and `tasks`) is preserved, all teacher feedback (including securely generated AI Drafts saved by the teacher), point awards, and submission statuses render perfectly.
- **Data Integrity**: No destructive migrations were run, and auto-sync behaviors remain completely intact.
