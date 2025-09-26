# Youtarr Troubleshooting Guide

## Login Issues

### Cannot Access Initial Setup

**Problem**: Unable to access the initial setup page or getting "Initial setup can only be performed from localhost" error.

**Solution**:
- Initial setup must be done from the same machine running Youtarr
- Access the setup using `http://localhost:3087` not the machine's IP address
- If running in Docker, ensure you're accessing from the host machine

#### Accessing from a Headless/Remote Server

If you're running Youtarr on a headless server (no GUI) or remote machine, you can use SSH port forwarding to access the initial setup:

**From Windows:**
```bash
# Open an elevated Command Prompt or PowerShell
ssh -L 3087:localhost:3087 username@<server-ip-address>
# Then open http://localhost:3087 in your browser
```

**From Linux/Mac:**
```bash
# In terminal
ssh -L 3087:localhost:3087 username@<server-ip-address>
# Then open http://localhost:3087 in your browser
```

This creates a secure tunnel between your local machine's port 3087 and the server's port 3087, allowing you to complete the initial setup as if you were on localhost. After completing the setup, you can access Youtarr normally using the server's IP address.

### Forgotten Admin Password {#reset-admin-password}

**Problem**: Cannot log in because you've forgotten the admin password.

**Solution**:
1. Stop Youtarr:
   ```bash
   ./stop.sh
   ```

2. Delete the following line in your `./config/config.json`:
   ```
   passwordHash": "YOUR_CURRENT_HASH",
   ```

3. Start Youtarr:
   ```bash
   ./start.sh
   ```

4. Access `http://localhost:3087` to set up a new admin password

### Session Expired

**Problem**: Getting "Invalid or expired token" errors.

**Solution**:
- You will be automatically redirected to the login page
- Simply log back in with your credentials
- Sessions expire after 7 days of inactivity
- If issues persist, clear browser cache/cookies

### Plex API Key Issues

**Problem**: Cannot connect to Plex server or refresh library.

**Solution**:
1. **Get a new API key automatically**:
   - Go to Configuration page
   - Click "Get Key" button next to Plex API Key field
   - Log in with your Plex account (must have admin access to your server)
   - Save configuration

