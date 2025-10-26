# Media Server Integration Guide

Youtarr supports multiple media servers through comprehensive metadata generation. This guide covers setup and configuration for each supported platform.

## Supported Media Servers

- **Plex Media Server** - Full integration with automatic library refresh
- **Kodi** - NFO metadata support with channel artwork
- **Jellyfin** - NFO metadata and poster support
- **Emby** - NFO metadata and poster support

## Metadata Overview

Youtarr generates two types of metadata:

1. **Embedded MP4 Metadata** - Written directly into video files
2. **NFO Files** - XML metadata files alongside videos
3. **Channel Posters** - poster.jpg files in channel folders

### What Metadata is Included

| Field | Embedded (MP4) | NFO File | Description |
|-------|---------------|----------|-------------|
| Title | ✅ | ✅ | Video title with channel prefix |
| Description | ✅ | ✅ | Full video description |
| Upload Date | ✅ | ✅ | Original YouTube upload date |
| Channel | ✅ | ✅ | Channel/uploader name |
| Genre | ✅ | ✅ | YouTube categories |
| Tags/Keywords | ✅ | ✅ | Video tags (up to 10) |
| Runtime | ❌ | ✅ | Video duration in minutes |
| YouTube ID | ❌ | ✅ | Original video ID for reference |
| Thumbnail | File | Reference | poster.jpg in video folder |

## Multi-Library Organization with Subfolders

Youtarr supports organizing channels into custom subfolders, enabling you to create **separate media server libraries** for different types of content. This is the primary way to organize content with distinct purposes, permissions, and settings.

### Why Use Subfolders?

Instead of having all YouTube channels in a single library, you can create purpose-specific libraries:

- **Separate libraries for kids and adults** - Kids channels in one library (subfolder), adult content in another
- **Better content discovery** - Organized libraries make it easier to find what you want

### Subfolder Examples

| Subfolder | Use Case | Benefits |
|-----------|----------|----------|
| `__kids` | Children's channels | Parental controls, kid-friendly UI, restricted sharing |
| `__music` | Music videos | Music-focused metadata, different view types |
| `__news` | News and current events | Keep separate from entertainment, private access |
| `__education` | Educational content | Dedicated learning library |
| `__podcasts` | Video podcasts | Audio-focused organization |
| _(no subfolder)_ | General entertainment | Default location for uncategorized channels |

### How It Works

1. **Configure channels**: Open any channel page and click the settings icon to set a custom subfolder
2. **Create libraries**: Point each media server library to a specific subfolder path
3. **Independent operation**: Each library operates independently with its own settings

Example directory structure:
```
/data/youtube/
├── __kids/
│   ├── Blippi/
│   └── Sesame Street/
├── __music/
│   ├── VEVO/
│   └── NPR Music/
├── MrBeast/              (root level - no subfolder)
└── Technology Connections/ (root level - no subfolder)
```

You would then create separate libraries:
- "YouTube - Kids" → `/data/youtube/__kids`
- "YouTube - Music" → `/data/youtube/__music`
- "YouTube" → `/data/youtube` (includes all content)

**Note**: Subfolder names starting with `__` (double underscore) are enforced by Youtarr to prevent conflicts with actual channel names

## Plex Configuration

### Library Setup
1. Create a new library in Plex:
   - **Type**: Other Videos
   - **Agent**: Personal Media
   - **Scanner**: Plex Video Files Scanner

<img width="829" height="369" alt="image" src="https://github.com/user-attachments/assets/0a0ee8d1-e049-4a19-9430-5977464e9dde" />
<img width="816" height="561" alt="image" src="https://github.com/user-attachments/assets/a7650ad5-68d5-495b-957d-e42515154dbf" />

2. Configure Agent Settings:
   - Enable "Local Media Assets"
   - Place it at the top of the agent list
   - Optional: Enable "Prefer local metadata"

<img width="1288" height="220" alt="image" src="https://github.com/user-attachments/assets/6e796c9a-243f-4e98-8d87-1d1283e060cc" />

3. Point the library to your Youtarr download directory

### What You'll See
- Videos organized by channel (folders)
- Embedded metadata displays automatically
- Thumbnails from poster.jpg files
- Rich descriptions and metadata

<img width="1137" height="967" alt="image" src="https://github.com/user-attachments/assets/c70ebfd3-2370-4ff8-89dd-88a0e2186345" />
<img width="1478" height="1248" alt="image" src="https://github.com/user-attachments/assets/f146ba72-abe0-4e4d-93bb-6f34cea8e5e5" />


