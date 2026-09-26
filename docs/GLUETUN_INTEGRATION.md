# Gluetun integration

[Gluetun](https://github.com/qdm12/gluetun) is a powerful Docker container for running a WireGuard or OpenVPN tunnel for your Docker containers or other devices on your network.

This is a basic guide to configuring Youtarr to use Gluetun for downloading media.

---

## Switching to Gluetun:
1. Backup Youtarr and Youtarr's database (if switching)
   - While adding Gluetun and using the new Docker Compose files does not mess with Youtarr or its database, it is always recommended to back up Youtarr and its database when modifying its setup.
   - See [docs/BACKUP_RESTORE.md](BACKUP_RESTORE.md) for instructions
2. Switching Docker Compose files
   - Switch to a Docker Compose file with Gluetun integrated, like [docker-compose-gluetun.yml](https://github.com/DialmasterOrg/Youtarr/blob/main/docker-compose-gluetun.yml)
   - For external database or dev users, use the respective compose files [docker-compose-gluetun.external-db.yml](https://github.com/DialmasterOrg/Youtarr/blob/main/docker-compose-gluetun.external-db.yml) & [docker-compose-gluetun.dev.yml](https://github.com/DialmasterOrg/Youtarr/blob/main/docker-compose-gluetun.dev.yml)
3. Recreate the Youtarr container and add Gluetun by running
   ```
    docker compose -f docker-compose-gluetun.yml up -d --force-recreate
   ```
4. Profit!

---

Sources:
- [Gluetun](https://github.com/qdm12/gluetun)
- [Gluetun Wiki](https://github.com/qdm12/gluetun-wiki)
