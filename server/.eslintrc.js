module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:testing-library/react'
  ],
  parserOptions: {
    ecmaVersion: 12
  },
  plugins: ['testing-library'],
  rules: {
    indent: ['error', 2],
    'linebreak-style': 'off',
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'react/no-unescaped-entities': 'off',
    'react/prop-types': 'off'
  }
};