# Youtarr Setup Guide

## Initial Setup

### Prerequisites

Before setting up Youtarr, ensure you have:

1. **Docker & Docker Compose** installed on your system
2. **Bash Shell** (Git Bash for Windows users)
3. **Git** to clone the repository
4. Access to your **Plex Media Server** (Youtarr should run on the same machine)

### First-Time Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dialmaster/Youtarr.git
   cd Youtarr
   ```

2. **Run the setup script**:
   ```bash
   ./setup.sh
   ```
   This will prompt you to select the root directory where YouTube videos will be stored.

3. **Start Youtarr**:
   ```bash
   ./start.sh
   ```
   This starts both the Youtarr application and MariaDB database containers.

4. **Access the web interface**:
   Open your browser and navigate to `http://localhost:3087`

5. **Complete initial setup**:
   - On first access from localhost, you'll be prompted to create an admin account
   - Choose a strong password (minimum 8 characters recommended)
   - This account will be used for all future logins

## Authentication

Youtarr uses a local authentication system:

- **Initial Setup**: When accessing Youtarr for the first time from localhost, you'll create an admin account
- **Subsequent Logins**: Use your admin credentials to log in
- **Session Management**: Sessions expire after 7 days of inactivity
- **Security**: Passwords are securely hashed using bcrypt

### Important Notes:
- Initial setup can **only** be performed from localhost for security reasons
- If you need to reset your admin password, see the [Troubleshooting Guide](TROUBLESHOOTING.md#reset-admin-password)

## Configuration

After logging in, configure Youtarr through the Configuration page:

### Required Settings

**Download Directory**:
- This is set by the initial setup via `./setup.sh`.
- Videos will be organized in subdirectories by channel name
- After changing this, restart Youtarr (`./stop.sh` then `./start.sh`)

### Optional Settings

1. **Plex Server Configuration**:
   - **Plex Server IP**: For Docker installations, use `host.docker.internal`
   - **Plex API Key**: Get it automatically via the Configuration page or [manually](https://www.plexopedia.com/plex-media-server/general/plex-token/)
   - **Plex Library Section**: Select the library where videos will be stored
     - The app can attempt to automatically set the right download directory for your selected
       Plex library, but this will require a restart of Youtarr if changed.
   - The library should be configured as "Other Videos" with "Personal Media" agent in your Plex server

2. **Download Schedule**:
    - Configure how often Youtarr checks for new and downloads new videos for your channels
    - Default: Every 6 hours

3. **Media Server Compatibility Settings**:

   **NFO File Generation** (enabled by default):
   - Automatically creates .nfo metadata files alongside each video
   - Compatible with Kodi, Jellyfin, and Emby
   - Includes: title, plot, upload date, channel info, genres, tags, runtime

   **Channel Poster Generation** (enabled by default):
   - Copies channel thumbnails as poster.jpg in each channel folder
   - Helps media servers display channel artwork

   **Embedded Metadata Enhancement**:
   - Automatically embeds extended metadata directly into MP4 files
   - Includes: genre (from categories), studio/network (channel name), keywords (from tags)
   - Ensures Plex can read metadata even without Local Media Assets configured

## Plex Library Setup

For Youtarr to work correctly with Plex:

1. Create a new library in Plex:
   - Type: **Other Videos**
   - Agent: **Personal Media**
   - Add the folder where Youtarr downloads videos

2. Ensure the Plex server can access the download directory

3. Videos will automatically be added to Plex after download and the Plex library will be refreshed.

## Adding YouTube Channels

1. Navigate to the Channels page
2. Click "Add Channel"
3. Enter the YouTube channel URL or ID
4. Youtarr will automatically:
   - Download new videos from subscribed channels
   - Organize them by channel name
   - Add them to your Plex library (if configured)
   - Generate metadata files for media server compatibility

Note on removal: Removing a channel in the UI disables future downloads for that channel but does not delete existing videos or download history.

## Network Access

To access Youtarr from other devices on your network:

1. Configure your firewall to allow port 3087
2. Access using your server's IP address: `http://[server-ip]:3087`

For external access, you'll need to:
- Set up port forwarding on your router
- Consider using a reverse proxy for security
- Implement HTTPS for secure remote access

## Upgrading

To upgrade to the latest version:

1. Stop Youtarr:
   ```bash
   ./stop.sh
   ```

2. Pull the latest changes:
   ```bash
   git pull
   ```

3. Start Youtarr:
   ```bash
   ./start.sh
   ```

Your database and configuration will be preserved during upgrades.
