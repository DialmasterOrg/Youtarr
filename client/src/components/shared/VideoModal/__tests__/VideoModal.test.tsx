import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoModalData } from '../types';

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
}));

const axios = require('axios');

// Mock useVideoMetadata - uses a ref object so resetMocks doesn't clear the return value
const videoMetadataReturn = {
  metadata: null as null,
  loading: false,
  error: null as string | null,
};
jest.mock('../hooks/useVideoMetadata', () => ({
  useVideoMetadata: () => videoMetadataReturn,
}));

// Mock useWatchStatus - it fires its own axios.get('/watch-status') call, which
// would interleave with (and steal from) the channel-settings axios.get queue
// used throughout the add-channel-affordance tests below. Isolate it here the
// same way useVideoMetadata is isolated above, with a mutable return object so
// individual tests can provide statuses, and a call log so the wiring from the
// modal into the hook stays covered.
const watchStatusReturn = {
  statuses: [] as Array<{
    server: string;
    played: boolean;
    playCount: number;
    percentWatched: number | null;
    lastWatchedAt: string | null;
    lastSyncedAt: string | null;
  }>,
  loading: false,
};
const watchStatusCalls: unknown[][] = [];
jest.mock('../hooks/useWatchStatus', () => ({
  useWatchStatus: (...args: unknown[]) => {
    watchStatusCalls.push(args);
    return watchStatusReturn;
  },
}));

// Mock useVideoProtection - use plain object refs to survive resetMocks
const mockToggleProtection = jest.fn();
const protectionReturn = {
  get toggleProtection() { return mockToggleProtection; },
  loading: false,
  error: null as string | null,
  successMessage: null as string | null,
  clearMessages: () => {},
};
jest.mock('../../useVideoProtection', () => ({
  useVideoProtection: () => protectionReturn,
}));

// Mock useVideoDeletion
const mockDeleteVideosByYoutubeIds = jest.fn();
const deletionReturn = {
  deleteVideos: () => Promise.resolve({ success: true, deleted: [], failed: [] }),
  get deleteVideosByYoutubeIds() { return mockDeleteVideosByYoutubeIds; },
  loading: false,
  error: null as string | null,
};
jest.mock('../../useVideoDeletion', () => ({
  useVideoDeletion: () => deletionReturn,
}));

// Mock useTriggerDownloads
const mockTriggerDownloads = jest.fn();
jest.mock('../../../../hooks/useTriggerDownloads', () => ({
  useTriggerDownloads: () => ({
    get triggerDownloads() { return mockTriggerDownloads; },
    loading: false,
    error: null,
  }),
}));

// Mock react-router-dom useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock sub-components that don't need full rendering
jest.mock('../components/VideoPlayer', () => ({
  __esModule: true,
  default: function MockVideoPlayer() {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'video-player' }, 'VideoPlayer');
  },
}));

jest.mock('../components/VideoMetadata', () => ({
  __esModule: true,
  default: function MockVideoMetadata(props: { onAddChannel?: () => void }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'video-metadata' },
      props.onAddChannel
        ? React.createElement('button', { 'data-testid': 'add-channel-affordance', onClick: props.onAddChannel }, 'Add channel')
        : null
    );
  },
}));

jest.mock('../../AddChannelDialog', () => ({
  __esModule: true,
  default: function MockAddChannelDialog(props: { open: boolean; channelName: string; channelUrl: string }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', { 'data-testid': 'add-channel-dialog' }, `${props.channelName}|${props.channelUrl}`);
  },
}));

jest.mock('../components/VideoTechnical', () => ({
  __esModule: true,
  default: function MockVideoTechnical() {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'video-technical' }, 'VideoTechnical');
  },
}));

jest.mock('../../DeleteVideosDialog', () => ({
  __esModule: true,
  default: function MockDeleteDialog(props: { open: boolean; onConfirm: () => void; onClose: () => void }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', { 'data-testid': 'delete-dialog' },
      React.createElement('button', { 'data-testid': 'confirm-delete', onClick: props.onConfirm }, 'Confirm Delete'),
      React.createElement('button', { 'data-testid': 'cancel-delete', onClick: props.onClose }, 'Cancel')
    );
  },
}));

