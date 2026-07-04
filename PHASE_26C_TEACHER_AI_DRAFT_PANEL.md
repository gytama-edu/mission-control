# Phase 26C: Teacher AI Draft Panel

## 1. Overview
In Phase 26C, we activated the "AI Draft" button inside the teacher submission review form. This allows teachers to generate AI-assisted feedback drafts securely and cleanly insert them into the feedback form before saving.

## 2. Changed Files
* `src/components/ClassDetail.tsx`: 
  * Enabled the "AI Draft" button, wiring it to `generateAIFeedbackDraft`.
  * Added loading states (`isGeneratingAiDraft`) to prevent duplicate clicks.
  * Created the AI Draft Panel UI to display the generated summary, strengths, areas to improve, and suggested feedback.
  * Added the "Insert into Feedback" button which appends the suggested feedback directly to the teacher's edit box.

## 3. UI Workflow
1. **Teacher opens a submission:** If it's a text submission, the "AI Draft" button is active. If not, it is disabled.
2. **Teacher clicks "AI Draft":** Button enters a loading state (`Generating...`).
3. **Draft Appears:** The Teacher AI Draft Panel appears, clearly labeled "Teacher Only".
4. **Teacher reviews draft:** The panel presents the structured JSON draft cleanly.
5. **Teacher inserts draft:** Clicking "Insert into Feedback" appends the draft to the existing evaluation textarea.
6. **Teacher edits and saves:** The teacher can manually edit the feedback and must still click the standard "Save Review" button to persist the changes.

## 4. Safety & Restrictions
* **No Auto-Save:** Generating an AI draft does not save the review, does not update points, and does not alter the submission status.
* **Teacher-Only Visibility:** AI drafts are never stored in the database. They exist strictly in the component's local state, ensuring students and parents never see the raw output.
* **Non-Destructive Insert:** The "Insert into Feedback" button appends the draft if the teacher has already written some comments, preventing accidental overwrites.
* **Text-Only MVP:** The "AI Draft" button is safely disabled if the submission does not contain text.

## 5. Next Phase Recommendation
The current Phase 26 series handles server-side setup and teacher-facing AI drafts securely. Moving forward, Phase 26D could involve fine-tuning the system prompt or adding support for different kinds of assignments (e.g., specific grading rubrics).
