/* eslint-env jest */
const express = require('express');
const { Op } = require('sequelize');
const createPlaylistRoutes = require('../playlists');
const { findRouteHandler } = require('../../__tests__/testUtils');

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
};

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const makePlaylist = (overrides = {}) => ({
  id: 1,
  playlist_id: 'PLtest123',
  title: 'Test Playlist',
  enabled: true,
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const buildDeps = (overrides = {}) => ({
  verifyToken: (req, res, next) => next(),
  playlistModule: {
    getPlaylistInfo: jest.fn(),
    upsertPlaylist: jest.fn(),
    fetchAllPlaylistVideos: jest.fn(),
    ...overrides.playlistModule,
  },
  m3uGenerator: {
    generatePlaylistM3U: jest.fn().mockResolvedValue(true),
    ...overrides.m3uGenerator,
  },
  downloadModule: {
    doPlaylistDownloads: jest.fn().mockResolvedValue(undefined),
    ...overrides.downloadModule,
  },
  mediaServers: {
    mediaServerSync: {
      syncPlaylist: jest.fn().mockResolvedValue(undefined),
    },
    watchStatusQueries: {
      getWatchedByMap: jest.fn().mockResolvedValue(new Map()),
    },
    ...overrides.mediaServers,
  },
  channelSettingsModule: {
    validateSubFolder: jest.fn().mockReturnValue({ valid: true }),
    ...overrides.channelSettingsModule,
  },
  subfolderModule: {
    register: jest.fn().mockResolvedValue(undefined),
    ...overrides.subfolderModule,
  },
  // Real ratingMapper: it is a pure module with no DB/IO deps, so route tests
  // exercise the actual rating validation/normalization.
  ratingMapper: require('../../modules/ratingMapper'),
  models: {
    Playlist: {
      findAndCountAll: jest.fn(),
      // Most :playlistId routes guard on an enabled playlist existing; default
      // to one so tests only override findOne for the not-found/soft-deleted cases.
      findOne: jest.fn().mockResolvedValue(makePlaylist()),
      ...overrides.Playlist,
    },
    PlaylistVideo: {
      findAndCountAll: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      ...overrides.PlaylistVideo,
    },
    Video: {
      findAll: jest.fn().mockResolvedValue([]),
      ...overrides.Video,
    },
    ...overrides.models,
  },
});

const getHandler = (method, path, deps) => {
  const router = createPlaylistRoutes(deps);
  const app = express();
  app.use(express.json());
  app.use(router);
  return findRouteHandler(app, method, path);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/playlists', () => {
  test('returns paginated playlist list', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [makePlaylist({ id: 1 }), makePlaylist({ id: 2, playlist_id: 'PLother' })],
    });

    const handler = getHandler('get', '/api/playlists', deps);
    const req = { query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.Playlist.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { enabled: true }, limit: 25, offset: 0 })
    );
    expect(res.json).toHaveBeenCalledWith({ total: 2, playlists: expect.any(Array) });
  });

  test('respects page and pageSize query params', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const handler = getHandler('get', '/api/playlists', deps);
    const req = { query: { page: '2', pageSize: '10' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.Playlist.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 10 })
    );
  });

  test('caps pageSize at 100', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const handler = getHandler('get', '/api/playlists', deps);
    const req = { query: { pageSize: '999' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.Playlist.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
  });

  test('returns 500 on db error', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findAndCountAll.mockRejectedValue(new Error('db down'));

    const handler = getHandler('get', '/api/playlists', deps);
    const req = { query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to list playlists' });
  });
});

describe('GET /api/playlists/:playlistId', () => {
  test('returns the playlist when found', async () => {
    const deps = buildDeps();
    const playlist = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(playlist);

    const handler = getHandler('get', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.Playlist.findOne).toHaveBeenCalledWith({
      where: { playlist_id: 'PLtest123', enabled: true },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ playlist }));
  });

  test('is not found when the playlist is soft-deleted', async () => {
    const deps = buildDeps();
    // The enabled-only lookup returns nothing for a soft-deleted playlist.
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('get', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'PLdeleted' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.Playlist.findOne).toHaveBeenCalledWith({
      where: { playlist_id: 'PLdeleted', enabled: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });

  test('returns 404 when playlist not found', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('get', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'PLmissing' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });

  test('returns 500 on db error', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockRejectedValue(new Error('db down'));

    const handler = getHandler('get', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch playlist' });
  });
});

describe('GET /api/playlists/:playlistId not_downloaded_count', () => {
  test('returns count of non-ignored videos without a Video row', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(makePlaylist({ video_count: 3 }));
    deps.models.PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'a' },
      { youtube_id: 'b' },
      { youtube_id: 'c' },
    ]);
    deps.models.Video.findAll.mockResolvedValue([{ youtubeId: 'b' }]);

    const handler = getHandler('get', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playlist_id: 'PLtest123', ignored: false } })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ not_downloaded_count: 2 })
    );
  });

  test('returns 404 when playlist missing', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);
    const handler = getHandler('get', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'missing' }, log: loggerMock };
    const res = createResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('GET /api/playlists/:playlistId unsyncable_count', () => {
  test('counts downloads without a video file on a video-type playlist', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(makePlaylist({ audio_format: null }));
    deps.models.PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'a' },
      { youtube_id: 'b' },
      { youtube_id: 'c' },
    ]);
    deps.models.Video.findAll.mockResolvedValue([
      // Downloaded as mp3-only: no video file to sync.
      { youtubeId: 'a', filePath: null, audioFilePath: '/y/a.mp3' },
      { youtubeId: 'b', filePath: '/y/b.mp4', audioFilePath: null },
      // 'c' has no Video row: counted as not downloaded, not as unsyncable.
    ]);

    const handler = getHandler('get', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ not_downloaded_count: 1, unsyncable_count: 1 })
    );
  });

  test('counts downloads without an mp3 on an MP3 Only playlist', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(makePlaylist({ audio_format: 'mp3_only' }));
    deps.models.PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'a' },
      { youtube_id: 'b' },
    ]);
    deps.models.Video.findAll.mockResolvedValue([
      // Manually downloaded as video-only: no mp3 to sync.
      { youtubeId: 'a', filePath: '/y/a.mp4', audioFilePath: null },
      // Video + MP3 download: its mp3 syncs fine.
      { youtubeId: 'b', filePath: '/y/b.mp4', audioFilePath: '/y/b.mp3' },
    ]);

    const handler = getHandler('get', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ unsyncable_count: 1 })
    );
  });
});

