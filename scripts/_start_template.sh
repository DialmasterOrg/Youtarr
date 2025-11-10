#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/_console_output.sh
source "$SCRIPT_DIR/_console_output.sh"

yt_banner "Youtarr Startup"

if [ "$DEV_MODE" == "true" ]; then
  export YOUTARR_IMAGE=youtarr-dev:latest
  export LOG_LEVEL=info
  yt_info "Running in development mode."
  yt_detail "Docker image : $YOUTARR_IMAGE"
  yt_detail "Log level    : info"
  if [[ -z "$(docker images -q "$YOUTARR_IMAGE" 2> /dev/null)" ]]; then
    yt_error "Development image '$YOUTARR_IMAGE' not found. Build it with './scripts/build-dev-image.sh' before continuing."
    exit 1
  else
    yt_success "Development image verified."
  fi
else
  export YOUTARR_IMAGE=dialmaster/youtarr:latest
  export LOG_LEVEL=warn
  yt_info "Running in production mode."
  yt_detail "Docker image : $YOUTARR_IMAGE"
  yt_detail "Log level    : warn"
fi

# shellcheck source=scripts/_shared_start_tasks.sh
source "$SCRIPT_DIR/_shared_start_tasks.sh" "$@"

if [ "$USE_EXTERNAL_DB" == "true" ]; then
  # Only start the youtarr service.
  COMPOSE_ARGS="-f docker-compose.external-db.yml up -d"
else
  COMPOSE_ARGS="-f docker-compose.yml up -d"
fi

$COMPOSE_CMD $COMPOSE_ARGS

yt_section "Environment"
yt_info "Youtarr services are starting."
yt_detail "Follow logs : $COMPOSE_CMD logs -f"
yt_detail "Stop stack  : $COMPOSE_CMD down"
