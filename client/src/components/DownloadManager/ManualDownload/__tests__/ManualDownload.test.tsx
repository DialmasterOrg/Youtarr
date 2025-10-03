import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import ManualDownload from '../ManualDownload';
import { ValidationResponse } from '../types';

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn()
  }))
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../UrlInput', () => {
  return function MockUrlInput({ onValidate, isValidating, disabled }: any) {
    return (
      <div data-testid="url-input">
        <button
          onClick={() => onValidate('https://youtube.com/watch?v=test123')}
          disabled={isValidating || disabled}
          data-testid="validate-button"
        >
          Validate
        </button>
      </div>
    );
  };
});

jest.mock('../VideoChip', () => {
  return function MockVideoChip({ video, onDelete }: any) {
    return (
      <div data-testid={`video-chip-${video.youtubeId}`}>
        <span>{video.videoTitle}</span>
        <button
          onClick={() => onDelete(video.youtubeId)}
          data-testid={`remove-${video.youtubeId}`}
        >
          Remove
        </button>
      </div>
    );
  };
});

jest.mock('../DownloadSettingsDialog', () => {
  return function MockDownloadSettingsDialog({ open, onClose, onConfirm }: any) {
    if (!open) return null;
    return (
      <div data-testid="download-settings-dialog">
        <button
          onClick={() => onConfirm(null)} // Use default settings
          data-testid="confirm-download"
        >
          Start Download
        </button>
        <button onClick={onClose} data-testid="cancel-download">
          Cancel
        </button>
      </div>
    );
  };
});

