import { rest } from 'msw';

// Mock API handlers for all backend endpoints
export const handlers = [
  // Setup endpoints
  rest.get('/setup/status', (req, res, ctx) => {
    return res(ctx.json({
      requiresSetup: false,
      isLocalhost: true,
      message: null,
    }));
  }),

  rest.post('/setup/create-auth', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      message: 'Authentication setup complete',
    }));
  }),

  // Authentication endpoints
  rest.post('/auth/login', (req, res, ctx) => {
    return res(ctx.json({
      token: 'mock-jwt-token',
      user: { username: 'admin' },
    }));
  }),

  rest.post('/auth/validate', (req, res, ctx) => {
    return res(ctx.json({
      valid: true,
      user: { username: 'admin' },
    }));
  }),

  // Configuration endpoints
  rest.get('/getconfig', (req, res, ctx) => {
    return res(ctx.json({
      youtubeOutputDirectory: '/app/data',
      preferredResolution: '1080p',
      darkModeEnabled: false,
      plexUrl: 'http://localhost:32400',
      plexToken: 'mock-plex-token',
      autoRemovalEnabled: false,
      writeChannelPosters: true,
      writeVideoNfoFiles: true,
    }));
  }),

  rest.post('/updateconfig', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      message: 'Configuration updated',
    }));
  }),

  // Database status
  rest.get('/api/db-status', (req, res, ctx) => {
    return res(ctx.json({
      status: 'healthy',
      database: {
        connected: true,
        schemaValid: true,
        errors: [],
      },
    }));
  }),

  // Channels endpoints
  rest.get('/getchannels', (req, res, ctx) => {
    return res(ctx.json([
      {
        id: 1,
        name: 'Test Channel',
        url: 'https://youtube.com/channel/test',
        enabled: true,
        video_quality: '1080p',
        sub_folder: null,
        last_fetched: new Date().toISOString(),
      },
    ]));
  }),

  rest.get('/getChannelInfo/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(ctx.json({
      id: parseInt(id as string),
      name: 'Test Channel',
      url: 'https://youtube.com/channel/test',
      description: 'A test channel',
      subscriberCount: '100K',
      videoCount: 500,
      thumbnail: '/images/channel-thumb.jpg',
    }));
  }),

  rest.post('/addchannel', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      channel: {
        id: 2,
        name: 'New Channel',
        url: 'https://youtube.com/channel/new',
        enabled: true,
      },
    }));
  }),

  rest.post('/updatechannels', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      updated: 1,
    }));
  }),

  // Videos endpoints
  rest.get('/getVideos', (req, res, ctx) => {
    return res(ctx.json([
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
    ]));
  }),

  rest.get('/getvideos', (req, res, ctx) => {
    return res(ctx.json({
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
    }));
  }),

  // Download manager endpoints
  rest.get('/runningjobs', (req, res, ctx) => {
    return res(ctx.json([]));
  }),

  rest.get('/jobstatus', (req, res, ctx) => {
    return res(ctx.json({
      active: [],
      queued: [],
      completed: [],
    }));
  }),

  rest.post('/triggerchanneldownloads', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      message: 'Download triggered',
      jobId: 'job-123',
    }));
  }),

  // Storage status
  rest.get('/storage-status', (req, res, ctx) => {
    return res(ctx.json({
      total: 1000000000, // 1GB
      used: 500000000,   // 500MB
      available: 500000000, // 500MB
      percentFree: 50,
    }));
  }),

  // Plex integration
  rest.get('/getplexlibraries', (req, res, ctx) => {
    return res(ctx.json([
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
    ]));
  }),

  // System endpoints
  rest.get('/getCurrentReleaseVersion', (req, res, ctx) => {
    return res(ctx.json({
      version: '1.56.0',
      ytDlpVersion: '2024.01.01',
    }));
  }),

  rest.get('/getlogs', (req, res, ctx) => {
    return res(ctx.json({
      logs: [
        '[2024-01-01] INFO: Application started',
        '[2024-01-01] INFO: Database connected',
      ],
    }));
  }),

  // Images endpoint (mock binary response)
  rest.get('/images/:filename', (req, res, ctx) => {
    return res(
      ctx.set('Content-Type', 'image/jpeg'),
      ctx.body(new ArrayBuffer(1024)) // Mock image data
    );
  }),

  // Error scenarios for testing
  rest.get('/api/error-500', (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
  }),

  rest.get('/api/error-403', (req, res, ctx) => {
    return res(ctx.status(403), ctx.json({ error: 'Forbidden' }));
  }),

  rest.get('/api/error-404', (req, res, ctx) => {
    return res(ctx.status(404), ctx.json({ error: 'Not found' }));
  }),
];