### Multi-Library Setup (Plex)

To create separate Plex libraries for different channel groups:

1. **Create each library separately**:
   - Library 1: "YouTube - Kids" → Point to `/path/to/youtube/__kids`
   - Library 2: "YouTube - Music" → Point to `/path/to/youtube/__music`
   - Library 3: "YouTube" → Point to `/path/to/youtube` (for ALL channels/Youtarr content)

### Tips for Plex
- The embedded metadata ensures videos display correctly even without NFO support
- Channel names appear as "Studio" and "Album" for grouping
- Use Collections to group channels if desired
- **Local Media Assets**: Ensure "Use local assets" is enabled in your library's Advanced settings to prioritize poster.jpg files
- **Thumbnail Issues**: If poster.jpg files are occasionally replaced by generated thumbnails, this appears to be a known Plex behavior that occurs inconsistently. Try refreshing metadata for affected items
- **Multi-Library**: When using subfolders, Youtarr only refreshes the specific library that received new content

## Kodi Configuration

### Library Setup
1. Add your Youtarr download directory as a Video source
2. Set content type to **Movies**
3. Choose information provider:
   - Select **Local information only**
   - Or use "Local NFO files" if available as option

### Metadata Settings
- **Enable**: Use folder names for lookups
- **Disable**: All online scrapers (we provide all metadata)
- Kodi will read the .nfo files automatically

### What You'll See
- Channel folders with poster.jpg artwork
- Full video metadata from NFO files
- Proper titles, descriptions, and dates
- Genre tags from YouTube categories

### Multi-Library Setup (Kodi)

To create separate video sources for different channel groups:

1. **Add each subfolder as a separate video source**:
   - Videos → Files → Add videos...
   - Browse to `/path/to/youtube/__kids` for kids content
   - Set content type to "Movies" with "Local information only"
   - Repeat for each subfolder (`__music`, `__news`, etc.)

2. **Organize sources in Kodi**:
   - Each source appears as a separate entry in your Videos section
   - Name them descriptively: "YouTube - Kids", "YouTube - Music", etc.

3. **Benefits**:
   - Each source can have different view settings
   - Easy to navigate to specific content types

## Jellyfin Configuration

### Library Setup
1. Create a new library:
   - **Content Type**: Movies
   - **Display Name**: YouTube (or your preference)

2. Add your Youtarr download folder

3. Configure Metadata downloaders:
   - **Enable**: Nfo (should be at top)
   - **Disable**: All other metadata providers

4. Configure Metadata savers:
   - **Enable**: Nfo

### Advanced Settings
- **Prefer embedded titles over filenames**: Yes
- **Enable real-time monitoring**: Optional (for instant updates)

### What You'll See
- Channel organization with poster artwork
- Complete metadata from NFO files
- Proper sorting by upload date
- Genre categorization

## Emby Configuration

### Library Setup
1. Add a new library:
   - **Type**: Movies
   - **Folders**: Add your Youtarr download directory

2. Metadata configuration:
   - **Metadata downloaders**: NFO (place at top)
   - **Disable**: All internet metadata providers
   - **Image fetchers**: Local images only

3. Advanced:
   - **Save artwork and metadata into media folders**: Yes
   - **Prefer embedded metadata**: Yes

### What You'll See
- Similar experience to Jellyfin
- Full NFO metadata support
- Channel posters in folder view
- Rich video information

## Configuration in Youtarr

Access the Configuration page in Youtarr's web interface:

### Media Server Compatibility Section

1. **Generate video .nfo files** (Default: Enabled)
   - Creates metadata files for Kodi/Jellyfin/Emby
   - Toggle off if only using Plex

2. **Copy channel poster.jpg files** (Default: Enabled)
   - Adds channel artwork to folders
   - Improves visual browsing experience

### Notes
- These settings apply to all new downloads
- Existing videos won't be retroactively updated
- Metadata generation happens during post-processing
- No performance impact on downloads

## Troubleshooting

### Metadata Not Showing

**All Servers:**
- Check that files are accessible by the media server
- Verify .nfo files exist alongside videos
- Ensure proper file permissions

**Plex Specific:**
- Verify "Local Media Assets" is enabled and prioritized
- Check Plex logs for metadata reading errors
- Try "Refresh Metadata" on the library

**Kodi/Jellyfin/Emby:**
- Confirm library type is set to "Movies"
- Check that NFO metadata reader is enabled
- Disable conflicting online scrapers
- Try library rescan

