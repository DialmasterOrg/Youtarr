#!/bin/bash

SHARED_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_SCRIPT_NAME=$(basename "$0")

# shellcheck source=scripts/_console_output.sh
source "$SHARED_SCRIPT_DIR/_console_output.sh"
# shellcheck source=scripts/_env_helpers.sh
source "$SHARED_SCRIPT_DIR/_env_helpers.sh"

SETUP_TOKEN_PATTERN='[0-9a-f]{64}'

get_youtarr_host_port() {
  local host_port="${YOUTARR_HOST_PORT:-}"

  if [ -z "$host_port" ]; then
    host_port=$(youtarr_get_env_file_value "./.env" "YOUTARR_HOST_PORT" "3087")
  fi

  printf '%s' "${host_port:-3087}"
}

extract_setup_token_from_text() {
  local text="$1"

  printf '%s' "$text" \
    | grep -Eo "setupToken['\"]?[[:space:]]*[:=][[:space:]]*['\"]?$SETUP_TOKEN_PATTERN['\"]?" \
    | head -n 1 \
    | grep -Eo "$SETUP_TOKEN_PATTERN" \
    | head -n 1
}

read_setup_token_from_file() {
  local token_file="./config/setup-token"
  local token

  if [ ! -r "$token_file" ]; then
    return 1
  fi

  token=$(tr -d '[:space:]' < "$token_file" 2>/dev/null || true)
  if printf '%s' "$token" | grep -Eq "^$SETUP_TOKEN_PATTERN$"; then
    printf '%s' "$token"
    return 0
  fi

  return 1
}

read_setup_token_from_logs() {
  local provided_logs="${1:-}"
  local logs token

  if [ -n "$provided_logs" ]; then
    token=$(extract_setup_token_from_text "$provided_logs")
    if [ -n "$token" ]; then
      printf '%s' "$token"
      return 0
    fi
  fi

  # shellcheck disable=SC2086 # COMPOSE_CMD and COMPOSE_FILES intentionally word-split.
  logs=$($COMPOSE_CMD $COMPOSE_FILES logs --tail 300 --no-log-prefix youtarr 2>/dev/null || true)
  token=$(extract_setup_token_from_text "$logs")
  if [ -n "$token" ]; then
    printf '%s' "$token"
    return 0
  fi

  return 1
}

read_initial_setup_token() {
  local provided_logs="${1:-}"

  read_setup_token_from_file && return 0
  read_setup_token_from_logs "$provided_logs" && return 0

  return 1
}

print_initial_setup_guidance() {
  local provided_logs="${1:-}"
  local setup_token host_port
  host_port=$(get_youtarr_host_port)

  yt_section "Initial Setup Required"
  yt_info "Authentication is not yet configured. Complete first-time setup with the one-time token."

  if setup_token=$(read_initial_setup_token "$provided_logs"); then
    yt_info "Setup token:"
    yt_detail "$setup_token"
    yt_warn "Treat this token as sensitive. It is single-use and will be removed after setup."
  else
    yt_info "Retrieve the token with:"
    yt_detail "$COMPOSE_CMD $COMPOSE_FILES logs youtarr | grep -A5 'initial setup required'"
    yt_detail "Or read config/setup-token in your Youtarr data volume."
  fi

  yt_info "Open the setup page in any browser and paste the token:"
  yt_detail "http://localhost:${host_port}/setup     (or http://<your-LAN-IP>:${host_port}/setup)"
  yt_detail "The token is also written to config/setup-token in your Youtarr data volume."
  yt_warn "Only use plain HTTP setup on localhost, your trusted LAN, VPN, or SSH tunnel."
}

