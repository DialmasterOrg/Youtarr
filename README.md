# Youtarr

![Backend Coverage](https://img.shields.io/badge/Backend_Coverage-91%25-brightgreen)
![Frontend Coverage](https://img.shields.io/badge/Frontend_Coverage-91%25-brightgreen)
![CI Status](https://github.com/DialmasterOrg/Youtarr/workflows/CI%20-%20Lint%20and%20Test/badge.svg)

Youtarr is a self-hosted YouTube downloader, powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp), that automatically downloads videos from your favorite channels and playlists. It provides metadata for multiple media servers, mirrors your subscribed YouTube playlists into Plex, Jellyfin, and Emby as native playlists, pulls watch status back from those servers so you can filter your library by what's been watched, and refreshes your Plex, Jellyfin, or Emby library after each download so new videos show up right away. Learn more at [youtarr.com](https://youtarr.com).

**Docs:** [dialmasterorg.github.io/Youtarr](https://dialmasterorg.github.io/Youtarr/) - searchable install, configuration, media server, and troubleshooting guides.

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

### Downloading

- **Channel Subscriptions**: Subscribe to channels and auto-download new videos, shorts, and streams with per-tab controls. You can bring over your existing YouTube subscriptions from a Google Takeout file or a one-time cookies file ([guide](docs/USAGE_GUIDE.md#import-youtube-subscriptions))
- **Playlist Subscriptions**: Subscribe to YouTube playlists and auto-download their videos into the right channel folders. Youtarr mirrors each playlist into Plex, Jellyfin, and Emby as a native playlist and writes a universal `.m3u` file for any other player
- **One-Off Downloads**: Paste a video URL and preview it before downloading, or queue the video you're watching with the Send to Youtarr bookmarklet. It also works from your phone with Apple Shortcuts or Tasker ([guide](docs/API_INTEGRATION.md#bookmarklet-setup))
- **Find on YouTube**: Search YouTube for channels and videos from inside Youtarr. Video results show what you've already downloaded, and a click subscribes to a channel or queues a download
- **Quality and Format**: Global and per-channel resolution (360p to 4K), MP3 alongside or instead of video, and automatic removal of sponsored segments with SponsorBlock
- **Cookies and Members-Only Videos**: Use a cookies file for videos that need a signed-in account, with a Test cookies button to check it still works. If the account is a member of a channel, Youtarr downloads that channel's members-only videos too ([details](docs/CONFIG.md#members-only-videos))

### Your library

- **Organized by Channel**: Each channel gets its own folder, and you can group channels into subfolders (e.g., `__kids`, `__music`, `__news`) to create separate media server libraries
- **Custom Filenames**: Choose how your video files are named with a template, with a live preview and ready-made presets ([details](docs/CONFIG.md#video-filename-template))
- **Metadata**: NFO files, poster images, and embedded MP4 metadata for all media servers, plus content ratings (`G`, `PG`, `PG-13`, `R`, and so on) per video or per channel and extra tags per channel
- **Browse and Play**: Search and filter every video from your channels, with tabs for Videos, Shorts, and Streams. Click a thumbnail to see its details and play a downloaded video right in your browser; no media server required
- **Filesystem Rescan**: Move, rename, or convert files outside Youtarr (e.g., `.mp4` to `.mkv`) and a rescan catches up, either on its daily schedule or when you start one from Settings -> Maintenance & Rescan. If your downloads drive or network share isn't mounted, Youtarr holds downloads and leaves your library alone instead of marking everything missing

### Media servers and integrations

- **Library Refresh**: Youtarr refreshes your Plex, Jellyfin, or Emby library after each download, so new videos show up right away
- **Watch Status Sync**: Pull watched state from Plex, Jellyfin, and Emby for every user on the server, show a Watched chip on listing pages, and filter your library by watched or unwatched. It's one-way; Youtarr never writes back to your servers
- **Sonarr and Radarr**: Add Youtarr to Sonarr or Radarr as an indexer and download client. A search there finds matching YouTube videos, Youtarr downloads the one that gets grabbed, and Sonarr or Radarr imports it into its own library ([guide](docs/SONARR_RADARR.md))
- **REST API**: Full API with interactive [Swagger/OpenAPI documentation](http://localhost:3087/swagger) for automation and integrations, plus read-only status keys for dashboards and monitoring tools ([guide](docs/API_INTEGRATION.md#api-keys))
- **Notifications and RSS**: Optional alerts for new downloads, failures, cleanup, and storage pauses via Apprise (Discord, Slack, Telegram, email, Pushover, Gotify, ntfy, Matrix, and more), or follow new downloads in your RSS reader with a private feed ([guide](docs/USAGE_GUIDE.md#rss-feeds))

### Automation and storage

- **Scheduling**: Choose how often automatic downloads and maintenance tasks run (a preset, a daily time, or a cron expression), see when each task last ran and how long it took, and start any of them right away with Run now
- **Auto-Cleanup and Storage Limits**: Remove videos by age, free space, or watched status, with a dry-run preview first and protection for the videos, channels, and newest downloads you want to keep. You can also pause downloads when your library passes a size you set or free space runs low

### Running it

- **Web Interface**: Manage everything through a responsive (PC or mobile) web UI with built-in authentication
- **Platform Guides**: Configurable storage paths and setup guides for Unraid (with a Community Applications template), Synology, Asustor, and Portainer
- **VPN Support**: Route Youtarr's traffic through a [Gluetun](https://github.com/qdm12/gluetun) VPN container with an optional Compose override

## How Youtarr compares

Youtarr predates [Pinchflat](https://github.com/kieraneglin/pinchflat) (first commits May 2023 vs. January 2024); the two arrived at similar solutions independently and have evolved in parallel since. For a side-by-side of where Youtarr, Pinchflat, and [Tube Archivist](https://github.com/tubearchivist/tubearchivist) differ on Plex integration, Sonarr and Radarr support, in-app playback, watch-status tracking, content ratings, REST API, filename templating, and transcript search, see the [comparison doc](docs/YOUTARR_VS_ALTERNATIVES.md).

## Quick Start

You'll need Docker, Docker Compose, Git, and a Bash shell (Git Bash on Windows). See the [Installation Guide](docs/INSTALLATION.md) for prerequisites, install methods, initial setup, and updating.

> **Heads up:** Youtarr runs exclusively via Docker; direct `npm start`/Node deployments are unsupported.

> Want to try unreleased features? See [Using Development Builds](docs/DEVELOPMENT.md#using-development-builds) for the bleeding-edge `dev-latest` image.

> **Database note for Docker Desktop/ARM/NAS users:** Fresh installs started with `./start.sh` use Docker named-volume storage for MariaDB. Existing bind-mounted installs and plain `docker compose up -d` installs may use `./database`; on virtualized filesystems this can be risky for MariaDB schema migrations. If you see `Table ... doesn't exist in engine` or `Incorrect information in file` errors, or if you want to proactively migrate, see [Database Management](docs/DATABASE.md#migrating-from-bind-mount-to-named-volume).

## Documentation

### Setup & Configuration
- [Installation Guide](docs/INSTALLATION.md) - Install methods, initial setup, and updating
- [Usage Guide](docs/USAGE_GUIDE.md) - Step-by-step tutorials for common tasks
- [Sonarr and Radarr](docs/SONARR_RADARR.md) - Use Youtarr as an indexer and download client for Sonarr and Radarr
- [Configuration Reference](docs/CONFIG.md) - All configuration options
- [Download Folder Structure](docs/YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md) - How Youtarr names and organizes your files on disk
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) - Docker environment settings
- [Authentication Setup](docs/AUTHENTICATION.md) - Security and access control

### Media Server Setup
- [Media Servers Overview](docs/MEDIA_SERVERS.md) - Comparison and quick start
- [Plex Integration](docs/media-servers/plex.md) - Full Plex setup guide
- [Kodi Setup](docs/media-servers/kodi.md) - Kodi configuration
- [Jellyfin Setup](docs/media-servers/jellyfin.md) - Jellyfin integration
- [Emby Setup](docs/media-servers/emby.md) - Emby configuration
- [Media Server Playlists](docs/MEDIA_SERVER_PLAYLISTS.md) - Sync subscribed playlists to Plex, Jellyfin, and Emby

### Platform Guides
- [Synology NAS](docs/platforms/synology.md) - DSM 7+ optimized setup
- [Unraid](docs/platforms/unraid.md) - Community Applications template
- [Asustor NAS](docs/platforms/asustor.md) - App Central community package
- [Portainer](docs/platforms/portainer.md) - Stack setup that keeps your data in folders you choose
- [External Database](docs/platforms/external-db.md) - Using existing MariaDB/MySQL

### Advanced Topics
- [Backup & Restore](docs/BACKUP_RESTORE.md) - Backup your configuration and database, restore to new systems
- [Database Management](docs/DATABASE.md) - Database configuration and maintenance
- [Docker Configuration](docs/DOCKER.md) - Advanced Docker settings
- [Development Guide](docs/DEVELOPMENT.md) - Contributing, development setup, and using bleeding-edge dev builds
- [API Documentation](http://localhost:3087/swagger) - Interactive Swagger/OpenAPI documentation (requires running instance)
- [API Integration](docs/API_INTEGRATION.md) - API keys, the bookmarklet, phone shortcuts, and dashboards
- [External API](docs/EXTERNAL_API.md) - Opt-in API (off by default) that lets other apps browse your library and request videos or channels, with per-key permissions and approvals
- [Gluetun Integration](docs/GLUETUN_INTEGRATION.md) - Gluetun VPN integration for Youtarr

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

### Settings (using "Bold Flat" theme)
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
