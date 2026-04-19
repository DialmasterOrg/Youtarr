# Youtarr

![Backend Coverage](https://img.shields.io/badge/Backend_Coverage-80%25-brightgreen)
![Frontend Coverage](https://img.shields.io/badge/Frontend_Coverage-83%25-brightgreen)
![CI Status](https://github.com/DialmasterOrg/Youtarr/workflows/CI%20-%20Lint%20and%20Test/badge.svg)

Youtarr is a self-hosted YouTube downloader that automatically downloads videos from your favorite channels. It provides metadata for multiple media servers and offers optional Plex integration for automatic library refreshes.

> Don't want to self-host? You can also run Youtarr on [ElfHosted](https://store.elfhosted.com/product/youtarr/) with a managed deployment – see their [Youtarr docs](https://docs.elfhosted.com/app/youtarr/).

> **Like Youtarr?** Consider [supporting the project on Patreon](https://www.patreon.com/c/ChrisDial) to help keep it free and actively developed!

https://github.com/user-attachments/assets/a80548fc-bcf9-4ad0-889c-dbd5aac250ee

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
- **Find on YouTube**: Search YouTube from inside Youtarr, see which results are already downloaded or missing, and click any result to queue a download
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

## How Youtarr compares to Pinchflat

Youtarr and [Pinchflat](https://github.com/kieraneglin/pinchflat) solve the same core problem — automated, yt-dlp-powered YouTube archiving for Plex, Jellyfin, Kodi, and Emby — and the two tools overlap heavily. SponsorBlock, NFO metadata, cookies, Apprise notifications, per-channel quality/duration/date filters, and ARM-friendly Docker deployment are all supported on both.

Youtarr predates Pinchflat (first commit May 2023 vs. January 2024); the two projects arrived at similar solutions independently and have evolved in parallel. For a side-by-side of where they actually differ — Plex integration, in-app playback, content ratings, REST API, RSS feeds, indexing strategy — see [Youtarr vs Pinchflat](docs/YOUTARR_VS_PINCHFLAT.md).

## Quick Start

You'll need Docker, Docker Compose, Git, and a Bash shell (Git Bash on Windows). See the [Installation Guide](docs/INSTALLATION.md) for prerequisites, install methods, initial setup, and updating.

> **Heads up:** Youtarr runs exclusively via Docker; direct `npm start`/Node deployments are unsupported.

> Want to try unreleased features? See [Using Development Builds](docs/DEVELOPMENT.md#using-development-builds) for the bleeding-edge `dev-latest` image.

## Documentation

### Setup & Configuration
- [Installation Guide](docs/INSTALLATION.md) - Install methods, initial setup, and updating
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
- [Development Guide](docs/DEVELOPMENT.md) - Contributing, development setup, and using bleeding-edge dev builds
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

### Channel Management (using "Dark Modern" theme)
<img width="1522" height="850" alt="image" src="https://github.com/user-attachments/assets/76a23a1a-2c8d-4c27-8ebc-4f430917a2e7" />

### Video Browser (using "Playful (Classic)" theme)
<img width="1507" height="1298" alt="image" src="https://github.com/user-attachments/assets/b7b50a72-942c-4653-930f-270ca27ac888" />

### Configuration (using "Bold Flat" theme)
<img width="1524" height="1296" alt="image" src="https://github.com/user-attachments/assets/3d6c28a6-c564-4972-b275-71da11dc39e9" />

### Download Manager (Dark Modern)
<img width="1521" height="1297" alt="image" src="https://github.com/user-attachments/assets/3a13c822-af39-4498-8e2c-9dcc990b3cfb" />

### Individual Video Modal (Playful Classic)
<img width="1523" height="1117" alt="image" src="https://github.com/user-attachments/assets/6d08ac34-544b-4e8c-8bfe-5b8fd3f341fe" />

### Search for videos on YouTube from in-app (Bold Flat)
<img width="1507" height="1120" alt="image" src="https://github.com/user-attachments/assets/1c42f56e-57a3-41b5-b1c7-89f5552d3c99" />

### Responsive for mobile (Bold Flat)
<img width="340" height="757" alt="image" src="https://github.com/user-attachments/assets/79f153ef-01d0-4238-8f11-d04f5ea6aad8" />

</details>

## Legal Disclaimer

Youtarr is not affiliated with YouTube or Plex. Users are responsible for ensuring their use complies with YouTube's Terms of Service and applicable copyright laws. This tool is intended for personal use with content you have the right to download.

## License

Licensed under the ISC License. See [LICENSE.md](LICENSE.md) for details.
