---
paths:
  - "server/modules/playlistModule.js"
  - "server/modules/playlistDownloadModule.js"
  - "server/modules/playlistDownloadGrouper.js"
  - "server/modules/playlistVideoFilters.js"
  - "server/modules/playlistConstants.js"
  - "server/modules/playlistOutputRefresh.js"
  - "server/modules/m3uGenerator.js"
  - "server/routes/playlists.js"
  - "server/routes/playlistSubscribeSettings.js"
  - "client/src/components/PlaylistPage.tsx"
  - "client/src/components/PlaylistPage/**/*"
  - "client/src/hooks/usePlaylist*.ts"
---

# Playlists

YouTube playlist following, playlist downloads, and the `.m3u` files.

## Following and refresh

- Every playlist fetch uses yt-dlp's default webpage path, capped at 5000 entries, with an InnerTube fallback on failure or a short result; a separate metadata-only request verifies the total.
- Missing or conflicting totals and partial snapshots cannot initialize or reset following, or prune tracked rows.
- Following setup above 5000 entries returns 422, an unverifiable snapshot 503, and a concurrent refresh 409 (shared text and limits in `playlistConstants.js`).
- First enable follows future discoveries only; an older auto-enabled playlist without a cutoff initializes the same way on its first successful sweep, without seeding a batch. Existing cutoffs survive upgrades.
- New baselines capture the highest tracked row id after refresh; legacy timestamp cutoffs still use the preserved `added_at`.
- `refreshForFollowing` owns refresh and reload for subscribe, first enable, explicit reset and scheduled downloads. Only an explicit reset clears saved batch requests, and it preserves the paused/running state.
- `first_seen_at` is immutable discovery; `downloaded_at` is the actual download time, set during reconciliation. Removal is a soft delete (`enabled=false`) and re-subscribe restores saved settings. An idle successful sweep records one empty Complete 'Playlist Downloads' job.
- First-setup recovery persists `playlists.auto_download_setup_error`: legacy incomplete snapshots stay enabled and retry with a waiting notice; oversized playlists are disabled with an explanation. Successful setup clears the error.
- Recovery refreshes the cache without setting a baseline or clearing requests and never counts as a successful idle sweep.
- Subscribe and restore return 201 with a warning for expected following failures, disable auto-download for size or completeness failures, and preserve settings on a concurrent refresh; warnings travel through the subscription hook and router state to the page.

## Download selection

- `playlistDownloadModule` is the one eligibility rule for the scheduled, download-all, explicit-id, preview, batch and count paths, with dependencies passed at call time.
- Requests persist for scheduled retry only when auto-download is enabled and a baseline exists; a successful download clears its request flags; queue failures are logged with playlist id and selected count.
- Scheduled selection returns disjoint discovery and older saved-retry pools, each capped at the configured limit; requested discoveries belong only to the discovery pool, and discovery jobs are admitted before any retry group. Retry jobs are `Playlist Retry: <title>`.
- Older requests rotate by `playlistvideos.auto_download_last_attempt_at`, recorded before queue submission (explicit saved batches and scheduled retry selection), outside the pure selector; null attempts stay in the bounded pool. The original batch queues in full.
- Already-active entries (queued or downloading, per `videoActivity`) are excluded before selection.
- Without allowRedownload, entries the archive lists without a Videos row (`archiveOnlyIds.findArchiveOnlyIds`; channel-ignored videos excepted, since a download removes their entry) are not eligible on any path: yt-dlp would skip them, so a sweep would queue them again every run.
- Explicit-id downloads can override ignored. `following_requested_count` reports eligible outstanding selections in the header without claiming they failed.
- `playlistDownloadGrouper` resolves per-video settings override -> channel -> playlist -> global and groups videos by the result.
- `playlistVideoFilters` orders before pagination and resolves `downloadState`/`watchedState` into a youtube_id constraint; models and `watchStatusQueries` are passed at call time so the route keeps its dependency injection.
- Playlist title filters are case-insensitive JavaScript regexes (`playlistModule.buildTitleFilterRegExp`); the settings route rejects patterns it cannot compile. Client feature defaults live in `components/PlaylistPage/playlistConstants.ts`.

## m3u files and output refresh

- `m3uGenerator` writes `__playlists__/*.m3u`: entries prefer the file matching the playlist's Download Type (mp3 for MP3 Only, video otherwise) and fall back to the other; deleted rows (`videoRemovalState.removalState`) are left out, missing rows stay listed since their file may return.
- Entries follow the saved `sort_order` ('default' = YouTube playlist order, 'reversed' = flipped). Per-channel `<channel folder>.m3u` files (`m3u_enabled`/`m3u_sort_order`) list only files on disk and carry no `.ignore` marker, so Jellyfin and Emby import them.
- Channel m3u files are regenerated on download completion, in-app deletion, settings changes, channel enable/disable and rescan completion (the scheduled rescan doubles as the periodic refresh); zero entries deletes the file instead of writing an empty playlist.
- `playlistOutputRefresh` rebuilds the m3u and re-syncs media servers for every enabled playlist that includes any of the given videos, one playlist at a time. `videoDeletionModule` calls it in the background after every delete path; downloads use `downloadModule.afterDownloadHook` instead.
