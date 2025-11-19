#!/bin/bash

SHARED_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_SCRIPT_NAME=$(basename "$0")

# shellcheck source=scripts/_console_output.sh
source "$SHARED_SCRIPT_DIR/_console_output.sh"

print_usage() {
  cat <<EOF
Usage: $START_SCRIPT_NAME [--no-auth] [--debug] [--headless-auth] [--pull-latest]

  --no-auth          Disable authentication (only safe behind your own auth layer!)
  --debug            Set container log level to debug
  --headless-auth    Prompt for auth credentials to write into .env for headless setups
                     This will disable web UI credential management (credentials set here persist)
                     To update credentials later, edit .env directly and restart Youtarr
  --pull-latest      Pull latest git commits and Docker images before starting
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

yt_section "Docker"
yt_info "Stopping any existing Youtarr containers."
$COMPOSE_CMD down
yt_success "Existing containers stopped."
