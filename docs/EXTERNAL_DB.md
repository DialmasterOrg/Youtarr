# Using Youtarr With an External Database

Youtarr now supports running against an existing MariaDB or MySQL instance. This guide walks you through preparing the database, configuring the container, and testing the setup locally so you can ship a confident experience to users who already manage their own database (including UNRAID deployments).

## Requirements

- MariaDB 10.3+ or MySQL 8.0+ reachable from the Youtarr container
- A database/schema dedicated to Youtarr (default name `youtarr`)
- A user with full privileges on that schema
- UTF-8 support (`utf8mb4` / `utf8mb4_unicode_ci`)

> **Tip:** Keep the database and Youtarr container on the same Docker network or ensure routing/firewall rules allow traffic from Youtarr to the DB host/port.

## 1. Prepare the External Database

Run the following SQL on your target database host (adjust usernames/passwords as needed):

```sql
CREATE DATABASE youtarr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'youtarr'@'%' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON youtarr.* TO 'youtarr'@'%';
FLUSH PRIVILEGES;
```

If your platform limits wildcard access, replace `'%'` with the container's IP or network CIDR.

## 2. Configure Youtarr for the External DB

1. Copy the new example file and fill in your connection details:
   ```bash
   cp config/external-db.env.example config/external-db.env
   ${EDITOR:-nano} config/external-db.env
   ```
2. Verify the following keys are set:
   - `DB_HOST` – hostname/IP of your database server
     - On Docker Desktop/WSL, `host.docker.internal` is the most reliable host name for reaching Windows services from the container
   - `DB_PORT` – defaults to 3306 if omitted
   - `DB_USER` / `DB_PASSWORD` – credentials created above
   - `DB_NAME` – defaults to `youtarr`
3. Start Youtarr with whichever helper fits your setup:
   ```bash
   # Docker Compose helper (launches only the app container)
   ./start.sh --external-db

   # Single-container helper (wraps docker run, should be easier to use for UNRAID)
   ./start-with-external-db.sh
   ```
   - `./start.sh --external-db` uses a dedicated compose stack (`docker-compose.external-db.yml`) that starts only the application container
   - `./start-with-external-db.sh` wraps `docker run` for platforms where Docker Compose is unavailable
   - Both scripts use the same `config/external-db.env` file
   - Add `--no-auth` if you are fronting Youtarr with your own authentication layer
   - Provide `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` (either exported before running the script or via your platform's UI) when you need to bypass the localhost-only setup wizard
   - Use `--image` with `start-with-external-db.sh` to pin a specific container tag when testing

To revert to the bundled database, simply run `./start.sh` without the flag.

## 3. Running `docker compose` Manually

If you prefer manual Docker Compose commands:

```bash
# Export DB settings for this shell
set -a
. config/external-db.env
set +a

# Launch the single-service stack that targets your external database
docker compose -f docker-compose.external-db.yml up -d
```

## 4. Testing Locally With a Throwaway DB

Use this flow to verify the external-DB path without touching production:

```bash
# Create an isolated network so both containers can reach each other
docker network create youtarr-ext-test

# Launch a standalone MariaDB container that acts as the "external" DB
docker run -d --name youtarr-ext-db \
  --network youtarr-ext-test \
  -e MYSQL_ROOT_PASSWORD=supersecret \
  -e MYSQL_DATABASE=youtarr \
  -e MYSQL_TCP_PORT=3306 \
  mariadb:10.6 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci

# Update config/external-db.env
cat <<'ENV' > config/external-db.env
DB_HOST=youtarr-ext-db
DB_PORT=3306
DB_USER=root
DB_PASSWORD=supersecret
DB_NAME=youtarr
ENV

# Start Youtarr against that database
./start.sh --external-db
```

When you are finished testing:
```bash
./stop.sh
docker rm -f youtarr-ext-db
docker network rm youtarr-ext-test
```

## 5. Notes for UNRAID & Other Platforms

- Create a MariaDB/MySQL container (or point to an existing server) and make sure it lives on the same Docker network as Youtarr.
- Mount `config/`, `jobs/`, and your download directory into the Youtarr container just as you would with the standard stack.
- Populate `config/external-db.env` inside the appdata share and run the container with `./start.sh --external-db` (or the equivalent command in the GUI).
- Because migrations run automatically on boot, no manual schema management is required beyond the initial database/user creation.

## 6. Troubleshooting Checklist

- **Authentication errors**: confirm the credentials in `config/external-db.env` match the DB user and that the user has access from the container's IP.
- **Connection timeout**: ensure the DB port is open and routable from the Docker network; check firewall or security group rules.
- **Schema mismatch**: rerun `./start.sh --external-db` after clearing out a misconfigured database—the app will apply migrations automatically on startup.
- **Character-set warnings**: verify the database is created with `utf8mb4` so emoji and YouTube metadata are stored correctly.
