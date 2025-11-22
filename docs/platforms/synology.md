# Youtarr on Synology NAS

This guide provides Synology-specific installation instructions for Youtarr. Synology NAS devices running DSM 7+ can run Youtarr using Container Manager (Docker).

## Why Synology Needs Special Instructions

The standard `./start.sh` scripts work well on most Linux systems but may encounter issues on Synology DSM:
- Shell compatibility differences in DSM
- Directory permissions and path structures specific to Synology
- Container Manager environment variables handling
- Need for preset credentials in headless environments

This guide provides a manual configuration approach that works reliably on Synology.

## Prerequisites

- **Synology NAS** with DSM 7 or later
- **Container Manager** installed (via Package Center)
- **Git Server** installed (via Package Center) - optional but recommended
- **SSH access** enabled (Control Panel → Terminal & SNMP)
- User account with **docker group membership**

---

## Installation Steps

> **Installation Overview**: This guide walks you through installing Youtarr on Synology. The most critical step for Synology users is **Step 4.5** where you must configure the database volume before first start. Unlike standard installations, Synology requires either named volumes or the LinuxServer MariaDB image to avoid permission issues.

### Step 1: Enable SSH and Configure Docker Access

1. **Enable SSH** (if not already enabled):
   - Open **Control Panel** → **Terminal & SNMP**
   - Enable **SSH service**
   - Note the port (default: 22)

2. **Connect via SSH**:
   ```bash
   ssh yourusername@your-nas-ip
   ```

3. **Add your user to the docker group** (required for Docker access):
   ```bash
   sudo synogroup --add docker yourusername
   ```

4. **Log out and back in** for group membership to take effect:
   ```bash
   exit
   # Then reconnect via SSH
   ssh yourusername@your-nas-ip
   ```

5. **Verify Docker access**:
   ```bash
   docker ps
   # Should NOT show permission errors
   ```

---

### Step 2: Choose Installation Location

Synology best practices recommend using `/volume1/docker` for containerized applications:

```bash
cd /volume1/docker
```

**Alternative locations**:
- If you have multiple volumes, use `/volumeX/docker` where X is your volume number
- For shared folders, you can use `/volume1/some-shared-folder`

---

### Step 3: Clone Youtarr Repository

**Option A: Using Git** (recommended):
```bash
cd /volume1/docker
git clone https://github.com/DialmasterOrg/Youtarr.git
cd Youtarr
```

**Option B: Manual Download**:
1. Download the latest release from GitHub
2. Upload to your NAS via File Station
3. Extract to `/volume1/docker/Youtarr`

---

### Step 4: Create Required Directories

The docker-compose.yml file expects certain directories to exist. Create them now:

```bash
cd /volume1/docker/Youtarr

# These directories are mounted by the containers
# Note: database directory is NOT needed - see Step 4.5 for database configuration
mkdir -p config
mkdir -p jobs
mkdir -p server/images
```

**Create your video output directory** (can be anywhere on your NAS):

```bash
# Example locations - choose what works for your setup:

# For Plex integration:
mkdir -p /volume1/media/youtube

# For Jellyfin/Emby integration:
mkdir -p /volume1/video/youtube

# For standalone use:
mkdir -p /volume1/docker/Youtarr/data/youtube
```

**Important**: Remember this path - you'll need it in the next step.

---

### Step 4.5: Configure Database Volume (IMPORTANT!)

> **Critical for Synology**: The official MariaDB Docker image runs as UID 999, which does not exist on Synology systems. Using a bind mount (like `./database:/var/lib/mysql`) **will fail with permission errors** on Synology. You MUST configure the database volume before starting Youtarr for the first time.

Choose one of the following options:

#### Option 1: Named Volume (RECOMMENDED)

Named volumes are managed by Docker internally and avoid all permission issues. This is the simplest and most reliable option for Synology users.

**Edit docker-compose.yml before first start:**

```bash
cd /volume1/docker/Youtarr
vi docker-compose.yml
```

> **Tip**: If you prefer `nano` and have installed it, use `nano docker-compose.yml` instead.

**Make these changes:**

