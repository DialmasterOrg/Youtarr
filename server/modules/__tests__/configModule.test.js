/* eslint-env jest */
const path = require('path');
const { EventEmitter } = require('events');

// Mock child_process for getStorageStatus tests
jest.mock('child_process', () => ({
  execFile: jest.fn()
}));

describe('ConfigModule', () => {
  let fs;
  let ConfigModule;
  const mockConfigPath = path.join(__dirname, '../../../config/config.json');
  const mockConfig = {
    plexApiKey: 'test-plex-key',
    youtubeOutputDirectory: '/test/output',
    plexLibrarySection: 1,
    cronSchedule: '0 */6 * * *',
    devYoutubeOutputDirectory: '/dev/output',
    devffmpegPath: '/usr/local/bin/ffmpeg'
  };

  beforeEach(() => {
    // Clear module cache
    jest.resetModules();
    
    // Reset UUID mock
    jest.doMock('uuid', () => ({
      v4: jest.fn(() => 'test-uuid-1234')
    }));
    
    // Mock fs module
    jest.doMock('fs', () => ({
      readFileSync: jest.fn().mockReturnValue(JSON.stringify(mockConfig)),
      writeFileSync: jest.fn(),
      watch: jest.fn().mockReturnValue({
        close: jest.fn()
      })
    }));
    
    // Get the mocked fs for assertions
    fs = require('fs');
    
    // Clear environment
    delete process.env.IN_DOCKER_CONTAINER;
  });

  afterEach(() => {
    // Clean up
    if (ConfigModule && ConfigModule.stopWatchingConfig) {
      ConfigModule.stopWatchingConfig();
    }
    jest.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    test('should load config from file and set defaults', () => {
      ConfigModule = require('../configModule');
      
      expect(fs.readFileSync).toHaveBeenCalledWith(mockConfigPath);
      expect(ConfigModule.config).toMatchObject(mockConfig);
      expect(ConfigModule.config.channelFilesToDownload).toBe(3);
      expect(ConfigModule.config.preferredResolution).toBe('1080');
    });

    test('should generate and save UUID if not present', () => {
      const uuid = require('uuid');
      ConfigModule = require('../configModule');
      
      expect(uuid.v4).toHaveBeenCalled();
      expect(ConfigModule.config.uuid).toBe('test-uuid-1234');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(ConfigModule.config, null, 2)
      );
    });

    test('should not generate UUID if already present', () => {
      const configWithUuid = { ...mockConfig, uuid: 'existing-uuid' };
      fs.readFileSync.mockReturnValue(JSON.stringify(configWithUuid));
      
      const uuid = require('uuid');
      ConfigModule = require('../configModule');
      
      expect(uuid.v4).not.toHaveBeenCalled();
      expect(ConfigModule.config.uuid).toBe('existing-uuid');
      // Should still save for other defaults
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    test('should use Docker paths when IN_DOCKER_CONTAINER is set', () => {
      process.env.IN_DOCKER_CONTAINER = '1';
      ConfigModule = require('../configModule');
      
      expect(ConfigModule.directoryPath).toBe('/usr/src/app/data');
      expect(ConfigModule.ffmpegPath).toBe('/usr/bin/ffmpeg');
    });

    test('should use dev paths when not in Docker', () => {
      ConfigModule = require('../configModule');
      
      expect(ConfigModule.directoryPath).toBe('/dev/output');
      expect(ConfigModule.ffmpegPath).toBe('/usr/local/bin/ffmpeg');
    });

    test('should start watching config file', () => {
      ConfigModule = require('../configModule');
      
      expect(fs.watch).toHaveBeenCalledWith(mockConfigPath, expect.any(Function));
    });
  });

  describe('config operations', () => {
    beforeEach(() => {
      ConfigModule = require('../configModule');
    });

    test('getConfig should return current config', () => {
      const config = ConfigModule.getConfig();
      
      expect(config).toMatchObject(mockConfig);
      expect(config.uuid).toBe('test-uuid-1234');
      expect(config.channelFilesToDownload).toBe(3);
      expect(config.preferredResolution).toBe('1080');
    });

    test('updateConfig should save and emit change event', () => {
      const changeListener = jest.fn();
      const newConfig = { ...mockConfig, plexApiKey: 'new-key' };
      
      ConfigModule.on('change', changeListener);
      ConfigModule.updateConfig(newConfig);
      
      expect(ConfigModule.config.plexApiKey).toBe('new-key');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(newConfig, null, 2)
      );
      expect(changeListener).toHaveBeenCalled();
    });

    test('saveConfig should write formatted JSON', () => {
      ConfigModule.config.testField = 'test-value';
      ConfigModule.saveConfig();
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      const savedData = fs.writeFileSync.mock.calls[fs.writeFileSync.mock.calls.length - 1][1];
      const parsed = JSON.parse(savedData);
      expect(parsed.testField).toBe('test-value');
    });
  });

  describe('file watching', () => {
    beforeEach(() => {
      ConfigModule = require('../configModule');
    });

    test('should reload config on file change', () => {
      const changeListener = jest.fn();
      ConfigModule.on('change', changeListener);
      
      // Get the watch callback
      const watchCallback = fs.watch.mock.calls[0][1];
      
      // Simulate file change
      const updatedConfig = { ...mockConfig, plexApiKey: 'updated-key' };
      fs.readFileSync.mockReturnValue(JSON.stringify(updatedConfig));
      
      watchCallback('change');
      
      expect(ConfigModule.config.plexApiKey).toBe('updated-key');
      expect(changeListener).toHaveBeenCalled();
    });

    test('should ignore non-change events', () => {
      const changeListener = jest.fn();
      ConfigModule.on('change', changeListener);
      
      const watchCallback = fs.watch.mock.calls[0][1];
      watchCallback('rename');
      
      expect(changeListener).not.toHaveBeenCalled();
    });

    test('stopWatchingConfig should close watcher', () => {
      const mockWatcher = { close: jest.fn() };
      fs.watch.mockReturnValue(mockWatcher);
      
      // Re-require to get new watcher
      jest.resetModules();
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(JSON.stringify(mockConfig)),
        writeFileSync: jest.fn(),
        watch: jest.fn().mockReturnValue(mockWatcher)
      }));
      jest.doMock('uuid', () => ({
        v4: jest.fn(() => 'test-uuid-1234')
      }));
      
      const FreshConfigModule = require('../configModule');
      FreshConfigModule.stopWatchingConfig();
      
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      ConfigModule = require('../configModule');
    });

    test('onConfigChange should register listener', () => {
      const callback = jest.fn();
      
      ConfigModule.onConfigChange(callback);
      ConfigModule.emit('change');
      
      expect(callback).toHaveBeenCalled();
    });

    test('should inherit EventEmitter methods', () => {
      expect(ConfigModule).toBeInstanceOf(EventEmitter);
      expect(typeof ConfigModule.on).toBe('function');
      expect(typeof ConfigModule.emit).toBe('function');
    });
  });

  describe('getStorageStatus', () => {
    let util;
    let execFilePromise;

    beforeEach(() => {
      ConfigModule = require('../configModule');
      util = require('util');
      execFilePromise = jest.fn();
      jest.spyOn(util, 'promisify').mockReturnValue(execFilePromise);
    });

    test('should return storage info on success', async () => {
      const mockDfOutput = `Filesystem     1K-blocks    Used Available Use% Mounted on
/dev/sda1      1099511627776 549755813888 549755813888  50% /usr/src/app/data`;

      execFilePromise.mockResolvedValue({ stdout: mockDfOutput });
      
      const status = await ConfigModule.getStorageStatus();
      
      expect(execFilePromise).toHaveBeenCalledWith('df', ['-B', '1', '/usr/src/app/data']);
      expect(status).toMatchObject({
        total: 1099511627776,
        used: 549755813888,
        available: 549755813888,
        percentUsed: 50,
        percentFree: 50,
        totalGB: '1024.0',
        usedGB: '512.0',
        availableGB: '512.0'
      });
    });

    test('should handle df command errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      execFilePromise.mockRejectedValue(new Error('df command failed'));
      
      const status = await ConfigModule.getStorageStatus();
      
      expect(status).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting storage status:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    test('should handle unexpected df output', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      execFilePromise.mockResolvedValue({ stdout: 'invalid output' });
      
      const status = await ConfigModule.getStorageStatus();
      
      expect(status).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    test('should handle missing optional config fields', () => {
      const minimalConfig = {
        plexApiKey: 'key',
        youtubeOutputDirectory: '/output'
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(minimalConfig));
      ConfigModule = require('../configModule');
      
      expect(ConfigModule.config.channelFilesToDownload).toBe(3);
      expect(ConfigModule.config.preferredResolution).toBe('1080');
      expect(ConfigModule.ffmpegPath).toBeUndefined(); // No devffmpegPath in config
      expect(ConfigModule.directoryPath).toBeUndefined(); // No devYoutubeOutputDirectory
    });

    test('should handle existing channelFilesToDownload and preferredResolution', () => {
      const configWithDefaults = {
        ...mockConfig,
        channelFilesToDownload: 5,
        preferredResolution: '720'
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(configWithDefaults));
      ConfigModule = require('../configModule');
      
      expect(ConfigModule.config.channelFilesToDownload).toBe(5);
      expect(ConfigModule.config.preferredResolution).toBe('720');
    });
  });
});