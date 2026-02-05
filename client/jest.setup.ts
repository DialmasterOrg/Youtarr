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
