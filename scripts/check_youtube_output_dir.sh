#!/bin/bash
# Verifies that the YouTube output directory exists and is readable and writeable
# Returns error and exits if not

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

# shellcheck source=scripts/_console_output.sh
source "$SCRIPT_DIR/_console_output.sh"

yt_section "YouTube Output Directory"

if [ ! -f "$ENV_FILE" ]; then
  yt_error ".env not found; run the start script to initialize configuration."
  exit 1
fi

# Read the selected directory from the .env file (handle optional quotes)
youtubeOutputDirectory=$(sed -n 's/^YOUTUBE_OUTPUT_DIR=//p' "$ENV_FILE" | head -n 1)
youtubeOutputDirectory=${youtubeOutputDirectory#\"}
youtubeOutputDirectory=${youtubeOutputDirectory%\"}

if [ -z "$youtubeOutputDirectory" ]; then
  yt_error "YOUTUBE_OUTPUT_DIR is not set in .env."
  yt_detail "Set YOUTUBE_OUTPUT_DIR in .env to a valid path, then re-run the start script."
  exit 1
fi

CHECK_DIR="$youtubeOutputDirectory"
yt_info "Validating directory: $CHECK_DIR"

if [ ! -d "$CHECK_DIR" ]; then
  yt_error "Directory '$CHECK_DIR' does not exist."
  yt_detail "Create the directory or update YOUTUBE_OUTPUT_DIR in .env to a valid location."
  exit 1
fi

if [ ! -r "$CHECK_DIR" ]; then
  yt_error "Directory '$CHECK_DIR' is not readable."
  yt_detail "Adjust filesystem permissions or choose a different directory."
  exit 1
fi

if ! touch "$CHECK_DIR/.write_test" 2>/dev/null; then
  yt_error "Directory '$CHECK_DIR' is not writable."
  yt_detail "Ensure the current user can write to this directory."
  exit 1
fi
rm -f "$CHECK_DIR/.write_test"

yt_success "YouTube output directory verified."
yt_detail "Downloaded videos will be stored here. Edit .env to change the location."
