#!/bin/bash

# Read the selected directory from the config file
# Read the selected directory from the config file
youtubeOutputDirectory=$(python -c "import json; print(json.load(open('config/config.json'))['youtubeOutputDirectory'])")

# Do not display errors from the following command
# If the container does not exist, it will return an error, but it is not a problem
docker rm -f youtarr 2> /dev/null

# Convert the windows path to Unix path and remove trailing whitespaces
## ONLY NEEDED IF RUNNING IN GIT BASH!!!
if [[ "$OSTYPE" == "msys" ]]; then
  # On windows, in git bash, the user would have selected a directory like /q/MyYoutubeDir
  # but it needs to be passed to the docker command as //q/MyYoutubeDir
  # Just prepend with an a extra / to make it work
  youtubeOutputDirectory="/$youtubeOutputDirectory"
fi

# Start the Docker container with the selected directory mounted
docker run --name youtarr-dev -d -v $youtubeOutputDirectory:/usr/src/app/data -v /$(pwd)/config:/app/config -v /$(pwd)/server/images:/app/server/images -v /$(pwd)/jobs:/app/jobs -v /$(pwd)/migrations:/app/migrations -v /$(pwd)/database:/var/lib/mysql -p 3087:3011 -p 3321:3321 -e IN_DOCKER_CONTAINER=1 youtarr-dev
