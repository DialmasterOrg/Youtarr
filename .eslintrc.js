module.exports = {
  settings: {
    react: {
      version: "18.2",
    },
  },
  env: {
    browser: true,
    es2021: true,
  },
  extends: "plugin:react/recommended",
  overrides: [
    {
      // Backend test files
      files: ["server/**/__tests__/**/*.js", "server/**/*.test.js"],
      env: {
        jest: true,
        node: true,
      },
    },
    {
      // Frontend test files
      files: ["client/src/**/__tests__/**/*", "client/src/**/*.test.*"],
      extends: ["plugin:testing-library/react"],
      env: {
        jest: true,
      },
    },
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
  },
  plugins: ["react", "react-hooks", "@typescript-eslint"],
  rules: {
    "react/react-in-jsx-scope": "off",
  },
};
