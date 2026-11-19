const { isAtLeast, isLaterWatch } = require('../watchStateCompare');

describe('watchStateCompare', () => {
  describe('isAtLeast', () => {
    it('needs played for a played snapshot', () => {
      expect(isAtLeast({ played: true }, { played: true })).toBe(true);
      expect(isAtLeast({ played: false, positionMs: 999999 }, { played: true })).toBe(false);
    });

    it('accepts played or a resume position no earlier than an in-progress snapshot', () => {
      expect(isAtLeast({ played: true }, { played: false, positionMs: 60000 })).toBe(true);
      expect(isAtLeast({ played: false, positionMs: 60000 }, { played: false, positionMs: 60000 })).toBe(true);
      expect(isAtLeast({ played: false, positionMs: 59000 }, { played: false, positionMs: 60000 })).toBe(false);
    });
  });

  describe('isLaterWatch', () => {
    it('counts finishing a video the snapshot had in progress', () => {
      expect(isLaterWatch({ played: true, lastWatchedAt: null }, { played: false, positionMs: 1000, lastWatchedAt: null })).toBe(true);
    });

    it('counts a last-watched time more than a second after the snapshot\'s', () => {
      const snapshot = { played: true, lastWatchedAt: '2026-10-01T00:00:00.000Z' };
      expect(isLaterWatch({ played: true, lastWatchedAt: new Date('2026-10-01T00:00:00.500Z') }, snapshot)).toBe(false);
      expect(isLaterWatch({ played: true, lastWatchedAt: new Date('2026-10-01T00:00:02Z') }, snapshot)).toBe(true);
    });

    it('cannot tell without both times', () => {
      expect(isLaterWatch({ played: true, lastWatchedAt: null }, { played: true, lastWatchedAt: '2026-10-01T00:00:00Z' })).toBe(false);
      expect(isLaterWatch({ played: true, lastWatchedAt: new Date() }, { played: true, lastWatchedAt: null })).toBe(false);
    });
  });
});
