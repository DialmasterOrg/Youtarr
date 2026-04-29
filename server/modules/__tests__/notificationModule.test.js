/* eslint-env jest */

const { EventEmitter } = require('events');
const { isDiscordWebhook } = require('../notificationHelpers');

// Create mock functions
const mockSpawn = jest.fn();
const mockHttpsRequest = jest.fn();
const mockGetConfig = jest.fn();
const mockLoggerDebug = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

// Mock modules before requiring notificationModule
jest.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args)
}));

jest.mock('https', () => ({
  request: (...args) => mockHttpsRequest(...args)
}));

// Mock logger for both old and new paths (the module redirects)
jest.mock('../../logger', () => ({
  debug: (...args) => mockLoggerDebug(...args),
  info: (...args) => mockLoggerInfo(...args),
  error: (...args) => mockLoggerError(...args)
}));

jest.mock('../configModule', () => ({
  getConfig: () => mockGetConfig()
}));

// Now require the module (which now redirects to notifications/index.js)
const notificationModule = require('../notificationModule');

// Also require the formatters and senders for direct testing
const {
  plainFormatter,
  discordFormatter,
  emailFormatter,
  telegramFormatter,
  slackMarkdownFormatter
} = require('../notifications/formatters');
const { appriseSender, discordSender } = require('../notifications/senders');
const { formatDuration, buildAutoRemovalTitle, formatBytes, groupVideosByChannel } = require('../notifications/utils');

describe('NotificationModule', () => {
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default config with Apprise URLs in new object format
    mockConfig = {
      notificationsEnabled: true,
      appriseUrls: [{ url: 'ntfy://test-topic', name: 'Test Ntfy', richFormatting: true }]
    };

    mockGetConfig.mockReturnValue(mockConfig);
  });

  describe('isConfigured', () => {
    it('should return true when notifications are enabled and appriseUrls has entries', () => {
      expect(notificationModule.isConfigured()).toBe(true);
    });

    it('should return false when notifications are disabled', () => {
      mockConfig.notificationsEnabled = false;
      expect(notificationModule.isConfigured()).toBe(false);
    });

    it('should return false when appriseUrls is empty', () => {
      mockConfig.appriseUrls = [];
      expect(notificationModule.isConfigured()).toBe(false);
    });

    it('should return false when appriseUrls is undefined', () => {
      mockConfig.appriseUrls = undefined;
      expect(notificationModule.isConfigured()).toBe(false);
    });

    it('should return false when appriseUrls is not an array', () => {
      mockConfig.appriseUrls = 'not-an-array';
      expect(notificationModule.isConfigured()).toBe(false);
    });

    it('should handle legacy string format in appriseUrls', () => {
      mockConfig.appriseUrls = ['ntfy://test-topic'];
      expect(notificationModule.isConfigured()).toBe(true);
    });
  });

  describe('getUrlsFromConfig', () => {
    it('should normalize string URLs to object format', () => {
      mockConfig.appriseUrls = ['ntfy://test-topic', 'discord://webhook_id/token'];
      const urls = notificationModule.getUrlsFromConfig(mockConfig);

      expect(urls).toHaveLength(2);
      // Ntfy doesn't support rich formatting, so it defaults to false
      expect(urls[0]).toEqual({
        url: 'ntfy://test-topic',
        name: 'Ntfy',
        richFormatting: false
      });
    });

    it('should preserve object format with all fields', () => {
      mockConfig.appriseUrls = [{
        url: 'ntfy://test-topic',
        name: 'My Custom Name',
        richFormatting: false
      }];
      const urls = notificationModule.getUrlsFromConfig(mockConfig);

      expect(urls[0]).toEqual({
        url: 'ntfy://test-topic',
        name: 'My Custom Name',
        richFormatting: false
      });
    });

    it('should default richFormatting to true when not specified', () => {
      mockConfig.appriseUrls = [{
        url: 'ntfy://test-topic',
        name: 'Test'
      }];
      const urls = notificationModule.getUrlsFromConfig(mockConfig);

      expect(urls[0].richFormatting).toBe(true);
    });

    it('should filter out empty URLs', () => {
      mockConfig.appriseUrls = [
        { url: 'ntfy://test', name: 'Test' },
        { url: '', name: 'Empty' },
        { url: '   ', name: 'Whitespace' }
      ];
      const urls = notificationModule.getUrlsFromConfig(mockConfig);

      expect(urls).toHaveLength(1);
      expect(urls[0].name).toBe('Test');
    });
  });

  describe('isDiscordWebhook (from notificationHelpers)', () => {
    it('should return true for discord.com webhook URLs', () => {
      expect(isDiscordWebhook('https://discord.com/api/webhooks/123/abc')).toBe(true);
    });

    it('should return true for discordapp.com webhook URLs', () => {
      expect(isDiscordWebhook('https://discordapp.com/api/webhooks/123/abc')).toBe(true);
    });

    it('should return false for discord:// Apprise URLs', () => {
      // discord:// URLs are NOT HTTP webhooks, they go through Apprise
      expect(isDiscordWebhook('discord://webhook_id/token')).toBe(false);
    });

    it('should return false for other URLs', () => {
      expect(isDiscordWebhook('ntfy://test')).toBe(false);
    });
  });
});

