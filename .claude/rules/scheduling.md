---
paths:
  - "server/modules/scheduleConfig.js"
  - "server/modules/scheduledTaskManager.js"
  - "server/modules/scheduledTaskRuns.js"
  - "server/modules/cronJobs.js"
  - "server/routes/schedules.js"
  - "server/routes/runNowResponse.js"
  - "client/src/components/Configuration/schedules.ts"
  - "client/src/components/Configuration/sections/SchedulingSection.tsx"
  - "client/src/components/Configuration/sections/components/Schedule*.tsx"
  - "client/src/components/Configuration/sections/components/runNowHint.ts"
  - "client/src/components/Configuration/sections/components/scheduleDisplay.ts"
  - "client/src/components/Configuration/sections/components/RunNowControl.tsx"
  - "client/src/components/Configuration/hooks/useScheduleStatus.ts"
  - "client/src/components/Configuration/hooks/useRunScheduledTask.ts"
  - "client/src/components/Configuration/hooks/useNow.ts"
  - "client/src/components/layout/ScheduledTaskIndicator.tsx"
  - "client/src/hooks/useRunningScheduledTasks.ts"
---

# Scheduling

The cron schedules, the scheduled task manager, the run history, and the Scheduling settings page.

## Expressions (`scheduleConfig`)

- The registry holds the eight configurable schedules (config key, label, default). `getScheduleError` checks syntax via node-cron plus a 15-minute minimum interval, computed structurally with node-cron's own step semantics.
- The across-midnight case asks the matcher whether two firing days are consecutive, so a Sundays-only `5,55 0,23` schedule is not rejected.
- `normalizeToMinimumInterval` (applied by `configModule` at startup) drops runs closer than 15 minutes apart, never adds, and keeps the hour and calendar fields (`0,5 2 * * 0` becomes `0 2 * * 0`).
- That normalization exists so pre-floor hand edits keep running instead of blocking every Settings save, since the client saves the full config.
- `getNextRun` steps node-cron's internal time matcher (`node-cron/src/time-matcher`, which node-cron 4 lacks) over the minutes and hours the expression can fire on, so predictions match what fires.
- When clocks fall back, `getNextRun` adds the repeated period, derived from the offset change so thirty-minute zones such as Lord Howe work, because `setHours` only yields an ambiguous time's first occurrence.
- node-cron 3 reads `a-b/n` as "divisible by n" (`0/15` is hourly, DOM `*/11` is 11,22), rewrites the first weekday `7` to `0` before ranges (`5-7` = Sunday through Friday), and reads reversed ranges low to high.
- The client preview (`describeSchedule`) rebuilds the expression from node-cron's own reading of each field before handing it to cronstrue, and only when `isSupportedCronSyntax` passes (a client mirror of the server's field rules and node-cron's parser).
- Anything cronstrue still rejects falls back to echoing the expression instead of throwing during render; so do `10/11`, `L`, `#` and other syntax the save would reject.

## Task manager

- `scheduledTaskManager.updateTask({ id, expression, enabled, run, isRunning, getRunBlocker, manualCooldownMs, manualRunRequiresEnabled })` replaces a timer only when the expression changes, keeps the previous timer on an invalid edit, and skips an occurrence while the previous run is active.
- Every run is recorded through the recorder injected by `setRunRecorder` (wired in server.js once the DB is ready). `run` is always called as `run({ trigger, ...args })`.
- `runNow(id, { trigger, args, enforceEnabled, enforceCooldown })` is the single entry point for manual runs: Scheduling's Run now via `routes/runNowResponse.js`, the Maintenance rescan, Watch Status Sync Now, the yt-dlp update button, and Download New.
- `runNow` returns `{ started, completion }` or a blocker, checked in order: running (the manager's flag or the task's `isRunning` probe) -> the task's `getRunBlocker` -> turned off -> the manual-run cooldown (`MANUAL_RUN_COOLDOWN_MS`, channel video counts only).
- `manualRunRequiresEnabled: false` (channel downloads) means the feature switch only stops the timer, not a manual run; channel downloads are refused only while a sweep is running.
- A task whose work outlives it may resolve with `finalRecord` (a promise of the run record): the lock is released as usual and only the history row waits (`finishWhenSettled`), so a stuck `finalRecord` never holds a task running.
- A rejected `finalRecord` closes the row as an error; a row still open at shutdown becomes interrupted.
- A `finalRecord` may carry the work's real `finishedAt` (the channel sweep's does, from `sweepRunSummary.toRunRecord`); `describeResult` passes it to `scheduledTaskRuns.finish` in place of the current time.
- `getTaskSnapshot(id)` reads the run blocker and the task's status together, after the run history, so `running` and `runNow` on `GET /api/schedules` never disagree.
- `scheduledTaskStatus` broadcasts (`{ key }`) tell open Scheduling pages to refetch; `announceRun(id, promise)` gives the same broadcast to startup passes that run outside the manager (library repair, the yt-dlp channel re-apply, the channel-count refresh).
- Tasks resolve to `{ status: success|error|skipped, outcome, message, details }`. Feature tasks map their results through adapters (`mediaServers/watchStatusRunSummary`, `channelAutoDownload`, `backfillFromCompleteList`, `rescanRunSummary`, `ytdlpUpdateRunSummary`) so an overlapped, deferred or partly failed run is never recorded as a success.
- A run whose work partly failed (some deletions or folder removals, some archive writes, the playlist half of a sweep, one media server of a sync) records `error` with outcome `partial` and counts in its message.
- `scheduledTaskRuns` keeps 20 rows per task in `scheduled_task_runs`, never pruning a running row or the newest row of each outcome (so "last installed" survives any number of later checks).
- The recorder is best-effort, so a DB problem never reaches the task; `markInterruptedRuns()` at startup flags rows a crashed process left running.
- Startup passes (rescan, library repair, channel-count refresh) record themselves; every scheduled and manual run is recorded by the manager through `runNow`. `jobModule.runStartupBackfill` records one finished row because it starts before `markInterruptedRuns()`.
- Last-run displays (Maintenance page, YT-DLP page via `/api/ytdlp/latest-version`) read the history, falling back to the legacy `rescanLastRun` / `ytdlpLast*` config keys, which are no longer written, until a run has been recorded.

## Scheduling page

- `useScheduleStatus` times a refetch just after a blocked task's `availableAt` passes so Run now re-enables on schedule. Timestamps render in the server's zone via `utils/formatters.formatDateTimeInZone`; relative times tick through `Configuration/hooks/useNow`, corrected by the hook's `clockOffsetMs`.
- Run lengths come from `lastFinishedRun` (`scheduledTaskRuns.getLatestFinishedRuns`: the newest success/error run, so a skipped or interrupted latest run does not hide the previous length, shown as "previous run took"); an interrupted last run shows "by a server restart" instead.
- `RunNowControl` is a sibling of the Radix accordion trigger, never inside it; automatic video cleanup confirms before Run now, since it deletes files.
