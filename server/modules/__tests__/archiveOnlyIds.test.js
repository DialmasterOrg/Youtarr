/* eslint-env jest */
jest.mock('../../models/channelvideo', () => ({ findAll: jest.fn() }));
jest.mock('../archiveModule', () => ({ filterArchivedVideoIds: jest.fn() }));
const ChannelVideo = require('../../models/channelvideo');
const archiveModule = require('../archiveModule');
const { findArchiveOnlyIds } = require('../archiveOnlyIds');

beforeEach(() => {
  jest.clearAllMocks();
  ChannelVideo.findAll.mockResolvedValue([]);
});

describe('findArchiveOnlyIds', () => {
  test('returns the ids the download archive lists', async () => {
    archiveModule.filterArchivedVideoIds.mockReturnValue(new Set(['aaaaaaaaaaa']));

    const result = await findArchiveOnlyIds(['aaaaaaaaaaa', 'bbbbbbbbbbb']);

    expect([...result]).toEqual(['aaaaaaaaaaa']);
  });

  test('leaves out ignored videos, whose archive entry an explicit download removes', async () => {
    archiveModule.filterArchivedVideoIds.mockReturnValue(new Set(['aaaaaaaaaaa', 'bbbbbbbbbbb']));
    ChannelVideo.findAll.mockResolvedValue([{ youtube_id: 'bbbbbbbbbbb' }]);

    const result = await findArchiveOnlyIds(['aaaaaaaaaaa', 'bbbbbbbbbbb']);

    expect([...result]).toEqual(['aaaaaaaaaaa']);
  });

  test('does not look up ignored videos when nothing is archived', async () => {
    archiveModule.filterArchivedVideoIds.mockReturnValue(new Set());

    await findArchiveOnlyIds(['aaaaaaaaaaa']);

    expect(ChannelVideo.findAll).not.toHaveBeenCalled();
  });
});