describe('Notification Utils', () => {
  describe('formatDuration', () => {
    it('should return "0:00" for zero seconds', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should return "0:00" for null or undefined', () => {
      expect(formatDuration(null)).toBe('0:00');
      expect(formatDuration(undefined)).toBe('0:00');
    });

    it('should format seconds under a minute', () => {
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(5)).toBe('0:05');
      expect(formatDuration(59)).toBe('0:59');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(125)).toBe('2:05');
      expect(formatDuration(599)).toBe('9:59');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(formatDuration(3600)).toBe('1:00:00');
      expect(formatDuration(3661)).toBe('1:01:01');
      expect(formatDuration(7384)).toBe('2:03:04');
    });

    it('should pad minutes and seconds in HH:MM:SS format', () => {
      expect(formatDuration(3605)).toBe('1:00:05');
      expect(formatDuration(3665)).toBe('1:01:05');
    });

    it('should handle decimal seconds by flooring', () => {
      expect(formatDuration(90.7)).toBe('1:30');
      expect(formatDuration(3661.9)).toBe('1:01:01');
    });
  });
});

describe('Plain Formatter', () => {
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

      const message = plainFormatter.formatDownloadMessage(summary, videos);

      expect(message.title).toBe('🎬 New Video Downloaded');
      expect(message.body).toContain('Tech Channel - How to Code');
    });

    it('should format message for multiple video downloads', () => {
      const message = plainFormatter.formatDownloadMessage(baseFinalSummary, baseVideoData);

      expect(message.title).toBe('🎬 2 New Videos Downloaded');
    });

    it('should include channel download label in body', () => {
      const message = plainFormatter.formatDownloadMessage(baseFinalSummary, baseVideoData);

      expect(message.body).toContain('Channel Video Downloads:');
    });

    it('should include manual download label for manually added URLs', () => {
      const summary = { ...baseFinalSummary, jobType: 'Manually Added Urls' };
      const message = plainFormatter.formatDownloadMessage(summary, baseVideoData);

      expect(message.body).toContain('Manually Selected Downloads:');
    });

    it('should list video details with duration', () => {
      const message = plainFormatter.formatDownloadMessage(baseFinalSummary, baseVideoData);

      expect(message.body).toContain('• Tech Channel - How to Code - 10:00');
      expect(message.body).toContain('• Music Channel - Best Song Ever - 4:05');
    });

    it('should handle videos without channel names', () => {
      const videos = [{ youTubeVideoName: 'Test Video', duration: 120 }];
      const summary = { ...baseFinalSummary, totalDownloaded: 1 };

      const message = plainFormatter.formatDownloadMessage(summary, videos);

      expect(message.body).toContain('Unknown Channel - Test Video');
    });

    it('should handle videos without video names', () => {
      const videos = [{ youTubeChannelName: 'Test Channel', duration: 120 }];
      const summary = { ...baseFinalSummary, totalDownloaded: 1 };

      const message = plainFormatter.formatDownloadMessage(summary, videos);

      expect(message.body).toContain('Test Channel - Unknown Title');
    });

    it('should truncate very long video titles', () => {
      const longTitle = 'A'.repeat(200);
      const videos = [{
        youTubeChannelName: 'Channel',
        youTubeVideoName: longTitle,
        duration: 100
      }];
      const summary = { ...baseFinalSummary, totalDownloaded: 1 };

      const message = plainFormatter.formatDownloadMessage(summary, videos);

      const videoLines = message.body.split('\n').filter(line => line.startsWith('•'));
      expect(videoLines[0].length).toBeLessThanOrEqual(154);
      expect(videoLines[0]).toContain('...');
    });

    it('should limit to first 10 videos and show count of remaining', () => {
      const manyVideos = Array.from({ length: 15 }, (_, i) => ({
        youTubeChannelName: `Channel ${i}`,
        youTubeVideoName: `Video ${i}`,
        duration: 100
      }));
      const summary = { ...baseFinalSummary, totalDownloaded: 15 };

      const message = plainFormatter.formatDownloadMessage(summary, manyVideos);

      expect(message.body).toContain('Video 0');
      expect(message.body).toContain('Video 9');
      expect(message.body).not.toContain('Video 10');
      expect(message.body).toContain('...and 5 more');
    });

    it('should handle empty video data array', () => {
      const message = plainFormatter.formatDownloadMessage(baseFinalSummary, []);

      expect(message.title).toBe('🎬 2 New Videos Downloaded');
      expect(message.body).toContain('Channel Video Downloads:');
    });

    it('should handle null video data', () => {
      const message = plainFormatter.formatDownloadMessage(baseFinalSummary, null);

      expect(message.title).toBe('🎬 2 New Videos Downloaded');
    });

    it('should include failed download details for partial-success notifications', () => {
      const summary = {
        ...baseFinalSummary,
        totalFailed: 1,
        failedVideos: [
          {
            channel: 'Private Channel',
            title: 'Members Only Video',
            error: 'This video is members-only'
          }
        ]
      };

      const message = plainFormatter.formatDownloadMessage(summary, baseVideoData);

      expect(message.body).toContain('⚠️ 1 video failed.');
      expect(message.body).toContain('Private Channel: This video is members-only');
    });
  });
});

