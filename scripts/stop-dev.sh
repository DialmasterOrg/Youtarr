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

# Set a dummy value for YOUTUBE_OUTPUT_DIR since it's not needed for stopping
export YOUTUBE_OUTPUT_DIR="/tmp"

# Stop the development containers using docker-compose
echo "Stopping Youtarr development environment..."
$COMPOSE_CMD -f docker-compose.dev.yml down

echo "Youtarr development environment has been stopped."