import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  const backendPort = process.env.VITE_BACKEND_PORT || '3011';
  const backendTarget = `http://127.0.0.1:${backendPort}`;

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'REACT_APP_'],
    server: {
      port: 3000,
      proxy: {
        // Handle WebSocket path explicitly first
        '/ws': {
          target: backendTarget.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ws/, ''),
        },
        // All API-related paths
        '/api': { 
          target: backendTarget, 
          changeOrigin: true,
          ws: false,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        },
        '/auth': { 
          target: backendTarget, 
          changeOrigin: true,
          ws: false,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        },
        '/setup': { 
          target: backendTarget, 
          changeOrigin: true,
          ws: false,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        },
        '/getconfig': { 
          target: backendTarget, 
          changeOrigin: true, 
          ws: false,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        },
        '/updateconfig': { target: backendTarget, changeOrigin: true, ws: false },
        '/validateToken': { target: backendTarget, changeOrigin: true, ws: false },
        '/getCurrentReleaseVersion': { target: backendTarget, changeOrigin: true, ws: false },
        '/getlogs': { target: backendTarget, changeOrigin: true, ws: false },
        '/getVideos': { target: backendTarget, changeOrigin: true, ws: false, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } },
        '/getvideos': { target: backendTarget, changeOrigin: true, ws: false, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } },
        '/getchannels': { target: backendTarget, changeOrigin: true, ws: false, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } },
        '/getChannels': { target: backendTarget, changeOrigin: true, ws: false, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } },
        '/getchannelvideos': { target: backendTarget, changeOrigin: true, ws: false, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } },
        '/runningjobs': { target: backendTarget, changeOrigin: true, ws: false },
        '/jobstatus': { target: backendTarget, changeOrigin: true, ws: false },
        '/storage-status': { target: backendTarget, changeOrigin: true, ws: false },
        '/getplexlibraries': { target: backendTarget, changeOrigin: true, ws: false },
        '/triggerchanneldownloads': { target: backendTarget, changeOrigin: true, ws: false },
        '/triggerspecificdownloads': { target: backendTarget, changeOrigin: true, ws: false },
        '/addchannel': { target: backendTarget, changeOrigin: true, ws: false },
        '/addchannelinfo': { target: backendTarget, changeOrigin: true, ws: false },
        '/updatechannels': { target: backendTarget, changeOrigin: true, ws: false },
        '/plex': { target: backendTarget, changeOrigin: true, ws: false },
        '/images': { target: backendTarget, changeOrigin: true, ws: false },
        '/fetchallchannelvideos': { target: backendTarget, changeOrigin: true, ws: false },
        '/getChannelInfo': { target: backendTarget, changeOrigin: true, ws: false, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } },
        '/refreshlibrary': { target: backendTarget, changeOrigin: true, ws: false },
      },
    },
    build: {
      outDir: 'build',
      sourcemap: true,
    },
  };
});

