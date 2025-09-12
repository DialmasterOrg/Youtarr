// Global test setup
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  // Keep log, info, debug for debugging
  log: console.log,
  info: console.info,
  debug: console.debug,
};