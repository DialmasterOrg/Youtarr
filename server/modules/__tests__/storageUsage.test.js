/* eslint-env jest */

jest.mock('../../logger');

describe('storageUsage', () => {
  let storageUsage;
  let mockSequelize;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockSequelize = { query: jest.fn() };
    jest.doMock('../../db.js', () => ({
      Sequelize: { QueryTypes: { SELECT: 'SELECT' } },
      sequelize: mockSequelize
    }));

    storageUsage = require('../storageUsage');
  });

  describe('getDownloadedBytes', () => {
    test('returns the summed size as a number', async () => {
      mockSequelize.query.mockResolvedValue([{ totalBytes: '5368709120' }]);

      await expect(storageUsage.getDownloadedBytes()).resolves.toBe(5368709120);
    });

    test('counts video and MP3 bytes of videos not marked removed', async () => {
      mockSequelize.query.mockResolvedValue([{ totalBytes: 0 }]);

      await storageUsage.getDownloadedBytes();

      const [sql] = mockSequelize.query.mock.calls[0];
      expect(sql).toContain(storageUsage.STORED_BYTES_SQL);
      expect(sql).toContain('videos.removed = 0');
    });

    test('returns 0 when the query yields no row', async () => {
      mockSequelize.query.mockResolvedValue([]);

      await expect(storageUsage.getDownloadedBytes()).resolves.toBe(0);
    });

    test('propagates query errors so callers can fail open or closed', async () => {
      mockSequelize.query.mockRejectedValue(new Error('db down'));

      await expect(storageUsage.getDownloadedBytes()).rejects.toThrow('db down');
    });
  });
});
