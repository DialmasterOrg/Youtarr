#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=scripts/_console_output.sh
source "$SCRIPT_DIR/_console_output.sh"

# Default configuration
FORCE=false
SKIP_DB=false
BACKUP_FILE=""

# Cleanup function for interruptions
cleanup() {
    if [[ -n "${EXTRACT_DIR:-}" ]] && [[ -d "$EXTRACT_DIR" ]]; then
        rm -rf "$EXTRACT_DIR" 2>/dev/null || true
    fi
}
trap cleanup EXIT

print_usage() {
  cat <<EOF
Usage: $(basename "$0") BACKUP_FILE [OPTIONS]

Restores Youtarr configuration and database from a backup archive.

Arguments:
  BACKUP_FILE        Path to the backup archive (.tar.gz)

Options:
  --force            Skip confirmation prompts
  --skip-db          Restore config files only, skip database restore
  --help             Show this help message

What gets restored:
  - Environment config (.env)
  - Application settings (config/config.json)
  - YouTube cookies (config/cookies.user.txt if present)
  - Download history (config/complete.list)
  - Database (MariaDB) - unless --skip-db
  - Video metadata (jobs/info/) - if present in backup
  - Thumbnails (server/images/) - if present in backup

IMPORTANT:
  - Stop Youtarr before restoring: ./stop.sh
  - Video files must be restored separately to YOUTUBE_OUTPUT_DIR
  - After restore, start Youtarr with: ./start.sh

Examples:
  $(basename "$0") ./backups/youtarr-backup-20240115-120000.tar.gz
  $(basename "$0") /mnt/backup/youtarr-backup.tar.gz --force
  $(basename "$0") backup.tar.gz --skip-db  # Config only
EOF
}

# Function to check if docker compose (v2) or docker-compose (v1) is available
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

# Get environment variable value from .env file
get_env_value() {
    local env_file="$1"
    local key="$2"
    local default="${3:-}"
    local value
    value=$(grep -E "^${key}=" "$env_file" 2>/dev/null | head -n1 | cut -d'=' -f2- | sed 's/^"//;s/"$//' || true)
    if [[ -n "$value" ]]; then
        echo "$value"
    else
        echo "$default"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=true
      shift
      ;;
    --skip-db)
      SKIP_DB=true
      shift
      ;;
    --help)
      print_usage
      exit 0
      ;;
    -*)
      yt_error "Unknown option: $1"
      print_usage
      exit 1
      ;;
    *)
      if [[ -z "$BACKUP_FILE" ]]; then
        BACKUP_FILE="$1"
      else
        yt_error "Unexpected argument: $1"
        print_usage
        exit 1
      fi
      shift
      ;;
  esac
done

yt_banner "Youtarr Restore"

# Validate backup file is provided
if [[ -z "$BACKUP_FILE" ]]; then
    yt_error "No backup file specified."
    print_usage
    exit 1
fi

# Validate backup file exists
if [[ ! -f "$BACKUP_FILE" ]]; then
    yt_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Get compose command
COMPOSE_CMD=$(get_compose_command)
yt_info "Docker compose command: $COMPOSE_CMD"

# Detect ARM architecture
ARCH=$(uname -m)
IS_ARM=false
if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
    IS_ARM=true
    yt_info "Detected ARM architecture ($ARCH)"
fi

# Extract backup to temporary directory
yt_section "Extracting Backup"
EXTRACT_DIR=$(mktemp -d)
yt_info "Extracting to temporary directory..."

if ! tar -xzf "$BACKUP_FILE" -C "$EXTRACT_DIR"; then
    yt_error "Failed to extract backup archive"
    rm -rf "$EXTRACT_DIR"
    exit 1
fi

# Find the backup directory (should be the only directory in extract)
BACKUP_DIR=$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n1)

if [[ -z "$BACKUP_DIR" ]]; then
    yt_error "Invalid backup archive structure - no directory found"
    rm -rf "$EXTRACT_DIR"
    exit 1
fi

yt_success "Backup extracted"

# Validate backup contents
yt_section "Validating Backup"

# Check for manifest (newer backups) or env.backup (required)
if [[ -f "$BACKUP_DIR/manifest.json" ]]; then
    yt_info "Found manifest.json"
    BACKUP_DATE=$(jq -r '.created // "unknown"' "$BACKUP_DIR/manifest.json" 2>/dev/null || echo "unknown")
    BACKUP_HOSTNAME=$(jq -r '.hostname // "unknown"' "$BACKUP_DIR/manifest.json" 2>/dev/null || echo "unknown")
    BACKUP_ARCH=$(jq -r '.architecture // "unknown"' "$BACKUP_DIR/manifest.json" 2>/dev/null || echo "unknown")
    yt_detail "  Created: $BACKUP_DATE"
    yt_detail "  Hostname: $BACKUP_HOSTNAME"
    yt_detail "  Architecture: $BACKUP_ARCH"
fi

if [[ ! -f "$BACKUP_DIR/env.backup" ]]; then
    yt_error "Invalid backup: missing env.backup file"
    rm -rf "$EXTRACT_DIR"
    exit 1
fi

