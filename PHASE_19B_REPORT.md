# Phase 19B Report — AI Writing Check Architecture + Edge Function Plan

## Phase Status

**Phase:** 19B — AI Checker Architecture + Edge Function Plan
**Feature name:** AI Writing Check
**Status:** Planning/design only
**Implementation status:** Not implemented yet

This phase defines the recommended architecture for adding an AI-assisted teacher review tool to Mission Control Remastered. The feature must support teachers during submission review, but it must not act as a final judgment system.

The feature should provide **review signals only**, not accusations, automatic penalties, automatic grading, or automatic changes to student records.

---

## 1. Provider Recommendation

### Recommended provider

**Primary provider:** Gemini 2.5 Flash
**Recommended model ID:** `gemini-2.5-flash`
**Backend location:** Supabase Edge Function
**Frontend exposure:** No API keys exposed in frontend

### Why Gemini 2.5 Flash fits this feature

Gemini 2.5 Flash is a strong fit for the first version of AI Writing Check because it is designed for fast structured analysis, has good price-performance, and is already familiar through Google AI Studio. This feature does not require heavy creative generation. It needs controlled, cautious, structured review output.

The model should be used for:

* Submission writing review signals
* Grammar/style consistency observations
* Possible originality concerns
* Teacher follow-up question suggestions
* Cautious review summaries
* Structured JSON output

It should **not** be used for:

* Declaring that a student cheated
* Assigning an “AI percentage”
* Automatically grading the work
* Automatically deducting points
* Automatically changing badges, reports, reviews, or task status

### Recommended provider strategy

Use Gemini 2.5 Flash as the only provider for the first implementation. Avoid adding fallback providers during the first release because provider switching adds cost, schema, debugging, and safety complexity.

A future phase may add:

* Gemini 2.5 Flash Lite for cheaper low-risk checks
* Gemini 2.5 Pro for deeper teacher-requested review
* Provider abstraction layer if needed later

For Phase 19C, keep it simple.

---

## 2. Edge Function Architecture

### Recommended Edge Function name

`ai-writing-check`

### High-level architecture

Teacher Submission Review Modal
→ Supabase authenticated function invoke
→ Supabase Edge Function validates teacher JWT
→ Edge Function verifies teacher ownership of submission
→ Edge Function fetches required submission/task data securely
→ Edge Function anonymizes/minimizes content
→ Edge Function calls Gemini 2.5 Flash
→ Edge Function validates structured JSON response
→ Edge Function returns review signals to teacher
→ Optional: result is stored in `submission_ai_reviews`

### Core security rule

The frontend should not send sensitive authority fields that the backend blindly trusts.

The Edge Function should trust:

* The authenticated Supabase user session
* Server-side database ownership checks
* Existing teacher-owned task/class/submission relationships

The Edge Function should not trust:

* Client-provided `teacher_id`
* Client-provided ownership claims
* Client-provided class ownership
* Client-provided student identity
* Client-provided AI result data

### Recommended function flow

1. Receive request from authenticated teacher.
2. Validate request body.
3. Confirm the caller is authenticated.
4. Confirm the caller is a teacher.
5. Confirm the teacher owns the submission through the existing secure relationship chain.
6. Fetch only the needed submission content.
7. Reject unsupported submission types.
8. Reject empty, too short, or too long text.
9. Remove or avoid student-identifying data where possible.
10. Build safe Gemini prompt.
11. Request structured JSON output.
12. Validate returned JSON against the expected schema.
13. Return safe teacher-facing review result.
14. Optionally store the result if storage is enabled.

### Recommended authorization model

Use the teacher’s Supabase session JWT when invoking the Edge Function.

The function should require authentication. It should not be public.

Recommended behavior:

* Anonymous users: reject
* Students: reject
* Teachers without ownership of the submission: reject
* Teachers who own the submission: allow

### Service role usage

If the Edge Function uses a service-role client internally, it must only do so after the function has already verified teacher ownership.

Safer preferred pattern:

* Use the authenticated/RLS-scoped client for read checks where possible.
* Use service role only for controlled server-side inserts into internal logging or AI review storage tables.
* Never expose service role keys to the frontend.

---

