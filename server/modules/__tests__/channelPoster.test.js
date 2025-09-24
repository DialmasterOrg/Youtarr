/* eslint-env jest */

// Mock fs-extra module before any imports
jest.mock('fs-extra');
jest.mock('../configModule');

describe('Channel Poster Functionality', () => {
  let channelModule;
  let fs;
  let configModule;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock fs-extra
    jest.doMock('fs-extra', () => ({
      existsSync: jest.fn(),
      copySync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        unlink: jest.fn(),
        rename: jest.fn()
      }
    }));

    // Mock configModule
    jest.doMock('../configModule', () => {
      const getConfig = jest.fn().mockReturnValue({
        channelAutoDownload: false,
        channelDownloadFrequency: '0 * * * *',
        writeChannelPosters: true,
        writeVideoNfoFiles: true
      });

      return {
        directoryPath: '/videos',
        getImagePath: jest.fn().mockReturnValue('/images'),
        onConfigChange: jest.fn(),
        getConfig
      };
    });

    // Mock other dependencies
    jest.doMock('../downloadModule', () => ({}));
    jest.doMock('../archiveModule', () => ({}));
    jest.doMock('node-cron', () => ({
      schedule: jest.fn()
    }));
    jest.doMock('../../models/channel', () => ({
      findAll: jest.fn(),
      findOne: jest.fn()
    }));
    jest.doMock('../../models/channelvideo', () => ({}));
    jest.doMock('../messageEmitter', () => ({
      emitMessage: jest.fn()
    }));

    // Re-import after mocking
    fs = require('fs-extra');
    channelModule = require('../channelModule');
    configModule = require('../configModule');
  });

  describe('backfillChannelPosters', () => {
    it('should copy channelthumb to channel folder as poster.jpg if it doesn\'t exist', async () => {
      const channels = [
        {
          channel_id: 'UC123',
          uploader: 'Test Channel 1',
          url: 'https://youtube.com/@testchannel1'
        },
        {
          channel_id: 'UC456',
          uploader: 'Test Channel 2',
          url: 'https://youtube.com/@testchannel2'
        }
      ];

      // Mock file existence checks
      fs.existsSync.mockImplementation((path) => {
        // Output directory exists
        if (path === '/videos') return true;
        // Channel folders exist
        if (path === '/videos/Test Channel 1') return true;
        if (path === '/videos/Test Channel 2') return true;
        // poster.jpg doesn't exist for channel 1
        if (path === '/videos/Test Channel 1/poster.jpg') return false;
        // poster.jpg already exists for channel 2
        if (path === '/videos/Test Channel 2/poster.jpg') return true;
        // channelthumb exists for channel 1
        if (path === '/images/channelthumb-UC123.jpg') return true;
        return false;
      });

      await channelModule.backfillChannelPosters(channels);

      // Should copy poster for channel 1 but not channel 2
      expect(fs.copySync).toHaveBeenCalledTimes(1);
      expect(fs.copySync).toHaveBeenCalledWith(
        '/images/channelthumb-UC123.jpg',
        '/videos/Test Channel 1/poster.jpg'
      );
    });

    it('should handle missing output directory gracefully', async () => {
      const channels = [
        { channel_id: 'UC123', uploader: 'Test Channel' }
      ];

      fs.existsSync.mockReturnValue(false);

      await channelModule.backfillChannelPosters(channels);

      expect(fs.copySync).not.toHaveBeenCalled();
    });

    it('should skip channels without channel_id or uploader', async () => {
      const channels = [
        { channel_id: null, uploader: 'Test Channel' },
        { channel_id: 'UC123', uploader: null },
        { channel_id: 'UC456', uploader: 'Valid Channel' }
      ];

      fs.existsSync.mockImplementation((path) => {
        if (path === '/videos') return true;
        if (path === '/videos/Valid Channel') return true;
        if (path === '/videos/Valid Channel/poster.jpg') return false;
        if (path === '/images/channelthumb-UC456.jpg') return true;
        return false;
      });

      await channelModule.backfillChannelPosters(channels);

      // Should only process the valid channel
      expect(fs.copySync).toHaveBeenCalledTimes(1);
      expect(fs.copySync).toHaveBeenCalledWith(
        '/images/channelthumb-UC456.jpg',
        '/videos/Valid Channel/poster.jpg'
      );
    });

    it('should skip processing when writeChannelPosters is disabled', async () => {
      configModule.getConfig.mockReturnValue({ writeChannelPosters: false });

      const channels = [
        { channel_id: 'UC123', uploader: 'Test Channel' }
      ];

      await channelModule.backfillChannelPosters(channels);

      // fs.existsSync may be called during module initialization, but copySync should not be called
      expect(fs.copySync).not.toHaveBeenCalled();
    });

    it('should handle copy errors gracefully', async () => {
      const channels = [
        { channel_id: 'UC123', uploader: 'Test Channel' }
      ];

      fs.existsSync.mockImplementation((path) => {
        if (path === '/videos') return true;
        if (path === '/videos/Test Channel') return true;
        if (path === '/videos/Test Channel/poster.jpg') return false;
        if (path === '/images/channelthumb-UC123.jpg') return true;
        return false;
      });

      fs.copySync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      console.log = jest.fn();

      await channelModule.backfillChannelPosters(channels);

      expect(console.log).toHaveBeenCalledWith(
        'Error backfilling poster for Test Channel: Permission denied'
      );
    });

    it('should not copy if channelthumb doesn\'t exist', async () => {
      const channels = [
        { channel_id: 'UC123', uploader: 'Test Channel' }
      ];

      fs.existsSync.mockImplementation((path) => {
        if (path === '/videos') return true;
        if (path === '/videos/Test Channel') return true;
        if (path === '/videos/Test Channel/poster.jpg') return false;
        if (path === '/images/channelthumb-UC123.jpg') return false; // channelthumb doesn't exist
        return false;
      });

      await channelModule.backfillChannelPosters(channels);

      expect(fs.copySync).not.toHaveBeenCalled();
    });
  });
});
