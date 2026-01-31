import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DownloadFormatConfigIndicator from '../DownloadFormatConfigIndicator';
import { renderWithProviders } from '../../../../../test-utils';

describe('DownloadFormatConfigIndicator', () => {
  test('shows only video icon when audioFormat is null (default)', () => {
    renderWithProviders(<DownloadFormatConfigIndicator audioFormat={null} />);

    expect(screen.getByTestId('video-format-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('audio-format-icon')).not.toBeInTheDocument();
  });

  test('shows only video icon when audioFormat is undefined', () => {
    renderWithProviders(<DownloadFormatConfigIndicator audioFormat={undefined} />);

    expect(screen.getByTestId('video-format-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('audio-format-icon')).not.toBeInTheDocument();
  });

  test('shows both video and audio icons when audioFormat is video_mp3', () => {
    renderWithProviders(<DownloadFormatConfigIndicator audioFormat="video_mp3" />);

    expect(screen.getByTestId('video-format-icon')).toBeInTheDocument();
    expect(screen.getByTestId('audio-format-icon')).toBeInTheDocument();
  });

  test('shows only audio icon when audioFormat is mp3_only', () => {
    renderWithProviders(<DownloadFormatConfigIndicator audioFormat="mp3_only" />);

    expect(screen.queryByTestId('video-format-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('audio-format-icon')).toBeInTheDocument();
  });

  test('renders container with correct testid', () => {
    renderWithProviders(<DownloadFormatConfigIndicator audioFormat={null} />);

    expect(screen.getByTestId('download-format-config-indicator')).toBeInTheDocument();
  });
});
