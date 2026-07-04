# Hotfix Phase 25B.4: Guardian Access Login Validation

## Cause of "We could not verify this guardian access code"
The Guardian Access login failed due to two discrepancies in the database RPC functions (`guardian_verify_access` and `guardian_fetch_dashboard_data`):
1. **Wrong Class Code Field**: The RPCs attempted to query `WHERE class_code = UPPER(p_class_code);`, but the actual column name used in the `classes` table for login is `join_code`.
2. **Missing Scoring System Column**: The RPCs attempted to select `scoring_system` and `category` from the `classes` table, but the table schema uses `class_category` and does not have a `scoring_system` column natively (scoring rules are inferred or mapped elsewhere). This caused the queries to silently fail or throw a database constraint error during validation.

## Resolutions
1. **RPC Re-written and Migrated**: 
   - Created `supabase/migrations/20260704_guardian_rpc_fix.sql` to apply the fixed functions and updated `supabase/schema.sql`.
   - Replaced `class_code` with `join_code`.
   - Selected `class_category` directly from the `classes` table instead of the non-existent `category` and `scoring_system` columns.
2. **Standardized Fields**: Confirmed that the target fields are exclusively `join_code` and `guardian_access_code`. No `parent_access_code` or `classCode` aliases were mixed into the raw schema.
3. **Login Normalization**: 
   - Strengthened `fetchGuardianStudentPreview` in `src/services/missionControlData.ts` to execute `.trim().toUpperCase()` on both `classCode` and `guardianCode` before passing them to the RPC.
   - The RPC functions also use `upper(trim())` logic for strict case-insensitive and space-insensitive matching.
4. **Improved Copy Instructions**: Verified that `handleCopyGuardianInfo` correctly outputs the target class code dynamically via `classData.joinCode` instead of student pin, providing a reliable text string for parents.
5. **Secure Debug Logging**: Enhanced `fetchGuardianStudentPreview` to log only safe metadata (such as input lengths and success/failure statuses) without exposing pins, raw text, or student data.

All checklist requirements have been met.
