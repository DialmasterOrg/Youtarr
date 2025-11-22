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
- May have permission issues on Synology/QNAP and or virtiofs issues on Apple Silicon macOS, leading to database issues/corruption

#### Option 2: Named Volume (Recommended for Synology/Apple)
```yaml
volumes:
  - youtarr-db-data:/var/lib/mysql
```
- Better compatibility with Synology/QNAP
- Avoids permission issues
- Required for macOS Apple Silicon
- Not easily visible on host

### Switching to Named Volume

If experiencing permission errors on Synology/QNAP or corruption on Apple Silicon:

**IMPORTANT**: Changing your DB volume mount will *not* migrate your existing database! If you are not experiencing problems, leave this setting alone!

1. Stop the stack:
   `docker compose down` or `./stop.sh`

2. Edit `docker-compose.yml`:
   ```yaml
   # Change from:
   volumes:
     - ./database:/var/lib/mysql

   # To:
   volumes:
     - youtarr-db-data:/var/lib/mysql
   ```

3. Add volume definition at bottom of file:
   ```yaml
   volumes:
     youtarr-db-data:
   ```

4. Restart:
   `docker compose up -d` or `./start.sh`

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
2. **macOS Apple Silicon**: virtiofs incompatibility with MariaDB 10.3
3. **Wrong ownership**: Database files owned by incorrect user

#### Solutions
1. **Switch to named volume** (see above)
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
