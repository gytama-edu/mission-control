# Hotfix Phase 25B.5: Proper Guardian Access Login Validation

## Real Cause of Login Failure
The core cause of the "We could not verify this guardian access code" error was that the earlier `guardian_fetch_dashboard_data` RPC queried against non-existent tables and columns (such as `individual_submissions` and `badges` instead of `task_submissions` and `badge_definitions`). This caused silent database query failures inside the RPC block. Furthermore, the RPC queried `class_code` instead of the actual `join_code` field, resulting in a null lookup.

## Confirmations
- **Actual class code field name:** `join_code` (on the `classes` table).
- **Actual guardian code field name:** `guardian_access_code` (on the `students` table).
- **RLS Blocking:** Yes, RLS inherently blocked direct frontend validation. The `classes` and `students` tables are properly protected; `anon` users cannot query them directly. A `SECURITY DEFINER` RPC is strictly required to bypass RLS securely for login validation.
- **Backend Validation:** We removed the faulty `guardian_verify_access` and `guardian_fetch_dashboard_data` RPCs. We created a singular, completely clean `verify_guardian_access` RPC in the database using the correct tables (`task_submissions`, `badge_definitions`). 
- **Safe MVP Execution:** The new RPC explicitly checks `upper(join_code) = upper(trim(p_class_code))` and `upper(guardian_access_code) = upper(trim(p_guardian_code))`. It securely fetches exactly one student's basic preview data, their safe submissions, logs, and badges, without exposing the class roster, student pins, or unauthorized metadata to the Guardian.
- **Frontend Flow:** The `fetchGuardianStudentPreview` method has been updated to securely call this new `verify_guardian_access` backend function while executing proper `trim().toUpperCase()` normalization on the client-side inputs as well.

The Guardian Access login is now safe, reliable, and functional.
