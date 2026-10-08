# Emby Integration Guide

Complete guide for integrating Youtarr with Emby Media Server.

## Table of Contents
- [Overview](#overview)
- [Library Setup](#library-setup)
- [TV Shows](#tv-shows)
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
- Optional channel and video backdrop art
- Embedded MP4 metadata
- Multi-library support for content organization
- TV show folders with season folders and episode NFO files (see [TV Shows](#tv-shows))
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
- **`TV Shows`**: for Youtarr TV folders only, where channels are saved as TV shows. See [TV Shows](#tv-shows).

We recommend against `Mixed Content` for any Youtarr folder, Videos or TV: in our testing it behaved inconsistently with Youtarr's files, and Youtarr's library check reports a Mixed library on a TV folder as the wrong type.

### Step 2: Add Media Folders

Configure folder settings:
1. Click "Add" to add folder
2. Browse to your Youtarr download directory
3. For specific content types, use subfolders associated to different libraries:
   - `/path/to/youtube/__kids`
   - `/path/to/youtube/__music`

   While every folder uses Videos, one library at `/path/to/youtube` shows them all. Emby shows a folder in only one library, though, so don't add a library at `/path/to/youtube` next to subfolder libraries: the subfolder libraries would stay empty. Once you use a TV folder, give each TV folder its own library and list the Video folders in your Movies library; see [One library per folder](#one-library-per-folder).

### Step 3: Configure Library Settings

In the library's settings (Emby 4.10 labels; everything not listed can keep its default):

| Setting | Value | Why |
|---------|-------|-----|
| Prefer embedded titles over filenames | On | Only used when a video has no NFO file (NFO files turned off in Youtarr): the MP4's embedded title beats a title parsed from the file name |
| Ignore files containing the word sample ... less than (MB) | 0 | A video whose title contains "sample" and is under 300 MB would otherwise be hidden |
| Enable multi-part items | Off | Emby groups files named "part 1", "part 2" into one item; YouTube titles use those words all the time, and Youtarr never produces multi-part files |
| Metadata Readers: Nfo | On | Youtarr's NFO file for every video |
| Movie Metadata Downloaders | All off | An online match can replace a video's title, plot and artwork with an unrelated movie's |
| After the initial import, automatically refresh metadata from the internet | Never | |
| Metadata Savers: Nfo | Off | Emby would rewrite Youtarr's NFO files (see the warning below) |
| Movie Image Fetchers | All internet fetchers off | Youtarr writes `poster.jpg` per channel and a thumbnail per video; Emby reads local images on its own. **Image Capture** can stay on: it only grabs a frame when no thumbnail exists |
| Save artwork into media folders | Off | |
| Generate chapters for videos that don't contain embedded chapter information | Off | Youtarr's files carry no chapter markers, so Emby would add one every 5 minutes to every video and extract a frame for each at scan time |
| Subtitle Downloaders / Automatic Subtitle Downloads | Off / no download languages | OpenSubtitles has nothing for YouTube videos. Youtarr's own **Subtitles** option (Settings -> Core -> **Downloads**) saves YouTube captions as an `.srt` next to the video, which Emby picks up |

> **Warning**: Do NOT enable Emby's NFO metadata saver. Youtarr generates and maintains the `.nfo` file for every video it downloads. If the saver is enabled, Emby will update and overwrite those files with its own data (for example, incorrectly guessed season/episode tags), which can cause problems for your library.

## TV Shows

Youtarr can save channels as TV shows in a **TV folder**: a library folder whose layout is TV shows (Settings -> **Library folders**, or Channel Settings -> **TV Show**). Each channel becomes a show with year seasons and episodes named `Season 2026/S2026E09281530 - Title [id].mp4`, each with an episode NFO file and a thumbnail, plus `tvshow.nfo`, `poster.jpg` and (when enabled) `backdrop.jpg` in the show folder. The episode number is the upload's month, day, hour and minute in UTC, so Emby lists episodes in upload order with large numbers (`S2026:E9281530` is September 28 at 15:30).

### Library setup

Add a library with content type **TV shows** for each TV folder and point it at the folder itself, for example `Q:\Youtube\__TV Shows`. Use the TV shows type, not `Mixed Content`: a Mixed library decides per folder whether it holds a movie or a series, and in our testing it was inconsistent with Youtarr's files. In the library's settings (Emby 4.10 labels; everything not listed can keep its default):

| Setting | Value | Why |
|---------|-------|-----|
| Prefer embedded titles over filenames | Off | Episode titles come from Youtarr's NFO files; for a file without one, the file name beats the MP4's `Channel - Title` tag |
| Ignore files containing the word sample ... less than (MB) | 0 | A video whose title contains "sample" and is under 300 MB would otherwise be hidden |
| Automatically merge series that are spread across multiple folders | Off | Emby merges series by name, and two channels can share one |
| Metadata Readers: Nfo | On | Youtarr's episode and `tvshow.nfo` files |
| Series, Season and Episode Metadata Downloaders | All off | An online match can replace a channel's titles and numbers with an unrelated show's |
| After the initial import, automatically refresh metadata from the internet | Never | |
| Metadata Savers: Nfo | Off | Emby would rewrite Youtarr's NFO files (see the warning above) |
| Series, Season and Episode Image Fetchers | All internet fetchers off | Youtarr writes `poster.jpg`, `backdrop.jpg` and an episode thumbnail; Emby reads local images on its own. Episode **Image Capture** can stay on: it only grabs a frame when no thumbnail exists |
| Save artwork into media folders | Off | |
| Generate chapters for videos that don't contain embedded chapter information | Off | Youtarr's files carry no chapter markers, so Emby would add one every 5 minutes to every episode and extract a frame for each at scan time |
| Subtitle Downloaders / Automatic Subtitle Downloads | Off / no download languages | OpenSubtitles has nothing for YouTube videos. Youtarr's own **Subtitles** option (Settings -> Core -> **Downloads**) saves YouTube captions as an `.srt` next to the video, which Emby picks up |
| Enable support for .plexignore files as an alias to .embyignore | Off | Youtarr writes a `.plexignore` only in a TV main folder, for Plex; a library at a subfolder never sees one |

Youtarr's library check (below) reports the NFO saver and the online metadata downloaders when they are on.

### One library per folder

While every folder uses Videos, one Movies library on your whole downloads folder shows them all. Emby shows a folder in only one library, though, so a TV shows library for `__TV Shows` stays empty while another library includes your downloads folder. Once a `__subfolder` is a TV folder:

- Point your Movies library at your Video folders one by one, not at the downloads folder. Editing a library's folders keeps its type, and the watch state of its videos stays.
- Channels saved directly in the downloads folder (no subfolder) can only be reached through a library at the downloads folder, which would include the TV folder. Give those channels a library folder first (Channel Settings -> **Library folder**).

When the main folder itself uses TV shows, point one TV shows library at the downloads folder instead. Emby shows each `__subfolder` there as an extra show, and the subfolder's own library stays empty, so this fits only while no other folder is in use (Video or TV show).

[Move an existing setup to TV shows](../USAGE_GUIDE.md#move-an-existing-setup-to-tv-shows) walks through each starting setup.

Youtarr's library check points this out in Settings -> **Library folders**, on each folder's page: the libraries that hold it and anything to fix (also a library of the wrong type, the NFO saver, or internet metadata providers). Channel Settings -> **TV Show** shows the same for the channel's TV folder.

### Watch state

Emby keys watch state by file path, so an episode Youtarr moves (between a Videos folder and a TV folder, or to another TV folder) shows up as a new, unwatched item. Youtarr restores the played state and resume position for every Emby user once Emby has scanned the moved file.

## Metadata Configuration

### NFO Support

Emby reads comprehensive NFO files containing:
- **Title**: Video title as it appears on YouTube (the NFO title never includes the channel name)
- **Plot**: Complete YouTube description
- **Premiered**: Original upload date
- **Year**: Upload year (keeps Emby's production year accurate for sorting)
- **Studios**: Channel/creator name
- **Genres**: YouTube categories
- **Tags**: Video keywords and topics
- **Runtime**: Video duration
- **Unique ID**: YouTube video identifier

### Artwork Configuration

Youtarr provides:
- **`poster.jpg`**: Channel artwork in channel folders
- **`<VIDEO NAME>.jpg`**: Video thumbnails in video folders
- **`backdrop.jpg`**: Channel background art from the YouTube channel banner, written when "Backdrop images" is enabled in Settings -> Core -> **Media server files** (off by default)
- **`<VIDEO NAME>-backdrop.jpg`**: Per-video background art from the video thumbnail, controlled by the same setting (new downloads only)
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

Connecting Emby also enables watch status sync: Youtarr periodically pulls per-video watch state (played, percent watched, last watched) for every user on the server and shows it as Watched chips and filters on its listing pages. Youtarr writes to Emby only to restore watch state after it moves your files (see [Watch state](#watch-state)). Emby decides when a video counts as played: edit the library and set **Max resume percentage**; stop after that point and the title counts as fully played. Settings live under **Settings -> Watch Status**; see [Track Watch Status from Media Servers](../USAGE_GUIDE.md#track-watch-status-from-media-servers).

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
   "YouTube - General" → /youtube/__news, /youtube/__gaming
   ```

   Emby shows a folder in only one library, so don't add the downloads folder itself to a library when other libraries use its subfolders: they would stay empty. Channels saved directly in the downloads folder need a subfolder once you split libraries.

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
- **Save artwork within media folders**: No (see the NFO saver warning in [Library Setup](#library-setup))
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

**Solution**: Emby can't change a library's type, so remove the Mixed Content library, create a `Movies` library for the same folders, and scan. A library you remove and create again starts over: played state and resume positions in it aren't restored. Channel `.m3u` playlists will no longer auto-import; see [Choosing a library type](#choosing-a-library-type) for the tradeoff.

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

### TV Library Is Empty

**Problem**: A TV Shows library for a Youtarr TV folder shows nothing, while the episodes appear in another library

**Cause**: Another library includes the TV folder (usually a library at the downloads folder). Emby shows a folder in one library only.

**Solution**: Edit the other library: remove the downloads folder and add your Video folders one by one instead, then scan. It keeps its type, and the watch state of its videos stays. See [One library per folder](#one-library-per-folder) and [Move an existing setup to TV shows](../USAGE_GUIDE.md#move-an-existing-setup-to-tv-shows).

### Duplicate Entries

**Problem**: Videos appear multiple times

**Solutions**:
1. Check for overlapping library paths
2. Remove duplicate library entries
3. Clean library: Dashboard → Scheduled Tasks → Clean Database
4. Verify no symbolic link loops

## File Structure Example

See [Youtarr Downloads Folder Structure](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md)
