/* eslint-env jest */

// Mock configModule before requiring the module under test
jest.mock('../../configModule', () => ({
  getConfig: jest.fn(),
  directoryPath: '/mock/youtube/output',
  ffmpegPath: '/usr/bin/ffmpeg',
  getCookiesPath: jest.fn()
}));

const YtdlpCommandBuilder = require('../ytdlpCommandBuilder');
const configModule = require('../../configModule');

describe('YtdlpCommandBuilder', () => {
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock configuration
    mockConfig = {
      preferredResolution: '1080',
      downloadSocketTimeoutSeconds: 30,
      downloadThrottledRate: '100K',
      downloadRetryCount: 2,
      sponsorblockEnabled: false,
      sponsorblockCategories: {},
      sponsorblockAction: null,
      sponsorblockApiUrl: null
    };

    configModule.getConfig.mockReturnValue(mockConfig);
    configModule.getCookiesPath.mockReturnValue(null);
  });

  describe('buildSponsorblockArgs', () => {
    it('should return empty array when sponsorblock is disabled', () => {
      const config = { sponsorblockEnabled: false };
      const result = YtdlpCommandBuilder.buildSponsorblockArgs(config);
      expect(result).toEqual([]);
    });

    it('should return empty array when no categories are enabled', () => {
      const config = {
        sponsorblockEnabled: true,
        sponsorblockCategories: {
          sponsor: false,
          intro: false,
          outro: false
        }
      };
      const result = YtdlpCommandBuilder.buildSponsorblockArgs(config);
      expect(result).toEqual([]);
    });

    it('should build remove args when action is remove', () => {
      const config = {
        sponsorblockEnabled: true,
        sponsorblockCategories: {
          sponsor: true,
          intro: false,
          outro: true,
          selfpromo: true
        },
        sponsorblockAction: 'remove'
      };
      const result = YtdlpCommandBuilder.buildSponsorblockArgs(config);
      expect(result).toEqual(['--sponsorblock-remove', 'sponsor,outro,selfpromo']);
    });

    it('should build mark args when action is mark', () => {
      const config = {
        sponsorblockEnabled: true,
        sponsorblockCategories: {
          sponsor: true,
          intro: true
        },
        sponsorblockAction: 'mark'
      };
      const result = YtdlpCommandBuilder.buildSponsorblockArgs(config);
      expect(result).toEqual(['--sponsorblock-mark', 'sponsor,intro']);
    });

    it('should include custom API URL when specified', () => {
      const config = {
        sponsorblockEnabled: true,
        sponsorblockCategories: {
          sponsor: true
        },
        sponsorblockAction: 'remove',
        sponsorblockApiUrl: 'https://custom.sponsorblock.api/api'
      };
      const result = YtdlpCommandBuilder.buildSponsorblockArgs(config);
      expect(result).toEqual([
        '--sponsorblock-remove',
        'sponsor',
        '--sponsorblock-api',
        'https://custom.sponsorblock.api/api'
      ]);
    });

    it('should trim API URL whitespace', () => {
      const config = {
        sponsorblockEnabled: true,
        sponsorblockCategories: {
          sponsor: true
        },
        sponsorblockAction: 'mark',
        sponsorblockApiUrl: '  https://api.example.com  '
      };
      const result = YtdlpCommandBuilder.buildSponsorblockArgs(config);
      expect(result).toContain('--sponsorblock-api');
      expect(result).toContain('https://api.example.com');
    });

    it('should not include API URL if empty after trimming', () => {
      const config = {
        sponsorblockEnabled: true,
        sponsorblockCategories: {
          sponsor: true
        },
        sponsorblockAction: 'remove',
        sponsorblockApiUrl: '   '
      };
      const result = YtdlpCommandBuilder.buildSponsorblockArgs(config);
      expect(result).toEqual(['--sponsorblock-remove', 'sponsor']);
    });
  });

  describe('buildCookiesArgs', () => {
    it('should return empty array when no cookies path exists', () => {
      configModule.getCookiesPath.mockReturnValue(null);
      const result = YtdlpCommandBuilder.buildCookiesArgs();
      expect(result).toEqual([]);
    });

    it('should return cookies args when path exists', () => {
      configModule.getCookiesPath.mockReturnValue('/path/to/cookies.txt');
      const result = YtdlpCommandBuilder.buildCookiesArgs();
      expect(result).toEqual(['--cookies', '/path/to/cookies.txt']);
    });
  });

  describe('getBaseCommandArgs', () => {
    it('should build basic command args with default values', () => {
      const result = YtdlpCommandBuilder.getBaseCommandArgs();

      // Check basic structure
      expect(result).toContain('-4');
      expect(result).toContain('--ffmpeg-location');
      expect(result).toContain('/usr/bin/ffmpeg');
      expect(result).toContain('--socket-timeout');
      expect(result).toContain('30');
      expect(result).toContain('--throttled-rate');
      expect(result).toContain('100K');
      expect(result).toContain('--retries');
      expect(result).toContain('2');
      expect(result).toContain('--fragment-retries');
      expect(result).toContain('2');

      // Check progress template
      expect(result).toContain('--newline');
      expect(result).toContain('--progress');
      expect(result).toContain('--progress-template');

      // Check format selection for 1080p
      const formatIndex = result.indexOf('-f');
      expect(result[formatIndex + 1]).toMatch(/bestvideo\[height<=1080\]/);

      // Check metadata and thumbnail options
      expect(result).toContain('--write-thumbnail');
      expect(result).toContain('--convert-thumbnails');
      expect(result).toContain('jpg');
      expect(result).toContain('--embed-metadata');
      expect(result).toContain('--write-info-json');

      // Check filter for duration
      const filterIndex = result.indexOf('--match-filter');
      expect(result[filterIndex + 1]).toContain('availability!=subscriber_only');

      // Check output paths
      expect(result).toContain('-o');
      const outputPaths = result.filter((arg, i) => result[i - 1] === '-o');
      expect(outputPaths.length).toBe(3); // main output, thumbnail output, pl_thumbnail

      // Check exec post-processing
      expect(result).toContain('--exec');
      const execIndex = result.indexOf('--exec');
      expect(result[execIndex + 1]).toContain('videoDownloadPostProcessFiles.js');
    });

    it('should use custom resolution when provided', () => {
      const result = YtdlpCommandBuilder.getBaseCommandArgs('720');
      const formatIndex = result.indexOf('-f');
      expect(result[formatIndex + 1]).toMatch(/bestvideo\[height<=720\]/);
    });

    it('should use config resolution when not provided', () => {
      mockConfig.preferredResolution = '480';
      const result = YtdlpCommandBuilder.getBaseCommandArgs();
      const formatIndex = result.indexOf('-f');
      expect(result[formatIndex + 1]).toMatch(/bestvideo\[height<=480\]/);
    });

    it('should include cookies args when cookies are available', () => {
      configModule.getCookiesPath.mockReturnValue('/path/to/cookies.txt');
      const result = YtdlpCommandBuilder.getBaseCommandArgs();
      expect(result[0]).toBe('--cookies');
      expect(result[1]).toBe('/path/to/cookies.txt');
    });

    it('should include sponsorblock args when configured', () => {
      mockConfig.sponsorblockEnabled = true;
      mockConfig.sponsorblockCategories = { sponsor: true };
      mockConfig.sponsorblockAction = 'remove';

      const result = YtdlpCommandBuilder.getBaseCommandArgs();
      expect(result).toContain('--sponsorblock-remove');
      expect(result).toContain('sponsor');
    });

    it('should use correct output templates', () => {
      const result = YtdlpCommandBuilder.getBaseCommandArgs();

      // Find all -o arguments
      const outputIndices = result.reduce((acc, arg, i) => {
        if (arg === '-o') acc.push(i);
        return acc;
      }, []);

      expect(outputIndices.length).toBe(3);

      // Check main output template
      const mainOutput = result[outputIndices[0] + 1];
      expect(mainOutput).toContain('/mock/youtube/output');
      expect(mainOutput).toContain('%(uploader,channel,uploader_id)s');
      expect(mainOutput).toContain('%(title)s');
      expect(mainOutput).toContain('%(id)s');
      expect(mainOutput).toContain('%(ext)s');

      // Check thumbnail output template
      const thumbOutput = result[outputIndices[1] + 1];
      expect(thumbOutput).toContain('thumbnail:');
      expect(thumbOutput).toContain('/mock/youtube/output');
      expect(thumbOutput).toContain('/poster');

      // Check playlist thumbnail is disabled
      const plThumbOutput = result[outputIndices[2] + 1];
      expect(plThumbOutput).toBe('pl_thumbnail:');
    });

    it('should include uploader_id cleanup', () => {
      const result = YtdlpCommandBuilder.getBaseCommandArgs();
      expect(result).toContain('--replace-in-metadata');

      const replaceIndex = result.indexOf('--replace-in-metadata');
      expect(result[replaceIndex + 1]).toBe('uploader_id');
      expect(result[replaceIndex + 2]).toBe('^@');
      expect(result[replaceIndex + 3]).toBe('');
    });

    it('should use config values for timeouts and retries', () => {
      mockConfig.downloadSocketTimeoutSeconds = 60;
      mockConfig.downloadRetryCount = 5;
      mockConfig.downloadThrottledRate = '200K';

      const result = YtdlpCommandBuilder.getBaseCommandArgs();

      expect(result).toContain('--socket-timeout');
      expect(result).toContain('60');
      expect(result).toContain('--throttled-rate');
      expect(result).toContain('200K');
      expect(result).toContain('--retries');
      expect(result).toContain('5');
      expect(result).toContain('--fragment-retries');
      expect(result).toContain('5');
    });
  });

  describe('getBaseCommandArgsForManualDownload', () => {
    it('should build command args without duration filter', () => {
      const result = YtdlpCommandBuilder.getBaseCommandArgsForManualDownload();

      // Check that duration filter is NOT included
      const filterIndex = result.indexOf('--match-filter');
      expect(result[filterIndex + 1]).toBe('availability!=subscriber_only');
    });

    it('should otherwise be identical to regular command args', () => {
      const regularArgs = YtdlpCommandBuilder.getBaseCommandArgs();
      const manualArgs = YtdlpCommandBuilder.getBaseCommandArgsForManualDownload();

      // Remove match-filter arguments for comparison
      const regularFiltered = regularArgs.filter((arg, i) =>
        arg !== '--match-filter' && regularArgs[i - 1] !== '--match-filter'
      );
      const manualFiltered = manualArgs.filter((arg, i) =>
        arg !== '--match-filter' && manualArgs[i - 1] !== '--match-filter'
      );

      expect(regularFiltered).toEqual(manualFiltered);
    });

    it('should use custom resolution when provided', () => {
      const result = YtdlpCommandBuilder.getBaseCommandArgsForManualDownload('2160');
      const formatIndex = result.indexOf('-f');
      expect(result[formatIndex + 1]).toMatch(/bestvideo\[height<=2160\]/);
    });

    it('should include cookies args when available', () => {
      configModule.getCookiesPath.mockReturnValue('/cookies/file.txt');
      const result = YtdlpCommandBuilder.getBaseCommandArgsForManualDownload();
      expect(result[0]).toBe('--cookies');
      expect(result[1]).toBe('/cookies/file.txt');
    });

    it('should include sponsorblock args when configured', () => {
      mockConfig.sponsorblockEnabled = true;
      mockConfig.sponsorblockCategories = {
        sponsor: true,
        selfpromo: true
      };
      mockConfig.sponsorblockAction = 'mark';
      mockConfig.sponsorblockApiUrl = 'https://api.example.com';

      const result = YtdlpCommandBuilder.getBaseCommandArgsForManualDownload();
      expect(result).toContain('--sponsorblock-mark');
      expect(result).toContain('sponsor,selfpromo');
      expect(result).toContain('--sponsorblock-api');
      expect(result).toContain('https://api.example.com');
    });

    it('should handle all same configuration options as regular download', () => {
      mockConfig.downloadSocketTimeoutSeconds = 45;
      mockConfig.downloadRetryCount = 3;
      mockConfig.downloadThrottledRate = '150K';
      mockConfig.preferredResolution = '360';

      const result = YtdlpCommandBuilder.getBaseCommandArgsForManualDownload();

      expect(result).toContain('--socket-timeout');
      expect(result).toContain('45');
      expect(result).toContain('--throttled-rate');
      expect(result).toContain('150K');
      expect(result).toContain('--retries');
      expect(result).toContain('3');
      expect(result).toContain('--fragment-retries');
      expect(result).toContain('3');

      const formatIndex = result.indexOf('-f');
      expect(result[formatIndex + 1]).toMatch(/bestvideo\[height<=360\]/);
    });
  });

  describe('Template Constants', () => {
    it('should generate consistent file and folder names', () => {
      const result = YtdlpCommandBuilder.getBaseCommandArgs();

      // Find the main output template
      const outputIndex = result.indexOf('-o');
      const mainOutput = result[outputIndex + 1];

      // Check that output contains the expected template patterns
      expect(mainOutput).toContain('/mock/youtube/output');
      expect(mainOutput).toContain('%(uploader,channel,uploader_id)s');

      // Folder should have channel - title - id format
      expect(mainOutput).toContain('%(uploader,channel,uploader_id)s - %(title)s - %(id)s');

      // File should have channel - title [id].ext format
      expect(mainOutput).toContain('%(uploader,channel,uploader_id)s - %(title)s  [%(id)s].%(ext)s');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing config values with defaults', () => {
      mockConfig = {};
      configModule.getConfig.mockReturnValue(mockConfig);

      const result = YtdlpCommandBuilder.getBaseCommandArgs();

      // Should use default values
      expect(result).toContain('30'); // default socket timeout
      expect(result).toContain('100K'); // default throttled rate
      expect(result).toContain('2'); // default retry count

      // Should default to 1080p resolution
      const formatIndex = result.indexOf('-f');
      expect(result[formatIndex + 1]).toMatch(/bestvideo\[height<=1080\]/);
    });

    it('should handle null config gracefully', () => {
      configModule.getConfig.mockReturnValue({});

      // Should not throw and use defaults
      expect(() => YtdlpCommandBuilder.getBaseCommandArgs()).not.toThrow();

      const result = YtdlpCommandBuilder.getBaseCommandArgs();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Should use default resolution of 1080
      const formatIndex = result.indexOf('-f');
      expect(result[formatIndex + 1]).toMatch(/bestvideo\[height<=1080\]/);
    });

    it('should convert numeric config values to strings', () => {
      mockConfig.downloadSocketTimeoutSeconds = 45;
      mockConfig.downloadRetryCount = 3;

      const result = YtdlpCommandBuilder.getBaseCommandArgs();

      // All args should be strings
      result.forEach(arg => {
        expect(typeof arg).toBe('string');
      });

      expect(result).toContain('45');
      expect(result).toContain('3');
    });
  });
});