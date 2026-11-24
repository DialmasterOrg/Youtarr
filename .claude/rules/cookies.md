---
paths:
  - "server/modules/externalCookies.js"
  - "server/modules/uploadedCookies.js"
  - "server/modules/cookieTest.js"
  - "server/modules/cookieDetails.js"
  - "server/modules/cookieHealth.js"
  - "server/modules/ytdlpProcess.js"
  - "server/utils/validate-cookies.py"
  - "client/src/components/Configuration/sections/CookieConfigSection.tsx"
  - "client/src/components/Configuration/hooks/useCookieManagement.ts"
  - "client/src/components/Configuration/hooks/useCookieTest.ts"
  - "client/src/components/Configuration/sections/components/ExternalCookieNotes.tsx"
  - "client/src/components/Configuration/sections/components/CookieFile*.tsx"
  - "server/modules/membersAccess.js"
  - "server/modules/membersAccessState.js"
  - "client/src/components/shared/MembersAccessChip.tsx"
  - "client/src/components/shared/VideoModal/hooks/useMembersAccessCheck.ts"
---

# Cookies

External and uploaded cookie files, how yt-dlp runs receive them, and the cookie test. The `player_client` handling for cookie runs is in `.claude/rules/downloads.md`.

- `externalCookies` validates external cookie snapshots through the installed yt-dlp parser (`utils/validate-cookies.py`), memoizes unchanged results, and reports unusable files for omission. There is no persistent cookie fallback.
- `uploadedCookies` gives `config/cookies.user.txt` a disposable private copy per run, because yt-dlp rewrites its cookie file in place on exit: concurrent runs sharing it could read a half-written jar or undo a Settings upload.
- Nothing is written back from a run; Settings uploads are written to a temp file and renamed into place.
- If the private copy fails, the run goes without cookies (error-level log; info when the upload was just deleted).
- yt-dlp is never handed the uploaded file itself: its exit-time jar save could overwrite a newer upload or recreate deleted cookies.
- `ytdlpProcess` owns both kinds of copy's lifetime around yt-dlp processes.
- `cookieTest` (`POST /api/cookies/test`) runs one yt-dlp request to the subscriptions feed with `buildCommonArgs` against a private temp copy and never logs stderr, because yt-dlp echoes malformed cookie lines with their values. One test at a time (409), rate-limited.
- In that feed, exit 0 with JSON means signed in (even zero subscriptions) and "Incomplete yt initial data" warnings mean signed out (EXPIRED_COOKIES); that meaning is specific to the feed, so it stays out of the shared subscription-import classifier.
- `cookieDetails` summarizes the YouTube login cookies (names, counts, earliest expiry; never values) for `GET /api/cookies/status` and the upload and delete responses.

## Cookies stopped working (`cookieHealth`, issue #1066)

- The `cookieCheckFrequency` task runs `cookieTest` while `cookiesEnabled`; `cookieHealth` notifies after two counted failures in a row (`EXPIRED_COOKIES`, or an unusable external file), because one can be a YouTube page change.
- Bot check, network and timeout results are recorded `skipped` and neither count nor reset the streak: bot checks are IP-based even with valid cookies. `UNKNOWN` records an error that never counts.
- A download run that passed the cookies and printed yt-dlp's "no longer valid" warning notifies at once (`downloadJobFinalizer`), unless it also hit a bot check; it records a run with trigger `download`.
- That report matches `ytdlpStderrSignals.containsRejectedCookiesWarning`, anchored to yt-dlp's own warning line, not `isCookiesRejected`: error lines carry file paths, and a video title there can hold the same words.
- A download's rejection counts as the first failed check even when its notification is not delivered, and is recorded once then, so the next failing check retries instead of starting the streak.
- One notification per cookie file, keyed by the first 16 hex characters of `membersAccess`'s cookie key, never the full hash: run details reach the Scheduling page. A later pass does not re-arm it.
- The `unreadable` marker stands for a condition, not a file, so a readable file clears it (`track`): the file going missing again is a new incident.
- A file counts as notified only when a service accepted the message (`sendCookiesInvalidNotification` resolves true), so notifications that are off or failing are tried again at the next failure.
- Checks and download reports run one at a time (`serialize`): interleaved across their awaits, a slow notification for a replaced file undid its replacement's mark, and a report made during a check was recorded as newer than that check's result.
- The run history is the persistence layer, as for `tabCountThrottle`: every run `cookieHealth` describes, skipped ones included, writes the streak and the notified file into its details. The Test cookies button never touches this state.
- After a restart it reads the newest run that has details (`getLatestRun` with `withDetails`), so a row recorded without them cannot hide the notified file; `runScheduledCheck` never rejects for the same reason.

## Runs that outlive their cookie file

- `ytdlpProcess` sets `child.cookieKey` to the SHA-256 of the bytes it copied for the run, the same hash `membersAccess` keys the file by. Never re-read the file for it: an external updater can replace it between two reads.
- `downloadExecutor` passes that key to the finalizer, and `cookieHealth.reportDownloadRejection` and `membersAccess.recordDownloadOutcome` drop what the run saw when it no longer matches the configured file: rejection, denials, confirmations.
- `getExternalCookiesStatus` returns named fields only, so the key never reaches `GET /api/cookies/status`.

## Members-only access (`membersAccess`)

- Without cookies, or without a live login cookie (`loginCookiesLive`, unreadable file included), every download keeps `availability!=subscriber_only`: such refusals never record denials. With live cookies channel runs exclude fresh denials by id (`id!~=`). yt-dlp applies a match filter to a video URL only after fetching it, so playlist jobs drop denials from their URL lists before queuing.
- Manual jobs clear the requested ids' verdicts and attempt them; External API requests (`EXTERNAL_REQUEST_JOB_LABEL`) keep the no-cookies filter, since they must not use the owner's membership.
- A verdict (`video_members_access`) counts for 24 hours and only under the same `cookie_key` (SHA-256 of the cookie file, memoized by path, size and mtime), so replacing cookies retires every verdict without a write.
- A "Join this channel" refusal records a denial only if yt-dlp really got `--cookies` (`child.cookiesPassed`; preparation drops it for an unusable file), the file holds a live login cookie (`cookieDetails`), and no "cookies are no longer valid"/rotated warning was printed.
- A rejection seen by a run or check is kept in memory per cookie key for 24 hours (`markCookiesRejected`) and keeps `availability!=subscriber_only`, else rejected-but-live cookies retry every members-only video each run; `confirmed` clears it.
- Ids come from yt-dlp output an uploader can shape with a title and end up in a yt-dlp regex, so only `[A-Za-z0-9_-]{11}` ids are stored or put in the filter (`membersAccessState.isVideoId`).
- Any successful yt-dlp read or download of a members-only video records `confirmed`; a successful read with another availability deletes the row and resets the channelvideos availability. A cached `.info.json` proves nothing, so it reads the recorded state instead.
- A video without `members_access` reads as blocked on the client (`isMembersOnlyBlocked`), matching servers and failed lookups from before access was tracked.
- `membersAccessState` holds the states and pure checks without models, so the Jest manual mock shares the real `isBlockedState`.
