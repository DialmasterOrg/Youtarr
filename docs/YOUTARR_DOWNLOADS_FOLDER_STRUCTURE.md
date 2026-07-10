# Youtarr Download Folder & File Structure

Youtarr downloads videos into folders named for the channel they came from.
Channels can be configured in the web UI to place the channel folder into a subfolder, which will be prefixed with `__` to allow grouping channels together. This allows you to setup different libraries in your media server of choice for different channel groups.
By default, videos in each channel folder are placed into their own subfolders with associated metadata files. This can be changed to a flat file structure on a per-channel basis (see below).

### Expected Default Layout

This is the folder/file layout for channels that do not have a configured subfolder setting and
is also used for manually downloaded files from channels that are not setup in `Your Channels`

```
<YOUTUBE_OUTPUT_DIR>/
├── Channel Name/
│   ├── poster.jpg                             # Channel poster
│   └── Channel - Video [id]/
│       ├── Channel - Video [id].mp4           # Video file
│       ├── Channel - Video [id].nfo           # Video metadata
│       ├── Channel - Video [id].[lang].srt    # Subtitle file(s)
│       └── Channel - Video [id].jpg           # Video thumbnail
├── Another Channel/
```

## Layout For Channels with Subfolder Settings

```
YouTube Downloads/
├── __Kids/                                        # Kids subfolder
│   └── Channel Name/
│       ├── poster.jpg                             # Channel poster
│       └── Channel - Video [id]/
│           ├── Channel - Video [id].mp4           # Video file
│           ├── Channel - Video [id].nfo           # Video metadata
│           ├── Channel - Video [id].[lang].srt    # Subtitle file
│           └── Channel - Video [id].jpg           # Video thumbnail
├── __Music/                                       # Music subfolder
│   └── Music Channel/
│       └── [videos]
└── Regular Channel/                               # Channel with no subfolder setting
    └── [videos]
```

## Layout For Channels with Flat File Structure (No Video Subfolders)

Channels can be configured to use a flat file structure, where video files are placed directly in the channel folder instead of individual video subfolders. This is a per-channel setting configured in the channel settings dialog ("Flat file structure (no video subfolders)") and only affects new downloads.

The same option is available as a one-time override in the manual download settings dialog.

```
<YOUTUBE_OUTPUT_DIR>/
├── Channel Name/
│   ├── poster.jpg                             # Channel poster
│   ├── Channel - Video [id].mp4              # Video file
│   ├── Channel - Video [id].nfo              # Video metadata
│   ├── Channel - Video [id].[lang].srt       # Subtitle file(s)
│   ├── Channel - Video [id].jpg              # Video thumbnail
│   ├── Channel - Another Video [id].mp4
│   ├── Channel - Another Video [id].nfo
│   ├── Channel - Another Video [id].[lang].srt
│   └── Channel - Another Video [id].jpg
```

This also works in combination with subfolder settings:

```
YouTube Downloads/
├── __Kids/
│   └── Channel Name/                              # Flat structure + subfolder
│       ├── poster.jpg
│       ├── Channel - Video [id].mp4
│       ├── Channel - Video [id].nfo
│       ├── Channel - Video [id].[lang].srt
│       └── Channel - Video [id].jpg
```

## The `__playlists__` Folder

If you subscribe to any YouTube playlists, Youtarr creates a `__playlists__` folder at the top of your download directory and writes one `.m3u` file per playlist into it. The videos themselves still live in their channel folders; the `.m3u` is just a list that points at them.

```
<YOUTUBE_OUTPUT_DIR>/
├── __playlists__/
│   ├── My Favorite Talks.m3u
│   └── Workout Mix.m3u
├── Channel Name/
│   └── [videos]
```

The `.m3u` files use relative paths, so they keep working if you move your library to a different location. Each one lists only the items you've actually downloaded, in playlist order (for MP3 Only playlists the entries are the MP3 files).

`playlists` is a reserved subfolder name, so Youtarr won't let you assign a channel to a subfolder called `playlists`. Channel subfolders also can't start with `__`, so they never collide with the `__playlists__` folder itself. See [Media Server Playlists](MEDIA_SERVER_PLAYLISTS.md) for how playlists download and sync.

## Supported File Extensions (Reads vs. Writes)

Youtarr **writes** downloaded media as `.mp4` for video and `.mp3` for audio-only downloads.

Youtarr **reads** a wider set of extensions when reconciling the database with disk (during the daily scheduled scan, the server-startup scan, and the manual **Settings -> Maintenance -> Rescan files on disk** action):

- **Video**: `.mp4`, `.webm`, `.mkv`, `.m4v`, `.avi`
- **Audio**: `.mp3`

This means you can safely convert downloaded videos to a different supported container outside Youtarr (for example, transcoding `.mp4` to `.mkv`) without losing track of them, as long as the `[<youtube-id>]` segment remains in the filename. Run a rescan from the Maintenance settings page after making changes to update Youtarr's view immediately, or wait for the next scheduled scan. See the [Usage Guide](USAGE_GUIDE.md#rescan-files-on-disk) for details.
