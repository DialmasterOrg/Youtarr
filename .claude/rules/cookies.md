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
