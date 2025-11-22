# Youtarr Troubleshooting Guide

## Login Issues

### Cannot Access Initial Setup

**Problem**: Unable to access the initial setup page or getting "Initial setup can only be performed from localhost" error.

**Solution**:
- Initial setup must be done from the same machine running Youtarr unless you seed credentials via environment variables
- For headless/remote setups, run `./start.sh --headless-auth` which will prompt for credentials and save them to your `.env` file
- Alternatively, manually add `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` to your `.env` file before first startup
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

**Method 1: Using Environment Variables (Recommended)**
1. Stop Youtarr:
   ```bash
   ./stop.sh
   ```

2. Edit your `.env` file and set new credentials:
   ```bash
   AUTH_PRESET_USERNAME=admin
   AUTH_PRESET_PASSWORD=your-new-password
   ```

3. Start Youtarr:
   ```bash
   ./start.sh
   ```

4. Log in with the new credentials. Once logged in, you can remove these variables from `.env` if desired (credentials will persist in `config/config.json`)

**Method 2: Reset via config.json (Requires localhost access)**
1. Stop Youtarr:
   ```bash
   ./stop.sh
   ```

2. Edit `./config/config.json` and delete both the `username` and `passwordHash` lines

3. Start Youtarr:
   ```bash
   ./start.sh
   ```

4. Access `http://localhost:3087` to create new credentials via the UI setup wizard
   - **Important**: This must be done from localhost (or via SSH port forwarding as described above)
   - You will be prompted to create a new admin account on first access

### Session Expired

**Problem**: Getting "Invalid or expired token" errors.

**Solution**:
- You will be automatically redirected to the login page
- Simply log back in with your credentials
- Sessions expire after 7 days
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
- Check server logs around 2:00 AM for messages prefixed with `[CRON]` or `[Auto-Removal]` to confirm the job is executing (`docker compose logs -f youtarr`).
- If errors appear in the logs (e.g., permission issues deleting files), resolve those first—the cron job will skip files it cannot delete.

## Docker Issues

### "Empty section between colons" Error

**Problem**: Getting error `invalid spec: :/usr/src/app/data: empty section between colons` when trying to start with Docker Compose.

**Cause**: You ran `docker compose up` directly instead of using `./start.sh` without creating and configuring your `.env` file. The docker-compose.yml file requires the `YOUTUBE_OUTPUT_DIR` environment variable to be set, which `./start.sh` reads from your config.json.

**Solution**:
1. Use the start script instead of running docker-compose commands directly:
```bash
./start.sh
```

The start script:
- Reads your configured YouTube output directory from `config/config.json`
- Exports it as `YOUTUBE_OUTPUT_DIR` environment variable
- Then runs docker-compose with the correct configuration

2. Using docker-compose commands:
- Ensure that you have created your `.env` file from the provided `.env.example` and configured your `YOUTUBE_OUTPUT_DIR` before attempting to run `docker compose up -d`

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

## Database Issues

### UTF-8 Character Errors

**Problem**: Errors like `Incorrect string value: '\\xF0\\x9F\\xA7\\xA1'` when channel names or video titles contain emojis.

By default Youtarr creates the database and tables as utf8mb4, so this shouldn't happen
unless you are using an external DB. If so, see [External Database Guide](platforms/external-db.md)
for how to create your DB with the correct character set.

**How to** ensure that your DB is using the correct character set:
1. Check your database character set by connecting to the DB and then running:
```bash
    -- Database Character Set
    SELECT 'DATABASE' as Object_Type, 'youtarr' as Name, DEFAULT_CHARACTER_SET_NAME as   Charset, DEFAULT_COLLATION_NAME as Collation
    FROM information_schema.SCHEMATA
    WHERE SCHEMA_NAME = 'youtarr';

    -- Table Character Sets (excluding Sequelize metadata)
    SELECT 'TABLE' as Object_Type, TABLE_NAME as Name,
    IFNULL(CCSA.CHARACTER_SET_NAME, '') as Charset,
    TABLE_COLLATION as Collation
    FROM information_schema.tables t
    LEFT JOIN information_schema.COLLATION_CHARACTER_SET_APPLICABILITY CCSA
    ON t.TABLE_COLLATION = CCSA.COLLATION_NAME
    WHERE TABLE_SCHEMA = 'youtarr'
    AND TABLE_TYPE = 'BASE TABLE'
    AND TABLE_NAME != 'SequelizeMeta'
    ORDER BY TABLE_NAME;
```
**It doesn't matter if the SequelizeMeta table is not utf8mb4**

