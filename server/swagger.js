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
          description: 'API key for external integrations (bookmarklets, shortcuts). Only works for /api/videos/download endpoint.',
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
    path.join(__dirname, 'routes', 'apikeys.js'),
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