describe('POST /api/playlists/addplaylistinfo', () => {
  test('returns playlist info on success', async () => {
    const deps = buildDeps();
    const info = { playlist_id: 'PLtest', title: 'Test', video_count: 5 };
    deps.playlistModule.getPlaylistInfo.mockResolvedValue(info);

    const handler = getHandler('post', '/api/playlists/addplaylistinfo', deps);
    const req = { body: { url: 'https://youtube.com/playlist?list=PLtest' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.playlistModule.getPlaylistInfo).toHaveBeenCalledWith('https://youtube.com/playlist?list=PLtest');
    expect(res.json).toHaveBeenCalledWith(info);
  });

  test('returns 400 when url is missing', async () => {
    const deps = buildDeps();
    const handler = getHandler('post', '/api/playlists/addplaylistinfo', deps);
    const req = { body: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'url is required' });
    expect(deps.playlistModule.getPlaylistInfo).not.toHaveBeenCalled();
  });

  test('returns 404 when playlist not found', async () => {
    const deps = buildDeps();
    deps.playlistModule.getPlaylistInfo.mockRejectedValue(new Error('PLAYLIST_NOT_FOUND'));

    const handler = getHandler('post', '/api/playlists/addplaylistinfo', deps);
    const req = { body: { url: 'https://youtube.com/playlist?list=bad' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });

  test('returns 403 when cookies required', async () => {
    const deps = buildDeps();
    deps.playlistModule.getPlaylistInfo.mockRejectedValue(new Error('COOKIES_REQUIRED'));

    const handler = getHandler('post', '/api/playlists/addplaylistinfo', deps);
    const req = { body: { url: 'https://youtube.com/playlist?list=private' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'This playlist requires authentication (cookies)' });
  });

  test('returns 503 on network error', async () => {
    const deps = buildDeps();
    deps.playlistModule.getPlaylistInfo.mockRejectedValue(new Error('NETWORK_ERROR'));

    const handler = getHandler('post', '/api/playlists/addplaylistinfo', deps);
    const req = { body: { url: 'https://youtube.com/playlist?list=net' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unable to reach YouTube' });
  });

  test('returns 500 on unexpected error', async () => {
    const deps = buildDeps();
    deps.playlistModule.getPlaylistInfo.mockRejectedValue(new Error('Unexpected'));

    const handler = getHandler('post', '/api/playlists/addplaylistinfo', deps);
    const req = { body: { url: 'https://youtube.com/playlist?list=x' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch playlist info' });
  });
});

describe('POST /api/playlists', () => {
  test('subscribes to a playlist and returns 201', async () => {
    const deps = buildDeps();
    const info = { playlist_id: 'PLtest', title: 'Test', video_count: 5 };
    const created = makePlaylist();
    deps.playlistModule.getPlaylistInfo.mockResolvedValue(info);
    deps.playlistModule.upsertPlaylist.mockResolvedValue({ playlist: created, restored: false });
    deps.playlistModule.fetchAllPlaylistVideos.mockResolvedValue(5);

    const handler = getHandler('post', '/api/playlists', deps);
    const req = { body: { url: 'https://youtube.com/playlist?list=PLtest' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.playlistModule.getPlaylistInfo).toHaveBeenCalledWith('https://youtube.com/playlist?list=PLtest');
    expect(deps.playlistModule.upsertPlaylist).toHaveBeenCalledWith(info, { enabled: true, settings: {} });
    expect(deps.playlistModule.fetchAllPlaylistVideos).toHaveBeenCalledWith(created.playlist_id);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ playlist: created, restored: false });
  });

  test('restores a soft-deleted playlist and reports restored without touching its settings', async () => {
    const deps = buildDeps();
    const restoredPlaylist = makePlaylist();
    deps.playlistModule.getPlaylistInfo.mockResolvedValue({ playlist_id: 'PLtest123' });
    deps.playlistModule.upsertPlaylist.mockResolvedValue({ playlist: restoredPlaylist, restored: true });
    deps.playlistModule.fetchAllPlaylistVideos.mockResolvedValue(5);

    const handler = getHandler('post', '/api/playlists', deps);
    const req = {
      body: { url: 'https://youtube.com/playlist?list=PLtest123', settings: { default_sub_folder: 'Music' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ playlist: restoredPlaylist, restored: true });
    // Discarded settings must not register their subfolder.
    expect(deps.subfolderModule.register).not.toHaveBeenCalled();
  });

  test('registers a real default_sub_folder so it appears in every picker', async () => {
    const deps = buildDeps();
    deps.playlistModule.getPlaylistInfo.mockResolvedValue({ playlist_id: 'PLtest' });
    deps.playlistModule.upsertPlaylist.mockResolvedValue({ playlist: makePlaylist(), restored: false });
    deps.playlistModule.fetchAllPlaylistVideos.mockResolvedValue(0);

    const handler = getHandler('post', '/api/playlists', deps);
    const req = {
      body: { url: 'https://youtube.com/playlist?list=PLtest', settings: { default_sub_folder: 'Music' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(deps.subfolderModule.register).toHaveBeenCalledWith('Music');
  });

  test('returns 400 when url is missing', async () => {
    const deps = buildDeps();
    const handler = getHandler('post', '/api/playlists', deps);
    const req = { body: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'url is required' });
    expect(deps.playlistModule.getPlaylistInfo).not.toHaveBeenCalled();
  });

  test('rejects a traversal default_sub_folder before subscribing', async () => {
    const deps = buildDeps({
      channelSettingsModule: {
        validateSubFolder: jest.fn().mockReturnValue({ valid: false, error: 'bad' }),
      },
    });
    const handler = getHandler('post', '/api/playlists', deps);
    const req = {
      body: { url: 'https://youtube.com/playlist?list=PLtest', settings: { default_sub_folder: '../../etc' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(deps.channelSettingsModule.validateSubFolder).toHaveBeenCalledWith('../../etc');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid default_sub_folder' });
    expect(deps.playlistModule.getPlaylistInfo).not.toHaveBeenCalled();
    expect(deps.playlistModule.upsertPlaylist).not.toHaveBeenCalled();
  });

  test('returns 500 on subscribe failure', async () => {
    const deps = buildDeps();
    deps.playlistModule.getPlaylistInfo.mockRejectedValue(new Error('boom'));

    const handler = getHandler('post', '/api/playlists', deps);
    const req = { body: { url: 'https://youtube.com/playlist?list=x' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to subscribe to playlist' });
  });
});

describe('DELETE /api/playlists/:playlistId', () => {
  test('disables the playlist', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('delete', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.Playlist.findOne).toHaveBeenCalledWith({ where: { playlist_id: 'PLtest123' } });
    expect(p.update).toHaveBeenCalledWith({ enabled: false });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('returns 404 when playlist not found', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('delete', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'nonexistent' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });

  test('returns 500 on db error', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockRejectedValue(new Error('db error'));

    const handler = getHandler('delete', '/api/playlists/:playlistId', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to unsubscribe' });
  });
});

describe('PATCH /api/playlists/:playlistId', () => {
  test('updates allowed fields', async () => {
    const deps = buildDeps();
    const p = makePlaylist({ auto_download: true });
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('patch', '/api/playlists/:playlistId', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { auto_download: true, ignored_field: 'should_be_skipped' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(p.update).toHaveBeenCalledWith({ auto_download: true });
    expect(res.json).toHaveBeenCalledWith({ playlist: p });
  });

  test('returns 404 when playlist not found', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('patch', '/api/playlists/:playlistId', deps);
    const req = {
      params: { playlistId: 'nonexistent' },
      body: { enabled: false },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });

  test('returns 500 on db error', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockRejectedValue(new Error('db error'));

    const handler = getHandler('patch', '/api/playlists/:playlistId', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { enabled: false },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update playlist' });
  });

  test('ignores sort_order sent via PATCH (settings endpoint owns it)', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('patch', '/api/playlists/:playlistId', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { auto_download: true, sort_order: 'reversed' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(p.update).toHaveBeenCalledWith({ auto_download: true });
  });
});

describe('GET /api/playlists/:playlistId/settings', () => {
  test('returns settings for a playlist', async () => {
    const deps = buildDeps();
    const p = makePlaylist({
      default_sub_folder: 'Music',
      video_quality: '1080p',
      min_duration: null,
      max_duration: null,
      title_filter_regex: null,
      audio_format: null,
      default_rating: null,
      sort_order: 'reversed',
    });
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('get', '/api/playlists/:playlistId/settings', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      default_sub_folder: 'Music',
      video_quality: '1080p',
      min_duration: null,
      max_duration: null,
      title_filter_regex: null,
      audio_format: null,
      default_rating: null,
      sort_order: 'reversed',
    });
  });

  test('returns 404 when playlist not found', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('get', '/api/playlists/:playlistId/settings', deps);
    const req = { params: { playlistId: 'nonexistent' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });
});

describe('PUT /api/playlists/:playlistId/settings', () => {
  test('updates allowed settings fields', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('put', '/api/playlists/:playlistId/settings', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { video_quality: '720p', min_duration: 60, ignored_field: 'bad' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(p.update).toHaveBeenCalledWith({ video_quality: '720p', min_duration: 60 });
    expect(res.json).toHaveBeenCalledWith({ settings: { video_quality: '720p', min_duration: 60 } });
  });

  test('updates sort_order when given a valid value', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('put', '/api/playlists/:playlistId/settings', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { sort_order: 'reversed' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(p.update).toHaveBeenCalledWith({ sort_order: 'reversed' });
    expect(res.json).toHaveBeenCalledWith({ settings: { sort_order: 'reversed' } });
  });

  test('rejects an invalid sort_order with 400 before touching the playlist', async () => {
    const deps = buildDeps();

    const handler = getHandler('put', '/api/playlists/:playlistId/settings', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { sort_order: 'upside_down' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid sort_order; expected default or reversed' });
    expect(deps.models.Playlist.findOne).not.toHaveBeenCalled();
  });

  test('registers a real default_sub_folder when settings are updated', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(makePlaylist());

    const handler = getHandler('put', '/api/playlists/:playlistId/settings', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { default_sub_folder: 'Music' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(deps.subfolderModule.register).toHaveBeenCalledWith('Music');
  });

  test('returns 404 when playlist not found', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('put', '/api/playlists/:playlistId/settings', deps);
    const req = {
      params: { playlistId: 'nonexistent' },
      body: { video_quality: '720p' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });

  test('rejects a traversal default_sub_folder without persisting', async () => {
    const deps = buildDeps({
      channelSettingsModule: {
        validateSubFolder: jest.fn().mockReturnValue({ valid: false, error: 'bad' }),
      },
    });
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('put', '/api/playlists/:playlistId/settings', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { default_sub_folder: 'a/../../etc' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(deps.channelSettingsModule.validateSubFolder).toHaveBeenCalledWith('a/../../etc');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid default_sub_folder' });
    expect(p.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/playlists/:playlistId/videos', () => {
  test('returns paginated videos for a playlist', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({
      count: 3,
      rows: [
        { id: 1, playlist_id: 'PLtest123', youtube_id: 'vid1', position: 1, ignored: false, ignored_at: null, added_at: null, channel_id: null },
        { id: 2, playlist_id: 'PLtest123', youtube_id: 'vid2', position: 2, ignored: false, ignored_at: null, added_at: null, channel_id: null },
        { id: 3, playlist_id: 'PLtest123', youtube_id: 'vid3', position: 3, ignored: false, ignored_at: null, added_at: null, channel_id: null },
      ],
    });

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playlist_id: 'PLtest123' },
        limit: 50,
        offset: 0,
        order: [['position', 'ASC']],
      })
    );
    expect(res.json).toHaveBeenCalledWith({ total: 3, videos: expect.any(Array) });
    const payload = res.json.mock.calls[0][0];
    expect(payload.videos[0]).toMatchObject({
      youtube_id: 'vid1',
      position: 1,
      thumbnail: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg',
      downloaded: false,
    });
  });

  test('returns metadata stored on playlistvideos rows, with downloaded-status overlay from Videos', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [
        {
          id: 1,
          playlist_id: 'PLtest123',
          youtube_id: 'downloaded1',
          position: 1,
          ignored: false,
          ignored_at: null,
          added_at: null,
          channel_id: 'UC1',
          channel_name: 'Downloaded Channel',
          title: 'A downloaded video',
          thumbnail: 'https://thumb/1.jpg',
          duration: 123,
          published_at: '20260101',
        },
        {
          id: 2,
          playlist_id: 'PLtest123',
          youtube_id: 'tracked2',
          position: 2,
          ignored: false,
          ignored_at: null,
          added_at: null,
          channel_id: 'UC2',
          channel_name: 'Tracked Channel',
          title: 'A tracked video',
          thumbnail: 'https://thumb/2.jpg',
          duration: 456,
          published_at: '20260215',
        },
      ],
    });
    deps.models.Video.findAll.mockResolvedValue([
      {
        id: 42,
        youtubeId: 'downloaded1',
        youTubeVideoName: 'A downloaded video',
        youTubeChannelName: 'Downloaded Channel',
        duration: 123,
        originalDate: '20260101',
        removed: false,
        youtube_removed: false,
        filePath: '/videos/downloaded1.mp4',
        fileSize: 1024,
        audioFilePath: '/videos/downloaded1.m4a',
        audioFileSize: 2048,
      },
    ]);

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.videos[0]).toMatchObject({
      youtube_id: 'downloaded1',
      title: 'A downloaded video',
      channel_name: 'Downloaded Channel',
      duration: 123,
      published_at: '20260101',
      thumbnail: 'https://thumb/1.jpg',
      downloaded: true,
      previously_downloaded: false,
      video_id: 42,
      file_path: '/videos/downloaded1.mp4',
      file_size: 1024,
      audio_file_path: '/videos/downloaded1.m4a',
      audio_file_size: 2048,
    });
    expect(payload.videos[1]).toMatchObject({
      youtube_id: 'tracked2',
      audio_file_path: null,
      audio_file_size: null,
      title: 'A tracked video',
      duration: 456,
      published_at: '20260215',
      thumbnail: 'https://thumb/2.jpg',
      downloaded: false,
      previously_downloaded: false,
      video_id: null,
    });
  });

  test('flags a video with a removed Videos row as previously_downloaded', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [
        { id: 1, playlist_id: 'PLtest123', youtube_id: 'gone1', position: 1, ignored: false, ignored_at: null, added_at: null, channel_id: null },
      ],
    });
    deps.models.Video.findAll.mockResolvedValue([
      {
        id: 7,
        youtubeId: 'gone1',
        youTubeVideoName: 'Deleted local file',
        removed: true,
        youtube_removed: false,
        filePath: '/videos/gone1.mp4',
        fileSize: 1024,
      },
    ]);

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.videos[0]).toMatchObject({
      youtube_id: 'gone1',
      downloaded: false,
      previously_downloaded: true,
    });
  });

  test('flags an audio-only download (no video filePath) as downloaded', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [
        { id: 1, playlist_id: 'PLtest123', youtube_id: 'audio1', position: 1, ignored: false, ignored_at: null, added_at: null, channel_id: null },
      ],
    });
    deps.models.Video.findAll.mockResolvedValue([
      {
        id: 9,
        youtubeId: 'audio1',
        youTubeVideoName: 'An mp3-only download',
        removed: false,
        youtube_removed: false,
        filePath: null,
        fileSize: null,
        audioFilePath: '/videos/audio1.mp3',
        audioFileSize: 512,
      },
    ]);

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.videos[0]).toMatchObject({
      youtube_id: 'audio1',
      downloaded: true,
      previously_downloaded: false,
      audio_file_path: '/videos/audio1.mp3',
    });
  });

  test('orders by position DESC when sortOrder=desc', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: { sortOrder: 'desc' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ order: [['position', 'DESC']] })
    );
  });

  test('orders by added_at DESC with position tie-break when sortOrder=recent', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: { sortOrder: 'recent' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ order: [['added_at', 'DESC'], ['position', 'ASC']] })
    );
  });

  test('falls back to position ASC for an invalid sortOrder', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: { sortOrder: 'sideways' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ order: [['position', 'ASC']] })
    );
  });

  test('caps pageSize at 200', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: { pageSize: '999' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 })
    );
  });

  test('returns 500 on db error', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockRejectedValue(new Error('db error'));

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to list videos' });
  });

  test('returns 404 for a soft-deleted playlist without listing videos', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLdeleted' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.Playlist.findOne).toHaveBeenCalledWith({
      where: { playlist_id: 'PLdeleted', enabled: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
    expect(deps.models.PlaylistVideo.findAndCountAll).not.toHaveBeenCalled();
  });
});

