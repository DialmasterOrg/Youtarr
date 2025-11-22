# Kodi Integration Guide

Complete guide for integrating Youtarr with Kodi media center.

## Table of Contents
- [Overview](#overview)
- [Library Setup](#library-setup)
- [Metadata Configuration](#metadata-configuration)
- [Multi-Library Organization](#multi-library-organization)
- [File Structure](#file-structure)
- [Troubleshooting](#troubleshooting)

## Overview

Youtarr provides comprehensive Kodi support through:
- NFO metadata files for each video
- Channel poster artwork (poster.jpg)
- Proper folder organization
- Full metadata including descriptions, dates, and tags
- Multi-source support for content organization

## Library Setup

### Step 1: Add Video Source

1. Navigate to Videos → Files → Add videos...
2. Browse to your Youtarr download directory
3. Enter a name for this media source (e.g., "YouTube")

### Step 2: Set Content Type

When prompted for content type:
1. Select **Movies** as the content type
2. Choose information provider:
   - **Recommended**: Local information only
   - **Alternative**: Local NFO files (if available as option)

### Step 3: Configure Scraper Settings

Configure the following settings:
- **Movies are in separate folders that match the movie title**: Yes
- **Scan recursively**: Yes
- **Selected folder contains a single video**: No
- **Exclude path from library updates**: No

## Metadata Configuration

### NFO Support

Youtarr generates comprehensive NFO files containing:
- **Title**: Video title with channel prefix
- **Plot**: Full video description
- **Premiered**: Original YouTube upload date
- **Studio**: Channel name
- **Genre**: YouTube categories
- **Tag**: Video keywords (up to 10)
- **Runtime**: Video duration in minutes
- **Uniqueid**: YouTube video ID

### Poster Artwork

Channel posters (poster.jpg) are:
- Automatically generated for each channel
- Displayed in folder view
- Used as fallback artwork
- Updated when channel avatar changes

### Metadata Settings

In Kodi settings:
1. **Enable**: Use folder names for lookups
2. **Disable**: All online scrapers
3. **Enable**: Prefer local information

## Multi-Library Organization

### Creating Multiple Sources

Organize content by type using subfolders:

1. **Add separate video sources** for each subfolder:
   ```
   Source 1: "YouTube - Kids" → /path/to/youtube/__kids
   Source 2: "YouTube - Music" → /path/to/youtube/__music
   Source 3: "YouTube - General" → /path/to/youtube
   ```

2. **Configure each source** independently:
   - Kids: Family-friendly settings
   - Music: Music visualization options
   - General: Standard video settings

### Benefits of Multiple Sources

- **Organization**: Easy navigation to specific content
- **Permissions**: Different access levels per source
- **Views**: Custom view modes per content type
- **Scanning**: Faster updates for specific sources

## File Structure

See [docs/YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md](../YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md)

## Troubleshooting

### Videos Not Appearing

**Problem**: Videos don't show in library after scanning

**Solutions**:
1. Verify content type is set to "Movies"
2. Check that NFO files exist:
   ```bash
   find /path/to/youtube -name "*.nfo" | head -5
   ```
3. Clean and rescan library
4. Check Kodi log for errors

### Metadata Not Displaying

**Problem**: Videos appear but without descriptions/details

**Solutions**:
1. Confirm NFO support is enabled
2. Verify NFO file format:
   ```bash
   cat "video.nfo" | head -20
   ```
3. Check scraper is set to "Local information only"
4. Refresh individual items

### Poster Issues

**Problem**: Channel posters not showing

**Solutions**:
1. Verify poster.jpg exists in channel folders
2. Check image permissions and format
3. Clear thumbnail cache and rescan
4. Try different view mode

### Special Characters

**Problem**: Titles with special characters display incorrectly

**Solutions**:
1. Ensure Kodi language is set correctly
2. Check NFO encoding (should be UTF-8)
3. Verify filesystem supports Unicode
4. Update Kodi to latest version

### Duplicate Entries

**Problem**: Videos appear multiple times

**Solutions**:
1. Check for duplicate source paths
2. Clean library before rescanning
3. Verify no symbolic links causing loops
4. Remove and re-add source
