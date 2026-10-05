jest.mock('../../tvShows/showStore', () => ({ findChannelShow: jest.fn(), planChannelShowFolder: jest.fn() }));
jest.mock('../../tvShows/channelFolders', () => {
  const path = require('path');
  return {
    showDirectory: (show) => path.join('/data', show.library_folder ? `__${show.library_folder}` : '', show.folder_name),
  };
});
jest.mock('../titleTargets', () => ({
  resolveTitleTargets: jest.fn(async () => ({ targets: new Map(), shows: new Map() })),
}));
jest.mock('../changeScope', () => {
  const path = require('path');
  return { libraryRootOf: (folder) => (folder ? path.join('/data', `__${folder}`) : '/data') };
});

const OWNER = { channel_id: 'UC1', title: 'Chan', folder_name: 'Chan', sub_folder: 'Kids', description: 'About' };

const subject = (overrides = {}) => ({
  video: { id: 1, youtubeId: 'aaaaaaaaaaa', filePath: '/data/__Kids/Chan/A [aaaaaaaaaaa].mp4', youTubeChannelName: 'Chan' },
  ownerChannelId: 'UC1',
  ownerChannel: OWNER,
  libraryFolder: 'Kids',
  currentLayout: 'videos',
  ...overrides,
});

const channelToTv = {
  type: 'channel',
  fromFolder: 'Kids',
  toFolder: 'TV',
  stored: { type: 'channel', channelId: 'UC1', subFolder: 'TV', previousSubFolder: 'Kids' },
  layoutBefore: (folder) => (folder === 'TV' ? 'tv' : 'videos'),
  layoutAfter: (folder) => (folder === 'TV' ? 'tv' : 'videos'),
  folderAfter: () => 'TV',
};

