// Title patterns run through the real Python script, like titleFilterRegex's
// own tests: playlist filters must match exactly what channel filters match.
jest.mock('../../logger', () => ({ warn: jest.fn() }));
const playlistFilters = require('../playlistFilters');
const logger = require('../../logger');

const NO_FILTERS = { min_duration: null, max_duration: null, title_filter_regex: null };
const TEN_MINUTES = 600;
const row = (youtube_id, title, duration = TEN_MINUTES) => ({ youtube_id, title, duration });
const filteredIds = async (settings, rows) =>
  [...(await playlistFilters.findFilteredIds({ ...NO_FILTERS, ...settings }, rows)).filteredIds];

describe('playlistFilters', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('hasFilters', () => {
    test('is false when no filter is set', () => {
      expect(playlistFilters.hasFilters(NO_FILTERS)).toBe(false);
    });

    test('is false for a blank title pattern', () => {
      expect(playlistFilters.hasFilters({ ...NO_FILTERS, title_filter_regex: '   ' })).toBe(false);
    });

    test.each([
      { title_filter_regex: 'Episode' },
      { min_duration: 0 },
      { max_duration: 600 },
    ])('is true for %j', (settings) => {
      expect(playlistFilters.hasFilters({ ...NO_FILTERS, ...settings })).toBe(true);
    });
  });

  describe('findFilteredIds', () => {
    test('filters nothing when the playlist has no filters', async () => {
      expect(await filteredIds({}, [row('a', 'Anything', null)])).toEqual([]);
    });

    test('filters videos whose title does not match the pattern', async () => {
      const rows = [row('ep', 'Episode 12'), row('trailer', 'Trailer')];
      expect(await filteredIds({ title_filter_regex: 'Episode \\d+' }, rows)).toEqual(['trailer']);
    });

    test('matches case-sensitively, as channel title filters do', async () => {
      expect(await filteredIds({ title_filter_regex: 'review' }, [row('a', 'Full Review')])).toEqual(['a']);
    });

    test('honors an inline case-insensitive flag', async () => {
      expect(await filteredIds({ title_filter_regex: '(?i)review' }, [row('a', 'Full Review')])).toEqual([]);
    });

    test('treats a missing title as an empty one', async () => {
      expect(await filteredIds({ title_filter_regex: 'Episode' }, [row('a', null)])).toEqual(['a']);
    });

    test('filters videos shorter than the minimum duration', async () => {
      const rows = [row('short', 'Clip', 299), row('exact', 'Exact', 300)];
      expect(await filteredIds({ min_duration: 300 }, rows)).toEqual(['short']);
    });

    // Exact seconds: a maximum saved through the API before the settings dialog
    // existed must keep meaning what it meant. The dialog adds the rest of the
    // final minute itself when it saves a whole-minute maximum.
    test('treats the maximum as an exact number of seconds', async () => {
      const rows = [row('exact', 'Exact', 600), row('over', 'Over', 601)];
      expect(await filteredIds({ max_duration: TEN_MINUTES }, rows)).toEqual(['over']);
    });

    test.each([{ min_duration: 60 }, { max_duration: 600 }])(
      'filters a video of unknown duration while %j is set',
      async (settings) => {
        expect(await filteredIds(settings, [row('a', 'Unknown length', null)])).toEqual(['a']);
      }
    );

    test('does not filter an unknown duration when only a title filter is set', async () => {
      expect(await filteredIds({ title_filter_regex: 'Episode' }, [row('a', 'Episode 1', null)])).toEqual([]);
    });

    test('filters a video that fails any one of the filters', async () => {
      const rows = [row('both', 'Episode 1', 600), row('short', 'Episode 2', 30), row('title', 'Trailer', 600)];
      expect(await filteredIds({ title_filter_regex: 'Episode', min_duration: 60 }, rows)).toEqual(['short', 'title']);
    });

    test('reports no error when the filters could be evaluated', async () => {
      const result = await playlistFilters.findFilteredIds({ ...NO_FILTERS, title_filter_regex: 'Episode' }, [row('a', 'Episode 1')]);
      expect(result.error).toBeNull();
    });

    describe('with a pattern that cannot be evaluated', () => {
      const broken = { ...NO_FILTERS, title_filter_regex: '[unclosed' };
      const rows = [row('a', 'Episode 1'), row('b', 'Trailer')];

      test('holds every video rather than letting them all download', async () => {
        const result = await playlistFilters.findFilteredIds(broken, rows);
        expect([...result.filteredIds]).toEqual(['a', 'b']);
      });

      test('reports why', async () => {
        const result = await playlistFilters.findFilteredIds(broken, rows);
        expect(result.error).toMatch(/Invalid regex pattern/);
      });

      test('logs the failure with the playlist id', async () => {
        await playlistFilters.findFilteredIds({ ...broken, playlist_id: 'PL1' }, rows);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ playlist_id: 'PL1' }),
          expect.any(String)
        );
      });
    });
  });
});
