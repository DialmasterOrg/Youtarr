---
paths:
  - "server/modules/arrBridge/**/*"
  - "server/routes/arrBridge.js"
  - "server/routes/arrBridgeSettings.js"
  - "server/models/arrbridgegrab.js"
  - "client/src/components/Configuration/sections/ArrBridgeSection.tsx"
  - "client/src/components/Configuration/sections/components/Arr*.tsx"
  - "client/src/components/Configuration/hooks/useArrBridge*.ts"
  - "client/src/components/Configuration/utils/arrBridgeSetup.ts"
---

# Sonarr/Radarr bridge

The opt-in `/arr` namespace (issue #760): a Newznab indexer and a SABnzbd download client that Sonarr and Radarr add with their stock settings. A grab is an ordinary Youtarr download; the app imports a hardlink.

## Access and config

- `/arr` skips `verifyToken` because Sonarr and Radarr cannot log in. Every request checks the bridge key, also with `AUTH_ENABLED=false`, and the namespace answers 404 while `arrBridgeEnabled` is off, so a login proxy exemption for `/arr/` stays safe.
- The key travels as `?apikey=` because the protocols allow nothing else. `redactUrl` and `redactQuery` in `server.js` and the log scrubber hide it; never log `req.query` or a rendered feed, whose item links carry the key.
- `arrBridgeApiKey` is server-owned like `downloadsFeedToken`: `/getconfig` omits it and `/updateconfig` restores it. It is created the first time the bridge is found enabled or Settings asks for it.
- Eleven `arrBridge*` settings are in `CONFIG_FIELDS`. `arrBridgeConfig` holds the one rule set `/updateconfig` rejects with and `configModule` corrects stored values with; `readSettings` still corrects on every read, so a category name can never become a path.
- `/updateconfig` keeps a bridge setting the client did not send: a tab loaded before the settings existed posts a config without them, and a save replaces the whole config, which would switch the bridge off.
- SABnzbd answers are always HTTP 200, with `status: false` for errors, because anything else marks the whole client unavailable. `mode=version` needs no key, as in real SABnzbd.

## Indexer

- Caps advertise no id parameters and no raw search engine: with an id Sonarr sends no title, and a release matched by id alone is grabbed but never imported. Sonarr caches caps in memory until restart.
- tv-search advertises `title` because Sonarr removes a leading "The" from `q`. A `q`-only TV request (Prowlarr drops `title`) is named `<Q>.AKA.The.<Q>`, which Sonarr matches with or without the article.
- Release titles come from the request, never the video's title: tokens such as `E05`, `720p` or `German` change the parsed episode, quality or language. The channel name is the release group, screened by a denylist.
- One release title is the feed title, NZB name, SABnzbd history `name`, staging folder and staged file name, because the apps map the file from that name, never from their own grab history.
- Every release name carries `YT` before `WEB-DL`. The apps recognize an imported release by its name (users' custom formats match the marker), so the name format must not change after release; older names without it stay valid.
- A label is the video's real resolution, capped by the download resolution (`arrBridgeResolution`, else `preferredResolution`) and `arrBridgeLabelLimit`, because the apps rank by label, and a 480p video labeled 1080p outranked real 720p releases. Unknown means the cap.
- Real resolution sources, in order: the library file's stored size, which the grab hands over (0x0 or missing is unknown); the API's `definition` (`hd` settles only a cap of 720 or lower); a 6 hour cache; a yt-dlp probe.
- A grab downloads at `arrBridgeResolution` as read at download time, never the resolution in its name, which is the real resolution or lower. One setting, not per category: a search does not say which category asks.
- Probes are bounded so yt-dlp never holds a search past the 100 s wait: 2 at a time, 10 and 20 s per answer, 100 an hour, paused 15 minutes after 3 failures, none under a 480 cap.
- The resolution probe (`videoMetadataModule.probeAvailableResolutions`) runs without cookies, reads and writes no info.json and records no members-access state, because it runs automatically on searches, not on a user's action.
- The feed reports size 0: Sonarr rejects a realistic YouTube size as too small for the series runtime. The estimate rides in the NZB link only for the queue's size columns.
- The no-query feed returns one placeholder item, because both apps' indexer Test fails on an empty feed. Its link answers 404.
- Strict matching is the default (an episode marker for TV, the year for a movie): whatever is offered parses as exactly the wanted item, and automatic search may grab it. Season answers stay strict even with loose matching on.
- Strict TV matching also rejects a title with several episodes, and one with other words between the series name and the marker: "Beyblade Metal Fusion S01E29" contains every word of "Beyblade" but is another series.
- A search that cannot run is held up to 30 s, then answered with Newznab error 900: never 429, which disables the indexer for 5 to 15 minutes, and never an empty page, which reads as "nothing on YouTube".
- Bridge searches use at most a fixed daily share (5,000 units) of the YouTube API quota, then yt-dlp. Daily-show requests are exempt because only the API gives exact dates. The count is in memory; a restart resets it.
- The failed-grab guard (7 days) keys on `fail_message` and `completed_at`, not status: Sonarr deletes a failed history item within a minute, turning the row `removed` before it searches again.

## Sonarr/Radarr connection and episode-title matching

- The connection to the user's own Sonarr and Radarr is optional and read-only. Episode data never comes from Skyhook, Sonarr's private service.
- `arrBridgeSonarrApiKey` and `arrBridgeRadarrApiKey` are server-owned like the bridge key and travel only as a header. `arrClient` turns every failure into an error without the axios object, whose config holds the key; never log that object.
- `/updateconfig` keeps the stored Sonarr and Radarr URLs as well as the keys: a client able to move a URL would have the stored key sent to a host it chose.
- A connection changes only through `PUT /api/arr-bridge/connections/:app`, which tests the given URL and key and stores both, never reading the stored key. The Test route reads no body. So a stored key only reaches the URL stored beside it.
- `/getconfig` omits the connection URLs too, because a hand-edited one may hold credentials. Settings reads normalized URLs from `/api/arr-bridge/status`, which never returns a key.
- The connection test passes on only the app's name, matched against Sonarr and Radarr, and a digits-and-dots version: the server calls a host the caller chose, so nothing else of its answer may be echoed.
- `checkSharedFolder` asks the app to list the staging root as it knows it and passes on only whether a category folder is there: read-only, nothing listed is echoed, and another folder at that path does not pass.
- The connection card never loads a stored key, but keeps a typed one in its field while the page is open, so a mistyped address is corrected without typing the key again.
- `arrClient` follows no redirect, because axios would send the key header on to the redirect's target. Its abort signal is the real time limit: axios's `timeout` only bounds the wait between bytes.
- A failed lookup falls back to the episode-code matcher, never an error document. The app is not asked again for 60 s after a failure, so requests do not each wait; remembered answers still serve.
- Caps advertise no ids, so a search is tied to a series by asking the app to parse the release name offered. The name must still be one of the series' own names (title, title without its tag, aliases).
- A name two series share resolves to the series the app itself picks for that release name, because that is the series the app will read the release as.
- Name lookups are remembered per release name, so "Batman" and "The Batman" stay apart, for 10 minutes; "not known" for 60 s only, so a series added just after a miss resolves soon.
- The list of all series serves only the similar-series check below. No search waits on it: 60 s limit, old list used while a new one loads, first load awaited 3 s, retry after 1 hour.
- The connection Test also parses the placeholder name: an app can answer system/status yet fail lookups. Not knowing the placeholder passes; a failed call is `lookup-failed`.
- Aliases with a scene season are dropped and scene-numbered series get no episode title: Sonarr sends scene numbers for them, which would look up another episode.
- The title stage searches `<main series title> <episode title>` for every alias, so one Sonarr search costs one YouTube search. Releases are still named from the alias that was asked.
- A title match needs the episode title as a whole phrase, the series name within the video title or within the channel name, no other episode's number or title, and a length inside the runtime window.
- Strict matching runs the title stage only with a known runtime: without the window, an hour of episodes listing this title would pass.
- Sonarr grabs the newer of equal releases whatever the feed order, and a re-upload is always newer. So the strict title stage offers only the closest channel (`seriesChannelRank`); others return once its grab failed.
- A video naming a library series whose name contains this one's ("Beyblade Burst"), or a year before the series began, is another series. Loose matching drops this, the series-name and the one-word-title rules, and lets an unknown length pass.
- A generic, shared or series-named episode title skips the title stage, and a one-word title also needs the episode number: such titles appear in unrelated videos.
- With a known runtime, `runtimeWindow` replaces the fixed minimum lengths in every filter, loose matching included: it is what rejects a double episode, and it never goes below Sonarr's sample threshold.
- Movies keep the year requirement under strict matching: The Matrix and The Matrix Reloaded share every title word and nearly a runtime.
- `searchService` decodes HTML entities in titles and channel names first: the YouTube Data API encodes them (`It&#39;s`), which broke every match on an apostrophe or `&`.

## Grabs and staging

- The apps only ever get a hardlink under `.arr-staging` (a copy across filesystems): they move the file and delete the folder themselves.
- With `arrBridgeRemoveAfterImport` on, `libraryCopyRemover` deletes Youtarr's copy of a grab only after a confirmed import, through `videoDeletionModule` (`auto_removal`; the archive line stays). Off, a grab never removes a library file, a Videos row or an archive line.
- One history delete serves an import and a removal, so only the connected app's history (`downloadId` is the grab id) proves an import; unconfirmed keeps the copy. A hardlink count is no proof: any other link reads as one.
- `library_copy` is `owned` only for a video with no library row that the grab's own job downloads; a requeue clears it, because another job may then be the one that downloads the video.
- Removal waits while another grab of the same video is pending or queued: that grab still stages from the library file.
- `videosModule.scanForVideoFiles`, `libraryRootCheck`, the orphan folder sweep and `videoMetadataProcessor` skip `.arr-staging` (`ARR_STAGING_DIR_NAME` in `filesystem/constants.js`). Any new walk of the downloads folder must skip it too.
- Category folders exist from the moment the bridge is on, because Radarr raises a health error for a missing one. `.ignore` and `.plexignore` keep media servers out: their adapters match library items by file name.
- A SABnzbd category is one app instance: an app keeps only items of its own category, so two instances sharing one import each other's grabs. The carrier NZB holds the kind (tv or movie), not the category.
- `grabExecutor` follows `externalRequestExecutor`, but each attempt gets a new job id stored on the grab: work on one grab is serialized, and every write names the status it expects, so a removed grab is never revived or staged.
- A grab is failed only on evidence. A job a restart terminated, or one that never existed, queues the grab again at once; a file that cannot be checked waits.
- A job that errored before trying the video, or a staging error, holds the grab 15 minutes and retries for a day, in memory. A failure makes the app blocklist the release and hides the video 7 days.
- `endedBeforeTrying` names the three `Error` outputs written before yt-dlp runs (output folder check, process start, `failUnstartedJob`); rewording them in `downloadExecutor` or `jobModule` makes such grabs fail again. Any other `Error` job counts as tried, so a finalization error never re-downloads.
- `grabService.grabState` derives what Settings shows. A removed grab that completed is `handed-off`, never "imported": the app sends the same history delete after an import and after a removal there.
- A category's name cannot be edited in Settings, only removed and added: existing grabs carry the name and their staging folder is named after it.
- `ARR_BRIDGE_JOB_LABEL` contains the manual download label on purpose, so job detection, per-video structure and members-only handling treat a grab as a manual download.
