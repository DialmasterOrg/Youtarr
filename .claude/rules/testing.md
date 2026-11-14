---
paths:
  - "**/__tests__/**/*"
  - "**/*.test.js"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.story.tsx"
  - "**/*.stories.tsx"
---

# Testing

Jest on both sides, React Testing Library on the client. Test files in shared folders such as `server/modules/__tests__/` load only this rule and the backend or frontend one, so read the module under test first to load its area's rule.

## React Testing Library

- No direct DOM access (`querySelector`, `parentElement`, native node methods); ESLint enforces `testing-library/no-node-access`. Use `getByRole`, `getByLabelText`, `getByText`, `getByTestId`, and `within()` for scoped queries; restructure the test instead of walking to a parent.
- No conditional `expect`. Assert behavior (outputs, side effects, state), not implementation.
- Components needing router, theme, WebSocket or tooltip context render through `renderWithProviders` in `client/src/test-utils.tsx`, whose default socket comes from `createMockWebSocketContext()`.
- `*.story.tsx` and `*.stories.tsx` do not match Jest's `testMatch`, but `client/src/tests/storybook_coverage.test.js` imports stories and asserts on them, so a story edit can fail Jest.

## Jest mocking gotchas (project-specific)

- Mocking a React component: no JSX inside `jest.mock()`, because hoisting makes it fail with "Invalid variable access". Use `React.createElement` via `require('react')` inside the factory, with `__esModule: true` and a `default` function.
- Mocking axios: a factory with only the methods you need (`jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }))`). With that factory, `const axios = require('axios')` and `import axios from 'axios'` both work.
- Mocking `fetch` JSON: `json: jest.fn().mockResolvedValueOnce(data)`, not an async arrow function, which returns the wrong shape.
- Mock paths resolve relative to the test file, not the module under test; double-check `../` versus `../../`.

## Backend tests

- All `jest.mock()` calls before `require()`. `jest.resetModules()` and `jest.clearAllMocks()` in `beforeEach`, then re-require the module under test.
- Mock only external dependencies (db, fs, HTTP, logger); consult an existing test under `server/modules/__tests__/` or `client/src/**/__tests__/` before mocking a new dependency. Needing to mock internal module methods usually means a design issue.
- `downloadModule.test.js` replaces model files with plain objects, so a module it loads must not require the models index: its association setup throws on them.
- A module that requires `membersAccess` loads a model at require time, which fails against a mocked `db`; such tests add `jest.mock('<path>/membersAccess')`, which picks up `server/modules/__mocks__/membersAccess.js` (no cookies by default).

## Hook tests

- `renderHook` with explicit type annotations for parameterized hooks, for example `renderHook(({ token }: { token: string | null }) => useMyHook(token), { initialProps: { token: null as string | null } })`, then `rerender({ token })`.
- `waitFor` for async state changes, never arbitrary delays. Polling and interval hooks use `jest.useFakeTimers()` with `jest.runOnlyPendingTimers()` and `jest.useRealTimers()` in `afterEach`, plus a test that unmounts and proves no further calls.

## Quality

- One behavior per test; meaningful names (`'returns empty array when no channels exist'`); minimal setup, with `beforeEach` only for genuinely shared setup; never expose internals just to test them.
- Run single files during development; the full suites are slow.
