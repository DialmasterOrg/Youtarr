/* eslint-env jest */

// Mock fs module - must define mockFsPromises before jest.mock
const mockFsPromises = {
  statfs: jest.fn(),
  stat: jest.fn(),
};
jest.mock('fs', () => {
  const mockActualFs = jest.requireActual('fs');
  return {
    ...mockActualFs,
    promises: mockFsPromises,
  };
});

jest.mock('../../../logger');

jest.mock('../../filesystem', () => ({
  extractYoutubeIdFromPath: jest.requireActual('../../filesystem/pathBuilder').extractYoutubeIdFromPath,
}));

jest.mock('../tempPathManager', () => ({
  getTempBasePath: jest.fn().mockReturnValue('/tmp/youtarr-downloads'),
}));

const logger = require('../../../logger');
const { findOutOfSpaceFailures } = require('../tempSpaceProbe');

const GB = 1024 * 1024 * 1024;
const VIDEO_ID = 'SgVJcDPGoJs';
const VIDEO_DIR = `/tmp/youtarr-downloads/Chan/Chan - Big Video - ${VIDEO_ID}`;
const VIDEO_STREAM = `${VIDEO_DIR}/Chan - Big Video [${VIDEO_ID}].f298.mp4`;
const AUDIO_STREAM = `${VIDEO_DIR}/Chan - Big Video [${VIDEO_ID}].f140.m4a`;

const conversionFailure = (overrides = {}) => ({
  youtubeId: VIDEO_ID,
  error: 'Conversion failed!',
  ...overrides,
});

// 4 KiB blocks, like the filesystems Youtarr runs on.
const BLOCK_SIZE = 4096;
const freeSpace = (bytes, totalBytes = 250 * GB) => ({
  bsize: BLOCK_SIZE,
  blocks: Math.floor(totalBytes / BLOCK_SIZE),
  bavail: Math.floor(bytes / BLOCK_SIZE),
});

const fileSizes = (sizes) => {
  mockFsPromises.stat.mockImplementation(async (filePath) => {
    if (!(filePath in sizes)) {
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    }
    return { size: sizes[filePath] };
  });
};

describe('tempSpaceProbe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFsPromises.statfs.mockResolvedValue(freeSpace(100 * GB));
    fileSizes({});
  });

  describe('findOutOfSpaceFailures', () => {
    it('flags a failed merge when temp has less free space than the video\'s downloaded files', async () => {
      mockFsPromises.statfs.mockResolvedValue(freeSpace(2 * GB));
      fileSizes({ [VIDEO_STREAM]: 16 * GB, [AUDIO_STREAM]: 1 * GB });

      const flagged = await findOutOfSpaceFailures([conversionFailure()], [VIDEO_STREAM, AUDIO_STREAM]);

      expect([...flagged]).toEqual([VIDEO_ID]);
    });

    it('does not flag a failed merge when temp has room for another copy', async () => {
      mockFsPromises.statfs.mockResolvedValue(freeSpace(100 * GB));
      fileSizes({ [VIDEO_STREAM]: 16 * GB, [AUDIO_STREAM]: 1 * GB });

      const flagged = await findOutOfSpaceFailures([conversionFailure()], [VIDEO_STREAM, AUDIO_STREAM]);

      expect(flagged.size).toBe(0);
    });

    it('counts only the failed video\'s own files', async () => {
      const otherStream = '/tmp/youtarr-downloads/Chan/Chan - Other - otherVid123/Chan - Other [otherVid123].f298.mp4';
      mockFsPromises.statfs.mockResolvedValue(freeSpace(2 * GB));
      fileSizes({ [VIDEO_STREAM]: 1 * GB, [otherStream]: 50 * GB });

      const flagged = await findOutOfSpaceFailures([conversionFailure()], [VIDEO_STREAM, otherStream]);

      expect(flagged.size).toBe(0);
    });

    it('flags an explicit no-space error without needing a measurement', async () => {
      mockFsPromises.statfs.mockRejectedValue(new Error('statfs not supported'));
      const failure = conversionFailure({ error: 'unable to write data: [Errno 28] No space left on device' });

      const flagged = await findOutOfSpaceFailures([failure], []);

      expect([...flagged]).toEqual([VIDEO_ID]);
    });

    it('does not flag a failed merge when free space cannot be measured', async () => {
      mockFsPromises.statfs.mockRejectedValue(new Error('statfs not supported'));
      fileSizes({ [VIDEO_STREAM]: 16 * GB });

      const flagged = await findOutOfSpaceFailures([conversionFailure()], [VIDEO_STREAM]);

      expect(flagged.size).toBe(0);
    });

    it('does not flag a failed merge when the filesystem reports no size at all', async () => {
      mockFsPromises.statfs.mockResolvedValue({ bsize: BLOCK_SIZE, blocks: 0, bavail: 0 });
      fileSizes({ [VIDEO_STREAM]: 16 * GB });

      const flagged = await findOutOfSpaceFailures([conversionFailure()], [VIDEO_STREAM]);

      expect(flagged.size).toBe(0);
    });

    it('does not flag a failed merge whose files are already gone', async () => {
      mockFsPromises.statfs.mockResolvedValue(freeSpace(0));

      const flagged = await findOutOfSpaceFailures([conversionFailure()], [VIDEO_STREAM]);

      expect(flagged.size).toBe(0);
    });

    it('ignores failures unrelated to disk space', async () => {
      mockFsPromises.statfs.mockResolvedValue(freeSpace(0));
      fileSizes({ [VIDEO_STREAM]: 16 * GB });
      const failure = conversionFailure({ error: 'unable to download video data: HTTP Error 403: Forbidden' });

      const flagged = await findOutOfSpaceFailures([failure], [VIDEO_STREAM]);

      expect(flagged.size).toBe(0);
    });

    it('does not touch the disk when no failure could be a space problem', async () => {
      const failure = conversionFailure({ error: 'Video unavailable' });

      await findOutOfSpaceFailures([failure], [VIDEO_STREAM]);

      expect(mockFsPromises.statfs).not.toHaveBeenCalled();
    });

    it('logs the temp folder and its free space for a flagged video', async () => {
      mockFsPromises.statfs.mockResolvedValue(freeSpace(2 * GB));
      fileSizes({ [VIDEO_STREAM]: 16 * GB });

      await findOutOfSpaceFailures([conversionFailure()], [VIDEO_STREAM]);

      expect(logger.error).toHaveBeenCalledWith(
        {
          youtubeId: VIDEO_ID,
          tempPath: '/tmp/youtarr-downloads',
          freeBytes: 2 * GB,
          leftoverBytes: 16 * GB,
        },
        'Download failed because the temporary download folder is out of space'
      );
    });

    it('returns an empty set when given no failures', async () => {
      const flagged = await findOutOfSpaceFailures(undefined, undefined);

      expect(flagged.size).toBe(0);
    });
  });
});
