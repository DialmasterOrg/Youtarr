---
paths:
  - "server/modules/channel/**/*"
  - "server/modules/subscriptionImport/**/*"
  - "server/modules/channelModule.js"
  - "server/modules/channelSettingsModule.js"
  - "server/modules/channelDownloadAllModule.js"
  - "server/modules/channelSearchModule.js"
  - "server/modules/channelVideoReanchor.js"
  - "server/modules/channelFolderNameMigration.js"
  - "server/modules/titleFilterRegex.js"
  - "server/modules/videoMetadataModule.js"
  - "server/modules/tabsUtils.js"
  - "server/modules/youtubeApi/**/*"
  - "server/utils/title-filter-regex.py"
  - "server/routes/channels.js"
  - "server/routes/channelSearch.js"
  - "server/routes/subscriptions.js"
  - "client/src/components/ChannelPage.tsx"
  - "client/src/components/ChannelPage/**/*"
  - "client/src/components/Subscriptions.tsx"
  - "client/src/components/Subscriptions/**/*"
  - "client/src/components/shared/AddChannelDialog.tsx"
  - "client/src/components/FindChannels/**/*"
  - "client/src/components/SubscriptionImport/**/*"
  - "client/src/utils/tabDownloadStats.ts"
---

# Channels

Channel subscriptions, listings, title filters, per-tab download counts, channel search and bulk import.

- `channelModule.js` is the public facade; the domain lives in `modules/channel/` (`fetchRegistry` in-flight guard, `channelYtdlpExecutor`, `channelIdentity`, `tabState`, `channelMappers`, `videoEntryParser`, `channelVideoWriter`/`channelVideoQuery`, `channelThumbnails`, `channelBackdropBackfill`, `channelMetadataFetcher`, `tabManager`, `channelProvisioning`, `channelCatalog`, `autoDownloadScheduler`, `channelVideoFetcher`, `channelVideosService`).
- Channel title filters are evaluated with Python's `re` through `titleFilterRegex` (`utils/title-filter-regex.py`, one process per batch, JSON on stdin) so the preview and validation match yt-dlp's `--match-filter` exactly.
- `ytdlpCommandBuilder.buildMatchFilters` escapes only `'` and `&`, because yt-dlp's `match_str` unescapes nothing else. Playlist title filters are separate: case-insensitive JavaScript regexes (`playlistModule.buildTitleFilterRegExp`).
- Per-channel `auto_removal_protected` and `auto_removal_keep_recent_count` are mutually exclusive: a request setting both is rejected, and enabling protection clears the count. Both guards go dormant while the channel is unsubscribed.
- `channelDownloadAllModule` selects every known never-downloaded channel video, excluding ignored, YouTube-removed, members-only videos the cookies cannot open (`membersAccess`), live, anything ever downloaded even if since deleted, and `archiveOnlyIds` entries: download-all is not a re-download mechanism. It queues one `doSpecificDownloads` job, `Channel Download All: <title>`.
- `channelSearchModule`: YouTube Data API `search.list` type=channel plus `channels.list` enrichment when a key is configured, else a yt-dlp channel-filtered results page; `subscribed` comes from enabled Channel rows; `videoCount` is API-path only.
- `channelVideosService.applyArchiveFlag` sets `inArchive` on the page `buildChannelVideosResponse` returns, so the date probe before each listing never reads the archive. The channel page counts such videos as previously downloaded, which turns on "Allow re-downloading".
- The channel listing takes `deletedFilter` as the last positional argument through `channelModule` -> `channelVideosService` -> `channelVideoQuery`, and reads plain rows (`raw: true`): the library check spreads them, and a Sequelize instance loses its getters when spread.
- `getChannelVideos` waits on yt-dlp only for a tab with no rows or no `last_fetched_by_tab` entry; otherwise it answers from the database and refreshes through `channelVideoFetcher.refreshTabTracked`, because that wait was the page's loading screen.
- A finished `autoRefresh` stays in `fetchRegistry` as `lastResult` for 2 minutes; the client offers its new rows and reloads only an empty list, because a refetch moves rows under selections and cannot update an infinite list past page 1.
- `useChannelVideos` reports a background refresh as `refreshSeq`, a new value per response, not a boolean: a latched flag never re-triggers tracking when the same view is refreshed again.
- Existence checks run after the response, so a YouTube removal shows one load later; a failed background refresh blocks another for that tab until its `lastResult` expires.
- `channelFeedCheck` uses the `channel_id` and `UUMO` (members-only) feeds only to notice unlisted ids; rows come from the yt-dlp tab listing. A failed, truncated or mismatched feed is no information; a well-formed feed with no entries is valid.
- The `UUMO` feed is read only after the channel feed answers and never counts toward the outage breaker. Its 404 means no members-only videos (remembered 24 hours), except for a channel with a `subscriber_only` row from the last 30 days, where it is an outage: no stamp.
- The cookieless yt-dlp tab listing already returns members-only videos as `subscriber_only`; the `UUMO` feed only triggers it. A few `UUMO` ids never appear in a tab listing and stay in the unresolved memory.
- YouTube's feeds are down about a sixth of the time, so an outage is an ordinary result: the run is `skipped` and logged at info ("Channel feed check finished") with a `feedFailures` tally, never as a warning.
- `feed_checked_at` is separate from `last_fetched_by_tab` so a quiet channel still gets a real listing every 24 hours; feeds cannot show title changes or ended live streams.
- Feed-check tab listings pass no `mostRecentVideoDate` (50 entries), because the recency window lists 5 and the feed holds 15; ids the listing never returns are remembered in memory so they do not retrigger hourly.
- `youtubeExistenceCheck` answers `exists`/`removed`/`unknown`; on `unknown` leave `youtube_removed_checked_at` alone, because it is an outage, not a verdict, and the check must run again later (`.claude/rules/server-runtime.md`).
- `subscriptionImport/` (`importJobRunner`, `takeoutParser`, `cookiesFetcher`, `thumbnailEnricher`, `concurrencyLimiter`, `errorClassifier`) treats the uploaded Takeout CSV and cookies as untrusted: validated, size-limited, parsed defensively.
- `videoMetadataModule.getCachedVideoMetadata` reads the cached `.info.json` only; `getVideoMetadata` fetches with yt-dlp and caches the result (slimmed; see `.claude/rules/videos.md`).
- `channelThumbnails.backfillChannelImages` uses async disk checks only: synchronous ones on a slow mount blocked the event loop, and every other request, about 5 ms per channel on each channel list load.
- The channel list calls `backfillChannelImagesInBackground`, never awaited, which skips channels checked in the last 15 minutes; a poster or backdrop setting change forgets every check, so newly enabled images appear on the next load.
- The Channels page's add input is also the list search (`/getchannels?search=`, debounced). Enter adds only `isExplicitChannelReference` input, because a bare word may be a search; the search is held while a lookup runs so the list does not empty behind it.
- `useChannelList` applies only its newest request's response, because search-as-you-type overlaps requests. An unmatched name goes to Find Channels as `?q=`, run once on open: a YouTube search costs 100 quota units or seconds of yt-dlp, so never as-you-type.

