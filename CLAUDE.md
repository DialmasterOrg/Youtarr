# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Youtarr is a Dockerized application that automatically downloads videos from YouTube channels and integrates them with Plex Media Server. It consists of:

- **Backend**: Node.js/Express server with MariaDB database using Sequelize ORM
- **Frontend**: React/TypeScript application with a custom UI layer (Radix primitives + Tailwind CSS, themed via CSS variables)
- **Infrastructure**: Docker Compose setup with separate containers for app and database

## Scope Discipline

**IMPORTANT: Change only what the task requires.** This rule overrides every other rule in this file when they conflict.

- **Bug fixes**: make the minimum change needed to fix the bug. Do not rewrite surrounding code for style, extract helpers you don't need for the fix, or clean up while you're there.
- **Features**: touch only files the feature requires. Write new code to the standards below. Leave pre-existing code alone unless the feature forces you to change it.
- **Refactors**: only when the user explicitly asks for a refactor, and only as wide as the user scopes it.
- **Unrelated issues you notice** (oversized files, duplication, legacy patterns, missing tests, `console.log` calls, `any` types, drifted error-response shapes): list them in your final report so the user can decide whether to address them. **Do not fix them.**
- **When in doubt**: ask. A small clarifying question is cheaper than an unwanted refactor.

The size and quality rules in this file apply to code you are **creating or substantially rewriting**. They are not a mandate to refactor existing code you pass through.

## Task Handling

For multi-part requests (e.g., "review this PR AND explain WebSocket handling"), explicitly acknowledge all parts and complete each one before considering the task done.

## Architecture

### Backend (server/)
- `server.js`: Express entry point. `db.js`: Sequelize setup. `logger.js`: Pino logger with request correlation.
- `models/`: Sequelize models (channel, video, job, jobvideo, jobvideodownload, channelvideo, session, apikey). Associations: Channel hasMany Videos, Job hasMany JobVideos.
- `routes/`: API handlers (auth, channels, videos, videoDetail, config, jobs, plex, setup, subscriptions, apikeys, health). All use the dependency injection factory pattern; wiring lives in `server/routes/index.js`.
- `modules/`: class-based singletons holding business logic. Top-level modules include `channelModule`, `downloadModule`, `plexModule`, `jobModule`, `configModule`, `videosModule`, `videoMetadataModule`, `webSocketServer`, `databaseHealthModule`, `notificationModule`, `channelSettingsModule`, `videoDeletionModule`, `nfoGenerator`, `cronJobs`, `apiKeyModule`, `ytdlpModule`, `messageEmitter`.
- `modules/download/`: download orchestration (`downloadExecutor`, `ytdlpCommandBuilder`, `DownloadProgressMonitor`, `tempPathManager`, `videoMetadataProcessor`).
- `modules/filesystem/`: path/file abstraction (`pathBuilder`, `directoryManager`, `fileOperations`, `sanitizer`, `constants`). Good example of the sub-module aggregator pattern.
- `modules/notifications/`: multi-service notifications via Apprise (`serviceRegistry`, `formatters/`, `senders/`). Good example of a pluggable service registry.
- `modules/subscriptionImport/`: bulk channel import (`importJobRunner`, `takeoutParser`, `cookiesFetcher`, `thumbnailEnricher`, `concurrencyLimiter`, `errorClassifier`).

