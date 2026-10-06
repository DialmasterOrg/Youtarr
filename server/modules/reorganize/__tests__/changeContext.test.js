jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ getDefaultSubfolder: jest.fn() }));
jest.mock('../../../models/channel', () => ({ findOne: jest.fn() }));
jest.mock('../../subfolderModule', () => ({ getAll: jest.fn() }));
jest.mock('../../tvShows/libraryLayouts', () => ({ getLayoutResolver: jest.fn() }));
jest.mock('../../tvShows/layoutGuards', () => ({
  guardError: (message, status) => Object.assign(new Error(message), { status }),
  assertNoMp3Users: jest.fn(),
  usersOfFolder: jest.fn().mockResolvedValue({ channels: [], playlists: [] }),
  usersOfGlobalDefault: jest.fn().mockResolvedValue({ channels: [], playlists: [] }),
  assertNoTitleShows: jest.fn(),
}));
jest.mock('../../tvShows/titleShowSaver', () => ({ prepare: jest.fn() }));
jest.mock('../../tvShows/channelLayout', () => ({
  MESSAGES: { mp3: 'TV shows are video-only.' },
  resolveLayoutTarget: jest.fn(),
}));

const TV_FOLDERS = new Set(['tv shows']);

describe('reorganize changeContext', () => {
  let changeContext;
  let configModule;
  let Channel;
  let subfolderModule;
  let layoutGuards;
  let channelLayout;

  const channel = (overrides = {}) => ({
    channel_id: 'UC1', title: 'Chan', sub_folder: 'Kids', audio_format: null, ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    configModule = require('../../configModule');
    Channel = require('../../../models/channel');
    subfolderModule = require('../../subfolderModule');
    layoutGuards = require('../../tvShows/layoutGuards');
    channelLayout = require('../../tvShows/channelLayout');
    require('../../tvShows/libraryLayouts').getLayoutResolver.mockResolvedValue(
      (folder) => (TV_FOLDERS.has(String(folder).toLowerCase()) ? 'tv' : 'videos')
    );
    configModule.getDefaultSubfolder.mockReturnValue('GlobalDefault');
    subfolderModule.getAll.mockResolvedValue(['__Kids', '__TV Shows', '__GlobalDefault']);
    changeContext = require('../changeContext');
  });

  describe('title show changes', () => {
    const change = { type: 'titleShows', channelId: 'UC1', shows: [{ name: 'Beyblade' }], overrides: [] };

    beforeEach(() => {
      Channel.findOne.mockResolvedValue(channel({ title: 'BEYBLADE Official' }));
      require('../../tvShows/titleShowSaver').prepare.mockResolvedValue({ drafts: [{ key: 'new:0' }], plan: { entries: [] } });
    });

    it('plans the channel\'s title shows', async () => {
      const context = await changeContext.resolveChange(change);
      expect(require('../../tvShows/titleShowSaver').prepare).toHaveBeenCalledWith({
        channel: expect.objectContaining({ channel_id: 'UC1' }), rawShows: change.shows, rawOverrides: [],
      });
      expect([context.type, context.drafts, context.titlePlan]).toEqual(['titleShows', [{ key: 'new:0' }], { entries: [] }]);
    });

    it('keeps the channel where it is', async () => {
      const context = await changeContext.resolveChange(change);
      expect([context.fromFolder, context.toFolder, context.folderAfter({ sub_folder: 'Kids' })]).toEqual(['Kids', 'Kids', 'Kids']);
    });

    it('stores the change as requested', async () => {
      const context = await changeContext.resolveChange(change);
      expect([context.stored, context.scope, context.label]).toEqual([change, 'UC1', 'BEYBLADE Official: shows']);
    });

    it('refuses shows that are not a list', async () => {
      await expect(changeContext.resolveChange({ ...change, shows: 'x' })).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('a folder holding title shows', () => {
    it('refuses to switch it to Videos', async () => {
      layoutGuards.assertNoTitleShows.mockRejectedValue(Object.assign(new Error('Move its title shows first.'), { status: 400 }));
      await expect(changeContext.resolveChange({ type: 'folderLayout', folder: 'TV Shows', layout: 'videos' }))
        .rejects.toMatchObject({ status: 400 });
      expect(layoutGuards.assertNoTitleShows).toHaveBeenCalledWith('TV Shows');
    });
  });

  describe('channel changes', () => {
    it('resolves a move from a Videos folder to a TV folder', async () => {
      Channel.findOne.mockResolvedValue(channel());

      const context = await changeContext.resolveChange({ type: 'channel', channelId: 'UC1', subFolder: 'TV Shows' });

      expect(context).toMatchObject({ type: 'channel', fromFolder: 'Kids', toFolder: 'TV Shows', label: 'Chan' });
      expect(context.stored).toEqual({ type: 'channel', channelId: 'UC1', subFolder: 'TV Shows', previousSubFolder: 'Kids' });
      expect(context.folderAfter({ channel_id: 'UC1', sub_folder: 'Kids' })).toBe('TV Shows');
      expect(context.folderAfter({ channel_id: 'UC2', sub_folder: '##USE_GLOBAL_DEFAULT##' })).toBe('GlobalDefault');
    });

    it('resolves the layout toggle through the folder it would pick', async () => {
      Channel.findOne.mockResolvedValue(channel());
      channelLayout.resolveLayoutTarget.mockResolvedValue('TV Shows');

      const context = await changeContext.resolveChange({ type: 'channelLayout', channelId: 'UC1', layout: 'tv' });

      expect(channelLayout.resolveLayoutTarget).toHaveBeenCalledWith(expect.objectContaining({ layout: 'tv', folder: undefined }));
      expect(context.toFolder).toBe('TV Shows');
    });

    it('refuses a move between two Videos folders', async () => {
      Channel.findOne.mockResolvedValue(channel());

      await expect(changeContext.resolveChange({ type: 'channel', channelId: 'UC1', subFolder: 'Other' }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('refuses a change that keeps the channel in its folder', async () => {
      Channel.findOne.mockResolvedValue(channel({ sub_folder: 'TV Shows' }));

      await expect(changeContext.resolveChange({ type: 'channel', channelId: 'UC1', subFolder: 'tv shows' }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('refuses an MP3 channel moving to a TV folder', async () => {
      Channel.findOne.mockResolvedValue(channel({ audio_format: 'mp3_only' }));

      await expect(changeContext.resolveChange({ type: 'channel', channelId: 'UC1', subFolder: 'TV Shows' }))
        .rejects.toMatchObject({ status: 400, message: 'TV shows are video-only.' });
    });

    it('returns 404 for an unknown channel', async () => {
      Channel.findOne.mockResolvedValue(null);

      await expect(changeContext.resolveChange({ type: 'channel', channelId: 'UCX', subFolder: 'TV Shows' }))
        .rejects.toMatchObject({ status: 404 });
    });

    it('refuses an invalid folder name', async () => {
      Channel.findOne.mockResolvedValue(channel());

      await expect(changeContext.resolveChange({ type: 'channel', channelId: 'UC1', subFolder: '../etc' }))
        .rejects.toMatchObject({ status: 400 });
    });
  });

  describe('folder layout changes', () => {
    it('resolves a folder switching to TV', async () => {
      const context = await changeContext.resolveChange({ type: 'folderLayout', folder: 'Kids', layout: 'tv' });

      expect(context.stored).toEqual({ type: 'folderLayout', folder: 'Kids', layout: 'tv', previousLayout: 'videos' });
      expect(context.layoutAfter('kids')).toBe('tv');
      expect(context.layoutAfter('Other')).toBe('videos');
      expect(layoutGuards.assertNoMp3Users).toHaveBeenCalled();
    });

    it('returns 404 for an unknown subfolder', async () => {
      await expect(changeContext.resolveChange({ type: 'folderLayout', folder: 'Nope', layout: 'tv' }))
        .rejects.toMatchObject({ status: 404 });
    });

    it('refuses a layout the folder already has', async () => {
      await expect(changeContext.resolveChange({ type: 'folderLayout', folder: 'TV Shows', layout: 'tv' }))
        .rejects.toMatchObject({ status: 400 });
    });
  });

  describe('default subfolder changes', () => {
    it('resolves a default moving to a TV folder', async () => {
      const context = await changeContext.resolveChange({ type: 'defaultSubfolder', value: 'TV Shows' });

      expect(context.stored).toEqual({ type: 'defaultSubfolder', value: 'TV Shows', previousValue: 'GlobalDefault' });
      expect(context.folderAfter({ sub_folder: '##USE_GLOBAL_DEFAULT##' })).toBe('TV Shows');
      expect(context.folderAfter({ sub_folder: 'Kids' })).toBe('Kids');
    });

    it('refuses a default with the same layout', async () => {
      await expect(changeContext.resolveChange({ type: 'defaultSubfolder', value: 'Kids' }))
        .rejects.toMatchObject({ status: 400 });
    });
  });

  it('refuses an unknown change type', async () => {
    await expect(changeContext.resolveChange({ type: 'rename' })).rejects.toMatchObject({ status: 400 });
  });
});
