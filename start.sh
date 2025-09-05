#!/bin/bash

git pull

# Read the selected directory from the config file
# Read the selected directory from the config file
youtubeOutputDirectory=$(python -c "import json; print(json.load(open('config/config.json'))['youtubeOutputDirectory'])")

docker rm -f youtarr

# Convert the windows path to Unix path and remove trailing whitespaces
## ONLY NEEDED IF RUNNING IN GIT BASH!!!
if [[ "$OSTYPE" == "msys" ]]; then
  # On windows, in git bash, the user would have selected a directory like /q/MyYoutubeDir
  # but it needs to be passed to the docker command as //q/MyYoutubeDir
  # Just prepend with an a extra / to make it work
  youtubeOutputDirectory="/$youtubeOutputDirectory"
fi

docker pull dialmaster/youtarr:v1.17.22

# Start the Docker container with the selected directory mounted
docker run --name youtarr -d -v $youtubeOutputDirectory:/usr/src/app/data -v /$(pwd)/server/images:/app/server/images -v /$(pwd)/config:/app/config -v /$(pwd)/jobs:/app/jobs -v /$(pwd)/migrations:/app/migrations -v /$(pwd)/database:/var/lib/mysql -p 3087:3011 -p 3321:3306 -e IN_DOCKER_CONTAINER=1 --restart unless-stopped dialmaster/youtarr:v1.17.22
