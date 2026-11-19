module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/server', '<rootDir>/migrations'],
    testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/.eslintrc.js',
        '!server/**/__tests__/**',
        '!server/models/**',
        '!client/src/types/**',
        '!server/node_modules/**',
        '!**/index.ts',
        '!**/constants.ts',
        '!**/types.ts',
        '!client/src/config/configSchema.ts'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testTimeout: 10000,
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testPathIgnorePatterns: ['<rootDir>/server/testing/externalRuntime.database.test.js', '<rootDir>/migrations/__tests__/externalApiDatabase\\.integration\\.test\\.js$'],
    maxWorkers: 1
};
