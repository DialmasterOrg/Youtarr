import { renderHook, waitFor, act } from '@testing-library/react';
import { useChangelog } from '../useChangelog';
import { locationUtils } from 'src/utils/location';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Track a counter to ensure each test gets a unique "now" time
// This ensures the cache from previous tests is always expired
let testCounter = 0;

describe('useChangelog', () => {
  const mockChangelogContent = '# Changelog\n\n## [1.0.0]\n- Initial release';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Each test starts 1 hour after the previous one to ensure cache expiration
    testCounter++;
    jest.setSystemTime(new Date(2024, 0, 1, testCounter, 0, 0));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('fetches and returns changelog content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(mockChangelogContent),
    });

    const { result } = renderHook(() => useChangelog());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.content).toBe(mockChangelogContent);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/DialmasterOrg/Youtarr/main/CHANGELOG.md'
    );
  });

  test('handles fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useChangelog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.content).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  test('uses cached content within cache duration', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(mockChangelogContent),
    });

    const { result: result1, unmount } = renderHook(() => useChangelog());

    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    unmount();

    // Advance time but stay within cache duration (< 5 minutes)
    jest.advanceTimersByTime(2 * 60 * 1000);

    const { result: result2 } = renderHook(() => useChangelog());

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });

    // Should use cache, not fetch again
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result2.current.content).toBe(mockChangelogContent);
  });

  test('refetch bypasses cache', async () => {
    const updatedContent = '# Updated Changelog';

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockChangelogContent),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(updatedContent),
      });

    const { result } = renderHook(() => useChangelog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.content).toBe(mockChangelogContent);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.content).toBe(updatedContent);
  });

  test('mocks window.location with a custom URL', () => {
    const mockLocation = setMockLocation('http://localhost/test?query=1');

    expect(locationUtils.getHref()).toBe('http://localhost/test?query=1');
    expect(locationUtils.getSearch()).toBe('?query=1');

    locationUtils.assign('http://localhost/next');
    expect(mockLocation.assign).toHaveBeenCalledWith('http://localhost/next');

    locationUtils.reload();
    expect(mockLocation.reload).toHaveBeenCalled();
  });
});
