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

  # Escape the user input to avoid any issues with sed
  dir_path_escaped=$(printf '%s\n' "$dir_path" | sed 's:[][\/.^$*]:\\&:g')

  # Use sed to replace the value of youtubeOutputDirectory in config.json
  sed -i "s/\"youtubeOutputDirectory\": \".*\"/\"youtubeOutputDirectory\": \"$dir_path_escaped\"/" ./config/config.json

  echo "Directory path saved to config file."
else
  echo "Directory does not exist. Please enter a valid directory path."
fi