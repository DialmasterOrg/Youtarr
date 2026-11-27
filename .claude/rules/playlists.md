---
paths:
  - "server/modules/playlistModule.js"
  - "server/modules/playlistDownloadModule.js"
  - "server/modules/playlistDownloadGrouper.js"
  - "server/modules/playlistFilters.js"
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

- `playlistModule.getPlaylistInfo` accepts only a YouTube URL (`youtubeUrlParser.toYoutubeUrl`) or a bare playlist id, which it turns into one: yt-dlp would fetch any other address, including internal ones.
- Every playlist fetch uses yt-dlp's default webpage path, capped at 5000 entries, with an InnerTube fallback on failure or a short result; a separate metadata-only request verifies the total.
- Both playlist yt-dlp calls go through `buildMetadataFetchArgs` and `spawnYtDlp` (cookies, proxy, custom args). With cookies configured the InnerTube fallback adds `skip=authcheck`, which yt-dlp requires for an authenticated jar.
- YouTube reports a private playlist as nonexistent when signed out or when cookies expired, so `PLAYLIST_NOT_FOUND` carries `usedCookies` for the route's wording and skips the InnerTube retry.
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
- An ignore change only sets `playlistvideos.ignored`; `playlistOutputRefresh.scheduleIfListed` rebuilds the m3u and re-syncs 30 s after the playlist's last change, because a sync can take minutes. Videos with no file, or a deleted one, schedule nothing.
- `runPending` starts that waiting refresh early: the page calls it on leaving, and Sync now uses it so the pending timer does not sync a second time. The timer is in memory, so a restart drops it.
- The waiting refresh rechecks `enabled` when it starts, because neither `m3uGenerator` nor `mediaServerSync` does, and a playlist removed meanwhile must keep its outputs unchanged.
- Bulk ignore covers videos the outputs list (a file, or a missing one); the client confirms those first (`isListedInOutputs`), sends at most 1000 ids per request, and the route schedules a refresh only when a row changed.
- The page's selection holds only loaded rows: a sort change or refetch reloads page one alone, and an action on an id that is no longer loaded was silently skipped.
- `usePlaylistDetail.loadMoreFailed` pauses the page's scroll trigger until Retry or a reload: after a failed load the sentinel is still in range, so the trigger re-requested at once for as long as the request failed.
- Explicit-id downloads can override ignored. `following_requested_count` reports eligible outstanding selections in the header without claiming they failed.
- `playlistDownloadGrouper` resolves per-video settings override -> channel -> playlist -> global and groups videos by the result.
- `playlistVideoFilters` orders before pagination and resolves `downloadState`/`watchedState` into a youtube_id constraint; models and `watchStatusQueries` are passed at call time so the route keeps its dependency injection.
- Client feature defaults live in `components/PlaylistPage/playlistConstants.ts`.

## Download filters

- A playlist's `title_filter_regex`, `min_duration` and `max_duration` decide what Youtarr picks, never what is tracked: a refresh stores every available entry, because hiding non-matching ones made a filter change unpredictable and a typo invisible.
- `getTrackedVideos` reports `filteredIds` when given `filterBy`; scheduled discoveries, download-all and the suggested batch leave them out. Explicit ids ignore the filters, and a saved request (`auto_download_requested`) is never filtered.
- The videos listing flags every undownloaded row that fails the filters, so `filtered` rows can outnumber `filtered_count`, which counts only download candidates. Narrowing the flag to candidates made non-matching rows read as tracked.
- Playlist durations are exact seconds (no final-minute grace like channels); the dialog saves a whole-minute maximum as its last second, because API-set values predate the dialog and must keep their meaning.
- `playlistFilters` evaluates titles with Python `re` through `titleFilterRegex`, so a pattern means the same on a playlist and a channel; both playlist routes validate with `channelSettingsModule.validateTitleRegex`.
- A title pattern that cannot be evaluated holds every unrequested video and surfaces as `filter_error`, because downloading everything the filter was meant to keep out is the worse failure.
- A scheduled run that cannot evaluate the filters queues the saved requests, then throws with `queued` set: `playlistAutoDownload` counts those jobs and the playlist as failed, so the sweep never records an idle "found nothing" run.
- Filtered discoveries stay above the baseline, so loosening a filter releases them to later runs; the settings preview reports that count, and "Follow from now" skips them.
- The settings dialog sends only the filter fields that were edited: API-set values predate validation (equal limits, long patterns), and resending one the server now rejects would block saving an unrelated setting.
- A refresh under the open settings form updates only fields the user has not changed: a reset discarded drafts, and stale untouched fields let a save overwrite another session's values. Preview results clear when the shown filters change.
- `ensureSourceChannel` does not copy the filters to auto-created channels: a playlist-specific pattern would silently block the channel if it is later subscribed.

## m3u files and output refresh

- `m3uGenerator`: MP3 Only lists the mp3 and Video Only the video, each falling back to the other file; Video + MP3 writes `<name>.m3u` (videos) and `<name> (MP3).m3u` (mp3s) with no fallback. Channel files follow the same rule.
- Deleted rows (`videoRemovalState.removalState`) are left out of playlist files; missing rows stay listed since their file may return.
- The `(MP3)` file exists only while it has entries. It carries a `#YOUTARR-MP3-LIST:<kind>:<id>` line and is overwritten or removed only when that line names the asker: the path can hold a user's or another subscription's file.
- A playlist's main list is not written over another playlist's marked `(MP3)` file (a playlist really titled `X (MP3)`), and the rebuild returns false: whichever file exists first keeps the name, in both directions.
- `m3uGenerator` queues rebuilds (and channel deletes) per playlist or channel, each reading settings when it starts, because a slow rebuild begun under an older Download Type would otherwise finish last and restore removed files.
- A changed `audio_format` on the playlist settings route rebuilds the files at once, because Download Type decides which files exist; a `sort_order` change still waits for the next rebuild.
- Entries follow the saved `sort_order` ('default' = YouTube playlist order, 'reversed' = flipped). Per-channel `<channel folder>.m3u` files (`m3u_enabled`/`m3u_sort_order`) list only files on disk and carry no `.ignore` marker, so Jellyfin and Emby import them.
- Channel m3u files are regenerated on download completion, in-app deletion, settings changes, channel enable/disable and rescan completion (the scheduled rescan doubles as the periodic refresh); zero entries deletes the file instead of writing an empty playlist.
- `playlistOutputRefresh` rebuilds the m3u and re-syncs media servers for every enabled playlist that includes any of the given videos, one playlist at a time. `videoDeletionModule` calls it in the background after every delete path; downloads use `downloadModule.afterDownloadHook` instead.
