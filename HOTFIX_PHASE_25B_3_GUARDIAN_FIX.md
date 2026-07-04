# Hotfix Phase 25B.3: Guardian Code Generation Fix

## Cause of "Failed to reset guardian code"
The `alert('Failed to reset guardian code')` error triggered because `db.updateGuardianCode()` threw an exception. This happened because the database rejected the `.update({ guardian_access_code: newCode })` payload, indicating that the `guardian_access_code` column was missing in the real database environment. The UI failed to display the exact database error because it was hardcoded to a generic alert message, and local UI state was not optimistically updated for instant feedback. 

## Resolutions
1. **Migration File Added**: Created `supabase/migrations/20260704_guardian_access_code.sql` containing the safe additive migration (`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS guardian_access_code text;`) to ensure the column is provisioned.
2. **Standardized Field Name**: Confirmed all instances across types, creation flows, RPCs, and updates strictly use `guardian_access_code`. Added this field to the `Student` interface in `src/types.ts`.
3. **Optimistic Local State**: Replaced the forced `onSync` wait time with an optimistic state update (`optimisticGuardianCodes`) that immediately displays the newly generated code in both the main roster view and the modal, satisfying the "Update local state immediately" requirement.
4. **Improved Error Handling**: Removed the blocking browser alert. Replaced it with an inline, dismissible error banner at the top of the roster view. The generic message is replaced with the requested safe message: *"Guardian code could not be generated. Please sync and try again."*
5. **Console-Safe Debugging**: Added safe debug logs to `updateGuardianCode` that verify if the `studentId` exists, if the generated code exists, and output a clean success/failure state without exposing sensitive data.
6. **Confirmed Reset/Generate Logic**: Both "Generate" and "Reset" buttons correctly use the targeted `student.id`, trigger the confirmation modal when applicable, and save securely.

All checklist requirements have been met.
