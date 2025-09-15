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
- **📥 Direct Downloads**: Download any YouTube video by URL (powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp))
- **📺 Channel Subscriptions**: Subscribe to channels and auto-download new videos
- **🗂️ Smart Organization**: Videos organized by channel with metadata and thumbnails
- **⏰ Scheduled Downloads**: Configure automatic downloads on your schedule (cron-based)
- **📱 Web Interface**: Manage everything through a responsive web UI
- **🔍 Browse Channels**: View all videos from subscribed channels before downloading
- **📊 Download History**: Track what you've downloaded with smart duplicate prevention
- **🔐 Secure Access**: Local authentication system with admin controls

### Optional Plex Integration
- **🔄 Auto Library Refresh**: Automatically update Plex after downloads
- **📁 Plex-Ready Format**: Videos organized and named for perfect Plex compatibility
- **🎬 Metadata Support**: Full descriptions, thumbnails, and video info display in Plex

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
2. Paste YouTube URLs (one per line)
3. Click "Download Specific Videos"

### Subscribe to Channels
1. Go to Channels page
2. Add channel by URL or @handle (e.g., `@MrBeast` or `https://youtube.com/@MrBeast`)
3. Choose to download all videos or let automation handle new ones

### Configure Automation
1. Visit Configuration page
2. Set download schedule (e.g., every 6 hours)
3. Choose video resolution and download limits
4. (Optional) Connect Plex for auto-refresh

## 📖 Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration instructions
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Solutions to common issues
- **[Docker Guide](docs/DOCKER.md)** - Docker configuration and management
- **[Development](docs/DEVELOPMENT.md)** - Contributing and development setup

## ⚠️ Important Notes

### For All Users
- **Storage**: Videos download to the directory you select during setup
- **Storage Growth**: Downloads can consume significant disk space over time. The UI includes a storage status chip that shows total and free space for your selected directory/drive, making it easy to monitor and adjust limits/schedule as needed.
- **Format**: Downloads as MP4 with embedded metadata for best compatibility
- **Filtering**: Automatically skips YouTube Shorts and subscriber-only content
- **Authentication**: Uses local authentication (create admin account on first access)

### For Plex Users (Optional)
- **Library Type**: Must be configured as "Other Videos" with "Personal Media" agent
- **API Key**: Get it automatically via Configuration page or [manually](https://www.plexopedia.com/plex-media-server/general/plex-token/)
- **Network Access**: Run on same machine as Plex server (the app must be able to write to the Plex library directory)
- **Docker on Windows**: Use `host.docker.internal` as your Plex server address

## ⚖️ Legal Disclaimer

Youtarr is not affiliated with YouTube or Plex. Users are responsible for ensuring their use complies with YouTube's Terms of Service and applicable copyright laws. This tool is intended for personal use with content you have the right to download.

## 📝 License

Licensed under the ISC License. See [LICENSE.md](LICENSE.md) for details.

## Screenshots

![Alt text](/screenshots/youtarr_channels.jpg?raw=true 'Channels Screen')
![Alt text](/screenshots/youtarr_config.jpg?raw=true 'Config Screen')
![Alt text](/screenshots/youtarr_downloads.jpg?raw=true 'Downloads Screen')
![Alt text](/screenshots/youtarr_videos.jpg?raw=true 'Videos Screen')
![Alt text](/screenshots/youtarr_channels_mb.jpg?raw=true 'Channels Screen Mobile')
![Alt text](/screenshots/youtarr_config_mb.jpg?raw=true 'Config Screen Mobile')
![Alt text](/screenshots/youtarr_downloads_mb.jpg?raw=true 'Downloads Screen Mobile')
![Alt text](/screenshots/youtarr_videos_mb.jpg?raw=true 'Videos Screen Mobile')
![Alt text](/screenshots/youtarr_channel_view_pc.jpg?raw=true 'Individual Channel Screen')