1. Find the `youtarr-db` service's `volumes:` section (around line 39):
   ```yaml
   volumes:
     - ./database:/var/lib/mysql
     # Synology and Apple Silicon macOS users:
     # Uncomment the line below and comment out the line above to use named volume:
     # - youtarr-db-data:/var/lib/mysql
   ```

   Change it to:
   ```yaml
   volumes:
     # - ./database:/var/lib/mysql
     # Synology and Apple Silicon macOS users:
     # Uncomment the line below and comment out the line above to use named volume:
     - youtarr-db-data:/var/lib/mysql
   ```

2. Find the `volumes:` section at the bottom of the file (around line 101):
   ```yaml
   # Synology and Apple Silicon macOS users:
   # Uncomment the line below and comment out the line above to use named volume:
   # volumes:
   #   youtarr-db-data:
   ```

   Change it to:
   ```yaml
   # Synology and Apple Silicon macOS users:
   # Uncomment the line below and comment out the line above to use named volume:
   volumes:
     youtarr-db-data:
   ```

**Save the file**:
- In `vi`: Press `Esc`, type `:wq`, press `Enter`
- In `nano`: Press `Ctrl+O`, `Enter`, then `Ctrl+X`

**Benefits of named volumes:**
- No permission issues - Docker manages all permissions internally
- Works perfectly with official MariaDB image
- Portable across all platforms (Synology, QNAP, macOS, Linux)
- No UID/GID configuration needed

**Note about data location:** The named volume data is stored by Docker in `/volume/@docker/volumes/` on Synology. You can back it up using `docker exec youtarr-db mysqldump` (see Backup section).

---

#### Option 2: LinuxServer MariaDB with Bind Mount (ADVANCED)

If you need direct filesystem access to the database files (for easier backups or migrations), you can use the LinuxServer MariaDB image which respects PUID/PGID environment variables.

** This requires replacing the entire `youtarr-db` service definition in docker-compose.yml:**

**1. Find your Synology user UID/GID**

SSH into your NAS and run:

```bash
ssh <your-user>@<your-nas-ip>
id
```
You'll see something like:
```bash
uid=1026(youruser) gid=100(users) groups=100(users),...
```

In this example:
- The PUID would be 1026
- The PGID would be 100

```bash
cd /volume1/docker/Youtarr
vi docker-compose.yml
```

**2. Replace the entire `youtarr-db` service** (starting around line 17) with:

```yaml
  youtarr-db:
    image: linuxserver/mariadb:latest
    container_name: youtarr-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-123qweasd}
      MYSQL_DATABASE: ${DB_NAME:-youtarr}
      MYSQL_TCP_PORT: ${DB_PORT:-3321}
      MYSQL_USER: ${DB_USER:-root}
      MYSQL_PASSWORD: ${DB_PASSWORD:-123qweasd}
      MYSQL_CHARSET: utf8mb4
      MYSQL_COLLATION: utf8mb4_unicode_ci
      # Replace these with your own UID/GID from the `id` command
      PUID: 1026 # Example: Synology default standard user
      PGID: 100  # Example: Synology default users group
    ports:
      - "${DB_PORT:-3321}:${DB_PORT:-3321}"
    volumes:
      # Database files will be stored in ./database on the host
      - ./database:/config
    command: --port=${DB_PORT:-3321} --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-P", "${DB_PORT:-3321}", "-p${DB_PASSWORD:-123qweasd}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - youtarr-network
```

**3. Database directory:**
By default, Docker will automatically create the ./database directory (as root:root) the first time the container starts. The linuxserver/mariadb image will then chown /config to PUID:PGID during its init step, so in most cases you don’t need to do anything extra.

If you prefer to create it explicitly, or if you run into permission errors, you can do:
```bash
cd /volume1/docker/Youtarr
mkdir -p database
# Optional: If permissions are wrong, you can force ownership:
# chown <your_uid>:<your_gid> database
# Eg: chown 1026:100 database
```
*Use the same UID/GID here that you set as PUID/PGID in the compose file.*

**Important differences:**
- Uses `linuxserver/mariadb` image instead of official `mariadb:10.3`
- Volume mount path is `./database:/config` (NOT `/var/lib/mysql`)
- PUID=1026 and PGID=100 match typical Synology user permissions
  - Find your DSM user’s UID/GID by SSHing into the NAS and running id.
