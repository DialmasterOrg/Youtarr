# Gluetun integration

[Gluetun](https://github.com/qdm12/gluetun) is a powerful Docker container for running a WireGuard or OpenVPN tunnel for your Docker containers or other devices on your network.

This is a basic guide to configuring Youtarr to use Gluetun for downloading media.

---

## Switching to Gluetun:
1. Backup Youtarr and Youtarr's database (if switching)
   - While adding Gluetun and using the new Docker Compose files does not mess with Youtarr or its database, it is always recommended to back up Youtarr and its database when modifying its setup.
2. Switching Docker Compose files
   - Switch to a Docker Compose file with Gluetun integrated, like [docker-compose-gluetun.yml](https://github.com/DialmasterOrg/Youtarr/blob/main/docker-compose-gluetun.yml)
3. Switching `.env` files
   - Switch to an `.env` file with Gluetun integrated, like [.env.gluetun-example](https://github.com/DialmasterOrg/Youtarr/blob/main/.env.gluetun-example)
4. Recreate Youtarr's container by running
   ```
   docker compose up -d --force-recreate
   ```
6. Profit!

---

Sources:
- [Gluetun](https://github.com/qdm12/gluetun)
- [Gluetun Wiki](https://github.com/qdm12/gluetun-wiki)
- [inter-containers-networking.md](https://github.com/qdm12/gluetun-wiki/blob/main/setup/inter-containers-networking.md)
- [providers](https://github.com/qdm12/gluetun-wiki/tree/main/setup/providers)
- [firewall.md](https://github.com/qdm12/gluetun-wiki/blob/main/setup/options/firewall.md)
- [connect-a-container-to-gluetun.md](https://github.com/qdm12/gluetun-wiki/blob/main/setup/connect-a-container-to-gluetun.md)
