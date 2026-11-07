---
paths:
  - "server/**/*"
---

# Backend standards (Node.js/Express)

Apply these when creating or substantially rewriting server code. Scope Discipline in the root file wins when they conflict: do not refactor code you only pass through.

## Logging

- Always the Pino logger (`require('../logger')`), never `console.log` or `console.error`. Structured context objects, not string interpolation: `logger.error({ err: error, videoId }, 'Download failed')`.
- Levels: `error` for failures needing attention, `warn` for recoverable issues, `info` for significant operations, `debug` for diagnostic detail.
- Pino redacts known top-level keys only, so it will not catch a secret nested in a logged object.

## Errors and responses

- Standard error shape: `res.status(code).json({ error: 'Human-readable message' })`. The codebase has drift (`{ success: false, error }`, `{ status, message }`); new code uses `{ error }`.
- Every async route handler catches its errors with try-catch and logs them with context (ids, operation name, the error object). `server.js` logs unhandled rejections instead of exiting, but they still count as bugs.
- Status codes: 400 bad input, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 503 service unavailable. A 503 with `requiresDbFix: true` triggers the client's database error overlay.

## Routes

- Route files export a dependency-injection factory wired in `server/routes/index.js`, and new routes receive stateful modules as factory arguments:

  ```javascript
  function createMyRoutes({ verifyToken, myModule }) {
    const router = express.Router();
    // ...
    return router;
  }
  module.exports = createMyRoutes;
  ```

- The codebase has drift (`config.js`, `health.js`, `ytdlpOptions.js` and `videos.js` import stateful modules directly). Constants, error classes and pure helpers may be imported; new code takes stateful modules through the factory.
- Routes stay thin: call module methods and format responses. Business logic belongs in modules.
- Legacy API keys (`x-api-key` through `verifyToken`) reach only `POST /api/videos/download`; every other `/api` route answers them 403. The External API (`/external-api/v1`) authenticates its own keys in `middleware/externalApiAuth.js`.
- Rate limiting follows `server/routes/videos.js` and `server/routes/auth.js`.

## Modules

- Class-based singletons: `module.exports = new MyModule()`.
- No circular dependencies, and no late-binding `require()` inside methods as a workaround: restructure, extract shared logic, use events, or pass dependencies at call time. `cronJobs.js` and others still do this; do not copy or refactor it during unrelated work.
- Sub-module aggregator pattern for complex features: `server/modules/filesystem/` and `server/modules/notifications/` are the examples to follow.
- Never call an async function without awaiting it or attaching error handling. Named constants go at the top of the file or in a shared constants module.
- Sequelize model methods over raw SQL unless there is a specific performance reason. Multi-step writes that must be atomic run in a transaction.
