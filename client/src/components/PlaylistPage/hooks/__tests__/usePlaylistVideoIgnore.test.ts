import { act, renderHook } from '@testing-library/react';
import { usePlaylistVideoIgnore } from '../usePlaylistVideoIgnore';
import { PlaylistVideo } from '../../../../types/playlist';

const mockIgnoreVideo = jest.fn();
const mockUnignoreVideo = jest.fn();
const mockIgnoreVideos = jest.fn();
const mockRunPendingRefresh = jest.fn();

jest.mock('../../../../hooks/usePlaylistMutations', () => ({
  usePlaylistMutations: () => ({
    ignoreVideo: mockIgnoreVideo,
    unignoreVideo: mockUnignoreVideo,
    ignoreVideos: mockIgnoreVideos,
    runPendingRefresh: mockRunPendingRefresh,
  }),
}));

const makeVideo = (youtubeId: string, overrides: Partial<PlaylistVideo> = {}): PlaylistVideo => ({
  id: 1,
  playlist_id: 'PL1',
  youtube_id: youtubeId,
  position: 1,
  added_at: null,
  channel_id: null,
  ignored: false,
  ignored_at: null,
  title: youtubeId,
  channel_name: null,
  duration: null,
  published_at: null,
  thumbnail: null,
  downloaded: false,
  previously_downloaded: false,
  youtube_removed: false,
  video_id: null,
  file_path: null,
  file_size: null,
  audio_file_path: null,
  audio_file_size: null,
  ...overrides,
});

const videos = [
  makeVideo('new1'),
  makeVideo('new2'),
  makeVideo('onDisk', { downloaded: true }),
  makeVideo('missing', { previously_downloaded: true, removed_reason: 'not_found' }),
  makeVideo('deleted', { previously_downloaded: true, removed_reason: 'user_deleted' }),
  makeVideo('ignored', { ignored: true }),
];
const defaultVideosById = new Map(videos.map((v) => [v.youtube_id, v]));