### Channel Posters Not Displaying
- Verify poster.jpg exists in channel folders
- Check image file permissions
- Some servers cache artwork - try clearing cache

### Special Characters in Metadata
- Youtarr properly escapes XML characters in NFO files
- File names with special characters are handled safely
- If issues persist, check server logs for parsing errors

## File Structure Example

### Single Library (Default)
```
YouTube Downloads/
├── MrBeast/
│   ├── poster.jpg                                    # Channel poster
│   ├── $1 vs $1,000,000,000 Yacht!/
│   │   ├── MrBeast - $1 vs $1,000,000,000 Yacht! [video_id].mp4
│   │   ├── MrBeast - $1 vs $1,000,000,000 Yacht! [video_id].nfo
│   │   └── poster.jpg                                # Video thumbnail
│   └── Another Video/
│       ├── MrBeast - Another Video [video_id].mp4
│       ├── MrBeast - Another Video [video_id].nfo
│       └── poster.jpg
└── Technology Connections/
    ├── poster.jpg
    └── How Dishwashers Work/
        ├── Technology Connections - How Dishwashers Work [video_id].mp4
        ├── Technology Connections - How Dishwashers Work [video_id].nfo
        └── poster.jpg
```

### Multi-Library with Subfolders
```
YouTube Downloads/
├── __kids/                                           # Kids library subfolder
│   ├── Blippi/
│   │   ├── poster.jpg
│   │   └── Learn Colors with Blippi/
│   │       ├── Blippi - Learn Colors with Blippi [video_id].mp4
│   │       ├── Blippi - Learn Colors with Blippi [video_id].nfo
│   │       └── poster.jpg
│   └── Sesame Street/
│       ├── poster.jpg
│       └── Elmo's World/
│           ├── Sesame Street - Elmo's World [video_id].mp4
│           ├── Sesame Street - Elmo's World [video_id].nfo
│           └── poster.jpg
├── __music/                                          # Music library subfolder
│   ├── VEVO/
│   │   ├── poster.jpg
│   │   └── Latest Music Video/
│   │       ├── VEVO - Latest Music Video [video_id].mp4
│   │       ├── VEVO - Latest Music Video [video_id].nfo
│   │       └── poster.jpg
│   └── NPR Music/
│       ├── poster.jpg
│       └── Tiny Desk Concert/
│           ├── NPR Music - Tiny Desk Concert [video_id].mp4
│           ├── NPR Music - Tiny Desk Concert [video_id].nfo
│           └── poster.jpg
├── MrBeast/                                          # Root level
│   ├── poster.jpg
│   └── $1 vs $1,000,000,000 Yacht!/
│       ├── MrBeast - $1 vs $1,000,000,000 Yacht! [video_id].mp4
│       ├── MrBeast - $1 vs $1,000,000,000 Yacht! [video_id].nfo
│       └── poster.jpg
└── Technology Connections/                           # Root level
    ├── poster.jpg
    └── How Dishwashers Work/
        ├── Technology Connections - How Dishwashers Work [video_id].mp4
        ├── Technology Connections - How Dishwashers Work [video_id].nfo
        └── poster.jpg
```

## Best Practices

1. **Plan Your Subfolder Structure Early**:
   - Decide on your library organization before adding many channels
   - Common structures: `__kids`, `__music`, `__news`, `__education`
   - Use double underscore (`__`) prefix to make subfolders visually distinct
   - Keep names simple, lowercase, and filesystem-safe (no spaces or special characters)
   - Channels can be moved between subfolders later, but planning ahead saves work

2. **Initial Setup**: Configure metadata settings before adding channels for consistency

3. **Multi-Library Recommendations**:
   - Create media server libraries for each subfolder you plan to use
   - Set up library-specific permissions and settings immediately
   - Test with one or two channels per subfolder before mass-adding
   - Remember that root-level channels (no subfolder) are separate from subfolder libraries

4. **Storage Planning**: NFO files and posters add minimal space (~5KB per video)

5. **Library Scanning**:
   - For large libraries, disable real-time monitoring
   - Schedule periodic scans instead

6. **Backup**: NFO files contain all metadata - back them up with your videos

7. **Channel Quality Settings**:
   - Use per-channel quality overrides strategically
   - High-quality for visual content (tech reviews, cinematography)
   - Lower quality for talk/podcast content to save space
   - Kids content often works fine at 720p or lower
