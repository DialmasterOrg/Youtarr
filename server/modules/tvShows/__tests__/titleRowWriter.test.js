jest.mock('../../../models', () => ({
  VideoClassification: { update: jest.fn(), findByPk: jest.fn(), create: jest.fn(), destroy: jest.fn() },
}));
jest.mock('../titleShowStore', () => ({ saveDefinitions: jest.fn(), raiseHighWater: jest.fn() }));
jest.mock('../episodeConflicts', () => ({
  recordDuplicate: jest.fn(), release: jest.fn(), clearErrorsForChannel: jest.fn(), duplicateIdsForChannel: jest.fn(),
}));

const CHANNEL_ID = 'UCDrqiuwNRbEahL1UEB0hkKQ';
const channel = { channel_id: CHANNEL_ID };

function entry(youtubeId, before, after, extra = {}) {
  return { youtubeId, title: `Video ${youtubeId}`, downloaded: false, before, after, moves: false, ...extra };
}

function titleRow(episode, extra = {}) {
  return {
    showKey: 'new:0', status: 'assigned', season: 1, episode, source: 'title', patternKey: 'new:0#0',
    episodeTitle: `Ep ${episode}`, titleOptOut: false, keep: false, ...extra,
  };
}

function plan(entries, extra = {}) {
  return { entries, duplicates: [], highWater: new Map(), ...extra };
}

