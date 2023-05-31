#!/bin/bash

# Check if config.json exists, if not, copy from config.example.json
if [ ! -f "./config/config.json" ]; then
  echo "config.json not found. Creating from config.example.json..."
  cp "./config/config.example.json" "./config/config.json"
fi

touch "./config/complete.list"

function detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # MacOS
        echo "mac"
    elif [[ "$OSTYPE" == "cygwin" ]]; then
        # POSIX compatibility layer and Linux environment emulation for Windows
        echo "windows"
    elif [[ "$OSTYPE" == "msys" ]]; then
        # Lightweight shell and GNU utilities compiled for Windows (part of MinGW)
        echo "windows"
    elif [[ "$OSTYPE" == "win32" ]]; then
        # I'm not sure this can happen.
        echo "windows"
    else
        # Unknown.
        echo "unknown"
    fi
}

# Detect the host operating system
os=$(detect_os)

if [[ "$os" == "linux" ]]; then
    # If the host is Linux, set plexIP to the Docker host IP
    plex_ip="172.17.0.1"  # Adjust this value according to your Docker network setup
    echo "Linux detected as host OS, setting Plex IP for Docker to $plex_ip"
else
    # If the host is not Linux, use host.docker.internal
    plex_ip="host.docker.internal"
    echo "Linux not detected as host OS, setting Plex IP to $plex_ip"
fi

# Escape the plex_ip value to avoid any issues with sed
plex_ip_escaped=$(printf '%s\n' "$plex_ip" | sed 's:[][\/.^$*]:\\&:g')

# Use sed to replace the value of plexIP in config.json
sed -i "s/\"plexIP\": \".*\"/\"plexIP\": \"$plex_ip_escaped\"/" ./config/config.json


read -p "Would you like to (re)set your Youtube video file output directory? (Y/N) " confirm && [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]] || exit 1


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