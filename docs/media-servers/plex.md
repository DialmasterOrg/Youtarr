# Plex Integration Guide

Complete guide for integrating Youtarr with Plex Media Server.

## Table of Contents
- [Overview](#overview)
- [Library Setup](#library-setup)
- [Youtarr Configuration](#youtarr-configuration)
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

## Library Setup

### Step 1: Create a New Library

1. In Plex, go to Settings → Manage → Libraries
2. Click "Add Library"
3. Configure as follows:
   - **Type**: Other Videos
   - **Name**: YouTube (or your preference)
   - **Language**: Your preferred language

<img width="829" height="369" alt="Plex Library Type Selection" src="https://github.com/user-attachments/assets/0a0ee8d1-e049-4a19-9430-5977464e9dde" />

### Step 2: Select Agent

Choose the appropriate agent:
- **Agent**: Personal Media
- **Scanner**: Plex Video Files Scanner

<img width="816" height="561" alt="Plex Agent Selection" src="https://github.com/user-attachments/assets/a7650ad5-68d5-495b-957d-e42515154dbf" />

### Step 3: Configure Agent Settings

1. After creating the library, go to its settings
2. Navigate to the "Agent" tab
3. Configure "Personal Media" agent:
   - Enable "Local Media Assets"
   - Move it to the top of the agent list
   - Optional: Enable "Prefer local metadata"

<img width="1288" height="220" alt="Plex Agent Settings" src="https://github.com/user-attachments/assets/6e796c9a-243f-4e98-8d87-1d1283e060cc" />

### Step 4: Add Folder

Point the library to your Youtarr download directory:
- Default: `/path/to/youtube`
- Or specific subfolder: `/path/to/youtube/__kids`

## Youtarr Configuration

### Obtaining Plex Token

#### Method 1: OAuth (Recommended)
1. Go to Youtarr Configuration page
2. Click "Get Key" next to Plex API Key field
3. Log in with your Plex account
4. Authorize Youtarr
5. Token automatically populated

#### Method 2: Manual
1. Follow [official Plex token guide](https://www.plexopedia.com/plex-media-server/general/plex-token/)
2. Enter token in Configuration page

### Required Settings

In Youtarr Configuration:
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
- **Title**: Video title with channel prefix
- **Description**: Full YouTube description
- **Studio**: Channel name for grouping
- **Album**: Channel name (alternative grouping)
- **Genre**: YouTube categories
- **Release Date**: Original upload date
- **Poster**: Channel artwork (poster.jpg)
- **Thumbnail**: Video thumbnail

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
