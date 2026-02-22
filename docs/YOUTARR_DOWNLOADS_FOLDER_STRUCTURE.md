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
