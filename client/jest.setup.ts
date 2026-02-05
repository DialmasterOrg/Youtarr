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

// Mock window.location properly for JSDOM
// We use a property descriptor to make it configurable
const mockLocation = {
  ...window.location,
  reload: jest.fn(),
  assign: jest.fn(),
  replace: jest.fn(),
};

try {
  Object.defineProperty(window, 'location', {
    value: mockLocation,
    configurable: true,
    writable: true,
  });
} catch (e) {
  console.warn('Could not mock window.location:', e);
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
