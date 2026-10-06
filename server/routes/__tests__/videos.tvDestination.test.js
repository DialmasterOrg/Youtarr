/* eslint-env jest */
const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../../modules/channelSettingsModule', () => ({
  validateSubFolder: jest.fn().mockReturnValue({ valid: true }),
}));

describe('POST /triggerspecificdownloads into a TV folder', () => {
  let app;
  let downloadModule;
  let layoutGuards;
  const url = 'https://youtu.be/abcdefghijk';

  beforeEach(() => {
    jest.clearAllMocks();
    downloadModule = {
      doGroupedManualDownloads: jest.fn().mockResolvedValue({ queued: 1, acceptedIds: [], alreadyActiveIds: [] }),
    };
    layoutGuards = {
      assertVideoOnlyDestination: jest.fn(async ({ audioFormat, subFolderValue }) => {
        if (audioFormat && subFolderValue === 'TV') {
          throw Object.assign(new Error('TV folders are video-only.'), { status: 400 });
        }
      }),
    };
    const createVideoRoutes = require('../videos');
    app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.log = { warn: jest.fn(), error: jest.fn(), info: jest.fn() }; next(); });
    app.use(createVideoRoutes({
      verifyToken: (req, res, next) => next(),
      videosModule: {},
      downloadModule,
      storageGuard: { isPausedError: () => false },
      layoutGuards,
    }));
  });

  test('refuses MP3 with a TV destination override', async () => {
    const response = await request(app).post('/triggerspecificdownloads')
      .send({ urls: [url], overrideSettings: { subfolder: 'TV', audioFormat: 'mp3_only' } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'TV folders are video-only.' });
    expect(downloadModule.doGroupedManualDownloads).not.toHaveBeenCalled();
  });

  test('allows video with a TV destination override', async () => {
    const response = await request(app).post('/triggerspecificdownloads')
      .send({ urls: [url], overrideSettings: { subfolder: 'TV' } });

    expect(response.status).toBe(200);
  });

  // Without an override the destination is known per video: manualDownloadGrouper
  // downgrades MP3 to video for URLs whose channel saves to a TV folder.
  test('does not check MP3 without a destination override', async () => {
    await request(app).post('/triggerspecificdownloads')
      .send({ urls: [url], overrideSettings: { audioFormat: 'mp3_only' } });

    expect(layoutGuards.assertVideoOnlyDestination).not.toHaveBeenCalled();
  });
});
