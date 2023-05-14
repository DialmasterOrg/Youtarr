#!/bin/bash

# Read the selected directory from the config file
selected_directory=$(grep selected_directory ./config/yt_dir.conf | cut -d'=' -f2)

docker rm -f youtubeplexarr

# Start the Docker container with the selected directory mounted
docker run --name youtubeplexarr -d -v $selected_directory:/usr/src/app/data -v /$(pwd)/config:/app/config -p 3087:3011 -e IN_DOCKER_CONTAINER=1 youtubeplexarr
