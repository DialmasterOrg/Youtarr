import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
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
  default: function MockVideoMetadata() {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'video-metadata' }, 'VideoMetadata');
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
  default: function MockDownloadDialog(props: { open: boolean; onConfirm: () => void; onClose: () => void }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', { 'data-testid': 'download-dialog' },
      React.createElement('button', { 'data-testid': 'confirm-download', onClick: props.onConfirm }, 'Confirm Download'),
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
  default: function MockRatingBadge(props: { rating: string | null }) {
    const React = require('react');
    return props.rating
      ? React.createElement('span', { 'data-testid': 'rating-badge' }, props.rating)
      : null;
  },
}));

import VideoModal from '../index';

const theme = createTheme();

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
    <ThemeProvider theme={theme}>
      <VideoModal {...defaultProps} {...props} />
    </ThemeProvider>
  );
}

describe('VideoModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    protectionReturn.error = null;
  });

  test('renders video title when open', () => {
    renderModal();
    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
  });

  test('renders status chip', () => {
    renderModal();
    expect(screen.getByText('Downloaded')).toBeInTheDocument();
  });

  test('renders rating in action button when rating exists', () => {
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

  test('renders ignore button for non-downloaded videos', () => {
    renderModal({ video: neverDownloadedVideo });
    expect(screen.getByRole('button', { name: /ignore/i })).toBeInTheDocument();
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
      await userEvent.click(confirmButton);

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
      await userEvent.click(confirmButton);

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
          '/api/channels/videos/test123/ignore',
          { ignored: true },
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

      // Click the Rate button to open the rating dialog
      const rateButton = screen.getByRole('button', { name: /change rating/i });
      await userEvent.click(rateButton);

      // Apply a rating
      const applyButton = screen.getByTestId('apply-rating');
      await userEvent.click(applyButton);

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
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText('Rating update failed')).toBeInTheDocument();
      });
    });

    test('shows error snackbar when video has no databaseId', async () => {
      const videoWithoutDbId = { ...baseVideo, databaseId: null };
      axios.post.mockResolvedValueOnce({ data: { success: true } });

      renderModal({ video: videoWithoutDbId });

      const rateButton = screen.getByRole('button', { name: /change rating/i });
      await userEvent.click(rateButton);

      const applyButton = screen.getByTestId('apply-rating');
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText('Cannot update rating: video not in database')).toBeInTheDocument();
      });

      // Should not have called the API
      expect(axios.post).not.toHaveBeenCalled();
    });
  });
});