describe('titleRowWriter.applyPlan', () => {
  let writer;
  let models;
  let store;
  let conflicts;
  let rows;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    store = require('../titleShowStore');
    conflicts = require('../episodeConflicts');
    writer = require('../titleRowWriter');
    rows = new Map();
    store.saveDefinitions.mockResolvedValue({
      showIds: new Map([['new:0', 9], ['title:3', 3]]),
      patternIds: new Map([['new:0#0', 90], ['title:3#0', 30]]),
    });
    models.VideoClassification.findByPk.mockImplementation(async (id) => rows.get(id) || null);
    conflicts.duplicateIdsForChannel.mockResolvedValue(new Set());
    models.VideoClassification.update.mockResolvedValue([1]);
    models.VideoClassification.destroy.mockResolvedValue(1);
  });

  // The guarded write of one row (not the pass that frees numbers).
  const rowWrite = (youtubeId) => models.VideoClassification.update.mock.calls
    .find(([, options]) => options.where.youtube_id === youtubeId && options.where.status !== undefined);

  const apply = (planned, highWaterBefore = new Map()) => writer.applyPlan({ channel, drafts: [], plan: planned, highWaterBefore, transaction: 't' });

  it('saves the definitions in the transaction', async () => {
    await apply(plan([]));
    expect(store.saveDefinitions).toHaveBeenCalledWith({ channelId: CHANNEL_ID, drafts: [], transaction: 't' });
  });

  it('creates a row for a newly classified video with its show, pattern and stem', async () => {
    await apply(plan([entry('abcdefghijk', null, titleRow(20))]));
    expect(models.VideoClassification.create).toHaveBeenCalledWith({
      youtube_id: 'abcdefghijk', channel_id: CHANNEL_ID, show_id: 9, status: 'assigned', season: 1, episode: 20,
      source: 'title', timestamp_source: null, pattern_id: 90, episode_title: 'Ep 20',
      file_stem: 'S01E20 - Ep 20 [abcdefghijk]', title_opt_out: false,
    }, { transaction: 't' });
  });

  it('falls back to the video title for the episode title', async () => {
    await apply(plan([entry('abcdefghijk', null, titleRow(20, { episodeTitle: null }))]));
    expect(models.VideoClassification.create.mock.calls[0][0]).toMatchObject({ episode_title: 'Video abcdefghijk', file_stem: 'S01E20 - Video abcdefghijk [abcdefghijk]' });
  });

  it('frees the numbers of changing rows before writing any', async () => {
    const before = { ...titleRow(2, { showKey: 'title:3' }), showId: 3, fileStem: 'S01E02 - x [aaaaaaaaaaa]' };
    await apply(plan([entry('aaaaaaaaaaa', before, titleRow(3, { showKey: 'title:3', patternKey: 'title:3#0' }))]));
    expect(models.VideoClassification.update.mock.calls[0]).toEqual([
      { season: null, episode: null },
      { where: { youtube_id: ['aaaaaaaaaaa'] }, transaction: 't' },
    ]);
    expect(rowWrite('aaaaaaaaaaa')[0]).toMatchObject({ season: 1, episode: 3 });
  });

  it('writes a changed row only while it is still as planned', async () => {
    const before = { ...titleRow(null, { status: 'pending_number', season: null, showKey: 'title:3' }), showId: 3 };
    await apply(plan([entry('aaaaaaaaaaa', before, titleRow(4, { showKey: 'title:3', patternKey: 'title:3#0' }))]));
    expect(rowWrite('aaaaaaaaaaa')[1]).toEqual({
      where: { youtube_id: 'aaaaaaaaaaa', status: 'pending_number', show_id: 3, season: null, episode: null }, transaction: 't',
    });
  });

  it('refuses to overwrite a row another writer changed since the plan', async () => {
    const before = { ...titleRow(null, { status: 'pending_number', season: null, showKey: 'title:3' }), showId: 3 };
    models.VideoClassification.update.mockResolvedValue([0]);
    await expect(apply(plan([entry('aaaaaaaaaaa', before, titleRow(4, { showKey: 'title:3', patternKey: 'title:3#0' }))])))
      .rejects.toMatchObject({ code: 'ROW_CHANGED' });
  });

  it('refuses to delete a row another writer changed since the plan', async () => {
    const before = { ...titleRow(null, { status: 'pending_number', season: null, showKey: 'title:3' }), showId: 3 };
    models.VideoClassification.destroy.mockResolvedValue(0);
    await expect(apply(plan([entry('aaaaaaaaaaa', before, null)]))).rejects.toMatchObject({ code: 'ROW_CHANGED' });
  });

  it('keeps the stem of a row whose show and number stay', async () => {
    const before = { ...titleRow(2, { showKey: 'title:3' }), showId: 3, fileStem: 'S01E02 - Old title [aaaaaaaaaaa]' };
    await apply(plan([entry('aaaaaaaaaaa', before, titleRow(2, { showKey: 'title:3', patternKey: 'title:3#0', episodeTitle: 'New title' }))]));
    expect(rowWrite('aaaaaaaaaaa')[0]).toMatchObject({ file_stem: 'S01E02 - Old title [aaaaaaaaaaa]', pattern_id: 30 });
  });

  it('points a kept row at its pattern\'s new id', async () => {
    const before = { ...titleRow(2, { showKey: 'title:3', patternKey: 'title:3#0' }), showId: 3, fileStem: 's' };
    await apply(plan([entry('aaaaaaaaaaa', before, { ...titleRow(2, { showKey: 'title:3', patternKey: 'title:3#0' }), keep: true })]));
    expect(models.VideoClassification.update).toHaveBeenCalledWith({ pattern_id: 30 }, { where: { youtube_id: ['aaaaaaaaaaa'] }, transaction: 't' });
  });

  // A pattern without {title}: the stored episode title is the video title.
  const untitled = (youtubeId, patternId) => ({
    ...titleRow(20, { showKey: 'title:3', patternKey: 'title:3#0', episodeTitle: 'Video ' + youtubeId }),
    showId: 3, patternId, timestampSource: null, fileStem: `S01E20 - Video ${youtubeId} [${youtubeId}]`,
  });
  const untitledAfter = () => titleRow(20, { showKey: 'title:3', patternKey: 'title:3#0', episodeTitle: null });

  it('skips a row whose stored values already are the planned ones', async () => {
    await apply(plan([entry('aaaaaaaaaaa', untitled('aaaaaaaaaaa', 30), untitledAfter())]));
    expect(models.VideoClassification.update).not.toHaveBeenCalled();
  });

  it('moves rows whose only change is their pattern in one statement per pattern', async () => {
    await apply(plan([
      entry('aaaaaaaaaaa', untitled('aaaaaaaaaaa', 99), untitledAfter()),
      entry('bbbbbbbbbbb', untitled('bbbbbbbbbbb', 99), untitledAfter()),
    ]));
    expect(models.VideoClassification.update.mock.calls).toEqual([
      [{ pattern_id: 30 }, { where: { youtube_id: ['aaaaaaaaaaa', 'bbbbbbbbbbb'] }, transaction: 't' }],
    ]);
  });

  it('keeps the time source of a row whose number stays', async () => {
    const channelRow = {
      showKey: 'channel:UC1', showKind: 'channel', showId: 5, status: 'assigned', season: 2024, episode: 3151200, source: 'date',
      titleOptOut: true, patternKey: null, patternId: null, episodeTitle: 'x', fileStem: 'S2024E03151200 - x [aaaaaaaaaaa]', timestampSource: 'timestamp',
    };
    await apply(plan([entry('aaaaaaaaaaa', channelRow, { ...channelRow, titleOptOut: false, keep: true })]));
    expect(rowWrite('aaaaaaaaaaa')[0]).toMatchObject({ timestamp_source: 'timestamp', title_opt_out: false });
  });

  it('leaves a kept row whose pattern kept its id alone', async () => {
    const before = { ...titleRow(2, { showKey: 'title:3', patternKey: 'title:3#0' }), showId: 3, patternId: 30, fileStem: 's' };
    await apply(plan([entry('aaaaaaaaaaa', before, { ...titleRow(2, { showKey: 'title:3', patternKey: 'title:3#0' }), keep: true })]));
    expect(models.VideoClassification.findByPk).not.toHaveBeenCalled();
  });

  it('uses the stored definitions without saving them again', async () => {
    const definitions = { showIds: new Map([['title:3', 3]]), patternIds: new Map([['title:3#0', 30]]) };
    await writer.applyPlan({ channel, drafts: [], plan: plan([]), highWaterBefore: new Map(), transaction: 't', definitions });
    expect(store.saveDefinitions).not.toHaveBeenCalled();
  });

  it('leaves a kept channel-show row alone', async () => {
    const before = { showKey: 'channel:UC1', showKind: 'channel', showId: 5, status: 'assigned', season: 2024, episode: 1, source: 'date', fileStem: 's' };
    await apply(plan([entry('aaaaaaaaaaa', before, { ...before, keep: true })]));
    expect(models.VideoClassification.findByPk).not.toHaveBeenCalled();
  });

  it('deletes a released row', async () => {
    const before = { ...titleRow(2, { showKey: 'title:3' }), showId: 3 };
    await apply(plan([entry('aaaaaaaaaaa', before, null)]));
    expect(models.VideoClassification.destroy).toHaveBeenCalledWith({
      where: { youtube_id: 'aaaaaaaaaaa', status: 'assigned', show_id: 3 }, transaction: 't',
    });
  });

  it('writes an opted-out row without a number', async () => {
    await apply(plan([entry('aaaaaaaaaaa', null, titleRow(null, { status: 'opted_out', season: null, source: null, titleOptOut: true }))]));
    expect(models.VideoClassification.create.mock.calls[0][0]).toMatchObject({ status: 'opted_out', season: null, episode: null, file_stem: null, title_opt_out: true });
  });

  it('records duplicates against the saved show', async () => {
    await apply(plan(
      [entry('dup', null, titleRow(null, { status: 'duplicate', season: null }), { downloaded: true })],
      { duplicates: [{ youtubeId: 'dup', showKey: 'new:0', season: 1, episode: 20, duplicateOf: 'win' }] }
    ));
    expect(conflicts.recordDuplicate).toHaveBeenCalledWith({
      youtubeId: 'dup', channelId: CHANNEL_ID, showId: 9, season: 1, episode: 20, duplicateOf: 'win', downloaded: true, transaction: 't',
    });
  });

  it('releases the conflict of a video that is no longer a duplicate', async () => {
    const before = { ...titleRow(null, { status: 'duplicate', season: null, showKey: 'title:3' }), showId: 3 };
    rows.set('dupdupdup01', { update: jest.fn() });
    conflicts.duplicateIdsForChannel.mockResolvedValue(new Set(['dupdupdup01']));
    await apply(plan([entry('dupdupdup01', before, titleRow(20, { showKey: 'title:3', patternKey: 'title:3#0' }))]));
    expect(conflicts.release).toHaveBeenCalledWith('dupdupdup01', { transaction: 't' });
  });

  it('releases the conflict of a channel-show episode that no longer loses a title claim', async () => {
    const channelRow = { showKey: 'channel:UC1', showKind: 'channel', status: 'assigned', season: 2024, episode: 3151200, source: 'date', titleOptOut: false, keep: true };
    conflicts.duplicateIdsForChannel.mockResolvedValue(new Set(['episode0001']));
    await apply(plan([entry('episode0001', channelRow, channelRow)]));
    expect(conflicts.release).toHaveBeenCalledWith('episode0001', { transaction: 't' });
  });

  it('keeps the conflict of a channel-show episode that still loses a title claim', async () => {
    const channelRow = { showKey: 'channel:UC1', showKind: 'channel', status: 'assigned', season: 2024, episode: 3151200, source: 'date', titleOptOut: false, keep: true };
    conflicts.duplicateIdsForChannel.mockResolvedValue(new Set(['episode0001']));
    await apply(plan(
      [entry('episode0001', channelRow, channelRow)],
      { duplicates: [{ youtubeId: 'episode0001', showKey: 'new:0', season: 1, episode: 20, duplicateOf: 'win' }] }
    ));
    expect(conflicts.release).not.toHaveBeenCalled();
  });

  it('keeps the conflict of a downloaded duplicate whose verdict the plan kept', async () => {
    const before = { ...titleRow(null, { status: 'duplicate', season: null, showKey: 'title:3' }), showId: 3 };
    conflicts.duplicateIdsForChannel.mockResolvedValue(new Set(['keptdup0001']));
    await apply(plan([entry('keptdup0001', before, { ...before, keep: true }, { downloaded: true })]));
    expect(conflicts.release).not.toHaveBeenCalled();
  });

  it('leaves the conflicts of videos a listing refresh did not classify', async () => {
    const before = { ...titleRow(null, { status: 'duplicate', season: null, showKey: 'title:3' }), showId: 3 };
    conflicts.duplicateIdsForChannel.mockResolvedValue(new Set(['frozen00001']));
    await apply(plan([entry('frozen00001', before, { ...before, keep: true }, { classified: false })]));
    expect(conflicts.release).not.toHaveBeenCalled();
  });

  it('clears the channel\'s classification errors once its titles classified', async () => {
    await apply(plan([]));
    expect(conflicts.clearErrorsForChannel).toHaveBeenCalledWith(CHANNEL_ID, { transaction: 't' });
  });

  it('raises the high-water marks of seasons that allocated order numbers', async () => {
    await apply(plan([], { highWater: new Map([['new:0|0', 4], ['title:3|1', 2]]) }), new Map([['title:3|1', 2]]));
    expect(store.raiseHighWater.mock.calls).toEqual([[9, 0, 4, { transaction: 't' }]]);
  });
});