describe('GET /api/playlists/:playlistId/videos watched_by', () => {
  const playlistRows = (youtubeIds) => ({
    count: youtubeIds.length,
    rows: youtubeIds.map((youtubeId, i) => ({
      id: i + 1,
      playlist_id: 'PLtest123',
      youtube_id: youtubeId,
      position: i + 1,
      ignored: false,
      ignored_at: null,
      added_at: null,
      channel_id: null,
    })),
  });

  test('stamps watched_by from watch-status rows keyed by the Videos id', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue(playlistRows(['watched1', 'tracked2']));
    deps.models.Video.findAll.mockResolvedValue([
      {
        id: 42,
        youtubeId: 'watched1',
        removed: false,
        youtube_removed: false,
        filePath: '/videos/watched1.mp4',
        fileSize: 1024,
      },
    ]);
    deps.mediaServers.watchStatusQueries.getWatchedByMap.mockResolvedValue(
      new Map([[42, ['plex', 'jellyfin']]])
    );

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.mediaServers.watchStatusQueries.getWatchedByMap).toHaveBeenCalledWith([42]);
    const payload = res.json.mock.calls[0][0];
    expect(payload.videos[0].watched_by).toEqual(['plex', 'jellyfin']);
    expect(payload.videos[1].watched_by).toEqual([]);
  });

  test('keeps watched_by for a previously-downloaded video whose file is gone', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue(playlistRows(['gone1']));
    deps.models.Video.findAll.mockResolvedValue([
      {
        id: 7,
        youtubeId: 'gone1',
        removed: true,
        youtube_removed: false,
        filePath: '/videos/gone1.mp4',
        fileSize: 1024,
      },
    ]);
    deps.mediaServers.watchStatusQueries.getWatchedByMap.mockResolvedValue(
      new Map([[7, ['emby']]])
    );

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.videos[0]).toMatchObject({
      previously_downloaded: true,
      watched_by: ['emby'],
    });
  });
});

