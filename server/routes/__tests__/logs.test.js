/* eslint-env jest */
const express = require('express');
const supertest = require('supertest');
const { Readable } = require('stream');
const createLogRoutes = require('../logs');

function makeApp(logFilesModule, verifyToken = (req, _res, next) => next()) {
  const app = express();
  app.use((req, _res, next) => {
    req.log = { error: jest.fn() };
    next();
  });
  const configModule = { getConfig: jest.fn(() => SAVED_CONFIG) };
  app.use(createLogRoutes({ verifyToken, logFilesModule, configModule }));
  return app;
}

const SAVED_CONFIG = { plexApiKey: 'plexToken123abc' };
const FILES = [{ name: 'youtarr.1.log', number: 1, path: '/logs/youtarr.1.log' }];

describe('GET /api/logs/download', () => {
  test('streams the combined log files as a download', async () => {
    const logFilesModule = {
      listLogFiles: jest.fn().mockResolvedValue(FILES),
      createCombinedStream: jest.fn(() => Readable.from(['line 1\n', 'line 2\n'])),
    };

    const res = await supertest(makeApp(logFilesModule)).get('/api/logs/download');

    expect(res.status).toBe(200);
    expect(res.text).toBe('line 1\nline 2\n');
  });

  test('names the download with a timestamp', async () => {
    const logFilesModule = {
      listLogFiles: jest.fn().mockResolvedValue(FILES),
      createCombinedStream: jest.fn(() => Readable.from(['x\n'])),
    };

    const res = await supertest(makeApp(logFilesModule)).get('/api/logs/download');

    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="youtarr-logs-\d{8}T\d{6}Z\.log"$/);
  });

  test('hides the saved secrets in the download', async () => {
    const logFilesModule = {
      listLogFiles: jest.fn().mockResolvedValue(FILES),
      createCombinedStream: jest.fn(() => Readable.from(['x\n'])),
    };

    await supertest(makeApp(logFilesModule)).get('/api/logs/download');

    expect(logFilesModule.createCombinedStream).toHaveBeenCalledWith(FILES, SAVED_CONFIG);
  });

  test('returns 404 when no log files exist', async () => {
    const logFilesModule = { listLogFiles: jest.fn().mockResolvedValue([]), createCombinedStream: jest.fn() };

    const res = await supertest(makeApp(logFilesModule)).get('/api/logs/download');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No log files found' });
  });

  test('returns 500 when the log folder cannot be read', async () => {
    const logFilesModule = {
      listLogFiles: jest.fn().mockRejectedValue(new Error('EACCES')),
      createCombinedStream: jest.fn(),
    };

    const res = await supertest(makeApp(logFilesModule)).get('/api/logs/download');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Could not read the log folder' });
  });

  test('requires authentication', async () => {
    const logFilesModule = { listLogFiles: jest.fn(), createCombinedStream: jest.fn() };
    const denyAll = (_req, res) => res.status(401).json({ error: 'Unauthorized' });

    const res = await supertest(makeApp(logFilesModule, denyAll)).get('/api/logs/download');

    expect(res.status).toBe(401);
    expect(logFilesModule.listLogFiles).not.toHaveBeenCalled();
  });
});
