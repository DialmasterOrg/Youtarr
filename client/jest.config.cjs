module.exports = {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  resetMocks: true,
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'jest-transform-stub',
    '\\.(png|jpg|jpeg|gif|svg|webp|mp4|mp3|wav|woff2?|ttf|eot)$': 'jest-transform-stub',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: true,
          },
          target: 'es2022',
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
            react: {
              runtime: 'automatic',
            },
            optimizer: {
              globals: {
                vars: {
                  'import.meta.env.DEV': 'true',
                  'import.meta.env.MODE': '"test"',
                },
              },
            },
          },
        },
        module: {
          type: 'commonjs',
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/src/setupTests.ts'],
  transformIgnorePatterns: ['/node_modules/(?!(@mui|@emotion)\\/)/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/', '<rootDir>/storybook-static/'],
};
