# Hotfix Phase 25B.2: Inline Guardian Controls

## Issue
While guardian code controls were added to the Edit Student modal, there was no quick, visible way in the teacher roster to generate a code for a student who was missing one, or to immediately copy/reset an existing code without entering edit mode.

## Resolution
- Updated `src/components/ClassDetail.tsx` to include inline guardian code management within both the Desktop/Tablet table view and the Mobile grid view.
- Under the `Credentials` column (or inline credentials section on mobile):
  - A prominent "Generate" button appears for students without a code.
  - For students with an active code, the code is clearly displayed alongside "Copy" and "Reset" action buttons.
- These inline buttons hook directly into the established `handleResetGuardianCode` and `handleCopyGuardianInfo` methods to guarantee functional parity with the edit modal controls.

## Confirmations
- Teachers can now visually identify students missing a Guardian Code and generate one with a single click from the main roster.
- Resetting and generating inline respects the same confirmation barriers and side-effect guarantees (does not mutate `pin`, points, or lives).
- The AI privacy rules and read-only parent limitations are unaffected.
