#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=scripts/_console_output.sh
source "$SCRIPT_DIR/_console_output.sh"

SKIP_DB=false
FORCE=false

print_usage() {
  cat <<EOF
Usage: $(basename "$0") <backup.tar.gz> [OPTIONS]

Restores Youtarr configuration and database from a backup archive.

Options:
  --skip-db     Restore only configuration files (skip database)
  --force       Skip confirmation prompt
  --help        Show this help message
EOF
}

get_compose_command() {
  if docker compose version &>/dev/null; then
    echo "docker compose"
  elif docker-compose version &>/dev/null; then
    echo "docker-compose"
  else
    echo "Error: Neither 'docker compose' nor 'docker-compose' command found." >&2
    echo "Please install Docker Compose." >&2
    exit 1
  fi
}

if [[ $# -lt 1 ]]; then
  print_usage
  exit 1
fi

ARCHIVE_PATH="$1"
shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-db)
      SKIP_DB=true
      shift
      ;;
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

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  yt_error "Backup archive not found: $ARCHIVE_PATH"
  exit 1
fi

if [[ "$FORCE" == "false" ]]; then
  yt_warn "This will overwrite your current Youtarr configuration${SKIP_DB:+ (database will be skipped)}."
  yt_warn "Type RESTORE to continue:"
  read -r CONFIRM
  if [[ "$CONFIRM" != "RESTORE" ]]; then
    yt_info "Restore cancelled."
    exit 0
  fi
fi

COMPOSE_CMD=$(get_compose_command)

ARCH=$(uname -m)
IS_ARM=false
if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
  IS_ARM=true
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT


yt_banner "Youtarr Restore"

yt_section "Extracting Backup"

if ! tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"; then
  yt_error "Failed to extract archive"
  exit 1
fi

BACKUP_ROOT=$(find "$TMP_DIR" -maxdepth 1 -type d -name 'youtarr-backup-*' | head -n1)
if [[ -z "$BACKUP_ROOT" ]]; then
  yt_error "Invalid backup archive (missing root directory)"
  exit 1
fi

# Restore .env
if [[ -f "$BACKUP_ROOT/env.backup" ]]; then
  cp "$BACKUP_ROOT/env.backup" "$PROJECT_DIR/.env"
  yt_success "Restored .env"
fi

# Restore config files
if [[ -d "$BACKUP_ROOT/config" ]]; then
  mkdir -p "$PROJECT_DIR/config"
  cp -f "$BACKUP_ROOT/config/config.json" "$PROJECT_DIR/config/" 2>/dev/null || true
  cp -f "$BACKUP_ROOT/config/cookies.user.txt" "$PROJECT_DIR/config/" 2>/dev/null || true
  cp -f "$BACKUP_ROOT/config/complete.list" "$PROJECT_DIR/config/" 2>/dev/null || true
  yt_success "Restored config files"
fi

# Restore metadata (jobs/info)
if [[ -d "$BACKUP_ROOT/metadata/jobs/info" ]]; then
  mkdir -p "$PROJECT_DIR/jobs"
  cp -r "$BACKUP_ROOT/metadata/jobs/info" "$PROJECT_DIR/jobs/" 2>/dev/null || true
  yt_success "Restored metadata files"
fi

# Restore images
if [[ -d "$BACKUP_ROOT/metadata/server/images" ]]; then
  mkdir -p "$PROJECT_DIR/server"
  cp -r "$BACKUP_ROOT/metadata/server/images" "$PROJECT_DIR/server/" 2>/dev/null || true
  yt_success "Restored image files"
fi

if [[ "$SKIP_DB" == "true" ]]; then
  yt_warn "Skipping database restore (--skip-db)"
  exit 0
fi

# Database restore

yt_section "Database Restore"

DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD:-123qweasd}
DB_NAME=${DB_NAME:-youtarr}
DB_PORT=${DB_PORT:-3321}

if [[ "$IS_ARM" == "true" ]]; then
  COMPOSE_ARGS="-f $PROJECT_DIR/docker-compose.yml -f $PROJECT_DIR/docker-compose.arm.yml"
else
  COMPOSE_ARGS="-f $PROJECT_DIR/docker-compose.yml"
fi

# Start DB container
export YOUTUBE_OUTPUT_DIR="${YOUTUBE_OUTPUT_DIR:-/tmp}"
(cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS up -d youtarr-db)

yt_info "Waiting for database to be ready..."
MAX_WAIT=60
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  if docker exec youtarr-db mysqladmin ping -h localhost -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" &>/dev/null; then
    break
  fi
  sleep 2
  WAITED=$((WAITED + 2))
done

if [[ $WAITED -ge $MAX_WAIT ]]; then
  yt_error "Database failed to become ready within ${MAX_WAIT}s"
  (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS down)
  exit 1
fi

SQL_PATH="$BACKUP_ROOT/database/youtarr.sql"
if [[ ! -f "$SQL_PATH" ]]; then
  yt_error "Database backup not found in archive"
  (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS down)
  exit 1
fi


yt_info "Restoring database..."
if docker exec -i youtarr-db mysql -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$SQL_PATH"; then
  yt_success "Database restored"
else
  yt_error "Database restore failed"
  (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS down)
  exit 1
fi

(cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS down)

yt_success "Restore complete"