## 3. Request Payload Design

### Preferred request payload

The frontend should send IDs, not full sensitive data.

```json
{
  "submission_id": "uuid",
  "task_id": "uuid_optional",
  "store_result": false,
  "force_new": false,
  "review_context": {
    "language": "en",
    "student_level": "optional",
    "rubric_focus": ["grammar", "organization", "originality"],
    "assignment_title": "optional"
  }
}
```

### Required fields

| Field            | Required | Notes                                                                |
| ---------------- | -------: | -------------------------------------------------------------------- |
| `submission_id`  |      Yes | Main identifier used by the server to fetch the submission securely. |
| `task_id`        | Optional | Can help validate relationship, but server should verify it.         |
| `store_result`   | Optional | Default should be `false` in first implementation.                   |
| `force_new`      | Optional | Allows rerun later if caching/storage is added.                      |
| `review_context` | Optional | Limited assignment context only.                                     |

### Fields that should not be accepted from frontend

The frontend should not provide:

* `teacher_id`
* `student_id`
* `class_id` as trusted authority
* Student name
* Student email
* Student profile data
* Points
* Badge history
* Previous teacher judgments
* Reports
* Full classroom history
* API key
* Model override unless controlled by server

### Text submission handling

Preferred behavior:

* The Edge Function fetches the submitted text from the database.
* The frontend does not send raw submission text by default.
* If a future version allows pasted text, it should be treated as untrusted and should not be stored unless explicitly approved.

### Validation rules

The function should validate:

* `submission_id` is a valid UUID.
* User is authenticated.
* User owns the relevant class/task/submission.
* Submission exists.
* Submission is text-based.
* Submission has enough content for meaningful analysis.
* Submission is under the configured maximum length.
* Request is within rate limits.

Recommended first limits:

* Minimum: 80–100 words
* Maximum: 3,000–5,000 words
* Hard character limit: around 20,000 characters for first version
* Text-only submissions only

---

## 4. Response JSON Schema

### Core response principle

The response must avoid “AI detector” framing. It should not include an AI percentage, guilt score, or definitive accusation.

Recommended wording:

* “review signals”
* “possible concern”
* “patterns worth reviewing”
* “teacher follow-up suggested”
* “not a final decision”

Avoid:

* “AI-generated probability”
* “cheating score”
* “detected as AI”
* “student used AI”
* “plagiarism confirmed”

### Recommended response structure

```json
{
  "schema_version": "1.0",
  "status": "completed",
  "submission_id": "uuid",
  "review_id": "uuid_or_null",
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "created_at": "ISO_DATE_TIME",
  "disclaimer": "This AI Writing Check provides teacher review signals only. It is not proof of misconduct and must not be used as the sole basis for penalties.",
  "input_metadata": {
    "word_count": 642,
    "character_count": 3821,
    "was_truncated": false,
    "text_type": "student_submission"
  },
  "overall_review": {
    "concern_level": "low",
    "confidence_level": "medium",
    "human_review_required": true,
    "summary": "The writing is generally consistent with student-level work, with some areas the teacher may want to review."
  },
  "signals": [
    {
      "signal_type": "tone_consistency",
      "severity": "low",
      "title": "Mostly consistent tone",
      "explanation": "The tone remains mostly consistent across the submission.",
      "evidence_excerpt": "Short excerpt from the student text",
      "teacher_note": "No major concern from this signal."
    }
  ],
  "writing_feedback": {
    "strengths": [
      "Clear paragraph structure",
      "Relevant response to the task"
    ],
    "areas_to_review": [
      "Some vocabulary may be above the expected level",
      "A few transitions sound unusually polished"
    ],
    "suggested_follow_up_questions": [
      "Can you explain how you planned this paragraph?",
      "Which part of this writing was most difficult for you?",
      "Can you rewrite one paragraph in your own words?"
    ],
    "suggested_teacher_actions": [
      "Compare with the student's previous writing if available",
      "Ask a short oral follow-up before making any decision",
      "Offer revision if the concern remains unclear"
    ]
  },
  "limitations": [
    "This result is not proof that AI was or was not used.",
    "Strong English learners may naturally produce polished writing.",
    "Short texts are harder to evaluate reliably.",
    "Teacher judgment is required."
  ]
}
```

