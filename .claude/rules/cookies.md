---
paths:
  - "server/modules/externalCookies.js"
  - "server/modules/uploadedCookies.js"
  - "server/modules/cookieTest.js"
  - "server/modules/cookieDetails.js"
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
