# Gluetun integration

[Gluetun](https://github.com/qdm12/gluetun) is a powerful Docker container for running a WireGuard or OpenVPN tunnel for your Docker containers or other devices on your network.

**Important:** Youtarr runs inside Gluetun's network, so the two are tied together.

- To restart Gluetun, run `docker compose restart gluetun`. Youtarr restarts with it.
- If Gluetun restarts or gets replaced on its own (a crash, `docker restart`, a Watchtower update, a Portainer recreate), Youtarr goes offline. Run `docker compose up -d --force-recreate youtarr` to reattach it.
- Updating Gluetun with `docker compose pull && docker compose up -d` recreates Youtarr automatically.

**Note:** This is a basic guide. Gluetun is pinned to the `v3` image to avoid breaking changes. You need Docker Compose v2.24 or newer (check with `docker compose version`); the old `docker-compose` v1 command won't work.

---

## Installation

### New Youtarr installation
Set up Gluetun before the first start so Youtarr never runs without the VPN. If you already ran `./start.sh` once, follow the existing-installation steps below instead.

1. Clone the repository and create `.env` from `.env.example`, then set `YOUTUBE_OUTPUT_DIR` ([INSTALLATION.md](INSTALLATION.md) walks through this).
2. In the Gluetun section at the bottom of `.env`, uncomment `COMPOSE_PATH_SEPARATOR` and the `COMPOSE_FILE` line that matches your setup. Then uncomment and fill in `VPN_SERVICE_PROVIDER`, `WIREGUARD_PRIVATE_KEY` and `WIREGUARD_ADDRESSES`. On a fresh install, `./start.sh` adds the named-volume database override to that line for you.
3. Continue with steps 3 to 6 below, then finish the initial setup in the web UI as described in INSTALLATION.md.

### Existing Youtarr installation
1. Back up Youtarr and Youtarr's database
   - While adding Gluetun and using the new Docker Compose files does not mess with Youtarr or its database, it is always recommended to back up Youtarr and its database when modifying its setup.
   - See [BACKUP_RESTORE.md](BACKUP_RESTORE.md) for instructions
2. Copy the Gluetun section from [.env.example](https://github.com/DialmasterOrg/Youtarr/blob/main/.env.example) to the bottom of your existing `.env` and set the required variables, such as
   - `VPN_SERVICE_PROVIDER`
   - `WIREGUARD_PRIVATE_KEY`
   - `WIREGUARD_ADDRESSES`

   **Note:** Your `.env` may already have a `COMPOSE_FILE=` line (`./start.sh` adds one on named-volume installs). If it does, add `:docker-compose.gluetun.yml` to the end of that line. Don't add a second `COMPOSE_FILE` line; Compose only reads the last one. If there isn't one, uncomment the `COMPOSE_FILE` line in the Gluetun section that matches your setup.
3. Set `FIREWALL_OUTBOUND_SUBNETS` (for example `192.168.1.0/24`) if Youtarr needs to reach Plex, Jellyfin, Emby or an external database on your LAN. Without it, that traffic goes into the VPN and times out.

   **Note:** `host.docker.internal` points at the Docker bridge, not your LAN, so add `172.17.0.0/16` (or your bridge subnet) if you use it. Enter Plex, Jellyfin and Emby by IP address, not by a LAN hostname: Gluetun blocks DNS answers that point at private IPs. The subnets can't overlap your VPN tunnel's address range. See the [Gluetun firewall docs](https://github.com/qdm12/gluetun-wiki/blob/main/setup/options/firewall.md).
4. Reverse proxy users (Traefik, NPM, etc.)
   - Domain name users will need to point the upstream domain name from your Youtarr instance to Gluetun.
      - Example: `youtarr:3011` to `gluetun:3011`
   - IP address users using Docker container IP addresses will need to update the upstream IP address from Youtarr's IP address to Gluetun's container IP address. Youtarr and Gluetun will share the same container IP address, because all of Youtarr's traffic goes through Gluetun.
      - Example: `10.88.2.2` to `10.89.2.2` or something similar
   - IP address users **not** using Docker container IP addresses will not need to change anything.
5. Start Youtarr with `./start.sh`, or `docker compose up -d` if you don't use the scripts. Compose recreates the Youtarr container on its own; no `--force-recreate` needed. If you use an external database, run `docker compose up -d`: `./start-with-external-db.sh` ignores `COMPOSE_FILE` and would start Youtarr without the VPN.
6. Check that it worked: `docker compose exec youtarr curl -s https://api.ipify.org` should print your VPN provider's IP address, not your own.

---

Sources:
- [Gluetun](https://github.com/qdm12/gluetun)
- [Gluetun Wiki](https://github.com/qdm12/gluetun-wiki)
