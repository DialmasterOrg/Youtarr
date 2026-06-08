# Media Server Playlists

Youtarr can mirror your subscribed YouTube playlists to Plex, Jellyfin, and Emby as native playlists, plus generate a universal `.m3u` fallback file. This document covers per-server setup, visibility models, and the M3U fallback.

## Overview

When you subscribe to a YouTube playlist:

1. Youtarr fetches the playlist metadata and video list from YouTube via `yt-dlp`.
2. Videos auto-download into the channel folder for their uploader (the channel is auto-created and hidden if it does not already exist).
3. After each download (and after manual downloads of videos that happen to live in a tracked playlist), Youtarr syncs the playlist to every configured media server and regenerates the M3U file.
4. The native server playlists keep the YouTube playlist's order. Partially-downloaded playlists keep their relative ordering — position 1, 3, 5 stay 1, 3, 5; position 2 slots in correctly when it later downloads.

What Youtarr does **not** do for playlists:

- Does not deliver private YouTube playlists. Public and unlisted only (cookies-based auth for private playlists is out of scope for now).
- Does not rename or move existing channel folders when a video is added to a tracked playlist.
- Does not cross-share playlists across multiple Jellyfin/Emby user accounts. Each Youtarr instance uses one configured user per server.

## Per-server setup

### Plex

- **API key**: collected during the standard Plex OAuth flow in Settings → Plex.
- **Playlist visibility scope (advanced)**: under Settings → Plex → "Advanced: playlist visibility scope", a selector controls which account owns Youtarr playlists. It maps to the `plexPlaylistToken` config value:
  - **Use my Plex admin account (default)** — blank/unset; playlist-scoped requests reuse `plexApiKey`. Correct for a normal claimed server.
  - **Unclaimed server (anonymous LAN access)** — stores the sentinel `"UNCLAIMED_SERVER"`; playlist requests are sent with no token, matching the anonymous session Plex Web uses on an unclaimed server. After a Test Connection detects an unclaimed server, this section auto-expands and shows a hint nudging you to pick this option.
  - **A specific Plex user account** — stores that exact token; routes playlists through the chosen account.
- **Visibility / sharing**: on a claimed server, Plex playlists are created under your admin account and are visible only to you. To share one with another user, open the playlist in Plex Web → menu → Share → pick a user. Youtarr cannot grant per-user access programmatically.
- **Self-healing scope changes**: if you change the visibility scope after playlists already exist, the next sync detects that the stored playlist id is no longer visible in the new scope and relocates the playlist: it deletes the stranded copy from its old scope (best-effort across the scopes it knows — current, anonymous, and admin token), then reconciles by name in the new scope (adopting a same-named playlist if one already exists, otherwise creating it). This makes repeated scope switches idempotent rather than piling up duplicates. If the old copy can't be deleted in any known scope, it is left orphaned and logged.

### Jellyfin

1. In Jellyfin, go to **Dashboard → API Keys** and create a new API key for Youtarr.
2. Find your User ID under **Dashboard → Users** (it is a GUID in the URL when editing a user) — or use the **Fetch Users** button in Youtarr's Jellyfin settings to populate the user list and click your account.
3. (Optional) Find the library IDs that hold your Youtarr videos and enter them as a comma-separated list in **Video Library IDs**. Jellyfin returns these as numeric IDs in the URL when browsing a library; this narrows the per-item lookup that resolves a downloaded video to a Jellyfin item.
4. Click **Test Connection** to verify reachability.
5. Toggle **Enable Jellyfin integration** on.

**Visibility**: when a Youtarr playlist is marked **Public**, the underlying Jellyfin playlist sets the `IsPublic` flag, making it visible to all users on the server. Marking it **Private** restricts visibility to the configured user account.

### Emby

The Emby flow mirrors Jellyfin. The two API surfaces share lineage but differ enough that Youtarr ships a separate adapter.

1. In Emby, go to **Settings → Advanced → API Keys** and create a key.
2. Find your User ID via the user-edit URL or the **Fetch Users** helper in Settings.
3. (Optional) Set Video Library IDs to narrow item resolution.
4. **Test Connection**, then toggle **Enable Emby integration**.

Note: Emby's `POST /Playlists` accepts query params with comma-separated `Ids`; Jellyfin's accepts a JSON body with an array. Youtarr's adapter handles both — you don't have to do anything special.

**Visibility**: a **Public** Youtarr playlist is visible to all users on the Emby server; a **Private** one is visible only to the configured user account.

One thing to expect with Public playlists: Emby shows them as read-only and hides the per-user visibility control. That is normal. Youtarr owns these playlists and rewrites them on every sync, so any manual edits would be overwritten anyway.

## Replace semantics

When a playlist's video list changes (new videos downloaded, ignored videos removed), Youtarr re-syncs:

- **Plex**: deletes existing items in place and PUTs the new URI list. Same playlist ID retained.
- **Jellyfin / Emby**: deletes the entire playlist and recreates it. The `playlist_sync_state.server_playlist_id` is updated to point at the new ID. This is required because both servers' `DELETE /Playlists/{id}/Items` returns errors on current versions; full replace is the only reliable path.

If the stored `server_playlist_id` no longer exists on the server (manual deletion, server state drift), the next sync detects the failure, logs a warning, and creates a fresh playlist. Sync is self-healing; no manual database surgery is required.

## M3U fallback

For every tracked playlist, Youtarr writes a `.m3u` file under:

```
<youtubeOutputDirectory>/__playlists__/<sanitized playlist title>.m3u
```

The M3U uses **relative paths** so the file remains valid when the storage volume is mounted at a different host path than where Youtarr writes it. Open it in any media player that understands M3U:

- **VLC**: File → Open File → select the `.m3u`.
- **mpv**: `mpv "/path/to/Athlete Collabs.m3u"`
- **Kodi**: import the M3U as a playlist source.
- **Plex / Jellyfin / Emby**: most clients can also import M3U directly if you do not want to enable the native sync.

The reserved `__playlists__` subfolder is rejected by the channel sub_folder validator so users cannot accidentally collide with it.

## Troubleshooting

- **"Playlist sync failed"**: inspect `playlist_sync_state.last_error` for the specific server. Common causes: stale API key, server moved, user ID changed.
- **Items not appearing in the right order**: confirm the underlying videos are downloaded. Items missing on disk are skipped (not appended later); when they download, the next sync slots them into their correct position.
- **Playlist not visible to other users (Plex)**: this is by design. Plex only exposes admin-created playlists to other accounts via per-user share grants — see "Visibility" above.
