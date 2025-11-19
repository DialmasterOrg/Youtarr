#!/bin/bash

# Shared helpers for consistent console output across startup scripts.
YOUTARR_CONSOLE_DIVIDER='============================================================'

# Color detection: Enable colors if terminal supports it and NO_COLOR is not set
USE_COLOR=false
if [ -z "$NO_COLOR" ] && [ -t 1 ]; then
  # Check if terminal supports colors (8 or more colors)
  if command -v tput >/dev/null 2>&1; then
    num_colors=$(tput colors 2>/dev/null || echo 0)
    if [ "$num_colors" -ge 8 ]; then
      USE_COLOR=true
    fi
  else
    # Fallback: assume color support if stdout is a terminal
    USE_COLOR=true
  fi
fi

# Define colors if supported
if [ "$USE_COLOR" = true ]; then
  COLOR_RESET='\033[0m'
  COLOR_BOLD='\033[1m'
  COLOR_DIM='\033[2m'
  COLOR_CYAN='\033[36m'
  COLOR_GREEN='\033[32m'
  COLOR_YELLOW='\033[33m'
  COLOR_RED='\033[31m'
  COLOR_BOLD_CYAN='\033[1;36m'
else
  COLOR_RESET=''
  COLOR_BOLD=''
  COLOR_DIM=''
  COLOR_CYAN=''
  COLOR_GREEN=''
  COLOR_YELLOW=''
  COLOR_RED=''
  COLOR_BOLD_CYAN=''
fi

yt_banner() {
  printf '\n%b%s\n %s\n%s%b\n' "$COLOR_BOLD_CYAN" "$YOUTARR_CONSOLE_DIVIDER" "$1" "$YOUTARR_CONSOLE_DIVIDER" "$COLOR_RESET"
}

yt_section() {
  printf '\n%b--%b %b%s%b %b--%b\n' "$COLOR_CYAN" "$COLOR_RESET" "$COLOR_BOLD" "$1" "$COLOR_RESET" "$COLOR_CYAN" "$COLOR_RESET"
}

yt_info() {
  printf "[INFO ] %s\n" "$1"
}

yt_success() {
  printf "%b[ OK  ]%b %s\n" "$COLOR_GREEN" "$COLOR_RESET" "$1"
}

yt_warn() {
  printf "%b[WARN ]%b %s\n" "$COLOR_YELLOW" "$COLOR_RESET" "$1"
}

yt_error() {
  printf "%b[ERROR]%b %s\n" "$COLOR_RED" "$COLOR_RESET" "$1"
}

yt_detail() {
  printf "%b        %s%b\n" "$COLOR_DIM" "$1" "$COLOR_RESET"
}
