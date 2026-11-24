/* eslint-env jest */
const { createSabnzbdApi } = require('../sabnzbdApi');
const { buildNzb } = require('../nzbFile');

const KEY = 'k'.repeat(64);
const GRAB_ID = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';
const OTHER_ID = '11111111-2222-4333-8444-555555555555';
const TITLE = 'The.Office.US.S01E02.1080p.WEB-DL-NBC';
const STAGED = `/data/.arr-staging/tv/${TITLE}/${TITLE}.mkv`;
const fields = {
  youtubeId: 'abcdefghijk',
  kind: 'tv',
  releaseTitle: TITLE,
  uploadDate: new Date('2024-03-01T12:00:00.000Z'),
  estimatedBytes: 1000,
};
const nzbUpload = () => ({ buffer: Buffer.from(buildNzb(fields)), originalname: `${TITLE}.nzb` });

function setup({ queue = [], history = [], paused = false } = {}) {
  const grabService = {
    addGrab: jest.fn().mockResolvedValue({ id: GRAB_ID }),
    listQueue: jest.fn().mockResolvedValue(queue),
    listHistory: jest.fn().mockResolvedValue(history),
    removeFromQueue: jest.fn().mockResolvedValue(undefined),
    removeFromHistory: jest.fn().mockResolvedValue(undefined),
  };
  const api = createSabnzbdApi({
    getConfig: () => ({ arrBridgeEnabled: true, arrBridgeApiKey: KEY, arrBridgeCategories: [{ name: 'tv' }, { name: 'tv-4k' }] }),
    grabService,
    staging: {
      stagingRoot: () => '/data/.arr-staging',
      clientPath: (localPath) => localPath.replace('/data/.arr-staging', '/downloads/staging'),
    },
    getActivity: () => null,
    isPaused: () => paused,
    logger: { warn: jest.fn(), info: jest.fn() },
  });
  return { api, grabService };
}

const call = (api, query, extra = {}) => api.handle({ query: { apikey: KEY, output: 'json', ...query }, body: {}, ...extra });

