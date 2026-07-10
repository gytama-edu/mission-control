# Phase 27C — Guardian Authentication and Read-Only Dashboard RPCs

## Status

Implemented on the isolated branch `phase-27c-guardian-auth-rpcs`.

This phase adds database RPCs and verification SQL only. It does not add React components, teacher credential controls, routing, browser storage, deployment changes, or live Supabase execution.

## Dependency

Phase 27C depends on the Phase 27B database foundation:

- `guardian_access_credentials`
- `guardian_sessions`
- RLS lockdown
- session-revocation trigger
- internal cleanup helper

The Phase 27B migration must be applied first.

## Files

- `supabase/migrations/20260710_phase_27c_guardian_auth_rpcs.sql`
- `supabase/rollbacks/20260710_phase_27c_guardian_auth_rpcs_rollback.sql`
- `supabase/tests/20260710_phase_27c_guardian_auth_rpcs_test.sql`
- `PHASE_27C_GUARDIAN_AUTH_RPCS.md`

## Credential Format

Phase 27C formalizes a 20-character Guardian code using this alphabet:

`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`

Ambiguous characters `I`, `O`, `0`, and `1` are excluded.

A displayed code may be grouped with hyphens, but authentication normalizes only whitespace and hyphens. For example:

`ABCDEFGH-JKLM-NPQR-STUV`

normalizes to:

`ABCDEFGHJKLMNPQRSTUV`

The first eight normalized characters are stored as a non-secret `lookup_key`. The complete normalized code is checked against the stored password hash. The database never stores the full reusable code.

The lookup key is necessary because class code plus a fully hashed secret otherwise requires testing every Guardian hash in a class. A unique lookup key allows one bounded password-hash verification and makes per-credential lockout possible without locking unrelated families.

## RPC 1: `guardian_begin_session`

Inputs:

- class code
- Guardian code

Behavior:

1. Enforces strict input lengths.
2. Normalizes class code casing.
3. Removes only Guardian-code whitespace and hyphens.
4. Uses the first eight characters to locate one credential.
5. Confirms that the credential belongs to a student in the supplied class.
6. Rejects archived classes, disabled credentials, expired credentials, and active lockouts.
7. Verifies the full secret using `pgcrypto` password hashing.
8. Records failed attempts against only the located credential.
9. Applies a 15-minute lock after five failed attempts.
10. Generates a random 256-bit session token.
11. Stores only a SHA-256 digest of the session token.
12. Returns the raw token once with a fixed 12-hour expiry.

Every login failure returns the same external result:

```json
{
  "ok": false,
  "reason": "invalid_credentials"
}
```

This prevents the response from identifying whether the class, lookup key, password, lock status, expiry, or archive state caused rejection.

## RPC 2: `guardian_fetch_dashboard`

Input:

- opaque Guardian session token

The function hashes the token, validates the session and credential chain, and constructs a new JSON payload. It never returns raw table rows.

### Returned class fields

- class name
- level when available
- class category
- derived display mode

Current display-mode mapping follows the stable classroom model:

- `regular` → `points`
- `private` → `lives`

### Returned student fields

- name
- nickname when available
- points only in points mode
- lives only in lives mode

### Returned badge fields

- name
- description
- icon
- awarded date

### Returned task fields

- title
- description, limited to 1,000 characters
- task type
- due date
- student-specific status
- awarded points
- saved teacher feedback
- submitted date
- reviewed date

Only published or closed tasks are returned. Group tasks are included only when the child is assigned to that task. Group names, members, submitters, and other students are excluded.

### Returned recent progress

The RPC converts an allowlist of student-specific activity types into neutral labels. It may include mode-appropriate point or life changes, but does not return raw reasons or metadata.

### Explicitly excluded

- database IDs
- student PIN
- Guardian code, hash, hint, or lookup key
- session hashes
- class code
- teacher identity
- class roster
- rank or leaderboard
- other students
- group names or members
- submission text
- attachments or storage paths
- raw activity-log reasons or metadata
- meeting summaries
- AI Writing Check output
- AI-generated feedback internals
- draft or archived tasks

Invalid, expired, revoked, disabled, locked, or archive-invalidated sessions return:

```json
{
  "ok": false,
  "reason": "invalid_session"
}
```

When a matching session is no longer valid because of server-side state, the RPC also revokes it.

## RPC 3: `guardian_end_session`

Input:

- opaque Guardian session token

The function hashes the token and revokes a matching session. Logout is idempotent and always returns success, including for malformed, missing, expired, previously revoked, or unknown tokens. It therefore does not act as a token-existence oracle.

## Direct-Access Boundary

The Guardian tables remain protected by Phase 27B:

- RLS enabled
- no direct browser policies
- no `anon` table privileges
- no `authenticated` table privileges

Only the three Phase 27C RPCs receive explicit execution grants for browser roles.

## Verification Script

The test script runs inside a transaction and rolls back every fixture. It verifies:

- browser roles do not receive direct Guardian-table access
- browser roles can execute only the intended RPC surface
- wrong secret rejection
- wrong class rejection
- failed-attempt accounting
- active lockout rejection
- case and hyphen normalization
- valid session creation
- one-student dashboard scope
- regular-class points mode
- task, badge, and sanitized progress inclusion
- no other-student leakage
- no submission-text leakage
- no badge-reason leakage
- no raw activity reason or metadata leakage
- no internal ID or PIN leakage
- logout revocation and idempotency
- archived-class session invalidation and revocation
- expired-credential rejection

The test must be run in a non-production Supabase environment after applying Phase 27B and Phase 27C.

## Security Limits at This Phase

The database can enforce per-credential lockout because the code contains a non-secret lookup segment. Source-IP throttling is not implemented inside PostgreSQL because the RPC does not receive a trustworthy client network identity. Platform-level rate limiting may be added later without weakening the current database boundary.

The teacher cannot create a Guardian credential through the application yet. Phase 27D will add teacher-owned generation, one-time copy, rotation, and disable controls.

## Regression Boundary

Phase 27C does not modify:

- existing tables used by teachers or students
- student Class Code + PIN RPCs
- task submission or review RPCs
- badge-award behavior
- AI Writing Check
- AI Feedback
- frontend types or components
- `App.tsx`
- Vite configuration
- GitHub Pages configuration
- Gemini configuration

## Deployment Gate

Do not apply these migrations to production until the live Supabase inventory confirms that no unexpected legacy Guardian objects or rows conflict with Phase 27B and Phase 27C.
