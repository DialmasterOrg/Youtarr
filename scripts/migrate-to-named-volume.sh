#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=scripts/_console_output.sh
source "$SCRIPT_DIR/_console_output.sh"
# shellcheck source=scripts/_env_helpers.sh
source "$SCRIPT_DIR/_env_helpers.sh"

FORCE=false
STAGING_DIR=""
COMPOSE_CMD=""
ENV_BACKUP_PATH=""
BACKUP_DIR_NAME=""

print_usage() {
  cat <<EOF
Usage: $(basename "$0") [--force] [--help]

Migrates Youtarr's bundled MariaDB from the legacy bind mount
(./database:/var/lib/mysql) to the safer named-volume override
(docker-compose.arm.yml).

The migration is opt-in and reversible:
  - ./database/ is renamed to ./database.bind-mount-backup.<timestamp>/
  - .env is snapshotted to ./.env.bak.<timestamp>
  - .env is updated so future docker compose and ./start.sh runs use the
    named-volume override

Options:
  --force    Skip the confirmation prompt
  --help     Show this help message
EOF
}

cleanup() {
  if [[ -n "$STAGING_DIR" ]] && [[ -d "$STAGING_DIR" ]]; then
    rm -rf "$STAGING_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT

print_error_log() {
  local log_file="$1"
  if [[ -s "$log_file" ]]; then
    yt_detail "Error output (last 40 lines):"
    while IFS= read -r line; do
      yt_detail "  $line"
    done < <(tail -n 40 "$log_file")
  fi
}

get_compose_command() {
  if docker compose version &>/dev/null; then
    echo "docker compose"
  elif docker-compose version &>/dev/null; then
    echo "docker-compose"
  else
    yt_error "Neither 'docker compose' nor 'docker-compose' command found."
    exit 1
  fi
}

get_env_value() {
  local key="$1"
  local default="${2:-}"
  local value="${!key:-}"

  if [[ -n "$value" ]]; then
    printf '%s' "$value"
    return
  fi

  if [[ -f "$PROJECT_DIR/.env" ]]; then
    value=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$PROJECT_DIR/.env" 2>/dev/null \
      | tail -n 1 \
      | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//" \
      | sed -E 's/[[:space:]]+#.*$//' \
      | sed -E 's/[[:space:]]+$//' \
      | sed -E 's/^"(.*)"$/\1/' \
      | sed -E "s/^'(.*)'$/\1/" || true)
  fi

  if [[ -n "$value" ]]; then
    printf '%s' "$value"
  else
    printf '%s' "$default"
  fi
}

database_dir_has_real_content() {
  [[ -f "$PROJECT_DIR/database/ibdata1" || -d "$PROJECT_DIR/database/mysql" ]]
}

# Single, consistent message for any failure that happens after we have
# renamed ./database/ to the timestamped backup but before the migration is
# fully verified. .env has not been touched at this point, so the user can
# get back to a clean pre-migration state with a few commands.
print_post_rename_failure_help() {
  yt_detail ""
  yt_detail "Your .env file was NOT modified."
  yt_detail "Your original database is preserved at ./$BACKUP_DIR_NAME/."
  yt_detail ""
  yt_detail "To return to the pre-migration state:"
  yt_detail "  1. Restore the database directory:"
  yt_detail "       mv ./$BACKUP_DIR_NAME ./database"
  yt_detail "  2. Remove the partially-populated named volume:"
  yt_detail "       docker volume ls --format '{{.Name}}' | grep youtarr-db-data"
  yt_detail "       docker volume rm <volume-name>"
  yt_detail "  3. Start normally:"
  yt_detail "       ./start.sh"
}

wait_for_db_ready() {
  local db_user="$1"
  local db_password="$2"
  local db_port="$3"
  local max_wait=180
  local waited=0

  while [[ $waited -lt $max_wait ]]; do
    if docker exec youtarr-db mysqladmin ping -h localhost -P "$db_port" -u "$db_user" -p"$db_password" &>/dev/null; then
      if docker exec youtarr-db mysql -h 127.0.0.1 -P "$db_port" -u "$db_user" -p"$db_password" -e "SELECT 1;" &>/dev/null; then
        return 0
      fi
    fi
    sleep 2
    waited=$((waited + 2))
  done

  return 1
}

