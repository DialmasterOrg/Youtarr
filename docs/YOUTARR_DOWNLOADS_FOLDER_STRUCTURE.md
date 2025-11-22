# Youtarr Download Folder & File Structure

Youtarr downloads videos into folders named for the channel they came from.
Channels can be configured in the web UI to place the channel folder into a subfolder, which will be prefixed with `__` to allow grouping channels together. This allows you to setup different libraries in your media server of choice for different channel groups.
In each channel folder videos will be placed into their own subfolders with associated metadata files.

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
