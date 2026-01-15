import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react(), tsconfigPaths(), storybookTest()],
  optimizeDeps: {
    // Avoid Vite re-optimizing dependencies mid test run.
    // When this happens, the browser test runner can fail to dynamically
    // import chunks from the previous optimization output.
    include: [
      'react-markdown',
      '@mui/icons-material/Edit',
      '@mui/icons-material/Send',
      '@mui/icons-material/Warning',
    ],
  },
  test: {
    name: 'storybook',
    setupFiles: ['.storybook/vitest.setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  },
});
