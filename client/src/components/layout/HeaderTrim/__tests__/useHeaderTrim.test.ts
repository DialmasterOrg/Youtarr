import { renderHook } from '@testing-library/react';
import { resolveHeaderTrim, useHeaderTrim } from '../useHeaderTrim';

const resolveOn = (now: Date, overrides: { search?: string; language?: string } = {}) =>
  resolveHeaderTrim({ now, search: '', language: 'en-US', ...overrides });

describe('resolveHeaderTrim', () => {
  it('returns christmas from seven days before through the day itself', () => {
    expect(resolveOn(new Date(2026, 11, 18))).toBe('christmas');
    expect(resolveOn(new Date(2026, 11, 25, 23, 59))).toBe('christmas');
  });

  it('returns null just outside the christmas window', () => {
    expect(resolveOn(new Date(2026, 11, 17, 23, 59))).toBeNull();
    expect(resolveOn(new Date(2026, 11, 26))).toBeNull();
  });

  it('returns halloween from October 24 through October 31', () => {
    expect(resolveOn(new Date(2026, 9, 24))).toBe('halloween');
    expect(resolveOn(new Date(2026, 9, 31))).toBe('halloween');
  });

  it('returns null the day after halloween', () => {
    expect(resolveOn(new Date(2026, 10, 1))).toBeNull();
  });

  it('returns july4 from June 27 through July 4 for a US English browser', () => {
    expect(resolveOn(new Date(2026, 5, 27))).toBe('july4');
    expect(resolveOn(new Date(2026, 6, 4))).toBe('july4');
  });

  it('returns null in the july4 window for a browser that is not US English', () => {
    expect(resolveOn(new Date(2026, 6, 4), { language: 'en-GB' })).toBeNull();
  });

  it('returns null on an ordinary day', () => {
    expect(resolveOn(new Date(2026, 2, 10))).toBeNull();
  });

  it('returns the trim named in the query on any date', () => {
    expect(resolveOn(new Date(2026, 2, 10), { search: '?trim=halloween' })).toBe('halloween');
  });

  it('lets the query force july4 for a browser that is not US English', () => {
    expect(resolveOn(new Date(2026, 2, 10), { search: '?trim=july4', language: 'de-DE' })).toBe('july4');
  });

  it('returns null inside a window when the query names no known trim', () => {
    expect(resolveOn(new Date(2026, 9, 31), { search: '?trim=none' })).toBeNull();
  });
});

describe('useHeaderTrim', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the trim that is active on the current date', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 31, 12));

    const { result } = renderHook(() => useHeaderTrim());

    expect(result.current).toBe('halloween');
  });

  it('returns null when no trim is active on the current date', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 10, 12));

    const { result } = renderHook(() => useHeaderTrim());

    expect(result.current).toBeNull();
  });
});
