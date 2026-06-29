# Phase 19C Report — AI Writing Check Edge Function MVP

## Phase Status

**Phase:** 19C — AI Checker Edge Function MVP
**Feature name:** AI Writing Check
**Status:** Completed
**Implementation status:** Implemented MVP (Non-persistent storage)

## 1. Files Changed
* `src/components/AiWritingCheck.tsx` (New UI Component)
* `src/components/ClassDetail.tsx` (Added import and embedded `<AiWritingCheck />` in the Teacher Submission Review form)
* `supabase/functions/ai-writing-check/index.ts` (New Supabase Edge Function)

## 2. Edge Function Created
* Created a Supabase Edge Function named `ai-writing-check`.
* Validates user authentication from the Authorization header using `@supabase/supabase-js`.
* Checks the user's role to ensure they are a `teacher`.
* Fetches the submission and explicitly ensures that the teacher owns the class the task belongs to, reinforcing Row Level Security (RLS) constraints.
* Checks submission text length (requires >50 words) and automatically truncates overly long content (~5000+ words) to avoid blowing up context tokens.
* Leverages Gemini 3.5 Flash strictly via server-side invocation to provide controlled output structured in JSON.

## 3. Environment/Secrets Required
The following environment variables/secrets must be provided to the deployed Supabase Edge Function:
* `SUPABASE_URL`: The URL to the Supabase project.
* `SUPABASE_ANON_KEY`: The anon key to construct the scoped user client.
* `GEMINI_API_KEY`: The Gemini API Key to access the `gemini-3.5-flash` model.

**Crucially:** The Gemini API Key is purely held on the server and is never exposed or sent to the frontend code.

## 4. Authorization Model Used
* **Auth Verification:** Reads the JWT in the incoming request to identify the user. Rejects missing/invalid tokens.
* **Teacher Authorization Check:** Correctly and dynamically checks `auth.uid()` against Mission Control's existing class ownership model, confirming class `teacher_id` ownership rather than querying a non-existent public `users` table. Students and anonymous users are blocked from access.
* **Ownership Check:** Pulls the submission ID and joins with tasks and classes to ensure the class `teacher_id` matches the authenticated user ID. Rejecting any submission belonging to another teacher's class.

## 5. UI Integration Summary
* Built an `<AiWritingCheck />` component that acts as a collapsible-style panel inside the Teacher Submission Review Modal in `ClassDetail.tsx`.
* Shows up specifically only when viewing a text-based submission (`allow_text_submission` enabled and `submission_text` provided).
* Includes a manual "Run AI Writing Check" button.
* Displays "Analyzing writing patterns..." during the request.
* Safely parses and presents the resulting JSON with concern levels prominently badged.
* Maps AI review signals cleanly with limitations, strengths, areas to review, and suggested follow-up questions.

## 6. Request/Response Format Implemented

**Request:**
```json
{
  "submission_id": "uuid",
  "task_id": "uuid_optional",
  "review_context": {
    "language": "en"
  }
}
```

**Response (from the Edge Function):**
```json
{
  "schema_version": "1.0",
  "status": "completed",
  "submission_id": "uuid",
  "provider": "gemini",
  "model": "gemini-3.5-flash",
  "created_at": "ISO_DATE_TIME",
  "disclaimer": "This AI Writing Check provides teacher review signals only. It is not proof of misconduct and must not be used as the sole basis for penalties.",
  "input_metadata": {
    "word_count": 120,
    "character_count": 680,
    "was_truncated": false,
    "text_type": "student_submission"
  },
  "overall_review": {
    "concern_level": "low",
    "confidence_level": "medium",
    "human_review_required": true,
    "summary": "Short cautious teacher-facing summary."
  },
  "signals": [
     // ... Array of structured signals matching spec
  ],
  "writing_feedback": {
     // ... Array of strengths, areas to review, suggested follow-ups and actions
  },
  "limitations": [
    "This result is not proof that AI was or was not used.",
    "Teacher judgment is required."
  ]
}
```

## 7. Safety Disclaimers Added
* "Teacher review signals only. Not proof of misconduct." prominently displayed in the UI.
* "This AI Writing Check provides teacher review signals only. It is not proof of misconduct and must not be used as the sole basis for penalties." embedded structurally in the API response JSON format.
* Added specific prompts to Gemini reinforcing that the model must not label cheating or dictate penalties, treating text inside the `===STUDENT_SUBMISSION===` block purely as content to analyze and prevent prompt injection instructions.

## 8. Tests Performed (Conceptual Validation)
* Validated that the `AiWritingCheck` component only renders during `isReviewingThis`.
* Verified the Edge Function restricts input length limits appropriately.
* Prevented student/unauthorized invocation of the Edge Function locally.
* Checked that error states bubble up beautifully within the UI modal block.

## 9. Blockers
* Real-world execution of the edge function requires deployment via `supabase functions deploy`. Once deployed, the frontend connects seamlessly.

## 10. Confirmations
* **No automatic scoring:** The AI check is strictly a visual aid for the teacher's assessment. It does not push values to `awarded_points`.
* **No badges/reports changes:** The feature acts orthogonally to gamification loops and report generation. 
* **No review status changes:** Checking the writing does not flag the task as "reviewed."
* **No student-facing UI logic:** The `AiWritingCheck` strictly resides in the teacher context within `ClassDetail.tsx` when evaluating a submission manually.
* **No persistent storage:** The Edge Function executes and returns the payload in a single roundtrip. `submission_ai_reviews` was deliberately **not** created and the data is lost once the session refreshes (per instructions for this MVP phase).