describe('ManualDownload', () => {
  const mockOnStartDownload = jest.fn();
  const mockToken = 'test-token';


  const mockValidationResponse: ValidationResponse = {
    isValidUrl: true,
    isAlreadyDownloaded: false,
    isMembersOnly: false,
    metadata: {
      youtubeId: 'test123',
      url: 'https://youtube.com/watch?v=test123',
      channelName: 'Test Channel',
      videoTitle: 'Test Video',
      duration: 300,
      publishedAt: 1234567890,
      media_type: 'video'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the component with initial state', () => {
    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    expect(screen.getByText('Add Videos to Download')).toBeInTheDocument();
    expect(screen.getByText('Paste YouTube video URLs to add to queue')).toBeInTheDocument();
    expect(screen.getByTestId('url-input')).toBeInTheDocument();
    expect(screen.queryByText('Download Queue')).not.toBeInTheDocument();
  });

  test('validates and adds a valid video to the queue', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: mockValidationResponse });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/checkYoutubeVideoURL',
        { url: 'https://youtube.com/watch?v=test123' },
        { headers: { 'x-access-token': mockToken } }
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Download Queue')).toBeInTheDocument();
    });
    expect(screen.getByTestId('video-chip-test123')).toBeInTheDocument();
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('Video added to download list.')).toBeInTheDocument();
  });

  test('shows error for invalid YouTube URL', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { isValidUrl: false }
    });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid YouTube URL. Please check the URL and try again.')).toBeInTheDocument();
    });

    expect(screen.queryByText('Download Queue')).not.toBeInTheDocument();
  });

  test('shows error for members-only videos', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        isValidUrl: true,
        isMembersOnly: true
      }
    });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('This video is members-only and cannot be downloaded.')).toBeInTheDocument();
    });
  });

  test('prevents duplicate videos in the queue', async () => {
    mockedAxios.post.mockResolvedValue({ data: mockValidationResponse });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');

    // First addition
    fireEvent.click(validateButton);
    await waitFor(() => {
      expect(screen.getByTestId('video-chip-test123')).toBeInTheDocument();
    });

    // Try to add the same video again
    fireEvent.click(validateButton);
    await waitFor(() => {
      expect(screen.getByText('This video is already in your download list.')).toBeInTheDocument();
    });

    // Should still only have one video chip
    const videoChips = screen.getAllByTestId('video-chip-test123');
    expect(videoChips).toHaveLength(1);
  });

  test('handles API errors gracefully', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        status: 429
      }
    });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Too many requests. Please wait a moment and try again.')).toBeInTheDocument();
    });
  });

  test('handles custom error messages from API', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        data: { error: 'Custom error message' }
      }
    });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  test('handles generic API errors', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to validate URL. Please try again.')).toBeInTheDocument();
    });
  });

  test('removes video from queue when delete is clicked', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: mockValidationResponse });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByTestId('video-chip-test123')).toBeInTheDocument();
    });

    const removeButton = screen.getByTestId('remove-test123');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('video-chip-test123')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Download Queue')).not.toBeInTheDocument();
  });

  test('clears all videos from queue', async () => {
    // Add multiple videos
    const video1 = { ...mockValidationResponse, metadata: { ...mockValidationResponse.metadata!, youtubeId: 'video1' } };
    const video2 = { ...mockValidationResponse, metadata: { ...mockValidationResponse.metadata!, youtubeId: 'video2' } };

    mockedAxios.post
      .mockResolvedValueOnce({ data: video1 })
      .mockResolvedValueOnce({ data: video2 });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');

    fireEvent.click(validateButton);
    await screen.findByTestId('video-chip-video1');

    fireEvent.click(validateButton);
    await screen.findByTestId('video-chip-video2');

    const clearAllButton = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearAllButton);

    expect(screen.queryByTestId('video-chip-video1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-chip-video2')).not.toBeInTheDocument();
    expect(screen.queryByText('Download Queue')).not.toBeInTheDocument();
  });

  test('starts download with both new and already downloaded videos', async () => {
    const newVideo = mockValidationResponse;
    const downloadedVideo = {
      ...mockValidationResponse,
      isAlreadyDownloaded: true,
      metadata: { ...mockValidationResponse.metadata!, youtubeId: 'downloaded123' }
    };

    mockedAxios.post
      .mockResolvedValueOnce({ data: newVideo })
      .mockResolvedValueOnce({ data: downloadedVideo });

    mockOnStartDownload.mockResolvedValueOnce(undefined);

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');

    // Add new video
    fireEvent.click(validateButton);
    await screen.findByTestId('video-chip-test123');

    // Add already downloaded video - should be added with special message
    fireEvent.click(validateButton);
    await waitFor(() => {
      expect(screen.getByText('Video added to download list (previously downloaded).')).toBeInTheDocument();
    });

    // Should have added the downloaded video to the queue
    expect(screen.getByTestId('video-chip-downloaded123')).toBeInTheDocument();

    const downloadButton = screen.getByRole('button', { name: /download videos/i });
    fireEvent.click(downloadButton);

    // Dialog should open
    await screen.findByTestId('download-settings-dialog');

    // Click confirm in the dialog
    const confirmButton = screen.getByTestId('confirm-download');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnStartDownload).toHaveBeenCalledWith(
        ['https://youtube.com/watch?v=test123', 'https://youtube.com/watch?v=test123'],
        null
      );
    });
    expect(await screen.findByText('Started downloading 2 videos.')).toBeInTheDocument();
  });

  test('allows downloading already downloaded videos', async () => {
    const downloadedVideo = {
      ...mockValidationResponse,
      isAlreadyDownloaded: true
    };

    mockedAxios.post.mockResolvedValueOnce({ data: downloadedVideo });
    mockOnStartDownload.mockResolvedValueOnce(undefined);

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    // Should show success message for already downloaded video
    await waitFor(() => {
      expect(screen.getByText('Video added to download list (previously downloaded).')).toBeInTheDocument();
    });

    // Video should be added to the queue
    expect(screen.getByTestId('video-chip-test123')).toBeInTheDocument();

    // Download Queue section should appear
    expect(screen.getByText('Download Queue')).toBeInTheDocument();

    // Download button should be available
    const downloadButton = screen.getByRole('button', { name: /download videos/i });
    expect(downloadButton).toBeInTheDocument();

    // Start download
    fireEvent.click(downloadButton);
    await screen.findByTestId('download-settings-dialog');
    const confirmButton = screen.getByTestId('confirm-download');
    fireEvent.click(confirmButton);

    // The onStartDownload should be called
    await waitFor(() => {
      expect(mockOnStartDownload).toHaveBeenCalledWith(['https://youtube.com/watch?v=test123'], null);
    });
  });

  test('handles download error', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: mockValidationResponse });
    mockOnStartDownload.mockRejectedValueOnce(new Error('Download failed'));

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await screen.findByTestId('video-chip-test123');

    const downloadButton = screen.getByRole('button', { name: /download videos/i });
    fireEvent.click(downloadButton);

    // Dialog should open
    await screen.findByTestId('download-settings-dialog');

    // Click confirm in the dialog
    const confirmButton = screen.getByTestId('confirm-download');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to start download. Please try again.')).toBeInTheDocument();
    });
  });

  test('disables inputs while downloading', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: mockValidationResponse });

    // Mock the onStartDownload to take some time
    mockOnStartDownload.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await screen.findByTestId('video-chip-test123');

    const downloadButton = screen.getByRole('button', { name: /download videos/i });
    fireEvent.click(downloadButton);

    // Dialog should open
    await screen.findByTestId('download-settings-dialog');

    // Click confirm in the dialog
    const confirmButton = screen.getByTestId('confirm-download');
    fireEvent.click(confirmButton);

    // Check that button shows loading state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /starting/i })).toBeInTheDocument();
    });
    expect(validateButton).toBeDisabled();

    // Wait for download to complete
    await waitFor(() => {
      expect(screen.getByText('Started downloading 1 video.')).toBeInTheDocument();
    });
  });

  test('displays correct video counts', async () => {
    const video1 = { ...mockValidationResponse, metadata: { ...mockValidationResponse.metadata!, youtubeId: 'video1' } };
    const video2 = { ...mockValidationResponse, metadata: { ...mockValidationResponse.metadata!, youtubeId: 'video2' } };
    const downloadedVideo = {
      ...mockValidationResponse,
      isAlreadyDownloaded: true,
      metadata: { ...mockValidationResponse.metadata!, youtubeId: 'downloaded123' }
    };

    mockedAxios.post
      .mockResolvedValueOnce({ data: video1 })
      .mockResolvedValueOnce({ data: video2 })
      .mockResolvedValueOnce({ data: downloadedVideo });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');

    // Add first video
    fireEvent.click(validateButton);
    await screen.findByTestId('video-chip-video1');
    expect(screen.getByText('1 video to download')).toBeInTheDocument();

    // Add second video
    fireEvent.click(validateButton);
    await screen.findByTestId('video-chip-video2');
    expect(screen.getByText('2 videos to download')).toBeInTheDocument();

    // Add already downloaded video - should be added to queue
    fireEvent.click(validateButton);
    await waitFor(() => {
      expect(screen.getByText('Video added to download list (previously downloaded).')).toBeInTheDocument();
    });
    // Count should now be 3
    expect(screen.getByText('3 videos to download')).toBeInTheDocument();

    // All videos should be in the queue
    expect(screen.getByTestId('video-chip-video1')).toBeInTheDocument();
    expect(screen.getByTestId('video-chip-video2')).toBeInTheDocument();
    expect(screen.getByTestId('video-chip-downloaded123')).toBeInTheDocument();
  });

  test('shows download button badge with correct count', async () => {
    const video1 = { ...mockValidationResponse, metadata: { ...mockValidationResponse.metadata!, youtubeId: 'video1' } };
    const video2 = { ...mockValidationResponse, metadata: { ...mockValidationResponse.metadata!, youtubeId: 'video2' } };

    mockedAxios.post
      .mockResolvedValueOnce({ data: video1 })
      .mockResolvedValueOnce({ data: video2 });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');

    fireEvent.click(validateButton);
    await screen.findByTestId('video-chip-video1');

    fireEvent.click(validateButton);
    await screen.findByTestId('video-chip-video2');

    // Check that the download count badge shows "2"
    const badge = screen.getByTestId('download-count-badge');
    expect(badge).toBeInTheDocument();
    const badgeText = within(badge).getByText('2');
    expect(badgeText).toBeInTheDocument();
  });

  test('handles null token', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: mockValidationResponse });

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={null} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/checkYoutubeVideoURL',
        { url: 'https://youtube.com/watch?v=test123' },
        { headers: { 'x-access-token': '' } }
      );
    });
  });

  test('clears queue after successful download', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: mockValidationResponse });
    mockOnStartDownload.mockResolvedValueOnce(undefined);

    render(<ManualDownload onStartDownload={mockOnStartDownload} token={mockToken} />);

    const validateButton = screen.getByTestId('validate-button');
    fireEvent.click(validateButton);

    await screen.findByTestId('video-chip-test123');

    const downloadButton = screen.getByRole('button', { name: /download videos/i });
    fireEvent.click(downloadButton);

    // Dialog should open
    await screen.findByTestId('download-settings-dialog');

    // Click confirm in the dialog
    const confirmButton = screen.getByTestId('confirm-download');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByTestId('video-chip-test123')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Download Queue')).not.toBeInTheDocument();
  });
});
