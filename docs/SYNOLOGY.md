# Youtarr on Synology NAS

This guide provides Synology-specific installation instructions for Youtarr. Synology NAS devices running DSM 7+ can run Youtarr using Container Manager (Docker).

## Why Synology Needs Special Instructions

The standard `./setup.sh` and `./start.sh` scripts work well on most Linux systems but may encounter issues on Synology DSM:
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
mkdir -p database
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

### Step 5: Configure Environment Variables

#### Create .env file

Create a `.env` file in the Youtarr directory:

```bash
cd /volume1/docker/Youtarr
vi .env
```

> **Tip**: Synology DSM ships with the BusyBox `vi` editor. If you have installed `nano` separately and prefer it, you can run `nano .env` instead of `vi .env`.

Add the following content (adjust the path to match your video output directory):

```bash
# Required: Set this to your video output directory
YOUTUBE_OUTPUT_DIR=/volume1/media/youtube

# Optional: Set initial admin credentials (highly recommended for headless setup)
AUTH_PRESET_USERNAME=admin
AUTH_PRESET_PASSWORD=YourSecurePassword123

# Optional: Logging level (warn, info, debug)
LOG_LEVEL=warn
```

**Save the file**:
- Press `Esc`, then type `:wq` and press `Enter` (for `vi`)
- If using `nano`, press `Ctrl+O`, `Enter`, then `Ctrl+X`

**Security Note**: The preset credentials are only used on first boot to create your admin account. You can change them later via the Youtarr UI. If you skip setting them, you'll need to complete initial setup from localhost (requires SSH port forwarding).

#### Verify .env file

```bash
cat .env
```

Ensure `YOUTUBE_OUTPUT_DIR` matches the directory you created in Step 4.

**Note about config.json**: You don't need to manually create or edit `config/config.json`. When running in Docker:
- If config.json doesn't exist, it will be auto-created on first startup with correct defaults
- The `youtubeOutputDirectory` setting in config.json is ignored in favor of the `/usr/src/app/data` path inside the container
- This path is automatically mounted to your `YOUTUBE_OUTPUT_DIR` via the volume mapping
- You can configure Plex and other settings later through the web UI

---

### Step 6: Start Youtarr (2 min)

Start the containers using docker-compose:

> **Compose command on Synology**: DSM 7 installs Docker Compose v2, which uses the space-separated syntax (`docker compose`). The examples below use `docker-compose`; substitute `docker compose` if that is what your system provides.

```bash
cd /volume1/docker/Youtarr
docker-compose up -d
```

**Monitor the startup**:

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Press Ctrl+C to exit log viewing
```

**Expected output**:
- `youtarr-db` container should show as "healthy"
- `youtarr` container should show as "running"

**Known harmless messages**:
- IPv6 rate limiting warnings can be ignored
- "Waiting for database" is normal during first startup

---

### Step 7: Access Youtarr (1 min)

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

Youtarr runs as root inside the container, which should work with Synology's default permissions. If you encounter permission issues:

```bash
# Fix ownership (from SSH)
cd /volume1/docker/Youtarr
sudo chown -R yourusername:users database config jobs server
```

### Network Access

**Port Requirements**:
- `3087`: Web UI and API
- `3321`: MariaDB (exposed on the NAS because `docker-compose.yml` maps `3321:3321`; lock it down with your firewall or remove the port mapping if you only need in-container access)

> **Security tip**: If you do not need MariaDB reachable from the NAS host, remove the `ports` block for `youtarr-db` from `docker-compose.yml` and redeploy (`docker-compose down && docker-compose up -d`). The `youtarr` container will still connect over the internal Docker network.

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
├── ChannelName1/
│   ├── video1 [youtubeid].mp4
│   └── video1 [youtubeid].nfo
└── ChannelName2/
    └── video2 [youtubeid].mp4
```

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
docker-compose pull
docker-compose up -d

