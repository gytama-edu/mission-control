# Phase 27E — Guardian Read-Only Portal

## Status

Implemented on the isolated branch `phase-27e-guardian-read-only-portal`.

This phase connects the public Guardian access path to the secure Phase 27C RPCs. It does not change the Guardian database schema, credential generation rules, teacher ownership rules, student login, classroom controls, AI features, or deployment configuration.

## Dependencies

Phase 27E depends on the following database phases being applied in order:

1. Phase 27B — Guardian credential and session tables
2. Phase 27C — Guardian login, dashboard, and logout RPCs
3. Phase 27D — teacher-owned credential controls

The public portal must not be deployed before those migrations exist in the target Supabase project and their SQL verification scripts pass in a non-production environment.

## Files

- `src/services/guardianPortalData.ts`
- `src/components/GuardianAccess.tsx`
- `src/App.tsx`
- `src/components/Landing.tsx`
- `PHASE_27E_GUARDIAN_READ_ONLY_PORTAL.md`

## Public Authentication Flow

The Guardian enters:

- class code
- 20-character Guardian code

The frontend calls `guardian_begin_session`. Every credential rejection uses the same public-facing message. The UI does not identify whether rejection was caused by:

- an unknown class code
- an unknown Guardian lookup segment
- an incorrect full code
- a disabled credential
- an expired credential
- a temporarily locked credential
- an archived class

Unexpected Supabase or PostgreSQL errors are logged to the browser console for technical diagnosis but are not displayed verbatim to the Guardian.

## Session Storage

The successful login response contains an opaque Guardian session token and expiry timestamp.

The frontend stores them only in `window.sessionStorage`:

- `mission_control_guardian_session_token`
- `mission_control_guardian_session_expiry`

The token is not stored in:

- `localStorage`
- cookies
- URL parameters
- application database rows in plaintext
- class or student objects

The browser session is therefore scoped to the current tab and automatically disappears when the tab is closed. The frontend also removes locally expired sessions before attempting a dashboard request.

## Session Restoration and Revocation

When the Guardian portal is reopened in the same tab, it attempts to restore the session and calls `guardian_fetch_dashboard` again. The stored token is never treated as proof by itself.

A session is cleared locally when the server reports `invalid_session`, including after:

- logout
- session expiry
- credential rotation
- credential disabling
- credential expiry
- class archive
- server-side session revocation

The portal also refreshes quietly when the browser tab becomes visible again, allowing server-side revocations and progress updates to be recognized without a full page reload.

## Read-Only Dashboard

The frontend displays only fields returned by the Phase 27C allowlist:

### Class

- class name
- level when available
- class category
- points or lives display mode

### Student

- display name
- nickname when available
- points in points mode
- lives in lives mode

### Tasks

- title
- limited description
- task type
- due date
- student-specific submission status
- awarded points
- saved teacher feedback
- submitted and reviewed timestamps

### Badges

- badge name
- description
- icon
- awarded date

### Recent progress

- sanitized neutral label
- timestamp
- mode-appropriate points or lives delta when available

## Explicitly Unavailable

The component has no frontend field or rendering path for:

- database IDs
- student PIN
- class join code after authentication
- complete Guardian credential after authentication
- Guardian hashes or lookup keys
- session hashes
- teacher identity
- class roster
- rank or leaderboard
- other students
- group names or members
- submission text
- attachments or storage paths
- raw activity-log reasons
- raw activity metadata
- meeting summaries
- AI Writing Check output
- AI feedback-generation internals
- editing, submission, grading, point, life, badge, or task mutations

## User Experience

The Guardian Portal includes:

- automatic Guardian-code formatting using the approved alphabet
- generic invalid-credential messaging
- tab-scoped session restoration
- secure sign-out
- manual refresh
- visibility-based refresh
- retry behavior for temporary network failures
- task and teacher-feedback cards
- badge summaries
- sanitized recent progress
- responsive empty states
- an explicit privacy boundary notice

The dashboard states that rank and the class leaderboard are not shown.

## App Integration

The existing `parent` view-mode value remains in place to avoid changing persisted navigation behavior. The old development placeholder in `App.tsx` is replaced with:

```tsx
<GuardianAccess onBack={() => handleSetViewMode('landing')} />
```

Teacher Guardian management remains a separate authenticated class screen. Student access remains a separate Class Code + PIN flow.

## Runtime Verification Gate

Before merging or deploying, run the following against a non-production Supabase project and a local frontend checkout.

### Database

1. Apply Phase 27B.
2. Run the Phase 27B inventory and foundation checks.
3. Apply Phase 27C.
4. Run `supabase/tests/20260710_phase_27c_guardian_auth_rpcs_test.sql`.
5. Apply Phase 27D.
6. Run `supabase/tests/20260710_phase_27d_guardian_teacher_controls_test.sql`.

### Frontend build

```bash
npm ci
npm run lint
npm run build
```

### Browser matrix

1. Open Guardian Access with no stored session.
2. Confirm incomplete codes cannot be submitted.
3. Confirm invalid credentials produce one generic error.
4. Generate a code from the teacher screen.
5. Confirm the generated code signs in successfully.
6. Confirm the token exists only in `sessionStorage`.
7. Confirm refresh restores the same valid session.
8. Confirm opening another tab does not inherit the session.
9. Confirm manual refresh updates progress without navigation.
10. Confirm returning to a visible tab refreshes progress.
11. Confirm sign-out invalidates the current token.
12. Confirm rotating the code signs out the old session.
13. Confirm disabling access signs out the active session.
14. Confirm archiving the class invalidates the session.
15. Confirm regular classes show points and no lives card.
16. Confirm private classes show lives and no points card.
17. Confirm no rank or leaderboard is visible.
18. Confirm no other student name appears.
19. Confirm no PIN, submission text, attachment path, raw log reason, raw metadata, meeting summary, or AI review output appears.
20. Confirm empty task, badge, and recent-progress states render correctly.
21. Confirm mobile and desktop layouts remain usable.
22. Confirm teacher and student flows still work unchanged.

## Validation Status in This Environment

The branch source and RPC contracts were statically reviewed. A real repository checkout was attempted for TypeScript and Vite validation, but this execution environment could not resolve `github.com`, so `npm run lint` and `npm run build` could not be executed here.

No claim is made that runtime validation has passed. Production deployment remains blocked until the database tests, frontend build, and browser matrix above are completed.

## Regression Boundary

Phase 27E does not modify:

- Guardian tables or RLS
- Guardian SQL functions
- teacher ownership enforcement
- teacher credential management screen
- student Class Code + PIN RPCs
- teacher authentication
- roster ordering
- point or life controls
- classroom sessions
- tasks or submission mutations
- AI Writing Check
- AI Feedback
- Vite configuration
- GitHub Pages workflow
- Gemini configuration
