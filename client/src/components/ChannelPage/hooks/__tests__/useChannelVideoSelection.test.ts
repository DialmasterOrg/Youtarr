import { act, renderHook } from '@testing-library/react';
import { useChannelSelectionPill, useChannelVideoSelection } from '../useChannelVideoSelection';
import { ChannelVideo } from '../../../../types/ChannelVideo';
import type { SelectionAction } from '../../../shared/VideoList';

type ActivitySnapshot = { instanceId: string; revision: number; videos: Record<string, { jobId: string; state: string }> };
let mockSnapshot: ActivitySnapshot = { instanceId: '', revision: 0, videos: {} };
jest.mock('../../../../providers/VideoActivityProvider', () => ({
  useVideoActivity: () => ({ snapshot: mockSnapshot, refresh: jest.fn() }),
}));

type Props = Parameters<typeof useChannelVideoSelection>[0];

const video = (youtubeId: string, overrides: Partial<ChannelVideo> = {}): ChannelVideo => ({
  title: `Video ${youtubeId}`,
  youtube_id: youtubeId,
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnail: `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`,
  added: false,
  duration: 300,
  media_type: 'video',
  live_status: null,
  ...overrides,
});

describe('useChannelVideoSelection', () => {
  const neverDownloaded = video('new1');
  const ignored = video('ignored1', { ignored: true });
  const downloaded = video('have1', { added: true, removed: false });
  const missing = video('gone1', { added: true, removed: true });
  const inArchiveOnly = video('archived1', { inArchive: true });
  const allVideos = [neverDownloaded, ignored, downloaded, missing, inArchiveOnly];

  const baseProps: Props = { videos: allVideos, filters: {}, search: '' };

  const renderSelection = (props: Partial<Props> = {}) =>
    renderHook((hookProps: Props) => useChannelVideoSelection(hookProps), {
      initialProps: { ...baseProps, ...props },
    });

  beforeEach(() => {
    mockSnapshot = { instanceId: '', revision: 0, videos: {} };
  });

  describe('selection mode', () => {
    test('is off until a video is selected', () => {
      const { result } = renderSelection();

      expect(result.current.selectionMode).toBeNull();
    });

    test('is download once a video is checked for download', () => {
      const { result } = renderSelection();

      act(() => result.current.onCheckChange('new1', true));

      expect(result.current).toMatchObject({ selectionMode: 'download', checkedBoxes: ['new1'] });
    });

    test('is delete once a video is checked for deletion', () => {
      const { result } = renderSelection();

      act(() => result.current.onDeletionChange('have1', true));

      expect(result.current).toMatchObject({ selectionMode: 'delete', selectedForDeletion: ['have1'] });
    });

    test('stays download if both kinds end up selected', () => {
      const { result } = renderSelection();

      act(() => {
        result.current.onCheckChange('new1', true);
        result.current.onDeletionChange('have1', true);
      });

      expect(result.current.selectionMode).toBe('download');
    });

    test('turns off when the last video is unchecked', () => {
      const { result } = renderSelection();
      act(() => result.current.onCheckChange('new1', true));

      act(() => result.current.onCheckChange('new1', false));

      expect(result.current.selectionMode).toBeNull();
    });
  });

  describe('selecting every video on screen', () => {
    test('selects the videos that can be downloaded, ignored and missing ones included', () => {
      const { result } = renderSelection();

      act(() => result.current.selectAllNotDownloaded());

      expect(result.current.checkedBoxes).toEqual(['new1', 'ignored1', 'gone1', 'archived1']);
    });

    test('selects the downloaded videos whose file is still there', () => {
      const { result } = renderSelection();

      act(() => result.current.selectAllDownloaded());

      expect(result.current.selectedForDeletion).toEqual(['have1']);
    });

    test('leaves out videos no row lets you select: removed by YouTube, or still live', () => {
      const youtubeRemoved = video('removed1', { youtube_removed: true });
      const liveNow = video('live1', { live_status: 'is_live' });
      const liveWithFile = video('live2', { added: true, live_status: 'is_live' });
      const { result } = renderSelection({ videos: [...allVideos, youtubeRemoved, liveNow, liveWithFile] });

      act(() => result.current.selectAllNotDownloaded());
      act(() => result.current.selectAllDownloaded());

      expect(result.current.checkedBoxes).toEqual(['new1', 'ignored1', 'gone1', 'archived1']);
      expect(result.current.selectedForDeletion).toEqual(['have1']);
    });

    test('select all follows delete mode', () => {
      const { result } = renderSelection({ videos: [downloaded, video('have2', { added: true })] });
      act(() => result.current.onDeletionChange('have1', true));

      act(() => result.current.selectAll());

      expect(result.current.selectedForDeletion).toEqual(['have1', 'have2']);
    });

    test('select all selects for download outside delete mode', () => {
      const { result } = renderSelection();

      act(() => result.current.selectAll());

      expect(result.current.selectionMode).toBe('download');
    });

    test('says when no video on screen can be selected for download', () => {
      const { result } = renderSelection({ videos: [downloaded] });

      expect(result.current).toMatchObject({ canSelectNotDownloaded: false, canSelectDownloaded: true });
    });

    test('says when no video on screen can be selected for deletion', () => {
      const { result } = renderSelection({ videos: [neverDownloaded, missing] });

      expect(result.current).toMatchObject({ canSelectNotDownloaded: true, canSelectDownloaded: false });
    });
  });

  describe('dropping the selection', () => {
    const withBothSelected = (props: Partial<Props> = {}) => {
      const view = renderSelection(props);
      act(() => {
        view.result.current.onCheckChange('new1', true);
        view.result.current.onDeletionChange('have1', true);
      });
      return view;
    };

    test.each([
      ['a filter', { filters: { watchedFilter: 'only' } }],
      ['the search', { search: 'trailer' }],
    ])('clears both kinds when %s changes', (_case, changed) => {
      const { result, rerender } = withBothSelected();

      rerender({ ...baseProps, ...changed });

      expect(result.current).toMatchObject({ checkedBoxes: [], selectedForDeletion: [] });
    });

    test('keeps the selection when another page of videos loads', () => {
      const { result, rerender } = withBothSelected();

      rerender({ ...baseProps, videos: [video('other1')] });

      expect(result.current).toMatchObject({ checkedBoxes: ['new1'], selectedForDeletion: ['have1'] });
    });

    test('unchecks a video once it is queued or downloading', () => {
      const { result, rerender } = renderSelection();
      act(() => result.current.selectAllNotDownloaded());

      mockSnapshot = { instanceId: 'a', revision: 1, videos: { new1: { jobId: 'job1', state: 'queued' } } };
      rerender(baseProps);

      expect(result.current.checkedBoxes).toEqual(['ignored1', 'gone1', 'archived1']);
    });

    test('removes only the given videos from the delete selection', () => {
      const { result } = renderSelection({ videos: [downloaded, video('have2', { added: true })] });
      act(() => result.current.selectAllDownloaded());

      act(() => result.current.removeFromDeletion(['have1']));

      expect(result.current.selectedForDeletion).toEqual(['have2']);
    });
  });

  describe('missing video count', () => {
    test.each([
      ['a video whose file is gone', 'gone1', 1],
      ['a video only the download archive lists', 'archived1', 1],
      ['a video that was never downloaded', 'new1', 0],
    ])('for %s', (_case, youtubeId, expected) => {
      const { result } = renderSelection();

      act(() => result.current.onCheckChange(youtubeId, true));

      expect(result.current.missingVideoCount).toBe(expected);
    });

    test('still counts a selected video after its page is no longer loaded', () => {
      const { result, rerender } = renderSelection();
      act(() => result.current.onCheckChange('gone1', true));

      rerender({ ...baseProps, videos: [video('other1')] });

      expect(result.current.missingVideoCount).toBe(1);
    });
  });
});

