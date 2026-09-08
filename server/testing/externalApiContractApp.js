'use strict';

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalApiAuth } = require('../middleware/externalApiAuth');
const { createExternalApiRoutes } = require('../routes/externalApi');
const { CatalogError, pagination: validatePagination } = require('../modules/externalCatalogService');

const SYNTHETIC_API_KEY = 'plinx-synthetic-key';
const LANDSCAPE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAZklEQVR4nI3GMQrCQBAF0H+udJJmxkpSmSLgCioraMIWG0nALby4f27w4RUPU2fXPjDKcT8apUNQjudgNw+McuST0XsMyvE6W0lOjHKs2alcgnLsi9dHYJRjm53aJyjHt/qvBUb5H8Jgm8kDX1f1AAAAAElFTkSuQmCC',
  'base64'
);
const SQUARE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAsklEQVR4nI3GywoBARgG0O/RLO3IQlIiNferuUSkNFm4rKbZuCwkC01KpEiShbKRd/I9wl9ncVAodanSjEhyFKtxXQ2JkRxtN6ByIyLJYcadmhISIzladkDB0CfJoYed/tgjRnIkc5f8gU+SY5Y5vcQjRnKMpi5lK5skxyR11luLGMmxy01KFzZJjsPJWG4sYiTHdm/S5aaT5MiPxuOlESM53h+VzledJMf3p9yfGjGS/wEEcYEIZzOCRwAAAABJRU5ErkJggg==',
  'base64'
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rawSyntheticKey() {
  return {
    id: 9001,
    name: 'Plinx synthetic contract',
    role: 'request',
    is_active: true,
    revoked_at: null,
    allow_video_requests: true,
    allow_channel_requests: false,
    allow_delete_video_requests: false,
    auto_approve_video_requests: false,
    auto_approve_channel_requests: false,
    auto_approve_delete_requests: false,
    max_rating_level: 2,
    allow_unrated: true,
    allowed_media_types: ['video', 'short', 'livestream'],
    max_active_jobs: 5,
    hourly_write_limit: 30,
    daily_write_limit: 200,
  };
}

function requestPage(requests, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
  const filtered = query.status
    ? requests.filter((request) => request.status === query.status)
    : requests;
  const data = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize);
  return {
    data,
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages,
      nextCursor: page < totalPages ? `synthetic-request-page-${page + 1}` : null,
    },
  };
}

