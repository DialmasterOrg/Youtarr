import { parseResolution, tierFromDimensions, resolutionTierLabel } from '../videoResolution';

describe('videoResolution', () => {
  describe('parseResolution', () => {
    it('parses a WIDTHxHEIGHT string', () => {
      expect(parseResolution('1920x1080')).toEqual({ width: 1920, height: 1080 });
      expect(parseResolution('608x1080')).toEqual({ width: 608, height: 1080 });
    });

    it('returns null for the probe-failed sentinel', () => {
      expect(parseResolution('0x0')).toBeNull();
    });

    it('returns null for missing or malformed values', () => {
      expect(parseResolution(null)).toBeNull();
      expect(parseResolution(undefined)).toBeNull();
      expect(parseResolution('')).toBeNull();
      expect(parseResolution('1080p')).toBeNull();
      expect(parseResolution('1920x')).toBeNull();
    });
  });

  describe('tierFromDimensions', () => {
    it('maps standard 16:9 dimensions to the height', () => {
      expect(tierFromDimensions(1920, 1080)).toBe(1080);
      expect(tierFromDimensions(1280, 720)).toBe(720);
      expect(tierFromDimensions(3840, 2160)).toBe(2160);
    });

    it('maps wider-than-16:9 (cinemascope) by the long edge', () => {
      expect(tierFromDimensions(1920, 816)).toBe(1080);
      expect(tierFromDimensions(2560, 1072)).toBe(1440);
      expect(tierFromDimensions(3840, 1608)).toBe(2160);
    });

    it('maps 4:3 videos by the height', () => {
      expect(tierFromDimensions(640, 480)).toBe(480);
      expect(tierFromDimensions(1440, 1080)).toBe(1080);
    });

    it('maps vertical videos to their selection class (smallest rung >= height)', () => {
      // A height cap of N downloads the tallest encode with height <= N, so
      // ceiling the height back onto the ladder recovers the selected value.
      expect(tierFromDimensions(1080, 1920)).toBe(2160);
      expect(tierFromDimensions(608, 1080)).toBe(1080);
      expect(tierFromDimensions(360, 640)).toBe(720);
      expect(tierFromDimensions(240, 426)).toBe(480);
      expect(tierFromDimensions(144, 256)).toBe(360);
      expect(tierFromDimensions(720, 1280)).toBe(1440);
    });

    it('absorbs encoder rounding without changing the rung', () => {
      expect(tierFromDimensions(854, 480)).toBe(480);
      expect(tierFromDimensions(1918, 1080)).toBe(1080);
      // Mod-16 shaved cinemascope: computes to 1071, rounds up to 1080.
      expect(tierFromDimensions(1904, 816)).toBe(1080);
    });

    it('falls back to snapping the height when width is missing', () => {
      expect(tierFromDimensions(null, 720)).toBe(720);
      expect(tierFromDimensions(undefined, 1080)).toBe(1080);
    });

    it('returns null when nothing usable is present', () => {
      expect(tierFromDimensions(null, null)).toBeNull();
      expect(tierFromDimensions(0, 0)).toBeNull();
    });
  });

  describe('resolutionTierLabel', () => {
    it('labels stored dimension strings', () => {
      expect(resolutionTierLabel('1920x1080')).toBe('1080p');
      expect(resolutionTierLabel('608x1080')).toBe('1080p');
      expect(resolutionTierLabel('1080x1920')).toBe('2160p');
      expect(resolutionTierLabel('1920x816')).toBe('1080p');
    });

    it('returns null for the sentinel and missing values', () => {
      expect(resolutionTierLabel('0x0')).toBeNull();
      expect(resolutionTierLabel(null)).toBeNull();
      expect(resolutionTierLabel(undefined)).toBeNull();
    });
  });
});
