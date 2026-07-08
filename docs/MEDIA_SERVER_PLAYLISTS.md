# Media Server Playlists

Youtarr can mirror your subscribed YouTube playlists to Plex, Jellyfin, and Emby as native playlists, plus generate a universal `.m3u` fallback file. This document covers per-server setup, visibility models, and the M3U fallback.

## Overview

When you subscribe to a YouTube playlist:

1. Youtarr fetches the playlist metadata and video list from YouTube via `yt-dlp`.
2. Videos auto-download into the channel folder for their uploader (the channel is auto-created and hidden if it does not already exist).
3. After each download (and after manual downloads of videos that happen to live in a tracked playlist), Youtarr syncs the playlist to every configured media server and regenerates the M3U file.
4. The native server playlists keep the YouTube playlist's order. Partially-downloaded playlists keep their relative ordering: position 1, 3, 5 stay 1, 3, 5, and position 2 slots in correctly when it later downloads.

What Youtarr does **not** do for playlists:

- Does not deliver private YouTube playlists. Public and unlisted only (cookies-based auth for private playlists is out of scope for now).
- Does not rename or move existing channel folders when a video is added to a tracked playlist.
- Uses a single configured account per Jellyfin/Emby server. A playlist is either private to that account or public to everyone on the server (set the **Public on media servers** toggle); Youtarr can't target a playlist to a specific subset of other users.

## Per-server setup

### Plex

- **API key**: collected during the standard Plex OAuth flow in Settings -> Plex.
- **Playlist visibility scope (advanced)**: under Settings -> Plex -> "Advanced: playlist visibility scope", a selector controls which account owns Youtarr playlists. It maps to the `plexPlaylistToken` config value:
  - **Use my Plex admin account (default)**: blank/unset; playlist-scoped requests reuse `plexApiKey`. Correct for a normal claimed server.
  - **Unclaimed server (anonymous LAN access)**: stores the sentinel `"UNCLAIMED_SERVER"`; playlist requests are sent with no token, matching the anonymous session Plex Web uses on an unclaimed server. After a Test Connection detects an unclaimed server, this section auto-expands and shows a hint nudging you to pick this option.
  - **A specific Plex user account**: stores that exact token; routes playlists through the chosen account.
- **Visibility / sharing**: on a claimed server, Plex playlists are created under your admin account and are visible only to you. To share one with another user, open the playlist in Plex Web (playlist menu -> Share -> pick a user) or use Settings -> Manage Library Access -> [user] -> Media. Youtarr cannot grant per-user access programmatically. Note that shared playlists do **not** show up in the recipient's "Playlists" section - Plex lists them under a separate sidebar source named **Media** (see [Troubleshooting](#troubleshooting)).
- **Self-healing scope changes**: if you change the visibility scope after playlists already exist, the next sync detects that the stored playlist id is no longer visible in the new scope and relocates the playlist: it deletes the stranded copy from its old scope (best-effort across the scopes it knows: current, anonymous, and admin token), then reconciles by name in the new scope (adopting a same-named playlist if one already exists, otherwise creating it). This makes repeated scope switches idempotent rather than piling up duplicates. If the old copy can't be deleted in any known scope, it is left orphaned and logged.

### Jellyfin

1. In Jellyfin, go to **Dashboard -> API Keys** and create a new API key for Youtarr.
2. Find your User ID under **Dashboard -> Users** (it is a GUID in the URL when editing a user), or open the **Jellyfin User** dropdown in Youtarr's Jellyfin settings to load the accounts from your server and pick yours.
3. (Optional) Leave **Video Library IDs** blank. You can enter a comma-separated list of library IDs that hold your Youtarr videos, but Youtarr already matches downloaded videos to Jellyfin items across all your libraries, so this is rarely needed.
4. Click **Test Connection** to verify reachability.
5. Toggle **Enable Jellyfin integration** on.

**Visibility**: when a Youtarr playlist is marked **Public**, the underlying Jellyfin playlist sets the `IsPublic` flag, making it visible to all users on the server. Marking it **Private** restricts visibility to the configured user account.

