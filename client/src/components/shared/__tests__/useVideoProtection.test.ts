import { renderHook, act } from '@testing-library/react';

jest.mock('axios', () => ({
  patch: jest.fn(),
}));

const axios = require('axios');

import { useVideoProtection } from '../useVideoProtection';

describe('useVideoProtection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('toggleProtection calls PATCH with correct params and returns new state', async () => {
    axios.patch.mockResolvedValueOnce({ data: { id: 1, protected: true } });

    const { result } = renderHook(() => useVideoProtection('test-token'));

    let returnedState: boolean | undefined;
    await act(async () => {
      returnedState = await result.current.toggleProtection(1, false);
    });

    expect(axios.patch).toHaveBeenCalledWith(
      '/api/videos/1/protected',
      { protected: true },
      { headers: { 'x-access-token': 'test-token' } }
    );
    expect(returnedState).toBe(true);
  });

  test('toggleProtection sends false when current state is true', async () => {
    axios.patch.mockResolvedValueOnce({ data: { id: 1, protected: false } });

    const { result } = renderHook(() => useVideoProtection('test-token'));

    await act(async () => {
      await result.current.toggleProtection(1, true);
    });

    expect(axios.patch).toHaveBeenCalledWith(
      '/api/videos/1/protected',
      { protected: false },
      { headers: { 'x-access-token': 'test-token' } }
    );
  });

  test('sets successMessage on successful toggle on', async () => {
    axios.patch.mockResolvedValueOnce({ data: { id: 1, protected: true } });

    const { result } = renderHook(() => useVideoProtection('test-token'));

    await act(async () => {
      await result.current.toggleProtection(1, false);
    });

    expect(result.current.successMessage).toBe('Video protected from auto-deletion');
  });

  test('sets successMessage on successful toggle off', async () => {
    axios.patch.mockResolvedValueOnce({ data: { id: 1, protected: false } });

    const { result } = renderHook(() => useVideoProtection('test-token'));

    await act(async () => {
      await result.current.toggleProtection(1, true);
    });

    expect(result.current.successMessage).toBe('Video protection removed');
  });

  test('sets error on failure', async () => {
    axios.patch.mockRejectedValueOnce({
      response: { data: { error: 'Video not found' } }
    });

    const { result } = renderHook(() => useVideoProtection('test-token'));

    let returnedState: boolean | undefined;
    await act(async () => {
      returnedState = await result.current.toggleProtection(999, false);
    });

    expect(result.current.error).toBe('Video not found');
    expect(returnedState).toBeUndefined();
  });

  test('clearMessages resets successMessage and error', async () => {
    axios.patch.mockResolvedValueOnce({ data: { id: 1, protected: true } });

    const { result } = renderHook(() => useVideoProtection('test-token'));

    await act(async () => {
      await result.current.toggleProtection(1, false);
    });

    expect(result.current.successMessage).toBe('Video protected from auto-deletion');

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.successMessage).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
