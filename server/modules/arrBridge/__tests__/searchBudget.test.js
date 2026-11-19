const { createSearchBudget, ARR_BRIDGE_DAILY_API_UNITS } = require('../searchBudget');

describe('searchBudget', () => {
  let clock;
  let logger;
  const make = (options = {}) => createSearchBudget({ now: () => new Date(clock), logger, ...options });

  beforeEach(() => {
    // 18:00 UTC in winter is 10:00 Pacific on 2026-01-15.
    clock = '2026-01-15T18:00:00.000Z';
    logger = { info: jest.fn() };
  });

  test('the share is 5000 units', () => {
    expect(ARR_BRIDGE_DAILY_API_UNITS).toBe(5000);
  });

  test('allows the API while under the share', () => {
    const budget = make();
    budget.spend(4999);
    expect(budget.allowsApi()).toBe(true);
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('stops allowing the API at the share and logs once', () => {
    const budget = make();
    budget.spend(4999);
    budget.spend(1);
    expect(budget.allowsApi()).toBe(false);
    budget.spend(100);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      { spentUnits: 5000, dailyUnits: 5000 },
      'Sonarr/Radarr searches used their share of today\'s YouTube API quota; using yt-dlp until it resets'
    );
  });

  test('the search that crosses the line still ran on the API', () => {
    const budget = make();
    budget.spend(4900);
    expect(budget.allowsApi()).toBe(true);
    budget.spend(201);
    expect(budget.allowsApi()).toBe(false);
  });

  test('starts again at zero on the next Pacific day', () => {
    const budget = make();
    budget.spend(5000);
    expect(budget.allowsApi()).toBe(false);
    // 07:59 UTC is still 23:59 Pacific on the 15th.
    clock = '2026-01-16T07:59:00.000Z';
    expect(budget.allowsApi()).toBe(false);
    // 08:00 UTC is midnight Pacific.
    clock = '2026-01-16T08:00:00.000Z';
    expect(budget.allowsApi()).toBe(true);
    budget.spend(5000);
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  test('a new instance starts at zero', () => {
    make().spend(5000);
    expect(make().allowsApi()).toBe(true);
  });

  test('ignores anything but a positive finite number', () => {
    const budget = make({ dailyUnits: 10 });
    [0, -5, NaN, Infinity, '100', null, undefined, {}].forEach((value) => budget.spend(value));
    expect(budget.allowsApi()).toBe(true);
  });

  test('works without a logger', () => {
    const budget = createSearchBudget({ now: () => new Date(clock), dailyUnits: 1 });
    expect(() => budget.spend(1)).not.toThrow();
  });
});
