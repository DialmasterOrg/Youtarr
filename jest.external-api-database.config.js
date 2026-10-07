const backendConfig = require('./jest.config');

module.exports = {
    ...backendConfig,
    roots: ['<rootDir>/migrations', '<rootDir>/server/testing'],
    testMatch: ['<rootDir>/migrations/__tests__/externalApiDatabase.integration.test.js', '<rootDir>/server/testing/externalRuntime.database.test.js'],
    testPathIgnorePatterns: [],
};