describe('GET /api/playlists/:playlistId/videos downloadState filter', () => {
  // dl1 has a usable file; gone2 was downloaded then lost its file
  // (previously_downloaded); new3 has no Video row at all.
  const memberRows = [
    { youtube_id: 'dl1' },
    { youtube_id: 'gone2' },
    { youtube_id: 'new3' },
  ];
  const videoRows = [
    { youtubeId: 'dl1', removed: false, filePath: '/videos/dl1.mp4', audioFilePath: null },
    { youtubeId: 'gone2', removed: false, filePath: null, audioFilePath: null },
  ];

  test('downloadState=downloaded restricts the page query to ids with a usable file', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAll.mockResolvedValue(memberRows);
    deps.models.Video.findAll.mockResolvedValue(videoRows);
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{ id: 1, playlist_id: 'PLtest123', youtube_id: 'dl1', position: 1, ignored: false, ignored_at: null, added_at: null, channel_id: null }],
    });

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: { downloadState: 'downloaded' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playlist_id: 'PLtest123', youtube_id: { [Op.in]: ['dl1'] } },
      })
    );
    const payload = res.json.mock.calls[0][0];
    expect(payload.total).toBe(1);
    expect(payload.videos[0]).toMatchObject({ youtube_id: 'dl1', downloaded: true });
  });

  test('downloadState=not_downloaded excludes ids with a usable file; previously-downloaded rows still shown', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAll.mockResolvedValue(memberRows);
    deps.models.Video.findAll.mockResolvedValue(videoRows);
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [
        { id: 2, playlist_id: 'PLtest123', youtube_id: 'gone2', position: 2, ignored: false, ignored_at: null, added_at: null, channel_id: null },
        { id: 3, playlist_id: 'PLtest123', youtube_id: 'new3', position: 3, ignored: false, ignored_at: null, added_at: null, channel_id: null },
      ],
    });

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: { downloadState: 'not_downloaded' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playlist_id: 'PLtest123', youtube_id: { [Op.notIn]: ['dl1'] } },
      })
    );
    const payload = res.json.mock.calls[0][0];
    expect(payload.videos.map((v) => v.youtube_id)).toEqual(['gone2', 'new3']);
    expect(payload.videos[0]).toMatchObject({ downloaded: false, previously_downloaded: true });
  });

  test('downloadState=downloaded short-circuits to an empty page when nothing is downloaded', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAll.mockResolvedValue(memberRows);
    deps.models.Video.findAll.mockResolvedValue([]);

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: { downloadState: 'downloaded' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ total: 0, videos: [] });
    expect(deps.models.PlaylistVideo.findAndCountAll).not.toHaveBeenCalled();
  });

  test('downloadState=not_downloaded applies no id filter when nothing is downloaded', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.findAll.mockResolvedValue(memberRows);
    deps.models.Video.findAll.mockResolvedValue([]);
    deps.models.PlaylistVideo.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: { downloadState: 'not_downloaded' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playlist_id: 'PLtest123' } })
    );
  });

  test('rejects an invalid downloadState with 400', async () => {
    const deps = buildDeps();

    const handler = getHandler('get', '/api/playlists/:playlistId/videos', deps);
    const req = { params: { playlistId: 'PLtest123' }, query: { downloadState: 'sideways' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('downloadState') });
    expect(deps.models.PlaylistVideo.findAndCountAll).not.toHaveBeenCalled();
  });
});