### Recommended enum values

#### `status`

* `completed`
* `insufficient_text`
* `unsupported_submission_type`
* `rate_limited`
* `unauthorized`
* `error`

#### `concern_level`

* `low`
* `moderate`
* `high`
* `insufficient_text`
* `not_applicable`

#### `confidence_level`

* `low`
* `medium`
* `high`

This confidence level should mean confidence in the review quality, not confidence that the student used AI.

#### `signal_type`

* `tone_consistency`
* `vocabulary_level`
* `grammar_pattern`
* `structure_pattern`
* `coherence`
* `task_alignment`
* `overly_generic_language`
* `revision_needed`
* `insufficient_evidence`

#### `severity`

* `low`
* `moderate`
* `high`

---

## 5. Safe Prompt Draft

### System instruction draft

You are supporting a teacher with an AI Writing Check for a student submission.

This tool provides review signals only. It must not accuse the student of cheating. It must not claim that the text was definitely written by AI. It must not provide an AI probability percentage. It must not recommend penalties, point deductions, grade changes, badge changes, or disciplinary action.

Analyze the submitted writing cautiously and fairly. Consider that the student may be an English learner, may have improved, may have received help, may have revised carefully, or may naturally write in a polished style.

Return only structured JSON matching the requested schema.

Focus on:

* Writing consistency
* Vocabulary level
* Tone and style
* Organization
* Task alignment
* Areas the teacher may want to review
* Suggested follow-up questions
* Fair teacher next steps

Do not include moral judgment. Do not label the student. Do not use the phrase “AI detector.” Use “AI Writing Check.”

### User/content prompt draft

Review the following student writing for teacher-support signals only.

Assignment context:

* Title: [assignment_title_if_available]
* Student level: [student_level_if_available]
* Rubric focus: [rubric_focus_if_available]

Student submission:
[anonymized_submission_text]

Return a JSON object using the provided schema.

Important:

* Do not decide whether the student cheated.
* Do not provide an AI-generated percentage.
* Do not recommend punishment.
* Suggest teacher follow-up questions instead.
* If the text is too short, say it is insufficient for reliable review.
* If evidence is weak, say so clearly.

---

## 6. Privacy and Anonymization Rules

### Data that may be sent to Gemini

Only send the minimum needed for writing review:

* Student submission text
* Assignment title, if useful
* Task instructions, if useful
* Basic student level, if already available and non-sensitive
* Rubric focus, if available

### Data that should not be sent to Gemini

Do not send:

* Student name
* Student email
* Teacher name
* Class name unless truly necessary
* School/organization name
* Student login code
* Student PIN
* Student profile information
* Badge history
* Points history
* Reports
* Archive/restore status
* IP/device data
* Private teacher comments
* Other students’ submissions
* Attachments in Phase 19C

### Anonymization rules

Before calling Gemini:

* Replace student name if present.
* Remove emails and phone numbers where possible.
* Remove unnecessary URLs where possible.
* Avoid sending class identifiers.
* Avoid sending teacher identifiers.
* Send only the relevant submission text.
* Truncate long submissions.
* Do not send full database objects.

### Retention recommendation

For the first implementation, use a **non-persistent result** by default.

The first version should return the AI Writing Check result to the teacher without storing it permanently. This lowers privacy and RLS complexity.

Optional storage can be added after the basic flow is proven safe.

---

## 7. Optional Database Table Design

### Recommendation

Storage should be optional, not required for the first release.

Recommended rollout:

* **Phase 19C:** Non-persistent AI Writing Check result
* **Phase 19D or later:** Optional stored review history if needed

### Optional table name

`submission_ai_reviews`

### Purpose

Store AI Writing Check results for teacher reference, caching, audit history, and cost reduction.

### Suggested columns

