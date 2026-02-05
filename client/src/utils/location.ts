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

const getLocationMocks = (): LocationMocks | undefined => {
  return (globalThis as any).__locationMocks;
};

const getLocationOverrides = (): LocationOverrides | undefined => {
  return (globalThis as any).__locationOverrides;
};

/**
 * A type-safe wrapper for window.location to allow robust mocking in tests.
 * This avoids the need to redefine window.location directly while still
 * allowing tests to simulate different URLs and capture actions.
 */
export const locationUtils = {
  assign: (url: string): void => {
    const mocks = getLocationMocks();
    if (mocks) {
      mocks.assign(url);
    } else {
      window.location.assign(url);
    }
  },

  replace: (url: string): void => {
    const mocks = getLocationMocks();
    if (mocks) {
      mocks.replace(url);
    } else {
      window.location.replace(url);
    }
  },

  reload: (): void => {
    const mocks = getLocationMocks();
    if (mocks) {
      mocks.reload();
    } else {
      window.location.reload();
    }
  },

  setHref: (url: string): void => {
    const mocks = getLocationMocks();
    if (mocks) {
      mocks.assign(url);
    } else {
      window.location.href = url;
    }
  },

  getHref: () => getLocationOverrides()?.href ?? window.location.href,
  getOrigin: () => getLocationOverrides()?.origin ?? window.location.origin,
  getProtocol: () => getLocationOverrides()?.protocol ?? window.location.protocol,
  getHost: () => getLocationOverrides()?.host ?? window.location.host,
  getHostname: () => getLocationOverrides()?.hostname ?? window.location.hostname,
  getPort: () => getLocationOverrides()?.port ?? window.location.port,
  getPathname: () => getLocationOverrides()?.pathname ?? window.location.pathname,
  getSearch: () => getLocationOverrides()?.search ?? window.location.search,
};
