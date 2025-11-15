# Youtarr Setup Guide

## Initial Setup

### Prerequisites

Before setting up Youtarr, ensure you have:

1. **Docker & Docker Compose** installed on your system
2. **Bash Shell** (Git Bash for Windows users)
3. **Git** to clone the repository
4. Access to your **Plex Media Server** (Youtarr just needs network reachability; running on the same machine is optional)

### First-Time Installation via `./start.sh` helper

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dialmaster/Youtarr.git
   cd Youtarr
   ```
2. **Start Youtarr**:
   ```bash
   ./start.sh
   ```
   If this is a first time run:
   - You will be prompted to setup your output directory for videos (defaults to `./downloads`)
   - You will be prompted to set your username and password for login if not using --no-auth

   This starts both the Youtarr application and MariaDB database containers.

4. **Access the web interface**:
   Open your browser and navigate to `http://localhost:3087`

5. **Complete initial setup**:
   - On first access from localhost, you'll be prompted to create an admin account
   - Choose a strong password (minimum 8 characters recommended)
   - This account will be used for all future logins

### Alternative: Manual Configuration with .env

If you prefer to use standard `docker compose up` commands (eg. for Portainer, TrueNAS, or other Docker GUI platforms):

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dialmaster/Youtarr.git
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

4. **Start with Docker Compose**:
   ```bash
   docker compose up -d
   ```

5. **Access the web interface**:
   - Navigate to `http://localhost:3087`
   - If you set preset credentials in .env, use those to log in
   - If not, you'll create your admin account on first access from localhost
   - Configure Plex and other settings from the Configuration page
   - When launched this way, the Configuration screen shows the download directory as a read-only “Docker Volume” because Docker Compose owns the mapping. To change it later, update the volume path in docker-compose and restart.

> **Important**: Ensure the path you assign to `YOUTUBE_OUTPUT_DIR` already exists on the host and is writable before starting the stack. Otherwise Docker will create it as root-owned and the container may not be able to write downloads.

This method is **functionally equivalent** to using the start.sh script, but gives you direct control over environment variables. It's the preferred approach for any Docker-native workflow.

## Authentication

Youtarr uses a local authentication system:

- **Initial Setup**: When accessing Youtarr for the first time from localhost, you'll create an admin account
- **Subsequent Logins**: Use your admin credentials to log in
- **Session Management**: Sessions expire after 7 days of inactivity
- **Security**: Passwords are securely hashed using bcrypt

