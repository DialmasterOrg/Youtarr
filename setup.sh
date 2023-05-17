#!/bin/bash

# Check if config.json exists, if not, copy from config.example.json
if [ ! -f "./config/config.json" ]; then
  echo "config.json not found. Creating from config.example.json..."
  cp "./config/config.example.json" "./config/config.json"
fi

# Prompt the user to enter a directory path
echo "Please enter the directory path to store the videos (you can change this later):"
read dir_path

# Check if the directory exists
if [ -d "$dir_path" ]; then
  echo "Directory exists. Saving to config file..."
  python -c "import json; config = json.load(open('./config/config.json')); config['youtubeOutputDirectory'] = '$dir_path'; json.dump(config, open('./config/config.json', 'w'), indent=4)"
  echo "Directory path saved to config file."
else
  echo "Directory does not exist. Please enter a valid directory path."
fi

# Install dependencies in root directory
echo "Installing root directory dependencies..."
npm i

# Install dependencies in client directory
echo "Installing client directory dependencies..."
cd client
npm i
cd ..