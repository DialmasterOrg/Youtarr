# Database Configuration and Management

This document provides comprehensive information about Youtarr's database setup, configuration, troubleshooting, and management.

## Table of Contents
- [Overview](#overview)
- [Internal Database (Default)](#internal-database-default)
- [External Database Setup](#external-database-setup)
- [Database Migrations](#database-migrations)
- [Troubleshooting Database Issues](#troubleshooting-database-issues)
- [Storage Considerations](#storage-considerations)

## Overview

Youtarr uses MariaDB/MySQL for storing:
- Channel subscriptions and metadata
- Video information and download history
- Job queues and processing state
- Session data for authentication

### Database Tables
| Table              | Model             | Description                       |
| :----------------- | :-------------    | :-------------------------------- |
| `channels`         | `Channel`         | YouTube channel information       |
| `Videos`           | `Video`           | Downloaded video metadata         |
| `channelvideos`    | `ChannelVideo`    | Channel <-> video associations    |
| `Jobs`             | `Job`             | Download job queue                |
| `JobVideos`        | `JobVideo`        | Job <-> video associations        |
| `JobVideoDownloads`| `JobVideoDownload`| Download progress tracking        |
| `Sessions`         | `Session`         | User authentication sessions      |
| `ApiKeys`          | `ApiKey`          | API key credentials for external integrations (bookmarklets, shortcuts, automation) |
| `SequelizeMeta`    | NA                | Sequelize ORM migration tracking  |

## Internal Database (Default)

### Container Details
- **Image**: `mariadb:10.3`
- **Container Name**: `youtarr-db`
- **Port**: 3321 (both host and container)
- **Character Set**: `utf8mb4` (full Unicode/emoji support)
- **Default Credentials**:
  - User: `root`
  - Password: `123qweasd` (change in production!)
  - Database: `youtarr`

### Storage Options

#### Option 1: Bind Mount (Default)
```yaml
volumes:
  - ./database:/var/lib/mysql
```
- Data stored in `./database` directory on the host
- Kept for backwards compatibility with existing bind-mounted installs and plain `docker compose up -d` users
- Works well on native Linux Docker hosts
- Can have permission issues on Synology/QNAP
- Can corrupt during MariaDB schema migrations on Docker Desktop for Windows/macOS, ARM hosts, and some virtualized filesystems

#### Option 2: Named Volume (Recommended for Docker Desktop/ARM/NAS)
```yaml
volumes:
  - youtarr-db-data:/var/lib/mysql
```
- Better compatibility with Synology/QNAP
- Avoids the virtualized-filesystem write semantics problem that can affect bind-mounted MariaDB
- Used automatically for fresh installs started with `./start.sh` on every platform (Linux included, since v1.69)
- Recommended for Docker Desktop on Windows/macOS, ARM systems, and NAS setups
- Not easily visible on host: data lives under `/var/lib/docker/volumes/<project>_youtarr-db-data/_data` rather than `./database/`. `./scripts/backup.sh` dumps from the running MariaDB container when it is already up; when it has to start MariaDB for a backup, it detects whether this install uses the bind mount or named volume first.

### Migrating from Bind Mount to Named Volume

If you already have Youtarr data in `./database/`, do **not** switch the compose mount by hand unless you intentionally want to start with an empty database. Use the migration helper instead:

```bash
./scripts/migrate-to-named-volume.sh
```

What the script does (in this order, so any failure leaves the simplest possible recovery state):
1. Runs a pre-flight permissions check so it fails fast (instead of stalling on an interactive `sudo` prompt) if it cannot write to the project directory.
2. Stops Youtarr.
3. Starts the existing bind-mounted MariaDB long enough to run `mysqldump` and to capture per-table row counts.
4. Renames `./database/` to `./database.bind-mount-backup.<timestamp>/` so the original files are preserved.
5. Starts a fresh named-volume MariaDB and imports the dump.
6. Verifies that the table set matches the source **and** that every table has the same row count as the source.
7. **Only after verification succeeds**, snapshots `.env` to `./.env.bak.<timestamp>` and pins `COMPOSE_PATH_SEPARATOR=:` and `COMPOSE_FILE=docker-compose.yml:docker-compose.arm.yml` in `.env`. This means a failure during step 5 or 6 leaves `.env` untouched, and recovery is just `mv ./database.bind-mount-backup.<timestamp> ./database` plus removing the partial named volume.
8. Brings the full stack (app + database) back up so Youtarr is immediately usable.

**What the migration does *not* copy**: `mysqldump` runs with `--single-transaction --routines --triggers --events`. Schema, data, stored routines, triggers, and events all migrate. MariaDB users and `GRANT` statements (anything in `mysql.user` / `mysql.db`) do **not**. The default Youtarr install only uses the bundled `root` user, so this is a no-op for almost everyone. If you have created additional database users on the bundled MariaDB, recreate them after the migration completes.

**Password note**: for the bundled `root` database user, `DB_ROOT_PASSWORD` seeds the root password when a fresh MariaDB data directory is initialized, while Youtarr connects with `DB_PASSWORD`. The migration requires those two values to match before it creates the new named-volume database.

After it completes, the stack is already running. Subsequent restarts can use any of:

```bash
./start.sh                                                       # recommended
docker compose up -d                                             # the script pins COMPOSE_FILE in .env
docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d  # explicit override
```

### Reverting to Bind Mount

The migration is reversible:

1. Stop the stack:
   ```bash
   ./stop.sh
   ```
2. Restore the `.env` snapshot:
   ```bash
   mv ./.env.bak.<timestamp> .env
   ```
3. Remove the named volume for this install. The name is usually `<project>_youtarr-db-data`:
   ```bash
   docker volume ls --format '{{.Name}}' | grep -E '(^|_)youtarr-db-data$'
   docker volume rm <volume-name>
   ```
4. Restore the original bind-mounted database directory:
   ```bash
   mv ./database.bind-mount-backup.<timestamp> ./database
   ```
5. Start Youtarr:
   ```bash
   ./start.sh
   ```

Changes made while running on the named volume are not present in the old bind-mounted backup. If you have used the named volume for a while and want to keep those newer changes, take a backup first with `./scripts/backup.sh`.

### Fresh Installs with Named Volume

For a new install with no data to preserve, you can start directly with the named-volume override:

```bash
docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d
```

Or pin the override in `.env` so plain `docker compose up -d` uses it:

```env
COMPOSE_PATH_SEPARATOR=:
COMPOSE_FILE=docker-compose.yml:docker-compose.arm.yml
```

`COMPOSE_PATH_SEPARATOR=:` is important on Windows so Compose parses the file list consistently.

### Security Considerations

#### Changing Default Credentials
1. Edit `.env` file:
   ```bash
   DB_USER=youtarr
   DB_PASSWORD=secure-password-here
   DB_ROOT_PASSWORD=different-secure-password
   ```

2. If using non-root user, uncomment in `docker-compose.yml`:
   ```yaml
   environment:
     - MYSQL_USER=${DB_USER}
     - MYSQL_PASSWORD=${DB_PASSWORD}
   ```

3. Restart containers for changes to take effect

**Warning**: Never expose port 3321 to the internet without proper security measures.

## External Database Setup

### Requirements
- MariaDB 10.3+ or MySQL 8.0+
- Database with `utf8mb4` character set
- User with full privileges on the database
- Network connectivity from Youtarr container

### Step 1: Prepare External Database

Run on your database server:

**Note**: The example below assumes you are using `youtarr` for your DB name and `youtarr` for your DB user.

```sql
CREATE DATABASE youtarr
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'youtarr'@'%'
  IDENTIFIED BY 'your-secure-password';

GRANT ALL PRIVILEGES ON youtarr.*
  TO 'youtarr'@'%';

FLUSH PRIVILEGES;
```

Replace `'%'` with specific IP/network if restricting access.

### Step 2: Configure Youtarr

Edit `.env` file:
```bash
DB_HOST=192.168.1.100  # Your database server IP
DB_PORT=3306           # Your database port
DB_USER=youtarr        # Database username
DB_PASSWORD=your-secure-password
DB_NAME=youtarr        # Database name
```

### Step 3: Start with External Database

Using convenience script:
```bash
./start-with-external-db.sh
```

Or manually:
```bash
docker compose -f docker-compose.external-db.yml up -d
```

### Reverting to Internal Database
Simply run the normal start script:
```bash
./start.sh
```

## Database Migrations

### How Migrations Work
- Migrations run automatically on container startup
- Tracked in `SequelizeMeta` table
- Located in `/app/migrations/` inside container
- Idempotent - safe to run multiple times

### Creating New Migrations
```bash
# Use the provided script
./scripts/db-create-migration.sh my-migration-name

# Or use npm directly
npm run db:create-migration -- --name my-migration-name
```

### Migration Best Practices
1. **Always use helpers** for idempotent operations:
   ```javascript
   const { tableExists, columnExists, createTableIfNotExists } = require('./helpers');

   if (!await columnExists(queryInterface, 'videos', 'duration')) {
     await queryInterface.addColumn('videos', 'duration', {...});
   }
   ```

2. **Test migrations** in development first
3. **Never modify** existing migration files
4. **Create new migrations** for schema changes

## Troubleshooting Database Issues

### Permission Failures

#### Symptoms
- `InnoDB: Operating system error number 13`
- MariaDB container fails to start
- Permission denied errors in logs

#### Common Causes
1. **Synology/QNAP NAS**: MariaDB runs as UID 999, which may not exist
2. **Docker Desktop/ARM/NAS**: virtualized filesystem or permission issues with bind-mounted MariaDB data
3. **Wrong ownership**: Database files owned by incorrect user

#### Solutions
1. **Migrate to named volume** (see above)
2. **Fix permissions**:
   ```bash
   # Check current ownership
   ls -la ./database

   # Fix ownership (adjust UID:GID as needed)
   sudo chown -R 999:999 ./database
   ```

### Duplicate Column Errors

#### Symptoms
- `Duplicate column name 'duration'`
- `Table 'channelvideos' already exists`
- Migration errors after crash/restore

#### Cause
Lost or corrupted `SequelizeMeta` table causing migrations to re-run

#### Solution
With recent updates, migrations are idempotent and self-healing:
1. Simply restart the container:
   ```bash
   docker compose down
   docker compose up -d
   ```

2. If errors persist, manually check:
   ```bash
   # Connect to database
   docker exec -it youtarr-db mysql -u root -p123qweasd youtarr

   # Check SequelizeMeta
   SELECT * FROM SequelizeMeta;

   # If missing, migrations will re-run safely
   ```

### Connection Issues

#### Cannot Connect to Database
1. **Check container status**:
   ```bash
   docker ps | grep youtarr-db
   ```

2. **Test connection**:
   ```bash
   # From host
   mysql -h localhost -P 3321 -u root -p123qweasd

   # From Youtarr container
   docker exec -it youtarr bash
   mysql -h youtarr-db -P 3321 -u root -p123qweasd
   ```

3. **Check logs**:
   ```bash
   docker logs youtarr-db
   ```

#### Authentication Failures
- Verify credentials match in `.env` and database
- Check user permissions: `SHOW GRANTS FOR 'youtarr'@'%';`
- Ensure user can connect from container IP

### Character Set Issues

#### Symptoms
- Emoji not saving correctly
- UTF-8 encoding errors
- Question marks in text

#### Solution
Ensure database uses `utf8mb4`:
```sql
-- Check database charset
SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'youtarr';

-- Convert if needed
ALTER DATABASE youtarr
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

## Storage Considerations

### Database Size Estimates
- **Per Channel**: ~1-2 KB metadata
- **Per Video**: ~5-10 KB metadata
- **Growth Rate**: ~10 MB per 1000 videos