has_valid_auth_preset() {
  local username="$1"
  local password="$2"
  local trimmed_username

  trimmed_username=$(printf '%s' "$username" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')

  [ -n "$trimmed_username" ] &&
    [ "${#trimmed_username}" -le 32 ] &&
    [ -n "$password" ] &&
    [ "${#password}" -ge 8 ] &&
    [ "${#password}" -le 64 ]
}

print_setup_guidance_if_needed() {
  local env_file="./.env"

  local auth_enabled auth_preset_username auth_preset_password
  auth_enabled=$(youtarr_get_env_file_value "$env_file" "AUTH_ENABLED" "true")
  auth_preset_username=$(youtarr_get_env_file_value "$env_file" "AUTH_PRESET_USERNAME" "")
  auth_preset_password=$(youtarr_get_env_file_value "$env_file" "AUTH_PRESET_PASSWORD" "")

  # Platform-managed auth: setup wizard is bypassed.
  if [ "$auth_enabled" = "false" ]; then
    return 0
  fi

  # Headless preset will bootstrap creds on container start; no wizard needed.
  if has_valid_auth_preset "$auth_preset_username" "$auth_preset_password"; then
    return 0
  fi

  # Prefer the app's setup-status endpoint once it is reachable. This avoids
  # racing the startup logs on first boot, where MariaDB/app initialization can
  # take longer than the shell helper's polling window.
  local i logs setup_status setup_token host_port
  host_port=$(get_youtarr_host_port)
  for i in $(seq 1 60); do
    if command -v curl >/dev/null 2>&1; then
      setup_status=$(curl --silent --max-time 1 "http://localhost:${host_port}/setup/status" 2>/dev/null || true)
      if printf '%s' "$setup_status" | grep -q '"requiresSetup"[[:space:]]*:[[:space:]]*true'; then
        print_initial_setup_guidance
        return 0
      fi
      if printf '%s' "$setup_status" | grep -q '"requiresSetup"[[:space:]]*:[[:space:]]*false'; then
        return 0
      fi
    fi

    # Fall back to logs for systems without curl or while the HTTP endpoint is
    # still coming up. Include COMPOSE_FILES so dev/external-db starts inspect
    # the same stack that was just launched.
    # shellcheck disable=SC2086 # COMPOSE_CMD and COMPOSE_FILES intentionally word-split.
    logs=$($COMPOSE_CMD $COMPOSE_FILES logs --tail 300 --no-log-prefix youtarr 2>/dev/null)
    if printf '%s' "$logs" | grep -q 'initial setup required'; then
      print_initial_setup_guidance "$logs"
      return 0
    fi
    if ! command -v curl >/dev/null 2>&1 && printf '%s' "$logs" | grep -q 'Server started and listening'; then
      return 0
    fi
    sleep 0.5
  done

  yt_section "Startup Next Steps"
  yt_info "Youtarr is still starting or the setup-status endpoint is not reachable yet."
  yt_info "Open http://localhost:${host_port} after the container finishes starting."
  yt_detail "If this is a first-time install, the setup page will ask for the one-time token."
  if setup_token=$(read_initial_setup_token "$logs"); then
    yt_info "Setup token:"
    yt_detail "$setup_token"
    yt_warn "Treat this token as sensitive. It is single-use and will be removed after setup."
  else
    yt_detail "Token command: $COMPOSE_CMD $COMPOSE_FILES logs youtarr | grep -A5 'initial setup required'"
  fi
  return 0
}

print_usage() {
  cat <<EOF
Usage: $START_SCRIPT_NAME [--no-auth] [--debug] [--headless-auth] [--pull-latest] [--dev]

  --no-auth          Disable authentication (only safe behind your own auth layer!)
  --debug            Set container log level to debug
  --headless-auth    Prompt for auth credentials to write into .env for headless setups
                     This will disable web UI credential management (credentials set here persist)
                     To update credentials later, edit .env directly and restart Youtarr
  --pull-latest      Pull latest git commits and Docker images before starting
  --dev              Use the bleeding-edge dev image (dialmaster/youtarr:dev-latest)
                     Warning: Dev builds contain unreleased features and may be unstable
  --arm              Force ARM compose file selection (useful for Apple Silicon / Raspberry Pi)
  --external-db      Use external database compose file (docker-compose.external-db.yml)
  --as-elfhosted     (Dev only) Spoof an Elfhosted deployment by exporting PLATFORM=elfhosted
                     and AUTH_ENABLED=false for this run. Implies --no-auth. Does not set
                     DATA_PATH or PLEX_URL; add those to .env if you need to test code paths
                     that depend on them. See docs/development/ELFHOSTED.md.
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

get_env_or_dotenv_value() {
  local key="$1"
  local value="${!key:-}"

  if [ -n "$value" ]; then
    printf '%s' "$value"
    return
  fi

  if [ -f ./.env ]; then
    value=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" ./.env | tail -n 1 | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//" | sed -E 's/[[:space:]]+#.*$//' | sed -E 's/^"(.*)"$/\1/' | sed -E "s/^'(.*)'$/\1/")
    printf '%s' "$value"
  fi
}

# Get the appropriate compose command
COMPOSE_CMD=$(get_compose_command)

yt_section "Configuration"
yt_warn "Runtime configuration now comes from .env and config/config.json files."
yt_warn "config/config.json is created from config/config.example.json if missing."
yt_info "Docker compose command: $COMPOSE_CMD"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-auth)
      NO_AUTH=true
      shift
      ;;
    --debug)
      LOG_LEVEL="debug"
      shift
      ;;
    --headless-auth)
      HEADLESS_AUTH=true
      shift
      ;;
    --pull-latest)
      PULL_LATEST=true
      shift
      ;;
    --dev)
      USE_DEV_IMAGE=true
      shift
      ;;
    --arm)
      USE_ARM=true
      shift
      ;;
    --external-db)
      USE_EXTERNAL_DB=true
      shift
      ;;
    --as-elfhosted)
      AS_ELFHOSTED=true
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

