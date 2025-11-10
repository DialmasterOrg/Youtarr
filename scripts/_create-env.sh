#!/bin/bash
# If .env file does not exist, create it from .env.example
# Automatically migrate "youtubeOutputDirectory" value from config.json to YOUTUBE_OUTPUT_DIR in .env
# If config.json does not exist:
#   - Prompt user for YOUTUBE_OUTPUT_DIR (with option to use default ./downloads)
#   - Prompt user to set their username and password, which will be written to .env as AUTH_PRESET_USERNAME and AUTH_PRESET_PASSWORD
ENV_FILE="./.env"
ENV_EXAMPLE_FILE="./.env.example"
CONFIG_FILE="./config/config.json"

CREATE_ENV_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/_console_output.sh
source "$CREATE_ENV_SCRIPT_DIR/_console_output.sh"

update_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp

  tmp=$(mktemp) || {
    yt_error "Failed to create temporary file while updating $file"
    exit 1
  }

  if awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    {
      if ($0 ~ ("^#*[[:space:]]*" key "=")) {
        print key "=" value;
        updated = 1;
        next;
      }
      print;
    }
    END {
      if (!updated) {
        print key "=" value;
      }
    }
  ' "$file" > "$tmp"; then
    mv "$tmp" "$file"
  else
    yt_error "Failed to update $key in $file"
    rm -f "$tmp"
    exit 1
  fi
}

