---
paths:
  - "server/modules/download/**/*"
  - "server/modules/downloadModule.js"
  - "server/modules/jobModule.js"
  - "server/modules/jobAuxData.js"
  - "server/modules/ytdlpModule.js"
  - "server/modules/ytdlpProcess.js"
  - "server/modules/ytDlpRunner.js"
  - "server/modules/ytdlpUpdateRunSummary.js"
  - "server/modules/storageGuard.js"
  - "server/modules/storageUsage.js"
  - "server/modules/archiveModule.js"
  - "server/modules/archiveOnlyIds.js"
  - "server/modules/manualDownloadGrouper.js"
  - "server/modules/channelDownloadGrouper.js"
  - "server/modules/videoPersistence.js"
  - "server/modules/videoDownloadPostProcessFiles.js"
  - "server/modules/videoValidationModule.js"
  - "server/modules/youtubeUrlParser.js"
  - "server/modules/resolutionTier.js"
  - "server/modules/channel/autoDownloadScheduler.js"
  - "server/modules/channel/sweepCompletion.js"
  - "server/modules/channel/sweepRunSummary.js"
  - "server/routes/jobs.js"
  - "server/routes/videos.js"
  - "server/routes/ytdlpOptions.js"
  - "client/src/components/DownloadManager.tsx"
  - "client/src/components/DownloadManager/**/*"
  - "client/src/providers/VideoActivityProvider.tsx"
  - "client/src/utils/jobTypeLabel.ts"
  - "client/src/hooks/useLocalVideoStatus.ts"
  - "client/src/utils/videoResolution.ts"
  - "client/src/hooks/useDownloadPauseStatus.ts"
  - "client/src/components/layout/DownloadPauseBanner.tsx"
  - "client/src/components/shared/DownloadPauseAlert.tsx"
---

# Downloads

yt-dlp runs, the job queue, the download archive, storage limits, and the activity page; cookie files are in `.claude/rules/cookies.md`. Each bullet is a behavior a reader of the code would not expect, with its reason.

## Jobs and the queue

- yt-dlp writes to a temp location; the per-video post-processor finalizes files into the target directory. Manual jobs always download nested to temp, and the post-processor resolves flat-vs-subfolder per video from its real channel at finalize.
- `jobModule.startNextJob` coalesces overlapping calls into one in-flight scan: the storage guard's `resumed` event fires inside a refresh a scan awaits, and a channel job stays Pending while it builds groups, so two scans would start it twice.
- A job whose action rejects while still Pending is marked `Error` by `jobModule.failUnstartedJob`, which waits for the launching scan to settle and scans again, so the queue never stalls behind it.
- `subscriptionImport` calls `startNextJob` when an import finishes: the import occupies the queue but completes outside the download path, so jobs queued meanwhile would otherwise stay Pending.
- `jobAuxData` persists job.data minus videos (failed downloads, diagnoses, skip counts) in `Jobs.aux_data` at save and merges it back on startup load, so Download History detail survives restarts; failedVideos are capped at 1000.
- `Channel Download All: <title>` jobs are exempt from the 6-hour absolute runtime cap, since large channels take days; the 30-minute activity timeout remains the hang guard.
- `manualDownloadGrouper` buckets pasted URLs by resolved per-channel resolution and audio format. Attribution prefers the channelId captured at URL validation (server cache over the client echo), then `videos.channel_id`, then channelvideos listers, gated to tracked, enabled channels.
- Multi-bucket pastes share one `downloadRunTracker` run labeled 'Manual downloads'. `youtubeUrlParser` is the one YouTube URL to video-id parser, shared with `videoValidationModule`.
- `jobModule.onJobEnded` fires for every final status and `onJobAbandoned` for `failUnstartedJob`; server.js wires both to the run tracker, so jobModule never requires it.
- `jobModule.backfillFromCompleteList` (library repair) follows the rescan rules in `.claude/rules/videos.md`: read the row first, write file details and `removed: false` only for a file actually found, and recreate unmatched rows as missing even after a partial walk.

