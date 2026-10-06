jest.mock('../../../models/videoclassification', () => ({
  findByPk: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const YOUTUBE_ID = 'abcdefghijk';
const SHOW = { id: 4, channel_id: 'UC123' };
// 2024-03-15 12:00:00 UTC
const TIMESTAMP = Date.UTC(2024, 2, 15, 12, 0, 0) / 1000;

function uniqueError() {
  const err = new Error('Validation error');
  err.name = 'SequelizeUniqueConstraintError';
  return err;
}

describe('episodeAllocator.assignDateEpisode', () => {
  let VideoClassification;
  let assignDateEpisode;

  const assign = (info = { timestamp: TIMESTAMP, title: 'Big Build' }, extra = {}) =>
    assignDateEpisode({ show: SHOW, youtubeId: YOUTUBE_ID, channelId: 'UC123', info, ...extra });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    VideoClassification = require('../../../models/videoclassification');
    ({ assignDateEpisode } = require('../episodeAllocator'));
    VideoClassification.findByPk.mockResolvedValue(null);
    VideoClassification.findAll.mockResolvedValue([]);
    VideoClassification.create.mockImplementation(async (values) => values);
  });

  it('numbers a new video by its upload time', async () => {
    await expect(assign()).resolves.toEqual({
      season: 2024,
      episode: 3151200,
      dateNumbered: true,
      episodeTitle: 'Big Build',
      fileStem: `S2024E03151200 - Big Build [${YOUTUBE_ID}]`,
    });
  });

  it('stores the assignment with its sources', async () => {
    await assign();
    expect(VideoClassification.create).toHaveBeenCalledWith(expect.objectContaining({
      youtube_id: YOUTUBE_ID,
      channel_id: 'UC123',
      show_id: 4,
      status: 'assigned',
      season: 2024,
      episode: 3151200,
      source: 'date',
      timestamp_source: 'timestamp',
      file_stem: `S2024E03151200 - Big Build [${YOUTUBE_ID}]`,
    }));
  });

  it('takes the next free number when the upload minute is taken', async () => {
    VideoClassification.findAll.mockResolvedValue([{ episode: 3151200 }, { episode: 3151201 }]);
    const result = await assign();
    expect(result.episode).toBe(3151202);
  });

  it('falls back to upload_date and records it', async () => {
    await assign({ upload_date: '20240315', title: 'Big Build' });
    expect(VideoClassification.create).toHaveBeenCalledWith(expect.objectContaining({
      episode: 3150000,
      timestamp_source: 'upload_date',
    }));
  });

  it('numbers from the current time when the info has no release time', async () => {
    const now = () => Date.UTC(2025, 0, 2, 3, 4, 0);
    const result = await assign({ title: 'Big Build' }, { now });
    expect([result.season, result.episode]).toEqual([2025, 1020304]);
  });

  it('reuses a stored assignment in the same show without writing', async () => {
    VideoClassification.findByPk.mockResolvedValue({
      show_id: 4, status: 'assigned', season: 2023, episode: 1010000,
      file_stem: `S2023E01010000 - Old Title [${YOUTUBE_ID}]`, episode_title: 'Old Title',
    });
    const result = await assign();
    expect(result).toEqual({
      season: 2023,
      episode: 1010000,
      dateNumbered: true,
      episodeTitle: 'Old Title',
      fileStem: `S2023E01010000 - Old Title [${YOUTUBE_ID}]`,
    });
    expect(VideoClassification.create).not.toHaveBeenCalled();
  });

  it('renumbers a stored row that belongs to another show in place', async () => {
    const stored = { show_id: 9, status: 'assigned', season: 2023, episode: 1, update: jest.fn() };
    VideoClassification.findByPk.mockResolvedValue(stored);
    await assign();
    expect(stored.update).toHaveBeenCalledWith(expect.objectContaining({ show_id: 4, season: 2024, episode: 3151200 }));
  });

  it('re-reads the season and retries once when another writer takes the number', async () => {
    VideoClassification.create.mockRejectedValueOnce(uniqueError());
    VideoClassification.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ episode: 3151200 }]);
    const result = await assign();
    expect(result.episode).toBe(3151201);
  });

  it('gives up when the retry also collides', async () => {
    VideoClassification.create.mockRejectedValue(uniqueError());
    await expect(assign()).rejects.toThrow('Validation error');
  });
});
