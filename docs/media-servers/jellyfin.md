# Jellyfin Integration Guide

Complete guide for integrating Youtarr with Jellyfin Media Server.

## Table of Contents
- [Overview](#overview)
- [Library Setup](#library-setup)
- [Metadata Configuration](#metadata-configuration)
- [Native Playlist Sync](#native-playlist-sync)
- [Channel Playlist Files (.m3u)](#channel-playlist-files-m3u)
- [Multi-Library Organization](#multi-library-organization)
- [Troubleshooting](#troubleshooting)

## Overview

Youtarr provides full Jellyfin support through:
- NFO metadata files with complete video information
- Channel poster artwork
- Proper folder structure for organization
- Multi-library support for content separation
- Real-time monitoring capability
- Native playlist sync: subscribed YouTube playlists appear as Jellyfin playlists (see [Native Playlist Sync](#native-playlist-sync))

## Library Setup

### Step 1: Create a New Library

1. In Jellyfin, go to Dashboard → Libraries
2. Click "Add Media Library"
3. Configure basic settings:
   - **Content Type**: `Movies` (current recommendation; see [Choosing a library type](#choosing-a-library-type) below)
   - **Display Name**: YouTube (or your preference)

#### Choosing a library type

Youtarr writes each video as a standalone "movie" with its own NFO metadata, so two Jellyfin content types can read the library:

- **`Movies` (current recommendation)**: the most reliable option. Every video displays as a movie with full metadata and artwork. Limitation: Jellyfin will NOT automatically import Youtarr's optional per-channel `.m3u` playlist files; Jellyfin only imports playlist files from libraries whose content type is Mixed or Music. See [Channel Playlist Files (.m3u)](#channel-playlist-files-m3u).
- **`Mixed Movies and Shows`**: automatically imports the per-channel `.m3u` files as Jellyfin playlists, but comes with real risks. [Jellyfin's own documentation](https://jellyfin.org/docs/general/server/media/mixed-movies-and-shows/) says this library type "is broken and deprecated" and recommends against using it, and its TV-detection heuristics can misclassify channel content as TV series: video titles that look episode-like ("Season 3", "Episode 12") or folder names starting with digits can be picked up as episodes, and a single misdetected video folder can flip an entire channel folder into displaying as a series. This tends to work on smaller libraries and break as the library grows, since more titles means more chances for a false match.
- **`Shows`**: not currently supported. Writing videos and metadata in a way that is compatible with Shows-type libraries is on our roadmap but is not supported yet.

### Step 2: Add Folders

Add your Youtarr download directory:
1. Click "Add" under Folders
2. Browse to your YouTube directory
3. For subfolders, add specific paths:
   - Kids: `/path/to/youtube/__kids`
   - Music: `/path/to/youtube/__music`
   - All: `/path/to/youtube`

### Step 3: Configure Metadata Sources

In the library settings:

**Top level library settings**
1. **Preferred download language**: Your language
2. **Country**: Your country
3. **Prefer embedded titles over filenames**: Set to enabled
4. **Enable real time monitoring**: Recommended as enabled
5. **Automatically refresh metadata**: Never (metadata is all embedded/included via `.nfo`)

**Metadata downloaders** (in order):
1. Disable **ALL** metadata downloaders since metadata is included!

**Metadata savers**:
- **Disable**: Nfo

> **Warning**: Do NOT enable the Nfo metadata saver. Youtarr generates and maintains the `.nfo` file for every video it downloads. If the saver is enabled, Jellyfin will update and overwrite those files with its own data, which can cause problems for your library.

**Image fetchers**:
- Disable all internet fetchers
- Local images will be used automatically

## Metadata Configuration

### NFO Support

Jellyfin reads NFO files containing:
- **Title**: Video title with channel prefix
- **Plot**: Full YouTube description
- **Premiered**: Original upload date
- **Studios**: Channel name
- **Genres**: YouTube categories
- **Tags**: Video keywords
- **Runtime**: Duration in minutes
- **Unique ID**: YouTube video ID

### Artwork Support

Youtarr provides:
- **`poster.jpg`**: Channel artwork in each channel folder
- **`<VIDEO NAME>.jpg`**: Video thumbnail in each video folder
- Proper image naming for Jellyfin recognition

## Native Playlist Sync

The library and metadata setup above is all you need for downloaded videos to show up in Jellyfin. Playlist sync is separate: connect it only if you want your subscribed YouTube playlists to appear as native Jellyfin playlists.

### Step 1: Create a Jellyfin API key

1. In Jellyfin, go to **Dashboard -> API Keys**
2. Create a new key for Youtarr and copy it

### Step 2: Connect Jellyfin in Youtarr

1. In Youtarr, open **Settings -> Jellyfin Integration**
2. Enter the **Jellyfin URL** (e.g., `http://192.168.1.100:8096`) and the **API key** from Step 1
3. Open the **Jellyfin User** dropdown and pick the account that should own the playlists. (Youtarr loads the user list from your server; you can also enter the user ID by hand.)
4. (Optional) Leave **Video Library IDs** blank. Youtarr matches downloaded videos to Jellyfin items across all your libraries.
5. Click **Test Connection**, then turn on **Enable Jellyfin integration**

Once connected, open a playlist in Youtarr and turn on its Jellyfin sync chip. See [Media Server Playlists](../MEDIA_SERVER_PLAYLISTS.md) for how syncing, ordering, and updates work.

Connecting Jellyfin also enables watch status sync: Youtarr periodically pulls per-video watch state (played, percent watched, last watched) for every user on the server and shows it as Watched chips and filters on its listing pages. It's one-way; Youtarr never marks anything watched on Jellyfin. Jellyfin decides when a video counts as played: **Maximum resume percentage** under Server -> Playback -> Resume. Settings live under **Settings -> Watch Status**; see [Track Watch Status from Media Servers](../USAGE_GUIDE.md#track-watch-status-from-media-servers).

### Visibility

A playlist marked **Public** in Youtarr is visible to all users on the server; a **Private** one is visible only to the configured user account.

## Channel Playlist Files (.m3u)

Separately from playlist sync, each channel has an optional "Generate channel playlist file (.m3u)" setting that writes a `<Channel Name>.m3u` playlist at the top of the channel folder (see [Channel playlist file](../USAGE_GUIDE.md#channel-playlist-file-m3u)).

Whether Jellyfin picks that file up as a playlist depends entirely on the library's content type:

- **Mixed Movies and Shows**: Jellyfin imports the file automatically as a (read-only) playlist during library scans, and picks up changes on later scans.
- **Movies**: Jellyfin ignores the file. This is expected; Jellyfin only imports playlist files from Mixed or Music libraries.

If you keep the recommended Movies library type, you can still use the file outside Jellyfin: any `.m3u`-capable player (VLC, mpv, Kodi) opens it directly, or a third-party tool such as [m3u-to-jellyfin](https://github.com/warreth/m3u-to-jellyfin) can import it into Jellyfin as a native, editable playlist via the API.

## Multi-Library Organization

### Creating Separate Libraries

Organize content by type:

1. **Create multiple libraries**:
   ```
   Library: "YouTube - Kids"
   Path: /path/to/youtube/__kids

   Library: "YouTube - Music"
   Path: /path/to/youtube/__music

   Library: "YouTube - General"
   Path: /path/to/youtube
   ```

2. **Configure each library** independently:
   - Kids: Enable parental ratings
   - Music: Music-focused display options
   - General: Standard movie library settings

### Benefits

- **Access Control**: Different user permissions per library
- **Organization**: Easier content discovery
- **Performance**: Faster scanning of specific content
- **Customization**: Different metadata settings per type

### Initial Setup

1. **Start Small**: Test with one channel first
2. **Verify NFO Generation**: Check files exist before scanning
3. **Plan Structure**: Organize subfolders before adding channels
4. **Test Permissions**: Ensure Jellyfin can read all files

## Troubleshooting

### Metadata Missing

**Problem**: Videos appear but lack descriptions/details

**Solutions**:
1. Verify NFO reader is enabled
2. Check NFO file content:
   ```bash
   cat "/path/to/video.nfo"
   ```
3. Disable other metadata providers
4. Manually refresh metadata for items

### Channel .m3u Not Appearing as a Playlist

**Problem**: A channel's "Generate channel playlist file (.m3u)" setting is on and the file exists on disk, but no playlist shows up in Jellyfin

**Cause**: The library's content type is `Movies`. Jellyfin only imports playlist files from Mixed or Music libraries; this is expected behavior, not a bug. See [Channel Playlist Files (.m3u)](#channel-playlist-files-m3u) for alternatives.

### Channel Displays as a TV Series

**Problem**: In a `Mixed Movies and Shows` library, a channel (or some of its videos) shows up as a TV series with seasons/episodes and broken metadata

**Cause**: Jellyfin's mixed-library TV-detection heuristics misread episode-like video titles or folder names starting with digits. Jellyfin has deprecated this library type.

**Solution**: Change the library's content type to `Movies` (or recreate the library as `Movies`) and rescan. Channel `.m3u` playlists will no longer auto-import; see [Choosing a library type](#choosing-a-library-type) for the tradeoff.

### Poster Issues

**Problem**: Channel/video posters not displaying

**Solutions**:
1. Check poster.jpg exists in channel folders
2. Check that video file .jpg files exist in video folders
2. Verify image permissions:
   ```bash
   ls -la /path/to/channel/poster.jpg
   ```
3. Clear cache and rescan
4. Check image format (JPEG required)

## File Structure

See [docs/YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md)
