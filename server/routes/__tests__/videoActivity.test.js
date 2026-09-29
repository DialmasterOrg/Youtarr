/* eslint-env jest */
const express = require('express');
const request = require('supertest');
jest.mock('../../modules/videoLocalStatus', () => ({ applyLocalVideoStatus: jest.fn() }));
jest.mock('../../modules/download/videoActivity', () => ({ snapshot: jest.fn() }));
const { applyLocalVideoStatus } = require('../../modules/videoLocalStatus');
const activity = require('../../modules/download/videoActivity');

describe('video activity endpoints', () => {
  let app;
  let enqueue;
  let storageGuard;
  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.log = { error: jest.fn() }; next(); });
    const verifyToken = (req, res, next) => req.headers['x-access-token'] ? next() : res.sendStatus(401);
    enqueue = jest.fn().mockResolvedValue({ queued: 0, acceptedIds: [], alreadyActiveIds: ['aaaaaaaaaaa'] });
    const downloadModule = { doGroupedManualDownloads: enqueue };
    storageGuard = {
      isPausedError: jest.fn((err) => Boolean(err && err.code === 'DOWNLOADS_PAUSED')),
      refresh: jest.fn().mockResolvedValue({ paused: false, reasons: [] }),
    };
    app.use(require('../videos')({ verifyToken, videosModule: {}, downloadModule, videoLocalStatus: { applyLocalVideoStatus }, storageGuard }));
    app.use(require('../jobs')({ verifyToken, jobModule: {}, downloadModule, videoActivity: activity, storageGuard }));
  });

  it('requires authentication for snapshots and local metadata', async () => {
    await request(app).get('/api/jobs/video-activity').expect(401);
    await request(app).post('/api/videos/local-status').send({ youtubeIds: [] }).expect(401);
    expect(activity.snapshot).not.toHaveBeenCalled();
    expect(applyLocalVideoStatus).not.toHaveBeenCalled();
  });

  it('returns the current activity snapshot', async () => {
    const snapshot = { instanceId: 'server', revision: 1, videos: { aaaaaaaaaaa: { jobId: 'job', state: 'queued' } } };
    activity.snapshot.mockReturnValue(snapshot);
    const response = await request(app).get('/api/jobs/video-activity').set('x-access-token', 'token').expect(200);
    expect(response.body).toEqual(snapshot);
  });

  it('validates and deduplicates local-status IDs', async () => {
    await request(app).post('/api/videos/local-status').set('x-access-token', 'token').send({ youtubeIds: ['invalid'] }).expect(400);
    await request(app).post('/api/videos/local-status').set('x-access-token', 'token').send({ youtubeIds: Array(501).fill('aaaaaaaaaaa') }).expect(400);
    applyLocalVideoStatus.mockImplementation(async results => { results[0].status = 'downloaded'; });
    const response = await request(app).post('/api/videos/local-status').set('x-access-token', 'token')
      .send({ youtubeIds: ['aaaaaaaaaaa', 'aaaaaaaaaaa'] }).expect(200);
    expect(response.body.results).toEqual([{ youtubeId: 'aaaaaaaaaaa', status: 'downloaded' }]);
  });

  it('reports already-active submissions without pretending to enqueue a job', async () => {
    const response = await request(app).post('/triggerspecificdownloads').set('x-access-token', 'token')
      .send({ urls: ['https://youtu.be/aaaaaaaaaaa'] }).expect(200);
    expect(response.body).toMatchObject({ queued: 0, alreadyActiveIds: ['aaaaaaaaaaa'] });
  });

  it('returns 409 with the reason when downloads are paused for storage', async () => {
    enqueue.mockRejectedValue(Object.assign(new Error('Downloads are paused: over the limit'), { code: 'DOWNLOADS_PAUSED' }));
    const response = await request(app).post('/triggerspecificdownloads').set('x-access-token', 'token')
      .send({ urls: ['https://youtu.be/aaaaaaaaaaa'] }).expect(409);
    expect(response.body).toEqual({ error: 'Downloads are paused: over the limit' });
  });

  it('returns the download pause state', async () => {
    const status = { paused: true, reasons: [{ type: 'usage', text: 'over the limit' }] };
    storageGuard.refresh.mockResolvedValue(status);
    const response = await request(app).get('/api/jobs/download-pause').set('x-access-token', 'token').expect(200);
    expect(response.body).toEqual(status);
  });

  it('measures the downloaded total for the download pause state', async () => {
    await request(app).get('/api/jobs/download-pause').set('x-access-token', 'token').expect(200);
    expect(storageGuard.refresh).toHaveBeenCalledWith({ includeUsage: true });
  });

  it('requires authentication for the download pause state', async () => {
    await request(app).get('/api/jobs/download-pause').expect(401);
  });

  it('reports enqueue failure instead of returning early success', async () => {
    enqueue.mockRejectedValue(new Error('database unavailable'));
    await request(app).post('/triggerspecificdownloads').set('x-access-token', 'token')
      .send({ urls: ['https://youtu.be/aaaaaaaaaaa'] }).expect(500);
  });
});
