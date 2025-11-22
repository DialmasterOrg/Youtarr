# Environment Variables Reference

This document provides a comprehensive reference for all environment variables supported by Youtarr.

## Table of Contents
- [Required Variables](#required-variables)
- [Database Configuration](#database-configuration)
- [Authentication](#authentication)
- [User and Permissions](#user-and-permissions)
- [Platform Deployment](#platform-deployment)
- [Development and Debugging](#development-and-debugging)
- [Docker Configuration](#docker-configuration)

## Required Variables

### YOUTUBE_OUTPUT_DIR
**Required**: Yes
**Default**: `./downloads`
**Description**: Directory on the host machine where downloaded YouTube videos will be stored
**Example Values**:
- Linux/Mac: `/mnt/media/youtube` or `/home/user/videos/youtube`
- Windows: `C:/Media/YouTube` (use forward slashes)
- Synology NAS: `/volume1/media/youtube`

**Important Notes**:
- This path must exist on your host system before starting the containers
- Ensure the directory has appropriate write permissions for the configured UID/GID
- For network storage, mount the storage before starting Youtarr

## Database Configuration

### Internal Database (Default)
When using the bundled MariaDB container, these variables typically use their defaults:

### DB_HOST
**Required**: No
**Default**: `youtarr-db` (internal container name)
**Description**: Database hostname or IP address
**Example**: `192.168.1.100` (for external database)

### DB_PORT
**Required**: No
**Default**: `3321`
**Description**: Database port number
**Note**: Both internal and external databases use port 3321 as the default for Youtarr

### DB_USER
**Required**: No
**Default**: `root`
**Description**: Database username
**Note**: If switching from root, ensure MYSQL_USER is configured in docker-compose.yml

### DB_PASSWORD
**Required**: No
**Default**: `123qweasd`
**Description**: Database password
**Security**: Change this in production environments

### DB_NAME
**Required**: No
**Default**: `youtarr`
**Description**: Database name for Youtarr DB

### DB_ROOT_PASSWORD
**Required**: Only for internal database setup
**Default**: `123qweasd`
**Description**: Root password for MariaDB container
**Note**: Only used when creating the internal database container

### External Database Setup
To use an external database:
1. Uncomment and configure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in your .env file
2. Ensure the external database has utf8mb4 character set support
3. See [docs/platforms/external-db.md](platforms/external-db.md) for detailed setup

## Authentication

### AUTH_ENABLED
**Required**: No
**Default**: `true`
**Options**: `true`, `false`
**Description**: Enable/disable built-in authentication
**Warning**: Never set to `false` when exposed to the internet

**Use Cases for Disabling**:
- When only using Youtarr in an environment that is not exposed to the internet
- When behind a VPN
- When using reverse proxy with authentication
- Platform deployments with external auth (e.g., Cloudflare Access)

### AUTH_PRESET_USERNAME
**Required**: No
**Default**: None
**Description**: Pre-configured admin username for automated deployments
**Validation**: 3-32 characters, no leading/trailing spaces

### AUTH_PRESET_PASSWORD
**Required**: No
**Default**: None
**Description**: Pre-configured admin password for automated deployments
**Validation**: 8-64 characters

**Important Notes**:
- These override any existing credentials in config.json
- If not set, credentials must be configured through the web UI on first access via `localhost`
- Useful for deployment environments where you may not have access to `localhost`
  via a browser as this removes the requirement to set your initial login credentials via the web UI.

## User and Permissions

### YOUTARR_UID
**Required**: No
**Default**: `0` (root)
**Recommended**: `1000` (typical first user on Linux)
**Description**: User ID for running Youtarr inside the container

### YOUTARR_GID
**Required**: No
**Default**: `0` (root)
**Recommended**: `1000`
**Description**: Group ID for running Youtarr inside the container

**Important Setup Steps**:

Note: *The `/path/to/youtube/videos` is just an example. Use the path you have configured in your `.env` file.*

1. Create required directories:
   ```bash
   mkdir -p config jobs server/images /path/to/youtube/videos
   ```
2. Set ownership to match UID/GID:
   ```bash
   sudo chown -R 1000:1000 ./config ./jobs ./server/images
   sudo chown -R 1000:1000 /path/to/youtube/videos
   ```

**Affected Directories**:
- `config/*` - Configuration files
- `jobs/*` - Job state and artifacts
- `server/images/*` - Thumbnails and cache
- `${YOUTUBE_OUTPUT_DIR}` - Downloaded videos

## Platform Deployment

### DATA_PATH
**Required**: No (Platform-specific)
**Default**: None
**Description**: Override video storage path inside container
**Example**: `/storage/rclone/storagebox/youtube`
**Used By**: Elfhosted and similar platform deployments. Most users will never need to use this setting.

**Behavior**:
- When set, consolidates all data under `/app/config/`
- Creates platform-specific subdirectories
- Internally the container will write to DATA_PATH instead of the default of `/usr/src/app/data/`

### PLEX_URL
**Required**: No
**Default**: None
**Description**: Pre-configured Plex server URL
**Example**: `http://plex:32400`
**Note**: Overrides plexIp, plexPort and plexViaHttps from config.json

## Development and Debugging

### LOG_LEVEL
**Required**: No
**Default**: `info`
**Options**: `warn`, `info`, `debug`
**Description**: Controls logging verbosity
- `warn`: Minimal logging, errors and warnings only
- `info`: Standard logging for production
- `debug`: Verbose logging for troubleshooting

### TZ
**Required**: No
**Default**: `UTC`
**Description**: Timezone for scheduled jobs and cleanup tasks
**Format**: IANA timezone (e.g., `America/Los_Angeles`, `Europe/Paris`)
**Note**: Affects cron job execution times in Youtarr container.

### YOUTARR_IMAGE
**Required**: No
**Default**: `dialmaster/youtarr:latest`
**Description**: Docker image selection
**Development**: Set to `youtarr-dev:latest` for local builds
**Note**: Development scripts handle this automatically

## Docker Configuration

These variables are used by docker-compose.yml but not directly by the application:

### Container Naming
- Container names are automatically prefixed with the directory name
- Default containers: `youtarr`, `youtarr-db`

### Network Configuration
- Network: `youtarr-network` (internal bridge)
- Application port: 3087 (host) → 3011 (container)
- Database port: 3321 (both host and container)

## Best Practices

### Security
1. **Always change default passwords** in production
2. **Never disable AUTH_ENABLED** for internet-exposed instances
3. **Use non-root UID/GID** (set YOUTARR_UID=1000)
    - Existing Youtarr users that were previously using the default root GID/UID (0:0) will need to completely stop Youtarr and ensure that directory permissions are updated if they want to switch from root UID/GID to non-root
4. **Secure your .env file** with appropriate permissions:
   ```bash
   chmod 600 .env
   ```

### Performance
1. **Use local storage** when possible for better performance
2. **Set appropriate LOG_LEVEL** (`info` for production, `debug` only when needed)
3. **Configure timezone** to match your location for accurate scheduling

### Maintenance
1. **Backup your .env file** along with your configuration
2. **Document any custom variables** for your deployment
3. **Test configuration changes** in a development environment first

## Environment Variable Priority

Variables are processed in this order (highest to lowest priority):
1. Environment variables set at runtime
2. Variables defined in .env file
3. Default values in docker-compose.yml
4. Application defaults

## Troubleshooting

### Permission Errors
If you see "Permission denied" errors:
1. Check YOUTARR_UID/GID match your file ownership
2. Verify directory permissions with `ls -la`
3. Fix ownership: `sudo chown -R ${UID}:${GID} ./config ./jobs ./server/images`

### Database Connection Issues
1. Verify DB_HOST is reachable: `ping ${DB_HOST}`
2. Check DB_PORT is open: `telnet ${DB_HOST} ${DB_PORT}`
3. Confirm credentials with: `mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p`

### Authentication Problems
1. If locked out, set AUTH_PRESET_USERNAME and AUTH_PRESET_PASSWORD
2. These override existing credentials on each restart
3. Remove them after regaining access to prevent continued override (or leave them in place to prevent any updates to credentials via the web UI)