# Command line flag overrides .env settings
if [ "$AS_ELFHOSTED" = true ]; then
  if [ "$DEV_MODE" != "true" ]; then
    yt_error "--as-elfhosted is only supported by ./scripts/start-dev.sh."
    exit 1
  fi
  export PLATFORM=elfhosted
  export AUTH_ENABLED=false
  yt_warn "Spoofing Elfhosted deployment for this run."
  yt_detail "Exported: PLATFORM=elfhosted, AUTH_ENABLED=false (these overrides do not persist)."
  yt_detail "Covers: yt-dlp update gating, auth bypass, Elfhosted UI chips, version-banner suppression."
  DATA_PATH_FOR_SPOOF=$(get_env_or_dotenv_value "DATA_PATH")
  PLEX_URL_FOR_SPOOF=$(get_env_or_dotenv_value "PLEX_URL")
  if [ -z "$DATA_PATH_FOR_SPOOF" ] && [ -z "$PLEX_URL_FOR_SPOOF" ]; then
    yt_detail "Not spoofed: DATA_PATH and PLEX_URL are unset, so persistent-data relocation"
    yt_detail "  and Plex-URL locking will not be exercised. Set them in .env to test those paths."
  elif [ -z "$DATA_PATH_FOR_SPOOF" ]; then
    yt_detail "Not spoofed: DATA_PATH is unset (persistent-data relocation will not be exercised)."
  elif [ -z "$PLEX_URL_FOR_SPOOF" ]; then
    yt_detail "Not spoofed: PLEX_URL is unset (Plex-URL locking will not be exercised)."
  else
    yt_detail "Detected DATA_PATH and PLEX_URL from the shell or .env for full platform spoofing."
  fi
  yt_detail "A local spoof cannot replicate Cloudflare Access or rclone-backed storage."
fi

if [ "$NO_AUTH" = true ]; then
  export AUTH_ENABLED=false
  yt_warn "Authentication disabled via --no-auth flag."
  yt_detail "Do not expose Youtarr directly to the internet without your own auth proxy."
  yt_detail "This override does not persist; set AUTH_ENABLED=false in .env to make it permanent."
fi

if [ -n "$LOG_LEVEL" ]; then
  export LOG_LEVEL
  yt_info "Log level forced to '$LOG_LEVEL' via CLI flag."
fi