- This image respects those UID/GID settings and will chown the `/config` directory on startup.

**When to use this option:**
- You need to access database files directly from the host
- You're migrating from another system with existing database files
- You want simpler backups via file copy instead of mysqldump

**Drawbacks:**
- More complex configuration
- Different image from official documentation
- Slightly different file structure inside container

---

After configuring the database, proceed to Step 5 to configure environment variables.

---

### Step 5: Configure Environment Variables

#### Create .env file

Youtarr includes a `.env.example` template that you can use as a starting point:

```bash
cd /volume1/docker/Youtarr
cp .env.example .env
vi .env
```

> **Tip**: Synology DSM ships with the BusyBox `vi` editor. If you have installed `nano` separately and prefer it, you can run `nano .env` instead of `vi .env`.

Edit the file to configure your settings. At minimum, set the `YOUTUBE_OUTPUT_DIR` to match your video storage location:

```bash
# Required: Set this to your video output directory (adjust to match your path)
YOUTUBE_OUTPUT_DIR=/volume1/media/youtube

# Optional: Set initial admin credentials
# Recommended for headless setup since you must otherwise set your initial login credentials via localhost
AUTH_PRESET_USERNAME=admin
AUTH_PRESET_PASSWORD=YourSecurePassword123

# Optional: Logging level (warn, info, debug)
LOG_LEVEL=info
```

The `.env.example` file contains detailed comments explaining each variable - refer to it for all available options.

**Save the file**:
- Press `Esc`, then type `:wq` and press `Enter` (for `vi`)
- If using `nano`, press `Ctrl+O`, `Enter`, then `Ctrl+X`

**Security Note**: Preset credentials via `AUTH_PRESET` persist. If you use them, you will not be able to change your username or password in the UI.

#### Verify .env file

```bash
cat .env
```

Ensure `YOUTUBE_OUTPUT_DIR` matches the directory you created in Step 4.

**Note about config.json**: You don't need to manually create or edit `config/config.json`:
- If config.json doesn't exist, it will be auto-created on first startup with correct defaults
- You can configure Plex and other settings later through the web UI

---

### Step 6: Start Youtarr

> **⚠️ IMPORTANT**: Before starting, ensure you completed **Step 4.5** to configure the database volume! Skipping Step 4.5 will cause MariaDB to fail with permission errors on Synology.

Start the containers using docker compose:

> **Compose command on Synology**: DSM 7 installs Docker Compose v2, which uses the space-separated syntax (`docker compose`). If your environment still uses the legacy v1 binary, substitute `docker-compose` in the examples below.

```bash
cd /volume1/docker/Youtarr
docker compose up -d
```

**Monitor the startup**:

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f

