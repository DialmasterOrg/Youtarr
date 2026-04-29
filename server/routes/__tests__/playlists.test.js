/* eslint-env jest */
const express = require('express');
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
    ...overrides.mediaServers,
  },
  models: {
    Playlist: {
      findAndCountAll: jest.fn(),
      findOne: jest.fn(),
      ...overrides.Playlist,
    },
    PlaylistVideo: {
      findAndCountAll: jest.fn(),
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
      where: { playlist_id: 'PLtest123' },
    });
    expect(res.json).toHaveBeenCalledWith({ playlist });
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
    deps.playlistModule.upsertPlaylist.mockResolvedValue(created);
    deps.playlistModule.fetchAllPlaylistVideos.mockResolvedValue(5);

    const handler = getHandler('post', '/api/playlists', deps);
    const req = { body: { url: 'https://youtube.com/playlist?list=PLtest' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.playlistModule.getPlaylistInfo).toHaveBeenCalledWith('https://youtube.com/playlist?list=PLtest');
    expect(deps.playlistModule.upsertPlaylist).toHaveBeenCalledWith(info, { enabled: true, settings: {} });
    expect(deps.playlistModule.fetchAllPlaylistVideos).toHaveBeenCalledWith(created.playlist_id);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ playlist: created });
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
      video_id: 42,
      file_path: '/videos/downloaded1.mp4',
      file_size: 1024,
    });
    expect(payload.videos[1]).toMatchObject({
      youtube_id: 'tracked2',
      title: 'A tracked video',
      duration: 456,
      published_at: '20260215',
      thumbnail: 'https://thumb/2.jpg',
      downloaded: false,
      video_id: null,
    });
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
  test('syncs playlist to media servers', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);

    const handler = getHandler('post', '/api/playlists/:playlistId/sync', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.mediaServers.mediaServerSync.syncPlaylist).toHaveBeenCalledWith(p.id);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('returns 404 when playlist not found', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('post', '/api/playlists/:playlistId/sync', deps);
    const req = { params: { playlistId: 'nonexistent' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Playlist not found' });
  });

  test('returns 500 on sync error', async () => {
    const deps = buildDeps();
    const p = makePlaylist();
    deps.models.Playlist.findOne.mockResolvedValue(p);
    deps.mediaServers.mediaServerSync.syncPlaylist.mockRejectedValue(new Error('plex down'));

    const handler = getHandler('post', '/api/playlists/:playlistId/sync', deps);
    const req = { params: { playlistId: 'PLtest123' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Sync failed' });
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

    expect(deps.downloadModule.doPlaylistDownloads).toHaveBeenCalledWith(p);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ status: 'accepted', message: 'Playlist download started' });
  });

  test('returns 404 when playlist not found', async () => {
    const deps = buildDeps();
    deps.models.Playlist.findOne.mockResolvedValue(null);

    const handler = getHandler('post', '/api/playlists/:playlistId/download', deps);
    const req = { params: { playlistId: 'nope' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

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
