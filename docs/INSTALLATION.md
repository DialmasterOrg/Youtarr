# Youtarr Setup Guide

## Prerequisites

Before setting up Youtarr, ensure you have:

1. **Docker & Docker Compose** installed on your system
2. **Bash Shell** (Git Bash for Windows users)
3. **Git** to clone the repository

## Quick Start Guide

Choose your preferred installation method

### Method 1: First-Time Installation via `./start.sh` helper

1. **Clone the repository**:
   ```bash
   git clone https://github.com/DialmasterOrg/Youtarr.git
   cd Youtarr
   ```
2. **Start Youtarr**:
   ```bash
   ./start.sh
   ```
   If this is a first time run you will:
   - Be prompted to setup your output directory for videos (defaults to `./downloads`)
   - Choose your timezone (default `UTC`), which drives scheduled downloads and nightly cleanup jobs.

   #### Optional flags:
     - `--no-auth`: Completely disable auth. Never expose Youtarr directly to the internet in this manner, only use if you have your own authentication layer (Cloudflare Tunnel, OAuth Proxy, etc)
     - `--headless-auth`: Set auth credentials in `.env`, bypassing the need to setup credentials in the UI (as that may be difficult to do over localhost for headless setups)
     - `--pull-latest`: Pull latest code from Github and latest image from DockerHub
     - `--debug`: Set log level to debug

   This automatically creates a `.env` file from the included `.env.example` and starts both the Youtarr application and MariaDB database containers.

3. **Access the web interface**:
   Open your browser and navigate to `http://localhost:3087`

4. **Complete initial setup**:
   - On first access from localhost, you'll be prompted to create an admin account
     - **IMPORTANT**: This requires access via `localhost`
   - Choose a strong password (minimum 8 characters required)
   - This account will be used for all future logins and can be changed in the web UI

### Method 2: Standard Docker Compose (For Docker-Native Setups)

If you prefer to use standard `docker compose up` commands:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/DialmasterOrg/Youtarr.git
   cd Youtarr
   ```

2. **Create environment configuration**:
   ```bash
   cp .env.example .env
   ```

3. **Edit the .env file**:
   ```bash
   vim .env  # or use your preferred editor
   ```

   Set the required `YOUTUBE_OUTPUT_DIR` variable to your video storage location:
   ```bash
   YOUTUBE_OUTPUT_DIR=/path/to/your/videos
   ```

   Optionally configure other settings:
   - `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` - For headless deployments (e.g., Unraid)
   - `AUTH_ENABLED=false` - Only if behind external authentication (VPN, reverse proxy)
   - `LOG_LEVEL` - Set to `debug` for troubleshooting, `info` for normal/production use (default), `warn` for minimal logging

   See: [ENVIRONMENT VARIABLES](ENVIRONMENT_VARIABLES.md) for more details

4. **Start with Docker Compose**:
   ```bash
   docker compose up -d
   ```

   > **ARM Users (Apple Silicon, Raspberry Pi)**: Use the ARM override to avoid MariaDB volume issues:
   > ```bash
   > docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d
   > ```
   > See [Troubleshooting](TROUBLESHOOTING.md#apple-silicon--arm-incorrect-information-in-file-errors) for details.

5. **Access the web interface**:
   - Navigate to `http://localhost:3087`
   - If you set preset credentials in .env, use those to log in
   - If not, you'll create your admin account on first access, which will require access via `localhost`
   - Configure Plex and other settings from the Configuration page

> **Important**: Ensure the path you assign to `YOUTUBE_OUTPUT_DIR` already exists on the host and is writable before starting the stack. Otherwise Docker will create it as root-owned and the container may not be able to write downloads.

This method is **functionally equivalent** to using the start.sh script, but gives you direct control over environment variables. It's the preferred approach for any Docker-native workflow.

### Method 3: Manual Setup Without Git (Advanced Users Only)

