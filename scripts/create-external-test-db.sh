#!/bin/bash
# Create and start an "external" MariaDB Docker container DB for testing
# NOTE: To test this works, you will need to set your .env to match the settings here
# And ensure that the DB is reachable from your host machine

# This is for use with the scripts/start-dev-external-db.sh and start-with-external-db.sh scripts
# which start Youtarr with an external DB rather than the internal one
# This is not really needed for most users, but is useful for testing and development

# WINDOWS WSL2 USERS:
# To make this accessible from your host IP:
# 1. In WSL2 run this command to get the WSL2 IP:
# ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1
# 2. Run Powershell as Admin and then:
# 2a. Check existing port proxies:
# netsh interface portproxy show v4tov4
# 2b. Remove existing proxy if needed:
# netsh interface portproxy delete v4tov4 listenport=3194 listenaddress=<YOUR_WINDOWS_IP>
# 2c. Add the port forward:
# netsh interface portproxy add v4tov4 listenport=3194 listenaddress=<YOUR_WINDOWS_IP> connectport=3194 connectaddress=<YOUR_WSL2_IP>

docker run -d --name youtarr-ext-db \
  -p 3194:3306 \
  -e MYSQL_ROOT_PASSWORD=123qweasd \
  -e MYSQL_DATABASE=youtarr \
  -e MYSQL_USER=youtarr \
  -e MYSQL_PASSWORD=supersecret \
  mariadb:10.6 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci \
  --bind-address=0.0.0.0

echo "Database container started with user 'youtarr' created!"