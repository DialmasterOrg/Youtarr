/* eslint-env jest */
const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../../modules/videoDeletionModule', () => ({
  deleteVideos: jest.fn().mockResolvedValue({ success: true, deleted: [1], failed: [] }),
  deleteVideosByYoutubeIds: jest.fn().mockResolvedValue({ success: true, deleted: ['abc'], failed: [] }),
}));

describe('DELETE /api/videos while a reorganize runs', () => {
  let app;
  let reorganizeLock;
  let videoDeletionModule;

  beforeEach(() => {
    jest.clearAllMocks();
    videoDeletionModule = require('../../modules/videoDeletionModule');
    reorganizeLock = { coversAnyVideo: jest.fn(() => false) };
    const createVideoRoutes = require('../videos');
    app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.log = { warn: jest.fn(), error: jest.fn(), info: jest.fn() }; next(); });
    app.use(createVideoRoutes({
      verifyToken: (req, res, next) => next(),
      videosModule: {},
      downloadModule: {},
      storageGuard: { isPausedError: () => false },
      layoutGuards: {},
      reorganizeLock,
    }));
  });

  test('refuses videos the reorganize is moving', async () => {
    reorganizeLock.coversAnyVideo.mockReturnValue(true);

    const response = await request(app).delete('/api/videos').send({ youtubeIds: ['abc'] });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/being reorganized/);
    expect(reorganizeLock.coversAnyVideo).toHaveBeenCalledWith({ ids: [], youtubeIds: ['abc'] });
    expect(videoDeletionModule.deleteVideosByYoutubeIds).not.toHaveBeenCalled();
  });

  test('deletes other videos', async () => {
    const response = await request(app).delete('/api/videos').send({ videoIds: [1] });

    expect(response.status).toBe(200);
    expect(videoDeletionModule.deleteVideos).toHaveBeenCalledWith([1]);
  });
});
