jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ getConfig: jest.fn(() => ({ x: 1 })), getDefaultSubfolder: jest.fn(() => 'GlobalDefault'), updateConfig: jest.fn() }));
jest.mock('../../subfolderModule', () => ({ register: jest.fn() }));
jest.mock('../../m3uGenerator', () => ({ deleteChannelM3U: jest.fn() }));
jest.mock('../../../models/channel', () => ({ findOne: jest.fn(), update: jest.fn() }));
jest.mock('../../../models/tvshow', () => ({ findByPk: jest.fn() }));
jest.mock('../../tvShows/showStore', () => ({ findChannelShow: jest.fn(), createChannelShowAt: jest.fn(), moveShowTo: jest.fn() }));
jest.mock('../../tvShows/libraryLayouts', () => ({ setLayout: jest.fn() }));
jest.mock('../../tvShows/layoutGuards', () => ({
  usersOfFolder: jest.fn().mockResolvedValue({ channels: [{ channel_id: 'UC7' }] }),
  usersOfGlobalDefault: jest.fn().mockResolvedValue({ channels: [{ channel_id: 'UC8' }] }),
}));
jest.mock('../../tvShows/channelLayout', () => ({ applyChannelFolderChange: jest.fn() }));
jest.mock('../../tvShows/libraryFolders', () => ({ syncPlexIgnore: jest.fn() }));
jest.mock('../showPlanner', () => ({ SHOW_ACTION: { KEEP: 'keep', CREATE: 'create', MOVE: 'move' } }));
jest.mock('../changeContext', () => ({ libraryFolderOf: (value, def) => (value === '##USE_GLOBAL_DEFAULT##' ? def : value || '') }));
jest.mock('../../tvShows/titleShowSaver', () => ({ prepare: jest.fn(), applyPrepared: jest.fn() }));
jest.mock('../titleSnapshot', () => ({ restoreTitleSnapshot: jest.fn() }));

const layoutOf = (folder) => (folder === 'TV' ? 'tv' : 'videos');

