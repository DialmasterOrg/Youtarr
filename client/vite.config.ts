import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const backendTarget = process.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:3011';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: backendTarget, changeOrigin: true },
      '/auth': { target: backendTarget, changeOrigin: true },
      '/setup': { target: backendTarget, changeOrigin: true },
      '/getconfig': { target: backendTarget, changeOrigin: true },
      '/updateconfig': { target: backendTarget, changeOrigin: true },
      '/validateToken': { target: backendTarget, changeOrigin: true },
      '/getCurrentReleaseVersion': { target: backendTarget, changeOrigin: true },
      '/getlogs': { target: backendTarget, changeOrigin: true },
      '/getVideos': { target: backendTarget, changeOrigin: true },
      '/getvideos': { target: backendTarget, changeOrigin: true },
      '/getchannels': { target: backendTarget, changeOrigin: true },
      '/getChannels': { target: backendTarget, changeOrigin: true },
      '/runningjobs': { target: backendTarget, changeOrigin: true },
      '/jobstatus': { target: backendTarget, changeOrigin: true },
      '/storage-status': { target: backendTarget, changeOrigin: true },
      '/getplexlibraries': { target: backendTarget, changeOrigin: true },
      '/triggerchanneldownloads': { target: backendTarget, changeOrigin: true },
      '/triggerspecificdownloads': { target: backendTarget, changeOrigin: true },
      '/addchannel': { target: backendTarget, changeOrigin: true },
      '/addchannelinfo': { target: backendTarget, changeOrigin: true },
      '/updatechannels': { target: backendTarget, changeOrigin: true },
      '/plex': { target: backendTarget, changeOrigin: true },
      '/images': { target: backendTarget, changeOrigin: true },
      '/fetchallchannelvideos': { target: backendTarget, changeOrigin: true },
      '/getchannelinfo': { target: backendTarget, changeOrigin: true },
      '/getchannelvideos': { target: backendTarget, changeOrigin: true },
      '/refreshlibrary': { target: backendTarget, changeOrigin: true },
      '/ws': {
        target: backendTarget.replace(/^http/, 'ws'),
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
    setupFiles: ['./src/setupTests.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        'src/test-utils.tsx',
        '**/*.d.ts',
        '**/*.stories.tsx',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    // Enable UI for better test debugging
    ui: true,
    // Watch mode configuration
    watch: {
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    },
  },
});
