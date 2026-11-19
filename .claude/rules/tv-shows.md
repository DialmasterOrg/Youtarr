---
paths:
  - "server/modules/tvShows/**/*"
  - "server/routes/tvShows.js"
  - "server/routes/tvTitleShows.js"
  - "server/models/tvshow.js"
  - "server/models/tvshowpattern.js"
  - "server/models/tvshowseason.js"
  - "server/models/videoclassification.js"
  - "server/models/episodeconflict.js"
  - "server/modules/filesystem/showFolderCleanup.js"
  - "client/src/components/ChannelPage/components/TitleShows/**/*"
  - "client/src/components/ChannelPage/components/ChannelTv*.tsx"
  - "client/src/components/ChannelPage/components/TvFolderSetup.tsx"
  - "client/src/components/ChannelPage/hooks/useChannelTv.ts"
  - "client/src/components/ChannelPage/hooks/useTitleShows.ts"
  - "client/src/components/ChannelPage/hooks/useTitleShowPreview.ts"
  - "client/src/components/ChannelPage/hooks/useMissingEpisodes.ts"
  - "client/src/components/shared/EpisodeAssign/**/*"
  - "client/src/components/shared/EpisodeChip.tsx"
  - "client/src/components/shared/VideoModal/components/VideoEpisodeSection.tsx"
  - "client/src/components/Subscriptions/components/chips/ShowsChip.tsx"
  - "client/src/components/Subscriptions/components/chips/TvChip.tsx"
  - "client/src/types/tvShows.ts"
  - "client/src/types/titleShows.ts"
  - "client/src/utils/seasonNumbers.ts"
---

# TV shows