describe('Discord Formatter', () => {
  describe('formatDownloadMessage', () => {
    const baseFinalSummary = {
      totalDownloaded: 2,
      jobType: 'Channel Downloads'
    };

    const baseVideoData = [
      {
        youTubeChannelName: 'Tech Channel',
        youTubeVideoName: 'How to Code',
        duration: 600
      }
    ];

    it('should return Discord embed format', () => {
      const message = discordFormatter.formatDownloadMessage(baseFinalSummary, baseVideoData);

      expect(message).toHaveProperty('embeds');
      expect(message.embeds).toHaveLength(1);
      expect(message.embeds[0]).toHaveProperty('title');
      expect(message.embeds[0]).toHaveProperty('description');
      expect(message.embeds[0]).toHaveProperty('color');
      expect(message.embeds[0]).toHaveProperty('timestamp');
    });

    it('should include video fields in embed', () => {
      const message = discordFormatter.formatDownloadMessage(baseFinalSummary, baseVideoData);

      expect(message.embeds[0].fields).toBeDefined();
      expect(message.embeds[0].fields[0].name).toContain('Tech Channel');
      expect(message.embeds[0].fields[0].value).toContain('How to Code');
    });

    it('should include failed download details and warning color for partial-success notifications', () => {
      const summary = {
        ...baseFinalSummary,
        totalFailed: 1,
        failedVideos: [
          {
            channel: 'Private Channel',
            error: 'This video is members-only'
          }
        ]
      };

      const message = discordFormatter.formatDownloadMessage(summary, baseVideoData);

      expect(message.embeds[0].color).toBe(0xffa500);
      expect(message.embeds[0].description).toContain('⚠️ **1 video failed.**');
      expect(message.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: '⚠️ Failed downloads',
            value: expect.stringContaining('Private Channel: This video is members-only')
          })
        ])
      );
    });
  });
});

