jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ getConfig: jest.fn() }));
jest.mock('../../ytDlpRunner', () => ({ run: jest.fn() }));
jest.mock('../../download/ytdlpCommandBuilder', () => ({ buildCustomArgs: jest.fn() }));

const fs = require('fs');

const ID_A = 'aaaaaaaaaaa';
const ID_B = 'bbbbbbbbbbb';

describe('movieNameRenderer', () => {
  let renderer;
  let configModule;
  let ytDlpRunner;
  let commandBuilder;

  beforeEach(() => {
    jest.resetModules();
    configModule = require('../../configModule');
    ytDlpRunner = require('../../ytDlpRunner');
    commandBuilder = require('../../download/ytdlpCommandBuilder');
    configModule.getConfig.mockReturnValue({ videoFilenamePrefix: '%(uploader).80B - %(title).64B' });
    commandBuilder.buildCustomArgs.mockReturnValue([]);
    renderer = require('../movieNameRenderer');
  });

  const output = (...pairs) => `${pairs.map(([id, line]) => `${id}\n${line}`).join('\n')}\n`;

  describe('nameAffectingArgs', () => {
    it('keeps only the custom args that change file names, with their values', () => {
      const tokens = ['--retries', '5', '--restrict-filenames', '--trim-filenames', '60', '--replace-in-metadata', 'title', 'a', 'b', '-f', 'best'];

      expect(renderer.nameAffectingArgs(tokens)).toEqual([
        '--restrict-filenames', '--trim-filenames', '60', '--replace-in-metadata', 'title', 'a', 'b',
      ]);
    });

    it('keeps a --flag=value token on its own', () => {
      expect(renderer.nameAffectingArgs(['--trim-filenames=60', '--no-mtime'])).toEqual(['--trim-filenames=60']);
    });
  });

  it('renders the channel folder, video folder and stem from the global template', () => {
    expect(renderer.renderTemplate('%(uploader).80B - %(title).64B')).toBe(
      '%(uploader,channel,uploader_id).80B/%(uploader).80B - %(title).64B - %(id)s/%(uploader).80B - %(title).64B [%(id)s]'
    );
  });

  it('pairs each id with its rendered path', async () => {
    ytDlpRunner.run.mockResolvedValue(output(
      [ID_A, `Chan/Chan - One - ${ID_A}/Chan - One [${ID_A}]`],
      [ID_B, `Chan/Chan - Two - ${ID_B}/Chan - Two [${ID_B}]`],
    ));

    const names = await renderer.renderMovieNames([
      { youtubeId: ID_A, info: { id: ID_A, title: 'One' } },
      { youtubeId: ID_B, info: { id: ID_B, title: 'Two' } },
    ]);

    expect(names.get(ID_A)).toEqual({ channelFolder: 'Chan', videoFolder: `Chan - One - ${ID_A}`, stem: `Chan - One [${ID_A}]` });
    expect(names.get(ID_B).stem).toBe(`Chan - Two [${ID_B}]`);
  });

  it('passes the info dicts without their format lists, plus the download naming options', async () => {
    let written = null;
    ytDlpRunner.run.mockImplementation(async (args) => {
      written = JSON.parse(fs.readFileSync(args[args.indexOf('--load-info-json') + 1], 'utf8'));
      return output([ID_A, `Chan/Chan - One - ${ID_A}/Chan - One [${ID_A}]`]);
    });
    commandBuilder.buildCustomArgs.mockReturnValue(['--restrict-filenames', '--retries', '3']);

    await renderer.renderMovieNames([{ youtubeId: ID_A, info: { id: ID_A, title: 'One', formats: [{}], thumbnails: [{}] } }]);

    const args = ytDlpRunner.run.mock.calls[0][0];
    expect(written).toEqual([{ id: ID_A, title: 'One' }]);
    expect(args).toEqual(expect.arrayContaining(['--ignore-no-formats-error', '--windows-filenames', '--restrict-filenames']));
    expect(args).not.toContain('--retries');
  });

  it('isolates an info dict that fails yt-dlp and renders the rest', async () => {
    ytDlpRunner.run.mockImplementation(async (args) => {
      const batch = JSON.parse(fs.readFileSync(args[args.indexOf('--load-info-json') + 1], 'utf8'));
      if (batch.some((info) => info.id === ID_B)) throw new Error('bad info');
      return output([ID_A, `Chan/Chan - One - ${ID_A}/Chan - One [${ID_A}]`]);
    });

    const names = await renderer.renderMovieNames([
      { youtubeId: ID_A, info: { id: ID_A } },
      { youtubeId: ID_B, info: { id: ID_B } },
    ]);

    expect(names.has(ID_A)).toBe(true);
    expect(names.has(ID_B)).toBe(false);
  });

  it('ignores a rendered path that does not end with the video id', () => {
    const names = renderer.parseOutput(`${ID_A}\nChan/Folder/Other name\n`, new Set([ID_A]));

    expect(names.size).toBe(0);
  });

  it('does not run yt-dlp for an empty list', async () => {
    await expect(renderer.renderMovieNames([])).resolves.toEqual(new Map());
    expect(ytDlpRunner.run).not.toHaveBeenCalled();
  });
});