### Frontend (client/src/)
- `App.tsx`: app routing plus a global `fetch()` override that detects 503 `requiresDbFix` responses and surfaces the database error overlay. You can use normal `fetch()` anywhere; database errors are handled automatically.
- `components/`: feature directories and pages. Complex features pair a top-level `FeatureName.tsx` with a same-named `FeatureName/` directory holding `components/`, `hooks/`, and `__tests__/`. Examples of this sibling-file layout: `ChannelManager.tsx` + `ChannelManager/`, `Configuration.tsx` + `Configuration/`, `ChannelPage.tsx` + `ChannelPage/`. Newer features (e.g. `SubscriptionImport/`) put the main component at `FeatureName/index.tsx` instead; either layout is acceptable for new features.
- `components/shared/`: reusable components used across multiple features (e.g. `VideoModal/` for the video detail modal, `ThumbnailClickOverlay` for clickable thumbnail hotspots, `DeleteVideosDialog`).
- `components/ui/`: theme-neutral UI primitives (Button, Card, Dialog, Select, etc.) built on Radix and styled via CSS variables + Tailwind. Use these instead of Material-UI imports in new code.
- `components/layout/`: app shell and navigation chrome. `AppShell.tsx` is the outer frame; `NavSidebar.tsx` / `NavHeader.tsx` own desktop and mobile nav; `navLayoutConstants.ts` holds shared sidebar/header sizing constants; `layoutFallback.css` provides fallback CSS variables for themes that skip layout overrides.
- `components/Settings/`: Settings page wrapper and splash index (`SettingsIndex.tsx`) listing the per-section routes under `/settings/<key>`.
- `themes/`: theme definitions (`playful`, `linear`, `flat`), shared layout policy (`layoutPolicy.ts`), and the `ALL_THEMES` registry. New themes add an entry here and implement the required token surface.
- `hooks/`: app-wide custom hooks for data fetching and state.
- `contexts/` and `providers/`: React Context for cross-cutting concerns (auth token, WebSocket, theme). `contexts/ThemeEngineContext.tsx` owns the active theme mode, resolves the layout policy for the current viewport, and injects theme CSS variables onto the document root.
- `config/configSchema.ts`: the `CONFIG_FIELDS` registry. Use this pattern when adding new configuration fields; it auto-derives types, defaults, and change tracking.
- `types/`, `utils/`: shared types and helpers.

### Database
- MariaDB 10.3 with utf8mb4. Migrations in `migrations/` run automatically on container startup. Create new migrations with `./scripts/db-create-migration.sh migration-name`.

### Reference docs (consult these instead of re-deriving from code)
- `docs/DEVELOPMENT.md`: dev environment setup, `./scripts/build-dev.sh` (flags: `--install-deps`, `--no-cache`) and `./scripts/start-dev.sh` (flags: `--no-auth`, `--debug`, `--headless-auth`, `--pull-latest`, `--dev`, `--arm`, `--external-db`), Vite HMR dev server option (`cd client && npm run dev` on port 3000), running tests, Swagger/OpenAPI docs at `/swagger` and `/swagger.json`.
- `docs/DOCKER.md`: Docker architecture (two containers), Compose file variants (main, ARM override, external-db), volume layout, NAS configuration, backup/restore, platform deployment (`DATA_PATH`, `AUTH_ENABLED`, `PLEX_URL`).
- `docs/DATABASE.md`: schema tables, internal vs external database, migration workflow, idempotent migration helpers, troubleshooting.
- `docs/ENVIRONMENT_VARIABLES.md`: all env vars (`DB_*`, `YOUTUBE_OUTPUT_DIR`, `DATA_PATH`, `YOUTARR_UID/GID`, `AUTH_ENABLED`, `AUTH_PRESET_*`, `PLEX_URL`, `LOG_LEVEL`, `TZ`, `YOUTARR_IMAGE`).
- `docs/CONFIG.md`: `config/config.json` schema. Real field names include `plexApiKey`, `plexYoutubeLibraryId`, `plexSubfolderLibraryMappings`, `plexIP`/`plexPort`/`plexViaHttps`/`plexUrl`, `channelAutoDownload`, `channelDownloadFrequency` (cron), `channelFilesToDownload`, `preferredResolution`, `videoCodec`, `defaultSubfolder`, plus groups for SponsorBlock, notifications (`appriseUrls`), download performance, and auto-removal. Legacy `cronSchedule` is auto-migrated to `channelDownloadFrequency` on startup.
- `docs/AUTHENTICATION.md`: Plex OAuth, local auth (bcrypt, `username`/`passwordHash`), API keys (`x-api-key` header, rate-limited, download-only scope), session management (`x-access-token`, 7-day expiry), headless bootstrap via `AUTH_PRESET_*`.
- `docs/API_INTEGRATION.md`: API key integration for external tools (bookmarklets, iOS Shortcuts, Android Tasker, Home Assistant, cURL/Python/JS). Documents the `/api/videos/download` endpoint, rate limits, and CORS/auth-proxy bypass for Cloudflare Zero Trust and Authelia.
- `docs/TROUBLESHOOTING.md`: common runtime issues.

### Implementation notes (non-obvious behaviors)
- **Plex integration** uses OAuth; the user must be the Plex server admin. The target Plex library must be "Other Videos" with the "Personal Media" agent.
- **Video downloads**: yt-dlp writes to a temp location, then post-processing finalizes files into the channel's target directory. Resume-on-partial-download is supported.
- **WebSocket server** shares the HTTP server port (3011 in container, 3087 on host) via the `ws` library; there is no separate WS port.
- **Deno** is installed in the container; yt-dlp uses it automatically for JS-heavy extractors.

