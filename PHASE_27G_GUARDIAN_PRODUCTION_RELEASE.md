# Phase 27G — Guardian Production Release Gate

## Status

**Release candidate prepared. Production not modified.**

Branch: `phase-27g-guardian-production-release`

This branch is cumulative. It contains the validated Guardian work from Phases 27A–27F plus the Phase 27G production preflight package.

The release must remain unmerged until the live Supabase inventory is captured and reviewed.

## What Phase 27G Adds

- `supabase/preflight/20260711_guardian_live_inventory.sql`
- `supabase/preflight/20260711_guardian_post_migration_verification.sql`
- `scripts/run-guardian-production-preflight.sh`
- this release document
- CI coverage for release-candidate pull requests targeting `main`

No production credentials, database URLs, secrets, or generated family codes are committed.

## Why Production Is Still Locked

The removed Guardian/Parent implementation previously used uncertain schema assumptions. Repository history cannot prove whether the live Supabase project still contains old:

- tables or views
- columns on `students`, `classes`, or other tables
- functions
- policies
- grants
- triggers
- credential rows

Applying new migrations without this inventory could preserve insecure objects, collide with old names, or migrate unexpected data.

## Gate 1 — Backup

Before any migration:

1. Create a Supabase database backup or equivalent verified snapshot.
2. Record the backup timestamp and identifier in the release PR.
3. Confirm a restore path exists.
4. Do not treat GitHub source control as a database backup.

## Gate 2 — Read-Only Live Inventory

Run:

`supabase/preflight/20260711_guardian_live_inventory.sql`

It starts a read-only transaction and rolls it back. It inventories:

- matching Guardian/Parent relations
- matching columns
- matching functions
- RLS policies
- triggers
- table grants
- function grants
- pgcrypto installation
- Supabase migration-history entries
- a compact blocker summary

The inventory may be run directly in Supabase SQL Editor. The guarded shell runner is also available:

```bash
export GUARDIAN_PRODUCTION_DATABASE_URL='postgresql://...'
export ALLOW_GUARDIAN_PRODUCTION_PREFLIGHT='READ_ONLY_I_UNDERSTAND'
export GUARDIAN_PRODUCTION_PREFLIGHT_MODE='inventory'
bash scripts/run-guardian-production-preflight.sh
```

The runner executes only the selected read-only SQL file. It never applies migrations or fixtures.

### Inventory stop conditions

Do not continue when results contain an unreviewed:

- `BLOCKER_UNEXPECTED_OBJECT`
- `BLOCKER_UNEXPECTED_COLUMN`
- `BLOCKER_UNEXPECTED_FUNCTION`
- `BLOCKER_POLICY_REQUIRES_REVIEW`
- `BLOCKER_UNEXPECTED_TRIGGER`
- `BLOCKER_BROWSER_TABLE_GRANT`
- non-zero blocker-summary count

Approved Guardian object names already present must still be compared against the committed Phase 27B–27D definitions. A matching name is not proof that the definition is safe.

## Gate 3 — Migration Order

After a clean inventory and verified backup, apply exactly:

1. `supabase/migrations/20260710_phase_27b_guardian_database_foundation.sql`
2. `supabase/migrations/20260710_phase_27c_guardian_auth_rpcs.sql`
3. `supabase/migrations/20260710_phase_27d_guardian_teacher_controls.sql`

Do not run Phase 27C before 27B. Do not run Phase 27D before 27C.

Each migration uses an explicit transaction. Stop immediately on the first error. Do not edit production objects manually to “make the next file pass” without updating and revalidating the source migration.

## Gate 4 — Post-Migration Read-Only Verification

Run:

`supabase/preflight/20260711_guardian_post_migration_verification.sql`

Or:

```bash
export GUARDIAN_PRODUCTION_PREFLIGHT_MODE='post-migration'
bash scripts/run-guardian-production-preflight.sh
```

Required result:

- every `critical_check` is `PASS`
- every `function_definition_check` is `PASS`
- every `function_grant_check` is `PASS`
- every `column_shape_check` is `PASS`
- final `release_summary` is `PASS`
- `data_count_review` is either `PASS_EMPTY_INITIAL_STATE` or an explicitly reviewed intentional state

The verifier checks:

- pgcrypto schema
- table existence
- RLS state
- absence of direct Guardian table policies
- absence of anon/authenticated table privileges
- credential-update revocation trigger
- required unique lookup key
- absence of plaintext secret/token columns
- exact SECURITY DEFINER function surface
- fixed search paths
- exact browser execution grants
- exact Guardian table column shape

## Gate 5 — Release Candidate CI

The Guardian validation workflow must pass on the pull request targeting `main`:

- locked dependency installation
- TypeScript check
- Vite production build
- deployable `dist` output
- isolated local Supabase startup
- baseline plus Phase 27B–27D migration application
- Phase 27C SQL security tests
- Phase 27D ownership tests
- Phase 27G preflight SQL checks
- Chromium Guardian end-to-end flow

A previous successful Phase 27F run is supporting evidence, but the production release PR must also be green at its current head.

## Gate 6 — Merge and Deployment Order

Only after Gates 1–5 pass:

1. Merge the cumulative Guardian release PR into `main`.
2. Allow the existing GitHub Pages workflow to build from Vite `dist`.
3. Confirm the deployment serves `/mission-control/` assets rather than raw source files.
4. Do not generate family credentials until the deployed Guardian route is confirmed healthy.

## Gate 7 — Real-Device Smoke Test

Use one temporary student in a controlled class:

1. Open teacher class view.
2. Open Guardian Access management.
3. Generate a code and copy it once.
4. In a separate private/incognito browser, open Guardian Access.
5. Confirm wrong-code rejection is generic.
6. Log in with the temporary code.
7. Confirm only the intended student appears.
8. Confirm rank, classmates, PIN, submission text, attachments, raw notes, and AI data do not appear.
9. Refresh and confirm same-tab session restoration.
10. Rotate the code from the teacher view.
11. Confirm the old Guardian session and code stop working.
12. Disable access and confirm immediate sign-out.
13. Remove the temporary student or leave the credential disabled.

## Rollback Boundary

Database rollback files exist for Phases 27B–27D. Rollback is not automatic because production may contain newly generated credentials or sessions after release.

Before rollback:

- disable new code generation
- preserve evidence and logs
- confirm whether any families are using the portal
- back up the current state
- execute rollback files in reverse order: 27D, 27C, 27B
- redeploy the last known-good frontend commit

## Final Release Rule

Production release is authorized only when all of the following are documented in the main release PR:

- backup identifier and timestamp
- full live-inventory output or attached sanitized result
- explicit resolution of every blocker/review row
- migration execution success
- post-migration verifier success
- green release-candidate CI
- successful real-device smoke test

Until then, the PR remains draft and production remains unchanged.