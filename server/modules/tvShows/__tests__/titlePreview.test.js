const { summarizePlan } = require('../titlePreview');

const drafts = [
  { key: 'title:3', id: 3, name: 'Beyblade', folderName: 'Beyblade', libraryFolder: 'TV Shows', patterns: [{ key: 'title:3#0' }, { key: 'title:3#1' }] },
];
const storedShows = new Map([['title:3', { key: 'title:3', kind: 'title', active: true, name: 'Beyblade (old)' }]]);

function video(youtubeId, extra = {}) {
  return { youtubeId, title: `Title ${youtubeId}`, publishedAtMs: 0, available: true, downloaded: false, filePath: null, ...extra };
}

function assigned(episode, extra = {}) {
  return { showKey: 'title:3', status: 'assigned', season: 1, episode, source: 'title', patternKey: 'title:3#1', episodeTitle: `E${episode}`, keep: false, ...extra };
}

function plan(entries, extra = {}) {
  return {
    entries, duplicates: [], unsupported: [], retired: [], relocated: [], requiresReorganize: false, knownVideos: 4,
    drafts, storedShows, ...extra,
  };
}

describe('titlePreview.summarizePlan', () => {
  const videos = [video('a'), video('b', { downloaded: true }), video('c'), video('loose')];

  it('lists each show\'s episodes in order with their download state', () => {
    const result = summarizePlan(plan([
      { ...videos[1], before: null, after: assigned(2), moves: true },
      { ...videos[0], before: null, after: assigned(1), moves: false },
    ]), { videos, isQueued: () => false });
    expect(result.shows[0].episodes).toEqual([
      expect.objectContaining({ youtubeId: 'a', code: 'S01E01', downloadState: 'not_downloaded', patternIndex: 1 }),
      expect.objectContaining({ youtubeId: 'b', code: 'S01E02', downloadState: 'downloaded' }),
    ]);
  });

  it('counts the downloads whose files stay outside the downloads folder', () => {
    const result = summarizePlan(plan([
      { ...videos[1], before: null, after: assigned(2), moves: false, staysOutside: true },
      { ...videos[0], before: null, after: assigned(1), moves: false },
    ]), { videos, isQueued: () => false });
    expect(result.staysOutside).toBe(1);
  });

  it('marks a queued episode', () => {
    const result = summarizePlan(plan([{ ...videos[0], before: null, after: assigned(1), moves: false }]), { videos, isQueued: (id) => id === 'a' });
    expect(result.shows[0].episodes[0].downloadState).toBe('queued');
  });

  it('counts each show\'s episodes, downloads, pending and duplicates', () => {
    const result = summarizePlan(plan([
      { ...videos[0], before: null, after: assigned(1), moves: false },
      { ...videos[1], before: null, after: assigned(2), moves: false },
      { ...videos[2], before: null, after: { ...assigned(null), status: 'duplicate', season: null }, moves: false },
    ], { duplicates: [{ youtubeId: 'c', showKey: 'title:3', season: 1, episode: 1, duplicateOf: 'a' }] }), { videos });
    expect(result.shows[0].counts).toEqual({ episodes: 2, downloaded: 1, pending: 0, duplicates: 1, unsupported: 0 });
  });

  it('names the winner of each duplicate', () => {
    const result = summarizePlan(plan([], { duplicates: [{ youtubeId: 'c', showKey: 'title:3', season: 1, episode: 1, duplicateOf: 'a' }] }), { videos });
    expect(result.duplicates[0]).toMatchObject({ code: 'S01E01', duplicateOfTitle: 'Title a', showName: 'Beyblade' });
  });

  it('lists the videos no show takes', () => {
    const result = summarizePlan(plan([{ ...videos[0], before: null, after: assigned(1), moves: false }]), { videos });
    expect(result.unmatched).toEqual({ count: 3, videos: [
      { youtubeId: 'b', title: 'Title b', downloaded: true },
      { youtubeId: 'c', title: 'Title c', downloaded: false },
      { youtubeId: 'loose', title: 'Title loose', downloaded: false },
    ] });
  });

  it('leaves duplicates and unsupported matches out of the unmatched list', () => {
    const result = summarizePlan(plan([
      { ...videos[0], before: null, after: assigned(1), moves: false },
      { ...videos[1], before: null, after: { ...assigned(null), status: 'duplicate', season: null }, moves: false },
      { ...videos[2], before: null, after: { ...assigned(null), status: 'unsupported', season: null }, moves: false },
    ]), { videos });
    expect(result.unmatched).toEqual({ count: 1, videos: [{ youtubeId: 'loose', title: 'Title loose', downloaded: false }] });
  });

  it('counts a duplicate whose stored channel-show row is kept as matched, not unmatched', () => {
    const channelRow = { showKey: 'channel:UC1', status: 'assigned', season: 2021, episode: 6161600, source: 'date' };
    const result = summarizePlan(plan([
      { ...videos[0], before: assigned(1), after: assigned(1), moves: false },
      { ...videos[1], before: channelRow, after: channelRow, moves: false },
    ], { duplicates: [{ youtubeId: 'b', showKey: 'title:3', season: 1, episode: 1, duplicateOf: 'a' }] }), { videos });
    expect([result.unmatched.videos.map((v) => v.youtubeId), result.shows[0].counts.duplicates]).toEqual([['c', 'loose'], 1]);
  });

  it('caps the unmatched list but not its count', () => {
    const result = summarizePlan(plan([]), { videos, listLimit: 2 });
    expect([result.unmatched.count, result.unmatched.videos.length]).toEqual([4, 2]);
  });

  it('reports seasons with missing numbers', () => {
    const result = summarizePlan(plan([
      { ...videos[0], before: null, after: assigned(1), moves: false },
      { ...videos[2], before: null, after: assigned(4), moves: false },
    ]), { videos });
    expect(result.gaps).toEqual([expect.objectContaining({ showKey: 'title:3', season: 1, missing: [2, 3] })]);
  });

  it('lists stored episodes whose number would change', () => {
    const before = { showKey: 'title:3', status: 'assigned', season: 1, episode: 5, source: 'title' };
    const result = summarizePlan(plan([{ ...videos[0], before, after: assigned(6), moves: false }]), { videos });
    expect(result.changes).toEqual([{
      youtubeId: 'a', title: 'Title a', downloaded: false,
      from: { showKey: 'title:3', showName: 'Beyblade (old)', code: 'S01E05', status: 'assigned' },
      to: { showKey: 'title:3', showName: 'Beyblade', code: 'S01E06', status: 'assigned' },
    }]);
  });

  it('counts the downloaded videos that move', () => {
    const result = summarizePlan(plan([{ ...videos[1], before: null, after: assigned(2), moves: true }]), { videos });
    expect(result.filesToMove).toBe(1);
  });

  it('describes unsupported matches', () => {
    const result = summarizePlan(plan([], {
      unsupported: [{ youtubeId: 'c', showKey: 'title:3', reason: 'compilation', season: 1, episode: 19, episodeEnd: 20, part: null }],
    }), { videos });
    expect(result.unsupported[0]).toMatchObject({ title: 'Title c', showName: 'Beyblade', reason: 'compilation', episodeEnd: 20 });
  });
});