jest.mock('../../../DownloadManager/ManualDownload/DownloadSettingsDialog', () => ({
  __esModule: true,
  default: function MockDownloadDialog(props: { open: boolean; onConfirm: (settings: null) => void; onClose: () => void; missingVideoCount?: number }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', { 'data-testid': 'download-dialog' },
      React.createElement('div', { 'data-testid': 'download-dialog-missing-count' }, String(props.missingVideoCount)),
      React.createElement('button', { 'data-testid': 'confirm-download', onClick: () => props.onConfirm(null) }, 'Confirm Download'),
    );
  },
}));

jest.mock('../../ChangeRatingDialog', () => ({
  __esModule: true,
  default: function MockRatingDialog(props: { open: boolean; onApply: (rating: string | null) => Promise<void>; onClose: () => void }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', { 'data-testid': 'rating-dialog' },
      React.createElement('button', {
        'data-testid': 'apply-rating',
        onClick: () => props.onApply('PG-13'),
      }, 'Apply PG-13'),
      React.createElement('button', {
        'data-testid': 'clear-rating',
        onClick: () => props.onApply(null),
      }, 'Clear Rating'),
    );
  },
}));

jest.mock('../../RatingBadge', () => ({
  __esModule: true,
  default: function MockRatingBadge(props: { rating: string | null; showNA?: boolean; onClick?: () => void; ariaLabel?: string }) {
    const React = require('react');
    const label = props.rating || (props.showNA ? 'Unrated' : null);
    return label
      ? React.createElement(
          props.onClick ? 'button' : 'span',
          {
            'data-testid': 'rating-badge',
            onClick: props.onClick,
            'aria-label': props.ariaLabel,
            type: props.onClick ? 'button' : undefined,
          },
          label
        )
      : null;
  },
}));

import { MemoryRouter } from 'react-router-dom';
import VideoModal from '../index';

const baseVideo: VideoModalData = {
  youtubeId: 'test123',
  title: 'Test Video Title',
  channelName: 'Test Channel',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  duration: 120,
  publishedAt: '2024-01-15',
  addedAt: '2024-01-16',
  mediaType: 'video',
  status: 'downloaded',
  isDownloaded: true,
  filePath: '/videos/test.mp4',
  fileSize: 1024000,
  audioFilePath: null,
  audioFileSize: null,
  isProtected: false,
  isIgnored: false,
  normalizedRating: null,
  ratingSource: null,
  databaseId: 42,
  channelId: 'UC123',
};

const neverDownloadedVideo: VideoModalData = {
  ...baseVideo,
  status: 'never_downloaded',
  isDownloaded: false,
  filePath: null,
  fileSize: null,
};

