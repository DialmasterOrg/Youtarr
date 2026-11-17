/* eslint-env jest */
const {
  createVideoResolution,
  tierOfPixels,
  LOOKUP_BUDGET_MS,
  CACHE_TTL_MS,
  PAUSE_MS,
  MAX_PROBES_PER_LOOKUP,
  MAX_PROBES_PER_HOUR,
} = require('../videoResolution');

const AT_1080 = { ceiling: 1080 };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const candidate = (youtubeId, definition) => (definition === undefined ? { youtubeId } : { youtubeId, definition });
const manyIds = (count) => Array.from({ length: count }, (_, index) => `vid${String(index).padStart(8, '0')}`);

function setup({ library = new Map(), probe = jest.fn().mockResolvedValue(1080), libraryResolutions } = {}) {
  let clock = Date.parse('2026-11-16T00:00:00.000Z');
  const logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  const deps = {
    libraryResolutions: libraryResolutions
      ?? jest.fn(async (ids) => new Map([...library].filter(([id]) => ids.includes(id)))),
    probe,
    logger,
    now: () => clock,
  };
  return {
    resolution: createVideoResolution(deps),
    deps,
    logger,
    advance: (ms) => {
      clock += ms;
    },
  };
}

describe('videoResolution', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('tierOfPixels', () => {
    test.each([
      [3840, 2160, 2160],
      [3200, 1600, 2160],
      [2560, 2100, 2160],
      [1920, 1080, 1080],
      [1920, 960, 1080],
      [608, 1080, 1080],
      [1280, 720, 720],
      [1200, 500, 720],
      [1024, 576, 480],
      [854, 480, 480],
      [640, 360, 480],
    ])('%p x %p reads as %p', (width, height, tier) => {
      expect(tierOfPixels(width, height)).toBe(tier);
    });
  });

  describe('sources', () => {
    test('a library file settles the resolution without a probe', async () => {
      const { resolution, deps } = setup({ library: new Map([['a', 720]]) });

      const tiers = await resolution.lookup([candidate('a')], AT_1080);

      expect(tiers).toEqual(new Map([['a', 720]]));
      expect(deps.libraryResolutions).toHaveBeenCalledWith(['a']);
      expect(deps.probe).not.toHaveBeenCalled();
    });

    test('an sd definition is 480 without a probe', async () => {
      const { resolution, deps } = setup();

      const tiers = await resolution.lookup([candidate('a', 'sd')], AT_1080);

      expect(tiers).toEqual(new Map([['a', 480]]));
      expect(deps.probe).not.toHaveBeenCalled();
    });

    test('an hd definition settles a ceiling of 720 without a probe', async () => {
      const { resolution, deps } = setup();

      const tiers = await resolution.lookup([candidate('a', 'hd')], { ceiling: 720 });

      expect(tiers).toEqual(new Map([['a', 720]]));
      expect(deps.probe).not.toHaveBeenCalled();
    });

    test('a ceiling of 480 answers at once without reading the library or probing', async () => {
      const { resolution, deps, logger } = setup();

      const tiers = await resolution.lookup([candidate('a'), candidate('b', 'hd')], { ceiling: 480 });

      expect(tiers).toEqual(new Map());
      expect(deps.libraryResolutions).not.toHaveBeenCalled();
      expect(deps.probe).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    test('an hd definition is probed when the ceiling is 1080', async () => {
      const { resolution, deps } = setup();

      const tiers = await resolution.lookup([candidate('a', 'hd')], AT_1080);

      expect(deps.probe).toHaveBeenCalledWith('a');
      expect(tiers).toEqual(new Map([['a', 1080]]));
    });

    test('the library file wins over the definition', async () => {
      const { resolution } = setup({ library: new Map([['a', 1080]]) });

      const tiers = await resolution.lookup([candidate('a', 'sd')], AT_1080);

      expect(tiers).toEqual(new Map([['a', 1080]]));
    });

    test('a probed resolution is reused for 6 hours, then probed again', async () => {
      const { resolution, deps, advance } = setup();

      await resolution.lookup([candidate('a')], AT_1080);
      advance(CACHE_TTL_MS - 1);
      const again = await resolution.lookup([candidate('a')], AT_1080);

      expect(again).toEqual(new Map([['a', 1080]]));
      expect(deps.probe).toHaveBeenCalledTimes(1);

      advance(2);
      await resolution.lookup([candidate('a')], AT_1080);

      expect(deps.probe).toHaveBeenCalledTimes(2);
    });

    test('a library read that fails is logged and treated as no library data', async () => {
      const failure = new Error('database gone');
      const { resolution, deps, logger } = setup({ libraryResolutions: jest.fn().mockRejectedValue(failure) });

      const tiers = await resolution.lookup([candidate('a', 'sd'), candidate('b')], AT_1080);

      expect(tiers).toEqual(new Map([['a', 480], ['b', 1080]]));
      expect(deps.probe).toHaveBeenCalledWith('b');
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ err: failure }), expect.any(String));
    });

    test('an empty candidate list asks nothing', async () => {
      const { resolution, deps } = setup();

      expect(await resolution.lookup([], AT_1080)).toEqual(new Map());
      expect(deps.libraryResolutions).not.toHaveBeenCalled();
    });
  });

  describe('probe limits', () => {
    test('never runs more than 2 probes at a time', async () => {
      let active = 0;
      let mostActive = 0;
      const probe = jest.fn(async () => {
        active += 1;
        mostActive = Math.max(mostActive, active);
        await flush();
        active -= 1;
        return 720;
      });
      const { resolution } = setup({ probe });

      const tiers = await resolution.lookup(manyIds(5).map((id) => candidate(id)), AT_1080);

      expect(probe).toHaveBeenCalledTimes(5);
      expect(tiers.size).toBe(5);
      expect(mostActive).toBe(2);
    });

    test('two lookups at once still share 2 probes', async () => {
      let active = 0;
      let mostActive = 0;
      const probe = jest.fn(async () => {
        active += 1;
        mostActive = Math.max(mostActive, active);
        await flush();
        active -= 1;
        return 720;
      });
      const { resolution } = setup({ probe });
      const ids = manyIds(6);

      const [first, second] = await Promise.all([
        resolution.lookup(ids.slice(0, 3).map((id) => candidate(id)), AT_1080),
        resolution.lookup(ids.slice(3).map((id) => candidate(id)), AT_1080),
      ]);

      expect(first.size + second.size).toBe(6);
      expect(mostActive).toBe(2);
    });

    test('two lookups that wait for slots for the same videos probe each video once', async () => {
      const probe = jest.fn(async () => {
        await flush();
        return 720;
      });
      const { resolution } = setup({ probe });
      const ids = manyIds(4);
      const candidates = ids.map((id) => candidate(id));

      const [first, second] = await Promise.all([
        resolution.lookup(candidates, AT_1080),
        resolution.lookup(candidates, AT_1080),
      ]);

      expect(probe).toHaveBeenCalledTimes(4);
      expect(first).toEqual(new Map(ids.map((id) => [id, 720])));
      expect(second).toEqual(first);
    });

    test('a video two lookups ask for at once is probed once', async () => {
      const { resolution, deps } = setup();

      const [first, second] = await Promise.all([
        resolution.lookup([candidate('a')], AT_1080),
        resolution.lookup([candidate('a')], AT_1080),
      ]);

      expect(deps.probe).toHaveBeenCalledTimes(1);
      expect(first).toEqual(new Map([['a', 1080]]));
      expect(second).toEqual(new Map([['a', 1080]]));
    });

    test('probes at most 10 videos per lookup, leaving the 11th out', async () => {
      const { resolution, deps } = setup();
      const ids = manyIds(11);

      const tiers = await resolution.lookup(ids.map((id) => candidate(id)), AT_1080);

      expect(deps.probe).toHaveBeenCalledTimes(10);
      expect(tiers.size).toBe(10);
      expect(tiers.has(ids[10])).toBe(false);
    });

    test('a probe that never answers does not hold the lookup past its budget', async () => {
      jest.useFakeTimers();
      const probe = jest.fn((id) => (id === 'stuck' ? new Promise(() => {}) : Promise.resolve(720)));
      const { resolution } = setup({ probe });
      let tiers = null;

      resolution.lookup([candidate('stuck'), candidate('quick')], AT_1080).then((value) => {
        tiers = value;
      });
      await jest.advanceTimersByTimeAsync(LOOKUP_BUDGET_MS - 1);
      expect(tiers).toBeNull();
      await jest.advanceTimersByTimeAsync(1);

      expect(tiers).toEqual(new Map([['quick', 720]]));
      expect(jest.getTimerCount()).toBe(0);
    });

    test('a lookup given a shorter budget answers when that budget ends', async () => {
      jest.useFakeTimers();
      const probe = jest.fn(() => new Promise(() => {}));
      const { resolution } = setup({ probe });
      let tiers = null;

      resolution.lookup([candidate('a', 'sd'), candidate('stuck')], { ceiling: 1080, budgetMs: 5000 }).then((value) => {
        tiers = value;
      });
      await jest.advanceTimersByTimeAsync(4999);
      expect(tiers).toBeNull();
      await jest.advanceTimersByTimeAsync(1);

      expect(tiers).toEqual(new Map([['a', 480]]));
      expect(jest.getTimerCount()).toBe(0);
    });

    test('a probe waiting for a free slot is dropped when its lookup runs out of time', async () => {
      jest.useFakeTimers();
      const probe = jest.fn(() => new Promise(() => {}));
      const { resolution } = setup({ probe });

      const first = resolution.lookup([candidate('a'), candidate('b')], AT_1080);
      const second = resolution.lookup([candidate('c')], AT_1080);
      await jest.advanceTimersByTimeAsync(LOOKUP_BUDGET_MS);

      expect(await first).toEqual(new Map());
      expect(await second).toEqual(new Map());
      expect(probe.mock.calls).toEqual([['a'], ['b']]);
    });

    test('a lookup that answers early leaves no timer behind', async () => {
      jest.useFakeTimers();
      const { resolution } = setup();

      await resolution.lookup([candidate('a')], AT_1080);

      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('probes without an answer', () => {
    test.each([
      ['rejects', () => Promise.reject(new Error('Sign in to confirm you are not a bot'))],
      ['finds nothing', () => Promise.resolve(null)],
    ])('a probe that %s is left out and asked again next time', async (_label, answer) => {
      const probe = jest.fn(answer);
      const { resolution } = setup({ probe });

      expect(await resolution.lookup([candidate('a')], AT_1080)).toEqual(new Map());
      await resolution.lookup([candidate('a')], AT_1080);

      expect(probe).toHaveBeenCalledTimes(2);
    });

    test('after 3 in a row no probe starts for 15 minutes', async () => {
      const probe = jest.fn().mockResolvedValue(null);
      const { resolution, advance, logger } = setup({ probe });

      await resolution.lookup([candidate('a'), candidate('b'), candidate('c')], AT_1080);
      await resolution.lookup([candidate('d')], AT_1080);
      expect(probe).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(1);

      advance(PAUSE_MS - 1);
      await resolution.lookup([candidate('d')], AT_1080);
      expect(probe).toHaveBeenCalledTimes(3);

      advance(1);
      await resolution.lookup([candidate('d')], AT_1080);
      expect(probe).toHaveBeenCalledTimes(4);
    });

    test('an answer in between starts the count again', async () => {
      const probe = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(1080)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(720);
      const { resolution } = setup({ probe });

      for (const id of ['a', 'b', 'c', 'd']) {
        // eslint-disable-next-line no-await-in-loop
        await resolution.lookup([candidate(id)], AT_1080);
      }
      const tiers = await resolution.lookup([candidate('e')], AT_1080);

      expect(tiers).toEqual(new Map([['e', 720]]));
    });
  });

  describe('hourly cap', () => {
    const HOUR_MS = 60 * 60 * 1000;
    const startProbes = async (resolution, ids) => {
      for (let index = 0; index < ids.length; index += MAX_PROBES_PER_LOOKUP) {
        // eslint-disable-next-line no-await-in-loop
        await resolution.lookup(ids.slice(index, index + MAX_PROBES_PER_LOOKUP).map((id) => candidate(id)), AT_1080);
      }
    };

    test('after 100 probes in an hour a new unknown video is not probed and is left out', async () => {
      const { resolution, deps } = setup();
      await startProbes(resolution, manyIds(MAX_PROBES_PER_HOUR));
      expect(deps.probe).toHaveBeenCalledTimes(MAX_PROBES_PER_HOUR);

      const tiers = await resolution.lookup([candidate('fresh')], AT_1080);

      expect(deps.probe).toHaveBeenCalledTimes(MAX_PROBES_PER_HOUR);
      expect(tiers).toEqual(new Map());
    });

    test('a video left out for the cap is not cached and is probed once the hour has passed', async () => {
      const { resolution, deps, advance } = setup();
      await startProbes(resolution, manyIds(MAX_PROBES_PER_HOUR));
      await resolution.lookup([candidate('fresh')], AT_1080);

      advance(HOUR_MS - 1);
      expect(await resolution.lookup([candidate('fresh')], AT_1080)).toEqual(new Map());
      advance(1);
      const tiers = await resolution.lookup([candidate('fresh')], AT_1080);

      expect(deps.probe).toHaveBeenCalledTimes(MAX_PROBES_PER_HOUR + 1);
      expect(tiers).toEqual(new Map([['fresh', 1080]]));
    });

    test('videos known without a probe are still answered at the cap', async () => {
      const { resolution } = setup({ library: new Map([['known', 720]]) });
      await startProbes(resolution, manyIds(MAX_PROBES_PER_HOUR));

      const tiers = await resolution.lookup([candidate('known'), candidate('sd', 'sd')], AT_1080);

      expect(tiers).toEqual(new Map([['known', 720], ['sd', 480]]));
    });

    test('skipped probes neither pause the probes nor count as failures', async () => {
      const { resolution, deps, advance, logger } = setup();
      await startProbes(resolution, manyIds(MAX_PROBES_PER_HOUR - 1));
      advance(HOUR_MS / 2);
      await startProbes(resolution, ['last']);
      advance(HOUR_MS / 3);

      await resolution.lookup(['s1', 's2', 's3', 's4'].map((id) => candidate(id)), AT_1080);
      expect(deps.probe).toHaveBeenCalledTimes(MAX_PROBES_PER_HOUR);
      expect(logger.warn).not.toHaveBeenCalled();

      // The first 99 starts are an hour old now; a pause would last until 15 minutes after the skips.
      advance(HOUR_MS / 6);
      const tiers = await resolution.lookup([candidate('s1')], AT_1080);

      expect(tiers).toEqual(new Map([['s1', 1080]]));
    });

    test('the lookup line counts the probes skipped for the cap', async () => {
      const { resolution, logger } = setup();
      await startProbes(resolution, manyIds(MAX_PROBES_PER_HOUR));
      logger.info.mockClear();

      await resolution.lookup([candidate('s1'), candidate('s2')], AT_1080);

      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        { probed: 0, known: 0, unknown: 2, skippedForHourlyCap: 2 },
        expect.any(String)
      );
    });
  });

  describe('logging', () => {
    test('logs one line of counts for a lookup that probed', async () => {
      const probe = jest.fn((id) => Promise.resolve(id === 'b' ? 1080 : null));
      const { resolution, logger } = setup({ library: new Map([['a', 720]]), probe });

      await resolution.lookup([candidate('a'), candidate('b'), candidate('c')], AT_1080);

      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith({ probed: 2, known: 2, unknown: 1 }, expect.any(String));
    });

    test('logs nothing for a lookup that probed nothing', async () => {
      const { resolution, logger } = setup({ library: new Map([['a', 720]]) });

      await resolution.lookup([candidate('a'), candidate('b', 'sd')], AT_1080);

      expect(logger.info).not.toHaveBeenCalled();
    });
  });
});
