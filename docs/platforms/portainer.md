# Youtarr on Portainer

Portainer can run Youtarr as a stack, but **don't paste the repository's `docker-compose.yml` into Portainer as it is.** That file keeps the database and settings in folders next to the compose file (`./database`, `./config`), and in Portainer those folders end up somewhere you can't easily see, that Portainer doesn't back up, and that can come back empty. See [Why not the repository's docker-compose.yml?](#why-not-the-repositorys-docker-composeyml) for the details. Use the stack on this page instead: it puts everything in folders you choose.

These steps were tested on Portainer Community Edition 2.27 with a local Docker environment. Other versions may label things a little differently.

## Before you start

Pick two folders on the Docker host:

- **Videos**: where Youtarr saves downloads, for example a folder on your media share. Your media server needs to be able to read it.
- **App data**: where Youtarr keeps its settings, its record of downloaded videos, and its images, for example `/srv/appdata/youtarr`, or `/mnt/user/appdata/youtarr` on Unraid.

Both should be on the host's real disks and included in your backups. On Unraid, folders outside `/mnt/` live in memory and are wiped on reboot; also see the [Unraid notes](#unraid-notes).

The database is stored in a Docker volume named `youtarr-db-data`, so you don't need a folder for it.

## Create the stack

1. In Portainer, open your environment and go to **Stacks** -> **Add stack**.
2. Name the stack `youtarr`.
3. Under **Build method**, keep **Web editor** and paste the stack below.
4. Replace every `/path/to/...` with your folders (the lines marked `CHANGE`). The `YOUTUBE_OUTPUT_DIR` line must match the videos folder.
5. Set `TZ` to your timezone, written as Area/City (for example `America/New_York` or `Australia/Melbourne`).
6. Optional: to use your own database password instead of the default, add an environment variable named `DB_PASSWORD` under **Environment variables**. Do this before the first deploy; see [Changing the database password](#changing-the-database-password).
7. Click **Deploy the stack**.

```yaml
services:
  youtarr-db:
    image: mariadb:10.3
    container_name: youtarr-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD:-123qweasd}
      MYSQL_DATABASE: youtarr
      MYSQL_TCP_PORT: 3321
    command: --port=3321 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --innodb-file-per-table=1 --innodb-large-prefix=ON
    volumes:
      - youtarr-db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-P", "3321", "-u", "root", "-p${DB_PASSWORD:-123qweasd}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  youtarr:
    image: dialmaster/youtarr:latest
    container_name: youtarr
    restart: unless-stopped
    depends_on:
      youtarr-db:
        condition: service_healthy
    environment:
      TZ: UTC  # Your timezone as Area/City, e.g. America/New_York
      DB_HOST: youtarr-db
      DB_PORT: 3321
      DB_USER: root
      DB_PASSWORD: ${DB_PASSWORD:-123qweasd}
      DB_NAME: youtarr
      YOUTUBE_OUTPUT_DIR: /path/to/youtube  # CHANGE: same folder as the first volume below
    ports:
      - "3087:3011"  # Web UI on port 3087. Leave 3011 alone; it's Youtarr's port inside the container
    volumes:
      - /path/to/youtube:/usr/src/app/data  # CHANGE: where your videos are saved
      - /path/to/appdata/youtarr/config:/app/config  # CHANGE: settings and download history
      - /path/to/appdata/youtarr/jobs:/app/jobs  # CHANGE
      - /path/to/appdata/youtarr/images:/app/server/images  # CHANGE

volumes:
  youtarr-db-data:
    name: youtarr-db-data
```

A few things in this file look like they should be changed but shouldn't:

- In `3087:3011`, only the `3087` is yours to change (it's the port you open in the browser). `3011` is the port Youtarr listens on inside the container, so `3087:3087` gives you a page that never loads.
- `/usr/src/app/data`, `/app/config`, `/app/jobs`, and `/app/server/images` are paths inside the container. Change only the part before the colon. If videos are mounted anywhere other than `/usr/src/app/data`, Youtarr saves them inside the container and they disappear when the container is recreated.
- Youtarr ignores `PUID` and `PGID`. To run it as a non-root user, see [Running as a non-root user](#running-as-a-non-root-user).

If you started from a compose file you found somewhere else (a blog post, a generic template, an AI answer), compare it with this one. `PUID`/`PGID`, a `3087:3087` port, and an `/app/data` mount are all signs it wasn't written for Youtarr.

## First login

Open `http://<your-server-ip>:3087`. On first start, Youtarr asks for a one-time setup token:

- In Portainer, go to **Containers** -> **youtarr** -> **Logs** and look for the `Youtarr initial setup required` line. It includes the token as `setupToken`.
- The token is also saved in the `setup-token` file in your config folder.

To skip the token, add `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` to the `youtarr` service's `environment:` before the first deploy. See [Authentication](../AUTHENTICATION.md) for both options.

## Check where your data is stored

After the first deploy, make sure Docker used the folders you meant:

- **Containers** -> **youtarr**: the **Volumes** section at the bottom lists each host folder next to its path in the container. Each one should be one of your folders.
- **Containers** -> **youtarr-db**: the **Volumes** section should show `youtarr-db-data`.

Or from a shell on the Docker host:

```bash
docker inspect youtarr youtarr-db --format '{{.Name}}{{range .Mounts}}  {{if .Name}}{{.Name}}{{else}}{{.Source}}{{end}}{{end}}'
```

If any path starts with `/data/compose/`, that stack is using relative paths. See [Moving an existing install out of /data/compose](#moving-an-existing-install-out-of-datacompose).

## Why not the repository's docker-compose.yml?

The repository's compose file is written for a cloned Youtarr folder and `./start.sh`, so it uses paths relative to the compose file: `./database`, `./config`, `./jobs`, and `./server/images`. Portainer runs each stack's compose file from its own folder, so on the Docker host those paths become `/data/compose/<stack id>/database` and so on. That causes three problems:

- **Portainer's backups don't include it.** Portainer keeps its own copy of your compose file in its data volume. Your database and settings are in a different `/data/compose` folder on the host, which most people never look at.
- **A re-created stack starts empty.** Deleting a stack leaves its folder behind, and a new stack gets a new ID even if you give it the same name. The new stack then uses a new, empty folder, so Youtarr starts with an empty database and default settings.
- **On Unraid, it's wiped on reboot.** `/data` is outside `/mnt`, so it lives in memory, and the database disappears the next time the server restarts.

The same thing happens with the **Upload** and **Repository** build methods. Portainer's relative path support for Git stacks is a Business Edition feature.

The repository's file also needs `YOUTUBE_OUTPUT_DIR` set. Without it, Portainer refuses to deploy with `invalid spec: :/usr/src/app/data: empty section between colons`.

## Updating Youtarr

1. Go to **Stacks** -> **youtarr** and open the **Editor** tab.
2. Click **Update the stack**.
3. Turn on **Re-pull image and redeploy** and click **Update**.

Your videos, settings, and database are kept. There's no need to delete the stack to update.

## Changing the database password

MariaDB only sets its password the first time it starts with an empty database. If you change `DB_PASSWORD` after that, Youtarr uses the new password while the database still expects the old one. Youtarr then repeats `Waiting for database...`, gives up after about a minute, and restarts to try again, while the **youtarr-db** container's logs show `Access denied for user 'root'`.

Deleting and re-creating the stack doesn't fix it, because Portainer keeps the `youtarr-db-data` volume when you delete a stack. To fix it, put the old password back.

If this is a new install with nothing in it yet, you can start the database over instead. **This deletes everything in the database (channels, history, and so on).**

1. Go to **Stacks** -> **youtarr** and click **Delete this stack**.
2. Go to **Volumes**, search for `youtarr-db-data`, select it (it shows as **Unused**), and click **Remove**.
3. Deploy the stack again with the password you want.

## Moving an existing install out of /data/compose

If you deployed the repository's compose file in Portainer, your data is in `/data/compose/<stack id>/` on the Docker host. Move it to real folders before something deletes it (on Unraid, before the next reboot). You'll need a shell on the Docker host (SSH, or the Unraid terminal) with root access.

1. Find the folder: go to **Containers** -> **youtarr-db** and look at the **Volumes** section. The host path looks like `/data/compose/4/database`. The part before `/database` (here `/data/compose/4`) is your stack folder.
2. Go to **Stacks** -> **youtarr** and click **Stop this stack**. This removes the containers, but the data stays where it is.
3. On the Docker host, copy everything to your new app data folder and into a `youtarr-db-data` volume:

   ```bash
   OLD=/data/compose/4                 # your stack folder from step 1
   NEW=/path/to/appdata/youtarr        # your new app data folder
   sudo mkdir -p "$NEW"
   sudo cp -a "$OLD/config" "$OLD/jobs" "$NEW/"
   sudo cp -a "$OLD/server/images" "$NEW/images"
   docker volume create youtarr-db-data
   docker run --rm -v "$OLD/database":/from:ro -v youtarr-db-data:/to mariadb:10.3 cp -a /from/. /to/
   ```

   Copy only what is actually in `$OLD`. If your old stack already used full paths for some folders (for example `config`), skip those and point the new stack at the paths you already use. If your old stack's `YOUTUBE_OUTPUT_DIR` started with `./`, your videos are in `$OLD` too, so move them to your videos folder as well.
4. Open the **Editor** tab, replace the whole file with the stack from [Create the stack](#create-the-stack), and fill in your folders. If you set `DB_PASSWORD` under **Environment variables** before, leave it there.
5. Click **Update the stack**.
6. Open Youtarr and check that your channels and download history are there, then [check where your data is stored](#check-where-your-data-is-stored).

Once everything looks right, you can delete the old folder with `sudo rm -rf /data/compose/4` (using your stack folder).

## Backups

Back up three things:

- **Your app data folder.** `config` holds your settings and `complete.list`, Youtarr's record of every video it has downloaded. Without that file, re-adding your channels downloads everything again.
- **The database.** It lives in a Docker volume, so backups of your host's folders don't include it. Save a copy with:

  ```bash
  docker exec youtarr-db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --events youtarr' > youtarr-db.sql
  ```

- **Your videos**, separately, if you want to keep them.

Stop the **youtarr** container first (**Containers** -> **youtarr** -> **Stop**) so the database and the config folder match, and start it again afterward. Leave **youtarr-db** running.

To restore a database copy, stop **youtarr** the same way, then run:

```bash
docker exec -i youtarr-db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" youtarr' < youtarr-db.sql
```

## Unraid notes

- Use folders under `/mnt/` for everything. Folders anywhere else, such as `/data`, `/opt`, or `/srv`, live in memory and are wiped on reboot.
- The `youtarr-db-data` volume lives inside Unraid's `docker.img`. If you ever delete or rebuild `docker.img`, the database goes with it. Either keep regular [database backups](#backups), or store the database in a folder on your pool instead: replace `youtarr-db-data:/var/lib/mysql` with a pool path such as `/mnt/cache/appdata/youtarr/database:/var/lib/mysql`. Unraid's usual advice is to give databases a pool path like this rather than a `/mnt/user/...` path.
- Use `99:100` (`nobody:users`) if you [run Youtarr as a non-root user](#running-as-a-non-root-user).
- If Youtarr logs `Cannot watch config.json for changes` or `EMFILE: too many open files`, see [Config file watcher limit](../TROUBLESHOOTING.md#config-file-watcher-limit).

## Running as a non-root user

By default Youtarr runs as root, so the files it creates are owned by root. To run it as another user, add a `user:` line to the `youtarr` service, for example:

```yaml
  youtarr:
    image: dialmaster/youtarr:latest
    container_name: youtarr
    user: "1000:1000"
```

Before you deploy, give that user ownership of your folders:

```bash
sudo chown -R 1000:1000 /path/to/youtube /path/to/appdata/youtarr
```

Use the same numbers in both places. The `youtarr-db` container manages its own user, so leave it as it is.

## Troubleshooting

- **Stuck on `Waiting for database...`**: check the **youtarr-db** logs. `Access denied` means the database password changed after the first start; see [Changing the database password](#changing-the-database-password).
- **`empty section between colons` when deploying**: you deployed the repository's compose file without `YOUTUBE_OUTPUT_DIR`. Use the stack on this page instead.
- **The page doesn't load, but the containers are running**: the port mapping must end in `:3011`, for example `"3087:3011"`.
- **Channels are gone after a reboot or after re-creating the stack**: the database was probably stored in `/data/compose`. See [Database Empty After a Reboot or Redeploy](../TROUBLESHOOTING.md#database-empty-after-reboot-or-redeploy).
- **Scheduled downloads or cleanup run at the wrong time**: check `TZ`. It must be a valid Area/City name such as `Australia/Melbourne`; with anything else, Youtarr runs on UTC.

For anything else, see the [Troubleshooting guide](../TROUBLESHOOTING.md), or ask on [Discord](https://discord.gg/68rvWnYMtD) or in [GitHub issues](https://github.com/DialmasterOrg/Youtarr/issues).
