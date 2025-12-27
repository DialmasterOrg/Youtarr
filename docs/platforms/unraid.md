# Youtarr on Unraid

Youtarr has not yet been accepted into the Community Templates store, but has been validated as working on Unraid


## Deploying on Unraid

### Install and setup MariaDB
1. Install the Community Applications plugin (if you have not already)
2. Setup your MariaDB instance. The MariaDB Official docker container will work fine for this purpose.
  - See [External Database Guide](external-db.md) for more information about external DB setup since this uses a DB instance that is not directly bundled with Youtarr.

#### If this is the first time you've installed the MariaDB Official docker container
Set the following configuration options and make note of them as you will need to set the same values in your Youtarr configuration:
- `Database Name`: `youtarr` is recommended
- `Database User`: `youtarr` is recommended
- `Port`: Leaving as default of `3306` is recommended
- `Database Password`: Choose something secure

The first time MariaDB runs it will automatically create the database and user for Youtarr.

#### If you already have a MariaDB instance available

You will need to create a database and user for Youtarr in that instance and ensure that you note the port, database name, database user and password for your subsequent Youtarr configuration.

See [docs/platforms/external-db.md](external-db.md) for reference

**NOTE**: Your MariaDB instance *must* be up and running before Youtarr starts!

### Install and setup Youtarr

The Unraid template for Youtarr `https://github.com/DialmasterOrg/unraid-templates/blob/main/Youtarr/Youtarr.xml`

1. Open a terminal in Unraid
2. Download the template and make it available in Unraid:
```bash
curl -L https://raw.githubusercontent.com/DialmasterOrg/unraid-templates/main/Youtarr/Youtarr.xml -o /boot/config/plugins/dockerMan/templates-user/my-Youtarr.xml
```
3. Navigate to the Docker tab in Unraid and click "Add container"
4. Select "Youtarr" from "User Templates"
5. Fill in all configuration details
  - Ensure that your MariaDB instance is setup with a database name, user and password matching what you set in the Youtarr configuration
  - Use the LAN IP of your Unraid server as DB_HOST (eg `192.168.1.100`)
    - Do not use `127.0.0.1` or `localhost`, as those refer to the container itself, not the Unraid host.
  - Map your persistent paths (for example `/mnt/user/appdata/youtarr/config` for `/app/config` and `/mnt/user/media/youtube` for `/data`) and supply the MariaDB connection variables before deploying.
  - Set both `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` to set credentials for login to Youtarr
  - **IMPORTANT**: `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` must meet these rules or they’ll be ignored:
    - `AUTH_PRESET_USERNAME`: 3-32 characters in length
    - `AUTH_PRESET_PASSWORD`: 8-64 characters in length
  Leaving them blank requires completing the setup wizard from the Unraid host's localhost (e.g., via SSH port forwarding), which most headless installs won't have handy.
6. Click the "Apply" button to start Youtarr

Once the container is running, open http://<your-unraid-ip>:3087 in your browser to access Youtarr.

- **Note** Until the template is accepted into the main Community Applications feed, it is available directly from the repository above.

## Running as Non-Root User

By default, Youtarr runs as root inside the container. This works fine for most setups, but if you need Plex or Jellyfin to be able to delete files that Youtarr downloads, you'll need to run Youtarr as a non-root user with matching permissions.

**Note**: The `YOUTARR_UID` and `YOUTARR_GID` environment variables do not work on Unraid. You must use the `--user` parameter instead.

### Steps to Run as Non-Root

1. **Stop the Youtarr container** if it's running

2. **Set correct ownership on your directories** by opening an Unraid terminal and running:
   ```bash
   chown -R 99:100 /mnt/user/appdata/youtarr/config
   chown -R 99:100 /mnt/user/appdata/youtarr/jobs
   chown -R 99:100 /path/to/your/youtube_videos
   ```
   Replace the paths with your actual mapped directories. The `99:100` corresponds to the `nobody:users` user/group on Unraid.

3. **Add the user parameter to your container**:
   - Edit your Youtarr container in Unraid
   - Scroll down to "Extra Parameters"
   - Add: `--user 99:100`
   - Click "Apply" to restart the container

4. **Verify it's working** by running:
   ```bash
   docker exec -it Youtarr sh -c 'id'
   ```
   You should see `uid=99(nobody) gid=100(users)` instead of `uid=0(root)`.

After this setup, Youtarr will create files with `nobody:users` ownership, which matches the default permissions that Plex and other media apps use on Unraid, allowing them to delete files as needed.
