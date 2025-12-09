/* eslint-env jest */

// Dummy test to satisfy Jest requirement that test files must contain at least one test
// This file is a utility module, not a test file
describe('testUtils', () => {
  test('exports findRouteHandlers', () => {
    expect(typeof findRouteHandlers).toBe('function');
  });

  test('exports findRouteHandler', () => {
    expect(typeof findRouteHandler).toBe('function');
  });
});

/**
 * Finds route handlers in an Express app, including nested routers
 * @param {Object} app - Express application
 * @param {string} method - HTTP method (get, post, etc.)
 * @param {string} routePath - Route path to find
 * @param {boolean} debug - Enable debug output
 * @returns {Array} Array of handler functions for the route
 */
const findRouteHandlers = (app, method, routePath, debug = false) => {
  const stack = app?._router?.stack || [];

  if (debug) {
    console.error(`Looking for ${method.toUpperCase()} ${routePath}`);
    console.error(`App router stack has ${stack.length} layers`);
  }

  // First, try to find the route directly on the app
  for (const layer of stack) {
    if (debug && layer.route) {
      console.error(`  Direct route: ${layer.route.path}, methods: ${JSON.stringify(layer.route.methods)}`);
    }
    if (layer.route && layer.route.path === routePath && layer.route.methods[method]) {
      return layer.route.stack.map((routeLayer) => routeLayer.handle);
    }
  }

  // If not found directly, search in nested routers
  // Express Router middleware can be identified by having a handle function with its own stack
  for (const layer of stack) {
    // Check if this layer has a handle with a stack (indicates it's a router)
    if (layer.handle && layer.handle.stack && Array.isArray(layer.handle.stack)) {
      if (debug) {
        console.error(`  Router layer (${layer.name}): ${layer.handle.stack.length} nested routes`);
      }
      const routerStack = layer.handle.stack;
      for (const routerLayer of routerStack) {
        if (debug && routerLayer.route) {
          console.error(`    Nested route: ${routerLayer.route.path}, methods: ${JSON.stringify(routerLayer.route.methods)}`);
        }
        if (routerLayer.route && routerLayer.route.path === routePath && routerLayer.route.methods[method]) {
          return routerLayer.route.stack.map((routeLayer) => routeLayer.handle);
        }
      }
    }
  }

  throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
};

/**
 * Finds a single route handler (the last one in the chain) in an Express app
 * @param {Object} app - Express application
 * @param {string} method - HTTP method (get, post, etc.)
 * @param {string} routePath - Route path to find
 * @returns {Function} The route handler function
 */
const findRouteHandler = (app, method, routePath) => {
  const handlers = findRouteHandlers(app, method, routePath);
  return handlers[handlers.length - 1];
};

module.exports = {
  findRouteHandlers,
  findRouteHandler
};