Channels saved as TV shows in TV-layout library folders (issue #175), and title shows: a series inside one channel, numbered from its titles. Moving existing downloads is in `.claude/rules/reorganize.md`; folders and the media server library check in `.claude/rules/library-folders.md`.

## Layouts and channel shows

- A folder's layout decides how its downloads are saved: `mainFolderLayout` config for the main folder (`''`), `subfolders.layout` for each subfolder, read through `libraryLayouts` (one query per resolver). A channel's layout is its folder's layout.
- `tvShows/constants` (layouts, show kinds) is dependency-free so pure modules can import it. `libraryLayouts` never imports `subfolderModule`, which reads layouts through it.
- `channelFolders` imports `filesystem/pathBuilder` only, since the filesystem aggregator would load fs-extra.
- A channel show (`tv_shows.kind = 'channel'`) is created once per channel, when it switches to TV or first downloads into a TV folder. `showStore` sanitizes and validates its folder name, adding ` (<channel id>)` when taken or invalid.
- `channelLayout.applyChannelFolderChange` (called from `channelSettingsModule.updateChannelSettings`) creates or moves the channel show instead of moving files when TV is involved, and rolls the folder change back when that fails.
- Leaving TV keeps the show row but removes the show folder once only `tvshow.nfo` and art remain (`showFolderCleanup.cleanupOrphanShowFolder`).
- `layoutGuards`: a folder or channel with downloaded videos switches between Videos and TV only through the reorganize. A direct change is answered with a `reorganizeRequired` 409 naming the change (`reorganizeRequiredError`; routes send `errorBody`).
- Nothing switches layout while a download job is In Progress; the caller passes `isDownloadRunning`.
- A channel's downloads include its episodes uploaded under another channel id, found through `video_classifications`, because VEVO and Topic uploads keep the uploader's id on their videos row.
- MP3 download types never target a TV folder: saved channel and playlist settings and explicit download overrides are refused (`assertVideoOnlyDestination`).
- `manualDownloadGrouper` and `playlistDownloadGrouper` downgrade a download-time MP3 type to video for each video whose predicted folder is TV (`downloadSettingsResolver.predictFinalSubfolder` + `coerceAudioFormatForLayout`, one layout read per batch).
- `routing` is the pure rule for where a downloaded video belongs: title show, channel show, or movie-style. `channelFolders.tvChannelCondition` backs the `/getchannels?layout=tv` filter.

## Episode numbers and placement

- `dateNumbering`: the season is the UTC upload year and the episode an 8-digit MMDDHHMM from `timestamp`, falling back to `upload_date`. A taken number bumps to the next free integer; batch numbering adopts "Plex TV Series" preset codes.
- `episodeAllocator` stores unique numbers in `video_classifications`, and a re-download reuses its row. Never upsert there: ON DUPLICATE KEY would also fire on the episode key. A taken number gets one retry.
- `episodeNaming`: `Season NN` folders and `SxxEyy - <title> [id]` stems, titles cut to 64 bytes.
- `episodePlacement.planEpisode` (the post-processor's TV branch) returns null for a Videos folder or when layouts cannot be read, and throws rather than misplace an episode.
- `moveEpisodeFiles` goes through `filesystem.replaceFileWithRetries` (a `<name>.part` staging file and an atomic rename), because fs-extra's overwrite removes the destination before a cross-device copy. It then removes the video's other files in the season folder.
- MP3 output that still reaches a TV folder (attribution that only succeeds from the .info.json) is placed under the episode stem too, never movie-style, with a warning.
- `writeEpisodeMetadata` always writes the episode NFO, whatever `writeVideoNfoFiles` says, and `tvshow.nfo` only when its content changes. `tvNfo` never writes lockdata, dateadded or artwork paths.
- The post-processor tags episodes with `--TVShowName`, `--TVEpisode` and `--stik "TV Show"`, never the season and episode atoms, and copies the show owner's channel art, not the uploader's, into the show folder.
- `episodeInfo` adds episode details to the channel videos, `/getVideos` and video metadata responses only when the video's file is named with its stored stem.
- Video deletion and the orphan sweep pick `showFolderCleanup` (emptied season and show folders in `<library folder>/<show>/Season NN/`) or the channel-folder cleanup by the library folder's layout.

## Title shows

- A title show (`tv_shows.kind = 'title'`) is a series inside one channel. Classification decides which videos belong; the match filter only screens downloads.
- `patternCompiler` turns the simple syntax (`{season}`, `{episode}`, `{title}`, `*`, `^`) or a regex into a Python regex with named groups plus its filter form (groups unnamed, leading flags scoped). Seasons run 0..199.
- It refuses backreferences and conditional groups, since unnaming and joining a show's patterns renumber groups.
- `titleMatcher` runs one Python batch per channel through `titleFilterRegex.classifyTitles`: first show by position, then pattern, without an exclude term.
- A number the pattern takes from the title but the title skipped (an optional regex group) is `unsupported`, reason `missing-number`. A pending match keeps its title episode for the reorganize as `titleEpisode`.
- `titleNumbering` (pure) gives each row `assigned`, `pending_number`, `duplicate`, `unsupported`, `opted_out` or `error`. The stored holder of a title number keeps it while it still claims it and is available or downloaded; else the earliest available upload takes it.
- A manual override takes its number from any holder, which is then classified as if it held nothing. Manual and opted-out rows are never touched by automatic numbering.
- `order` numbers continue past `tv_show_seasons.order_high_water` and are never reissued.
- Year seasons and date episodes wait for the download (`pending_number`), except that a downloaded video's upload year is known (`Videos.originalDate`), so a year season with a title episode is numbered at plan time.
- A downloaded duplicate the post-processor recorded keeps that verdict, since the planner never has the upload time to redo it.
- The preview, direct saves and the reorganize all plan through `titlePlanner.planChannel`. A download outside the downloads folder never moves (`staysOutside`).
- A show folder renamed only in case or accents still moves its files, since the database compares folder names ignoring both and most filesystems do not.
- `titleRowWriter` writes a plan in one transaction, numbers released before they are retaken, each row only while it is as planned; otherwise `ROW_CHANGED`, and the saver plans again once.
- `titleShowSaver` saves directly when no downloaded video's show, number or stem changes, else answers `reorganizeRequired` with a `titleShows` change.
- Listing refreshes classify only new rows (`classifyNew`, from `channelVideoWriter.insertVideosIntoDb`): an existing video keeps its episode whatever its title says now. It never fails the refresh.
- After each save `titleShowService` rewrites the channel's title show NFO files, which name and season-name edits change without moving a file; the reorganize follow-up does the same for a `titleShows` change. "Not an episode" applies to title show episodes only.
- `episodeConflicts`: a not-downloaded duplicate is ignored and suppressed in `complete.list`; on release only what Youtarr did is undone (`youtarr_ignored`; `archive_suppressed`, false when the line was already there). A downloaded duplicate is never ignored or deleted; duplicates a listing refresh finds are ignored too.
- `archiveSuppressor` defers those `complete.list` writes (`archive_pending`) until no download job is In Progress, through `jobModule.onBeforeNextJob` (awaited before any job starts) and at startup, because channel jobs count archive lines.
- `titleEpisodeAssigner` (post-processor): a stored episode is reused without Python; otherwise the full title is classified at finalize. Duplicates, unsupported, opted-out and errors fall back to the channel layout and are recorded.
- The show-only switch (`channels.tv_show_only_downloads`) adds one `--match-filter` per show (`ytdlpCommandBuilder.buildMatchFilterList`), never OR'd across shows into one regex: repeated group names or flags would crash yt-dlp mid-run.
- Each per-show filter carries the channel's own filters, the members-only clause from `membersAccess.buildDownloadFilter`, the show's patterns and that show's exclude terms, so a term one show excludes never blocks another show.
- The show-only switch also limits Download All to classified videos (`assigned`, `pending_number`) and does nothing while the channel has no active show.
- `tvNfo` marks title shows with `<uniqueid type="youtarr">` plus a custom UUID, `<namedseason>`, and a `season.nfo` per named season.
- `titleCorpusClassification.test.js` runs real channel titles with intended classifications (`__tests__/fixtures/channelTitleCorpus.json`) through the real Python matcher.
