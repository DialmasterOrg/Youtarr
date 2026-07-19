/* eslint-env jest */

jest.mock('../../../logger');

describe('channelMappers', () => {
  let channelMappers;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    channelMappers = require('../channelMappers');
  });

  describe('mapChannelToResponse', () => {
    test('should map channel database record to response format', () => {
      const channel = {
        channel_id: 'UC123',
        uploader: 'Test User',
        uploader_id: 'UC123',
        title: 'Test Channel',
        description: 'Test Description',
        url: 'https://youtube.com/@test',
        auto_download_enabled_tabs: 'video,short'
      };

      const result = channelMappers.mapChannelToResponse(channel);

      expect(result).toEqual({
        id: 'UC123',
        uploader: 'Test User',
        uploader_id: 'UC123',
        title: 'Test Channel',
        description: 'Test Description',
        url: 'https://youtube.com/@test',
        enabled: false,
        auto_download_enabled_tabs: 'video,short',
        available_tabs: null,
        sub_folder: null,
        video_quality: null,
        audio_format: null,
        min_duration: null,
        max_duration: null,
        title_filter_regex: null,
        terminated_at: null,
      });
    });

    test('should use default value for auto_download_enabled_tabs when null', () => {
      const channel = {
        channel_id: 'UC123',
        uploader: 'Test User',
        uploader_id: 'UC123',
        title: 'Test Channel',
        description: 'Test Description',
        url: 'https://youtube.com/@test',
        auto_download_enabled_tabs: null
      };

      const result = channelMappers.mapChannelToResponse(channel);

      expect(result.auto_download_enabled_tabs).toBe('video');
      expect(result.available_tabs).toBeNull();
      expect(result.sub_folder).toBeNull();
      expect(result.video_quality).toBeNull();
      expect(result.min_duration).toBeNull();
      expect(result.max_duration).toBeNull();
      expect(result.title_filter_regex).toBeNull();
    });
  });

  describe('mapChannelToResponse with hidden_tabs', () => {
    test('returns effective available_tabs excluding hidden tabs', () => {
      const channel = {
        channel_id: 'UC123',
        uploader: 'Test',
        uploader_id: 'UC123',
        title: 'Test',
        description: 'Test',
        url: 'https://youtube.com/@test',
        auto_download_enabled_tabs: 'video',
        available_tabs: 'videos,shorts,streams',
        hidden_tabs: 'shorts'
      };

      const result = channelMappers.mapChannelToResponse(channel);

      expect(result.available_tabs).toBe('videos,streams');
    });

    test('leaves available_tabs unchanged when hidden_tabs is null', () => {
      const channel = {
        channel_id: 'UC123',
        uploader: 'Test',
        uploader_id: 'UC123',
        title: 'Test',
        description: 'Test',
        url: 'https://youtube.com/@test',
        auto_download_enabled_tabs: 'video',
        available_tabs: 'videos,shorts',
        hidden_tabs: null
      };

      const result = channelMappers.mapChannelToResponse(channel);

      expect(result.available_tabs).toBe('videos,shorts');
    });

    test('returns null available_tabs when all detected are hidden', () => {
      const channel = {
        channel_id: 'UC123',
        uploader: 'Test',
        uploader_id: 'UC123',
        title: 'Test',
        description: 'Test',
        url: 'https://youtube.com/@test',
        auto_download_enabled_tabs: 'video',
        available_tabs: 'videos',
        hidden_tabs: 'videos'
      };

      const result = channelMappers.mapChannelToResponse(channel);

      expect(result.available_tabs).toBeNull();
    });
  });

  describe('mapChannelListEntry with hidden_tabs', () => {
    test('returns effective available_tabs excluding hidden tabs', () => {
      const channel = {
        url: 'https://youtube.com/@test',
        uploader: 'Test',
        channel_id: 'UC123',
        auto_download_enabled_tabs: 'video',
        available_tabs: 'videos,shorts,streams',
        hidden_tabs: 'shorts,streams'
      };

      const result = channelMappers.mapChannelListEntry(channel);

      expect(result.available_tabs).toBe('videos');
    });
  });
});
