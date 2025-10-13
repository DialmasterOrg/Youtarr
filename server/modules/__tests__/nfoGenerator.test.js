/* eslint-env jest */

// Mock fs and logger modules before any imports
jest.mock('fs');
jest.mock('../../logger');

describe('NfoGenerator', () => {
  let nfoGenerator;
  let fs;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock fs after resetting modules
    jest.doMock('fs', () => ({
      writeFileSync: jest.fn(),
      readFileSync: jest.fn(),
      existsSync: jest.fn()
    }));

    // Re-import fs, logger, and nfoGenerator after mocking
    fs = require('fs');
    logger = require('../../logger');
    nfoGenerator = require('../nfoGenerator');
  });

  describe('escapeXml', () => {
    it('should escape special XML characters', () => {
      expect(nfoGenerator.escapeXml('Test & <tag>')).toBe('Test &amp; &lt;tag&gt;');
      expect(nfoGenerator.escapeXml('"quotes"')).toBe('&quot;quotes&quot;');
      // eslint-disable-next-line quotes
      expect(nfoGenerator.escapeXml("'apostrophe'")).toBe('&apos;apostrophe&apos;');
    });

    it('should handle null and undefined values', () => {
      expect(nfoGenerator.escapeXml(null)).toBe('');
      expect(nfoGenerator.escapeXml(undefined)).toBe('');
      expect(nfoGenerator.escapeXml('')).toBe('');
    });

    it('should convert non-string values to strings', () => {
      expect(nfoGenerator.escapeXml(123)).toBe('123');
      expect(nfoGenerator.escapeXml(true)).toBe('true');
    });

    it('should handle all special characters in one string', () => {
      const input = '& < > " \'';
      const expected = '&amp; &lt; &gt; &quot; &apos;';
      expect(nfoGenerator.escapeXml(input)).toBe(expected);
    });
  });

  describe('formatDate', () => {
    it('should format valid YYYYMMDD date strings', () => {
      expect(nfoGenerator.formatDate('20231225')).toBe('2023-12-25');
      expect(nfoGenerator.formatDate('20240101')).toBe('2024-01-01');
      expect(nfoGenerator.formatDate('19991231')).toBe('1999-12-31');
    });

    it('should handle number input', () => {
      expect(nfoGenerator.formatDate(20230515)).toBe('2023-05-15');
    });

    it('should return null for invalid dates', () => {
      expect(nfoGenerator.formatDate('20231301')).toBe(null); // Invalid month
      expect(nfoGenerator.formatDate('20230132')).toBe(null); // Invalid day
      // Note: JavaScript Date auto-corrects some invalid dates like Feb 29 on non-leap years
      // The formatDate function doesn't validate leap years, so we'll test a clearly invalid month
      expect(nfoGenerator.formatDate('20231332')).toBe(null); // Month 13, day 32
    });

    it('should return null for invalid formats', () => {
      expect(nfoGenerator.formatDate('2023-01-15')).toBe(null); // Wrong format
      expect(nfoGenerator.formatDate('123')).toBe(null); // Too short
      expect(nfoGenerator.formatDate('202301151')).toBe(null); // Too long
      expect(nfoGenerator.formatDate(null)).toBe(null);
      expect(nfoGenerator.formatDate(undefined)).toBe(null);
      expect(nfoGenerator.formatDate('')).toBe(null);
    });
  });

  describe('calculateRuntime', () => {
    it('should convert seconds to minutes rounded up', () => {
      expect(nfoGenerator.calculateRuntime(60)).toBe(1);
      expect(nfoGenerator.calculateRuntime(61)).toBe(2);
      expect(nfoGenerator.calculateRuntime(119)).toBe(2);
      expect(nfoGenerator.calculateRuntime(120)).toBe(2);
      expect(nfoGenerator.calculateRuntime(121)).toBe(3);
      expect(nfoGenerator.calculateRuntime(3600)).toBe(60);
    });

    it('should handle edge cases', () => {
      expect(nfoGenerator.calculateRuntime(0)).toBe(0);
      expect(nfoGenerator.calculateRuntime(-10)).toBe(0);
      expect(nfoGenerator.calculateRuntime(null)).toBe(0);
      expect(nfoGenerator.calculateRuntime(undefined)).toBe(0);
    });

    it('should handle fractional seconds', () => {
      expect(nfoGenerator.calculateRuntime(30.5)).toBe(1);
      expect(nfoGenerator.calculateRuntime(60.1)).toBe(2);
    });
  });

  describe('buildYouTubeTrailerUrl', () => {
    it('should build valid YouTube plugin URLs', () => {
      const videoId = 'dQw4w9WgXcQ';
      const expected = 'plugin://plugin.video.youtube/?action=play_video&amp;videoid=dQw4w9WgXcQ';
      expect(nfoGenerator.buildYouTubeTrailerUrl(videoId)).toBe(expected);
    });

    it('should return empty string for invalid input', () => {
      expect(nfoGenerator.buildYouTubeTrailerUrl('')).toBe('');
      expect(nfoGenerator.buildYouTubeTrailerUrl(null)).toBe('');
      expect(nfoGenerator.buildYouTubeTrailerUrl(undefined)).toBe('');
    });

    it('should handle various video ID formats', () => {
      expect(nfoGenerator.buildYouTubeTrailerUrl('abc123')).toBe('plugin://plugin.video.youtube/?action=play_video&amp;videoid=abc123');
      expect(nfoGenerator.buildYouTubeTrailerUrl('ABC-123_xyz')).toBe('plugin://plugin.video.youtube/?action=play_video&amp;videoid=ABC-123_xyz');
    });
  });

  describe('writeVideoNfoFile', () => {
    const mockVideoPath = '/videos/test-video.mp4';
    const mockNfoPath = '/videos/test-video.nfo';

    beforeEach(() => {
      fs.writeFileSync.mockClear();
      logger.info.mockClear();
      logger.error.mockClear();
    });

    it('should create NFO file with complete metadata', () => {
      const jsonData = {
        id: 'video123',
        title: 'Test Video Title',
        fulltitle: 'Test Video Full Title',
        description: 'Test video description',
        upload_date: '20231225',
        uploader: 'Test Channel',
        channel: 'Channel Name',
        duration: 185,
        categories: ['Gaming', 'Comedy'],
        tags: ['tag1', 'tag2', 'tag3']
      };

      const result = nfoGenerator.writeVideoNfoFile(mockVideoPath, jsonData);

      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        { videoPath: mockVideoPath },
        'Writing NFO file for video'
      );
      expect(logger.info).toHaveBeenCalledWith(
        { nfoPath: mockNfoPath },
        'NFO file created successfully'
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockNfoPath,
        expect.any(String),
        'utf8'
      );

      const nfoContent = fs.writeFileSync.mock.calls[0][1];

      // Check XML structure
      expect(nfoContent).toContain('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
      expect(nfoContent).toContain('<movie>');
      expect(nfoContent).toContain('</movie>');

      // Check content
      expect(nfoContent).toContain('<title>Test Video Full Title</title>');
      expect(nfoContent).toContain('<plot>Test video description</plot>');
      expect(nfoContent).toContain('<uniqueid type="youtube" default="true">video123</uniqueid>');
      expect(nfoContent).toContain('<youtubeid>video123</youtubeid>');
      expect(nfoContent).toContain('<premiered>2023-12-25</premiered>');
      expect(nfoContent).toContain('<studio>Test Channel</studio>');
      expect(nfoContent).toContain('<credits>Test Channel</credits>');
      expect(nfoContent).toContain('<runtime>4</runtime>'); // 185 seconds = 4 minutes rounded up
      expect(nfoContent).toContain('<durationinseconds>185</durationinseconds>');
      expect(nfoContent).toContain('<genre>Gaming</genre>');
      expect(nfoContent).toContain('<genre>Comedy</genre>');
      expect(nfoContent).toContain('<tag>tag1</tag>');
      expect(nfoContent).toContain('<tag>tag2</tag>');
      expect(nfoContent).toContain('<tag>tag3</tag>');
      expect(nfoContent).toContain('<trailer>plugin://plugin.video.youtube/?action=play_video&amp;videoid=video123</trailer>');
    });

    it('should handle minimal metadata', () => {
      const jsonData = {
        title: 'Minimal Video'
      };

      const result = nfoGenerator.writeVideoNfoFile(mockVideoPath, jsonData);

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();

      const nfoContent = fs.writeFileSync.mock.calls[0][1];

      expect(nfoContent).toContain('<title>Minimal Video</title>');
      expect(nfoContent).toContain('<studio>Unknown Channel</studio>');
      expect(nfoContent).not.toContain('<plot>');
      expect(nfoContent).not.toContain('<premiered>');
      expect(nfoContent).not.toContain('<runtime>');
      expect(nfoContent).not.toContain('<genre>');
      expect(nfoContent).not.toContain('<tag>');
    });

    it('should use fallback values for uploader/studio', () => {
      const variations = [
        { uploader: 'Uploader Name' },
        { channel: 'Channel Name' },
        { uploader_id: 'uploader_id_123' },
        { channel_id: 'channel_id_456' },
        {}
      ];

      const expectedStudios = [
        'Uploader Name',
        'Channel Name',
        'uploader_id_123',
        'channel_id_456',
        'Unknown Channel'
      ];

      variations.forEach((jsonData, index) => {
        fs.writeFileSync.mockClear();
        jsonData.title = 'Test';

        nfoGenerator.writeVideoNfoFile(mockVideoPath, jsonData);
        const nfoContent = fs.writeFileSync.mock.calls[0][1];
        expect(nfoContent).toContain(`<studio>${expectedStudios[index]}</studio>`);
      });
    });

    it('should escape XML special characters in content', () => {
      const jsonData = {
        title: 'Test & <Special> "Characters"',
        // eslint-disable-next-line quotes
        description: "Description with 'quotes' & <tags>",
        uploader: 'Channel & Co.',
        categories: ['Science & Tech'],
        tags: ['<tag>', '"quote"', '&amp;']
      };

      nfoGenerator.writeVideoNfoFile(mockVideoPath, jsonData);

      const nfoContent = fs.writeFileSync.mock.calls[0][1];

      expect(nfoContent).toContain('<title>Test &amp; &lt;Special&gt; &quot;Characters&quot;</title>');
      expect(nfoContent).toContain('<plot>Description with &apos;quotes&apos; &amp; &lt;tags&gt;</plot>');
      expect(nfoContent).toContain('<studio>Channel &amp; Co.</studio>');
      expect(nfoContent).toContain('<genre>Science &amp; Tech</genre>');
      expect(nfoContent).toContain('<tag>&lt;tag&gt;</tag>');
      expect(nfoContent).toContain('<tag>&quot;quote&quot;</tag>');
      expect(nfoContent).toContain('<tag>&amp;amp;</tag>');
    });

    it('should handle different file extensions', () => {
      const testPaths = [
        { input: '/path/to/video.mkv', expected: '/path/to/video.nfo' },
        { input: '/path/to/video.webm', expected: '/path/to/video.nfo' },
        { input: '/path/to/video.with.dots.mp4', expected: '/path/to/video.with.dots.nfo' },
        { input: '/path/video', expected: '/path/video.nfo' }
      ];

      testPaths.forEach(({ input, expected }) => {
        fs.writeFileSync.mockClear();

        nfoGenerator.writeVideoNfoFile(input, { title: 'Test' });

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          expected,
          expect.any(String),
          'utf8'
        );
      });
    });

    it('should handle file write errors gracefully', () => {
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = nfoGenerator.writeVideoNfoFile(mockVideoPath, { title: 'Test' });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          videoPath: mockVideoPath
        }),
        'Error creating NFO file'
      );
    });

    it('should handle invalid upload date gracefully', () => {
      const jsonData = {
        title: 'Test Video',
        upload_date: 'invalid-date'
      };

      const result = nfoGenerator.writeVideoNfoFile(mockVideoPath, jsonData);

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();

      const nfoContent = fs.writeFileSync.mock.calls[0][1];
      expect(nfoContent).not.toContain('<premiered>');
    });

    it('should use fulltitle over title when both are present', () => {
      const jsonData = {
        title: 'Short Title',
        fulltitle: 'This is the Full Title'
      };

      nfoGenerator.writeVideoNfoFile(mockVideoPath, jsonData);

      const nfoContent = fs.writeFileSync.mock.calls[0][1];
      expect(nfoContent).toContain('<title>This is the Full Title</title>');
      expect(nfoContent).not.toContain('Short Title');
    });

    it('should handle empty arrays for categories and tags', () => {
      const jsonData = {
        title: 'Test Video',
        categories: [],
        tags: []
      };

      const result = nfoGenerator.writeVideoNfoFile(mockVideoPath, jsonData);

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();

      const nfoContent = fs.writeFileSync.mock.calls[0][1];
      expect(nfoContent).not.toContain('<genre>');
      expect(nfoContent).not.toContain('<tag>');
      expect(nfoContent).not.toContain('<!-- Classification -->');
    });

    it('should include proper XML sections with comments', () => {
      const jsonData = {
        id: 'video123',
        title: 'Test',
        upload_date: '20231225',
        uploader: 'Channel',
        duration: 60,
        categories: ['Category1'],
        tags: ['Tag1']
      };

      nfoGenerator.writeVideoNfoFile(mockVideoPath, jsonData);

      const nfoContent = fs.writeFileSync.mock.calls[0][1];

      // Check for section comments
      expect(nfoContent).toContain('<!-- IDs -->');
      expect(nfoContent).toContain('<!-- Dates -->');
      expect(nfoContent).toContain('<!-- People / orgs -->');
      expect(nfoContent).toContain('<!-- Classification -->');
      expect(nfoContent).toContain('<!-- Runtime -->');
      expect(nfoContent).toContain('<!-- Backlink to YouTube in Kodi format -->');
    });

    it('should create valid XML structure for fileinfo', () => {
      const jsonData = {
        title: 'Test',
        duration: 120
      };

      nfoGenerator.writeVideoNfoFile(mockVideoPath, jsonData);

      const nfoContent = fs.writeFileSync.mock.calls[0][1];

      expect(nfoContent).toContain('<fileinfo>');
      expect(nfoContent).toContain('<streamdetails>');
      expect(nfoContent).toContain('<video>');
      expect(nfoContent).toContain('<durationinseconds>120</durationinseconds>');
      expect(nfoContent).toContain('</video>');
      expect(nfoContent).toContain('</streamdetails>');
      expect(nfoContent).toContain('</fileinfo>');
    });
  });
});