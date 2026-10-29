/* eslint-env jest */
const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

const CHANNEL_ID = 'UCDrqiuwNRbEahL1UEB0hkKQ';
const VIDEO_ID = 'y7xVT7DTt2k';

function refusal(message, status, extra = {}) {
  return Object.assign(new Error(message), { status }, extra);
}

describe('title show routes', () => {
  let app;
  let titleShowService;
  let models;
  const channel = { channel_id: CHANNEL_ID, title: 'BEYBLADE Official' };
  const SHOWS = { shows: [], conflicts: [] };

  beforeEach(() => {
    jest.resetModules();
    titleShowService = {
      getChannelShows: jest.fn().mockResolvedValue(SHOWS),
      createShow: jest.fn().mockResolvedValue(SHOWS),
      updateShow: jest.fn().mockResolvedValue(SHOWS),
      retireShow: jest.fn().mockResolvedValue(SHOWS),
      restoreShow: jest.fn().mockResolvedValue(SHOWS),
      reorderShows: jest.fn().mockResolvedValue(SHOWS),
      recheck: jest.fn().mockResolvedValue(SHOWS),
      setShowOnly: jest.fn().mockResolvedValue({ showOnlyDownloads: true }),
      preview: jest.fn().mockResolvedValue({ shows: [] }),
      useDuplicateCopy: jest.fn().mockResolvedValue(SHOWS),
      missingEpisodes: jest.fn().mockResolvedValue({ seasons: [] }),
      getVideoEpisode: jest.fn().mockResolvedValue({ channelId: CHANNEL_ID }),
      assignEpisode: jest.fn().mockResolvedValue({ channelId: CHANNEL_ID }),
    };
    models = { Channel: { findOne: jest.fn().mockResolvedValue(channel) } };
    const createRoutes = require('../tvTitleShows');
    app = express();
    app.use(express.json());
    app.use(createRoutes({
      verifyToken: (req, res, next) => next(),
      titleShowService,
      models,
      layoutGuards: {
        errorBody: (error) => ({
          error: error.message,
          ...(error.reorganizeRequired ? { reorganizeRequired: true, change: error.change } : {}),
        }),
      },
    }));
  });

  describe('GET /api/channels/:channelId/tv/shows', () => {
    test('returns the channel\'s shows', async () => {
      const res = await request(app).get(`/api/channels/${CHANNEL_ID}/tv/shows`);
      expect([res.status, res.body]).toEqual([200, SHOWS]);
    });

    test('answers 404 for an unknown channel', async () => {
      models.Channel.findOne.mockResolvedValue(null);
      const res = await request(app).get(`/api/channels/${CHANNEL_ID}/tv/shows`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/channels/:channelId/tv/shows', () => {
    test('adds a show', async () => {
      const draft = { name: 'Beyblade', patterns: [] };
      await request(app).post(`/api/channels/${CHANNEL_ID}/tv/shows`).send(draft);
      expect(titleShowService.createShow).toHaveBeenCalledWith(channel, draft);
    });

    test('passes a reorganize request through with the change', async () => {
      titleShowService.createShow.mockRejectedValue(refusal('Review the move first.', 409, {
        reorganizeRequired: true, change: { type: 'titleShows', channelId: CHANNEL_ID },
      }));
      const res = await request(app).post(`/api/channels/${CHANNEL_ID}/tv/shows`).send({ name: 'x' });
      expect([res.status, res.body.reorganizeRequired, res.body.change.type]).toEqual([409, true, 'titleShows']);
    });

    test('adds the suggestion of a folder refusal to the body', async () => {
      titleShowService.createShow.mockRejectedValue(refusal('taken', 409, { details: { suggestion: 'Beyblade (BEYBLADE Official)', retiredShowId: 5 } }));
      const res = await request(app).post(`/api/channels/${CHANNEL_ID}/tv/shows`).send({ name: 'x' });
      expect(res.body).toEqual({ error: 'taken', suggestion: 'Beyblade (BEYBLADE Official)', retiredShowId: 5 });
    });

    test('refuses a body that is not a show', async () => {
      const res = await request(app).post(`/api/channels/${CHANNEL_ID}/tv/shows`).send([1, 2]);
      expect(res.status).toBe(400);
    });

    test('answers 500 for an unexpected failure', async () => {
      titleShowService.createShow.mockRejectedValue(new Error('python crashed'));
      const res = await request(app).post(`/api/channels/${CHANNEL_ID}/tv/shows`).send({ name: 'x' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/channels/:channelId/tv/shows/order', () => {
    test('reorders the shows', async () => {
      await request(app).put(`/api/channels/${CHANNEL_ID}/tv/shows/order`).send({ showIds: [4, 3] });
      expect(titleShowService.reorderShows).toHaveBeenCalledWith(channel, [4, 3]);
    });
  });

  describe('PUT /api/channels/:channelId/tv/shows/:showId', () => {
    test('edits a show', async () => {
      await request(app).put(`/api/channels/${CHANNEL_ID}/tv/shows/4`).send({ name: 'Renamed' });
      expect(titleShowService.updateShow).toHaveBeenCalledWith(channel, 4, { name: 'Renamed' });
    });

    test('refuses a show id that is not a number', async () => {
      const res = await request(app).put(`/api/channels/${CHANNEL_ID}/tv/shows/abc`).send({ name: 'x' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/channels/:channelId/tv/shows/:showId', () => {
    test('retires a show', async () => {
      await request(app).delete(`/api/channels/${CHANNEL_ID}/tv/shows/4`);
      expect(titleShowService.retireShow).toHaveBeenCalledWith(channel, 4);
    });
  });

  describe('POST /api/channels/:channelId/tv/shows/:showId/restore', () => {
    test('restores a show', async () => {
      await request(app).post(`/api/channels/${CHANNEL_ID}/tv/shows/5/restore`);
      expect(titleShowService.restoreShow).toHaveBeenCalledWith(channel, 5);
    });
  });

  describe('GET /api/channels/:channelId/tv/shows/:showId/missing', () => {
    test('returns a show\'s missing episodes', async () => {
      const res = await request(app).get(`/api/channels/${CHANNEL_ID}/tv/shows/3/missing`);
      expect([res.status, titleShowService.missingEpisodes.mock.calls[0]]).toEqual([200, [channel, 3]]);
    });
  });

  describe('POST /api/channels/:channelId/tv/preview', () => {
    test('previews draft shows', async () => {
      const shows = [{ name: 'Beyblade' }];
      await request(app).post(`/api/channels/${CHANNEL_ID}/tv/preview`).send({ shows });
      expect(titleShowService.preview).toHaveBeenCalledWith(channel, { shows, overrides: [] });
    });

    test('refuses a preview without a list of shows', async () => {
      const res = await request(app).post(`/api/channels/${CHANNEL_ID}/tv/preview`).send({ shows: 'x' });
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/channels/:channelId/tv/show-only', () => {
    test('sets the switch', async () => {
      const res = await request(app).put(`/api/channels/${CHANNEL_ID}/tv/show-only`).send({ enabled: true });
      expect([res.status, titleShowService.setShowOnly.mock.calls[0]]).toEqual([200, [channel, true]]);
    });

    test('refuses a value that is not a boolean', async () => {
      const res = await request(app).put(`/api/channels/${CHANNEL_ID}/tv/show-only`).send({ enabled: 'yes' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/channels/:channelId/tv/conflicts/:youtubeId/use-copy', () => {
    test('swaps a duplicate in', async () => {
      await request(app).post(`/api/channels/${CHANNEL_ID}/tv/conflicts/${VIDEO_ID}/use-copy`);
      expect(titleShowService.useDuplicateCopy).toHaveBeenCalledWith(channel, VIDEO_ID);
    });

    test('refuses an invalid video id', async () => {
      const res = await request(app).post(`/api/channels/${CHANNEL_ID}/tv/conflicts/bad/use-copy`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/channels/:channelId/tv/recheck', () => {
    test('classifies the channel\'s titles again', async () => {
      await request(app).post(`/api/channels/${CHANNEL_ID}/tv/recheck`);
      expect(titleShowService.recheck).toHaveBeenCalledWith(channel);
    });
  });

  describe('GET /api/videos/:youtubeId/episode', () => {
    test('returns the video\'s episode', async () => {
      const res = await request(app).get(`/api/videos/${VIDEO_ID}/episode`);
      expect([res.status, res.body]).toEqual([200, { channelId: CHANNEL_ID }]);
    });
  });

  describe('PUT /api/videos/:youtubeId/episode', () => {
    test('assigns an episode', async () => {
      await request(app).put(`/api/videos/${VIDEO_ID}/episode`).send({ showId: 3, season: 1, episode: 20 });
      expect(titleShowService.assignEpisode).toHaveBeenCalledWith(VIDEO_ID, { showId: 3, season: 1, episode: 20 });
    });

    test('refuses an invalid video id', async () => {
      const res = await request(app).put('/api/videos/x/episode').send({ notAnEpisode: true });
      expect(res.status).toBe(400);
    });
  });
});