describe('Rich Notification Formatters', () => {
  const partialSuccessSummary = {
    totalDownloaded: 2,
    totalFailed: 1,
    jobType: 'Channel Downloads',
    failedVideos: [
      {
        channel: 'Private Channel',
        error: 'This video is members-only'
      }
    ]
  };

  const videoData = [
    {
      youTubeChannelName: 'Tech Channel',
      youTubeVideoName: 'How to Code',
      duration: 600
    }
  ];

  it('should include failed download details in email notifications', () => {
    const message = emailFormatter.formatDownloadMessage(partialSuccessSummary, videoData);

    expect(message.body).toContain('⚠️ 1 video failed.');
    expect(message.body).toContain('Private Channel: This video is members-only');
  });

  it('should include failed download details in Telegram notifications', () => {
    const message = telegramFormatter.formatDownloadMessage(partialSuccessSummary, videoData);

    expect(message.body).toContain('⚠️ <b>1 video failed.</b>');
    expect(message.body).toContain('Private Channel: This video is members-only');
  });

  it('should include failed download details in Slack notifications', () => {
    const message = slackMarkdownFormatter.formatDownloadMessage(partialSuccessSummary, videoData);

    expect(message.body).toContain('⚠️ *1 video failed.*');
    expect(message.body).toContain('Private Channel: This video is members-only');
  });
});


describe('Apprise Sender', () => {
  let mockProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    mockSpawn.mockReturnValue(mockProcess);
  });

  describe('send', () => {
    it('should spawn apprise with correct arguments', async () => {
      const sendPromise = appriseSender.send('Test Title', 'Test Body', ['ntfy://test']);

      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      await sendPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'apprise',
        ['-vv', '-t', 'Test Title', '-b', 'Test Body', 'ntfy://test'],
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('should include all provided URLs in arguments', async () => {
      const urls = ['ntfy://url1', 'gotify://url2', 'pover://url3'];
      const sendPromise = appriseSender.send('Title', 'Body', urls);

      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      await sendPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'apprise',
        ['-vv', '-t', 'Title', '-b', 'Body', 'ntfy://url1', 'gotify://url2', 'pover://url3'],
        expect.any(Object)
      );
    });

    it('should reject when apprise exits with non-zero code', async () => {
      const sendPromise = appriseSender.send('Title', 'Body', ['ntfy://test']);

      setImmediate(() => {
        mockProcess.stderr.emit('data', 'Some error occurred');
        mockProcess.emit('close', 1);
      });

      await expect(sendPromise).rejects.toThrow('Some error occurred');
    });

    it('should throw error when no URLs are provided', async () => {
      await expect(appriseSender.send('Title', 'Body', []))
        .rejects.toThrow('No notification URLs provided');
    });

    it('should resolve successfully on exit code 0', async () => {
      const sendPromise = appriseSender.send('Title', 'Body', ['ntfy://test']);

      setImmediate(() => {
        mockProcess.stdout.emit('data', 'Notification sent');
        mockProcess.emit('close', 0);
      });

      await expect(sendPromise).resolves.toBeUndefined();
    });
  });
});

describe('Discord Sender', () => {
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = new EventEmitter();
    mockResponse.statusCode = 204;

    mockRequest = new EventEmitter();
    mockRequest.write = jest.fn();
    mockRequest.end = jest.fn();
    mockRequest.destroy = jest.fn();

    mockHttpsRequest.mockImplementation((options, callback) => {
      callback(mockResponse);
      return mockRequest;
    });
  });

  describe('send', () => {
    it('should send message to Discord webhook', async () => {
      const sendPromise = discordSender.send(
        'https://discord.com/api/webhooks/123/abc',
        { content: 'Test message' }
      );

      setImmediate(() => {
        mockResponse.emit('data', '');
        mockResponse.emit('end');
      });

      await sendPromise;

      expect(mockHttpsRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'discord.com',
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        }),
        expect.any(Function)
      );
      expect(mockRequest.write).toHaveBeenCalledWith(JSON.stringify({ content: 'Test message' }));
    });

    it('should reject for non-Discord URLs', async () => {
      await expect(
        discordSender.send('https://example.com/webhook', { content: 'Test' })
      ).rejects.toThrow('Invalid Discord webhook URL');
    });

    it('should reject on non-2xx status code', async () => {
      mockResponse.statusCode = 400;

      const sendPromise = discordSender.send(
        'https://discord.com/api/webhooks/123/abc',
        { content: 'Test' }
      );

      setImmediate(() => {
        mockResponse.emit('data', 'Bad request');
        mockResponse.emit('end');
      });

      await expect(sendPromise).rejects.toThrow();
    });
  });
});