## Code Quality Standards (for new and rewritten code)

These standards apply when you are authoring new code or doing an explicit rewrite. See **Scope Discipline** above.

### General Principles
- **DRY when writing the third copy**: if you find yourself writing the same logic a third time in your own new code, extract it.
- **Single responsibility**: each module, class, or function should have one clear purpose. If a function name requires "and" to describe it, split it.
- **Right-size your extractions**: do not create helpers, components, or hooks for one-time operations. Three similar lines of code is better than a premature abstraction. If a helper is used in exactly one place, inline it.
- **File size targets for new files**: backend modules under ~500 lines, frontend components under ~300 lines. Several legacy files exceed these limits (notably `channelModule.js`, `jobModule.js`, `channelSettingsModule.js`, `videoDeletionModule.js`, `VideosPage.tsx`, `ChannelVideos.tsx`, `DownloadProgress.tsx`) - do not use them as examples. The codebase is migrating toward these targets over time.
- **Named constants for magic values**: in new code, timeouts, retry counts, limits, and defaults should be named constants at the top of the file or in a shared constants module.
- **Early returns** for error and edge cases, to keep happy-path nesting shallow.
- **Comments**: only where the logic is not self-evident. Do not add docstrings, type comments, or explanatory prose to code you did not change.

### Backend Standards (Node.js/Express)

#### Logging
- **Always use the Pino logger** (`require('../logger')`), never `console.log` or `console.error`.
- **Structured logging** with context objects: `logger.error({ err: error, videoId }, 'Download failed')`, not string interpolation.
- **Levels**: `error` for failures needing attention, `warn` for recoverable issues, `info` for significant operations, `debug` for diagnostic detail.

#### Error Handling
- **Standard error response shape**: `res.status(statusCode).json({ error: 'Human-readable message' })`. The codebase has drift (`{ success: false, error }`, `{ status, message }`); new code must use `{ error }`.
- **Always catch async errors** in route handlers with try-catch. Never let unhandled promise rejections escape.
- **Specific status codes**: 400 for bad input, 401 for unauthenticated, 403 for forbidden, 404 for not found, 409 for conflicts, 503 for service unavailable.
- **Log errors with context**: include relevant IDs, operation names, and the error object.

#### Route Patterns
- **Dependency injection factory pattern** for all new route files:
  ```javascript
  function createMyRoutes({ verifyToken, myModule }) {
    const router = express.Router();
    // ...
    return router;
  }
  module.exports = createMyRoutes;
  ```
  Never import modules directly inside route files; receive them as factory arguments.
- **Keep routes thin**: validate input, call module methods, format responses. Business logic belongs in modules.

#### Module Patterns
- **Class-based singletons**: new modules export a single instance (`module.exports = new MyModule()`).
- **Avoid circular dependencies**: restructure the dependency graph, extract shared logic, use events, or pass dependencies at call time. Do not use late-binding `require()` inside methods as a workaround. Some existing modules (e.g., `cronJobs.js`) use late-binding; do not copy the pattern.
- **Sub-module aggregator pattern** for complex features: see `server/modules/filesystem/` and `server/modules/notifications/` as good examples.

#### Database
- **Sequelize model methods** for queries, not raw SQL, unless there is a specific performance reason. Raw queries must use explicit parameter binding.
- **Create migrations using the script**: `./scripts/db-create-migration.sh migration-name`. Never create migration files manually.
- **Transactions** for multi-step operations that must be atomic.

### Frontend Standards (React/TypeScript)

#### TypeScript
- **No `any` in new code**. Use proper types everywhere:
  - Error handlers: `catch (err: unknown)` with type narrowing.
  - API responses, WebSocket payloads: define interfaces.
  - Event handlers: use React's built-in event types.
- **Define interfaces** for props, API payloads, and shared data. Co-locate feature-specific types with the feature; put shared types in `client/src/types/`.
- **CONFIG_FIELDS registry**: use `client/src/config/configSchema.ts` when adding new configuration fields.
- The codebase has ~300 existing `any` occurrences; do not add more.