# Press Ctrl+C to exit log viewing
```

**Expected output**:
- `youtarr-db` container should show as "healthy"
- `youtarr` container should show as "running"

**Known harmless messages**:
- IPv6 rate limiting warnings can be ignored
- "Waiting for database" is normal during first startup

---

### Step 7: Access Youtarr

Open your web browser and navigate to:

```
http://your-nas-ip:3087
```

**First-time setup**:
- If you set `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` in `.env`, log in with those credentials
- If you didn't set credentials, you'll be prompted to create an admin account (only accessible from localhost - requires SSH port forwarding)

**After logging in**:
1. Navigate to **Configuration** page
2. (Optional) Configure Plex integration if desired
3. Add your first YouTube channel subscription
4. Start downloading videos!

---

## Synology-Specific Notes

### Container Manager GUI (Alternative to SSH)

While SSH is recommended for initial setup, you can also manage Youtarr through Container Manager:

1. Open **Container Manager** from DSM Package Center
2. Go to **Project** tab
3. Click **Create**
4. Set project name: `youtarr`
5. Set path: `/volume1/docker/Youtarr` (or your chosen location/volume)
6. Upload or create `docker-compose.yml`

**However**, manual configuration via SSH is more reliable for environment variables and initial setup.

### File Permissions

Youtarr runs as root by default inside the container, which should work with Synology's default permissions. If you encounter permission issues with the **app container** (not database):

First stop Youtarr, then:

**1. Find your Synology user UID/GID**

SSH into your NAS and run:

```bash
ssh <your-user>@<your-nas-ip>
id
```
You'll see something like:
```bash
uid=1026(youruser) gid=100(users) groups=100(users),...
```

In this example:
- The PUID would be 1026
- The PGID would be 100

**2. Fix ownership for app directories**
```bash
# Fix ownership for app directories only (from SSH)
cd /volume1/docker/Youtarr
# sudo chown -R <your uid>:<your gid> config jobs server
# Eg: sudo chown -R 1026:100 config jobs server
```

Set the UID/GID in your `.env` file using your UID/GID, example:
```
YOUTARR_UID=1026
YOUTARR_GID=100
```

Then restart Youtarr

**Important**: The `YOUTARR_UID` and `YOUTARR_GID` environment variables only affect the **youtarr app container**, not the database container.

- If you're using **named volumes** (Step 4.5 Option 1), database permissions are handled automatically by Docker
- If you're using **linuxserver/mariadb** (Step 4.5 Option 2), database permissions are controlled by the `PUID` and `PGID` settings in docker-compose.yml
- If you have database permission errors with the official MariaDB image, see the "Database Permission Errors" section below

### Network Access

**Port Requirements**:
- `3087`: Web UI and API
- `3321`: MariaDB (exposed on the NAS because `docker-compose.yml` maps `3321:3321`; lock it down with your firewall or remove the port mapping if you only need in-container access)

> **Security tip**: If you do not need MariaDB reachable from the NAS host, remove the `ports` block for `youtarr-db` from `docker-compose.yml` and redeploy (`docker compose down && docker compose up -d`). The `youtarr` container will still connect over the internal Docker network.

**Firewall**:
- Ensure port 3087 is accessible on your local network
- For remote access, use Synology's reverse proxy or VPN (do not expose directly to internet)

### Storage Locations

**Recommended directory structure**:
```
/volume1/docker/Youtarr/          # Application files
├── config/                        # Youtarr configuration
├── database/                      # MariaDB data
├── jobs/                          # Job processing data
├── server/                        # Server assets
└── .env                          # Environment variables

/volume1/media/youtube/           # Downloaded videos (example)
```
See [YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md) for structure of downloaded videos

### Integration with Media Servers on Synology

#### Plex
- If Plex runs on the same NAS, use your NAS's local IP address (e.g., `192.168.1.100`)
- Point Plex library to the same path as `YOUTUBE_OUTPUT_DIR`
- Configure as "Other Videos" library type with "Personal Media" agent

#### Jellyfin
- Install via Container Manager or Package Center
- Add library as "Movies" type
- Enable NFO metadata reader
- Point to your `YOUTUBE_OUTPUT_DIR`

#### Emby
- Similar to Jellyfin setup
- Use NFO metadata format
- Configure as Movies library

---

## Updating Youtarr

To update Youtarr to the latest version:

```bash
cd /volume1/docker/Youtarr

# Pull latest code
git pull

# Pull latest Docker images and restart
docker compose pull
docker compose up -d

