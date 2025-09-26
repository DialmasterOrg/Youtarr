# Youtarr

Youtarr is a self-hosted YouTube downloader that automatically downloads videos from your favorite channels or specific URLs. With optional Plex integration, it can refresh your media library for a seamless, ad-free viewing experience.

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
- **🎯 Custom Quality Settings**: Per-download resolution control with support from 360p to 4K
- **📺 Channel Subscriptions**: Subscribe to channels and auto-download new videos
- **🚫 SponsorBlock Integration**: Automatically remove or mark sponsored segments, intros, outros, and more using the crowdsourced SponsorBlock database
- **🗂️ Smart Organization**: Videos organized by channel with metadata and thumbnails
- **📝 Multi-Server Support**: Compatible with Plex, Kodi, Jellyfin, and Emby through NFO metadata files and embedded MP4 metadata
- **🖼️ Channel Artwork**: Automatic channel poster generation for media server folder displays
- **⏰ Scheduled Downloads**: Configure automatic downloads on your schedule (cron-based)
- **📱 Web Interface**: Manage everything through a responsive web UI
- **🔍 Browse Channels**: View all videos from subscribed channels before downloading
- **📊 Download History**: Track what you've downloaded with smart duplicate prevention
- **🔐 Secure Access**: Local authentication system with admin controls
- **☁️ Platform Flexible**: Configurable storage paths for Kubernetes/Elfhosted deployments

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

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dialmaster/Youtarr.git
   cd Youtarr
   ```

2. **Run setup**:
   ```bash
   ./setup.sh  # Select your YouTube download directory
   ```

3. **Start Youtarr**:
   ```bash
   ./start.sh
   ```

4. **Access the web interface**:
   - Navigate to `http://localhost:3087`
   - Create your admin account on first access
   - If you want automatic Plex integration with library refresh, then configure your Plex connection
     - The app works fine without Plex integration and will still download videos from YouTube automatically and
       allow you to add and browse YouTube channels
   - If containers don’t start or the app isn’t reachable, see [Troubleshooting](docs/TROUBLESHOOTING.md)

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

### Configure Automation
1. Visit Configuration page
2. Set download schedule (e.g., every 6 hours)
3. Choose video resolution and download limits
4. (Optional) Connect Plex for auto-refresh

### Configure SponsorBlock
1. Go to Configuration page → SponsorBlock Integration section
2. Enable SponsorBlock to automatically handle sponsored content
3. Choose action: Remove segments entirely or mark them as chapters
4. Select which types of segments to handle (sponsors, intros, outros, etc.)
5. All new downloads will automatically process selected segments

## 📖 Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration instructions
- **[Media Server Guide](docs/MEDIA_SERVERS.md)** - Configuration for Plex, Kodi, Jellyfin, and Emby
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Solutions to common issues
- **[Docker Guide](docs/DOCKER.md)** - Docker configuration and management
- **[Development](docs/DEVELOPMENT.md)** - Contributing and development setup

## ⚠️ Important Notes

### For All Users
- **Storage**: Videos download to the directory you select during setup
- **Storage Growth**: Downloads can consume significant disk space over time. The UI includes a storage status chip that shows total and free space for your selected directory/drive, making it easy to monitor and adjust limits/schedule as needed.
- **Format**: Downloads as MP4 with comprehensive embedded metadata (title, genre, studio, keywords) and NFO files for maximum media server compatibility
- **Filtering**: Automatically skips YouTube Shorts and subscriber-only content
- **Authentication**: Uses local authentication (create admin account on first access)

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
- **Platform Authentication**: Set `AUTH_ENABLED=false` to bypass internal auth (when platform handles it)
- **Pre-configured Plex**: Set `PLEX_URL` for automatic Plex server configuration
- **Consolidated Storage**: All persistent data stored under single `/app/config` mount
- **Example**: `DATA_PATH=/storage/rclone/storagebox/youtube`
- **Details**: See [Docker Guide](docs/DOCKER.md#platform-deployment-configuration) for full configuration

## ⚖️ Legal Disclaimer

Youtarr is not affiliated with YouTube or Plex. Users are responsible for ensuring their use complies with YouTube's Terms of Service and applicable copyright laws. This tool is intended for personal use with content you have the right to download.

## 📝 License

Licensed under the ISC License. See [LICENSE.md](LICENSE.md) for details.

## Screenshots

<img width="1927" height="1488" alt="image" src="https://github.com/user-attachments/assets/9ef03477-a1e2-400f-891b-6e275a58d441" />
<img width="1908" height="1485" alt="image" src="https://github.com/user-attachments/assets/cac5d4b8-9c65-4782-8bb8-8d5064579937" />
<img width="1907" height="1487" alt="image" src="https://github.com/user-attachments/assets/3dc7cabc-e725-4e6c-92f0-578e25a0905b" />
<img width="1901" height="1487" alt="image" src="https://github.com/user-attachments/assets/7d5dbeca-c3dc-4ced-972b-97e16a70dfd4" />
<img width="1916" height="1482" alt="image" src="https://github.com/user-attachments/assets/18625f29-61de-475d-b509-1654420e7612" />
<img width="1907" height="1489" alt="image" src="https://github.com/user-attachments/assets/1151811e-0a8a-4960-897b-7b1eb3ab3546" />
<img width="1905" height="1488" alt="image" src="https://github.com/user-attachments/assets/a9e10530-a966-42fa-b71d-b2d7bbbeadff" />




