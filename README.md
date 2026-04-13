# Youtarr

![Backend Coverage](https://img.shields.io/badge/Backend_Coverage-80%25-yellow)
![Frontend Coverage](https://img.shields.io/badge/Frontend_Coverage-85%25-brightgreen)
![CI Status](https://github.com/DialmasterOrg/Youtarr/workflows/CI%20-%20Lint%20and%20Test/badge.svg)

Youtarr is a self-hosted YouTube downloader that automatically downloads videos from your favorite channels. It provides metadata for multiple media servers and offers optional Plex integration for automatic library refreshes.

> Don't want to self-host? You can also run Youtarr on [ElfHosted](https://store.elfhosted.com/product/youtarr/) with a managed deployment – see their [Youtarr docs](https://docs.elfhosted.com/app/youtarr/).

> **Like Youtarr?** Consider [supporting the project on Patreon](https://www.patreon.com/c/ChrisDial) to help keep it free and actively developed!

https://github.com/user-attachments/assets/34e5b50b-1a38-4f0b-9f84-bd47cefe4348

## Why Youtarr?

- **No Ads or Tracking**: Watch YouTube content without interruptions
- **Offline Viewing**: Access your videos anytime, even without internet
- **Archive Content**: Preserve videos before they're deleted or made private
- **Works Standalone**: Full functionality without requiring any media server
- **Family-Friendly**: Create curated, safe YouTube experiences with multi-library support
- **Media Server Ready**: Downloads videos with proper organization and metadata for Plex, Kodi, Jellyfin, and Emby.

## Key Features

- **Smart Downloads**: Pre-validate manually pasted URLs with metadata preview before downloading
- **Channel Subscriptions**: Subscribe to channels and auto-download new videos, shorts, and streams with per-tab controls
- **Browse Channels**: View and search all videos from subscribed channels with advanced filtering, tabbed views for Videos/Shorts/Streams, and contextual publish date accuracy tips
- **In-App Playback**: Click any thumbnail to open a detail modal with extended metadata and in-browser streaming of downloaded videos; no media server required
- **Channel Grouping & Multi-Library Support**: Organize channels into custom subfolders (e.g., `__kids`, `__music`, `__news`) to create separate media server libraries
- **Smart Organization**: Videos organized by channel with metadata and thumbnails
- **SponsorBlock Integration**: Remove sponsored segments automatically
- **Quality Control**: Global and per-channel resolution settings (360p to 4K)
- **Download History**: Track what you've downloaded with smart duplicate prevention
- **Metadata Generation**: NFO files, poster images and embedded MP4 metadata for all media servers
- **Scheduled Downloads**: Configure automatic downloads on your schedule (cron-based)
- **Auto-Cleanup**: Age and space-based removal of videos with dry-run previews
- **Discord Notifications**: Optional webhook alerts for new downloads
- **Web Interface**: Manage everything through a responsive (PC or mobile) web UI
- **Secure Access**: Built-in authentication with admin controls
- **REST API**: Full API with interactive [Swagger/OpenAPI documentation](http://localhost:3087/swagger) for automation and integrations
- **Platform Flexible**: Configurable storage paths and guides for deployment to multiple platforms and architectures
- **Unraid Ready**: Community Applications template (via DialmasterOrg repo) with headless-friendly credential presets
- **Powered by yt-dlp**: Uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) under the hood for YouTube integration and downloads
- **Content Ratings**: Add per-video and per-channel content ratings (normalized to common media-server values like `G`, `PG`, `PG-13`, `R`, `NC-17`, `TV-*`). Ratings can be set per-download, via channel defaults, or derived from yt-dlp metadata; they show up as badges and can be used for automated policies.

## Prerequisites
- Docker & Docker Compose
- Git
- Bash shell (Git Bash for Windows)
> **Heads up:** Youtarr runs exclusively via Docker; direct `npm start`/Node deployments are unsupported.

## Using Development Builds

Want to try new features before they're officially released? Youtarr offers bleeding-edge development builds that contain the latest merged changes.

> ⚠️ **Warning:** Dev builds are not fully tested and may be unstable. Use at your own risk, and expect potential bugs or breaking changes. Recommended for testing/feedback only.

### Option 1: Using the start script (recommended)

```bash
./start.sh --dev --pull-latest
```

This pulls and runs the `dev-latest` image, which is automatically built whenever changes are merged to the `dev` branch.

### Option 2: Manual configuration

If you're not using the start script, set the `YOUTARR_IMAGE` environment variable in your `.env` file or docker-compose command:

```bash
# In .env file
YOUTARR_IMAGE=dialmaster/youtarr:dev-latest
```

Or with docker-compose directly:

```bash
YOUTARR_IMAGE=dialmaster/youtarr:dev-latest docker compose up -d
```

### Switching back to stable

Simply run without the `--dev` flag:

```bash
./start.sh --pull-latest
```

Or remove/comment out the `YOUTARR_IMAGE` line in your `.env` file to use the default stable `latest` tag.

## Documentation

### Getting Started
- [Installation Guide](docs/INSTALLATION.md) - Quick Start guide, installation and setup instructions
- [Usage Guide](docs/USAGE_GUIDE.md) - Step-by-step tutorials for common tasks
- [Configuration Reference](docs/CONFIG.md) - All configuration options
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) - Docker environment settings
- [Authentication Setup](docs/AUTHENTICATION.md) - Security and access control

### Media Server Setup
- [Media Servers Overview](docs/MEDIA_SERVERS.md) - Comparison and quick start
- [Plex Integration](docs/media-servers/plex.md) - Full Plex setup guide
- [Kodi Setup](docs/media-servers/kodi.md) - Kodi configuration
- [Jellyfin Setup](docs/media-servers/jellyfin.md) - Jellyfin integration
- [Emby Setup](docs/media-servers/emby.md) - Emby configuration

### Platform Guides
- [Synology NAS](docs/platforms/synology.md) - DSM 7+ optimized setup
- [Unraid](docs/platforms/unraid.md) - Community Applications template
- [External Database](docs/platforms/external-db.md) - Using existing MariaDB/MySQL

### Advanced Topics
- [Backup & Restore](docs/BACKUP_RESTORE.md) - Backup your configuration and database, restore to new systems
- [Database Management](docs/DATABASE.md) - Database configuration and maintenance
- [Docker Configuration](docs/DOCKER.md) - Advanced Docker settings
- [Development Guide](docs/DEVELOPMENT.md) - Contributing and development setup
- [API Documentation](http://localhost:3087/swagger) - Interactive Swagger/OpenAPI documentation (requires running instance)

### Help & Support
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [GitHub Issues](https://github.com/DialmasterOrg/Youtarr/issues) - Report bugs or request features
- [Discord Server](https://discord.gg/68rvWnYMtD) - Join the community for help and discussion

## Contributing

Interested in contributing to Youtarr? We welcome contributions of all kinds!

- [Contributing Guide](CONTRIBUTING.md) - How to contribute, coding standards, and development workflow
- [Development Guide](docs/DEVELOPMENT.md) - Technical setup and architecture details
- [Contributors](CONTRIBUTORS.md) - People who have helped build Youtarr

## Screenshots

<details>
<summary>Click to view screenshots</summary>

### Channel Management
![ChannelsPage](https://github.com/user-attachments/assets/75adf139-f202-499d-9eee-1c81b71a4355)

### Video Browser
![ChannelPage](https://github.com/user-attachments/assets/f658c97b-3898-477c-82d1-4a15d6b34207)


### Configuration
![ConfigurationPage](https://github.com/user-attachments/assets/9aba2e17-9d53-4adb-9c05-c6f9dc926dcf)


### Download Manager
![DownloadsPage](https://github.com/user-attachments/assets/5aa84c3c-6bc7-478b-b97d-c8f1e46e8ca2)

### Individual Video Modal
![VideoModal](https://github.com/user-attachments/assets/e27f8adb-73fc-4cc8-826e-bec1ac505b18)

### SponsorBlock Settings
![SponsorBlock](https://github.com/user-attachments/assets/0bcf1d1a-2d8c-4dff-9e67-abbe369e64d5)

</details>

## Legal Disclaimer

Youtarr is not affiliated with YouTube or Plex. Users are responsible for ensuring their use complies with YouTube's Terms of Service and applicable copyright laws. This tool is intended for personal use with content you have the right to download.

## License

Licensed under the ISC License. See [LICENSE.md](LICENSE.md) for details.
