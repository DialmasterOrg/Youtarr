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

# Pull the latest images
echo "Pulling latest images..."
$COMPOSE_CMD pull

# Stop and remove existing containers (if any)
echo "Stopping existing containers..."
$COMPOSE_CMD down

# Start the containers using docker-compose
echo "Starting Youtarr with docker-compose..."
$COMPOSE_CMD up -d

# Check for auth setup after starting containers (skip if --no-auth was used)
if [ "$NO_AUTH" != true ] && ! grep -q "passwordHash" config/config.json 2>/dev/null; then
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
