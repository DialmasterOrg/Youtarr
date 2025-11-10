# Using Youtarr With an External Database

Youtarr now supports running against an existing MariaDB or MySQL instance. This guide walks you through preparing the database, configuring the container, and testing the setup locally so you can ship a confident experience to users who already manage their own database (including UNRAID deployments).

## Requirements

- MariaDB 10.3+ or MySQL 8.0+ reachable from the Youtarr container
- A database/schema dedicated to Youtarr (default name `youtarr`)
- A user with full privileges on that schema
- UTF-8 support (`utf8mb4` / `utf8mb4_unicode_ci`)

> **Tip:** Keep the database and Youtarr container on the same Docker network or ensure routing/firewall rules allow traffic from Youtarr to the DB host/port.

## 1. Prepare the External Database

Run the following SQL on your target database host (adjust usernames/passwords as needed to match your `.env`):

```sql
CREATE DATABASE youtarr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'youtarr'@'%' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON youtarr.* TO 'youtarr'@'%';
FLUSH PRIVILEGES;
```

If your platform limits wildcard access, replace `'%'` with the container's IP or network CIDR.

## 2. Configure Youtarr for the External DB

1. Edit your .env file and add your external DB configuration
2. Verify the following keys are set to the same values you used for the DB:
   - `DB_HOST`: The host the DB is reachable at from Youtarr (eg. 192.168.1.XXX)
   - `DB_PORT`: The port your DB is exposed on
   - `DB_USER` / `DB_PASSWORD`: The username and password you used to create the user for youtarr
   - `DB_NAME`: The database name you created for youtarr

3. Start Youtarr without it's normally bundled DB using the convenience script:
   ```bash
   # Docker Compose helper (launches only the app container)
   ./start-with-external-db.sh
   ```
   - Add `--no-auth` if you are fronting Youtarr with your own authentication layer
   - Provide `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` (either via .env or via your platform's UI) when you need to bypass the localhost-only setup wizard

To revert to the bundled database, simply run `./start.sh` without the flag.

## 3. Running `docker compose` Manually

If you prefer manual Docker Compose commands:

# Launch the single-service stack that targets your external database
docker compose -f docker-compose.external-db.yml up -d
```

## 4. Testing Locally With a Throwaway DB

The script at `./scripts/create-external-test-db.sh` has been provided to create a local DB for testing
This should not normally be needed for most users.

## 5. Troubleshooting Checklist

- **Authentication errors**: confirm the credentials in `.env` match the DB user and that the user has access from the container's IP.
- **Connection timeout**: ensure the DB port is open and routable from the Docker network; check firewall or security group rules.
- **Schema mismatch**: rerun `./start-with-external-db.sh` after clearing out a misconfigured database—the app will apply migrations automatically on startup.
- **Character-set warnings**: verify the database is created with `utf8mb4` so emoji and YouTube metadata are stored correctly.

See [Troubleshooting](docs/TROUBLESHOOTING.md#database-issues) for database-specific troubleshooting steps.