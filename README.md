# Youtarr

![Backend Coverage](https://img.shields.io/badge/Backend_Coverage-79%25-yellow)
![Frontend Coverage](https://img.shields.io/badge/Frontend_Coverage-87%25-brightgreen)
![CI Status](https://github.com/DialmasterOrg/Youtarr/workflows/CI%20-%20Lint%20and%20Test/badge.svg)

Youtarr is a self-hosted YouTube downloader that automatically downloads videos from your favorite channels. It provides metadata for multiple media servers and offers optional Plex integration for automatic library refreshes.

> Don't want to self-host? You can also run Youtarr on [ElfHosted](https://store.elfhosted.com/product/youtarr/) with a managed deployment – see their [Youtarr docs](https://docs.elfhosted.com/app/youtarr/).

> **Like Youtarr?** Consider [supporting the project on Patreon](https://www.patreon.com/c/ChrisDial) to help keep it free and actively developed!

https://github.com/user-attachments/assets/cc153624-c905-42c2-8ee9-9c213816be3a

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
<img width="1888" height="1072" alt="Channel Management" src="https://github.com/user-attachments/assets/a4e8172c-eb7f-44bb-a891-a9d436ee9b73" />

### Video Browser
<img width="1489" height="976" alt="Video Browser" src="https://github.com/user-attachments/assets/cbf765c6-67d1-431b-a393-0ac0c4e2f7e2" />

### Configuration
<img width="1890" height="1383" alt="Configuration" src="https://github.com/user-attachments/assets/b8d586b1-fe5b-4cb4-a61a-79d1905cc44e" />

### Download Manager
<img width="1472" height="1236" alt="Download Manager" src="https://github.com/user-attachments/assets/cd71937b-8423-42b3-9ddd-070f69c80662" />

### SponsorBlock Settings
<img width="1476" height="1186" alt="SponsorBlock Settings" src="https://github.com/user-attachments/assets/86fb9b48-2284-4ef9-a76b-e083a2d70584" />

### Auto-Removal Preview
<img width="1466" height="1227" alt="Auto-Removal Preview" src="https://github.com/user-attachments/assets/12629a9f-56be-4c71-8c43-e6673504f388" />
</details>

## Legal Disclaimer

Youtarr is not affiliated with YouTube or Plex. Users are responsible for ensuring their use complies with YouTube's Terms of Service and applicable copyright laws. This tool is intended for personal use with content you have the right to download.

## License

Licensed under the ISC License. See [LICENSE.md](LICENSE.md) for details.