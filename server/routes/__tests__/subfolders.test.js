/* eslint-env jest */
const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

describe('Subfolder routes', () => {
  let app;
  let mockSubfolderModule;

  beforeEach(() => {
    jest.resetModules();
    mockSubfolderModule = {
      register: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getUsage: jest.fn().mockResolvedValue([]),
    };
    const createSubfolderRoutes = require('../subfolders');
    app = express();
    app.use(express.json());
    app.use(createSubfolderRoutes({
      verifyToken: (req, res, next) => next(),
      subfolderModule: mockSubfolderModule,
    }));
  });

  describe('GET /api/subfolders', () => {
    test('returns the usage list from the module', async () => {
      const items = [
        { name: 'Music', displayName: '__Music', usage: { channels: 2, playlists: 0, isDefault: false, plexMapped: false, hasFiles: true }, deletable: false },
      ];
      mockSubfolderModule.getUsage.mockResolvedValueOnce(items);

      const res = await request(app).get('/api/subfolders');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(items);
    });

    test('returns 500 when the module throws', async () => {
      mockSubfolderModule.getUsage.mockRejectedValueOnce(new Error('boom'));
      const res = await request(app).get('/api/subfolders');
      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/subfolders', () => {
    test('registers a valid name and returns 200', async () => {
      const res = await request(app).post('/api/subfolders').send({ name: 'Sports' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ name: 'Sports' });
      expect(mockSubfolderModule.register).toHaveBeenCalledWith('Sports');
    });

    test('rejects an empty name with 400', async () => {
      const res = await request(app).post('/api/subfolders').send({ name: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(mockSubfolderModule.register).not.toHaveBeenCalled();
    });

    test('rejects a sentinel name with 400', async () => {
      const res = await request(app).post('/api/subfolders').send({ name: '##ROOT##' });
      expect(res.status).toBe(400);
    });

    test('rejects an invalid name with 400', async () => {
      const res = await request(app).post('/api/subfolders').send({ name: 'bad/name' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/subfolders/:name', () => {
    test('deletes and returns 200', async () => {
      const res = await request(app).delete('/api/subfolders/Old');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true });
      expect(mockSubfolderModule.delete).toHaveBeenCalledWith('Old');
    });

    test('maps a traversal attempt to 400 before calling the module', async () => {
      const res = await request(app).delete('/api/subfolders/' + encodeURIComponent('../etc'));
      expect(res.status).toBe(400);
      expect(mockSubfolderModule.delete).not.toHaveBeenCalled();
    });

    test('maps a 409 from the module', async () => {
      const err = new Error('Subfolder is in use by 1 channel(s)');
      err.status = 409;
      mockSubfolderModule.delete.mockRejectedValueOnce(err);
      const res = await request(app).delete('/api/subfolders/Used');
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Subfolder is in use by 1 channel(s)');
    });

    test('maps a 404 from the module', async () => {
      const err = new Error('Subfolder not found');
      err.status = 404;
      mockSubfolderModule.delete.mockRejectedValueOnce(err);
      const res = await request(app).delete('/api/subfolders/Ghost');
      expect(res.status).toBe(404);
    });
  });
});
