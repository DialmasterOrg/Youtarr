import { renderHook, act } from '@testing-library/react';
import { useImportFlow } from '../hooks/useImportFlow';
import { ReviewChannel, DEFAULT_ROW_SETTINGS } from '../../../types/subscriptionImport';

describe('useImportFlow', () => {
  const mockChannels: ReviewChannel[] = [
    {
      channelId: 'UC001',
      title: 'New Channel',
      url: 'https://youtube.com/@newchannel',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      alreadySubscribed: false,
    },
    {
      channelId: 'UC002',
      title: 'Already Subscribed',
      url: 'https://youtube.com/@subscribed',
      thumbnailUrl: null,
      alreadySubscribed: true,
    },
    {
      channelId: 'UC003',
      title: 'Another New',
      url: 'https://youtube.com/@anothernew',
      thumbnailUrl: 'https://example.com/thumb3.jpg',
      alreadySubscribed: false,
    },
  ];

  test('initial state has phase source', () => {
    const { result } = renderHook(() => useImportFlow());

    expect(result.current.state.phase).toBe('source');
    expect(result.current.state.source).toBeNull();
    expect(result.current.state.channels).toEqual([]);
    expect(result.current.state.rowStates).toEqual({});
    expect(result.current.state.activeJobId).toBeNull();
    expect(result.current.state.error).toBeNull();
  });

  test('PREVIEW_SUCCESS populates channels and rowStates correctly', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    expect(result.current.state.phase).toBe('reviewing');
    expect(result.current.state.channels).toEqual(mockChannels);

    // Non-subscribed channels should be selected
    expect(result.current.state.rowStates['UC001'].selected).toBe(true);
    expect(result.current.state.rowStates['UC003'].selected).toBe(true);

    // Already subscribed channel should NOT be selected
    expect(result.current.state.rowStates['UC002'].selected).toBe(false);

    // All should have default settings
    expect(result.current.state.rowStates['UC001'].settings).toEqual(DEFAULT_ROW_SETTINGS);
    expect(result.current.state.rowStates['UC002'].settings).toEqual(DEFAULT_ROW_SETTINGS);
    expect(result.current.state.rowStates['UC003'].settings).toEqual(DEFAULT_ROW_SETTINGS);
  });

  test('PREVIEW_ERROR resets to source phase with error message', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({ type: 'PREVIEW_LOADING' });
    });
    expect(result.current.state.phase).toBe('preview-loading');

    act(() => {
      result.current.dispatch({ type: 'PREVIEW_ERROR', payload: 'File parsing failed' });
    });

    expect(result.current.state.phase).toBe('source');
    expect(result.current.state.error).toBe('File parsing failed');
  });

  test('TOGGLE_ROW_SELECTION flips selected for a non-subscribed channel', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    // UC001 starts selected (not already subscribed)
    expect(result.current.state.rowStates['UC001'].selected).toBe(true);

    act(() => {
      result.current.dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: 'UC001' });
    });

    expect(result.current.state.rowStates['UC001'].selected).toBe(false);

    // Toggle back
    act(() => {
      result.current.dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: 'UC001' });
    });

    expect(result.current.state.rowStates['UC001'].selected).toBe(true);
  });

  test('TOGGLE_ROW_SELECTION does nothing for alreadySubscribed channels', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    // UC002 is already subscribed, starts as not selected
    expect(result.current.state.rowStates['UC002'].selected).toBe(false);

    act(() => {
      result.current.dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: 'UC002' });
    });

    // Should still be false - can't toggle already-subscribed channels
    expect(result.current.state.rowStates['UC002'].selected).toBe(false);
  });

  test('SELECT_ALL selects all non-subscribed channels', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    // Deselect first, then select all
    act(() => {
      result.current.dispatch({ type: 'DESELECT_ALL' });
    });

    expect(result.current.state.rowStates['UC001'].selected).toBe(false);
    expect(result.current.state.rowStates['UC003'].selected).toBe(false);

    act(() => {
      result.current.dispatch({ type: 'SELECT_ALL' });
    });

    expect(result.current.state.rowStates['UC001'].selected).toBe(true);
    expect(result.current.state.rowStates['UC003'].selected).toBe(true);
    // Already subscribed should stay unselected
    expect(result.current.state.rowStates['UC002'].selected).toBe(false);
  });

  test('DESELECT_ALL deselects all channels', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    act(() => {
      result.current.dispatch({ type: 'DESELECT_ALL' });
    });

    expect(result.current.state.rowStates['UC001'].selected).toBe(false);
    expect(result.current.state.rowStates['UC002'].selected).toBe(false);
    expect(result.current.state.rowStates['UC003'].selected).toBe(false);
  });

  test('TOGGLE_ALL_AUTO_DOWNLOAD sets autoDownloadEnabled for selected rows only', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    // UC001 and UC003 are selected; UC002 is not (already subscribed)
    act(() => {
      result.current.dispatch({ type: 'TOGGLE_ALL_AUTO_DOWNLOAD', payload: false });
    });

    expect(result.current.state.rowStates['UC001'].settings.autoDownloadEnabled).toBe(false);
    expect(result.current.state.rowStates['UC003'].settings.autoDownloadEnabled).toBe(false);
    // UC002 not selected, so not affected
    expect(result.current.state.rowStates['UC002'].settings.autoDownloadEnabled).toBe(true);
  });

  test('UPDATE_ROW_SETTINGS merges partial settings', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    act(() => {
      result.current.dispatch({
        type: 'UPDATE_ROW_SETTINGS',
        payload: {
          channelId: 'UC001',
          settings: { videoQuality: '720p', subFolder: 'custom-folder' },
        },
      });
    });

    const settings = result.current.state.rowStates['UC001'].settings;
    expect(settings.videoQuality).toBe('720p');
    expect(settings.subFolder).toBe('custom-folder');
    // Other settings remain at defaults
    expect(settings.autoDownloadEnabled).toBe(true);
    expect(settings.downloadType).toBe('videos');
    expect(settings.defaultRating).toBeNull();
  });

  test('UPDATE_ROW_SETTINGS does nothing for unknown channelId', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    const stateBefore = result.current.state.rowStates;

    act(() => {
      result.current.dispatch({
        type: 'UPDATE_ROW_SETTINGS',
        payload: {
          channelId: 'UC_NONEXISTENT',
          settings: { videoQuality: '720p' },
        },
      });
    });

    expect(result.current.state.rowStates).toEqual(stateBefore);
  });

  test('START_IMPORT transitions to importing phase', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    act(() => {
      result.current.dispatch({ type: 'START_IMPORT', payload: 'job-abc-123' });
    });

    expect(result.current.state.phase).toBe('importing');
    expect(result.current.state.activeJobId).toBe('job-abc-123');
  });

  test('IMPORT_COMPLETE transitions to complete phase', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({
        type: 'PREVIEW_SUCCESS',
        payload: { channels: mockChannels },
      });
    });

    act(() => {
      result.current.dispatch({ type: 'START_IMPORT', payload: 'job-abc-123' });
    });

    act(() => {
      result.current.dispatch({ type: 'IMPORT_COMPLETE' });
    });

    expect(result.current.state.phase).toBe('complete');
  });

  test('SET_SOURCE updates source value', () => {
    const { result } = renderHook(() => useImportFlow());

    act(() => {
      result.current.dispatch({ type: 'SET_SOURCE', payload: 'cookies' });
    });

    expect(result.current.state.source).toBe('cookies');
  });

  test('PREVIEW_LOADING transitions to preview-loading phase and clears error', () => {
    const { result } = renderHook(() => useImportFlow());

    // Set an error first
    act(() => {
      result.current.dispatch({ type: 'PREVIEW_ERROR', payload: 'Some error' });
    });
    expect(result.current.state.error).toBe('Some error');

    act(() => {
      result.current.dispatch({ type: 'PREVIEW_LOADING' });
    });

    expect(result.current.state.phase).toBe('preview-loading');
    expect(result.current.state.error).toBeNull();
  });
});
