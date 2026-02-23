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
import { _testLocationHelpers } from './src/utils/location';

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

  _testLocationHelpers.setOverrides(overrides);

  // Use existing mocks if they already exist to prevent losing references in tests
  const existingMocks = _testLocationHelpers.getMocks();
  if (existingMocks) {
    return existingMocks as unknown as LocationMocks;
  }

  const mocks: LocationMocks = {
    assign: jest.fn((nextUrl: string) => {
      setMockLocation(new URL(nextUrl, _testLocationHelpers.getOverrides()?.href || 'http://localhost/').href);
    }),
    replace: jest.fn((nextUrl: string) => {
      setMockLocation(new URL(nextUrl, _testLocationHelpers.getOverrides()?.href || 'http://localhost/').href);
    }),
    reload: jest.fn(),
  };

  _testLocationHelpers.setMocks(mocks as any);

  return mocks;
};

declare global {
  var setMockLocation: (url: string) => LocationMocks;
}

// @ts-ignore
globalThis.setMockLocation = setMockLocation;

// Note: Direct window.location redefinition is blocked in JSDOM (Jest 30).
// We use the locationUtils abstraction instead (src/utils/location.ts).

beforeEach(() => {
  _testLocationHelpers.setMocks(undefined);
  _testLocationHelpers.setOverrides(undefined);
  setMockLocation('http://localhost/');
});

// Global matchMedia mock – required because jsdom does not implement window.matchMedia.
// Uses a plain function (NOT jest.fn()) so resetMocks:true does NOT wipe the implementation.
// Tests that need responsive behaviour can re-define per-test with Object.defineProperty.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

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

// Radix UI Slider (and other pointer-based primitives) call these in JSDOM where
// they are undefined. We provide no-op stubs so the tests don't throw.
if (typeof HTMLElement !== 'undefined') {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = function () { return false; };
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = function () {};
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = function () {};
  }
  // Radix Select calls scrollIntoView on focused items; JSDOM doesn't implement it.
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = function () {};
  }
}