describe('NotificationModule Integration', () => {
  let mockProcess;
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockSpawn.mockReturnValue(mockProcess);

    mockResponse = new EventEmitter();
    mockResponse.statusCode = 204;

    mockRequest = new EventEmitter();
    mockRequest.write = jest.fn();
    mockRequest.end = jest.fn();
    mockRequest.destroy = jest.fn();

    mockHttpsRequest.mockImplementation((options, callback) => {
      callback(mockResponse);
      return mockRequest;
    });

    mockGetConfig.mockReturnValue({
      notificationsEnabled: true,
      appriseUrls: [{ url: 'ntfy://test-topic', name: 'Test Ntfy', richFormatting: true }]
    });
  });

  describe('sendTestNotification', () => {
    it('should send test notification via Apprise for non-Discord URLs', async () => {
      const sendPromise = notificationModule.sendTestNotification();

      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      await sendPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'apprise',
        expect.arrayContaining([
          '-vv', '-t', '✅ Test Notification'
        ]),
        expect.any(Object)
      );
    });

    it('should send rich embed for Discord webhooks with richFormatting enabled', async () => {
      mockGetConfig.mockReturnValue({
        notificationsEnabled: true,
        appriseUrls: [{
          url: 'https://discord.com/api/webhooks/123/abc',
          name: 'Discord',
          richFormatting: true
        }]
      });

      const sendPromise = notificationModule.sendTestNotification();

      setImmediate(() => {
        mockResponse.emit('data', '');
        mockResponse.emit('end');
      });

      await sendPromise;

      expect(mockHttpsRequest).toHaveBeenCalled();
      expect(mockRequest.write).toHaveBeenCalledWith(
        expect.stringContaining('embeds')
      );
    });

    it('should send plain text via Apprise for Discord webhooks with richFormatting disabled', async () => {
      mockGetConfig.mockReturnValue({
        notificationsEnabled: true,
        appriseUrls: [{
          url: 'https://discord.com/api/webhooks/123/abc',
          name: 'Discord',
          richFormatting: false
        }]
      });

      const sendPromise = notificationModule.sendTestNotification();

      // Plain text Discord goes through Apprise, not direct HTTP
      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      await sendPromise;

      // Should use Apprise for plain text
      expect(mockSpawn).toHaveBeenCalledWith(
        'apprise',
        expect.arrayContaining(['-vv', '-t']),
        expect.any(Object)
      );
    });

    it('should throw error when no URLs are configured', async () => {
      mockGetConfig.mockReturnValue({
        notificationsEnabled: true,
        appriseUrls: []
      });

      await expect(notificationModule.sendTestNotification())
        .rejects.toThrow('No notification URLs are configured');
    });
  });

  describe('sendDownloadNotification', () => {
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
        mockProcess.emit('close', 0);
      });

      await sendPromise;

      expect(mockSpawn).toHaveBeenCalled();
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        { downloadCount: 2, successCount: 1, totalCount: 1 },
        'Download notification sent successfully'
      );
    });

    it('should skip notification when not configured', async () => {
      mockGetConfig.mockReturnValue({
        notificationsEnabled: false,
        appriseUrls: []
      });

      await notificationModule.sendDownloadNotification(baseNotificationData);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(mockLoggerDebug).toHaveBeenCalledWith('Notifications not configured, skipping notification');
    });

    it('should skip notification when no videos downloaded', async () => {
      const notificationData = {
        ...baseNotificationData,
        finalSummary: { ...baseNotificationData.finalSummary, totalDownloaded: 0 }
      };

      await notificationModule.sendDownloadNotification(notificationData);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(mockLoggerDebug).toHaveBeenCalledWith('No new videos downloaded, skipping notification');
    });

    it('should use Discord webhook directly for Discord URLs with rich formatting', async () => {
      mockGetConfig.mockReturnValue({
        notificationsEnabled: true,
        appriseUrls: [{
          url: 'https://discord.com/api/webhooks/123/abc',
          name: 'Discord',
          richFormatting: true
        }]
      });

      const sendPromise = notificationModule.sendDownloadNotification(baseNotificationData);

      setImmediate(() => {
        mockResponse.emit('data', '');
        mockResponse.emit('end');
      });

      await sendPromise;

      expect(mockHttpsRequest).toHaveBeenCalled();
      expect(mockRequest.write).toHaveBeenCalledWith(
        expect.stringContaining('embeds')
      );
    });
  });

  describe('sendAutoRemovalNotification', () => {
    const baseCleanupResult = {
      success: true,
      totalDeleted: 5,
      deletedByAge: 3,
      deletedBySpace: 2,
      freedBytes: 5368709120, // 5 GB
      errors: [],
      plan: {
        ageStrategy: {
          thresholdDays: 30,
          sampleVideos: [
            { id: 1, youtubeId: 'abc123', title: 'Old Video 1', channel: 'Tech Channel', fileSize: 1073741824, timeCreated: new Date() },
            { id: 2, youtubeId: 'def456', title: 'Old Video 2', channel: 'Tech Channel', fileSize: 1073741824, timeCreated: new Date() },
            { id: 3, youtubeId: 'ghi789', title: 'Old Video 3', channel: 'Music Channel', fileSize: 1073741824, timeCreated: new Date() }
          ]
        },
        spaceStrategy: {
          threshold: '50GB',
          sampleVideos: [
            { id: 4, youtubeId: 'jkl012', title: 'Space Video 1', channel: 'Gaming Channel', fileSize: 1073741824, timeCreated: new Date() },
            { id: 5, youtubeId: 'mno345', title: 'Space Video 2', channel: 'Gaming Channel', fileSize: 1073741824, timeCreated: new Date() }
          ]
        }
      }
    };

    it('should send notification when properly configured and videos were deleted', async () => {
      const sendPromise = notificationModule.sendAutoRemovalNotification(baseCleanupResult);

      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      await sendPromise;

      expect(mockSpawn).toHaveBeenCalled();
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        { totalDeleted: 5, successCount: 1, totalCount: 1 },
        'Auto-removal notification sent successfully'
      );
    });

    it('should skip notification when not configured', async () => {
      mockGetConfig.mockReturnValue({
        notificationsEnabled: false,
        appriseUrls: []
      });

      await notificationModule.sendAutoRemovalNotification(baseCleanupResult);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(mockLoggerDebug).toHaveBeenCalledWith('Notifications not configured, skipping auto-removal notification');
    });

    it('should skip notification when no videos were deleted', async () => {
      const emptyResult = { ...baseCleanupResult, totalDeleted: 0 };

      await notificationModule.sendAutoRemovalNotification(emptyResult);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(mockLoggerDebug).toHaveBeenCalledWith('No videos were removed, skipping auto-removal notification');
    });

    it('should skip notification when cleanupResult is null', async () => {
      await notificationModule.sendAutoRemovalNotification(null);

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should use Discord embed for Discord URLs with rich formatting', async () => {
      mockGetConfig.mockReturnValue({
        notificationsEnabled: true,
        appriseUrls: [{
          url: 'https://discord.com/api/webhooks/123/abc',
          name: 'Discord',
          richFormatting: true
        }]
      });

      const sendPromise = notificationModule.sendAutoRemovalNotification(baseCleanupResult);

      setImmediate(() => {
        mockResponse.emit('data', '');
        mockResponse.emit('end');
      });

      await sendPromise;

      expect(mockHttpsRequest).toHaveBeenCalled();
      expect(mockRequest.write).toHaveBeenCalledWith(
        expect.stringContaining('embeds')
      );
    });
  });
});

