# Series Configuration Feature

## Overview

This feature adds channel-specific configuration to Youtarr, allowing users to automatically organize downloaded videos into TV show/series format with proper Season/Episode naming for compatibility with media servers like Plex, Jellyfin, and Emby.

## Goals

### Primary Objectives
1. **Automatic Series Organization**: Allow channels to have multiple "series profiles" that filter and organize videos into proper TV show structure
2. **Flexible Naming Templates**: Support custom naming schemes with Season/Episode numbering
3. **Media Server Compatibility**: Generate Plex/Jellyfin-compatible file names and thumbnails
4. **Unmatched Content Handling**: Automatically place non-series videos in "Specials" (Season 00)
5. **Optional NFO Support**: Generate metadata files for Jellyfin/Emby/Kodi (Plex doesn't support NFO)

### Key Features
- Multiple series profiles per channel
- Regex-based video filtering to match videos to series
- Customizable file naming templates
- Automatic episode numbering with counters
- Proper thumbnail naming for media server detection
- Optional NFO metadata file generation
- Backward compatibility with existing functionality

## Technical Design

### Database Schema

#### Table: `channel_profiles`
Stores series configuration profiles for each channel.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| channel_id | INT | Foreign key to channels table |
| profile_name | VARCHAR(255) | Name of the series/profile |
| is_default | BOOLEAN | If true, catches unmatched videos |
| destination_path | TEXT | Custom output directory path |
| naming_template | VARCHAR(500) | File naming template string |
| season_number | INT | Fixed season number for this profile |
| episode_counter | INT | Auto-incrementing episode counter |
| generate_nfo | BOOLEAN | Whether to generate NFO files |
| enabled | BOOLEAN | Profile active status |

#### Table: `profile_filters`
Defines filters to match videos to profiles.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| profile_id | INT | Foreign key to channel_profiles |
| filter_type | ENUM | 'title_regex', 'title_contains', 'duration_range' |
| filter_value | TEXT | Regex pattern or filter criteria |
| priority | INT | Filter evaluation order |

#### Table: `video_profile_mappings`
Tracks which videos have been processed by which profile.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| video_id | INT | Foreign key to Videos table |
| profile_id | INT | Foreign key to channel_profiles |
| season | INT | Assigned season number |
| episode | INT | Assigned episode number |
| processed_at | TIMESTAMP | When the video was processed |

### File Organization

#### Current Structure
```
/YouTube Downloads/
  /ChannelName/
    /ChannelName - Video Title - abc123/
      ChannelName - Video Title [abc123].mp4
      poster.jpg
```

#### New Structure (with Series Profile)
```
/TV Shows/
  /Series Name/
    tvshow.nfo (optional - for Jellyfin/Emby)
    /Season 01/
      Series Name - s01e01 - Episode Title.mp4
      Series Name - s01e01 - Episode Title.jpg
      Series Name - s01e01 - Episode Title.nfo (optional)
    /Season 00/ (Specials/Unmatched)
      Series Name - s00e001 - Special Title.mp4
      Series Name - s00e001 - Special Title.jpg
      Series Name - s00e001 - Special Title.nfo (optional)
```

### Naming Template System

#### Supported Variables
- `{series}` - Series/profile name
- `{season}` or `{season:02d}` - Season number with optional padding
- `{episode}` or `{episode:03d}` - Episode number with optional padding
- `{title}` - Original video title
- `{clean_title}` - Title with filter match removed
- `{year}`, `{month}`, `{day}` - From video upload date
- `{channel}` - YouTube channel name
- `{id}` - YouTube video ID

#### Example Templates
1. **Standard Format**: `{series} - s{season:02d}e{episode:03d} - {clean_title}`
   - Output: `Tech Tutorials - s01e001 - Introduction to Python.mp4`

2. **Date-Based**: `{series} - {year}x{month:02d}{day:02d} - {title}`
   - Output: `Daily Show - 2024x0115 - Monday News Update.mp4`

3. **Minimal**: `S{season:02d}E{episode:03d} - {title}`
   - Output: `S01E001 - Building Your First App.mp4`

### Post-Processing Workflow

1. **Video Downloaded**: Standard yt-dlp download completes
2. **Channel Profile Check**: System checks if channel has profiles configured
3. **Filter Evaluation**: Video title tested against profile filters in priority order
4. **Match Found**:
   - Apply naming template to generate new filename
   - Move video to profile's destination path with series structure
   - Rename thumbnail to match episode name (for Plex compatibility)
   - Generate NFO file if enabled
   - Update episode counter in database
5. **No Match (Default Profile)**:
   - Place in Season 00 as "Special"
   - Auto-increment special episode counter
6. **No Profiles**: Use existing Youtarr behavior

### NFO File Format

#### Episode NFO (`Series Name - s01e01.nfo`)
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<episodedetails>
    <title>Episode Title</title>
    <season>1</season>
    <episode>1</episode>
    <plot>Video description from YouTube</plot>
    <aired>2024-01-15</aired>
    <premiered>2024-01-15</premiered>
    <studio>Channel Name</studio>
    <uniqueid type="youtube" default="true">abc123def456</uniqueid>
</episodedetails>
```

#### Series NFO (`tvshow.nfo`)
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<tvshow>
    <title>Series Name</title>
    <plot>YouTube series from Channel Name</plot>
    <studio>Channel Name</studio>
    <premiered>2024-01-01</premiered>
    <status>Continuing</status>
    <uniqueid type="youtube_channel">UCxxxxxxxxxxxxx</uniqueid>
</tvshow>
```

## API Endpoints

### Profile Management
- `GET /api/channels/:id/profiles` - List all profiles for a channel
- `POST /api/channels/:id/profiles` - Create new profile
- `PUT /api/profiles/:id` - Update profile configuration
- `DELETE /api/profiles/:id` - Delete profile
- `POST /api/profiles/:id/test` - Test filters against existing videos
- `GET /api/profiles/:id/preview` - Preview naming for matched videos

### Request/Response Examples

#### Create Profile
```json
POST /api/channels/1/profiles
{
  "profile_name": "Python Tutorials",
  "destination_path": "/TV Shows/Python Tutorials",
  "naming_template": "{series} - s{season:02d}e{episode:03d} - {clean_title}",
  "season_number": 1,
  "generate_nfo": true,
  "filters": [
    {
      "filter_type": "title_regex",
      "filter_value": "Python Tutorial #(\\d+)",
      "priority": 1
    }
  ]
}
```

## User Interface

### Channel Configuration Page
New "Series Configuration" tab in channel details with:
- List of existing profiles
- Add/Edit/Delete profile buttons
- Drag-and-drop profile reordering
- Enable/Disable toggles
- Test filters functionality

### Profile Editor
- Profile name and destination path
- Season number selection
- Naming template builder with variable buttons
- NFO generation toggle
- Filter builder with regex helpers
- Live preview of matched videos

## Implementation Roadmap

### Phase 1: Foundation
- [ ] Create database migration files
- [ ] Implement channel_profiles table
- [ ] Implement profile_filters table
- [ ] Implement video_profile_mappings table

### Phase 2: Backend Core
- [ ] Create channelProfileModule.js
- [ ] Implement CRUD operations for profiles
- [ ] Build filter evaluation engine
- [ ] Add episode counter management

### Phase 3: Post-Processing
- [ ] Enhance videoDownloadPostProcessFiles.js
- [ ] Implement file moving/renaming logic
- [ ] Add thumbnail renaming for media servers
- [ ] Implement optional NFO generation

### Phase 4: API Layer
- [ ] Add profile management endpoints
- [ ] Implement filter testing endpoint
- [ ] Add preview functionality

### Phase 5: Frontend Basic
- [ ] Create ChannelProfileManager component
- [ ] Build ProfileEditor form
- [ ] Add profile list UI
- [ ] Implement enable/disable toggles

### Phase 6: Frontend Advanced
- [ ] Create FilterBuilder component
- [ ] Build NamingTemplateEditor
- [ ] Add VideoMatcher preview
- [ ] Implement drag-and-drop reordering

### Phase 7: Testing & Polish
- [ ] Test series matching logic
- [ ] Verify file organization
- [ ] Test NFO generation
- [ ] Add error handling
- [ ] Write user documentation

## Configuration Examples

### Example 1: Tutorial Series with Numbered Episodes
**Channel**: TechEducation
**Profile**: "Python Course"
- **Filter**: Regex `Python Tutorial #(\d+):`
- **Template**: `Python Course - s01e{episode:03d} - {clean_title}`
- **Result**: `Python Course - s01e001 - Variables and Data Types.mp4`

### Example 2: Daily Show with Date-Based Episodes
**Channel**: NewsChannel
**Profile**: "Daily Updates"
- **Filter**: Contains `Daily News`
- **Template**: `Daily News - {year}x{month:02d}{day:02d} - {title}`
- **Result**: `Daily News - 2024x0115 - Market Analysis.mp4`

### Example 3: Mixed Content with Specials
**Channel**: GamingChannel
**Profile 1**: "Let's Play Series"
- **Filter**: Regex `Let's Play .+ Part (\d+)`
- **Season**: 1
- **Template**: `Gaming - s{season:02d}e{episode:03d} - {clean_title}`

**Default Profile**: "Gaming Extras"
- **No filters** (catches all unmatched)
- **Season**: 0 (Specials)
- **Template**: `Gaming - s00e{episode:03d} - {title}`

## Backward Compatibility

- System continues to function normally without profiles configured
- Existing downloaded videos remain in their current locations
- Profile system is opt-in per channel
- Can be disabled globally in configuration
- Future enhancement: Bulk migration tool for existing videos

## Media Server Compatibility

### Plex
- ✅ Proper file naming (Series - s##e## - Title.mp4)
- ✅ Episode thumbnails (same name as video file)
- ❌ NFO files not supported (Plex ignores them)

### Jellyfin/Emby
- ✅ Proper file naming
- ✅ Episode thumbnails
- ✅ NFO files for metadata
- ✅ tvshow.nfo for series metadata

### Kodi
- ✅ All features supported
- ✅ NFO format compatible

## Future Enhancements

1. **Smart Series Detection**: AI-powered suggestions for series patterns
2. **Bulk Reprocessing**: Re-organize existing videos with new profiles
3. **Profile Templates**: Import/export profile configurations
4. **Multi-Language Support**: Localized season folder names
5. **Advanced Filters**: Duration ranges, upload date filters, view count thresholds
6. **Series Artwork**: Auto-fetch or generate series posters/banners
7. **Episode Ordering**: Custom episode order based on upload date or title
8. **Series Completion**: Mark series as complete to stop downloading