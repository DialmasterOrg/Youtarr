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
});
