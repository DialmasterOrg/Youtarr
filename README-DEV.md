# Development instructions

These instructions are meant to explain how to do local development.
They will show you how to run a local server with hot reload for both the Node.js server and the React client, as well as how to run database migrations.

Youtarr uses Docker Compose with separate containers:
- **youtarr**: Node.js application container
- **youtarr-db**: MariaDB 10.3 database container

1. Build and start the development environment:
   ```bash
   ./scripts/build-dev.sh
   ./scripts/start-dev.sh
   ```
   - Optional: append `--no-auth` only when developing behind your own authentication gateway (Cloudflare Tunnel, VPN, etc.); never expose a no-auth instance directly to the internet

2. View logs:
   ```bash
   docker compose -f docker-compose.dev.yml logs -f
   ```

3. Stop the development environment:
   ```bash
   ./scripts/stop-dev.sh
   ```

## Building and Testing

### Creating a test docker image for local validation

1. Build the development image:
   ```bash
   ./scripts/build-dev.sh
   ```
   - Add `--install-deps` flag if this is your first build
   - Add `--no-cache` flag to force download of latest yt-dlp

2. Start the development containers:
   ```bash
   ./scripts/start-dev.sh
   ```

3. Stop the development containers:
   ```bash
   ./scripts/stop-dev.sh
   ```

## Creating a release build

The release process is now automated via GitHub Actions:

1. Merge your changes to the `main` branch
2. Go to Actions → "Create Release V2" → Run workflow
3. The workflow will:
   - Bump the version
   - Build the optimized Docker image (~600MB)
   - Push to Docker Hub with version and latest tags

## Docker Compose Details

### Files
- `docker-compose.yml` - Production configuration
- `docker-compose.dev.yml` - Development configuration
- `Dockerfile` - Multi-stage build for optimized image size

### DB details
- MariaDB runs separately (port 3321)
- Application connects via `DB_HOST` environment variable
- Database data persists in `./database` directory
- All scripts support both `docker compose` (v2) and `docker-compose` (v1)

### Useful Commands
```bash
# View running containers
docker compose ps

# View logs for specific service
docker compose logs -f youtarr
docker compose logs -f youtarr-db

# Restart a specific service
docker compose restart youtarr

# Execute commands in running container
docker compose exec youtarr bash
docker compose exec youtarr-db mysql -p123qweasd
```

## Environment Variables

The application uses these environment variables for database connection:
- `DB_HOST` - Database host (default: localhost, docker-compose sets to youtarr-db)
- `DB_PORT` - Database port (default: 3321)
- `DB_USER` - Database user (default: root)
- `DB_PASSWORD` - Database password (default: 123qweasd)
- `DB_NAME` - Database name (default: youtarr)
