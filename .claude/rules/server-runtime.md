---
paths:
  - "server/server.js"
  - "server/logger.js"
  - "server/db.js"
  - "server/logging/**/*"
  - "server/modules/logFilesModule.js"
  - "server/modules/logLevelSync.js"
  - "server/modules/databaseSocket.js"
  - "server/modules/youtubeExistenceCheck.js"
  - "server/modules/webSocketServer.js"
  - "server/modules/webSocketAuth.js"
  - "server/modules/messageEmitter.js"
  - "server/modules/databaseHealthModule.js"
  - "server/modules/sessionAuth.js"
  - "server/routes/logs.js"
  - "server/routes/auth.js"
  - "server/routes/health.js"
  - "client/src/App.tsx"
  - "client/src/providers/WebSocketProvider.tsx"
  - "client/src/contexts/WebSocketContext.ts"
  - "client/src/hooks/useDownloadListingsRefresh.ts"
  - "client/src/components/Configuration/sections/LoggingSection.tsx"
  - "client/src/components/Configuration/hooks/useLogDownload.ts"
---

# Server runtime

Process lifecycle, logging, DNS and database connections, the WebSocket, and sessions.

## Process, DNS, database (issue #921)

- `server.js` logs unhandled promise rejections instead of exiting.
- `dns.lookup` runs on libuv's threadpool, which runs only 2 lookups at a time; offline, each internet lookup hangs ~16 s, and the database host's lookup queued behind them outlasted mysql2's 10 s connect timeout although the database was fine.
- `databaseSocket` is mysql2's `stream` factory (`db.js` `dialectOptions.stream`): it reuses the last address a connection reached and looks the host up again only after a connection fails before connecting.
- `youtubeExistenceCheck` (the oEmbed HEAD "does this video still exist" check behind the channel and Videos listings) resolves through c-ares (`dns.Resolver`, off the threadpool; A and AAAA in parallel, IPv4 first, so an IPv6-only host still connects).
- It answers `exists`/`removed`/`unknown`; callers leave `youtube_removed_checked_at` alone on `unknown`, so the check runs again later. After a request gets no answer it pauses checks for 5 minutes, then lets one request at a time test whether YouTube answers.

## Logging

- Both pino transports are pinned to `trace`, so the root level is the only filter and `logger.applyLevelSetting` can change it live; `logLevelSync` applies the `logLevel` setting ('' = `LOG_LEVEL`) at startup, on config change, and in the post-processor.
- Never log a field named `level`: it overwrites pino's level and the record is dropped.
- Only the server process (`process.argv[1]` is `server.js`) also writes the console format, without colors or ANSI codes, to `config/logs/youtarr.<n>.log` through `logging/logFileTransport.js` (pino-roll with `removeOtherLogFiles`, so earlier runs' files are pruned; `LOG_FILE_MAX_SIZE` 10MB, `LOG_FILE_MAX_COUNT` 5).
- The post-processor, scripts and tests never write log files; post-processor output already reaches the server log through yt-dlp's stdout.
- A file error prints one stderr notice and stops file output only; an unwritable folder is detected at startup and reported through `logger.getLoggingStatus()`, served as `logging` on `/getconfig` and shown by `LoggingSection`.
- `GET /api/logs/download` serves all files oldest first, line by line through `logging/logScrubber.js`, which replaces the configured keys and tokens, Apprise URLs, `X-Plex-Token`/`X-Emby-Token`/`api_key` values and URL userinfo with `[REDACTED]`. Files on disk are not scrubbed.
- That scrubbing exists because pino's redaction only covers top-level keys, and tokens reach the log inside logged axios errors and the logged yt-dlp args. The client downloads logs through an axios blob (`useLogDownload`), since a link cannot send `x-access-token`.

## WebSocket

- The WebSocket shares the HTTP port (3011 in the container, 3087 on the host) via `ws`; there is no separate WS port. The upgrade bypasses Express (no `verifyToken`), so `webSocketServer` authorizes it through `webSocketAuth` before the handshake.
- The upgrade is accepted only on `/ws` and only with an active session (`sessionAuth.findActiveSession`, the same lookup `verifyToken` uses); API keys are refused; anything goes with `AUTH_ENABLED=false`.
- Browsers cannot set handshake headers, so `WebSocketProvider` (rendered inside `AppContent`, no connection while `token` is null) offers `youtarr` plus `youtarr.auth.<token>` as subprotocols and the server echoes `youtarr`, keeping the token out of URLs and proxy logs.
- Open sockets are re-checked every 5 minutes (one lookup per session, however many tabs share it) and closed with 1008 once their session expired or was revoked; a lookup error keeps them.
- A refused handshake reaches the browser only as 1006, so the provider calls `onSessionCheckNeeded` on a 1008 close and on every 3rd attempt in a row that never opens (about every 90 s at the 30 s backoff cap).
- `AppContent` then re-runs `/auth/validate` and signs out only on 401/403, so an outage never logs anyone out; a check that could not reach the server is retried by the next 3rd attempt.
- Clients never send data (`maxPayload` 1 KB), and every socket has an `error` listener, because ws rethrows an invalid frame's `error` without one and that crashed the process.
- The server pings clients every 30 s and terminates unresponsive ones (proxy idle-timeout guard).
- On connect the server replays only the last stored final-state message, never in-flight progress; the activity page seeds over REST instead (`.claude/rules/downloads.md`). The provider emits a local `connectionRestored` message after every reconnect.
- Broadcast types: `videoActivityUpdated`, `downloadProgress`, `downloadComplete`, `jobsUpdated` (a job is enqueued or flips to In Progress), `videosUpdated` (per video mid-batch, after its rows persist), `rescanStatus`, `scheduledTaskStatus`, `downloadPauseChanged`. Listing pages refetch through `client/src/hooks/useDownloadListingsRefresh.ts`.
