/* eslint-env jest */
jest.mock('../../logger');
jest.mock('../configModule', () => ({
  getConfig: jest.fn(),
  onConfigChange: jest.fn(),
}));

describe('logLevelSync', () => {
  let logLevelSync;
  let logger;
  let configModule;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    logger = require('../../logger');
    configModule = require('../configModule');
    logLevelSync = require('../logLevelSync');
  });

  test('apply sends the saved setting to the logger', () => {
    configModule.getConfig.mockReturnValue({ logLevel: 'debug' });

    logLevelSync.apply();

    expect(logger.applyLevelSetting).toHaveBeenCalledWith('debug', {});
  });

  test('apply passes options through to the logger', () => {
    configModule.getConfig.mockReturnValue({ logLevel: 'debug' });

    logLevelSync.apply({ announce: false });

    expect(logger.applyLevelSetting).toHaveBeenCalledWith('debug', { announce: false });
  });

  test('subscribe re-applies the setting whenever the config changes', () => {
    logLevelSync.subscribe();
    const onChange = configModule.onConfigChange.mock.calls[0][0];
    configModule.getConfig.mockReturnValue({ logLevel: 'warn' });

    onChange();

    expect(logger.applyLevelSetting).toHaveBeenCalledWith('warn', {});
  });
});
