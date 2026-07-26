# Emby Integration Guide

Complete guide for integrating Youtarr with Emby Media Server.

## Table of Contents
- [Overview](#overview)
- [Library Setup](#library-setup)
- [Metadata Configuration](#metadata-configuration)
- [Native Playlist Sync](#native-playlist-sync)
- [Channel Playlist Files (.m3u)](#channel-playlist-files-m3u)
- [Multi-Library Organization](#multi-library-organization)
- [Advanced Settings](#advanced-settings)
- [Troubleshooting](#troubleshooting)

## Overview

Youtarr provides comprehensive Emby support through:
- NFO metadata files with complete video information
- Channel poster artwork
- Embedded MP4 metadata
- Multi-library support for content organization
- Compatible folder structure
- Native playlist sync: subscribed YouTube playlists appear as Emby playlists (see [Native Playlist Sync](#native-playlist-sync))

## Library Setup

### Step 1: Add New Library

1. In Emby, go to Settings → Library
2. Click "Add Media Library"
3. Select library type:
   - **Type**: `Movies` (current recommendation; see [Choosing a library type](#choosing-a-library-type) below)
   - **Display Name**: YouTube (or your preference)

#### Choosing a library type

Youtarr writes each video as a standalone "movie" with its own NFO metadata, so two Emby library types can read the library:

- **`Movies` (current recommendation)**: the most reliable option. Every video displays as a movie with full metadata and artwork. Limitation: Emby will NOT automatically import Youtarr's optional per-channel `.m3u` playlist files as playlists; that only happens in Mixed Content libraries. See [Channel Playlist Files (.m3u)](#channel-playlist-files-m3u).
- **`Mixed Content`**: automatically imports the per-channel `.m3u` files as Emby playlists, but [Emby's own documentation](https://emby.media/support/articles/Library-Setup.html) notes that "support for mixed content is limited", and its TV-detection heuristics can misclassify channel content as TV series: video titles that look episode-like ("Season 3", "Episode 12") can be picked up as episodes and display with wrong metadata. This tends to work on smaller libraries and break as the library grows, since more titles means more chances for a false match.
- **`TV Shows`**: not currently supported. Writing videos and metadata in a way that is compatible with TV Shows libraries is on our roadmap but is not supported yet.

### Step 2: Add Media Folders

Configure folder settings:
1. Click "Add" to add folder
2. Browse to your Youtarr download directory
3. For specific content types, use subfolders associated to different libraries:
   - `/path/to/youtube/__kids`
   - `/path/to/youtube/__music`
   - `/path/to/youtube` (all content)

### Step 3: Configure Library Settings

In the library configuration:

**Metadata downloaders**:
1. **NFO** (enable and move to top)
2. Disable all internet providers (TheMovieDb, etc.)

**Metadata savers**:
- **Disable**: Nfo ("Save metadata to NFO")

> **Warning**: Do NOT enable Emby's NFO metadata saver. Youtarr generates and maintains the `.nfo` file for every video it downloads. If the saver is enabled, Emby will update and overwrite those files with its own data (for example, incorrectly guessed season/episode tags), which can cause problems for your library.

**Image fetchers**:
- **Local Images** (enable)
- Disable all internet image providers

**Advanced Settings**:
- **Save artwork and metadata into media folders**: No (see the NFO saver warning above)
- **Prefer embedded metadata**: Yes
- **Enable real-time monitoring**: Optional

## Metadata Configuration

### NFO Support

Emby reads comprehensive NFO files containing:
- **Title**: Video title with channel name
- **Plot**: Complete YouTube description
- **Premiered**: Original upload date
- **Studios**: Channel/creator name
- **Genres**: YouTube categories
- **Tags**: Video keywords and topics
- **Runtime**: Video duration
- **Unique ID**: YouTube video identifier

### Artwork Configuration

Youtarr provides:
- **`poster.jpg`**: Channel artwork in channel folders
- **`<VIDEO NAME>.jpg`**: Video thumbnails in video folders
- Proper naming conventions for Emby recognition

### Embedded Metadata

MP4 files include:
- Title and description
- Upload date
- Channel information
- Genre/category tags
- Ensures basic info even without NFO

## Native Playlist Sync

The library and metadata setup above is all you need for downloaded videos to show up in Emby. Playlist sync is separate: connect it only if you want your subscribed YouTube playlists to appear as native Emby playlists.

### Step 1: Create an Emby API key

1. In Emby, go to **Settings -> Advanced -> API Keys**
2. Create a new key for Youtarr and copy it

### Step 2: Connect Emby in Youtarr

1. In Youtarr, open **Settings -> Emby Integration**
2. Enter the **Emby URL** and the **API key** from Step 1
3. Open the **Emby User** dropdown and pick the account that should own the playlists. (Youtarr loads the user list from your server; you can also enter the user ID by hand.)
4. (Optional) Leave **Video Library IDs** blank. Youtarr matches downloaded videos to Emby items across all your libraries.
5. Click **Test Connection**, then turn on **Enable Emby integration**

Once connected, open a playlist in Youtarr and turn on its Emby sync chip. See [Media Server Playlists](../MEDIA_SERVER_PLAYLISTS.md) for how syncing, ordering, and updates work.

Connecting Emby also enables watch status sync: Youtarr periodically pulls per-video watch state (played, percent watched, last watched) for every user on the server and shows it as Watched chips and filters on its listing pages. It's one-way; Youtarr never marks anything watched on Emby. Emby decides when a video counts as played: edit the library and set **Max resume percentage**; stop after that point and the title counts as fully played. Settings live under **Settings -> Watch Status**; see [Track Watch Status from Media Servers](../USAGE_GUIDE.md#track-watch-status-from-media-servers).

### Visibility

A playlist marked **Public** in Youtarr is created as a server-wide (shared) Emby playlist that all users can see; a **Private** one is owned by the configured user account only. Emby sets this when the playlist is created, so changing Public/Private for a playlist that already exists takes effect on the next sync that recreates it. Emby also shows shared playlists as read-only, which is expected: Youtarr owns these playlists and rewrites them on every sync.

## Channel Playlist Files (.m3u)

Separately from playlist sync, each channel has an optional "Generate channel playlist file (.m3u)" setting that writes a `<Channel Name>.m3u` playlist at the top of the channel folder (see [Channel playlist file](../USAGE_GUIDE.md#channel-playlist-file-m3u)).

Whether Emby picks that file up as a playlist depends on the library type:

- **Mixed Content**: Emby imports the file automatically as a (read-only) playlist during library scans, and picks up changes on later scans.
- **Movies**: Emby ignores the file. This is expected behavior, not a bug.

If you keep the recommended Movies library type, you can still open the file directly in any `.m3u`-capable player (VLC, mpv, Kodi).

## Multi-Library Organization

### Setting Up Multiple Libraries

Create content-specific libraries:

1. **Library Structure**:
   ```
   "YouTube - Kids" → /youtube/__kids
   "YouTube - Music" → /youtube/__music
   "YouTube - Education" → /youtube/__education
   "YouTube - General" → /youtube
   ```

2. **Configure Each Library**:
   - Kids: Parental controls enabled
   - Music: Music visualization options
   - Education: Documentary settings
   - General: Standard movie configuration

### Benefits of Separation

- **Access Control**: User-specific library access
- **Organization**: Easier content discovery
- **Performance**: Faster targeted scans
- **Customization**: Per-library settings

## Advanced Settings

### Library Options

Configure in Advanced settings:

**Content**:
- **Preferred download language**: Your language
- **Country**: Your region
- **Rating country**: For parental controls

**Display**:
- **Date added behavior**: Use file creation date
- **Enable chapter image extraction**: No (not needed)
- **Extract chapter images during scan**: No

**Real-time Monitoring**:
- Enable for immediate updates
- Disable for better performance with large libraries

### Metadata Options

**Metadata Settings**:
- **Prefer local metadata**: Yes
- **Save metadata within media folders**: No (Emby would overwrite Youtarr's `.nfo` files; see the NFO saver warning in [Library Setup](#library-setup))
- **Save subtitles within media folders**: Yes (if using)

**Image Settings**:
- **Save artwork within media folders**: Yes
- **Download images in advance**: Your preference
- **Enable thumbnail generation**: Optional

## Troubleshooting

### Videos Not Appearing

**Problem**: Library scan completes but videos missing

**Solutions**:
1. Verify library type is "Movies"
2. Check NFO files exist:
   ```bash
   find /path/to/youtube -name "*.nfo" -type f
   ```
3. Ensure NFO metadata source is enabled
4. Review Emby logs:
   ```bash
   tail -f /var/lib/emby/logs/embyserver.txt
   ```

### Channel .m3u Not Appearing as a Playlist

**Problem**: A channel's "Generate channel playlist file (.m3u)" setting is on and the file exists on disk, but no playlist shows up in Emby

**Cause**: The library type is `Movies`. Emby only imports playlist files from Mixed Content libraries; this is expected behavior, not a bug. See [Channel Playlist Files (.m3u)](#channel-playlist-files-m3u) for alternatives.

### Channel Displays as a TV Series

**Problem**: In a `Mixed Content` library, a channel (or some of its videos) shows up as a TV series with seasons/episodes and broken metadata

**Cause**: Emby's mixed-library TV-detection heuristics misread episode-like video titles. Emby's own documentation notes that support for mixed content is limited.

**Solution**: Change the library to `Movies` (or recreate it as `Movies`) and rescan. Channel `.m3u` playlists will no longer auto-import; see [Choosing a library type](#choosing-a-library-type) for the tradeoff.

### Metadata Not Loading

**Problem**: Videos appear without descriptions

**Solutions**:
1. Confirm NFO reader is first in providers
2. Verify NFO content:
   ```bash
   xmllint --noout /path/to/video.nfo
   ```
3. Check "Prefer embedded metadata" is enabled
4. Manually refresh metadata for items

### Artwork Issues

**Problem**: Missing channel or video posters

**Solutions**:
1. Verify poster.jpg files exist:
2. Check image permissions and format
3. Clear Emby cache:
   - Dashboard → Advanced → Clear Cache
4. Rescan library with "Replace all metadata"

### Permission Denied

**Problem**: Emby cannot access media files

**Solutions**:
1. Check file permissions:
   ```bash
   ls -la /path/to/youtube
   ```
2. Fix ownership if needed:
   ```bash
   sudo chown -R emby:emby /path/to/youtube
   ```
3. For Docker: Verify volume permissions
4. Check SELinux/AppArmor if applicable

### Duplicate Entries

**Problem**: Videos appear multiple times

**Solutions**:
1. Check for overlapping library paths
2. Remove duplicate library entries
3. Clean library: Dashboard → Scheduled Tasks → Clean Database
4. Verify no symbolic link loops

## File Structure Example

See [Youtarr Downloads Folder Structure](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md)
