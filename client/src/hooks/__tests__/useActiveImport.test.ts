import { renderHook, waitFor, act } from '@testing-library/react';
import { useActiveImport } from '../useActiveImport';
import { ImportJobSummary } from '../../types/subscriptionImport';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

const buildSummary = (overrides: Partial<ImportJobSummary> = {}): ImportJobSummary => ({
  jobId: 'job-1',
  status: 'In Progress',
  total: 5,
  done: 2,
  errors: 0,
  startedAt: '2026-01-01',
  ...overrides,
});

describe('useActiveImport', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('does not fetch when token is null', () => {
    const { result } = renderHook(() => useActiveImport(null));
    expect(axios.get).not.toHaveBeenCalled();
    expect(result.current.activeImport).toBeNull();
  });

  test('fetches and exposes the active import on mount', async () => {
    const summary = buildSummary({ status: 'Completed' });
    axios.get.mockResolvedValueOnce({ status: 200, data: summary });

    const { result } = renderHook(() => useActiveImport('tok'));

    await waitFor(() => {
      expect(result.current.activeImport).toEqual(summary);
    });
    expect(axios.get).toHaveBeenCalledWith(
      '/api/subscriptions/imports/active',
      expect.objectContaining({ headers: { 'x-access-token': 'tok' } })
    );
  });

  test('treats a 204 response as no active import', async () => {
    axios.get.mockResolvedValueOnce({ status: 204, data: '' });
    const { result } = renderHook(() => useActiveImport('tok'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.activeImport).toBeNull();
  });

  test('clears activeImport when fetch errors', async () => {
    axios.get.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useActiveImport('tok'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.activeImport).toBeNull();
  });

  test('polls every 5 seconds while status is In Progress', async () => {
    axios.get.mockResolvedValue({ status: 200, data: buildSummary({ status: 'In Progress' }) });

    const { result } = renderHook(() => useActiveImport('tok'));

    // Wait for the initial fetch to settle and state to reflect "In Progress"
    await waitFor(() => {
      expect(result.current.activeImport?.status).toBe('In Progress');
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  test('does not poll when status is not In Progress', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: buildSummary({ status: 'Completed' }) });

    renderHook(() => useActiveImport('tok'));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(20000);
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('clears the polling interval on unmount', async () => {
    axios.get.mockResolvedValue({ status: 200, data: buildSummary({ status: 'In Progress' }) });

    const { result, unmount } = renderHook(() => useActiveImport('tok'));

    await waitFor(() => {
      expect(result.current.activeImport?.status).toBe('In Progress');
    });
    const callsBeforeUnmount = axios.get.mock.calls.length;

    unmount();
    await act(async () => {
      jest.advanceTimersByTime(20000);
    });
    expect(axios.get).toHaveBeenCalledTimes(callsBeforeUnmount);
  });

  test('refetch is callable and triggers another request', async () => {
    axios.get.mockResolvedValue({ status: 200, data: buildSummary({ status: 'Completed' }) });
    const { result } = renderHook(() => useActiveImport('tok'));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
