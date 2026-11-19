const { planRevision } = require('../revision');

const plan = (overrides = {}) => ({
  change: { type: 'channel', channelId: 'UC1', subFolder: 'TV' },
  shows: [{ ownerChannelId: 'UC1', action: 'create', libraryFolder: 'TV', folderName: 'Chan' }],
  items: [{
    youtubeId: 'abcdefghijk',
    files: [{ from: '/a.mp4', to: '/b.mp4', size: 10, mtimeMs: 1000 }],
    classification: { season: 2024, episode: 3151200, fileStem: 'S2024E03151200 - T [abcdefghijk]' },
  }],
  ...overrides,
});

describe('reorganize revision', () => {
  it('is stable for the same plan', () => {
    expect(planRevision(plan())).toBe(planRevision(plan()));
  });

  it('changes when a source file changes', () => {
    const changed = plan();
    changed.items[0].files[0].size = 11;

    expect(planRevision(changed)).not.toBe(planRevision(plan()));
  });

  it('changes when a planned show folder changes', () => {
    const changed = plan({ shows: [{ ownerChannelId: 'UC1', action: 'create', libraryFolder: 'TV', folderName: 'Chan (UC1)' }] });

    expect(planRevision(changed)).not.toBe(planRevision(plan()));
  });

  it('does not depend on the order shows were planned in', () => {
    const shows = [
      { ownerChannelId: 'UC2', action: 'create', libraryFolder: 'TV', folderName: 'B' },
      { ownerChannelId: 'UC1', action: 'create', libraryFolder: 'TV', folderName: 'A' },
    ];

    expect(planRevision(plan({ shows }))).toBe(planRevision(plan({ shows: [...shows].reverse() })));
  });
});
