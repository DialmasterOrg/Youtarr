# Gluetun integration

[Gluetun](https://github.com/qdm12/gluetun) is a powerful Docker container for running a WireGuard or OpenVPN tunnel for your Docker containers or other devices on your network.

**Important:** Gluetun and Youtarr are tied together. Restarting Gluetun will restart Youtarr.

**Note:** This is a basic guide to configuring Youtarr to use Gluetun for downloading media. To avoid breaking changes, Gluetun is locked to the `v3` image.

---

## Installation

### Existing Youtarr installation:
1. Back up Youtarr and Youtarr's database
   - While adding Gluetun and using the new Docker Compose files does not mess with Youtarr or its database, it is always recommended to back up Youtarr and its database when modifying its setup.
   - See [docs/BACKUP_RESTORE.md](BACKUP_RESTORE.md) for instructions
2. Copy the Gluetun section from [.env.example](https://github.com/DialmasterOrg/Youtarr/blob/main/.env.example) to the bottom of your existing `.env` and set the required variables, such as
   - `VPN_SERVICE_PROVIDER`
   - `WIREGUARD_PRIVATE_KEY`
   - `WIREGUARD_ADDRESSES`
**Note:** If you are using named-volume storage or an external database, uncomment the appropriate `COMPOSE_FILE` lines 
3. Set `FIREWALL_OUTBOUND_SUBNETS` if Youtarr needs to reach Plex, Jellyfin, Emby, or an external DB on your LAN. Otherwise, that traffic goes into the VPN and will time out.
4. Reverse proxy users (Traefik, NPM, etc.)
   - Domain name users will need to point the upstream domain name from your Youtarr instance to Gluetun.
      - Example: `youtarr:3011` to `gluetun:3011`
   - IP address users using Docker container IP addresses will need to update the upstream IP address from Youtarr's IP address to Gluetun's container IP address. Youtarr and Gluetun will share the same container IP address, because all of Youtarr's traffic goes through Gluetun.
      - Example: `10.88.2.2` to `10.89.2.2` or something similar
   - IP address users **not** using Docker container IP addresses will not need to change anything.
5. Set `COMPOSE_FILE` in `.env`, then run `./start.sh`, or `docker compose up -d` if you don't use the scripts. No `--force-recreate` needed either, compose recreates youtarr on its own because its config changed.
6. Profit!

---

Sources:
- [Gluetun](https://github.com/qdm12/gluetun)
- [Gluetun Wiki](https://github.com/qdm12/gluetun-wiki)
