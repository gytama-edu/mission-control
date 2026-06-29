# Phase 19A: AI Checker Integration Audit Report

## 1. Recommended Feature Name
**AI Writing Check** (or "Submission Authenticity Review").
*Reasoning:* These names avoid the accusatory tone of "AI Detector" or "Cheating Detected." They frame the tool as a supportive diagnostic feature that assists teacher judgment rather than rendering a final, unchallengeable verdict.

## 2. Best First Use Case
**Text-based task submissions only.**
*Reasoning:* Analyzing pure text submitted directly within Mission Control is the most reliable, lowest-latency, and least error-prone starting point. It avoids the complexities, costs, and higher failure rates associated with OCR on PDFs, image analysis, audio transcription, or external link scraping.

## 3. Teacher Workflow Recommendation
**Location:** Teacher Submission Viewer / Review Modal.
**Flow:**
1. The teacher opens a specific student's submission.
2. The teacher clicks a manual "Run AI Writing Check" button.
3. The system processes the text and displays the analysis in a dedicated panel within the review modal.
4. The teacher uses this information to inform their manual grading and feedback process.
*Reasoning:* A manual trigger ensures the teacher remains in control, prevents unnecessary API costs for submissions the teacher doesn't feel need checking, and reinforces that the tool is supplementary.

## 4. AI Check Output Recommendation
The output should provide signals, not proof.
* **Overall Concern Level:** Low / Medium / High
* **Writing Consistency Notes:** Observations on sudden shifts in tone or vocabulary.
* **Grammar/Style Observations:** Detection of highly formulaic, overly formal, or typical LLM phrasing patterns.
* **Suggested Teacher Action:** e.g., "Review manually," "Discuss with student."
* **Mandatory Disclaimer:** *"AI Writing Check gives review signals only. It should not be used as the sole basis for grading or accusations."*

## 5. Fairness/Ethics Risks & Safeguards
**Risks:**
* **False Positives:** Advanced students, non-native English speakers (ESL), or neurodivergent students often trigger AI detectors at higher rates.
* **Grammar Tools:** Use of Grammarly or similar assistive tools can trigger false positives.
* **Short Answers:** Analyzing 1-2 sentences yields highly unreliable results.
**Safeguards:**
* **Never Auto-Penalize:** The system must never automatically deduct points, assign badges, or fail a student based on this check.
* **Acknowledge Uncertainty:** The UI and prompts must explicitly state that the results are probabilistic.
* **Encourage Dialogue:** UI actions should suggest "Discuss with student" rather than "Punish."

## 6. Privacy Recommendations
* **Data Sent:** Only send the `submission text`, `task title`, and (optionally) `task instructions` to the AI provider.
* **Data Withheld:** Do NOT send the student's name, nickname, PIN, or any personally identifiable information (PII).
* **Visibility:** Results must be visible *only* to the teacher who owns the class. Students should not see the raw AI check results to prevent gamification of the detector.

## 7. API/Backend Architecture Recommendation
**Supabase Edge Function** (or a secure server-side endpoint).
* **Security:** The API key for the AI model (e.g., OpenAI, Gemini) must live securely in the backend environment variables.
* **Verification:** The Edge Function must verify the authenticated teacher's JWT and confirm they own the `class_id` associated with the `submission_id` before invoking the AI model.
* **Frontend:** The React frontend will simply call the Edge Function via `supabase.functions.invoke()`.

## 8. Database/Schema Recommendation
A new table is recommended to cache results and avoid repeated costly API calls for the same submission text.
**Proposed Table:** `submission_ai_reviews`
* `id` (uuid, PK)
* `submission_id` (uuid, FK)
* `class_id` (uuid, FK)
* `task_id` (uuid, FK)
* `student_id` (uuid, FK)
* `concern_level` (text: low/medium/high)
* `summary` (text)
* `evidence_notes` (jsonb)
* `created_at` (timestamptz)

## 9. RLS/Security Recommendation
For the new `submission_ai_reviews` table:
* **Teachers:** Can `SELECT`, `INSERT`, `UPDATE` where `classes.teacher_id = auth.uid()`.
* **Students:** No access (`SELECT` blocked).
* **Anon:** No access.
This strictly adheres to the Phase 18J RLS Lockdown model.

## 10. Cost/Performance Recommendation
* **Manual Execution:** Do not auto-run checks on every submission to aggressively control token costs.
* **Result Caching:** Once run, the result is stored in the database. If the teacher opens the submission again, the cached result is displayed.
* **Re-run Logic:** Only allow a "Re-run" if the submission text changes (e.g., if the student resubmits) or if explicitly requested via a secondary action.

## 11. UI/UX Recommendation
* **Trigger:** A subtle, secondary button in the review modal: "Run AI Writing Check".
* **State:** A clear loading spinner with text: "Checking writing signals..."
* **Result Card:** A visually distinct card (perhaps using warning colors for High concern, neutral for Low) that separates the AI assessment from the student's actual work.
* **Actions:** Provide quick buttons for the teacher to "Acknowledge" or "Add to Feedback Notes."

## 12. Review-Flow Integration Recommendation
The AI check must be completely decoupled from the actual state-changing logic of the review.
* Running the check does **not** change the submission status to "reviewed."
* It does **not** alter the awarded points.
* It does **not** interact with the safe point-awarding delta logic or badge logic.
* It is purely informational context presented to the teacher *while* they make their manual grading decisions.

## 13. Prompting Recommendation
The system prompt to the LLM should be heavily constrained:
* **Focus:** "Analyze this text against the provided task instructions for consistency, writing level, and generic AI-style phrasing."
* **Constraints:** "Do not accuse the student. Do not claim absolute certainty. Provide an objective analysis of the text's characteristics."
* **Output:** Force a structured JSON output (e.g., `concern_level`, `summary`, `notes`) to easily parse and render in the UI.

## 14. Risks/Blockers
* **LLM API Latency:** Waiting for a response might disrupt the teacher's grading flow if it takes >5 seconds. (Mitigation: Asynchronous UI loading state).
* **Token Limits:** Extremely long text submissions might hit token limits or cost significantly more. (Mitigation: Truncate text to a reasonable limit, e.g., 2000 words, before sending).

## 15. Recommended Phase 19B Plan
**Phase 19B: AI Checker Architecture Plan + Edge Function Design.**
Draft the exact Supabase Edge Function TypeScript code, the required environment variable setup, and the specific database migrations needed for the `submission_ai_reviews` table, without yet deploying them to production.

## 16. Confirmation of System Integrity
**Confirmed.** 
No code, SQL, RLS policies, storage policies, or application logic was changed during this audit phase. The Supabase RLS lockdown, teacher isolation, and secure student RPCs remain fully intact and operational.
