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
      expect(quotaTracker.markExhausted).toHaveBeenCalledTimes(1);
    });

    test('returns QUOTA_EXCEEDED immediately when tracker is in cooldown', async () => {
      quotaTracker.isInCooldown.mockReturnValueOnce(true);

      const result = await client.testKey('some-key');

      expect(result).toEqual({ ok: false, code: YoutubeApiErrorCode.QUOTA_EXCEEDED });
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
    test('resolves @handle URL via forHandle', async () => {
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
            part: 'snippet,contentDetails',
          }),
        })
      );
      expect(info).toMatchObject({
        channelId: 'UCxxxxx',
        title: 'Example Channel',
        uploadsPlaylistId: 'UUxxxxx',
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
          }],
        },
      });

      await client.getChannelInfo('api-key', 'https://www.youtube.com/channel/UCxxxxx');

      expect(axios.get.mock.calls[0][1].params).toEqual(expect.objectContaining({
        id: 'UCxxxxx',
        part: 'snippet,contentDetails',
      }));
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

  describe('listChannelVideos', () => {
    test('fetches uploads playlist and lists videos', async () => {
      // channels.list
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [{
            id: 'UCxxx',
            snippet: { title: 'Chan', customUrl: '@chan' },
            contentDetails: { relatedPlaylists: { uploads: 'UUxxx' } },
          }],
        },
      });
      // playlistItems.list (single page)
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            { snippet: { resourceId: { videoId: 'v1aaaaaaaaa' }, title: 'V1', publishedAt: '2024-05-01T00:00:00Z' } },
            { snippet: { resourceId: { videoId: 'v2bbbbbbbbb' }, title: 'V2', publishedAt: '2024-04-30T00:00:00Z' } },
          ],
        },
      });
      // videos.list for full metadata
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            {
              id: 'v1aaaaaaaaa',
              snippet: { title: 'V1', publishedAt: '2024-05-01T00:00:00Z' },
              contentDetails: { duration: 'PT5M' },
              statistics: { viewCount: '100' },
              status: { privacyStatus: 'public' },
            },
            {
              id: 'v2bbbbbbbbb',
              snippet: { title: 'V2', publishedAt: '2024-04-30T00:00:00Z' },
              contentDetails: { duration: 'PT10M' },
              statistics: { viewCount: '200' },
              status: { privacyStatus: 'public' },
            },
          ],
        },
      });

      const result = await client.listChannelVideos('api-key', 'https://www.youtube.com/@chan', {
        maxVideos: 100,
        includeMetadata: true,
      });

      expect(result.videos).toHaveLength(2);
      expect(result.videos[0]).toMatchObject({ id: 'v1aaaaaaaaa', duration: 300 });
      expect(result.currentChannelUrl).toBe('https://www.youtube.com/@chan');
    });

    test('paginates playlistItems until maxVideos reached', async () => {
      // channels.list
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { items: [{ id: 'UCxxx', snippet: {}, contentDetails: { relatedPlaylists: { uploads: 'UUxxx' } } }] },
      });
      // Two pages of playlistItems (50 + 30)
      const page1 = Array.from({ length: 50 }, (_, i) => ({ snippet: { resourceId: { videoId: `p1id${i}` }, title: `V${i}` } }));
      const page2 = Array.from({ length: 30 }, (_, i) => ({ snippet: { resourceId: { videoId: `p2id${i}` }, title: `V${i + 50}` } }));
      axios.get.mockResolvedValueOnce({ status: 200, data: { items: page1, nextPageToken: 'tok' } });
      axios.get.mockResolvedValueOnce({ status: 200, data: { items: page2 } });

      const result = await client.listChannelVideos('api-key', 'https://www.youtube.com/channel/UCxxx', {
        maxVideos: 100,
        includeMetadata: false,
      });

      expect(result.videos).toHaveLength(80);
      expect(axios.get).toHaveBeenCalledTimes(3); // channels + 2x playlistItems
      expect(axios.get.mock.calls[2][1].params.pageToken).toBe('tok');
    });
  });

  describe('searchVideos', () => {
    test('returns normalized search results without calling videos.list', async () => {
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

      const results = await client.searchVideos('api-key', 'test query', 10);

      expect(axios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({
          params: expect.objectContaining({
            key: 'api-key',
            q: 'test query',
            type: 'video',
            part: 'snippet',
            maxResults: 10,
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

      const results = await client.searchVideos('api-key', 'q', 10);
      expect(results).toHaveLength(1);
      expect(results[0].youtubeId).toBe('vid12345678');
    });
  });
});
