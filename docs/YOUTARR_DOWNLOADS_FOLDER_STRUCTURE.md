# Youtarr Download Folder & File Structure

Youtarr downloads videos into folders named for the channel they came from.
Channels can be configured in the web UI to place the channel folder into a subfolder, which will be prefixed with `__` to allow grouping channels together. This allows you to setup different libraries in your media server of choice for different channel groups.
By default, videos in each channel folder are placed into their own subfolders with associated metadata files. This can be changed to a flat file structure globally or per channel (see below).

### File and Folder Names

The examples below use the default **Video Filename Template** (Settings -> Core -> File Structure Settings), which names files `<Channel> - <Title>` with the title capped at 64 bytes. You can change the template or pick a preset (Date prefix, Plex YouTube-Agent, Plex TV Series, Title only); see [Video Filename Template](CONFIG.md#video-filename-template). Whatever template you choose, Youtarr always appends:

- ` [<youtube-id>]` to file names, for example `Channel - Title [dQw4w9WgXcQ].mp4`
- ` - <youtube-id>` to per-video folder names, for example `Channel - Title - dQw4w9WgXcQ/` (a dash, not brackets)

Youtarr uses these ID suffixes to find your videos on disk, so they cannot be changed. The template only affects new downloads; existing files are not renamed.

### Expected Default Layout

This is the folder/file layout for channels that do not have a configured subfolder setting. It
is also used for manually downloaded files from channels that are not set up in `Channels & Playlists`, as long as the global **Default Subfolder** setting is empty.

```
<YOUTUBE_OUTPUT_DIR>/
├── Channel Name/
│   ├── poster.jpg                               # Channel poster
│   ├── backdrop.jpg                             # Optional; written from the channel banner when "Create backdrop images" is on
│   ├── Channel Name.m3u                         # Optional; written when the channel's "Generate channel playlist file" setting is on
│   └── Channel - Title - id/
│       ├── Channel - Title [id].mp4             # Video file
│       ├── Channel - Title [id].nfo             # Video metadata
│       ├── Channel - Title [id].[lang].srt      # Subtitle file(s)
│       ├── Channel - Title [id].jpg             # Video thumbnail
│       ├── Channel - Title [id]-fanart.jpg      # Optional; written when "Create video fanart files" is on
│       └── Channel - Title [id]-backdrop.jpg    # Optional; written when "Create backdrop images" is on
├── Another Channel/
```

The optional artwork and `.m3u` files follow the channel wherever it lives; they are written the same way in the subfolder and flat layouts below.

## Layout For Channels with Subfolder Settings

```
YouTube Downloads/
├── __Kids/                                        # Kids subfolder
│   └── Channel Name/
│       ├── poster.jpg                             # Channel poster
│       ├── Channel Name.m3u                       # Optional channel playlist file
│       └── Channel - Title - id/
│           ├── Channel - Title [id].mp4           # Video file
│           ├── Channel - Title [id].nfo           # Video metadata
│           ├── Channel - Title [id].[lang].srt    # Subtitle file
│           └── Channel - Title [id].jpg           # Video thumbnail
├── __Music/                                       # Music subfolder
│   └── Music Channel/
│       └── [videos]
└── Regular Channel/                               # Channel with no subfolder setting
    └── [videos]
```

## Layout For Channels with Flat File Structure (No Video Subfolders)

You can use a flat file structure, where video files are placed directly in the channel folder instead of individual video subfolders. It only affects new downloads. There are three places to set it:

- **Global default**: turn on **Flat file structure by default** in Settings -> Core -> File Structure Settings. Every channel that has not chosen its own structure follows this, as do downloads from untracked channels. See [Flat File Structure Default](CONFIG.md#flat-file-structure-default).
- **Per channel**: in the channel settings dialog, set "Video File Structure" to "Flat (no video subfolders)" or "Video subfolders" to override the global default. The default option, "Use global setting", follows the global default.
- **One download**: the manual download settings dialog can force either structure for a single download.

```
<YOUTUBE_OUTPUT_DIR>/
├── Channel Name/
│   ├── poster.jpg                             # Channel poster
│   ├── Channel Name.m3u                       # Optional channel playlist file
│   ├── Channel - Title [id].mp4               # Video file
│   ├── Channel - Title [id].nfo               # Video metadata
│   ├── Channel - Title [id].[lang].srt        # Subtitle file(s)
│   ├── Channel - Title [id].jpg               # Video thumbnail
│   ├── Channel - Another Title [id].mp4
│   ├── Channel - Another Title [id].nfo
│   ├── Channel - Another Title [id].[lang].srt
│   └── Channel - Another Title [id].jpg
```

This also works in combination with subfolder settings:

```
YouTube Downloads/
├── __Kids/
│   └── Channel Name/                              # Flat structure + subfolder
│       ├── poster.jpg
│       ├── Channel Name.m3u
│       ├── Channel - Title [id].mp4
│       ├── Channel - Title [id].nfo
│       ├── Channel - Title [id].[lang].srt
│       └── Channel - Title [id].jpg
```

## The `__playlists__` Folder

If you subscribe to any YouTube playlists, Youtarr creates a `__playlists__` folder at the top of your download directory and writes one `.m3u` file per playlist into it. The videos themselves still live in their channel folders; the `.m3u` is just a list that points at them.

```
<YOUTUBE_OUTPUT_DIR>/
├── __playlists__/
│   ├── .ignore                                # Marker so Jellyfin/Emby skip this folder during library scans
│   ├── My Favorite Talks.m3u
│   └── Workout Mix.m3u
├── Channel Name/
│   └── [videos]
```

The `.m3u` files use relative paths, so they keep working if you move your library to a different location. Each one lists only the items you've actually downloaded, in playlist order (for MP3 Only playlists the entries are the MP3 files). The empty `.ignore` file is deliberate: it keeps Jellyfin and Emby from auto-importing every playlist during library scans.

`playlists` is a reserved subfolder name, so Youtarr won't let you assign a channel to a subfolder called `playlists`. Channel subfolders also can't start with `__`, so they never collide with the `__playlists__` folder itself. See [Media Server Playlists](MEDIA_SERVER_PLAYLISTS.md) for how playlists download and sync.

## Supported File Extensions (Reads vs. Writes)

Youtarr **writes** downloaded media as `.mp4` for video and `.mp3` for audio-only downloads.

Youtarr **reads** a wider set of extensions when reconciling the database with disk (during the daily scheduled scan, the server-startup scan, and the manual **Settings -> Maintenance & Rescan -> Rescan files on disk** action):

- **Video**: `.mp4`, `.webm`, `.mkv`, `.m4v`, `.avi`
- **Audio**: `.mp3`

This means you can safely convert downloaded videos to a different supported container outside Youtarr (for example, transcoding `.mp4` to `.mkv`) without losing track of them, as long as the `[<youtube-id>]` segment remains in the filename. Run a rescan from the Maintenance & Rescan settings page after making changes to update Youtarr's view immediately, or wait for the next scheduled scan. See the [Usage Guide](USAGE_GUIDE.md#rescan-files-on-disk) for details.
