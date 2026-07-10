# Phase 27D — Teacher-Owned Guardian Credential Controls

## Status

Implemented on the isolated branch `phase-27d-guardian-teacher-controls`.

This phase adds authenticated teacher controls for Guardian credentials. It does not enable the public Guardian Portal, change student login, expose Guardian secrets after creation, alter classroom point/life behavior, or modify AI features.

## Dependencies

Phase 27D must be applied after:

1. Phase 27B Guardian database foundation
2. Phase 27C Guardian authentication and read-only dashboard RPCs

The live database inventory gate from the earlier phases still applies. These migrations have not been run against production by this repository change.

## Files

- `supabase/migrations/20260710_phase_27d_guardian_teacher_controls.sql`
- `supabase/rollbacks/20260710_phase_27d_guardian_teacher_controls_rollback.sql`
- `supabase/tests/20260710_phase_27d_guardian_teacher_controls_test.sql`
- `src/services/guardianTeacherData.ts`
- `src/components/GuardianManagement.tsx`
- `src/App.tsx`
- `PHASE_27D_GUARDIAN_TEACHER_CONTROLS.md`

## Teacher RPC Surface

All Phase 27D browser-facing RPCs are granted only to `authenticated`. The `anon` role receives no execution grant.

Every operation validates exact ownership through:

`students.class_id → classes.id → classes.teacher_id = auth.uid()`

The previous permissive legacy pattern that allowed `teacher_id is null` is not used.

### `guardian_teacher_list_credentials`

Input:

- class ID

Returns one status item per student in the teacher-owned class:

- student ID for teacher UI row matching
- student name and nickname
- credential state
- active/disabled state
- final four-character hint
- expiry, lock, creation, rotation, and last-used timestamps
- count of currently active Guardian sessions

It never returns:

- the complete Guardian code
- password hashes
- lookup keys
- session hashes or tokens
- student PINs
- another class roster

Credential states are:

- `not_configured`
- `active`
- `disabled`
- `expired`
- `locked`

### `guardian_teacher_create_credential`

Input:

- student ID

Behavior:

1. Confirms the authenticated teacher owns the student.
2. Rejects duplicate creation with `already_configured`.
3. Generates a cryptographically random 20-character Guardian code.
4. Stores only:
   - the first eight-character non-secret lookup key
   - a bcrypt password hash
   - the final four-character display hint
5. Returns the formatted Guardian code exactly once.

A returned code has this format:

`XXXXXXXX-XXXX-XXXX-XXXX`

The full plaintext code is never written to a table, activity log, browser storage, or application state outside the temporary in-memory dialog.

### `guardian_teacher_rotate_credential`

Input:

- student ID

Behavior:

- validates ownership
- requires an existing credential
- generates a new code
- replaces the lookup key, hash, and hint
- resets failed attempts and lockout
- re-enables the credential
- revokes every previous Guardian session through the database trigger
- returns the new code exactly once

The old code stops authenticating immediately.

### `guardian_teacher_set_credential_active`

Inputs:

- student ID
- desired active state

Disabling access immediately revokes all active Guardian sessions. Re-enabling access does not restore revoked sessions; the guardian must log in again using the current code.

## Random-Code Generation

The internal generator uses `pgcrypto.gen_random_bytes` and this 32-character alphabet:

`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`

Ambiguous characters are excluded. Because the alphabet contains exactly 32 symbols, each random byte can be mapped with modulo 32 without distribution bias.

The generator and formatting helper are internal functions. They have no browser execution grants.

## Teacher UI

A `Guardian Access` button appears as an isolated floating action in the active class view. It opens a dedicated management screen rather than inserting new controls into the classroom roster table.

This protects the stable rapid-click classroom workflow from layout and state changes.

The management screen provides:

- student-by-student credential status
- configured and active totals
- manual refresh
- Generate Access
- Rotate Code
- Enable
- Disable
- final-four-character hint
- last-used time
- active-session count

### One-time code dialog

After creation or rotation, the readable Guardian code is held only in React component memory and displayed in a modal.

The teacher can:

- copy the code
- manually select it if clipboard access fails
- close the dialog after saving it

Closing the dialog deletes the readable code from component state. The application does not save it to `localStorage`, `sessionStorage`, the database, or activity logs.

### Confirmation boundaries

Rotation warns that:

- the previous code will stop working
- all active sessions will be revoked

Disabling warns that all active Guardian sessions will be signed out.

## Guardian Portal Status

The public Guardian/Parent entry remains the existing development placeholder. Phase 27D creates teacher credentials but does not enable public login or dashboard UI.

The Guardian-facing UI remains Phase 27E.

## Verification Script

The Phase 27D SQL test runs in a transaction and rolls back all fixtures. It verifies:

- `anon` cannot execute teacher RPCs
- `authenticated` has the intended execution grants
- an owned class can be listed
- another teacher's class cannot be listed
- another teacher's student cannot be managed
- generated code format and entropy alphabet
- only lookup key, bcrypt hash, and hint are stored
- duplicate creation does not reveal or replace a code
- the generated code works with Phase 27C login
- disabling revokes active sessions
- enabling allows a new login without restoring old sessions
- rotation returns a different code
- rotation invalidates the old code and old sessions
- unconfigured students cannot be rotated or enabled
- status responses never contain full codes or hashes

## Regression Boundary

Phase 27D does not modify:

- `ClassDetail.tsx`
- roster ordering
- optimistic point/life updates
- teacher authentication
- student Class Code + PIN authentication
- task submission or review functions
- badges
- reports
- session history
- AI Writing Check
- AI Feedback
- Guardian public login
- Vite base path
- GitHub Pages workflow
- Gemini configuration

## Rollback

The rollback removes only the four teacher RPCs and the two internal code-generation helpers introduced in Phase 27D. Phase 27B tables and Phase 27C Guardian authentication RPCs remain intact.

## Next Phase

Phase 27E may replace the public Guardian placeholder with the isolated read-only Guardian login and dashboard. It must use only:

- class code
- Guardian code for initial login
- the short-lived Guardian session token after login

It must not import teacher mutation services, student submission mutations, badge mutation services, or AI review services.
