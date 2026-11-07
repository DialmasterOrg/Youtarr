---
paths:
  - "server/modules/mediaServers/**/*"
  - "server/modules/plexModule.js"
  - "server/modules/nfoGenerator.js"
  - "server/routes/mediaServers.js"
  - "server/routes/plex.js"
  - "client/src/components/Configuration/sections/WatchStatusSection.tsx"
  - "client/src/components/Configuration/hooks/useWatchStatusSync.ts"
---

# Media servers

Plex, Jellyfin and Emby: library refresh, native playlist sync, and watch status sync.

- Plex login uses OAuth and must be the server admin; an unclaimed server has no accounts and runs anonymously. A library scan is triggered after downloads.
- "Other Videos" with the "Personal Media" agent is the documented baseline, not an enforced requirement: `plexAdapter` also lists TV-type sections for video and Music sections for audio playlists.
- Jellyfin 12.1 and Emby 4.10.1 (tested 2026-10-03) leave a library empty when its folder sits inside another library's folder, so a root library breaks per-subfolder ones. Jellyfin logs `Found duplicate path`; Plex shows the files in both.
- `serverRegistry` + `adapters/` (`plexAdapter`, `jellyfinAdapter`, `embyAdapter`, `baseAdapter`) wrap each server's REST API; `mediaServerSync` decides which adapters apply to a playlist and updates `playlist_sync_state`.

## Playlist sync

- Playlists are media-typed by the Download Type SETTING, not by what is on disk: an MP3 Only playlist syncs as audio using `Video.audioFilePath` (Plex resolves tracks by listing artist sections with type=10); others sync `Video.filePath` in the saved `sort_order`.
- Items lacking a file of the playlist's type are left out (`unsyncable_count` on the detail route, shown only while the playlist syncs to a server), as are deleted rows; missing rows still sync, since their file may come back.
- With zero resolved items the sync defers instead of creating or emptying a server playlist, except a deliberately emptied playlist (every video ignored, or none with a file left) with an existing server playlist, which is emptied.
- `replacePlaylistItems` never creates an empty playlist: Jellyfin/Emby (replace = delete + recreate) delete it and return `{ id: null }`, which clears `playlist_sync_state.server_playlist_id` so the next sync with items creates a fresh one.
- Plex empties in place when the stored id is visible in its current scope. Otherwise it deletes the stranded copy, then adopts a same-named playlist or, with no items, returns `{ id: null }`.
- Audio syncs trigger a scan of Plex's music sections before resolving; video sections rely on the post-download refresh; Jellyfin/Emby refresh all libraries in one call.

## Watch status sync

- `watchStatusSync` pulls per-video, per-user state through the adapters' `fetchWatchStates()` contract `{ entries, users }` and upserts `video_watch_status` keyed (video, server, user) plus the `media_server_users` name directory. Only items actually returned are written: a missing row means unknown, never unwatched.
- Matching is by the trailing `[<youtube-id>].<ext>` filename token, else the exact `filePath` basename; a video matches all user entries of its best-scoring path. Missing and removed videos still sync: their file may live on in a server library.
- Jellyfin/Emby list every user via /Users plus per-user /Items, asking only for played (`isPlayed=true`) and in-progress (`filters=IsResumable`) items, paged, because a whole-library listing outlasts the 30 s request timeout.
- Users listed in full are reported as `completeUserIds`, never a user whose paging repeated a page.
- For those listings a present video (not `removed`) takes only a match sharing its file's parent folder whenever the server shows Youtarr's layout (any match does); a server with its own layout still matches everything.
- That parent-folder rule keeps a watched stale copy, or another channel's same-named legacy file, from standing in for an unwatched current copy.
- For complete users the sync also resets stored watched or in-progress rows no listed item matched (unwatched on the server) to the server's unwatched values; rows holding only a play count or last-watched time are never listed and stay.
- Plex reads the owner account from section listings (account id '1'; anonymous session on unclaimed servers) and every other account from the server-local play history endpoint: played-only fidelity, incremental via a viewedAt watermark from stored rows.
- Per-server all-users toggles (`plexWatchStatusAllUsers`, `jellyfinWatchStatusAllUsers`, `embyWatchStatusAllUsers`) default on. Video files only.
- `watchStatusQueries` is the stateless read side: `getWatchedByMap()` honors `watchStatusWatchedRule` ('any' default, 'primary' = owner plus configured user); `buildWatchedExistsSql()` is the same rule as a raw-SQL EXISTS fragment for videosModule's paginated listing; `getStatusesForVideo()` shapes the modal rows.
- `buildWatchedEligibilitySql` feeds auto-removal's watched strategy; a qualifying played row with a NULL `last_watched_at` blocks days-since-watched removal. Listing filters (`watchedFilter` off/only/exclude; the playlist route's `watchedState`) always count unknown and never-synced videos as unwatched.
- `watchStatusScheduler` is a config-driven cron (`watchStatusSyncEnabled`, `watchStatusSyncFrequency`, default every 4 hours) that reschedules on config change.