describe('reorganize showPlanner', () => {
  let showPlanner;
  let showStore;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    showStore = require('../../tvShows/showStore');
    showStore.findChannelShow.mockResolvedValue(null);
    showStore.planChannelShowFolder.mockImplementation(async ({ folderName }) => folderName);
    showPlanner = require('../showPlanner');
  });

  it('plans a new show for a channel moving to TV, remembering its Videos folder', async () => {
    const { targets, shows } = await showPlanner.planShows([subject()], channelToTv);

    expect(targets.get(1)).toEqual({ libraryFolder: 'TV', layout: 'tv' });
    expect(shows.get('UC1')).toMatchObject({
      action: 'create', libraryFolder: 'TV', folderName: 'Chan', name: 'Chan', plot: 'About', previousVideosFolder: 'Kids',
    });
  });

  it('keeps a show already at the destination', async () => {
    showStore.findChannelShow.mockResolvedValue({ id: 9, name: 'Chan', library_folder: 'tv', folder_name: 'Chan', external_key: 'UC1' });

    const { shows } = await showPlanner.planShows([subject()], channelToTv);

    expect(shows.get('UC1')).toMatchObject({ action: 'keep', showId: 9 });
    expect(showStore.planChannelShowFolder).not.toHaveBeenCalled();
  });

  it('moves a show along with its channel to another TV folder', async () => {
    showStore.findChannelShow.mockResolvedValue({ id: 9, name: 'Chan', library_folder: 'Old TV', folder_name: 'Chan', external_key: 'UC1' });
    const context = { ...channelToTv, fromFolder: 'Old TV', layoutBefore: () => 'tv', layoutAfter: () => 'tv' };

    const { shows } = await showPlanner.planShows([subject({ libraryFolder: 'Old TV', currentLayout: 'tv' })], context);

    expect(shows.get('UC1')).toMatchObject({
      action: 'move', showId: 9, libraryFolder: 'TV', previousLocation: { libraryFolder: 'Old TV', folderName: 'Chan' },
      previousVideosFolder: null,
    });
    expect(showStore.planChannelShowFolder).toHaveBeenCalledWith(expect.objectContaining({ excludeShowId: 9, libraryFolder: 'TV' }));
  });

  it('plans no show for videos going to a Videos folder', async () => {
    const context = { ...channelToTv, toFolder: 'Kids', folderAfter: () => 'Kids' };

    const { targets, shows } = await showPlanner.planShows([subject({ libraryFolder: 'TV', currentLayout: 'tv' })], context);

    expect(targets.get(1)).toEqual({ libraryFolder: 'Kids', layout: 'videos' });
    expect(shows.size).toBe(0);
  });

  describe('a folder switching to TV', () => {
    const folderToTv = {
      type: 'folderLayout',
      folder: 'Kids',
      layoutBefore: () => 'videos',
      layoutAfter: (folder) => (folder === 'Kids' || folder === 'TV' ? 'tv' : 'videos'),
    };

    it('keeps its videos in the folder and names a new show after their channel folder', async () => {
      const untracked = subject({ ownerChannelId: 'UCX', ownerChannel: null, video: {
        id: 2, youtubeId: 'bbbbbbbbbbb', filePath: '/data/__Kids/Some Uploader/B [bbbbbbbbbbb].mp4', youTubeChannelName: 'Uploader',
      } });

      const { targets, shows } = await showPlanner.planShows([untracked], folderToTv);

      expect(targets.get(2)).toEqual({ libraryFolder: 'Kids', layout: 'tv' });
      expect(shows.get('UCX')).toMatchObject({ action: 'create', folderName: 'Some Uploader', name: 'Uploader', libraryFolder: 'Kids' });
    });

    it('leaves an owner\'s show where it is when it already lives in a TV folder', async () => {
      showStore.findChannelShow.mockResolvedValue({ id: 9, name: 'Chan', library_folder: 'TV', folder_name: 'Chan', external_key: 'UC1' });

      const { shows } = await showPlanner.planShows([subject()], folderToTv);

      expect(shows.get('UC1')).toMatchObject({ action: 'keep', libraryFolder: 'TV' });
    });
  });

  describe('title shows', () => {
    const titleShow = { key: 'title:3', kind: 'title', ownerChannelId: 'UC1', showId: 3, action: 'keep', name: 'Beyblade', libraryFolder: 'Anime', folderName: 'Beyblade' };

    beforeEach(() => {
      require('../titleTargets').resolveTitleTargets.mockResolvedValue({
        targets: new Map([[1, { showKey: 'title:3', after: { season: 1, episode: 20 } }]]),
        shows: new Map([['title:3', titleShow]]),
      });
    });

    it('sends an episode of a title show to its show\'s folder', async () => {
      const { targets } = await showPlanner.planShows([subject()], channelToTv, new Map());
      expect(targets.get(1)).toEqual({ libraryFolder: 'Anime', layout: 'tv', showKey: 'title:3' });
    });

    it('plans the title show and no channel show for it', async () => {
      const { shows } = await showPlanner.planShows([subject()], channelToTv, new Map());
      expect([...shows.keys()]).toEqual(['title:3']);
    });

    it('hands the title targets on for numbering', async () => {
      const { titleTargets } = await showPlanner.planShows([subject()], channelToTv, new Map());
      expect(titleTargets.get(1).after).toEqual({ season: 1, episode: 20 });
    });

    it('passes the channels to the title show lookup', async () => {
      const channels = new Map([['UC1', OWNER]]);
      await showPlanner.planShows([subject()], channelToTv, channels);
      expect(require('../titleTargets').resolveTitleTargets).toHaveBeenCalledWith([subject()], channelToTv, channels);
    });
  });

  it('gives the absolute folders of a planned show', () => {
    const planned = { libraryFolder: 'TV', folderName: 'Chan', previousLocation: { libraryFolder: '', folderName: 'Chan' } };

    expect(showPlanner.plannedShowDirectory(planned)).toBe('/data/__TV/Chan');
    expect(showPlanner.previousShowDirectory(planned)).toBe('/data/Chan');
  });
});
