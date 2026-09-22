const fs = require('fs');
const path = require('path');

const { discoverSwaggerFiles, swaggerSpec } = require('../swagger');

describe('Swagger contract', () => {
  test('produces a non-empty OpenAPI 3 document', () => {
    expect(swaggerSpec.openapi).toMatch(/^3\./);
    expect(Object.keys(swaggerSpec.paths || {})).not.toHaveLength(0);
  });

  test('discovers every annotated JavaScript route source', () => {
    const routeDir = path.join(__dirname, '..', 'routes');
    const annotatedRoutes = fs.readdirSync(routeDir)
      .filter((fileName) => fileName.endsWith('.js'))
      .filter((fileName) => fs.readFileSync(path.join(routeDir, fileName), 'utf8').includes('@swagger'))
      .map((fileName) => path.join(routeDir, fileName));

    expect(discoverSwaggerFiles()).toEqual(expect.arrayContaining(annotatedRoutes));
  });

  test('keeps server initialization compatible with minimal filesystem adapters', () => {
    expect(discoverSwaggerFiles({})).toEqual([
      path.join(__dirname, '..', 'server.js'),
    ]);
  });

  test('contains representative paths from previously omitted route modules', () => {
    expect(swaggerSpec.paths).toEqual(expect.objectContaining({
      '/api/maintenance/rescan-files': expect.any(Object),
      '/api/subscriptions/imports': expect.any(Object),
      '/api/mediaservers/watch-status': expect.any(Object),
    }));
  });
});
