/* eslint-env jest */
const express = require('express');
const supertest = require('supertest');
const createVideoTrashRoutes = require('../videoTrash');

class LibraryUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.code = 'LIBRARY_UNAVAILABLE';
  }
}

class PurgeRunningError extends Error {
  constructor() {
    super('A purge is already running');
    this.code = 'PURGE_RUNNING';
  }
}

function makeModule(overrides = {}) {
  return {
    LibraryUnavailableError,
    PurgeRunningError,
    getRemovedSummary: jest.fn().mockResolvedValue({ deleted: 2, missing: 1, legacy: 0, libraryCheck: { ok: true, reason: null, path: null, message: null } }),
    markMissingAsDeleted: jest.fn().mockResolvedValue({ updated: 2 }),
    purgeRemoved: jest.fn().mockResolvedValue({ purged: 0, archiveEntriesRemoved: 0, jobIds: [] }),
    ...overrides,
  };
}

function makeApp(videoTrashModule, jobModule = { reloadJobVideos: jest.fn().mockResolvedValue(undefined) }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
    next();
  });
  app.use(createVideoTrashRoutes({ verifyToken: (req, _res, next) => next(), videoTrashModule, jobModule }));
  return app;
}

describe('GET /api/videos/removed-summary', () => {
  test('returns the module summary', async () => {
    const module = makeModule();
    const res = await supertest(makeApp(module)).get('/api/videos/removed-summary');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 2, missing: 1, legacy: 0, libraryCheck: { ok: true, reason: null, path: null, message: null } });
  });

  test('returns 500 with the standard error shape when the summary fails', async () => {
    const module = makeModule({ getRemovedSummary: jest.fn().mockRejectedValue(new Error('db down')) });
    const res = await supertest(makeApp(module)).get('/api/videos/removed-summary');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to read the deleted and missing video counts' });
  });
});

describe('POST /api/videos/mark-deleted', () => {
  test.each([
    ['nothing', {}],
    ['both a selection and all', { videoIds: [1], all: true }],
    ['an empty selection', { videoIds: [] }],
    ['a non-integer id', { videoIds: ['x'] }],
    ['all set to false alone', { all: false }],
  ])('rejects %s with 400', async (_label, body) => {
    const module = makeModule();
    const res = await supertest(makeApp(module)).post('/api/videos/mark-deleted').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Send either videoIds (1 to 1000 video ids) or all: true' });
    expect(module.markMissingAsDeleted).not.toHaveBeenCalled();
  });

  test('marks a selection', async () => {
    const module = makeModule();
    const res = await supertest(makeApp(module)).post('/api/videos/mark-deleted').send({ videoIds: [1, 2] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 2 });
    expect(module.markMissingAsDeleted).toHaveBeenCalledWith({ videoIds: [1, 2], all: false, ignoreLibraryCheck: false });
  });

  test('marks all missing videos', async () => {
    const module = makeModule({ markMissingAsDeleted: jest.fn().mockResolvedValue({ updated: 40 }) });
    const res = await supertest(makeApp(module)).post('/api/videos/mark-deleted').send({ all: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 40 });
    expect(module.markMissingAsDeleted).toHaveBeenCalledWith({ videoIds: null, all: true, ignoreLibraryCheck: false });
  });

  test('marks all past the downloads folder check when asked to', async () => {
    const module = makeModule({ markMissingAsDeleted: jest.fn().mockResolvedValue({ updated: 40 }) });
    const res = await supertest(makeApp(module)).post('/api/videos/mark-deleted').send({ all: true, ignoreLibraryCheck: true });
    expect(res.status).toBe(200);
    expect(module.markMissingAsDeleted).toHaveBeenCalledWith({ videoIds: null, all: true, ignoreLibraryCheck: true });
  });

  test('rejects a non-boolean ignoreLibraryCheck with 400', async () => {
    const module = makeModule();
    const res = await supertest(makeApp(module)).post('/api/videos/mark-deleted').send({ all: true, ignoreLibraryCheck: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ignoreLibraryCheck must be true or false' });
    expect(module.markMissingAsDeleted).not.toHaveBeenCalled();
  });

  test('answers 409 with the reason while the downloads folder looks unmounted', async () => {
    const module = makeModule({
      markMissingAsDeleted: jest.fn().mockRejectedValue(new LibraryUnavailableError('The downloads folder is empty.')),
    });
    const res = await supertest(makeApp(module)).post('/api/videos/mark-deleted').send({ all: true });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'The downloads folder is empty.', reason: 'library-unavailable' });
  });

  test('answers 500 with the standard error shape on any other failure', async () => {
    const module = makeModule({ markMissingAsDeleted: jest.fn().mockRejectedValue(new Error('boom')) });
    const res = await supertest(makeApp(module)).post('/api/videos/mark-deleted').send({ all: true });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to mark videos as deleted' });
  });
});

