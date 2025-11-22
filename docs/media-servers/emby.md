# Emby Integration Guide

Complete guide for integrating Youtarr with Emby Media Server.

## Table of Contents
- [Overview](#overview)
- [Library Setup](#library-setup)
- [Metadata Configuration](#metadata-configuration)
- [Multi-Library Organization](#multi-library-organization)
- [Advanced Settings](#advanced-settings)
- [Troubleshooting](#troubleshooting)

## Overview

Youtarr provides comprehensive Emby support through:
- NFO metadata files with complete video information
- Channel poster artwork
- Embedded MP4 metadata
- Multi-library support for content organization
- Compatible folder structure

## Library Setup

### Step 1: Add New Library

1. In Emby, go to Settings → Library
2. Click "Add Media Library"
3. Select library type:
   - **Type**: Movies or Mixed Content
   - **Display Name**: YouTube (or your preference)

### Step 2: Add Media Folders

Configure folder settings:
1. Click "Add" to add folder
2. Browse to your Youtarr download directory
3. For specific content types, use subfolders associated to different libraries:
   - `/path/to/youtube/__kids`
   - `/path/to/youtube/__music`
   - `/path/to/youtube` (all content)

### Step 3: Configure Library Settings

In the library configuration:

**Metadata downloaders**:
1. **NFO** (enable and move to top)
2. Disable all internet providers (TheMovieDb, etc.)

**Image fetchers**:
- **Local Images** (enable)
- Disable all internet image providers

**Advanced Settings**:
- **Save artwork and metadata into media folders**: Yes
- **Prefer embedded metadata**: Yes
- **Enable real-time monitoring**: Optional

## Metadata Configuration

### NFO Support

Emby reads comprehensive NFO files containing:
- **Title**: Video title with channel name
- **Plot**: Complete YouTube description
- **Premiered**: Original upload date
- **Studios**: Channel/creator name
- **Genres**: YouTube categories
- **Tags**: Video keywords and topics
- **Runtime**: Video duration
- **Unique ID**: YouTube video identifier

### Artwork Configuration

Youtarr provides:
- **`poster.jpg`**: Channel artwork in channel folders
- **`<VIDEO NAME>.jpg`**: Video thumbnails in video folders
- Proper naming conventions for Emby recognition

### Embedded Metadata

MP4 files include:
- Title and description
- Upload date
- Channel information
- Genre/category tags
- Ensures basic info even without NFO

## Multi-Library Organization

### Setting Up Multiple Libraries

Create content-specific libraries:

1. **Library Structure**:
   ```
   "YouTube - Kids" → /youtube/__kids
   "YouTube - Music" → /youtube/__music
   "YouTube - Education" → /youtube/__education
   "YouTube - General" → /youtube
   ```

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
- **Save metadata within media folders**: Yes
- **Save subtitles within media folders**: Yes (if using)

**Image Settings**:
- **Save artwork within media folders**: Yes
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

### Duplicate Entries

**Problem**: Videos appear multiple times

**Solutions**:
1. Check for overlapping library paths
2. Remove duplicate library entries
3. Clean library: Dashboard → Scheduled Tasks → Clean Database
4. Verify no symbolic link loops

## File Structure Example

See [Youtarr Downloads Folder Structure](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md)
