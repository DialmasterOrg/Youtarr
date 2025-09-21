#!/usr/bin/env bash
set -euo pipefail

cat <<'WARN'

##########################################################################
# ⚠️  DANGER ZONE: THIS WILL ERASE LOCAL YOUTARR SERVER DATA PERMANENTLY #
##########################################################################

This script will permanently remove all Youtarr server state, including:
  • MariaDB data volume (./database/)
  • Download archive list (config/complete.list)
  • Job metadata caches (jobs/info/*)
  • Downloaded thumbnails and posters (server/images/*)

Actual media files stored in your Plex/YouTube output directory are NOT touched.

##########################################################################
WARN

echo
read -r -p "Type 'RESET' to proceed or anything else to abort: " confirmation

if [[ "${confirmation}" != "RESET" ]]; then
  echo "Aborted. No data was removed."
  exit 1
fi

echo "Resetting Youtarr server data..."

# Ensure glob patterns that match nothing simply expand to nothing
shopt -s nullglob

sudo rm -rf ./database/
sudo rm -f ./config/complete.list
sudo rm -f ./jobs/info/*
sudo rm -f ./server/images/*

shopt -u nullglob

echo "Server data reset complete."
echo "Reminder: downloaded video files remain in your configured output directory. Delete them manually if desired."
