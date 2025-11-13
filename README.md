# Youtarr

![Backend Coverage](https://img.shields.io/badge/Backend_Coverage-84%25-brightgreen)
![Frontend Coverage](https://img.shields.io/badge/Frontend_Coverage-79%25-yellow)
![CI Status](https://github.com/DialmasterOrg/Youtarr/workflows/CI%20-%20Lint%20and%20Test/badge.svg)

Youtarr is a self-hosted YouTube downloader that automatically downloads videos from your favorite channels or specific URLs. With optional Plex integration, it can refresh your media library for a seamless, ad-free viewing experience.

https://github.com/user-attachments/assets/cc153624-c905-42c2-8ee9-9c213816be3a

## 🤔 Why Youtarr?

- **No Ads or Tracking**: Watch YouTube content without interruptions
- **Offline Viewing**: Access your videos anytime, even without internet
- **Archive Content**: Preserve videos before they're deleted or made private
- **Family-Friendly Option**: Create a curated, safe YouTube experience for kids
- **Works Standalone**: Full functionality without requiring any media server
- **Plex-Ready**: Seamlessly integrates with Plex if desired, but never requires it

## 🎯 Key Features

### Core Features (No Plex Required)
- **📥 Smart Downloads**: Pre-validate YouTube URLs with metadata preview before downloading (powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp))
- **🎯 Custom Quality Settings**: Global and per-channel resolution control with support from 360p to 4K
- **📺 Channel Subscriptions**: Subscribe to channels and auto-download new videos, shorts, and streams with per-tab controls
- **📁 Channel Grouping & Multi-Library Support**: Organize channels into custom subfolders (e.g., `__kids`, `__music`, `__news`) to create separate media server libraries with distinct parental controls, sharing rules, and content organization
- **🚫 SponsorBlock Integration**: Automatically remove or mark sponsored segments, intros, outros, and more using the crowdsourced SponsorBlock database
- **🗂️ Smart Organization**: Videos organized by channel with metadata and thumbnails
- **📝 Multi-Server Support**: Compatible with Plex, Kodi, Jellyfin, and Emby through NFO metadata files and embedded MP4 metadata
- **🖼️ Channel Artwork**: Automatic channel poster generation for media server folder displays
- **⏰ Scheduled Downloads**: Configure automatic downloads on your schedule (cron-based)
- **🧹 Automatic Cleanup**: Nightly auto-removal with configurable age and free-space thresholds plus dry-run previews
- **📱 Web Interface**: Manage everything through a responsive web UI
- **🔍 Browse Channels**: View and search all videos from subscribed channels with advanced filtering, tabbed views for Videos/Shorts/Streams, and contextual publish date accuracy tips
- **🔴 Live-Aware Downloads**: Track live status to avoid grabbing still-airing streams and see LIVE indicators in the UI
- **📊 Download History**: Track what you've downloaded with smart duplicate prevention
- **🔔 Discord Alerts**: Send optional webhook notifications when new videos finish downloading
- **♻️ Re-download Missing**: Easily identify and re-download videos that were removed from disk
- **🔐 Secure Access**: Local authentication system with admin controls
- **☁️ Platform Flexible**: Configurable storage paths for Kubernetes/Elfhosted deployments
- **🖥️ Unraid Ready**: Community Applications template (via DialmasterOrg repo) with headless-friendly credential presets

### Optional Plex Integration
- **🔄 Auto Library Refresh**: Automatically update Plex after downloads
- **📁 Plex-Ready Format**: Videos organized and named for perfect Plex compatibility
- **🎬 Enhanced Metadata**: Embedded metadata including title, genre, studio, and keywords for rich Plex display

### Kodi, Jellyfin, and Emby Support
- **📄 NFO Files**: Automatically generates .nfo metadata files for each video
- **🎨 Channel Posters**: Creates poster.jpg files in channel folders for visual browsing
- **🏷️ Rich Metadata**: Includes title, plot, upload date, channel info, genres, tags, and runtime
- **🔧 Easy Setup**: Add as "Movies" library with NFO metadata reader enabled

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git
- Bash shell (Git Bash for Windows)
- Plex Media Server (optional - only if you want automatic library refresh)

> **Heads up:** Youtarr runs exclusively via Docker; direct `npm start`/Node deployments are unsupported.

### Installation

Choose your preferred installation method:

#### Method 1: Quick Setup with Scripts (Recommended for Beginners)

Perfect for users who want automated setup with minimal configuration:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dialmaster/Youtarr.git
   cd Youtarr
   ```

2. **Start Youtarr with built-in DB**:
   ```bash
   ./start.sh
   ```
   On first run, this will allow you to select your YouTube download directory and create a `.env` file from `.env.example`.
   The default download directory is `./downloads` but can be overridden during initial ./start.sh or via `.env`
   You will be required to set your auth credentials via UI on localhost for first time setup, and your credentials will be saved in `./config/config.json`

   - Optional flags:
     - `--no-auth`: Completely disable auth. Never expose Youtarr directly to the internet in this manner, only use if you have your own authentication layer (Cloudflare Tunnel, OAuth Proxy, etc)
     - `--headless-auth`: Set auth credentials in `.env`, bypassing the need to setup credentials in the UI (as that may be difficult to do over localhost for headless setups)
     - `--pull-latest`: Pull latest code from Github and latest image from DockerHub
     - `--debug`: Set log level to debug


3. **Access the web interface**:
   - Navigate to `http://localhost:3087`
   - Create your admin account on first access if you did not pass `--no-auth` or `--headless-auth`
   - Configure Plex (optional) and other settings from the Configuration page
   - If containers don't start or the app isn't reachable, see [Troubleshooting](docs/TROUBLESHOOTING.md)

#### Method 2: Standard Docker Compose (For Docker-Native Setups)

Eg. for Portainer, TrueNAS, or any Docker-native workflow:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dialmaster/Youtarr.git
   cd Youtarr
   ```

2. **Create environment configuration**:
   ```bash
   cp .env.example .env
   vim .env  # or use your preferred editor
   ```
   Set `YOUTUBE_OUTPUT_DIR` to your video storage location:
   ```bash
   YOUTUBE_OUTPUT_DIR="/mnt/c/Youtarr Videos" # This path is just an example
   ```
   Make sure this directory already exists on the host and is writable before starting the containers.
   Docker will otherwise create it as root-owned (if YOUTARR_UID and YOUTARR_GID are not set in .env)

   Optionally configure authentication and logging settings (see .env.example for details).

   > **Note:** Changes to `.env` require a complete container restart to take effect:
   > - Using scripts: `./stop.sh` then `./start.sh`
   > - Using Docker Compose: `docker compose down` then `docker compose up -d`

3. **Start with Docker Compose**:
   ```bash
   docker compose up -d
   ```

4. **Access the web interface**:
   - Navigate to `http://localhost:3087`
   - If `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` are set in `.env`, login with those credentials
     - These must meet length criteria or they will be ignored:
       - `AUTH_PRESET_USERNAME`: 3-32 characters
       - `AUTH_PRESET_PASSWORD`: 8-64 characters
   - Otherwise you must set your login credentials in UI via localhost on first run and they will be saved to `./config/config.json`
   - Configure Plex (optional) and other settings from the Configuration page

**Platform-Specific Guides**:
- **Synology NAS** (DSM 7+): See the [Synology NAS Guide](docs/SYNOLOGY.md) for optimized installation steps
- **Unraid**: See the [Unraid section](#deploying-on-unraid) below for template-based installation
- **Portainer/TrueNAS**: Use Method 2 above, or see [Docker documentation](docs/DOCKER.md) for stack configurations
- **Advanced Docker Setup**: See the [Docker documentation](docs/DOCKER.md) for detailed configuration options

### Using an External Database
- Already running MariaDB/MySQL elsewhere and do not want to use bundled internal DB?
- See [docs/EXTERNAL_DB.md](docs/EXTERNAL_DB.md)

### Deploying on Unraid

See [docs/UNRAID.md](docs/UNRAID.md) for instructions on Unraid setup.


## 📋 Usage Examples

### Download Individual Videos
1. Navigate to Downloads page
2. Paste YouTube URLs to validate and preview video metadata
3. Optionally customize resolution settings for this download
4. Click "Start Download" to begin

### Subscribe to Channels
1. Go to Channels page
2. Add channel by URL or @handle (e.g., `@MrBeast` or `https://youtube.com/@MrBeast`)
3. Choose to download all videos or let automation handle new ones
4. (Optional) Configure channel-specific settings:
   - Click on a channel to open its page, then click the settings icon (gear)
   - Set a custom subfolder to organize channels into separate media libraries (e.g., `__kids`, `__music`)
   - Override the global quality setting with a channel-specific resolution preference

### Configure Automation
1. Visit Configuration page
2. Set download schedule (e.g., every 6 hours)
3. Choose video resolution and download limits
4. Enable Automatic Video Removal (optional):
   - Toggle "Enable Automatic Video Removal"
   - Pick a free-space and/or age threshold
   - Use "Preview Automatic Removal" to simulate deletions before saving
5. (Optional) Connect Plex for auto-refresh

### Configure SponsorBlock
1. Go to Configuration page → SponsorBlock Integration section
2. Enable SponsorBlock to automatically handle sponsored content
3. Choose action: Remove segments entirely or mark them as chapters
4. Select which types of segments to handle (sponsors, intros, outros, etc.)
5. All new downloads will automatically process selected segments

### Enable Download Notifications
1. Open Configuration → Optional: Notifications
2. Toggle notifications on and paste your Discord webhook URL (Server Settings → Integrations → Webhooks)
3. Save configuration, then use "Send Test Notification" to verify delivery
4. Youtarr will notify the channel after successful downloads that include at least one new video

### Re-download Missing Videos
1. Go to Downloaded Videos or Channel Videos page
2. Look for videos marked with cloud-off icon (missing from disk)
3. Select videos to re-download with your preferred resolution
4. Videos will be queued for download while preserving metadata

## 🔄 Updating Youtarr

Youtarr does not automatically update. When you run `./start.sh` or `docker compose up -d`, it uses your currently installed version.

### To Update to the Latest Version

**If using start.sh (Method 1 from Quick Start):**
```bash
./start.sh --pull-latest
```

**If using docker compose directly (Method 2 from Quick Start):**
```bash
git pull
docker compose pull
docker compose up -d
```

The `--pull-latest` flag (or manual git/docker pull commands) does two things:
1. Pulls the latest code from the GitHub repository
2. Pulls the latest Docker image from DockerHub

**Important**: Simply restarting Youtarr without pulling updates will restart the same version you currently have installed. If you're wondering why you don't see new features after a restart, you likely need to run the update commands above.

### Checking for Updates

- View release notes and changelog: [GitHub Releases](https://github.com/DialmasterOrg/Youtarr/releases)
- Check current version: Look in the footer of the Youtarr web interface

## 📖 Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration instructions
- **[Synology NAS Guide](docs/SYNOLOGY.md)** - Synology-specific installation instructions for DSM 7+
- **[Media Server Guide](docs/MEDIA_SERVERS.md)** - Configuration for Plex, Kodi, Jellyfin, and Emby
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Solutions to common issues
- **[Docker Guide](docs/DOCKER.md)** - Docker configuration and management
- **[Development](docs/DEVELOPMENT.md)** - Contributing and development setup

## ⚠️ Important Notes

### For All Users
- **Storage**: Videos download to the directory you select during setup
- **Storage Growth**: Downloads can consume significant disk space over time. The UI includes a storage status chip that shows total and free space for your selected directory/drive, making it easy to monitor and adjust limits/schedule as needed. Automatic Video Removal can purge old videos nightly at 2:00 AM once you configure age or free-space thresholds; space-based cleanup relies on the storage status chip reporting accurate disk usage.
- **Format**: Downloads as MP4 with comprehensive embedded metadata (title, genre, studio, keywords) and NFO files for maximum media server compatibility
- **File Management**: Videos must retain their `[youtubeid].mp4` filename and remain in their download location. Moving or renaming files will cause Youtarr to mark them as "missing"
- **⚠️ CRITICAL: Download Archive File**: The `config/complete.list` file tracks all downloaded videos and prevents re-downloads during automatic channel updates. **Never delete this file** - doing so will cause Youtarr to re-download all videos from subscribed channels on the next scheduled run. This file also stores videos you've marked to ignore for automatic downloads.
- **Filtering**: Automatically skips subscriber-only content; configure auto-downloads separately for long-form videos, Shorts, and Streams
- **Manual Ignore**: Mark individual videos to exclude them from automatic channel downloads while keeping auto-downloads enabled for the rest of the channel. Use the ignore button on videos that haven't been downloaded yet, or bulk-ignore multiple videos at once
- **Authentication**: Uses local authentication (create admin account on first access)
- **Security**: Leave authentication enabled unless you have your own auth in front of Youtarr. If you launch with `--no-auth` (or set `AUTH_ENABLED=false`), never expose that instance directly to the public internet.

### For Plex Users (Optional)
- **Library Type**: Must be configured as "Other Videos" with "Personal Media" agent
- **API Key**: Get it automatically via Configuration page or [manually](https://www.plexopedia.com/plex-media-server/general/plex-token/)
- **Network Access**: Youtarr and Plex can run on the same or separate machines as long as:
  - Youtarr can write to the media location (local or network storage)
  - Plex can read from the same media location
  - Youtarr can reach the Plex API over the network
- **Network Storage**: Supports NAS, network shares, and mounted volumes
- **Docker Desktop (Windows/macOS)**: Use `host.docker.internal` as your Plex server address
- **Docker on macOS without Docker Desktop (e.g., Colima)**: Use the Mac's LAN IP (e.g., `192.168.x.x`) or `host.lima.internal`
- **Docker on Linux**: Use the host's LAN IP (e.g., `192.168.x.x`). `host.docker.internal` normally resolves to the Docker bridge and Plex may not be listening there.
- **Custom Plex port**: Plex defaults to port `32400`, but you can change the Plex Port field (or include the port in `PLEX_URL`) if your server listens elsewhere.
- **Library path translation**: When you pick a Plex library, confirm the suggested download path matches how Youtarr sees your storage (e.g., convert `C:\Media` to `/mnt/c/Media` on WSL).

### For Platform Deployments (Elfhosted, Kubernetes, etc.)
Youtarr now fully supports platform-managed deployments with automatic configuration:

- **Auto-Configuration**: When `DATA_PATH` is set, config.json is auto-created on first run
- **Platform Authentication**: Set `AUTH_ENABLED=false` to bypass internal auth (only when platform handles it). ⚠️ Never expose a no-auth instance directly; protect it behind your platform's authentication layer.
- **Pre-configured Plex**: Set `PLEX_URL` for automatic Plex server configuration
- **Consolidated Storage**: All persistent data stored under single `/app/config` mount
- **Example**: `DATA_PATH=/storage/rclone/storagebox/youtube`
- **Details**: See [Docker Guide](docs/DOCKER.md#platform-deployment-configuration) for full configuration

## ⚖️ Legal Disclaimer

Youtarr is not affiliated with YouTube or Plex. Users are responsible for ensuring their use complies with YouTube's Terms of Service and applicable copyright laws. This tool is intended for personal use with content you have the right to download.

## 📝 License

Licensed under the ISC License. See [LICENSE.md](LICENSE.md) for details.

## Screenshots

<img width="1888" height="1072" alt="image" src="https://github.com/user-attachments/assets/a4e8172c-eb7f-44bb-a891-a9d436ee9b73" />
<img width="1489" height="976" alt="image" src="https://github.com/user-attachments/assets/cbf765c6-67d1-431b-a393-0ac0c4e2f7e2" />
<img width="1890" height="1383" alt="image" src="https://github.com/user-attachments/assets/b8d586b1-fe5b-4cb4-a61a-79d1905cc44e" />
<img width="1472" height="1236" alt="image" src="https://github.com/user-attachments/assets/cd71937b-8423-42b3-9ddd-070f69c80662" />
<img width="1476" height="1186" alt="image" src="https://github.com/user-attachments/assets/86fb9b48-2284-4ef9-a76b-e083a2d70584" />
<img width="1466" height="1227" alt="image" src="https://github.com/user-attachments/assets/12629a9f-56be-4c71-8c43-e6673504f388" />
