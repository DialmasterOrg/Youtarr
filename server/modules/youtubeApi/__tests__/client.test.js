const { YoutubeApiErrorCode } = require('../errorClassifier');

describe('youtubeApi/client', () => {
  let client;
  let axios;
  let quotaTracker;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.mock('axios', () => ({ get: jest.fn() }));
    jest.mock('../../../logger', () => ({
      info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn(),
    }));
    jest.mock('../quotaTracker', () => ({
      isInCooldown: jest.fn(() => false),
      markExhausted: jest.fn(),
    }));
    axios = require('axios');
    quotaTracker = require('../quotaTracker');
    client = require('../client');
  });

  describe('testKey', () => {
    test('returns ok:true when the key is valid', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { items: [{ id: 'dQw4w9WgXcQ' }] },
      });

      const result = await client.testKey('test-key-123');

      expect(result).toEqual({ ok: true });
      expect(axios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/videos',
        expect.objectContaining({
          params: expect.objectContaining({
            key: 'test-key-123',
            id: 'dQw4w9WgXcQ',
            part: 'id',
          }),
          timeout: 15000,
        })
      );
    });

    test('returns ok:false with code when axios throws', async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: { errors: [{ reason: 'keyInvalid' }] } },
        },
      });

      const result = await client.testKey('bad-key');

      expect(result).toEqual({ ok: false, code: YoutubeApiErrorCode.KEY_INVALID });
    });

    test('marks quota exhausted on 403 quotaExceeded and returns that code', async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 403,
          data: { error: { errors: [{ reason: 'quotaExceeded' }] } },
        },
      });

      const result = await client.testKey('some-key');

      expect(result).toEqual({ ok: false, code: YoutubeApiErrorCode.QUOTA_EXCEEDED });
      expect(quotaTracker.markExhausted).toHaveBeenCalledWith('some-key');
    });

    test('returns QUOTA_EXCEEDED immediately when tracker is in cooldown', async () => {
      quotaTracker.isInCooldown.mockReturnValueOnce(true);

      const result = await client.testKey('some-key');

      expect(result).toEqual({ ok: false, code: YoutubeApiErrorCode.QUOTA_EXCEEDED });
      expect(quotaTracker.isInCooldown).toHaveBeenCalledWith('some-key');
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('getVideoMetadata', () => {
    test('fetches and returns normalized metadata for a single id', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [{
            id: 'abc12345678',
            snippet: {
              title: 'Example video',
              description: 'A description',
              publishedAt: '2024-01-15T10:00:00Z',
              channelId: 'UCxxx',
              channelTitle: 'Some Channel',
              tags: ['foo', 'bar'],
              categoryId: '22',
            },
            contentDetails: { duration: 'PT3M45S' },
            statistics: { viewCount: '12345', likeCount: '67', commentCount: '8' },
            status: { privacyStatus: 'public' },
          }],
        },
      });

      const [meta] = await client.getVideoMetadata('api-key', ['abc12345678']);

      expect(meta).toMatchObject({
        id: 'abc12345678',
        title: 'Example video',
        description: 'A description',
        duration: 225,
        viewCount: 12345,
        likeCount: 67,
        commentCount: 8,
        uploadDate: '20240115',
        channelId: 'UCxxx',
        channelTitle: 'Some Channel',
        tags: ['foo', 'bar'],
        availability: 'public',
      });
    });

    test('batches ids 50 at a time', async () => {
      const ids = Array.from({ length: 120 }, (_, i) => `id${String(i).padStart(8, '0')}`);
      axios.get.mockResolvedValue({ status: 200, data: { items: [] } });

      await client.getVideoMetadata('api-key', ids);

      expect(axios.get).toHaveBeenCalledTimes(3);
      expect(axios.get.mock.calls[0][1].params.id.split(',')).toHaveLength(50);
      expect(axios.get.mock.calls[1][1].params.id.split(',')).toHaveLength(50);
      expect(axios.get.mock.calls[2][1].params.id.split(',')).toHaveLength(20);
    });

    test('throws YoutubeApiError when axios fails', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 403, data: { error: { errors: [{ reason: 'quotaExceeded' }] } } },
      });

      await expect(client.getVideoMetadata('key', ['abc12345678'])).rejects.toMatchObject({
        name: 'YoutubeApiError',
        code: YoutubeApiErrorCode.QUOTA_EXCEEDED,
      });
    });
  });

  describe('getChannelInfo', () => {
    test('resolves @handle URL via forHandle and returns videoCount', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [{
            id: 'UCxxxxx',
            snippet: {
              title: 'Example Channel',
              description: 'Channel desc',
              customUrl: '@example',
              thumbnails: { high: { url: 'https://yt3.ggpht.com/foo' } },
            },
            contentDetails: { relatedPlaylists: { uploads: 'UUxxxxx' } },
            statistics: { videoCount: '42' },
          }],
        },
      });

      const info = await client.getChannelInfo('api-key', 'https://www.youtube.com/@example');

      expect(axios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/channels',
        expect.objectContaining({
          params: expect.objectContaining({
            key: 'api-key',
            forHandle: '@example',
            part: 'snippet,contentDetails,statistics',
          }),
        })
      );
      expect(info).toMatchObject({
        channelId: 'UCxxxxx',
        title: 'Example Channel',
        uploadsPlaylistId: 'UUxxxxx',
        videoCount: 42,
        thumbnailUrl: 'https://yt3.ggpht.com/foo',
      });
    });

    test('resolves /channel/UCxxx URL via id', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [{
            id: 'UCxxxxx',
            snippet: { title: 'T' },
            contentDetails: { relatedPlaylists: { uploads: 'UUxxxxx' } },
            statistics: { videoCount: '1' },
          }],
        },
      });

      await client.getChannelInfo('api-key', 'https://www.youtube.com/channel/UCxxxxx');

      expect(axios.get.mock.calls[0][1].params).toEqual(expect.objectContaining({
        id: 'UCxxxxx',
        part: 'snippet,contentDetails,statistics',
      }));
    });

    test('returns videoCount=null when statistics are hidden', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [{
            id: 'UCxxxxx',
            snippet: { title: 'T' },
            contentDetails: { relatedPlaylists: { uploads: 'UUxxxxx' } },
            // no statistics block (owner hid count)
          }],
        },
      });

      const info = await client.getChannelInfo('api-key', 'https://www.youtube.com/channel/UCxxxxx');

      expect(info.videoCount).toBeNull();
    });

    test('returns null when no items match', async () => {
      axios.get.mockResolvedValueOnce({ status: 200, data: { items: [] } });
      const info = await client.getChannelInfo('api-key', 'https://www.youtube.com/@nonexistent');
      expect(info).toBeNull();
    });

    test('throws on unrecognized URL shape', async () => {
      await expect(client.getChannelInfo('api-key', 'https://example.com/not-youtube'))
        .rejects.toThrow(/Unrecognized YouTube channel URL/);
    });
  });

  describe('detectAvailableTabs', () => {
    const CHAN_X = 'UCxxxxxxxxxxxxxxxxxxxxxx';

    const mockChannelsListOnce = (channelId = CHAN_X) => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [{
            id: channelId,
            snippet: { title: 'Chan' },
            contentDetails: { relatedPlaylists: { uploads: `UU${channelId.slice(2)}` } },
          }],
        },
      });
    };

    const nonEmptyPlaylistResponse = {
      status: 200,
      data: { items: [{ id: 'pli-abc' }] },
    };

    const emptyPlaylistResponse = {
      status: 200,
      data: { items: [] },
    };

    test('returns all three tabs when every probe has content', async () => {
      mockChannelsListOnce(CHAN_X);
      axios.get.mockResolvedValueOnce(nonEmptyPlaylistResponse); // UULF
      axios.get.mockResolvedValueOnce(nonEmptyPlaylistResponse); // UUSH
      axios.get.mockResolvedValueOnce(nonEmptyPlaylistResponse); // UULV

      const { availableTabs } = await client.detectAvailableTabs('api-key', 'https://www.youtube.com/@chan');

      expect(availableTabs).toEqual(['videos', 'shorts', 'streams']);
      // Verify probes hit the correct playlist IDs
      const suffix = CHAN_X.slice(2);
      const playlistIds = axios.get.mock.calls.slice(1).map((c) => c[1].params.playlistId).sort();
      expect(playlistIds).toEqual([`UULF${suffix}`, `UULV${suffix}`, `UUSH${suffix}`]);
    });

    test('returns only videos when shorts/streams probes are empty', async () => {
      mockChannelsListOnce(CHAN_X);
      axios.get.mockResolvedValueOnce(nonEmptyPlaylistResponse); // UULF
      axios.get.mockResolvedValueOnce(emptyPlaylistResponse);    // UUSH
      axios.get.mockResolvedValueOnce(emptyPlaylistResponse);    // UULV

      const { availableTabs } = await client.detectAvailableTabs('api-key', 'https://www.youtube.com/@chan');

      expect(availableTabs).toEqual(['videos']);
    });

    test('treats per-probe 404 as tab absent, not a failure', async () => {
      mockChannelsListOnce(CHAN_X);
      axios.get.mockResolvedValueOnce(nonEmptyPlaylistResponse); // UULF
      // UUSH playlist does not exist
      axios.get.mockRejectedValueOnce({
        response: { status: 404, data: { error: { errors: [{ reason: 'playlistNotFound' }] } } },
      });
      axios.get.mockResolvedValueOnce(nonEmptyPlaylistResponse); // UULV

      const { availableTabs } = await client.detectAvailableTabs('api-key', 'https://www.youtube.com/@chan');

      expect(availableTabs).toEqual(['videos', 'streams']);
    });

    test('returns empty when getChannelInfo finds no channel', async () => {
      axios.get.mockResolvedValueOnce({ status: 200, data: { items: [] } });

      const { availableTabs, channelInfo } = await client.detectAvailableTabs(
        'api-key',
        'https://www.youtube.com/@nonexistent'
      );

      expect(availableTabs).toEqual([]);
      expect(channelInfo).toBeNull();
      // No playlist probes happened
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('propagates non-404 errors from a single probe', async () => {
      mockChannelsListOnce(CHAN_X);
      axios.get.mockResolvedValueOnce(nonEmptyPlaylistResponse); // UULF
      axios.get.mockRejectedValueOnce({
        response: { status: 403, data: { error: { errors: [{ reason: 'quotaExceeded' }] } } },
      });
      axios.get.mockResolvedValueOnce(nonEmptyPlaylistResponse); // UULV (may or may not be awaited)

      await expect(
        client.detectAvailableTabs('api-key', 'https://www.youtube.com/@chan')
      ).rejects.toMatchObject({
        name: 'YoutubeApiError',
        code: YoutubeApiErrorCode.QUOTA_EXCEEDED,
      });
    });
  });

  describe('searchVideos', () => {
    test('enriches normalized search results with duration and viewCount from videos.list', async () => {
      // search.list response
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            {
              id: { kind: 'youtube#video', videoId: 'abc12345678' },
              snippet: {
                title: 'Result 1',
                channelId: 'UCxxx',
                channelTitle: 'Channel X',
                publishedAt: '2024-06-01T00:00:00Z',
                thumbnails: { high: { url: 'https://t/1.jpg' } },
              },
            },
          ],
        },
      });
      // videos.list enrichment response (contentDetails + statistics)
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            {
              id: 'abc12345678',
              snippet: {},
              contentDetails: { duration: 'PT5M32S' },
              statistics: { viewCount: '4242' },
              status: { privacyStatus: 'public' },
            },
          ],
        },
      });

      const results = await client.searchVideos('api-key', 'test query', 10);

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(axios.get).toHaveBeenNthCalledWith(
        1,
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({
          params: expect.objectContaining({
            key: 'api-key',
            q: 'test query',
            type: 'video',
            part: 'snippet',
            // Always request the API's max page size; filtered + truncated
            // down to the caller's requested count after enrichment.
            maxResults: 50,
          }),
        })
      );
      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'https://www.googleapis.com/youtube/v3/videos',
        expect.objectContaining({
          params: expect.objectContaining({
            id: 'abc12345678',
            part: 'snippet,contentDetails,statistics,status',
          }),
        })
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        youtubeId: 'abc12345678',
        title: 'Result 1',
        channelId: 'UCxxx',
        channelName: 'Channel X',
        publishedAt: '2024-06-01T00:00:00.000Z',
        thumbnailUrl: 'https://t/1.jpg',
        duration: 332,
        viewCount: 4242,
      });
    });

    test('returns search-only results when videos.list enrichment fails', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            { id: { kind: 'youtube#video', videoId: 'vid12345678' }, snippet: { title: 'Vid', publishedAt: '2024-01-01T00:00:00Z' } },
          ],
        },
      });
      // videos.list throws (e.g. transient network error) - search must still succeed
      axios.get.mockRejectedValueOnce({
        response: { status: 500, data: { error: { errors: [{ reason: 'backendError' }] } } },
      });

      const results = await client.searchVideos('api-key', 'q', 10);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        youtubeId: 'vid12345678',
        duration: null,
        viewCount: null,
      });
    });

    test('ignores non-video items in response', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            { id: { kind: 'youtube#channel', channelId: 'UCxxx' }, snippet: { title: 'Chan' } },
            { id: { kind: 'youtube#video', videoId: 'vid12345678' }, snippet: { title: 'Vid', publishedAt: '2024-01-01T00:00:00Z' } },
          ],
        },
      });
      // videos.list enrichment for the single remaining video
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            { id: 'vid12345678', contentDetails: { duration: 'PT1M' }, statistics: { viewCount: '10' } },
          ],
        },
      });

      const results = await client.searchVideos('api-key', 'q', 10);
      expect(results).toHaveLength(1);
      expect(results[0].youtubeId).toBe('vid12345678');
      expect(results[0].duration).toBe(60);
    });

    test('returns empty array without calling videos.list when search has no matches', async () => {
      axios.get.mockResolvedValueOnce({ status: 200, data: { items: [] } });

      const results = await client.searchVideos('api-key', 'q', 10);

      expect(results).toEqual([]);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('filters out live and upcoming broadcasts before enrichment', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            {
              id: { kind: 'youtube#video', videoId: 'regular1234' },
              snippet: { title: 'Regular', publishedAt: '2024-01-01T00:00:00Z', liveBroadcastContent: 'none' },
            },
            {
              id: { kind: 'youtube#video', videoId: 'livenow1234' },
              snippet: { title: 'Live now', publishedAt: '2024-01-01T00:00:00Z', liveBroadcastContent: 'live' },
            },
            {
              id: { kind: 'youtube#video', videoId: 'upcoming123' },
              snippet: { title: 'Premiere', publishedAt: '2024-01-01T00:00:00Z', liveBroadcastContent: 'upcoming' },
            },
          ],
        },
      });
      // Enrichment call should only include the surviving regular video.
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            { id: 'regular1234', contentDetails: { duration: 'PT5M' }, statistics: { viewCount: '100' } },
          ],
        },
      });

      const results = await client.searchVideos('api-key', 'q', 10);

      expect(results).toHaveLength(1);
      expect(results[0].youtubeId).toBe('regular1234');
      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'https://www.googleapis.com/youtube/v3/videos',
        expect.objectContaining({ params: expect.objectContaining({ id: 'regular1234' }) })
      );
    });

    test('filters out Shorts shorter than 60 seconds after enrichment', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            { id: { kind: 'youtube#video', videoId: 'short000001' }, snippet: { title: 'Short', publishedAt: '2024-01-01T00:00:00Z' } },
            { id: { kind: 'youtube#video', videoId: 'exact60sss1' }, snippet: { title: 'Minute', publishedAt: '2024-01-01T00:00:00Z' } },
            { id: { kind: 'youtube#video', videoId: 'longvideo01' }, snippet: { title: 'Long', publishedAt: '2024-01-01T00:00:00Z' } },
          ],
        },
      });
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            { id: 'short000001', contentDetails: { duration: 'PT45S' }, statistics: { viewCount: '1' } },
            { id: 'exact60sss1', contentDetails: { duration: 'PT60S' }, statistics: { viewCount: '2' } },
            { id: 'longvideo01', contentDetails: { duration: 'PT10M' }, statistics: { viewCount: '3' } },
          ],
        },
      });

      const results = await client.searchVideos('api-key', 'q', 10);

      // 60s is kept (boundary), 45s is dropped, 10m is kept.
      expect(results.map((r) => r.youtubeId)).toEqual(['exact60sss1', 'longvideo01']);
    });

    test('keeps items whose enrichment row is missing so gaps do not silently drop videos', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            { id: { kind: 'youtube#video', videoId: 'enriched001' }, snippet: { title: 'Has metadata', publishedAt: '2024-01-01T00:00:00Z' } },
            { id: { kind: 'youtube#video', videoId: 'missingmeta' }, snippet: { title: 'No metadata row', publishedAt: '2024-01-01T00:00:00Z' } },
          ],
        },
      });
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            { id: 'enriched001', contentDetails: { duration: 'PT5M' }, statistics: { viewCount: '10' } },
            // missingmeta deliberately omitted
          ],
        },
      });

      const results = await client.searchVideos('api-key', 'q', 10);

      expect(results.map((r) => r.youtubeId)).toEqual(['enriched001', 'missingmeta']);
      expect(results[1].duration).toBeNull();
    });

    test('truncates filtered results down to requested count', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: { kind: 'youtube#video', videoId: `video0000${i}1` },
        snippet: { title: `V${i}`, publishedAt: '2024-01-01T00:00:00Z' },
      }));
      axios.get.mockResolvedValueOnce({ status: 200, data: { items } });
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: items.map((it) => ({
            id: it.id.videoId,
            contentDetails: { duration: 'PT5M' },
            statistics: { viewCount: '10' },
          })),
        },
      });

      const results = await client.searchVideos('api-key', 'q', 2);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.youtubeId)).toEqual(['video000001', 'video000011']);
    });

    test('truncates to requested count even when enrichment fails', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: { kind: 'youtube#video', videoId: `vidx00000${i}1` },
        snippet: { title: `V${i}`, publishedAt: '2024-01-01T00:00:00Z' },
      }));
      axios.get.mockResolvedValueOnce({ status: 200, data: { items } });
      axios.get.mockRejectedValueOnce({
        response: { status: 500, data: { error: { errors: [{ reason: 'backendError' }] } } },
      });

      const results = await client.searchVideos('api-key', 'q', 3);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.duration === null)).toBe(true);
    });

    test('passes abort signal to API calls and propagates cancellation', async () => {
      const controller = new AbortController();
      axios.get.mockRejectedValueOnce({ name: 'CanceledError', code: 'ERR_CANCELED' });

      await expect(
        client.searchVideos('api-key', 'q', 10, { signal: controller.signal })
      ).rejects.toMatchObject({
        name: 'YoutubeApiError',
        code: YoutubeApiErrorCode.CANCELED,
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({ signal: controller.signal })
      );
    });
  });
});