if [ "$USE_DEV_IMAGE" = true ]; then
  export USE_DEV_IMAGE
fi

if [ "$HEADLESS_AUTH" = true ]; then
  export HEADLESS_AUTH=true
  yt_info "Headless authentication bootstrap enabled."
fi

if [ "$PULL_LATEST" = true ]; then
  yt_section "Repository Updates"
  yt_info "Pulling latest git commits."
  git pull
  yt_info "Pulling latest Docker images."
  $COMPOSE_CMD pull
else
  yt_section "Updates"
  yt_warn "Starting with current version (no updates pulled)."
  yt_info "To update Youtarr to the latest version, use:"
  yt_detail "$START_SCRIPT_NAME --pull-latest"
  yt_detail "This pulls the latest code and Docker images before starting."
fi

# Run the create-env script to ensure .env and config are setup
yt_section "Environment Files"
yt_info "Ensuring .env and supporting config are present."
"$SHARED_SCRIPT_DIR/_create-env.sh"

# Check that the YouTube output directory exists and is readable
if ! "$SHARED_SCRIPT_DIR/check_youtube_output_dir.sh"; then
    yt_error "YouTube output directory check failed. Resolve the issue and re-run the start script."
    exit 1
fi

# Determine compose files to use
# Support dev, external database, and ARM compose flows.
# Priority (highest -> lowest):
# 1) Dev compose (explicit CI/dev flows)
# 2) External DB compose (when using an external DB)
# 3) ARM compose (auto-detected or forced with --arm)
# 4) Default docker-compose.yml

# If the start script or wrapper exported USE_EXTERNAL_DB, it will be honored.
# Allow explicit CLI override with --external-db and --arm flags parsed above.

# Auto-detect ARM if not explicitly provided
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
  DETECTED_ARM=true
else
  DETECTED_ARM=false
fi

DATABASE_HAS_CONTENT=false
if [[ -f ./database/ibdata1 || -d ./database/mysql ]]; then
  DATABASE_HAS_CONTENT=true
fi

# Detect a pre-existing MariaDB named volume for THIS install only. We scope by
# Compose project name so a sibling Youtarr checkout's volume on the same host
# does not falsely trigger named-volume mode here.
NAMED_VOLUME_EXISTS=false
if youtarr_named_volume_exists "$(pwd)"; then
  NAMED_VOLUME_EXISTS=true
fi

prepare_named_volume_compose_selection() {
  if [[ -n "${COMPOSE_FILE:-}" ]] && [[ "$COMPOSE_FILE" != *"docker-compose.arm.yml"* ]]; then
    yt_error "COMPOSE_FILE is set in your shell environment but does not include docker-compose.arm.yml."
    yt_detail "This run needs named-volume database storage, but shell COMPOSE_FILE overrides .env."
    yt_detail "Unset COMPOSE_FILE or include docker-compose.arm.yml before starting Youtarr."
    exit 1
  fi

  youtarr_pin_named_volume_in_env "$(pwd)/.env"
  PIN_RC=$?
  if [ "$PIN_RC" -eq 0 ]; then
    yt_detail "Pinned named-volume override in .env so plain 'docker compose up -d' uses the same storage."
  elif [ "$PIN_RC" -eq 1 ]; then
    yt_warn "Could not pin named-volume override in .env."
    yt_detail "Use ./start.sh for future restarts, or add docker-compose.arm.yml to COMPOSE_FILE manually."
  fi

  COMPOSE_FILES=$(youtarr_compose_args_for_storage_mode "$(pwd)" "named-volume")
}

if [ "$USE_DOCKER_COMPOSE_DEV" == "true" ]; then
  # Dev flow uses the dev compose (standalone file for developer workflows)
  COMPOSE_FILES="-f docker-compose.dev.yml"
elif [ "$USE_EXTERNAL_DB" == "true" ]; then
  # External DB uses the base compose with the external-db override
  COMPOSE_FILES="-f docker-compose.yml -f docker-compose.external-db.yml"