**Solution**
Either:
1. Recreate your DB with the correct character set (**THIS WILL CAUSE LOSS OF ALL DB DATA**)
or
2. Backup your DB and then alter your existing DB to the correct character set using:
```
  ALTER DATABASE youtarr CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
```

### Database Connection Failed

**Problem**: Cannot connect to database errors.

**Solution**:
1. Ensure the database container is running (the commands below only applies if using the bundled DB):
   ```bash
   docker ps | grep youtarr-db
   ```

2. Check database logs:
   ```bash
   docker logs youtarr-db
   ```

3. Verify database credentials in environment

### Access Denied for Custom Database User

**Problem**: After changing `DB_USER` and `DB_PASSWORD` in your `.env` file to use a non-root user, you see access denied errors in the logs:
```
youtarr-db  | 2025-11-22  6:28:19 8 [Warning] Access denied for user '<DB_USER>'@'172.25.0.3' (using password: YES)
```

**Cause**: When using the bundled MariaDB container, you changed `DB_USER` and `DB_PASSWORD` in `.env` but forgot to uncomment the corresponding `MYSQL_USER` and `MYSQL_PASSWORD` environment variables in `docker-compose.yml`. MariaDB needs these variables to create the custom user during initialization.

**Solution**:
1. Stop Youtarr:
   `./stop.sh` or `docker compose down`

2. Edit `docker-compose.yml` and uncomment the `MYSQL_USER` and `MYSQL_PASSWORD` lines under the `youtarr-db` service:
   ```yaml
   environment:
     MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
     MYSQL_DATABASE: ${DB_NAME}
     MYSQL_USER: ${DB_USER}        # Uncomment this line
     MYSQL_PASSWORD: ${DB_PASSWORD}  # Uncomment this line
   ```

3. If the database has already been initialized with incorrect credentials, remove the database directory:

   **WARNING: This will completely remove your DB data!**
   ```bash
   rm -rf ./database
   # Or if using a named volume:
   docker volume rm youtarr-db-data
   ```

4. Start Youtarr again:
   `./start.sh` or `docker compose up -d`

**Note**: This only applies when using the bundled MariaDB container. External database setups don't need the `MYSQL_USER`/`MYSQL_PASSWORD` variables.

### MariaDB init: `Operation CREATE USER failed for 'root'@'%'`

**Problem**: Fresh installs that only use `.env` + `docker-compose.yml` fail during the MariaDB bootstrap with:
```
ERROR 1396 (HY000) at line 21: Operation CREATE USER failed for 'root'@'%'
```

**Cause**: The compose file was configured to set `MYSQL_USER=root`. MariaDB already creates the `root` accounts internally, so trying to create it again aborts initialization and leaves the builtin tables in a crashed state.

**Solution**:
1. Leave the `MYSQL_USER` / `MYSQL_PASSWORD` lines commented out in `docker-compose.yml` when `DB_USER=root` (the default). Only uncomment them if you explicitly set a non-root `DB_USER` / `DB_PASSWORD` in `.env`.
2. Remove the broken datadir (`rm -rf ./database` or `docker volume rm youtarr-db-data`, depending on which storage you use).
3. Run `docker compose up -d` again. MariaDB will initialize cleanly.

### Duplicate Column Errors After Upgrade

**Problem**: MariaDB logs `Duplicate column name 'duration'` (or similar) when the stack starts. The API returns `Database error: Duplicate column name ...`.

**Cause**: The `SequelizeMeta` table was lost or corrupted, so Sequelize re-ran migrations on top of a populated schema. Every migration now checks for existing tables/columns/indexes before mutating anything, so simply restarting the containers lets the stack skip duplicate work automatically in most cases.
**NOTE**: This should not happen anymore, migrations have been updated to be idempotent.

