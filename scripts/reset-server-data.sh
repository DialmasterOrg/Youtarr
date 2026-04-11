#!/usr/bin/env bash
set -euo pipefail

cat <<'WARN'

##########################################################################
# ⚠️  DANGER ZONE: THIS WILL ERASE LOCAL YOUTARR SERVER DATA PERMANENTLY #
##########################################################################

This script will permanently remove all Youtarr server state, including:
  • MariaDB data (bind mount ./database/ AND Docker named volumes)
  • Download archive list (config/complete.list)
  • Job metadata caches (jobs/info/*)
  • Downloaded thumbnails and posters (server/images/*)

Docker named volumes removed if present:
  - youtarr_youtarr-db-data-dev  (used by docker-compose.dev.yml)
  - youtarr_youtarr-db-data      (used by docker-compose.arm.yml)

Works whether Youtarr is running or stopped. Any running Youtarr
containers will be force-stopped so their volumes can be removed.

Actual media files in your Plex/YouTube output directory are NOT touched.
External databases (docker-compose.external-db.yml) are NOT touched.

##########################################################################
WARN

echo
read -r -p "Type 'RESET' to proceed or anything else to abort: " confirmation

if [[ "${confirmation}" != "RESET" ]]; then
  echo "Aborted. No data was removed."
  exit 1
fi

echo "Resetting Youtarr server data..."

# Known Youtarr container and volume names across compose flows
# (production, dev, and ARM). We operate on names directly instead of via
# `docker compose down` so the script works even when required env vars
# (e.g. YOUTUBE_OUTPUT_DIR) or compose files are missing.
YOUTARR_CONTAINERS=(youtarr-dev youtarr youtarr-db-dev youtarr-db)
YOUTARR_VOLUMES=(youtarr_youtarr-db-data-dev youtarr_youtarr-db-data)

if command -v docker &>/dev/null && docker info &>/dev/null; then
  # Named volumes can't be removed while a container is using them, so
  # force-remove any known Youtarr containers first. `docker rm -f` works
  # on both running and stopped containers.
  for container in "${YOUTARR_CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -qx "$container"; then
      echo "  Removing container: $container"
      docker rm -f "$container" >/dev/null 2>&1 || true
    fi
  done

  for vol in "${YOUTARR_VOLUMES[@]}"; do
    if docker volume inspect "$vol" &>/dev/null; then
      echo "  Removing Docker volume: $vol"
      docker volume rm "$vol" >/dev/null
    fi
  done
else
  echo "  Docker not available - skipping container/volume cleanup."
fi

# Ensure glob patterns that match nothing simply expand to nothing
shopt -s nullglob

# Bind-mounted MariaDB data directory (used by the default docker-compose.yml flow)
sudo rm -rf ./database/
sudo rm -f ./config/complete.list
sudo rm -f ./jobs/info/*
sudo rm -f ./server/images/*

shopt -u nullglob

echo "Server data reset complete."
echo "Reminder: downloaded video files remain in your configured output directory. Delete them manually if desired."
