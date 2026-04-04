# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Youtarr is a Dockerized application that automatically downloads videos from YouTube channels and integrates them with Plex Media Server. It consists of:

- **Backend**: Node.js/Express server with MariaDB database using Sequelize ORM
- **Frontend**: React/TypeScript application with Material-UI components
- **Infrastructure**: Docker Compose setup with separate containers for app and database

## Architecture

### Backend Structure (server/)
- `server.js`: Main Express server entry point
- `db.js`: Database connection and Sequelize setup
- `logger.js`: Pino-based structured logging with request correlation
- `models/`: Sequelize models (channel, video, job, jobvideo, jobvideodownload, channelvideo, session, apikey)
- `routes/`: API route handlers
  - `auth.js`: Authentication and session management
  - `channels.js`: Channel subscription and refresh
  - `videos.js`: Video browsing and download triggers
  - `config.js`: Application configuration
  - `jobs.js`: Download job status
  - `plex.js`: Plex integration
  - `setup.js`: Initial setup wizard
  - `apikeys.js`: API key management
  - `health.js`: Health check endpoints
- `modules/`: Core business logic modules
  - `channelModule.js`: YouTube channel management
  - `downloadModule.js`: Video download handling via yt-dlp
  - `plexModule.js`: Plex Media Server integration
  - `jobModule.js`: Background job processing
  - `configModule.js`: Configuration management
  - `videosModule.js`: Video metadata and processing
  - `webSocketServer.js`: WebSocket communication for real-time updates
  - `databaseHealthModule.js`: Database connection validation and schema health checks
  - `notificationModule.js`: Multi-service notifications via Apprise (Discord, Slack, Telegram, Email, Pushover, Gotify, Ntfy, Matrix, etc.)
  - `channelSettingsModule.js`: Per-channel settings (subfolders, quality overrides)
  - `videoDeletionModule.js`: Video file and database deletion with dry-run support
  - `nfoGenerator.js`: NFO metadata file generation for Jellyfin/Kodi/Emby
  - Additional modules: `cronJobs.js` (scheduled tasks), `apiKeyModule.js` (API key auth), `ytdlpModule.js` (yt-dlp updates), `messageEmitter.js` (WebSocket broadcasting)
- `modules/download/`: Download orchestration
  - `downloadExecutor.js`: Main download orchestration
  - `ytdlpCommandBuilder.js`: yt-dlp command construction
  - `DownloadProgressMonitor.js`: Real-time progress tracking
  - `tempPathManager.js`: Temporary file management
  - `videoMetadataProcessor.js`: Metadata extraction
- `modules/filesystem/`: File system abstraction layer
  - `pathBuilder.js`: Download path construction
  - `directoryManager.js`: Directory creation and management
  - `fileOperations.js`: File move/copy operations
  - `sanitizer.js`: Filename sanitization
  - `constants.js`: Filesystem constants
- `modules/notifications/`: Multi-service notification system
  - `serviceRegistry.js`: Service detection (Discord, Slack, Telegram, Email, etc.)
  - `formatters/`: Service-specific message formatters
  - `senders/`: Delivery mechanisms (Discord webhooks, Apprise)

## Task Handling

For multi-part requests (e.g., 'review this PR AND explain WebSocket handling'), explicitly acknowledge all parts and complete each one before considering the task done.

### Frontend Structure (client/src/)
- `App.tsx`: Main application component with routing
- `components/`: React components organized by feature
  - `ChannelManager/`: Channel subscription management (with `hooks/`, `components/`, and `components/chips/` subdirectories)
  - `ChannelPage/`: Individual channel detail page (with `hooks/` and `components/` subdirectories)
  - `DownloadManager/`: Download queue and history
  - `VideosPage/`: Video browsing and filtering
  - `Configuration/`: App settings with 10+ sections in `sections/` subdirectory, reusable UI in `common/`, and feature hooks in `hooks/`
  - `InitialSetup.tsx`: First-time setup wizard
  - `LocalLogin.tsx`: Local user authentication form
  - `StorageStatus.tsx`: Real-time storage status display
  - `shared/`: Shared/reusable components (e.g., DeleteVideosDialog) and hooks
  - Additional pages: `ChangelogPage.tsx`, `PlexAuthDialog.tsx`, `DatabaseErrorOverlay.tsx`, `ErrorBoundary.tsx`