| Column                  | Type                 | Purpose                            |
| ----------------------- | -------------------- | ---------------------------------- |
| `id`                    | uuid                 | Primary key                        |
| `submission_id`         | uuid                 | Linked submission                  |
| `task_id`               | uuid                 | Linked task                        |
| `class_id`              | uuid                 | Linked class                       |
| `teacher_id`            | uuid                 | Teacher who requested review       |
| `student_id`            | uuid nullable        | Optional link for ownership checks |
| `provider`              | text                 | Example: `gemini`                  |
| `model`                 | text                 | Example: `gemini-2.5-flash`        |
| `schema_version`        | text                 | Example: `1.0`                     |
| `status`                | text                 | Completed/error/rate-limited/etc.  |
| `concern_level`         | text                 | Low/moderate/high/etc.             |
| `confidence_level`      | text                 | Low/medium/high review confidence  |
| `summary`               | text                 | Short safe summary                 |
| `result_json`           | jsonb                | Full structured result             |
| `input_word_count`      | integer              | Metadata only                      |
| `input_character_count` | integer              | Metadata only                      |
| `input_hash`            | text                 | Used for caching/deduplication     |
| `was_truncated`         | boolean              | Whether text was shortened         |
| `created_at`            | timestamptz          | Review timestamp                   |
| `expires_at`            | timestamptz nullable | Optional retention cleanup         |
| `deleted_at`            | timestamptz nullable | Optional soft delete               |

### Storage rules

Do not store:

* Full prompt
* Full submitted text duplicate
* API key
* Student private profile
* Teacher private notes unless deliberately added later

Store:

* Result JSON
* Minimal metadata
* Ownership fields
* Hash of reviewed text for cache comparison

### Caching strategy

If stored results are enabled later:

* Generate `input_hash` from normalized submission text + task instruction + schema version + model.
* If the same teacher requests the same unchanged submission again, return cached result unless `force_new` is true.
* This can reduce cost and repeated AI calls.

---

## 8. RLS and Security Model

### RLS principle

AI review results must be teacher-owned.

Students should not see AI Writing Check results unless a future phase intentionally creates a student-facing explanation flow. For now, keep it teacher-only.

### Access rules

#### Anonymous users

No access.

#### Students

No access to AI review records.

Students should not be able to:

* View AI Writing Check results
* Create AI Writing Check results
* Update AI Writing Check results
* Delete AI Writing Check results

#### Teachers

Teachers may only view AI review records connected to submissions they own through their own classes/tasks.

Teachers should not see AI review results for other teachers’ students.

#### Edge Function

The Edge Function may insert AI review results only after verifying:

* Authenticated teacher identity
* Teacher owns the related class/task/submission
* Submission exists
* Submission is eligible for AI Writing Check

### RLS policy plan if storage is added

For `submission_ai_reviews`:

* Enable RLS.
* `SELECT`: teacher can select only rows where `teacher_id = auth.uid()` and the linked submission belongs to that teacher.
* `INSERT`: preferably only through Edge Function after server-side authorization.
* `UPDATE`: no direct client update in first stored version.
* `DELETE`: optional teacher-owned delete later.
* Students and anon users: no policies.

### Security checks inside Edge Function

The Edge Function should perform these checks before calling Gemini:

1. Validate JWT.
2. Load authenticated user.
3. Confirm user role is teacher.
4. Confirm submission ownership.
5. Confirm submission content is text-based.
6. Confirm request is within rate limit.
7. Confirm text length is acceptable.
8. Only then call Gemini.

This avoids paying for AI calls on unauthorized or invalid requests.

---

## 9. UI Integration Plan

### Recommended UI location

Add the feature inside the existing **Teacher Submission Review modal**.

Recommended section title:

**AI Writing Check**

Recommended subtitle:

“Teacher review signals only. Not proof of misconduct.”

### UI placement

Place it below the submitted answer/content area and near the existing teacher review tools.

Suggested layout:

1. Collapsed AI Writing Check card
2. Short disclaimer
3. Button: **Run AI Writing Check**
4. Loading state
5. Result summary
6. Signal cards
7. Suggested follow-up questions
8. Limitations/disclaimer
9. Optional rerun button
10. Optional save result button if storage is enabled later

### Button states

| State             | UI behavior                              |
| ----------------- | ---------------------------------------- |
| Not run           | Show “Run AI Writing Check”              |
| Loading           | Disable button, show “Checking writing…” |
| Completed         | Show result and “Run again”              |
| Rate limited      | Show friendly cooldown message           |
| Insufficient text | Explain that the text is too short       |
| Unauthorized      | Show generic access error                |
| Error             | Show safe retry message                  |

