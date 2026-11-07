/* eslint-env jest */
// Manual mock for tests of modules that use membersAccess but mock the
// database. Defaults behave like a setup without cookies, where downloads
// keep members-only videos out exactly as before access was tracked.
const STATE = Object.freeze({
  NO_COOKIES: 'no_cookies',
  UNCHECKED: 'unchecked',
  CONFIRMED: 'confirmed',
  DENIED: 'denied',
});

module.exports = {
  STATE,
  ACCESS: Object.freeze({ CONFIRMED: 'confirmed', DENIED: 'denied' }),
  ACCESS_TTL_MS: 24 * 60 * 60 * 1000,
  MAX_FILTERED_DENIALS: 5000,
  isBlockedState: (state) => state === STATE.NO_COOKIES || state === STATE.DENIED,
  isCookiesRejected: jest.fn(() => false),
  getContext: jest.fn(() => ({ cookiesConfigured: false, cookieKey: null })),
  // Without cookies every known members-only video is no_cookies.
  getStates: jest.fn(async (ids = [], { knownMembersOnly = new Set() } = {}) => new Map(
    ids.filter((id) => knownMembersOnly.has(id)).map((id) => [id, STATE.NO_COOKIES])
  )),
  getFreshDeniedIds: jest.fn(async () => []),
  buildDownloadFilter: jest.fn(async ({ cookiesEnabled } = {}) => (cookiesEnabled ? null : 'availability!=subscriber_only')),
  recordVerdict: jest.fn(async () => {}),
  recordMembersOnly: jest.fn(async () => {}),
  clearVerdicts: jest.fn(async () => {}),
  recordFetchOutcome: jest.fn(async (_id, { availability = null, errorMessage = null } = {}) => (
    errorMessage !== null || availability === 'subscriber_only' ? STATE.NO_COOKIES : null
  )),
  recordDownloadOutcome: jest.fn(async () => {}),
};
