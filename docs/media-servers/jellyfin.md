# Jellyfin Integration Guide

Complete guide for integrating Youtarr with Jellyfin Media Server.

## Table of Contents
- [Overview](#overview)
- [Library Setup](#library-setup)
- [TV Shows](#tv-shows)
- [Metadata Configuration](#metadata-configuration)
- [Native Playlist Sync](#native-playlist-sync)
- [Channel Playlist Files (.m3u)](#channel-playlist-files-m3u)
- [Multi-Library Organization](#multi-library-organization)
- [Troubleshooting](#troubleshooting)

## Overview

Youtarr provides full Jellyfin support through:
- NFO metadata files with complete video information
- Channel poster artwork
- Optional channel and video backdrop art
- Proper folder structure for organization
- Multi-library support for content separation
- TV show folders with season folders and episode NFO files (see [TV Shows](#tv-shows))
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
- **`Shows`**: for Youtarr TV folders only, where channels are saved as TV shows. See [TV Shows](#tv-shows).

We recommend against `Mixed Movies and Shows` for any Youtarr folder, Videos or TV: in our testing it behaved inconsistently with Youtarr's files, and Youtarr's library check reports a Mixed library on a TV folder as the wrong type.

### Step 2: Add Folders

Add your Youtarr download directory:
1. Click "Add" under Folders
2. Browse to your YouTube directory
3. For subfolders, add specific paths:
   - Kids: `/path/to/youtube/__kids`
   - Music: `/path/to/youtube/__music`

   While every folder uses Videos, one library at `/path/to/youtube` shows them all. Jellyfin shows a folder in only one library, though, so don't add a library at `/path/to/youtube` next to subfolder libraries: the subfolder libraries would stay empty. Once you use a TV folder, give each TV folder its own library and list the Video folders in your Movies library; see [One library per folder](#one-library-per-folder).

### Step 3: Configure Metadata Sources

In the library's settings (everything not listed can keep its default):

| Setting | Value | Why |
|---------|-------|-----|
| Prefer embedded titles over filenames | On | Only used when a video has no NFO file (NFO files turned off in Youtarr): the MP4's embedded title beats a title parsed from the file name. Jellyfin reads NFO files without a setting |
| Metadata downloaders (Movies) | All off | An online match can replace a video's title, plot and artwork with an unrelated movie's |
| Automatically refresh metadata from the internet | Never | |
| Metadata savers: Nfo | Off | Jellyfin would rewrite Youtarr's NFO files (see the warning below) |
| Image fetchers (Movies) | TheMovieDb and The Open Movie Database off | Youtarr writes `poster.jpg` per channel and a thumbnail per video; Jellyfin reads local images on its own. **Embedded Image Extractor** and **Screen Grabber** can stay on: they only run when no image exists |
| Save artwork into media folders | Off | |
| Trickplay and Chapter Images | Off (the defaults) | Slow and disk-hungry; Youtarr's files carry no chapter markers |

> **Warning**: Do NOT enable the Nfo metadata saver. Youtarr generates and maintains the `.nfo` file for every video it downloads. If the saver is enabled, Jellyfin will update and overwrite those files with its own data, which can cause problems for your library.

## TV Shows

Youtarr can save channels as TV shows in a **TV folder**: a library folder whose layout is TV shows (Settings -> **Library folders**, or Channel Settings -> **TV Show**). Each channel becomes a show with year seasons and episodes named `Season 2026/S2026E09281530 - Title [id].mp4`, each with an episode NFO file and a thumbnail, plus `tvshow.nfo`, `poster.jpg` and (when enabled) `backdrop.jpg` in the show folder. The episode number is the upload's month, day, hour and minute in UTC, so Jellyfin lists episodes in upload order with large numbers (`9281530. Title` is September 28 at 15:30).

### Library setup

Add a library with content type **Shows** for each TV folder and point it at the folder itself, for example `/path/to/youtube/__TV Shows`. Use the Shows type, not `Mixed Movies and Shows`: a Mixed library decides per folder whether it holds a movie or a series, and in our testing it was inconsistent with Youtarr's files. In the library's settings (everything not listed can keep its default):

| Setting | Value | Why |
|---------|-------|-----|
| Prefer embedded titles over filenames | Off | Episode titles come from Youtarr's NFO files (Jellyfin reads NFO files without a setting) |
| Prefer embedded episode information over filenames | Off | Episode numbers come from the file names and NFO files, never from MP4 tags |
| Metadata downloaders (TV Shows), (Seasons) and (Episodes) | All off | An online match can replace a channel's titles and numbers with an unrelated show's |
| Automatically refresh metadata from the internet | Never | |
| Metadata savers: Nfo | Off | Jellyfin would rewrite Youtarr's NFO files (see the warning above) |
| Image fetchers (TV Shows), (Seasons) and (Episodes) | TheMovieDb and The Open Movie Database off | Youtarr writes `poster.jpg`, `backdrop.jpg` and an episode thumbnail; Jellyfin reads local images on its own. **Embedded Image Extractor** and **Screen Grabber** can stay on: they only run when no image exists |
| Save artwork into media folders | Off | |
| Trickplay and Chapter Images | Off (the defaults) | Slow and disk-hungry; Youtarr's files carry no chapter markers |

Youtarr's library check (below) reports the Nfo saver and the online metadata downloaders when they are on.

### One library per folder

While every folder uses Videos, one Movies library on your whole downloads folder shows them all. Jellyfin shows a folder in only one library, though. A library whose folder sits inside another library's folder is skipped (the Jellyfin log says `Found duplicate path`), so a Shows library for `__TV Shows` stays empty while another library includes your downloads folder. Once a `__subfolder` is a TV folder:

- Point your Movies library at your Video folders one by one, not at the downloads folder. Editing a library's folders keeps its type, and the watch state of its videos stays.
- Channels saved directly in the downloads folder (no subfolder) can only be reached through a library at the downloads folder, which would include the TV folder. Give those channels a library folder first (Channel Settings -> **Library folder**).

When the main folder itself uses TV shows, point one Shows library at the downloads folder instead. Jellyfin shows each `__subfolder` there as an extra show, and the subfolder's own library stays empty, so this fits only while no other folder is in use (Video or TV show).

[Move an existing setup to TV shows](../USAGE_GUIDE.md#move-an-existing-setup-to-tv-shows) walks through each starting setup.

Youtarr's library check points this out in Settings -> **Library folders**, on each folder's page: the libraries that hold it and anything to fix (also a library of the wrong type, the Nfo saver, or online metadata downloaders). Channel Settings -> **TV Show** shows the same for the channel's TV folder.

### Watch state

Jellyfin keeps watch state when Youtarr moves a show's episodes to another TV folder: `tvshow.nfo` carries the channel ID as a custom ID, and Jellyfin keys episode watch state on the show's ID and the episode number. A video that moves between a Videos folder and a TV folder shows up as a new, unwatched item; Youtarr restores the played state and resume position for every Jellyfin user once Jellyfin has scanned the moved file.

### Replace all metadata

Prefer **Scan for new and updated files**. On Jellyfin 12.1, **Replace all metadata** on a show kept Youtarr's episode numbers, titles and air dates in our tests; Jellyfin 10.11 was not tested.

## Metadata Configuration

### NFO Support

Jellyfin reads NFO files containing:
- **Title**: Video title as it appears on YouTube (the NFO title never includes the channel name)
- **Plot**: Full YouTube description
- **Premiered**: Original upload date
- **Year**: Upload year
- **Studios**: Channel name
- **Genres**: YouTube categories
- **Tags**: Video keywords
- **Runtime**: Duration in minutes
- **Unique ID**: YouTube video ID

### Artwork Support

Youtarr provides:
- **`poster.jpg`**: Channel artwork in each channel folder
- **`<VIDEO NAME>.jpg`**: Video thumbnail in each video folder
- **`backdrop.jpg`**: Channel background art from the YouTube channel banner, written when "Backdrop images" is enabled in Settings -> Core -> **Media server files** (off by default)
- **`<VIDEO NAME>-backdrop.jpg`**: Per-video background art from the video thumbnail, controlled by the same setting (new downloads only)
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

Connecting Jellyfin also enables watch status sync: Youtarr periodically pulls per-video watch state (played, percent watched, last watched) for every user on the server and shows it as Watched chips and filters on its listing pages. Youtarr writes to Jellyfin only to restore watch state after it moves your files (see [Watch state](#watch-state)). Jellyfin decides when a video counts as played: **Maximum resume percentage** under Server -> Playback -> Resume. Settings live under **Settings -> Watch Status**; see [Track Watch Status from Media Servers](../USAGE_GUIDE.md#track-watch-status-from-media-servers).

Videos inside Jellyfin Collections remain available for watch status and native playlist sync with **Group movies into collections** enabled. You do not need to change that display setting.

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
   Paths: /path/to/youtube/__news, /path/to/youtube/__gaming
   ```

   Jellyfin shows a folder in only one library, so don't add the downloads folder itself to a library when other libraries use its subfolders: they would stay empty. Channels saved directly in the downloads folder need a subfolder once you split libraries.

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

**Solution**: Jellyfin can't change a library's content type, so remove the Mixed library, create a `Movies` library for the same folders, and scan. A library you remove and create again starts over: played state and resume positions in it aren't restored. Channel `.m3u` playlists will no longer auto-import; see [Choosing a library type](#choosing-a-library-type) for the tradeoff.

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

### TV Library Is Empty

**Problem**: A Shows library for a Youtarr TV folder shows nothing, while the episodes appear in another library

**Cause**: Another library includes the TV folder (usually a library at the downloads folder). Jellyfin shows a folder in one library only and skips the nested one; its log says `Found duplicate path`.

**Solution**: Edit the other library: remove the downloads folder and add your Video folders one by one instead, then scan. It keeps its type, and the watch state of its videos stays. See [One library per folder](#one-library-per-folder) and [Move an existing setup to TV shows](../USAGE_GUIDE.md#move-an-existing-setup-to-tv-shows).

## File Structure

See [docs/YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md)
