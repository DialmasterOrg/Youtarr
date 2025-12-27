# Configuration Reference (config.json)

This document provides a comprehensive reference for all configuration options in Youtarr's `config.json` file.
These settings can be changed from the Configuration page in the web UI.

## Table of Contents
- [Configuration File Location](#configuration-file-location)
- [Core Settings](#core-settings)
- [Plex Integration](#plex-integration)
- [SponsorBlock Settings](#sponsorblock-settings)
- [Kodi, Emby and Jellyfin Compatibility](#kodi-emby-and-jellyfin-compatibility)
- [Cookie Config](#cookie-config)
- [Notifications](#notifications)
- [Download Performance](#download-performance)
- [Advanced Settings](#advanced-settings)
- [Auto-Removal Settings](#auto-removal-settings)
- [Account & Security](#account--security)
- [System Fields](#system-fields)
- [Configuration Examples](#configuration-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Configuration File Location

The configuration file is stored at `./config/config.json` relative to your Youtarr installation directory.

### Auto-Creation
The `config.json` is automatically created on first startup if it doesn't exist, with sensible defaults from `config.example.json`.

### Editing Configuration
Configuration can be modified through:
1. **Web UI** (recommended) - Configuration page in the application
2. **Manual editing** - Stop Youtarr, edit the JSON file, restart
3. **Environment variables** - Some values can be overridden (see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md))

## Core Settings

### Youtube Output Directory
- **Config Key**: *This can only be set via .env and is view only in the web UI*
- **Type**: `string`
- **Default**: `"./downloads"`
- **Description**: Directory path for downloaded videos
- **Note**: Set during initial setup or via YOUTUBE_OUTPUT_DIR environment variable

### Enable Automatic Downloads
- **Config Key**: `channelAutoDownload`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Automatically download most recent videos from auto-download enabled channels and tabs
- **Note**: When true, the newest videos automatically downloaded on a cron schedule

### Download Frequency
- **Config Key**: `channelDownloadFrequency`
- **Type**: `string` (cron expression)
- **Default**: `"0 * * * *"` (hourly)
- **Description**: Cron schedule for automatic channel refreshes and downloads
- **Examples**:
  - `"0 */6 * * *"` - Every 6 hours
  - `"0 2 * * *"` - Daily at 2 AM
  - `"0 0 * * 0"` - Weekly on Sunday at midnight
  - `"*/30 * * * *"` - Every 30 minutes

### Files to Download per Channel
- **Config Key**: `channelFilesToDownload`
- **Type**: `number`
- **Default**: `5`
- **Description**: Maximum number of most recent videos to download per channel per scheduled auto download
- **Range**: 1-10
- **Note**: Applies to scheduled autodownloads and manually triggered channel downloads

### Preferred Resolution
- **Config Key**: preferredResolution
- **Type**: `string`
- **Default**: `"1080"`
- **Options**: `"4320"`, `"2160"`, `"1440"`, `"1080"`, `"720"`, `"480"`, `"360"`, `"240"`, `"144"`
- **Description**: Global setting for preferred download resolution
- **Note**: Downloads from YouTube at best available quality up to this limit

### Preferred Video Codec
- **Config Key**: `videoCodec`
- **Type**: `string`
- **Default**: `"default"`
- **Options**: `"default"`, `"h264"`, `"h265"`
- **Description**: Preferred video codec for downloads, default generally downloads as vp9 or av1
- **Compatibility**:
  - `h264`: Best compatibility with all devices
  - `h265`: Better compression, requires modern devices
  - `vp9`: YouTube's preferred codec
  - `av1`: Best compression, limited device support

### Default Subfolder
- **Config Key**: `defaultSubfolder`
- **Type**: `string`
- **Default**: `""` (empty - downloads to root directory)
- **Description**: Default download location for untracked channels and channels set to use "Default Subfolder"
- **Note**: Subfolders are prefixed with `__` on the filesystem (e.g., setting `Sports` creates `__Sports/`)
- **Channel Subfolder Semantics**:
  - **"Default Subfolder"** (NULL in database): Channel uses this global default setting
  - **"No Subfolder"** (special value): Channel explicitly downloads to root directory, ignoring the global default
  - **Specific subfolder**: Channel downloads to that specific subfolder
- **Use Cases**:
  - Organize untracked manual downloads into a specific folder
  - Set a default location while allowing individual channels to override
  - Explicitly place specific channels in the root directory using "No Subfolder"

### Enable Subtitles
- **Config Key**: `subtitlesEnabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Download subtitles/closed captions with videos

### Subtitle Languages
- **Config Key**: `subtitleLanguage`
- **Type**: `string`
- **Default**: `"en"`
- **Description**: Preferred subtitle language(s) when downloading subtitle files for videos (ISO 639-1 code)
- **Examples**: `"en"` (English), `"es"` (Spanish), `"fr"` (French)
- **Note**: Only displayed when subtitles are enabled

### Dark Mode
- **Config Key**: `darkModeEnabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable dark mode in web UI

## Plex Integration

### Plex API Key
- **Config Key**: `plexApiKey`
- **Type**: `string`
- **Default**: `""` (empty)
- **Description**: Plex authentication token (X-Plex-Token)
- **Note**: Can be obtained through Plex OAuth in the web UI or manually entered

### Plex YouTube Library ID
- **Config Key**: `plexYoutubeLibraryId`
- **Type**: `string`
- **Default**: `""` (empty)
- **Description**: Plex library section ID for YouTube videos
- **Note**: Library refresh is automatically triggered if configured when new videos are downloaded

### Plex IP
- **Config Key**: `plexIP`
- **Type**: `string`
- **Default**: `""` (empty)
- **Description**: Plex server IP address or hostname
- **Examples**: `"192.168.1.100"`, `"host.docker.internal"`

### Plex Port
- **Config Key**: `plexPort`
- **Type**: `string`
- **Default**: `"32400"`
- **Description**: Plex server port number

### Use HTTPS for Plex
- **Config Key**: `plexViaHttps`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Use HTTPS for Plex connections
- **Note**: Enable for remote Plex servers or when SSL is configured

### Plex URL Override
- **Config Key**: `plexUrl`
- **Type**: `string`
- **Default**: `""` (empty)
- **Description**: Optional full Plex base URL (e.g., `https://plex.example.com:32400`)
- **Usage**: Not configurable via the web UI. Edit `config/config.json` manually or set the `PLEX_URL` environment variable to populate it.
- **Note**: When this field is set it takes precedence over the `plexIP`, `plexPort`, and `plexViaHttps` values shown in the UI.

## SponsorBlock Settings

### Enable SponsorBlock
- **Config Key**: `sponsorblockEnabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable SponsorBlock to skip/remove sponsored segments

### SponsorBlock Action
- **Config Key**: `sponsorblockAction`
- **Type**: `string`
- **Default**: `"remove"`
- **Options**: `"remove"`, `"mark"`
- **Description**: How to handle sponsored segments
  - `remove`: Cut segments from video file
  - `mark`: Add chapters to mark segments

### SponsorBlock Categories
- **Config Key**: `sponsorblockCategories`
- **Type**: `object`
- **Default**:
```json
{
  "sponsor": true,
  "intro": false,
  "outro": false,
  "selfpromo": true,
  "preview": false,
  "filler": false,
  "interaction": false,
  "music_offtopic": false
}
```
- **Description**: Which segment types to skip/remove

### SponsorBlock API URL
- **Config Key**: `sponsorblockApiUrl`
- **Type**: `string`
- **Default**: `""` (uses default SponsorBlock API)
- **Description**: Custom SponsorBlock API server URL (optional)
- **Example**: `"https://sponsor.ajay.app"`

## Kodi, Emby and Jellyfin Compatibility

### Write Channel Posters
- **Config Key**: `writeChannelPosters`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Generate channel poster images for media servers
- **Note**: Creates poster.jpg in each channel directory

### Write Video NFO Files
- **Config Key**: `writeVideoNfoFiles`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Generate NFO metadata files for Kodi/Jellyfin/Emby
- **Note**: Creates .nfo XML files with video metadata

## Cookie Config

### Enable Cookies
- **Config Key**: `cookiesEnabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Use cookies for YouTube authentication
- **Note**: May be required in some cases to get around YouTube bot detection

### Custom Cookies Uploaded
- **Config Key**: `customCookiesUploaded`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Indicates if custom cookies.txt file has been uploaded
- **Note**: Managed automatically by the application

## Notifications

Youtarr uses [Apprise](https://github.com/caronc/apprise) to send notifications when new videos are downloaded, supporting 100+ notification services.

### Enable Notifications
- **Config Key**: `notificationsEnabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable notifications when new videos are downloaded

### Apprise URLs
- **Config Key**: `appriseUrls`
- **Type**: `array` of objects
- **Default**: `[]` (empty array)
- **Description**: List of notification service configurations

Each entry in the array is an object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `url` | `string` | Apprise-compatible notification URL |
| `name` | `string` | Friendly name for this notification (e.g., "Discord - Gaming Server") |
| `richFormatting` | `boolean` | Enable rich formatting (embeds, styled text) when supported |

**Example Configuration:**
```json
{
  "appriseUrls": [
    {
      "url": "discord://webhook_id/webhook_token",
      "name": "Discord Server",
      "richFormatting": true
    },
    {
      "url": "tgram://bot_token/chat_id",
      "name": "Telegram Group",
      "richFormatting": true
    },
    {
      "url": "ntfy://my-topic",
      "name": "Ntfy Mobile",
      "richFormatting": false
    }
  ]
}
```

### Rich Formatting

For supported services, Youtarr sends beautifully formatted notifications with embeds, styled text, video cards, and timestamps. Services without rich formatting support receive plain text notifications.

| Service | URL Format | Rich Formatting |
|---------|------------|-----------------|
| Discord | `discord://webhook_id/webhook_token` | ✅ Embeds with colors, thumbnails |
| Telegram | `tgram://bot_token/chat_id` | ✅ HTML formatting |
| Slack | `slack://token_a/token_b/token_c` | ✅ Block Kit formatting |
| Email | `mailto://user:pass@gmail.com` | ✅ HTML email with styling |
| Pushover | `pover://user_key@app_token` | ❌ Plain text |
| Ntfy | `ntfy://topic` | ❌ Plain text |
| Other services | Various | ❌ Plain text |

Toggle "Rich formatting" off on any webhook to send plain text instead.

### Supported Services

Apprise supports 100+ notification services. See the [Apprise Notification Services Wiki](https://github.com/caronc/apprise/wiki#notification-services) for a complete list and URL formats.

Common services include:
- **Discord**: `discord://webhook_id/webhook_token`
- **Telegram**: `tgram://bot_token/chat_id`
- **Slack**: `slack://token_a/token_b/token_c`
- **Pushover**: `pover://user_key@app_token`
- **Ntfy**: `ntfy://topic` or `ntfys://your-server/topic`
- **Email**: `mailto://user:pass@gmail.com`
- **Matrix**: `matrix://user:pass@hostname/#room`
- **Gotify**: `gotify://hostname/token`

### Migration from Discord Webhook

If you previously used the `discordWebhookUrl` configuration option, Youtarr automatically migrates it to the new `appriseUrls` format on startup:

**Before (legacy):**
```json
{
  "discordWebhookUrl": "https://discord.com/api/webhooks/123/abc",
  "notificationService": "discord"
}
```

**After (automatic migration):**
```json
{
  "appriseUrls": [
    {
      "url": "https://discord.com/api/webhooks/123/abc",
      "name": "Discord Webhook",
      "richFormatting": true
    }
  ]
}
```

The old `discordWebhookUrl` and `notificationService` fields are automatically removed after migration. No manual action is required.

## Download Performance

### Download Socket Timeout
- **Config Key**: `downloadSocketTimeoutSeconds`
- **Type**: `number`
- **Default**: `30`
- **Description**: Network timeout for download connections (seconds)
- **Range**: 10-300
- **Note**: Corresponds to yt-dlp `--socket-timeout` setting. Time to wait before giving up, in seconds.

### Download Throttled Rate
- **Config Key**: `downloadThrottledRate`
- **Type**: `string`
- **Default**: `"100K"`
- **Description**: Bandwidth limit for downloads
- **Examples**: `"500K"`, `"1M"`, `"10M"`, `""` (unlimited)
- **Note**: Corresponds to yt-dlp `--throttled-rate` setting. Minimum download rate in bytes per second below which throttling is assumed and the video data is re-extracted.

### Download Retry Count
- **Config Key**: `downloadRetryCount`
- **Type**: `number`
- **Default**: `2`
- **Description**: Number of retry attempts for failed downloads
- **Range**: 0-10
- **Note**: Used for yt-dlp `--fragment-retries` and `--retries` settings.

### Enable Stall Detection
- **Config Key**: `enableStallDetection`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Detect and abort stalled downloads
- **Note**: Setting to control whether stall detection window and rate threshold are used.

### Stall Detection Window
- **Config Key**: `stallDetectionWindowSeconds`
- **Type**: `number`
- **Default**: `30`
- **Description**: Time window for stall detection (seconds)

### Stall Detection Rate Threshold
- **Config Key**: `stallDetectionRateThreshold`
- **Type**: `string`
- **Default**: `"100K"`
- **Description**: Minimum download rate before considering stalled

### Sleep Between Requests
- **Config Key**: `sleepRequests`
- **Type**: `number`
- **Default**: `1`
- **Description**: Delay between YouTube API requests (seconds)
- **Note**: Corresponds to yt-dlp `--sleep-requests` setting.

## Advanced Settings

### Proxy
- **Config Key**: `proxy`
- **Type**: `string`
- **Default**: `""` (empty)
- **Description**: HTTP/HTTPS proxy for downloads
- **Format**: `"http://proxy:port"` or `"socks5://proxy:port"`

### Use External Temporary Directory
- **Config Key**: `useTmpForDownloads`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Controls where downloads are staged before moving to final location:
  - `false` (default): Downloads are staged in a hidden `.youtarr_tmp/` directory within your output folder. Uses fast atomic renames since source and destination are on the same filesystem. The dot-prefix hides in-progress downloads from media servers like Plex and Jellyfin.
  - `true`: Downloads are staged in the external path specified by `tmpFilePath` (e.g., `/tmp`). Useful when your output directory is on slow network storage and you want to download to fast local storage first.
- **Note**: Some managed platforms (e.g., ElfHosted) force this value on.

### External Temporary File Path
- **Config Key**: `tmpFilePath`
- **Type**: `string`
- **Default**: `"/tmp/youtarr-downloads"`
- **Description**: External temporary directory for downloads when `useTmpForDownloads` is `true`
- **Note**: Only used when `useTmpForDownloads` is enabled. Internal path in Youtarr container.

## Auto-Removal Settings

### Enable Auto-Removal
- **Config Key**: `autoRemovalEnabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable automatic deletion of old videos

### Free Space Threshold
- **Config Key**: `autoRemovalFreeSpaceThreshold`
- **Type**: `string`
- **Default**: `null` (not set)
- **Description**: Minimum free space to maintain
- **Examples**: `"100GB"`, `"500GB"`, `"1TB"`
- **Note**: Deletes oldest videos when space falls below threshold

### Video Age Threshold
- **Config Key**: `autoRemovalVideoAgeThreshold`
- **Type**: `string`
- **Default**: `null` (not set)
- **Description**: Delete videos older than this age
- **Examples**: `"30d"` (30 days), `"3m"` (3 months), `"1y"` (1 year)

## Account & Security

### username
- **Type**: `string`
- **Default**: Not set (must be configured)
- **Description**: Login username for the web interface
- **Validation**: 3-32 characters, no leading/trailing spaces
- **Note**: Set during initial setup or via AUTH_PRESET_USERNAME environment variable

### passwordHash
- **Type**: `string`
- **Default**: Not set (must be configured)
- **Description**: Bcrypt hash of the login password
- **Note**: Never edit directly - use web UI or AUTH_PRESET_PASSWORD environment variable


## System Fields

These fields are managed automatically by the application:

### uuid
**Type**: `string`
**Default**: Auto-generated
**Description**: Unique installation identifier
**Note**: Currently unused

## Configuration Examples

See config/config.example.json

## Best Practices

1. **Backup your config.json** before major changes
2. **Use the Web UI** for configuration when possible
3. **Test cron expressions** at [crontab.guru](https://crontab.guru/)
4. **Monitor disk space** when enabling auto-downloads
5. **Start conservative** with download frequency to avoid rate limiting

## Troubleshooting

### Configuration Not Saving
- Check file permissions: `ls -la config/config.json`
- Ensure proper ownership matches YOUTARR_UID/GID
- Check logs for write permission errors

### Missing Configuration Options in UI
- Clear browser cache
- Ensure you're running the latest version
- Check browser console for JavaScript errors

### Downloads Not Running on Schedule
- Verify cron expression syntax
- Check timezone setting (TZ environment variable)
- Review logs for scheduler errors
