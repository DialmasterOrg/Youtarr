# Jellyfin Integration Guide

Complete guide for integrating Youtarr with Jellyfin Media Server.

## Table of Contents
- [Overview](#overview)
- [Library Setup](#library-setup)
- [Metadata Configuration](#metadata-configuration)
- [Multi-Library Organization](#multi-library-organization)
- [Troubleshooting](#troubleshooting)

## Overview

Youtarr provides full Jellyfin support through:
- NFO metadata files with complete video information
- Channel poster artwork
- Proper folder structure for organization
- Multi-library support for content separation
- Real-time monitoring capability

## Library Setup

### Step 1: Create a New Library

1. In Jellyfin, go to Dashboard → Libraries
2. Click "Add Media Library"
3. Configure basic settings:
   - **Content Type**: `Movies` or `Mixed Movies and Shows`
     - Youtarr currently only supports downloading videos as "movies"
   - **Display Name**: YouTube (or your preference)

### Step 2: Add Folders

Add your Youtarr download directory:
1. Click "Add" under Folders
2. Browse to your YouTube directory
3. For subfolders, add specific paths:
   - Kids: `/path/to/youtube/__kids`
   - Music: `/path/to/youtube/__music`
   - All: `/path/to/youtube`

### Step 3: Configure Metadata Sources

In the library settings:

**Top level library settings**
1. **Preferred download language**: Your language
2. **Country**: Your country
3. **Prefer embedded titles over filenames**: Set to enabled
4. **Enable real time monitoring**: Recommended as enabled
5. **Automatically refresh metadata**: Never (metadata is all embedded/included via `.nfo`)

**Metadata downloaders** (in order):
1. Disable **ALL** metadata downloaders since metadata is included!

**Metadata savers**:
- **Disable**: Nfo

**Image fetchers**:
- Disable all internet fetchers
- Local images will be used automatically

## Metadata Configuration

### NFO Support

Jellyfin reads NFO files containing:
- **Title**: Video title with channel prefix
- **Plot**: Full YouTube description
- **Premiered**: Original upload date
- **Studios**: Channel name
- **Genres**: YouTube categories
- **Tags**: Video keywords
- **Runtime**: Duration in minutes
- **Unique ID**: YouTube video ID

### Artwork Support

Youtarr provides:
- **`poster.jpg`**: Channel artwork in each channel folder
- **`<VIDEO NAME>.jpg`**: Video thumbnail in each video folder
- Proper image naming for Jellyfin recognition

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
   Path: /path/to/youtube
   ```

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

## File Structure

See [docs/YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md)