quote_env_value() {
  local val="$1"
  val=${val//\\/\\\\}
  val=${val//\"/\\\"}
  printf '"%s"' "$val"
}

prompt_with_label() {
  local label="$1"
  printf "%-42s: " "$label"
}

# Check for old external-db.env and migrate to .env if needed
EXTERNAL_DB_ENV_FILE="./config/external-db.env"
if [ "$USE_EXTERNAL_DB" = "true" ] && [ -f "$EXTERNAL_DB_ENV_FILE" ]; then
  yt_section "External Database Configuration Migration"
  yt_info "Found existing external database configuration in config/external-db.env"
  yt_info "Database settings are now managed in .env file"
  printf "Migrate settings to .env? (Y/n): "
  read -r migrate_response
  migrate_response=${migrate_response:-Y}  # Default to Yes

  if [[ "$migrate_response" =~ ^[Yy] ]]; then
    # Create .env from .env.example if it doesn't exist
    if [ ! -f "$ENV_FILE" ]; then
      cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
      yt_success "Created .env from .env.example."
    fi

    # Source the old config file to load variables
    # Use a subshell to avoid polluting current environment
    eval "$(grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME|AUTH_PRESET_USERNAME|AUTH_PRESET_PASSWORD)=' "$EXTERNAL_DB_ENV_FILE" || true)"

    # Migrate DB variables if they are set
    if [ -n "$DB_HOST" ]; then
      update_env_var "DB_HOST" "$(quote_env_value "$DB_HOST")" "$ENV_FILE"
    fi
    if [ -n "$DB_PORT" ]; then
      update_env_var "DB_PORT" "$DB_PORT" "$ENV_FILE"
    fi
    if [ -n "$DB_USER" ]; then
      update_env_var "DB_USER" "$(quote_env_value "$DB_USER")" "$ENV_FILE"
    fi
    if [ -n "$DB_PASSWORD" ]; then
      update_env_var "DB_PASSWORD" "$(quote_env_value "$DB_PASSWORD")" "$ENV_FILE"
    fi
    if [ -n "$DB_NAME" ]; then
      update_env_var "DB_NAME" "$(quote_env_value "$DB_NAME")" "$ENV_FILE"
    fi
    if [ -n "$AUTH_PRESET_USERNAME" ]; then
      update_env_var "AUTH_PRESET_USERNAME" "$(quote_env_value "$AUTH_PRESET_USERNAME")" "$ENV_FILE"
    fi
    if [ -n "$AUTH_PRESET_PASSWORD" ]; then
      update_env_var "AUTH_PRESET_PASSWORD" "$(quote_env_value "$AUTH_PRESET_PASSWORD")" "$ENV_FILE"
    fi

    # Move old config to backup
    mv "$EXTERNAL_DB_ENV_FILE" "${EXTERNAL_DB_ENV_FILE}.bak"

    # Display migration results
    yt_success "Successfully migrated external database configuration to .env"
    yt_info "Migrated settings:"
    [ -n "$DB_HOST" ] && yt_detail "DB_HOST: $DB_HOST"
    [ -n "$DB_PORT" ] && yt_detail "DB_PORT: $DB_PORT"
    [ -n "$DB_USER" ] && yt_detail "DB_USER: $DB_USER"
    [ -n "$DB_PASSWORD" ] && yt_detail "DB_PASSWORD: $DB_PASSWORD"
    [ -n "$DB_NAME" ] && yt_detail "DB_NAME: $DB_NAME"
    [ -n "$AUTH_PRESET_USERNAME" ] && yt_detail "AUTH_PRESET_USERNAME: $AUTH_PRESET_USERNAME"
    [ -n "$AUTH_PRESET_PASSWORD" ] && yt_detail "AUTH_PRESET_PASSWORD: $(mask_password "$AUTH_PRESET_PASSWORD")"
    yt_info "Backup saved to: ${EXTERNAL_DB_ENV_FILE}.bak"
    yt_warn "IMPORTANT: Use './start-with-external-db.sh' to start with external database"
  else
    yt_info "Migration skipped. You can migrate later by re-running this script."
  fi
fi

# Does .env exist? If so we can exit now
if [ -f "$ENV_FILE" ]; then
  yt_info ".env already exists; skipping bootstrap."
  exit 0
fi

# Create .env from .env.example
cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
yt_success "Created .env from .env.example."

# Load from .env to check AUTH_ENABLED / HEADLESS_AUTH
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
AUTH_ENABLED=${AUTH_ENABLED:-true}
HEADLESS_AUTH=${HEADLESS_AUTH:-false}

EXISTING_CONFIG=false

# Check if config.json exists to migrate youtubeOutputDirectory
if [ -f "$CONFIG_FILE" ]; then
  EXISTING_CONFIG=true
  # Extract youtubeOutputDirectory value from config.json
  YOUTUBE_OUTPUT_DIR=$(grep -o '"youtubeOutputDirectory"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | \
    sed 's/.*"youtubeOutputDirectory"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | head -n 1)
  YOUTUBE_OUTPUT_DIR=$(echo "$YOUTUBE_OUTPUT_DIR" | xargs) # Trim whitespace

  if [ -n "$YOUTUBE_OUTPUT_DIR" ]; then
    update_env_var "YOUTUBE_OUTPUT_DIR" "$(quote_env_value "$YOUTUBE_OUTPUT_DIR")" "$ENV_FILE"
    yt_info "Migrated youtubeOutputDirectory from config.json into .env."
  fi
else
  yt_warn "config/config.json not found, skipping youtubeOutputDirectory migration."

  # Prompt for YouTube output directory
  yt_section "YouTube Output Directory"
  yt_info "Choose where downloaded YouTube videos will be stored."
  yt_detail "If you plan to link this to Plex, use the same directory as your Plex library."
  yt_detail "Press Enter to accept the default directory: ./downloads"

  while true; do
    read -r -p "Directory path [./downloads]: " dir_path

    # If empty (user pressed Enter), use default
    if [ -z "$dir_path" ]; then
      dir_path="./downloads"
      if [ ! -d "$dir_path" ]; then
        mkdir -p "$dir_path"
        yt_info "Created directory: $dir_path"
      fi
      update_env_var "YOUTUBE_OUTPUT_DIR" "$(quote_env_value "$dir_path")" "$ENV_FILE"
      yt_success "Using default directory: $dir_path"
      break
    fi

    if [ -d "$dir_path" ]; then
      yt_success "Directory verified: $dir_path"
      update_env_var "YOUTUBE_OUTPUT_DIR" "$(quote_env_value "$dir_path")" "$ENV_FILE"
      yt_info "Updated YOUTUBE_OUTPUT_DIR in .env."
      break
    else
      yt_error "Directory '$dir_path' does not exist."
      yt_detail "Enter a valid path, accept ./downloads by pressing Enter, or press Ctrl+C to exit."
    fi
  done
fi

if [ "$AUTH_ENABLED" = true ]; then
  if [ "$HEADLESS_AUTH" = true ]; then
      yt_section "Headless Authentication"
      yt_info "Provide initial admin credentials for this headless deployment."
      yt_detail "Values will be written to .env as AUTH_PRESET_USERNAME and AUTH_PRESET_PASSWORD."
      while true; do
      prompt_with_label "Initial admin username (3-32 characters) [admin]"
      read -r INITIAL_USERNAME
      INITIAL_USERNAME=${INITIAL_USERNAME:-admin}
      # Trim leading/trailing whitespace
      INITIAL_USERNAME=$(echo "$INITIAL_USERNAME" | xargs)
      if [ -z "$INITIAL_USERNAME" ]; then
          yt_error "Username cannot be blank."
          continue
      fi
      if [ ${#INITIAL_USERNAME} -gt 32 ]; then
          yt_error "Username must be 32 characters or fewer."
          continue
      fi
      # Must be 3 characters or more
      if [ ${#INITIAL_USERNAME} -lt 3 ]; then
          yt_error "Username must be 3 characters or more."
          continue
      fi
      break
      done
      # Prompt for password and confirmation with validation
      while true; do
      prompt_with_label "Admin password (8-64 characters)"
      read -r INITIAL_PASSWORD
      prompt_with_label "Confirm password"
      read -r INITIAL_PASSWORD_CONFIRM
      printf '\n'
      if [ "$INITIAL_PASSWORD" != "$INITIAL_PASSWORD_CONFIRM" ]; then
          yt_error "Passwords do not match. Please try again."
          continue
      fi
      PASS_LENGTH=${#INITIAL_PASSWORD}
      if [ $PASS_LENGTH -lt 8 ]; then
          yt_error "Password must be at least 8 characters."
          continue
      fi
      if [ $PASS_LENGTH -gt 64 ]; then
          yt_error "Password must be 64 characters or fewer."
          continue
      fi
      break
      done
      update_env_var "AUTH_PRESET_USERNAME" "$(quote_env_value "$INITIAL_USERNAME")" "$ENV_FILE"
      update_env_var "AUTH_PRESET_PASSWORD" "$(quote_env_value "$INITIAL_PASSWORD")" "$ENV_FILE"
      yt_success "Admin credentials stored in .env."
      yt_info "Username and password are now managed via .env and cannot be changed via the web UI in headless auth mode."
  else
    if [ "$EXISTING_CONFIG" = false ]; then
      yt_info "Authentication is enabled. You'll be prompted to create credentials on first web login (localhost required)."
      yt_info "Your authentication settings will be saved in config/config.json after first login and can be changed via the web UI."
      yt_detail "For headless setups, set AUTH_PRESET_USERNAME and AUTH_PRESET_PASSWORD manually in .env."
    else
      yt_info "Authentication is enabled. Existing config.json will retain existing login credentials."
      yt_detail "If you wish to change credentials, you can do so via the web UI after logging in."
      yt_detail "If you have forgotten your login credentials, stop Youtarr, remove 'passwordHash' and 'username' from config.json, then restart Youtarr to reset."
    fi
  fi
fi