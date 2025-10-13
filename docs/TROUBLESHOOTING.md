# Youtarr Troubleshooting Guide

## Login Issues

### Cannot Access Initial Setup

**Problem**: Unable to access the initial setup page or getting "Initial setup can only be performed from localhost" error.

**Solution**:
- Initial setup must be done from the same machine running Youtarr unless you seed credentials via environment variables
- Run `./start.sh` (or `./start.sh --external-db`) – if no credentials exist you will be prompted for an initial admin username/password and the script will export the required `AUTH_PRESET_USERNAME` / `AUTH_PRESET_PASSWORD` values automatically
- Alternatively, pass both preset variables yourself when launching the container (e.g. through Docker Compose, Unraid template's environment, or other orchestration tools)
- If you prefer to use the UI wizard, access the setup using `http://localhost:3087` (not the machine's IP address)
- When running in Docker, make sure you browse from the host machine or forward the port securely as described below

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

> Tip: If you cannot use SSH port forwarding, provide `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` in your container environment (or via `./start.sh`) before the first boot. Youtarr will hash the password and skip the localhost-only wizard.

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

### Discord Notifications Not Sending

**Problem**: You never receive Discord alerts after downloads.

**Solution**:
1. Open Configuration → Optional: Notifications and confirm **Enable Notifications** is on.
2. Verify the Discord webhook URL is correct and saved; click "Send Test Notification" to confirm delivery.
3. Notifications only send when at least one new video downloads successfully—skipped runs will not trigger an alert.
4. Check the server logs (`docker compose logs -f`) for `Failed to send notification` errors that may indicate network or webhook permission issues.

### Test Notification Fails

**Problem**: "Send Test Notification" shows an error.

**Solution**:
1. Ensure the webhook URL is saved and not blank or whitespace.
2. Confirm the webhook belongs to Discord (URL should start with `https://discord.com/api/webhooks/`).
3. Make sure the Discord channel still exists and the webhook has permission to post.
4. Retry after checking network/firewall rules that may block outbound HTTPS requests.

## Automatic Video Removal Issues

### Dry Run Preview Fails or Shows "Storage status unavailable"

**Problem**: Previewing automatic removal returns an error, or the space-based strategy is disabled.

**Solution**:
- Confirm the storage indicator at the top of the Configuration page is visible and shows valid values. Space-based removal requires the server to resolve the download directory path and gather disk usage via `df`.
- Ensure the `DATA_PATH` (or selected YouTube directory) exists within the container/host and is mounted with read access to filesystem metadata.
- If you're running on network storage or uncommon mounts, try remounting with `df` support or rely on age-based cleanup instead.
- Retry the preview after saving the configuration again. The preview endpoint requires a valid auth token; log back in if necessary.

### Nightly Cleanup Didn't Delete Anything

**Problem**: Automatic cleanup runs at 2:00 AM but no videos are removed.

**Solution**:
- Verify Automatic Video Removal is enabled and at least one threshold (age or free space) is configured on the Configuration page.
- Run the dry-run preview to see how many videos currently match the thresholds and adjust values if needed (for example, lower the free-space threshold or reduce the age requirement).
- Check server logs around 2:00 AM for messages prefixed with `[CRON]` or `[Auto-Removal]` to confirm the job is executing (`docker compose logs -f app`).
- If errors appear in the logs (e.g., permission issues deleting files), resolve those first—the cron job will skip files it cannot delete.

## Docker Issues

### "Empty section between colons" Error

**Problem**: Getting error `invalid spec: :/usr/src/app/data: empty section between colons` when trying to start with Docker Compose.

**Cause**: You ran `docker compose up` directly instead of using `./start.sh`. The docker-compose.yml file requires the `YOUTUBE_OUTPUT_DIR` environment variable to be set, which `./start.sh` reads from your config.json.

**Solution**:
Always use the start script instead of running docker-compose commands directly:
```bash
./start.sh
```

The start script:
- Reads your configured YouTube output directory from `config/config.json`
- Exports it as `YOUTUBE_OUTPUT_DIR` environment variable
- Then runs docker-compose with the correct configuration

**Note**: This is by design to ensure your configured directory in config.json matches the Docker volume mount. Using docker-compose directly would bypass this validation and could result in mismatched storage locations.

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
