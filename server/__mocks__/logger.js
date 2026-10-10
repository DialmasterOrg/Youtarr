/* eslint-env jest */
module.exports = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  isLevelEnabled: jest.fn(() => true),
  applyLevelSetting: jest.fn(),
  getLoggingStatus: jest.fn(() => ({
    envLevel: 'info',
    file: { enabled: false, directory: '/app/config/logs', maxSizeBytes: 10485760, maxFiles: 5, error: null },
  })),
  child: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn()
  }))
};