## Executor and yt-dlp output

- `downloadExecutor` finalizes on the child's `close` event (stdio drained), not `exit`, with a 5 s `STDIO_DRAIN_TIMEOUT_MS` fallback for pipes an orphaned ffmpeg or post-process child holds open.
- `outputDirHealthCheckConfig` (pure) reads `OUTPUT_DIR_HEALTHCHECK_TIMEOUT` (seconds, default 10) once for the executor's pre-download output-directory probe; an invalid value warns and keeps the default. A job failing on the timeout names the variable in its notes; a permission failure does not.
- `YtdlpOutputRouter` classifies complete stderr lines only, holding a split line until its newline; after `dispose()` output is logged but never classified or broadcast. Its 25 s heartbeat rebroadcasts the monitor snapshot while yt-dlp is silent during merges.
- `ytdlpStderrSignals.containsHttp403` ignores yt-dlp's "require a GVS PO Token ... may yield HTTP Error 403" advisory, printed on every free-account cookie run; `isSabrRestriction` matches the account-level SABR warning.
- `YtdlpErrorTracker`: a `WARNING: Unable to download video subtitles` line un-fails the current video, because yt-dlp prints the subtitle ERROR first and still downloads the video under `--ignore-errors`.
- An ERROR between `[info] Writing video subtitles to:` and the first `[download] Destination:` is held as subtitle-only; `YtdlpErrorTracker.dropSubtitleOnlyFailure` (called by `downloadResultProcessor`) turns it into a subtitle failure only when the video file exists.
- `downloadCleanup` runs after a terminated run, a bot-detected run, and any other non-zero exit, because a video whose merge failed leaves its fully downloaded streams in temp, where they can fill the disk before the next job's temp clean.
- After a bot-detected or non-zero-exit run, that cleanup is skipped when the run finalized through the stdio drain fallback, since a post-processor child may still be moving a finished video. A terminated run always cleans.
- `tempSpaceProbe` decides `temp-out-of-space`: explicit "No space left on device", or a `Conversion failed!` whose leftover temp files exceed the temp folder's free space (`fs.statfs`). Measured before any cleanup; never throws.
- `cookiePlayerClients` adds `player_client=default,mweb,web_safari` whenever a cookies file is in play: YouTube's SABR-only experiment strips URLs from logged-in default clients, leaving 360p itag 18.
- yt-dlp keeps only the last `--extractor-args` per extractor key, so that `player_client` is folded into any user `youtube:` token; a user-supplied `player_client` wins.
- `ytdlpCommandBuilder.buildMatchFilters` escapes only `'` and `&` in the channel title regex, because yt-dlp's `match_str` unescapes nothing else; the regex itself is evaluated with Python `re` (`.claude/rules/channels.md`).
- Deno is installed in the container; yt-dlp picks it up from PATH for JS-heavy extractors.

## Finalizer, retries, diagnoses

- `downloadJobFinalizer` persists the terminal status, broadcasts the final state, reports to the run tracker and dispatches notifications; `downloadCompletionEffects` owns the side effects after completion (temp cleanup, poster backfill, playlist hooks, Plex refresh, next-job kickoff).
- `transient403RetryPlanner` (pure) picks failures to auto-retry: transient mid-stream 403s and cookie-specific `Video unavailable`. The finalizer enqueues an "Auto-retry" URL-list job through a callback injected from downloadModule, capped by `downloadAutoRetryCount`.
- Handed-off failures are tagged `autoRetryQueued` so run summaries report the post-retry outcome instead of the first failure.
- `failureAdvisor` (pure) maps known failure signatures (temp space, 403 with or without cookies, bot check) to plain-language diagnoses; the finalizer stamps `diagnosisKey` on failed videos and emits a deduped `diagnoses` list.
- That list flows into job data, run summaries, the Download History UI and the notification "Likely cause" lines.
- `failedVideoEnricher` backfills title and channel onto failed-video records from videos, channelvideos + channels, and playlistvideos, once, right after result partitioning; the client falls back to a linked YouTube ID.