describe('Auto-Removal Utils', () => {
  describe('buildAutoRemovalTitle', () => {
    it('should return singular form for 1 video', () => {
      expect(buildAutoRemovalTitle(1)).toBe('🗑️ 1 Video Auto-Removed');
    });

    it('should return plural form for multiple videos', () => {
      expect(buildAutoRemovalTitle(5)).toBe('🗑️ 5 Videos Auto-Removed');
    });
  });

  describe('formatBytes', () => {
    it('should return "0 B" for zero or falsy values', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(null)).toBe('0 B');
      expect(formatBytes(undefined)).toBe('0 B');
    });

    it('should format bytes under 1 KB', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1)).toBe('1 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(512 * 1024)).toBe('512.00 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(256 * 1024 * 1024)).toBe('256.00 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5.00 GB');
    });

    it('should format fractional gigabytes', () => {
      expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB');
    });
  });

  describe('groupVideosByChannel', () => {
    it('should group videos by channel name', () => {
      const videos = [
        { channel: 'Tech', title: 'Video A' },
        { channel: 'Tech', title: 'Video B' },
        { channel: 'Music', title: 'Video C' }
      ];

      const { groups, truncatedCount } = groupVideosByChannel(videos);

      expect(groups).toHaveLength(2);
      expect(groups[0]).toEqual({ channel: 'Tech', titles: ['Video A', 'Video B'], count: 2 });
      expect(groups[1]).toEqual({ channel: 'Music', titles: ['Video C'], count: 1 });
      expect(truncatedCount).toBe(0);
    });

    it('should limit to maxVideos parameter and report truncation', () => {
      const videos = Array.from({ length: 10 }, (_, i) => ({
        channel: 'Channel', title: `Video ${i}`
      }));

      const { groups, truncatedCount } = groupVideosByChannel(videos, 3);

      expect(groups[0].titles).toHaveLength(3);
      expect(truncatedCount).toBe(7);
    });

    it('should default to 5 videos max and report truncation', () => {
      const videos = Array.from({ length: 10 }, (_, i) => ({
        channel: 'Channel', title: `Video ${i}`
      }));

      const { groups, truncatedCount } = groupVideosByChannel(videos);

      expect(groups[0].titles).toHaveLength(5);
      expect(truncatedCount).toBe(5);
    });

    it('should use totalCount for truncation when provided', () => {
      const videos = Array.from({ length: 5 }, (_, i) => ({
        channel: 'Channel', title: `Video ${i}`
      }));

      const { groups, truncatedCount } = groupVideosByChannel(videos, 5, 175);

      expect(groups[0].titles).toHaveLength(5);
      expect(truncatedCount).toBe(170);
    });

    it('should report zero truncation when all videos fit', () => {
      const videos = [
        { channel: 'Tech', title: 'Video A' },
        { channel: 'Tech', title: 'Video B' }
      ];

      const { groups, truncatedCount } = groupVideosByChannel(videos);

      expect(groups[0].titles).toHaveLength(2);
      expect(truncatedCount).toBe(0);
    });

    it('should handle empty or null input', () => {
      expect(groupVideosByChannel([])).toEqual({ groups: [], truncatedCount: 0 });
      expect(groupVideosByChannel(null)).toEqual({ groups: [], truncatedCount: 0 });
      expect(groupVideosByChannel(undefined)).toEqual({ groups: [], truncatedCount: 0 });
    });

    it('should handle missing channel or title', () => {
      const videos = [
        { title: 'No Channel' },
        { channel: 'Has Channel' }
      ];

      const { groups } = groupVideosByChannel(videos);

      expect(groups[0]).toEqual({ channel: 'Unknown Channel', titles: ['No Channel'], count: 1 });
      expect(groups[1]).toEqual({ channel: 'Has Channel', titles: ['Unknown Title'], count: 1 });
    });
  });
});

