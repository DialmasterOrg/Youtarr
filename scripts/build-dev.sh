#!/bin/bash
IMAGE_NAME="youtarr-dev:latest"
IMAGE_LABEL="youtarr.image=youtarr-dev"

echo "Building development Docker image..."
echo "Note: If you want to install dependencies, run with --install-deps, may be required on first build!"
echo "If you want to build without caching, run with --no-cache, this will take much longer, but will download a new yt-dlp binary."
echo "In Github Actions, there will never be a cache, so it will always get a new yt-dlp binary."

# Check if --install-deps was passed as an argument
if [ "$1" = "--install-deps" ]
then
  # Install dependencies for the base
  npm install

  # Install dependencies and build the client
  cd client
  npm install
  cd ..
fi

# Always build the client and Docker container
cd client
npm run build
cd ..

# Build the Docker container -- do we need --no-cache?
BUILD_ARGS=(--label "$IMAGE_LABEL" -t "$IMAGE_NAME")
if [ "$1" = "--no-cache" ]; then
  BUILD_ARGS+=(--no-cache)
fi
docker build "${BUILD_ARGS[@]}" .

# Prune dangling dev images so repeats don't pile up
if [ -z "$SKIP_DEV_IMAGE_PRUNE" ]; then
  echo ""
  echo "Cleaning up old dangling dev images..."
  docker image prune --force --filter "label=$IMAGE_LABEL"
else
  echo ""
  echo "Skipping dev image prune because SKIP_DEV_IMAGE_PRUNE is set."
fi

echo ""
echo "Development image built successfully!"
echo "To start the development environment, run: ./scripts/start-dev.sh"