# List backup contents
yt_info "Backup contents:"
[[ -f "$BACKUP_DIR/env.backup" ]] && yt_detail "  - Environment config (.env)"
[[ -f "$BACKUP_DIR/config/config.json" ]] && yt_detail "  - Application settings (config/config.json)"
[[ -f "$BACKUP_DIR/config/cookies.user.txt" ]] && yt_detail "  - YouTube cookies (config/cookies.user.txt)"
[[ -f "$BACKUP_DIR/config/complete.list" ]] && yt_detail "  - Download history (config/complete.list)"
[[ -f "$BACKUP_DIR/database/youtarr.sql" ]] && yt_detail "  - Database dump (youtarr.sql)"
[[ -d "$BACKUP_DIR/metadata/jobs/info" ]] && yt_detail "  - Video metadata (jobs/info/)"
[[ -d "$BACKUP_DIR/metadata/server/images" ]] && yt_detail "  - Thumbnails (server/images/)"

# Check for existing data
yt_section "Pre-restore Checks"

HAS_EXISTING_DATA=false
if [[ -f "$PROJECT_DIR/.env" ]]; then
    HAS_EXISTING_DATA=true
    yt_warn "Existing .env file found - will be overwritten"
fi

if [[ -f "$PROJECT_DIR/config/config.json" ]]; then
    HAS_EXISTING_DATA=true
    yt_warn "Existing config/config.json found - will be overwritten"
fi

if [[ -d "$PROJECT_DIR/database" ]] && [[ -n "$(ls -A "$PROJECT_DIR/database" 2>/dev/null)" ]]; then
    HAS_EXISTING_DATA=true
    yt_warn "Existing database directory found - database will be replaced"
fi

# Check if containers are running
CONTAINERS_RUNNING=false
if docker ps --format '{{.Names}}' | grep -qE '^youtarr(-db)?$'; then
    CONTAINERS_RUNNING=true
    yt_error "Youtarr containers are still running!"
    yt_detail "Stop them first with: ./stop.sh"
    if [[ "$FORCE" != "true" ]]; then
        rm -rf "$EXTRACT_DIR"
        exit 1
    fi
    yt_warn "Continuing anyway due to --force flag..."
fi

# Confirmation prompt
if [[ "$FORCE" != "true" ]]; then
    yt_section "Confirmation Required"

    echo ""
    cat <<'WARN'
##########################################################################
#  WARNING: This will overwrite existing Youtarr configuration!         #
##########################################################################
WARN
    echo ""

    if [[ "$HAS_EXISTING_DATA" == "true" ]]; then
        yt_warn "Existing data will be overwritten!"
    fi

    if [[ "$SKIP_DB" == "true" ]]; then
        yt_info "Database restore will be skipped (--skip-db)"
    fi

    echo ""
    read -r -p "Type 'RESTORE' to proceed or anything else to abort: " confirmation

    if [[ "${confirmation}" != "RESTORE" ]]; then
        yt_info "Aborted. No data was restored."
        rm -rf "$EXTRACT_DIR"
        exit 0
    fi
fi

# Stop containers if running (and we're forcing)
if [[ "$CONTAINERS_RUNNING" == "true" ]]; then
    yt_info "Stopping Youtarr containers..."
    (cd "$PROJECT_DIR" && ./stop.sh)
fi

# Perform restore
yt_section "Restoring Configuration"

# Restore .env
if [[ -f "$BACKUP_DIR/env.backup" ]]; then
    cp "$BACKUP_DIR/env.backup" "$PROJECT_DIR/.env"
    yt_success "Restored .env"
fi

# Restore config files
mkdir -p "$PROJECT_DIR/config"

if [[ -f "$BACKUP_DIR/config/config.json" ]]; then
    cp "$BACKUP_DIR/config/config.json" "$PROJECT_DIR/config/"
    yt_success "Restored config/config.json"
fi

if [[ -f "$BACKUP_DIR/config/cookies.user.txt" ]]; then
    cp "$BACKUP_DIR/config/cookies.user.txt" "$PROJECT_DIR/config/"
    yt_success "Restored config/cookies.user.txt"
fi

if [[ -f "$BACKUP_DIR/config/complete.list" ]]; then
    cp "$BACKUP_DIR/config/complete.list" "$PROJECT_DIR/config/"
    yt_success "Restored config/complete.list"
fi

# Restore metadata files if present
if [[ -d "$BACKUP_DIR/metadata/jobs/info" ]]; then
    mkdir -p "$PROJECT_DIR/jobs"
    cp -r "$BACKUP_DIR/metadata/jobs/info" "$PROJECT_DIR/jobs/"
    METADATA_COUNT=$(find "$PROJECT_DIR/jobs/info" -type f | wc -l)
    yt_success "Restored $METADATA_COUNT metadata files to jobs/info/"
fi

if [[ -d "$BACKUP_DIR/metadata/server/images" ]]; then
    mkdir -p "$PROJECT_DIR/server"
    cp -r "$BACKUP_DIR/metadata/server/images" "$PROJECT_DIR/server/"
    IMAGES_COUNT=$(find "$PROJECT_DIR/server/images" -type f | wc -l)
    yt_success "Restored $IMAGES_COUNT image files to server/images/"