2. **Get API key manually**:
   - Follow [these instructions](https://www.plexopedia.com/plex-media-server/general/plex-token/)
   - Enter the token in the Plex API Key field
   - Save configuration

3. **If you have an invalid/old key**:
   - Stop Youtarr: `./stop.sh`
   - Edit `config/config.json` and clear the key: `"plexApiKey": ""`
   - Restart: `./start.sh`
   - Get a new key using method 1 or 2 above

## Docker Issues

### Docker Desktop Mount Path Error (Windows)

**Problem**: Error message: `Error response from daemon: error while creating mount source path '/run/desktop/mnt/host/...': mkdir /run/desktop/mnt/host/...: file exists`

This is a known Docker Desktop issue on Windows where mount points become corrupted.

**Solutions** (try in order):

1. **Restart Docker Desktop**:
   ```bash
   ./stop.sh
   ```
   Quit Docker Desktop from system tray, restart it, then:
   ```bash
   ./start.sh
   ```

2. **Reset WSL2 mounts**:
   - Open PowerShell as Administrator
   - Run: `wsl --shutdown`
   - Restart Docker Desktop
   - Run `./start.sh`

3. **Full system restart**:
   - If Docker Desktop hangs, restart your entire machine
   - This clears all stale mount points

**Prevention**:
- Always use `./stop.sh` before shutting down Docker Desktop
- Disable Windows Fast Startup (Control Panel → Power Options)
- Let Docker Desktop fully start before running `./start.sh`

### Container Won't Start

**Problem**: Containers fail to start or immediately exit.

**Solution**:
1. Check logs:
   ```bash
   docker compose logs -f
   ```

2. Ensure ports aren't in use:
   ```bash
   netstat -an | grep 3087
   netstat -an | grep 3321
   ```

3. Clean restart:
   ```bash
   ./stop.sh
   docker compose down -v  # Warning: This removes volumes
   ./start.sh
   ```

## Database Issues

### UTF-8 Character Errors

**Problem**: Errors like `Incorrect string value: '\\xF0\\x9F\\xA7\\xA1'` when channel names or video titles contain emojis.

**Solution** for existing installations:
1. Check your database character set:
   ```bash
   ./scripts/check-database-charset.sh
   ```

2. If not using utf8mb4, backup your database and run the migration

New installations automatically support full UTF-8 (utf8mb4).

### Database Connection Failed

**Problem**: Cannot connect to database errors.

**Solution**:
1. Ensure the database container is running:
   ```bash
   docker ps | grep youtarr-db
   ```

2. Check database logs:
   ```bash
   docker logs youtarr-db
   ```

3. Verify database credentials in environment

## Download Issues

### Videos Not Downloading

**Problem**: Channels are added but videos aren't downloading.

**Checklist**:
1. Check the download directory is correctly configured
2. Verify the directory is accessible by Docker
3. Check logs for yt-dlp errors:
   ```bash
   docker compose logs -f youtarr | grep yt-dlp
   ```
4. Ensure the cron schedule is configured (default: every 6 hours)
5. Manually trigger a download from the Channels page

### yt-dlp Errors

**Problem**: yt-dlp fails to download videos.

**Solution**:
- Youtarr's Docker image includes yt-dlp which auto-updates
- For persistent issues, rebuild the container:
  ```bash
  ./stop.sh
  docker compose pull
  ./start.sh
  ```

## Plex Integration Issues

### Videos Not Showing in Plex

**Problem**: Downloaded videos don't appear in Plex library.

**Checklist**:
1. Verify Plex library is set to "Other Videos" type
2. Ensure Plex agent is "Personal Media"
3. Check Plex has access to the download directory
4. Manually scan the library in Plex
5. Verify Plex server IP and port are correct
   - Docker Desktop (Windows/macOS): `host.docker.internal`
   - Docker on macOS without Docker Desktop (e.g., Colima): host LAN IP (e.g., `192.168.x.x`) or `host.lima.internal`
   - Docker on Linux or running inside WSL2 without Docker Desktop: host LAN IP (e.g., `192.168.x.x`)
   - Ensure the Plex Port matches your Plex configuration (default `32400`).

### Cannot Connect to Plex

**Problem**: Youtarr cannot communicate with Plex server.

**Solution**:
1. Verify the Plex IP and port settings:
  - Docker Desktop (Windows/macOS): use `host.docker.internal`
  - Docker on macOS without Docker Desktop (e.g., Colima): use the host LAN IP (e.g., `192.168.x.x`) or `host.lima.internal`
  - Docker on Linux or running inside WSL2 without Docker Desktop: use the host LAN IP (e.g., `192.168.x.x`)
  - Update the Plex Port field if Plex listens on a non-default port (default `32400`).
2. Ensure Plex is running on the same machine
3. Check firewall isn't blocking local connections
4. Verify Plex is accessible at the configured IP and port

## Performance Issues

### High Memory/CPU Usage

**Problem**: Youtarr consuming excessive resources.

**Solution**:
1. Check for stuck download jobs
2. Limit concurrent downloads in configuration
3. Restart containers:
   ```bash
   ./stop.sh
   ./start.sh
   ```
4. Check disk space - low space can cause performance issues

## Network Access Issues

### Cannot Access from Other Devices

**Problem**: Can't access Youtarr from other computers on the network.

**Solution**:
1. Configure firewall to allow port 3087
2. Use server's actual IP address, not localhost
3. Check Windows Defender Firewall settings
4. Verify router settings if accessing from different subnet

## Metadata Issues

### Metadata Not Showing in Media Server

**Problem**: Videos play but metadata (title, description, etc.) isn't displaying in your media server.

#### Plex
**Solution**:
- Ensure "Local Media Assets" is enabled in your library agent settings
- Place Local Media Assets at the top of the agent priority list
- Check container logs for "Successfully added additional metadata to video file"
- Try "Refresh Metadata" on the library or individual items
- Verify the library type is "Other Videos" with "Personal Media" agent

#### Kodi/Jellyfin/Emby
**Solution**:
- Verify .nfo files exist alongside video files (same name, different extension)
- Ensure library is configured as "Movies" type
- Enable "Nfo" metadata reader in library settings
- Disable all online metadata scrapers to avoid conflicts
- Try a full library rescan
- Check file permissions - media server must be able to read .nfo files

### Channel Posters Not Displaying

**Problem**: Channel folders don't show artwork/posters.

**Solution**:
- Verify poster.jpg exists in each channel folder
- Check that "Copy channel poster.jpg files" is enabled in Configuration
- Ensure media server has read permissions for image files
- Some servers cache artwork - try:
  - Clearing server cache
  - Restarting the media server
  - Removing and re-adding the library

### Special Characters in Titles/Metadata

**Problem**: Titles with $, &, or other special characters display incorrectly.

**Solution**:
- Youtarr properly escapes XML characters in NFO files
- For Plex: Embedded metadata handles special characters automatically
- If issues persist:
  - Check media server logs for XML parsing errors
  - Verify you're running the latest version of Youtarr
  - Report specific character issues on GitHub

### NFO Files Not Being Created

**Problem**: Videos download but no .nfo files are generated.

**Solution**:
- Check that "Generate video .nfo files" is enabled in Configuration
- Verify post-processing completed (check container logs)
- Ensure write permissions in video directories
- Look for errors in logs during post-processing phase

## Getting Help

If these solutions don't resolve your issue:

1. Check the [GitHub Issues](https://github.com/dialmaster/Youtarr/issues) page
2. Provide relevant logs when reporting issues:
   ```bash
   docker compose logs --tail=100 youtarr
   ```
3. Include your configuration (without sensitive data)
4. Describe steps to reproduce the problem