### Result display

Recommended result areas:

* Overall review
* Concern level badge
* Writing strengths
* Areas to review
* Specific signals
* Suggested teacher follow-up questions
* Limitations

### Badge wording

Use:

* Low concern
* Moderate concern
* High concern
* Insufficient text

Avoid:

* AI detected
* Cheating detected
* Guilty
* Fake
* AI percentage

### Student-facing visibility

Do not show AI Writing Check results on:

* Student dashboard
* Student submission page
* Student reports
* Badge pages
* Points history

The result is for teacher review only.

---

## 10. Review-Flow Integration Rules

### The AI Writing Check must not automatically change anything

The feature must not automatically change:

* Points
* Grades
* Review status
* Submission status
* Task status
* Badge awards
* Achievement logic
* Student reports
* Class reports
* Export results
* Archive/restore state
* Teacher notes
* Meeting logs

### Teacher decision remains final

The teacher can use the AI Writing Check as one input among many.

Recommended teacher workflow:

1. Read the student submission.
2. Run AI Writing Check if needed.
3. Review the signals cautiously.
4. Ask the student a follow-up question if needed.
5. Compare with previous student writing if available.
6. Decide manually.
7. Write teacher feedback manually.
8. Award/reduce points manually only if appropriate under normal classroom policy.

### No automatic report inclusion

AI Writing Check results should not appear in reports by default.

If report inclusion is added later, it should require explicit teacher action and careful wording.

---

## 11. Cost and Rate-Limit Strategy

### First-release cost strategy

Use manual trigger only.

Do not run automatically when:

* A student submits work
* A teacher opens the modal
* A report is generated
* A dashboard refreshes
* A task closes
* A student logs in

This keeps costs predictable.

### Recommended rate limits

Initial recommended limits:

| Limit                   | Recommendation    |
| ----------------------- | ----------------- |
| Per teacher per minute  | 3 checks          |
| Per teacher per day     | 30–50 checks      |
| Per submission cooldown | 1–5 minutes       |
| Maximum text length     | 3,000–5,000 words |
| Minimum text length     | 80–100 words      |

### Abuse prevention

Before calling Gemini:

* Verify authentication.
* Verify teacher ownership.
* Check daily quota.
* Check cooldown.
* Check content length.
* Check whether cached result exists if storage is enabled.

### Cost controls

Recommended:

* Use `gemini-2.5-flash`, not a heavier model.
* Keep prompt compact.
* Send only required text.
* Avoid attachments in first version.
* Avoid batch mode in first version.
* Add caching only after storage is approved.
* Log usage counts without storing sensitive content.

### Optional usage log

If stored review results are not added, a separate lightweight usage log may be useful later:

`ai_usage_logs`

Possible fields:

* `id`
* `teacher_id`
* `submission_id`
* `provider`
* `model`
* `status`
* `estimated_input_tokens`
* `estimated_output_tokens`
* `created_at`

This should also be teacher-owned/internal and not student-visible.

---

## 12. Risks and Blockers

### Risk 1: False accusations

AI writing review can be wrong. A student may write polished English naturally, receive legitimate help, revise carefully, or use grammar tools.

Mitigation:

* Never use “AI Detector.”
* Never show AI percentage.
* Always show disclaimer.
* Recommend follow-up questions instead of punishment.
* Keep teacher decision manual.

### Risk 2: Bias against strong or improving students

Students who improve quickly or use advanced vocabulary may be unfairly flagged.

Mitigation:

* Prompt must mention ESL learner variability.
* Results must include limitations.
* UI must encourage teacher comparison and conversation.
* Avoid punitive automation.

### Risk 3: Privacy exposure

Sending unnecessary student data to an AI provider creates privacy risk.

Mitigation:

* Send text only.
* Remove identifying information where possible.
* Avoid names, emails, class names, profiles, and points.
* Do not send attachments in first version.
* Do not store raw prompts.

### Risk 4: Cost abuse

Teachers might run many checks, or malicious users might try to trigger AI calls.