## Run tracker (sweep summaries)

- `downloadRunTracker` aggregates one channel+playlist sweep's jobs into one summary and notification; it remembers the last 20 finished runs so a sweep that finished before anyone listened still reports its end.
- `maybeFinalize` finishes a sealed run only once every job has reported: `updateJob` sets a final status before the finalizer reports the job's totals (its videos are reloaded from the database first).
- A job with a final status that has not reported holds the run for `REPORT_GRACE_MS` (5 min, one timer per run); after that it counts as an issue, and the run is dated to when that job ended.
- `jobIssue` (`{ status, reason, byUser }`) reaches the run from the ungrouped finalizer, the executor's output-directory and spawn failures, the single-group channel job's pre-spawn failure, and `failUnstartedJob`.
- Issues make the run's summary a warning, appear in its text and the activity page card, and notify unless the user terminated the job.
- An Error whose failed videos all went to an automatic retry, without a bot check, is left to the retry job's own result rather than reported as an issue.
- `autoDownloadScheduler` polls `getUnfinishedJobs(runId)` so the Automatic downloads task reports as running until every job of the sweep finishes; `channelAutoDownload` returns once the sweep is queued, with a `finalRecord` from `channel/sweepCompletion.waitForSweepEnd` (never rejects; 48 h cap) mapped by `channel/sweepRunSummary.toRunRecord`.
- `waitForSweepEnd` also ends at a storage pause once none of the run's jobs is in progress or still reporting; `toRunRecord` records a pause as `success`/`paused` and carries the sweep's real `finishedAt` into the run record.

## Custom yt-dlp options

- `customArgsParser.checkCustomArgs` resolves every token to its canonical option the way optparse does (exact name, unique prefix, short alias, grouped shorts) and checks it against `ytdlpOptionTable`; blocked and malformed tokens are skipped individually and the rest still apply.
- It is an allowlist because a denylist can be bypassed (GHSA-xj5v-qwfw-gp7j, GHSA-jprg-87hp-2phh). `args` are canonical names plus values, so yt-dlp reads them as the check did, even after a runtime yt-dlp update; `buildCustomArgs` re-checks at download time.
- `ytdlpOptionTable` is the hand-maintained ALLOW/WARN/BLOCK policy over `ytdlpOptionSpecs` (generated by `scripts/generate-ytdlp-option-specs.py`). ALLOW and WARN are explicit allowlists; every other option and unknown token blocks, so a dangerous future flag is denied until classified.

## Subtitles

- `ytdlpCommandBuilder.buildSubtitleLanguageSelector` expands each bare code from `subtitleLanguages` into a `--sub-langs` regex matching regional and script tracks (`en-GB`, `zh-Hans`), since yt-dlp matches every entry as a case-insensitive full regex; `en-orig`, `all`, exclusions and regexes pass through verbatim.
- The subtag groups switch case-sensitivity back on so `-orig` and `<target>-<source>` machine translations stay out; Node 22 cannot evaluate `(?-i:...)`, so the pattern is verified against yt-dlp's own matcher, not in JavaScript.
- `subtitleSidecarPruner` (pure, per-video post-processor) keeps, per configured bare language, the uploaded track(s), else the bare auto track, else everything, because yt-dlp picks uploaded and auto tracks from one list keyed by exact code.
- Nothing is pruned when any entry is an alias, exclusion or regex, when the uploaded codes are unknown, or for other videos' files in a flat folder.
- Nor when custom args carry `--sub-langs`, `--srt-langs`, `--all-subs` or any prefix yt-dlp accepts (`--sub-lang`): a repeated `--sub-langs` is appended to Youtarr's value, not replaced. A code listed verbatim is never deleted but still counts as uploaded.

## Archive and storage

