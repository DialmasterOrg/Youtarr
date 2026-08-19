# Youtarr on Asustor NAS

Youtarr is available in Asustor's **App Central** as a community-maintained package, built and published by [Orbernator](https://www.forum-nas.fr/threads/youtarr-outil-auto-h%C3%A9berg%C3%A9-permettant-de-t%C3%A9l%C3%A9charger-automatiquement-les-vid%C3%A9os-de-vos-cha%C3%AEnes-et-playlists-youtube-pr%C3%A9f%C3%A9r%C3%A9es.27016/). The Youtarr project doesn't build this package or control when it updates, but we're happy to help with anything on the app side.

## Requirements

- An x86-64 Asustor NAS (the package doesn't support ARM models)
- ADM 5.0 or newer
- Asustor's Docker Engine app (`docker-ce`); App Central installs it as a dependency if you don't have it

## Installing

1. Open **App Central** on your NAS and search for "Youtarr".
2. Install the app. It pulls the official Youtarr Docker image plus a MariaDB database and starts both.
3. Open `http://<your-nas-ip>:3087` in a browser.

### Change the default password first

The package sets the login to `admin` / `admin` through environment variables in its generated compose file, and Youtarr re-applies those on every startup. That has two consequences: the web UI won't offer a "Change Password" option, and anything you change by other means gets reverted on the next restart. To actually change the credentials:

1. Stop Youtarr in App Central.
2. Edit `/share/Docker/Youtarr/docker-compose.yml` and change the values of `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` (password must be 8-64 characters).
3. Start Youtarr again in App Central.

Do this before anything else. Anyone on your network can guess the default, and it's a serious problem if your NAS is reachable from the internet.

One caveat: App Central package updates regenerate the compose file with the default credentials, so you'll need to repeat this edit after each update. Check `docker-compose.yml` after updating.

## Where your data lives

| What | Where |
|------|-------|
| App config, database, and the generated `docker-compose.yml` | `/share/Docker/Youtarr` |
| Generated database passwords | `/share/Docker/Youtarr/secrets.txt` |
| Install log | `/share/Docker/Youtarr/install.log` |
| Downloaded videos | `/share/Download/Youtarr` |

All of this survives app updates. For backups, see the [Backup & Restore guide](../BACKUP_RESTORE.md); the paths above are the ones to back up.

## Updating

**Updates come through App Central only.** The package pins the exact Youtarr version in its docker-compose file, so `docker pull`, Portainer, and similar tools won't move you to a new release; the image tag doesn't change until the package does.

When a new Youtarr version comes out, the package maintainer rebuilds the package, tests it, and submits it to Asustor for approval. That usually takes a day or so, but it's volunteer work, so App Central can lag a bit behind [GitHub releases](https://github.com/DialmasterOrg/Youtarr/releases). When the update shows up in App Central, install it from there; your config, database, and videos are all preserved.

We don't recommend editing the compose file to bump the version yourself. The next App Central update regenerates that file, and if it ships an older version than the one you jumped to, you'd be downgrading against a database that has already migrated forward.

## Getting help

- **Youtarr itself** (downloads failing, features, bugs): [GitHub issues](https://github.com/DialmasterOrg/Youtarr/issues) or the [Discord server](https://discord.gg/68rvWnYMtD)
- **The App Central package** (install or update problems, packaging): the maintainer's [forum-nas.fr thread](https://www.forum-nas.fr/threads/youtarr-outil-auto-h%C3%A9berg%C3%A9-permettant-de-t%C3%A9l%C3%A9charger-automatiquement-les-vid%C3%A9os-de-vos-cha%C3%AEnes-et-playlists-youtube-pr%C3%A9f%C3%A9r%C3%A9es.27016/)