### Emby

The Emby flow mirrors Jellyfin. The two API surfaces share lineage but differ enough that Youtarr ships a separate adapter.

1. In Emby, go to **Settings -> Advanced -> API Keys** and create a key.
2. Find your User ID via the user-edit URL, or open the **Emby User** dropdown in Settings to load the accounts from your server and pick yours.
3. (Optional) Leave **Video Library IDs** blank; Youtarr matches videos across all your libraries.
4. **Test Connection**, then toggle **Enable Emby integration**.

Note: Emby's `POST /Playlists` accepts query params with comma-separated `Ids`; Jellyfin's accepts a JSON body with an array. Youtarr's adapter handles both, so you don't have to do anything special.

**Visibility**: a **Public** Youtarr playlist is created as a server-wide (shared) Emby playlist that all users can see; a **Private** one is owned by the configured user account only. Emby fixes this when the playlist is created, so flipping Public/Private on a playlist that already exists only takes effect on the next sync that recreates it (see [Replace semantics](#replace-semantics) below).

One thing to expect with Public playlists: Emby shows them as read-only and hides the per-user visibility control. That is normal. Youtarr owns these playlists and rewrites them on every sync, so any manual edits would be overwritten anyway.

## Audio-only playlists

A playlist whose Download Type setting is **MP3 Only** syncs as an *audio* playlist: a music playlist on Plex, `MediaType: Audio` on Jellyfin and Emby. The **setting** decides the type, not what happens to be downloaded: per-video overrides can mix formats, but an MP3 Only playlist always syncs mp3s (items downloaded as **Video + MP3** contribute their mp3 too), and every other playlist always syncs video files. For the sync to find the files, your media server needs a music-type library that includes the Youtarr output directory:

- **Plex**: create a **Music** library pointing at your Youtarr output folder. A video library and a music library can point at the same folder; each scanner only indexes its own media type. Channel folders will show up as "artists" in the music library, which is cosmetic.
- **Jellyfin / Emby**: add a **Music** library (or a mixed-content library on Jellyfin) that includes the output folder.

Point the music library at the **whole** output directory, not at a single subfolder: a playlist's files can land in different channel subfolders, because channel download settings take precedence over playlist settings.

When Youtarr syncs an audio playlist it asks the server to scan its music libraries first (on Plex, every music-type library gets a scan request), then waits for the new tracks to be indexed. A first-ever scan of a very large music library can take longer than one sync attempt waits (about a minute); if that happens the sync defers, and the next sync - or a manual **Sync now** - picks the tracks up.

Two more things to know:

- Media servers cannot mix video and audio in one playlist, so items downloaded without a file of the playlist's type are left out of the synced playlist: a video-only download never appears in an MP3 Only playlist, and an mp3-only download never appears in a video playlist. The playlist page shows a notice with the count of affected items.
- The `.m3u` fallback file always lists every downloaded item regardless of type or media server setup; when an item has both files, the `.m3u` uses the one matching the playlist's type.

**Where to find them**: media servers list audio playlists separately from video playlists. In Plex Web, look in your music library's **Playlists** tab, or open **Playlists** in the sidebar and switch the type filter to **Music**; synced audio playlists do not appear alongside your video playlists.

## Switching a playlist's download type

Changing a playlist's **Download Type** across the video/audio boundary (to or from **MP3 Only**) changes what its media-server playlist is:

- **To MP3 Only**: on the next sync with at least one mp3 available, servers replace the synced video playlist with a music playlist. Items downloaded as **Video + MP3** carry over (their mp3 is used); items downloaded as video-only drop out. Until an mp3 exists, the old video playlist is left untouched.
- **From MP3 Only**: the mirror image - the music playlist is replaced by a video playlist once a video file exists, and mp3-only items drop out.

Existing downloads are never converted or re-downloaded when the setting changes; new downloads simply follow the new setting. Switching back later restores the other type's items, since the files stay on disk. Items that dropped out of the synced playlist always remain in the `.m3u` file, and switching between **Video Only** and **Video + MP3** has no effect on the synced playlist's type.

## Replace semantics

When a playlist's video list changes (new videos downloaded, ignored videos removed), Youtarr re-syncs:

- **Plex**: deletes existing items in place and PUTs the new URI list. Same playlist ID retained.
- **Jellyfin / Emby**: deletes the entire playlist and recreates it. The `playlist_sync_state.server_playlist_id` is updated to point at the new ID. This is required because both servers' `DELETE /Playlists/{id}/Items` returns errors on current versions; full replace is the only reliable path.

If the stored `server_playlist_id` no longer exists on the server (manual deletion, server state drift), the next sync detects the failure, logs a warning, and creates a fresh playlist. Sync is self-healing; no manual database surgery is required.

## Removing a playlist

Removing a playlist in Youtarr (trashcan icon on the Subscriptions page) is a soft delete: it stops auto-downloads, hides the playlist from the UI and API, and stops future syncs. It does **not** delete downloaded videos, does not remove the playlist from your media server (delete it there directly if you want it gone), and does not delete the `.m3u` file. Re-adding the same playlist later restores it with its previous settings and download history intact.

## M3U fallback

For every tracked playlist, Youtarr writes a `.m3u` file under:

```
<youtubeOutputDirectory>/__playlists__/<sanitized playlist title>.m3u
```

The M3U uses **relative paths** so the file remains valid when the storage volume is mounted at a different host path than where Youtarr writes it. Open it in any media player that understands M3U:

- **VLC**: File -> Open File -> select the `.m3u`.
- **mpv**: `mpv "/path/to/Athlete Collabs.m3u"`
- **Kodi**: import the M3U as a playlist source.
- **Plex / Jellyfin / Emby**: most clients can also import M3U directly if you do not want to enable the native sync.

The reserved `__playlists__` subfolder is rejected by the channel sub_folder validator so users cannot accidentally collide with it.

## Troubleshooting

- **"Playlist sync failed"**: inspect `playlist_sync_state.last_error` for the specific server. Common causes: stale API key, server moved, user ID changed.
- **Items not appearing in the right order**: confirm the underlying videos are downloaded. Items missing on disk are skipped (not appended later); when they download, the next sync slots them into their correct position.
- **One item missing from a synced playlist / logs say "not found on server, skipping"**: the file downloaded but the media server never indexed it, so sync cannot add it. On Plex for Windows the usual cause is the 260-character path limit; see [Video Downloads Fine but Never Appears in Plex](TROUBLESHOOTING.md#video-downloads-fine-but-never-appears-in-plex-windows-path-length). Once the file is visible in the server's library, the next sync (or **Sync now**) picks it up.
- **Playlist not visible to other users (Plex)**: this is by design. Plex only exposes admin-created playlists to other accounts via per-user share grants; see "Visibility" above.
- **Shared playlists don't appear for other users (Plex)**: after you share a playlist (the grant shows correctly under Settings -> Manage Library Access -> [user] -> Media), the recipient's **Playlists** section still shows '"Playlists" is empty' on every client. This is long-standing Plex behavior: the Playlists source only lists playlists the user created themselves, and playlists shared by another account appear under a separate sidebar source named **Media** (same level as Playlists and Libraries). Have the recipient open **Media**; the shared playlists are there. Also note: sharing a playlist does not grant access to the underlying library (share the library too, or items will be hidden), and content-rating parental restrictions hide YouTube videos because they carry no rating - use label-based restrictions for kid accounts instead.
- **Audio playlist never appears / logs say "downloaded audio files were not found on the server"**: first check that you are looking in the right place - audio playlists are listed with music playlists (in Plex: the music library's Playlists tab, or the Playlists sidebar with the type filter set to Music), not alongside video playlists. If it is genuinely absent, the server has no music-type library covering the downloaded mp3s. See [Audio-only playlists](#audio-only-playlists).
