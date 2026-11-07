import { renderHook, act } from '@testing-library/react';
import { usePersistedChipFilter } from '../usePersistedChipFilter';

const STORAGE_KEY = 'youtarr.test.deletedFilter';

describe('usePersistedChipFilter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns the default when nothing is stored', () => {
    const { result } = renderHook(() => usePersistedChipFilter(STORAGE_KEY, 'exclude'));
    expect(result.current[0]).toBe('exclude');
  });

  test('returns a stored mode', () => {
    localStorage.setItem(STORAGE_KEY, 'only');
    const { result } = renderHook(() => usePersistedChipFilter(STORAGE_KEY, 'exclude'));
    expect(result.current[0]).toBe('only');
  });

  test.each(['', 'bogus', 'ONLY', '1'])('falls back to the default for the stored value "%s"', (bad) => {
    localStorage.setItem(STORAGE_KEY, bad);
    const { result } = renderHook(() => usePersistedChipFilter(STORAGE_KEY, 'exclude'));
    expect(result.current[0]).toBe('exclude');
  });

  test('remembers a change in storage and in state', () => {
    const { result } = renderHook(() => usePersistedChipFilter(STORAGE_KEY, 'exclude'));
    act(() => result.current[1]('off'));
    expect(result.current[0]).toBe('off');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('off');
  });

  test('keeps working in memory when storage throws', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => usePersistedChipFilter(STORAGE_KEY, 'exclude'));
    act(() => result.current[1]('only'));
    expect(result.current[0]).toBe('only');
    setItem.mockRestore();
  });
});
