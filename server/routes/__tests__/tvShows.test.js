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
  let reorganize;
  let libraryCheck;
  let folderDetail;
  let plexRefreshMappings;
  const channel = { channel_id: 'UC1', sub_folder: 'Kids' };
  const REORGANIZE_STATE = { running: false, unmoved: null };

  beforeEach(() => {
    jest.resetModules();
    libraryFolders = {
      listLibraryFolders: jest.fn().mockResolvedValue([{ name: '', layout: 'videos' }]),
      setFolderLayout: jest.fn().mockResolvedValue({ changed: true }),
      setDefaultFolder: jest.fn().mockResolvedValue({ changed: true, defaultSubfolder: 'TV' }),
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
    reorganize = { channelState: jest.fn().mockResolvedValue(REORGANIZE_STATE) };
    libraryCheck = {
      check: jest.fn().mockResolvedValue({ servers: [], folders: [] }),
      applyPlexMapping: jest.fn().mockResolvedValue({ mappedLibraryId: '41' }),
    };
    folderDetail = { getFolderDetail: jest.fn().mockResolvedValue({ name: 'check' }) };
    plexRefreshMappings = {
      setMapping: jest.fn().mockResolvedValue({ choice: 'library' }),
      removeMapping: jest.fn().mockResolvedValue({ choice: 'none' }),
    };
    const createTvShowRoutes = require('../tvShows');
    app = express();
    app.use(express.json());
    app.use(createTvShowRoutes({
      verifyToken: (req, res, next) => next(),
      libraryFolders,
      channelLayout,
      layoutGuards: {
        errorBody: (error) => ({
          error: error.message,
          ...(error.reorganizeRequired ? { reorganizeRequired: true, change: error.change } : {}),
          ...(error.code ? { code: error.code } : {}),
        }),
      },
      reorganize,
      channelSettingsModule,
      jobModule,
      models,
      libraryCheck,
      folderDetail,
      plexRefreshMappings,
    }));
  });

  describe('GET /api/library-folders/check', () => {
    test('checks every folder without a folder parameter', async () => {
      const res = await request(app).get('/api/library-folders/check');

      expect(res.status).toBe(200);
      expect(libraryCheck.check).toHaveBeenCalledWith({});
    });

    test('checks only the folders asked for, including the main folder', async () => {
      await request(app).get('/api/library-folders/check?folder=TV%20Shows&folder=');

      expect(libraryCheck.check).toHaveBeenCalledWith({ folders: ['TV Shows', ''] });
    });

    test('rejects an overlong folder name', async () => {
      const res = await request(app).get(`/api/library-folders/check?folder=${'x'.repeat(101)}`);

      expect(res.status).toBe(400);
    });

    test('checks the folders asked for as another layout', async () => {
      await request(app).get('/api/library-folders/check?folder=TV%20Shows&layout=tv');

      expect(libraryCheck.check).toHaveBeenCalledWith({ folders: ['TV Shows'], layout: 'tv' });
    });

    test.each([
      ['an unknown layout', '?folder=TV&layout=movies'],
      ['a layout without folders', '?layout=tv'],
    ])('rejects %s', async (_label, query) => {
      const res = await request(app).get(`/api/library-folders/check${query}`);

      expect(res.status).toBe(400);
      expect(libraryCheck.check).not.toHaveBeenCalled();
    });

    test('answers 500 when the check fails unexpectedly', async () => {
      libraryCheck.check.mockRejectedValue(new Error('boom'));

      const res = await request(app).get('/api/library-folders/check');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to check the media server libraries' });
    });
  });

  describe('PUT /api/library-folders/plex-mapping', () => {
    test('maps the folder to the library', async () => {
      const res = await request(app).put('/api/library-folders/plex-mapping').send({ folder: 'TV Shows', libraryId: '41' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ mappedLibraryId: '41' });
      expect(libraryCheck.applyPlexMapping).toHaveBeenCalledWith('TV Shows', '41');
    });

    test.each([
      [{ folder: '', libraryId: '41' }],
      [{ folder: 'TV', libraryId: 'abc' }],
      [{ folder: 'TV' }],
    ])('rejects %o', async (body) => {
      const res = await request(app).put('/api/library-folders/plex-mapping').send(body);

      expect(res.status).toBe(400);
      expect(libraryCheck.applyPlexMapping).not.toHaveBeenCalled();
    });

    test('passes the check\'s refusal through', async () => {
      libraryCheck.applyPlexMapping.mockRejectedValue(refusal('__TV already refreshes another Plex library.', 409));

      const res = await request(app).put('/api/library-folders/plex-mapping').send({ folder: 'TV', libraryId: '41' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: '__TV already refreshes another Plex library.' });
    });
  });

  describe('plex-mapping replace and delete', () => {
    test('replace sets any folder, the main folder included', async () => {
      await request(app).put('/api/library-folders/plex-mapping').send({ folder: '', libraryId: '37', replace: true });
      expect(plexRefreshMappings.setMapping).toHaveBeenCalledWith('', '37');
    });

    test('replace accepts the explicit default choice', async () => {
      await request(app).put('/api/library-folders/plex-mapping').send({ folder: 'TV', libraryId: null, replace: true });
      expect(plexRefreshMappings.setMapping).toHaveBeenCalledWith('TV', null);
    });

    test('replace rejects a non-numeric library id', async () => {
      const res = await request(app).put('/api/library-folders/plex-mapping').send({ folder: 'TV', libraryId: 'abc', replace: true });
      expect(res.status).toBe(400);
    });

    test('without replace keeps today\'s applyPlexMapping', async () => {
      await request(app).put('/api/library-folders/plex-mapping').send({ folder: 'TV', libraryId: '41' });
      expect(libraryCheck.applyPlexMapping).toHaveBeenCalledWith('TV', '41');
      expect(plexRefreshMappings.setMapping).not.toHaveBeenCalled();
    });

    test('delete removes a folder\'s entry, the main folder included', async () => {
      const res = await request(app).delete('/api/library-folders/plex-mapping?folder=');
      expect(res.status).toBe(200);
      expect(plexRefreshMappings.removeMapping).toHaveBeenCalledWith('');
    });

    test('delete requires the folder parameter', async () => {
      const res = await request(app).delete('/api/library-folders/plex-mapping');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/library-folders/folder/:key', () => {
    test('answers a folder named check (outside the /check path)', async () => {
      const res = await request(app).get('/api/library-folders/folder/check');
      expect(res.status).toBe(200);
      expect(folderDetail.getFolderDetail).toHaveBeenCalledWith('check');
    });

    test('decodes the key and passes the main folder key as is', async () => {
      await request(app).get('/api/library-folders/folder/Science%20Shows');
      expect(folderDetail.getFolderDetail).toHaveBeenCalledWith('Science Shows');
      await request(app).get('/api/library-folders/folder/~main');
      expect(folderDetail.getFolderDetail).toHaveBeenLastCalledWith('~main');
    });

    test('answers 404 with the module\'s message', async () => {
      folderDetail.getFolderDetail.mockRejectedValueOnce(refusal('Library folder not found', 404));
      const res = await request(app).get('/api/library-folders/folder/Nope');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Library folder not found' });
    });
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

    test('passes include to the module', async () => {
      await request(app).get('/api/library-folders?include=usage,files');
      expect(libraryFolders.listLibraryFolders).toHaveBeenCalledWith({ include: ['usage', 'files'] });
    });

    test('keeps the plain call without include', async () => {
      await request(app).get('/api/library-folders');
      expect(libraryFolders.listLibraryFolders).toHaveBeenCalledWith();
    });

    test('rejects an unknown include', async () => {
      const res = await request(app).get('/api/library-folders?include=everything');
      expect(res.status).toBe(400);
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

    test('names the change to preview when the folder\'s files must move', async () => {
      libraryFolders.setFolderLayout.mockRejectedValueOnce(Object.assign(refusal('Review the move', 409), {
        reorganizeRequired: true, change: { type: 'folderLayout', folder: 'TV', layout: 'tv' },
      }));
      const res = await request(app).put('/api/library-folders').send({ name: 'TV', layout: 'tv' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: 'Review the move', reorganizeRequired: true, change: { type: 'folderLayout', folder: 'TV', layout: 'tv' },
      });
    });
  });

  describe('PUT /api/library-folders/default', () => {
    test('saves and answers with the folders', async () => {
      const res = await request(app).put('/api/library-folders/default').send({ name: 'TV' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ changed: true, defaultSubfolder: 'TV', folders: [{ name: '', layout: 'videos' }] });
      expect(libraryFolders.setDefaultFolder).toHaveBeenCalledWith('TV', { isDownloadRunning: expect.any(Function) });
    });

    test('answers unchanged', async () => {
      libraryFolders.setDefaultFolder.mockResolvedValueOnce({ changed: false, defaultSubfolder: 'TV' });
      const res = await request(app).put('/api/library-folders/default').send({ name: 'TV' });
      expect(res.body.changed).toBe(false);
    });

    test('passes a reorganize refusal with its change', async () => {
      libraryFolders.setDefaultFolder.mockRejectedValueOnce(Object.assign(refusal('Review the move first.', 409), {
        reorganizeRequired: true, change: { type: 'defaultSubfolder', value: 'TV' },
      }));
      const res = await request(app).put('/api/library-folders/default').send({ name: 'TV' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'Review the move first.', reorganizeRequired: true, change: { type: 'defaultSubfolder', value: 'TV' } });
    });

    test('passes the reorganize-running code', async () => {
      libraryFolders.setDefaultFolder.mockRejectedValueOnce(Object.assign(refusal('Downloads are being reorganized.', 409), {
        code: 'REORGANIZE_RUNNING',
      }));
      const res = await request(app).put('/api/library-folders/default').send({ name: 'TV' });
      expect(res.body.code).toBe('REORGANIZE_RUNNING');
    });

    test('rejects an invalid name', async () => {
      const res = await request(app).put('/api/library-folders/default').send({ name: 'bad/name' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/channels/:channelId/tv', () => {
    test('returns the channel TV state with its reorganize state', async () => {
      const res = await request(app).get('/api/channels/UC1/tv');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ layout: 'tv', reorganize: REORGANIZE_STATE });
      expect(reorganize.channelState).toHaveBeenCalledWith('UC1');
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
      expect(res.body).toEqual({ settings: { sub_folder: 'TV' }, tv: { layout: 'tv', reorganize: REORGANIZE_STATE } });
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

    test('passes a reorganize-required refusal through as 409 with the change', async () => {
      channelSettingsModule.updateChannelSettings.mockRejectedValueOnce(Object.assign(refusal('Review the move', 409), {
        reorganizeRequired: true, change: { type: 'channel', channelId: 'UC1', subFolder: 'TV' },
      }));
      const res = await request(app).put('/api/channels/UC1/tv/layout').send({ layout: 'tv' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ reorganizeRequired: true, change: { type: 'channel', channelId: 'UC1', subFolder: 'TV' } });
    });

    test('returns 500 for an unexpected failure', async () => {
      channelSettingsModule.updateChannelSettings.mockRejectedValueOnce(new Error('db'));
      const res = await request(app).put('/api/channels/UC1/tv/layout').send({ layout: 'tv' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to switch the channel\'s layout' });
    });
  });
});
