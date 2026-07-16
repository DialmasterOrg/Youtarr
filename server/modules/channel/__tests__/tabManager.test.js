/* eslint-env jest */

const mockFactories = require('./mockFactories');

jest.mock('fs');
jest.mock('child_process');
jest.mock('uuid');
jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../messageEmitter.js');
jest.mock('../../youtubeApi', () => mockFactories.mockYoutubeApi());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());

describe('tabManager', () => {
  let tabManager;
  let fs;
  let childProcess;
  let uuid;
  let logger;
  let Channel;
  let MessageEmitter;
  let youtubeApi;

  const mockChannelData = {
    channel_id: 'UC123456',
    title: 'Test Channel',
    description: 'Test Description',
    uploader: 'Test Uploader',
    url: 'https://www.youtube.com/@testchannel',
    lastFetchedByTab: JSON.stringify({ video: new Date('2024-01-01').toISOString() })
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    uuid = require('uuid');
    uuid.v4.mockReturnValue('test-uuid-1234');

    fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.copySync = jest.fn();
    fs.createWriteStream = jest.fn().mockReturnValue({
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    });
    fs.promises = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      unlink: jest.fn(),
      rename: jest.fn()
    };

    childProcess = require('child_process');
    childProcess.spawn = jest.fn();
    childProcess.execSync = jest.fn();

    MessageEmitter = require('../../messageEmitter.js');
    MessageEmitter.emitMessage = jest.fn();

    Channel = require('../../../models/channel');
    Channel.findOne.mockResolvedValue(null);

    logger = require('../../../logger');

    youtubeApi = require('../../youtubeApi');
    youtubeApi.isAvailable.mockReturnValue(false);
    youtubeApi.getApiKey.mockReturnValue(null);

    tabManager = require('../tabManager');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getChannelAvailableTabs', () => {
    test('should return cached available tabs if already stored', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: 'videos,shorts'
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      const result = await tabManager.getChannelAvailableTabs('UC123');

      expect(result).toEqual({ availableTabs: ['videos', 'shorts'] });
      expect(Channel.findOne).toHaveBeenCalledWith({
        where: { channel_id: 'UC123' }
      });
    });

    test('should detect tabs when not cached and return results', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: null,
        save: jest.fn()
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      // Spy on detectAndSaveChannelTabs to return detected tabs
      const detectSpy = jest.spyOn(tabManager, 'detectAndSaveChannelTabs')
        .mockResolvedValue({ availableTabs: ['videos', 'shorts'], autoDownloadEnabledTabs: 'video' });

      const result = await tabManager.getChannelAvailableTabs('UC123');

      // Should await detection and return results
      expect(result).toEqual({ availableTabs: ['videos', 'shorts'] });
      expect(detectSpy).toHaveBeenCalledWith('UC123');

      detectSpy.mockRestore();
    });

    test('should throw error when channel not found', async () => {
      Channel.findOne.mockResolvedValue(null);

      await expect(tabManager.getChannelAvailableTabs('UC999')).rejects.toThrow('Channel not found in database');
    });

    test('should return empty array when detection returns null', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: null,
        save: jest.fn()
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      // Spy on detectAndSaveChannelTabs to return null (detection failed/skipped)
      const detectSpy = jest.spyOn(tabManager, 'detectAndSaveChannelTabs').mockResolvedValue(null);

      const result = await tabManager.getChannelAvailableTabs('UC123');

      // Should return empty array when detection fails
      expect(result).toEqual({ availableTabs: [] });
      expect(detectSpy).toHaveBeenCalledWith('UC123');

      detectSpy.mockRestore();
    });
  });

  describe('detectAndSaveChannelTabs', () => {
    test('should detect and save available tabs and return results', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: null,
        title: 'Test Channel'
      };
      Channel.findOne.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue([1]);

      // Mock yt-dlp tab probing:
      // - videos tab exists (returns entries)
      // - shorts tab exists (returns entries)
      // - streams tab doesn't exist (errors)
      tabManager.checkTabExistsViaYtdlp = jest.fn()
        .mockImplementation(async (chId, tabType) => {
          if (tabType === 'videos') return true;
          if (tabType === 'shorts') return true;
          return false; // streams
        });

      const result = await tabManager.detectAndSaveChannelTabs('UC123');

      expect(Channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          available_tabs: 'videos,shorts',
          auto_download_enabled_tabs: 'video'
        }),
        { where: { channel_id: 'UC123' } }
      );

      // Should return detected tabs
      expect(result).toEqual({
        availableTabs: ['videos', 'shorts'],
        autoDownloadEnabledTabs: 'video'
      });
    });

    test('should return null if already detecting', async () => {
      // Simulate already detecting
      const fetchRegistry = require('../fetchRegistry');
      fetchRegistry.set('tabs-UC123', { startTime: new Date().toISOString(), type: 'tabDetection' });

      const result = await tabManager.detectAndSaveChannelTabs('UC123');

      // Should not call Channel.findOne since we skipped
      expect(Channel.findOne).not.toHaveBeenCalled();
      // Should return null
      expect(result).toBeNull();

      // Cleanup
      fetchRegistry.delete('tabs-UC123');
    });

    test('should return cached values if tabs already populated', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: 'videos,shorts', // Already populated
        auto_download_enabled_tabs: 'video,short'
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      const result = await tabManager.detectAndSaveChannelTabs('UC123');

      // Should not call Channel.update since tabs already exist
      expect(Channel.update).not.toHaveBeenCalled();
      // Should return cached values
      expect(result).toEqual({
        availableTabs: ['videos', 'shorts'],
        autoDownloadEnabledTabs: 'video,short'
      });
    });

    test('reconciles the stale video default to the detected tab for a shorts-only channel', async () => {
      // 'video' is the NOT NULL column default; detection should drop it and default to 'short'.
      const mockChannel = {
        ...mockChannelData,
        available_tabs: null,
        auto_download_enabled_tabs: 'video'
      };
      Channel.findOne.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue([1]);

      tabManager.checkTabExistsViaYtdlp = jest.fn()
        .mockImplementation(async (chId, tabType) => tabType === 'shorts');

      const result = await tabManager.detectAndSaveChannelTabs('UC123');

      expect(Channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          available_tabs: 'shorts',
          auto_download_enabled_tabs: 'short'
        }),
        { where: { channel_id: 'UC123' } }
      );
      expect(result).toEqual({
        availableTabs: ['shorts'],
        autoDownloadEnabledTabs: 'short'
      });
    });

    test('should fallback to videos tab when all RSS checks fail', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: null, // Not yet populated
        auto_download_enabled_tabs: null
      };
      Channel.findOne.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue([1]);

      // Mock fetch to always reject (simulating network timeout/failure)
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));

      try {
        const result = await tabManager.detectAndSaveChannelTabs('UC123');

        // Should fallback to videos tab
        expect(result).toEqual({
          availableTabs: ['videos'],
          autoDownloadEnabledTabs: 'video'
        });

        // Should save the fallback to the database
        expect(Channel.update).toHaveBeenCalledWith(
          expect.objectContaining({
            available_tabs: 'videos',
            auto_download_enabled_tabs: 'video'
          }),
          expect.anything()
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('checkTabExistsViaYtdlp', () => {
    test('should return true when yt-dlp returns entries for the tab', async () => {
      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      channelYtdlpExecutor.withTempFile = jest.fn().mockImplementation(async (prefix, fn) => {
        return fn('/tmp/test-output');
      });
      channelYtdlpExecutor.executeYtDlpCommand = jest.fn().mockResolvedValue(
        JSON.stringify({ entries: [{ id: 'video1' }] })
      );

      const exists = await tabManager.checkTabExistsViaYtdlp('UC123testchannel456', 'videos');
      expect(exists).toBe(true);
    });

    test('should return false when yt-dlp returns empty entries', async () => {
      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      channelYtdlpExecutor.withTempFile = jest.fn().mockImplementation(async (prefix, fn) => {
        return fn('/tmp/test-output');
      });
      channelYtdlpExecutor.executeYtDlpCommand = jest.fn().mockResolvedValue(
        JSON.stringify({ entries: [] })
      );

      const exists = await tabManager.checkTabExistsViaYtdlp('UC123testchannel456', 'videos');
      expect(exists).toBe(false);
    });

    test('should return false when yt-dlp errors', async () => {
      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      channelYtdlpExecutor.withTempFile = jest.fn().mockImplementation(async (prefix, fn) => {
        return fn('/tmp/test-output');
      });
      channelYtdlpExecutor.executeYtDlpCommand = jest.fn().mockRejectedValue(new Error('yt-dlp failed'));

      const exists = await tabManager.checkTabExistsViaYtdlp('UC123testchannel456', 'videos');
      expect(exists).toBe(false);
    });

    test('should return false on JSON parse error', async () => {
      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      channelYtdlpExecutor.withTempFile = jest.fn().mockImplementation(async (prefix, fn) => {
        return fn('/tmp/test-output');
      });
      channelYtdlpExecutor.executeYtDlpCommand = jest.fn().mockResolvedValue('not json');

      const exists = await tabManager.checkTabExistsViaYtdlp('UC123testchannel456', 'videos');
      expect(exists).toBe(false);
    });
  });

  describe('updateAutoDownloadForTab', () => {
    test('should enable auto download for a tab type', async () => {
      const mockChannel = {
        ...mockChannelData,
        auto_download_enabled_tabs: 'video',
        save: jest.fn()
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      await tabManager.updateAutoDownloadForTab('UC123', 'shorts', true);

      expect(mockChannel.auto_download_enabled_tabs).toBe('video,short');
      expect(mockChannel.save).toHaveBeenCalled();
    });

    test('should disable auto download for a tab type', async () => {
      const mockChannel = {
        ...mockChannelData,
        auto_download_enabled_tabs: 'video,short,livestream',
        save: jest.fn()
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      await tabManager.updateAutoDownloadForTab('UC123', 'shorts', false);

      expect(mockChannel.auto_download_enabled_tabs).toBe('video,livestream');
      expect(mockChannel.save).toHaveBeenCalled();
    });

    test('should not duplicate tab types when already enabled', async () => {
      const mockChannel = {
        ...mockChannelData,
        auto_download_enabled_tabs: 'video,short',
        save: jest.fn()
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      await tabManager.updateAutoDownloadForTab('UC123', 'shorts', true);

      expect(mockChannel.auto_download_enabled_tabs).toBe('video,short');
      expect(mockChannel.save).toHaveBeenCalled();
    });

    test('should handle null auto_download_enabled_tabs', async () => {
      const mockChannel = {
        ...mockChannelData,
        auto_download_enabled_tabs: null,
        save: jest.fn()
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      await tabManager.updateAutoDownloadForTab('UC123', 'shorts', true);

      expect(mockChannel.auto_download_enabled_tabs).toBe('video,short');
      expect(mockChannel.save).toHaveBeenCalled();
    });

    test('should throw error when channel not found', async () => {
      Channel.findOne.mockResolvedValue(null);

      await expect(tabManager.updateAutoDownloadForTab('UC999', 'videos', true)).rejects.toThrow('Channel not found in database');
    });

    test('should handle disabling all tabs', async () => {
      const mockChannel = {
        ...mockChannelData,
        auto_download_enabled_tabs: 'video',
        save: jest.fn()
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      await tabManager.updateAutoDownloadForTab('UC123', 'videos', false);

      expect(mockChannel.auto_download_enabled_tabs).toBe('');
      expect(mockChannel.save).toHaveBeenCalled();
    });

    test('preserves empty-string state when enabling a tab on a previously cleared channel', async () => {
      // Empty string is the terminated state; '||' coalescing would yield 'video,short'.
      const mockChannel = {
        ...mockChannelData,
        auto_download_enabled_tabs: '',
        save: jest.fn()
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      await tabManager.updateAutoDownloadForTab('UC123', 'shorts', true);

      expect(mockChannel.auto_download_enabled_tabs).toBe('short');
      expect(mockChannel.save).toHaveBeenCalled();
    });
  });

  describe('getChannelAvailableTabs with hidden_tabs', () => {
    test('returns effective tabs (detected minus hidden)', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: 'videos,shorts,streams',
        hidden_tabs: 'shorts'
      };
      Channel.findOne.mockResolvedValue(mockChannel);

      const result = await tabManager.getChannelAvailableTabs('UC123');

      expect(result).toEqual({ availableTabs: ['videos', 'streams'] });
    });
  });

  describe('redetectChannelTabs', () => {
    test('probes tabs via yt-dlp even when available_tabs is cached', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: 'shorts', // Pretend RSS era gave us only shorts
        hidden_tabs: null,
        auto_download_enabled_tabs: 'short'
      };
      Channel.findOne.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue([1]);

      tabManager.checkTabExistsViaYtdlp = jest.fn()
        .mockImplementation(async (chId, tabType) => {
          if (tabType === 'videos') return true;
          if (tabType === 'shorts') return true;
          if (tabType === 'streams') return true;
          return false;
        });

      const result = await tabManager.redetectChannelTabs('UC123');

      expect(tabManager.checkTabExistsViaYtdlp).toHaveBeenCalledWith('UC123', 'videos');
      expect(tabManager.checkTabExistsViaYtdlp).toHaveBeenCalledWith('UC123', 'shorts');
      expect(tabManager.checkTabExistsViaYtdlp).toHaveBeenCalledWith('UC123', 'streams');
      expect(Channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          available_tabs: 'videos,shorts,streams'
        }),
        { where: { channel_id: 'UC123' } }
      );
      expect(result.availableTabs).toEqual(['videos', 'shorts', 'streams']);
      expect(result.detectedTabs).toEqual(['videos', 'shorts', 'streams']);
    });

    test('preserves hidden_tabs when re-detecting', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: 'videos',
        hidden_tabs: 'shorts',
        auto_download_enabled_tabs: 'video'
      };
      Channel.findOne.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue([1]);

      tabManager.checkTabExistsViaYtdlp = jest.fn()
        .mockImplementation(async (chId, tabType) => {
          return tabType === 'videos' || tabType === 'shorts';
        });

      const result = await tabManager.redetectChannelTabs('UC123');

      // The update call should NOT overwrite hidden_tabs
      const updateCall = Channel.update.mock.calls[0][0];
      expect(updateCall).not.toHaveProperty('hidden_tabs');

      // Effective available_tabs = detected - hidden = [videos, shorts] - [shorts] = [videos]
      expect(result.availableTabs).toEqual(['videos']);
      // detectedTabs shows the raw detection
      expect(result.detectedTabs).toEqual(['videos', 'shorts']);
      expect(result.hiddenTabs).toEqual(['shorts']);
    });

    test('drops auto_download_enabled_tabs entries that are no longer detected', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: 'videos,shorts,streams',
        hidden_tabs: null,
        auto_download_enabled_tabs: 'video,short,livestream'
      };
      Channel.findOne.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue([1]);

      // Shorts no longer exists
      tabManager.checkTabExistsViaYtdlp = jest.fn()
        .mockImplementation(async (chId, tabType) => {
          return tabType === 'videos' || tabType === 'streams';
        });

      await tabManager.redetectChannelTabs('UC123');

      const updateCall = Channel.update.mock.calls[0][0];
      expect(updateCall.auto_download_enabled_tabs.split(',').sort())
        .toEqual(['livestream', 'video'].sort());
    });

    test('drops auto_download_enabled_tabs entries that are hidden', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: 'videos',
        hidden_tabs: 'shorts',
        auto_download_enabled_tabs: 'video,short'
      };
      Channel.findOne.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue([1]);

      tabManager.checkTabExistsViaYtdlp = jest.fn()
        .mockImplementation(async (chId, tabType) => {
          return tabType === 'videos' || tabType === 'shorts';
        });

      await tabManager.redetectChannelTabs('UC123');

      const updateCall = Channel.update.mock.calls[0][0];
      // short should have been stripped because shorts is in hidden_tabs
      expect(updateCall.auto_download_enabled_tabs.split(',')).toEqual(['video']);
    });

    test('throws error when channel not found', async () => {
      Channel.findOne.mockResolvedValue(null);
      await expect(tabManager.redetectChannelTabs('UC999'))
        .rejects.toThrow('Channel not found in database');
    });

    test('falls back to videos tab when all yt-dlp probes fail', async () => {
      const mockChannel = {
        ...mockChannelData,
        available_tabs: 'shorts',
        hidden_tabs: null,
        auto_download_enabled_tabs: 'short'
      };
      Channel.findOne.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue([1]);

      tabManager.checkTabExistsViaYtdlp = jest.fn().mockResolvedValue(false);

      const result = await tabManager.redetectChannelTabs('UC123');

      expect(result.detectedTabs).toEqual(['videos']);
    });
  });

  describe('tab detection - API-first', () => {
    test('detectAndSaveChannelTabs uses API when available, does not invoke yt-dlp probe', async () => {
      Channel.findOne.mockResolvedValue({
        channel_id: 'UCxxx',
        title: 'Chan',
        available_tabs: null,
        auto_download_enabled_tabs: null,
      });
      Channel.update.mockResolvedValue([1]);

      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      youtubeApi.client.detectAvailableTabs.mockResolvedValue({
        availableTabs: ['videos', 'shorts'],
        channelInfo: { channelId: 'UCxxx' },
      });

      const ytdlpSpy = jest.spyOn(tabManager, 'checkTabExistsViaYtdlp');

      const result = await tabManager.detectAndSaveChannelTabs('UCxxx');

      expect(youtubeApi.client.detectAvailableTabs).toHaveBeenCalledTimes(1);
      expect(ytdlpSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        availableTabs: ['videos', 'shorts'],
        autoDownloadEnabledTabs: 'video',
      });
    });

    test('detectAndSaveChannelTabs falls back to yt-dlp when API throws', async () => {
      Channel.findOne.mockResolvedValue({
        channel_id: 'UCxxx',
        title: 'Chan',
        available_tabs: null,
        auto_download_enabled_tabs: null,
      });
      Channel.update.mockResolvedValue([1]);

      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      const apiErr = new Error('boom');
      apiErr.name = 'YoutubeApiError';
      apiErr.code = 'QUOTA_EXCEEDED';
      youtubeApi.client.detectAvailableTabs.mockRejectedValue(apiErr);

      const ytdlpSpy = jest
        .spyOn(tabManager, 'checkTabExistsViaYtdlp')
        .mockImplementation(async (_id, tabType) => tabType === 'videos');

      const result = await tabManager.detectAndSaveChannelTabs('UCxxx');

      expect(youtubeApi.client.detectAvailableTabs).toHaveBeenCalledTimes(1);
      expect(ytdlpSpy).toHaveBeenCalled();
      expect(result.availableTabs).toEqual(['videos']);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'QUOTA_EXCEEDED' }),
        expect.stringContaining('falling back to yt-dlp')
      );
    });

    test('detectAndSaveChannelTabs falls back to yt-dlp when API returns no tabs', async () => {
      Channel.findOne.mockResolvedValue({
        channel_id: 'UCxxx',
        title: 'Chan',
        available_tabs: null,
        auto_download_enabled_tabs: null,
      });
      Channel.update.mockResolvedValue([1]);

      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      youtubeApi.client.detectAvailableTabs.mockResolvedValue({
        availableTabs: [],
        channelInfo: null,
      });

      const ytdlpSpy = jest
        .spyOn(tabManager, 'checkTabExistsViaYtdlp')
        .mockImplementation(async (_id, tabType) => tabType === 'videos');

      const result = await tabManager.detectAndSaveChannelTabs('UCxxx');

      expect(ytdlpSpy).toHaveBeenCalled();
      expect(result.availableTabs).toEqual(['videos']);
    });
  });
});
