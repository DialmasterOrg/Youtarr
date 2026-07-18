/* eslint-env jest */
const { Op } = require('sequelize');
const playlistVideoFilters = require('../playlistVideoFilters');

// dl1 has a usable file; gone2 was downloaded then lost its file; new3 has no
// Video row at all. dl1 is watched, dl2 is downloaded but unwatched.
const memberRows = [
  { youtube_id: 'dl1' },
  { youtube_id: 'dl2' },
  { youtube_id: 'gone2' },
  { youtube_id: 'new3' },
];
const videoRows = [
  { id: 11, youtubeId: 'dl1', removed: false, filePath: '/v/dl1.mp4', audioFilePath: null },
  { id: 12, youtubeId: 'dl2', removed: false, filePath: '/v/dl2.mp4', audioFilePath: null },
  { id: 13, youtubeId: 'gone2', removed: false, filePath: null, audioFilePath: null },
];

const buildDeps = (overrides = {}) => ({
  playlistId: 'PLtest123',
  downloadState: 'all',
  watchedState: 'all',
  PlaylistVideo: { findAll: jest.fn().mockResolvedValue(memberRows) },
  Video: { findAll: jest.fn().mockResolvedValue(videoRows) },
  watchStatusQueries: { getWatchedByMap: jest.fn().mockResolvedValue(new Map([[11, ['plex']]])) },
  ...overrides,
});

describe('playlistVideoFilters.resolveVideoIdFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns no constraint and runs no queries when both filters are off', async () => {
    const deps = buildDeps();
    const result = await playlistVideoFilters.resolveVideoIdFilter(deps);

    expect(result).toEqual({ empty: false, youtubeIdWhere: null });
    expect(deps.PlaylistVideo.findAll).not.toHaveBeenCalled();
    expect(deps.Video.findAll).not.toHaveBeenCalled();
  });

  test('downloadState=downloaded allows only ids with a usable file', async () => {
    const result = await playlistVideoFilters.resolveVideoIdFilter(
      buildDeps({ downloadState: 'downloaded' })
    );

    expect(result.empty).toBe(false);
    expect(result.youtubeIdWhere).toEqual({ [Op.in]: ['dl1', 'dl2'] });
  });

  test('downloadState=not_downloaded excludes ids with a usable file', async () => {
    const result = await playlistVideoFilters.resolveVideoIdFilter(
      buildDeps({ downloadState: 'not_downloaded' })
    );

    expect(result.youtubeIdWhere).toEqual({ [Op.notIn]: ['dl1', 'dl2'] });
  });

  test('watchedState=watched allows only watched ids', async () => {
    const result = await playlistVideoFilters.resolveVideoIdFilter(
      buildDeps({ watchedState: 'watched' })
    );

    expect(result.youtubeIdWhere).toEqual({ [Op.in]: ['dl1'] });
  });

  test('watchedState=not_watched excludes watched ids but keeps unknown ones', async () => {
    const result = await playlistVideoFilters.resolveVideoIdFilter(
      buildDeps({ watchedState: 'not_watched' })
    );

    expect(result.youtubeIdWhere).toEqual({ [Op.notIn]: ['dl1'] });
  });

  test('combines downloadState=downloaded with watchedState=not_watched', async () => {
    const result = await playlistVideoFilters.resolveVideoIdFilter(
      buildDeps({ downloadState: 'downloaded', watchedState: 'not_watched' })
    );

    expect(result.youtubeIdWhere).toEqual({ [Op.in]: ['dl2'] });
  });

  test('reports empty when the allowed set resolves to nothing', async () => {
    const result = await playlistVideoFilters.resolveVideoIdFilter(
      buildDeps({
        watchedState: 'watched',
        watchStatusQueries: { getWatchedByMap: jest.fn().mockResolvedValue(new Map()) },
      })
    );

    expect(result.empty).toBe(true);
  });

  test('adds no constraint when there is nothing to exclude', async () => {
    const result = await playlistVideoFilters.resolveVideoIdFilter(
      buildDeps({
        downloadState: 'not_downloaded',
        Video: { findAll: jest.fn().mockResolvedValue([]) },
      })
    );

    expect(result).toEqual({ empty: false, youtubeIdWhere: null });
  });
});
