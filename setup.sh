#!/bin/bash

# Prompt the user to enter a directory path
echo "Please enter a directory path:"
read dir_path

# Check if the directory exists
if [ -d "$dir_path" ]; then
  echo "Directory exists. Saving to config file..."
  echo "selected_directory=$dir_path" > config/yt_dir.conf
  echo "Directory path saved to config file."
else
  echo "Directory does not exist. Please enter a valid directory path."
fi