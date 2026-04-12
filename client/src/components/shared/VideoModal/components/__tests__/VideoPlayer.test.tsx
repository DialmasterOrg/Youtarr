import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { VideoModalData } from '../../types';

// Mock MUI icons to lightweight spans
jest.mock('@mui/icons-material/PlayArrow', () => ({
  __esModule: true,
  default: function MockPlayArrowIcon() {
    const React = require('react');
    return React.createElement('span', { 'data-testid': 'PlayArrowIcon' });
  },
}));

jest.mock('@mui/icons-material/CloudOff', () => ({
  __esModule: true,
  default: function MockCloudOffIcon() {
    const React = require('react');
    return React.createElement('span', { 'data-testid': 'CloudOffIcon' });
  },
}));

jest.mock('@mui/icons-material/Download', () => ({
  __esModule: true,
  default: function MockDownloadIcon() {
    const React = require('react');
    return React.createElement('span', { 'data-testid': 'DownloadIcon' });
  },
}));

jest.mock('@mui/icons-material/Block', () => ({
  __esModule: true,
  default: function MockBlockIcon() {
    const React = require('react');
    return React.createElement('span', { 'data-testid': 'BlockIcon' });
  },
}));

jest.mock('@mui/icons-material/InfoOutlined', () => ({
  __esModule: true,
  default: function MockInfoOutlinedIcon() {
    const React = require('react');
    return React.createElement('span', { 'data-testid': 'InfoOutlinedIcon' });
  },
}));

jest.mock('@mui/icons-material/Stop', () => ({
  __esModule: true,
  default: function MockStopIcon() {
    const React = require('react');
    return React.createElement('span', { 'data-testid': 'StopIcon' });
  },
}));

jest.mock('@mui/icons-material/WarningAmber', () => ({
  __esModule: true,
  default: function MockWarningAmberIcon() {
    const React = require('react');
    return React.createElement('span', { 'data-testid': 'WarningAmberIcon' });
  },
}));

import VideoPlayer from '../VideoPlayer';

const theme = createTheme();

const downloadedVideo: VideoModalData = {
  youtubeId: 'abc123',
  title: 'Test Video',
  channelName: 'Test Channel',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  duration: 300,
  publishedAt: '2024-06-01',
  addedAt: '2024-06-02',
  mediaType: 'video',
  status: 'downloaded',
  isDownloaded: true,
  filePath: '/videos/test.mp4',
  fileSize: 5242880,
  audioFilePath: null,
  audioFileSize: null,
  isProtected: false,
  isIgnored: false,
  normalizedRating: null,
  ratingSource: null,
  databaseId: 1,
  channelId: 'UC_test',
};

function renderPlayer(
  videoOverride?: Partial<VideoModalData>,
  propsOverride?: { token?: string | null; isMobile?: boolean }
) {
  const video = videoOverride
    ? { ...downloadedVideo, ...videoOverride }
    : downloadedVideo;

  const defaultProps = {
    video,
    token: 'my-test-token',
    onDownloadClick: jest.fn(),
    isMobile: false,
    ...propsOverride,
  };

  return {
    ...render(
      <ThemeProvider theme={theme}>
        <VideoPlayer {...defaultProps} />
      </ThemeProvider>
    ),
    onDownloadClick: defaultProps.onDownloadClick,
  };
}

describe('VideoPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders thumbnail with play overlay for a downloaded video', () => {
    renderPlayer();

    expect(screen.getByRole('img', { name: 'Test Video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
  });

  test('renders "not downloaded" state with download button', () => {
    renderPlayer({
      status: 'never_downloaded',
      isDownloaded: false,
      filePath: null,
      fileSize: null,
    });

    expect(screen.getByRole('button', { name: /download video/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play video' })).not.toBeInTheDocument();
  });

  test('renders "ignored" state with block icon and label', () => {
    renderPlayer({
      status: 'ignored',
      isDownloaded: false,
      isIgnored: true,
      filePath: null,
      fileSize: null,
    });

    expect(screen.getByText('Ignored')).toBeInTheDocument();
    expect(screen.getByTestId('BlockIcon')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play video' })).not.toBeInTheDocument();
  });

  test('renders "missing file" state with warning and re-download button', () => {
    renderPlayer({
      status: 'missing',
      isDownloaded: true,
    });

    expect(screen.getByText('File Missing')).toBeInTheDocument();
    expect(screen.getByTestId('WarningAmberIcon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-download video/i })).toBeInTheDocument();
  });

  test('clicking play enters playback mode with correct stream URL', async () => {
    const user = userEvent.setup();
    renderPlayer();

    await user.click(screen.getByRole('button', { name: 'Play video' }));

    // Playback mode: stop button visible, play button and thumbnail gone
    expect(screen.getByRole('button', { name: 'Stop playback' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play video' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Test Video' })).not.toBeInTheDocument();

    // Verify the stream URL includes the video ID and properly encoded token
    const videoEl = screen.getByTestId('video-stream-element');
    expect(videoEl).toHaveAttribute(
      'src',
      '/api/videos/abc123/stream?token=my-test-token'
    );
  });

  test('stream error shows fallback UI with YouTube link', async () => {
    const user = userEvent.setup();
    renderPlayer();

    // Start playback
    await user.click(screen.getByRole('button', { name: 'Play video' }));

    // Trigger error on the video element via its data-testid
    const videoEl = screen.getByTestId('video-stream-element');
    fireEvent.error(videoEl);

    // Error fallback should appear
    await waitFor(() => {
      expect(screen.getByText('Unable to stream video')).toBeInTheDocument();
    });

    const youtubeLink = screen.getByRole('link', { name: 'Open on YouTube' });
    expect(youtubeLink).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=abc123'
    );
  });

  test('state resets when video.youtubeId changes', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <VideoPlayer
          video={downloadedVideo}
          token="my-test-token"
          onDownloadClick={jest.fn()}
          isMobile={false}
        />
      </ThemeProvider>
    );

    // Start playback
    await user.click(screen.getByRole('button', { name: 'Play video' }));
    expect(screen.getByRole('button', { name: 'Stop playback' })).toBeInTheDocument();

    // Rerender with a different youtubeId
    const newVideo: VideoModalData = {
      ...downloadedVideo,
      youtubeId: 'xyz789',
      title: 'Different Video',
    };

    rerender(
      <ThemeProvider theme={theme}>
        <VideoPlayer
          video={newVideo}
          token="my-test-token"
          onDownloadClick={jest.fn()}
          isMobile={false}
        />
      </ThemeProvider>
    );

    // useEffect resets playbackStarted and streamError, so thumbnail + play button return
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Stop playback' })).not.toBeInTheDocument();
  });
});
