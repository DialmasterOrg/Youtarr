#!/bin/bash

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

# Parse command line arguments
NO_AUTH=false
USE_EXTERNAL_DB=false
COMPOSE_FILE_ARGS=("-f" "docker-compose.yml")
DB_ENV_FILE="./config/external-db.env"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-auth)
      NO_AUTH=true
      shift
      ;;
    --external-db)
      USE_EXTERNAL_DB=true
      COMPOSE_FILE_ARGS=("-f" "docker-compose.external-db.yml")
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--no-auth] [--external-db]"
      exit 1
      ;;
  esac
done

if [ "$USE_EXTERNAL_DB" = true ] && [ ! -f "$DB_ENV_FILE" ]; then
  echo ""
  echo "==============================================="
  echo "ERROR: External DB configuration missing!"
  echo "==============================================="
  echo "Expected environment file: $DB_ENV_FILE"
  echo "Create it from config/external-db.env.example and set"
  echo "DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME."
  echo "==============================================="
  exit 1
fi

if [ "$USE_EXTERNAL_DB" = true ]; then
  set -a
  # shellcheck disable=SC1090
  source "$DB_ENV_FILE"
  set +a

  REQUIRED_VARS=(DB_HOST DB_USER DB_PASSWORD)
  for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
      echo ""
      echo "==============================================="
      echo "ERROR: Missing required variable $var in $DB_ENV_FILE"
      echo "==============================================="
      exit 1
    fi
  done

  export DB_PORT=${DB_PORT:-3306}
  export DB_NAME=${DB_NAME:-youtarr}

  echo "External database target: ${DB_HOST}:${DB_PORT} (schema: ${DB_NAME})"
fi

# Export AUTH_ENABLED for docker-compose if --no-auth flag is present
if [ "$NO_AUTH" = true ]; then
  export AUTH_ENABLED=false
  echo "⚠️  Authentication disabled via --no-auth flag"
  echo "⚠️  Do not expose Youtarr directly to the internet when auth is disabled; protect access with your own auth proxy"
fi

# Track whether preset credentials were provided before running this script
PRESET_SUPPLIED_ALREADY=false
if [ -n "${AUTH_PRESET_USERNAME:-}" ] && [ -n "${AUTH_PRESET_PASSWORD:-}" ]; then
  PRESET_SUPPLIED_ALREADY=true
fi

# Pull latest changes
git pull

# Check if config file exists
if [ ! -f "config/config.json" ]; then
  echo ""
  echo "==============================================="
  echo "ERROR: Configuration file not found!"
  echo "==============================================="
  echo "Please run ./setup.sh first to configure Youtarr."
  echo "==============================================="
  exit 1
fi