# View logs to verify update
docker compose logs -f
```

---

## Stopping and Starting

**Stop Youtarr**:
```bash
cd /volume1/docker/Youtarr
docker compose down
```

**Start Youtarr**:
```bash
cd /volume1/docker/Youtarr
docker compose up -d
```

**Restart Youtarr**:
```bash
cd /volume1/docker/Youtarr
docker compose restart
```

---

## Troubleshooting

### "YOUTUBE_OUTPUT_DIR not set" Error

**Symptom**: Container fails to start with error about empty section between colons.

**Solution**:
1. Verify `.env` file exists: `cat /volume1/docker/Youtarr/.env`
2. Verify it contains: `YOUTUBE_OUTPUT_DIR="/your/path"`
3. Restart containers: `docker compose down && docker compose up -d`

### "ffmpeg-location undefined does not exist" Error

**Symptom**: Logs show warnings about ffmpeg location.

**Root Cause**: This usually indicates `YOUTUBE_OUTPUT_DIR` was not properly set, causing yt-dlp to fail.

**Solution**:
1. Verify `YOUTUBE_OUTPUT_DIR` in `.env` file matches a real directory
2. Verify directory exists: `ls -la /volume1/media/youtube`
3. Check directory permissions: `ls -ld /volume1/media/youtube`
4. Restart containers: `docker compose restart`

### "'NoneType' object has no attribute 'lower'" Error

**Symptom**: Videos fail to download with Python errors.

**Root Cause**: Missing or incorrect `YOUTUBE_OUTPUT_DIR` configuration.

**Solution**: Follow the steps in "YOUTUBE_OUTPUT_DIR not set" above.

### "Bind mount failed" Errors

**Symptom**: Container won't start, logs show mount errors.

**Solution**:
```bash
cd /volume1/docker/Youtarr
mkdir -p database config jobs server/images
docker compose up -d
```

### "Permission denied" on Docker Commands

**Symptom**: `docker` or `docker compose` commands fail with permission errors.

**Solution**:
```bash
# Add user to docker group (if not already done)
sudo synogroup --add docker yourusername

# IMPORTANT: Log out completely and reconnect
exit
# Reconnect via SSH

# Verify group membership
groups
# Should include "docker"

# Test Docker access
docker ps
```

### Web Interface Not Accessible

**Symptoms**: Cannot reach `http://your-nas-ip:3087`

**Troubleshooting steps**:

1. **Check container status**:
   ```bash
   docker compose ps
   # Both containers should be running
   ```

2. **Check logs for errors**:
   ```bash
   docker compose logs
   ```

3. **Verify port is listening**:
   ```bash
   sudo netstat -tulpn | grep 3087
   # Should show docker-proxy listening on port 3087
   ```

4. **Check firewall**:
   - DSM: Control Panel → Security → Firewall
   - Ensure port 3087 is allowed

5. **Test from NAS itself**:
   ```bash
   curl http://localhost:3087
   # Should return HTML content
   ```

### Cannot Login - Setup Wizard Required

**Symptom**: Browser shows "Initial setup required" but you can't access from remote IP.

**Cause**: Initial setup must be completed from localhost for security.

**Solution A: Set preset credentials** (recommended):
```bash
# Edit .env file
vi /volume1/docker/Youtarr/.env

# Add these lines:
AUTH_PRESET_USERNAME=admin
AUTH_PRESET_PASSWORD=YourSecurePassword123

# Restart to apply
docker compose down
docker compose up -d
```

> **Tip**: If you prefer `nano` and have installed it, replace `vi` with `nano` in the command above. In `vi`, press `Esc`, type `:wq`, then press `Enter` to save and exit.

**Solution B: SSH port forwarding**:
```bash
# From your local computer, create SSH tunnel:
ssh -L 3087:localhost:3087 yourusername@your-nas-ip

# Then access http://localhost:3087 on your computer
# Complete setup wizard
```

### Database Connection Errors

**Symptom**: Logs show "Error: connect ECONNREFUSED" or database connection failures.

**Solution**:
1. Check database container health:
   ```bash
   docker compose ps
   # youtarr-db should show "healthy"
   ```

2. View database logs:
   ```bash
   docker compose logs youtarr-db
   ```

3. Restart database:
   ```bash
   docker compose restart youtarr-db
   # Wait 30 seconds for health check
   docker compose restart youtarr
   ```

4. If issues persist, reset database:
   **WARNING: This deletes all data in your database!**
   #### If using host mounted database
   ```bash
   docker compose down
   rm -rf database/*
   docker compose up -d
   ```

   #### If using volume mounted database
   ```bash
   docker compose down -v # Removes the named volume (defaults to youtarr-db-data)
   docker compose up -d   # Recreates the volume and initializes a fresh database
   ```


### Database Permission Errors or "Duplicate column name" Errors

**Symptoms**:
- MariaDB container fails to start with permission errors (error 13)
- "InnoDB: Operating system error number 13 in a file operation"
- "Database error: Duplicate column name 'duration'" in web UI
- Database corruption issues

