#!/bin/bash

# Read the selected directory from the config file
# Read the selected directory from the config file
youtubeOutputDirectory=$(python -c "import json; print(json.load(open('config/config.json'))['youtubeOutputDirectory'])")

docker rm -f youtubeplexarr

# Start the Docker container with the selected directory mounted
docker run --name youtubeplexarr -d -v $youtubeOutputDirectory:/usr/src/app/data -v /$(pwd)/config:/app/config -p 3087:3011 -e IN_DOCKER_CONTAINER=1 youtubeplexarr
