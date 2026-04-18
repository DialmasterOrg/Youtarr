import { renderHook, waitFor, act } from '@testing-library/react';
import { useImportHistory } from '../useImportHistory';
import { ImportJobSummary } from '../../../../types/subscriptionImport';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

const sample: ImportJobSummary[] = [
  { jobId: 'a', status: 'Completed', total: 5, done: 5, errors: 0, startedAt: '2026-01-01' },
  { jobId: 'b', status: 'In Progress', total: 3, done: 1, errors: 0, startedAt: '2026-01-02' },
];

describe('useImportHistory', () => {
  test('does not fetch when token is empty', () => {
    const { result } = renderHook(() => useImportHistory(''));
    expect(axios.get).not.toHaveBeenCalled();
    expect(result.current.imports).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  test('fetches history on mount and exposes data', async () => {
    axios.get.mockResolvedValueOnce({ data: { imports: sample } });
    const { result } = renderHook(() => useImportHistory('tok'));

    await waitFor(() => {
      expect(result.current.imports).toEqual(sample);
    });
    expect(axios.get).toHaveBeenCalledWith('/api/subscriptions/imports', {
      headers: { 'x-access-token': 'tok' },
    });
    expect(result.current.loading).toBe(false);
  });

  test('falls back to empty array when response.imports is missing', async () => {
    axios.get.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useImportHistory('tok'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.imports).toEqual([]);
  });

  test('silently leaves imports empty on error', async () => {
    axios.get.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useImportHistory('tok'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.imports).toEqual([]);
  });

  test('refetch triggers another fetch with the same token', async () => {
    axios.get.mockResolvedValue({ data: { imports: sample } });
    const { result } = renderHook(() => useImportHistory('tok'));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  test('refetches when token changes', async () => {
    axios.get.mockResolvedValue({ data: { imports: sample } });
    const { rerender } = renderHook(
      ({ token }: { token: string }) => useImportHistory(token),
      { initialProps: { token: 'a' } }
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    rerender({ token: 'b' });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
    expect(axios.get).toHaveBeenLastCalledWith('/api/subscriptions/imports', {
      headers: { 'x-access-token': 'b' },
    });
  });
});
