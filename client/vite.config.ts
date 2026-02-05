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
        // All API-related paths (cache control is handled server-side, not here)
        '/api': { 
          target: backendTarget, 
          changeOrigin: true,
          ws: false,
        },
        '/auth': { 
          target: backendTarget, 
          changeOrigin: true,
          ws: false,
        },
        '/setup': { 
          target: backendTarget, 
          changeOrigin: true,
          ws: false,
        },
        '/getconfig': { 
          target: backendTarget, 
          changeOrigin: true, 
          ws: false,
        },
        '/updateconfig': { target: backendTarget, changeOrigin: true, ws: false },
        '/validateToken': { target: backendTarget, changeOrigin: true, ws: false },
        '/getCurrentReleaseVersion': { target: backendTarget, changeOrigin: true, ws: false },
        '/getlogs': { target: backendTarget, changeOrigin: true, ws: false },
        '/getVideos': { target: backendTarget, changeOrigin: true, ws: false },
        '/getvideos': { target: backendTarget, changeOrigin: true, ws: false },
        '/getchannels': { target: backendTarget, changeOrigin: true, ws: false },
        '/getChannels': { target: backendTarget, changeOrigin: true, ws: false },
        '/getchannelvideos': { target: backendTarget, changeOrigin: true, ws: false },
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
        '/getChannelInfo': { target: backendTarget, changeOrigin: true, ws: false },
        '/refreshlibrary': { target: backendTarget, changeOrigin: true, ws: false },
      },
    },
    build: {
      outDir: 'build',
      sourcemap: true,
    },
  };
});

