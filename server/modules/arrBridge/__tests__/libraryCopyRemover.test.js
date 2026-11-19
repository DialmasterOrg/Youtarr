/* eslint-env jest */
const { Op } = require('sequelize');
const { createLibraryCopyRemover } = require('../libraryCopyRemover');

const NOW = new Date('2025-06-10T12:00:00.000Z');
const GRAB_ID = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';
const OTHER_GRAB_ID = '11111111-2222-4333-8444-555555555555';
const YOUTUBE_ID = 'abcdefghijk';
const SONARR = { url: 'http://sonarr:8989', apiKey: 'sonarr-key' };
const RADARR = { url: 'http://radarr:7878', apiKey: 'radarr-key' };
const minutesAgo = (minutes) => new Date(NOW.getTime() - minutes * 60 * 1000);

function matchesValue(actual, expected) {
  if (expected === null || typeof expected !== 'object' || expected instanceof Date) return actual === expected;
  return Reflect.ownKeys(expected).every((operator) => {
    const operand = expected[operator];
    if (operator === Op.ne) return actual !== operand;
    if (operator === Op.in) return operand.includes(actual);
    throw new Error(`Unsupported operator ${String(operator)}`);
  });
}

const matches = (where) => (row) => Reflect.ownKeys(where).every((key) => matchesValue(row[key] ?? null, where[key]));

// An in-memory stand-in for the model: tests assert on the rows, not the calls.
function grabTable(rows) {
  return {
    findAll: jest.fn(async ({ where }) => rows.filter(matches(where))),
    update: jest.fn(async (values, { where }) => {
      const hits = rows.filter(matches(where));
      hits.forEach((row) => Object.assign(row, values));
      return [hits.length];
    }),
  };
}

// A grab Sonarr or Radarr took out of its history, whose video Youtarr
// downloaded for it.
function grab(overrides = {}) {
  return {
    id: GRAB_ID,
    youtube_id: YOUTUBE_ID,
    kind: 'tv',
    category: 'tv',
    status: 'removed',
    library_copy: 'remove',
    completed_at: minutesAgo(10),
    removed_at: minutesAgo(1),
    ...overrides,
  };
}

// Sonarr and Radarr are both connected, and neither recorded an import.
function setup({
  rows = [grab()], video = { youtubeId: YOUTUBE_ID }, removeAfterImport = true, sonarr = SONARR, radarr = RADARR,
} = {}) {
  const deps = {
    models: {
      ArrBridgeGrab: grabTable(rows),
      Video: { findOne: jest.fn(async () => video) },
    },
    client: { fetchImported: jest.fn().mockResolvedValue(false) },
    getSettings: () => ({ removeAfterImport, sonarr, radarr }),
    removeVideo: jest.fn().mockResolvedValue(true),
    now: () => NOW,
    logger: { info: jest.fn(), warn: jest.fn() },
  };
  return { remover: createLibraryCopyRemover(deps), deps, rows };
}

const imported = (deps) => deps.client.fetchImported.mockResolvedValue(true);
const unreachable = (deps) => deps.client.fetchImported.mockRejectedValue(new Error('unreachable'));

