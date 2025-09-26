#!/bin/bash

# Flag to track if this is initial setup
INITIAL_SETUP=false

# Check if config.json exists, if not, copy from config.example.json
if [ ! -f "./config/config.json" ]; then
  echo "config.json not found. Creating from config.example.json..."
  cp "./config/config.example.json" "./config/config.json"
  INITIAL_SETUP=true
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

# Check if youtubeOutputDirectory is already set in config
# Extract the value between quotes after youtubeOutputDirectory
CURRENT_DIR=$(grep '"youtubeOutputDirectory"' ./config/config.json | sed 's/.*"youtubeOutputDirectory"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

# Trim whitespace from CURRENT_DIR
CURRENT_DIR=$(echo "$CURRENT_DIR" | xargs)

# Determine if we need to set the directory
SHOULD_SET_DIR=false

if [ -z "$CURRENT_DIR" ] || [ "$CURRENT_DIR" == "" ] || [ "$CURRENT_DIR" == "null" ]; then
  # Directory not set - this is required
  echo ""
  echo "==============================================="
  echo "YouTube video output directory must be configured."
  echo "==============================================="
  SHOULD_SET_DIR=true
else
  # Directory already set - ask if they want to change it
  echo ""
  echo "==============================================="
  echo "Current YouTube video output directory:"
  echo "  $CURRENT_DIR"
  echo "==============================================="
  read -p "Would you like to change your YouTube video output directory? (Y/N) " confirm
  if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
    SHOULD_SET_DIR=true
  fi
fi

if [ "$SHOULD_SET_DIR" = true ]; then
  # Loop until a valid directory is provided
  while true; do
    echo "Please enter the directory path to store your downloaded YouTube videos (eg, "/mnt/c/Youtube_videos/"):"
    echo "If you plan to link this to Plex, you should use the same directory that you will be using for the Plex library."
    read dir_path

    # Check if the directory exists
    if [ -d "$dir_path" ]; then
      echo "Directory verified: $dir_path"
      echo "Saving to config file..."

      # Escape the user input to avoid any issues with sed
      dir_path_escaped=$(printf '%s\n' "$dir_path" | sed 's:[][\/.^$*]:\\&:g')

      # Use sed to replace the value of youtubeOutputDirectory in config.json
      sed -i "s/\"youtubeOutputDirectory\": \".*\"/\"youtubeOutputDirectory\": \"$dir_path_escaped\"/" ./config/config.json

      echo ""
      echo "==============================================="
      echo "Configuration saved successfully!"
      echo "==============================================="
      if [ "$INITIAL_SETUP" = true ]; then
        echo "Initial configuration complete!"
        echo "Configuration file written."
        echo ""
        echo "Next steps:"
        echo "1. Start the server: ./start.sh"
        echo "2. Access Youtarr at: http://localhost:3087"
        echo "3. Complete initial setup (create admin account)"
        echo ""
        echo "Note: Initial admin setup MUST be done from localhost"
      else
        echo "Configuration updated."
        echo "Remember to restart Youtarr for changes to take effect."
      fi
      echo "==============================================="
      break
    else
      echo ""
      echo "Error: Directory '$dir_path' does not exist."
      echo "Please enter a valid directory path, or press Ctrl+C to exit."
      echo ""
    fi
  done
else
  echo "Keeping existing directory configuration."
  echo "Setup complete."
fi