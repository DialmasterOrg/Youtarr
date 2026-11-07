import { act, renderHook } from '@testing-library/react';
import { SearchResult } from '../../types';
import { VideoSelectionState } from '../../../shared/VideoList/hooks/useVideoSelection';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockTriggerDownloads = jest.fn();
jest.mock('../../../../hooks/useTriggerDownloads', () => ({
  useTriggerDownloads: () => ({ triggerDownloads: mockTriggerDownloads, loading: false, error: null }),
}));

const { useResultDownload } = require('../useResultDownload');

function makeResult(overrides: Partial<SearchResult> & { youtubeId: string }): SearchResult {
  return {
    title: overrides.youtubeId,
    channelName: 'C',
    channelId: null,
    duration: null,
    thumbnailUrl: null,
    publishedAt: null,
    viewCount: null,
    status: 'never_downloaded',
    ...overrides,
  };
}

function makeSelection(selectedIds: string[]): VideoSelectionState<string> & { clear: jest.Mock } {
  return {
    selectedIds,
    isSelected: (id) => selectedIds.includes(id),
    toggle: jest.fn(),
    set: jest.fn(),
    add: jest.fn(),
    selectAll: jest.fn(),
    clear: jest.fn(),
    hasSelection: selectedIds.length > 0,
    count: selectedIds.length,
    actions: [],
    menuAnchor: null,
    openMenu: jest.fn(),
    closeMenu: jest.fn(),
  };
}

const results = [
  makeResult({ youtubeId: 'aaaaaaaaaaa' }),
  makeResult({ youtubeId: 'bbbbbbbbbbb', status: 'missing' }),
  makeResult({ youtubeId: 'ccccccccccc', inArchive: true }),
];

describe('useResultDownload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTriggerDownloads.mockResolvedValue(true);
  });

  test('opening for one video targets just that video', () => {
    const selection = makeSelection(['aaaaaaaaaaa']);
    const { result } = renderHook(() => useResultDownload({ token: 't', results, selection, activeVideos: {} }));

    act(() => { result.current.openForOne(results[1]); });

    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.targetIds).toEqual(['bbbbbbbbbbb']);
  });

  test('counts removed and archive-only targets as previously downloaded', () => {
    const selection = makeSelection(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
    const { result } = renderHook(() => useResultDownload({ token: 't', results, selection, activeVideos: {} }));

    act(() => { result.current.openForSelection(); });

    expect(result.current.targetIds).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
    expect(result.current.missingVideoCount).toBe(2);
  });

  test('confirming a selection queues its URLs, clears the selection, and opens the activity page', async () => {
    const selection = makeSelection(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    const { result } = renderHook(() => useResultDownload({ token: 't', results, selection, activeVideos: {} }));

    act(() => { result.current.openForSelection(); });
    await act(async () => { await result.current.confirm(null); });

    expect(mockTriggerDownloads).toHaveBeenCalledWith({
      urls: ['https://www.youtube.com/watch?v=aaaaaaaaaaa', 'https://www.youtube.com/watch?v=bbbbbbbbbbb'],
      overrideSettings: undefined,
    });
    expect(selection.clear).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/downloads/activity');
    expect(result.current.dialogOpen).toBe(false);
  });

  test('confirming a single video leaves the selection alone', async () => {
    const selection = makeSelection(['aaaaaaaaaaa']);
    const { result } = renderHook(() => useResultDownload({ token: 't', results, selection, activeVideos: {} }));

    act(() => { result.current.openForOne(results[1]); });
    await act(async () => { await result.current.confirm(null); });

    expect(mockTriggerDownloads).toHaveBeenCalledWith({
      urls: ['https://www.youtube.com/watch?v=bbbbbbbbbbb'],
      overrideSettings: undefined,
    });
    expect(selection.clear).not.toHaveBeenCalled();
  });

  test('skips targets that are already queued or downloading', async () => {
    const selection = makeSelection(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    const { result } = renderHook(() => useResultDownload({
      token: 't', results, selection, activeVideos: { aaaaaaaaaaa: { state: 'queued' } },
    }));

    act(() => { result.current.openForSelection(); });
    await act(async () => { await result.current.confirm(null); });

    expect(mockTriggerDownloads).toHaveBeenCalledWith(expect.objectContaining({
      urls: ['https://www.youtube.com/watch?v=bbbbbbbbbbb'],
    }));
  });

  test('a failed queue keeps the selection and reports an error', async () => {
    mockTriggerDownloads.mockResolvedValueOnce(false);
    const selection = makeSelection(['aaaaaaaaaaa']);
    const { result } = renderHook(() => useResultDownload({ token: 't', results, selection, activeVideos: {} }));

    act(() => { result.current.openForSelection(); });
    await act(async () => { await result.current.confirm(null); });

    expect(result.current.error).toMatch(/failed to queue/i);
    expect(selection.clear).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });
});
