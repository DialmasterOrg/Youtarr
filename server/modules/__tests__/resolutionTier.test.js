/* eslint-env jest */

jest.mock('child_process', () => ({ execFile: jest.fn() }));
jest.mock('../../logger');

const { execFile } = require('child_process');
const { parseTierFromFormatNote, probeVideoDimensions, selectionTierForHeight } = require('../resolutionTier');

describe('resolutionTier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseTierFromFormatNote', () => {
    test('parses plain tier strings', () => {
      expect(parseTierFromFormatNote('1080p')).toBe(1080);
      expect(parseTierFromFormatNote('720p')).toBe(720);
    });

    test('parses tier with fps or codec suffixes', () => {
      expect(parseTierFromFormatNote('1080p60')).toBe(1080);
      expect(parseTierFromFormatNote('1080p+medium')).toBe(1080);
    });

    test('returns null for missing or unparseable values', () => {
      expect(parseTierFromFormatNote(null)).toBeNull();
      expect(parseTierFromFormatNote(undefined)).toBeNull();
      expect(parseTierFromFormatNote('medium')).toBeNull();
      expect(parseTierFromFormatNote(1080)).toBeNull();
    });
  });

  describe('selectionTierForHeight', () => {
    test('returns the height itself when it sits on a ladder rung', () => {
      expect(selectionTierForHeight(1080)).toBe(1080);
      expect(selectionTierForHeight(2160)).toBe(2160);
    });

    test('rounds off-ladder heights up to the next rung', () => {
      expect(selectionTierForHeight(256)).toBe(360);
      expect(selectionTierForHeight(640)).toBe(720);
      expect(selectionTierForHeight(854)).toBe(1080);
      expect(selectionTierForHeight(1280)).toBe(1440);
      expect(selectionTierForHeight(1920)).toBe(2160);
      expect(selectionTierForHeight(3840)).toBe(4320);
    });

    test('clamps heights above the ladder to the top rung', () => {
      expect(selectionTierForHeight(5000)).toBe(4320);
    });

    test('returns null for missing or non-positive values', () => {
      expect(selectionTierForHeight(null)).toBeNull();
      expect(selectionTierForHeight(undefined)).toBeNull();
      expect(selectionTierForHeight(0)).toBeNull();
    });
  });

  describe('probeVideoDimensions', () => {
    test('probes the file with ffprobe and returns the raw dimensions', async () => {
      execFile.mockImplementation((file, args, opts, cb) => cb(null, '1920,1080\n'));

      await expect(probeVideoDimensions('/data/video.mp4')).resolves.toBe('1920x1080');

      expect(execFile).toHaveBeenCalledWith(
        'ffprobe',
        expect.arrayContaining(['-select_streams', 'v:0', '/data/video.mp4']),
        expect.objectContaining({ timeout: expect.any(Number) }),
        expect.any(Function)
      );
    });

    test('returns vertical dimensions as-is without interpretation', async () => {
      execFile.mockImplementation((file, args, opts, cb) => cb(null, '608,1080\n'));

      await expect(probeVideoDimensions('/data/short.mp4')).resolves.toBe('608x1080');
    });

    test('resolves null when ffprobe fails', async () => {
      execFile.mockImplementation((file, args, opts, cb) => cb(new Error('boom')));

      await expect(probeVideoDimensions('/data/video.mp4')).resolves.toBeNull();
    });

    test('resolves null on unusable ffprobe output', async () => {
      execFile.mockImplementation((file, args, opts, cb) => cb(null, '\n'));

      await expect(probeVideoDimensions('/data/video.mp4')).resolves.toBeNull();
    });

    test('resolves null on zero dimensions', async () => {
      execFile.mockImplementation((file, args, opts, cb) => cb(null, '0,0\n'));

      await expect(probeVideoDimensions('/data/video.mp4')).resolves.toBeNull();
    });
  });
});
