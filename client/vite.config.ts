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
        '/ws': {
          target: backendTarget.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ws/, ''),
        },
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
        '/getChannelInfo': { target: backendTarget, changeOrigin: true },
        '/getchannelinfo': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/getchannelinfo/, '/getChannelInfo'),
        },
        '/getchannelvideos': { target: backendTarget, changeOrigin: true },
        '/refreshlibrary': { target: backendTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: 'build',
      sourcemap: true,
    },
  };
});
