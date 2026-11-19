---
paths:
  - "server/modules/reorganize/**/*"
  - "server/routes/tvReorganize.js"
  - "server/models/tvreorganizeoperation.js"
  - "server/models/tvreorganizeitem.js"
  - "server/models/watchstatushold.js"
  - "server/modules/mediaServers/watchStatusHolds.js"
  - "server/modules/mediaServers/watchStatusPushBack.js"
  - "server/modules/mediaServers/watchStateCompare.js"
  - "server/modules/sidecarWriter.js"
  - "server/modules/videoInfoStore.js"
  - "client/src/components/shared/Reorganize/**/*"
  - "client/src/components/layout/ReorganizeBanner.tsx"
  - "client/src/components/Configuration/hooks/useWatchStateHolds.ts"
  - "client/src/components/Configuration/sections/components/WatchStateRestores.tsx"
  - "client/src/types/reorganize.ts"
---

# Reorganize

Moving downloaded files when a channel, a library folder or the default folder switches between the Videos and TV layouts, when a TV channel moves to another TV folder, when a title show change moves downloads, or when the main folder is emptied; and the watch state it protects on media servers.

## Preview and apply

- `POST /api/tv/reorganize/preview` is the dry run. Its `revision` is a sha256 over the change, the planned show locations and each source's size and mtime; it lists at most 200 moves but its totals are complete.
- `POST /api/tv/reorganize` recomputes the plan under the lock and refuses a stale token (409 `STALE_PREVIEW`).
- Apply writes the settings change and pins the shows at the start, so queued downloads already see the new layout. Files move in the background; the change is rolled back only when no video's files reached their destination.
- A plan with nothing to move is applied as a bare settings change, unless its videos could not be planned at all (`planner.applyRefusal`: `blocked.reason` `problems`, 409 on apply); missing files are excepted.
- A `titleShows` change writes the show definitions and every classification row of the channel at the start, with a `titleSnapshot` in `settings_change` that is restored (deleting the shows the change created) when no video moved.
- That change marks the operation applied inside its own write transaction, so a restart never replays shows it created.
- `titleTargets` keeps episodes of active title shows in place for every other change type, and a folder holding title shows cannot switch to Videos (400).
- Title shows are planned under show keys `title:<id>`/`new:<n>`, channel shows under their owner's channel id. `titleAssignments` numbers videos moving into a title show from the stored info.json, as the post-processor would.

## Planning

- `changeScope`: a channel's rows by channel id, by classified episode and by path under its folder; a folder's rows by path, owners from the channel folder or the episode's classification.
- `showPlanner`: a moving channel takes its show; in a folder switching to TV an existing show elsewhere keeps its location. Folder names are planned exactly through `showStore.planChannelShowFolder`.
- `destinationPlanner` reads each source directory once per plan, indexed by video id, since a flat channel folder holds thousands of files. Every destination is checked to stay inside the downloads folder (`unsafe-name` problem).
- Episode numbers are planned as the post-processor gives them, keeping a number the video holds. Movie-style channel folders come from `folder_name` or the rendered name, never the raw uploader.
- `movieNameRenderer` renders the global template's folder and stem through one batched `yt-dlp --load-info-json` per 200 videos, with `formats` stripped and the download's naming options.

## Lock

- `reorganizeLock` is dependency-free. While it is held `jobModule` keeps download jobs Pending (in `addOrUpdateJob` and `_startNextJob`) and restarts the queue on release.
- `scheduledTaskManager.setExclusiveBlocker` refuses the rescan, library repair, auto-removal, watch sync and yt-dlp update while it is held, scheduled occurrences included; the startup rescan and library repair skip.
- `DELETE /api/videos` and channel settings saves of covered videos and channels get 409; media-server playlist syncs are deferred and replayed on release.

## Running an operation

