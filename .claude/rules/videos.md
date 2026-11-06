---
paths:
  - "server/modules/filesystem/**/*"
  - "server/modules/videosModule.js"
  - "server/modules/videoMetadataModule.js"
  - "server/modules/videoDownloadPostProcessFiles.js"
  - "server/modules/nfoGenerator.js"
  - "server/modules/rescanRowUpdate.js"
  - "server/modules/rescanRunSummary.js"
  - "server/modules/videoRowGuard.js"
  - "server/modules/videoRemovalState.js"
  - "server/modules/libraryRootCheck.js"
  - "server/modules/videoTrashModule.js"
  - "server/modules/videoDeletionModule.js"
  - "server/modules/autoRemovalQueries.js"
  - "server/modules/fileCheckModule.js"
  - "server/modules/archiveModule.js"
  - "server/modules/videoOembedEnricher.js"
  - "server/modules/subfolderModule.js"
  - "server/modules/infoJsonSlimmer.js"
  - "server/modules/infoJsonCachePruner.js"
  - "server/routes/videos.js"
  - "server/routes/videoTrash.js"
  - "server/routes/maintenance.js"
  - "server/routes/subfolders.js"
  - "client/src/components/VideosPage/**/*"
  - "client/src/components/Settings/MaintenanceSection.tsx"
  - "client/src/components/Settings/components/**/*"
  - "client/src/components/Settings/hooks/**/*"
  - "client/src/components/shared/VideoModal/**/*"
  - "client/src/utils/videoRemoval.ts"
  - "client/src/utils/videoStatus.tsx"
---

# Videos and the library

Listing, the filesystem rescan, library repair, deleted vs. missing videos, the trash, automatic removal, and the info.json cache. Search and single-video lookup are in `.claude/rules/video-search.md`.

## Rescan and library repair

- The rescan (`videosModule.backfillVideoMetadata`) walks the disk once and reads rows in chunks, so downloads and deletions in between make the walk stale. The walk only nominates rows (`isRescanCandidate`); `rescanRowUpdate.resolveRescanUpdate` recomputes each write from a fresh per-format stat.
- Per-format stat: present only for a regular file; missing on `ENOENT`, `ENOTDIR` or a non-file; unknown on any other error.
- Both formats missing marks the row missing and keeps its stored paths; a missing format is cleared only when the other is present; any present format means `removed: false` even if the other is unknown.
- An unknown format is never cleared, and with nothing present an unknown writes nothing. The write lands only if the row is unchanged since read (`videoRowGuard.unchangedSinceRead`: removed, both paths and sizes, `video_resolution`, `last_downloaded_at`).
- Zero affected rows means a conflict only when the write includes a column that really differs: Sequelize's MySQL dialect connects with -FOUND_ROWS, so mysql2 counts changed rows, not matched rows.
- Rows left as recorded count as `kept` (`videosKept` in the run details), unreadable folders and files as `unreadableOnDisk` (re-checked by path next run), rows another writer changed as `skippedChanged` (`videosSkipped`), failed writes as `failed` (`videosFailed`).
- Failed writes make a finished scan `error`/`partial`; a timed-out scan stays `timed-out` so Maintenance can continue it.
- The completion `rescanStatus` broadcast is built through the same `rescanRunSummary` record as the run history, so the live Maintenance view matches it.
- Library repair (`jobModule.backfillFromCompleteList`) uses the same guard: it reads the row before searching the disk and writes file details and `removed: false` only for a file it actually found.
- A lost row's files are looked up by YouTube id with one `videosModule.scanForVideoFiles` walk per run (only when a lost row exists; video and audio, any folder layout), recreating it as missing when the walk finds nothing.
- The walk skips and counts (`unreadable`) folders and files it cannot read rather than stopping, logging unreadable files once per folder.
- Repair still recreates unmatched rows as missing after a partial walk, because deferring would block recovery wherever a folder is never readable (lost+found, NAS recycle bins); the next rescan restores a row whose file it finds.
- Such a run records `error`/`partial`, naming the count in its message (`recreatedUnverified` and `unreadableOnDisk` in the details); a partial walk that affected no row stays `completed`.

## Deleted vs. missing (issue #670)

