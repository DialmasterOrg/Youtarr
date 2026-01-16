import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';
import { MessageChannel, MessagePort } from 'worker_threads';

if (!globalThis.TextEncoder) {
  Object.defineProperty(globalThis, 'TextEncoder', {
    writable: true,
    value: TextEncoder,
  });
}

if (!globalThis.TextDecoder) {
  Object.defineProperty(globalThis, 'TextDecoder', {
    writable: true,
    value: TextDecoder,
  });
}

if (!globalThis.ReadableStream) {
  Object.defineProperty(globalThis, 'ReadableStream', {
    writable: true,
    value: ReadableStream,
  });
}

if (!globalThis.TransformStream) {
  Object.defineProperty(globalThis, 'TransformStream', {
    writable: true,
    value: TransformStream,
  });
}

if (!globalThis.WritableStream) {
  Object.defineProperty(globalThis, 'WritableStream', {
    writable: true,
    value: WritableStream,
  });
}

if (!globalThis.MessageChannel) {
  Object.defineProperty(globalThis, 'MessageChannel', {
    writable: true,
    value: MessageChannel,
  });
}

if (!globalThis.MessagePort) {
  Object.defineProperty(globalThis, 'MessagePort', {
    writable: true,
    value: MessagePort,
  });
}

if (!globalThis.BroadcastChannel) {
  class MockBroadcastChannel {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;

    constructor(name: string) {
      this.name = name;
    }

    postMessage = jest.fn();
    close = jest.fn();
    addEventListener = jest.fn();
    removeEventListener = jest.fn();
    dispatchEvent = jest.fn();
  }

  Object.defineProperty(globalThis, 'BroadcastChannel', {
    writable: true,
    value: MockBroadcastChannel,
  });
}

const { Headers, Request, Response } = require('undici');

if (!globalThis.Response) {
  Object.defineProperty(globalThis, 'Response', {
    writable: true,
    configurable: true,
    value: Response,
  });
}

if (!globalThis.Headers) {
  Object.defineProperty(globalThis, 'Headers', {
    writable: true,
    configurable: true,
    value: Headers,
  });
}

if (!globalThis.Request) {
  Object.defineProperty(globalThis, 'Request', {
    writable: true,
    configurable: true,
    value: Request,
  });
}

const { server } = require('./mocks/server');

// Provide a stable, mockable fetch for unit tests.
Object.defineProperty(globalThis, 'fetch', {
  writable: true,
  configurable: true,
  value: jest.fn(),
});

// Mock matchMedia for MUI/JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock Notification API
Object.defineProperty(window, 'Notification', {
  writable: true,
  configurable: true,
  value: jest.fn().mockImplementation(() => ({
    permission: 'granted',
  })),
});

Object.defineProperty(window.Notification, 'requestPermission', {
  writable: true,
  value: jest.fn().mockResolvedValue('granted'),
});

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => {
  server.resetHandlers();
  
  // Clear any pending timers that might be keeping the event loop alive.
  try {
    if (typeof jest !== 'undefined' && jest.useFakeTimers) {
      // Small check to see if we're in a fake timers context
      // but clearAllTimers is generally safe to call if jest is available.
      jest.clearAllTimers();
    }
  } catch (e) {
    // Ignore if timers are not mockable in this context
  }
});

// Clean up after the tests are finished.
afterAll(() => server.close());
