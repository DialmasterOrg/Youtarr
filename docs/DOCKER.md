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
  - `./migrations:/app/migrations` - DB migrations

### Database Container (youtarr-db)
- **Image**: `mariadb:10.3`
- **Port**: 3321 (both host and container)
- **Volumes**:
  - `youtarr_db_data:/var/lib/mysql` - Database persistence
- **Character Set**: utf8mb4 (full Unicode support)

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

#### What Happens in Platform Mode

When `DATA_PATH` is set:
1. **Auto-Configuration**: If no config.json exists, one is created automatically with:
   - Video output directory set to `DATA_PATH` value
   - Plex URL set to `PLEX_URL` if provided
   - Sensible defaults for all other settings

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

When running in Docker, use these addresses for Plex:
- `host.docker.internal` - Recommended for Docker Desktop
- Host machine's IP address - For Docker Engine on Linux

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