- `videos.removed` stays the single "no file" flag every query reads. `removed_reason` (`user_deleted`; `auto_removal` with the rule in `removed_detail`; `not_found`; `marked_deleted`) and `removed_at` say why. Missing = removed with `not_found`; every other removed row, NULL reason included, is deleted.
- `videoRemovalState.removedColumns(reason)` and `presentColumns()` are the only writers of those columns; `stateWhere`/`notStateWhere` the only filters. The client mirrors the states in `utils/videoRemoval.ts` (`getRemovalState`, `describeRemoval`) and `utils/videoStatus.tsx`.
- Deleted stays deleted: `fileCheckModule` and the rescan only mark present rows missing. A file that reappears clears all three columns in every writer (download persistence, job recovery, library repair, file check, rescan).
- `libraryRootCheck.checkLibraryRoot(baseDir)` guards every `removed: true` write against an unmounted drive or share: the root must exist and hold something, and so must each `__subfolder` in it.
- Reasons: `missing | empty | unreadable | subfolder-empty | subfolder-unreadable`; unreadable beats empty, so an unreadable share is never looked past as emptied on purpose.
- A root failure is reported alone, while every failing subfolder is reported in `paths`. `message` names no path, because the container path means nothing on the host: the root is "the downloads folder" and a subfolder by its name.
- Entries Youtarr creates itself (`.youtarr_tmp`, `__playlists__`, `.youtarr_healthcheck_*`, named in `filesystem/constants.js`) never count, because a sweep or a restart creates them on the bare mount point while a share is down.
- `libraryCheckCoversRows(check, Video, where)` (a `LIKE` on both path columns, wildcards escaped) decides whether a failing check covers any matching row, so an empty `__subfolder` no row is stored in blocks nothing; `isUnderLibraryCheckPath` and `isRowUnderLibraryCheck` cover one file or row.
- The file check runs the check lazily, once per pass and only when a row would be marked missing, holds back the rows it covers, and returns them as `libraryWarning` (`{ reason, path, message, heldBack }`).
- `/getVideos` passes `libraryWarning` through for the Videos page banner; the channel page gets the suppression only. File-check writes carry a `removed` predicate, so a delete landing inside the request is never undone and only a removed row is restored.
- The rescan checks first and only counts a failure covering present rows: a failing root ends the run `error`, an empty or unreadable `__subfolder` holds back its rows (`notMarkedMissing`, outcome `partial`), and with no present rows it runs normally.
- `POST /api/maintenance/rescan-files` with `ignoreLibraryCheck: true` skips the check ("Rescan anyway", offered only for the `empty` reasons); the scheduled task never passes it, and the run record says the check was skipped.
- Automatic cleanup and the orphan folder sweep record a `skipped` run while the check covers present rows (`_libraryBlock`; a dry run never checks; the sweep removes an empty `__subfolder` nothing is stored in, which clears the check).
- Manual deletes (`deleteVideos`, `deleteVideosByYoutubeIds`) refuse each covered video with the message rather than stamping a row whose file may sit on an unmounted share: one check per batch, fail-open if the check itself throws.
- Job recovery likewise leaves the removal columns alone when it cannot find the file.
- `/getVideos` filters: `missingFilter` is strictly missing; `deletedFilter` (default `off`; the Videos page sends `exclude`, remembered in localStorage) hides or isolates deleted rows and returns `hiddenDeletedCount` while excluding. The channel listing takes the same `deletedFilter`.

## Trash (`videoTrashModule`)

- `GET /api/videos/removed-summary` reports the library check as passing when it covers no present or missing row (so the card matches the Videos page banner), `missingActionsBlocked` (it covers missing rows, the only rows the trash touches), and `downloadsActive` from `archiveAccess.isDownloading()`.
- `POST /api/videos/mark-deleted` changes only missing rows, to `marked_deleted`. `all` is refused 409 `library-unavailable` while the check covers missing rows unless `ignoreLibraryCheck: true` and the reason is `empty` or `subfolder-empty` (never `missing` or unreadable); a selection is never refused.
- `POST /api/videos/purge-removed` runs one purge at a time (409 `running`), refuses `missing` while the check covers missing rows (409 `library-unavailable`), and refuses archive removal while a download holds the archive (409 `archive-busy`).
- It works in chunks of 500, each in a transaction: `video_watch_status` and `jobvideos` rows (restricting FK) before the `videos` row, `playlistvideos.downloaded_at` nulled.
- Each purged video's `jobs/info/<id>.info.json` and cached `videothumb-<id>*.jpg` are unlinked, because library repair would otherwise recreate the row as missing from the archive entry plus the info.json. Nothing under the downloads folder is touched.
- `complete.list` lines are removed only when asked (`archiveModule.removeVideosFromArchive`, an atomic file replacement per chunk before the transaction commits); keeping them means automatic downloads keep skipping the videos.
- An archive rewrite failure rolls back that chunk so its rows remain selectable for retry; a commit failure after a successful rewrite is safe to retry, since re-removing absent entries is harmless.
- Earlier committed chunks still get the job reload and broadcasts before a chunk's error is rethrown.
- Each chunk is re-read under lock with the state predicate inside its transaction, so a video re-downloaded or restored between the select and the delete is kept and its fresh info.json left alone.
- Affected in-memory jobs are refreshed through the injected `jobModule.reloadJobVideos` (the route hands it in) before `videosUpdated` + `jobsUpdated` broadcast, so a Download History refetch never shows ghosts.
- `RemovedVideosCard` keeps "Mark all missing as deleted" available for an empty folder once the user confirms (sending `ignoreLibraryCheck`), so "Rescan anyway" is never a dead end; it is disabled while a rescan runs.

