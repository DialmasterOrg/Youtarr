/* eslint-env jest */
const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../../modules/subfolderModule', () => ({ register: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../modules/videoValidationModule', () => ({
  validateVideo: jest.fn().mockResolvedValue({ isValidUrl: true, title: 'T' }),
}));
jest.mock('../../modules/channelSettingsModule', () => ({
  validateSubFolder: jest.fn().mockReturnValue({ valid: true }),
}));
jest.mock('../../modules/jobModule', () => ({
  getRunningJobs: jest.fn().mockReturnValue([]),
}));

const subfolderModule = require('../../modules/subfolderModule');

describe('POST /api/videos/download subfolder registration', () => {
  let app;
  let downloadModule;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock to ensure register is callable after clearAllMocks
    subfolderModule.register.mockResolvedValue(undefined);
    downloadModule = { doSpecificDownloads: jest.fn() };
    const createVideoRoutes = require('../videos');
    app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.log = { warn: jest.fn(), error: jest.fn(), info: jest.fn() }; next(); });
    app.use(createVideoRoutes({
      verifyToken: (req, res, next) => next(),
      videosModule: {},
      downloadModule,
      videoOembedEnricher: {},
    }));
  });

  test('registers a real subfolder override', async () => {
    await request(app).post('/api/videos/download')
      .send({ url: 'https://youtu.be/abcdefghijk', subfolder: 'Sports' });
    expect(subfolderModule.register).toHaveBeenCalledWith('Sports');
  });

  test('does not register a root sentinel override', async () => {
    await request(app).post('/api/videos/download')
      .send({ url: 'https://youtu.be/abcdefghijk', subfolder: '##ROOT##' });
    expect(subfolderModule.register).not.toHaveBeenCalled();
  });

  test('does not register a use-global-default sentinel override', async () => {
    await request(app).post('/api/videos/download')
      .send({ url: 'https://youtu.be/abcdefghijk', subfolder: '##USE_GLOBAL_DEFAULT##' });
    expect(subfolderModule.register).not.toHaveBeenCalled();
  });

  test('does not register when no subfolder is given', async () => {
    await request(app).post('/api/videos/download')
      .send({ url: 'https://youtu.be/abcdefghijk' });
    expect(subfolderModule.register).not.toHaveBeenCalled();
  });
});
