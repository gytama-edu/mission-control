# Phase 26A: AI Feedback Design + Teacher Approval Architecture

## 1. Product Philosophy
* **AI is not the teacher:** AI acts as a teaching assistant to draft feedback. It does not replace the teacher's judgment.
* **No automatic grading:** AI does not auto-grade or automatically assign points, lives, badges, or change task status.
* **No automatic publishing:** AI does not post feedback directly to students or parents.
* **Teacher in the loop:** The teacher must review, edit, approve, and manually save all AI-generated feedback.
* **Safe exposure:** Students and parents only ever see the final, teacher-approved feedback.

## 2. AI Feedback MVP Scope
* **Supported formats:** Text submissions only for the MVP. No voice, image OCR, or file parsing yet.
* **Workflow:** Teacher manually clicks "Generate AI Feedback" on a submission. AI returns a structured draft. Teacher edits the draft in the existing textarea and saves it.
* **Out of scope:** Voice analysis, automatic language detection, AI detection (plagiarism), auto-grading.

## 3. Output JSON Structure
The AI model will be prompted to return a structured JSON response to allow flexible UI rendering (if needed) or to format a clean text block:
```json
{
  "overall_summary": "A positive, encouraging summary of the submission.",
  "strengths": ["Clear main idea", "Good use of transition words"],
  "areas_to_improve": ["Past tense verb conjugation", "Punctuation at the end of sentences"],
  "grammar_notes": "...",
  "vocabulary_notes": "...",
  "suggested_teacher_feedback": "Draft paragraph the teacher can copy/paste and edit."
}
```
*Note: In the MVP, we may simply inject a formatted text version of this into the textarea for the teacher to edit.*

## 4. Backend / Edge Function Architecture
To secure the AI API keys and ensure proper authorization:
* **Edge Function / Backend Endpoint:** A dedicated server-side endpoint (e.g., Supabase Edge Function).
* **API Key Security:** The AI provider API key is stored securely in the backend environment, **never** exposed to the browser.
* **Request Validation:** The endpoint must verify:
  1. The user is an authenticated teacher.
  2. The teacher owns the class.
  3. The submission belongs to that class.
* **Data Minimization:** Send only the minimum required data (submission text, task title, task instructions). Do not send PII, student names (unless anonymized), or unrelated class data.

## 5. Storage Strategy
* **MVP Storage:** Raw AI drafts are **not** persisted in the database. They are only generated on demand and displayed in the UI. Only the final, teacher-edited text is saved to `teacher_feedback` on the submission record.
* **Future Storage (If needed for auditing):** A separate table like `submission_ai_feedback_drafts` with strict RLS allowing only the teacher to read/write.

## 6. Authorization Rules
* Only authenticated teachers can request AI feedback.
* Students and parents are strictly blocked from triggering the AI or seeing raw AI responses.

## 7. Parent Portal Visibility Rules (Future)
* When the Parent Portal is fully implemented, parents may see teacher feedback.
* **Rule:** Parents only see the final, saved `teacher_feedback`. They never see the raw AI output, confidence scores, prompts, or generation metadata.
* It is at the product's discretion whether to label the feedback as "AI-assisted".

## 8. Safety Wording
The UI should clearly communicate the nature of the tool:
* "AI draft feedback"
* "Review before saving"
* "Teacher approval required"
* "AI suggestions may need editing"
* Avoid terms like "AI grade", "detected", or "AI-written".

## 9. Rate Limit and Abuse Prevention
* **UI safeguards:** Loading states, disabling the generate button while processing, per-submission cooldowns.
* **Backend safeguards:** The Edge Function should implement rate limiting per teacher (e.g., requests per minute/day) to prevent API abuse.

## 10. Implementation Roadmap
* **Phase 26A:** AI Feedback Design + Teacher Approval Architecture (Current Phase)
* **Phase 26B:** AI Feedback Edge Function Foundation (Setup backend infrastructure and API keys)
* **Phase 26C:** Teacher AI Draft Panel (UI for triggering and displaying the draft)
* **Phase 26D:** Save Teacher-Approved Feedback (Wiring the draft to the existing save flow)
* **Phase 26E:** Parent Portal Approved Feedback Visibility (Integrating with Phase 25 components)
