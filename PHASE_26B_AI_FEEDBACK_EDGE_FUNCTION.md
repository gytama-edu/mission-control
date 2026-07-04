# Phase 26B: AI Feedback Edge Function Foundation

## 1. Overview
In Phase 26B, we implemented the secure server-side foundation for generating AI-assisted teacher feedback. This ensures that AI provider API keys are kept strictly out of the frontend and that only authorized teachers can request feedback drafts for their own students' submissions.

## 2. Changed Files
* `supabase/functions/generate-ai-feedback/index.ts`: Created the new Supabase Edge Function to securely call the Gemini API.
* `src/services/missionControlData.ts`: Added the `generateAIFeedbackDraft` wrapper function to securely invoke the Edge Function from the frontend.

## 3. Edge Function Details
* **Function Name:** `generate-ai-feedback`
* **Request Payload:** `{ "submission_id": "uuid" }`
* **Response Format:** A structured JSON object containing:
  ```json
  {
    "status": "completed",
    "draft": {
      "overall_summary": "...",
      "strengths": ["..."],
      "areas_to_improve": ["..."],
      "grammar_notes": ["..."],
      "vocabulary_notes": ["..."],
      "corrected_examples": [...],
      "suggested_teacher_feedback": "...",
      "suggested_next_steps": ["..."]
    }
  }
  ```

## 4. Auth and Ownership Validation
The Edge Function performs the following strict checks before communicating with the AI provider:
1. Verifies the request includes a valid Supabase JWT and extracts the authenticated user.
2. Fetches the `task_submissions` record to confirm it exists.
3. Fetches the associated `classes` record.
4. Verifies that `classData.teacher_id` exactly matches the authenticated user's ID.
If any check fails, it safely returns an error (e.g. `unauthorized`, `submission_not_found`, `submission_not_owned_by_teacher`) without processing further.

## 5. Data Minimization
The Edge Function fetches and sends only the absolute minimum required context to the AI model:
* `task.title`
* `task.description`
* `submission.submission_text`

**No student PII (like names, PINs, or Guardian Access codes), class rosters, or unrelated logs are sent.**

## 6. Safety & Restrictions
* **Text-Only MVP:** The Edge Function explicitly rejects submissions with empty text bodies, returning an error: `"AI feedback is currently available for text submissions only."`
* **Teacher-Only:** The raw AI draft is returned only to the authenticated teacher. It is **not** persisted directly to the database in this phase.
* **No Auto-Grading:** The AI prompt strictly forbids grading, assigning points, or accusing the student of cheating.
* **No Frontend Exposure:** The `GEMINI_API_KEY` is completely isolated in the Supabase backend environment.

## 7. Environment Variables Required
To deploy this function, the following environment variables must be set in the Supabase Edge Function environment:
* `SUPABASE_URL`
* `SUPABASE_ANON_KEY`
* `GEMINI_API_KEY` (The API key for Gemini 2.5 Flash)

## 8. Next Phase Plan
In Phase 26C, we will build out the Teacher AI Draft Panel in the UI, enabling the currently disabled "AI Draft" button, and allowing teachers to copy/edit the draft into the final feedback field.
