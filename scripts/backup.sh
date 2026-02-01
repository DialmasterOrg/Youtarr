#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=scripts/_console_output.sh
source "$SCRIPT_DIR/_console_output.sh"

OUTPUT_DIR="$PROJECT_DIR/backups"
SKIP_IMAGES=false

cleanup() {
  if [[ -n "${STAGING_DIR:-}" ]] && [[ -d "$STAGING_DIR" ]]; then
    rm -rf "$STAGING_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT

print_usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Creates a backup of Youtarr configuration and database.

Options:
  --output-dir DIR  Directory to save backup (default: ./backups)
  --skip-images     Skip server/images/ thumbnail files (~8MB savings)
                    (Thumbnails auto-regenerate when channels are accessed)
  --help            Show this help message

What gets backed up:
  - Environment config (.env)
  - Application settings (config/config.json)
  - YouTube cookies (config/cookies.user.txt if present)
  - Download history (config/complete.list)
  - Database (full MariaDB dump)
  - Video metadata (jobs/info/*.info.json)
  - Thumbnails (server/images/*) - unless --skip-images

NOT backed up: Video files in YOUTUBE_OUTPUT_DIR (user's responsibility)

Examples:
  $(basename "$0")                     # Full backup to ./backups/
  $(basename "$0") --output-dir /mnt/backup
  $(basename "$0") --skip-images
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

get_env_value() {
  local key="$1"
  local default="${2:-}"
  local value
  value=$(grep -E "^${key}=" "$PROJECT_DIR/.env" 2>/dev/null | head -n1 | cut -d'=' -f2- | sed 's/^"//;s/"$//' || true)
  if [[ -n "$value" ]]; then
    echo "$value"
  else
    echo "$default"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --skip-images)
      SKIP_IMAGES=true
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

yt_banner "Youtarr Backup"

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  yt_error "No .env file found in $PROJECT_DIR"
  yt_detail "This doesn't appear to be a configured Youtarr installation."
  yt_detail "Run ./start.sh first to initialize Youtarr, then try again."
  exit 1
fi

COMPOSE_CMD=$(get_compose_command)

yt_info "Docker compose command: $COMPOSE_CMD"

ARCH=$(uname -m)
IS_ARM=false
if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
  IS_ARM=true
  yt_info "Detected ARM architecture ($ARCH)"
fi

DB_USER=$(get_env_value "DB_USER" "root")
DB_PASSWORD=$(get_env_value "DB_PASSWORD" "123qweasd")
DB_NAME=$(get_env_value "DB_NAME" "youtarr")
DB_PORT=$(get_env_value "DB_PORT" "3321")

mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_NAME="youtarr-backup-$TIMESTAMP"
STAGING_DIR=$(mktemp -d)
BACKUP_DIR="$STAGING_DIR/$BACKUP_NAME"
mkdir -p "$BACKUP_DIR"

yt_section "Staging Backup"

DB_RUNNING=false
if docker ps --format '{{.Names}}' | grep -q '^youtarr-db$'; then
  DB_RUNNING=true
  yt_info "Database container is running."
else
  yt_info "Database container is not running."
fi

BACKED_UP_ITEMS=()

if [[ -f "$PROJECT_DIR/.env" ]]; then
  cp "$PROJECT_DIR/.env" "$BACKUP_DIR/env.backup"
  BACKED_UP_ITEMS+=("env.backup")
  yt_success "Backed up .env file"
fi

mkdir -p "$BACKUP_DIR/config"
USED_SUDO_FOR_CONFIG=false

if [[ -f "$PROJECT_DIR/config/config.json" ]]; then
  if cp "$PROJECT_DIR/config/config.json" "$BACKUP_DIR/config/" 2>/dev/null; then
    BACKED_UP_ITEMS+=("config/config.json")
    yt_success "Backed up config/config.json"
  elif sudo cp "$PROJECT_DIR/config/config.json" "$BACKUP_DIR/config/" 2>/dev/null; then
    USED_SUDO_FOR_CONFIG=true
    BACKED_UP_ITEMS+=("config/config.json")
    yt_success "Backed up config/config.json (with sudo)"
  else
    yt_warn "Could not backup config/config.json (permission denied)"
  fi
fi

if [[ -f "$PROJECT_DIR/config/cookies.user.txt" ]]; then
  if cp "$PROJECT_DIR/config/cookies.user.txt" "$BACKUP_DIR/config/" 2>/dev/null; then
    BACKED_UP_ITEMS+=("config/cookies.user.txt")
    yt_success "Backed up config/cookies.user.txt"
  elif sudo cp "$PROJECT_DIR/config/cookies.user.txt" "$BACKUP_DIR/config/" 2>/dev/null; then
    USED_SUDO_FOR_CONFIG=true
    BACKED_UP_ITEMS+=("config/cookies.user.txt")
    yt_success "Backed up config/cookies.user.txt (with sudo)"
  else
    yt_warn "Could not backup config/cookies.user.txt (permission denied)"
  fi
fi

if [[ -f "$PROJECT_DIR/config/complete.list" ]]; then
  if cp "$PROJECT_DIR/config/complete.list" "$BACKUP_DIR/config/" 2>/dev/null; then
    BACKED_UP_ITEMS+=("config/complete.list")
    yt_success "Backed up config/complete.list"
  elif sudo cp "$PROJECT_DIR/config/complete.list" "$BACKUP_DIR/config/" 2>/dev/null; then
    USED_SUDO_FOR_CONFIG=true
    BACKED_UP_ITEMS+=("config/complete.list")
    yt_success "Backed up config/complete.list (with sudo)"
  else
    yt_warn "Could not backup config/complete.list (permission denied)"
  fi
fi

if [[ "$USED_SUDO_FOR_CONFIG" == "true" ]]; then
  sudo chown -R "$(id -u):$(id -g)" "$BACKUP_DIR/config"
fi

# Database backup

yt_section "Database Backup"

mkdir -p "$BACKUP_DIR/database"

if [[ "$IS_ARM" == "true" ]]; then
  COMPOSE_ARGS="-f $PROJECT_DIR/docker-compose.yml -f $PROJECT_DIR/docker-compose.arm.yml"
else
  COMPOSE_ARGS="-f $PROJECT_DIR/docker-compose.yml"
fi

DB_STARTED_FOR_BACKUP=false

if [[ "$DB_RUNNING" == "false" ]]; then
  yt_info "Starting database container for backup..."
  export YOUTUBE_OUTPUT_DIR="${YOUTUBE_OUTPUT_DIR:-/tmp}"
  (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS up -d youtarr-db)
  DB_STARTED_FOR_BACKUP=true

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
    rm -rf "$STAGING_DIR"
    exit 1
  fi

  yt_success "Database is ready"
fi

# Perform database dump

yt_info "Dumping database..."
if docker exec youtarr-db mysqldump \
  --single-transaction \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  "$DB_NAME" > "$BACKUP_DIR/database/youtarr.sql" 2>/dev/null; then
  BACKED_UP_ITEMS+=("database/youtarr.sql")
  DB_SIZE=$(du -h "$BACKUP_DIR/database/youtarr.sql" | cut -f1)
  yt_success "Database dumped ($DB_SIZE)"
else
  yt_error "Database dump failed"
  if [[ "$DB_STARTED_FOR_BACKUP" == "true" ]]; then
    (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS down)
  fi
  rm -rf "$STAGING_DIR"
  exit 1
fi

if [[ "$DB_STARTED_FOR_BACKUP" == "true" ]]; then
  yt_info "Stopping database container..."
  (cd "$PROJECT_DIR" && $COMPOSE_CMD $COMPOSE_ARGS down)
  yt_success "Database container stopped"
fi

# Metadata files

yt_section "Metadata Backup"
if [[ -d "$PROJECT_DIR/jobs/info" ]] && [[ -n "$(ls -A "$PROJECT_DIR/jobs/info" 2>/dev/null)" ]]; then
  mkdir -p "$BACKUP_DIR/metadata/jobs"
  if cp -r "$PROJECT_DIR/jobs/info" "$BACKUP_DIR/metadata/jobs/" 2>/dev/null; then
    METADATA_COUNT=$(find "$BACKUP_DIR/metadata/jobs/info" -type f 2>/dev/null | wc -l)
    METADATA_SIZE=$(du -sh "$BACKUP_DIR/metadata/jobs/info" 2>/dev/null | cut -f1)
    BACKED_UP_ITEMS+=("metadata/jobs/info/")
    yt_success "Backed up $METADATA_COUNT metadata files ($METADATA_SIZE)"
  elif sudo cp -r "$PROJECT_DIR/jobs/info" "$BACKUP_DIR/metadata/jobs/" 2>/dev/null; then
    sudo chown -R "$(id -u):$(id -g)" "$BACKUP_DIR/metadata/jobs/info"
    METADATA_COUNT=$(find "$BACKUP_DIR/metadata/jobs/info" -type f 2>/dev/null | wc -l)
    METADATA_SIZE=$(du -sh "$BACKUP_DIR/metadata/jobs/info" 2>/dev/null | cut -f1)
    BACKED_UP_ITEMS+=("metadata/jobs/info/")
    yt_success "Backed up $METADATA_COUNT metadata files ($METADATA_SIZE) (with sudo)"
  else
    yt_warn "Could not backup jobs/info/ (permission denied)"
  fi
else
  yt_info "No metadata files found in jobs/info/"
fi

# Optional images
if [[ "$SKIP_IMAGES" == "false" ]]; then
  yt_section "Images Backup"
  if [[ -d "$PROJECT_DIR/server/images" ]] && [[ -n "$(ls -A "$PROJECT_DIR/server/images" 2>/dev/null)" ]]; then
    mkdir -p "$BACKUP_DIR/metadata/server"
    if cp -r "$PROJECT_DIR/server/images" "$BACKUP_DIR/metadata/server/" 2>/dev/null; then
      IMAGES_COUNT=$(find "$BACKUP_DIR/metadata/server/images" -type f 2>/dev/null | wc -l)
      IMAGES_SIZE=$(du -sh "$BACKUP_DIR/metadata/server/images" 2>/dev/null | cut -f1)
      BACKED_UP_ITEMS+=("metadata/server/images/")
      yt_success "Backed up $IMAGES_COUNT image files ($IMAGES_SIZE)"
    elif sudo cp -r "$PROJECT_DIR/server/images" "$BACKUP_DIR/metadata/server/" 2>/dev/null; then
      sudo chown -R "$(id -u):$(id -g)" "$BACKUP_DIR/metadata/server/images"
      IMAGES_COUNT=$(find "$BACKUP_DIR/metadata/server/images" -type f 2>/dev/null | wc -l)
      IMAGES_SIZE=$(du -sh "$BACKUP_DIR/metadata/server/images" 2>/dev/null | cut -f1)
      BACKED_UP_ITEMS+=("metadata/server/images/")
      yt_success "Backed up $IMAGES_COUNT image files ($IMAGES_SIZE) (with sudo)"
    else
      yt_warn "Could not backup server/images/ (permission denied)"
    fi
  else
    yt_info "No image files found in server/images/"
  fi
else
  yt_info "Skipping image files (--skip-images)"
fi

# Manifest

yt_section "Creating Archive"
cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "version": "1.0",
  "created": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "architecture": "$ARCH",
  "is_arm": $IS_ARM,
  "db_name": "$DB_NAME",
  "items": $(printf '%s\n' "${BACKED_UP_ITEMS[@]}" | jq -R . | jq -s .),
  "options": {
    "skip_images": $SKIP_IMAGES
  }
}
EOF

yt_success "Created manifest.json"

ARCHIVE_PATH="$OUTPUT_DIR/$BACKUP_NAME.tar.gz"
yt_info "Creating archive..."
if ! (cd "$STAGING_DIR" && tar -czf "$ARCHIVE_PATH" "$BACKUP_NAME"); then
  yt_error "Failed to create archive"
  rm -rf "$STAGING_DIR"
  exit 1
fi

rm -rf "$STAGING_DIR"

ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)

yt_section "Backup Complete"
yt_success "Backup created successfully!"


yt_info "Archive: $ARCHIVE_PATH"
yt_info "Size: $ARCHIVE_SIZE"

yt_detail "Contents:"
for item in "${BACKED_UP_ITEMS[@]}"; do
  yt_detail " - $item"
done

yt_warn "Remember: Video files are NOT included in this backup."
yt_detail "Ensure your YOUTUBE_OUTPUT_DIR is backed up separately."
