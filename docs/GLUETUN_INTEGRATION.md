# Gluetun integration

[Gluetun](https://github.com/qdm12/gluetun) is a powerful Docker container for running a WireGuard or OpenVPN tunnel for your Docker containers or other devices on your network.

> [!IMPORTANT]
> Gluetun and Youtarr are tied together. Restarting Gluetun will restart Youtarr.

> [!NOTE]
> This is a basic guide to configuring Youtarr to use Gluetun for downloading media. To avoid breaking changes, Gluetun is locked to the `v3` image.

---

## Installation

### Existing Youtarr installation:
1. Back up Youtarr and Youtarr's database
   - While adding Gluetun and using the new Docker Compose files does not mess with Youtarr or its database, it is always recommended to back up Youtarr and its database when modifying its setup.
   - See [docs/BACKUP_RESTORE.md](BACKUP_RESTORE.md) for instructions
2. Switching Docker Compose files
   - Switch to a Docker Compose file with Gluetun integrated, like [docker-compose-gluetun.yml](https://github.com/DialmasterOrg/Youtarr/blob/main/docker-compose-gluetun.yml)
   - For external database users, use the respective compose file [docker-compose-gluetun.external-db.yml](https://github.com/DialmasterOrg/Youtarr/blob/main/docker-compose-gluetun.external-db.yml)
   - ARM users will need to stack their Docker Compose files. See the notes in [.env.example](https://github.com/DialmasterOrg/Youtarr/blob/main/.env.example) file.
4. Grab the latest [.env.example](https://github.com/DialmasterOrg/Youtarr/blob/main/.env.example) file
5. Set the required variables in your new `.env` file, such as
   - `VPN_SERVICE_PROVIDER`
   - `WIREGUARD_PRIVATE_KEY`
   - `WIREGUARD_PRESHARED_KEY`
   - `WIREGUARD_ADDRESSES`
6. Set `FIREWALL_OUTBOUND_SUBNETS` if Youtarr needs to reach Plex, Jellyfin, Emby, or an external DB on your LAN. Otherwise, that traffic goes into the VPN and will time out.
7. Reverse proxy users (Traefik, NPM, etc.)
   - Domain name users will need to point the upstream domain name from your Youtarr instance to Gluetun.
      - Example: `youtarr:3011` to `gluetun:3011`
   - IP address users using Docker container IP addresses will need to update the upstream IP address from Youtarr's IP address to Gluetun's container IP address. Youtarr and Gluetun will share the same container IP address, because all of Youtarr's traffic goes through Gluetun.
      - Example: `10.88.2.2` to `10.89.2.2` or something similar
   - IP address users **not** using Docker container IP addresses will not need to change anything.
8. Recreate the Youtarr container and add Gluetun by running
   ```
    docker compose -f docker-compose-gluetun.yml up -d --force-recreate
   ```
9. Profit!

---

Sources:
- [Gluetun](https://github.com/qdm12/gluetun)
- [Gluetun Wiki](https://github.com/qdm12/gluetun-wiki)
