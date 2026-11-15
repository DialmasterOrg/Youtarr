---
paths:
  - "server/modules/arrBridge/**/*"
  - "server/routes/arrBridge.js"
  - "server/models/arrbridgegrab.js"
---

# Sonarr/Radarr bridge

The opt-in `/arr` namespace (issue #760): a Newznab indexer and a SABnzbd download client that Sonarr and Radarr add with their stock settings. A grab is an ordinary Youtarr download; the app imports a hardlink.

## Access and config

- `/arr` skips `verifyToken` because Sonarr and Radarr cannot log in. Every request checks the bridge key, also with `AUTH_ENABLED=false`, and the namespace answers 404 while `arrBridgeEnabled` is off, so a login proxy exemption for `/arr/` stays safe.
- The key travels as `?apikey=` because the protocols allow nothing else. `redactUrl` and `redactQuery` in `server.js` and the log scrubber hide it; never log `req.query` or a rendered feed, whose item links carry the key.
- `arrBridgeApiKey` is server-owned like `downloadsFeedToken`: `/getconfig` omits it and `/updateconfig` restores it. `arrBridgeService` creates it the first time the bridge is found enabled.
- The `arrBridge*` settings are hand-edited and absent from `CONFIG_FIELDS` until the Settings page ships. `arrBridgeConfig.readSettings` corrects them on every read, so a category name can never become a path.
- SABnzbd answers are always HTTP 200, with `status: false` for errors, because anything else marks the whole client unavailable. `mode=version` needs no key, as in real SABnzbd.

## Indexer

- Caps advertise no id parameters and no raw search engine: with an id Sonarr sends no title, and a release matched by id alone is grabbed but never imported. Sonarr caches caps in memory until restart.
- tv-search advertises `title` because Sonarr removes a leading "The" from `q`. A `q`-only TV request (Prowlarr drops `title`) is named `<Q>.AKA.The.<Q>`, which Sonarr matches with or without the article.
- Release titles come from the request, never the video's title: tokens such as `E05`, `720p` or `German` change the parsed episode, quality or language. The channel name is the release group, screened by a denylist.
- One release title is the feed title, NZB name, SABnzbd history `name`, staging folder and staged file name, because the apps map the file from that name, never from their own grab history.
- The feed reports size 0: Sonarr rejects a realistic YouTube size as too small for the series runtime. The estimate rides in the NZB link only for the queue's size columns.
- The no-query feed returns one placeholder item, because both apps' indexer Test fails on an empty feed. Its link answers 404.
- Strict matching is the default (an episode marker for TV, the year for a movie): whatever is offered parses as exactly the wanted item, and automatic search may grab it. Season answers stay strict even with loose matching on.
- Strict TV matching also rejects a title with several episodes, and one with other words between the series name and the marker: "Beyblade Metal Fusion S01E29" contains every word of "Beyblade" but is another series.
- A search that cannot run is held up to 30 s, then answered with Newznab error 900: never 429, which disables the indexer for 5 to 15 minutes, and never an empty page, which reads as "nothing on YouTube".
- The failed-grab guard (7 days) keys on `fail_message` and `completed_at`, not status: Sonarr deletes a failed history item within a minute, turning the row `removed` before it searches again.

## Grabs and staging

- The apps only ever get a hardlink under `.arr-staging` (a copy across filesystems): they move the file and delete the folder themselves. A grab never removes the library file, a Videos row or an archive line.
- `videosModule.scanForVideoFiles`, `libraryRootCheck`, the orphan folder sweep and `videoMetadataProcessor` skip `.arr-staging` (`ARR_STAGING_DIR_NAME` in `filesystem/constants.js`). Any new walk of the downloads folder must skip it too.
- Category folders exist from the moment the bridge is on, because Radarr raises a health error for a missing one. `.ignore` and `.plexignore` keep media servers out: their adapters match library items by file name.
- A SABnzbd category is one app instance: an app keeps only items of its own category, so two instances sharing one import each other's grabs. The carrier NZB holds the kind (tv or movie), not the category.
- `grabExecutor` follows `externalRequestExecutor`, but each attempt gets a new job id stored on the grab: work on one grab is serialized, and every write names the status it expects, so a removed grab is never revived or staged.
- A grab is failed only on evidence. A job a restart terminated, or one that never existed, queues the grab again; a file that cannot be checked waits. A failure makes the app blocklist the release and hides the video for 7 days.
- `ARR_BRIDGE_JOB_LABEL` contains the manual download label on purpose, so job detection, per-video structure and members-only handling treat a grab as a manual download.
