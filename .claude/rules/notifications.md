---
paths:
  - "server/modules/notifications/**/*"
  - "server/modules/notificationModule.js"
  - "client/src/config/notificationLinkTemplate.ts"
---

# Notifications

Multi-service notifications via Apprise (Discord, Slack, Telegram, Email, Pushover, Gotify, Ntfy, Matrix and others).

- The Dockerfile installs Apprise unpinned, so rendering can change between images; check `apprise.__version__` before blaming a formatter. In 2.1.0 (tested 2026-11-05), Slack `*bold*` renders as `_italic_`, and in Telegram bodies a `\n` between tags collapses to a space.
- `serviceRegistry` detects the service from each Apprise URL; `formatters/` hold the per-service message formatters and `senders/` the delivery mechanisms (Discord webhooks, Apprise). Every formatter renders `jobIssues` and diagnoses through `utils.getStoppedLines` and the "Likely cause" lines.
- `notificationLinkTemplate` is an `http(s)` URL with one `{youtubeId}` variable. Empty changes nothing; otherwise the download notification turns each video title into a link in the Discord, Slack, Telegram and Email formatters.
- The plain formatter ignores the template, and so do the auto removal and download pause notifications.
- `notifications/index.js` passes it as `formatDownloadMessage(finalSummary, videoData, { linkTemplate })`; `utils.buildVideoLink` returns null for an invalid template or a video without a valid `youtubeId`.
- `utils.getLinkTemplateError` validates the template; `routes/config.js` runs it on save only when the value changed, and `client/src/config/notificationLinkTemplate.ts` mirrors it.
- Each formatter escapes the link for its own syntax: Discord `[title](url)`; Telegram and Email `<a href>`; Slack `[title](<url>)`, which Apprise turns into Slack's `<url|title>`.
- The raw Slack form breaks one-word titles in Apprise 2.x, and the Slack title escapes `\ < > [ ]` with a backslash.
