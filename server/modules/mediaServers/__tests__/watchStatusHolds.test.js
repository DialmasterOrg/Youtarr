const VIDEO = { id: 7, filePath: '/data/__TV/Chan/Season 2024/S2024E03151200 - Title [id1].mp4' };
const NEW_PATH = '/srv/media/__TV/Chan/Season 2024/S2024E03151200 - Title [id1].mp4';
const OLD_PATH = '/srv/media/Chan/Chan - Title - id1/Chan - Title [id1].mp4';
const FROM_PATH = '/data/Chan/Chan - Title - id1/Chan - Title [id1].mp4';
// A move between two TV folders keeps the show, season and file names.
const TV_VIDEO = { id: 7, filePath: '/data/__NewTV/Chan/Season 2024/S2024E03151200 - Title [id1].mp4' };
const TV_FROM_PATH = '/data/__OldTV/Chan/Season 2024/S2024E03151200 - Title [id1].mp4';

const entry = (overrides = {}) => ({
  path: NEW_PATH, serverUserId: '1', played: false, playCount: 0, positionMs: 0, percentWatched: 0, lastWatchedAt: null,
  ...overrides,
});

const holdRow = (snapshot, overrides = {}) => ({
  id: 3, video_id: 7, server_type: 'plex', server_user_id: '1', state: 'pending', snapshot: JSON.stringify(snapshot),
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('watchStatusHolds', () => {
  let holds;
  let WatchStatusHold;
  let VideoWatchStatus;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
    jest.doMock('../../../models/watchstatushold', () => ({
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue([0]),
    }));
    jest.doMock('../../../models/videowatchstatus', () => ({ findAll: jest.fn().mockResolvedValue([]) }));
    jest.doMock('../../../models/video', () => ({ findAll: jest.fn().mockResolvedValue([]) }));
    jest.doMock('../../../models/mediaserveruser', () => ({ findAll: jest.fn().mockResolvedValue([]) }));
    jest.doMock('../adapters/plexAdapter', () => ({ PLEX_OWNER_ACCOUNT_ID: '1' }));
    WatchStatusHold = require('../../../models/watchstatushold');
    VideoWatchStatus = require('../../../models/videowatchstatus');
    holds = require('../watchStatusHolds');
  });

  describe('isHoldable', () => {
    it('protects watched and in-progress rows', () => {
      expect(holds.isHoldable({ server_type: 'jellyfin', server_user_id: 'u', played: true, position_ms: null })).toBe(true);
      expect(holds.isHoldable({ server_type: 'emby', server_user_id: 'u', played: false, position_ms: 5000 })).toBe(true);
    });

    it('skips rows with nothing to protect', () => {
      expect(holds.isHoldable({ server_type: 'jellyfin', server_user_id: 'u', played: false, position_ms: 0 })).toBe(false);
    });

    it('skips Plex accounts other than the owner', () => {
      expect(holds.isHoldable({ server_type: 'plex', server_user_id: '5', played: true, position_ms: null })).toBe(false);
      expect(holds.isHoldable({ server_type: 'plex', server_user_id: '1', played: true, position_ms: null })).toBe(true);
    });
  });

  describe('createHolds', () => {
    it('snapshots each protected row with a 14-day deadline', async () => {
      const now = new Date('2026-10-03T00:00:00Z');
      VideoWatchStatus.findAll.mockResolvedValue([
        { video_id: 7, server_type: 'jellyfin', server_user_id: 'u1', played: true, play_count: 2, position_ms: null, percent_watched: 100, last_watched_at: '2026-09-01T00:00:00Z' },
        { video_id: 7, server_type: 'plex', server_user_id: '5', played: true, play_count: 1, position_ms: null, percent_watched: 100, last_watched_at: null },
      ]);

      require('../../../models/video').findAll.mockResolvedValue([{ id: 7, filePath: FROM_PATH }]);

      const count = await holds.createHolds({ operationId: 9, videoIds: [7], now });

      expect(count).toBe(1);
      expect(WatchStatusHold.create).toHaveBeenCalledWith(expect.objectContaining({
        video_id: 7, server_type: 'jellyfin', server_user_id: 'u1', operation_id: 9, state: 'pending',
        expires_at: new Date('2026-10-17T00:00:00Z'),
      }));
      expect(JSON.parse(WatchStatusHold.create.mock.calls[0][0].snapshot))
        .toMatchObject({ played: true, playCount: 2, fromPath: FROM_PATH });
    });

    it('keeps the stronger state when an active hold already protects the row', async () => {
      VideoWatchStatus.findAll.mockResolvedValue([
        { video_id: 7, server_type: 'jellyfin', server_user_id: 'u1', played: false, play_count: 0, position_ms: 1000, percent_watched: 5, last_watched_at: null },
      ]);
      const existing = holdRow({ played: true, playCount: 1, positionMs: null, percentWatched: 100, lastWatchedAt: null },
        { server_type: 'jellyfin', server_user_id: 'u1' });
      WatchStatusHold.findAll.mockResolvedValue([existing]);

      await holds.createHolds({ operationId: 10, videoIds: [7] });

      expect(WatchStatusHold.create).not.toHaveBeenCalled();
      expect(JSON.parse(existing.update.mock.calls[0][0].snapshot)).toMatchObject({ played: true, positionMs: 1000 });
    });

    it('makes a re-held row due for a fresh push: the earlier push went to the earlier location', async () => {
      VideoWatchStatus.findAll.mockResolvedValue([
        { video_id: 7, server_type: 'jellyfin', server_user_id: 'u1', played: true, play_count: 1, position_ms: null, percent_watched: 100, last_watched_at: null },
      ]);
      const existing = holdRow({ played: true, playCount: 1, positionMs: null, percentWatched: 100, lastWatchedAt: null },
        { server_type: 'jellyfin', server_user_id: 'u1', state: 'restored', attempts: 2, last_attempt_at: new Date('2026-10-01T00:00:00Z'), last_error: null });
      WatchStatusHold.findAll.mockResolvedValue([existing]);

      await holds.createHolds({ operationId: 11, videoIds: [7] });

      expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({
        state: 'pending', operation_id: 11, attempts: 0, last_attempt_at: null, last_pushed_at: null, last_error: null,
      }));
    });

    it('does nothing for videos without protected rows', async () => {
      await expect(holds.createHolds({ operationId: 1, videoIds: [7] })).resolves.toBe(0);
      expect(WatchStatusHold.create).not.toHaveBeenCalled();
    });
  });

  describe('applyHolds', () => {
    const watched = { played: true, playCount: 1, positionMs: null, percentWatched: 100, lastWatchedAt: '2026-09-01T00:00:00.000Z' };

    it('passes matches through when no hold applies', async () => {
      const matches = [{ video: VIDEO, entry: entry() }];

      await expect(holds.applyHolds('plex', matches)).resolves.toEqual(matches);
    });

    it('drops a downgrade of a held row', async () => {
      WatchStatusHold.findAll.mockResolvedValue([holdRow(watched)]);

      await expect(holds.applyHolds('plex', [{ video: VIDEO, entry: entry() }])).resolves.toEqual([]);
    });

    it('drops the reset of a held row whose server still lists the old path', async () => {
      WatchStatusHold.findAll.mockResolvedValue([holdRow(watched, { server_type: 'jellyfin', server_user_id: 'u1' })]);
      const cleared = { serverUserId: 'u1', played: false, playCount: 0, positionMs: 0, percentWatched: null, lastWatchedAt: null };

      await expect(holds.applyHolds('jellyfin', [{ video: VIDEO, entry: cleared }])).resolves.toEqual([]);
    });

    it('ends the hold when the item at the new path shows the state, keeping the row\'s history', async () => {
      WatchStatusHold.findAll.mockResolvedValue([holdRow(watched)]);
      const match = { video: VIDEO, entry: entry({ played: true, playCount: 1 }) };

      const kept = await holds.applyHolds('plex', [match]);

      expect(kept).toHaveLength(1);
      expect(kept[0].entry).toMatchObject({ played: true, playCount: 1, lastWatchedAt: '2026-09-01T00:00:00.000Z' });
      expect(WatchStatusHold.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'restored' }), { where: { id: [3] } });
    });

    it('writes but keeps the hold when only the old path shows the state', async () => {
      WatchStatusHold.findAll.mockResolvedValue([holdRow(watched)]);
      const match = { video: VIDEO, entry: entry({ path: OLD_PATH, played: true, playCount: 1 }) };

      await expect(holds.applyHolds('plex', [match])).resolves.toEqual([match]);
      expect(WatchStatusHold.update).not.toHaveBeenCalled();
    });

    it('keeps the hold when only a stale item at the old TV path shows the state', async () => {
      WatchStatusHold.findAll.mockResolvedValue([holdRow({ ...watched, fromPath: TV_FROM_PATH })]);
      const stale = entry({ path: '/srv/media/__OldTV/Chan/Season 2024/S2024E03151200 - Title [id1].mp4', played: true, playCount: 1 });

      await expect(holds.applyHolds('plex', [{ video: TV_VIDEO, entry: stale }])).resolves.toHaveLength(1);
      expect(WatchStatusHold.update).not.toHaveBeenCalled();
    });

    it('ends the hold when the item at the new TV path shows the state', async () => {
      WatchStatusHold.findAll.mockResolvedValue([holdRow({ ...watched, fromPath: TV_FROM_PATH })]);
      const current = entry({ path: '/srv/media/__NewTV/Chan/Season 2024/S2024E03151200 - Title [id1].mp4', played: true, playCount: 1 });

      await holds.applyHolds('plex', [{ video: TV_VIDEO, entry: current }]);

      expect(WatchStatusHold.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'restored' }), { where: { id: [3] } });
    });

    it('accepts a newer state at the new path and ends the hold', async () => {
      WatchStatusHold.findAll.mockResolvedValue([holdRow({ played: false, playCount: 0, positionMs: 60000, percentWatched: 10, lastWatchedAt: '2026-09-01T00:00:00.000Z' })]);
      const match = { video: VIDEO, entry: entry({ positionMs: 1000, lastWatchedAt: new Date('2026-10-02T00:00:00Z') }) };

      await expect(holds.applyHolds('plex', [match])).resolves.toEqual([match]);
      expect(WatchStatusHold.update).toHaveBeenCalled();
    });

    describe('after a push', () => {
      const pushedAt = new Date('2026-10-03T12:00:00Z');
      const history = { played: true, playCount: 3, positionMs: null, percentWatched: 100, lastWatchedAt: '2026-09-01T00:00:00.000Z' };
      const pushed = (overrides = {}) => holdRow(history, {
        attempts: 1, last_attempt_at: pushedAt, last_pushed_at: pushedAt, last_error: null, ...overrides,
      });

      it('keeps the historical count and last-watched time when the server echoes the push', async () => {
        WatchStatusHold.findAll.mockResolvedValue([pushed()]);
        const echo = entry({ played: true, playCount: 1, lastWatchedAt: new Date('2026-10-03T12:00:04Z') });

        const kept = await holds.applyHolds('plex', [{ video: VIDEO, entry: echo }]);

        expect(kept).toHaveLength(1);
        expect(kept[0].entry).toMatchObject({ played: true, playCount: 3, lastWatchedAt: '2026-09-01T00:00:00.000Z' });
        expect(WatchStatusHold.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'restored' }), { where: { id: [3] } });
      });

      it('keeps preserving the history once the hold has ended', async () => {
        WatchStatusHold.findAll.mockResolvedValue([pushed({ state: 'restored' })]);
        const echo = entry({ played: true, playCount: 1, lastWatchedAt: new Date('2026-10-03T12:00:04Z') });

        const kept = await holds.applyHolds('plex', [{ video: VIDEO, entry: echo }]);

        expect(kept[0].entry).toMatchObject({ playCount: 3, lastWatchedAt: '2026-09-01T00:00:00.000Z' });
        expect(WatchStatusHold.update).not.toHaveBeenCalled();
      });

      it('treats a watch near a push that was skipped (nothing written) as the real watch it is', async () => {
        WatchStatusHold.findAll.mockResolvedValue([pushed({ last_pushed_at: null })]);
        const watched = entry({ played: true, playCount: 1, lastWatchedAt: new Date('2026-10-03T12:00:04Z') });

        const kept = await holds.applyHolds('plex', [{ video: VIDEO, entry: watched }]);

        expect(kept[0].entry).toBe(watched);
      });

      it('accepts a real later watch as it is', async () => {
        WatchStatusHold.findAll.mockResolvedValue([pushed({ state: 'restored' })]);
        const later = entry({ played: true, playCount: 2, lastWatchedAt: new Date('2026-10-03T15:00:00Z') });

        const kept = await holds.applyHolds('plex', [{ video: VIDEO, entry: later }]);

        expect(kept[0].entry).toBe(later);
      });

      it('asks for another push when the server shows less than the held state', async () => {
        WatchStatusHold.findAll.mockResolvedValue([pushed()]);

        await expect(holds.applyHolds('plex', [{ video: VIDEO, entry: entry() }])).resolves.toEqual([]);
        expect(WatchStatusHold.update).toHaveBeenCalledWith(
          { last_error: expect.stringMatching(/less than/) }, { where: { id: [3] } }
        );
      });

      it('does not ask for a push while the stale item at the old path is all the server lists', async () => {
        WatchStatusHold.findAll.mockResolvedValue([pushed({ snapshot: JSON.stringify({ ...history, fromPath: TV_FROM_PATH }) })]);
        const stale = entry({ path: '/srv/media/__OldTV/Chan/Season 2024/S2024E03151200 - Title [id1].mp4', played: false });

        await holds.applyHolds('plex', [{ video: TV_VIDEO, entry: stale }]);

        expect(WatchStatusHold.update).not.toHaveBeenCalled();
      });
    });

    it('drops a lower resume position for an in-progress hold', async () => {
      WatchStatusHold.findAll.mockResolvedValue([holdRow({ played: false, playCount: 0, positionMs: 60000, percentWatched: 10, lastWatchedAt: null })]);

      await expect(holds.applyHolds('plex', [{ video: VIDEO, entry: entry({ positionMs: 0 }) }])).resolves.toEqual([]);
    });
  });

  it('releases the holds of videos an operation did not move', async () => {
    WatchStatusHold.update.mockResolvedValue([2]);

    await expect(holds.releaseUnmovedHolds({ operationId: 9, videoIds: [7, 8] })).resolves.toBe(2);
    expect(WatchStatusHold.update).toHaveBeenCalledWith(
      { state: 'dismissed' },
      { where: { operation_id: 9, video_id: [7, 8], state: ['pending', 'failed'] } }
    );
  });

  it('marks pending holds past their deadline as failed', async () => {
    WatchStatusHold.update.mockResolvedValue([2]);

    await expect(holds.expireHolds(new Date('2026-10-20T00:00:00Z'))).resolves.toBe(2);
    expect(WatchStatusHold.update.mock.calls[0][0]).toMatchObject({ state: 'failed' });
  });

  it('reopens a failed hold for another 14 days', async () => {
    const hold = holdRow({ played: true }, { state: 'failed' });
    WatchStatusHold.findByPk.mockResolvedValue(hold);

    await holds.reopenHold(3, new Date('2026-10-03T00:00:00Z'));

    expect(hold.update).toHaveBeenCalledWith(expect.objectContaining({
      state: 'pending', last_attempt_at: null, expires_at: new Date('2026-10-17T00:00:00Z'),
    }));
  });

  it('dismisses a hold', async () => {
    const hold = holdRow({ played: true }, { state: 'failed' });
    WatchStatusHold.findByPk.mockResolvedValue(hold);

    await expect(holds.dismissHold(3)).resolves.toBe(true);
    expect(hold.update).toHaveBeenCalledWith({ state: 'dismissed' });
  });

  it('reports a missing hold when dismissing', async () => {
    WatchStatusHold.findByPk.mockResolvedValue(null);

    await expect(holds.dismissHold(99)).resolves.toBe(false);
  });

  it('describes holds with their video and server user names', async () => {
    WatchStatusHold.findAll.mockResolvedValue([holdRow({ played: false, positionMs: 61000 }, {
      state: 'failed', server_type: 'jellyfin', server_user_id: 'u1', attempts: 3, last_error: 'HTTP 404',
    })]);
    require('../../../models/video').findAll.mockResolvedValue([{ id: 7, youtubeId: 'id1', youTubeVideoName: 'Title', youTubeChannelName: 'Chan' }]);
    require('../../../models/mediaserveruser').findAll.mockResolvedValue([{ server_type: 'jellyfin', server_user_id: 'u1', server_user_name: 'Ann' }]);

    await expect(holds.describeHolds({ states: ['failed'] })).resolves.toEqual([expect.objectContaining({
      id: 3, state: 'failed', serverType: 'jellyfin', serverUserName: 'Ann', title: 'Title', played: false,
      positionMs: 61000, attempts: 3, lastError: 'HTTP 404',
    })]);
  });
});
