# Phase 26C.1: AI Draft Button Activation Hotfix

## What was broken
The "AI Draft" button in the teacher review form (`ClassDetail.tsx`) appeared to behave like a placeholder or disabled UI for two main reasons:
1. The button state was strictly checking `!sub.submission_text` but did not safely account for submissions containing only whitespaces or trailing spaces.
2. The AI Draft preview panel was missing several expected structured fields from the AI draft object (e.g., grammar notes, vocabulary notes, corrected examples, suggested next steps), making the preview incomplete when it did render.
3. Depending on the test data used, the button was correctly disabling itself for attachment-only submissions but could have appeared broken because the logic was unclear.

## How it was fixed
- **Enabled the button for valid text submissions**: The disabled condition on the button was updated to safely check `disabled={isGeneratingAiDraft || !sub.submission_text || sub.submission_text.trim().length === 0}`.
- **Button Loading States**: Added a `Generating...` loading state with a spinner when the generation request is ongoing.
- **Click Handler**: Mapped the button `onClick` event to `handleGenerateAiDraft()`, which triggers the `generateAIFeedbackDraft` service in `src/services/missionControlData.ts`.
- **Error Handling**: Displaying a safe fallback error message in the UI if the AI service fails or the edge function is unreachable (`"AI draft could not be generated right now. You can still write feedback manually."`).
- **Complete Preview Panel**: Added all requested fields to the `AI Draft Panel (Teacher Only)` rendering block, ensuring `grammar_notes`, `vocabulary_notes`, `corrected_examples`, and `suggested_next_steps` are displayed if they exist in the response.

## Text Submission Detection
The submission object returned from the `fetch_task_submissions_for_teacher` RPC has a field `submission_text`. The UI now correctly detects if `sub.submission_text` exists and has actual text (`trim().length > 0`). If it does not, the button remains disabled with a helpful tooltip: `"AI feedback is available for text submissions only."`

## Preview Panel & "Insert into Feedback"
- Once generation is complete, the `AI Draft Panel (Teacher Only)` renders above the "Awarded Points" section.
- The panel contains a button: `"Insert into Feedback"`.
- Clicking this button appends the `suggested_teacher_feedback` to the existing textarea (`reviewFeedback`).
- If the textarea already contains text, the new text is safely appended at the bottom with a double newline (`\n\n`).

## Confirmation of No Auto-Save/Auto-Grade
- AI drafts are strictly loaded into local state (`aiDraftResult`) and are **not automatically saved** to the database.
- AI drafts are kept securely in the teacher's UI. Students and parents have no access to this local state.
- The teacher must click "Insert into Feedback", optionally edit the text, and manually complete the standard "Complete & Grade" or "Return for Revision" workflow to save the feedback.
- No points, lives, or submission status values are automatically altered by the AI draft generation process.