- `hooks/`: Custom React hooks for data fetching and state management
- `theme.ts`: Material-UI theme configuration (light/dark mode)
- `config/`: Configuration schemas and validation (Zod schemas)
- `types/`: TypeScript type definitions
- `contexts/`: React Context definitions (e.g., WebSocketContext)
- `providers/`: Context provider implementations (e.g., WebSocketProvider)
- `utils/`: Utility functions and helpers

#### Frontend API Error Handling
**Database Error Detection:** The global `fetch()` function is automatically overridden in `App.tsx` to detect database errors across all API calls. This means:

- ✅ You can use normal `fetch()` syntax anywhere in the frontend
- ✅ Database errors (503 responses with `requiresDbFix: true`) are automatically detected
- ✅ The database error overlay appears automatically during outages
- ✅ No special wrapper functions or imports needed

**Implementation:** When the backend returns a 503 status with `requiresDbFix: true` in the JSON response, the overridden fetch automatically dispatches a custom event that triggers the database error overlay with appropriate messaging and polling for recovery.

### Database
- MariaDB 10.3 with utf8mb4 support for full Unicode
- Sequelize migrations in `migrations/`
- Models use associations: Channel hasMany Videos, Job hasMany JobVideos

## Code Quality Standards

### General Principles

- **DRY (Don't Repeat Yourself)**: Extract duplicated logic into shared utilities or modules. If you see the same pattern 3+ times, it should be abstracted.
- **Single Responsibility**: Each module, class, or function should have one clear purpose. If a function name requires "and" to describe it, split it.
- **Keep files focused**: Backend modules should stay under ~500 lines. Frontend components should stay under ~300 lines. If a file grows beyond this, extract sub-modules or child components. (Several legacy files exceed these limits -- `channelModule.js` at 2356 lines, `downloadExecutor.js` at 1505 lines, `VideosPage.tsx` at 1047 lines -- these should not be used as examples to follow.)
- **No magic numbers**: Use named constants. Timeouts, retry counts, limits, and default values should be defined as named constants at the top of the file or in a shared constants module, not embedded inline.
- **Prefer early returns**: Reduce nesting by returning early for error/edge cases rather than wrapping the happy path in deep conditionals.

### Backend Standards (Node.js/Express)

#### Logging
- **Always use the Pino logger** (`require('../logger')` or `require('../../logger')`), never `console.log` or `console.error`. The logger provides structured output, log levels, and automatic sensitive-data redaction.
- **Use structured logging** with context objects: `logger.error({ err: error, videoId }, 'Download failed')` -- not string interpolation.
- **Use appropriate log levels**: `error` for failures that need attention, `warn` for recoverable issues, `info` for significant operations, `debug` for diagnostic detail.

#### Error Handling
- **Standard API error response format**: All error responses from routes must use this structure:
  ```javascript
  res.status(statusCode).json({ error: 'Human-readable error message' });
  ```
- **Always catch async errors** in route handlers. Use try-catch and return proper HTTP status codes. Never let unhandled promise rejections escape.
- **Log errors with context**: Include relevant IDs, operation names, and the error object using structured logging (see above).
- **Use specific error codes** where applicable (e.g., 400 for bad input, 404 for not found, 409 for conflicts, 503 for service unavailable).

#### Route Patterns
- **Use the dependency injection factory pattern** for all route files. Routes export a factory function that receives dependencies:
  ```javascript
  function createMyRoutes({ verifyToken, myModule }) {
    const router = express.Router();
    // ... route definitions
    return router;
  }
  module.exports = createMyRoutes;
  ```
  This is the established pattern (see `server/routes/index.js`). Never import modules directly in route files.
- **Keep routes thin**: Routes should validate input, call module methods, and format responses. Business logic belongs in modules.

#### Module Patterns
- **Class-based singletons**: Modules export a single instance (`module.exports = new MyModule()`). Follow this pattern for new modules.
- **Avoid circular dependencies**: If module A and module B need each other, restructure the dependency (extract shared logic, use events, or pass dependencies at call time). Do not use late-binding `require()` inside methods as a workaround.
- **Use the established sub-module pattern** for complex features. Good examples to follow:
  - `server/modules/filesystem/` -- clean aggregator index with namespaced exports
  - `server/modules/notifications/` -- service registry with pluggable formatters and senders

#### Database
- **Use Sequelize model methods** for queries, not raw SQL, unless there's a specific performance reason.
- **Create migrations using the script**: `./scripts/db-create-migration.sh migration-name`. Never manually create migration files.
- **Use transactions** for multi-step database operations that must be atomic.

### Frontend Standards (React/TypeScript)

#### TypeScript
- **No `any` types**: Use proper types for all variables, parameters, and return values. Especially:
  - Error handlers: Use `unknown` and type-narrow instead of `catch (err: any)`
  - API responses: Define interfaces for all response shapes
  - WebSocket messages: Type the message payloads
  - Event handlers: Use React's built-in event types
- **Define interfaces** for component props, API responses, and shared data structures. Co-locate types with their feature when specific, or place in `client/src/types/` when shared.
- **Use the CONFIG_FIELDS registry pattern** (`client/src/config/configSchema.ts`) when adding new configuration fields -- it auto-derives types, defaults, and change tracking.

#### Component Structure
- **Decompose large components**: If a component has more than ~10 state variables or exceeds ~300 lines, extract logic into custom hooks and UI into child components.
- **Feature directory structure**: For complex features, organize as:
  ```
  FeatureName/
  ├── components/       # Child components
  ├── hooks/           # Feature-specific hooks
  ├── __tests__/       # Tests and stories
  └── index.tsx        # Main component (or separate file)
  ```
  Good examples: `ChannelManager/`, `Configuration/`, `ChannelPage/`.

#### Custom Hooks
- **Extract data fetching and state logic** into custom hooks. Each hook should manage one concern (e.g., `useChannelList` for channel data, `useConfigSave` for save operations).
- **Standard hook return pattern**: Return an object with `{ data, loading, error, ...actions }` for consistency across hooks.
- **Clean up effects**: Always return cleanup functions from `useEffect` for subscriptions, timers, and event listeners.
- **Memoize expensive computations**: Use `useMemo` for derived data and `useCallback` for callbacks passed to children, but don't over-memoize trivial values.

#### Styling
- **Use MUI's `sx` prop** for all styling. Do not use inline `style` attributes -- they bypass the theme system and don't support responsive breakpoints, hover states, or dark mode.
  ```typescript
  // Good
  <Box sx={{ p: 2, display: 'flex', bgcolor: 'background.paper' }}>
  
  // Bad
  <Box style={{ padding: '16px', display: 'flex' }}>
  ```
- **Use theme values** instead of hardcoded colors: `theme.palette.primary.main` not `'#1976d2'`.
- **Use responsive breakpoints**: `useMediaQuery(theme.breakpoints.down('sm'))` for mobile-responsive behavior.

#### API Calls
- **Use Axios** for API calls (not `fetch`). This is the established pattern for data-fetching hooks.
- **Include auth headers via the token prop**: `headers: { 'x-access-token': token }`. Hooks receive `token` from their calling component.
- **Type API responses**: Define interfaces for request and response payloads.
- **Handle errors with specific status codes** where applicable (403, 404, 503) rather than generic catch-all messages.

#### State Management
- Use React Context for cross-cutting concerns (auth token, WebSocket, theme).
- Use local `useState` / `useReducer` for component-specific state.
- Use custom events sparingly and only for decoupled communication (e.g., `CONFIG_UPDATED_EVENT`).

## Important Tool Usage

### File Searching
- **Always use `rg` (ripgrep) instead of `grep`** - it's faster and more powerful
- ripgrep is pre-installed and should be your default search tool
- Example: `rg "pattern" --type ts` instead of `grep -r "pattern" *.ts`

## Common Development Commands

### Development with Docker
For development, use the Docker-based "build-and-test" workflow. See [Development Guide](docs/DEVELOPMENT.md) for detailed instructions:

```bash
# Build development environment
./scripts/build-dev.sh

# Start development environment
./scripts/start-dev.sh

# Additional start-dev.sh options:
# ./scripts/start-dev.sh --no-auth        # Disable authentication
# ./scripts/start-dev.sh --headless-auth  # Bootstrap auth credentials for headless deployments
# ./scripts/start-dev.sh --pull-latest    # Pull latest git commits and Docker images
# ./scripts/start-dev.sh --debug          # Enable debug logging

# Access the app at http://localhost:3087

# After making code changes, rebuild and restart:
./scripts/build-dev.sh
./scripts/start-dev.sh  # Automatically stops and restarts

# View logs
docker compose logs -f

# Stop development environment
./scripts/stop-dev.sh
```

**Development Setup Characteristics:**
- ❌ No hot reload - code changes require rebuild
- ✅ Tests code in actual Docker environment
- ✅ Consistent with production container
- ✅ Includes all system dependencies (yt-dlp, ffmpeg)
- ℹ️ For faster iteration during active development, consider running backend/frontend outside Docker, then test in Docker before committing

### Production with Docker
```bash
# Start application (creates .env on first run, pulls latest, starts containers)
./start.sh

# Start script options:
./start.sh --pull-latest    # Update before starting
./start.sh --dev            # Use bleeding-edge dev image
./start.sh --arm            # Force ARM compose file
./start.sh --external-db    # Use external database
./start.sh --no-auth        # Disable authentication
./start.sh --headless-auth  # Bootstrap auth credentials
./start.sh --debug          # Enable debug logging

# Stop application
./stop.sh

# View logs
docker compose logs -f
```

### Code Quality
```bash
# Run ESLint on both frontend and backend
npm run lint

# Additional lint commands
npm run lint:frontend    # Frontend only
npm run lint:backend     # Backend only
npm run lint:ts          # TypeScript type checking
npm run lint:fix         # Auto-fix linting issues

# Run tests with coverage
npm run test:coverage

# Lint is also configured with Husky for pre-commit hooks
```

### Testing

**Always run tests from the project root:**

```bash
# Run all frontend tests
npm run test:frontend

# Run specific frontend test
npm run test:frontend -- client/src/hooks/__tests__/useStorageStatus.test.ts

# Run all backend tests
npm run test:backend

# Run specific backend test
npm run test:backend -- server/modules/__tests__/videosModule.test.js
```

#### Important Testing Guidelines
When writing tests with React Testing Library, **always follow these rules to avoid linting errors**:

1. **Never use direct DOM queries** like `querySelector`, `parentElement`, or other native DOM methods
   - ❌ BAD: `button.querySelector('[data-testid="AddIcon"]')`
   - ✅ GOOD: `screen.getByTestId('AddIcon')`

2. **Use Testing Library queries exclusively**:
   - Avoid direct Node access. Prefer using the methods from Testing Library!
   - `getBy...` / `queryBy...` / `findBy...` for single elements
   - `getAllBy...` / `queryAllBy...` / `findAllBy...` for multiple elements
   - Common queries: `ByRole`, `ByLabelText`, `ByPlaceholderText`, `ByText`, `ByTestId`

3. **For parent element access**, restructure your tests:
   - Instead of `.parentElement`, use more specific queries
   - Consider using `within()` for scoped queries
   - Use accessible roles and labels rather than DOM structure

4. **ESLint will flag violations** with: `testing-library/no-node-access`
   - This rule ensures tests remain maintainable and less brittle
   - Tests should interact with components as users would

5. **Avoid calling `expect` conditionally**

#### Jest Mocking Best Practices

1. **Mocking React Components in Tests**
   - Jest has hoisting issues when mocking components with JSX
   - ❌ BAD: Using JSX directly in jest.mock() causes "Invalid variable access" errors
   ```javascript
   jest.mock('../Component', () => {
     return function MockComponent() {
       return <div>Mock</div>; // This will fail!
     }
   });
   ```
   - ✅ GOOD: Use React.createElement to avoid hoisting issues
   ```javascript
   jest.mock('../Component', () => ({
     __esModule: true,
     default: function MockComponent(props) {
       const React = require('react');
       return React.createElement('div', { 'data-testid': 'mock' }, 'Mock');
     }
   }));
   ```

2. **Mocking axios**
   - Use a factory function with `jest.mock()` to mock only the HTTP methods you need
   - Import axios using `require()` after the mock (not ES6 import)
   - ❌ BAD: `import axios from 'axios'` (will fail with ESM import errors)
   - ✅ GOOD: Use factory function and require
   ```javascript
   // Mock axios with only the methods you need
   jest.mock('axios', () => ({
     get: jest.fn(),
     post: jest.fn(),
     delete: jest.fn(),
   }));

   const axios = require('axios');

   // In your test
   axios.get.mockResolvedValueOnce({ data: mockData });
   ```

3. **Mocking fetch() Calls**
   - Always mock the json() method as a jest function that returns a promise
   - ❌ BAD: `json: async () => ({ data })`
   - ✅ GOOD: `json: jest.fn().mockResolvedValueOnce({ data })`
   ```javascript
   mockFetch.mockResolvedValueOnce({
     ok: true,
     status: 200,
     json: jest.fn().mockResolvedValueOnce({ data: 'value' })
   });
   ```

4. **Mock Path Resolution**
   - Mock paths must be relative to the test file location, not the component
   - Double-check parent directory references (../ vs ../../)

#### Hook Testing Patterns

When testing custom React hooks, follow these patterns:

1. **Basic Hook Testing Setup**
   ```typescript
   import { renderHook, waitFor } from '@testing-library/react';
   import { useMyHook } from '../useMyHook';

   describe('useMyHook', () => {
     const { result } = renderHook(() => useMyHook(params));

     expect(result.current.data).toBe(expected);
   });
   ```

2. **Testing Hooks with Parameters (TypeScript)**
   - Always provide explicit type annotations for renderHook callbacks
   ```typescript
   const { result, rerender } = renderHook(
     ({ token }: { token: string | null }) => useStorageStatus(token),
     { initialProps: { token: null as string | null } }
   );

   // Change props to trigger re-render
   rerender({ token: 'new-token' });
   ```

3. **Testing Async Hooks**
   - Use `waitFor` to wait for async state updates
   - Wait for specific state changes, not just arbitrary delays
   ```typescript
   await waitFor(() => {
     expect(result.current.loading).toBe(false);
   });

   await waitFor(() => {
     expect(result.current.data).toEqual(expectedData);
   });
   ```

4. **Testing Hooks with Timers (Polling, Intervals)**
   - Use fake timers to control time-based behavior
   - Clean up properly to avoid test interference
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
     jest.useFakeTimers();
   });

   afterEach(() => {
     jest.runOnlyPendingTimers();
     jest.useRealTimers();
   });

   test('polls at interval', async () => {
     // Initial fetch
     await waitFor(() => {
       expect(mockFn).toHaveBeenCalledTimes(1);
     });

     // Advance timers
     jest.advanceTimersByTime(60000);

     await waitFor(() => {
       expect(mockFn).toHaveBeenCalledTimes(2);
     });
   });
   ```

5. **Testing Hook Cleanup (useEffect cleanup)**
   ```typescript
   test('cleans up on unmount', async () => {
     const { unmount } = renderHook(() => useMyHook());

     unmount();

     // Verify cleanup happened (e.g., intervals cleared)
     jest.advanceTimersByTime(60000);
     expect(mockFn).toHaveBeenCalledTimes(1); // No additional calls
   });
   ```

#### Backend Test Patterns

Backend tests use Jest with extensive mocking. Follow these patterns:

1. **Mock setup order**: Place all `jest.mock()` calls before `require()` imports. Use `jest.resetModules()` in `beforeEach` to ensure clean state.
2. **Module loading after mocks**: Re-require the module under test in `beforeEach` after resetting modules:
   ```javascript
   let myModule;
   beforeEach(() => {
     jest.resetModules();
     jest.clearAllMocks();
     myModule = require('../myModule');
   });
   ```
3. **Test structure**: Use descriptive `describe` blocks organized by method, and `test`/`it` blocks that describe the expected behavior (not the implementation).
4. **Avoid over-mocking**: Only mock external dependencies (database, file system, HTTP). If you need to mock internal module methods to test, the module likely has a design issue.

#### Test Quality Standards
- **Tests must assert behavior, not implementation**: Test what the code does (outputs, side effects, state changes), not how it does it internally.
- **Each test should test one thing**: A test with 15 assertions is testing too many things. Split it up.
- **Use meaningful test names**: `'returns empty array when no channels exist'` not `'test case 1'`.
- **Keep test setup minimal**: Only set up what the specific test needs. Use `beforeEach` for truly shared setup only.
- **Don't test private implementation details**: If you need to expose internals just for testing, the API design needs work.

#### Test Execution Policy
**NEVER skip tests** - All tests must either pass or be fixed:
- ❌ Never use `test.skip()` or `describe.skip()`
- ❌ Never comment out failing tests
- ✅ Fix failing tests immediately or remove them if obsolete
- ✅ Tests should be comprehensive and actually test functionality
- If a test is created, it must run and pass in CI/CD

#### Running Individual Tests

**Run from project root** using the appropriate npm script:

Frontend tests:
```bash
npm run test:frontend -- client/src/hooks/__tests__/useStorageStatus.test.ts
```

Backend tests:
```bash
npm run test:backend -- server/modules/__tests__/videosModule.test.js
```

## Key Configuration

### Environment Variables (Docker)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: Database connection
- `YOUTUBE_OUTPUT_DIR`: Host directory for downloaded videos (set in .env file)
- `DATA_PATH`: Optional override for video storage path (used in platform deployments like Elfhosted)
- `YOUTARR_UID`, `YOUTARR_GID`: Container user/group IDs for file permissions
- `AUTH_PRESET_USERNAME`, `AUTH_PRESET_PASSWORD`: Headless auth bootstrap credentials
- `LOG_LEVEL`: Logging verbosity (warn/info/debug)
- `TZ`: Timezone for scheduled jobs

### Application Config (config/config.json)
- `plexApiKey`: Plex authentication token
- `youtubeOutputDirectory`: Where videos are saved
- `plexLibrarySection`: Plex library ID for YouTube videos
- `youtubeApiKey`: Optional, for browsing channel videos in-app
- `cronSchedule`: Download schedule (default: every 6 hours)

## Important Implementation Details

### Plex Integration
- Uses Plex OAuth for authentication - must use same account as Plex server admin
- Automatically triggers library scan after downloads
- Videos organized in channel-named subdirectories
- Plex library must be "Other Videos" type with "Personal Media" agent

### Video Downloads
- Uses yt-dlp for downloading (included in Docker image)
- Downloads video, thumbnail, and metadata (.info.json)
- Post-processes files for Plex compatibility
- Supports resume on partial downloads

### WebSocket Communication
- Real-time updates for download progress
- Channel refresh status
- Job status updates
- Uses ws library, shares HTTP server port (3011 in container, 3087 on host)

### API Documentation
- Swagger/OpenAPI documentation available at `/swagger`
- All endpoints annotated for automatic documentation generation

### Database Migrations
- Run automatically on container startup
- **Create new migrations using the script**: `./scripts/db-create-migration.sh migration-name`
  - This uses sequelize-cli with the correct config and generates a properly timestamped migration file
  - Alternative command: `npm run db:create-migration -- --name migration-name`
  - ❌ Never manually create migration files - always use the script
- Migrations support utf8mb4 for emoji support

## Docker Architecture
- Two containers: `youtarr` (app) and `youtarr-db` (MariaDB)
- Health checks ensure database is ready before app starts
- Volumes persist database data and configuration
- Network isolation with `youtarr-network`
- Deno is installed in the container to enhance yt-dlp performance (yt-dlp automatically uses Deno when available in PATH)

### Docker Compose Files
- `docker-compose.yml`: Main production configuration
- `docker-compose.dev.yml`: Development overrides (code mounting, debug logging)
- `docker-compose.arm.yml`: ARM architecture support (Apple Silicon, Raspberry Pi)
- `docker-compose.external-db.yml`: External database configuration

## Port Mappings

Both development and production use the same port configuration:
- Application (backend + frontend): 3087 (host) → 3011 (container)
- WebSocket: shares application port (3087/3011)
- Database: 3321 (both host and container)

**Note:** Access the app via http://localhost:3087. In development, the setup serves pre-built static React files (no webpack dev server).

## Git Workflow

### Branch Strategy
- **`dev`** - Default branch for active development; all PRs target this branch
- **`main`** - Stable release branch; merging `dev` → `main` triggers a production release
- **Feature branches** - Create from `dev`, merge back to `dev` via PR

### Release Process
- Merging to `dev` → Builds RC image (`dev-latest`, `dev-rc.<sha>`)
- Merging `dev` to `main` → Triggers production release with semantic versioning
- Commit prefixes: `feat:` (minor), `fix:` (patch), `BREAKING CHANGE:` (major)
- Docker images auto-published to `dialmaster/youtarr` on release

### PR Guidelines
- All contributor PRs should target `dev` (not `main`)
- PRs to `dev` get automatic Claude Code reviews
- CI runs on PRs to both `dev` and `main`

## Anti-Patterns to Avoid

These are common mistakes found in the codebase that should not be repeated in new code:

### Backend
- **`console.log` / `console.error`**: Always use the Pino logger. Several legacy files still use console -- don't follow that pattern.
- **God modules**: Modules over 500 lines with multiple responsibilities. Break them up by extracting focused sub-modules.
- **Late-binding `require()` inside functions**: This is a workaround for circular dependencies. Instead, restructure the dependency graph, pass the dependency as a parameter, or use an event emitter. (Several existing modules use this pattern, including `cronJobs.js` and others — migrate over time but do NOT refactor these as part of unrelated feature work or bug fixes.)
- **Inconsistent error response shapes**: Don't mix `{ error: '...' }`, `{ success: false, error: '...' }`, and `{ status: 'error', message: '...' }`. Use `{ error: '...' }` consistently.
- **Fire-and-forget promises**: Don't call an async function without awaiting or attaching error handling. Unhandled rejections crash the process.
- **Hardcoded paths and timeouts**: Define as named constants, not inline literals.

### Frontend
- **`any` type escape hatch**: Don't use `any` to silence TypeScript. Use `unknown` with type narrowing for genuinely unknown types, or define proper interfaces.
- **Monolith components**: Components with 10+ `useState` calls and hundreds of lines. Extract custom hooks for logic and child components for UI.
- **Inline `style` prop**: Use MUI's `sx` prop for theme-aware, responsive styling.
- **Mixed fetch/axios**: Use Axios consistently for API calls. The only exception is the global fetch override in `App.tsx` for database error detection.
- **Prop drilling through many layers**: Use React Context or restructure component hierarchy if a prop is passed through 3+ levels unchanged.

## Code Review

When reviewing PRs or analyzing code, always complete the full analysis before ending - don't stop after just reading files. Provide actionable findings even if the session might end soon.

### What to Check
- **Consistency**: Does the new code follow established patterns in the codebase (dependency injection in routes, class-based modules, typed hooks)?
- **File size**: Are new/modified files staying within reasonable limits (~500 lines backend, ~300 lines frontend)?
- **Error handling**: Are errors properly caught, logged (with context), and returned to the caller?
- **Type safety**: No `any` types in TypeScript? Proper error typing?
- **Test coverage**: Do tests cover the new behavior? Are they testing behavior, not implementation?
- **DRY**: Is there duplicated logic that should be extracted?
- **Naming**: Are functions, variables, and files named clearly and consistently?

## Debugging

### CI/CD

When debugging CI/CD or GitHub Actions issues, check both the permissions AND the actual command execution logs. A fix isn't complete until the underlying behavior is verified working.