# View logs to verify update
docker-compose logs -f
```

---

## Stopping and Starting

**Stop Youtarr**:
```bash
cd /volume1/docker/Youtarr
docker-compose down
```

**Start Youtarr**:
```bash
cd /volume1/docker/Youtarr
docker-compose up -d
```

**Restart Youtarr**:
```bash
cd /volume1/docker/Youtarr
docker-compose restart
```

---

## Troubleshooting

### "YOUTUBE_OUTPUT_DIR not set" Error

**Symptom**: Container fails to start with error about empty section between colons.

**Solution**:
1. Verify `.env` file exists: `cat /volume1/docker/Youtarr/.env`
2. Verify it contains: `YOUTUBE_OUTPUT_DIR=/your/path`
3. Ensure no extra spaces or quotes around the path
4. Restart containers: `docker-compose down && docker-compose up -d`

### "ffmpeg-location undefined does not exist" Error

**Symptom**: Logs show warnings about ffmpeg location.

**Root Cause**: This usually indicates `YOUTUBE_OUTPUT_DIR` was not properly set, causing yt-dlp to fail.

**Solution**:
1. Verify `YOUTUBE_OUTPUT_DIR` in `.env` file matches a real directory
2. Verify directory exists: `ls -la /volume1/media/youtube`
3. Check directory permissions: `ls -ld /volume1/media/youtube`
4. Restart containers: `docker-compose restart`

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
docker-compose up -d
```

### "Permission denied" on Docker Commands

**Symptom**: `docker` or `docker-compose` commands fail with permission errors.

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
   docker-compose ps
   # Both containers should be running
   ```

2. **Check logs for errors**:
   ```bash
   docker-compose logs
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
docker-compose down
docker-compose up -d
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
   docker-compose ps
   # youtarr-db should show "healthy"
   ```

2. View database logs:
   ```bash
   docker-compose logs youtarr-db
   ```

3. Restart database:
   ```bash
   docker-compose restart youtarr-db
   # Wait 30 seconds for health check
   docker-compose restart youtarr
   ```

4. If issues persist, reset database:
   ```bash
   # WARNING: This deletes all data!
   docker-compose down
   rm -rf database/*
   docker-compose up -d
   ```

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

# Backup database (with containers running)
docker exec youtarr-db mysqldump -u root -p123qweasd youtarr > /volume1/backups/youtarr/database-$(date +%Y%m%d).sql

# Or backup database directory (stop containers first)
docker-compose down
cp -r /volume1/docker/Youtarr/database /volume1/backups/youtarr/database-$(date +%Y%m%d)
docker-compose up -d
```

### Restore from Backup

```bash
# Stop containers
cd /volume1/docker/Youtarr
docker-compose down

# Restore configuration
rm -rf config
cp -r /volume1/backups/youtarr/config-YYYYMMDD config

# Restore database
rm -rf database
cp -r /volume1/backups/youtarr/database-YYYYMMDD database

# Start containers
docker-compose up -d
```

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
docker-compose down && docker-compose up -d
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
docker-compose down -v

# Remove application files
cd /volume1/docker
rm -rf Youtarr

# Optional: Remove downloaded videos
# rm -rf /volume1/media/youtube
```

---

## Additional Resources

- **Main Documentation**: [README.md](../README.md)
- **Docker Guide**: [DOCKER.md](DOCKER.md)
- **Media Server Setup**: [MEDIA_SERVERS.md](MEDIA_SERVERS.md)
- **General Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **GitHub Issues**: [Report problems](https://github.com/dialmaster/Youtarr/issues)

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the logs**:
   ```bash
   docker-compose logs -f
   ```

2. **Search existing issues**: [GitHub Issues](https://github.com/dialmaster/Youtarr/issues)

3. **Create a new issue** with:
   - Your Synology model and DSM version
   - Contents of `.env` file (redact passwords)
   - Output of `docker-compose ps`
   - Relevant logs from `docker-compose logs`

---

**Last Updated**: November 2024
