/* eslint-env jest */

const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Support prompt routes', () => {
  let app;
  let mockSupportPromptModule;
  let verifyToken;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockSupportPromptModule = {
      shouldShow: jest.fn().mockResolvedValue(false),
      markShown: jest.fn()
    };
    verifyToken = jest.fn((req, res, next) => next());

    const createSupportPromptRoutes = require('../supportPrompt');

    app = express();
    app.use(express.json());
    app.use(createSupportPromptRoutes({ verifyToken, supportPromptModule: mockSupportPromptModule }));
  });

  describe('GET /api/support-prompt', () => {
    test('reports that the prompt should be shown', async () => {
      mockSupportPromptModule.shouldShow.mockResolvedValue(true);

      const res = await request(app).get('/api/support-prompt');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ show: true });
    });

    test('reports that the prompt should stay hidden', async () => {
      const res = await request(app).get('/api/support-prompt');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ show: false });
    });

    test('returns 500 when eligibility cannot be checked', async () => {
      mockSupportPromptModule.shouldShow.mockRejectedValue(new Error('db down'));

      const res = await request(app).get('/api/support-prompt');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to check support prompt eligibility' });
    });

    test('requires authentication', async () => {
      verifyToken.mockImplementation((req, res) => res.status(401).json({ error: 'Unauthorized' }));

      const res = await request(app).get('/api/support-prompt');

      expect(res.status).toBe(401);
      expect(mockSupportPromptModule.shouldShow).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/support-prompt/shown', () => {
    test('records that the prompt was shown', async () => {
      const res = await request(app).post('/api/support-prompt/shown');

      expect(res.status).toBe(204);
      expect(mockSupportPromptModule.markShown).toHaveBeenCalledTimes(1);
    });

    test('returns 500 when the config cannot be saved', async () => {
      mockSupportPromptModule.markShown.mockImplementation(() => {
        throw new Error('read-only config');
      });

      const res = await request(app).post('/api/support-prompt/shown');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to record that the support prompt was shown' });
    });

    test('requires authentication', async () => {
      verifyToken.mockImplementation((req, res) => res.status(401).json({ error: 'Unauthorized' }));

      const res = await request(app).post('/api/support-prompt/shown');

      expect(res.status).toBe(401);
      expect(mockSupportPromptModule.markShown).not.toHaveBeenCalled();
    });
  });
});