function renderModal(props: Partial<React.ComponentProps<typeof VideoModal>> = {}) {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    video: baseVideo,
    token: 'test-token',
  };

  return render(
    <MemoryRouter>
      <VideoModal {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe('VideoModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    protectionReturn.error = null;
    mockTriggerDownloads.mockResolvedValue(true);
    // Reset shared metadata mock so tests don't bleed
    videoMetadataReturn.metadata = null;
    videoMetadataReturn.loading = false;
    videoMetadataReturn.error = null;
    watchStatusReturn.statuses = [];
    watchStatusReturn.loading = false;
    watchStatusCalls.length = 0;
  });

  test('renders video title when open', () => {
    renderModal();
    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
  });

  test('renders status chip', () => {
    renderModal();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  describe('watch status section', () => {
    test('requests watch status for the opened downloaded video', () => {
      renderModal();
      expect(
        watchStatusCalls.some((args) => args[0] === 'test123' && args[1] === 'test-token')
      ).toBe(true);
    });

    test('does not request watch status for a never-downloaded video', () => {
      renderModal({ video: neverDownloadedVideo });
      expect(watchStatusCalls.every((args) => args[0] === '')).toBe(true);
    });

    test('renders per-server watch status when the hook returns data', () => {
      watchStatusReturn.statuses = [
        {
          server: 'plex',
          played: true,
          playCount: 1,
          percentWatched: 100,
          lastWatchedAt: '2026-07-10T12:00:00Z',
          lastSyncedAt: '2026-07-16T00:00:00Z',
        },
      ];

      renderModal();

      expect(screen.getByText('Watch Status')).toBeInTheDocument();
      expect(screen.getByText('Plex')).toBeInTheDocument();
      expect(screen.getByText(/Watched/)).toBeInTheDocument();
    });

    test('renders no watch status section when there are no statuses', () => {
      renderModal();
      expect(screen.queryByText('Watch Status')).not.toBeInTheDocument();
    });
  });

  test('promotes status to Members Only when metadata reports subscriber_only', () => {
    // Simulate the first-open case: video prop has stale availability (the
    // channelvideos row hadn't been stamped yet), but the metadata fetch
    // detected members-only and the backend overrode the response.
    videoMetadataReturn.metadata = {
      availability: 'subscriber_only',
    } as unknown as typeof videoMetadataReturn.metadata;

    renderModal({ video: neverDownloadedVideo });

    // The members_only status chip label is "Members Only"
    expect(screen.getByText('Members Only')).toBeInTheDocument();
    // And the original 'Not Downloaded' label should NOT be shown
    expect(screen.queryByText('Not Downloaded')).not.toBeInTheDocument();
  });

  test('does not promote when metadata reports public availability', () => {
    videoMetadataReturn.metadata = {
      availability: 'public',
    } as unknown as typeof videoMetadataReturn.metadata;

    renderModal({ video: neverDownloadedVideo });

    expect(screen.queryByText('Members Only')).not.toBeInTheDocument();
    expect(screen.getByText('Not Downloaded')).toBeInTheDocument();
  });

  test('fires onAvailabilityDetected once when promoting to members_only', async () => {
    videoMetadataReturn.metadata = {
      availability: 'subscriber_only',
    } as unknown as typeof videoMetadataReturn.metadata;
    const onAvailabilityDetected = jest.fn();

    const { rerender } = renderModal({
      video: neverDownloadedVideo,
      onAvailabilityDetected,
    });

    await waitFor(() => {
      expect(onAvailabilityDetected).toHaveBeenCalledWith(
        neverDownloadedVideo.youtubeId,
        'subscriber_only',
      );
    });
    expect(onAvailabilityDetected).toHaveBeenCalledTimes(1);

    // A re-render with the same video must not refire.
    rerender(
      <MemoryRouter>
        <VideoModal
          open
          onClose={jest.fn()}
          video={neverDownloadedVideo}
          token="test-token"
          onAvailabilityDetected={onAvailabilityDetected}
        />
      </MemoryRouter>
    );
    expect(onAvailabilityDetected).toHaveBeenCalledTimes(1);
  });

  test('does not fire onAvailabilityDetected when video is already members_only', () => {
    videoMetadataReturn.metadata = {
      availability: 'subscriber_only',
    } as unknown as typeof videoMetadataReturn.metadata;
    const onAvailabilityDetected = jest.fn();

    renderModal({
      video: { ...neverDownloadedVideo, status: 'members_only' },
      onAvailabilityDetected,
    });

    expect(onAvailabilityDetected).not.toHaveBeenCalled();
  });

  test('does not fire onAvailabilityDetected for non-members-only availability', () => {
    videoMetadataReturn.metadata = {
      availability: 'public',
    } as unknown as typeof videoMetadataReturn.metadata;
    const onAvailabilityDetected = jest.fn();

    renderModal({
      video: neverDownloadedVideo,
      onAvailabilityDetected,
    });

    expect(onAvailabilityDetected).not.toHaveBeenCalled();
  });

  test('fires onPublishedDateDetected once with a UTC-midnight ISO date when metadata yields an upload date', async () => {
    videoMetadataReturn.metadata = {
      uploadDate: '20260606',
    } as unknown as typeof videoMetadataReturn.metadata;
    const onPublishedDateDetected = jest.fn();

    const { rerender } = renderModal({ onPublishedDateDetected });

    await waitFor(() => {
      expect(onPublishedDateDetected).toHaveBeenCalledWith(
        baseVideo.youtubeId,
        '2026-06-06T00:00:00.000Z',
      );
    });
    expect(onPublishedDateDetected).toHaveBeenCalledTimes(1);

    // A re-render with the same video must not refire.
    rerender(
      <MemoryRouter>
        <VideoModal
          open
          onClose={jest.fn()}
          video={baseVideo}
          token="test-token"
          onPublishedDateDetected={onPublishedDateDetected}
        />
      </MemoryRouter>
    );
    expect(onPublishedDateDetected).toHaveBeenCalledTimes(1);
  });

  test('does not fire onPublishedDateDetected when metadata has no upload date', () => {
    videoMetadataReturn.metadata = {
      uploadDate: null,
    } as unknown as typeof videoMetadataReturn.metadata;
    const onPublishedDateDetected = jest.fn();

    renderModal({ onPublishedDateDetected });

    expect(onPublishedDateDetected).not.toHaveBeenCalled();
  });

  test('renders a clickable rating chip when rating exists', () => {
    renderModal({
      video: { ...baseVideo, normalizedRating: 'PG-13', ratingSource: 'manual' },
    });

    const ratingButton = screen.getByRole('button', { name: /change rating/i });
    expect(ratingButton).toBeInTheDocument();
    expect(ratingButton).toHaveTextContent('PG-13');
  });

  test('renders delete button for downloaded videos', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  test('hides delete button when the video is not downloaded', () => {
    renderModal({ video: neverDownloadedVideo });
    expect(screen.queryByRole('button', { name: /delete video/i })).not.toBeInTheDocument();
  });

  test('hides delete button when the video file is missing', () => {
    renderModal({
      video: { ...baseVideo, status: 'missing' },
    });
    expect(screen.queryByRole('button', { name: /delete video/i })).not.toBeInTheDocument();
  });

  test('renders ignore button for non-downloaded videos', () => {
    renderModal({ video: neverDownloadedVideo });
    expect(screen.getByRole('button', { name: /ignore/i })).toBeInTheDocument();
  });

  test('passes missingVideoCount 1 to the download dialog for a missing video', () => {
    renderModal({
      video: { ...baseVideo, status: 'missing' },
    });

    fireEvent.click(screen.getByRole('button', { name: /download video/i }));

    expect(screen.getByTestId('download-dialog-missing-count')).toHaveTextContent('1');
  });

  test('passes missingVideoCount 0 to the download dialog for a never-downloaded video', () => {
    renderModal({ video: neverDownloadedVideo });

    fireEvent.click(screen.getByRole('button', { name: /download video/i }));

    expect(screen.getByTestId('download-dialog-missing-count')).toHaveTextContent('0');
  });

  test('calls onClose when close button clicked', async () => {
    const onClose = jest.fn();
    renderModal({ onClose });

    const closeButton = screen.getByRole('button', { name: /close/i });
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not render when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByText('Test Video Title')).not.toBeInTheDocument();
  });

  describe('handleProtectionToggle', () => {
    test('calls toggleProtection and fires onProtectionChanged on success', async () => {
      const onProtectionChanged = jest.fn();
      mockToggleProtection.mockResolvedValueOnce(true);

      renderModal({ onProtectionChanged });

      const protectButton = screen.getByRole('button', { name: /protect from auto-deletion/i });
      await userEvent.click(protectButton);

      await waitFor(() => {
        expect(mockToggleProtection).toHaveBeenCalledWith(42, false);
      });

      await waitFor(() => {
        expect(onProtectionChanged).toHaveBeenCalledWith('test123', true);
      });

      expect(screen.getByText('Video protected from auto-deletion')).toBeInTheDocument();
    });

    test('shows error snackbar and reverts on protection failure', async () => {
      protectionReturn.error = 'Server error';
      mockToggleProtection.mockResolvedValueOnce(undefined);

      renderModal();

      const protectButton = screen.getByRole('button', { name: /protect from auto-deletion/i });
      await userEvent.click(protectButton);

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });
  });

  describe('handleDeleteConfirm', () => {
    test('calls deleteVideosByYoutubeIds and fires onVideoDeleted on success', async () => {
      const onVideoDeleted = jest.fn();
      const onClose = jest.fn();
      mockDeleteVideosByYoutubeIds.mockResolvedValueOnce({
        success: true,
        deleted: ['test123'],
        failed: [],
      });

      renderModal({ onVideoDeleted, onClose });

      // Click the Delete button to open the dialog
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);

      // Confirm the deletion in the dialog
      const confirmButton = screen.getByTestId('confirm-delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteVideosByYoutubeIds).toHaveBeenCalledWith(['test123'], 'test-token');
      });

      await waitFor(() => {
        expect(onVideoDeleted).toHaveBeenCalledWith('test123');
      });

      expect(onClose).toHaveBeenCalled();
    });

    test('shows error snackbar on deletion failure', async () => {
      mockDeleteVideosByYoutubeIds.mockResolvedValueOnce({
        success: false,
        deleted: [],
        failed: [{ youtubeId: 'test123', error: 'Permission denied' }],
      });

      renderModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);

      const confirmButton = screen.getByTestId('confirm-delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Permission denied')).toBeInTheDocument();
      });
    });
  });

  describe('handleIgnoreToggle', () => {
    test('calls ignore API and fires onIgnoreChanged on success', async () => {
      const onIgnoreChanged = jest.fn();
      axios.post.mockResolvedValueOnce({ data: { success: true } });

      renderModal({ video: neverDownloadedVideo, onIgnoreChanged });

      const ignoreButton = screen.getByRole('button', { name: /ignore/i });
      await userEvent.click(ignoreButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          '/api/channels/UC123/videos/test123/ignore',
          undefined,
          { headers: { 'x-access-token': 'test-token' } }
        );
      });

      await waitFor(() => {
        expect(onIgnoreChanged).toHaveBeenCalledWith('test123', true);
      });

      expect(screen.getByText('Video ignored')).toBeInTheDocument();
    });

    test('shows error snackbar on ignore API failure', async () => {
      axios.post.mockRejectedValueOnce({
        response: { data: { error: 'Network error' } },
      });

      renderModal({ video: neverDownloadedVideo });

      const ignoreButton = screen.getByRole('button', { name: /ignore/i });
      await userEvent.click(ignoreButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('handleRatingApply', () => {
    test('calls rating API and fires onRatingChanged on success', async () => {
      const onRatingChanged = jest.fn();
      axios.post.mockResolvedValueOnce({ data: { success: true } });

      renderModal({ onRatingChanged });

      const rateButton = screen.getByRole('button', { name: /change rating/i });
      await userEvent.click(rateButton);

      const applyButton = screen.getByTestId('apply-rating');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          '/api/videos/rating',
          { videoIds: [42], rating: 'PG-13' },
          { headers: { 'x-access-token': 'test-token' } }
        );
      });

      await waitFor(() => {
        expect(onRatingChanged).toHaveBeenCalledWith('test123', 'PG-13');
      });

      expect(screen.getByText('Rating updated')).toBeInTheDocument();
    });

    test('shows error snackbar on rating API failure', async () => {
      axios.post.mockRejectedValueOnce({
        response: { data: { error: 'Rating update failed' } },
      });

      renderModal();

      const rateButton = screen.getByRole('button', { name: /change rating/i });
      await userEvent.click(rateButton);

      const applyButton = screen.getByTestId('apply-rating');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText('Rating update failed')).toBeInTheDocument();
      });
    });

    test('shows error snackbar when video has no databaseId', async () => {
      const videoWithoutDbId = { ...baseVideo, databaseId: null };

      renderModal({ video: videoWithoutDbId });

      const rateButton = screen.getByRole('button', { name: /change rating/i });
      await userEvent.click(rateButton);

      const applyButton = screen.getByTestId('apply-rating');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText('Cannot update rating: video not in database')).toBeInTheDocument();
      });

      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('add-channel affordance', () => {
    test('affordance appears when the settings fetch 404s (unsubscribed channel)', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });

      renderModal({ video: { ...baseVideo, channelId: 'UCx' } });

      expect(await screen.findByTestId('add-channel-affordance')).toBeInTheDocument();
    });

    test('affordance appears when settings return enabled=false (soft-deleted channel)', async () => {
      axios.get.mockResolvedValue({ data: { video_quality: null, enabled: false } });

      renderModal({ video: { ...baseVideo, channelId: 'UCx' } });

      expect(await screen.findByTestId('add-channel-affordance')).toBeInTheDocument();
    });

    test('no affordance when settings return enabled=true (subscribed channel)', async () => {
      axios.get.mockResolvedValue({ data: { video_quality: null, enabled: true } });

      renderModal({ video: { ...baseVideo, channelId: 'UCx' } });

      await waitFor(() => expect(axios.get).toHaveBeenCalled());
      expect(screen.queryByTestId('add-channel-affordance')).not.toBeInTheDocument();
    });

    test('clicking the affordance opens the AddChannelDialog with the channel URL', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });

      renderModal({ video: { ...baseVideo, channelId: 'UCx', channelName: 'Chan X' } });

      fireEvent.click(await screen.findByTestId('add-channel-affordance'));

      expect(screen.getByTestId('add-channel-dialog')).toHaveTextContent(
        'Chan X|https://www.youtube.com/channel/UCx'
      );
    });

    test('switching to a different channel drops the previous affordance until its own fetch resolves', async () => {
      // Video A's channel is unsubscribed (404): affordance shows.
      axios.get.mockRejectedValueOnce({ response: { status: 404 } });
      const { rerender } = renderModal({ video: { ...baseVideo, channelId: 'UCa' } });
      expect(await screen.findByTestId('add-channel-affordance')).toBeInTheDocument();

      // Video B's fetch stays pending: A's 'unsubscribed' state must not leak
      // into B while B's request is in flight.
      let resolveB: (v: unknown) => void = () => {};
      axios.get.mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));
      rerender(
        <MemoryRouter>
          <VideoModal
            open
            onClose={jest.fn()}
            token="test-token"
            video={{ ...baseVideo, channelId: 'UCb' }}
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('add-channel-affordance')).not.toBeInTheDocument();

      // B resolves as subscribed: still no affordance.
      await act(async () => {
        resolveB({ data: { video_quality: null, enabled: true } });
      });
      expect(screen.queryByTestId('add-channel-affordance')).not.toBeInTheDocument();
    });

    test('a failed non-404 fetch after switching channels does not inherit the previous unsubscribed state', async () => {
      axios.get.mockRejectedValueOnce({ response: { status: 404 } });
      const { rerender } = renderModal({ video: { ...baseVideo, channelId: 'UCa' } });
      expect(await screen.findByTestId('add-channel-affordance')).toBeInTheDocument();

      axios.get.mockRejectedValueOnce({ response: { status: 500 } });
      rerender(
        <MemoryRouter>
          <VideoModal
            open
            onClose={jest.fn()}
            token="test-token"
            video={{ ...baseVideo, channelId: 'UCc' }}
          />
        </MemoryRouter>
      );

      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
      expect(screen.queryByTestId('add-channel-affordance')).not.toBeInTheDocument();
    });
  });

});