#### Component Structure
- **When authoring or rewriting a component**: aim for fewer than 10 `useState` calls and under 300 lines. If you cross that threshold while writing new code, extract logic into custom hooks and UI into child components.
- **Feature directory layout** for new complex features, either of these is acceptable:
  ```
  # Sibling-file layout (most common in this repo)
  FeatureName.tsx              # the main component
  FeatureName/
  ├── components/
  ├── hooks/
  └── __tests__/

  # index.tsx layout
  FeatureName/
  ├── components/
  ├── hooks/
  ├── __tests__/
  └── index.tsx
  ```
  Sibling-file examples: `ChannelManager.tsx`, `Configuration.tsx`, `ChannelPage.tsx`. `index.tsx` example: `SubscriptionImport/`.

#### Custom Hooks
- **Extract data fetching and multi-step state logic** into hooks. Each hook owns one concern.
- **Return shape**: `{ data, loading, error, ...actions }` for consistency.
- **Do not extract one-off state**: local component state read in exactly one place stays inline.
- **Cleanup effects**: always return cleanup from `useEffect` for subscriptions, timers, and event listeners.
- **Memoize deliberately**: `useMemo` for genuinely expensive derivations, `useCallback` for callbacks passed to memoized children. Do not over-memoize trivial values.

#### Styling
- **Tailwind utility classes** via `className` are the default for layout, spacing, and typography. Import UI primitives from `./ui` (Box, Card, Typography, Button, Chip, Dialog, etc.); do not reach for MUI, it is not installed.
- **Theme tokens via CSS variables**, not hardcoded colors: `var(--destructive)`, `text-foreground`, `text-muted-foreground`, `bg-card`. Theme values are set on the document root by `ThemeEngineContext`.
- **Inline `style` is acceptable only for computed/dynamic values** (e.g., a padding driven by `isMobile`, a length-dependent `maxHeight`). For static styling, prefer Tailwind classes.
- **Responsive breakpoints**: use the custom `useMediaQuery` from `hooks/useMediaQuery` with a raw media query (`useMediaQuery('(max-width: 767px)')`) or the exported `breakpoints.down('sm')` helper. Tailwind's `md:`/`sm:` class prefixes are also fine for pure-CSS responsive behavior.

#### API Calls
- **Use Axios** in new hooks and components. A few legacy hooks use raw `fetch()` (`client/src/hooks/useConfig.ts` and `client/src/components/Configuration/hooks/usePlexConnection.ts`); do not copy them.
- **Auth headers**: `headers: { 'x-access-token': token }`. Hooks receive `token` from the calling component.
- **Type requests and responses** with interfaces.
- **Handle specific status codes** (403, 404, 503) rather than generic catch-alls.
- **Exception**: the global `fetch()` override in `App.tsx` is the one place `fetch` is intentional, for database error detection.

#### State Management
- React Context for cross-cutting concerns (auth, WebSocket, theme).
- Local `useState` / `useReducer` for component-specific state.
- Custom events sparingly, only for decoupled communication (e.g., `CONFIG_UPDATED_EVENT`).

## Security

Youtarr shells out to `yt-dlp` and writes files using user-influenced paths, so this section is not optional.

- **Validate untrusted input at route boundaries**. Check types, lengths, and shape before passing anything to modules. Return 400 with `{ error }` for invalid input.
- **Never interpolate user data into shell commands or filesystem paths directly.** Use the existing helpers: `modules/download/ytdlpCommandBuilder.js`, `modules/filesystem/pathBuilder.js`, `modules/filesystem/sanitizer.js`. If a new helper is needed, add it to those modules, not inline in a route.
- **Auth by default**: new routes must wire `verifyToken` unless the user explicitly says the route is public. If you add a public route, call it out in your final report so the user can confirm.
- **Never log secrets**. Pino redacts known keys, but do not bypass redaction by interpolating tokens, passwords, cookies, or API keys into log messages.
- **Treat uploaded files as untrusted**: Takeout CSV and cookies uploads in the subscription import flow must be validated, size-limited, and parsed defensively.
- **Sequelize protects against SQL injection only when using model methods**. Raw queries require explicit parameterization.
- **Rate-limit endpoints that accept external identifiers or credentials** (follow the existing pattern in `server/routes/videos.js` and `server/routes/auth.js`).

## Testing

**Run tests from the project root.** See `docs/DEVELOPMENT.md` for the full workflow.

```bash
npm run test:frontend                                        # all frontend tests
npm run test:frontend -- client/src/hooks/__tests__/foo.ts   # one frontend test
npm run test:backend                                         # all backend tests
npm run test:backend -- server/modules/__tests__/foo.test.js # one backend test
npm run lint                                                  # lint front + back
npm run lint:ts                                               # TypeScript typecheck
```

