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
for arg in "$@"; do
  case $arg in
    --no-auth)
      NO_AUTH=true
      shift
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--no-auth]"
      exit 1
      ;;
  esac
done

# Export AUTH_ENABLED for docker-compose if --no-auth flag is present
if [ "$NO_AUTH" = true ]; then
  export AUTH_ENABLED=false
  echo "⚠️  Authentication disabled via --no-auth flag"
  echo "⚠️  Do not expose Youtarr directly to the internet when auth is disabled; protect access with your own auth proxy"
fi

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

# Read the selected directory from the config file
youtubeOutputDirectory=$(python -c "import json; print(json.load(open('config/config.json'))['youtubeOutputDirectory'])" 2>/dev/null)

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

# Stop and remove existing containers (if any)
echo "Stopping existing containers..."
$COMPOSE_CMD -f docker-compose.dev.yml down

# Start the containers using docker-compose for development
echo "Starting Youtarr development environment..."
$COMPOSE_CMD -f docker-compose.dev.yml up -d

# Show the status
echo ""
echo "Youtarr development environment is starting up..."
echo "You can check the logs with: $COMPOSE_CMD -f docker-compose.dev.yml logs -f"
echo "To stop the development environment, run: $COMPOSE_CMD -f docker-compose.dev.yml down"
