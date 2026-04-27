import { renderHook, act } from '@testing-library/react';
import { useListPageSize } from '../useListPageSize';

const STORAGE_KEY = 'youtarr.test.pageSize';

describe('useListPageSize', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns default 16 when localStorage is empty', () => {
    const { result } = renderHook(() => useListPageSize(STORAGE_KEY));
    expect(result.current[0]).toBe(16);
  });

  test('returns stored value when localStorage holds a valid page size', () => {
    localStorage.setItem(STORAGE_KEY, '32');
    const { result } = renderHook(() => useListPageSize(STORAGE_KEY));
    expect(result.current[0]).toBe(32);
  });

  test.each([8, 16, 32, 64, 128])('accepts valid page size %i', (size) => {
    localStorage.setItem(STORAGE_KEY, String(size));
    const { result } = renderHook(() => useListPageSize(STORAGE_KEY));
    expect(result.current[0]).toBe(size);
  });

  test.each(['foo', '7', '256', '', 'NaN', '0', '-1', '16.5'])(
    'returns default 16 for invalid localStorage value "%s"',
    (badValue) => {
      localStorage.setItem(STORAGE_KEY, badValue);
      const { result } = renderHook(() => useListPageSize(STORAGE_KEY));
      expect(result.current[0]).toBe(16);
    }
  );

  test('setPageSize writes to localStorage and updates state', () => {
    const { result } = renderHook(() => useListPageSize(STORAGE_KEY));
    expect(result.current[0]).toBe(16);

    act(() => {
      result.current[1](64);
    });

    expect(result.current[0]).toBe(64);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('64');
  });

  test('two hooks with different storage keys do not share state', () => {
    localStorage.setItem('youtarr.test.a', '32');
    localStorage.setItem('youtarr.test.b', '64');

    const { result: resultA } = renderHook(() => useListPageSize('youtarr.test.a'));
    const { result: resultB } = renderHook(() => useListPageSize('youtarr.test.b'));

    expect(resultA.current[0]).toBe(32);
    expect(resultB.current[0]).toBe(64);

    act(() => {
      resultA.current[1](8);
    });

    expect(resultA.current[0]).toBe(8);
    expect(localStorage.getItem('youtarr.test.a')).toBe('8');
    expect(localStorage.getItem('youtarr.test.b')).toBe('64');
  });

  test('handles localStorage.setItem throwing without crashing', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useListPageSize(STORAGE_KEY));

    act(() => {
      result.current[1](32);
    });

    expect(result.current[0]).toBe(32);

    setItemSpy.mockRestore();
  });

  test('handles localStorage.getItem throwing without crashing', () => {
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const { result } = renderHook(() => useListPageSize(STORAGE_KEY));
    expect(result.current[0]).toBe(16);

    getItemSpy.mockRestore();
  });
});