- `operationStore` (`tv_reorganize_operations`, `tv_reorganize_items`) is resumed at startup by `recoverInterrupted`, which waits up to 30 minutes for startup work and otherwise closes the operation as unfinished for Retry.
- `operationRunner` re-checks its preconditions after the plan, since a job may have started meanwhile. Retry covers failed and never-reached items unless a newer reorganize covers the channels.
- Watch-state holds are released in `finally` for videos whose files stayed.
- `itemExecutor` handles one video and is safe to repeat: the episode number first, then every file through `filesystem.moveFileNoClobber`. On a failure every file at its destination goes back, so the video is moved or home, never split.
- A sidecar gone since the preview is skipped; the media file is not.
- The move error says where the files are: `filesMoved` true (a file could not be brought back, or the failure came after the move), false (verified back at their sources), unset (the attempt never reached them).
- `files_moved` on the item is set or cleared only on a definite answer, so a video counts as moved (settings kept, holds kept) exactly when its files are, and Retry finishes it.
- `moveFileNoClobber` renames; across filesystems it copies to `.reorganize.part` and renames into place before the source goes. It retries a rename on `EBUSY`.
- An earlier interrupted copy is finished or cleaned, but never for two paths that differ only in case or accents, which may be one file on a filesystem whose inode numbers vary by spelling.
- A matching destination (size and mtime) counts as an interrupted copy across filesystems; on the same device (`stat.dev`, which two mounts of one filesystem share) only when the contents compare equal, else EEXIST.
- The videos row is written through `videoRowGuard`, and the `_actual_*` paths in `jobs/info` through `videoInfoStore`, which falls back to the videos row when the info.json is gone.
- `followUp` covers every done item of the operation, earlier runs included. Inside the lock: `tvshow.nfo` and art, channel art, emptied channel and show folders, channel `.m3u`.
- After the lock: `__playlists__` m3u, media-server playlist re-sync for moved videos, Plex refresh of the old and new folders, Jellyfin and Emby refresh, and the watch-state push-back.
- The playlist re-sync repeats 5 and 15 minutes later (`PLAYLIST_RESYNC_DELAYS_MS`), because a move that keeps file names first resolves to the stale item at the old path.
- `followUp` removes Youtarr's `tvshow.nfo` from a folder that receives movie-style videos: a show folder that is a channel folder again.
- `sidecarWriter` writes a video's NFO (episode NFO always, movie NFO when enabled), fanart and backdrop copies, and channel or show art at its current path from the stored info.

## Main folder move

- `mainFolderMove` moves every non-removed row whose video file or MP3 is in the main folder into its owner channel's folder after the change; only the files in the main folder move.
- The target is a Videos folder (`Videos`, else `Videos 2` and so on) for channels that named the main folder or followed a main-folder default, and for untracked downloads. An existing folder is merged per file, never overwriting.
- Items are `relocate`: relative paths and names are kept, with no yt-dlp rendering or info.json reads, and the NFO moves as a file.
- A stored path with no file behind it is cleared with its size and resolution, as the rescan would, instead of leaving the row missing and the main folder in use.
- Channels and playlists naming the main folder, and a main-folder default, are switched in one transaction with compare-and-set rows and a compensated config write. Their channel `.m3u` files are removed first and written again on rollback.
- The preview's `leftInMain` lists files under the main folder no move takes. An unreadable folder, or the walk's entry limit, sets `truncated`, so the count is a lower bound.
- While the main folder is in use (Videos layout, enabled channels or playlists saving there, or downloads in it), creating a TV folder or switching a subfolder to TV is refused with a `reorganizeRequired` 409 for `mainFolderMove` (`libraryFolders.assertMainFolderClear`).

## Watch state holds

- Before files move, each watched or in-progress `video_watch_status` row is snapshotted into `watch_status_holds`. For Plex only the owner: other accounts come from play history, which a move never resets.
- `watchStatusSync` passes every server's matches through `applyHolds`, which drops downgrades of held rows: the moved item looks new and unwatched, and until a rescan the server lists the old path.
- A hold ends when the item at the video's current path shows at least the held state or a newer one.
- That item must match the current path with more trailing segments than `fromPath`, because between TV folders the stale item shares the show, season and file names.
- A push stamps the server item with the push time, so a last-watched time within 10 minutes of `last_pushed_at` is that echo, not a watch: the row keeps its historical play count and last-watched time.
- Restored holds are consulted for the echo check too, and a later real watch is written as is. An attempt that found the state already there writes nothing and leaves no echo.
- Re-holding a row for a later reorganize resets its push record, since the earlier push went to the earlier location.
- Push-back first reads the item's state (`getWatchState`) and leaves alone a state at least as watched, or watched since the snapshot (`watchStateCompare.isAtLeast`/`isLaterWatch`, shared with the sync).
- `resolveItemMatchesByPaths` skips an item only when the same item answers for both the new and the old path and fits the old one at least as well: the stale item before a rescan. An explicit retry takes whatever matches.
- A hold is pushed once, and again only when a sync finds the item at the new path below the held state, since a blind re-push could undo a watch made in between.
- Push-back runs 1, 5 and 15 minutes after a reorganize and at the end of every sync, an hour apart per hold.
- Holds not restored within 14 days become failed but still protect the row until retried or dismissed (`GET /api/tv/holds`, `POST /api/tv/holds/:id/retry|dismiss`).

## Client

- `reorganizeErrors` turns a `reorganizeRequired` refusal into a `ReorganizeRequiredError` carrying the change; whoever caught it opens the shared `ReorganizeDialog`.
- `useReorganizePreview` computes the preview again every 5 s while a task that ends on its own blocks it.
- The opener saves the folder optimistically when the move starts (`onApplied`), then reads the saved folder back at each run end (`useReorganizeOutcome`, once per `finishedAt`).
- That read-back is needed because the server undoes the change when nothing moved and applies it again when a retry moves some.
