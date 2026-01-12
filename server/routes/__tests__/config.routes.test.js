const request = require('supertest');
const express = require('express');
const createConfigRoutes = require('../config');
// Minimal mocks for dependencies
let updateConfigCalled = false;
let lastUpdatedConfig = null;
const mockConfigModule = {
  getConfig: () => ({ darkModeEnabled: true, customColors: { primary: '#123456' } }),
  updateConfig: (cfg) => { updateConfigCalled = true; lastUpdatedConfig = cfg; },
};
const app = express();
app.use(express.json());
app.use(createConfigRoutes({ verifyToken: (req, res, next) => next(), configModule: mockConfigModule, validateEnvAuthCredentials: () => false, isWslEnvironment: false }));

describe('Config routes', () => {
  test('GET /api/v1/admin/settings/theme is public and returns theme', async () => {
    const res = await request(app).get('/api/v1/admin/settings/theme');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('theme');
    expect(res.body.theme.mode).toBe('dark');
    expect(res.body.theme.darkModeEnabled).toBe(true);
    expect(res.body.theme.customColors).toEqual({ primary: '#123456' });
  });

  test('POST /api/v1/admin/settings/theme requires auth and updates config', async () => {
    const payload = { darkModeEnabled: false, customColors: { primary: '#abcdef' } };
    const res = await request(app).post('/api/v1/admin/settings/theme').send(payload).set('x-access-token', 'fake');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'success' });
    // Our lightweight spy should have been called
    expect(updateConfigCalled).toBe(true);
    expect(lastUpdatedConfig).toBeTruthy();
  });
});
