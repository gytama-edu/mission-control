#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${GUARDIAN_VALIDATION_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [[ "${ALLOW_NON_LOCAL_GUARDIAN_VALIDATION:-0}" != "1" ]]; then
  case "$DATABASE_URL" in
    postgresql://*@127.0.0.1:*/*|postgres://*@127.0.0.1:*/*|postgresql://*@localhost:*/*|postgres://*@localhost:*/*)
      ;;
    *)
      echo "Refusing to run Guardian validation against a non-local database." >&2
      echo "Use a localhost/127.0.0.1 database, or set ALLOW_NON_LOCAL_GUARDIAN_VALIDATION=1 deliberately." >&2
      exit 2
      ;;
  esac
fi

command -v psql >/dev/null 2>&1 || {
  echo "psql is required for Guardian database validation." >&2
  exit 3
}

PSQL=(psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --no-psqlrc)

run_sql_file() {
  local label="$1"
  local path="$2"

  if [[ ! -f "$path" ]]; then
    echo "Missing required SQL file: $path" >&2
    exit 4
  fi

  echo "==> $label"
  "${PSQL[@]}" --file "$path"
}

run_sql_file "Apply Mission Control baseline schema" "supabase/schema.sql"
run_sql_file "Validate read-only live inventory SQL before Guardian objects exist" "supabase/preflight/20260711_guardian_live_inventory.sql"

run_sql_file "Apply Phase 27B Guardian database foundation" "supabase/migrations/20260710_phase_27b_guardian_database_foundation.sql"
run_sql_file "Apply Phase 27C Guardian authentication RPCs" "supabase/migrations/20260710_phase_27c_guardian_auth_rpcs.sql"
run_sql_file "Apply Phase 27D Guardian teacher controls" "supabase/migrations/20260710_phase_27d_guardian_teacher_controls.sql"

run_sql_file "Run Phase 27C authentication and leakage tests" "supabase/tests/20260710_phase_27c_guardian_auth_rpcs_test.sql"
run_sql_file "Run Phase 27D teacher ownership and credential tests" "supabase/tests/20260710_phase_27d_guardian_teacher_controls_test.sql"

POST_MIGRATION_OUTPUT="$(mktemp)"
trap 'rm -f "$POST_MIGRATION_OUTPUT"' EXIT

echo "==> Run strict post-migration production verifier"
"${PSQL[@]}" \
  --no-align \
  --field-separator='|' \
  --file "supabase/preflight/20260711_guardian_post_migration_verification.sql" \
  | tee "$POST_MIGRATION_OUTPUT"

if grep -Eq '(^|\|)FAIL(_[A-Z_]+)?(\||$)' "$POST_MIGRATION_OUTPUT"; then
  echo "Guardian post-migration verifier reported a FAIL status." >&2
  exit 5
fi

echo "Guardian database validation and production preflight checks passed."