Mitigation:

* Auth required.
* Ownership checked before AI call.
* Manual trigger only.
* Per-teacher quotas.
* Per-submission cooldown.
* Optional caching later.

### Risk 5: Prompt injection

Student text may include instructions like “ignore previous instructions.”

Mitigation:

* Treat submission text as untrusted content.
* Put student text in a clearly delimited field.
* System prompt must state that student text is content to analyze, not instructions to follow.
* Validate JSON response.

### Risk 6: Schema drift

AI output may not perfectly match the expected JSON shape.

Mitigation:

* Use structured output mode.
* Validate JSON server-side.
* Return safe error if validation fails.
* Do not render unvalidated AI output directly.

### Risk 7: Overcomplicating first release

Adding storage, caching, reports, and dashboards immediately could increase risk.

Mitigation:

* Phase 19C should be non-persistent first.
* Add storage only after the basic flow is stable.

---

## 13. Recommended Phase 19C Implementation Plan

### Recommended Phase 19C scope

Build the first working version as a **non-persistent AI Writing Check MVP**.

Do not store results yet unless explicitly approved before implementation.

### Phase 19C goals

1. Create Supabase Edge Function `ai-writing-check`.
2. Add server-side Gemini API integration.
3. Keep Gemini API key in Supabase secrets only.
4. Require authenticated teacher JWT.
5. Verify teacher ownership before AI call.
6. Support text-based submissions only.
7. Return structured JSON review result.
8. Add UI button in Teacher Submission Review modal.
9. Display safe teacher-only result.
10. Confirm no automatic scoring/review/report changes.

### Phase 19C implementation steps

#### Step 1 — Edge Function skeleton

Create the Edge Function with:

* Auth required
* CORS handling
* Request validation
* Safe error responses
* No Gemini call yet

#### Step 2 — Authorization check

Add server-side logic to verify:

* User is authenticated
* User is a teacher
* Teacher owns the submission

Do this before calling Gemini.

#### Step 3 — Submission text fetch

Fetch only:

* Submission ID
* Submission text/content
* Task title/instructions if needed
* Minimal context required for review

Reject:

* Missing content
* Non-text submissions
* Too-short text
* Too-long text

#### Step 4 — Gemini integration

Add:

* `GEMINI_API_KEY` as Supabase secret
* Gemini 2.5 Flash model call
* Safe system prompt
* Structured JSON schema
* Output validation

#### Step 5 — UI integration

In the Teacher Submission Review modal, add:

* AI Writing Check card
* Run button
* Loading state
* Error state
* Result display
* Disclaimer

#### Step 6 — Safety wording

Add visible disclaimer:

“This AI Writing Check provides teacher review signals only. It is not proof of misconduct and should not be used as the sole basis for penalties.”

#### Step 7 — Testing

Test with:

* Teacher owns submission
* Teacher does not own submission
* Student account tries to call function
* Anonymous user tries to call function
* Empty submission
* Very short submission
* Long submission
* Normal student writing
* Very polished writing
* Prompt injection attempt inside student text
* Gemini error
* Invalid JSON response
* Rate limit scenario

#### Step 8 — Confirm no side effects

Verify that running AI Writing Check does not change:

* Points
* Badges
* Reports
* Review status
* Submission status
* Task status
* Archive/restore state
* Student dashboard
* Teacher dashboard counts

### Recommended post-19C phase

If Phase 19C works safely, Phase 19D can decide whether to add:

* `submission_ai_reviews` table
* RLS policies for stored AI review results
* Caching by `input_hash`
* Teacher review history
* Optional result deletion
* Usage logs
* Admin cost monitoring

---

## 14. No-Change Confirmation

Phase 19B is a planning/design phase only.

No code was changed.
No SQL was executed.
No Edge Function was created.
No Gemini API key was added.
No database schema was changed.
No RLS policy was changed.
No storage policy was changed.
No frontend app logic was changed.
No task logic was changed.
No submission logic was changed.
No review logic was changed.
No points logic was changed.
No badges logic was changed.
No reports logic was changed.
No archive/restore logic was changed.

Mission Control Remastered remains in the same functional state as after Phase 19A.
