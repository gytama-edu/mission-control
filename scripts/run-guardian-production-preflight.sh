#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${GUARDIAN_PRODUCTION_DATABASE_URL:-}"
MODE="${GUARDIAN_PRODUCTION_PREFLIGHT_MODE:-inventory}"
ACKNOWLEDGEMENT="${ALLOW_GUARDIAN_PRODUCTION_PREFLIGHT:-}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "GUARDIAN_PRODUCTION_DATABASE_URL is required." >&2
  exit 2
fi

if [[ "$ACKNOWLEDGEMENT" != "READ_ONLY_I_UNDERSTAND" ]]; then
  echo "Refusing to connect to a production database without explicit acknowledgement." >&2
  echo "Set ALLOW_GUARDIAN_PRODUCTION_PREFLIGHT=READ_ONLY_I_UNDERSTAND." >&2
  exit 3
fi

command -v psql >/dev/null 2>&1 || {
  echo "psql is required." >&2
  exit 4
}

case "$MODE" in
  inventory)
    SQL_FILE="supabase/preflight/20260711_guardian_live_inventory.sql"
    ;;
  post-migration)
    SQL_FILE="supabase/preflight/20260711_guardian_post_migration_verification.sql"
    ;;
  *)
    echo "Unknown GUARDIAN_PRODUCTION_PREFLIGHT_MODE: $MODE" >&2
    echo "Use inventory or post-migration." >&2
    exit 5
    ;;
esac

if [[ ! -f "$SQL_FILE" ]]; then
  echo "Missing preflight SQL file: $SQL_FILE" >&2
  exit 6
fi

echo "Running Guardian production preflight in READ-ONLY mode: $MODE"
echo "No migration or fixture SQL is executed by this script."

psql "$DATABASE_URL" \
  --no-psqlrc \
  --set ON_ERROR_STOP=1 \
  --file "$SQL_FILE"

echo "Guardian production preflight completed. Review every BLOCKER, FAIL, and REVIEW row before continuing."