# Elfhosted Developer Guide

This guide is for developers working on Youtarr changes that interact with the Elfhosted platform deployment. It covers what makes a deployment "Elfhosted" from the code's perspective, the environment variables that toggle the related behavior, and how to spoof Elfhosted locally for testing.

End-user, customer-facing Elfhosted documentation lives at https://docs.elfhosted.com/app/youtarr.

## Table of Contents

- [Why Elfhosted is Special](#why-elfhosted-is-special)
- [The Four Environment Variables](#the-four-environment-variables)
- [Behavior Matrix](#behavior-matrix)
- [Spoofing Elfhosted Locally](#spoofing-elfhosted-locally)
- [Code Touchpoints](#code-touchpoints)
- [Testing Patterns](#testing-patterns)
- [Common Pitfalls](#common-pitfalls)

## Why Elfhosted is Special

Elfhosted runs Youtarr as a managed app inside a Kubernetes-style platform. That means a few baseline assumptions normal self-hosters can rely on do not hold:

- Authentication is handled by the platform (Cloudflare Access, Authelia, etc.), so Youtarr's built-in login flow gets in the way.
- The video output directory is on slow rclone-backed remote storage, so downloads must be staged to fast local temp space first.
- Persistent data needs to live under a single `/app/config/` mount instead of being scattered across `./config`, `./jobs`, and `./server/images`.
- The yt-dlp binary is provisioned by the platform's image build, so Youtarr must not try to self-update it (the in-container update path lacks write permission and would silently fail).

The codebase encodes these assumptions through four orthogonal environment variables. None of them are exclusive to Elfhosted, but Elfhosted is the canonical deployment that sets all four together.

## The Four Environment Variables

### `PLATFORM`

The Elfhosted-specific switch. Detected by `configModule.isElfhostedPlatform()` in `server/modules/configModule.js:321` (case-insensitive `=== 'elfhosted'`). Also surfaced to the frontend as `deploymentEnvironment.platform` via `/getconfig` (`server/routes/config.js:164-165`).

When `PLATFORM=elfhosted`:

- **Backend, on every config save and reload:** `useTmpForDownloads` is forced to `true` and `tmpFilePath` is forced to `/app/config/temp_downloads` (`configModule.js:107-108, 372-373, 486-487`). These overrides are runtime-only; they are stripped from the persisted `config.json` so they do not survive a platform switch (`configModule.js:393-394`).
- **Backend, on startup with `DATA_PATH` also set:** the temp downloads directory `/app/config/temp_downloads` is auto-created (`configModule.js:340-346`).
- **Backend, nightly cron (4:00 AM):** the yt-dlp auto-update job no-ops, regardless of the `autoUpdateYtdlp` config toggle (`server/modules/cronJobs.js:178`).
- **Backend, manual update route:** `POST /api/ytdlp/update` returns `403` with `{ success: false, message: 'yt-dlp is managed by the platform and cannot be updated from Youtarr.' }` (`server/routes/health.js:277-282`).
- **Backend, `/getconfig` response:** the `isPlatformManaged` object exposes `useTmpForDownloads: true` and `ytdlpUpdates: true` so the frontend can disable the corresponding controls (`server/routes/config.js:160-161`).
- **Frontend:** the Youtarr-version-update banner is suppressed (`client/src/App.tsx:92, 96`). When the `/tmp` directory warning fires, an Elfhosted setup-guide link is appended (`App.tsx:577-589`). In Settings, the "External temp directory" control (Settings -> Core -> **Advanced**) and the yt-dlp card (Settings -> YT-DLP) show "Managed by Elfhosted" chips and platform-managed messages (`client/src/components/Configuration/sections/CoreSettingsSection.tsx:191-198`, `client/src/components/Configuration/sections/YtdlpUpdateSection.tsx:105-121`), and the downloads folder on Core's **Library folders** card says the platform configures it (`client/src/components/Configuration/sections/components/LibraryFoldersCard.tsx:32-36, 82-83`).

### `AUTH_ENABLED`

Independent of `PLATFORM`. When `AUTH_ENABLED=false`:

- `/setup/status` returns `{ requiresSetup: false, platformManaged: true, message: 'Authentication is managed by the platform' }` (`server/routes/setup.js`).
- The frontend auto-logs in with the synthetic token `'platform-managed-auth'` and skips the login screen (`client/src/App.tsx:345-349`).
- All API endpoints accept requests without a token. The bypass is implemented in two places: `verifyToken` short-circuits when `AUTH_ENABLED === 'false'` (`server/server.js:443`), and the local-login route does the same (`server/routes/auth.js:101`).
- Login and logout buttons are hidden in the UI; `isPlatformManaged.authEnabled` is `false` in `/getconfig` (`server/routes/config.js:159`). The frontend logout button gates on the App-level `isPlatformManaged` boolean (`client/src/components/layout/NavHeaderActions.tsx:159`), and the Youtarr-version-update tooltip is suppressed by the same flag (`NavHeaderActions.tsx:44`).

This is the standard way Elfhosted bypasses Youtarr's local-account flow. It can also be enabled in dev with the `--no-auth` flag to `start-dev.sh` (`scripts/_shared_start_tasks.sh:313-318`).

### `DATA_PATH`

Independent of `PLATFORM`. Detected by `configModule.isPlatformDeployment()` (`configModule.js:317`). When set:

- The container reads/writes downloaded videos under `DATA_PATH` instead of the default `/usr/src/app/data` (`configModule.js:52, 634`).
- Persistent data relocates from `./jobs` to `/app/config/jobs/`, and from `./server/images` to `/app/config/images/` (`configModule.js:349-361`).
- `/getconfig` reports `isPlatformManaged.youtubeOutputDirectory: true` so the UI shows the path read-only (`server/routes/config.js:157`).
- `youtubeOutputDirectory` in the UI resolves to `process.env.YOUTUBE_OUTPUT_DIR || process.env.DATA_PATH` (`server/routes/config.js:171`).

`DATA_PATH` is documented in `docs/ENVIRONMENT_VARIABLES.md` and `docs/DOCKER.md`. Most self-hosters never need it.

### `PLEX_URL`

Independent of `PLATFORM`. When set:

- The Plex IP, port, and HTTPS fields are disabled in the UI (`isPlatformManaged.plexUrl: true` from `server/routes/config.js:158`).
- The value seeds `config.plexUrl` on first-run config creation (`configModule.js:273-276`).
- `config.plexUrl` takes precedence over `plexIP`/`plexPort`/`plexViaHttps` everywhere it is consulted (see `docs/CONFIG.md`).

Used by Elfhosted to point Youtarr at the bundled Plex instance.

## Behavior Matrix

| Variable | Sets `isElfhostedPlatform()` | Forces tmp downloads | Hides yt-dlp updates | Bypasses login | Relocates persistent data | Locks Plex URL |
|---|---|---|---|---|---|---|
| `PLATFORM=elfhosted` | yes | yes | yes | no | no | no |
| `AUTH_ENABLED=false` | no | no | no | yes | no | no |
| `DATA_PATH=<path>` | no | no | no | no | yes | no |
| `PLEX_URL=<url>` | no | no | no | no | no | yes |

A real Elfhosted deployment sets all four. Most local-test scenarios only need the one (or two) you are exercising.

## Spoofing Elfhosted Locally

The dev compose file (`docker-compose.dev.yml`) forwards all four Elfhosted-relevant env vars (`AUTH_ENABLED`, `PLATFORM`, `DATA_PATH`, `PLEX_URL`) using the `${VAR:-}` form, so they default to empty when unset on the host and have zero effect on normal dev runs. The `./scripts/start-dev.sh` script has an `--as-elfhosted` flag that handles the common cases for you.

### Recipes

**Minimum viable Elfhosted spoof - for most Elfhosted-related work:**

```bash
./scripts/start-dev.sh --as-elfhosted
```

This exports `PLATFORM=elfhosted` and `AUTH_ENABLED=false` for the run, prints a `yt-warn` summary of what is and is not spoofed, and otherwise behaves like `./scripts/start-dev.sh --no-auth`. It is enough to exercise:
- yt-dlp update gating (cron skip and `POST /api/ytdlp/update` returning 403)
- Auto-login with the synthetic `'platform-managed-auth'` token (no login screen)
- The "Managed by Elfhosted" chips and platform-managed copy in Settings
- Suppression of the Youtarr-version-update banner
- The Elfhosted setup-guide link in the `/tmp` warning Snackbar
- The `useTmpForDownloads` runtime override in `configModule.js` (downloads stage in `./config/temp_downloads/` on the host, auto-created on first download via `tempPathManager.cleanTempDirectory`)

The flag does **not** set `DATA_PATH` or `PLEX_URL`, because those need real values, not constants. Without them:
- Plex IP/port fields in Settings remain editable (no "Platform Managed" lock).
- Persistent data stays in the normal dev locations (`./jobs/`, `./server/images/`) instead of relocating to `/app/config/jobs/` and `/app/config/images/`.
- The **Downloads folder** line on Core's **Library folders** card still shows the Elfhosted copy: it follows `PLATFORM`, not `DATA_PATH` (`DATA_PATH` alone, without `PLATFORM`, shows "Set by the DATA_PATH environment variable."). The Library folders page header follows `DATA_PATH` only, so it still says "set by YOUTUBE_OUTPUT_DIR".

That is fine for almost all dev work; downloads and the new yt-dlp gating both work end-to-end. Set the extra vars only when you specifically need to test code that consults `DATA_PATH` (storage-status path, persistent-data relocation, image/jobs directories) or `PLEX_URL` (Plex URL locking, `plexUrl` config seeding).

**Full platform-deployment spoof - also relocates persistent data and locks the Plex URL:**

Add to your `.env` for the duration of the test:

```dotenv
DATA_PATH=/usr/src/app/data
PLEX_URL=http://your-plex:32400
```

Then run with the flag:

```bash
./scripts/start-dev.sh --as-elfhosted
```

The flag picks up `DATA_PATH` and `PLEX_URL` from `.env` automatically (because the dev compose forwards them) and the `yt-warn` output will reflect that they are now set. Note that with `DATA_PATH` set, persistent data moves under `/app/config/` inside the container, which is the bind-mounted `./config/` directory on the host; your existing `./jobs/` and `./server/images/` directories will not be read.

### What `--as-elfhosted` cannot replicate

Even with all four env vars set, the local spoof cannot stand in for everything Elfhosted handles:

- **Cloudflare Access / Authelia / external auth** - Elfhosted relies on an upstream auth proxy. `AUTH_ENABLED=false` only tells Youtarr to trust the upstream; there is no upstream in dev.
- **rclone-backed remote storage** - the production `DATA_PATH` points at network storage with its own latency profile. The dev mount is local disk.
- **The platform's own yt-dlp build** - Elfhosted ships yt-dlp via its container image, not via Youtarr's update path. Locally you still have whatever `yt-dlp` is in the dev container.

These limitations are by design. If you need to verify behavior under those conditions, do it on a real Elfhosted deployment.

### What you should see

After `./scripts/start-dev.sh --as-elfhosted`:

- The startup log includes a `yt-warn` line "Spoofing Elfhosted deployment for this run." followed by what is and is not spoofed.
- No login screen - the app auto-authenticates with the synthetic `'platform-managed-auth'` token (from the `AUTH_ENABLED=false` half of the spoof).
- The logout button is hidden in the nav header (`NavHeaderActions.tsx:159`).
- The Youtarr self-update banner does not appear, even when a newer Youtarr version is published to Docker Hub (suppressed via `isElfHosted` in `client/src/App.tsx:92, 96`).
- Settings -> Core -> **Advanced**, in the **External temp directory** row: "Managed by Elfhosted" chip, the switch is disabled and forced on.
- Settings -> Core, the **Library folders** card: the **Downloads folder** line reads "This path is configured by your platform deployment and cannot be changed here." (`LibraryFoldersCard.tsx:32-36, 82-83`).
- Settings -> YT-DLP, in the **yt-dlp Version & Updates** card: "Managed by Elfhosted" chip, no Update button, no release-channel picker, no auto-update toggle, replacement caption: "yt-dlp is managed by Elfhosted and cannot be updated from Youtarr. Updates are applied automatically by the platform."
- `curl -i -X POST http://localhost:3087/api/ytdlp/update` returns `403` with the platform-managed message body.
- Downloads still work; they stage in `./config/temp_downloads/` on the host (auto-created on first download).
- If the `/tmp` warning fires (e.g., your `YOUTUBE_OUTPUT_DIR` resolves to a `/tmp` path), the warning Snackbar gets an extra "Elfhosted setup guide" link (`App.tsx:577-589`).

Additional behavior only when you also set `DATA_PATH` in `.env`:

- Settings -> **Library folders**: the page header says the downloads folder is "set by DATA_PATH" instead of "set by YOUTUBE_OUTPUT_DIR" (`client/src/components/LibraryFolders/components/PageHeader.tsx:17`). It follows `isPlatformManaged.youtubeOutputDirectory` and ignores `PLATFORM`, unlike the Core card.
- Persistent data is read from `/app/config/jobs/` and `/app/config/images/` (bind-mounted to `./config/jobs/` and `./config/images/` on the host) instead of `./jobs/` and `./server/images/`.

Additional behavior only when you also set `PLEX_URL` in `.env`:

- Settings -> Plex: the IP/port/HTTPS fields are disabled with helper text indicating the URL is platform-managed.

### Reverting

Just stop using the flag - `./scripts/start-dev.sh` (without `--as-elfhosted`) returns to normal behavior. The compose-file passthroughs are zero-impact when `PLATFORM`, `DATA_PATH`, and `PLEX_URL` are unset on the host (each forwards as an empty string, which all consumer code paths treat the same as undefined). If you set `DATA_PATH` or `PLEX_URL` in `.env` for a test, remove or comment those lines.

## Code Touchpoints

When you make a change that depends on Elfhosted detection, audit these locations:

**Backend**

- `server/modules/configModule.js`
  - `isElfhostedPlatform()` (line 321) - the canonical check
  - `isPlatformDeployment()` (line 317) - `DATA_PATH`-based, often paired with the above
  - `getImagePath()`, `getJobsPath()`, `getStorageStatus()` - relocate paths when `DATA_PATH` is set
  - The constructor and `updateConfig()` / `saveConfig()` / `watchConfig()` re-apply the temp-downloads override
- `server/modules/cronJobs.js:178` - the yt-dlp update task skips every run; its Run now is refused (`getRunBlocker`, lines 236-238) and its timer stays off (line 254)
- `server/routes/health.js:277` - `POST /api/ytdlp/update` returns 403
- `server/routes/config.js:156-171` - `/getconfig` exposes `isPlatformManaged.{youtubeOutputDirectory, plexUrl, authEnabled, useTmpForDownloads, ytdlpUpdates}`, `deploymentEnvironment.platform` and `youtubeOutputDirectory`
- `server/routes/setup.js:74-81` - `AUTH_ENABLED=false` short-circuits setup status (returns `platformManaged: true`)
- `server/routes/auth.js:101` - local-login route is a no-op when `AUTH_ENABLED=false`
- `server/server.js:443` - the `verifyToken` middleware bypasses auth when `AUTH_ENABLED=false`

**Frontend**

- `client/src/App.tsx`
  - `isPlatformManaged` boolean state (line 77), set from the `/setup/status` response and threaded into the layout (lines 495, 512)
  - `isElfHosted` (line 92) and version-banner suppression (line 96)
  - `/setup/status` `platformManaged` handling and synthetic-token auto-login (lines 345-349)
  - `/tmp` warning Elfhosted link (lines 577-589)
- `client/src/hooks/useConfig.ts:29-38, 65-85` - `isPlatformManaged` (the per-flag object) and `deploymentEnvironment` are split out of the `/getconfig` response and exposed via context to the rest of the app. Note: this is a different object from the App-level `isPlatformManaged` boolean above; both exist for historical reasons.
- `client/src/components/layout/NavHeaderActions.tsx`
  - Hides the logout button when the App-level `isPlatformManaged` boolean is true (line 159)
  - Suppresses the Youtarr-version-update tooltip via the same flag (line 44)
- `client/src/components/layout/NavHeader.tsx:28, 245` and `client/src/components/layout/AppShell.tsx:22, 206` - thread `isPlatformManaged` from `App.tsx` down to `NavHeaderActions.tsx`
- `client/src/components/Settings/Settings.tsx`
  - Uses `isPlatformManaged.plexUrl` to determine whether a Plex server is "configured" (line 86)
  - Passes `isPlatformManaged` into the Core section, the Library folders page, and the Scheduling, Plex and YT-DLP sections, and `isPlatformManaged.authEnabled` into Account Security (lines 307, 322, 336, 348, 433, 486)
  - Skips the post-save yt-dlp version re-check when `isPlatformManaged.ytdlpUpdates` is true (line 226)
- `client/src/components/Configuration/sections/CoreSettingsSection.tsx` - "External temp directory" chip and disabled state, in the **Advanced** section (lines 191-198)
- `client/src/components/Configuration/sections/components/LibraryFoldersCard.tsx` - the **Downloads folder** line's text branches on `deploymentEnvironment.platform === 'elfhosted'`, then `isPlatformManaged.youtubeOutputDirectory` (lines 32-36, 82-83)
- `client/src/components/LibraryFolders/components/PageHeader.tsx:17` - the Library folders page header's "set by DATA_PATH" / "set by YOUTUBE_OUTPUT_DIR" follows `isPlatformManaged.youtubeOutputDirectory` only, not `PLATFORM`
- `client/src/components/Configuration/sections/SchedulingSection.tsx:115` - the yt-dlp update schedule row is marked managed when `isPlatformManaged.ytdlpUpdates` is true: no Run now (`components/ScheduleTaskRow.tsx:135`) and "Updates are managed by your hosting platform." (`components/ScheduleTaskDetails.tsx:10`)
- `client/src/components/Configuration/sections/YtdlpUpdateSection.tsx` - the whole yt-dlp card: version display, Update button, release-channel picker, auto-update toggle. When `isPlatformManaged.ytdlpUpdates` is true, all of those are replaced by the chip and the platform-managed caption (lines 60-61, 105-121)
- `client/src/components/Configuration/sections/PlexIntegrationSection.tsx:159-216` - Plex URL field locking when `PLEX_URL` is set
- `client/src/components/Configuration/types.ts:83-90` - `PlatformManagedState` type; add a new flag here when you add a new platform-managed control

**Tests**

- `server/modules/__tests__/configModule.test.js:519-616, 671-683` - covers `isElfhostedPlatform()`, `isPlatformDeployment()`, and the temp-download override behavior. Uses `process.env.PLATFORM = 'elfhosted'` directly.
- `server/modules/__tests__/cronJobs.test.js` - see the `'yt-dlp auto-update cron job (4:00 AM)'` describe block; `mockConfigModule.isElfhostedPlatform.mockReturnValue(true)` is the gating pattern.
- `server/__tests__/server.routes.test.js` - `'server routes - configuration'` and `'server routes - yt-dlp update'` describe blocks; `configModuleMock.isElfhostedPlatform.mockReturnValue(true)` toggles platform mode per-test.
- `client/src/App.test.tsx:429-542` - frontend Elfhosted-detection tests; injects `deploymentEnvironment: { platform: 'elfhosted' }` into the mocked `useConfig`.
- `client/src/components/Configuration/sections/__tests__/YtdlpUpdateSection.test.tsx` - platform-managed coverage for the yt-dlp card; uses `createPlatformManagedState({ ytdlpUpdates: true })` and `createDeploymentEnvironment({ platform: 'elfhosted' })`.

## Testing Patterns

When you add a new behavior gated on Elfhosted, write tests at three layers:

1. **Module-level**: prove the module's branch responds to `isElfhostedPlatform()` returning true. Mock `configModule` with a jest factory and toggle `isElfhostedPlatform` between tests.
2. **Route-level**: prove `/getconfig` exposes any new `isPlatformManaged.*` flag, and any new gated route returns the right status. The `createServerModule` helper in `server/__tests__/server.routes.test.js` already mocks `configModule`; just call `configModuleMock.isElfhostedPlatform.mockReturnValue(true)` in the test.
3. **UI**: prove the new control hides or disables when `isPlatformManaged.<your-flag>` is true. Use `createPlatformManagedState({ <yourFlag>: true })` and `createDeploymentEnvironment({ platform: 'elfhosted' })` in the section's test file.

Always test the `false` case too - most regressions are "the control is now permanently disabled."

## Common Pitfalls

- **Forgetting to add the new flag to `PlatformManagedState`**. TypeScript will catch this at compile time, but you also have to update every test helper that constructs the type. `npm run lint:ts` will tell you which files.
- **Persisting platform overrides to disk.** `useTmpForDownloads` and `tmpFilePath` are stripped from the saved `config.json` on Elfhosted (`configModule.js:343`). If you add a similar runtime-only override, follow the same pattern or it will leak into non-Elfhosted runs after a config save.
- **Assuming `PLATFORM=elfhosted` implies `AUTH_ENABLED=false` (or vice versa).** They are independent. Test each toggle on its own.
- **Hardcoding the `'elfhosted'` string in new code.** Prefer `configModule.isElfhostedPlatform()` on the backend and `isPlatformManaged.<flag>` on the frontend. The string-comparison is reserved for places that customize chip labels and copy ("Managed by Elfhosted" vs. "Platform Managed").
- **Forgetting that `--no-auth` is a dev convenience for `AUTH_ENABLED=false`.** When debugging an Elfhosted-only login issue locally, use `--no-auth`; do not edit `.env` to flip `AUTH_ENABLED` permanently.
- **Triggering the cron on a real Elfhosted environment.** The 4:00 AM yt-dlp auto-update job is the most recent gating addition. If you add another scheduled job that touches platform-owned binaries, gate it behind `isElfhostedPlatform()` the same way (`cronJobs.js:116`).

## See Also

- `docs/CONFIG.md` - config field reference (some fields are noted as platform-managed)
- `docs/DOCKER.md` § Platform Deployment Configuration - operator-facing summary
- `docs/ENVIRONMENT_VARIABLES.md` - full env var reference
- `docs/AUTHENTICATION.md` - `AUTH_ENABLED=false` behavior
