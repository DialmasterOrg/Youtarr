import { renderHook, waitFor, act } from '@testing-library/react';
import { useYtDlpUpdate, YTDLP_UPDATED_EVENT } from '../useYtDlpUpdate';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockDispatchEvent = jest.fn();
const originalDispatchEvent = window.dispatchEvent;

describe('useYtDlpUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.dispatchEvent = mockDispatchEvent;
  });

  afterEach(() => {
    window.dispatchEvent = originalDispatchEvent;
  });

  describe('initialization', () => {
    it('starts with default state', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          currentVersion: '2024.01.01',
          latestVersion: '2024.01.15',
          updateAvailable: true,
        }),
      });

      const { result } = renderHook(() => useYtDlpUpdate('test-token'));

      expect(result.current.versionInfo).toEqual({
        currentVersion: null,
        latestVersion: null,
        updateAvailable: false,
      });
      expect(result.current.updateStatus).toBe('checking');
      expect(result.current.checkingVersion).toBe(true);
    });

    it('does not fetch when token is null', () => {
      const { result } = renderHook(() => useYtDlpUpdate(null));

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.versionInfo).toEqual({
        currentVersion: null,
        latestVersion: null,
        updateAvailable: false,
      });
    });
  });

  describe('checkLatestVersion', () => {
    it('fetches version info on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          currentVersion: '2024.01.01',
          latestVersion: '2024.01.15',
          updateAvailable: true,
        }),
      });

      const { result } = renderHook(() => useYtDlpUpdate('test-token'));

      await waitFor(() => {
        expect(result.current.checkingVersion).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/ytdlp/latest-version', {
        headers: { 'x-access-token': 'test-token' },
      });
      expect(result.current.versionInfo).toEqual({
        currentVersion: '2024.01.01',
        latestVersion: '2024.01.15',
        updateAvailable: true,
      });
      expect(result.current.updateStatus).toBe('idle');
    });

    it('handles fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useYtDlpUpdate('test-token'));

      await waitFor(() => {
        expect(result.current.checkingVersion).toBe(false);
      });

      expect(result.current.errorMessage).toBe('Network error');
      expect(result.current.updateStatus).toBe('error');
    });

    it('handles non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValueOnce({ error: 'Unauthorized' }),
      });

      const { result } = renderHook(() => useYtDlpUpdate('test-token'));

      await waitFor(() => {
        expect(result.current.checkingVersion).toBe(false);
      });

      expect(result.current.errorMessage).toBe('Failed to fetch version information');
      expect(result.current.updateStatus).toBe('error');
    });
  });

  describe('performUpdate', () => {
    it('performs update successfully', async () => {
      // First call is for initial version check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          currentVersion: '2024.01.01',
          latestVersion: '2024.01.15',
          updateAvailable: true,
        }),
      });

      const { result } = renderHook(() => useYtDlpUpdate('test-token'));

      await waitFor(() => {
        expect(result.current.checkingVersion).toBe(false);
      });

      // Mock update call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          message: 'Successfully updated to 2024.01.15',
          newVersion: '2024.01.15',
        }),
      });

      // Mock version refresh after update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          currentVersion: '2024.01.15',
          latestVersion: '2024.01.15',
          updateAvailable: false,
        }),
      });

      await act(async () => {
        await result.current.performUpdate();
      });

      await waitFor(() => {
        expect(result.current.updateStatus).toBe('idle');
      });

      expect(result.current.versionInfo.currentVersion).toBe('2024.01.15');
      expect(result.current.versionInfo.updateAvailable).toBe(false);
    });

    it('dispatches YTDLP_UPDATED_EVENT on successful update', async () => {
      // Initial version check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          currentVersion: '2024.01.01',
          latestVersion: '2024.01.15',
          updateAvailable: true,
        }),
      });

      const { result } = renderHook(() => useYtDlpUpdate('test-token'));

      await waitFor(() => {
        expect(result.current.checkingVersion).toBe(false);
      });

      // Mock update call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          message: 'Successfully updated',
          newVersion: '2024.01.15',
        }),
      });

      // Mock version refresh after update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          currentVersion: '2024.01.15',
          latestVersion: '2024.01.15',
          updateAvailable: false,
        }),
      });

      await act(async () => {
        await result.current.performUpdate();
      });

      // Verify event was dispatched
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: YTDLP_UPDATED_EVENT,
        })
      );
    });

    it('handles update failure', async () => {
      // Initial version check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          currentVersion: '2024.01.01',
          latestVersion: '2024.01.15',
          updateAvailable: true,
        }),
      });

      const { result } = renderHook(() => useYtDlpUpdate('test-token'));

      await waitFor(() => {
        expect(result.current.checkingVersion).toBe(false);
      });

      // Mock failed update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          success: false,
          message: 'Permission denied',
        }),
      });

      await act(async () => {
        await result.current.performUpdate();
      });

      await waitFor(() => {
        expect(result.current.updateStatus).toBe('error');
      });

      expect(result.current.errorMessage).toBe('Permission denied');
    });
  });

  describe('clearMessages', () => {
    it('clears error and success messages', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Test error'));

      const { result } = renderHook(() => useYtDlpUpdate('test-token'));

      await waitFor(() => {
        expect(result.current.errorMessage).toBe('Test error');
      });

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.errorMessage).toBe(null);
      expect(result.current.successMessage).toBe(null);
    });
  });
});