describe('libraryCopyRemover', () => {
  describe('request', () => {
    const handedOff = () => grab({ library_copy: 'owned' });

    test('marks a grab whose video Youtarr downloaded for it', async () => {
      const { remover, rows } = setup({ rows: [handedOff()] });

      await remover.request(rows[0]);

      expect(rows[0].library_copy).toBe('remove');
    });

    test('leaves the grab alone while the setting is off', async () => {
      const { remover, rows } = setup({ rows: [handedOff()], removeAfterImport: false });

      await remover.request(rows[0]);

      expect(rows[0].library_copy).toBe('owned');
    });

    test('never marks a grab of a video that was already in the library', async () => {
      const { remover, rows } = setup({ rows: [grab({ library_copy: null })] });

      await remover.request(rows[0]);

      expect(rows[0].library_copy).toBeNull();
    });
  });

  describe('run', () => {
    test('removes the copy when the connected Sonarr recorded the import of the grab', async () => {
      const { remover, deps, rows } = setup();
      imported(deps);

      await remover.run();

      expect(deps.client.fetchImported).toHaveBeenCalledWith(SONARR, GRAB_ID);
      expect(deps.removeVideo).toHaveBeenCalledWith(YOUTUBE_ID, {
        reason: 'auto_removal', detail: 'after Sonarr imported it',
      });
      expect(rows[0].library_copy).toBe('removed');
    });

    test('asks Radarr about a movie, and names it', async () => {
      const { remover, deps } = setup({ rows: [grab({ kind: 'movie' })] });
      imported(deps);

      await remover.run();

      expect(deps.client.fetchImported).toHaveBeenCalledWith(RADARR, GRAB_ID);
      expect(deps.removeVideo).toHaveBeenCalledWith(YOUTUBE_ID, {
        reason: 'auto_removal', detail: 'after Radarr imported it',
      });
    });

    test('keeps the copy when the connected app recorded no import', async () => {
      const { remover, deps, rows } = setup();

      await remover.run();

      expect(deps.removeVideo).not.toHaveBeenCalled();
      expect(rows[0].library_copy).toBe('kept');
    });

    test('keeps the copy when the app that grabs this kind is not connected, without asking the other', async () => {
      const { remover, deps, rows } = setup({ sonarr: null });
      imported(deps);

      await remover.run();

      expect(deps.client.fetchImported).not.toHaveBeenCalled();
      expect(deps.removeVideo).not.toHaveBeenCalled();
      expect(rows[0].library_copy).toBe('kept');
    });

    test('waits when the app cannot be asked', async () => {
      const { remover, deps, rows } = setup();
      unreachable(deps);

      await remover.run();

      expect(deps.removeVideo).not.toHaveBeenCalled();
      expect(rows[0].library_copy).toBe('remove');
    });

    test('keeps the copy once the app could not be asked for a day', async () => {
      const { remover, deps, rows } = setup({ rows: [grab({ removed_at: minutesAgo(24 * 60) })] });
      unreachable(deps);

      await remover.run();

      expect(deps.removeVideo).not.toHaveBeenCalled();
      expect(rows[0].library_copy).toBe('kept');
    });

    test('asks an app that does not answer only once in a run', async () => {
      const { remover, deps } = setup({ rows: [grab(), grab({ id: OTHER_GRAB_ID, youtube_id: 'zyxwvutsrqp' })] });
      unreachable(deps);

      await remover.run();

      expect(deps.client.fetchImported).toHaveBeenCalledTimes(1);
    });

    test('a grab that must wait goes to the back of the line', async () => {
      const { remover, deps, rows } = setup({ rows: [grab({ updated_at: minutesAgo(30) })] });
      unreachable(deps);

      await remover.run();

      expect(rows[0]).toMatchObject({ library_copy: 'remove', updated_at: NOW });
    });

    test.each(['pending', 'queued'])('waits while another grab of the video is %s and needs the file', async (status) => {
      const { remover, deps, rows } = setup({
        rows: [grab(), grab({ id: OTHER_GRAB_ID, status, library_copy: null })],
      });
      imported(deps);

      await remover.run();

      expect(deps.removeVideo).not.toHaveBeenCalled();
      expect(rows[0].library_copy).toBe('remove');
    });

    test('removes the copy while another grab has the video staged: its staged file is its own', async () => {
      const { remover, deps, rows } = setup({
        rows: [grab(), grab({ id: OTHER_GRAB_ID, status: 'completed', library_copy: null })],
      });
      imported(deps);

      await remover.run();

      expect(deps.removeVideo).toHaveBeenCalledTimes(1);
      expect(rows[0].library_copy).toBe('removed');
    });

    test('has nothing to remove, and claims nothing, when the video already left the library', async () => {
      const { remover, deps, rows } = setup({ video: null });
      imported(deps);

      await remover.run();

      expect(deps.client.fetchImported).not.toHaveBeenCalled();
      expect(deps.removeVideo).not.toHaveBeenCalled();
      expect(rows[0].library_copy).toBeNull();
    });

    test('waits when the delete is refused, to try again', async () => {
      const { remover, deps, rows } = setup();
      imported(deps);
      deps.removeVideo.mockResolvedValue(false);

      await remover.run();

      expect(rows[0].library_copy).toBe('remove');
    });

    test('keeps the copy when the setting was switched off in the meantime', async () => {
      const { remover, deps, rows } = setup({ removeAfterImport: false });
      imported(deps);

      await remover.run();

      expect(deps.client.fetchImported).not.toHaveBeenCalled();
      expect(deps.removeVideo).not.toHaveBeenCalled();
      expect(rows[0].library_copy).toBe('kept');
    });

    test('ignores grabs that were never marked', async () => {
      const { remover, deps, rows } = setup({ rows: [grab({ library_copy: 'owned' })] });
      imported(deps);

      await remover.run();

      expect(deps.removeVideo).not.toHaveBeenCalled();
      expect(rows[0].library_copy).toBe('owned');
    });

    test('one grab that cannot be settled does not stop the next', async () => {
      const { remover, deps, rows } = setup({
        rows: [grab(), grab({ id: OTHER_GRAB_ID, youtube_id: 'zyxwvutsrqp' })],
      });
      imported(deps);
      deps.removeVideo.mockRejectedValueOnce(new Error('disk exploded'));

      await remover.run();

      expect(rows[0].library_copy).toBe('remove');
      expect(rows[1].library_copy).toBe('removed');
      expect(deps.logger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