- `download/archiveAccess` coordinates archive-removing purges with `downloadExecutor.doDownload`: such purges are refused with 409 `archive-busy` while any download holds access, and new downloads wait for a running purge. Purges that keep archive entries can run during downloads.
- `archiveOnlyIds` finds ids in `complete.list` with no Videos row (yt-dlp would skip them). It requires only the ChannelVideo model, not the models index: `downloadModule.test.js` replaces model files with plain objects, and the index's association setup throws on them.
- `storageUsage` is `SUM(file_size + audio_file_size)` over non-removed rows, never a disk walk; its `STORED_BYTES_SQL` fragment is shared with the oldest-first auto-removal queries so MP3-only videos count their real size.
- `storageGuard`: optional `downloadPauseUsageLimit` and `downloadPauseMinFreeSpace` triggers, both off by default; a failed measurement never pauses (fail open). The usage SUM runs only when a usage limit is set; `GET /api/jobs/download-pause` opts in with `refresh({ includeUsage: true })`.
- `assertDownloadsAllowed()` throws `DownloadsPausedError` (code `DOWNLOADS_PAUSED`) from downloadModule's fresh-request entry points; queued jobs started with isNextJob skip it; routes map it to 409 through the injected `storageGuard.isPausedError`.
- Download New reaches `doChannelAndPlaylistDownloads` through the scheduler's `channelDownloadFrequency` task, so the pause check runs first in `autoDownloadScheduler.getRunBlocker` and a paused request gets the `downloads-paused` reason, not a bare 409.
- A pause hit mid-sweep stops the playlist loop and is reported as `pausedReason`, not a failure; the scheduled sweep records a skipped run first.
- `startNextJob` refreshes the guard (every finished job re-checks) and holds Pending jobs while paused, restarting on the guard's `resumed` event. A paused-state flip broadcasts `downloadPauseChanged` and sends `notificationModule.sendDownloadPauseNotification`; re-checks run every 5 min while paused and on deletions.
- `/updateconfig` rejects size values other than blank or `<positive int>MB|GB|TB`; `configModule.normalizeStorageSizeFields` corrects hand-edited ones on load, because the client saves the full config and one bad value would block every Settings save.

## Activity page and resolutions

- `download/videoActivity` is the transient per-video queued/downloading registry with duplicate admission claims and revisioned snapshots; `videoActivityUpdated` invalidates `GET /api/jobs/video-activity` snapshots. `VideoActivityProvider` shares them; `useLocalVideoStatus` refreshes persisted metadata independently of activity revisions.
- The WebSocket replays only the last final-state message on connect, never in-flight progress, so the activity page seeds from `GET /api/jobs/current-activity` (`downloadModule.getCurrentActivitySnapshot()`, the retained monitor's side-effect-free `toPayload()`).
- `DownloadManager/hooks/useCurrentActivitySeed` applies that seed only until the first live broadcast arrives and re-probes on tab visibility and on the provider's `connectionRestored` message.
- `client/src/utils/jobTypeLabel.ts` mirrors `server/modules/download/jobTypes.js` labels for the activity header, queued chips and job summaries.
- `resolutionTier` probes the file's real dimensions with ffprobe (ground truth over info.json) into `Videos.video_resolution` as `"WIDTHxHEIGHT"`; `"0x0"` means the probe failed and is stamped once so the row is not re-probed nightly.
- Interpreting dimensions into a tier is display logic in `client/src/utils/videoResolution.ts`: landscape by the YouTube ladder, vertical by selection class (608x1080 reads 1080p, 1080x1920 reads 2160p), shared by the listing chips and the modal so they agree.
- `selectionTierForHeight` applies the same vertical rule to the available-resolutions list, because YouTube's format_note labels verticals by short edge while the app labels them by selection class.
- `ytdlpModule`: `ytdlpUpdateChannel` picks stable or nightly, and every update runs `--update-to <channel>@latest` so the channel survives container recreation; startup re-applies it via `shouldReapplyChannel` when the installed version shape drifts.
- Latest-version checks hit the matching GitHub repo per channel, and downloads do not block updates.
