import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3011',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3011',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'], // Will rename existing setupTests if needed
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
  },
});
