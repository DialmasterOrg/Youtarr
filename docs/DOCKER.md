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

> **⚠️ CRITICAL**: Do **NOT** mount `./migrations:/app/migrations` as a volume. See [warning below](#critical-do-not-mount-migrations-volume).

### Database Container (youtarr-db)
- **Image**: `mariadb:10.3`
- **Port**: 3321 (both host and container)
- **Volumes**:
  - `youtarr_db_data:/var/lib/mysql` - Database persistence
- **Character Set**: utf8mb4 (full Unicode support)

## ⚠️ CRITICAL: Do Not Mount Migrations Volume

**DO NOT** mount `./migrations:/app/migrations` as a volume. Migrations are already included in the Docker image.

### Why This Matters

If you mount an empty or missing local migrations directory (common with Ansible, Terraform, or Kubernetes automation), it **overwrites** the migrations in the image, causing database initialization to fail.

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

**Note:** `docker-compose.dev.yml` does mount migrations for development convenience only.

## Configuration Setup

### Automatic Config Creation (NEW)

Starting with version 1.23.0, Youtarr now **automatically creates** a `config/config.json` file on first boot if one doesn't exist. This improves the Docker experience for users who manually configure their containers.

#### Two Setup Methods

1. **Using setup.sh + start.sh (Recommended)**
   - Run `./setup.sh` to configure your YouTube video directory
   - Script creates `config.json` with your chosen host path
   - Use `./start.sh` to start containers (reads path from config and sets volume mount)
   - If no admin credentials exist, `./start.sh` prompts for an initial username/password and exports them as `AUTH_PRESET_USERNAME` / `AUTH_PRESET_PASSWORD` for the upcoming container boot
   - Use `./stop.sh` to stop containers
   - **UI Behavior**: YouTube Output Directory field is **editable** - changes require restart via `./start.sh`

2. **Manual Docker Configuration (docker-compose directly)**
   - Skip setup.sh entirely
   - **IMPORTANT**: You **must** edit `docker-compose.yml` first to hardcode your volume mount:
     ```yaml
     volumes:
       - /your/host/path:/usr/src/app/data  # Replace ${YOUTUBE_OUTPUT_DIR} with your path
     ```
   - Running `docker compose up` without this edit will fail with: `invalid spec: :/usr/src/app/data: empty section between colons`
   - After editing the compose file, start containers with `docker compose up -d`
   - Container auto-creates `config.json` with `/usr/src/app/data` (container's internal path)
   - **UI Behavior**: YouTube Output Directory field is **read-only** - shows "Docker Volume" chip

#### How Volume Mounts Work

The actual storage location depends on your setup method:

| Setup Method | Volume Mount Source | Config Value | UI Behavior |
|--------------|-------------------|--------------|-------------|
| setup.sh + start.sh | `${YOUTUBE_OUTPUT_DIR}` from config.json | Your host path (e.g., `/mnt/videos`) | Editable |
| Manual docker-compose | Hardcoded in docker-compose.yml | `/usr/src/app/data` (container path) | Read-only |

#### What You'll See in the UI

**If you used setup.sh:**
- YouTube Output Directory field is editable
- Shows your actual host path
- Can be changed (requires restart with `./start.sh`)

**If you manually configured docker-compose.yml:**
- YouTube Output Directory field shows "Docker Volume" chip
- Field is disabled (read-only) showing `/usr/src/app/data`
- Helper text: "This path is configured by your Docker volume mount. To change where videos are saved, update the volume mount in your docker-compose.yml file."

### Setup Script for Network Storage

The `setup.sh` script validates that your chosen directory exists and is accessible. When using network storage:

1. **Mount your network storage BEFORE running setup.sh**
2. **Enter the full path to the mounted directory** when prompted
3. **The script will verify the directory exists** and is writable

Examples:
- Linux with NFS mount: `/mnt/nas/youtube`
- Windows with mapped drive: `Z:/Youtube_videos`
- macOS with SMB mount: `/Users/username/nas-youtube`
- Docker volume mount: `/path/to/mounted/volume`

If you need to change the directory later:
```bash
# Re-run setup to change directory
./setup.sh

# Or manually edit config/config.json
# Update "youtubeOutputDirectory" value
```

## Using an External Database

Some users prefer to supply their own MariaDB/MySQL instance instead of the bundled `youtarr-db` container. You now have two helper scripts:

- Copy `config/external-db.env.example` to `config/external-db.env` and enter your credentials
- Run `./start.sh --external-db` to launch only the application container via Docker Compose (uses `docker-compose.external-db.yml`)
- Run `./start-with-external-db.sh` to launch a single container (should work for UNRAID or plain `docker run` workflows)
- Follow the full walkthrough (including a local test harness) in [docs/EXTERNAL_DB.md](EXTERNAL_DB.md)

Both helpers automatically run migrations against the external database on boot, so no manual schema management is required once connectivity is in place.

## Unraid Community Applications Template

Youtarr provides a community Unraid Community Applications template that mirrors the `start-with-external-db.sh` flow.

- Add the template repository URL `https://github.com/DialmasterOrg/unraid-templates` under **Apps → Settings → Manage Template Repositories** on your Unraid server.
- Search for **Youtarr** in the Apps tab and install it. The XML source lives at [DialmasterOrg/unraid-templates/Youtarr.xml](https://github.com/DialmasterOrg/unraid-templates/blob/main/Youtarr/Youtarr.xml) if you want to review or fork it.
- The template is currently distributed from this repository while it awaits inclusion in the main Community Applications feed.
- The template expects an external MariaDB instance. Supply the connection details and map your persistent host paths before clicking **Apply**.
- Provide both `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` so the container initializes with working credentials. If you intentionally leave them blank, be ready to complete the setup wizard from the Unraid host's localhost (for example, by SSH tunneling) because remote access is blocked until auth is configured.
- After installation you can access the UI from the Apps page using the WebUI button (maps to `http://[IP]:[PORT:3011]/` by default).

## Docker Commands

### Starting and Stopping

```bash
# Start containers
./start.sh

# Stop containers
./stop.sh

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

Set in docker-compose.yml:

```yaml
environment:
  - IN_DOCKER_CONTAINER=1
  - DB_HOST=youtarr-db
  - DB_PORT=3321
  - DB_USER=root
  - DB_PASSWORD=123qweasd
  - DB_NAME=youtarr
  - YOUTUBE_OUTPUT_DIR=${YOUTUBE_OUTPUT_DIR}
  # Optional: Custom data path (for Elfhosted or similar platforms)
  # - DATA_PATH=/storage/rclone/storagebox/youtube
```

### Platform Deployment Configuration

Youtarr supports platform-managed deployments (Elfhosted, Kubernetes, etc.) with three special environment variables:

#### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATA_PATH` | Video storage path inside container | `/storage/rclone/storagebox/youtube` |
| `AUTH_ENABLED` | Set to `false` to bypass internal authentication | `false` |
| `PLEX_URL` | Pre-configured Plex server URL | `http://plex:32400` |

### Preset Credentials for Headless Deployments

For platforms where you cannot access `http://localhost:3087` (Unraid, Kubernetes, etc.), you can seed the initial login without touching the UI by setting both environment variables below. They are only applied when the config file does not already contain credentials.

| Variable | Description |
|----------|-------------|
| `AUTH_PRESET_USERNAME` | Initial admin username. Trimmed and must be ≤ 32 characters. |
| `AUTH_PRESET_PASSWORD` | Initial admin password (8–64 characters). Stored as a hash on first boot. |

If only one variable is present, or the values fall outside the validation rules, the preset is ignored and the localhost-only setup wizard remains active. Once the credentials are saved to `config/config.json`, subsequent restarts ignore the preset variables so they can safely remain in your container template.

#### What Happens in Platform Mode

When `DATA_PATH` is set:
1. **Auto-Configuration**: If no config.json exists, one is created automatically with:
   - Video output directory set to `DATA_PATH` value
   - Plex URL set to `PLEX_URL` if provided
   - Sensible defaults for all other settings
   - **Note**: This platform behavior is unchanged - DATA_PATH deployments continue to work exactly as before

2. **Consolidated Storage**: All persistent data is stored under `/app/config/`:
   - `/app/config/config.json` - Configuration file
   - `/app/config/images/` - Channel and video thumbnails
   - `/app/config/jobs/` - Job state and metadata

3. **Protected Settings**: In the web UI:
   - YouTube Output Directory field is disabled (shows "Platform Managed")
   - Plex URL field is disabled if `PLEX_URL` is set
   - Users can still configure Plex API key and other settings

When `AUTH_ENABLED=false`:
- No login required - authentication handled by platform (OAuth, Authelia, etc.)
- Login/logout buttons hidden in UI
- All API endpoints accessible without token

#### Standard vs Platform Deployments

| Aspect | Standard Docker | Platform Deployment |
|--------|----------------|---------------------|
| Config creation | Manual via setup.sh | Auto-created if DATA_PATH set |
| Video storage | Volume mount to host | Platform-managed path |
| Authentication | Built-in password | Optional (AUTH_ENABLED) |
| Storage paths | Separate mounts | Consolidated under /app/config |
| Plex URL | User configured | Can be pre-configured |

**Note**: Standard Docker users don't need these variables. They're only for platform deployments that can't use traditional Docker volume mounts.

#### Example Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: youtarr
spec:
  template:
    spec:
      containers:
      - name: youtarr
        image: dialmaster/youtarr:latest
        env:
        - name: DATA_PATH
          value: "/storage/youtube"
        - name: AUTH_ENABLED
          value: "false"  # Platform handles auth
        - name: PLEX_URL
          value: "http://plex-service:32400"
        volumeMounts:
        - name: config
          mountPath: /app/config
        - name: youtube-storage
          mountPath: /storage/youtube
      volumes:
      - name: config
        persistentVolumeClaim:
          claimName: youtarr-config
      - name: youtube-storage
        persistentVolumeClaim:
          claimName: youtube-storage
```

## Volume Management

### Persistent Data Locations

- **Database**: Docker volume `youtarr_db_data`
- **Config**: `./config` directory
- **Videos**: User-specified directory (set via setup.sh)
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

# Use the mapped drive path in setup.sh
# Enter: Z:/Youtube_videos
```

**macOS Example (SMB)**:
```bash
# Mount via Finder or command line
mkdir ~/nas-youtube
mount_smbfs //username@nas-server/youtube ~/nas-youtube

# Use the mount path in setup.sh
# Enter: /Users/username/nas-youtube
```

#### Docker Compose Configuration

Once your network storage is mounted on the host, configure it in docker-compose.yml:

```yaml
services:
  youtarr:
    volumes:
      # Local mount path : Container path
      - /mnt/nas/youtube:/usr/src/app/data
      # Or for Windows with mapped drive
      - Z:/Youtube_videos:/usr/src/app/data
```

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

# Include database volume
docker run --rm -v youtarr_db_data:/data -v $(pwd):/backup alpine tar -czf /backup/db-backup.tar.gz -C /data .
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
- Docker Desktop (Windows/macOS): `host.docker.internal`
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

## Upgrading

### From Single Container to Compose (v1.15.0+)

If upgrading from older single-container setup:

1. Stop old container:
   ```bash
   docker stop youtarr
   docker rm youtarr
   ```

2. Pull latest code:
   ```bash
   git pull
   ```

3. Start with new setup:
   ```bash
   ./start.sh
   ```

Your database in `./database` directory is automatically migrated.

### Updating to Latest Version

```bash
# Stop containers
./stop.sh

# Pull latest images
docker compose pull

# Start with new images
./start.sh
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

### Database Password

Default password is `123qweasd`. To change:

1. Update in docker-compose.yml:
   ```yaml
   DB_PASSWORD=your_new_password
   MYSQL_ROOT_PASSWORD=your_new_password
   ```

2. Rebuild database container:
   ```bash
   ./stop.sh
   docker compose down -v  # WARNING: Deletes data
   ./start.sh
   ```

### Network Isolation

Containers communicate on isolated network. External access only through explicitly mapped ports.

### Running as Non-Root

For enhanced security on Linux, configure user in docker-compose.yml:
```yaml
services:
  youtarr:
    user: "1000:1000"
```

## Development with Docker

See [DEVELOPMENT.md](DEVELOPMENT.md) for running Youtarr in development mode with Docker.
