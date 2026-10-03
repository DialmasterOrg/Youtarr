/* eslint-env jest */
const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

function refusal(message, status) {
  return Object.assign(new Error(message), { status });
}

describe('TV show routes', () => {
  let app;
  let libraryFolders;
  let channelLayout;
  let channelSettingsModule;
  let jobModule;
  let models;
  const channel = { channel_id: 'UC1', sub_folder: 'Kids' };

  beforeEach(() => {
    jest.resetModules();
    libraryFolders = {
      listLibraryFolders: jest.fn().mockResolvedValue([{ name: '', layout: 'videos' }]),
      setFolderLayout: jest.fn().mockResolvedValue({ changed: true }),
    };
    channelLayout = {
      getChannelTvState: jest.fn().mockResolvedValue({ layout: 'tv' }),
      resolveLayoutTarget: jest.fn().mockResolvedValue('TV'),
    };
    channelSettingsModule = {
      updateChannelSettings: jest.fn().mockResolvedValue({ settings: { sub_folder: 'TV' } }),
    };
    jobModule = { getInProgressJobId: jest.fn().mockReturnValue(null) };
    models = { Channel: { findOne: jest.fn().mockResolvedValue(channel) } };
    const createTvShowRoutes = require('../tvShows');
    app = express();
    app.use(express.json());
    app.use(createTvShowRoutes({
      verifyToken: (req, res, next) => next(),
      libraryFolders,
      channelLayout,
      channelSettingsModule,
      jobModule,
      models,
    }));
  });

  describe('GET /api/library-folders', () => {
    test('returns the folder list', async () => {
      const res = await request(app).get('/api/library-folders');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ folders: [{ name: '', layout: 'videos' }] });
    });

    test('returns 500 when listing fails', async () => {
      libraryFolders.listLibraryFolders.mockRejectedValueOnce(new Error('disk'));
      const res = await request(app).get('/api/library-folders');
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/library-folders', () => {
    test('changes the layout and returns the updated list', async () => {
      const res = await request(app).put('/api/library-folders').send({ name: 'TV', layout: 'tv' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ changed: true, folders: [{ name: '', layout: 'videos' }] });
      expect(libraryFolders.setFolderLayout).toHaveBeenCalledWith('TV', 'tv', expect.any(Object));
    });

    test('tells the module whether a download is running', async () => {
      jobModule.getInProgressJobId.mockReturnValue('job-1');
      await request(app).put('/api/library-folders').send({ name: '', layout: 'tv' });
      const { isDownloadRunning } = libraryFolders.setFolderLayout.mock.calls[0][2];
      expect(isDownloadRunning()).toBe(true);
    });

    test('rejects a missing name with 400', async () => {
      const res = await request(app).put('/api/library-folders').send({ layout: 'tv' });
      expect(res.status).toBe(400);
      expect(libraryFolders.setFolderLayout).not.toHaveBeenCalled();
    });

    test('rejects a missing layout with 400', async () => {
      const res = await request(app).put('/api/library-folders').send({ name: 'TV' });
      expect(res.status).toBe(400);
    });

    test('passes a refusal through with its status', async () => {
      libraryFolders.setFolderLayout.mockRejectedValueOnce(refusal('holds downloads', 409));
      const res = await request(app).put('/api/library-folders').send({ name: 'TV', layout: 'tv' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'holds downloads' });
    });
  });

  describe('GET /api/channels/:channelId/tv', () => {
    test('returns the channel TV state', async () => {
      const res = await request(app).get('/api/channels/UC1/tv');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ layout: 'tv' });
    });

    test('returns 404 for an unknown channel', async () => {
      models.Channel.findOne.mockResolvedValueOnce(null);
      const res = await request(app).get('/api/channels/UCX/tv');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/channels/:channelId/tv/layout', () => {
    test('saves the resolved folder through the channel settings', async () => {
      const res = await request(app).put('/api/channels/UC1/tv/layout').send({ layout: 'tv', folder: 'TV' });
      expect(res.status).toBe(200);
      expect(channelLayout.resolveLayoutTarget).toHaveBeenCalledWith({ channel, layout: 'tv', folder: 'TV' });
      expect(channelSettingsModule.updateChannelSettings).toHaveBeenCalledWith(
        'UC1', { sub_folder: 'TV' }, expect.objectContaining({ isDownloadRunning: expect.any(Function) })
      );
      expect(res.body).toEqual({ settings: { sub_folder: 'TV' }, tv: { layout: 'tv' } });
    });

    test('rejects a non-string layout with 400', async () => {
      const res = await request(app).put('/api/channels/UC1/tv/layout').send({ layout: 1 });
      expect(res.status).toBe(400);
    });

    test('rejects a non-string folder with 400', async () => {
      const res = await request(app).put('/api/channels/UC1/tv/layout').send({ layout: 'tv', folder: 3 });
      expect(res.status).toBe(400);
    });

    test('returns 404 for an unknown channel', async () => {
      models.Channel.findOne.mockResolvedValueOnce(null);
      const res = await request(app).put('/api/channels/UCX/tv/layout').send({ layout: 'tv' });
      expect(res.status).toBe(404);
    });

    test('passes a choose-a-folder refusal through as 400', async () => {
      channelLayout.resolveLayoutTarget.mockRejectedValueOnce(refusal('Choose a TV folder.', 400));
      const res = await request(app).put('/api/channels/UC1/tv/layout').send({ layout: 'tv' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Choose a TV folder.' });
    });

    test('passes a has-downloads refusal through as 409', async () => {
      channelSettingsModule.updateChannelSettings.mockRejectedValueOnce(refusal('has downloads', 409));
      const res = await request(app).put('/api/channels/UC1/tv/layout').send({ layout: 'tv' });
      expect(res.status).toBe(409);
    });

    test('returns 500 for an unexpected failure', async () => {
      channelSettingsModule.updateChannelSettings.mockRejectedValueOnce(new Error('db'));
      const res = await request(app).put('/api/channels/UC1/tv/layout').send({ layout: 'tv' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to switch the channel\'s layout' });
    });
  });
});