function createExternalApiContractApp({ contract, scenario = 'normal', delayMs = 0 } = {}) {
  if (!contract) throw new Error('A canonical external API contract is required');

  const app = express();
  const initialRequests = () => {
    const unknownStatusVideoRequest = {
      ...clone(contract.unknownEnumSamples.request),
      id: '00000000-0000-4000-8000-000000000097',
      type: 'video',
      target: clone(contract.requests[0].target),
    };
    const completedVideoRequest = {
      ...clone(contract.requests[0]),
      id: '00000000-0000-4000-8000-000000000017',
      status: 'completed',
      createdAt: '2026-07-30T12:00:00.000Z',
      updatedAt: '2026-07-30T12:05:00.000Z',
      completedAt: '2026-07-30T12:05:00.000Z',
    };
    return [
      clone(contract.unknownEnumSamples.request),
      unknownStatusVideoRequest,
      completedVideoRequest,
      ...clone(contract.requests),
    ];
  };
  const state = {
    lastVideoRequest: null,
    lastVideoQuery: null,
    artworkRequests: [],
    requests: initialRequests(),
    scenario,
    delayMs,
  };
  const assetDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-contract-assets-'));
  const channelArtworkPath = path.join(assetDirectory, 'channel.png');
  fs.writeFileSync(channelArtworkPath, SQUARE_PNG);

  app.use((req, _res, next) => {
    req.id = 'synthetic-contract-request';
    next();
  });
  app.use('/__contract', express.json({ limit: '4kb' }));
  app.get('/__contract/ready', (_req, res) => res.json({ ready: true, scenario: state.scenario }));
  app.get('/__contract/state', (req, res) => {
    if (req.get('x-api-key') !== SYNTHETIC_API_KEY) return res.sendStatus(401);
    return res.json(state);
  });
  app.post('/__contract/scenario', (req, res) => {
    if (req.get('x-api-key') !== SYNTHETIC_API_KEY) return res.sendStatus(401);
    state.scenario = String(req.body.scenario || 'normal');
    state.delayMs = Math.max(0, Number(req.body.delayMs) || 0);
    state.lastVideoRequest = null;
    state.lastVideoQuery = null;
    state.artworkRequests = [];
    state.requests = initialRequests();
    return res.json({ scenario: state.scenario, delayMs: state.delayMs });
  });

  const pause = async () => {
    if (state.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
  };
  const failIfRequested = () => {
    if (state.scenario === 'server-error') throw new Error('synthetic server failure');
  };
  const terminalPage = (data) => ({
    ...clone(contract.catalogPage),
    data: clone(data),
    pagination: {
      ...clone(contract.catalogPage.pagination),
      total: data.length,
      totalPages: data.length === 0 ? 0 : 1,
      nextCursor: null,
    },
  });
  const visibleCatalog = () => {
    if (state.scenario === 'empty') return terminalPage([]);
    if (state.scenario === 'filtered') {
      return terminalPage([{
        ...clone(contract.catalogPage.data.find((video) => video.youtubeId === 'abcdefghijk')),
        youtubeId: 'unsafe00001',
        title: 'Locally filtered mature fixture',
        rating: 'TV-MA',
      }]);
    }
    if (state.scenario === 'malformed') return { malformed: true };
    const response = clone(contract.catalogPage);
    response.data.push({
      ...clone(response.data[0]),
      youtubeId: 'unsafe00001',
      title: 'Locally filtered mature fixture',
      rating: 'TV-MA',
    });
    return response;
  };

  const catalogService = {
    async listChannels() {
      await pause();
      failIfRequested();
      return clone(contract.channelsPage);
    },
    async listChannelVideos() {
      await pause();
      failIfRequested();
      return visibleCatalog();
    },
    async listVideos(_key, query) {
      await pause();
      failIfRequested();
      validatePagination(query, 100);
      if (query.search && String(query.search).length > 200) {
        throw new CatalogError('search must be at most 200 characters');
      }
      state.lastVideoQuery = clone(query);
      if (query.cursor) return clone(contract.catalogNextPage);
      const response = visibleCatalog();
      if (!Array.isArray(response.data)) return response;
      if (query.search) {
        response.data = response.data.filter((video) =>
          video.title.toLowerCase().includes(String(query.search).toLowerCase())
        );
        response.pagination.total = response.data.length;
      }
      return response;
    },
    async getVideoDetail(_key, youtubeId) {
      await pause();
      failIfRequested();
      const catalogVideo = contract.catalogPage.data.find((video) => video.youtubeId === youtubeId);
      if (!catalogVideo) {
        const error = new Error('Video not found');
        error.name = 'CatalogError';
        error.status = 404;
        throw error;
      }
      return {
        ...clone(contract.videoDetail),
        ...clone(catalogVideo),
        metadata: clone(contract.videoDetail.metadata),
      };
    },
    async getChannelThumbnail(_key, channelId) {
      state.artworkRequests.push(`channel:${channelId}`);
      return channelArtworkPath;
    },
    async getVideoThumbnail(_key, youtubeId) {
      state.artworkRequests.push(`video:${youtubeId}`);
      return { source: 'upstream', url: 'https://synthetic.invalid/video.png' };
    },
  };

  const requestService = {
    async createVideoRequest(_key, body) {
      state.lastVideoRequest = clone(body);
      const request = {
        id: '00000000-0000-4000-8000-000000000098',
        type: 'video',
        status: 'pending',
        target: { youtubeId: body.youtubeId, channelId: body.channelId, channelUrl: null },
        createdAt: '2026-07-31T12:30:00.000Z',
        updatedAt: '2026-07-31T12:30:00.000Z',
        decidedAt: null,
        completedAt: null,
        message: null,
      };
      state.requests.unshift(request);
      return { outcome: 'created', request };
    },
    async createChannelRequest() {
      return clone(contract.videoRequestResponses[1]);
    },
    async createDeleteVideoRequest() {
      return clone(contract.videoRequestResponses[2]);
    },
    async listRequests(_key, query) {
      await pause();
      failIfRequested();
      return requestPage(state.requests, query);
    },
    async getRequest(_key, id) {
      const request = state.requests.find((candidate) => candidate.id === id);
      if (request) return clone(request);
      const error = new Error('Request not found');
      error.name = 'RequestError';
      error.status = 404;
      throw error;
    },
  };

  app.use('/external-api/v1', (req, res, next) => {
    if (state.scenario === 'transport') {
      req.socket.destroy();
      return;
    }
    if (state.scenario === 'unsupported' && req.path === '/capabilities') {
      const sendJSON = res.json.bind(res);
      res.json = (body) => sendJSON({ ...body, apiVersion: '2' });
    }
    next();
  });

  app.use('/external-api/v1', createExternalApiRoutes({
    externalApiAuth: createExternalApiAuth({
      validateApiKey: async (value) =>
        state.scenario !== 'unauthorized' && value === SYNTHETIC_API_KEY ? rawSyntheticKey() : null,
    }),
    externalApiLimiter: (_req, _res, next) => next(),
    serverVersion: contract.capabilities.serverVersion,
    catalogService,
    thumbnailProxy: {
      fetchExternalThumbnail: async () => ({ body: LANDSCAPE_PNG, contentType: 'image/png' }),
    },
    externalWorkLimiter: { run: (operation) => operation() },
    requestService,
    quotaService: {
      status: async () => ({
        limits: { maxActiveJobs: 5, hourlyWriteLimit: 30, dailyWriteLimit: 200 },
        remaining: { activeJobs: 5, hourlyWrites: 30, dailyWrites: 200 },
      }),
    },
  }));

  return { app, state };
}

module.exports = {
  SYNTHETIC_API_KEY,
  createExternalApiContractApp,
};