### Important Notes:
- Initial setup can **only** be performed from localhost for security reasons
- If you need to reset your admin password, see the [Troubleshooting Guide](TROUBLESHOOTING.md#reset-admin-password)

## Configuration

After logging in, configure Youtarr through the Configuration page:

### Required Settings

**Download Directory**:
- This is set by the initial setup via `./start.sh` in `.env`
- Videos will be organized in subdirectories by channel name
- After changing this, restart Youtarr (`./stop.sh` then `./start.sh`)

### Optional Settings

1. **Plex Server Configuration**:
   - **Plex Server IP**:
     - Docker Desktop (Windows/macOS): `host.docker.internal`
     - Docker on macOS without Docker Desktop (e.g., Colima): host LAN IP (e.g., `192.168.x.x`) or `host.lima.internal`
     - Docker on Linux or running inside WSL without Docker Desktop: host LAN IP (e.g., `192.168.x.x`)
   - **Plex Port**: Defaults to `32400`. Update this if you've changed the Plex listening port or exposed it through a different mapping.
     - The setup script will try to contact `http://<address>:<port>/identity`; if it fails you can retry or skip to keep the value.
   - **Plex API Key**: Get it automatically via the Configuration page or [manually](https://www.plexopedia.com/plex-media-server/general/plex-token/)
   - **Plex Library Section**: Select the library where videos will be stored
     - The app can attempt to automatically set the right download directory for your selected
       Plex library, but this will require a restart of Youtarr if changed.
      - Paths are shown exactly as Plex reports them. Convert Windows paths (for example, `C:\Media`) to the mount that Youtarr can access (such as `/mnt/c/Media` on WSL or Docker) before saving.
   - The library should be configured as "Other Videos" with "Personal Media" agent in your Plex server

2. **Download Schedule**:
    - Configure how often Youtarr checks for new and downloads new videos for your channels
    - Default: Every 6 hours

3. **Automatic Video Removal**:
   - Toggle **Enable Automatic Video Removal** to allow nightly cleanup at 2:00 AM
   - Pick one or both strategies:
     - **Free Space Threshold**: Delete the oldest videos until free space meets the selected minimum (requires the storage indicator at the top of Configuration to show valid data)
     - **Video Age Threshold**: Delete videos older than the chosen number of days
   - Use **Preview Automatic Removal** to run a dry-run simulation before saving changes; previews show estimated deletions, recovered space, and sample videos
   - Save the configuration to apply your thresholds—deletions are permanent, so review the dry-run results first

4. **Media Server Compatibility Settings**:

   **NFO File Generation** (enabled by default):
   - Automatically creates .nfo metadata files alongside each video
   - Compatible with Kodi, Jellyfin, and Emby
   - Includes: title, plot, upload date, channel info, genres, tags, runtime

   **Channel Poster Generation** (enabled by default):
   - Copies channel thumbnails as poster.jpg in each channel folder
   - Helps media servers display channel artwork

   **Embedded Metadata Enhancement**:
   - Automatically embeds extended metadata directly into MP4 files
   - Includes: genre (from categories), studio/network (channel name), keywords (from tags)
   - Ensures Plex can read metadata even without Local Media Assets configured

5. **Notifications (Discord Webhooks)**:
   - Toggle **Enable Notifications** to allow Discord alerts when new videos finish downloading
   - Paste your Discord webhook URL (Discord → Server Settings → Integrations → Webhooks)
   - Save the configuration before sending a test message with **Send Test Notification**
   - Notifications are sent only after successful downloads that include at least one new video

## Plex Library Setup

For Youtarr to work correctly with Plex:

1. Create a new library in Plex:
   - Type: **Other Videos**
   - Agent: **Personal Media**
   - Add the folder where Youtarr downloads videos

2. Ensure the Plex server can access the download directory

3. Videos will automatically be added to Plex after download and the Plex library will be refreshed.

## Adding YouTube Channels

1. Navigate to the Channels page
2. Click "Add Channel"
3. Enter the YouTube channel URL or ID
4. Youtarr will automatically:
   - Download new videos from subscribed channels
   - Organize them by channel name
   - Add them to your Plex library (if configured)
   - Generate metadata files for media server compatibility

Note on removal: Removing a channel in the UI disables future downloads for that channel but does not delete existing videos or download history.

### Channel-Level Configuration

Each channel can have custom settings that override global defaults. To access these settings:
1. Click on a channel in the Channel Manager to open the channel page
2. Click the settings icon (gear) next to the channel name
3. Configure your custom subfolder and/or quality settings

**Custom Subfolder Organization**:
- Organize channels into subfolders to create separate media server libraries
- Common use cases:
  - `__kids` - Children's content with parental controls in a dedicated library
  - `__music` - Music videos with music-focused metadata and views
  - `__news` - News channels in a private library
  - `__education` - Educational content separated from entertainment
  - Leave blank for default behavior (channel folder in root directory)
- This enables you to create multiple Plex/Jellyfin/Emby libraries, each pointing to a different subfolder
- Each library can have its own sharing rules, age restrictions, and viewing settings

**Custom Video Quality**:
- Override the global quality setting for specific channels
- Useful when certain channels benefit from higher/lower quality
- Examples:
  - High-quality gaming or tech channels → 4K/1440p
  - News or podcast channels → 720p to save space
  - Kids content → 480p for smaller files
- Leave as "Use Global Setting" to inherit the default quality

**Editing Settings**:
- Settings can be changed at any time from the Channel Manager
- New quality settings apply to future downloads only
- Existing videos are not affected by quality changes
- Changing a subfolder will affect where new videos are downloaded and move existing files for the channel into that subfolder

## Network Access

To access Youtarr from other devices on your network:

1. Configure your firewall to allow port 3087
2. Access using your server's IP address: `http://[server-ip]:3087`

For external access, you'll need to:
- Set up port forwarding on your router
- Consider using a reverse proxy for security
- Implement HTTPS for secure remote access

## Upgrading

To upgrade to the latest version:

1. Stop Youtarr:
   ```bash
   ./stop.sh
   ```

2. Pull the latest changes:
   ```bash
   git pull
   ```

3. Start Youtarr:
   ```bash
   ./start.sh
   ```

Your database and configuration will be preserved during upgrades.
