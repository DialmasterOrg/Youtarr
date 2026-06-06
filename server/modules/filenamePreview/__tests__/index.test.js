/* eslint-env jest */

jest.mock('../../ytDlpRunner', () => ({
  run: jest.fn(),
}));

const ytDlpRunner = require('../../ytDlpRunner');
const filenamePreview = require('..');

const FIXTURE_PATH_FRAGMENT = 'sample-video.info.json';

beforeEach(() => {
  jest.clearAllMocks();
  filenamePreview._resetCache();
});

describe('previewTemplate', () => {
  test('calls yt-dlp twice (file template + folder template) and shapes the result', async () => {
    ytDlpRunner.run
      .mockResolvedValueOnce('TEDx Talks - How to Get Your Brain... [Hu4Yvq-g7_Y].mp4\n')
      .mockResolvedValueOnce('TEDx Talks - How to Get Your Brain... - Hu4Yvq-g7_Y\n');

    const result = await filenamePreview.previewTemplate(
      '%(uploader,channel,uploader_id).80B - %(title).76B'
    );

    expect(ytDlpRunner.run).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      fileLine: 'TEDx Talks - How to Get Your Brain... [Hu4Yvq-g7_Y].mp4',
      folderLine: 'TEDx Talks - How to Get Your Brain... - Hu4Yvq-g7_Y',
      fileLineLength: 'TEDx Talks - How to Get Your Brain... [Hu4Yvq-g7_Y].mp4'.length,
      folderLineLength: 'TEDx Talks - How to Get Your Brain... - Hu4Yvq-g7_Y'.length,
    });
  });

  test('passes the composed file and folder templates to yt-dlp via -o', async () => {
    ytDlpRunner.run
      .mockResolvedValueOnce('a [id].mp4')
      .mockResolvedValueOnce('a - id');

    await filenamePreview.previewTemplate('%(title).76B');

    const fileArgs = ytDlpRunner.run.mock.calls[0][0];
    const folderArgs = ytDlpRunner.run.mock.calls[1][0];

    // -o is positional; grab the value after it
    const fileOIdx = fileArgs.indexOf('-o');
    const folderOIdx = folderArgs.indexOf('-o');
    expect(fileArgs[fileOIdx + 1]).toBe('%(title).76B [%(id)s].%(ext)s');
    expect(folderArgs[folderOIdx + 1]).toBe('%(title).76B - %(id)s');
  });

  test('passes --load-info-json with the bundled fixture path', async () => {
    ytDlpRunner.run.mockResolvedValue('x');
    await filenamePreview.previewTemplate('%(title).76B');

    const args = ytDlpRunner.run.mock.calls[0][0];
    const loadIdx = args.indexOf('--load-info-json');
    expect(loadIdx).toBeGreaterThanOrEqual(0);
    expect(args[loadIdx + 1]).toMatch(FIXTURE_PATH_FRAGMENT);
  });

  test('passes flags that prevent network and downloads', async () => {
    ytDlpRunner.run.mockResolvedValue('x');
    await filenamePreview.previewTemplate('%(title).76B');

    const args = ytDlpRunner.run.mock.calls[0][0];
    expect(args).toContain('--simulate');
    expect(args).toContain('--skip-download');
    expect(args).toContain('--windows-filenames');
    expect(args).toContain('--quiet');
    expect(args).toContain('--no-warnings');
    expect(args).toContain('--no-update');
  });

  test('caches by prefix and does not re-spawn yt-dlp on a hit', async () => {
    ytDlpRunner.run
      .mockResolvedValueOnce('file [id].mp4')
      .mockResolvedValueOnce('folder - id');

    const a = await filenamePreview.previewTemplate('%(title).76B');
    const b = await filenamePreview.previewTemplate('%(title).76B');

    expect(a).toEqual(b);
    expect(ytDlpRunner.run).toHaveBeenCalledTimes(2); // first call only
  });

  test('different prefixes do not share cache entries', async () => {
    ytDlpRunner.run
      .mockResolvedValueOnce('A.mp4')
      .mockResolvedValueOnce('A')
      .mockResolvedValueOnce('B.mp4')
      .mockResolvedValueOnce('B');

    await filenamePreview.previewTemplate('%(title).76B');
    await filenamePreview.previewTemplate('%(uploader)s');

    expect(ytDlpRunner.run).toHaveBeenCalledTimes(4);
  });

  test('propagates yt-dlp error so the route can return 400 with stderr', async () => {
    const error = new Error(
      'yt-dlp: error: invalid default output template "%(title)Z": unsupported format character'
    );
    ytDlpRunner.run.mockRejectedValueOnce(error).mockRejectedValueOnce(error);

    await expect(filenamePreview.previewTemplate('%(title)Z')).rejects.toThrow(
      /unsupported format character/
    );
  });
});

describe('validateTemplate', () => {
  test('returns ok=true for a template yt-dlp accepts', async () => {
    ytDlpRunner.run.mockResolvedValueOnce('a [id].mp4').mockResolvedValueOnce('a - id');

    const result = await filenamePreview.validateTemplate('%(title).76B');

    expect(result).toEqual({ ok: true });
  });

  test('returns ok=false and the yt-dlp stderr message when yt-dlp rejects', async () => {
    const error = new Error(
      'yt-dlp: error: invalid default output template "%(title)Z": unsupported format character \'Z\' (0x5a) at index 8'
    );
    ytDlpRunner.run.mockRejectedValueOnce(error).mockRejectedValueOnce(error);

    const result = await filenamePreview.validateTemplate('%(title)Z');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unsupported format character/);
  });

  test('does not throw when yt-dlp times out', async () => {
    const timeoutError = new Error('yt-dlp process timed out after 5000ms');
    timeoutError.code = 'YTDLP_TIMEOUT';
    ytDlpRunner.run
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    const result = await filenamePreview.validateTemplate('%(title).76B');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timed out/);
  });
});
