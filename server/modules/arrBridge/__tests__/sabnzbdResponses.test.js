/* eslint-env jest */
const responses = require('../sabnzbdResponses');

const MB = 1024 * 1024;
const TITLE = 'The.Office.US.S01E02.1080p.WEB-DL-NBC';

function grab(overrides = {}) {
  return {
    id: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
    youtube_id: 'abcdefghijk',
    kind: 'tv',
    category: 'tv',
    release_title: TITLE,
    status: 'queued',
    job_id: 'job-1',
    staged_path: null,
    bytes: null,
    estimated_bytes: 200 * MB,
    fail_message: null,
    created_at: new Date('2025-06-01T10:00:00.000Z'),
    completed_at: null,
    ...overrides,
  };
}

const runningActivity = (overrides = {}) => ({
  jobId: 'job-1',
  terminal: false,
  activity: {
    progress: { percent: 60, downloadedBytes: 60 * MB, totalBytes: 100 * MB, speedBytesPerSecond: MB, etaSeconds: 40 },
  },
  ...overrides,
});

describe('sabnzbdResponses', () => {
  test('formatTimeleft is always h:mm:ss', () => {
    expect(responses.formatTimeleft(3725)).toBe('1:02:05');
    expect(responses.formatTimeleft(59)).toBe('0:00:59');
    expect(responses.formatTimeleft(-3)).toBe('0:00:00');
    expect(responses.formatTimeleft(undefined)).toBe('0:00:00');
  });

  test('version is in the x.y.z form the apps require', () => {
    expect(responses.version().version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('error carries the message with status false', () => {
    expect(responses.error('API Key Incorrect')).toEqual({ status: false, error: 'API Key Incorrect' });
  });

  test('added returns the grab id as the nzo_id', () => {
    expect(responses.added('abc')).toEqual({ status: true, nzo_ids: ['abc'] });
  });

  describe('getConfig', () => {
    const config = responses.getConfig({
      completeDir: '/data/.arr-staging',
      categories: [{ name: 'tv', subfolder: null }, { name: 'tv-4k', subfolder: 'Shows' }],
    }).config;

    test('reports the staging root as the completed folder', () => {
      expect(config.misc.complete_dir).toBe('/data/.arr-staging');
    });

    test('lists the catch-all category first, then each configured one with its own folder', () => {
      expect(config.categories.map((category) => category.name)).toEqual(['*', 'tv', 'tv-4k']);
      expect(config.categories[1].dir).toBe('tv');
      expect(config.categories[2].dir).toBe('tv-4k');
    });

    test('turns off everything that would move or rename the download', () => {
      expect(config.misc).toMatchObject({
        pre_check: false,
        enable_tv_sorting: false,
        enable_movie_sorting: false,
        enable_date_sorting: false,
        history_retention_option: 'all',
      });
      expect(config.sorters).toEqual([]);
    });
  });

  describe('queue', () => {
    test('reports the running job from its live progress', () => {
      const { queue } = responses.queue({ grabs: [grab()], activity: runningActivity(), paused: false });
      expect(queue.slots).toHaveLength(1);
      expect(queue.slots[0]).toMatchObject({
        status: 'Downloading',
        filename: TITLE,
        nzo_id: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
        cat: 'tv',
        mb: '100.00',
        mbleft: '40.00',
        timeleft: '0:00:40',
        percentage: '60',
      });
      expect(queue.status).toBe('Downloading');
      expect(queue.noofslots).toBe(1);
    });

    test('reports a waiting grab from its estimate', () => {
      const waiting = grab({ id: 'other', job_id: 'job-2', status: 'pending' });
      const { queue } = responses.queue({ grabs: [grab(), waiting], activity: runningActivity(), paused: false });
      expect(queue.slots[1]).toMatchObject({
        status: 'Queued', mb: '200.00', mbleft: '200.00', timeleft: '0:00:00', percentage: '0',
      });
      expect(queue.slots.map((slot) => slot.index)).toEqual([0, 1]);
    });

    test('a finished process is not reported as downloading', () => {
      const { queue } = responses.queue({
        grabs: [grab()], activity: runningActivity({ terminal: true }), paused: false,
      });
      expect(queue.slots[0].status).toBe('Queued');
    });

    test('falls back to the estimate while the running job has no size yet', () => {
      const activity = runningActivity();
      activity.activity.progress = { percent: 0, downloadedBytes: 0, totalBytes: 0, speedBytesPerSecond: 0, etaSeconds: 0 };
      const { queue } = responses.queue({ grabs: [grab()], activity, paused: false });
      expect(queue.slots[0]).toMatchObject({ status: 'Downloading', mb: '200.00', mbleft: '200.00' });
    });

    test('shows every grab as paused while downloads are paused', () => {
      const { queue } = responses.queue({ grabs: [grab()], activity: null, paused: true });
      expect(queue.slots[0].status).toBe('Paused');
      expect(queue.paused).toBe(true);
    });

    test('reports an unknown size as zero', () => {
      const { queue } = responses.queue({ grabs: [grab({ estimated_bytes: null })], activity: null, paused: false });
      expect(queue.slots[0]).toMatchObject({ mb: '0.00', mbleft: '0.00' });
    });

    test('is idle with no grabs', () => {
      const { queue } = responses.queue({ grabs: [], activity: null, paused: false });
      expect(queue).toMatchObject({ status: 'Idle', noofslots: 0, slots: [] });
    });
  });

  describe('history', () => {
    const storagePathFor = (row) => `/downloads/staging/tv/${row.release_title}/${row.release_title}.mkv`;

    test('a completed grab carries the release title as its name and the staged file as storage', () => {
      const completed = grab({
        status: 'completed', bytes: 300 * MB, staged_path: '/x', completed_at: new Date('2025-06-01T10:05:00.000Z'),
      });
      const { history } = responses.history({ grabs: [completed], storagePathFor });
      expect(history.slots[0]).toMatchObject({
        name: TITLE,
        nzb_name: `${TITLE}.nzb`,
        status: 'Completed',
        fail_message: '',
        storage: `/downloads/staging/tv/${TITLE}/${TITLE}.mkv`,
        category: 'tv',
        bytes: 300 * MB,
        downloaded: 300 * MB,
        completed: Math.floor(new Date('2025-06-01T10:05:00.000Z').getTime() / 1000),
        download_time: 300,
        nzo_id: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
      });
      expect(history.noofslots).toBe(1);
    });

    test('a failed grab carries its message and no storage', () => {
      const failed = grab({
        status: 'failed', fail_message: 'YouTube bot check (usually temporary)',
        completed_at: new Date('2025-06-01T10:05:00.000Z'),
      });
      const { history } = responses.history({ grabs: [failed], storagePathFor });
      expect(history.slots[0]).toMatchObject({
        status: 'Failed', fail_message: 'YouTube bot check (usually temporary)', storage: '', bytes: 0,
      });
    });
  });

  test('fullStatus reports the completed folder', () => {
    expect(responses.fullStatus({ completeDir: '/data/.arr-staging' }))
      .toEqual({ status: { completedir: '/data/.arr-staging' } });
  });
});
