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

function validate_plex_endpoint() {
  local address="$1"
  local port="${2:-32400}"
  local url="http://$address:$port/identity"

  if command -v curl >/dev/null 2>&1; then
    if curl --connect-timeout 5 --max-time 8 -s "$url" >/dev/null 2>&1; then
      echo "Plex URL validated at $url via curl!"
      return 0
    else
      return 1
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget --tries=1 --timeout=5 -qO - "$url" >/dev/null 2>&1; then
      echo "Plex URL validated at $url via wget!"
      return 0
    else
      return 1
    fi
  else
    echo "curl and wget do not appear to be available. Unable to validate Plex URL."
    return 0
  fi
}

function prompt_plex_details() {
  local default_ip="$1"
  local manual_prompt="$2"

  while true; do
    local ip_input=""

    if [[ -n "$default_ip" ]]; then
      read -p "Plex server IP [press Enter to use $default_ip]: " ip_input
      if [[ -z "$ip_input" ]]; then
        plex_ip="$default_ip"
      else
        plex_ip="$ip_input"
        default_ip="$ip_input"
      fi
    else
      read -p "$manual_prompt" ip_input
      plex_ip="$ip_input"
    fi

    if [[ -z "$plex_ip" ]]; then
      echo "Plex server IP cannot be empty. Please enter a value."
      continue
    fi

    read -p "Plex server port [press Enter to use 32400]: " port_input
    port_input=${port_input:-32400}

    if ! [[ $port_input =~ ^[0-9]+$ ]]; then
      echo "Invalid port number. Please enter a numeric value between 1 and 65535."
      continue
    fi

    local port_num=$((10#$port_input))
    if (( port_num < 1 || port_num > 65535 )); then
      echo "Invalid port number. Please enter a value between 1 and 65535."
      continue
    fi

    plex_port="$port_num"

    if validate_plex_endpoint "$plex_ip" "$plex_port"; then
      break
    fi

    echo "Warning: Could not reach Plex at http://$plex_ip:$plex_port/identity."
    echo "Ensure Plex is running and reachable from this environment."
    read -p "Press Enter to try different values, or type 'skip' to continue with these settings: " retry_choice
    if [[ "$retry_choice" =~ ^[sS](kip)?$ ]]; then
      break
    fi
  done
}

# Ask whether to configure Plex settings now
configure_plex=true
read -p "Would you like to configure Plex connectivity now? (Y/n) " configure_plex_choice
if [[ "$configure_plex_choice" =~ ^[nN](o)?$ ]]; then
  configure_plex=false
fi

plex_ip=""
plex_port='32400'

if [[ "$configure_plex" == true ]]; then
  # Detect the host operating system
  os=$(detect_os)

  is_wsl=false
  if [[ -f /proc/sys/kernel/osrelease ]] && grep -qi microsoft /proc/sys/kernel/osrelease; then
    is_wsl=true
  fi

  if [[ "$os" == "linux" ]]; then
      echo "Linux detected as host OS."
      echo "When running Docker natively on Linux, containers usually cannot reach Plex via localhost."

      detected_ip=""

      skip_auto_detection=false

      if [[ "$is_wsl" == true ]]; then
        echo "WSL environment detected. Attempting to read Windows host LAN IP..."
        detected_ip=$("/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -Command '(
          Get-NetIPConfiguration |
            Where-Object {
              $_.IPv4DefaultGateway -ne $null -and
              $_.NetAdapter.Status -eq "Up" -and
              $_.NetAdapter.InterfaceDescription -notmatch "Hyper-V|vEthernet|WSL"
            } |
            Select-Object -ExpandProperty IPv4Address |
            Select-Object -First 1 -ExpandProperty IPAddress
        )' 2>/dev/null | tr -d '\r')

        if [[ -z "$detected_ip" ]]; then
          echo "Could not detect Windows host IP automatically."
          skip_auto_detection=true
        fi
      fi

      if [[ "$skip_auto_detection" != true && -z "$detected_ip" ]]; then
        detected_ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
      fi

      if [[ "$skip_auto_detection" != true && -z "$detected_ip" ]]; then
        detected_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
      fi

      prompt_plex_details "$detected_ip" "Plex server IP (e.g., 192.168.1.174): "
  elif [[ "$os" == "mac" ]]; then
      docker_platform=$(docker info --format '{{.OperatingSystem}}' 2>/dev/null || true)

      if echo "$docker_platform" | grep -qi "docker desktop"; then
        echo "Docker Desktop detected on macOS, using host.docker.internal to reach the host."
        prompt_plex_details "host.docker.internal" "Plex server IP (e.g., 192.168.1.50 or host.lima.internal): "
      else
        echo "macOS detected without Docker Desktop (e.g., Colima)."
        echo "Enter the LAN IP address of this Mac so Youtarr can reach Plex, or use host.lima.internal."

        detected_ip=$(ipconfig getifaddr en0 2>/dev/null)
        if [[ -z "$detected_ip" ]]; then
          detected_ip=$(ipconfig getifaddr en1 2>/dev/null)
        fi

        prompt_plex_details "$detected_ip" "Plex server IP (e.g., 192.168.1.50 or host.lima.internal): "
      fi
  else
      echo "Non-Linux host detected. Containers can usually reach the host via host.docker.internal."
      prompt_plex_details "host.docker.internal" "Plex server IP (e.g., 192.168.1.10): "
  fi

  # Escape the plex_ip value to avoid any issues with sed
  plex_ip_escaped=$(printf '%s\n' "$plex_ip" | sed 's:[][\/.^$*]:\\&:g')
  plex_port_escaped=$(printf '%s\n' "$plex_port" | sed 's:[][\/.^$*]:\\&:g')

  # Use sed to replace the value of plexIP in config.json
  sed -i "s/\"plexIP\": \".*\"/\"plexIP\": \"$plex_ip_escaped\"/" ./config/config.json

  if grep -q '"plexPort"' ./config/config.json; then
    sed -i "s/\"plexPort\": \".*\"/\"plexPort\": \"$plex_port_escaped\"/" ./config/config.json
  else
    sed -i "s/\"plexIP\": \"$plex_ip_escaped\"/\"plexIP\": \"$plex_ip_escaped\",\n  \"plexPort\": \"$plex_port_escaped\"/" ./config/config.json
  fi
else
  echo "Skipping Plex configuration. You can configure Plex later from the Youtarr UI or by editing config/config.json."
fi

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
