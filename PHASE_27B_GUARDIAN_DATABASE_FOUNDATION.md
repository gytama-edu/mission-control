# Phase 27B — Guardian Portal Database Foundation

## Status

Implemented on the isolated branch `phase-27b-guardian-database-foundation`.

This phase adds only the Guardian Portal credential/session foundation.

It does **not** add:

- guardian login RPCs
- teacher credential controls
- guardian UI
- routing changes
- student or teacher dashboard changes
- Gemini or any other AI dependency

## Files

- `supabase/migrations/20260710_phase_27b_guardian_database_foundation.sql`
- `supabase/rollbacks/20260710_phase_27b_guardian_database_foundation_rollback.sql`

## Foundation Model

### `guardian_access_credentials`

One credential row may exist per student.

Stored values include:

- student relationship
- password hash of the reusable guardian secret
- non-sensitive short hint
- active state
- optional expiry
- failed-attempt and temporary-lock state
- creator and lifecycle timestamps

The reusable guardian secret itself is never stored.

The table is normalized through `student_id`. Class ownership will always be resolved through:

`guardian_access_credentials.student_id -> students.class_id -> classes.teacher_id`

This avoids storing a second `class_id` value that could become inconsistent with the student record.

### `guardian_sessions`

Guardian sessions are separate from reusable credentials.

Stored values include:

- credential relationship
- one-way hash of an opaque session token
- expiry
- revocation timestamp
- created and last-used timestamps

The raw session token will be returned once by a future login RPC and kept only in browser `sessionStorage` by the future Guardian UI.

## Security Boundary

Both tables have Row Level Security enabled.

No direct RLS policies are created for `anon` or `authenticated`. Table privileges are explicitly revoked from:

- `public`
- `anon`
- `authenticated`

The intended access path is future narrowly scoped `SECURITY DEFINER` functions only.

No existing teacher or student policy is modified.

## Automatic Revocation

The migration installs an internal update trigger on guardian credentials.

Every active session for a credential is revoked when any security-sensitive credential state changes:

- password hash rotation
- active/inactive state
- credential expiry
- explicit rotation timestamp

Changing non-security operational fields such as failed-attempt counters does not revoke valid sessions.

## Internal Helpers

### `guardian_revoke_sessions_for_credential(uuid)`

Revokes all currently active sessions for one credential and returns the number revoked.

Execution is revoked from browser-facing roles. It is intended only for trusted internal functions and triggers.

### `guardian_cleanup_expired_sessions(interval)`

Deletes expired or revoked sessions after a retention period. Default retention is seven days.

Execution is also revoked from browser-facing roles. It can later be called through trusted maintenance infrastructure.

## Constraints

The migration adds checks to prevent malformed foundation data, including:

- blank or obviously invalid credential hashes
- unsafe credential hints
- negative failed-attempt counts
- expiry before credential creation
- blank or obviously invalid session hashes
- session expiry before creation
- revocation or last-use timestamps before session creation

These constraints are defensive database checks. Future credential and session RPCs will perform stricter input and lifecycle validation.

## Indexes

Indexes support:

- active credential lookup by student
- active session lookup by credential and expiry
- expired-session cleanup

Unique constraints enforce:

- one guardian credential per student
- unique session-token hashes

## Rollback

The rollback script removes:

- credential trigger
- Guardian internal helper functions
- session table
- credential table

The rollback does not remove `pgcrypto` or the shared `extensions` schema because they may be used by other project features.

Running the rollback destroys all Guardian Portal credentials and sessions.

## Deployment Gate

Before applying this migration to the live Supabase project, run the Phase 27A inventory queries and confirm there are no remaining legacy Guardian objects.

If old objects exist, remove or rename them deliberately before applying this migration. Do not layer this foundation over unknown legacy functions, grants, policies, or columns.

## Regression Boundary

This phase does not alter:

- `classes`
- `students`
- `meetings`
- `activity_logs`
- tasks or submissions
- badges
- student access RPCs
- AI Writing Check
- AI Feedback
- Vite/GitHub Pages configuration
- frontend TypeScript or React code

## Next Phase

Phase 27C will add authentication RPCs only:

1. `guardian_begin_session`
2. `guardian_fetch_dashboard`
3. `guardian_end_session`

Phase 27C must include negative-path and privacy tests before any frontend route is enabled.
