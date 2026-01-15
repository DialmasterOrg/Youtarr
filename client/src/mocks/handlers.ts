import { http, HttpResponse } from 'msw';
import type { RequestHandler } from 'msw';

// Mock API handlers for all backend endpoints
export const handlers: RequestHandler[] = [
  // Setup endpoints
  http.get('/setup/status', () => {
    return HttpResponse.json({
      requiresSetup: false,
      isLocalhost: true,
      message: null,
    });
  }),

  http.post('/setup/create-auth', () => {
    return HttpResponse.json({
      success: true,
      message: 'Authentication setup complete',
    });
  }),

  // Authentication endpoints
  http.post('/auth/login', () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { username: 'admin' },
    });
  }),

  http.post('/auth/validate', () => {
    return HttpResponse.json({
      valid: true,
      user: { username: 'admin' },
    });
  }),

  // Configuration endpoints
  http.get('/getconfig', () => {
    return HttpResponse.json({
      youtubeOutputDirectory: '/app/data',
      preferredResolution: '1080p',
      darkModeEnabled: false,
      plexUrl: 'http://localhost:32400',
      plexToken: 'mock-plex-token',
      autoRemovalEnabled: false,
      writeChannelPosters: true,
      writeVideoNfoFiles: true,
    });
  }),

  http.post('/updateconfig', () => {
    return HttpResponse.json({
      success: true,
      message: 'Configuration updated',
    });
  }),

  // Database status
  http.get('/api/db-status', () => {
    return HttpResponse.json({
      status: 'healthy',
      database: {
        connected: true,
        schemaValid: true,
        errors: [],
      },
    });
  }),

  // Channels endpoints
  http.get('/getchannels', () => {
    return HttpResponse.json({
      channels: [
        {
          url: 'https://youtube.com/channel/UC_TEST',
          uploader: 'Test Channel',
          channel_id: 'UC_TEST',
          description: 'A test channel',
          sub_folder: null,
          video_quality: '1080',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null,
          available_tabs: 'videos,shorts,streams',
          auto_download_enabled_tabs: 'video,short',
        },
      ],
      total: 1,
      totalPages: 1,
      subFolders: ['Movies', 'TV Shows'],
    });
  }),

  http.get('/getChannelInfo/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      url: `https://youtube.com/channel/${id}`,
      uploader: 'Test Channel',
      channel_id: id as string,
      description: 'A test channel',
      sub_folder: null,
      video_quality: '1080',
      min_duration: null,
      max_duration: null,
      title_filter_regex: null,
      available_tabs: 'videos,shorts,streams',
      auto_download_enabled_tabs: 'video,livestream',
    });
  }),

  // ChannelPage dependencies
  http.get('/getchannelvideos/:channelId', ({ params }) => {
    const { channelId } = params;
    return HttpResponse.json({
      videos: [
        {
          title: 'Channel Video 1',
          youtube_id: 'chanvid1',
          publishedAt: '2024-01-01T00:00:00Z',
          thumbnail: 'https://img.youtube.com/vi/chanvid1/mqdefault.jpg',
          added: false,
          removed: false,
          youtube_removed: false,
          duration: 600,
          availability: 'available',
          media_type: 'video',
          live_status: 'none',
          ignored: false,
          ignored_at: null,
        },
      ],
      totalCount: 1,
      oldestVideoDate: '2024-01-01',
      videoFail: false,
      autoDownloadsEnabled: true,
      availableTabs: ['videos', 'shorts', 'streams'],
    });
  }),

  http.get('/api/channels/:channelId/tabs', () => {
    return HttpResponse.json({
      availableTabs: ['videos', 'shorts', 'streams'],
    });
  }),

  http.get('/api/channels/:channelId/settings', () => {
    return HttpResponse.json({
      sub_folder: null,
      video_quality: '1080',
      min_duration: null,
      max_duration: null,
      title_filter_regex: null,
      auto_download_enabled_tabs: 'video,livestream',
      available_tabs: 'videos,shorts,streams',
    });
  }),

  http.post('/api/channels/:channelId/settings', async () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/channels/subfolders', () => {
    return HttpResponse.json({
      subfolders: ['__Movies', '__TV Shows', '__Documentaries'],
      defaultSubfolder: 'Movies',
    });
  }),

  http.post('/addchannel', () => {
    return HttpResponse.json({
      success: true,
      channel: {
        id: 2,
        name: 'New Channel',
        url: 'https://youtube.com/channel/new',
        enabled: true,
      },
    });
  }),

  http.post('/updatechannels', () => {
    return HttpResponse.json({
      success: true,
      updated: 1,
    });
  }),

  // Videos endpoints
  http.get('/getVideos', () => {
    return HttpResponse.json({
      videos: [
        {
          id: 1,
          youtubeId: 'test123',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video',
          timeCreated: new Date().toISOString(),
          originalDate: '20240101',
          duration: 3600,
          description: 'A test video for Storybook/MSW',
          removed: false,
          fileSize: '1073741824',
        },
      ],
      total: 1,
      totalPages: 1,
      page: 1,
      limit: 12,
      channels: ['Test Channel'],
      enabledChannels: [
        { channel_id: 'UC_TEST', uploader: 'Test Channel', enabled: true },
      ],
    });
  }),

  http.get('/getvideos', () => {
    return HttpResponse.json({
      videos: [
        {
          id: 1,
          youtube_id: 'test123',
          title: 'Test Video',
          channel_id: 1,
          duration: 3600,
          file_path: '/app/data/test.mp4',
          thumbnail: '/images/video-thumb.jpg',
          published_at: new Date().toISOString(),
          downloaded_at: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  }),

  // Download manager endpoints
  http.get('/runningjobs', () => {
    return HttpResponse.json([]);
  }),

  http.get('/jobstatus', () => {
    return HttpResponse.json({
      active: [],
      queued: [],
      completed: [],
    });
  }),

  http.post('/triggerchanneldownloads', () => {
    return HttpResponse.json({
      success: true,
      message: 'Download triggered',
      jobId: 'job-123',
    });
  }),

  // Storage status
  http.get('/storage-status', () => {
    return HttpResponse.json({
      availableGB: '50',
      totalGB: '100',
      percentFree: 50,
    });
  }),

  // Plex integration
  http.get('/getplexlibraries', () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Movies',
        type: 'movie',
      },
      {
        id: 2,
        name: 'TV Shows',
        type: 'show',
      },
    ]);
  }),

  // System endpoints
  http.get('/getCurrentReleaseVersion', () => {
    return HttpResponse.json({
      version: '1.56.0',
      ytDlpVersion: '2024.01.01',
    });
  }),

  http.get('/getlogs', () => {
    return HttpResponse.json({
      logs: [
        '[2024-01-01] INFO: Application started',
        '[2024-01-01] INFO: Database connected',
      ],
    });
  }),

  // Images endpoint (mock binary response)
  http.get('/images/:filename', () => {
    return new HttpResponse(new ArrayBuffer(1024), {
      headers: { 'Content-Type': 'image/jpeg' },
    });
  }),

  // Error scenarios for testing
  http.get('/api/error-500', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }),

  http.get('/api/error-403', () => {
    return HttpResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }),

  http.get('/api/error-404', () => {
    return HttpResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }),
];

/**
 * Utility for Storybook stories: keep the global handler set, but allow story-level overrides.
 *
 * Note: when merging Storybook parameters, `parameters.msw.handlers` is replaced, not merged.
 * Using this helper prevents accidental 404s during `test-storybook` runs.
 */
export function withMswHandlers(...overrides: RequestHandler[]): RequestHandler[] {
  return [...overrides, ...handlers];
}