---
paths:
  - "server/modules/feeds/**/*"
  - "server/routes/feeds.js"
  - "client/src/components/Configuration/sections/RssFeedsSection.tsx"
  - "client/src/components/Configuration/hooks/useDownloadsFeedToken.ts"
---

# RSS feeds

The `/feeds` namespace for RSS readers: the download feed today, with the podcast feeds of #533 planned beside it.

- `GET /feeds/downloads.xml` skips `verifyToken`, because readers can't log in and `verifyToken` opens everything under `AUTH_ENABLED=false`. `downloadsFeed.isAuthorized` always checks the token, so a login proxy exemption for `/feeds/` stays safe.
- A wrong token and a disabled feed both answer 404. The `/feeds` catch-all keeps an unknown path from falling through to the SPA.
- The token stays in the query string because `redactUrl` in `server.js` only strips `?token=` from request logs; a path token would reach the log files.
- `downloadsFeedToken` is unhashed in `config.json` so Settings can show the URL again. It is read-only by design: never reuse an API key here.
- The token is server-owned: `/getconfig` omits it and `/updateconfig` restores it, because the client saves the full config and a stale tab would undo a new URL. It is absent from `CONFIG_FIELDS` and the config template.
- `GET /api/feeds/downloads/token` creates the token on first request, so the client only asks while the feed is on.
- The GUID is the video ID alone: `last_downloaded_at` is rewritten at job save and job recovery, so a date in it would repeat one download. `pubDate` is the download time, so a backfilled old video still reads as new.
- `lastBuildDate` is the newest item's date, not the current time: identical bytes let Express's ETag answer a repeat poll with 304.
- `rssWriter.escapeXml` strips characters XML 1.0 forbids, because one in a description makes a strict reader reject the whole feed.
- Thumbnails use `i.ytimg.com`, because an https reader blocks an http Youtarr image and a login proxy can block `/images`. Only a video removed from YouTube uses Youtarr's copy.
- `feedSettings` is pure so `configModule` can require it to correct hand-edited values on load. `downloadsFeed` normalizes again on read, because a stale browser tab can save a config without the new fields.
- There is no public URL setting: the "This Youtarr" link saves the browser's origin as a link template, so only the feed's home link and the removed-video thumbnail use the request's host.
