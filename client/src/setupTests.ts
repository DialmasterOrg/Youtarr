import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Alias jest to vi for compatibility with legacy tests
globalThis.jest = vi;

// Mock matchMedia for MUI/JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
