#!/bin/bash

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

# Build the Docker container
docker build --no-cache -t youtarr-dev .