import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DownloadFormatIndicator from '../DownloadFormatIndicator';

describe('DownloadFormatIndicator', () => {
  describe('Rendering', () => {
    test('returns null when no file paths are provided', () => {
      const { container } = render(<DownloadFormatIndicator />);

      expect(container).toBeEmptyDOMElement();
    });

    test('returns null when file paths are null', () => {
      const { container } = render(
        <DownloadFormatIndicator filePath={null} audioFilePath={null} />
      );

      expect(container).toBeEmptyDOMElement();
    });

    test('renders video chip with the video icon when filePath is provided', () => {
      render(<DownloadFormatIndicator filePath="/videos/test.mp4" fileSize={104857600} />);

      expect(screen.getByText('100MB')).toBeInTheDocument();
      expect(screen.getByTestId('VideoFormatIcon')).toBeInTheDocument();
    });

    test('renders audio chip with the audio icon when audioFilePath is provided', () => {
      render(<DownloadFormatIndicator audioFilePath="/audio/test.mp3" audioFileSize={52428800} />);

      expect(screen.getByText('50MB')).toBeInTheDocument();
      expect(screen.getByTestId('AudioFormatIcon')).toBeInTheDocument();
    });

    test('renders distinct icons for the video and audio chips', () => {
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
      expect(screen.getByTestId('VideoFormatIcon')).toBeInTheDocument();
      expect(screen.getByTestId('AudioFormatIcon')).toBeInTheDocument();
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

  describe('Layout orientation', () => {
    test('lays chips out horizontally by default', () => {
      render(
        <DownloadFormatIndicator
          filePath="/videos/test.mp4"
          fileSize={1073741824}
          audioFilePath="/audio/test.mp3"
          audioFileSize={52428800}
        />
      );

      expect(screen.getByTestId('download-format-indicator')).not.toHaveClass('flex-col');
    });

    test('stacks chips vertically when orientation is vertical', () => {
      render(
        <DownloadFormatIndicator
          filePath="/videos/test.mp4"
          fileSize={1073741824}
          audioFilePath="/audio/test.mp3"
          audioFileSize={52428800}
          orientation="vertical"
        />
      );

      expect(screen.getByTestId('download-format-indicator')).toHaveClass('flex-col');
    });
  });

  describe('Tooltip path', () => {
    test('strips Docker internal path prefix but keeps the filename in the tooltip', async () => {
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

    test('shows the full non-Docker path including the filename in the tooltip', async () => {
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

  describe('Click propagation', () => {
    test('does not bubble a chip click to a parent row/card handler', async () => {
      const user = userEvent.setup();
      const handleParentClick = jest.fn();
      render(
        <div onClick={handleParentClick}>
          <DownloadFormatIndicator filePath="/videos/test.mp4" fileSize={104857600} />
        </div>
      );

      await user.click(screen.getByText('100MB'));

      expect(handleParentClick).not.toHaveBeenCalled();
    });

    test('still lets the parent handler fire for clicks outside the indicator', async () => {
      const user = userEvent.setup();
      const handleParentClick = jest.fn();
      render(
        <div onClick={handleParentClick}>
          <span>elsewhere</span>
          <DownloadFormatIndicator filePath="/videos/test.mp4" fileSize={104857600} />
        </div>
      );

      await user.click(screen.getByText('elsewhere'));

      expect(handleParentClick).toHaveBeenCalledTimes(1);
    });
  });
});
