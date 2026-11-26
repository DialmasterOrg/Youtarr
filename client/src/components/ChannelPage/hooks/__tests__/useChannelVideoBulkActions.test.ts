import { act, renderHook } from '@testing-library/react';
import axios from 'axios';
import { useChannelVideoBulkActions } from '../useChannelVideoBulkActions';
import { useTriggerDownloads } from '../../../../hooks/useTriggerDownloads';
import { useVideoDeletion } from '../../../shared/useVideoDeletion';
import { ChannelVideo } from '../../../../types/ChannelVideo';
import { DownloadSettings } from '../../../DownloadManager/ManualDownload/types';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

type ActivitySnapshot = { instanceId: string; revision: number; videos: Record<string, { jobId: string; state: string }> };
let mockSnapshot: ActivitySnapshot = { instanceId: '', revision: 0, videos: {} };
jest.mock('../../../../providers/VideoActivityProvider', () => ({
  useVideoActivity: () => ({ snapshot: mockSnapshot, refresh: jest.fn() }),
}));

jest.mock('../../../../hooks/useTriggerDownloads', () => ({
  useTriggerDownloads: jest.fn(),
}));

jest.mock('../../../shared/useVideoDeletion', () => ({
  useVideoDeletion: jest.fn(),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const mockPost = axios.post as jest.Mock;

type Props = Parameters<typeof useChannelVideoBulkActions>[0];

// Shaped like an axios error: the request it was for rides along.
const serverError = Object.assign(new Error('Request failed with status code 500'), {
  response: { status: 500 },
  config: { headers: { 'x-access-token': 'test-token' } },
});

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

describe('useChannelVideoBulkActions', () => {
  const triggerDownloads = jest.fn();
  const deleteVideosByYoutubeIds = jest.fn();
  let props: Props;

  const renderActions = (selection: Partial<Props['selection']> = {}) =>
    renderHook(() =>
      useChannelVideoBulkActions({ ...props, selection: { ...props.selection, ...selection } })
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockReset();
    mockSnapshot = { instanceId: '', revision: 0, videos: {} };
    (useTriggerDownloads as jest.Mock).mockReturnValue({ triggerDownloads });
    (useVideoDeletion as jest.Mock).mockReturnValue({ deleteVideosByYoutubeIds, loading: false });
    triggerDownloads.mockResolvedValue(true);
    props = {
      channelId: 'UC123',
      token: 'test-token',
      videos: [video('one'), video('two', { ignored: true }), video('three', { added: true })],
      selection: {
        checkedBoxes: [],
        selectedForDeletion: [],
        clearChecked: jest.fn(),
        clearDeletion: jest.fn(),
        removeFromDeletion: jest.fn(),
      },
      setIgnored: jest.fn(),
      refetchVideos: jest.fn().mockResolvedValue(undefined),
      refetchTabStats: jest.fn().mockResolvedValue(undefined),
      notify: jest.fn(),
    };
  });

  describe('downloading the selection', () => {
    const settings: DownloadSettings = {
      resolution: '720',
      allowRedownload: true,
      subfolder: 'Kids',
      audioFormat: null,
      rating: 'PG',
      skipVideoFolder: false,
      protect: true,
    };

    test('opens and closes the download dialog', () => {
      const { result } = renderActions();

      act(() => result.current.openDownloadDialog());
      const openAfterOpening = result.current.downloadDialogOpen;
      act(() => result.current.closeDownloadDialog());

      expect([openAfterOpening, result.current.downloadDialogOpen]).toEqual([true, false]);
    });

    test('queues the selected videos for this channel with the chosen settings', async () => {
      const { result } = renderActions({ checkedBoxes: ['one', 'two'] });

      await act(() => result.current.confirmDownload(settings));

      expect(triggerDownloads).toHaveBeenCalledWith({
        urls: ['https://www.youtube.com/watch?v=one', 'https://www.youtube.com/watch?v=two'],
        overrideSettings: settings,
        channelId: 'UC123',
      });
    });

    test('sends no override settings when the dialog gives none', async () => {
      const { result } = renderActions({ checkedBoxes: ['one'] });

      await act(() => result.current.confirmDownload(null));

      expect(triggerDownloads).toHaveBeenCalledWith(
        expect.objectContaining({ overrideSettings: undefined })
      );
    });

    test('clears the selection and opens the activity page once queued', async () => {
      const { result } = renderActions({ checkedBoxes: ['one'] });

      await act(() => result.current.confirmDownload(null));

      expect(props.selection.clearChecked).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/downloads/activity');
    });

    test('leaves out a video that is already queued or downloading', async () => {
      mockSnapshot = { instanceId: 'a', revision: 1, videos: { one: { jobId: 'job1', state: 'downloading' } } };
      const { result } = renderActions({ checkedBoxes: ['one', 'two'] });

      await act(() => result.current.confirmDownload(null));

      expect(triggerDownloads).toHaveBeenCalledWith(
        expect.objectContaining({ urls: ['https://www.youtube.com/watch?v=two'] })
      );
    });

    test('queues nothing when every selected video is already downloading', async () => {
      mockSnapshot = { instanceId: 'a', revision: 1, videos: { one: { jobId: 'job1', state: 'queued' } } };
      const { result } = renderActions({ checkedBoxes: ['one'] });

      await act(() => result.current.confirmDownload(null));

      expect(triggerDownloads).not.toHaveBeenCalled();
    });

    test('reports a failure and keeps the selection', async () => {
      triggerDownloads.mockResolvedValue(false);
      const { result } = renderActions({ checkedBoxes: ['one'] });

      await act(() => result.current.confirmDownload(null));

      expect(props.notify).toHaveBeenCalledWith('Failed to queue downloads', 'error');
      expect(props.selection.clearChecked).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('changes nothing when another submission is already running', async () => {
      triggerDownloads.mockResolvedValue(null);
      const { result } = renderActions({ checkedBoxes: ['one'] });

      await act(() => result.current.confirmDownload(null));

      expect(props.notify).not.toHaveBeenCalled();
      expect(props.selection.clearChecked).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('deleting the selection', () => {
    test('asks for confirmation first', () => {
      const { result } = renderActions({ selectedForDeletion: ['three'] });

      act(() => result.current.requestDelete());

      expect(result.current.deleteDialogOpen).toBe(true);
      expect(deleteVideosByYoutubeIds).not.toHaveBeenCalled();
    });

    test('reports an error instead of asking when nothing is selected', () => {
      const { result } = renderActions();

      act(() => result.current.requestDelete());

      expect(result.current.deleteDialogOpen).toBe(false);
      expect(props.notify).toHaveBeenCalledWith('No videos selected for deletion', 'error');
    });

    test('cancelling closes the confirmation', () => {
      const { result } = renderActions({ selectedForDeletion: ['three'] });
      act(() => result.current.requestDelete());

      act(() => result.current.cancelDelete());

      expect(result.current.deleteDialogOpen).toBe(false);
    });

    test('deletes the selected videos, clears the selection and reloads the list', async () => {
      deleteVideosByYoutubeIds.mockResolvedValue({ success: true, deleted: ['three'], failed: [] });
      const { result } = renderActions({ selectedForDeletion: ['three'] });

      await act(() => result.current.confirmDelete());

      expect(deleteVideosByYoutubeIds).toHaveBeenCalledWith(['three'], 'test-token');
      expect(props.notify).toHaveBeenCalledWith('Successfully deleted 1 video');
      expect(props.selection.clearDeletion).toHaveBeenCalledTimes(1);
      expect(props.refetchVideos).toHaveBeenCalledTimes(1);
    });

    test('keeps the videos that failed selected when only some were deleted', async () => {
      deleteVideosByYoutubeIds.mockResolvedValue({
        success: false,
        deleted: ['one', 'two'],
        failed: [{ youtubeId: 'three', error: 'File is locked' }],
      });
      const { result } = renderActions({ selectedForDeletion: ['one', 'two', 'three'] });

      await act(() => result.current.confirmDelete());

      expect(props.notify).toHaveBeenCalledWith('Deleted 2 videos, but 1 failed');
      expect(props.selection.removeFromDeletion).toHaveBeenCalledWith(['one', 'two']);
      expect(props.refetchVideos).toHaveBeenCalledTimes(1);
    });

    test('reports the first error and keeps the list when nothing was deleted', async () => {
      deleteVideosByYoutubeIds.mockResolvedValue({
        success: false,
        deleted: [],
        failed: [{ youtubeId: 'three', error: 'File is locked' }],
      });
      const { result } = renderActions({ selectedForDeletion: ['three'] });

      await act(() => result.current.confirmDelete());

      expect(props.notify).toHaveBeenCalledWith('Failed to delete videos: File is locked', 'error');
      expect(props.refetchVideos).not.toHaveBeenCalled();
    });

    test('says while a delete is running', () => {
      (useVideoDeletion as jest.Mock).mockReturnValue({ deleteVideosByYoutubeIds, loading: true });

      const { result } = renderActions();

      expect(result.current.deleteLoading).toBe(true);
    });
  });

  describe('ignoring the selection', () => {
    const serverAnswers = (body: Record<string, unknown>) =>
      mockPost.mockResolvedValue({ data: body });

    test('sends the selected videos to the bulk ignore endpoint', async () => {
      serverAnswers({ message: 'Successfully ignored 2 videos' });
      const { result } = renderActions({ checkedBoxes: ['one', 'two'] });

      await act(() => result.current.ignoreSelected());

      expect(mockPost).toHaveBeenCalledWith(
        '/api/channels/UC123/videos/bulk-ignore',
        { youtubeIds: ['one', 'two'] },
        { headers: { 'x-access-token': 'test-token' } }
      );
    });

    test('shows every selected row as ignored, then clears the selection and refreshes the tab counts', async () => {
      serverAnswers({ message: 'Successfully ignored 2 videos' });
      const { result } = renderActions({ checkedBoxes: ['one', 'two'] });

      await act(() => result.current.ignoreSelected());

      expect(props.setIgnored).toHaveBeenCalledWith({ one: true, two: true });
      expect(props.notify).toHaveBeenCalledWith('Successfully ignored 2 videos');
      expect(props.selection.clearChecked).toHaveBeenCalledTimes(1);
      expect(props.refetchTabStats).toHaveBeenCalledTimes(1);
    });

    test('uses its own message when the server sends none', async () => {
      serverAnswers({});
      const { result } = renderActions({ checkedBoxes: ['one', 'two'] });

      await act(() => result.current.ignoreSelected());

      expect(props.notify).toHaveBeenCalledWith('Successfully ignored 2 videos');
    });

    test('puts each row back as it was and keeps the selection when the server refuses', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockPost.mockRejectedValue(serverError);
      const { result } = renderActions({ checkedBoxes: ['one', 'two'] });

      await act(() => result.current.ignoreSelected());

      expect(props.setIgnored).toHaveBeenLastCalledWith({ one: false, two: true });
      expect(props.notify).toHaveBeenCalledWith('Failed to bulk ignore videos', 'error');
      expect(props.selection.clearChecked).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    test('logs the failure without the request and its session token', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockPost.mockRejectedValue(serverError);
      const { result } = renderActions({ checkedBoxes: ['one'] });

      await act(() => result.current.ignoreSelected());

      expect(consoleError).toHaveBeenCalledWith('Error bulk ignoring:', {
        message: 'Request failed with status code 500',
        status: 500,
      });
      consoleError.mockRestore();
    });

    test('reports an error when nothing is selected', async () => {
      const { result } = renderActions();

      await act(() => result.current.ignoreSelected());

      expect(mockPost).not.toHaveBeenCalled();
      expect(props.notify).toHaveBeenCalledWith('No videos selected to ignore', 'error');
    });
  });
});
