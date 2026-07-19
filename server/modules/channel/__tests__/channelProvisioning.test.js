/* eslint-env jest */

const mockFactories = require('./mockFactories');

jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../messageEmitter.js');
jest.mock('../../youtubeApi', () => mockFactories.mockYoutubeApi());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../filesystem', () => mockFactories.mockFilesystem());

describe('channelProvisioning', () => {
  let channelProvisioning;
  let fs;
  let childProcess;
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
    jest.clearAllMocks();
    jest.resetModules();

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

    youtubeApi = require('../../youtubeApi');
    youtubeApi.isAvailable.mockReturnValue(false);
    youtubeApi.getApiKey.mockReturnValue(null);

    channelProvisioning = require('../channelProvisioning');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertChannel', () => {
    test('should create new channel if not exists', async () => {
      const mockChannel = { ...mockChannelData };
      Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
      Channel.findOne.mockResolvedValueOnce(null); // Not found by URL
      Channel.create.mockResolvedValue(mockChannel);

      const channelData = {
        id: 'UC123',
        title: 'New Channel',
        description: 'New Description',
        uploader: 'New Uploader',
        url: 'https://youtube.com/@new'
      };

      const result = await channelProvisioning.upsertChannel(channelData);

      expect(Channel.findOne).toHaveBeenNthCalledWith(1, {
        where: { channel_id: channelData.id }
      });
      expect(Channel.findOne).toHaveBeenNthCalledWith(2, {
        where: { url: channelData.url }
      });
      expect(Channel.create).toHaveBeenCalledWith({
        channel_id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url,
        enabled: false,
        sub_folder: '##USE_GLOBAL_DEFAULT##'
      });
      expect(result).toBe(mockChannel);
    });

    test('should default sub_folder to global-default sentinel when no initialSettings provided', async () => {
      const mockChannel = { ...mockChannelData };
      Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
      Channel.findOne.mockResolvedValueOnce(null); // Not found by URL
      Channel.create.mockResolvedValue(mockChannel);

      const channelData = {
        id: 'UC_DEFAULT',
        title: 'Default Channel',
        description: 'Default Description',
        uploader: 'Default Uploader',
        url: 'https://youtube.com/@defaultchannel'
      };

      await channelProvisioning.upsertChannel(channelData);

      expect(Channel.create).toHaveBeenCalledWith(
        expect.objectContaining({ sub_folder: '##USE_GLOBAL_DEFAULT##' })
      );
    });

    test('should persist an explicit null sub_folder as root (not coerce to sentinel)', async () => {
      const mockChannel = { ...mockChannelData };
      Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
      Channel.findOne.mockResolvedValueOnce(null); // Not found by URL
      Channel.create.mockResolvedValue(mockChannel);

      const channelData = {
        id: 'UC_ROOT',
        title: 'Root Channel',
        description: 'Root Description',
        uploader: 'Root Uploader',
        url: 'https://youtube.com/@rootchannel'
      };

      // User explicitly selected "No Subfolder (root)" -> null
      const initialSettings = { sub_folder: null };

      await channelProvisioning.upsertChannel(channelData, false, null, initialSettings);

      expect(Channel.create).toHaveBeenCalledWith(
        expect.objectContaining({ sub_folder: null })
      );
    });

    test('should update existing channel found by channel_id', async () => {
      const mockChannel = {
        ...mockChannelData,
        update: jest.fn()
      };
      Channel.findOne.mockResolvedValueOnce(mockChannel); // Found by channel_id

      const channelData = {
        id: 'UC123',
        title: 'Updated Channel',
        description: 'Updated Description',
        uploader: 'Updated Uploader',
        url: 'https://youtube.com/@test'
      };

      await channelProvisioning.upsertChannel(channelData);

      expect(Channel.findOne).toHaveBeenCalledWith({
        where: { channel_id: channelData.id }
      });
      expect(mockChannel.update).toHaveBeenCalledWith({
        channel_id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url
      });
    });

    test('should not demote enabled on existing channel when enabled arg is false', async () => {
      const mockChannel = {
        ...mockChannelData,
        enabled: true,
        update: jest.fn()
      };
      Channel.findOne.mockResolvedValueOnce(mockChannel); // Found by channel_id

      await channelProvisioning.upsertChannel({
        id: 'UC123',
        title: 'Updated Channel',
        description: 'Updated Description',
        uploader: 'Updated Uploader',
        url: 'https://youtube.com/@test'
      }, false);

      expect(mockChannel.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ enabled: expect.anything() })
      );
    });

    test('should enable existing disabled channel when enabled arg is true', async () => {
      const mockChannel = {
        ...mockChannelData,
        enabled: false,
        update: jest.fn()
      };
      Channel.findOne.mockResolvedValueOnce(mockChannel); // Found by channel_id

      await channelProvisioning.upsertChannel({
        id: 'UC123',
        title: 'Updated Channel',
        description: 'Updated Description',
        uploader: 'Updated Uploader',
        url: 'https://youtube.com/@test'
      }, true);

      expect(mockChannel.update).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });

    test('should update existing channel found by URL and backfill channel_id', async () => {
      const mockChannel = {
        ...mockChannelData,
        update: jest.fn()
      };
      Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
      Channel.findOne.mockResolvedValueOnce(mockChannel); // Found by URL

      const channelData = {
        id: 'UC123',
        title: 'Updated Channel',
        description: 'Updated Description',
        uploader: 'Updated Uploader',
        url: 'https://youtube.com/@test'
      };

      await channelProvisioning.upsertChannel(channelData);

      expect(Channel.findOne).toHaveBeenNthCalledWith(1, {
        where: { channel_id: channelData.id }
      });
      expect(Channel.findOne).toHaveBeenNthCalledWith(2, {
        where: { url: channelData.url }
      });
      expect(mockChannel.update).toHaveBeenCalledWith({
        channel_id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url
      });
    });

    test('should apply initialSettings when creating a new channel', async () => {
      const mockChannel = { ...mockChannelData };
      Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
      Channel.findOne.mockResolvedValueOnce(null); // Not found by URL
      Channel.create.mockResolvedValue(mockChannel);

      const channelData = {
        id: 'UC_NEW',
        title: 'New Channel',
        description: 'New Description',
        uploader: 'New Uploader',
        url: 'https://youtube.com/@newchannel'
      };

      const initialSettings = {
        video_quality: '720',
        sub_folder: 'MySubFolder',
        default_rating: 'PG'
      };

      const result = await channelProvisioning.upsertChannel(channelData, true, null, initialSettings);

      expect(Channel.create).toHaveBeenCalledWith({
        channel_id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url,
        enabled: true,
        video_quality: '720',
        sub_folder: 'MySubFolder',
        default_rating: 'PG'
      });
      expect(result).toBe(mockChannel);
    });

    test('should ignore initialSettings when channel already exists by channel_id', async () => {
      const mockChannel = {
        ...mockChannelData,
        update: jest.fn()
      };
      Channel.findOne.mockResolvedValueOnce(mockChannel); // Found by channel_id

      const channelData = {
        id: 'UC123',
        title: 'Existing Channel',
        description: 'Description',
        uploader: 'Uploader',
        url: 'https://youtube.com/@existing'
      };

      const initialSettings = {
        video_quality: '480',
        sub_folder: 'ShouldBeIgnored',
        default_rating: 'R'
      };

      await channelProvisioning.upsertChannel(channelData, false, null, initialSettings);

      // Should update without initialSettings fields
      expect(mockChannel.update).toHaveBeenCalledWith({
        channel_id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url
      });
      expect(Channel.create).not.toHaveBeenCalled();
    });

    test('should ignore initialSettings when channel already exists by URL', async () => {
      const mockChannel = {
        ...mockChannelData,
        update: jest.fn()
      };
      Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
      Channel.findOne.mockResolvedValueOnce(mockChannel); // Found by URL

      const channelData = {
        id: 'UC456',
        title: 'Legacy Channel',
        description: 'Description',
        uploader: 'Uploader',
        url: 'https://youtube.com/@legacy'
      };

      const initialSettings = {
        video_quality: '1080',
        sub_folder: 'ShouldBeIgnored'
      };

      await channelProvisioning.upsertChannel(channelData, false, null, initialSettings);

      // Should update without initialSettings fields
      expect(mockChannel.update).toHaveBeenCalledWith({
        channel_id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url
      });
      expect(Channel.create).not.toHaveBeenCalled();
    });

    test('should work without initialSettings for backward compatibility', async () => {
      const mockChannel = { ...mockChannelData };
      Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
      Channel.findOne.mockResolvedValueOnce(null); // Not found by URL
      Channel.create.mockResolvedValue(mockChannel);

      const channelData = {
        id: 'UC_COMPAT',
        title: 'Compat Channel',
        description: 'Description',
        uploader: 'Uploader',
        url: 'https://youtube.com/@compat'
      };

      // Call without initialSettings (old callers)
      const result = await channelProvisioning.upsertChannel(channelData, true);

      expect(Channel.create).toHaveBeenCalledWith({
        channel_id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url,
        enabled: true,
        sub_folder: '##USE_GLOBAL_DEFAULT##'
      });
      expect(result).toBe(mockChannel);
    });

    test('should apply only provided initialSettings fields on create', async () => {
      const mockChannel = { ...mockChannelData };
      Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
      Channel.findOne.mockResolvedValueOnce(null); // Not found by URL
      Channel.create.mockResolvedValue(mockChannel);

      const channelData = {
        id: 'UC_PARTIAL',
        title: 'Partial Settings Channel',
        description: 'Description',
        uploader: 'Uploader',
        url: 'https://youtube.com/@partial'
      };

      // Only provide sub_folder, not video_quality or default_rating
      const initialSettings = {
        sub_folder: 'CustomFolder'
      };

      await channelProvisioning.upsertChannel(channelData, false, null, initialSettings);

      expect(Channel.create).toHaveBeenCalledWith({
        channel_id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url,
        enabled: false,
        sub_folder: 'CustomFolder'
      });
    });

    test('should seed min_duration, max_duration, title_filter_regex, audio_format on create', async () => {
      const mockChannel = { ...mockChannelData };
      Channel.findOne.mockResolvedValueOnce(null);
      Channel.findOne.mockResolvedValueOnce(null);
      Channel.create.mockResolvedValue(mockChannel);

      const channelData = {
        id: 'UC_SEED',
        title: 'Seed Channel',
        description: '',
        uploader: 'Seeder',
        url: 'https://youtube.com/@seed',
      };

      const initialSettings = {
        min_duration: 60,
        max_duration: 3600,
        title_filter_regex: '^Tutorial',
        audio_format: 'mp3',
      };

      await channelProvisioning.upsertChannel(channelData, false, null, initialSettings);

      expect(Channel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          min_duration: 60,
          max_duration: 3600,
          title_filter_regex: '^Tutorial',
          audio_format: 'mp3',
        })
      );
    });

    test('should not apply new seed fields when channel already exists', async () => {
      const mockChannel = {
        ...mockChannelData,
        update: jest.fn(),
      };
      Channel.findOne.mockResolvedValueOnce(mockChannel);

      const channelData = {
        id: 'UC123',
        title: 'Existing',
        description: '',
        uploader: 'Uploader',
        url: 'https://youtube.com/@existing',
      };

      const initialSettings = {
        min_duration: 60,
        max_duration: 3600,
        title_filter_regex: '^Tutorial',
        audio_format: 'mp3',
      };

      await channelProvisioning.upsertChannel(channelData, false, null, initialSettings);

      expect(mockChannel.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ min_duration: 60 })
      );
      expect(Channel.create).not.toHaveBeenCalled();
    });
  });

  describe('getChannelInfo with existing channel', () => {
    const makeExistingChannel = (enabled) => {
      const channel = {
        channel_id: 'UC_EXISTING',
        title: 'Existing Channel',
        description: 'Existing Description',
        uploader: 'Existing Uploader',
        url: 'https://www.youtube.com/@existing',
        available_tabs: 'videos',
        hidden_tabs: null,
        auto_download_enabled_tabs: 'video',
        sub_folder: 'MyFolder',
        enabled,
      };
      channel.update = jest.fn(async (values) => Object.assign(channel, values));
      return channel;
    };

    test('re-enables an existing disabled channel when enableChannel is true', async () => {
      const channel = makeExistingChannel(false);
      Channel.findOne.mockResolvedValueOnce(channel);

      const result = await channelProvisioning.getChannelInfo('https://www.youtube.com/@existing', false, true);

      expect(channel.update).toHaveBeenCalledWith({ enabled: true });
      expect(result.enabled).toBe(true);
    });

    test('leaves an existing disabled channel disabled when enableChannel is false', async () => {
      const channel = makeExistingChannel(false);
      Channel.findOne.mockResolvedValueOnce(channel);

      const result = await channelProvisioning.getChannelInfo('https://www.youtube.com/@existing', false, false);

      expect(channel.update).not.toHaveBeenCalled();
      expect(result.enabled).toBe(false);
    });

    test('reports existing=true and enabled=true for an active subscription', async () => {
      const channel = makeExistingChannel(true);
      Channel.findOne.mockResolvedValueOnce(channel);

      const result = await channelProvisioning.getChannelInfo('https://www.youtube.com/@existing', false, false);

      expect(channel.update).not.toHaveBeenCalled();
      expect(result.existing).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.sub_folder).toBe('MyFolder');
    });
  });
});
