import { renderHook, waitFor, act } from '@testing-library/react';
import { useImportJob } from '../useImportJob';
import { ImportJobDetail } from '../../../../types/subscriptionImport';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

const buildJob = (overrides: Partial<ImportJobDetail> = {}): ImportJobDetail => ({
  jobId: 'job-1',
  status: 'In Progress',
  total: 3,
  done: 1,
  errors: 0,
  startedAt: '2026-01-01T00:00:00Z',
  results: [],
  ...overrides,
});

describe('useImportJob', () => {
  const token = 'tok';

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('does not fetch and exposes null jobDetail when jobId is null', () => {
    const { result } = renderHook(() => useImportJob(null, token));

    expect(axios.get).not.toHaveBeenCalled();
    expect(result.current.jobDetail).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  test('does not fetch when token is missing', async () => {
    const { result } = renderHook(() => useImportJob('job-1', ''));

    // The effect still runs (jobId truthy), but fetchJob returns early without token
    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalled();
    });
    expect(result.current.jobDetail).toBeNull();
  });

  test('fetches job detail on mount and exposes data', async () => {
    const job = buildJob({ status: 'Completed', done: 3 });
    axios.get.mockResolvedValueOnce({ data: job });

    const { result } = renderHook(() => useImportJob('job-1', token));

    await waitFor(() => {
      expect(result.current.jobDetail).toEqual(job);
    });

    expect(axios.get).toHaveBeenCalledWith('/api/subscriptions/imports/job-1', {
      headers: { 'x-access-token': token },
    });
    expect(result.current.loading).toBe(false);
  });

  test('polls every 3 seconds while status is In Progress', async () => {
    axios.get.mockResolvedValue({ data: buildJob() });

    renderHook(() => useImportJob('job-1', token));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(3);
    });
  });

  test('stops polling once status is no longer In Progress', async () => {
    axios.get
      .mockResolvedValueOnce({ data: buildJob({ status: 'In Progress' }) })
      .mockResolvedValueOnce({ data: buildJob({ status: 'Completed' }) });

    renderHook(() => useImportJob('job-1', token));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    // Further time should not trigger more fetches
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('continues polling silently when fetch errors', async () => {
    axios.get
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce({ data: buildJob() });

    const { result } = renderHook(() => useImportJob('job-1', token));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
    expect(result.current.jobDetail).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(result.current.jobDetail).not.toBeNull();
    });
  });

  test('clears interval on unmount so no further fetches happen', async () => {
    axios.get.mockResolvedValue({ data: buildJob() });

    const { unmount } = renderHook(() => useImportJob('job-1', token));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    unmount();

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('resets jobDetail to null when jobId becomes null', async () => {
    axios.get.mockResolvedValue({ data: buildJob({ status: 'Completed' }) });

    const { result, rerender } = renderHook(
      ({ jobId }: { jobId: string | null }) => useImportJob(jobId, token),
      { initialProps: { jobId: 'job-1' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.jobDetail).not.toBeNull();
    });

    rerender({ jobId: null });

    expect(result.current.jobDetail).toBeNull();
  });
});