else
  # Refuse to auto-pick storage when both bind mount and named volume exist.
  # Picking the wrong one would make the user's data appear to vanish; we'd
  # rather fail loudly than silently switch them.
  if [ "$DATABASE_HAS_CONTENT" == "true" ] && [ "$NAMED_VOLUME_EXISTS" == "true" ]; then
    yt_error "Ambiguous database storage: both ./database/ and a Docker named volume for MariaDB exist."
    yt_detail "Refusing to choose automatically because the wrong choice would make your data appear to vanish."
    yt_detail ""
    yt_detail "Inspect what you have:"
    yt_detail "  Named volumes:  docker volume ls --format '{{.Name}}' | grep youtarr-db-data"
    yt_detail "  Bind mount:     ls -la ./database/"
    yt_detail ""
    yt_detail "Then keep one and remove the other:"
    yt_detail "  Keep the bind mount:   docker volume rm <volume-name>"
    yt_detail "  Keep the named volume: mv ./database ./database.unused.\$(date +%Y%m%d)"
    yt_detail ""
    yt_detail "If you are migrating from the bind mount to a named volume for the first time,"
    yt_detail "use the helper instead: ./scripts/migrate-to-named-volume.sh"
    exit 1
  fi

  if [ "$USE_ARM" == "true" ]; then
    if [ "$DATABASE_HAS_CONTENT" == "true" ]; then
      # Existing bind-mounted installs keep using their current database even
      # when --arm is passed. Silently switching would make their data appear
      # to vanish behind an empty named volume.
      unset COMPOSE_FILES
      yt_warn "--arm requested, but bind-mounted MariaDB data was detected in ./database/."
      yt_warn "Keeping the existing bind-mounted database for this run."
      yt_detail "To move this install to named-volume storage, run:"
      yt_detail "  ./scripts/migrate-to-named-volume.sh"
    else
      # Explicit --arm uses the named-volume override when there is no bind data to preserve.
      prepare_named_volume_compose_selection
    fi
  elif [ "$DETECTED_ARM" == "true" ]; then
    if [ "$DATABASE_HAS_CONTENT" == "true" ]; then
      # Existing bind-mounted installs keep using their current database on ARM.
      unset COMPOSE_FILES
      yt_warn "ARM host detected, but bind-mounted MariaDB data was detected in ./database/."
      yt_warn "Keeping the existing bind-mounted database for this run."
      yt_detail "To move this install to named-volume storage, run:"
      yt_detail "  ./scripts/migrate-to-named-volume.sh"
    else
      # ARM fresh installs use the named-volume override.
      prepare_named_volume_compose_selection
      yt_info "ARM host detected; using named-volume database storage."
    fi
  elif [ "$NAMED_VOLUME_EXISTS" == "true" ]; then
    # An existing named volume with no bind-mount data: keep using the named volume.
    # This is the common case after a successful migration, or after the user manually
    # switched to the named-volume override on a previous run.
    prepare_named_volume_compose_selection
    yt_info "Existing named-volume database detected; using named-volume storage."
  elif [ "$DATABASE_HAS_CONTENT" != "true" ]; then
    # Fresh bundled-DB installs use the named-volume override on every platform.
    prepare_named_volume_compose_selection
    yt_info "Fresh install detected; using named-volume database storage."
  else
    # Default - use standard docker-compose.yml (existing bind-mounted install).
    unset COMPOSE_FILES
    yt_warn "Bind-mounted MariaDB data detected in ./database/."
    yt_detail "Docker Desktop on Windows/Mac and some NAS/virtualized filesystems can corrupt bind-mounted MariaDB during schema migrations."
    yt_detail "Linux native Docker hosts are usually unaffected. To migrate to a named volume, run:"
    yt_detail "  ./scripts/migrate-to-named-volume.sh"
  fi
fi

yt_section "Docker"

# shellcheck disable=SC2086 # COMPOSE_CMD and COMPOSE_FILES intentionally expand into command/flag words.
$COMPOSE_CMD $COMPOSE_FILES down
yt_success "Existing containers stopped."
