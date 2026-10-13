const backendConfig = require('./jest.config');

module.exports = {
    ...backendConfig,
    roots: ['<rootDir>/migrations'],
    testMatch: ['<rootDir>/migrations/__tests__/externalApiDatabase.integration.test.js'],
    testPathIgnorePatterns: [],
};