describe('sabnzbdApi', () => {
  test('version answers without a key, as SABnzbd does', async () => {
    const { api } = setup();
    const response = await api.handle({ query: { mode: 'version' }, body: {} });
    expect(response).toEqual({ status: 200, json: { version: '4.3.0' } });
  });

  test('every other mode with a wrong key reports it in the words Sonarr looks for', async () => {
    const { api, grabService } = setup();
    const response = await api.handle({ query: { mode: 'queue', apikey: 'wrong' }, body: {} });
    expect(response).toEqual({ status: 200, json: { status: false, error: 'API Key Incorrect' } });
    expect(grabService.listQueue).not.toHaveBeenCalled();
  });

  test('get_config reports the staging root as the apps see it and the configured categories', async () => {
    const { api } = setup();
    const { json } = await call(api, { mode: 'get_config' });
    expect(json.config.misc.complete_dir).toBe('/downloads/staging');
    expect(json.config.categories.map((category) => category.name)).toEqual(['*', 'tv', 'tv-4k']);
  });

  test('fullstatus reports the completed folder', async () => {
    const { api } = setup();
    const { json } = await call(api, { mode: 'fullstatus' });
    expect(json).toEqual({ status: { completedir: '/downloads/staging' } });
  });

  describe('queue', () => {
    const waiting = { id: GRAB_ID, category: 'tv', release_title: TITLE, status: 'pending', job_id: null, estimated_bytes: 0 };

    test('lists the waiting grabs of the asked category', async () => {
      const { api, grabService } = setup({ queue: [waiting] });
      const { json } = await call(api, { mode: 'queue', category: 'tv', start: '0', limit: '0' });
      expect(grabService.listQueue).toHaveBeenCalledWith('tv');
      expect(json.queue.slots.map((slot) => slot.nzo_id)).toEqual([GRAB_ID]);
    });

    test('shows them paused while downloads are paused', async () => {
      const { api } = setup({ queue: [waiting], paused: true });
      const { json } = await call(api, { mode: 'queue' });
      expect(json.queue.slots[0].status).toBe('Paused');
    });

    test('delete removes each named grab from the queue', async () => {
      const { api, grabService } = setup();
      const { json } = await call(api, { mode: 'queue', name: 'delete', value: `${GRAB_ID},${OTHER_ID}`, del_files: '1' });
      expect(grabService.removeFromQueue.mock.calls).toEqual([[GRAB_ID], [OTHER_ID]]);
      expect(json).toEqual({ status: true, nzo_ids: [GRAB_ID, OTHER_ID] });
    });
  });

  describe('history', () => {
    const completed = {
      id: GRAB_ID, category: 'tv', release_title: TITLE, status: 'completed', staged_path: STAGED, bytes: 4096,
      created_at: new Date('2025-06-01T10:00:00.000Z'), completed_at: new Date('2025-06-01T10:05:00.000Z'),
    };

    test('lists finished grabs with the staged file as the apps see it', async () => {
      const { api, grabService } = setup({ history: [completed] });
      const { json } = await call(api, { mode: 'history', category: 'tv', start: '0', limit: '60' });
      expect(grabService.listHistory).toHaveBeenCalledWith('tv', '60');
      expect(json.history.slots[0]).toMatchObject({
        name: TITLE,
        status: 'Completed',
        storage: `/downloads/staging/tv/${TITLE}/${TITLE}.mkv`,
      });
    });

    test('delete removes each named grab, as the apps ask after an import', async () => {
      const { api, grabService } = setup();
      const { json } = await call(api, { mode: 'history', name: 'delete', value: GRAB_ID, del_files: '1', archive: '1' });
      expect(grabService.removeFromHistory.mock.calls).toEqual([[GRAB_ID]]);
      expect(json).toEqual({ status: true });
    });
  });

  describe('addfile', () => {
    test('adds a grab for an uploaded carrier NZB', async () => {
      const { api, grabService } = setup();
      const response = await call(api, { mode: 'addfile', cat: 'tv', priority: '-100' }, { file: nzbUpload() });
      expect(grabService.addGrab).toHaveBeenCalledWith({ fields, category: 'tv' });
      expect(response).toEqual({ status: 200, json: { status: true, nzo_ids: [GRAB_ID] } });
    });

    test('reads mode and category from the form body when the query has none', async () => {
      const { api, grabService } = setup();
      const response = await api.handle({
        query: { apikey: KEY }, body: { mode: 'addfile', cat: 'tv-4k' }, file: nzbUpload(),
      });
      expect(grabService.addGrab).toHaveBeenCalledWith({ fields, category: 'tv-4k' });
      expect(response.json.status).toBe(true);
    });

    test.each([
      ['an NZB from somewhere else', { buffer: Buffer.from('<nzb><file/></nzb>') }],
      ['no file', undefined],
    ])('answers status false with HTTP 200 for %s', async (_name, file) => {
      const { api, grabService } = setup();
      const response = await call(api, { mode: 'addfile', cat: 'tv' }, { file });
      expect(response).toEqual({ status: 200, json: { status: false, error: 'Not a Youtarr NZB' } });
      expect(grabService.addGrab).not.toHaveBeenCalled();
    });

    test('passes on the reason a grab was refused', async () => {
      const { api, grabService } = setup();
      grabService.addGrab.mockResolvedValue({ error: 'Category music is not configured in Youtarr' });
      const response = await call(api, { mode: 'addfile', cat: 'music' }, { file: nzbUpload() });
      expect(response).toEqual({
        status: 200, json: { status: false, error: 'Category music is not configured in Youtarr' },
      });
    });
  });

  test('an unknown mode answers status false with HTTP 200', async () => {
    const { api } = setup();
    const response = await call(api, { mode: 'shutdown' });
    expect(response).toEqual({ status: 200, json: { status: false, error: 'Mode shutdown is not supported' } });
  });

  test('a mode that is not plain text is not echoed', async () => {
    const { api } = setup();
    expect((await call(api, { mode: ['queue'] })).json).toEqual({ status: false, error: 'Mode is not supported' });
    expect((await call(api, { mode: '<script>' })).json).toEqual({ status: false, error: 'Mode is not supported' });
  });

  test('a missing mode answers status false', async () => {
    const { api } = setup();
    expect((await call(api, {})).json.status).toBe(false);
  });
});