describe('useChannelSelectionPill', () => {
  const downloadActions: SelectionAction<string>[] = [{ id: 'download', label: 'Download', onClick: jest.fn() }];
  const deleteActions: SelectionAction<string>[] = [{ id: 'delete', label: 'Delete', onClick: jest.fn() }];
  const videos = [video('new1'), video('have1', { added: true })];

  const renderPill = () =>
    renderHook(() => {
      const selection = useChannelVideoSelection({ videos, filters: null, search: '' });
      const pill = useChannelSelectionPill(selection, downloadActions, deleteActions);
      return { selection, pill };
    });

  test('has nothing to show while no video is selected', () => {
    const { result } = renderPill();

    expect(result.current.pill).toBeUndefined();
  });

  test('offers the download actions for the videos checked for download', () => {
    const { result } = renderPill();

    act(() => result.current.selection.onCheckChange('new1', true));

    expect(result.current.pill).toMatchObject({ selectedIds: ['new1'], count: 1, actions: downloadActions });
  });

  test('offers the delete actions for the videos checked for deletion', () => {
    const { result } = renderPill();

    act(() => result.current.selection.onDeletionChange('have1', true));

    expect(result.current.pill).toMatchObject({ selectedIds: ['have1'], count: 1, actions: deleteActions });
  });

  test('its Clear empties both kinds of selection', () => {
    const { result } = renderPill();
    act(() => {
      result.current.selection.onCheckChange('new1', true);
      result.current.selection.onDeletionChange('have1', true);
    });

    act(() => result.current.pill?.clear());

    expect(result.current.selection).toMatchObject({ checkedBoxes: [], selectedForDeletion: [] });
  });
});
