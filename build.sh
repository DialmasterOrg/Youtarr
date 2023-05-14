#!/bin/bash

#Install dependencies for the base
npm install


# Install dependencies and build the client
cd client
npm install
npm run build

cd ..

# Build the Docker container
docker build -t youtubeplexarr .