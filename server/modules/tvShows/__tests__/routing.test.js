const { resolveDestination } = require('../routing');

describe('routing.resolveDestination', () => {
  const trackedOwner = { channelId: 'UCowner', folderName: 'Owner Channel', tracked: true, enabled: true };
  const untrackedOwner = { channelId: 'UCother', folderName: 'Other Channel', tracked: false, enabled: false };
  const titleShow = { id: 7, libraryFolder: 'TV Shows', folderName: 'Beyblade' };
  const channelShow = { id: 3, libraryFolder: 'TV Shows', folderName: 'Owner Channel' };
  const tvFolders = (...folders) => (libraryFolder) => (folders.includes(libraryFolder) ? 'tv' : 'videos');

  it('sends a classified video of a tracked, enabled channel to its title show', () => {
    expect(resolveDestination({
      ownerChannel: trackedOwner,
      titleShow,
      resolvedSubfolder: null,
      layoutOf: tvFolders('TV Shows')
    })).toEqual({
      layout: 'tv',
      kind: 'title',
      showId: 7,
      channelId: 'UCowner',
      libraryFolder: 'TV Shows',
      folderName: 'Beyblade'
    });
  });

  it('ignores a dialog override to a videos folder for a title show episode', () => {
    const destination = resolveDestination({
      ownerChannel: trackedOwner,
      titleShow,
      resolvedSubfolder: 'Kids',
      layoutOf: tvFolders('TV Shows')
    });
    expect(destination.showId).toBe(7);
  });

  it('does not use title shows of a disabled channel', () => {
    expect(resolveDestination({
      ownerChannel: { ...trackedOwner, enabled: false },
      titleShow,
      resolvedSubfolder: 'Kids',
      layoutOf: tvFolders('TV Shows')
    })).toEqual({ layout: 'videos', libraryFolder: 'Kids' });
  });

  it('saves movie-style into the main folder when it uses the videos layout', () => {
    expect(resolveDestination({ ownerChannel: trackedOwner, resolvedSubfolder: null, layoutOf: tvFolders() }))
      .toEqual({ layout: 'videos', libraryFolder: '' });
  });

  it('saves movie-style into a videos subfolder even when the channel has a channel show', () => {
    expect(resolveDestination({
      ownerChannel: trackedOwner,
      channelShow,
      resolvedSubfolder: 'Kids',
      layoutOf: tvFolders('TV Shows')
    })).toEqual({ layout: 'videos', libraryFolder: 'Kids' });
  });

  it('creates a channel show in the resolved TV folder on first use', () => {
    expect(resolveDestination({ ownerChannel: trackedOwner, resolvedSubfolder: 'TV Shows', layoutOf: tvFolders('TV Shows') }))
      .toEqual({
        layout: 'tv',
        kind: 'channel',
        showId: null,
        channelId: 'UCowner',
        libraryFolder: 'TV Shows',
        folderName: 'Owner Channel'
      });
  });

  it('creates a channel show for an untracked channel under a TV global default', () => {
    expect(resolveDestination({ ownerChannel: untrackedOwner, resolvedSubfolder: 'TV Shows', layoutOf: tvFolders('TV Shows') }))
      .toMatchObject({ kind: 'channel', showId: null, channelId: 'UCother', folderName: 'Other Channel' });
  });

  it('creates a channel show in the main folder when it is the TV folder', () => {
    expect(resolveDestination({ ownerChannel: trackedOwner, resolvedSubfolder: null, layoutOf: tvFolders('') }))
      .toMatchObject({ kind: 'channel', libraryFolder: '' });
  });

  it('keeps an existing channel show where it is when the resolved TV folder differs', () => {
    expect(resolveDestination({
      ownerChannel: trackedOwner,
      channelShow,
      resolvedSubfolder: 'Other TV',
      layoutOf: tvFolders('TV Shows', 'Other TV')
    })).toMatchObject({ showId: 3, libraryFolder: 'TV Shows', folderName: 'Owner Channel' });
  });

  it('names a new channel show after the owner channel, not the uploader (VEVO/Topic)', () => {
    const owner = { channelId: 'UCartist', folderName: 'Artist', tracked: true, enabled: true };
    expect(resolveDestination({ ownerChannel: owner, resolvedSubfolder: 'TV Shows', layoutOf: tvFolders('TV Shows') }))
      .toMatchObject({ channelId: 'UCartist', folderName: 'Artist' });
  });

  it('refuses to route to a channel show without the owner channel', () => {
    expect(() => resolveDestination({ ownerChannel: null, resolvedSubfolder: 'TV Shows', layoutOf: tvFolders('TV Shows') }))
      .toThrow(TypeError);
  });
});