### Test Execution Policy
**NEVER skip tests.** No `test.skip()`, no `describe.skip()`, no commented-out failing tests. Fix failing tests or delete them if obsolete. If a test is written, it must run and pass in CI.

### React Testing Library Rules
- **No direct DOM queries**: no `querySelector`, `parentElement`, or other native DOM access. Use `getByRole`, `getByLabelText`, `getByText`, `getByTestId`, and `within()` for scoped queries. ESLint enforces this via `testing-library/no-node-access`.
- **No conditional `expect`** calls.
- **Assert behavior, not implementation**. Test what the code does, not how.

### Jest Mocking Gotchas (project-specific)
These are real landmines that cost time, not general Jest advice. Full examples live in existing tests under `server/modules/__tests__/` and `client/src/**/__tests__/`; consult them before mocking a new dependency.

1. **Mocking React components**: do NOT use JSX inside `jest.mock()`. Jest hoists the mock and JSX fails with "Invalid variable access." Use `React.createElement` via `require('react')` inside the factory.
2. **Mocking axios**: use a factory (`jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), ... }))`) and `require('axios')` after the mock. Direct ES6 `import axios from 'axios'` fails with ESM errors.
3. **Mocking `fetch` JSON**: mock `json` as `jest.fn().mockResolvedValueOnce(...)`, not an async arrow function; the latter returns the wrong shape.
4. **Mock path resolution**: mock paths are relative to the test file, not the component under test. Double-check `../` vs `../../`.

### Backend Test Setup
- Place `jest.mock()` calls before `require()` imports.
- Use `jest.resetModules()` and `jest.clearAllMocks()` in `beforeEach`, then re-require the module under test.
- Mock only external dependencies (db, fs, HTTP, logger). Over-mocking internal module methods usually indicates a design issue.

### Hook Test Setup
- Use `renderHook` with explicit type annotations for parameterized hooks (e.g., `renderHook(({ token }: { token: string | null }) => useMyHook(token), { initialProps: { token: null } })`).
- Use `waitFor` for async state changes, not arbitrary timeouts.
- For polling/interval tests, use fake timers (`jest.useFakeTimers()`) and clean up with `jest.runOnlyPendingTimers()` + `jest.useRealTimers()` in `afterEach`.
- Test cleanup on unmount.

### Test Quality
- Each test asserts one thing. A test with 15 assertions is testing too much.
- Meaningful names: `'returns empty array when no channels exist'`, not `'test case 1'`.
- Minimal setup: only what the specific test needs; use `beforeEach` for genuinely shared setup.
- Do not test private implementation details. If you need to expose internals to test them, the API design needs work.

## Documentation Sync

When a code change creates or invalidates information in this file or in `docs/`, update the docs in the same PR. This is not optional; stale docs are how we got here.

- **New top-level route file or module**: add a one-liner to the Architecture section above.
- **New feature directory under `client/src/components/`**: add a one-liner to the Frontend section.
- **New or changed env var**: update `docs/ENVIRONMENT_VARIABLES.md`.
- **New or changed config field**: update `docs/CONFIG.md` and register the field in `client/src/config/configSchema.ts`.
- **New dev command or flag**: update `docs/DEVELOPMENT.md`.
- **Schema changes**: update `docs/DATABASE.md`.
- **API changes**: Swagger annotations live with the routes; update them so `/swagger` stays accurate.

## Git Workflow

### Branches
- **`dev`**: default branch for active development; all contributor PRs target `dev`.
- **`main`**: stable release branch; merging `dev` -> `main` triggers a production release.
- **Feature branches**: create from `dev`, merge back to `dev` via PR.

### Release
- Merging to `dev` builds an RC image (`dev-latest`, `dev-rc.<sha>`).
- Merging `dev` -> `main` triggers a production release with semantic versioning.
- Commit prefixes: `feat:` (minor), `fix:` (patch), `BREAKING CHANGE:` (major).
- Docker images auto-publish to `dialmaster/youtarr` on release.

### PRs
- Contributor PRs target `dev`, not `main`.
- PRs to `dev` get automatic Claude Code reviews.
- CI runs on PRs to both `dev` and `main`.

## Debugging

### CI/CD
When debugging CI/CD or GitHub Actions issues, check both the permissions AND the actual command execution logs. A fix is not complete until the underlying behavior is verified working.
