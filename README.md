# Youtarr

Youtarr is a self-hosted application that automatically downloads videos from YouTube channels and integrates them seamlessly with your Plex Media Server, providing a curated, ad-free YouTube experience.

## Overview

In the era of digital media, ensuring safe and appropriate content for your children can be a challenge. Youtube, while being a vast reservoir of educational and entertaining content, also hosts content that might not be suitable for children. To strike a balance, Youtarr allows you to curate YouTube channels so that you can provide a vetted, customized and safe YouTube experience for your kids via Plex.

The application operates by running a scheduled task that automatically downloads new videos, along with their thumbnails and metadata, from a list of YouTube channels that you specify. These videos are then automatically added to your Plex server and a library scan is initiated as soon as downloads are complete.

## 🎯 Key Features

- **📺 Automated Downloads**: Schedule automatic downloads from your subscribed YouTube channels
- **🎬 Plex Integration**: If you link the PLex, videos are automatically added to your Plex library with metadata
- **👨‍👩‍👧‍👦 Family-Friendly**: Create a safe, curated YouTube experience without ads or comments
- **🔐 Secure Access**: Local authentication system with admin controls
- **📱 Responsive UI**: Works on desktop and mobile devices
- **🐳 Docker-Ready**: Easy deployment with Docker Compose

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git
- Bash shell (Git Bash for Windows)
- Plex Media Server (on the same machine)

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
     - The app works fine without Plex integration and will still download videos from Youtube automatically and
       allow you to add and browse Youtube channels

## 📖 Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration instructions
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Solutions to common issues
- **[Docker Guide](docs/DOCKER.md)** - Docker configuration and management
- **[Development](docs/DEVELOPMENT.md)** - Contributing and development setup

## ⚠️ Important Notes

- **Plex Library Type**: Must be configured as "Other Videos" with "Personal Media" agent
- **Authentication**: Youtarr uses local authentication (admin account)
- **Plex Integration**: Requires a Plex API key - get it automatically via the Configuration page or [manually](https://www.plexopedia.com/plex-media-server/general/plex-token/)
- **Network Access**: Run on the same machine as your Plex server for best results with Plex integration
- **Docker on Windows**: Use `host.docker.internal` as your Plex server address

## ⚖️ Legal Disclaimer

Youtarr is not affiliated with YouTube or Plex. Users are responsible for ensuring their use complies with YouTube's Terms of Service and applicable copyright laws. This tool is intended for personal use with content you have the right to download.

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
