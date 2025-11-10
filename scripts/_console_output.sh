#!/bin/bash

# Shared helpers for consistent console output across startup scripts.
YOUTARR_CONSOLE_DIVIDER='============================================================'

yt_banner() {
  printf '\n%s\n %s\n%s\n' "$YOUTARR_CONSOLE_DIVIDER" "$1" "$YOUTARR_CONSOLE_DIVIDER"
}

yt_section() {
  printf '\n-- %s --\n' "$1"
}

yt_info() {
  printf "[INFO ] %s\n" "$1"
}

yt_success() {
  printf "[ OK  ] %s\n" "$1"
}

yt_warn() {
  printf "[WARN ] %s\n" "$1"
}

yt_error() {
  printf "[ERROR] %s\n" "$1"
}

yt_detail() {
  printf "        %s\n" "$1"
}
