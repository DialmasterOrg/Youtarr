import '@testing-library/jest-dom';

// Node < 18 fallback (avoid overriding when native fetch exists)
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
}

// Minimal Request polyfill for tests that do `instanceof Request`
if (typeof globalThis.Request === 'undefined') {
  globalThis.Request = class Request {
    url: string;
    constructor(input: string | { url: string }) {
      this.url = typeof input === 'string' ? input : input.url;
    }
  } as any;
}

// Some libs (and JSDOM) expect these to exist
import { TextDecoder, TextEncoder } from 'util';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as any;
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as any;
}

type LocationMocks = {
  assign: jest.Mock<void, [string]>;
  reload: jest.Mock<void, []>;
  replace: jest.Mock<void, [string]>;
};

type LocationOverrides = {
  href: string;
  origin: string;
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
};

const setMockLocation = (url: string): LocationMocks => {
  const parsed = new URL(url, 'http://localhost/');
  
  const overrides: LocationOverrides = {
    href: parsed.href,
    origin: parsed.origin,
    protocol: parsed.protocol,
    host: parsed.host,
    hostname: parsed.hostname,
    port: parsed.port,
    pathname: parsed.pathname,
    search: parsed.search,
  };

  globalThis.__locationOverrides = overrides;

  // Use existing mocks if they already exist to prevent losing references in tests
  if (globalThis.__locationMocks) {
    return globalThis.__locationMocks;
  }

  const mocks: LocationMocks = {
    assign: jest.fn((nextUrl: string) => {
      setMockLocation(new URL(nextUrl, globalThis.__locationOverrides?.href || 'http://localhost/').href);
    }),
    replace: jest.fn((nextUrl: string) => {
      setMockLocation(new URL(nextUrl, globalThis.__locationOverrides?.href || 'http://localhost/').href);
    }),
    reload: jest.fn(),
  };

  globalThis.__locationMocks = mocks;

  return mocks;
};

declare global {
  interface GlobalThis {
    setMockLocation: (url: string) => LocationMocks;
    __locationMocks: LocationMocks | undefined;
    __locationOverrides: LocationOverrides | undefined;
  }
}

globalThis.setMockLocation = setMockLocation;

// Note: Direct window.location redefinition is blocked in JSDOM (Jest 30).
// We use the locationUtils abstraction instead (src/utils/location.ts).

beforeEach(() => {
  globalThis.__locationMocks = undefined;
  globalThis.__locationOverrides = undefined;
  setMockLocation('http://localhost/');
});

// Mock import.meta.env for source code that hasn't been transformed by SWC
// We define it on globalThis as well to ensure it's picked up
Object.defineProperty(globalThis, 'importMetaEnv', {
  value: { DEV: true, MODE: 'test', VITE_BACKEND_PORT: '3011' },
  writable: false,
});

// Polyfill for source code using import.meta.env directly
// @ts-ignore
if (typeof global.importMeta === 'undefined') {
  // @ts-ignore
  global.importMeta = { env: { DEV: true, MODE: 'test' } };
}
