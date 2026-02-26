import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DownloadFormatConfigIndicator from '../DownloadFormatConfigIndicator';
import { renderWithProviders } from '../../../../../test-utils';

describe('DownloadFormatConfigIndicator', () => {
  test('renders nothing when audioFormat is null (video-only, default)', () => {
    const { container } = renderWithProviders(<DownloadFormatConfigIndicator audioFormat={null} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('video-format-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('audio-format-icon')).not.toBeInTheDocument();
  });

  test('renders nothing when audioFormat is undefined', () => {
    const { container } = renderWithProviders(<DownloadFormatConfigIndicator audioFormat={undefined} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('video-format-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('audio-format-icon')).not.toBeInTheDocument();
  });

  test('shows only audio icon when audioFormat is video_mp3', () => {
    renderWithProviders(<DownloadFormatConfigIndicator audioFormat="video_mp3" />);

    expect(screen.queryByTestId('video-format-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('audio-format-icon')).toBeInTheDocument();
  });

  test('shows only audio icon when audioFormat is mp3_only', () => {
    renderWithProviders(<DownloadFormatConfigIndicator audioFormat="mp3_only" />);

    expect(screen.queryByTestId('video-format-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('audio-format-icon')).toBeInTheDocument();
  });

  test('renders container with correct testid when audio is enabled', () => {
    renderWithProviders(<DownloadFormatConfigIndicator audioFormat="video_mp3" />);

    expect(screen.getByTestId('download-format-config-indicator')).toBeInTheDocument();
  });

  test('does not render container when no audio format (default video-only)', () => {
    renderWithProviders(<DownloadFormatConfigIndicator audioFormat={null} />);

    expect(screen.queryByTestId('download-format-config-indicator')).not.toBeInTheDocument();
  });
});