# Distinguishes "MariaDB never came up" from "MariaDB is up but our credentials are wrong."
# Probes with a deliberately-bogus user; "Access denied" means the server is alive
# and answering, so the failure mode is auth, not startup.
db_running_but_auth_rejected() {
  local db_port="$1"
  local probe_output
  probe_output=$(docker exec youtarr-db mysqladmin ping \
    -h 127.0.0.1 -P "$db_port" \
    -u __youtarr_migrate_probe -p__not_a_real_password 2>&1) || true
  [[ "$probe_output" == *"Access denied"* ]]
}

print_db_auth_failure_hint() {
  yt_detail "MariaDB is running, but the credentials in .env did not authenticate."
  yt_detail "The bundled compose seeds MYSQL_ROOT_PASSWORD from DB_ROOT_PASSWORD on the very first DB"
  yt_detail "init only; subsequent edits to DB_ROOT_PASSWORD do not change an existing DB. The app connects with DB_USER"
  yt_detail "and DB_PASSWORD, so DB_PASSWORD in .env must match the password that was actually seeded."
  yt_detail "Verify which password Youtarr currently uses to connect, set DB_PASSWORD in .env to that value,"
  yt_detail "then re-run this script."
}

stop_started_db() {
  local compose_file_args="$1"
  if [[ -n "$COMPOSE_CMD" ]]; then
    # shellcheck disable=SC2086 # COMPOSE_CMD and compose_file_args intentionally expand into command/flag words.
    (cd "$PROJECT_DIR" && $COMPOSE_CMD $compose_file_args down) >/dev/null 2>&1 || true
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=true
      shift
      ;;
    --help)
      print_usage
      exit 0
      ;;
    *)
      yt_error "Unknown option: $1"
      print_usage
      exit 1
      ;;
  esac
done

yt_banner "Youtarr DB Migration: bind mount to named volume"

if [[ ! -f "$PROJECT_DIR/docker-compose.yml" || ! -f "$PROJECT_DIR/docker-compose.arm.yml" ]]; then
  yt_error "docker-compose.yml and docker-compose.arm.yml must both exist."
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  yt_error "No .env file found. Run ./start.sh once before migrating."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  yt_error "Docker does not appear to be running."
  exit 1
fi

if ! database_dir_has_real_content; then
  yt_error "No bind-mounted MariaDB data found in ./database/."
  yt_detail "This script only migrates existing bind-mounted bundled MariaDB installs."
  exit 1
fi

COMPOSE_FILE_VALUE=$(get_env_value "COMPOSE_FILE" "")
if [[ "$COMPOSE_FILE_VALUE" == *"docker-compose.external-db.yml"* || "${COMPOSE_FILE:-}" == *"docker-compose.external-db.yml"* ]]; then
  yt_error "External database configuration detected."
  yt_detail "This script only migrates the bundled MariaDB container."
  exit 1
fi

if [[ "$COMPOSE_FILE_VALUE" == *"docker-compose.arm.yml"* || "${COMPOSE_FILE:-}" == *"docker-compose.arm.yml"* ]]; then
  yt_error "Named-volume override already appears to be configured."
  yt_detail "Refusing to guess whether ./database/ is active or leftover data."
  exit 1
fi

if [[ -n "${COMPOSE_FILE:-}" ]]; then
  yt_error "COMPOSE_FILE is set in your shell environment: ${COMPOSE_FILE}"
  yt_detail "Unset it before migrating so the .env named-volume pin will take effect."
  yt_detail "Run: unset COMPOSE_FILE"
  exit 1
fi

if [[ -n "${COMPOSE_PATH_SEPARATOR:-}" && "${COMPOSE_PATH_SEPARATOR}" != ":" ]]; then
  yt_error "COMPOSE_PATH_SEPARATOR is set in your shell environment to: ${COMPOSE_PATH_SEPARATOR}"
  yt_detail "Unset it or set it to ':' before migrating so Compose reads the new .env pin correctly."
  exit 1
fi