fi

# Database restore
if [[ "$SKIP_DB" == "true" ]]; then
    yt_section "Database Restore"
    yt_info "Skipping database restore (--skip-db)"
elif [[ -f "$BACKUP_DIR/database/youtarr.sql" ]]; then
    yt_section "Database Restore"

    # Read database credentials from the restored .env
    DB_USER=$(get_env_value "$PROJECT_DIR/.env" "DB_USER" "root")
    DB_PASSWORD=$(get_env_value "$PROJECT_DIR/.env" "DB_PASSWORD" "123qweasd")
    DB_NAME=$(get_env_value "$PROJECT_DIR/.env" "DB_NAME" "youtarr")
    DB_PORT=$(get_env_value "$PROJECT_DIR/.env" "DB_PORT" "3321")

    # Need YOUTUBE_OUTPUT_DIR for compose to work
    export YOUTUBE_OUTPUT_DIR=$(get_env_value "$PROJECT_DIR/.env" "YOUTUBE_OUTPUT_DIR" "/tmp")

    # Determine compose args based on architecture
    if [[ "$IS_ARM" == "true" ]]; then
        COMPOSE_ARGS="-f $PROJECT_DIR/docker-compose.yml -f $PROJECT_DIR/docker-compose.arm.yml"
    else
        COMPOSE_ARGS="-f $PROJECT_DIR/docker-compose.yml"
    fi

    # Clear existing database directory for fresh import (only for bind mount, not named volume)
    if [[ "$IS_ARM" != "true" ]] && [[ -d "$PROJECT_DIR/database" ]]; then
        yt_info "Clearing existing database directory..."
        sudo rm -rf "$PROJECT_DIR/database"
        mkdir -p "$PROJECT_DIR/database"
    fi

    # Start database container
    yt_info "Starting database container..."
    (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS up -d youtarr-db)

    # Wait for database to be healthy
    yt_info "Waiting for database to be ready..."
    MAX_WAIT=90
    WAITED=0
    while [[ $WAITED -lt $MAX_WAIT ]]; do
        # First check if mysqladmin ping works
        if docker exec youtarr-db mysqladmin ping -h localhost -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" &>/dev/null; then
            # Then verify we can actually connect and run a query
            if docker exec youtarr-db mysql -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" &>/dev/null; then
                break
            fi
        fi
        sleep 2
        WAITED=$((WAITED + 2))
    done

    if [[ $WAITED -ge $MAX_WAIT ]]; then
        yt_error "Database failed to become ready within ${MAX_WAIT}s"
        yt_detail "Try starting Youtarr normally with ./start.sh"
        (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS down)
        rm -rf "$EXTRACT_DIR"
        exit 1
    fi

    yt_success "Database is ready"

    # Import database
    yt_info "Importing database..."

    # Drop and recreate database to ensure clean import
    yt_info "Preparing database..."
    DB_PREP_OUTPUT=$(docker exec youtarr-db mysql -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
        -e "DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1) || true
    if [[ -z "$DB_PREP_OUTPUT" ]] || [[ "$DB_PREP_OUTPUT" == *"Warning"* ]]; then
        yt_success "Database prepared for import"
    else
        yt_warn "Database preparation output: $DB_PREP_OUTPUT"
    fi

    # Import the SQL dump
    yt_info "Importing SQL dump (this may take a moment)..."
    IMPORT_ERROR=$(docker exec -i youtarr-db mysql -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$BACKUP_DIR/database/youtarr.sql" 2>&1)
    IMPORT_STATUS=$?
    if [[ $IMPORT_STATUS -eq 0 ]]; then
        yt_success "Database imported successfully"
    else
        yt_error "Database import failed"
        yt_detail "Error: $IMPORT_ERROR"
        (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS down)
        rm -rf "$EXTRACT_DIR"
        exit 1
    fi

    # Stop containers - let user start manually
    yt_info "Stopping database container..."
    (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS down)
    yt_success "Database container stopped"
else
    yt_section "Database Restore"
    yt_warn "No database dump found in backup - skipping database restore"
fi

# Clean up
rm -rf "$EXTRACT_DIR"

yt_section "Restore Complete"
yt_success "Youtarr has been restored successfully!"
echo ""
yt_info "Next steps:"
yt_detail "1. Verify YOUTUBE_OUTPUT_DIR in .env points to your video files"
yt_detail "2. Ensure video files are present in that directory"
yt_detail "3. Start Youtarr with: ./start.sh"
echo ""

# Read the restored YOUTUBE_OUTPUT_DIR for the reminder
RESTORED_OUTPUT_DIR=$(get_env_value "$PROJECT_DIR/.env" "YOUTUBE_OUTPUT_DIR" "")
if [[ -n "$RESTORED_OUTPUT_DIR" ]]; then
    yt_warn "Backup was configured for: YOUTUBE_OUTPUT_DIR=$RESTORED_OUTPUT_DIR"
    if [[ ! -d "$RESTORED_OUTPUT_DIR" ]]; then
        yt_error "This directory does not exist! Update .env or create the directory."
    fi
fi
