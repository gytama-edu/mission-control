# Phase 26C.2: Review Save Button State Hotfix

## Changed Files
- `src/components/ClassDetail.tsx`

## Reviewed State Detection
The application detects whether a submission has been reviewed by checking the `awarded_points` property on the submission object (`sub.awarded_points !== undefined && sub.awarded_points !== null`). Because the existing Supabase Edge Functions and RPC handlers strictly populate `awarded_points` when a teacher grades a submission (even if graded with 0 points), this reliably signifies that a review is finalized and stored in the database.

## Button Label Changes
The main review submission button dynamically toggles its text label based on the reviewed state condition. If the submission has awarded points, the label reads `"Update Review"`. Otherwise, it remains `"Complete & Grade"`. 

## Form Header Updates
A small, non-disruptive `"Review Saved"` label badge with a checkmark icon is displayed at the top of the Task Review & Feedback Form when the submission is in a reviewed state.

## Local UI Updates
Instead of blocking the UI with a native browser `alert("Review saved and points awarded.")`, the component now leverages a local `reviewSuccessMessage` state. Upon successfully saving a review, this state triggers an animated success banner next to the action buttons for 3 seconds. The `handleSaveReview` callback immediately updates the `selectedSubmissionForReview` local state with fresh data from the server, instantly re-rendering the UI without requiring a page reload.

## AI Draft Safety Confirmation
The AI Draft generation mechanism (which invokes `generateAIFeedbackDraft`) remains entirely untouched. Generated drafts continue to be stored safely in local React state (`aiDraftResult`) and do not auto-save or auto-grade the student.

## Duplicate Review Prevention
No new database entries are generated. The implementation preserves the original safe `handleSaveReview` pipeline, which defers to PostgreSQL RPC endpoints (`review_individual_submission` and `review_group_submission`). These perform an explicit `UPDATE` on the existing `task_submissions` record, safely computing point differentials and preventing duplicate review rows.