describe('Plain Formatter - Auto-Removal', () => {
  const baseCleanupResult = {
    totalDeleted: 5,
    deletedByAge: 3,
    deletedBySpace: 2,
    freedBytes: 5368709120,
    plan: {
      ageStrategy: {
        thresholdDays: 30,
        sampleVideos: [
          { id: 1, title: 'Old Video 1', channel: 'Tech Channel' },
          { id: 2, title: 'Old Video 2', channel: 'Tech Channel' },
          { id: 3, title: 'Old Video 3', channel: 'Music Channel' }
        ]
      },
      spaceStrategy: {
        threshold: '50GB',
        sampleVideos: [
          { id: 4, title: 'Space Video 1', channel: 'Gaming Channel' },
          { id: 5, title: 'Space Video 2', channel: 'Gaming Channel' }
        ]
      }
    }
  };

  it('should format combined age and space removal', () => {
    const message = plainFormatter.formatAutoRemovalMessage(baseCleanupResult);

    expect(message.title).toBe('🗑️ 5 Videos Auto-Removed');
    expect(message.body).toContain('Freed 5.00 GB of storage');
    expect(message.body).toContain('Removed by age (exceeded 30-day limit): 3 videos');
    expect(message.body).toContain('Tech Channel (2 videos): Old Video 1, Old Video 2');
    expect(message.body).toContain('Music Channel (1 video): Old Video 3');
    expect(message.body).toContain('Removed for storage (below 50GB threshold): 2 videos');
    expect(message.body).toContain('Gaming Channel (2 videos): Space Video 1, Space Video 2');
  });

  it('should format age-only removal', () => {
    const ageOnly = {
      ...baseCleanupResult,
      deletedBySpace: 0,
      totalDeleted: 3,
      plan: {
        ...baseCleanupResult.plan,
        spaceStrategy: { threshold: null, sampleVideos: [] }
      }
    };

    const message = plainFormatter.formatAutoRemovalMessage(ageOnly);

    expect(message.body).toContain('Removed by age');
    expect(message.body).not.toContain('Removed for storage');
  });

  it('should format space-only removal', () => {
    const spaceOnly = {
      ...baseCleanupResult,
      deletedByAge: 0,
      totalDeleted: 2,
      plan: {
        ...baseCleanupResult.plan,
        ageStrategy: { thresholdDays: null, sampleVideos: [] }
      }
    };

    const message = plainFormatter.formatAutoRemovalMessage(spaceOnly);

    expect(message.body).not.toContain('Removed by age');
    expect(message.body).toContain('Removed for storage');
  });

  it('should use singular form for 1 video', () => {
    const singleVideo = {
      totalDeleted: 1,
      deletedByAge: 1,
      deletedBySpace: 0,
      freedBytes: 1073741824,
      plan: {
        ageStrategy: {
          thresholdDays: 30,
          sampleVideos: [{ id: 1, title: 'Only Video', channel: 'Channel' }]
        },
        spaceStrategy: { threshold: null, sampleVideos: [] }
      }
    };

    const message = plainFormatter.formatAutoRemovalMessage(singleVideo);

    expect(message.title).toBe('🗑️ 1 Video Auto-Removed');
    expect(message.body).toContain('1 video');
  });
});

