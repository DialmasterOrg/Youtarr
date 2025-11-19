/* eslint-env jest */
const path = require('path');

jest.mock('fs');
jest.mock('../../logger');

describe('ArchiveModule', () => {
  let ArchiveModule;
  let fs;
  let logger;

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

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    fs = require('fs');
    fs.readFileSync = jest.fn();
    fs.appendFileSync = jest.fn();
    fs.writeFileSync = jest.fn();

    logger = require('../../logger');

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

  describe('isVideoInArchive', () => {
    test('should return true when video exists in archive', async () => {
      fs.readFileSync.mockReturnValue(mockArchiveContent);

      const result = await ArchiveModule.isVideoInArchive('video2');

      expect(result).toBe(true);
    });

    test('should return false when video does not exist in archive', async () => {
      fs.readFileSync.mockReturnValue(mockArchiveContent);

      const result = await ArchiveModule.isVideoInArchive('video999');

      expect(result).toBe(false);
    });

    test('should return false when archive is empty', async () => {
      fs.readFileSync.mockReturnValue('');

      const result = await ArchiveModule.isVideoInArchive('video1');

      expect(result).toBe(false);
    });

    test('should return false when archive file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFileSync.mockImplementation(() => {
        throw error;
      });

      const result = await ArchiveModule.isVideoInArchive('video1');

      expect(result).toBe(false);
    });

    test('should handle lines with extra spaces correctly', async () => {
      const contentWithSpaces = 'youtube   video1\nyoutube video2\n  youtube video3';
      fs.readFileSync.mockReturnValue(contentWithSpaces);

      const result1 = await ArchiveModule.isVideoInArchive('video1');
      const result2 = await ArchiveModule.isVideoInArchive('video3');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    test('should match exact video ID only', async () => {
      fs.readFileSync.mockReturnValue('youtube video123');

      const exactMatch = await ArchiveModule.isVideoInArchive('video123');
      const partialMatch = await ArchiveModule.isVideoInArchive('video12');
      const superMatch = await ArchiveModule.isVideoInArchive('video1234');

      expect(exactMatch).toBe(true);
      expect(partialMatch).toBe(false);
      expect(superMatch).toBe(false);
    });

    test('should only match lines starting with "youtube"', async () => {
      const mixedContent = 'youtube video1\nvimeo video2\nyoutube video3';
      fs.readFileSync.mockReturnValue(mixedContent);

      const result1 = await ArchiveModule.isVideoInArchive('video1');
      const result2 = await ArchiveModule.isVideoInArchive('video2');
      const result3 = await ArchiveModule.isVideoInArchive('video3');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(true);
    });
  });

  describe('addVideoToArchive', () => {
    test('should add video to archive successfully', async () => {
      fs.readFileSync.mockReturnValue('youtube video1');

      const result = await ArchiveModule.addVideoToArchive('video2');

      expect(result).toBe(true);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube video2\n'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { videoId: 'video2' },
        'Added video to archive'
      );
    });

    test('should return false when videoId is empty', async () => {
      const result = await ArchiveModule.addVideoToArchive('');

      expect(result).toBe(false);
      expect(fs.appendFileSync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'addVideoToArchive called with empty videoId, skipping'
      );
    });

    test('should return false when videoId is null', async () => {
      const result = await ArchiveModule.addVideoToArchive(null);

      expect(result).toBe(false);
      expect(fs.appendFileSync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'addVideoToArchive called with empty videoId, skipping'
      );
    });

    test('should return false when videoId is undefined', async () => {
      const result = await ArchiveModule.addVideoToArchive(undefined);

      expect(result).toBe(false);
      expect(fs.appendFileSync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'addVideoToArchive called with empty videoId, skipping'
      );
    });

    test('should return false when video already exists in archive', async () => {
      fs.readFileSync.mockReturnValue('youtube video1\nyoutube video2');

      const result = await ArchiveModule.addVideoToArchive('video2');

      expect(result).toBe(false);
      expect(fs.appendFileSync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        { videoId: 'video2' },
        'Video already in archive, skipping'
      );
    });

    test('should handle file write errors gracefully', async () => {
      fs.readFileSync.mockReturnValue('youtube video1');
      const writeError = new Error('Permission denied');
      writeError.code = 'EACCES';
      fs.appendFileSync.mockImplementation(() => {
        throw writeError;
      });

      const result = await ArchiveModule.addVideoToArchive('video2');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        { videoId: 'video2', err: 'Permission denied' },
        'Failed to add video to archive'
      );
    });

    test('should create archive file if it does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFileSync.mockImplementation(() => {
        throw error;
      });

      const result = await ArchiveModule.addVideoToArchive('video1');

      expect(result).toBe(true);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube video1\n'
      );
    });

    test('should add video with special characters in ID', async () => {
      fs.readFileSync.mockReturnValue('');

      const result = await ArchiveModule.addVideoToArchive('Video-With_Special.Chars123');

      expect(result).toBe(true);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube Video-With_Special.Chars123\n'
      );
    });

    test('should handle concurrent additions correctly', async () => {
      // First check: video doesn't exist
      fs.readFileSync.mockReturnValueOnce('youtube video1');
      // Append succeeds
      fs.appendFileSync.mockImplementation(() => {});

      const result1 = await ArchiveModule.addVideoToArchive('video2');

      // Second check: now video2 exists
      fs.readFileSync.mockReturnValue('youtube video1\nyoutube video2');

      const result2 = await ArchiveModule.addVideoToArchive('video2');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(fs.appendFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeVideoFromArchive', () => {
    test('should remove video from archive successfully', async () => {
      fs.readFileSync.mockReturnValue('youtube video1\nyoutube video2\nyoutube video3');

      const result = await ArchiveModule.removeVideoFromArchive('video2');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube video1\nyoutube video3\n',
        'utf-8'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { videoId: 'video2' },
        'Removed video from archive'
      );
    });

    test('should return false when videoId is empty', async () => {
      const result = await ArchiveModule.removeVideoFromArchive('');

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'removeVideoFromArchive called with empty videoId, skipping'
      );
    });

    test('should return false when videoId is null', async () => {
      const result = await ArchiveModule.removeVideoFromArchive(null);

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'removeVideoFromArchive called with empty videoId, skipping'
      );
    });

    test('should return false when videoId is undefined', async () => {
      const result = await ArchiveModule.removeVideoFromArchive(undefined);

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'removeVideoFromArchive called with empty videoId, skipping'
      );
    });

    test('should return false when video does not exist in archive', async () => {
      fs.readFileSync.mockReturnValue('youtube video1\nyoutube video2');

      const result = await ArchiveModule.removeVideoFromArchive('video999');

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        { videoId: 'video999' },
        'Video not in archive, nothing to remove'
      );
    });

    test('should return false when archive is empty', async () => {
      fs.readFileSync.mockReturnValue('');

      const result = await ArchiveModule.removeVideoFromArchive('video1');

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        { videoId: 'video1' },
        'Video not in archive, nothing to remove'
      );
    });

    test('should return false when archive file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFileSync.mockImplementation(() => {
        throw error;
      });

      const result = await ArchiveModule.removeVideoFromArchive('video1');

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    test('should handle file write errors gracefully', async () => {
      fs.readFileSync.mockReturnValue('youtube video1\nyoutube video2');
      const writeError = new Error('Permission denied');
      writeError.code = 'EACCES';
      fs.writeFileSync.mockImplementation(() => {
        throw writeError;
      });

      const result = await ArchiveModule.removeVideoFromArchive('video2');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        { videoId: 'video2', err: 'Permission denied' },
        'Failed to remove video from archive'
      );
    });

    test('should remove video with special characters in ID', async () => {
      fs.readFileSync.mockReturnValue('youtube video1\nyoutube Video-With_Special.Chars123\nyoutube video3');

      const result = await ArchiveModule.removeVideoFromArchive('Video-With_Special.Chars123');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube video1\nyoutube video3\n',
        'utf-8'
      );
    });

    test('should handle lines with extra spaces correctly', async () => {
      const contentWithSpaces = 'youtube   video1\nyoutube video2\n  youtube video3';
      fs.readFileSync.mockReturnValue(contentWithSpaces);

      const result = await ArchiveModule.removeVideoFromArchive('video2');

      expect(result).toBe(true);
      // Note: readCompleteListLines trims the lines, so whitespace is normalized
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube   video1\nyoutube video3\n',
        'utf-8'
      );
    });

    test('should only remove lines matching "youtube" prefix', async () => {
      const mixedContent = 'youtube video1\nvimeo video2\nyoutube video2\nyoutube video3';
      fs.readFileSync.mockReturnValue(mixedContent);

      const result = await ArchiveModule.removeVideoFromArchive('video2');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube video1\nvimeo video2\nyoutube video3\n',
        'utf-8'
      );
    });

    test('should remove only the first video when there are no others', async () => {
      fs.readFileSync.mockReturnValue('youtube video1');

      const result = await ArchiveModule.removeVideoFromArchive('video1');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        '',
        'utf-8'
      );
    });

    test('should remove video from beginning of list', async () => {
      fs.readFileSync.mockReturnValue('youtube video1\nyoutube video2\nyoutube video3');

      const result = await ArchiveModule.removeVideoFromArchive('video1');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube video2\nyoutube video3\n',
        'utf-8'
      );
    });

    test('should remove video from end of list', async () => {
      fs.readFileSync.mockReturnValue('youtube video1\nyoutube video2\nyoutube video3');

      const result = await ArchiveModule.removeVideoFromArchive('video3');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube video1\nyoutube video2\n',
        'utf-8'
      );
    });

    test('should match exact video ID only', async () => {
      fs.readFileSync.mockReturnValue('youtube video123\nyoutube video12\nyoutube video1234');

      const result = await ArchiveModule.removeVideoFromArchive('video123');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube video12\nyoutube video1234\n',
        'utf-8'
      );
    });

    test('should handle Windows line endings when removing', async () => {
      const windowsContent = 'youtube video1\r\nyoutube video2\r\nyoutube video3';
      fs.readFileSync.mockReturnValue(windowsContent);

      const result = await ArchiveModule.removeVideoFromArchive('video2');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockArchivePath,
        'youtube video1\nyoutube video3\n',
        'utf-8'
      );
    });
  });
});