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

# Bring up the stack using the selected compose files (COMPOSE_FILES is set in _shared_start_tasks.sh)
# shellcheck disable=SC2086 # COMPOSE_CMD and COMPOSE_FILES intentionally expand into command/flag words.
$COMPOSE_CMD $COMPOSE_FILES up -d

yt_section "Environment"
yt_info "Youtarr services are starting."
yt_detail "Follow logs : $COMPOSE_CMD logs -f"
yt_detail "Stop stack  : $COMPOSE_CMD down"
