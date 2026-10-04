# Plex Integration Guide

Complete guide for integrating Youtarr with Plex Media Server.

## Table of Contents
- [Overview](#overview)
- [Library Setup](#library-setup)
- [Youtarr Settings](#youtarr-settings)
- [Native Playlist Sync](#native-playlist-sync)
- [Watch Status Sync](#watch-status-sync)
- [Multi-Library Organization](#multi-library-organization)
- [What You'll See](#what-youll-see)
- [Tips and Best Practices](#tips-and-best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Youtarr provides full Plex integration with:
- Automatic library refresh after downloads
- Embedded MP4 metadata for rich display
- Channel poster artwork
- OAuth authentication for API token retrieval
- Multi-library support through subfolders
- Native playlist sync: subscribed YouTube playlists appear as Plex playlists (see [Native Playlist Sync](#native-playlist-sync))
- Watch status sync: Youtarr pulls who has watched what from Plex (see [Watch Status Sync](#watch-status-sync))

## Library Setup

Each Youtarr library folder (the main downloads folder and each `__subfolder`) has a layout, set under Settings -> Core -> File Structure -> **Library folders**:

- **Videos** (the default): give the folder an **Other Videos** library.
- **TV shows**: give the folder a **TV Shows** library. Youtarr saves each channel there as a show, with year seasons and an episode NFO file for every video; see [TV Shows](#tv-shows).

A Plex library must hold folders of one layout only.

### Other Videos

#### Step 1: Create a New Library

1. In Plex, go to Settings → Manage → Libraries
2. Click "Add Library"
3. Configure as follows:
   - **Type**: Other Videos
   - **Name**: YouTube (or your preference)
   - **Language**: Your preferred language

<img width="829" height="369" alt="Plex Library Type Selection" src="https://github.com/user-attachments/assets/0a0ee8d1-e049-4a19-9430-5977464e9dde" />

#### Step 2: Select Agent

Choose the appropriate agent:
- **Agent**: Personal Media
- **Scanner**: Plex Video Files Scanner

<img width="816" height="561" alt="Plex Agent Selection" src="https://github.com/user-attachments/assets/a7650ad5-68d5-495b-957d-e42515154dbf" />

#### Step 3: Configure Agent Settings

1. After creating the library, go to its settings
2. Navigate to the "Agent" tab
3. Configure "Personal Media" agent:
   - Enable "Local Media Assets"
   - Move it to the top of the agent list
   - Optional: Enable "Prefer local metadata"

<img width="1288" height="220" alt="Plex Agent Settings" src="https://github.com/user-attachments/assets/6e796c9a-243f-4e98-8d87-1d1283e060cc" />

#### Step 4: Add Folder

Point the library to your Youtarr download directory:
- Default: `/path/to/youtube`
- Or specific subfolder: `/path/to/youtube/__kids`

Once one of your folders is a TV folder, point the Other Videos library at your Videos folders only (one location per folder). A library at the whole download directory would show the TV folder's episodes a second time.

### TV Shows

Use a TV Shows library for each Youtarr **TV folder**: a library folder whose layout is TV shows. To make one, set a folder's layout under Settings -> Core -> File Structure -> **Library folders**, or switch a channel to **TV show** under Channel Settings -> **TV Show**, which can create the folder for you. Files are saved as `__TV Shows/<Show>/Season 2026/S2026E09281530 - Title [id].mp4`, where the episode number is the upload's month, day, hour and minute (UTC); see [TV folders](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md#tv-folders).

#### Step 1: Create the library

1. In Plex, go to Settings -> Manage -> Libraries and click **Add Library**
2. **Select type**: TV Shows, and name the library
3. **Add folders**: the TV folder itself, for example `/path/to/youtube/__TV Shows`. Show folders must sit directly inside the library's folder, so don't point it at your downloads folder.

#### Step 2: Advanced settings

- **Scanner**: Plex TV Series
- **Agent**: **Plex NFO Series** (Plex Media Server 1.43.1 or newer, recommended), or Plex Personal Media. With the NFO agent selected, a **Ratings Source** option set to "NFO Default" appears; leave it.
- **Use local assets**: on, so Plex uses Youtarr's `poster.jpg`, `backdrop.jpg` and episode thumbnails
- **Enable video preview thumbnails**: off for a large library (Plex generates them for every episode)
- Turn off intro, credit and voice activity detection. They don't help with this content, and Plex spends time on them.
- The remaining options (season titles, original titles, artwork language, collections, Seasons: Show, ad detection) can keep their defaults.

| | Plex NFO Series | Plex Personal Media |
|---|---|---|
| Episode title, plot and air date | From Youtarr's episode NFO files | From the tags embedded in the MP4 file |
| Show title and summary | From `tvshow.nfo` | Folder name, no summary |
| Watch state when Youtarr moves an episode to another TV folder | Kept: Plex identifies each episode by the YouTube ID in its NFO file | Lost; Youtarr restores the server owner's state |
| Videos Youtarr moved in from a Videos folder | NFO title | The title embedded at download, which can start with the channel name |

Don't use the **Plex Series** agent: it looks shows up online and can match a channel to an unrelated TV series. Plex is removing the legacy agents and scanners.

#### Step 3: Refresh mapping

After a download Youtarr refreshes the Plex library mapped to the folder the video landed in (Settings -> Plex -> subfolder library mappings), or the default YouTube library when the folder has no mapping. Youtarr fills this in for TV folders: whenever Channel Settings -> **TV Show** opens for a channel in a TV folder that has no mapping yet, it checks your Plex libraries and adds the mapping as soon as it finds the one TV Shows library that holds the folder. You can also add it from the library check under Settings -> Core -> File Structure. Youtarr never changes a mapping that exists, so to have a TV folder refresh a different library, change its mapping under Settings -> Plex rather than deleting it (a deleted mapping is filled in again the next time the check runs).

#### Checking your setup

Under Settings -> Core -> File Structure -> **Library folders**, each folder lists the Plex libraries that hold it and anything to fix: no TV Shows library yet, a library of the wrong type, the Plex Series agent or a legacy agent, another library that shows the same episodes again, or a missing refresh mapping. Channel Settings -> **TV Show** shows the same for the channel's TV folder, and the review of a move shows it for the TV folders the videos move into.

Avoid libraries that include a TV folder from a parent folder, such as a "YouTube - All" library pointed at your downloads folder: Plex shows every episode there a second time as a plain video, and Youtarr restores watch state to only one of the copies. Two TV Shows libraries pointed at the same folder have the same problem.

#### Plex TV Series filename preset

The **Plex TV Series** preset (Settings -> Core -> Video Filename Template) names files like episodes but keeps everything else movie-style: no season folders, no episode NFO files. If you used it and your Plex TV Shows library points at your downloads folder, you can set the main folder's layout to **TV shows**: Youtarr writes a `.plexignore` with `__*/*` there so that library skips your subfolders, and when your channels' files move into season folders they keep the episode numbers the preset gave them. For a new setup, use a TV folder instead.

## Youtarr Settings

### Obtaining Plex Token

#### Method 1: OAuth (Recommended)
1. In Youtarr, open Settings -> Plex
2. Click "Get Key" next to Plex API Key field
3. Log in with your Plex account
4. Authorize Youtarr
5. Token automatically populated

#### Method 2: Manual
1. Follow [official Plex token guide](https://www.plexopedia.com/plex-media-server/general/plex-token/)
2. Enter the token under Settings -> Plex

### Required Settings

Under Settings -> Plex:
- **Plex API Key**: Your X-Plex-Token
- **Plex IP**: Server IP or hostname
- **Plex Port**: Usually 32400
- **Use HTTPS**: Enable if using SSL
- **Plex YouTube Library ID**: Select your library from dropdown

### Library Refresh

Youtarr automatically:
- Triggers library scan after each download
- Updates only the affected sections
- Handles multi-library setups intelligently

## Native Playlist Sync

Once Plex is connected with the settings above, Youtarr can mirror your subscribed YouTube playlists into Plex as native playlists. Nothing extra is required for the common case: turn on a playlist's Plex sync chip in Youtarr and it appears under your account after the next sync.

### Playlist visibility scope (advanced)

Most people can ignore this. Under **Settings -> Plex -> Advanced: playlist visibility scope**, you can control which account owns Youtarr's playlists:

- **Use my Plex admin account (default)**: the normal claimed-server case. Playlists are created under your account and are visible to you.
- **Unclaimed server (anonymous LAN access)**: for an unclaimed server on your LAN, where Plex Web browses without a token. If a connection test detects an unclaimed server, Youtarr nudges you toward this option. Watch status sync also reads the anonymous session's watch state in this mode.
- **A specific Plex user account**: routes the playlists through a token you paste in.

Plex playlists are always owned by a single account, so there's no automatic "public" setting. To let another Plex user see a playlist, open it in Plex Web and share it (playlist menu -> Share), or use **Settings -> Manage Library Access -> [user] -> Media**. Youtarr can't grant per-user access for you.

Heads up: shared playlists do not appear in the recipient's **Playlists** section - Plex lists playlists shared by another account under a separate sidebar source named **Media**. If a user reports the playlist is missing even though the share looks correct, have them check there. See [Shared Playlists Don't Appear for Other Users](../TROUBLESHOOTING.md#shared-playlists-dont-appear-for-other-users-plex) for related gotchas (library access, content-rating restrictions).

For how syncing, ordering, and playlist updates work across all servers, see [Media Server Playlists](../MEDIA_SERVER_PLAYLISTS.md).

## Watch Status Sync

The same Plex connection you set up above also enables watch status sync: on a schedule (every 4 hours by default), Youtarr pulls per-video watch state from Plex and shows it as Watched chips and filters on its listing pages. Youtarr writes to Plex only to restore watch state after it moves your files (see below).

A couple of Plex-specific details:

- The server owner's account gets full detail: played, percent watched, and last watched time.
- Other Plex accounts come from the server's play history, which only records completed plays. Those users show as watched or not, with no in-progress positions.
- On an unclaimed server (see the playlist visibility scope above), Youtarr reads the anonymous session's watch state instead.
- Plex decides when a video counts as played, not Youtarr: the **Video Played Threshold** setting under Settings -> Library (90% by default).
- When Youtarr moves files (switching a channel or folder between Videos and TV shows, or a TV channel to another TV folder), Plex sees the moved files as new, unwatched items. With Plex NFO Series, episodes moved between TV folders keep their watch state on their own. Otherwise Youtarr restores the server owner's played state and resume position once Plex has scanned the moved files. Other Plex accounts keep their history in Youtarr, but not on Plex.

Settings live under **Settings -> Watch Status**, including a per-server toggle for syncing all users vs. just the owner. See [Track Watch Status from Media Servers](../USAGE_GUIDE.md#track-watch-status-from-media-servers) for the full workflow.

## Multi-Library Organization

### Why Use Multiple Libraries?

Separate content by purpose:
- Kids content with parental controls
- Music videos with different view modes
- Educational content for learning
- News/current events separately

### Setting Up Multiple Libraries

1. **Configure channel subfolders** in Youtarr:
   - Click settings icon on any channel page
   - Set custom subfolder (e.g., `__kids`, `__music`)

2. **Create separate Plex libraries**:
   ```
   Library: "YouTube - Kids" → /path/to/youtube/__kids
   Library: "YouTube - Music" → /path/to/youtube/__music
   Library: "YouTube - All" → /path/to/youtube
   ```

   A "YouTube - All" library at your downloads folder also includes any TV folder, so its episodes show up there a second time. Once you use a TV folder, point your Other Videos libraries at the Videos folders only.

3. **Configure each library** with appropriate settings:
   - Kids library: Enable parental controls
   - Music library: Use music-focused view
   - Main library: Standard video view

### Directory Structure Example

See: [docs/YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md)

## What You'll See

### Channel View
<img width="1137" height="967" alt="Plex Channel View" src="https://github.com/user-attachments/assets/c70ebfd3-2370-4ff8-89dd-88a0e2186345" />

### Video Details
<img width="1478" height="1248" alt="Plex Video Details" src="https://github.com/user-attachments/assets/f146ba72-abe0-4e4d-93bb-6f34cea8e5e5" />

### Metadata Display
- **Title**: Video title with channel prefix, from the embedded MP4 title (turn off **Prefix channel name in embedded video title** in Settings -> Core for plain titles). Episodes in a TV folder are always tagged with the plain title.
- **Description**: Full YouTube description
- **Studio**: Channel name for grouping
- **Album**: Channel name (alternative grouping)
- **Genre**: YouTube categories
- **Release Date**: Original upload instant (UTC), or the upload date when yt-dlp does not report a timestamp
- **Poster**: Channel artwork (poster.jpg)
- **Thumbnail**: Video thumbnail

For new MP4 downloads, Youtarr embeds the full UTC upload instant (for example `2026-08-03T17:11:00Z`) when yt-dlp reports a usable timestamp, falling back to the date-only upload date otherwise. NFO release dates stay date-only for Jellyfin and Emby compatibility. Youtarr has no re-tagging feature, so previously downloaded files keep their date-only tag until they are downloaded again; refreshing the Plex library does not rewrite it.

## Tips and Best Practices

### Library Settings
1. **Enable "Local Media Assets"** in Advanced settings
2. **Set "Prefer local metadata"** for consistency
3. **Disable "Generate video preview thumbnails"** to save resources
4. **Use Collections** to group related channels

### Performance
1. **Disable real-time monitoring** for large libraries
2. **Schedule periodic scans** instead
3. **Use specific library refreshes** rather than full scans

### Organization
1. **Use consistent naming** for subfolders
2. **Plan structure early** before adding many channels
3. **Keep subfolder names simple** (no spaces or special characters)

### Network Configuration
1. **Same network**: Ensure Plex and Youtarr are on same network
2. **Firewall rules**: Allow port 32400 between containers
3. **Docker networking**: Use bridge network or host mode

## Troubleshooting

### Plex Token Issues

**Problem**: Cannot connect to Plex server

**Solutions**:
1. Verify token is valid:
   ```bash
   curl -H "X-Plex-Token: YOUR_TOKEN" http://PLEX_IP:32400/
   ```
2. Ensure using admin account token
3. Try regenerating token via OAuth

### Library Not Updating

**Problem**: New videos don't appear

**Solutions**:
1. Check Youtarr logs for scan errors
2. Manually trigger library scan in Plex
3. Verify library ID is correct in Youtarr
4. Check folder permissions

### Metadata Not Displaying

**Problem**: Videos show without metadata

**Solutions**:
1. Verify "Local Media Assets" is enabled
2. Check embedded metadata:
   ```bash
   ffprobe -v quiet -print_format json -show_format video.mp4
   ```
3. Refresh metadata for specific items
4. Clear Plex cache and rescan

### Poster Issues

**Problem**: Channel posters not showing or changing

**Known Issue**: Plex occasionally replaces poster.jpg with generated thumbnails

**Workarounds**:
1. Refresh metadata for affected channels
2. Lock poster in Plex (edit → poster → lock)
3. Ensure "Local Media Assets" is prioritized

### Permission Errors

**Problem**: Plex cannot access files

**Solutions**:
1. Check file permissions:
   ```bash
   ls -la /path/to/youtube
   ```
2. Ensure Plex user has read access
3. For Docker: Check volume mount permissions
4. Use same UID/GID for both containers

### Multi-Library Issues

**Problem**: Wrong library refreshing

**Solutions**:
1. Verify each library has unique path
2. Check library IDs in Youtarr config
3. Ensure subfolders are correctly set
4. Test with manual refresh first

### API Usage

Direct API calls for troubleshooting:
```bash
# Get libraries
curl -H "X-Plex-Token: TOKEN" \
  http://PLEX_IP:32400/library/sections

# Trigger scan
curl -X POST -H "X-Plex-Token: TOKEN" \
  http://PLEX_IP:32400/library/sections/LIBRARY_ID/refresh

# Get library items
curl -H "X-Plex-Token: TOKEN" \
  http://PLEX_IP:32400/library/sections/LIBRARY_ID/all
```
