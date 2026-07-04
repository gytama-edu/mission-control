# Hotfix Phase 25C.1: Guardian Access Routing Fix

## Issue
During Phase 25C, the automated script intended to wire up the new `GuardianAccess` component into the main routing state of `App.tsx` failed to match the target string due to a minor difference in the placeholder's button text. Consequently, the Phase 25A hardcoded static placeholder remained in the application, preventing users from seeing the new login form and Dashboard MVP.

## Resolution
- Modified `src/App.tsx` to correctly mount the `<GuardianAccess />` component when `viewMode === 'parent'`.
- Removed the hardcoded placeholder markup that read *"The Guardian Portal is currently in development..."* directly from the root app router.
- Verified that the `fetchGuardianStudentPreview` RPC function properly provides the read-only boundary data after the login form submission.

## Confirmations
- The Guardian Access pathway from the Landing screen now accurately resolves to the active Login validation form.
- The Dashboard MVP (including points, badges, task progression, and saved teacher feedback) displays correctly after authentication.
- Read-only constraints (no rank, no roster, no AI drafts, no editing) are fully preserved.
