import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DownloadFormatIndicator from '../DownloadFormatIndicator';

describe('DownloadFormatIndicator', () => {
  describe('Rendering', () => {
    test('returns null when no file paths are provided', () => {
      const { container } = render(<DownloadFormatIndicator />);

      expect(container.firstChild).toBeNull();
    });

    test('returns null when file paths are null', () => {
      const { container } = render(
        <DownloadFormatIndicator filePath={null} audioFilePath={null} />
      );

      expect(container.firstChild).toBeNull();
    });

    test('renders video chip when filePath is provided', () => {
      render(<DownloadFormatIndicator filePath="/videos/test.mp4" fileSize={104857600} />);

      expect(screen.getByText('100MB')).toBeInTheDocument();
      expect(screen.getByTestId('MovieOutlinedIcon')).toBeInTheDocument();
    });

    test('renders audio chip when audioFilePath is provided', () => {
      render(<DownloadFormatIndicator audioFilePath="/audio/test.mp3" audioFileSize={52428800} />);

      expect(screen.getByText('50MB')).toBeInTheDocument();
      expect(screen.getByTestId('AudiotrackOutlinedIcon')).toBeInTheDocument();
    });

    test('renders both chips when both paths are provided', () => {
      render(
        <DownloadFormatIndicator
          filePath="/videos/test.mp4"
          fileSize={1073741824}
          audioFilePath="/audio/test.mp3"
          audioFileSize={52428800}
        />
      );

      expect(screen.getByText('1.0GB')).toBeInTheDocument();
      expect(screen.getByText('50MB')).toBeInTheDocument();
    });

    test('shows "Unknown" when file size is not provided', () => {
      render(<DownloadFormatIndicator filePath="/videos/test.mp4" />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    test('handles file size as string', () => {
      render(<DownloadFormatIndicator filePath="/videos/test.mp4" fileSize="104857600" />);

      expect(screen.getByText('100MB')).toBeInTheDocument();
    });
  });

  describe('Path stripping', () => {
    test('strips Docker internal path prefix from video path in tooltip', async () => {
      const user = userEvent.setup();
      render(
        <DownloadFormatIndicator
          filePath="/usr/src/app/data/channel/video.mp4"
          fileSize={104857600}
        />
      );

      const chip = screen.getByText('100MB');
      await user.hover(chip);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('channel/video.mp4');
      expect(tooltip).not.toHaveTextContent('/usr/src/app/data/');
    });

    test('preserves non-Docker paths in tooltip', async () => {
      const user = userEvent.setup();
      render(
        <DownloadFormatIndicator
          filePath="/custom/path/video.mp4"
          fileSize={104857600}
        />
      );

      const chip = screen.getByText('100MB');
      await user.hover(chip);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('/custom/path/video.mp4');
    });
  });
});
