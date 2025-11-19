/* eslint-env jest */

describe('Database Health Middleware Logic', () => {
  let checkDatabaseHealth;
  let databaseHealth;

  beforeEach(() => {
    // Mock the database health module
    databaseHealth = {
      isDatabaseHealthy: jest.fn(),
      getStartupHealth: jest.fn(),
    };

    // Simulate the middleware logic
    checkDatabaseHealth = function(req, res, next) {
      // Skip health check for the db-status endpoint itself
      if (req.path === '/api/db-status') {
        return next();
      }

      // Allow static assets
      const isStaticAsset = req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json|txt)$/i);
      if (isStaticAsset) {
        return next();
      }

      // Allow requests for HTML pages
      const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
      const isGetRequest = req.method === 'GET';

      if (isGetRequest && acceptsHtml) {
        return next();
      }

      // Allow static file paths explicitly
      if (req.path.startsWith('/static/') ||
          req.path.startsWith('/images/') ||
          req.path === '/favicon.ico' ||
          req.path === '/manifest.json' ||
          req.path === '/asset-manifest.json') {
        return next();
      }

      // Check if database is healthy
      if (!databaseHealth.isDatabaseHealthy()) {
        const health = databaseHealth.getStartupHealth();

        let errorType, errorMessage;
        if (!health.database.connected) {
          errorType = 'Database Connection Failed';
          errorMessage = 'Unable to connect to the database. Please ensure the database server is running and accessible.';
        } else if (!health.database.schemaValid) {
          errorType = 'Database Schema Mismatch';
          errorMessage = 'The database schema does not match the application models. This usually means migrations need to be run or the code is out of sync with the database.';
        } else {
          errorType = 'Database Error';
          errorMessage = 'A database error has occurred. Please check the logs for details.';
        }

        return res.status(503).json({
          error: errorType,
          message: errorMessage,
          requiresDbFix: true,
          details: health.database.errors
        });
      }

      next();
    };
  });

  const createMockRequest = (options = {}) => ({
    method: options.method || 'GET',
    path: options.path || '/',
    headers: options.headers || {},
  });

  const createMockResponse = () => {
    const res = {
      statusCode: 200,
      body: undefined,
    };
    res.status = jest.fn((code) => {
      res.statusCode = code;
      return res;
    });
    res.json = jest.fn((data) => {
      res.body = data;
      return res;
    });
    return res;
  };

  describe('When database is unhealthy', () => {
    beforeEach(() => {
      databaseHealth.isDatabaseHealthy.mockReturnValue(false);
      databaseHealth.getStartupHealth.mockReturnValue({
        database: {
          connected: false,
          schemaValid: false,
          errors: ['Cannot connect to database'],
        },
      });
    });

    it('should block API calls', () => {
      const req = createMockRequest({
        path: '/getchannels',
        headers: { accept: 'application/json' },
      });
      const res = createMockResponse();
      const next = jest.fn();

      checkDatabaseHealth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database Connection Failed',
          requiresDbFix: true,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow /api/db-status', () => {
      const req = createMockRequest({ path: '/api/db-status' });
      const res = createMockResponse();
      const next = jest.fn();

      checkDatabaseHealth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow HTML requests (React app deep links)', () => {
      const req = createMockRequest({
        method: 'GET',
        path: '/channels/123',
        headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      });
      const res = createMockResponse();
      const next = jest.fn();

      checkDatabaseHealth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow static files', () => {
      const staticPaths = [
        '/static/js/main.js',
        '/static/css/main.css',
        '/images/logo.png',
        '/favicon.ico',
        '/manifest.json',
      ];

      staticPaths.forEach((path) => {
        const req = createMockRequest({ path });
        const res = createMockResponse();
        const next = jest.fn();

        checkDatabaseHealth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('When database is healthy', () => {
    beforeEach(() => {
      databaseHealth.isDatabaseHealthy.mockReturnValue(true);
    });

    it('should allow all requests', () => {
      const req = createMockRequest({
        path: '/getchannels',
        headers: { accept: 'application/json' },
      });
      const res = createMockResponse();
      const next = jest.fn();

      checkDatabaseHealth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Schema mismatch error', () => {
    beforeEach(() => {
      databaseHealth.isDatabaseHealthy.mockReturnValue(false);
      databaseHealth.getStartupHealth.mockReturnValue({
        database: {
          connected: true,
          schemaValid: false,
          errors: ['Table "channels" is missing column "new_field"'],
        },
      });
    });

    it('should return schema mismatch error', () => {
      const req = createMockRequest({
        path: '/getchannels',
        headers: { accept: 'application/json' },
      });
      const res = createMockResponse();
      const next = jest.fn();

      checkDatabaseHealth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database Schema Mismatch',
          message: expect.stringContaining('migrations'),
        })
      );
    });
  });
});
