#!/bin/bash

# Function to check if docker compose (v2) or docker-compose (v1) is available
get_compose_command() {
    if docker compose version &>/dev/null; then
        echo "docker compose"
    elif docker-compose version &>/dev/null; then
        echo "docker-compose"
    else
        echo ""  # Return empty string if neither is available
    fi
}

echo "Stopping Youtarr..."

# First, try to stop and remove the old single-container version if it exists
if docker ps -a --format '{{.Names}}' | grep -q '^youtarr$'; then
    echo "Found old single-container Youtarr, stopping and removing it..."
    docker stop youtarr 2>/dev/null
    docker rm youtarr 2>/dev/null
    echo "Old single-container Youtarr has been removed."
fi

# Now handle the docker-compose version
COMPOSE_CMD=$(get_compose_command)

if [ -n "$COMPOSE_CMD" ]; then
    # Docker Compose is available
    echo "Using compose command: $COMPOSE_CMD"
    
    # Set a dummy value for YOUTUBE_OUTPUT_DIR since it's not needed for stopping
    export YOUTUBE_OUTPUT_DIR="/tmp"
    
    # Check if docker-compose containers are running
    if $COMPOSE_CMD ps --services 2>/dev/null | grep -q 'youtarr'; then
        echo "Stopping Youtarr docker-compose containers..."
        $COMPOSE_CMD down
        echo "Youtarr has been stopped."
    else
        # Even if no services are listed, try to bring down any orphaned containers
        $COMPOSE_CMD down 2>/dev/null
    fi
else
    # Docker Compose is not available, but we already handled the single container above
    if ! docker ps -a --format '{{.Names}}' | grep -q '^youtarr$'; then
        echo "Docker Compose not found and no Youtarr containers are running."
    fi
fi

echo "Done."