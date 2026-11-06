# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Youtarr is a Dockerized application that automatically downloads videos from YouTube channels and playlists and integrates them with Plex, Jellyfin and Emby:

- **Backend**: Node.js/Express server with MariaDB database using Sequelize ORM
- **Frontend**: React/TypeScript application with a custom UI layer (Radix primitives + Tailwind CSS, themed via CSS variables)
- **Infrastructure**: Docker Compose setup with separate containers for app and database

This file is the map and the universal rules. The non-obvious behaviors of each area live in `.claude/rules/<area>.md` (listed under "Area notes" below); each loads only when you read or edit a file its `paths:` frontmatter matches. The public docs site is https://dialmasterorg.github.io/Youtarr/ (built from `website/`).

## Scope Discipline

**IMPORTANT: Change only what the task requires.** This rule overrides every other rule in this file and in `.claude/rules/` when they conflict.

- **Bug fixes**: make the minimum change needed to fix the bug. Do not rewrite surrounding code for style, extract helpers you don't need for the fix, or clean up while you're there.
- **Features**: touch only files the feature requires. Write new code to the standards below. Leave pre-existing code alone unless the feature forces you to change it.
- **Refactors**: only when the user explicitly asks for a refactor, and only as wide as the user scopes it.
- **Unrelated issues you notice** (oversized files, duplication, legacy patterns, missing tests, `console.log` calls, `any` types, drifted error-response shapes): list them in your final report so the user can decide whether to address them. **Do not fix them.**
- **When in doubt**: ask. A small clarifying question is cheaper than an unwanted refactor.

The size and quality rules in this file apply to code you are **creating or substantially rewriting**. They are not a mandate to refactor existing code you pass through.

## Task Handling

For multi-part requests (e.g., "review this PR AND explain WebSocket handling"), explicitly acknowledge all parts and complete each one before considering the task done.

## Architecture

### Backend (`server/`)

- `server.js` is the Express entry point, `db.js` the Sequelize setup, `logger.js` the Pino logger (request correlation; file transport and log scrubber in `logging/`).
- `routes/`: one file per API area (auth, channels, videos, videoDetail, videoSearch, videoTrash, channelSearch, config, jobs, plex, setup, subscriptions, apikeys, ytdlpOptions, health, maintenance, playlists, playlistSubscribeSettings, mediaServers, subfolders, schedules, logs, feeds, youtubeApiKey, externalApi, externalRequests; `runNowResponse` and `overrideSettingsValidator` are helpers). Every file is a dependency-injection factory wired in `routes/index.js`; `middleware/` holds the External API auth.
- `models/`: Sequelize models (apikey, apikeychannelgrant, channel, channelvideo, externalapiusagebucket, externalrequest, job, jobvideo, jobvideodownload, mediaserveruser, playlist, playlistsyncstate, playlistvideo, scheduledtaskrun, session, subfolder, video, videowatchstatus, watchstatussynccursor).
- `modules/`: class-based singletons holding the business logic, by area:
  - Downloads: `downloadModule`, `jobModule`, `modules/download/` (yt-dlp command builder, executor, progress monitor, finalizer, run tracker, retry and diagnosis helpers), `ytdlpModule`, cookie handling, `storageGuard`, `archiveModule`, `modules/filenamePreview/` (filename template preview), `modules/constants/` (shared constants).
  - Channels: `channelModule` (facade) over `modules/channel/`, `channelSettingsModule`, `channelDownloadAllModule`, `channelSearchModule`, `titleFilterRegex`, `modules/subscriptionImport/`.
  - Playlists: `playlistModule`, `playlistDownloadModule`, `m3uGenerator`, `playlistOutputRefresh`.
  - Videos and the library: `videosModule`, `videoMetadataModule`, `videoSearchModule`, `videoDeletionModule`, `videoTrashModule`, `videoRemovalState`, `libraryRootCheck`, the rescan (`rescanRowUpdate`, `videoRowGuard`), the info.json cache (`infoJsonSlimmer`, `infoJsonCachePruner`), `subfolderModule`, `modules/filesystem/` (path and file abstraction; the sub-module aggregator pattern to copy).
  - Media servers: `plexModule`, `nfoGenerator`, `modules/mediaServers/` (adapter registry, playlist sync, watch status sync).
  - Scheduling: `scheduleConfig`, `scheduledTaskManager`, `scheduledTaskRuns`, `cronJobs`.
  - Runtime: `configModule`, `webSocketServer` + `webSocketAuth`, `messageEmitter`, `databaseSocket`, `databaseHealthModule`, `sessionAuth`, `apiKeyModule`, `logLevelSync`, `logFilesModule`.
  - Notifications: `notificationModule`, `modules/notifications/` (service registry, formatters, senders).
  - RSS feeds: `modules/feeds/` (RSS writer, download feed, settings limits).
  - External API: `modules/externalApi/` (catalog, requests, executor, permissions).
  - YouTube Data API: `modules/youtubeApi/` (client, quota tracker, error classifier), the optional API path for channel and video search, playlists, metadata and tab counts.
