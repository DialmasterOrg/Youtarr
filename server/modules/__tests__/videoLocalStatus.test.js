/* eslint-env jest */
jest.mock('../../models', () => ({ Video: { findAll: jest.fn() }, Channel: { findAll: jest.fn() } }));
jest.mock('../../models/channelvideo', () => ({ findAll: jest.fn() }));
jest.mock('../archiveModule', () => ({ filterArchivedVideoIds: jest.fn() }));
const { Video, Channel } = require('../../models');
const ChannelVideo = require('../../models/channelvideo');
const archiveModule = require('../archiveModule');
const { applyLocalVideoStatus } = require('../videoLocalStatus');

const pending = (...youtubeIds) => youtubeIds.map(youtubeId => ({ youtubeId, status: 'never_downloaded' }));

beforeEach(() => {
  jest.clearAllMocks();
  Video.findAll.mockResolvedValue([]);
  Channel.findAll.mockResolvedValue([]);
  ChannelVideo.findAll.mockResolvedValue([]);
  archiveModule.filterArchivedVideoIds.mockReturnValue(new Set());
});

it('does not query for an empty list', async () => {
  await applyLocalVideoStatus([]);
  expect(Video.findAll).not.toHaveBeenCalled();
});

it('merges downloaded and removed records while leaving unknown videos alone', async () => {
  Video.findAll.mockResolvedValue([
    { id: 1, youtubeId: 'aaaaaaaaaaa', removed: false, filePath: '/video.mp4', fileSize: 123,
      audioFilePath: '/audio.mp3', audioFileSize: 45, last_downloaded_at: '2026-09-01T00:00:00Z',
      protected: true, normalized_rating: 'PG', rating_source: 'manual' },
    { id: 2, youtubeId: 'bbbbbbbbbbb', removed: true, removed_reason: 'not_found', removed_at: '2026-10-03T00:00:00Z',
      removed_detail: null, last_downloaded_at: null, protected: false },
  ]);
  const results = pending('aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc');
  await applyLocalVideoStatus(results);
  expect(results[0]).toMatchObject({ status: 'downloaded', databaseId: 1, filePath: '/video.mp4',
    fileSize: 123, audioFilePath: '/audio.mp3', audioFileSize: 45, addedAt: '2026-09-01T00:00:00.000Z',
    isProtected: true, normalizedRating: 'PG', ratingSource: 'manual', removedReason: null, removedAt: null, removedDetail: null });
  expect(results[1]).toMatchObject({ status: 'missing', databaseId: 2, addedAt: null, isProtected: false,
    removedReason: 'not_found', removedAt: '2026-10-03T00:00:00.000Z', removedDetail: null });
  expect(results[2]).toEqual({ youtubeId: 'ccccccccccc', status: 'never_downloaded', inArchive: false });
});

it('reports a video Youtarr removed as deleted, with why', async () => {
  Video.findAll.mockResolvedValue([
    { id: 3, youtubeId: 'ddddddddddd', removed: true, removed_reason: 'auto_removal',
      removed_at: new Date('2026-10-03T00:00:00Z'), removed_detail: 'older than 30 days' },
    { id: 4, youtubeId: 'eeeeeeeeeee', removed: true, removed_reason: null, removed_at: null, removed_detail: null },
  ]);
  const results = pending('ddddddddddd', 'eeeeeeeeeee');
  await applyLocalVideoStatus(results);
  expect(results[0]).toMatchObject({ status: 'deleted', removedReason: 'auto_removal',
    removedAt: '2026-10-03T00:00:00.000Z', removedDetail: 'older than 30 days' });
  // Removed before the reason was recorded: deleted, with nothing to explain it.
  expect(results[1]).toMatchObject({ status: 'deleted', removedReason: null, removedAt: null, removedDetail: null });
});

describe('inArchive', () => {
  // The mock answers the way the real lookup does: only for the ids it is asked about.
  const archiveContains = (...archivedIds) => {
    const archived = new Set(archivedIds);
    archiveModule.filterArchivedVideoIds.mockImplementation(ids => new Set(ids.filter(id => archived.has(id))));
  };

  it('flags a video listed in the archive that has no database record', async () => {
    archiveContains('aaaaaaaaaaa');
    const results = pending('aaaaaaaaaaa', 'bbbbbbbbbbb');
    await applyLocalVideoStatus(results);
    expect(results.map(r => r.inArchive)).toEqual([true, false]);
  });

  it('keeps the never_downloaded status on an archive-only video', async () => {
    archiveContains('aaaaaaaaaaa');
    const results = pending('aaaaaaaaaaa');
    await applyLocalVideoStatus(results);
    expect(results[0].status).toBe('never_downloaded');
  });

  it('is false for an archived video that has a database record', async () => {
    archiveContains('aaaaaaaaaaa');
    Video.findAll.mockResolvedValue([{ id: 1, youtubeId: 'aaaaaaaaaaa', removed: true }]);
    const results = pending('aaaaaaaaaaa');
    await applyLocalVideoStatus(results);
    expect(results[0].inArchive).toBe(false);
  });

  it('is false for an ignored video, whose archive entry is deliberate', async () => {
    archiveContains('aaaaaaaaaaa', 'bbbbbbbbbbb');
    ChannelVideo.findAll.mockResolvedValue([{ youtube_id: 'aaaaaaaaaaa' }]);
    const results = pending('aaaaaaaaaaa', 'bbbbbbbbbbb');
    await applyLocalVideoStatus(results);
    expect(results.map(r => r.inArchive)).toEqual([false, true]);
  });

  it('looks up ignored state only for the archived videos', async () => {
    archiveContains('bbbbbbbbbbb');
    await applyLocalVideoStatus(pending('aaaaaaaaaaa', 'bbbbbbbbbbb'));
    expect(ChannelVideo.findAll).toHaveBeenCalledWith({
      where: { youtube_id: ['bbbbbbbbbbb'], ignored: true },
      attributes: ['youtube_id'],
    });
  });

  it('skips the ignored lookup when nothing is in the archive', async () => {
    await applyLocalVideoStatus(pending('aaaaaaaaaaa'));
    expect(ChannelVideo.findAll).not.toHaveBeenCalled();
  });
});

describe('channelSubscribed', () => {
  const withChannel = (youtubeId, channelId) => ({ youtubeId, channelId, status: 'never_downloaded' });

  it('is true for results whose channel is an enabled subscription and false otherwise', async () => {
    Channel.findAll.mockResolvedValue([{ channel_id: 'UCsubscribed' }]);
    const results = [withChannel('aaaaaaaaaaa', 'UCsubscribed'), withChannel('bbbbbbbbbbb', 'UCother')];
    await applyLocalVideoStatus(results);
    expect(results.map(r => r.channelSubscribed)).toEqual([true, false]);
  });

  it('asks only for enabled channels among the distinct channel ids in the results', async () => {
    const results = [withChannel('aaaaaaaaaaa', 'UCone'), withChannel('bbbbbbbbbbb', 'UCone'), withChannel('ccccccccccc', null)];
    await applyLocalVideoStatus(results);
    expect(Channel.findAll).toHaveBeenCalledWith({
      where: { channel_id: ['UCone'], enabled: true },
      attributes: ['channel_id'],
    });
  });

  it('leaves the flag unset and skips the lookup when no result carries a channel id', async () => {
    const results = pending('aaaaaaaaaaa');
    await applyLocalVideoStatus(results);
    expect(Channel.findAll).not.toHaveBeenCalled();
    expect(results[0]).not.toHaveProperty('channelSubscribed');
  });
});
