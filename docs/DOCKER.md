# Docker Configuration and Management

## Architecture Overview

Youtarr uses Docker Compose with two containers:
- **youtarr**: Main application container (Node.js/React)
- **youtarr-db**: MariaDB database container

## Container Details

### Application Container (youtarr)
- **Image**: `dialmaster/youtarr:latest`
- **Exposed Ports**:
  - 3087 → 3011 (Web interface)
  - 3088 → 3012 (WebSocket)
- **Volumes**:
  - `./config:/app/config` - Configuration files
  - `./database:/app/database` - SQLite fallback
  - `./logs:/app/logs` - Application logs
  - YouTube output directory (configured during setup)

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
docker exec -it youtarr-db mysql -u root -pyoutarr123 youtarr
```

## Environment Variables

Set in docker-compose.yml:

```yaml
environment:
  - IN_DOCKER_CONTAINER=1
  - DB_HOST=youtarr-db
  - DB_PORT=3306
  - DB_USER=root
  - DB_PASSWORD=youtarr123
  - DB_NAME=youtarr
  - YOUTUBE_OUTPUT_DIR=${YOUTUBE_OUTPUT_DIR}
```

## Volume Management

### Persistent Data Locations

- **Database**: Docker volume `youtarr_db_data`
- **Config**: `./config` directory
- **Logs**: `./logs` directory
- **Videos**: User-specified directory (set via setup.sh)

### Backup and Restore

**Backup database**:
```bash
docker exec youtarr-db mysqldump -u root -pyoutarr123 youtarr > backup.sql
```

**Restore database**:
```bash
docker exec -i youtarr-db mysql -u root -pyoutarr123 youtarr < backup.sql
```

**Backup all data**:
```bash
# Stop containers first
./stop.sh

# Create backup
tar -czf youtarr-backup.tar.gz config/ database/ logs/

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

Default password is `youtarr123`. To change:

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