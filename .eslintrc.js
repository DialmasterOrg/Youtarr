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
      files: ["server/**/__tests__/**/*.js", "server/**/*.test.js"],
      env: {
        jest: true,
        node: true,
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
