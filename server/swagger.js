const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

// Try to read version from package.json, fall back to 'unknown' if not available
let appVersion = 'unknown';
try {
  // Try multiple paths since the working directory may vary
  const possiblePaths = [
    path.join(__dirname, '../package.json'),
    path.join(__dirname, '../../package.json'),
    '/app/package.json'
  ];
  
  for (const pkgPath of possiblePaths) {
    if (fs.existsSync(pkgPath)) {
      const packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      appVersion = packageJson.version;
      break;
    }
  }
} catch (err) {
  // Silently fall back to 'unknown'
}

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Youtarr API',
      version: appVersion,
      description: 'API documentation for Youtarr - YouTube channel downloader and media server integration',
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current server',
      },
    ],
    components: {
      securitySchemes: {
        SessionAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-access-token',
          description: 'Session token obtained from /auth/login',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key sent to legacy download endpoints or the versioned external API.',
        },
        ExternalApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'External-role API key. Channel catalog access also requires an explicit per-key grant.',
        },
      },
      schemas: {
        ExternalError: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', example: 'not_found' },
                message: { type: 'string' },
                requestId: { type: 'string' },
              },
            },
          },
        },
        ExternalRequest: {
          type: 'object',
          required: ['id', 'type', 'status', 'target', 'createdAt', 'updatedAt'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['video', 'channel', 'delete_video'] },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'failed', 'cancelled'],
            },
            target: {
              type: 'object',
              properties: {
                youtubeId: { type: 'string', nullable: true },
                channelId: { type: 'integer', nullable: true },
                channelUrl: { type: 'string', format: 'uri', nullable: true },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            decidedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
            message: { type: 'string', maxLength: 500 },
            grantToRequestingKey: { type: 'boolean' },
          },
        },
        ExternalApiKeyPolicy: {
          type: 'object',
          required: ['role'],
          properties: {
            role: {
              type: 'string',
              enum: ['view', 'request', 'delete', 'admin'],
              description: 'Backward-compatible summary; clients should use explicit permissions.',
            },
            allowVideoRequests: { type: 'boolean', default: false },
            allowChannelRequests: { type: 'boolean', default: false },
            allowDeleteVideoRequests: { type: 'boolean', default: false },
            autoApproveVideoRequests: { type: 'boolean', default: false },
            autoApproveChannelRequests: { type: 'boolean', default: false },
            autoApproveDeleteRequests: { type: 'boolean', default: false },
            maxRatingLevel: {
              type: 'integer',
              minimum: 1,
              maximum: 4,
              default: 4,
              description: 'Maximum content-rating band: 1 = G / TV-Y / TV-G; ' +
                '2 = PG / TV-Y7 / TV-PG; 3 = PG-13 / TV-14; ' +
                '4 = R / NC-17 / TV-MA.',
            },
            allowUnrated: { type: 'boolean', default: false },
            allowedMediaTypes: {
              type: 'array',
              minItems: 1,
              uniqueItems: true,
              items: {
                type: 'string',
                enum: ['video', 'short', 'livestream'],
              },
              default: ['video'],
            },
            maxActiveJobs: { type: 'integer', minimum: 1, maximum: 5, default: 5 },
            hourlyWriteLimit: { type: 'integer', minimum: 1, maximum: 30, default: 30 },
            dailyWriteLimit: { type: 'integer', minimum: 1, maximum: 200, default: 200 },
          },
        },
      },
    },
    security: [
      {
        SessionAuth: [],
      },
      {
        ApiKeyAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and session management',
      },
      {
        name: 'Setup',
        description: 'Initial setup endpoints (localhost only)',
      },
      {
        name: 'Channels',
        description: 'YouTube channel management',
      },
      {
        name: 'Videos',
        description: 'Video management and downloads',
      },
      {
        name: 'Jobs',
        description: 'Download job management',
      },
      {
        name: 'Configuration',
        description: 'Application configuration',
      },
      {
        name: 'Plex',
        description: 'Plex media server integration',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'API Keys',
        description: 'API key management for external integrations',
      },
      {
        name: 'External API',
        description: 'Versioned, API-key-authenticated integration endpoints',
      },
      {
        name: 'External Requests',
        description: 'Session-authenticated administrator review of external requests',
      },
      {
        name: 'Playlists',
        description: 'YouTube playlist subscriptions and downloads',
      },
    ],
  },
  // Use absolute paths based on __dirname to work in both local dev and Docker
  apis: [
    path.join(__dirname, 'server.js'),
    path.join(__dirname, 'routes', 'auth.js'),
    path.join(__dirname, 'routes', 'channels.js'),
    path.join(__dirname, 'routes', 'config.js'),
    path.join(__dirname, 'routes', 'health.js'),
    path.join(__dirname, 'routes', 'jobs.js'),
    path.join(__dirname, 'routes', 'plex.js'),
    path.join(__dirname, 'routes', 'setup.js'),
    path.join(__dirname, 'routes', 'videos.js'),
    path.join(__dirname, 'routes', 'videoSearch.js'),
    path.join(__dirname, 'routes', 'apikeys.js'),
    path.join(__dirname, 'routes', 'playlists.js'),
    path.join(__dirname, 'routes', 'externalApi.js'),
    path.join(__dirname, 'routes', 'externalRequests.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

const setupSwagger = (app) => {
  // Serve swagger UI at /swagger
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Youtarr API Documentation',
  }));

  // Also expose the raw OpenAPI spec as JSON
  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

module.exports = { setupSwagger, swaggerSpec };
