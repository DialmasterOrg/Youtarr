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
echo "Using compose command: $COMPOSE_CMD"

# Read the selected directory from the config file
youtubeOutputDirectory=$(python -c "import json; print(json.load(open('config/config.json'))['youtubeOutputDirectory'])")

# Convert the windows path to Unix path and remove trailing whitespaces
## ONLY NEEDED IF RUNNING IN GIT BASH!!!
if [[ "$OSTYPE" == "msys" ]]; then
  # On windows, in git bash, the user would have selected a directory like /q/MyYoutubeDir
  # but it needs to be passed to the docker command as //q/MyYoutubeDir
  # Just prepend with an a extra / to make it work
  youtubeOutputDirectory="/$youtubeOutputDirectory"
fi

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