#!/bin/bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--no-auth] [--image IMAGE]" >&2
  exit 1
}

NO_AUTH=false
IMAGE="dialmaster/youtarr:latest"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-auth)
      NO_AUTH=true
      shift
      ;;
    --image)
      if [[ $# -lt 2 ]]; then
        usage
      fi
      IMAGE="$2"
      shift 2
      ;;
    --help|-h)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker command not found. Install Docker and try again." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR="$SCRIPT_DIR"
CONFIG_FILE="$ROOT_DIR/config/config.json"
DB_ENV_FILE="$ROOT_DIR/config/external-db.env"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "===============================================" >&2
  echo "ERROR: Configuration file not found!" >&2
  echo "===============================================" >&2
  echo "Please run ./setup.sh first to configure Youtarr." >&2
  echo "===============================================" >&2
  exit 1
fi

if [[ ! -f "$DB_ENV_FILE" ]]; then
  echo "===============================================" >&2
  echo "ERROR: External DB configuration missing!" >&2
  echo "===============================================" >&2
  echo "Expected environment file: $DB_ENV_FILE" >&2
  echo "Create it from config/external-db.env.example and set" >&2
  echo "DB_HOST, DB_USER, DB_PASSWORD (and optionally DB_PORT, DB_NAME)." >&2
  echo "===============================================" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$DB_ENV_FILE"
set +a

REQUIRED_VARS=(DB_HOST DB_USER DB_PASSWORD)
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "===============================================" >&2
    echo "ERROR: Missing required variable $var in $DB_ENV_FILE" >&2
    echo "===============================================" >&2
    exit 1
  fi
done

DB_PORT=${DB_PORT:-3306}
DB_NAME=${DB_NAME:-youtarr}

if [[ "$NO_AUTH" = true ]]; then
  AUTH_ENABLED_VALUE="false"
  echo "⚠️  Authentication disabled via --no-auth flag"
  echo "⚠️  Do not expose Youtarr directly to the internet when auth is disabled; protect access with your own auth proxy"
elif [[ -n "${AUTH_ENABLED:-}" ]]; then
  AUTH_ENABLED_VALUE="$AUTH_ENABLED"
else
  AUTH_ENABLED_VALUE=""
fi

youtubeOutputDirectory=$(grep '"youtubeOutputDirectory"' "$CONFIG_FILE" | sed 's/.*"youtubeOutputDirectory"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
youtubeOutputDirectory=$(echo "$youtubeOutputDirectory" | xargs)

if [[ -z "$youtubeOutputDirectory" || "$youtubeOutputDirectory" == "null" ]]; then
  echo "===============================================" >&2
  echo "ERROR: YouTube output directory not configured!" >&2
  echo "===============================================" >&2
  echo "Please run ./setup.sh to configure the download directory." >&2
  echo "===============================================" >&2
  exit 1
fi

DOCKER_MOUNT_SOURCE="$youtubeOutputDirectory"
CHECK_DIR="$youtubeOutputDirectory"

if [[ "$OSTYPE" == "msys" ]]; then
  DOCKER_MOUNT_SOURCE="/$DOCKER_MOUNT_SOURCE"
  CHECK_DIR="${DOCKER_MOUNT_SOURCE:1}"
fi

if [[ ! -d "$CHECK_DIR" ]]; then
  echo "===============================================" >&2
  echo "ERROR: YouTube output directory does not exist!" >&2
  echo "===============================================" >&2
  echo "Directory: $CHECK_DIR" >&2
  echo "===============================================" >&2
  exit 1
fi

if [[ ! -r "$CHECK_DIR" ]]; then
  echo "===============================================" >&2
  echo "ERROR: YouTube output directory is not readable!" >&2
  echo "===============================================" >&2
  echo "Directory: $CHECK_DIR" >&2
  echo "===============================================" >&2
  exit 1
fi

echo "YouTube output directory verified: $CHECK_DIR"

echo "Preparing host directories..."
mkdir -p "$ROOT_DIR/jobs" "$ROOT_DIR/server/images"

CONTAINER_NAME="youtarr"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Stopping existing container $CONTAINER_NAME..."
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

echo "Pulling image $IMAGE..."
docker pull "$IMAGE" >/dev/null

RUN_ARGS=(
  docker run -d
  --name "$CONTAINER_NAME"
  --restart unless-stopped
  -p 3087:3011
  --add-host host.docker.internal:host-gateway
  -e IN_DOCKER_CONTAINER=1
  -e DB_HOST="${DB_HOST}"
  -e DB_PORT="${DB_PORT}"
  -e DB_USER="${DB_USER}"
  -e DB_PASSWORD="${DB_PASSWORD}"
  -e DB_NAME="${DB_NAME}"
)

if [[ -n "$AUTH_ENABLED_VALUE" ]]; then
  RUN_ARGS+=( -e "AUTH_ENABLED=${AUTH_ENABLED_VALUE}" )
fi

if [[ -n "${AUTH_PRESET_USERNAME:-}" && -n "${AUTH_PRESET_PASSWORD:-}" ]]; then
  RUN_ARGS+=(
    -e "AUTH_PRESET_USERNAME=${AUTH_PRESET_USERNAME}"
    -e "AUTH_PRESET_PASSWORD=${AUTH_PRESET_PASSWORD}"
  )
elif [[ -n "${AUTH_PRESET_USERNAME:-}" || -n "${AUTH_PRESET_PASSWORD:-}" ]]; then
  echo "⚠️  Ignoring partial preset credentials. Both AUTH_PRESET_USERNAME and AUTH_PRESET_PASSWORD must be set." >&2
fi

RUN_ARGS+=(
  -v "${DOCKER_MOUNT_SOURCE}:/usr/src/app/data"
  -v "${ROOT_DIR}/config:/app/config"
  -v "${ROOT_DIR}/jobs:/app/jobs"
  -v "${ROOT_DIR}/server/images:/app/server/images"
  -v "${ROOT_DIR}/migrations:/app/migrations"
  "$IMAGE"
)

echo "External database target: ${DB_HOST}:${DB_PORT} (schema: ${DB_NAME})"

"${RUN_ARGS[@]}"

echo "Youtarr is starting up..."
echo "You can check the logs with: docker logs -f $CONTAINER_NAME"
echo "To stop Youtarr, run: ./stop.sh"