## Per-tab download counts (issue #865)

- Totals come from each tab's auto playlist (`UULF`/`UUSH`/`UULV` + channel id minus `UC`; members-only `UUM*` playlists are not counted): YouTube API `playlists.list` (50 ids per unit) with a key, else yt-dlp `--flat-playlist --playlist-items 0`.
- For yt-dlp, "The playlist does not exist" means an empty tab (0), but every tab empty means failure. Counts live in `channels.tab_video_counts` (JSON by media type); a failed lookup never overwrites a count.
- Bulk runs: `channelVideoCountsFrequency` daily, and `refreshAtStartup` 2 minutes after boot, recorded as a `startup` run only when it counted something. server.js wires the run history via `setRunHistory` and the download check via `setDownloadActivityCheck`.
- Without a key, or when the API call fails, `lookupChannelsPaced` counts one tab at a time with a 3 s gap, because yt-dlp's `--sleep-requests` only spaces requests inside one process.
- The paced run covers channels whose counts and `tab_counts_attempted_at` (stamped when a lookup starts) are 3+ days old, oldest attempt first, capped at 200 lookups per run at a whole-channel boundary, saving each channel as it finishes.
- Bulk yt-dlp runs go without cookies, because a bot check lands on the IP, not the account.
- After two consecutive bot-checked runs that counted nothing while cookies are configured, bulk runs send cookies, still paced, for 30 days from the switch before trying without again.
- A bulk run stops at the next channel boundary while a download runs (`stopBeforeChannel`) and before any lookup while paused (`stopBeforeLookup`); neither starts or clears a pause.
- Three unexplained failures in a row end the run without a pause; channel-unavailable errors (terminated, missing or unviewable channel) don't count toward them.
- A bot check, HTTP 429 or "try again later" ends the run `throttled` and starts a `tabCountThrottle` pause: 6 h, doubling to 24 h on consecutive throttles, forgotten 3 days after it ends.
- The pause scope is `bulk` for a bot check on a cookieless lookup while cookies are configured (on-demand lookups with cookies stay available) and `all` otherwise, including a bulk run that sent cookies.
- The run history persists the pause, the cookie mode (`bulkCookiesSince`) and the consecutive bot-check count (`cookielessBotChecks`): every executed bulk run writes `currentDetails()` into its details, and the latest executed run is read back whatever its outcome.
- The pause doubling ends only through `clearIfUnchanged`, so a run never clears a pause that started while it ran; clearing or decaying the pause leaves the cookie mode alone.
- On-demand refreshes (after subscribe; channel page open with counts older than 24 h, at most 1 h after the last attempt) use the API, else yt-dlp with cookies two at a time, skipping yt-dlp during an `all` pause.
- Only one bulk refresh runs at a time; an overlapping one records as skipped.
- Downloaded = videos rows (locally deleted included; `youtube_removed` and members-only excluded) through the channel's listing row or `videos.channel_id` + `media_type`; percent floors and caps at 100. Served as `tab_download_stats` on `/getchannels` and `GET /api/channels/:channelId/tab-stats`.
