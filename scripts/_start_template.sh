#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/_console_output.sh
source "$SCRIPT_DIR/_console_output.sh"

# Pre-parse --dev flag before image selection (full arg parsing happens in _shared_start_tasks.sh)
for arg in "$@"; do
  if [ "$arg" == "--dev" ]; then
    USE_DEV_IMAGE=true
    break
  fi
done

yt_banner "Youtarr Startup"

if [ "$DEV_MODE" == "true" ]; then
  export YOUTARR_IMAGE=youtarr-dev:latest
  export LOG_LEVEL=info
  yt_info "Running in local development mode."
  yt_detail "Docker image : $YOUTARR_IMAGE"
  yt_detail "Log level    : info"
  if [[ -z "$(docker images -q "$YOUTARR_IMAGE" 2> /dev/null)" ]]; then
    yt_error "Development image '$YOUTARR_IMAGE' not found. Build it with './scripts/build-dev.sh' before continuing."
    exit 1
  else
    yt_success "Development image verified."
  fi
elif [ "$USE_DEV_IMAGE" == "true" ]; then
  export YOUTARR_IMAGE=dialmaster/youtarr:dev-latest
  export LOG_LEVEL="${LOG_LEVEL:-info}"
  yt_warn "⚠️  Using bleeding-edge dev image. This contains unreleased features and may be unstable."
  yt_detail "Docker image : $YOUTARR_IMAGE"
  yt_detail "For stable releases, run without --dev flag."
else
  # Use .env value if set, otherwise default to latest stable
  export YOUTARR_IMAGE="${YOUTARR_IMAGE:-dialmaster/youtarr:latest}"
  export LOG_LEVEL="${LOG_LEVEL:-info}"
  yt_info "Running in production mode."
  yt_detail "Docker image : $YOUTARR_IMAGE"
  yt_detail "Log level    : $LOG_LEVEL"
fi

# shellcheck source=scripts/_shared_start_tasks.sh
source "$SCRIPT_DIR/_shared_start_tasks.sh" "$@"

# Detect ARM architecture (Apple Silicon, Raspberry Pi, etc.)
ARCH=$(uname -m)
IS_ARM=false
if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
  IS_ARM=true
  yt_info "Detected ARM architecture ($ARCH) - using named volume for MariaDB"
fi

if [ "$USE_EXTERNAL_DB" == "true" ]; then
  # Only start the youtarr service.
  COMPOSE_ARGS="-f docker-compose.external-db.yml up -d"
else
  if [ "$IS_ARM" == "true" ]; then
    # Use ARM override to switch to named volume (works around virtiofs bugs)
    COMPOSE_ARGS="-f docker-compose.yml -f docker-compose.arm.yml up -d"
  else
    COMPOSE_ARGS="-f docker-compose.yml up -d"
  fi
fi

$COMPOSE_CMD $COMPOSE_ARGS

yt_section "Environment"
yt_info "Youtarr services are starting."
yt_detail "Follow logs : $COMPOSE_CMD logs -f"
yt_detail "Stop stack  : $COMPOSE_CMD down"