COMPOSE_FILE_TRIMMED=$(printf '%s' "$COMPOSE_FILE_VALUE" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
if [[ -n "$COMPOSE_FILE_TRIMMED" && "$COMPOSE_FILE_TRIMMED" != "docker-compose.yml" ]]; then
  yt_error "Custom COMPOSE_FILE detected: $COMPOSE_FILE_VALUE"
  yt_detail "This migration only supports the default bundled MariaDB stack."
  yt_detail "Restore custom compose behavior from .env after migration, or migrate manually."
  exit 1
fi

COMPOSE_PATH_SEPARATOR_VALUE=$(get_env_value "COMPOSE_PATH_SEPARATOR" "")
if [[ -n "$COMPOSE_FILE_TRIMMED" || -n "$COMPOSE_PATH_SEPARATOR_VALUE" ]]; then
  yt_warn "Existing COMPOSE_FILE/COMPOSE_PATH_SEPARATOR settings will be replaced in .env."
  yt_detail "A full .env snapshot will be written before any change: ./.env.bak.<timestamp>"
fi

COMPOSE_CMD=$(get_compose_command)
yt_info "Docker compose command: $COMPOSE_CMD"

EXPECTED_DB_VOLUME="$(youtarr_expected_db_volume_name "$PROJECT_DIR")"
if docker volume inspect "$EXPECTED_DB_VOLUME" >/dev/null 2>&1; then
  yt_error "Named-volume database already exists: $EXPECTED_DB_VOLUME"
  yt_detail "Remove it only if you are certain it is empty or disposable, then re-run this script."
  exit 1
fi

# Pre-flight permissions check. We need to write a .env backup and rename
# ./database/ to ./database.bind-mount-backup.<timestamp>/. If the user can't do
# either directly, we want to know now (before the dump) rather than stalling
# on an interactive sudo prompt mid-migration on a headless box.
USE_SUDO_FOR_FS=false
PRE_FLIGHT_TEST_PATH="$PROJECT_DIR/.youtarr-migrate-write-test.$$"
if touch "$PRE_FLIGHT_TEST_PATH" 2>/dev/null; then
  rm -f "$PRE_FLIGHT_TEST_PATH"
else
  if sudo -n true 2>/dev/null; then
    USE_SUDO_FOR_FS=true
    yt_warn "Cannot write to $PROJECT_DIR directly; will use passwordless sudo for filesystem operations."
  else
    yt_error "Cannot write to $PROJECT_DIR and passwordless sudo is not available."
    yt_detail "This migration must rename ./database/ to ./database.bind-mount-backup.<timestamp>/"
    yt_detail "and write a .env backup, both in $PROJECT_DIR."
    yt_detail ""
    yt_detail "Resolve one of these and re-run:"
    yt_detail "  - Re-run the script as root:        sudo $(basename "$0")"
    yt_detail "  - Configure passwordless sudo for the current user"
    yt_detail "  - Make $PROJECT_DIR writable by the current user (chown / chmod)"
    exit 1
  fi
fi

DB_USER=$(get_env_value "DB_USER" "root")
DB_PASSWORD=$(get_env_value "DB_PASSWORD" "123qweasd")
DB_ROOT_PASSWORD=$(get_env_value "DB_ROOT_PASSWORD" "123qweasd")
DB_NAME=$(get_env_value "DB_NAME" "youtarr")
DB_PORT=$(get_env_value "DB_PORT" "3321")
YOUTUBE_OUTPUT_DIR_VALUE=$(get_env_value "YOUTUBE_OUTPUT_DIR" "/tmp")
export YOUTUBE_OUTPUT_DIR="$YOUTUBE_OUTPUT_DIR_VALUE"

if [[ "$DB_USER" == "root" && "$DB_ROOT_PASSWORD" != "$DB_PASSWORD" ]]; then
  yt_error "DB_ROOT_PASSWORD and DB_PASSWORD differ in .env."
  yt_detail "The fresh named-volume MariaDB initializes root from DB_ROOT_PASSWORD,"
  yt_detail "but this migration connects as root using DB_PASSWORD."
  yt_detail "Set DB_ROOT_PASSWORD to the same value as DB_PASSWORD before migrating, then re-run this script."
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_DIR_NAME="database.bind-mount-backup.$TIMESTAMP"
ENV_BACKUP_PATH="$PROJECT_DIR/.env.bak.$TIMESTAMP"
STAGING_DIR=$(mktemp -d)
DUMP_PATH="$STAGING_DIR/youtarr-$TIMESTAMP.sql"
ERROR_LOG="$STAGING_DIR/error.log"

yt_section "Plan"
yt_info "Bind-mount source: ./database/"
yt_info "Preserved as:       ./$BACKUP_DIR_NAME/"
yt_info ".env snapshot:      ./.env.bak.$TIMESTAMP"
yt_info "Target storage:     Docker named volume from docker-compose.arm.yml"

if [[ "$FORCE" != "true" ]]; then
  echo ""
  read -r -p "Type 'MIGRATE' to proceed or anything else to abort: " confirmation
  if [[ "$confirmation" != "MIGRATE" ]]; then
    yt_info "Aborted. Nothing changed."
    exit 0
  fi
fi

yt_section "Stopping Youtarr"
if [[ -x "$PROJECT_DIR/stop.sh" ]]; then
  (cd "$PROJECT_DIR" && ./stop.sh) || yt_warn "stop.sh returned non-zero; continuing."
else
  (cd "$PROJECT_DIR" && $COMPOSE_CMD down) || yt_warn "compose down returned non-zero; continuing."
fi

yt_section "Dumping Bind-Mounted Database"
(cd "$PROJECT_DIR" && $COMPOSE_CMD -f docker-compose.yml up -d youtarr-db)

if ! wait_for_db_ready "$DB_USER" "$DB_PASSWORD" "$DB_PORT"; then
  yt_error "Bind-mounted database did not become ready."
  if db_running_but_auth_rejected "$DB_PORT"; then
    print_db_auth_failure_hint
  fi
  stop_started_db "-f docker-compose.yml"
  exit 1
fi

: > "$ERROR_LOG"
if ! SOURCE_TABLE_COUNT=$(docker exec youtarr-db mysql -N -B -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>"$ERROR_LOG"); then
  yt_error "Could not inspect source database tables."
  print_error_log "$ERROR_LOG"
  stop_started_db "-f docker-compose.yml"
  exit 1
fi

if [[ ! "$SOURCE_TABLE_COUNT" =~ ^[0-9]+$ ]]; then
  yt_error "Unexpected source table count: $SOURCE_TABLE_COUNT"
  stop_started_db "-f docker-compose.yml"
  exit 1
fi

if [[ "$SOURCE_TABLE_COUNT" -lt 1 ]]; then
  yt_warn "Source database has no tables; nothing needs to be migrated."
  yt_detail "For a fresh named-volume install, stop the stack, move or remove ./database/, then run ./start.sh."
  stop_started_db "-f docker-compose.yml"
  exit 0
fi

: > "$ERROR_LOG"
if ! docker exec youtarr-db mysqldump \
  --single-transaction \
  --routines --triggers --events \
  -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$DUMP_PATH" 2>"$ERROR_LOG"; then
  yt_error "mysqldump failed. Your ./database/ data was not modified."
  print_error_log "$ERROR_LOG"
  stop_started_db "-f docker-compose.yml"
  exit 1
fi

yt_success "Database dump created."

# Capture per-table row counts from the source DB so we can verify the import is
# complete (not just structurally valid). A truncated dump (disk full, broken
# pipe) can produce a syntactically valid SQL file with all CREATE TABLEs but
# missing INSERTs; the table-count check alone wouldn't notice that.
SOURCE_COUNTS_FILE="$STAGING_DIR/source_counts.tsv"
: > "$SOURCE_COUNTS_FILE"
: > "$ERROR_LOG"
SOURCE_TABLE_LIST=$(docker exec youtarr-db mysql -N -B -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
  -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_type='BASE TABLE';" 2>"$ERROR_LOG") || {
  yt_error "Could not enumerate source tables for verification."
  print_error_log "$ERROR_LOG"
  stop_started_db "-f docker-compose.yml"
  exit 1
}

while IFS= read -r table; do
  [ -z "$table" ] && continue
  count=$(docker exec youtarr-db mysql -N -B -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
    -e "SELECT COUNT(*) FROM \`$table\`;" 2>"$ERROR_LOG") || {
    yt_error "Could not count rows in source table: $table"
    print_error_log "$ERROR_LOG"
    stop_started_db "-f docker-compose.yml"
    exit 1
  }
  printf '%s\t%s\n' "$table" "$count" >> "$SOURCE_COUNTS_FILE"
done <<< "$SOURCE_TABLE_LIST"

yt_success "Captured row counts for $(wc -l < "$SOURCE_COUNTS_FILE" | tr -d ' ') source tables."
stop_started_db "-f docker-compose.yml"

yt_section "Preserving Bind-Mount Directory"
RENAME_RC=0
if [ "$USE_SUDO_FOR_FS" = "true" ]; then
  sudo -n mv "$PROJECT_DIR/database" "$PROJECT_DIR/$BACKUP_DIR_NAME" || RENAME_RC=$?
else
  mv "$PROJECT_DIR/database" "$PROJECT_DIR/$BACKUP_DIR_NAME" || RENAME_RC=$?
fi
if [ "$RENAME_RC" -ne 0 ]; then
  yt_error "Failed to rename ./database/. No configuration changes were made."
  exit 1
fi
if [ "$USE_SUDO_FOR_FS" = "true" ]; then
  yt_success "Renamed ./database/ to ./$BACKUP_DIR_NAME/ (using sudo)"
else
  yt_success "Renamed ./database/ to ./$BACKUP_DIR_NAME/"
fi

# IMPORTANT: .env is NOT modified here. We hold off on rewriting .env until
# after the import is fully verified, so that any failure in this section
# leaves the user's .env intact and recovery is just a directory rename.
# The migration steps below all use explicit -f flags and do not depend on
# the .env pin to function.

yt_section "Importing Into Named Volume"
(cd "$PROJECT_DIR" && $COMPOSE_CMD -f docker-compose.yml -f docker-compose.arm.yml up -d youtarr-db)

if ! wait_for_db_ready "$DB_USER" "$DB_PASSWORD" "$DB_PORT"; then
  yt_error "Named-volume database did not become ready."
  if db_running_but_auth_rejected "$DB_PORT"; then
    print_db_auth_failure_hint
  fi
  print_post_rename_failure_help
  stop_started_db "-f docker-compose.yml -f docker-compose.arm.yml"
  exit 1
fi

# Belt-and-suspenders: the up-front docker-volume-inspect check guesses the project
# name; if Compose ended up reusing a stale volume under a slightly different name,
# our DROP/CREATE below would wipe whatever was in it. Refuse instead.
TARGET_TABLE_COUNT=$(docker exec youtarr-db mysql -N -B -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>/dev/null || echo "")
if [[ "$TARGET_TABLE_COUNT" =~ ^[0-9]+$ ]] && [[ "$TARGET_TABLE_COUNT" -gt 0 ]]; then
  yt_error "Target named-volume database is not empty: $TARGET_TABLE_COUNT tables already in '$DB_NAME'."
  yt_detail "Refusing to overwrite an existing volume."
  print_post_rename_failure_help
  stop_started_db "-f docker-compose.yml -f docker-compose.arm.yml"
  exit 1
fi

: > "$ERROR_LOG"
if ! docker exec youtarr-db mysql -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
  -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>"$ERROR_LOG"; then
  yt_error "Failed to prepare named-volume database for import."
  print_error_log "$ERROR_LOG"
  print_post_rename_failure_help
  stop_started_db "-f docker-compose.yml -f docker-compose.arm.yml"
  exit 1
fi

: > "$ERROR_LOG"
if ! docker exec -i youtarr-db mysql -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$DUMP_PATH" 2>"$ERROR_LOG"; then
  yt_error "SQL import failed."
  print_error_log "$ERROR_LOG"
  print_post_rename_failure_help
  stop_started_db "-f docker-compose.yml -f docker-compose.arm.yml"
  exit 1
fi

TABLE_COUNT=$(docker exec youtarr-db mysql -N -B -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>/dev/null || echo "0")
if [[ ! "$TABLE_COUNT" =~ ^[0-9]+$ ]] || [[ "$TABLE_COUNT" -lt 1 ]]; then
  yt_error "Import verification failed: no tables found."
  print_post_rename_failure_help
  stop_started_db "-f docker-compose.yml -f docker-compose.arm.yml"
  exit 1
fi

if [[ "$TABLE_COUNT" != "$SOURCE_TABLE_COUNT" ]]; then
  yt_error "Import verification failed: source had $SOURCE_TABLE_COUNT tables, target has $TABLE_COUNT."
  print_post_rename_failure_help
  stop_started_db "-f docker-compose.yml -f docker-compose.arm.yml"
  exit 1
fi

# Per-table row count verification. Catches truncated imports that produced all
# tables but only a partial set of rows.
MISMATCH_REPORT="$STAGING_DIR/mismatch.txt"
: > "$MISMATCH_REPORT"
MISMATCH_COUNT=0
while IFS=$'\t' read -r table src_count; do
  [ -z "$table" ] && continue
  tgt_count=$(docker exec youtarr-db mysql -N -B -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
    -e "SELECT COUNT(*) FROM \`$table\`;" 2>/dev/null) || tgt_count="MISSING"
  if [[ "$tgt_count" != "$src_count" ]]; then
    printf '  %s: source=%s target=%s\n' "$table" "$src_count" "$tgt_count" >> "$MISMATCH_REPORT"
    MISMATCH_COUNT=$((MISMATCH_COUNT + 1))
  fi
done < "$SOURCE_COUNTS_FILE"

if [ "$MISMATCH_COUNT" -gt 0 ]; then
  yt_error "Per-table row count verification failed: $MISMATCH_COUNT table(s) differ."
  while IFS= read -r line; do yt_detail "$line"; done < "$MISMATCH_REPORT"
  print_post_rename_failure_help
  stop_started_db "-f docker-compose.yml -f docker-compose.arm.yml"
  exit 1
fi

yt_success "Import verified: $TABLE_COUNT tables, all per-table row counts match source."

# Verification passed. Now (and only now) update .env so future plain
# `docker compose up -d` runs pick up the named-volume override.
yt_section "Updating .env"
SNAPSHOT_RC=0
if [ "$USE_SUDO_FOR_FS" = "true" ]; then
  sudo -n cp "$PROJECT_DIR/.env" "$ENV_BACKUP_PATH" || SNAPSHOT_RC=$?
else
  cp "$PROJECT_DIR/.env" "$ENV_BACKUP_PATH" || SNAPSHOT_RC=$?
fi
if [ "$SNAPSHOT_RC" -ne 0 ]; then
  yt_error "Failed to snapshot .env to $ENV_BACKUP_PATH."
  yt_detail "Migration data is in place, but .env was not pinned. Either retry the snapshot manually"
  yt_detail "or pin the override yourself by adding these two lines to .env:"
  yt_detail "  COMPOSE_PATH_SEPARATOR=:"
  yt_detail "  COMPOSE_FILE=docker-compose.yml:docker-compose.arm.yml"
  stop_started_db "-f docker-compose.yml -f docker-compose.arm.yml"
  exit 1
fi

PIN_ARGS=(--force)
if [ "$USE_SUDO_FOR_FS" = "true" ]; then
  PIN_ARGS+=(--use-sudo)
fi
if ! youtarr_pin_named_volume_in_env "$PROJECT_DIR/.env" "${PIN_ARGS[@]}"; then
  yt_error "Failed to update .env."
  yt_detail "Restore .env with: mv ./.env.bak.$TIMESTAMP .env"
  yt_detail "Then add these two lines to .env manually:"
  yt_detail "  COMPOSE_PATH_SEPARATOR=:"
  yt_detail "  COMPOSE_FILE=docker-compose.yml:docker-compose.arm.yml"
  stop_started_db "-f docker-compose.yml -f docker-compose.arm.yml"
  exit 1
fi
yt_success "Pinned docker-compose.arm.yml named-volume override in .env."

yt_section "Starting Full Stack"
if (cd "$PROJECT_DIR" && $COMPOSE_CMD -f docker-compose.yml -f docker-compose.arm.yml up -d); then
  yt_success "Youtarr is now running on the named-volume database."
else
  yt_warn "Could not auto-start the full Youtarr stack."
  yt_detail "Bring it up manually with: ./start.sh"
fi

yt_section "Migration Complete"
yt_success "Youtarr is now using the named-volume database override."
yt_detail ""
yt_detail "Going forward, any of these will start the stack against the named volume:"
yt_detail "  Recommended:           ./start.sh"
yt_detail "  Plain docker compose:  docker compose up -d"
yt_detail "                         (this script pinned COMPOSE_FILE in .env, so plain compose"
yt_detail "                          will pick up the named-volume override automatically)"
yt_detail "  Without the .env pin:  docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d"
yt_detail ""
yt_detail "Backups (preserved for safety):"
yt_detail "  Original DB:    ./$BACKUP_DIR_NAME/"
yt_detail "  Original .env:  ./.env.bak.$TIMESTAMP"
yt_detail ""
yt_detail "To revert: restore the .env backup, remove the named volume, rename the database backup"
yt_detail "back to ./database, then run ./start.sh."
yt_detail ""
yt_detail "After confirming the install is healthy for a few days, you can reclaim space by removing"
yt_detail "the backups above. This script will not delete them automatically."