**Solution**:
1. Restart the stack (`docker compose up -d`). If the schema had already been migrated, the rerun will now skip those operations.
2. If the error persists, check `docker compose logs youtarr` to see which migration is still failing.
3. Manually reconcile the schema for that migration:
   - Connect to MariaDB: `docker compose exec youtarr-db mysql -u root -p youtarr`
   - Drop the duplicate column or table mentioned in the error (for example `ALTER TABLE Videos DROP COLUMN media_type;`), **or** restore a known-good backup.
   - Exit MySQL and restart the stack.
4. Once the stack is back online, verify the latest schema under **Configuration → System → Database Health**.

Tip: run with a named volume (see Apple Silicon/Synology sections) so filesystem corruption is less likely to recur.

### Apple Silicon: `Incorrect information in file` errors

**Problem**: On Apple Silicon (M1/M2/M3/M4) running Docker Desktop, MariaDB logs errors like:
```
ERROR 1033 (HY000): Incorrect information in file: './youtarr/videos.frm'
```
This happens whenever MariaDB touches tables stored on a bind-mounted host directory (our default `./database:/var/lib/mysql`). Docker Desktop shares bind mounts over `virtiofs`, and MariaDB 10.3 cannot reliably reopen InnoDB tables on that filesystem ([MariaDB issue #447](https://github.com/MariaDB/mariadb-docker/issues/447), [#481](https://github.com/MariaDB/mariadb-docker/issues/481)). Linux and WSL users are unaffected.

**Solution** (switch to a named Docker volume):
**NOTE:** Existing data will *not* be migrated!
1. Stop the stack and remove the old volume `docker compose down -v`.
2. Edit `docker-compose.yml`:
   ```yaml
   services:
     youtarr-db:
       # Comment out the default bind mount line:
       # - ./database:/var/lib/mysql
       # And enable the named volume instead (charset tuning is built into the container command):
       - youtarr-db-data:/var/lib/mysql

   # Ensure that the volume is defined
   volumes:
     youtarr-db-data:
   ```
4. Start Youtarr again (`./start.sh` or `docker compose up -d`). MariaDB will initialize inside `youtarr-db-data`, avoiding virtiofs entirely.

**Alternatives**:
- Point Youtarr at an external MariaDB/MySQL instance via `./start-with-external-db.sh`.
- Run the stack on Linux/WSL, which uses a native filesystem for bind mounts.

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

**Solution #1**:

Youtarr's Docker image includes yt-dlp which auto-updates on every release, update to the latest version if behind:
  - Via docker compose:
      ```bash
      docker compose down
      docker compose pull
      docker compose up -d
      ```
  - Using helper scripts:
      ```bash
      ./stop.sh
      ./start.sh --pull-latest
      ```

**Solution #2**:

YouTube is blocking your downloads.
1. Try enabling and uploading cookies in Configuration -> Cookie Configuration
2. If only some videos are failing, try increasing the "Sleep Between Requests" value in Configuration -> Advanced Settings
3. Try using a proxy, or switching to a VPN

**NOTE**: In some cases YouTube may temporarily blacklist your IP address if too many requests were happening from your IP. You may just need to wait in order to download again. You can manually test downloading a video from YouTube to rule out Youtarr-specific issues by downloading yt-dlp and attempting to manually download a single video.


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
1. Check for stuck download jobs (these can be cleared by restarting Youtarr)
2. Restart containers:
   ```bash
   ./stop.sh
   ./start.sh
   ```
3. Check disk space - low space can cause performance issues

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
- Ensure library is configured as "Movies" or "Mixed" type
- Enable "Nfo" metadata reader in library settings
- Disable all online metadata scrapers to avoid conflicts
- Try a full library rescan
- Check file permissions - media server must be able to read .nfo files

### Channel Posters Not Displaying

**Problem**: Channel folders don't show artwork/posters.
**NOTE:** Plex does not support channel posters, this is only supported on Kodi/Jellyfin/Emby

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

1. Check the [GitHub Issues](https://github.com/DialmasterOrg/Youtarr/issues) page
2. Provide details about your operating system
3. Provide relevant logs when reporting issues:
   ```bash
   docker compose logs --tail=100 youtarr
   ```
4. Include your configuration (without sensitive data)
5. Describe steps to reproduce the problem
