type LocationMocks = {
  assign: jest.Mock<void, [string]>;
  reload: jest.Mock<void, []>;
  replace: jest.Mock<void, [string]>;
};

type LocationOverrides = {
  href?: string;
  origin?: string;
  protocol?: string;
  host?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
};

// Use globalThis for state to ensure it's shared across all modules and tests
// regardless of how they are transformed or bundled.
const getGlobalState = () => (globalThis as any).__locationMockState || {};
const setGlobalState = (state: any) => { (globalThis as any).__locationMockState = state; };

/**
 * Internal test helpers to manage location mocking state.
 * These are used by jest.setup.ts to sync state with tests.
 */
export const _testLocationHelpers = {
  setMocks: (mocks: LocationMocks | undefined) => { 
    const state = getGlobalState();
    state.mocks = mocks;
    setGlobalState(state);
  },
  setOverrides: (overrides: LocationOverrides | undefined) => { 
    const state = getGlobalState();
    state.overrides = overrides;
    setGlobalState(state);
  },
  getMocks: () => getGlobalState().mocks as LocationMocks | undefined,
  getOverrides: () => getGlobalState().overrides as LocationOverrides | undefined
};

/**
 * A type-safe wrapper for window.location to allow robust mocking in tests.
 * This avoids the need to redefine window.location directly while still
 * allowing tests to simulate different URLs and capture actions.
 */
export const locationUtils = {
  assign: (url: string): void => {
    const mocks = _testLocationHelpers.getMocks();
    if (mocks) {
      mocks.assign(url);
    } else {
      window.location.assign(url);
    }
  },

  replace: (url: string): void => {
    const mocks = _testLocationHelpers.getMocks();
    if (mocks) {
      mocks.replace(url);
    } else {
      window.location.replace(url);
    }
  },

  reload: (): void => {
    const mocks = _testLocationHelpers.getMocks();
    if (mocks) {
      mocks.reload();
    } else {
      window.location.reload();
    }
  },

  setHref: (url: string): void => {
    const mocks = _testLocationHelpers.getMocks();
    if (mocks) {
      mocks.assign(url);
    } else {
      window.location.href = url;
    }
  },

  getHref: () => _testLocationHelpers.getOverrides()?.href || window.location.href,
  getOrigin: () => _testLocationHelpers.getOverrides()?.origin || window.location.origin,
  getProtocol: () => _testLocationHelpers.getOverrides()?.protocol || window.location.protocol,
  getHost: () => _testLocationHelpers.getOverrides()?.host || window.location.host,
  getHostname: () => _testLocationHelpers.getOverrides()?.hostname || window.location.hostname,
  getPort: () => _testLocationHelpers.getOverrides()?.port || window.location.port,
  getPathname: () => _testLocationHelpers.getOverrides()?.pathname || window.location.pathname,
  getSearch: () => _testLocationHelpers.getOverrides()?.search || window.location.search,
};
