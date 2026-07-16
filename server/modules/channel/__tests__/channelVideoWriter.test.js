/* eslint-env jest */

const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('../../../models/channelvideo', () => mockFactories.mockChannelVideoModel());

describe('channelVideoWriter', () => {
  let channelVideoWriter;
  let ChannelVideo;

  const mockVideoData = {
    youtube_id: 'video123',
    title: 'Test Video',
    thumbnail: 'https://i.ytimg.com/vi/video123/mqdefault.jpg',
    duration: 600,
    publishedAt: '2024-01-01T00:00:00Z',
    availability: 'public'
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    ChannelVideo = require('../../../models/channelvideo');
    channelVideoWriter = require('../channelVideoWriter');
  });

  describe('insertVideosIntoDb', () => {
    // insertVideosIntoDb runs in two phases: phase 1 upserts fields and sets
    // the initial date on CREATE (via findOrCreate defaults); phase 2 runs the
    // shared anchoring algorithm over the whole batch and persists the final
    // dates for non-created/changed rows via ChannelVideo.update(..., {where:{id}}).

    // Make findOrCreate echo the defaults back as a created record (with an id
    // and update stub) so phase-2 sees a realistic created row.
    const echoCreates = (existingByYoutubeId = {}) => {
      let nextId = 100;
      ChannelVideo.findOrCreate.mockImplementation(async ({ where, defaults }) => {
        const existing = existingByYoutubeId[where.youtube_id];
        if (existing) return [existing, false];
        return [
          {
            id: nextId++,
            publishedAt: defaults.publishedAt,
            published_at_source: defaults.published_at_source,
            update: jest.fn(),
          },
          true,
        ];
      });
    };

    // Collect phase-2 date writes as { id, publishedAt, published_at_source }.
    const dateWrites = () =>
      ChannelVideo.update.mock.calls.map(([fields, opts]) => ({ id: opts.where.id, ...fields }));

    test('should insert new videos into database', async () => {
      const videos = [
        { ...mockVideoData, youtube_id: 'video1' },
        { ...mockVideoData, youtube_id: 'video2' }
      ];

      echoCreates();

      await channelVideoWriter.insertVideosIntoDb(videos, 'UC123');

      expect(ChannelVideo.findOrCreate).toHaveBeenCalledTimes(2);
      expect(ChannelVideo.findOrCreate).toHaveBeenCalledWith({
        where: {
          youtube_id: 'video1',
          channel_id: 'UC123'
        },
        defaults: expect.objectContaining({
          ...videos[0],
          channel_id: 'UC123'
        })
      });
    });

    test('phase 1 upserts non-date fields without the date; phase 2 writes the date', async () => {
      const mockVideo = {
        id: 7,
        publishedAt: '2023-01-01T00:00:00.000Z',
        published_at_source: 'approximate',
        update: jest.fn()
      };
      ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

      await channelVideoWriter.insertVideosIntoDb([mockVideoData], 'UC123');

      // Phase 1: fields only, never the date.
      expect(mockVideo.update).toHaveBeenCalledWith({
        title: mockVideoData.title,
        thumbnail: mockVideoData.thumbnail,
        duration: mockVideoData.duration,
        media_type: 'video',
        availability: mockVideoData.availability,
      });
      const phase1 = mockVideo.update.mock.calls[0][0];
      expect(phase1).not.toHaveProperty('publishedAt');
      expect(phase1).not.toHaveProperty('published_at_source');

      // Phase 2: the fetched date is persisted (normalized to ISO) for this
      // row. The source field is omitted because it is unchanged (approximate).
      expect(ChannelVideo.update).toHaveBeenCalledWith(
        { publishedAt: '2024-01-01T00:00:00.000Z' },
        { where: { id: 7 } },
      );
    });

    test('should never rewrite an exact date from a download', async () => {
      const mockVideo = {
        id: 9,
        publishedAt: '2024-01-10T00:00:00.000Z',
        published_at_source: 'exact',
        update: jest.fn()
      };
      ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

      await channelVideoWriter.insertVideosIntoDb([mockVideoData], 'UC123');

      // Phase 1 never carries the date...
      const phase1 = mockVideo.update.mock.calls[0][0];
      expect(phase1).not.toHaveProperty('publishedAt');
      // ...and phase 2 skips exact rows entirely.
      const wroteDate = ChannelVideo.update.mock.calls.some(([, opts]) => opts.where.id === 9);
      expect(wroteDate).toBe(false);
    });

    test('should preserve existing availability when refresh has no availability', async () => {
      const mockVideo = { id: 1, publishedAt: '2023-01-01T00:00:00.000Z', published_at_source: 'approximate', update: jest.fn() };
      ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

      const videoWithoutAvailability = { ...mockVideoData };
      delete videoWithoutAvailability.availability;

      await channelVideoWriter.insertVideosIntoDb([videoWithoutAvailability], 'UC123');

      const updateArgs = mockVideo.update.mock.calls[0][0];
      expect(updateArgs).not.toHaveProperty('availability');
    });

    test('should preserve existing live_status when refresh has no live_status', async () => {
      const mockVideo = { id: 1, publishedAt: '2023-01-01T00:00:00.000Z', published_at_source: 'approximate', update: jest.fn() };
      ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

      await channelVideoWriter.insertVideosIntoDb([mockVideoData], 'UC123');

      const updateArgs = mockVideo.update.mock.calls[0][0];
      expect(updateArgs).not.toHaveProperty('live_status');
    });

    test('should overwrite availability when refresh has a real value (real demotion still works)', async () => {
      const mockVideo = { id: 1, publishedAt: '2023-01-01T00:00:00.000Z', published_at_source: 'approximate', update: jest.fn() };
      ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

      const videoWithPublic = { ...mockVideoData, availability: 'public' };
      await channelVideoWriter.insertVideosIntoDb([videoWithPublic], 'UC123');

      expect(mockVideo.update).toHaveBeenCalledWith(
        expect.objectContaining({ availability: 'public' })
      );
    });

    test('should overwrite live_status when refresh has a real value', async () => {
      const mockVideo = { id: 1, publishedAt: '2023-01-01T00:00:00.000Z', published_at_source: 'approximate', update: jest.fn() };
      ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

      const videoWithLive = { ...mockVideoData, live_status: 'is_live' };
      await channelVideoWriter.insertVideosIntoDb([videoWithLive], 'UC123');

      expect(mockVideo.update).toHaveBeenCalledWith(
        expect.objectContaining({ live_status: 'is_live' })
      );
    });

    test('should insert videos with live_status field', async () => {
      const videoWithLiveStatus = {
        ...mockVideoData,
        live_status: 'was_live'
      };

      echoCreates();

      await channelVideoWriter.insertVideosIntoDb([videoWithLiveStatus], 'UC123');

      expect(ChannelVideo.findOrCreate).toHaveBeenCalledWith({
        where: {
          youtube_id: videoWithLiveStatus.youtube_id,
          channel_id: 'UC123'
        },
        defaults: expect.objectContaining({
          live_status: 'was_live'
        })
      });
    });

    test('should write strictly descending estimated dates for a date-less batch', async () => {
      const videosWithoutDates = [
        { youtube_id: 'video1', title: 'Video 1', publishedAt: null },
        { youtube_id: 'video2', title: 'Video 2', publishedAt: null },
        { youtube_id: 'video3', title: 'Video 3', publishedAt: null }
      ];

      echoCreates();

      await channelVideoWriter.insertVideosIntoDb(videosWithoutDates, 'UC123');

      // Created with the estimated source.
      for (const call of ChannelVideo.findOrCreate.mock.calls) {
        expect(call[0].defaults.published_at_source).toBe('estimated');
      }

      // Phase 2 persists strictly-descending dates, 1s apart, source unchanged.
      const writes = dateWrites();
      expect(writes).toHaveLength(3);
      const times = writes.map((w) => new Date(w.publishedAt).getTime());
      expect(times[1]).toBe(times[0] - 1000);
      expect(times[2]).toBe(times[0] - 2000);
      for (const w of writes) {
        expect(w).not.toHaveProperty('published_at_source'); // estimated stays estimated
      }
    });

    test('should anchor estimated dates just below the nearest dated entry above', async () => {
      // Mixed batch: dates for only the first entry. The undated entries must
      // sort below it, not jump to "now".
      const videos = [
        { youtube_id: 'video1', title: 'Video 1', publishedAt: '2024-01-10T00:00:00.000Z' },
        { youtube_id: 'video2', title: 'Video 2', publishedAt: null },
        { youtube_id: 'video3', title: 'Video 3', publishedAt: null }
      ];

      echoCreates();

      await channelVideoWriter.insertVideosIntoDb(videos, 'UC123');

      const anchor = new Date('2024-01-10T00:00:00.000Z').getTime();
      const writes = dateWrites();
      // video1 was created with the right date in defaults, so it isn't rewritten;
      // the two estimated rows are written just below the anchor.
      const estimatedTimes = writes.map((w) => new Date(w.publishedAt).getTime()).sort((a, b) => b - a);
      expect(estimatedTimes).toEqual([anchor - 1000, anchor - 2000]);
    });

    test('should anchor estimated dates below an existing record real date when the response has none', async () => {
      const existingRecord = {
        id: 50,
        publishedAt: '2024-02-01T00:00:00.000Z',
        published_at_source: 'approximate',
        update: jest.fn()
      };

      const videos = [
        { youtube_id: 'video1', title: 'Video 1', publishedAt: null },
        { youtube_id: 'video2', title: 'Video 2', publishedAt: null }
      ];

      echoCreates({ video1: existingRecord });

      await channelVideoWriter.insertVideosIntoDb(videos, 'UC123');

      // The existing real date is kept (no phase-2 write for that id)...
      const wroteExisting = ChannelVideo.update.mock.calls.some(([, opts]) => opts.where.id === 50);
      expect(wroteExisting).toBe(false);

      // ...and the new undated row slots in just below it.
      const anchor = new Date('2024-02-01T00:00:00.000Z').getTime();
      const writes = dateWrites();
      expect(writes).toHaveLength(1);
      expect(new Date(writes[0].publishedAt).getTime()).toBe(anchor - 1000);
    });

    test('should re-anchor existing estimated rows on a date-less refresh', async () => {
      const estimatedRecord = {
        id: 60,
        publishedAt: '2026-06-12T17:21:21.205Z',
        published_at_source: 'estimated',
        update: jest.fn()
      };

      const videos = [
        { youtube_id: 'video1', title: 'Video 1', publishedAt: '2024-03-01T00:00:00.000Z' },
        { youtube_id: 'video2', title: 'Video 2', publishedAt: null }
      ];

      echoCreates({ video2: estimatedRecord });

      await channelVideoWriter.insertVideosIntoDb(videos, 'UC123');

      const anchor = new Date('2024-03-01T00:00:00.000Z').getTime();
      const write = dateWrites().find((w) => w.id === 60);
      expect(write).toBeDefined();
      expect(new Date(write.publishedAt).getTime()).toBe(anchor - 1000);
      expect(write).not.toHaveProperty('published_at_source'); // estimated stays estimated
    });

    test('clamps a fetched approximate date that would sort above a nearby exact date', async () => {
      // An approximate date newer than an exact date below it in the listing
      // must be clamped into position.
      const exactRow = {
        id: 71,
        publishedAt: '2026-05-07T00:00:00.000Z',
        published_at_source: 'exact',
        update: jest.fn()
      };
      const videos = [
        { youtube_id: 'before', title: 'Before', publishedAt: '2026-05-20T00:00:00.000Z' },
        { youtube_id: 'exactvid', title: 'Exact', publishedAt: '2026-05-10T00:00:00.000Z' }, // fetch date ignored; row is exact
        { youtube_id: 'after', title: 'After', publishedAt: '2026-05-12T00:00:00.000Z' } // newer than the exact -> must be clamped below it
      ];

      echoCreates({ exactvid: exactRow });

      await channelVideoWriter.insertVideosIntoDb(videos, 'UC123');

      // The exact row keeps its date (not rewritten).
      const wroteExact = ChannelVideo.update.mock.calls.some(([, opts]) => opts.where.id === 71);
      expect(wroteExact).toBe(false);

      // The "after" row, despite a 5/12 fetched date, is written below 5/7.
      const exactMs = new Date('2026-05-07T00:00:00.000Z').getTime();
      const writes = dateWrites();
      const afterWrite = writes.find((w) => new Date(w.publishedAt).getTime() < exactMs);
      expect(afterWrite).toBeDefined();
      // It keeps its approximate source (created with it; not downgraded to estimated).
      expect(afterWrite.published_at_source).not.toBe('estimated');
    });

    test('should keep fetched dates as approximate when consistent', async () => {
      const videosWithDates = [
        { youtube_id: 'video1', title: 'Video 1', publishedAt: '2024-01-02T00:00:00.000Z' },
        { youtube_id: 'video2', title: 'Video 2', publishedAt: '2024-01-01T00:00:00.000Z' }
      ];

      echoCreates();

      await channelVideoWriter.insertVideosIntoDb(videosWithDates, 'UC123');

      const firstCall = ChannelVideo.findOrCreate.mock.calls[0][0];
      expect(firstCall.defaults.publishedAt).toBe('2024-01-02T00:00:00.000Z');
      expect(firstCall.defaults.published_at_source).toBe('approximate');

      // Consistent fetched dates need no phase-2 rewrite.
      expect(ChannelVideo.update).not.toHaveBeenCalled();
    });
  });
});
