# Docker Configuration and Management

## Architecture Overview

Youtarr uses Docker Compose with two containers:
- **youtarr**: Main application container (Node.js/React)
- **youtarr-db**: MariaDB database container

## Container Details

### Application Container (youtarr)
- **Image**: `dialmaster/youtarr:latest`
- **Exposed Ports**:
  - 3087 → 3011 (Web interface + WebSocket)
- **Volumes**:
  - `${YOUTUBE_OUTPUT_DIR}:/usr/src/app/data` - Videos directory
  - `./server/images:/app/server/images` - Thumbnails/cache
  - `./config:/app/config` - Configuration files
  - `./jobs:/app/jobs` - Job state and artifacts

### Database Container (youtarr-db)
- **Image**: `mariadb:10.3`
- **Port**: 3321 (both host and container)
- **Volumes**:
  - `./database:/var/lib/mysql` - Database persistence (default)
  - `youtarr-db-data:/var/lib/mysql` - Named volume (required for ARM/Synology)
- **Character Set**: utf8mb4 (full Unicode support)

> **ARM Users**: See [ARM Architecture Notes](#arm-architecture-apple-silicon-raspberry-pi) below.

## ⚠️ Important: Do Not Mount the Migrations Directory

Avoid adding a `./migrations:/app/migrations` volume. The production image already includes the migration files it needs.

### Why This Matters

If you mount an empty or missing local migrations directory (common with Ansible, Terraform, or Kubernetes automation), it overwrites the packaged migrations and the database bootstrap will fail.

```yaml
# ❌ WRONG - Causes DB initialization failures
volumes:
  - ./migrations:/app/migrations

# ✅ CORRECT - Use migrations from the image
volumes:
  - ${YOUTUBE_OUTPUT_DIR}:/usr/src/app/data
  - ./server/images:/app/server/images
  - ./config:/app/config
  - ./jobs:/app/jobs
```

If your automation creates a migrations directory, remove it from both directory creation and volume mounts.

## ARM Architecture (Apple Silicon, Raspberry Pi)

ARM-based systems (Apple Silicon Macs, Raspberry Pi, etc.) have known issues with MariaDB bind mounts due to virtiofs bugs. The start scripts automatically detect ARM and apply the fix.

### Using Start Scripts (Recommended)

The `./start.sh` script automatically detects ARM architecture and applies the correct configuration:
```bash
./start.sh
```

### Using Docker Compose Directly

If you prefer running `docker compose` commands directly on ARM systems, use the override file:
```bash
docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d
```

This uses a named Docker volume instead of a bind mount for MariaDB data, avoiding the virtiofs issues.

### Manual Configuration

Alternatively, edit `docker-compose.yml` directly:
```yaml
services:
  youtarr-db:
    volumes:
      # Comment out bind mount:
      # - ./database:/var/lib/mysql
      # Use named volume:
      - youtarr-db-data:/var/lib/mysql

# Add at the bottom:
volumes:
  youtarr-db-data:
```

See [Troubleshooting](TROUBLESHOOTING.md#apple-silicon--arm-incorrect-information-in-file-errors) for more details on the underlying issue.

## Configuration Setup
- **Create a .env file** to configure environment variables:
    ```bash
    cp .env.example .env
    vim .env  # Set YOUTUBE_OUTPUT_DIR to your video storage path
    ```
    See: [ENVIRONMENT_VARIABLES](ENVIRONMENT_VARIABLES.md) for more details
- **Alternative**: Edit `docker-compose.yml` to hardcode your volume mount:
    ```yaml
    volumes:
    - /your/host/path:/usr/src/app/data  # Replace ${YOUTUBE_OUTPUT_DIR} with your path
    ```
- Start containers with `docker compose up -d`
- Container auto-creates `config.json`
- **UI Behavior**: YouTube Output Directory field is **read-only** - shows "Docker Volume" chip
- **Host Path Reminder**: Create the `/your/host/path` directory ahead of time and ensure it is writable. Docker will otherwise create it as root-owned!

### Network Storage

When using network storage:

1. **Mount your network storage BEFORE starting Youtarr**

Examples:
- Linux with NFS mount: `/mnt/nas/youtube`
- Windows with mapped drive: `Z:/Youtube_videos`
- macOS with SMB mount: `/Users/username/nas-youtube`
- Docker volume mount: `/path/to/mounted/volume`

If you need to change the directory later:
```bash
vim .env # Or your editor of choice
# Change your YOUTUBE_OUTPUT_DIR
```

## Using an External Database

Some users prefer to supply their own MariaDB/MySQL instance instead of the bundled `youtarr-db` container. This is easily supported by setting up your external DB config in .env and then running
Youtarr without the bundled DB via:

- `./start-with-external-db.sh` or `docker compose -f docker-compose.external-db.yml up -d`
- See [External Database Guide](platforms/external-db.md)

Both helpers automatically run migrations against the external database on boot, so no manual schema management is required once connectivity is in place.

## Manual Setup Without Git Clone

This section covers setting up Youtarr when you cannot (or prefer not to) clone the full repository—common in Portainer, TrueNAS, and similar Docker-native environments.

### Important Warnings

**This is an advanced installation method with limitations:**
- No helper scripts (`start.sh`, `stop.sh`, etc.)
- Manual updates required (can't just `git pull`)
- No access to development tools
- More error-prone setup process
- Community support may be limited for this approach

**We strongly recommend cloning the repository if possible.** If you must proceed, follow these steps carefully.

### Prerequisites

- Docker and Docker Compose installed
- Terminal/SSH access to your system
- Basic understanding of Linux file permissions

### Setup Steps

#### 1. Create Working Directory

```bash
mkdir -p youtarr && cd youtarr
```

#### 2. Download Required Files

```bash
# Download docker-compose.yml
wget https://raw.githubusercontent.com/DialmasterOrg/Youtarr/main/docker-compose.yml

# Download environment template
wget https://raw.githubusercontent.com/DialmasterOrg/Youtarr/main/.env.example -O .env.example
```

**Alternative for systems without wget:**
- Manually copy `docker-compose.yml` from [GitHub](https://github.com/DialmasterOrg/Youtarr/blob/main/docker-compose.yml)
- Manually copy `.env.example` from [GitHub](https://github.com/DialmasterOrg/Youtarr/blob/main/.env.example)

#### 3. Configure Environment

```bash
# Create your environment file
cp .env.example .env

# Edit configuration
vim .env  # or nano, or your preferred editor
```

**Required settings:**
- `YOUTUBE_OUTPUT_DIR` - Must be set to your video storage path
- `TZ` - Your timezone (e.g., `America/New_York`, `Europe/London`)

**Optional settings:**
- `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` - For headless setups
- See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for full reference

#### 4. Create Required Directories

Youtarr needs these directories to exist before first start:

```bash
# Create all required directories
mkdir -p config jobs server/images

# Create your download directory (adjust path to match YOUTUBE_OUTPUT_DIR in .env)
mkdir -p downloads  # If using default ./downloads
# OR
mkdir -p /path/to/your/custom/location  # If using custom path
```

#### 5. Set Permissions

**If using UID/GID (1000:1000):**
```bash
sudo chown -R 1000:1000 config jobs server/images downloads
```

**If you configured custom YOUTARR_UID and YOUTARR_GID in .env:**
```bash
# Replace 1001:1001 with your configured UID:GID
sudo chown -R 1001:1001 config jobs server/images downloads
```

**Permission verification:**
```bash
ls -la config jobs server/images downloads
# All directories should show ownership matching your configured UID:GID
```

#### 6. Start Containers

```bash
docker compose up -d
```

#### 7. Verify Startup

```bash
# Check container status
docker compose ps

# Check logs for errors
docker compose logs -f

# Access web interface
# Navigate to http://your-server-ip:3087
```

### What You're Missing

By not cloning the repository, you lose access to:

| Missing Component | Impact |
|-------------------|--------|
| `start.sh` / `stop.sh` | Convenient start/stop management |
| `start-with-external-db.sh` | Easy external database setup |
| Helper scripts | Database migration tools, reset scripts |
| Local documentation | Offline access to guides |
| Development environment | Can't contribute changes easily |

### Updating Youtarr

Without Git, updates require manual steps:

```bash
# 1. Stop containers
docker compose down

# 2. Backup your configuration (recommended)
tar -czf backup-$(date +%Y%m%d).tar.gz config jobs

# 3. Download updated docker-compose.yml
wget https://raw.githubusercontent.com/DialmasterOrg/Youtarr/main/docker-compose.yml -O docker-compose.yml

# 4. Pull latest images
docker compose pull

# 5. Start with new version
docker compose up -d

# 6. Check logs for issues
docker compose logs -f
```

**Note**: Check [.env.example](https://github.com/DialmasterOrg/Youtarr/blob/main/.env.example) for new variables after major updates.

### Platform-Specific Notes

#### Portainer
- Use "Stacks" feature to paste docker-compose.yml content
- Environment variables can be set in the Portainer UI under "Environment variables"
- Create required directories via Portainer console or host SSH access
- Ensure volume paths are accessible from the Docker host

#### TrueNAS Scale
- Use "Custom App" feature in Apps section
- Map host paths carefully in volume configuration
- Ensure datasets exist before creating the app
- Consider using IX-applications for easier management

#### Unraid
- See [Unraid Guide](platforms/unraid.md) for template-based installation

### Troubleshooting Manual Setup

**Problem**: Container fails to start with "no such file or directory"

**Solution**: Verify all directories exist:
```bash
ls -la config jobs server/images
# All should exist and have correct permissions
```

**Problem**: "Permission denied" errors in logs

**Solution**:
```bash
# Check configured UID/GID in .env
grep YOUTARR_ .env

# Verify directory ownership matches
ls -ln config jobs server/images downloads

# Fix permissions (replace UID:GID with your values)
sudo chown -R 1000:1000 config jobs server/images downloads
```

**Problem**: "empty section between colons" error when starting

**Solution**: `YOUTUBE_OUTPUT_DIR` is not set in .env
```bash
grep YOUTUBE_OUTPUT_DIR .env
# Should show a valid path, not empty or commented out
```

**Problem**: Database initialization fails

**Solution**: Ensure database directory has correct permissions
```bash
# If using bind mount for database (default)
mkdir -p database
sudo chown -R 999:999 database  # MariaDB runs as UID 999

# Or switch to named volume (see DATABASE.md)
```

**Problem**: Videos download but aren't visible in media server

**Solution**:
- Verify `YOUTUBE_OUTPUT_DIR` path is correct
- Check that the path is accessible to both Youtarr and your media server
- Ensure permissions allow your media server to read files
- Trigger a manual library scan in your media server

### When to Use This Method

**Good use cases:**
- Portainer/TrueNAS/similar Docker-native platforms where Git is unavailable
- Systems where Git is not installed or cannot be installed
- Testing Youtarr in isolated environments
- Automated deployment scripts (though Git is still recommended)

**Bad use cases:**
- Development or contribution work (clone the repo!)
- Systems with Git available (use Method 1 or 2 instead)
- Users uncomfortable with manual configuration and troubleshooting
- Production environments where easy updates are important

### Getting Help

If you encounter issues with manual setup:

1. Verify you followed all steps exactly as documented
2. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
3. Review Docker logs: `docker compose logs -f youtarr`
4. When reporting issues on [GitHub](https://github.com/DialmasterOrg/Youtarr/issues):
   - Mention you're using manual installation (Method 3)
   - Provide your `.env` configuration (redact sensitive data)
   - Include relevant log output
   - Describe your platform (Portainer, TrueNAS, etc.)

**Note**: Community support for manual installations may be limited compared to standard Git-based installations. The recommended installation methods provide better support and easier troubleshooting.

## Docker Commands

### Starting and Stopping

```bash
# Start containers
docker compose up -d

# Stop containers
docker compose down

# View status
docker compose ps
```

### Viewing Logs

```bash
# All containers
docker compose logs -f

# Specific container
docker compose logs -f youtarr
docker compose logs -f youtarr-db

# Last 100 lines
docker compose logs --tail=100
```

### Container Management

```bash
# Restart containers
docker compose restart

# Rebuild containers (after image updates)
docker compose up -d --build

# Remove containers (preserves data)
docker compose down

# Remove containers AND volumes (WARNING: deletes data)
docker compose down -v
```

### Accessing Container Shell

```bash
# Application container
docker exec -it youtarr bash

# Database container
docker exec -it youtarr-db bash

# Direct database access
docker exec -it youtarr-db mysql -u root -p123qweasd youtarr
```

## Environment Variables

### Configuration Methods

You can configure environment variables in three ways:

1. **Using .env file**:
   ```bash
   cp .env.example .env
   nano .env  # Edit your configuration
   ```
   Docker Compose automatically reads `.env` and substitutes variables in docker-compose.yml.

2. **Hardcoding in docker-compose.yml**:
   Edit the compose file directly (not recommended - makes upgrades harder).

See: [ENVIRONMENT_VARIABLES](ENVIRONMENT_VARIABLES.md) for more details

### Platform Deployment Configuration

Youtarr supports platform-managed deployments (Elfhosted, Kubernetes, etc.) with three special environment variables:

#### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATA_PATH` | Video storage path inside container (only really needed for Elfhosted) | `/storage/rclone/storagebox/youtube` |
| `AUTH_ENABLED` | Set to `false` to bypass internal authentication | `false` |
| `PLEX_URL` | Pre-configured Plex server URL, overrides plexIp and plexPort from config.json | `http://plex:32400` |

### Preset Credentials for Headless Deployments

For platforms where you cannot access `http://localhost:3087` (Unraid, Kubernetes, etc.), you can seed the initial login without touching the UI by setting both environment variables below. These values will override and overwrite existing values in config.json

| Variable | Description |
|----------|-------------|
| `AUTH_PRESET_USERNAME` | Initial admin username. Trimmed and must be ≤ 32 characters. |
| `AUTH_PRESET_PASSWORD` | Initial admin password (8–64 characters). Stored as a hash on first boot. |

If only one variable is present, or the values fall outside the validation rules, the preset is ignored and the localhost-only setup wizard remains active.

#### What Happens in Platform Mode

When `DATA_PATH` is set:
1. **Consolidated Storage**: All persistent data aside from downloaded videos is stored under `/app/config/`:
   - `/app/config/config.json` - Configuration file
   - `/app/config/images/` - Channel and video thumbnails
   - `/app/config/jobs/` - Job state and metadata

2. **Protected Settings**: In the web UI:
   - Plex URL field is disabled if `PLEX_URL` is set
   - Users can still configure Plex API key and other settings

When `AUTH_ENABLED=false`:
- No login required - authentication handled by platform (OAuth, Authelia, Cloudflared, etc...)
- Login/logout buttons hidden in UI
- All API endpoints accessible without token

## Volume Management

### Persistent Data Locations

- **Database**: `./database` directory
- **Config**: `./config` directory
- **Videos**: User-specified directory (set via `YOUTUBE_OUTPUT_DIR`)
- **Images/Jobs**: `./server/images` and `./jobs` directories

### Network Storage (NAS) Configuration

Youtarr fully supports network-attached storage for your media library. This allows Youtarr and Plex to run on separate machines while sharing the same media storage.

#### Requirements
- Network share accessible from the Docker host
- Write permissions for Youtarr
- Read permissions for Plex (can be on a different machine)

#### Mounting NAS/Network Shares

**Linux Example (NFS)**:
```bash
# Create mount point
sudo mkdir -p /mnt/nas/youtube

# Mount NFS share
sudo mount -t nfs nas-server:/volume/youtube /mnt/nas/youtube

# Make persistent (add to /etc/fstab)
nas-server:/volume/youtube /mnt/nas/youtube nfs defaults 0 0
```

**Linux Example (SMB/CIFS)**:
```bash
# Create mount point
sudo mkdir -p /mnt/nas/youtube

# Mount SMB share (create credentials file for security)
echo "username=your_username" > ~/.smbcredentials
echo "password=your_password" >> ~/.smbcredentials
echo "domain=your_domain" >> ~/.smbcredentials
chmod 600 ~/.smbcredentials

# Mount
sudo mount -t cifs //nas-server/youtube /mnt/nas/youtube -o credentials=~/.smbcredentials,uid=1000,gid=1000

# Make persistent (add to /etc/fstab)
//nas-server/youtube /mnt/nas/youtube cifs credentials=/home/user/.smbcredentials,uid=1000,gid=1000 0 0
```

**Windows Example (Network Drive)**:
```bash
# Map network drive in Windows
net use Z: \\nas-server\youtube /persistent:yes

# Use the mapped drive path in .env or during initial ./start.sh setup
# Enter: Z:/Youtube_videos
```

**macOS Example (SMB)**:
```bash
# Mount via Finder or command line
mkdir ~/nas-youtube
mount_smbfs //username@nas-server/youtube ~/nas-youtube

# Use the mount path in .env or during initial ./start.sh setup
# Enter: /Users/username/nas-youtube
```

#### Docker Compose Configuration

Once your network storage is mounted on the host, configure it using `YOUTUBE_OUTPUT_DIR`:

#### Troubleshooting NAS Issues

**Permission Denied Errors**:
- Ensure the Docker user has write permissions to the NAS mount
- On Linux, check uid/gid in mount options match Docker container user
- Test write permissions: `touch /mnt/nas/youtube/test.txt`

**Mount Not Accessible in Container**:
```bash
# Verify mount is active on host
mount | grep nas

# Test access from container
docker exec youtarr ls -la /usr/src/app/data

# Check permissions
docker exec youtarr touch /usr/src/app/data/test.txt
```

**Slow Performance**:
- Check network connectivity between Docker host and NAS
- Consider mounting with performance options:
  ```bash
  # NFS with async writes
  mount -t nfs -o async,noatime nas-server:/youtube /mnt/nas/youtube

  # SMB with larger buffer
  mount -t cifs -o cache=loose,rsize=130048,wsize=130048 //nas-server/youtube /mnt/nas/youtube
  ```

**Plex Can't See Files**:
- Verify Plex has read access to the same network path
- Ensure consistent file paths between Youtarr and Plex
- Check file permissions after download (should be readable by Plex user)

### Backup and Restore

**Backup database**:
```bash
docker exec youtarr-db mysqldump -u root -p123qweasd youtarr > backup.sql
```

**Restore database**:
```bash
docker exec -i youtarr-db mysql -u root -p123qweasd youtarr < backup.sql
```

**Backup all data**:
```bash
# Stop containers first
./stop.sh

# Create backup
tar -czf youtarr-backup.tar.gz config/ database/ jobs/ server/images/

# Include database directory (default compose setup)
tar -czf db-backup.tar.gz database/

# If you switched to a named Docker volume, adjust the command accordingly:
# docker run --rm -v your_volume_name:/data -v $(pwd):/backup alpine tar -czf /backup/db-backup.tar.gz -C /data .
```

## Health Checks

The application container includes health checks:
- Checks database connectivity before starting
- Retries on failure with exponential backoff
- Maximum 30 retry attempts

## Network Configuration

- Internal network: `youtarr-network`
- Container communication uses internal hostnames
- External access through mapped ports

### Plex Server Communication

#### Same Machine Setup
When Youtarr and Plex run on the same machine:
- Docker Desktop (Windows/macOS): `host.docker.internal` or host LAN IP (e.g., `192.168.x.x`)
- Docker on macOS without Docker Desktop (e.g., Colima): host LAN IP (e.g., `192.168.x.x`) or `host.lima.internal`
- Docker on Linux: host LAN IP (e.g., `192.168.x.x`). The default bridge IP (`172.17.0.1`) usually won't work unless Plex is bound to the Docker bridge.
- Explicit host mapping: add `--add-host host.docker.internal:<host-ip>` when starting the container if you prefer that hostname on Linux.
- Plex defaults to port `32400`. If you use a custom Plex port, update the Plex Port field or include the port in `PLEX_URL`.

#### Separate Machine Setup
When Youtarr and Plex run on different machines:
- Use Plex server's IP address or hostname
- Example: `http://192.168.1.100:32400` or `http://plex-server.local:32400`
- Ensure network connectivity between machines
- Both machines must have access to the same media storage location

#### Testing Plex Connection
```bash
# From Youtarr container
docker exec youtarr curl -I http://your-plex-server:32400/web

# Should return HTTP 200 or 301
```

### Updating to Latest Version

```bash
# Stop containers
docker compose down

# Ensure you are on the `main` branch and then
git pull

# Pull latest images
docker compose pull

# Start with new images
docker compose up -d
```

## Performance Tuning

### Memory Limits

Add to docker-compose.yml if needed:
```yaml
services:
  youtarr:
    mem_limit: 2g
    mem_reservation: 1g
```

### CPU Limits

```yaml
services:
  youtarr:
    cpus: '2.0'
```

## Common Docker Issues

### Disk Space

Check available space:
```bash
docker system df
```

Clean up unused resources:
```bash
docker system prune -a
```

### Permission Issues

If videos aren't accessible:
1. Check directory permissions
2. Ensure Docker has access to the directory
3. On Linux, may need to adjust user/group IDs

### Port Conflicts

If ports are already in use:
1. Check what's using the port:
   ```bash
   netstat -tulpn | grep 3087
   ```

2. Either stop the conflicting service or change Youtarr's ports in docker-compose.yml

## Docker Compose Version

The start/stop scripts automatically detect your Docker Compose version:
- `docker compose` (v2) - Recommended
- `docker-compose` (v1) - Legacy support

To check your version:
```bash
docker compose version
# or
docker-compose version
```

## Security Considerations

### Network Isolation

Containers communicate on isolated network. External access only through explicitly mapped ports.

### Running as Non-Root

For enhanced security on Linux, configure user in .env:
```yaml
YOUTARR_UID=1000
YOUTARR_GID=1000
```

** WARNING, if previously running as root, you will need to MANUALLY change ownership of your YOUTUBE_OUTPUT_DIR as well as: **
```
config/*
jobs/*
server/images/*
```

If adjusting these settings, stop Youtarr, then fix ownership, then update .env, then restart.

Example to fix ownership (example YOUTUBE_OUTPUT_DIR given)
```
sudo chown -R 1000:1000 /mnt/c/my_youtarr_videos ./config ./jobs ./server/images
```
## Development with Docker

See [DEVELOPMENT.md](DEVELOPMENT.md) for running Youtarr in development mode with Docker.