describe('Discord Formatter - Auto-Removal', () => {
  const baseCleanupResult = {
    totalDeleted: 3,
    deletedByAge: 3,
    deletedBySpace: 0,
    freedBytes: 3221225472,
    plan: {
      ageStrategy: {
        thresholdDays: 30,
        sampleVideos: [
          { id: 1, title: 'Video 1', channel: 'Tech Channel' },
          { id: 2, title: 'Video 2', channel: 'Tech Channel' },
          { id: 3, title: 'Video 3', channel: 'Music Channel' }
        ]
      },
      spaceStrategy: { threshold: null, sampleVideos: [] }
    }
  };

  it('should return Discord embed format with orange color', () => {
    const message = discordFormatter.formatAutoRemovalMessage(baseCleanupResult);

    expect(message).toHaveProperty('embeds');
    expect(message.embeds).toHaveLength(1);
    expect(message.embeds[0].color).toBe(0xFFA500);
    expect(message.embeds[0].title).toContain('Auto-Removed');
    expect(message.embeds[0].description).toContain('3.00 GB');
    expect(message.embeds[0].timestamp).toBeDefined();
    expect(message.embeds[0].footer.text).toBe('Youtarr');
  });

  it('should include age strategy field with grouped channels', () => {
    const message = discordFormatter.formatAutoRemovalMessage(baseCleanupResult);

    expect(message.embeds[0].fields).toHaveLength(1);
    expect(message.embeds[0].fields[0].name).toContain('Removed by age');
    expect(message.embeds[0].fields[0].name).toContain('30-day');
    expect(message.embeds[0].fields[0].value).toContain('Tech Channel');
    expect(message.embeds[0].fields[0].value).toContain('Music Channel');
  });

  it('should include both strategy fields when both active', () => {
    const combined = {
      ...baseCleanupResult,
      deletedBySpace: 2,
      totalDeleted: 5,
      plan: {
        ...baseCleanupResult.plan,
        spaceStrategy: {
          threshold: '50GB',
          sampleVideos: [{ id: 4, title: 'Space Video', channel: 'Gaming' }]
        }
      }
    };

    const message = discordFormatter.formatAutoRemovalMessage(combined);

    expect(message.embeds[0].fields).toHaveLength(2);
    expect(message.embeds[0].fields[0].name).toContain('age');
    expect(message.embeds[0].fields[1].name).toContain('storage');
  });
});
