jest.mock('fs');
jest.mock('uuid');
jest.mock('../../logger');
jest.mock('child_process');

describe('ConfigModule', () => {
  let ConfigModule;
  let fs;
  let logger;
  let uuid;
  let util;
  let originalEnv;

  // Default template config
  const defaultTemplate = {
    uuid: '',
    plexUrl: '',
    plexApiKey: '',
    plexPort: '32400',
    plexLibrarySection: '',
    channelDownloadFrequency: '0 */6 * * *',
    videoResolution: '1080',
    sponsorBlock: {
      enabled: false,
      categories: []
    },
    cookiesEnabled: false,
    customCookiesUploaded: false,
    useTmpForDownloads: false,
    tmpFilePath: '/tmp',
    autoRemoval: {
      enabled: false,
      minDaysOld: 30
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Store original environment
    originalEnv = { ...process.env };
    delete process.env.DATA_PATH;
    delete process.env.PLATFORM;
    delete process.env.PLEX_URL;

    // Setup fs mocks
    fs = require('fs');
    fs.existsSync = jest.fn();
    fs.readFileSync = jest.fn();
    fs.writeFileSync = jest.fn();
    fs.mkdirSync = jest.fn();
    fs.watch = jest.fn().mockReturnValue({ close: jest.fn() });
    fs.chmodSync = jest.fn();
    fs.unlinkSync = jest.fn();

    // Setup uuid mock
    uuid = require('uuid');
    uuid.v4 = jest.fn().mockReturnValue('test-uuid-1234');

    // Setup logger mock
    logger = require('../../logger');

    util = require('util');
    jest.spyOn(util, 'promisify');
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe('Constructor and Initialization', () => {
    test('should create config from template when config.json does not exist', () => {
      // Arrange
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('config.json')) return false;
        if (path.includes('config.example.json')) return true;
        return true;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.stringContaining('test-uuid-1234')
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Auto-creating config.json from config.example.json template'
      );
    });

    test('should load existing config.json when it exists', () => {
      // Arrange
      const existingConfig = { ...defaultTemplate, uuid: 'existing-uuid', plexUrl: 'http://localhost:32400' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('config.json') && !path.includes('example')) {
          return JSON.stringify(existingConfig);
        }
        return JSON.stringify(defaultTemplate);
      });

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(ConfigModule.getConfig().uuid).toBe('existing-uuid');
      expect(ConfigModule.getConfig().plexUrl).toBe('http://localhost:32400');
    });

    test('should merge missing fields from template into existing config', () => {
      // Arrange
      const existingConfig = { uuid: 'existing-uuid', plexUrl: 'http://localhost:32400' };
      const completeTemplate = { ...defaultTemplate, newField: 'newValue' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('config.json') && !path.includes('example')) {
          return JSON.stringify(existingConfig);
        }
        return JSON.stringify(completeTemplate);
      });

      // Act
      ConfigModule = require('../configModule');

      // Assert
      const config = ConfigModule.getConfig();
      expect(config.uuid).toBe('existing-uuid'); // Preserved
      expect(config.plexUrl).toBe('http://localhost:32400'); // Preserved
      expect(config.newField).toBe('newValue'); // Added from template
      expect(fs.writeFileSync).toHaveBeenCalled(); // Config saved due to merge
    });

    test('should migrate legacy cronSchedule to channelDownloadFrequency', () => {
      // Arrange
      const legacyConfig = {
        ...defaultTemplate,
        cronSchedule: '0 */4 * * *'
      };
      delete legacyConfig.channelDownloadFrequency;

      const templateWithCronSchedule = {
        ...defaultTemplate,
        cronSchedule: '0 */4 * * *'
      };
      delete templateWithCronSchedule.channelDownloadFrequency;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('config.json') && !path.includes('example')) {
          return JSON.stringify(legacyConfig);
        }
        return JSON.stringify(templateWithCronSchedule);
      });

      // Act
      ConfigModule = require('../configModule');

      // Assert
      const config = ConfigModule.getConfig();
      expect(config.channelDownloadFrequency).toBe('0 */4 * * *');
      expect(config.cronSchedule).toBeUndefined();
      expect(logger.info).toHaveBeenCalledWith('Migrated legacy cronSchedule field to channelDownloadFrequency');
    });

    test('should convert plexPort to string if it is a number', () => {
      // Arrange
      const configWithNumberPort = {
        ...defaultTemplate,
        plexPort: 32400
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('config.json') && !path.includes('example')) {
          return JSON.stringify(configWithNumberPort);
        }
        return JSON.stringify(defaultTemplate);
      });

      // Act
      ConfigModule = require('../configModule');

      // Assert
      const config = ConfigModule.getConfig();
      expect(config.plexPort).toBe('32400');
      expect(typeof config.plexPort).toBe('string');
      expect(logger.info).toHaveBeenCalledWith('Converted plexPort to string type');
    });

    test('should set up file watcher for config changes', () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(fs.watch).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.any(Function)
      );
    });

    test('should apply PLEX_URL from environment when creating new config', () => {
      // Arrange
      process.env.PLEX_URL = 'http://plex.example.com:32400';
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('config.json') && !path.includes('example')) return false;
        return true;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      const savedConfig = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(savedConfig.plexUrl).toBe('http://plex.example.com:32400');
      expect(logger.info).toHaveBeenCalledWith(
        { plexUrl: 'http://plex.example.com:32400' },
        'Applied PLEX_URL from environment'
      );
    });
  });

  describe('Platform Detection', () => {
    test('should detect platform deployment when DATA_PATH is set', () => {
      // Arrange
      process.env.DATA_PATH = '/custom/data/path';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(ConfigModule.isPlatformDeployment()).toBe(true);
    });

    test('should not detect platform deployment when DATA_PATH is not set', () => {
      // Arrange
      delete process.env.DATA_PATH;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(ConfigModule.isPlatformDeployment()).toBe(false);
    });

    test('should detect Elfhosted platform when PLATFORM=elfhosted', () => {
      // Arrange
      process.env.PLATFORM = 'elfhosted';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(ConfigModule.isElfhostedPlatform()).toBe(true);
    });

    test('should override temp download settings for Elfhosted platform', () => {
      // Arrange
      process.env.PLATFORM = 'ELFHOSTED'; // Test case-insensitive
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      const config = ConfigModule.getConfig();
      expect(config.useTmpForDownloads).toBe(true);
      expect(config.tmpFilePath).toBe('/app/config/temp_downloads');
    });

    test('should create platform directories when DATA_PATH is set', () => {
      // Arrange
      process.env.DATA_PATH = '/custom/data';
      fs.existsSync.mockImplementation((path) => {
        // Config file exists, but directories do not
        if (path.includes('config.json') && !path.includes('example')) return true;
        if (path.includes('config.example.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('config/images'),
        { recursive: true }
      );
    });

    test('should create Elfhosted temp download directory', () => {
      // Arrange
      process.env.PLATFORM = 'elfhosted';
      process.env.DATA_PATH = '/custom/data';
      fs.existsSync.mockImplementation((path) => {
        // Config file exists, but directories do not
        if (path.includes('config.json') && !path.includes('example')) return true;
        if (path.includes('config.example.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/app/config/temp_downloads',
        { recursive: true }
      );
    });
  });

  describe('Configuration Management', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));
    });

    test('should return current config with getConfig()', () => {
      // Arrange
      ConfigModule = require('../configModule');

      // Act
      const config = ConfigModule.getConfig();

      // Assert
      expect(config).toHaveProperty('uuid');
      expect(config).toHaveProperty('plexUrl');
      expect(config).toHaveProperty('channelDownloadFrequency');
    });

    test('should update config and emit change event', (done) => {
      // Arrange
      ConfigModule = require('../configModule');
      const newConfig = { ...defaultTemplate, plexUrl: 'http://new-plex:32400' };

      ConfigModule.on('change', () => {
        // Assert
        expect(ConfigModule.getConfig().plexUrl).toBe('http://new-plex:32400');
        expect(fs.writeFileSync).toHaveBeenCalled();
        done();
      });

      // Act
      ConfigModule.updateConfig(newConfig);
    });

    test('should filter deprecated fields when saving config', () => {
      // Arrange
      ConfigModule = require('../configModule');
      const configWithDeprecated = {
        ...defaultTemplate,
        youtubeOutputDirectory: '/old/path',
        envAuthApplied: true
      };

      // Act
      ConfigModule.updateConfig(configWithDeprecated);

      // Assert
      const savedConfig = JSON.parse(fs.writeFileSync.mock.calls[fs.writeFileSync.mock.calls.length - 1][1]);
      expect(savedConfig.youtubeOutputDirectory).toBeUndefined();
      expect(savedConfig.envAuthApplied).toBeUndefined();
    });

    test('should not save Elfhosted temp download overrides to config file', () => {
      // Arrange
      process.env.PLATFORM = 'elfhosted';
      ConfigModule = require('../configModule');

      // Act
      ConfigModule.saveConfig();

      // Assert
      const savedConfig = JSON.parse(fs.writeFileSync.mock.calls[fs.writeFileSync.mock.calls.length - 1][1]);
      expect(savedConfig.useTmpForDownloads).toBeUndefined();
      expect(savedConfig.tmpFilePath).toBeUndefined();
    });
  });

  describe('File Operations', () => {
    test('should use config.example.json from mounted volume if it exists', () => {
      // Arrange
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('config.json') && !path.includes('example')) return false;
        if (path.includes('config/config.example.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('config/config.example.json') }),
        'Using config.example.json from mounted volume'
      );
    });

    test('should fall back to image template if mounted volume does not have config.example.json', () => {
      // Arrange
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('config.json') && !path.includes('example')) return false;
        // The template path is relative to __dirname (server/modules)
        if (path.includes('server/config.example.json')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      // Act
      ConfigModule = require('../configModule');

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('server/config.example.json') }),
        'Using config.example.json from image template'
      );
    });

    test('should throw error if config.example.json is not found anywhere', () => {
      // Arrange
      fs.existsSync.mockReturnValue(false);

      // Act & Assert
      expect(() => {
        ConfigModule = require('../configModule');
      }).toThrow('config.example.json not found');
    });

    test('should watch config file for external changes', (done) => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      let watchCallback;
      fs.watch.mockImplementation((path, callback) => {
        watchCallback = callback;
        return { close: jest.fn() };
      });

      ConfigModule = require('../configModule');

      const modifiedConfig = { ...defaultTemplate, plexUrl: 'http://external-change:32400' };
      fs.readFileSync.mockReturnValue(JSON.stringify(modifiedConfig));

      ConfigModule.on('change', () => {
        // Assert
        expect(ConfigModule.getConfig().plexUrl).toBe('http://external-change:32400');
        done();
      });

      // Act - simulate external file change
      watchCallback('change');
      // Trigger debounce timer
      jest.runAllTimers();
    });

    test('should stop watching config when stopWatchingConfig is called', () => {
      // Arrange
      const mockWatcher = { close: jest.fn() };
      fs.watch.mockReturnValue(mockWatcher);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      ConfigModule = require('../configModule');

      // Act
      ConfigModule.stopWatchingConfig();

      // Assert
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    test('should ignore file watcher events triggered by own saves', () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      let watchCallback;
      fs.watch.mockImplementation((path, callback) => {
        watchCallback = callback;
        return { close: jest.fn() };
      });

      ConfigModule = require('../configModule');
      const changeListener = jest.fn();
      ConfigModule.on('change', changeListener);

      const initialCallCount = changeListener.mock.calls.length;

      // Act - save config, which sets isSaving flag
      ConfigModule.saveConfig();

      // Simulate file watcher firing during save
      watchCallback('change');
      jest.runAllTimers();

      // Assert - change event should not fire for self-triggered saves
      expect(changeListener.mock.calls.length).toBe(initialCallCount);
    });

    test('should skip processing if file content has not changed', () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      const configContent = JSON.stringify(defaultTemplate);
      fs.readFileSync.mockReturnValue(configContent);

      let watchCallback;
      fs.watch.mockImplementation((path, callback) => {
        watchCallback = callback;
        return { close: jest.fn() };
      });

      ConfigModule = require('../configModule');
      const changeListener = jest.fn();
      ConfigModule.on('change', changeListener);

      // Act - trigger watcher with same content
      watchCallback('change');
      jest.runAllTimers();

      // Assert - should not emit change event for identical content
      expect(changeListener).not.toHaveBeenCalled();
    });
  });

  describe('Deep Merge Logic', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));
      ConfigModule = require('../configModule');
    });

    test('should add missing fields from template', () => {
      // Arrange
      const template = { a: 1, b: 2, c: 3 };
      const existing = { a: 10 };

      // Act
      const result = ConfigModule.deepMerge(template, existing);

      // Assert
      expect(result.merged).toEqual({ a: 10, b: 2, c: 3 });
      expect(result.fieldsAdded).toEqual(['b', 'c']);
    });

    test('should preserve existing values', () => {
      // Arrange
      const template = { a: 1, b: 2 };
      const existing = { a: 100, b: 200 };

      // Act
      const result = ConfigModule.deepMerge(template, existing);

      // Assert
      expect(result.merged).toEqual({ a: 100, b: 200 });
      expect(result.fieldsAdded).toEqual([]);
    });

    test('should recursively merge nested objects', () => {
      // Arrange
      const template = {
        outer: {
          inner1: 'value1',
          inner2: 'value2'
        }
      };
      const existing = {
        outer: {
          inner1: 'existing1'
        }
      };

      // Act
      const result = ConfigModule.deepMerge(template, existing);

      // Assert
      expect(result.merged.outer.inner1).toBe('existing1');
      expect(result.merged.outer.inner2).toBe('value2');
      expect(result.fieldsAdded).toEqual(['outer.inner2']);
    });

    test('should fix type mismatches by using template value', () => {
      // Arrange
      const template = {
        shouldBeObject: {
          nested: 'value'
        }
      };
      const existing = {
        shouldBeObject: 'string-instead-of-object'
      };

      // Act
      const result = ConfigModule.deepMerge(template, existing);

      // Assert
      expect(result.merged.shouldBeObject).toEqual({ nested: 'value' });
      expect(result.fieldsAdded).toEqual(['shouldBeObject']);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'shouldBeObject',
          expectedType: 'object'
        }),
        expect.stringContaining('incorrect type')
      );
    });

    test('should preserve extra user fields not in template', () => {
      // Arrange
      const template = { a: 1 };
      const existing = { a: 10, extraField: 'custom' };

      // Act
      const result = ConfigModule.deepMerge(template, existing);

      // Assert
      expect(result.merged.extraField).toBe('custom');
      expect(result.merged.a).toBe(10);
    });

    test('should skip comment keys', () => {
      // Arrange
      const template = { a: 1, '//comment': 'This is a comment' };
      const existing = {};

      // Act
      const result = ConfigModule.deepMerge(template, existing);

      // Assert
      expect(result.merged['//comment']).toBeUndefined();
      expect(result.merged.a).toBe(1);
    });

    test('should handle arrays as primitive values', () => {
      // Arrange
      const template = { categories: ['sponsor', 'intro'] };
      const existing = { categories: ['sponsor', 'outro', 'selfpromo'] };

      // Act
      const result = ConfigModule.deepMerge(template, existing);

      // Assert
      expect(result.merged.categories).toEqual(['sponsor', 'outro', 'selfpromo']);
    });
  });

  describe('Cookie Management', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));
      ConfigModule = require('../configModule');
    });

    test('should return null for cookies path when cookies are disabled', () => {
      // Arrange
      ConfigModule.config.cookiesEnabled = false;

      // Act
      const cookiesPath = ConfigModule.getCookiesPath();

      // Assert
      expect(cookiesPath).toBeNull();
    });

    test('should return null for cookies path when custom cookies not uploaded', () => {
      // Arrange
      ConfigModule.config.cookiesEnabled = true;
      ConfigModule.config.customCookiesUploaded = false;

      // Act
      const cookiesPath = ConfigModule.getCookiesPath();

      // Assert
      expect(cookiesPath).toBeNull();
    });

    test('should return cookies path when enabled and uploaded', () => {
      // Arrange
      ConfigModule.config.cookiesEnabled = true;
      ConfigModule.config.customCookiesUploaded = true;
      fs.existsSync.mockReturnValue(true);

      // Act
      const cookiesPath = ConfigModule.getCookiesPath();

      // Assert
      expect(cookiesPath).toContain('cookies.user.txt');
    });

    test('should return null and warn if cookies enabled but file missing', () => {
      // Arrange
      ConfigModule.config.cookiesEnabled = true;
      ConfigModule.config.customCookiesUploaded = true;
      fs.existsSync.mockReturnValue(false);

      // Act
      const cookiesPath = ConfigModule.getCookiesPath();

      // Assert
      expect(cookiesPath).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ cookiePath: expect.stringContaining('cookies.user.txt') }),
        expect.stringContaining('Cookie file not found')
      );
    });

    test('should return correct cookies status', () => {
      // Arrange
      ConfigModule.config.cookiesEnabled = true;
      ConfigModule.config.customCookiesUploaded = true;
      fs.existsSync.mockReturnValue(true);

      // Act
      const status = ConfigModule.getCookiesStatus();

      // Assert
      expect(status).toEqual({
        cookiesEnabled: true,
        customCookiesUploaded: true,
        customFileExists: true
      });
    });

    test('should write custom cookies file with correct permissions', () => {
      // Arrange
      const buffer = Buffer.from('cookie data');
      const changeListener = jest.fn();
      ConfigModule.on('change', changeListener);

      // Act
      const filePath = ConfigModule.writeCustomCookiesFile(buffer);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('cookies.user.txt'),
        buffer
      );
      expect(fs.chmodSync).toHaveBeenCalledWith(
        expect.stringContaining('cookies.user.txt'),
        0o600
      );
      expect(ConfigModule.config.customCookiesUploaded).toBe(true);
      expect(ConfigModule.config.cookiesEnabled).toBe(true);
      expect(filePath).toContain('cookies.user.txt');
      expect(changeListener).toHaveBeenCalled();
    });

    test('should delete custom cookies file', () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      const changeListener = jest.fn();
      ConfigModule.on('change', changeListener);

      // Act
      const result = ConfigModule.deleteCustomCookiesFile();

      // Assert
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('cookies.user.txt')
      );
      expect(ConfigModule.config.customCookiesUploaded).toBe(false);
      expect(result).toBe(true);
      expect(changeListener).toHaveBeenCalled();
    });

    test('should handle deleting non-existent cookies file', () => {
      // Arrange
      fs.existsSync.mockReturnValue(false);

      // Act
      const result = ConfigModule.deleteCustomCookiesFile();

      // Assert
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('Storage Management', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));
    });

    test('should get storage status successfully', async () => {
      // Arrange
      const mockExecFile = jest.fn().mockResolvedValue({
        stdout: 'Filesystem     1B-blocks      Used Available Use% Mounted on\n/dev/sda1     1000000000 400000000 600000000  40% /data'
      });
      util.promisify.mockReturnValue(mockExecFile);

      ConfigModule = require('../configModule');

      // Act
      const status = await ConfigModule.getStorageStatus();

      // Assert
      expect(status).toEqual({
        total: 1000000000,
        used: 400000000,
        available: 600000000,
        percentUsed: 40,
        percentFree: 60,
        totalGB: '0.9',
        usedGB: '0.4',
        availableGB: '0.6'
      });
      expect(mockExecFile).toHaveBeenCalledWith('df', ['-B', '1', '/usr/src/app/data']);
    });

    test('should use DATA_PATH environment variable for storage check', async () => {
      // Arrange
      process.env.DATA_PATH = '/custom/data/path';
      const mockExecFile = jest.fn().mockResolvedValue({
        stdout: 'Filesystem     1B-blocks      Used Available Use% Mounted on\n/dev/sda1     1000000000 400000000 600000000  40% /data'
      });
      util.promisify.mockReturnValue(mockExecFile);

      ConfigModule = require('../configModule');

      // Act
      await ConfigModule.getStorageStatus();

      // Assert
      expect(mockExecFile).toHaveBeenCalledWith('df', ['-B', '1', '/custom/data/path']);
    });

    test('should return null on storage check error', async () => {
      // Arrange
      const mockExecFile = jest.fn().mockRejectedValue(new Error('df command failed'));
      util.promisify.mockReturnValue(mockExecFile);

      ConfigModule = require('../configModule');

      // Act
      const status = await ConfigModule.getStorageStatus();

      // Assert
      expect(status).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Error getting storage status'
      );
    });

    test('should convert storage threshold from MB to bytes', () => {
      // Arrange
      ConfigModule = require('../configModule');

      // Act
      const bytes = ConfigModule.convertStorageThresholdToBytes('500MB');

      // Assert
      expect(bytes).toBe(500 * 1024 * 1024);
    });

    test('should convert storage threshold from GB to bytes', () => {
      // Arrange
      ConfigModule = require('../configModule');

      // Act
      const bytes = ConfigModule.convertStorageThresholdToBytes('2GB');

      // Assert
      expect(bytes).toBe(2 * 1024 * 1024 * 1024);
    });

    test('should return null for invalid threshold format', () => {
      // Arrange
      ConfigModule = require('../configModule');

      // Act
      const bytes = ConfigModule.convertStorageThresholdToBytes('invalid');

      // Assert
      expect(bytes).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        { threshold: 'invalid' },
        'Invalid storage threshold format'
      );
    });

    test('should return null for null threshold', () => {
      // Arrange
      ConfigModule = require('../configModule');

      // Act
      const bytes = ConfigModule.convertStorageThresholdToBytes(null);

      // Assert
      expect(bytes).toBeNull();
    });

    test('should check if storage is below threshold with string threshold', () => {
      // Arrange
      ConfigModule = require('../configModule');
      const currentAvailable = 100 * 1024 * 1024; // 100 MB

      // Act
      const isBelowThreshold = ConfigModule.isStorageBelowThreshold(currentAvailable, '200MB');

      // Assert
      expect(isBelowThreshold).toBe(true);
    });

    test('should check if storage is above threshold', () => {
      // Arrange
      ConfigModule = require('../configModule');
      const currentAvailable = 500 * 1024 * 1024; // 500 MB

      // Act
      const isBelowThreshold = ConfigModule.isStorageBelowThreshold(currentAvailable, '200MB');

      // Assert
      expect(isBelowThreshold).toBe(false);
    });

    test('should check threshold with numeric bytes value', () => {
      // Arrange
      ConfigModule = require('../configModule');
      const currentAvailable = 100 * 1024 * 1024; // 100 MB
      const thresholdBytes = 200 * 1024 * 1024; // 200 MB

      // Act
      const isBelowThreshold = ConfigModule.isStorageBelowThreshold(currentAvailable, thresholdBytes);

      // Assert
      expect(isBelowThreshold).toBe(true);
    });

    test('should return false when currentAvailable is null', () => {
      // Arrange
      ConfigModule = require('../configModule');

      // Act
      const isBelowThreshold = ConfigModule.isStorageBelowThreshold(null, '200MB');

      // Assert
      expect(isBelowThreshold).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot check storage threshold: currentAvailable is null/undefined'
      );
    });

    test('should return false when threshold is null', () => {
      // Arrange
      ConfigModule = require('../configModule');
      const currentAvailable = 100 * 1024 * 1024;

      // Act
      const isBelowThreshold = ConfigModule.isStorageBelowThreshold(currentAvailable, null);

      // Assert
      expect(isBelowThreshold).toBe(false);
    });
  });

  describe('Path Resolution', () => {
    test('should return platform image path when DATA_PATH is set', () => {
      // Arrange
      process.env.DATA_PATH = '/custom/data';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      ConfigModule = require('../configModule');

      // Act
      const imagePath = ConfigModule.getImagePath();

      // Assert
      expect(imagePath).toContain('config/images');
    });

    test('should return standard image path when DATA_PATH is not set', () => {
      // Arrange
      delete process.env.DATA_PATH;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      ConfigModule = require('../configModule');

      // Act
      const imagePath = ConfigModule.getImagePath();

      // Assert
      expect(imagePath).toContain('server/images');
      expect(imagePath).not.toContain('config/images');
    });

    test('should return platform jobs path when DATA_PATH is set', () => {
      // Arrange
      process.env.DATA_PATH = '/custom/data';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      ConfigModule = require('../configModule');

      // Act
      const jobsPath = ConfigModule.getJobsPath();

      // Assert
      expect(jobsPath).toContain('config/jobs');
    });

    test('should return standard jobs path when DATA_PATH is not set', () => {
      // Arrange
      delete process.env.DATA_PATH;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      ConfigModule = require('../configModule');

      // Act
      const jobsPath = ConfigModule.getJobsPath();

      // Assert
      expect(jobsPath).toContain('jobs');
      expect(jobsPath).not.toContain('config/jobs');
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));
      ConfigModule = require('../configModule');
    });

    test('should emit change event when config is updated', (done) => {
      // Arrange
      const newConfig = { ...defaultTemplate, plexUrl: 'http://updated:32400' };

      ConfigModule.on('change', () => {
        // Assert
        expect(ConfigModule.getConfig().plexUrl).toBe('http://updated:32400');
        done();
      });

      // Act
      ConfigModule.updateConfig(newConfig);
    });

    test('should support onConfigChange listener registration', (done) => {
      // Arrange
      const newConfig = { ...defaultTemplate, plexUrl: 'http://updated:32400' };

      ConfigModule.onConfigChange(() => {
        // Assert
        expect(ConfigModule.getConfig().plexUrl).toBe('http://updated:32400');
        done();
      });

      // Act
      ConfigModule.updateConfig(newConfig);
    });

    test('should emit change event when writing custom cookies', () => {
      // Arrange
      const changeListener = jest.fn();
      ConfigModule.on('change', changeListener);

      // Act
      ConfigModule.writeCustomCookiesFile(Buffer.from('cookies'));

      // Assert
      expect(changeListener).toHaveBeenCalled();
    });

    test('should emit change event when deleting custom cookies', () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      const changeListener = jest.fn();
      ConfigModule.on('change', changeListener);

      // Act
      ConfigModule.deleteCustomCookiesFile();

      // Assert
      expect(changeListener).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle file watcher errors gracefully', (done) => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      let watchCallback;
      fs.watch.mockImplementation((path, callback) => {
        watchCallback = callback;
        return { close: jest.fn() };
      });

      ConfigModule = require('../configModule');

      // Simulate invalid JSON in config file
      fs.readFileSync.mockReturnValue('{ invalid json');

      // Act
      watchCallback('change');

      // Wait for debounce timer
      setTimeout(() => {
        // Assert
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error) }),
          'Error processing config file change'
        );
        done();
      }, 150);
    });

    test('should handle unexpected df output', async () => {
      // Arrange
      const mockExecFile = jest.fn().mockResolvedValue({
        stdout: 'unexpected single line'
      });
      util.promisify.mockReturnValue(mockExecFile);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(defaultTemplate));

      ConfigModule = require('../configModule');

      // Act
      const status = await ConfigModule.getStorageStatus();

      // Assert
      expect(status).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
