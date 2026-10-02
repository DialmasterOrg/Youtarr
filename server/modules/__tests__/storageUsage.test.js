/* eslint-env jest */

jest.mock('../../logger');

describe('storageUsage', () => {
  let storageUsage;
  let mockSequelize;
  let mockVideo;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockSequelize = {
      fn: jest.fn((...args) => ['fn', args]),
      literal: jest.fn((sql) => sql),
    };
    jest.doMock('../../db.js', () => ({
      sequelize: mockSequelize,
    }));

    mockVideo = {
      findOne: jest.fn(),
    };
    jest.doMock('../../models', () => ({
      Video: mockVideo,
    }));

    storageUsage = require('../storageUsage');
  });

  describe('getDownloadedBytes', () => {
    test('returns the summed size as a number', async () => {
      mockVideo.findOne.mockResolvedValue({ totalBytes: '5368709120' });

      await expect(storageUsage.getDownloadedBytes()).resolves.toBe(5368709120);
    });

    test('counts video and MP3 bytes of videos not marked removed', async () => {
      mockVideo.findOne.mockResolvedValue({ totalBytes: 0 });

      await storageUsage.getDownloadedBytes();

      expect(mockVideo.findOne).toHaveBeenCalledWith({
        attributes: [
          [
            mockSequelize.fn(
              'COALESCE',
              mockSequelize.fn('SUM', mockSequelize.literal(storageUsage.STORED_BYTES_SQL)),
              0,
            ),
            'totalBytes',
          ],
        ],
        where: {
          removed: false,
        },
        raw: true,
      });
    });

    test('returns 0 when the query yields no row', async () => {
      mockVideo.findOne.mockResolvedValue({ totalBytes: null });

      await expect(storageUsage.getDownloadedBytes()).resolves.toBe(0);
    });

    test('propagates query errors so callers can fail open or closed', async () => {
      mockVideo.findOne.mockRejectedValue(new Error('db down'));

      await expect(storageUsage.getDownloadedBytes()).rejects.toThrow('db down');
    });
  });
});