## Automatic removal

- `videoDeletionModule.performAutomaticCleanup` (nightly by default) runs age, watched, free-space and total size (`autoRemovalUsageLimit`, measured by `storageUsage` after the earlier strategies) in that order; free-space and total size share the oldest-first `_removeOldestUntilFreed` loop, which never retries a failed deletion.
- Every strategy excludes protected videos, videos of enabled channels with `auto_removal_protected`, and the N most recently downloaded unprotected videos when `autoRemovalKeepRecentCount` or a channel's `auto_removal_keep_recent_count` is set.
- Those keep-recent guards form one unioned exclusion set; protected videos never consume keep-recent slots, and cleanup aborts (fail-closed) if a guard query fails.
- The watched strategy honors `watchStatusWatchedRule`, treats never-synced videos as unwatched, and is skipped with a warning when watch status sync is disabled.
- `autoRemovalQueries` is read-only: candidate queries LEFT JOIN enabled channels to exclude `auto_removal_protected` ones; watched eligibility SQL comes from `watchStatusQueries.buildWatchedEligibilitySql`.
- Every delete path (manual by id or YouTube id, and each automatic strategy) calls `playlistOutputRefresh` in the background afterwards, so no playlist keeps listing a deleted file.
- `subfolderModule.getAll` is the union of the `subfolders` table, the config default and the Plex-mapping subfolders; `register` idempotently upserts a name; `delete` guards removal against non-empty disk paths and active references.

- `youtubeExistenceCheck` answers `exists`/`removed`/`unknown`; on `unknown` leave `youtube_removed_checked_at` alone, because it is an outage, not a verdict, and the check must run again later (`.claude/rules/server-runtime.md`).

## info.json cache (issue #990)

- Every `jobs/info/<id>.info.json` writer (the post-processor, `videoMetadataModule.getVideoMetadata` on modal open, `videosModule.bulkUpdateVideoRatings`) passes yt-dlp's output through `infoJsonSlimmer.slimInfoJson`, which drops `automatic_captions`: nothing reads it, and it is about 90% of each file.
- `subtitles` (sidecar pruner) and `formats` (available resolutions) stay. Files already on disk are rewritten, and so slimmed, only by a rating change.
- `infoJsonCachePruner` runs after every rescan and unlinks `<11-char id>.info.json` files older than 21 days whose id has no Videos row and is not in `complete.list`, since library repair rebuilds a lost row from the archive entry plus this file.
- A file's age is its modification time, set by a fetch, a download, or a rating change (which only reaches videos with a row, so it never keeps an untracked file alive).
- The pruner reads the archive through `archiveModule.readCompleteListLines`, not `filterArchivedVideoIds`, which treats an unreadable archive as empty and would let it delete what repair needs; a failed lookup rejects the run and removes nothing.
- Each file's age is checked again right before its unlink, because a download finishing in between rewrites the file and `videoMetadataProcessor` still needs it; a file that vanished since the listing counts as gone, not failed.
- The rating change is the only NFO writer besides the post-processor: it keeps `<dateadded>` (`nfoGenerator.readDateAdded`, else `last_downloaded_at`; Jellyfin takes DateCreated from it), reaches MP3-only rows through `audioFilePath`, honors `writeVideoNfoFiles`, and skips removed rows.
- A file problem during the rating change is reported as a warning on an id that still counts as a success, since the row is the source of truth; the Videos page shows neither warnings nor failures yet.