describe('reorganize settingsApplier', () => {
  let applier;
  let showStore;
  let Channel;
  let TvShow;
  let m3uGenerator;
  let configModule;
  let libraryLayouts;
  let channelLayout;
  let libraryFolders;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    showStore = require('../../tvShows/showStore');
    Channel = require('../../../models/channel');
    TvShow = require('../../../models/tvshow');
    m3uGenerator = require('../../m3uGenerator');
    configModule = require('../../configModule');
    libraryLayouts = require('../../tvShows/libraryLayouts');
    channelLayout = require('../../tvShows/channelLayout');
    libraryFolders = require('../../tvShows/libraryFolders');
    showStore.findChannelShow.mockResolvedValue(null);
    showStore.createChannelShowAt.mockImplementation(async (values) => ({ id: 11, ...values }));
    applier = require('../settingsApplier');
  });

  const channelChange = { type: 'channel', channelId: 'UC1', subFolder: 'TV', previousSubFolder: 'Kids' };
  const plannedShow = {
    ownerChannelId: 'UC1', showId: null, action: 'create', name: 'Chan', libraryFolder: 'TV', folderName: 'Chan',
    previousVideosFolder: 'Kids',
  };

  it('records the change as applied once it is applied', async () => {
    Channel.findOne.mockResolvedValue({ update: jest.fn() });
    const markApplied = jest.fn();
    await applier.applySettings({ change: channelChange, shows: [plannedShow], layoutBefore: layoutOf, markApplied });
    expect(markApplied).toHaveBeenCalledWith([expect.objectContaining({ ownerChannelId: 'UC1', showId: 11 })]);
  });

  it('creates a planned show and moves the channel to its new folder', async () => {
    const channel = { update: jest.fn() };
    Channel.findOne.mockResolvedValue(channel);

    const shows = await applier.applySettings({ change: channelChange, shows: [plannedShow], layoutBefore: layoutOf });

    expect(shows).toEqual([expect.objectContaining({ showId: 11 })]);
    expect(showStore.createChannelShowAt).toHaveBeenCalledWith(expect.objectContaining({ folderName: 'Chan', previousVideosFolder: 'Kids' }));
    expect(m3uGenerator.deleteChannelM3U).toHaveBeenCalledWith('UC1');
    expect(m3uGenerator.deleteChannelM3U.mock.invocationCallOrder[0]).toBeLessThan(channel.update.mock.invocationCallOrder[0]);
    expect(channel.update).toHaveBeenCalledWith({ sub_folder: 'TV' });
    expect(channelLayout.applyChannelFolderChange).toHaveBeenCalledWith(expect.objectContaining({
      change: { oldLayout: 'videos', newLayout: 'tv', newFolder: 'TV' },
    }));
  });

  it('reuses a show already pinned when applied again after a restart', async () => {
    Channel.findOne.mockResolvedValue({ update: jest.fn() });
    showStore.findChannelShow.mockResolvedValue({ id: 11, library_folder: 'tv', folder_name: 'chan', update: jest.fn() });

    const shows = await applier.applySettings({ change: channelChange, shows: [plannedShow], layoutBefore: layoutOf });

    expect(showStore.createChannelShowAt).not.toHaveBeenCalled();
    expect(showStore.moveShowTo).not.toHaveBeenCalled();
    expect(shows[0].showId).toBe(11);
  });

  it('moves a show that moves with its channel', async () => {
    Channel.findOne.mockResolvedValue({ update: jest.fn() });
    const row = { id: 9, library_folder: 'Old TV', folder_name: 'Chan', update: jest.fn() };
    TvShow.findByPk.mockResolvedValue(row);
    showStore.moveShowTo.mockResolvedValue(row);

    await applier.applySettings({
      change: channelChange,
      shows: [{ ...plannedShow, showId: 9, action: 'move', previousVideosFolder: null }],
      layoutBefore: layoutOf,
    });

    expect(showStore.moveShowTo).toHaveBeenCalledWith(row, expect.objectContaining({ libraryFolder: 'TV', folderName: 'Chan' }));
  });

  it('keeps the channel .m3u when the channel moves to a Videos folder', async () => {
    Channel.findOne.mockResolvedValue({ update: jest.fn() });

    await applier.applySettings({
      change: { ...channelChange, subFolder: 'Kids', previousSubFolder: 'TV' }, shows: [], layoutBefore: layoutOf,
    });

    expect(m3uGenerator.deleteChannelM3U).not.toHaveBeenCalled();
  });

  it('switches a folder to TV, dropping its channels\' .m3u files first', async () => {
    await applier.applySettings({ change: { type: 'folderLayout', folder: '', layout: 'tv', previousLayout: 'videos' }, shows: [], layoutBefore: layoutOf });

    expect(m3uGenerator.deleteChannelM3U).toHaveBeenCalledWith('UC7');
    expect(libraryLayouts.setLayout).toHaveBeenCalledWith('', 'tv');
    expect(libraryFolders.syncPlexIgnore).toHaveBeenCalledWith('tv');
  });

  it('changes the default subfolder', async () => {
    await applier.applySettings({ change: { type: 'defaultSubfolder', value: 'TV', previousValue: 'GlobalDefault' }, shows: [], layoutBefore: layoutOf });

    expect(m3uGenerator.deleteChannelM3U).toHaveBeenCalledWith('UC8');
    expect(configModule.updateConfig).toHaveBeenCalledWith({ x: 1, defaultSubfolder: 'TV' });
  });

  describe('rollbackSettings', () => {
    it('puts the channel and a moved show back', async () => {
      const row = { id: 9 };
      TvShow.findByPk.mockResolvedValue(row);

      await applier.rollbackSettings({
        change: channelChange,
        shows: [{ showId: 9, action: 'move', previousLocation: { libraryFolder: 'Old TV', folderName: 'Chan' } }],
      });

      expect(showStore.moveShowTo).toHaveBeenCalledWith(row, { libraryFolder: 'Old TV', folderName: 'Chan' });
      expect(Channel.update).toHaveBeenCalledWith({ sub_folder: 'Kids' }, { where: { channel_id: 'UC1' } });
    });

    it('restores a folder\'s layout', async () => {
      await applier.rollbackSettings({ change: { type: 'folderLayout', folder: 'Kids', layout: 'tv', previousLayout: 'videos' }, shows: [] });

      expect(libraryLayouts.setLayout).toHaveBeenCalledWith('Kids', 'videos');
    });

    it('restores the default subfolder', async () => {
      await applier.rollbackSettings({ change: { type: 'defaultSubfolder', value: 'TV', previousValue: 'GlobalDefault' }, shows: [] });

      expect(configModule.updateConfig).toHaveBeenCalledWith({ x: 1, defaultSubfolder: 'GlobalDefault' });
    });
  });

  describe('title show changes', () => {
    const change = { type: 'titleShows', channelId: 'UC1', shows: [{ name: 'Beyblade' }], overrides: [] };
    const planned = [
      { key: 'new:0', kind: 'title', ownerChannelId: 'UC1', showId: null, action: 'create', name: 'Beyblade', libraryFolder: 'TV', folderName: 'Beyblade' },
      { key: 'title:3', kind: 'title', ownerChannelId: 'UC1', showId: 3, action: 'keep', name: 'Old', libraryFolder: 'TV', folderName: 'Old' },
    ];
    let titleShowSaver;

    beforeEach(() => {
      titleShowSaver = require('../../tvShows/titleShowSaver');
      Channel.findOne.mockResolvedValue({ channel_id: 'UC1' });
      titleShowSaver.prepare.mockResolvedValue({ drafts: ['drafts'], plan: { entries: [] } });
      titleShowSaver.applyPrepared.mockResolvedValue({ showIds: new Map([['new:0', 9], ['title:3', 3]]), patternIds: new Map() });
    });

    it('saves the shows and every episode row of the channel', async () => {
      await applier.applySettings({ change, shows: planned, layoutBefore: layoutOf });
      expect(titleShowSaver.prepare).toHaveBeenCalledWith({ channel: { channel_id: 'UC1' }, rawShows: change.shows, rawOverrides: [] });
      expect(titleShowSaver.applyPrepared).toHaveBeenCalledWith(expect.objectContaining({ channel: { channel_id: 'UC1' }, drafts: ['drafts'], plan: { entries: [] } }));
    });

    // A restart between the write and the record would replay the change,
    // whose new shows would then hold their own folders.
    it('records the change as applied inside the transaction that writes it', async () => {
      titleShowSaver.applyPrepared.mockImplementation(async ({ onWritten }) => {
        const saved = { showIds: new Map([['new:0', 9], ['title:3', 3]]), patternIds: new Map() };
        await onWritten(saved, 'tx');
        return saved;
      });
      const markApplied = jest.fn();
      await applier.applySettings({ change, shows: planned, layoutBefore: layoutOf, markApplied });
      expect(markApplied.mock.calls).toEqual([[[expect.objectContaining({ key: 'new:0', showId: 9 }), expect.objectContaining({ key: 'title:3', showId: 3 })], 'tx']]);
    });

    it('gives new title shows their saved ids', async () => {
      const pinned = await applier.applySettings({ change, shows: planned, layoutBefore: layoutOf });
      expect(pinned.map((show) => show.showId)).toEqual([9, 3]);
    });

    it('creates no channel show for a title show', async () => {
      await applier.applySettings({ change, shows: planned, layoutBefore: layoutOf });
      expect(showStore.createChannelShowAt).not.toHaveBeenCalled();
    });

    it('puts the shows and episodes back from the snapshot', async () => {
      const snapshot = { shows: [], rows: [], conflicts: [] };
      await applier.rollbackSettings({ change, shows: planned, snapshot });
      expect(require('../titleSnapshot').restoreTitleSnapshot).toHaveBeenCalledWith({ channel_id: 'UC1' }, snapshot);
    });
  });
});