describe('POST /api/videos/purge-removed', () => {
  test.each([
    ['no states', { removeFromArchive: false }],
    ['an empty states list', { states: [], removeFromArchive: false }],
    ['an unknown state', { states: ['bogus'], removeFromArchive: false }],
    ['a missing archive choice', { states: ['deleted'] }],
    ['a non-boolean archive choice', { states: ['deleted'], removeFromArchive: 'yes' }],
  ])('rejects %s with 400', async (_label, body) => {
    const module = makeModule();
    const res = await supertest(makeApp(module)).post('/api/videos/purge-removed').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Send states (deleted and/or missing) and removeFromArchive (true or false)' });
    expect(module.purgeRemoved).not.toHaveBeenCalled();
  });

  test('purges, handing the module the download history reload, and reports what it did', async () => {
    const module = makeModule({
      purgeRemoved: jest.fn().mockResolvedValue({ purged: 5, archiveEntriesRemoved: 5, jobIds: ['j1', 'j2'] }),
    });
    const jobModule = { reloadJobVideos: jest.fn().mockResolvedValue(undefined) };

    const res = await supertest(makeApp(module, jobModule)).post('/api/videos/purge-removed').send({ states: ['deleted', 'missing'], removeFromArchive: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ purged: 5, archiveEntriesRemoved: 5, jobsAffected: 2 });
    expect(module.purgeRemoved).toHaveBeenCalledWith(
      { states: ['deleted', 'missing'], removeFromArchive: true },
      { reloadJobVideos: expect.any(Function) }
    );
    // The module calls this before it broadcasts; it must reach jobModule.
    await module.purgeRemoved.mock.calls[0][1].reloadJobVideos(['j1', 'j2']);
    expect(jobModule.reloadJobVideos).toHaveBeenCalledWith(['j1', 'j2']);
  });

  test('answers 409 while another purge is running', async () => {
    const module = makeModule({ purgeRemoved: jest.fn().mockRejectedValue(new PurgeRunningError()) });
    const res = await supertest(makeApp(module)).post('/api/videos/purge-removed').send({ states: ['deleted'], removeFromArchive: false });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'A purge is already running', reason: 'running' });
  });

  test('answers 409 when a download prevents archive removal', async () => {
    const error = Object.assign(new Error('Wait for active downloads to finish.'), { code: 'ARCHIVE_BUSY' });
    const module = makeModule({ purgeRemoved: jest.fn().mockRejectedValue(error) });
    const res = await supertest(makeApp(module)).post('/api/videos/purge-removed').send({ states: ['deleted'], removeFromArchive: true });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: error.message, reason: 'archive-busy' });
  });

  test('answers 409 with the reason while the downloads folder looks unmounted', async () => {
    const module = makeModule({ purgeRemoved: jest.fn().mockRejectedValue(new LibraryUnavailableError('The downloads folder is empty.')) });
    const res = await supertest(makeApp(module)).post('/api/videos/purge-removed').send({ states: ['missing'], removeFromArchive: false });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'The downloads folder is empty.', reason: 'library-unavailable' });
  });

  test('answers 500 with the standard error shape on any other failure', async () => {
    const module = makeModule({ purgeRemoved: jest.fn().mockRejectedValue(new Error('boom')) });
    const res = await supertest(makeApp(module)).post('/api/videos/purge-removed').send({ states: ['deleted'], removeFromArchive: false });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to empty the trash' });
  });
});
