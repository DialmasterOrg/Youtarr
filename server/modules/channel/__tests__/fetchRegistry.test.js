/* eslint-env jest */

describe('fetchRegistry', () => {
  let fetchRegistry;

  beforeEach(() => {
    jest.resetModules();
    fetchRegistry = require('../fetchRegistry');
  });

  test('reports not fetching when the map is empty', () => {
    expect(fetchRegistry.isFetchInProgress('UC123')).toEqual({ isFetching: false });
  });

  test('reports an in-progress fetch for a specific tab', () => {
    fetchRegistry.set('UC123:videos', { startTime: '2026-07-15T00:00:00Z', type: 'fetchAll' });
    expect(fetchRegistry.isFetchInProgress('UC123', 'videos')).toEqual({
      isFetching: true,
      startTime: '2026-07-15T00:00:00Z',
      type: 'fetchAll',
      tabType: 'videos',
    });
  });

  test('includes progress for a specific tab once the operation reports it', () => {
    fetchRegistry.set('UC123:videos', { startTime: '2026-07-15T00:00:00Z', type: 'fetchAll' });
    fetchRegistry.update('UC123:videos', { progress: { itemsFetched: 120, stage: 'listing' } });
    expect(fetchRegistry.isFetchInProgress('UC123', 'videos').progress).toEqual({
      itemsFetched: 120,
      stage: 'listing',
    });
  });

  test('update keeps the fields it does not replace', () => {
    fetchRegistry.set('UC123:videos', { startTime: '2026-07-15T00:00:00Z', type: 'fetchAll' });
    fetchRegistry.update('UC123:videos', { progress: { itemsFetched: 30, stage: 'listing' } });
    expect(fetchRegistry.get('UC123:videos').type).toBe('fetchAll');
  });

  test('update does not recreate an operation that has ended', () => {
    fetchRegistry.update('UC123:videos', { progress: { itemsFetched: 30, stage: 'listing' } });
    expect(fetchRegistry.has('UC123:videos')).toBe(false);
  });

  test('reports not fetching for a different tab of the same channel', () => {
    fetchRegistry.set('UC123:videos', { startTime: '2026-07-15T00:00:00Z', type: 'fetchAll' });
    expect(fetchRegistry.isFetchInProgress('UC123', 'shorts')).toEqual({ isFetching: false });
  });

  test('legacy any-tab check finds a fetch on any tab of the channel', () => {
    fetchRegistry.set('UC123:shorts', { startTime: '2026-07-15T00:00:00Z', type: 'autoRefresh' });
    const result = fetchRegistry.isFetchInProgress('UC123');
    expect(result.isFetching).toBe(true);
    expect(result.tabType).toBe('shorts');
  });

  test('delete clears the in-progress state', () => {
    fetchRegistry.set('UC123:videos', { startTime: 'x', type: 'fetchAll' });
    fetchRegistry.delete('UC123:videos');
    expect(fetchRegistry.isFetchInProgress('UC123')).toEqual({ isFetching: false });
  });

  describe('finished results', () => {
    const KEY = 'UC123:videos';
    const TWO_MINUTES_MS = 2 * 60 * 1000;

    afterEach(() => {
      jest.useRealTimers();
    });

    test('finish clears the in-flight record and keeps the result', () => {
      fetchRegistry.set(KEY, { startTime: 'x', type: 'autoRefresh' });
      fetchRegistry.finish(KEY, { type: 'autoRefresh', newVideos: 2, failed: false });

      expect(fetchRegistry.has(KEY)).toBe(false);
      expect(fetchRegistry.getLastResult(KEY)).toEqual({
        type: 'autoRefresh',
        newVideos: 2,
        failed: false,
        finishedAt: expect.any(String),
      });
    });

    test('isFetchInProgress reports the last result for the tab', () => {
      fetchRegistry.set(KEY, { startTime: 'x', type: 'autoRefresh' });
      fetchRegistry.finish(KEY, { type: 'autoRefresh', newVideos: 2, failed: false });

      expect(fetchRegistry.isFetchInProgress('UC123', 'videos')).toEqual({
        isFetching: false,
        lastResult: expect.objectContaining({ newVideos: 2 }),
      });
    });

    test('drops the result after two minutes', () => {
      jest.useFakeTimers();
      fetchRegistry.finish(KEY, { type: 'autoRefresh', newVideos: 2, failed: false });

      jest.advanceTimersByTime(TWO_MINUTES_MS + 1);

      expect(fetchRegistry.getLastResult(KEY)).toBeNull();
      expect(fetchRegistry.isFetchInProgress('UC123', 'videos')).toEqual({ isFetching: false });
    });

    test('keeps the result until two minutes have passed', () => {
      jest.useFakeTimers();
      fetchRegistry.finish(KEY, { type: 'autoRefresh', newVideos: 2, failed: false });

      jest.advanceTimersByTime(TWO_MINUTES_MS - 1000);

      expect(fetchRegistry.getLastResult(KEY)).toEqual(expect.objectContaining({ newVideos: 2 }));
    });

    test('delete leaves no result', () => {
      fetchRegistry.set(KEY, { startTime: 'x', type: 'fetchAll' });
      fetchRegistry.delete(KEY);

      expect(fetchRegistry.getLastResult(KEY)).toBeNull();
    });

    test('starting another fetch of the tab forgets the previous result', () => {
      fetchRegistry.finish(KEY, { type: 'autoRefresh', newVideos: 50, failed: false });
      fetchRegistry.set(KEY, { startTime: 'x', type: 'fetchAll' });
      fetchRegistry.delete(KEY);

      expect(fetchRegistry.isFetchInProgress('UC123', 'videos')).toEqual({ isFetching: false });
    });

    test('a result for one tab is not reported for another', () => {
      fetchRegistry.finish(KEY, { type: 'autoRefresh', newVideos: 2, failed: false });

      expect(fetchRegistry.isFetchInProgress('UC123', 'shorts')).toEqual({ isFetching: false });
    });
  });
});
