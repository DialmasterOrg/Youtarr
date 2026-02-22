/**
 * Default MSW request handlers shared across all Storybook stories.
 *
 * These provide baseline API responses so stories render without real network
 * requests. Individual stories can override handlers via `parameters.msw`.
 *
 * Regenerate mockServiceWorker.js if it goes missing:
 *   cd client && npx msw init public/ --save
 */
import { http, HttpResponse } from 'msw';
import { DEFAULT_CONFIG } from '../../src/config/configSchema';

export const defaultMswHandlers = [
  http.get('/getconfig', () =>
    HttpResponse.json({
      ...DEFAULT_CONFIG,
      preferredResolution: '1080',
      channelFilesToDownload: 3,
      youtubeOutputDirectory: '/downloads/youtube',
      isPlatformManaged: {
        plexUrl: false,
        authEnabled: true,
        useTmpForDownloads: false,
      },
      deploymentEnvironment: {
        platform: null,
        isWsl: false,
      },
    })
  ),
  http.get('/storage-status', () =>
    HttpResponse.json({
      availableGB: '100',
      percentFree: 50,
      totalGB: '200',
    })
  ),
  http.get('/api/channels/subfolders', () => HttpResponse.json(['Movies', 'Shows'])),
  http.get('/api/cookies/status', () =>
    HttpResponse.json({
      cookiesEnabled: false,
      customCookiesUploaded: false,
      customFileExists: false,
    })
  ),
  http.get('/api/keys', () => HttpResponse.json({ keys: [] })),
  http.get('/api/db-status', () => HttpResponse.json({ status: 'healthy' })),
  http.get('/setup/status', () =>
    HttpResponse.json({
      requiresSetup: false,
      isLocalhost: true,
      platformManaged: false,
    })
  ),
  http.get('/getCurrentReleaseVersion', () =>
    HttpResponse.json({
      version: '1.0.0',
      ytDlpVersion: '2024.01.01',
    })
  ),
  http.get('/get-running-jobs', () => HttpResponse.json([])),
  http.get('/runningjobs', () => HttpResponse.json([])),
];