> **Not Recommended**: This method requires manual directory creation, permission management, and lacks helper scripts. It is more error-prone and provides limited community support.
>
> **For advanced users only.** If you cannot clone the repository (e.g., Portainer, TrueNAS, limited Git access), see [Manual Docker Setup Without Git](DOCKER.md#manual-setup-without-git-clone) in the Docker documentation.

Most users should use Method 1 or 2 above for the best experience and easiest updates.

## Authentication

See [AUTHENTICATION.md](AUTHENTICATION.md)

### Important Notes:
- Initial setup can **only** be performed from localhost for security reasons
- If you need to reset your admin password, see the [Troubleshooting Guide](TROUBLESHOOTING.md#reset-admin-password)

## Configuration

After logging in, configure Youtarr through the Configuration page.

### Required Settings

**Download Directory**:
- This is set by the initial setup via `./start.sh` or manual configuration in `.env` via the `YOUTUBE_OUTPUT_DIR` variable
- [Videos will be organized in subdirectories by channel name](YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md)
- After changing the download directory, you must restart Youtarr (`./stop.sh` then `./start.sh` or `docker compose down` and `docker compose up -d`)

### Configuration Settings

Editable via the web UI or direct edits to `config/config.json`.

See [CONFIG.md](CONFIG.md) for details.

## Important Operational Notes

### Critical: Download Archive File

**NEVER DELETE `config/complete.list`**

The `config/complete.list` file tracks all downloaded videos and prevents re-downloads during automatic channel updates. **Deleting this file will cause Youtarr to re-download ALL videos from all subscribed channels on the next scheduled run.** This file also stores videos you've marked to ignore for automatic downloads.

### Storage Management

**Storage Growth**: Downloads can consume significant disk space over time. The UI includes a storage status chip that shows total and free space for your selected directory/drive, making it easy to monitor and adjust limits/schedule as needed.

**Automatic Video Removal**: Can purge old videos nightly at 2:00 AM once you configure age or free-space thresholds in the Configuration page. Space-based cleanup relies on the storage status chip reporting accurate disk usage.

### File Management Restrictions

**Do Not Rename or Move Files**

Videos must retain their `[youtubeid].mp4` filename and remain in the Youtarr configured mount. Moving or renaming files will cause Youtarr to mark them as "missing" from disk.
If videos are moved WITHIN the mount, on restart, Youtarr will attempt to find them, but do so at your own risk.

**Format**: All videos download as MP4 with comprehensive embedded metadata (title, genre, studio, keywords) and NFO files for maximum media server compatibility.

### Network Storage Considerations

**Network Storage**: Youtarr supports NAS, network shares, and mounted volumes. Ensure:
- Youtarr container can write to the media location (local or network storage)
- Your media server (Plex/Jellyfin/etc.) can read from the same media location
- Youtarr can reach your media server API over the network (if using Plex integration)

**Docker Desktop (Windows/macOS)**: When configuring Plex, use `host.docker.internal` or your LAN IP (e.g. `192.168.x.x`) as your Plex server address to allow the container to reach the host machine.

**Docker on macOS without Docker Desktop** (e.g., Colima): Use the Mac's LAN IP (e.g., `192.168.x.x`) or `host.lima.internal`.

**Docker on Linux**: Use the host's LAN IP (e.g., `192.168.x.x`). `host.docker.internal` normally resolves to the Docker bridge and Plex may not be listening there.

### Content Filtering

**Automatic Filtering**: Youtarr automatically skips subscriber-only content. You can configure auto-downloads separately for long-form videos, Shorts, and Streams in each channel's settings.

**Manual Ignore**: Mark individual videos to exclude them from automatic channel downloads while keeping auto-downloads enabled for the rest of the channel. Use the ignore button on videos that haven't been downloaded yet, or bulk-ignore multiple videos at once.

### Platform Deployments (Elfhosted, Kubernetes, etc.)

Youtarr fully supports platform-managed deployments with automatic configuration:

- **Auto-Configuration**: When `DATA_PATH` is set, config.json is auto-created on first run
- **Platform Authentication**: Set `AUTH_ENABLED=false` to bypass internal auth (only when platform handles it). Never expose a no-auth instance directly; protect it behind your platform's authentication layer.
- **Pre-configured Plex**: Set `PLEX_URL` for automatic Plex server configuration
- **Consolidated Storage**: All persistent data stored under single `/app/config` mount
- **Example**: `DATA_PATH=/storage/rclone/storagebox/youtube`
- **Details**: See [Docker Guide](DOCKER.md#platform-deployment-configuration) for full configuration

## Network Access

To access Youtarr from other devices on your network:

1. Configure your firewall to allow port 3087
2. Access using your server's IP address: `http://[server-ip]:3087`

For external access, you'll need to:
- Set up port forwarding on your router
- Consider using a reverse proxy for security
- Implement HTTPS for secure remote access

## Upgrading

### Important: Youtarr Does Not Auto-Update

**Youtarr does not automatically update itself.** When you run `./start.sh` or `docker compose up -d`, it uses your currently installed version. Simply restarting Youtarr without pulling updates will restart the same version you currently have installed.

**If you're wondering why you don't see new features after a restart, you likely need to run the update commands below.**

### Checking for Updates

Before upgrading, you can check if updates are available:

- **View release notes and changelog**: [GitHub Releases](https://github.com/DialmasterOrg/Youtarr/releases)
- **Check your current version**: Look in the footer of the Youtarr web interface
- **Compare versions**: If your version number is older than the latest release, an update is available

### How to Update to the Latest Version

Choose the method that matches how you installed Youtarr:

#### Method 1: Using Helper Scripts

If you use the `./start.sh` script:

```bash
./start.sh --pull-latest
```

The `--pull-latest` flag does two things:
1. Pulls the latest code from the GitHub repository (`git pull`)
2. Pulls the latest Docker image from DockerHub (`docker compose pull`)
3. Restarts Youtarr with the new version

**Note**: You don't need to run `./stop.sh` first - the start script handles stopping and restarting automatically.

#### Method 2: Manual Docker Compose Update

If you use standard Docker Compose commands:

1. **Stop Youtarr**:
   ```bash
   docker compose down
   ```

2. **Pull the latest git changes** on the `main` branch:
   ```bash
   git pull
   ```

3. **Pull the latest Docker image**:
   ```bash
   docker compose pull
   ```

4. **Start Youtarr**:
   ```bash
   docker compose up -d
   ```

### What Happens During Updates

**Preserved**:
- Your database and all downloaded videos
- Configuration settings in `config/config.json`
- Download history in `config/complete.list`
- Channel subscriptions and settings

**Updated**:
- Application code and features
- Database schema (via automatic migrations)
- Docker container and dependencies

**Important**: Database migrations run automatically on startup. If a migration fails, check the logs with `docker compose logs -f` and see the [Troubleshooting Guide](TROUBLESHOOTING.md) for assistance.
