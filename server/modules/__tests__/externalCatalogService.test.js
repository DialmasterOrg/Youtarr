jest.mock('../../db', () => ({
  sequelize: { query: jest.fn() },
}));
jest.mock('../configModule', () => ({
  getImagePath: jest.fn(() => '/safe/images'),
}));

const { sequelize } = require('../../db');
const catalog = require('../externalCatalogService');

const key = (overrides = {}) => ({
  id: 4,
  maxRatingLevel: 2,
  allowUnrated: false,
  allowedMediaTypes: ['video'],
  ...overrides,
});

describe('external cached catalog', () => {
  beforeEach(() => jest.clearAllMocks());

  test('lists only granted enabled channels with SQL paging and policy-filtered counts', async () => {
    sequelize.query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{
        id: 8, channel_id: 'UCsafe', title: 'Safe Channel', description: 'Description',
        sub_folder: 'Kids', lastFetchedByTab: '{"video":"2026-07-20T00:00:00.000Z"}',
        videoCount: '12', downloadedCount: '3',
      }]);
    const result = await catalog.listChannels(key(), {
      page: '2', pageSize: '10', search: 'safe', sortBy: 'videoCount', sortOrder: 'desc',
    });

    expect(result.data[0]).toEqual(expect.objectContaining({
      id: 8,
      channelId: 'UCsafe',
      thumbnailUrl: '/external-api/v1/assets/channels/8/thumbnail',
      videoCount: 12,
      downloadedCount: 3,
    }));
    expect(result.pagination).toEqual({
      page: 2, pageSize: 10, total: 1, totalPages: 1, nextCursor: null,
    });
    const listSql = sequelize.query.mock.calls[1][0];
    const options = sequelize.query.mock.calls[1][1];
    expect(listSql).toContain('INNER JOIN api_key_channel_grants');
    expect(listSql).toContain('g.api_key_id = :keyId');
    expect(listSql).toContain('LIMIT :pageSize OFFSET :offset');
    expect(listSql).toContain(
      'COALESCE(NULLIF(v.normalized_rating, \'\'), NULLIF(c.default_rating, \'\'))'
    );
    expect(options.replacements).toEqual(expect.objectContaining({ keyId: 4, pageSize: 10, offset: 10 }));
    expect(options.replacements.allowedRatings).toContain('TV-Y7');
    expect(options.replacements.recognizedRatings).toContain('TV-Y7');
  });

  test('validates paging and sorting instead of interpolating user input', async () => {
    await expect(catalog.listChannels(key(), { pageSize: '101' })).rejects.toThrow('pageSize');
    await expect(catalog.listChannels(key(), { sortBy: 'title; DROP TABLE channels' })).rejects.toThrow('sortBy');
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  test('enforces grants, media type, rating, duration, date, and deterministic SQL paging', async () => {
    sequelize.query
      .mockResolvedValueOnce([{
        id: 8, channel_id: 'UCsafe', title: 'Safe Channel',
        lastFetchedByTab: '{"short":"2026-07-20T00:00:00.000Z"}',
      }])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{
        youtube_id: 'abc', title: 'Allowed', thumbnail: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
        publishedAt: '2026-07-10T00:00:00.000Z', published_at_source: 'exact',
        duration: 90, media_type: 'short', description: null, downloaded_id: null,
        downloaded_removed: null, rating: 'TV-Y', request_status: 'processing',
      }]);
    const result = await catalog.listChannelVideos(
      key({ allowedMediaTypes: ['video', 'short'] }),
      '8',
      {
        tabType: 'shorts', minDuration: '30', maxDuration: '120',
        dateFrom: '2026-07-01', dateTo: '2026-07-31', pageSize: '20',
      }
    );

    expect(result.data[0]).toEqual(expect.objectContaining({
      youtubeId: 'abc', rating: 'TV-Y', channelId: 'UCsafe', mediaType: 'short',
      thumbnailUrl: '/external-api/v1/assets/videos/abc/thumbnail',
      isDownloaded: false, isRequested: true, requestStatus: 'processing',
    }));
    expect(result.isFullyIndexed).toBe(true);
    const channelSql = sequelize.query.mock.calls[0][0];
    const listSql = sequelize.query.mock.calls[2][0];
    expect(channelSql).toContain('INNER JOIN api_key_channel_grants');
    expect(channelSql).toContain('c.enabled = true');
    expect(channelSql).toContain('c.terminated_at IS NULL');
    expect(listSql).toContain('cv.media_type = :mediaType');
    expect(listSql).toContain('cv.duration >= :minDuration');
    expect(listSql).toContain('cv.duration <= :maxDuration');
    expect(listSql).toContain('cv.published_at >= :dateFrom');
    expect(listSql).toContain(
      'ORDER BY COALESCE(cv.published_at, \'\') DESC, c.id ASC, cv.youtube_id ASC'
    );
    expect(listSql).toContain('LIMIT :fetchLimit OFFSET :offset');
    expect(listSql).toContain('FROM external_requests er');
    expect(listSql).toContain('er.api_key_id = :keyId');
  });

  test('returns the complete deterministic cross-channel catalog beyond the former three-page cap', async () => {
    sequelize.query
      .mockResolvedValueOnce([{ total: 1000 }])
      .mockResolvedValueOnce([{
        youtube_id: 'abcdefghijk',
        title: 'Safe candidate',
        thumbnail: '/cached/private-thumbnail.jpg',
        publishedAt: '2026-07-10T00:00:00.000Z',
        published_at_source: 'exact',
        duration: 120,
        media_type: 'video',
        description: null,
        downloaded_id: null,
        downloaded_removed: null,
        rating: 'TV-Y',
        channel_database_id: 8,
        channel_id: 'UCsafe',
        channel_title: 'Safe Channel',
        request_status: 'failed',
      }]);

    const result = await catalog.listVideos(key(), {
      page: '3',
      pageSize: '100',
      status: 'available',
    });

    expect(result).toMatchObject({
      data: [{
        youtubeId: 'abcdefghijk',
        channelDatabaseId: 8,
        thumbnailUrl: '/external-api/v1/assets/videos/abcdefghijk/thumbnail',
        isRequested: false,
        requestStatus: 'failed',
      }],
      pagination: {
        page: 3, pageSize: 100, total: 1000, totalPages: 10, nextCursor: null,
      },
      dataSource: 'cache',
      isFullyIndexed: true,
    });
    const listSql = sequelize.query.mock.calls[1][0];
    expect(listSql).toContain('INNER JOIN api_key_channel_grants');
    expect(listSql).toContain('c.terminated_at IS NULL');
    expect(listSql).toContain(
      'ORDER BY COALESCE(cv.published_at, \'\') DESC, c.id ASC, cv.youtube_id ASC'
    );
    expect(listSql).toContain('LIMIT :fetchLimit OFFSET :offset');
    expect(sequelize.query.mock.calls[1][1].replacements).toMatchObject({
      keyId: 4,
      fetchLimit: 101,
      offset: 200,
    });

    sequelize.query.mockClear();
    sequelize.query.mockResolvedValueOnce([{ total: 1000 }]).mockResolvedValueOnce([]);
    await expect(catalog.listVideos(key(), { page: '4', pageSize: '100' }))
      .resolves.toMatchObject({ pagination: { page: 4, totalPages: 10 } });
    sequelize.query.mockClear();
    await expect(catalog.listVideos(key(), { page: '101', pageSize: '100' }))
      .rejects.toThrow('page must be between 1 and 100');
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  test('filters requestable rows server-side and keeps active requests in available results', async () => {
    sequelize.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    await catalog.listVideos(key(), {
      status: 'requestable',
      minDuration: '30',
      maxDuration: '600',
      dateFrom: '2026-01-01',
      dateTo: '2026-07-31',
    });
    const requestableSql = sequelize.query.mock.calls[1][0];
    expect(requestableSql).toContain('(v.id IS NULL OR v.removed = true)');
    expect(requestableSql).toContain('NOT EXISTS');
    expect(requestableSql).toContain('er2.status IN (\'pending\', \'approved\', \'processing\')');
    expect(requestableSql).toContain('cv.duration >= :minDuration');
    expect(requestableSql).toContain('cv.duration <= :maxDuration');
    expect(requestableSql).toContain('cv.published_at >= :dateFrom');
    expect(requestableSql).toContain('cv.published_at <= :dateTo');

    sequelize.query.mockClear();
    sequelize.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    await catalog.listVideos(key(), { status: 'available' });
    const availableSql = sequelize.query.mock.calls[1][0];
    expect(availableSql).toContain('(v.id IS NULL OR v.removed = true)');
    expect(availableSql).not.toContain('NOT EXISTS');
  });

  test('uses filter-bound keyset cursors and rejects changed filters or sorting', async () => {
    const first = {
      youtube_id: 'aaaaaaaaaaa',
      title: 'Same title',
      publishedAt: null,
      published_at_source: 'approximate',
      duration: null,
      media_type: 'video',
      downloaded_id: null,
      downloaded_removed: null,
      rating: 'TV-Y',
      channel_database_id: 8,
      channel_id: 'UCsafe',
      channel_title: 'Safe Channel',
      request_status: null,
      cursor_sort_value: '',
    };
    const lookahead = {
      ...first,
      youtube_id: 'bbbbbbbbbbb',
      channel_database_id: 9,
      channel_id: 'UCother',
      channel_title: 'Other Channel',
    };
    sequelize.query
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([first, lookahead]);

    const firstPage = await catalog.listVideos(key(), {
      pageSize: '1',
      status: 'all',
      sortBy: 'date',
      sortOrder: 'desc',
    });
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.pagination.nextCursor).toEqual(expect.any(String));

    sequelize.query.mockClear();
    sequelize.query
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([lookahead]);
    const secondPage = await catalog.listVideos(key(), {
      pageSize: '1',
      status: 'all',
      sortBy: 'date',
      sortOrder: 'desc',
      cursor: firstPage.pagination.nextCursor,
    });
    expect(secondPage.data[0].youtubeId).toBe('bbbbbbbbbbb');
    const seekSql = sequelize.query.mock.calls[1][0];
    expect(seekSql).toContain('COALESCE(cv.published_at, \'\') < :cursorSortValue');
    expect(seekSql).toContain('c.id > :cursorChannelDatabaseId');
    expect(seekSql).not.toContain('OFFSET :offset');

    await expect(catalog.listVideos(key(), {
      cursor: firstPage.pagination.nextCursor,
      status: 'requestable',
    })).rejects.toThrow('cursor is invalid');
    await expect(catalog.listVideos(key(), {
      cursor: firstPage.pagination.nextCursor,
      status: 'all',
      sortOrder: 'asc',
    })).rejects.toThrow('cursor is invalid');
    await expect(catalog.listVideos(key(), {
      cursor: Buffer.from(JSON.stringify({ v: 1, page: 2 })).toString('base64url'),
    })).rejects.toThrow('cursor is invalid');
    await expect(catalog.listVideos(key(), {
      cursor: 'not-a-cursor',
    })).rejects.toThrow('cursor is invalid');
    await expect(catalog.listVideos(key(), {
      cursor: firstPage.pagination.nextCursor,
      page: '2',
      pageSize: '1',
      status: 'all',
    })).rejects.toThrow('cursor and page cannot be used together');
  });

  test('fails closed for invalid policy and disallowed media without querying', async () => {
    await expect(catalog.listChannelVideos(key({ maxRatingLevel: 99 }), '8', {}))
      .rejects.toMatchObject({ status: 401 });
    await expect(catalog.listChannelVideos(key(), '8', { tabType: 'shorts' }))
      .rejects.toMatchObject({ status: 403 });
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  test('keeps TV-Y7 in the rated policy branch when unrated content is allowed', async () => {
    sequelize.query
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await catalog.listChannels(key({ allowUnrated: true }), {});

    const options = sequelize.query.mock.calls[1][1];
    expect(options.replacements.allowedRatings).toContain('TV-Y7');
    expect(options.replacements.recognizedRatings).toContain('TV-Y7');
  });

  test('returns the same 404 for missing and ungranted channels', async () => {
    sequelize.query.mockResolvedValueOnce([]);
    await expect(catalog.listChannelVideos(key(), '99', {}))
      .rejects.toMatchObject({ status: 404, message: 'Channel not found' });
  });

  test('returns one eligible video with full modal metadata and no filesystem paths', async () => {
    sequelize.query.mockResolvedValueOnce([{
      youtube_id: 'abcdefghijk',
      title: 'Detailed video',
      publishedAt: '2026-07-10T00:00:00.000Z',
      published_at_source: 'exact',
      duration: 120,
      media_type: 'video',
      availability: 'public',
      description: 'database fallback',
      downloaded_id: 42,
      downloaded_removed: false,
      last_downloaded_at: '2026-07-20T12:00:00.000Z',
      fileSize: '12345',
      audioFileSize: '678',
      protected: true,
      rating_source: 'manual',
      video_resolution: '1920x1080',
      rating: 'TV-Y7',
      channel_database_id: 8,
      channel_id: 'UCsafe',
      channel_title: 'Safe Channel',
      request_status: 'approved',
    }]);
    const metadataService = {
      getVideoMetadata: jest.fn().mockResolvedValue({
        description: 'full description',
        viewCount: 1000,
        likeCount: 50,
        tags: ['one', 'two'],
        relatedFiles: [{ fileName: 'captions.srt', fileSize: 30, type: 'Subtitles' }],
      }),
    };

    const result = await catalog.getVideoDetail(key(), 'abcdefghijk', metadataService);

    expect(result).toMatchObject({
      youtubeId: 'abcdefghijk',
      thumbnailUrl: '/external-api/v1/assets/videos/abcdefghijk/thumbnail',
      isDownloaded: true,
      isRequested: true,
      requestStatus: 'approved',
      downloadedAt: '2026-07-20T12:00:00.000Z',
      fileSize: 12345,
      audioFileSize: 678,
      isProtected: true,
      videoResolution: '1920x1080',
      metadata: {
        description: 'full description',
        viewCount: 1000,
        relatedFiles: [{ fileName: 'captions.srt', fileSize: 30, type: 'Subtitles' }],
      },
    });
    expect(result).not.toHaveProperty('filePath');
    expect(result).not.toHaveProperty('audioFilePath');
    expect(metadataService.getVideoMetadata).toHaveBeenCalledWith('abcdefghijk');
    expect(sequelize.query.mock.calls[0][0]).toContain('INNER JOIN api_key_channel_grants');
  });

  test('returns 404 without fetching metadata when video is not eligible', async () => {
    sequelize.query.mockResolvedValueOnce([]);
    const metadataService = { getVideoMetadata: jest.fn() };

    await expect(catalog.getVideoDetail(key(), 'abcdefghijk', metadataService))
      .rejects.toMatchObject({ status: 404, message: 'Video not found' });
    expect(metadataService.getVideoMetadata).not.toHaveBeenCalled();
  });

  test('falls back to the stored description when extended metadata has none', async () => {
    sequelize.query.mockResolvedValueOnce([{
      youtube_id: 'abcdefghijk',
      title: 'Detailed video',
      media_type: 'video',
      description: 'database fallback',
      channel_database_id: 8,
      channel_id: 'UCsafe',
      channel_title: 'Safe Channel',
    }]);
    const metadataService = {
      getVideoMetadata: jest.fn().mockResolvedValue({ description: null }),
    };

    const result = await catalog.getVideoDetail(key(), 'abcdefghijk', metadataService);
    expect(result.metadata.description).toBe('database fallback');
  });

  test('rejects unsafe cached thumbnail identifiers without exposing a path', async () => {
    sequelize.query.mockResolvedValueOnce([{ channel_id: '../../secret' }]);
    await expect(catalog.getChannelThumbnail(key(), '8'))
      .rejects.toMatchObject({ status: 404, message: 'Thumbnail not found' });
  });

  test('only exposes HTTPS thumbnail URLs from known YouTube image hosts', () => {
    expect(catalog.publicVideoThumbnail('https://i.ytimg.com/vi/abc/hqdefault.jpg')).toContain('ytimg.com');
    expect(catalog.publicVideoThumbnail('http://i.ytimg.com/vi/abc/hqdefault.jpg')).toBeNull();
    expect(catalog.publicVideoThumbnail('https://example.com/tracker.jpg')).toBeNull();
    expect(catalog.publicVideoThumbnail('/images/local-secret.jpg')).toBeNull();
  });

  test('uses the API asset route for every catalog video thumbnail', () => {
    expect(catalog.videoThumbnailUrl('abcdefghijk'))
      .toBe('/external-api/v1/assets/videos/abcdefghijk/thumbnail');
  });

  test('falls back through Youtarr to a safe upstream thumbnail when no local image exists', async () => {
    sequelize.query.mockResolvedValueOnce([{
      youtube_id: 'abcdefghijk',
      thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
    }]);

    await expect(catalog.getVideoThumbnail(key(), 'abcdefghijk')).resolves.toEqual({
      source: 'upstream',
      url: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
    });
  });
});
