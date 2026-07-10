# Phase 27F — Guardian Validation Report

## Status

**Passed.**

Validation was executed through GitHub Actions on the isolated branch:

- Branch: `phase-27f-guardian-validation-gate`
- Draft PR: `#6` against `phase-27e-guardian-read-only-portal`
- Successful workflow: `Guardian Portal Validation`
- Successful run ID: `29081005692`
- Validated commit: `119b04f40390acc84091a1959cc7458d8a3c9647`

Neither `main` nor the production Supabase project was modified.

## Validation Infrastructure

Phase 27F adds:

- `.github/workflows/guardian-validation.yml`
- `scripts/validate-guardian-database.sh`
- `supabase/tests/20260710_phase_27f_guardian_browser_fixture.sql`
- `tests/guardian-portal.e2e.mjs`

The database runner refuses non-local database URLs unless the operator deliberately sets `ALLOW_NON_LOCAL_GUARDIAN_VALIDATION=1`.

## Frontend Gate

The following commands completed successfully from the committed lockfile:

```bash
npm ci
npm run lint
npm run build
```

The workflow also verified:

- `dist/index.html` exists
- `dist/assets` exists
- the Vite production output is deployable

This proves the Phase 27E React and TypeScript changes compile with the current repository dependencies and production Vite configuration.

## Local Supabase Gate

The workflow created an isolated local Supabase stack and then applied SQL in this explicit order:

1. `supabase/schema.sql`
2. Phase 27B Guardian database foundation
3. Phase 27C Guardian authentication and dashboard RPCs
4. Phase 27D teacher credential controls

The following verification suites passed:

- `supabase/tests/20260710_phase_27c_guardian_auth_rpcs_test.sql`
- `supabase/tests/20260710_phase_27d_guardian_teacher_controls_test.sql`

The successful run therefore confirms:

- Guardian tables and constraints can be created on the committed baseline schema
- RPC definitions compile in PostgreSQL
- browser roles retain the intended privilege boundary
- credential failure responses remain generic
- session creation, expiry, revocation, and logout work
- archived classes and disabled credentials invalidate sessions
- credential rotation invalidates old codes and sessions
- dashboard payloads remain scoped to one student
- denylisted submission text, reasons, metadata, PINs, internal IDs, and other-student data do not leak
- teacher management RPCs enforce exact class ownership
- one-time code creation and rotation integrate with Guardian login

## Startup Issue Found and Corrected

The first database workflow attempt failed before project SQL ran because `supabase start` automatically attempted to apply repository migrations before the separately committed baseline schema existed.

The validation workflow now temporarily stages `supabase/migrations` outside the Supabase project during startup, restores them immediately afterward, and applies the baseline plus Guardian migrations explicitly in dependency order.

The corrected database workflow passed in run `29080764437`, before the browser test was added.

## Chromium End-to-End Gate

A disposable local fixture was created with:

- one Guardian-visible student
- one forbidden second student
- a known Guardian test credential
- a reviewed task with teacher feedback
- a badge
- a sanitized progress event
- deliberate private values that must never reach the page

Headless Chromium then completed this workflow successfully:

1. Open Mission Control at the deployed base path `/mission-control/`
2. Select Guardian Access from the landing page
3. Submit a validly formatted wrong code
4. Confirm the generic rejection message
5. Sign in with the valid Class Code and Guardian Code
6. Confirm the correct student, class, points, task, feedback, badge, and progress event
7. Confirm no other-student name, PIN, submission text, badge reason, teacher reason, or raw metadata appears
8. Confirm the session token is tab-scoped in `sessionStorage`
9. Reload the page and restore the session through server validation
10. Sign out and confirm the local session token is removed

The browser test passed without producing a failure screenshot.

## Regression Boundary

Phase 27F does not modify:

- teacher or student authentication behavior
- roster point/life controls
- tasks, submissions, badges, or AI features
- Guardian database or RPC behavior from Phases 27B–27D
- Guardian portal behavior from Phase 27E
- Vite base-path configuration
- GitHub Pages deployment
- production secrets or production database objects

Only test, CI, fixture, and documentation files are added.

## Remaining Production Gate

Automated non-production validation is complete. Production remains intentionally untouched.

Before production release:

1. Inventory the live Supabase project for leftover Guardian/Parent tables, columns, functions, policies, grants, and rows from the removed implementation.
2. Back up the production database.
3. Apply Phase 27B, Phase 27C, and Phase 27D in order.
4. Run the SQL verification suites against a staging clone or equivalent non-production copy.
5. Merge the validated Guardian branches in order.
6. Deploy the Vite production build.
7. Perform a final real-device smoke test using a temporary student credential before issuing codes to families.

No production migration or release should occur if the live inventory finds unexpected legacy Guardian objects until those objects are reviewed explicitly.