**Root Cause**:
- Most Synology failures are straight permission issues: the official MariaDB image runs as UID 999, which often lacks ownership rights on `/volume1/...` bind mounts. MariaDB can't even open the files and surfaces error 13. **This is why Step 4.5 instructs you to configure database volumes BEFORE first start**.
- If you actually have a duplicate-column error (for example after restoring a database backup), all Youtarr migrations now check for existing schema and skip work they have already performed. A simple restart usually clears the error automatically; if not, drop the duplicate column manually (per the main Troubleshooting guide) and rerun.

**If you already started Youtarr and are seeing permission errors:**

**Option A: Switch to Named Volume (Recommended - Fresh Start)**

If you don't have important data yet or can re-add your channels:

1. **Stop containers**:
   ```bash
   cd /volume1/docker/Youtarr
   docker compose down
   ```

2. **Follow Step 4.5 Option 1** to edit docker-compose.yml for named volumes

3. **Remove failed bind mount data** (optional cleanup):
   ```bash
   # Only if you want to clean up the failed attempt
   sudo rm -rf database
   ```

4. **Start containers**:
   ```bash
   docker compose up -d
   ```

**Option B: Switch to LinuxServer MariaDB (Advanced - Keep Bind Mount)**

If you need bind mounts for some reason:

1. **Stop containers**:
   ```bash
   cd /volume1/docker/Youtarr
   docker compose down
   ```

2. **Follow Step 4.5 Option 2** to replace the youtarr-db service with linuxserver/mariadb

3. **Fix permissions on existing database directory**:
   ```bash
   sudo chown -R <your uid>:<your gid> database
   ```

4. **Start containers**:
   ```bash
   docker compose up -d
   ```

**Option C: Migrate Existing Data to Named Volume**

If you have existing data in `./database/` that you want to preserve:

1. **Backup your database first**:

   ```bash
   # Try to start just the database temporarily to dump data
   docker compose up -d youtarr-db
   sleep 30
   docker exec youtarr-db mysqldump -u <db_user> -p'<db_password>' <db_name> > /volume1/backups/youtarr-backup.sql
   # Replace <db_user>, <db_password>, and <db_name> with the values from your .env file (defaults: root / 123qweasd / youtarr).
   docker compose down
   ```

2. **Switch to named volume** (follow Option A steps 1-2)

3. **Start containers** to initialize fresh database:
   ```bash
   docker compose up -d
   ```

4. **Restore your data**:

   ```bash
   # Wait for database to be healthy
   sleep 30
   docker exec -i youtarr-db mysql -u <db_user> -p'<db_password>' <db_name> < /volume1/backups/youtarr-backup.sql
   # Replace <db_user>, <db_password>, and <db_name> with the values from your .env file.
   docker compose restart youtarr
   ```

**Prevention for new installations:**

✅ **Always follow Step 4.5** before starting Youtarr for the first time to avoid these issues entirely!

### High CPU Usage

**Symptom**: NAS CPU usage spikes during video downloads.

**Cause**: yt-dlp and ffmpeg are CPU-intensive during video processing.

**Solutions**:
- Schedule downloads during off-peak hours (configure via Youtarr UI)
- Reduce concurrent download limits in Configuration
- Lower video quality settings to reduce processing time
- Disable SponsorBlock integration (if enabled)

### Out of Disk Space

**Symptom**: Downloads fail, database errors, container issues.

**Solution**:
1. Check available space:
   ```bash
   df -h /volume1
   ```

2. Enable automatic cleanup in Youtarr:
   - Configuration → Automatic Video Removal
   - Set age threshold (e.g., remove videos older than 90 days)
   - Set free space threshold (e.g., maintain 100 GB free)

3. Manual cleanup:
   ```bash
   # Find and remove old videos
   find /volume1/media/youtube -name "*.mp4" -mtime +90 -delete
   ```

---

## Backup and Restore

### Backup Configuration and Database

```bash
# Create backup directory
mkdir -p /volume1/backups/youtarr

# Backup configuration
cp -r /volume1/docker/Youtarr/config /volume1/backups/youtarr/config-$(date +%Y%m%d)

# Backup database (with containers running).
# Replace <db_user>, <db_password>, and <db_name> with the values from your .env file.
docker exec youtarr-db mysqldump -u <db_user> -p'<db_password>' <db_name> > /volume1/backups/youtarr/database-$(date +%Y%m%d).sql
```