describe('usePlaylistVideoIgnore', () => {
  const markVideosIgnored = jest.fn();
  const refetchMeta = jest.fn().mockResolvedValue(undefined);
  const notify = jest.fn();
  const onBulkIgnored = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIgnoreVideo.mockResolvedValue(true);
    mockUnignoreVideo.mockResolvedValue(true);
    // Resolves to how many videos were newly ignored.
    mockIgnoreVideos.mockImplementation((_playlistId: string, ids: string[]) => Promise.resolve(ids.length));
  });

  const renderIgnore = (playlistId: string | null = 'PL1', videosById = defaultVideosById) =>
    renderHook(
      ({ id }: { id: string | null }) =>
        usePlaylistVideoIgnore({
          token: 't',
          playlistId: id,
          videosById,
          markVideosIgnored,
          refetchMeta,
          notify,
          onBulkIgnored,
        }),
      { initialProps: { id: playlistId } }
    );

  describe('one video', () => {
    test('ignores the video, updates its row and refreshes the counts', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        await result.current.ignoreOne('new1');
      });

      expect(mockIgnoreVideo).toHaveBeenCalledWith('PL1', 'new1');
      expect(markVideosIgnored).toHaveBeenCalledWith(['new1'], true);
      expect(refetchMeta).toHaveBeenCalled();
    });

    test('says a never-downloaded video will not be downloaded', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        await result.current.ignoreOne('new1');
      });

      expect(notify).toHaveBeenCalledWith("Ignored for this playlist. It won't be downloaded with this playlist.");
    });

    test('says the playlist outputs will update for a downloaded video', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        await result.current.ignoreOne('onDisk');
      });

      expect(notify).toHaveBeenCalledWith(
        'Ignored for this playlist. The .m3u file and any synced server playlists will update shortly; no file is deleted.'
      );
    });

    test('says the playlist outputs will update for a video whose file is missing', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        await result.current.ignoreOne('missing');
      });

      expect(notify).toHaveBeenCalledWith(expect.stringContaining('will update shortly'));
    });

    test('drops the result when the page moved to another playlist meanwhile', async () => {
      let finish: (ok: boolean) => void = () => {};
      mockIgnoreVideo.mockReturnValue(new Promise<boolean>((resolve) => { finish = resolve; }));
      const { result, rerender } = renderIgnore();
      let request: Promise<void> = Promise.resolve();
      act(() => {
        request = result.current.ignoreOne('new1');
      });

      rerender({ id: 'PL2' });
      await act(async () => {
        finish(true);
        await request;
      });

      expect(markVideosIgnored).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
      expect(refetchMeta).not.toHaveBeenCalled();
    });

    test('unignores the video and updates its row', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        await result.current.unignoreOne('ignored');
      });

      expect(mockUnignoreVideo).toHaveBeenCalledWith('PL1', 'ignored');
      expect(markVideosIgnored).toHaveBeenCalledWith(['ignored'], false);
      expect(notify).toHaveBeenCalledWith('No longer ignored. It can be downloaded with this playlist again.');
    });

    test('reports a failure and leaves the row alone', async () => {
      mockIgnoreVideo.mockResolvedValue(false);
      const { result } = renderIgnore();

      await act(async () => {
        await result.current.ignoreOne('new1');
      });

      expect(notify).toHaveBeenCalledWith('Could not ignore the video. Please retry.', 'error');
      expect(markVideosIgnored).not.toHaveBeenCalled();
    });

    test('does nothing before the playlist has loaded', async () => {
      const { result } = renderIgnore(null);

      await act(async () => {
        await result.current.ignoreOne('new1');
      });

      expect(mockIgnoreVideo).not.toHaveBeenCalled();
    });
  });

  describe('a selection', () => {
    test('ignores never-downloaded videos at once', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        result.current.requestBulkIgnore(['new1', 'new2']);
      });

      expect(result.current.dialogOpen).toBe(false);
      expect(mockIgnoreVideos).toHaveBeenCalledWith('PL1', ['new1', 'new2']);
      expect(markVideosIgnored).toHaveBeenCalledWith(['new1', 'new2'], true);
      expect(notify).toHaveBeenCalledWith("Ignored 2 videos. They won't be downloaded with this playlist.");
      expect(onBulkIgnored).toHaveBeenCalled();
    });

    test('words the message for a single video', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        result.current.requestBulkIgnore(['new1']);
      });

      expect(notify).toHaveBeenCalledWith("Ignored 1 video. It won't be downloaded with this playlist.");
    });

    test('asks first when a downloaded video is selected', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        result.current.requestBulkIgnore(['new1', 'onDisk']);
      });

      expect(result.current.dialogOpen).toBe(true);
      expect(result.current.confirmCount).toBe(2);
      expect(result.current.confirmListedCount).toBe(1);
      expect(mockIgnoreVideos).not.toHaveBeenCalled();
    });

    test('asks first for a video whose file is missing, since it is still listed', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        result.current.requestBulkIgnore(['missing']);
      });

      expect(result.current.dialogOpen).toBe(true);
      expect(result.current.confirmListedCount).toBe(1);
      expect(mockIgnoreVideos).not.toHaveBeenCalled();
    });

    test('does not ask for a video the user deleted, which is listed nowhere', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        result.current.requestBulkIgnore(['deleted']);
      });

      expect(result.current.dialogOpen).toBe(false);
      expect(mockIgnoreVideos).toHaveBeenCalledWith('PL1', ['deleted']);
      expect(notify).toHaveBeenCalledWith("Ignored 1 video. It won't be downloaded with this playlist.");
    });

    test('ignores the selection once confirmed and says the outputs will update', async () => {
      const { result } = renderIgnore();
      await act(async () => {
        result.current.requestBulkIgnore(['new1', 'onDisk']);
      });

      await act(async () => {
        result.current.confirmBulkIgnore();
      });

      expect(result.current.dialogOpen).toBe(false);
      expect(mockIgnoreVideos).toHaveBeenCalledWith('PL1', ['new1', 'onDisk']);
      expect(notify).toHaveBeenCalledWith(
        'Ignored 2 videos. The .m3u file and any synced server playlists will update shortly; no file is deleted.'
      );
    });

    test('reports how many the server newly ignored, not how many were sent', async () => {
      mockIgnoreVideos.mockResolvedValue(1);
      const { result } = renderIgnore();

      await act(async () => {
        result.current.requestBulkIgnore(['new1', 'new2']);
      });

      expect(notify).toHaveBeenCalledWith("Ignored 1 video. It won't be downloaded with this playlist.");
      expect(markVideosIgnored).toHaveBeenCalledWith(['new1', 'new2'], true);
    });

    test('says so when another session had already ignored them all', async () => {
      mockIgnoreVideos.mockResolvedValue(0);
      const { result } = renderIgnore();

      await act(async () => {
        result.current.requestBulkIgnore(['new1', 'new2']);
      });

      expect(notify).toHaveBeenCalledWith('Those videos were already ignored.');
      expect(onBulkIgnored).toHaveBeenCalled();
    });

    describe('larger than one request allows', () => {
      const BATCH = 1000;
      const manyIds = Array.from({ length: BATCH + 1 }, (_, i) => `v${i}`);
      const manyById = new Map(manyIds.map((id) => [id, makeVideo(id)]));

      test('sends the videos in batches', async () => {
        const { result } = renderIgnore('PL1', manyById);

        await act(async () => {
          result.current.requestBulkIgnore(manyIds);
        });

        expect(mockIgnoreVideos).toHaveBeenCalledTimes(2);
        expect(mockIgnoreVideos).toHaveBeenNthCalledWith(1, 'PL1', manyIds.slice(0, BATCH));
        expect(mockIgnoreVideos).toHaveBeenNthCalledWith(2, 'PL1', manyIds.slice(BATCH));
        expect(notify).toHaveBeenCalledWith(`Ignored ${BATCH + 1} videos. They won't be downloaded with this playlist.`);
        expect(onBulkIgnored).toHaveBeenCalledTimes(1);
      });

      test('keeps what a finished batch ignored and the selection when a later one fails', async () => {
        mockIgnoreVideos.mockResolvedValueOnce(BATCH).mockResolvedValueOnce(null);
        const { result } = renderIgnore('PL1', manyById);

        await act(async () => {
          result.current.requestBulkIgnore(manyIds);
        });

        expect(markVideosIgnored).toHaveBeenCalledWith(manyIds.slice(0, BATCH), true);
        expect(notify).toHaveBeenCalledWith(
          `Ignored ${BATCH} videos, then a request failed. Retry to ignore the rest.`,
          'error'
        );
        expect(onBulkIgnored).not.toHaveBeenCalled();
        expect(refetchMeta).toHaveBeenCalled();
      });
    });

    test('drops the result when the page moved to another playlist meanwhile', async () => {
      let finish: (count: number) => void = () => {};
      mockIgnoreVideos.mockReturnValue(new Promise<number>((resolve) => { finish = resolve; }));
      const { result, rerender } = renderIgnore();
      act(() => {
        result.current.requestBulkIgnore(['new1']);
      });

      rerender({ id: 'PL2' });
      await act(async () => {
        finish(1);
      });

      expect(markVideosIgnored).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
      expect(onBulkIgnored).not.toHaveBeenCalled();
      expect(refetchMeta).not.toHaveBeenCalled();
    });

    test('cancelling closes the confirmation without ignoring', async () => {
      const { result } = renderIgnore();
      await act(async () => {
        result.current.requestBulkIgnore(['onDisk']);
      });

      act(() => result.current.cancelBulkIgnore());

      expect(result.current.dialogOpen).toBe(false);
      expect(mockIgnoreVideos).not.toHaveBeenCalled();
    });

    test('leaves out videos that are already ignored or not in the list', async () => {
      const { result } = renderIgnore();

      await act(async () => {
        result.current.requestBulkIgnore(['new1', 'ignored', 'unknown']);
      });

      expect(mockIgnoreVideos).toHaveBeenCalledWith('PL1', ['new1']);
    });

    test('can ignore only a selection with a video that is not ignored yet', () => {
      const { result } = renderIgnore();

      expect(result.current.canBulkIgnore(['new1', 'ignored'])).toBe(true);
      expect(result.current.canBulkIgnore(['ignored'])).toBe(false);
      expect(result.current.canBulkIgnore([])).toBe(false);
    });

    test('reports a failure without clearing the selection', async () => {
      mockIgnoreVideos.mockResolvedValue(null);
      const { result } = renderIgnore();

      await act(async () => {
        result.current.requestBulkIgnore(['new1']);
      });

      expect(notify).toHaveBeenCalledWith('Could not ignore the selected videos. Please retry.', 'error');
      expect(markVideosIgnored).not.toHaveBeenCalled();
      expect(onBulkIgnored).not.toHaveBeenCalled();
    });
  });

  describe('leaving the page', () => {
    test('starts the waiting refresh after an ignore change', async () => {
      const { result, unmount } = renderIgnore();
      await act(async () => {
        await result.current.ignoreOne('onDisk');
      });

      unmount();

      expect(mockRunPendingRefresh).toHaveBeenCalledWith('PL1');
    });

    test('starts the waiting refresh after a bulk ignore', async () => {
      const { result, unmount } = renderIgnore();
      await act(async () => {
        result.current.requestBulkIgnore(['new1']);
      });

      unmount();

      expect(mockRunPendingRefresh).toHaveBeenCalledWith('PL1');
    });

    test('asks for nothing when no video was ignored or unignored', () => {
      const { unmount } = renderIgnore();

      unmount();

      expect(mockRunPendingRefresh).not.toHaveBeenCalled();
    });

    test('asks for nothing after a failed change', async () => {
      mockIgnoreVideo.mockResolvedValue(false);
      const { result, unmount } = renderIgnore();
      await act(async () => {
        await result.current.ignoreOne('onDisk');
      });

      unmount();

      expect(mockRunPendingRefresh).not.toHaveBeenCalled();
    });

    test('starts it for the playlist that changed when the page moves to another', async () => {
      const { result, rerender } = renderIgnore();
      await act(async () => {
        await result.current.ignoreOne('onDisk');
      });

      rerender({ id: 'PL2' });

      expect(mockRunPendingRefresh).toHaveBeenCalledTimes(1);
      expect(mockRunPendingRefresh).toHaveBeenCalledWith('PL1');
    });
  });
});
