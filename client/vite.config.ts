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
      '/api': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/auth': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/setup': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getconfig': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/updateconfig': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/validateToken': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getCurrentReleaseVersion': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getlogs': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getVideos': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getvideos': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getchannels': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getChannels': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/runningjobs': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/jobstatus': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/storage-status': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getplexlibraries': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/triggerchanneldownloads': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/triggerspecificdownloads': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/addchannel': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/addchannelinfo': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/updatechannels': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/plex': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/images': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/fetchallchannelvideos': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getchannelinfo': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/getchannelvideos': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/refreshlibrary': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/ws': {
        target: 'ws://127.0.0.1:3011',
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