# Read the selected directory from the config file using shell commands
# Extract the value between quotes after youtubeOutputDirectory
youtubeOutputDirectory=$(grep '"youtubeOutputDirectory"' config/config.json | sed 's/.*"youtubeOutputDirectory"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

# Trim whitespace
youtubeOutputDirectory=$(echo "$youtubeOutputDirectory" | xargs)

# Check if the directory was successfully read and is not empty
if [ -z "$youtubeOutputDirectory" ] || [ "$youtubeOutputDirectory" == "" ] || [ "$youtubeOutputDirectory" == "null" ]; then
  echo ""
  echo "==============================================="
  echo "ERROR: YouTube output directory not configured!"
  echo "==============================================="
  echo "Please run ./setup.sh to configure the download directory."
  echo "==============================================="
  exit 1
fi

# Convert the windows path to Unix path and remove trailing whitespaces
## ONLY NEEDED IF RUNNING IN GIT BASH!!!
if [[ "$OSTYPE" == "msys" ]]; then
  # On windows, in git bash, the user would have selected a directory like /q/MyYoutubeDir
  # but it needs to be passed to the docker command as //q/MyYoutubeDir
  # Just prepend with an a extra / to make it work
  youtubeOutputDirectory="/$youtubeOutputDirectory"
fi

# Validate that the directory exists and is readable
# Note: We check the original path for Unix/Mac, and handle Windows path separately
if [[ "$OSTYPE" == "msys" ]]; then
  # For Windows/Git Bash, check without the extra slash
  CHECK_DIR="${youtubeOutputDirectory:1}"
else
  CHECK_DIR="$youtubeOutputDirectory"
fi

if [ ! -d "$CHECK_DIR" ]; then
  echo ""
  echo "==============================================="
  echo "ERROR: YouTube output directory does not exist!"
  echo "==============================================="
  echo "Directory: $CHECK_DIR"
  echo ""
  echo "Please ensure the directory exists or run ./setup.sh"
  echo "to configure a different directory."
  echo "==============================================="
  exit 1
fi

if [ ! -r "$CHECK_DIR" ]; then
  echo ""
  echo "==============================================="
  echo "ERROR: YouTube output directory is not readable!"
  echo "==============================================="
  echo "Directory: $CHECK_DIR"
  echo ""
  echo "Please check directory permissions or run ./setup.sh"
  echo "to configure a different directory."
  echo "==============================================="
  exit 1
fi

echo "YouTube output directory verified: $CHECK_DIR"

# Export the YouTube output directory for docker-compose
export YOUTUBE_OUTPUT_DIR="$youtubeOutputDirectory"

# Determine if authentication is already configured in config.json
passwordHash=$(grep -o '"passwordHash"[[:space:]]*:[[:space:]]*"[^"]*"' config/config.json 2>/dev/null | \
  sed 's/.*"passwordHash"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | head -n 1)
passwordHash=$(echo "$passwordHash" | xargs)
HAS_PASSWORD_HASH=""
if [ -n "$passwordHash" ]; then
  HAS_PASSWORD_HASH="yes"
fi

AUTH_PRESET_FROM_PROMPT=false

if [ "$NO_AUTH" != true ] && [ -z "$HAS_PASSWORD_HASH" ]; then
  if [ -n "${AUTH_PRESET_USERNAME:-}" ] && [ -n "${AUTH_PRESET_PASSWORD:-}" ]; then
    echo "Using preset credentials from environment variables."
  elif [ -n "${AUTH_PRESET_USERNAME:-}" ] || [ -n "${AUTH_PRESET_PASSWORD:-}" ]; then
    echo "⚠️  Ignoring partial preset credentials. Both AUTH_PRESET_USERNAME and AUTH_PRESET_PASSWORD must be set." >&2
    unset AUTH_PRESET_USERNAME
    unset AUTH_PRESET_PASSWORD
  else
    echo ""
    echo "================================================================"
    echo "No admin credentials detected. Let's set them up now."
    echo "These values will be written to config/config.json as soon as"
    echo "the container starts. You can change them later from the UI."
    echo "================================================================"

    # Prompt for username (default to admin) and validate length
    while true; do
      read -r -p "Initial admin username [admin]: " INITIAL_USERNAME
      INITIAL_USERNAME=${INITIAL_USERNAME:-admin}
      # Trim leading/trailing whitespace
      INITIAL_USERNAME=$(echo "$INITIAL_USERNAME" | xargs)
      if [ -z "$INITIAL_USERNAME" ]; then
        echo "Username cannot be blank."
        continue
      fi
      if [ ${#INITIAL_USERNAME} -gt 32 ]; then
        echo "Username must be 32 characters or fewer."
        continue
      fi
      break
    done

    # Prompt for password and confirmation with validation
    while true; do
      read -r -s -p "Initial admin password (min 8 chars): " INITIAL_PASSWORD
      echo ""
      read -r -s -p "Confirm password: " INITIAL_PASSWORD_CONFIRM
      echo ""

      if [ "$INITIAL_PASSWORD" != "$INITIAL_PASSWORD_CONFIRM" ]; then
        echo "Passwords do not match. Please try again."
        continue
      fi

      PASS_LENGTH=${#INITIAL_PASSWORD}
      if [ $PASS_LENGTH -lt 8 ]; then
        echo "Password must be at least 8 characters."
        continue
      fi
      if [ $PASS_LENGTH -gt 64 ]; then
        echo "Password must be 64 characters or fewer."
        continue
      fi

      break
    done

    export AUTH_PRESET_USERNAME="$INITIAL_USERNAME"
    export AUTH_PRESET_PASSWORD="$INITIAL_PASSWORD"
    AUTH_PRESET_FROM_PROMPT=true

    echo "Preset credentials captured. They will be applied on container startup."
    echo "Initial admin username: $INITIAL_USERNAME"
  fi
fi

# Pull the latest images
echo "Pulling latest images..."
if [ "$USE_EXTERNAL_DB" = true ]; then
  $COMPOSE_CMD "${COMPOSE_FILE_ARGS[@]}" pull youtarr
else
  $COMPOSE_CMD pull
fi

# Stop and remove existing containers (if any)
echo "Stopping existing containers..."
if [ "$USE_EXTERNAL_DB" = true ]; then
  $COMPOSE_CMD "${COMPOSE_FILE_ARGS[@]}" down
else
  $COMPOSE_CMD down
fi

# Start the containers using docker-compose
echo "Starting Youtarr with docker-compose..."
if [ "$USE_EXTERNAL_DB" = true ]; then
  $COMPOSE_CMD "${COMPOSE_FILE_ARGS[@]}" up -d youtarr
else
  $COMPOSE_CMD up -d
fi

# Check for auth setup after starting containers (skip if presets were supplied)
if [ "$NO_AUTH" != true ] && [ -z "$HAS_PASSWORD_HASH" ] && [ "$AUTH_PRESET_FROM_PROMPT" != true ] && [ "$PRESET_SUPPLIED_ALREADY" != true ] && { [ -z "${AUTH_PRESET_USERNAME:-}" ] || [ -z "${AUTH_PRESET_PASSWORD:-}" ]; }; then
  echo ""
  echo "================================================================"
  echo "⚠️  IMPORTANT: FIRST-TIME SETUP REQUIRED"
  echo "================================================================"
  echo "Youtarr no longer requires Plex for authentication!"
  echo ""
  echo "➜ You MUST access from the SERVER ITSELF at:"
  echo "  http://localhost:3087"
  echo ""
  echo "⚠️  Setup is BLOCKED from remote connections for security"
  echo ""
  echo "🖥️  RUNNING ON A HEADLESS/REMOTE SERVER?"
  echo "   Use SSH port forwarding from your local machine:"
  echo "   ssh -L 3087:localhost:3087 username@server-ip"
  echo "   Then open http://localhost:3087 in your browser"
  echo ""
  echo "This is a one-time setup. After creating your password,"
  echo "you can access Youtarr from anywhere."
  echo ""
  echo "Your Plex integration (if configured) will continue to work"
  echo "for library refreshes."
  echo ""
  echo "All your existing channels, videos and configuration will be retained."
  echo "================================================================"
fi

# Show the status
echo ""
echo "Youtarr is starting up..."
echo "You can check the logs with: $COMPOSE_CMD logs -f"
echo "To stop Youtarr, run: ./stop.sh"

if [ "$AUTH_PRESET_FROM_PROMPT" = true ]; then
  unset AUTH_PRESET_USERNAME
  unset AUTH_PRESET_PASSWORD
  unset INITIAL_USERNAME
  unset INITIAL_PASSWORD
  unset INITIAL_PASSWORD_CONFIRM
fi
