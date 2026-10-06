jest.mock('../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../configModule', () => ({ getConfig: jest.fn(), getImagePath: jest.fn() }));
jest.mock('../tvShows/episodePlacement', () => ({ earliestEpisodeDate: jest.fn(), seasonNamesOf: jest.fn().mockResolvedValue({}) }));

const fs = require('fs');
const os = require('os');
const path = require('path');

const ID = 'abcdefghijk';
const INFO = { id: ID, title: 'Big Build', upload_date: '20240315', uploader: 'Builder', duration: 600, description: 'Plot' };

describe('sidecarWriter', () => {
  let sidecarWriter;
  let configModule;
  let episodePlacement;
  let root;
  let videoDir;
  let videoPath;
  let imageDir;

  beforeEach(() => {
    jest.resetModules();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-writer-'));
    videoDir = path.join(root, 'Show', 'Season 2024');
    imageDir = path.join(root, 'images');
    fs.mkdirSync(videoDir, { recursive: true });
    fs.mkdirSync(imageDir);
    videoPath = path.join(videoDir, `S2024E03151200 - Big Build [${ID}].mp4`);
    fs.writeFileSync(videoPath, 'video');
    configModule = require('../configModule');
    configModule.getConfig.mockReturnValue({});
    configModule.getImagePath.mockReturnValue(imageDir);
    episodePlacement = require('../tvShows/episodePlacement');
    episodePlacement.earliestEpisodeDate.mockResolvedValue('2024-03-15');
    sidecarWriter = require('../sidecarWriter');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const sibling = (suffix) => path.join(videoDir, `S2024E03151200 - Big Build [${ID}]${suffix}`);
  const episode = { showTitle: 'Builder', season: 2024, episode: 3151200, episodeTitle: 'Big Build' };

  describe('writeVideoSidecars', () => {
    it('writes an episode NFO for an episode', async () => {
      await sidecarWriter.writeVideoSidecars({ videoPath, info: INFO, episode });

      const nfo = fs.readFileSync(sibling('.nfo'), 'utf8');
      expect(nfo).toContain('<episodedetails>');
      expect(nfo).toContain('<episode>3151200</episode>');
    });

    it('writes the episode NFO even when video NFO files are turned off', async () => {
      configModule.getConfig.mockReturnValue({ writeVideoNfoFiles: false });

      await sidecarWriter.writeVideoSidecars({ videoPath, info: INFO, episode });

      expect(fs.existsSync(sibling('.nfo'))).toBe(true);
    });

    it('writes a movie NFO for a movie-style video', async () => {
      await sidecarWriter.writeVideoSidecars({ videoPath, info: INFO });

      expect(fs.readFileSync(sibling('.nfo'), 'utf8')).toContain('<movie>');
    });

    it('writes no movie NFO when video NFO files are turned off', async () => {
      configModule.getConfig.mockReturnValue({ writeVideoNfoFiles: false });

      const written = await sidecarWriter.writeVideoSidecars({ videoPath, info: INFO });

      expect(written).toEqual([]);
      expect(fs.existsSync(sibling('.nfo'))).toBe(false);
    });

    it('copies the thumbnail as fanart and backdrop when those are turned on', async () => {
      configModule.getConfig.mockReturnValue({ writeVideoNfoFiles: false, writeVideoFanart: true, writeBackdropImages: true });
      fs.writeFileSync(sibling('.jpg'), 'thumb');

      await sidecarWriter.writeVideoSidecars({ videoPath, info: INFO });

      expect(fs.readFileSync(sibling('-fanart.jpg'), 'utf8')).toBe('thumb');
      expect(fs.readFileSync(sibling('-backdrop.jpg'), 'utf8')).toBe('thumb');
    });

    it('keeps an existing fanart file', async () => {
      configModule.getConfig.mockReturnValue({ writeVideoNfoFiles: false, writeVideoFanart: true });
      fs.writeFileSync(sibling('.jpg'), 'thumb');
      fs.writeFileSync(sibling('-fanart.jpg'), 'custom');

      await sidecarWriter.writeVideoSidecars({ videoPath, info: INFO });

      expect(fs.readFileSync(sibling('-fanart.jpg'), 'utf8')).toBe('custom');
    });
  });

  describe('writeFolderArt', () => {
    it('copies the cached channel avatar as poster.jpg', () => {
      fs.writeFileSync(path.join(imageDir, 'channelthumb-UC1.jpg'), 'avatar');

      const written = sidecarWriter.writeFolderArt({ channelId: 'UC1', folderPath: videoDir });

      expect(written).toEqual([path.join(videoDir, 'poster.jpg')]);
      expect(fs.readFileSync(path.join(videoDir, 'poster.jpg'), 'utf8')).toBe('avatar');
    });

    it('copies the banner only when backdrops are turned on', () => {
      fs.writeFileSync(path.join(imageDir, 'channelbanner-UC1.jpg'), 'banner');

      sidecarWriter.writeFolderArt({ channelId: 'UC1', folderPath: videoDir });
      expect(fs.existsSync(path.join(videoDir, 'backdrop.jpg'))).toBe(false);

      configModule.getConfig.mockReturnValue({ writeBackdropImages: true });
      sidecarWriter.writeFolderArt({ channelId: 'UC1', folderPath: videoDir });
      expect(fs.readFileSync(path.join(videoDir, 'backdrop.jpg'), 'utf8')).toBe('banner');
    });

    it('writes nothing into a folder that does not exist', () => {
      fs.writeFileSync(path.join(imageDir, 'channelthumb-UC1.jpg'), 'avatar');

      expect(sidecarWriter.writeFolderArt({ channelId: 'UC1', folderPath: path.join(root, 'missing') })).toEqual([]);
    });
  });

  describe('writeShowMetadata', () => {
    it('writes tvshow.nfo with the earliest episode date and the show art', async () => {
      const showDir = path.join(root, 'Show');
      fs.writeFileSync(path.join(imageDir, 'channelthumb-UC1.jpg'), 'avatar');

      await sidecarWriter.writeShowMetadata({
        show: { id: 3, name: 'Builder', channel_id: 'UC1', external_key: 'UC1' },
        showDir,
        plot: 'About',
      });

      const nfo = fs.readFileSync(path.join(showDir, 'tvshow.nfo'), 'utf8');
      expect(nfo).toContain('<premiered>2024-03-15</premiered>');
      expect(nfo).toContain('<uniqueid type="custom">UC1</uniqueid>');
      expect(fs.existsSync(path.join(showDir, 'poster.jpg'))).toBe(true);
    });

    it('writes a title show\'s tvshow.nfo with its Youtarr id, season names and season.nfo files', async () => {
      const showDir = path.join(root, 'Beyblade');
      fs.mkdirSync(path.join(showDir, 'Season 02'), { recursive: true });
      require('../tvShows/episodePlacement').seasonNamesOf.mockResolvedValue({ 2: 'V-Force' });

      await sidecarWriter.writeShowMetadata({
        show: { id: 4, kind: 'title', name: 'Beyblade', channel_id: 'UC1', external_key: 'uuid-4' },
        showDir,
        plot: 'Channel description',
      });

      const nfo = fs.readFileSync(path.join(showDir, 'tvshow.nfo'), 'utf8');
      expect(nfo).toContain('<uniqueid type="youtarr" default="true">uuid-4</uniqueid>');
      expect(nfo).toContain('<namedseason number="2">V-Force</namedseason>');
      expect(nfo).not.toContain('Channel description');
      expect(fs.readFileSync(path.join(showDir, 'Season 02', 'season.nfo'), 'utf8')).toContain('<title>V-Force</title>');
    });
  });
});
