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
      }),
      existsSync: jest.fn().mockReturnValue(true), // Config exists by default
      mkdirSync: jest.fn()
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

    test('should use custom DATA_PATH when set in Docker environment', () => {
      process.env.IN_DOCKER_CONTAINER = '1';
      process.env.DATA_PATH = '/storage/rclone/storagebox/youtube';
      ConfigModule = require('../configModule');

      expect(ConfigModule.directoryPath).toBe('/storage/rclone/storagebox/youtube');
      expect(ConfigModule.ffmpegPath).toBe('/usr/bin/ffmpeg');

      delete process.env.DATA_PATH;
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

    test('should use custom DATA_PATH when set', async () => {
      process.env.DATA_PATH = '/custom/storage/path';
      const mockDfOutput = `Filesystem     1K-blocks    Used Available Use% Mounted on
/dev/sda1      1099511627776 549755813888 549755813888  50% /custom/storage/path`;

      execFilePromise.mockResolvedValue({ stdout: mockDfOutput });

      const status = await ConfigModule.getStorageStatus();

      expect(execFilePromise).toHaveBeenCalledWith('df', ['-B', '1', '/custom/storage/path']);
      expect(status).toBeTruthy();

      delete process.env.DATA_PATH;
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

  describe('auto-creation for platform deployments', () => {
    beforeEach(() => {
      // Reset mocks for auto-creation tests
      jest.resetModules();
      jest.clearAllMocks();

      jest.doMock('uuid', () => ({
        v4: jest.fn(() => 'auto-generated-uuid')
      }));
    });

    test('should auto-create config when DATA_PATH is set and config does not exist', () => {
      // Setup: DATA_PATH is set and config doesn't exist
      process.env.DATA_PATH = '/storage/rclone/storagebox/youtube';

      const mockFs = {
        existsSync: jest.fn()
          .mockReturnValueOnce(false) // Config doesn't exist on first check
          .mockReturnValue(true), // Exists after creation
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
        readFileSync: jest.fn().mockReturnValue(JSON.stringify({
          youtubeOutputDirectory: '/storage/rclone/storagebox/youtube',
          channelFilesToDownload: 3,
          preferredResolution: '1080',
          uuid: 'auto-generated-uuid'
        })),
        watch: jest.fn().mockReturnValue({ close: jest.fn() })
      };

      jest.doMock('fs', () => mockFs);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      ConfigModule = require('../configModule');

      // Verify auto-creation occurred
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenConfig = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
      expect(writtenConfig.youtubeOutputDirectory).toBe('/storage/rclone/storagebox/youtube');
      expect(writtenConfig.uuid).toBe('auto-generated-uuid');
      expect(writtenConfig.cronSchedule).toBe('0 */6 * * *');
      expect(writtenConfig.plexApiKey).toBe('');
      expect(consoleSpy).toHaveBeenCalledWith('Platform deployment detected (DATA_PATH is set). Auto-creating config.json...');

      consoleSpy.mockRestore();
      delete process.env.DATA_PATH;
    });

    test('should NOT auto-create config when DATA_PATH is set but config exists', () => {
      // Setup: DATA_PATH is set but config already exists
      process.env.DATA_PATH = '/storage/rclone/storagebox/youtube';

      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true), // Config exists
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
        readFileSync: jest.fn().mockReturnValue(JSON.stringify(mockConfig)),
        watch: jest.fn().mockReturnValue({ close: jest.fn() })
      };

      jest.doMock('fs', () => mockFs);

      ConfigModule = require('../configModule');

      // Verify no auto-creation occurred (writeFileSync only called for UUID, not for config creation)
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();

      delete process.env.DATA_PATH;
    });

    test('should NOT auto-create config when DATA_PATH is not set', () => {
      // Setup: DATA_PATH is not set
      delete process.env.DATA_PATH;

      const mockFs = {
        existsSync: jest.fn().mockReturnValue(false), // Config doesn't exist
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
        readFileSync: jest.fn(() => {
          throw new Error('ENOENT: no such file or directory');
        }),
        watch: jest.fn().mockReturnValue({ close: jest.fn() })
      };

      jest.doMock('fs', () => mockFs);

      // Should throw error when trying to read non-existent config
      expect(() => {
        ConfigModule = require('../configModule');
      }).toThrow('ENOENT');

      // Verify no auto-creation occurred
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    test('should create config directory if it does not exist', () => {
      process.env.DATA_PATH = '/storage/youtube';

      const mockFs = {
        existsSync: jest.fn()
          .mockReturnValueOnce(false) // Config doesn't exist
          .mockReturnValueOnce(false) // Config dir doesn't exist
          .mockReturnValue(true),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
        readFileSync: jest.fn().mockReturnValue(JSON.stringify({
          youtubeOutputDirectory: '/storage/youtube',
          uuid: 'auto-generated-uuid'
        })),
        watch: jest.fn().mockReturnValue({ close: jest.fn() })
      };

      jest.doMock('fs', () => mockFs);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      ConfigModule = require('../configModule');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('config'), { recursive: true });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Created config directory/));

      consoleSpy.mockRestore();
      delete process.env.DATA_PATH;
    });

    test('should include PLEX_URL in auto-created config when environment variable is set', () => {
      process.env.DATA_PATH = '/storage/youtube';
      process.env.PLEX_URL = 'http://plex:32400';

      const mockFs = {
        existsSync: jest.fn()
          .mockReturnValueOnce(false) // Config doesn't exist
          .mockReturnValue(true),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
        readFileSync: jest.fn().mockReturnValue(JSON.stringify({
          youtubeOutputDirectory: '/storage/youtube',
          plexUrl: 'http://plex:32400',
          uuid: 'auto-generated-uuid'
        })),
        watch: jest.fn().mockReturnValue({ close: jest.fn() })
      };

      jest.doMock('fs', () => mockFs);

      ConfigModule = require('../configModule');

      const writtenConfig = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
      expect(writtenConfig.plexUrl).toBe('http://plex:32400');

      delete process.env.DATA_PATH;
      delete process.env.PLEX_URL;
    });
  });

  describe('platform deployment detection', () => {
    test('isPlatformDeployment should return true when DATA_PATH is set', () => {
      process.env.DATA_PATH = '/storage/youtube';
      expect(ConfigModule.isPlatformDeployment()).toBe(true);
      delete process.env.DATA_PATH;
    });

    test('isPlatformDeployment should return false when DATA_PATH is not set', () => {
      delete process.env.DATA_PATH;
      expect(ConfigModule.isPlatformDeployment()).toBe(false);
    });
  });

  describe('platform-aware paths', () => {
    test('getImagePath should return config/images when in platform mode', () => {
      process.env.DATA_PATH = '/storage/youtube';
      const imagePath = ConfigModule.getImagePath();
      expect(imagePath).toContain('config/images');
      delete process.env.DATA_PATH;
    });

    test('getImagePath should return server/images when not in platform mode', () => {
      delete process.env.DATA_PATH;
      const imagePath = ConfigModule.getImagePath();
      expect(imagePath).toContain('server/images');
    });

    test('getJobsPath should return config/jobs when in platform mode', () => {
      process.env.DATA_PATH = '/storage/youtube';
      const jobsPath = ConfigModule.getJobsPath();
      expect(jobsPath).toContain('config/jobs');
      delete process.env.DATA_PATH;
    });

    test('getJobsPath should return jobs when not in platform mode', () => {
      delete process.env.DATA_PATH;
      const jobsPath = ConfigModule.getJobsPath();
      expect(jobsPath).toContain('/jobs');
    });
  });
});