/* eslint-env jest */
const path = require('path');

jest.mock('fs');

describe('ArchiveModule', () => {
  let ArchiveModule;
  let fs;
  let consoleErrorSpy;

  const mockArchivePath = path.join(__dirname, '../../../config', 'complete.list');
  const mockArchiveContent = `youtube video1
youtube video2
youtube video3
youtube video4
youtube video5`;

  const mockArchiveContentWithEmptyLines = `youtube video1

youtube video2

youtube video3
`;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    fs = require('fs');
    fs.readFileSync = jest.fn();

    ArchiveModule = require('../archiveModule');
  });

  describe('getArchivePath', () => {
    test('should return the correct path to complete.list', () => {
      const archivePath = ArchiveModule.getArchivePath();

      expect(archivePath).toBe(mockArchivePath);
      expect(archivePath).toContain('config');
      expect(archivePath).toContain('complete.list');
    });

    test('should return an absolute path', () => {
      const archivePath = ArchiveModule.getArchivePath();

      expect(path.isAbsolute(archivePath)).toBe(true);
    });
  });

  describe('readCompleteListLines', () => {
    test('should read and parse complete.list file correctly', () => {
      fs.readFileSync.mockReturnValue(mockArchiveContent);

      const lines = ArchiveModule.readCompleteListLines();

      expect(fs.readFileSync).toHaveBeenCalledWith(mockArchivePath, 'utf-8');
      expect(lines).toEqual([
        'youtube video1',
        'youtube video2',
        'youtube video3',
        'youtube video4',
        'youtube video5'
      ]);
    });

    test('should handle empty lines and trim whitespace', () => {
      fs.readFileSync.mockReturnValue(mockArchiveContentWithEmptyLines);

      const lines = ArchiveModule.readCompleteListLines();

      expect(lines).toEqual([
        'youtube video1',
        'youtube video2',
        'youtube video3'
      ]);
    });

    test('should handle Windows line endings (\\r\\n)', () => {
      const windowsContent = 'youtube video1\r\nyoutube video2\r\nyoutube video3';
      fs.readFileSync.mockReturnValue(windowsContent);

      const lines = ArchiveModule.readCompleteListLines();

      expect(lines).toEqual([
        'youtube video1',
        'youtube video2',
        'youtube video3'
      ]);
    });

    test('should handle Unix line endings (\\n)', () => {
      const unixContent = 'youtube video1\nyoutube video2\nyoutube video3';
      fs.readFileSync.mockReturnValue(unixContent);

      const lines = ArchiveModule.readCompleteListLines();

      expect(lines).toEqual([
        'youtube video1',
        'youtube video2',
        'youtube video3'
      ]);
    });

    test('should return empty array when file does not exist', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFileSync.mockImplementation(() => {
        throw error;
      });

      const lines = ArchiveModule.readCompleteListLines();

      expect(lines).toEqual([]);
    });

    test('should throw other errors that are not ENOENT', () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.readFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => ArchiveModule.readCompleteListLines()).toThrow('Permission denied');
    });

    test('should throw errors without code property', () => {
      const error = new Error('Generic error');
      fs.readFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => ArchiveModule.readCompleteListLines()).toThrow('Generic error');
    });

    test('should return empty array for empty file', () => {
      fs.readFileSync.mockReturnValue('');

      const lines = ArchiveModule.readCompleteListLines();

      expect(lines).toEqual([]);
    });

    test('should handle file with only whitespace', () => {
      fs.readFileSync.mockReturnValue('   \n  \t  \n   ');

      const lines = ArchiveModule.readCompleteListLines();

      expect(lines).toEqual([]);
    });
  });

  describe('getNewVideoUrlsSince', () => {
    beforeEach(() => {
      fs.readFileSync.mockReturnValue(mockArchiveContent);
    });

    test('should return URLs for videos added after initialCount', () => {
      const urls = ArchiveModule.getNewVideoUrlsSince(2);

      expect(urls).toEqual([
        'https://youtu.be/video3',
        'https://youtu.be/video4',
        'https://youtu.be/video5'
      ]);
    });

    test('should return all URLs when initialCount is 0', () => {
      const urls = ArchiveModule.getNewVideoUrlsSince(0);

      expect(urls).toEqual([
        'https://youtu.be/video1',
        'https://youtu.be/video2',
        'https://youtu.be/video3',
        'https://youtu.be/video4',
        'https://youtu.be/video5'
      ]);
    });

    test('should return empty array when initialCount equals total lines', () => {
      const urls = ArchiveModule.getNewVideoUrlsSince(5);

      expect(urls).toEqual([]);
    });

    test('should return empty array when initialCount exceeds total lines', () => {
      const urls = ArchiveModule.getNewVideoUrlsSince(10);

      expect(urls).toEqual([]);
    });

    test('should handle negative initialCount as 0', () => {
      const urls = ArchiveModule.getNewVideoUrlsSince(-5);

      expect(urls).toEqual([
        'https://youtu.be/video1',
        'https://youtu.be/video2',
        'https://youtu.be/video3',
        'https://youtu.be/video4',
        'https://youtu.be/video5'
      ]);
    });

    test('should extract video ID correctly from different formats', () => {
      const mixedContent = `youtube videoId123
youtube another-video_456
youtube Video.With-Special_Chars789`;
      fs.readFileSync.mockReturnValue(mixedContent);

      const urls = ArchiveModule.getNewVideoUrlsSince(0);

      expect(urls).toEqual([
        'https://youtu.be/videoId123',
        'https://youtu.be/another-video_456',
        'https://youtu.be/Video.With-Special_Chars789'
      ]);
    });

    test('should handle lines with extra spaces', () => {
      const contentWithSpaces = `youtube   video1
youtube video2
  youtube video3`;
      fs.readFileSync.mockReturnValue(contentWithSpaces);

      const urls = ArchiveModule.getNewVideoUrlsSince(0);

      expect(urls).toEqual([
        'https://youtu.be/video1',
        'https://youtu.be/video2',
        'https://youtu.be/video3'
      ]);
    });

    test('should return empty array when file does not exist', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFileSync.mockImplementation(() => {
        throw error;
      });

      const urls = ArchiveModule.getNewVideoUrlsSince(0);

      expect(urls).toEqual([]);
    });

    test('should propagate non-ENOENT errors', () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.readFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => ArchiveModule.getNewVideoUrlsSince(0)).toThrow('Permission denied');
    });
  });

  describe('integration scenarios', () => {
    test('should handle a typical download archive workflow', () => {
      // Initial state - no archive file
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFileSync.mockImplementationOnce(() => {
        throw error;
      });

      const initialCount = ArchiveModule.readCompleteListLines().length;
      expect(initialCount).toBe(0);

      // After some downloads
      fs.readFileSync.mockReturnValue('youtube video1\nyoutube video2');

      const lines = ArchiveModule.readCompleteListLines();
      expect(lines.length).toBe(2);

      const newUrls = ArchiveModule.getNewVideoUrlsSince(initialCount);
      expect(newUrls).toEqual([
        'https://youtu.be/video1',
        'https://youtu.be/video2'
      ]);
    });

    test('should correctly identify new videos after archive grows', () => {
      // First read - 3 videos
      fs.readFileSync.mockReturnValueOnce('youtube v1\nyoutube v2\nyoutube v3');
      const initialCount = ArchiveModule.readCompleteListLines().length;
      expect(initialCount).toBe(3);

      // Second read - 5 videos (2 new)
      fs.readFileSync.mockReturnValue('youtube v1\nyoutube v2\nyoutube v3\nyoutube v4\nyoutube v5');

      const newUrls = ArchiveModule.getNewVideoUrlsSince(initialCount);
      expect(newUrls).toEqual([
        'https://youtu.be/v4',
        'https://youtu.be/v5'
      ]);
    });
  });
});