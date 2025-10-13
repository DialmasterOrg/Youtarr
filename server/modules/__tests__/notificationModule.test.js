/* eslint-env jest */

// Mock https, logger, and configModule before requiring notificationModule
jest.mock('https');
jest.mock('../../logger');
jest.mock('../configModule', () => ({
  getConfig: jest.fn()
}));

const https = require('https');
const { EventEmitter } = require('events');
const logger = require('../../logger');

describe('NotificationModule', () => {
  let notificationModule;
  let configModule;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default config
    mockConfig = {
      notificationsEnabled: true,
      discordWebhookUrl: 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop'
    };

    configModule = require('../configModule');
    configModule.getConfig.mockReturnValue(mockConfig);

    notificationModule = require('../notificationModule');
  });

  describe('isConfigured', () => {
    it('should return true when notifications are enabled and webhook URL is set', () => {
      expect(notificationModule.isConfigured()).toBe(true);
    });

    it('should return false when notifications are disabled', () => {
      mockConfig.notificationsEnabled = false;
      configModule.getConfig.mockReturnValue(mockConfig);

      expect(notificationModule.isConfigured()).toBe(false);
    });

    it('should return false when webhook URL is empty', () => {
      mockConfig.discordWebhookUrl = '';
      configModule.getConfig.mockReturnValue(mockConfig);

      expect(notificationModule.isConfigured()).toBe(false);
    });

    it('should return false when webhook URL is only whitespace', () => {
      mockConfig.discordWebhookUrl = '   ';
      configModule.getConfig.mockReturnValue(mockConfig);

      expect(notificationModule.isConfigured()).toBe(false);
    });

    it('should return false when webhook URL is undefined', () => {
      mockConfig.discordWebhookUrl = undefined;
      configModule.getConfig.mockReturnValue(mockConfig);

      expect(notificationModule.isConfigured()).toBe(false);
    });
  });

  describe('formatDuration', () => {
    it('should return "0:00" for zero seconds', () => {
      expect(notificationModule.formatDuration(0)).toBe('0:00');
    });

    it('should return "0:00" for null or undefined', () => {
      expect(notificationModule.formatDuration(null)).toBe('0:00');
      expect(notificationModule.formatDuration(undefined)).toBe('0:00');
    });

    it('should format seconds under a minute', () => {
      expect(notificationModule.formatDuration(30)).toBe('0:30');
      expect(notificationModule.formatDuration(5)).toBe('0:05');
      expect(notificationModule.formatDuration(59)).toBe('0:59');
    });

    it('should format minutes and seconds', () => {
      expect(notificationModule.formatDuration(90)).toBe('1:30');
      expect(notificationModule.formatDuration(125)).toBe('2:05');
      expect(notificationModule.formatDuration(599)).toBe('9:59');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(notificationModule.formatDuration(3600)).toBe('1:00:00');
      expect(notificationModule.formatDuration(3661)).toBe('1:01:01');
      expect(notificationModule.formatDuration(7384)).toBe('2:03:04');
    });

    it('should pad minutes and seconds in HH:MM:SS format', () => {
      expect(notificationModule.formatDuration(3605)).toBe('1:00:05');
      expect(notificationModule.formatDuration(3665)).toBe('1:01:05');
    });

    it('should handle decimal seconds by flooring', () => {
      expect(notificationModule.formatDuration(90.7)).toBe('1:30');
      expect(notificationModule.formatDuration(3661.9)).toBe('1:01:01');
    });
  });

  describe('formatDownloadMessage', () => {
    const baseFinalSummary = {
      totalDownloaded: 2,
      totalSkipped: 1,
      jobType: 'Channel Downloads',
      completedAt: '2025-10-03T12:00:00Z'
    };

    const baseVideoData = [
      {
        youTubeChannelName: 'Tech Channel',
        youTubeVideoName: 'How to Code',
        duration: 600
      },
      {
        youTubeChannelName: 'Music Channel',
        youTubeVideoName: 'Best Song Ever',
        duration: 245
      }
    ];

    it('should format message for single video download', () => {
      const summary = { ...baseFinalSummary, totalDownloaded: 1 };
      const videos = [baseVideoData[0]];

      const message = notificationModule.formatDownloadMessage(summary, videos);

      expect(message.embeds[0].title).toBe('🎬 New Video Downloaded');
      expect(message.embeds[0].color).toBe(0x00ff00);
      expect(message.embeds[0].footer.text).toBe('Youtarr');
      expect(message.embeds[0].timestamp).toBeDefined();
    });

    it('should format message for multiple video downloads', () => {
      const message = notificationModule.formatDownloadMessage(baseFinalSummary, baseVideoData);

      expect(message.embeds[0].title).toBe('🎬 2 New Videos Downloaded');
    });

    it('should include channel download label in description', () => {
      const message = notificationModule.formatDownloadMessage(baseFinalSummary, baseVideoData);

      expect(message.embeds[0].description).toContain('**Channel Video Downloads:**');
    });

    it('should include manual download label for manually added URLs', () => {
      const summary = { ...baseFinalSummary, jobType: 'Manually Added Urls' };
      const message = notificationModule.formatDownloadMessage(summary, baseVideoData);

      expect(message.embeds[0].description).toContain('**Manually Selected Video Downloads:**');
    });

    it('should list video details with duration', () => {
      const message = notificationModule.formatDownloadMessage(baseFinalSummary, baseVideoData);

      expect(message.embeds[0].description).toContain('• Tech Channel - How to Code - 10:00');
      expect(message.embeds[0].description).toContain('• Music Channel - Best Song Ever - 4:05');
    });

    it('should handle videos without channel names', () => {
      const videos = [{ youTubeVideoName: 'Test Video', duration: 120 }];
      const summary = { ...baseFinalSummary, totalDownloaded: 1 };

      const message = notificationModule.formatDownloadMessage(summary, videos);

      expect(message.embeds[0].description).toContain('Unknown Channel - Test Video');
    });

    it('should handle videos without video names', () => {
      const videos = [{ youTubeChannelName: 'Test Channel', duration: 120 }];
      const summary = { ...baseFinalSummary, totalDownloaded: 1 };

      const message = notificationModule.formatDownloadMessage(summary, videos);

      expect(message.embeds[0].description).toContain('Test Channel - Unknown Title');
    });

    it('should truncate very long video titles', () => {
      const longTitle = 'A'.repeat(200);
      const videos = [{
        youTubeChannelName: 'Channel',
        youTubeVideoName: longTitle,
        duration: 100
      }];
      const summary = { ...baseFinalSummary, totalDownloaded: 1 };

      const message = notificationModule.formatDownloadMessage(summary, videos);

      const descriptionLines = message.embeds[0].description.split('\n');
      const videoLine = descriptionLines.find(line => line.startsWith('•'));
      expect(videoLine.length).toBeLessThanOrEqual(154); // 150 + "• " + "..."
      expect(videoLine).toContain('...');
    });

    it('should limit to first 10 videos and show count of remaining', () => {
      const manyVideos = Array.from({ length: 15 }, (_, i) => ({
        youTubeChannelName: `Channel ${i}`,
        youTubeVideoName: `Video ${i}`,
        duration: 100
      }));
      const summary = { ...baseFinalSummary, totalDownloaded: 15 };

      const message = notificationModule.formatDownloadMessage(summary, manyVideos);

      // Should show first 10 videos
      expect(message.embeds[0].description).toContain('Video 0');
      expect(message.embeds[0].description).toContain('Video 9');
      // Should not show video 10 or beyond
      expect(message.embeds[0].description).not.toContain('Video 10');
      // Should show count of remaining
      expect(message.embeds[0].description).toContain('...and 5 more');
    });

    it('should handle empty video data array', () => {
      const message = notificationModule.formatDownloadMessage(baseFinalSummary, []);

      expect(message.embeds[0].title).toBe('🎬 2 New Videos Downloaded');
      expect(message.embeds[0].description).toContain('**Channel Video Downloads:**');
    });

    it('should handle null video data', () => {
      const message = notificationModule.formatDownloadMessage(baseFinalSummary, null);

      expect(message.embeds[0].title).toBe('🎬 2 New Videos Downloaded');
    });
  });

  describe('sendDiscordWebhook', () => {
    let mockRequest;
    let mockResponse;

    beforeEach(() => {
      mockResponse = new EventEmitter();
      mockResponse.statusCode = 200;

      mockRequest = new EventEmitter();
      mockRequest.write = jest.fn();
      mockRequest.end = jest.fn();
      mockRequest.destroy = jest.fn();

      https.request.mockImplementation((options, callback) => {
        // Call the callback with our mock response
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });
    });

    it('should successfully send webhook with valid URL', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const message = { embeds: [{ title: 'Test' }] };

      const sendPromise = notificationModule.sendDiscordWebhook(webhookUrl, message);

      // Simulate successful response
      setImmediate(() => {
        mockResponse.emit('end');
      });

      await expect(sendPromise).resolves.toBeUndefined();

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'discord.com',
          port: 443,
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        }),
        expect.any(Function)
      );
      expect(mockRequest.write).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockRequest.end).toHaveBeenCalled();
    });

    it('should reject with error for non-Discord URL', async () => {
      const webhookUrl = 'https://example.com/webhook';
      const message = { embeds: [{ title: 'Test' }] };

      await expect(notificationModule.sendDiscordWebhook(webhookUrl, message))
        .rejects.toThrow('Invalid Discord webhook URL');
    });

    it('should reject with error for invalid URL format', async () => {
      const webhookUrl = 'not-a-url';
      const message = { embeds: [{ title: 'Test' }] };

      await expect(notificationModule.sendDiscordWebhook(webhookUrl, message))
        .rejects.toThrow('Invalid webhook URL');
    });

    it('should handle 4xx response codes', async () => {
      mockResponse.statusCode = 400;
      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const message = { embeds: [{ title: 'Test' }] };

      const sendPromise = notificationModule.sendDiscordWebhook(webhookUrl, message);

      setImmediate(() => {
        mockResponse.emit('data', 'Bad request');
        mockResponse.emit('end');
      });

      await expect(sendPromise).rejects.toThrow('Discord webhook returned status 400');
    });

    it('should handle 5xx response codes', async () => {
      mockResponse.statusCode = 500;
      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const message = { embeds: [{ title: 'Test' }] };

      const sendPromise = notificationModule.sendDiscordWebhook(webhookUrl, message);

      setImmediate(() => {
        mockResponse.emit('data', 'Internal server error');
        mockResponse.emit('end');
      });

      await expect(sendPromise).rejects.toThrow('Discord webhook returned status 500');
    });

    it('should handle network errors', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const message = { embeds: [{ title: 'Test' }] };

      const sendPromise = notificationModule.sendDiscordWebhook(webhookUrl, message);

      setImmediate(() => {
        mockRequest.emit('error', new Error('Network error'));
      });

      await expect(sendPromise).rejects.toThrow('Failed to send Discord webhook: Network error');
    });

    it('should handle timeout', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const message = { embeds: [{ title: 'Test' }] };

      const sendPromise = notificationModule.sendDiscordWebhook(webhookUrl, message);

      setImmediate(() => {
        mockRequest.emit('timeout');
      });

      await expect(sendPromise).rejects.toThrow('Discord webhook request timed out');
      expect(mockRequest.destroy).toHaveBeenCalled();
    });

    it('should include query parameters in request path', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123/abc?wait=true';
      const message = { embeds: [{ title: 'Test' }] };

      const sendPromise = notificationModule.sendDiscordWebhook(webhookUrl, message);

      setImmediate(() => {
        mockResponse.emit('end');
      });

      await sendPromise;

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/webhooks/123/abc?wait=true'
        }),
        expect.any(Function)
      );
    });

    it('should set proper timeout in request options', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const message = { embeds: [{ title: 'Test' }] };

      const sendPromise = notificationModule.sendDiscordWebhook(webhookUrl, message);

      setImmediate(() => {
        mockResponse.emit('end');
      });

      await sendPromise;

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000
        }),
        expect.any(Function)
      );
    });
  });

  describe('sendTestNotification', () => {
    let mockRequest;
    let mockResponse;

    beforeEach(() => {
      mockResponse = new EventEmitter();
      mockResponse.statusCode = 200;

      mockRequest = new EventEmitter();
      mockRequest.write = jest.fn();
      mockRequest.end = jest.fn();
      mockRequest.destroy = jest.fn();

      https.request.mockImplementation((options, callback) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });
    });

    it('should send test notification with correct format', async () => {
      const sendPromise = notificationModule.sendTestNotification();

      setImmediate(() => {
        mockResponse.emit('end');
      });

      await sendPromise;

      expect(mockRequest.write).toHaveBeenCalled();
      const payload = JSON.parse(mockRequest.write.mock.calls[0][0]);
      expect(payload.embeds[0].title).toBe('✅ Test Notification');
      expect(payload.embeds[0].description).toBe('Your Youtarr notifications are working correctly!');
      expect(payload.embeds[0].color).toBe(0x00ff00);
      expect(payload.embeds[0].footer.text).toBe('Youtarr Notifications');
    });

    it('should throw error when webhook URL is not configured', async () => {
      mockConfig.discordWebhookUrl = '';
      configModule.getConfig.mockReturnValue(mockConfig);

      await expect(notificationModule.sendTestNotification())
        .rejects.toThrow('Discord webhook URL is not configured');
    });

    it('should throw error when webhook URL is only whitespace', async () => {
      mockConfig.discordWebhookUrl = '   ';
      configModule.getConfig.mockReturnValue(mockConfig);

      await expect(notificationModule.sendTestNotification())
        .rejects.toThrow('Discord webhook URL is not configured');
    });
  });

  describe('sendDownloadNotification', () => {
    let mockRequest;
    let mockResponse;

    beforeEach(() => {
      mockResponse = new EventEmitter();
      mockResponse.statusCode = 200;

      mockRequest = new EventEmitter();
      mockRequest.write = jest.fn();
      mockRequest.end = jest.fn();
      mockRequest.destroy = jest.fn();

      https.request.mockImplementation((options, callback) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });
    });

    const baseNotificationData = {
      finalSummary: {
        totalDownloaded: 2,
        totalSkipped: 1,
        jobType: 'Channel Downloads',
        completedAt: '2025-10-03T12:00:00Z'
      },
      videoData: [
        {
          youTubeChannelName: 'Tech Channel',
          youTubeVideoName: 'How to Code',
          duration: 600
        }
      ],
      channelName: 'Tech Channel'
    };

    it('should send notification when properly configured', async () => {
      const sendPromise = notificationModule.sendDownloadNotification(baseNotificationData);

      setImmediate(() => {
        mockResponse.emit('end');
      });

      await sendPromise;

      expect(https.request).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        { downloadCount: 2 },
        'Download notification sent successfully'
      );
    });

    it('should skip notification when not configured', async () => {
      mockConfig.notificationsEnabled = false;
      configModule.getConfig.mockReturnValue(mockConfig);

      await notificationModule.sendDownloadNotification(baseNotificationData);

      expect(https.request).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Notifications not configured, skipping notification');
    });

    it('should skip notification when no videos downloaded', async () => {
      const notificationData = {
        ...baseNotificationData,
        finalSummary: { ...baseNotificationData.finalSummary, totalDownloaded: 0 }
      };

      await notificationModule.sendDownloadNotification(notificationData);

      expect(https.request).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('No new videos downloaded, skipping notification');
    });

    it('should handle errors gracefully without throwing', async () => {
      const sendPromise = notificationModule.sendDownloadNotification(baseNotificationData);

      setImmediate(() => {
        mockRequest.emit('error', new Error('Network failure'));
      });

      // Should not throw
      await expect(sendPromise).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Failed to send download notification'
      );
    });

    it('should send properly formatted message', async () => {
      const sendPromise = notificationModule.sendDownloadNotification(baseNotificationData);

      setImmediate(() => {
        mockResponse.emit('end');
      });

      await sendPromise;

      expect(mockRequest.write).toHaveBeenCalled();
      const payload = JSON.parse(mockRequest.write.mock.calls[0][0]);
      expect(payload.embeds[0].title).toBe('🎬 2 New Videos Downloaded');
      expect(payload.embeds[0].description).toContain('Tech Channel - How to Code - 10:00');
    });
  });
});