- `utils/`: Python helpers (`validate-cookies.py` runs yt-dlp's cookie parser; `title-filter-regex.py` evaluates Python `re` for channel title filters).

### Frontend (`client/src/`)

- `App.tsx`: routing plus the global `fetch()` override and axios response interceptor that turn a 503 `requiresDbFix` response into the database error overlay.
- `components/`: one directory per feature (`Subscriptions/`, `ChannelPage/`, `PlaylistPage/`, `VideosPage/`, `FindVideos/`, `FindChannels/`, `DownloadManager/`, `SubscriptionImport/`, `Settings/` + `Configuration/`, `ExternalRequests/`); `components/shared/` for cross-feature pieces (`VideoModal/`, `DeleteVideosDialog`, `AddChannelDialog`); `components/ui/` for theme-neutral primitives; `components/layout/` for the app shell and nav.
- `hooks/`, `contexts/`, `providers/` (auth token, WebSocket, theme, video activity), `themes/` (the `ALL_THEMES` registry), `config/` (the `CONFIG_FIELDS` registry), `types/`, `utils/`.

### Database

- MariaDB 10.3 with utf8mb4; migrations in `migrations/` run at container startup. Create them with `./scripts/db-create-migration.sh <name>`, never by hand.

### Reference docs (consult these instead of re-deriving from code)

- `docs/DEVELOPMENT.md`: dev environment setup, `./scripts/build-dev.sh` (flags: `--install-deps`, `--no-cache`) and `./scripts/start-dev.sh` (flags: `--no-auth`, `--debug`, `--headless-auth`, `--pull-latest`, `--dev`, `--arm`, `--external-db`, `--as-elfhosted`), Vite HMR dev server option (`cd client && npm run dev` on port 3000), running tests, Swagger/OpenAPI docs at `/swagger` and `/swagger.json`.
- `docs/DOCKER.md`: Docker architecture (two containers), Compose file variants (main, named-volume override, external-db), volume layout, NAS configuration, backup/restore, platform deployment (`DATA_PATH`, `AUTH_ENABLED`, `PLEX_URL`).
- `docs/DATABASE.md`: schema tables, internal vs external database, migration workflow, idempotent migration helpers, troubleshooting.
- `docs/ENVIRONMENT_VARIABLES.md`: all env vars (`DB_*`, `YOUTUBE_OUTPUT_DIR`, `DATA_PATH`, `YOUTARR_UID/GID`, `AUTH_ENABLED`, `AUTH_PRESET_*`, `PLEX_URL`, `LOG_LEVEL`, `LOG_FILE_MAX_SIZE`, `LOG_FILE_MAX_COUNT`, `OUTPUT_DIR_HEALTHCHECK_TIMEOUT`, `TZ`, `YOUTARR_IMAGE`).
- `docs/CONFIG.md`: `config/config.json` schema. Real field names include `plexApiKey`, `plexYoutubeLibraryId`, `plexSubfolderLibraryMappings`, `plexIP`/`plexPort`/`plexViaHttps`/`plexUrl`, `channelAutoDownload`, `channelDownloadFrequency` (cron), `channelFilesToDownload`, `preferredResolution`, `videoCodec`, `defaultSubfolder`, plus groups for SponsorBlock, notifications (`appriseUrls`), download performance, and auto-removal.
- `docs/AUTHENTICATION.md`: Plex OAuth, local auth (bcrypt, `username`/`passwordHash`), API keys (`x-api-key` header, rate-limited, download-only scope), session management (`x-access-token`, 7-day expiry), headless bootstrap via `AUTH_PRESET_*`.
- `docs/API_INTEGRATION.md`: API key integration for external tools (bookmarklets, iOS Shortcuts, Android Tasker, Home Assistant, cURL/Python/JS). Documents the `/api/videos/download` endpoint, rate limits, and CORS/auth-proxy bypass for Cloudflare Zero Trust and Authelia.
- `docs/TROUBLESHOOTING.md`: common runtime issues.

### Area notes (`.claude/rules/`)

Each file loads on its own when you Read, Edit or Write a matching file. A diff or a search (`git diff`, `rg`, Grep) loads nothing, so before judging or changing code you only saw that way, Read the file; `limit: 1` is enough. This applies to reviews too. A rule loaded here never reaches a subagent, which loads its own through its own reads, and after compaction a rule returns only on the next matching read. A brand-new file loads its area's rules only after its first Write, so read the area's rule file before creating a file in it, and read the relevant ones first when planning work that spans areas.

- `downloads.md`: yt-dlp runs, job queue, archive, storage pause, activity page.
- `cookies.md`: external and uploaded cookie files, the cookie test.
- `channels.md`: subscriptions, listings, title filters, tab counts, channel search, import.
- `playlists.md`: following, download selection, m3u files.
- `media-servers.md`: Plex, Jellyfin and Emby playlist and watch status sync.
- `videos.md`: rescan, library repair, deleted vs. missing, trash, auto-removal, info.json cache.
- `video-search.md`: Find Videos search, local status, single-video lookup.
- `scheduling.md`: cron expressions, task manager, run history, Scheduling page.
- `server-runtime.md`: process, DNS and database sockets, logging, WebSocket, sessions.
- `settings-config.md`: config.json, `/updateconfig`, Settings pages.
- `notifications.md`: Apprise services, formatters, link template.
- `feeds.md`: the token-protected `/feeds` RSS namespace.
- `external-api.md`: the opt-in `/external-api/v1` surface.
- `database.md`: migrations, collation history, models.
- `docs.md`: `docs/` and the published docs site.
- `backend.md`, `frontend.md`, `testing.md`: coding standards for server, client and test files.

## Code Quality Standards (for new and rewritten code)

These apply when you are authoring new code or doing an explicit rewrite. See Scope Discipline above. The per-side specifics (logging, error shapes, route factories, hooks, styling, API calls) are in `backend.md` and `frontend.md`.

- **DRY when writing the third copy**: if you find yourself writing the same logic a third time in your own new code, extract it.
- **Single responsibility**: one clear purpose per module, class or function. If a function name needs "and", split it.
- **Extract deliberately, inline small snippets**: extract a block of roughly 30+ lines with its own props or state, or one used by two structurally different parents; inline one-off snippets. Three similar lines beat a premature abstraction. Before creating a file, decide whether it is substantial enough, which directory it belongs in, and which test file goes alongside it.
- **File size targets for new files**: backend modules under ~500 lines, frontend components under ~300 lines. Legacy files that exceed them (`jobModule.js`, `channelSettingsModule.js`, `videoDeletionModule.js`, `VideosPage/`, `ChannelVideos.tsx`, `DownloadProgress.tsx`) are not examples to follow.
- **Named constants for magic values**: timeouts, retry counts, limits and defaults.
- **Early returns** for error and edge cases, to keep happy-path nesting shallow.
- **Comments** only where the logic is not self-evident. Do not add docstrings, type comments or explanatory prose to code you did not change.

## Security

Youtarr shells out to `yt-dlp` and writes files using user-influenced paths, so this section is not optional.

- **Validate untrusted input at route boundaries**: types, lengths, shape; 400 with `{ error }` for invalid input.
- **Never interpolate user data into shell commands or filesystem paths.** Use `modules/download/ytdlpCommandBuilder.js`, `modules/filesystem/pathBuilder.js` and `modules/filesystem/sanitizer.js`; a new helper goes in those modules, not inline in a route.
- **Auth by default**: new routes wire `verifyToken` unless the user explicitly says the route is public. Call out any public route in your final report.
- **Never log secrets**: do not interpolate tokens, passwords, cookies or API keys into log messages.
- **Treat uploaded files as untrusted**: Takeout CSV and cookies uploads are validated, size-limited and parsed defensively.
- **Sequelize protects against SQL injection only through model methods**; raw queries need explicit parameterization. **Rate-limit** endpoints that accept external identifiers or credentials.

## Testing

**Run tests from the project root.** See `docs/DEVELOPMENT.md` for the full workflow.

```bash
npm run test:frontend                                        # all frontend tests
npm run test:frontend -- client/src/hooks/__tests__/foo.ts   # one frontend test
npm run test:backend                                         # all backend tests
npm run test:backend -- server/modules/__tests__/foo.test.js # one backend test
npm run test:external-api-database                           # real database migration/runtime regressions
npm run test:external-index-plans                            # local synthetic query/EXPLAIN report
npm run lint                                                  # lint front + back, check rule paths
npm run lint:ts                                               # TypeScript typecheck
```

### Tests Accompany New Files
**New component/module files ship with tests in the same change.** Co-locate them in the nearest `__tests__/` directory and cover externally observable behavior: renders with required props, responds to interactions, handles the loading, empty and error states the component declares. Trivial pure-display components (no props, no logic) are the only exception.

### Test Execution Policy
**NEVER skip tests.** No `test.skip()`, no `describe.skip()`, no commented-out failing tests. Fix failing tests or delete them if obsolete. If a test is written, it must run and pass in CI. Testing Library rules, Jest mocking gotchas and hook test patterns are in `testing.md`.

## Local Dev Stack

`./scripts/build-dev.sh` then `./scripts/start-dev.sh` run `docker-compose.dev.yml`: containers `youtarr-dev` and `youtarr-db-dev`, app on host port 3087.

- `server/` and `migrations/` are bind-mounted and `node --watch` restarts the server on code changes; run a new migration with `docker restart youtarr-dev`. Client changes need a rebuild (the two scripts above), or the Vite dev server on port 3000.
- Logs: `docker logs youtarr-dev`. Database: `docker exec youtarr-db-dev mysql -uroot -p123qweasd youtarr -e "<sql>"` (the default dev password; `DB_ROOT_PASSWORD` overrides it).
- Run yt-dlp probes in the container (`docker exec youtarr-dev yt-dlp ...`): it has the version Youtarr actually runs, and a host install may differ.
- `git commit` runs a pre-commit hook: lint, typecheck and both full test suites. Expect it to take minutes, and give the command a long timeout.

## Documentation Sync

When a change creates or invalidates information in this file, a rule file, or `docs/`, update it in the same PR.

- **New top-level directory** under `server/`, `server/modules/` or `client/src/components/`: one line in the Architecture map above. Nothing else is added to this file; it stays under 200 lines.
- **Non-obvious behavior a future session could break** (an invariant with its reason, a cross-module contract): one bullet in that area's `.claude/rules/<area>.md`, under 40 words, no UI description, no code. A new area gets a new file with a `paths:` frontmatter and a line in "Area notes".
- **New module, route or component file in an existing area**: add its path to that area's `paths:` list (most rule files name files one by one, so an unlisted file loads no rule). `npm run lint` fails on a path that matches no file, so update the list when you rename or delete one.
- **New or changed env var**: `docs/ENVIRONMENT_VARIABLES.md`. **Config field**: `docs/CONFIG.md`, `client/src/config/configSchema.ts` and `config/config.example.json` (`configSchemaAlignment.test.ts` fails when the last two disagree).
- **Dev command or flag**: `docs/DEVELOPMENT.md`. **Schema change**: `docs/DATABASE.md`. **API change**: the Swagger annotations beside the route.
- **Services, environment or ports in `docker-compose.yml`**: mirror in `docs/platforms/portainer.md`, which keeps its own copy with absolute paths.

## Git Workflow

### Branches
- **`dev`**: integration branch for active development; all contributor PRs target `dev`, not `main`, even though `main` is GitHub's default branch.
- **`main`**: stable release branch; merging `dev` -> `main` triggers a production release.
- **Feature branches**: create from `dev`, merge back to `dev` via PR.

### Release
- Merging to `dev` builds an RC image (`dev-latest`, `dev-rc.<sha>`); merging `dev` -> `main` triggers a production release with semantic versioning.
- Commit prefixes: `feat:` (minor), `fix:` (patch), `BREAKING CHANGE:` (major). Docker images auto-publish to `dialmaster/youtarr` on release.
- CI runs on PRs to both `dev` and `main`. The Claude review workflow (`.github/workflows/claude.yml`) is dormant: it has no GitHub token, so Claude never starts, yet the job still shows green. A green check does not mean a PR was reviewed.

## Debugging

### CI/CD
When debugging CI/CD or GitHub Actions issues, check both the permissions AND the actual command execution logs. A fix is not complete until the underlying behavior is verified working.