describe('POST /api/playlists/:playlistId/refresh', () => {
  test('refreshes playlist videos and returns count', async () => {
    const deps = buildDeps();
    deps.playlistModule.fetchAllPlaylistVideos.mockResolvedValue(10);
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/refresh', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.playlistModule.fetchAllPlaylistVideos).toHaveBeenCalledWith('PLtest123');
    expect(res.json).toHaveBeenCalledWith({ fetched: 10 });
  });

  test('ignores a legacy fetchAll body field from older cached clients', async () => {
    const deps = buildDeps();
    deps.playlistModule.fetchAllPlaylistVideos.mockResolvedValue(42);
    deps.models.Playlist.findOne.mockResolvedValue(makePlaylist());

    const handler = getHandler('post', '/api/playlists/:playlistId/refresh', deps);
    const req = { params: { playlistId: 'PLtest123' }, body: { fetchAll: 'not-a-boolean' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.playlistModule.fetchAllPlaylistVideos).toHaveBeenCalledWith('PLtest123');
    expect(res.json).toHaveBeenCalledWith({ fetched: 42 });
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('returns 404 for a soft-deleted playlist without fetching', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('post', '/api/playlists/:playlistId/refresh', deps);
    const req = { params: { playlistId: 'PLdeleted' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.Playlist.findOne).toHaveBeenCalledWith({
      where: { playlist_id: 'PLdeleted', enabled: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
    expect(deps.playlistModule.fetchAllPlaylistVideos).not.toHaveBeenCalled();
  });

  test('returns 409 when a fetch is already in progress', async () => {
    const deps = buildDeps();
    deps.playlistModule.fetchAllPlaylistVideos.mockRejectedValue(new Error('FETCH_IN_PROGRESS'));

    const handler = getHandler('post', '/api/playlists/:playlistId/refresh', deps);
    const req = { params: { playlistId: 'PLtest123' }, body: { fetchAll: true }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'A fetch is already in progress for this playlist' });
  });

  test('returns 500 on fetch error', async () => {
    const deps = buildDeps();
    deps.playlistModule.fetchAllPlaylistVideos.mockRejectedValue(new Error('yt-dlp failed'));

    const handler = getHandler('post', '/api/playlists/:playlistId/refresh', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to refresh playlist' });
  });
});

describe('POST /api/playlists/:playlistId/sync', () => {
  test('returns 202 immediately without awaiting the sync', async () => {
    const playlist = makePlaylist();
    let releaseSync;
    const syncGate = new Promise((resolve) => { releaseSync = resolve; });
    const deps = buildDeps({
      Playlist: { findOne: jest.fn().mockResolvedValue(playlist) },
      mediaServers: { mediaServerSync: { syncPlaylist: jest.fn().mockReturnValue(syncGate) } },
    });
    const handler = getHandler('post', '/api/playlists/:playlistId/sync', deps);
    const res = createResponse();

    await handler({ params: { playlistId: 'PLtest123' }, log: loggerMock }, res);

    // Responded while the sync promise is still pending.
    expect(deps.mediaServers.mediaServerSync.syncPlaylist).toHaveBeenCalledWith(playlist.id);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    releaseSync();
  });

  test('returns 404 when the playlist does not exist or is soft-deleted', async () => {
    const deps = buildDeps({
      Playlist: { findOne: jest.fn().mockResolvedValue(null) },
    });
    const handler = getHandler('post', '/api/playlists/:playlistId/sync', deps);
    const res = createResponse();
    await handler({ params: { playlistId: 'nope' }, log: loggerMock }, res);
    expect(deps.models.Playlist.findOne).toHaveBeenCalledWith({
      where: { playlist_id: 'nope', enabled: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });

  test('returns 500 on db error', async () => {
    const deps = buildDeps({
      Playlist: { findOne: jest.fn().mockRejectedValue(new Error('db down')) },
    });
    const handler = getHandler('post', '/api/playlists/:playlistId/sync', deps);
    const res = createResponse();
    await handler({ params: { playlistId: 'PLtest123' }, log: loggerMock }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Sync failed' });
  });

  test('logs sync failures that happen after the response was sent', async () => {
    const playlist = makePlaylist();
    const deps = buildDeps({
      Playlist: { findOne: jest.fn().mockResolvedValue(playlist) },
      mediaServers: { mediaServerSync: { syncPlaylist: jest.fn().mockRejectedValue(new Error('plex down')) } },
    });
    const handler = getHandler('post', '/api/playlists/:playlistId/sync', deps);
    const res = createResponse();
    await handler({ params: { playlistId: 'PLtest123' }, log: loggerMock }, res);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toHaveBeenCalledWith(202);
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), playlist_id: 'PLtest123' }),
      expect.stringContaining('background playlist sync failed')
    );
  });
});

describe('POST /api/playlists/:playlistId/download', () => {
  test('returns 202 and fires doPlaylistDownloads', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.downloadModule.doPlaylistDownloads).toHaveBeenCalledWith(p, {
      youtubeIds: undefined,
      overrideSettings: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ status: 'accepted', message: 'Playlist download started' });
  });

  test('returns 404 when playlist not found or soft-deleted, without starting downloads', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = { params: { playlistId: 'nope' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.Playlist.findOne).toHaveBeenCalledWith({
      where: { playlist_id: 'nope', enabled: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
    expect(deps.downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
  });

  test('does not reject the response when doPlaylistDownloads rejects (fire-and-forget)', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);
    deps.downloadModule.doPlaylistDownloads.mockRejectedValue(new Error('yt-dlp missing'));

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    // Response is 202 regardless — error is logged asynchronously
    expect(res.status).toHaveBeenCalledWith(202);
  });

  test('passes videoIds through to doPlaylistDownloads when provided', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { videoIds: ['vidA', 'vidB'] },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(deps.downloadModule.doPlaylistDownloads).toHaveBeenCalledWith(p, {
      youtubeIds: ['vidA', 'vidB'],
      overrideSettings: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(202);
  });

  test('returns 400 when videoIds is not an array of non-empty strings', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { videoIds: ['ok', ''] },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'videoIds must be an array of video ids' });
    expect(deps.downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
  });

  test('returns 400 when videoIds is not an array', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(makePlaylist());

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = { params: { playlistId: 'PLtest123' }, body: { videoIds: 'notanarray' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(deps.downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
  });

  test('returns 400 when videoIds is an empty array', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(makePlaylist());

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = { params: { playlistId: 'PLtest123' }, body: { videoIds: [] }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(deps.downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
  });

  test('forwards validated overrideSettings to doPlaylistDownloads', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { videoIds: ['vidA'], overrideSettings: { resolution: '720', allowRedownload: true } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(deps.downloadModule.doPlaylistDownloads).toHaveBeenCalledWith(p, {
      youtubeIds: ['vidA'],
      overrideSettings: { resolution: '720', allowRedownload: true },
    });
  });

  test('rejects malformed overrideSettings with 400', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { overrideSettings: { resolution: 'banana' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid overrideSettings' });
    expect(deps.downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
  });

  test('rejects a subfolder override the subfolder validator deems invalid', async () => {
    const deps = buildDeps({
      channelSettingsModule: {
        validateSubFolder: jest.fn().mockReturnValue({ valid: false, error: 'bad' }),
      },
    });
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { overrideSettings: { subfolder: 'a/../../etc' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(deps.channelSettingsModule.validateSubFolder).toHaveBeenCalledWith('a/../../etc');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid overrideSettings' });
    expect(deps.downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
  });

  test('forwards a valid subfolder override', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { overrideSettings: { subfolder: 'Movies' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(deps.channelSettingsModule.validateSubFolder).toHaveBeenCalledWith('Movies');
    expect(res.status).toHaveBeenCalledWith(202);
    expect(deps.downloadModule.doPlaylistDownloads).toHaveBeenCalledWith(p, {
      youtubeIds: undefined,
      overrideSettings: { subfolder: 'Movies' },
    });
  });

  test('rejects an invalid rating override with 400', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { overrideSettings: { rating: 'banana' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid overrideSettings' });
    expect(deps.downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
  });

  test('forwards a valid rating override, normalized', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { overrideSettings: { rating: 'pg-13' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(deps.downloadModule.doPlaylistDownloads).toHaveBeenCalledWith(p, {
      youtubeIds: undefined,
      overrideSettings: { rating: 'PG-13' },
    });
  });

  test('normalizes an NR rating override to null', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = {
      params: { playlistId: 'PLtest123' },
      body: { overrideSettings: { rating: 'NR' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(deps.downloadModule.doPlaylistDownloads).toHaveBeenCalledWith(p, {
      youtubeIds: undefined,
      overrideSettings: { rating: null },
    });
  });
});

describe('POST /api/playlists/:playlistId/regenerate-m3u', () => {
  test('regenerates m3u and returns success', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);
    deps.m3uGenerator.generatePlaylistM3U.mockResolvedValue(true);

    const handler = getHandler('post', '/api/playlists/:playlistId/regenerate-m3u', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.m3uGenerator.generatePlaylistM3U).toHaveBeenCalledWith(p.id);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('returns 404 when playlist not found', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('post', '/api/playlists/:playlistId/regenerate-m3u', deps);
    const req = { params: { playlistId: 'nonexistent' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });

  test('returns 500 on m3u error', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);
    deps.m3uGenerator.generatePlaylistM3U.mockRejectedValue(new Error('write failed'));

    const handler = getHandler('post', '/api/playlists/:playlistId/regenerate-m3u', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'M3U regen failed' });
  });
});

describe('POST /api/playlists/:playlistId/videos/:ytId/ignore', () => {
  test('returns 404 for a soft-deleted playlist without updating the row', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('post', '/api/playlists/:playlistId/videos/:ytId/ignore', deps);
    const req = { params: { playlistId: 'PLdeleted', ytId: 'v1' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
    expect(deps.models.PlaylistVideo.update).not.toHaveBeenCalled();
  });

  test('marks a video as ignored', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.update.mockResolvedValue([1]);

    const handler = getHandler('post', '/api/playlists/:playlistId/videos/:ytId/ignore', deps);
    const req = { params: { playlistId: 'PLtest123', ytId: 'vid1' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.update).toHaveBeenCalledWith(
      { ignored: true, ignored_at: expect.any(Date) },
      { where: { playlist_id: 'PLtest123', youtube_id: 'vid1' } }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('returns 500 on db error', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.update.mockRejectedValue(new Error('db error'));

    const handler = getHandler('post', '/api/playlists/:playlistId/videos/:ytId/ignore', deps);
    const req = { params: { playlistId: 'PLtest123', ytId: 'vid1' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ignore failed' });
  });
});

describe('POST /api/playlists/:playlistId/videos/:ytId/unignore', () => {
  test('returns 404 for a soft-deleted playlist without updating the row', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('post', '/api/playlists/:playlistId/videos/:ytId/unignore', deps);
    const req = { params: { playlistId: 'PLdeleted', ytId: 'v1' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
    expect(deps.models.PlaylistVideo.update).not.toHaveBeenCalled();
  });

  test('removes ignored status from a video', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.update.mockResolvedValue([1]);

    const handler = getHandler('post', '/api/playlists/:playlistId/videos/:ytId/unignore', deps);
    const req = { params: { playlistId: 'PLtest123', ytId: 'vid1' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.models.PlaylistVideo.update).toHaveBeenCalledWith(
      { ignored: false, ignored_at: null },
      { where: { playlist_id: 'PLtest123', youtube_id: 'vid1' } }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('returns 500 on db error', async () => {
    const deps = buildDeps();
    deps.models.PlaylistVideo.update.mockRejectedValue(new Error('db error'));

    const handler = getHandler('post', '/api/playlists/:playlistId/videos/:ytId/unignore', deps);
    const req = { params: { playlistId: 'PLtest123', ytId: 'vid1' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unignore failed' });
  });
});