**Optional file-level backups**

- **Bind mount / linuxserver installs**:
  ```bash
  docker compose down
  cp -r /volume1/docker/Youtarr/database /volume1/backups/youtarr/database-$(date +%Y%m%d)
  docker compose up -d
  ```

- **Named volume installs** (default volume name is `youtarr-db-data`; adjust if you changed it):
  ```bash
  docker run --rm \
    -v youtarr-db-data:/var/lib/mysql \
    -v /volume1/backups/youtarr:/backup \
    busybox sh -c 'cd /var/lib/mysql && tar czf /backup/youtarr-db-$(date +%Y%m%d).tar.gz .'
  ```

### Restore from Backup

1. **Stop containers and restore configuration**
   ```bash
   cd /volume1/docker/Youtarr
   docker compose down
   rm -rf config
   cp -r /volume1/backups/youtarr/config-YYYYMMDD config
   ```

2. **Restore the database** – choose the workflow that matches your setup:

   - **From mysqldump (works everywhere)**:
     ```bash
     docker compose up -d youtarr-db
     sleep 30
     docker exec -i youtarr-db mysql -u <db_user> -p'<db_password>' <db_name> < /volume1/backups/youtarr/database-YYYYMMDD.sql
     docker compose restart youtarr
     ```

   - **Bind mount / linuxserver installs**:
     ```bash
     rm -rf database
     cp -r /volume1/backups/youtarr/database-YYYYMMDD database
     docker compose up -d
     ```

   - **Named volume installs**:
     ```bash
     docker compose down
     docker volume rm youtarr-db-data
     docker run --rm \
       -v youtarr-db-data:/var/lib/mysql \
       -v /volume1/backups/youtarr:/backup \
       busybox sh -c 'cd /var/lib/mysql && tar xzf /backup/youtarr-db-YYYYMMDD.tar.gz'
     docker compose up -d
     ```
     > Replace `youtarr-db-data` if you customized the volume name.

---

## Performance Optimization for Synology

### Reduce Docker Logging Overhead

Large log files can impact performance. Limit log size:

```bash
# Edit docker-compose.yml
vi docker-compose.yml
```

> **Tip**: Use `Esc` then `:wq` to save in `vi`. If you installed `nano`, you can run `nano docker-compose.yml` instead.

Add logging configuration to both services:

```yaml
services:
  youtarr-db:
    # ... existing config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  youtarr:
    # ... existing config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Apply changes:
```bash
docker compose down && docker compose up -d
```

### Use SSD Cache (If Available)

If your NAS has SSD cache:
1. Storage Manager → SSD Cache
2. Create read-write cache
3. Enable for volume containing Docker data

### Schedule Downloads During Low-Activity Periods

Configure Youtarr's cron schedule for late night:
- Configuration → Download Schedule
- Example: `0 2 * * *` (runs at 2 AM daily)

---

## Uninstalling Youtarr

To completely remove Youtarr:

```bash
# Stop and remove containers
cd /volume1/docker/Youtarr
docker compose down -v

# Remove application files
cd /volume1/docker
rm -rf Youtarr

# Optional: Remove downloaded videos
# rm -rf /volume1/media/youtube
```

---

## Additional Resources

- **Main Documentation**: [README.md](../../README.md)
- **Docker Guide**: [DOCKER.md](../DOCKER.md)
- **Media Server Setup**: [MEDIA_SERVERS.md](../MEDIA_SERVERS.md)
- **General Troubleshooting**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **GitHub Issues**: [Report problems](https://github.com/DialmasterOrg/Youtarr/issues)

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the logs**:
   ```bash
   docker compose logs -f
   ```

2. **Search existing issues**: [GitHub Issues](https://github.com/DialmasterOrg/Youtarr/issues)

3. **Create a new issue** with:
   - Your Synology model and DSM version
   - Contents of `.env` file (redact passwords)
   - Output of `docker compose ps`
   - Relevant logs from `docker compose logs`

---
