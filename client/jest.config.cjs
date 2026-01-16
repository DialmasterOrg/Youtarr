module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.(ts|tsx|js|jsx)', '**/?(*.)+(spec|test).(ts|tsx|js|jsx)'],
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
            decorators: false,
          },
          target: 'es2022',
          transform: {
            react: {
              runtime: 'automatic',
            },
            optimizer: {
              globals: {
                vars: {
                  'import.meta.env.MODE': '"test"',
                  'import.meta.env.DEV': 'false',
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
  transformIgnorePatterns: [
    '/node_modules/(?!until-async|msw|@mswjs|@mswjs\/interceptors|@mswjs\/.*)/',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/', '<rootDir>/storybook-static/'],
};
