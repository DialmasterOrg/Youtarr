---
paths:
  - "server/modules/configModule.js"
  - "server/routes/config.js"
  - "client/src/config/**/*"
  - "client/src/hooks/useConfig.ts"
  - "client/src/components/Configuration/**/*"
  - "client/src/components/Settings/Settings.tsx"
  - "client/src/components/Settings/SettingsIndex.tsx"
---

# Settings and config

`config/config.json`, the `/getconfig` and `/updateconfig` routes, and the Settings pages.

- New config fields go in the `CONFIG_FIELDS` registry (`client/src/config/configSchema.ts`), which derives types, defaults and change tracking, in `docs/CONFIG.md`, and in `config/config.example.json` with the same default (`configSchemaAlignment.test.ts` compares them).
- Legacy `cronSchedule` is auto-migrated to `channelDownloadFrequency` at startup.
- The client saves the full config, so one invalid stored value would block every Settings save: `configModule` corrects or clears hand-edited values on load (startup and the file-watch reload) instead of rejecting them (`normalizeStorageSizeFields`, `scheduleConfig.normalizeToMinimumInterval`).
- `/updateconfig` re-checks custom yt-dlp options and the notification link template only when their value changed, so an unchanged bad value cannot block every save; schedules and storage sizes are validated on every save.
- It always returns `customArgsCheck` for the value it saved; the client applies it after Save.
- `/getconfig` carries `customArgsCheck` for the saved value, and the client renders the blocked, unreadable and warning notices from the server (`sections/components/CustomArgsCheckAlerts`); the yt-dlp option list never reaches the client.
- `hooks/useConfig.ts` is a legacy raw-`fetch` hook; do not copy it (new hooks use axios). `useConfig().loggingStatus` exposes `/getconfig`'s `logging` block.
- `CONFIG_UPDATED_EVENT` is the one sanctioned custom event for decoupled config refresh. Settings sections live under `Configuration/sections/` (routed as `/settings/<key>` from `Settings/SettingsIndex.tsx`), reusable settings UI in `Configuration/common/`, feature hooks in `Configuration/hooks/`.
- Storage limits (`/settings/storage-limits`, `StorageLimitsSection.tsx`) read the pause status through `hooks/useDownloadPauseStatus`; the pause rules are in `.claude/rules/downloads.md`.
- `routes/config.js` also serves the cookie upload, status, delete and test endpoints; the `POST /api/cookies/test` rules are in `.claude/rules/cookies.md`.
