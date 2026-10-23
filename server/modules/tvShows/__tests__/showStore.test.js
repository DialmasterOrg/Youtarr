jest.mock('../../../models/tvshow', () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
}));

const CHANNEL_ID = 'UCY1kMZp36IQSyNx_9h4mpCg';

function uniqueError() {
  const err = new Error('Validation error');
  err.name = 'SequelizeUniqueConstraintError';
  return err;
}

describe('showStore', () => {
  let showStore;
  let TvShow;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    TvShow = require('../../../models/tvshow');
    showStore = require('../showStore');
    TvShow.findOne.mockResolvedValue(null);
    TvShow.create.mockImplementation(async (values) => ({ id: 7, ...values }));
  });

  describe('showFolderNameProblem', () => {
    it.each([
      ['__kids', 'starts with __'],
      ['.hidden', 'starts with .'],
      ['Season 01', 'season folder'],
      ['trailers', 'extras folder'],
      ['Behind The Scenes', 'extras folder'],
      ['', 'empty'],
    ])('flags %s', (name) => {
      expect(showStore.showFolderNameProblem(name)).not.toBeNull();
    });

    it('accepts an ordinary show name', () => {
      expect(showStore.showFolderNameProblem('Mark Rober')).toBeNull();
    });
  });

  describe('findChannelShow', () => {
    it('looks up the active channel show of a channel', async () => {
      await showStore.findChannelShow(CHANNEL_ID);
      expect(TvShow.findOne).toHaveBeenCalledWith({
        where: { channel_id: CHANNEL_ID, kind: 'channel', retired_at: null },
      });
    });
  });

  describe('createChannelShow', () => {
    const create = (overrides = {}) => showStore.createChannelShow({
      channelId: CHANNEL_ID,
      name: 'Mark Rober',
      folderName: 'Mark Rober',
      libraryFolder: 'TV Shows',
      ...overrides,
    });

    it('returns the existing channel show instead of creating a second one', async () => {
      const existing = { id: 3, channel_id: CHANNEL_ID };
      TvShow.findOne.mockResolvedValue(existing);
      await expect(create()).resolves.toBe(existing);
      expect(TvShow.create).not.toHaveBeenCalled();
    });

    it('creates the show at the library folder with the channel id as its key', async () => {
      const show = await create({ previousVideosFolder: '##USE_GLOBAL_DEFAULT##' });
      expect(show).toMatchObject({
        channel_id: CHANNEL_ID,
        kind: 'channel',
        name: 'Mark Rober',
        folder_name: 'Mark Rober',
        library_folder: 'TV Shows',
        external_key: CHANNEL_ID,
        previous_videos_folder: '##USE_GLOBAL_DEFAULT##',
      });
    });

    it('sanitizes a raw folder name like a yt-dlp field', async () => {
      const show = await create({ folderName: 'AC/DC: Live?' });
      expect(show.folder_name).toBe('AC⧸DC： Live？');
    });

    it('adds the channel id when another show holds the folder name', async () => {
      TvShow.create.mockRejectedValueOnce(uniqueError());
      const show = await create();
      expect(show.folder_name).toBe(`Mark Rober (${CHANNEL_ID})`);
    });

    it('adds the channel id when the name is an extras folder name', async () => {
      const show = await create({ folderName: 'Trailers' });
      expect(show.folder_name).toBe(`Trailers (${CHANNEL_ID})`);
    });

    it('uses the channel id alone when no form of the name is valid', async () => {
      const show = await create({ folderName: '.hidden' });
      expect(show.folder_name).toBe(CHANNEL_ID);
    });

    it('rethrows errors other than a taken folder name', async () => {
      TvShow.create.mockRejectedValueOnce(new Error('connection lost'));
      await expect(create()).rejects.toThrow('connection lost');
    });
  });

  describe('relocateChannelShow', () => {
    it('moves the show to another library folder, keeping its folder name', async () => {
      const show = { channel_id: CHANNEL_ID, folder_name: 'Mark Rober', update: jest.fn() };
      await showStore.relocateChannelShow(show, 'Kids TV');
      expect(show.update).toHaveBeenCalledWith({ library_folder: 'Kids TV', folder_name: 'Mark Rober' });
    });

    it('adds the channel id when the folder name is taken in the new folder', async () => {
      const show = {
        channel_id: CHANNEL_ID,
        folder_name: 'Mark Rober',
        update: jest.fn().mockRejectedValueOnce(uniqueError()).mockResolvedValueOnce(undefined),
      };
      await showStore.relocateChannelShow(show, 'Kids TV');
      expect(show.update).toHaveBeenLastCalledWith({
        library_folder: 'Kids TV',
        folder_name: `Mark Rober (${CHANNEL_ID})`,
      });
    });
  });

  describe('planned placement (reorganize)', () => {
    it('plans the first folder name no other show in the library folder uses', async () => {
      TvShow.findAll.mockResolvedValue([{ id: 2, folder_name: 'Mark Rober' }]);

      const name = await showStore.planChannelShowFolder({ channelId: CHANNEL_ID, folderName: 'Mark Rober', libraryFolder: 'TV' });

      expect(name).toBe(`Mark Rober (${CHANNEL_ID})`);
      expect(TvShow.create).not.toHaveBeenCalled();
    });

    it('compares folder names ignoring case and accents, like the unique key', async () => {
      TvShow.findAll.mockResolvedValue([{ id: 2, folder_name: 'cafe' }]);

      await expect(showStore.planChannelShowFolder({ channelId: CHANNEL_ID, folderName: 'Café', libraryFolder: 'TV' }))
        .resolves.toBe(`Café (${CHANNEL_ID})`);
    });

    it('lets a moving show keep its own name', async () => {
      TvShow.findAll.mockResolvedValue([{ id: 5, folder_name: 'Mark Rober' }]);

      await expect(showStore.planChannelShowFolder({
        channelId: CHANNEL_ID, folderName: 'Mark Rober', libraryFolder: 'TV', excludeShowId: 5,
      })).resolves.toBe('Mark Rober');
    });

    it('never plans the same name twice in one change', async () => {
      TvShow.findAll.mockResolvedValue([]);
      const reserved = new Set();

      const first = await showStore.planChannelShowFolder({ channelId: 'UCA', folderName: 'Music', libraryFolder: 'TV', reserved });
      const second = await showStore.planChannelShowFolder({ channelId: 'UCB', folderName: 'Music', libraryFolder: 'TV', reserved });

      expect([first, second]).toEqual(['Music', 'Music (UCB)']);
    });

    it('creates a show at exactly the planned location', async () => {
      await showStore.createChannelShowAt({ channelId: CHANNEL_ID, name: 'Mark Rober', folderName: 'Mark Rober (x)', libraryFolder: 'TV' });

      expect(TvShow.create).toHaveBeenCalledWith(expect.objectContaining({
        channel_id: CHANNEL_ID, folder_name: 'Mark Rober (x)', library_folder: 'TV', external_key: CHANNEL_ID, kind: 'channel',
      }));
    });

    it('moves a show to exactly the planned location', async () => {
      const show = { update: jest.fn().mockResolvedValue(undefined) };

      await showStore.moveShowTo(show, { libraryFolder: '', folderName: 'Mark Rober' });

      expect(show.update).toHaveBeenCalledWith({ library_folder: '', folder_name: 'Mark Rober' });
    });
  });
});
