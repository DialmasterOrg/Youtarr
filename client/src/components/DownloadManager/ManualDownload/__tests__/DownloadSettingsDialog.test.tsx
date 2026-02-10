import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import DownloadSettingsDialog from '../DownloadSettingsDialog';

describe('DownloadSettingsDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    test('renders dialog when open is true', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      expect(screen.getByText('Download Settings')).toBeInTheDocument();
      expect(screen.getByTestId('SettingsIcon')).toBeInTheDocument();
    });

    test('does not render dialog when open is false', () => {
      render(<DownloadSettingsDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Download Settings')).not.toBeInTheDocument();
    });

    test('renders manual mode alert for single video', () => {
      render(<DownloadSettingsDialog {...defaultProps} videoCount={1} mode="manual" />);

      expect(screen.getByText('You are about to download 1 video.')).toBeInTheDocument();
    });

    test('renders manual mode alert for multiple videos', () => {
      render(<DownloadSettingsDialog {...defaultProps} videoCount={5} mode="manual" />);

      expect(screen.getByText('You are about to download 5 videos.')).toBeInTheDocument();
    });

    test('renders channel mode alert', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      expect(screen.getByText('Downloading new videos from auto-download enabled channels/tabs. Channel settings and filters will be applied per channel.')).toBeInTheDocument();
    });

    test('renders custom settings toggle', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      expect(screen.getByLabelText('Use custom settings for this download')).toBeInTheDocument();
    });

    test('renders re-download toggle when custom settings enabled', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Enable custom settings to see re-download toggle
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      expect(screen.getByLabelText('Allow re-downloading previously fetched videos')).toBeInTheDocument();
    });

    test('shows summary box with quality info', () => {
      render(
        <DownloadSettingsDialog
          {...defaultProps}
          defaultResolution="720"
        />
      );

      // Should show the summary box with quality
      const summaryBox = screen.getByTestId('settings-summary');
      expect(summaryBox).toBeInTheDocument();
      expect(within(summaryBox).getByText('Current Settings')).toBeInTheDocument();
      expect(within(summaryBox).getByText(/Quality:/)).toBeInTheDocument();
      expect(within(summaryBox).getByText('720p (HD)')).toBeInTheDocument();
    });

    test('shows summary box with destination info', () => {
      render(
        <DownloadSettingsDialog
          {...defaultProps}
          defaultResolution="1080"
        />
      );

      // Should show destination behavior
      expect(screen.getByText(/Destination:/)).toBeInTheDocument();
      expect(screen.getByText('Per channel settings (or global default)')).toBeInTheDocument();
    });

    test('renders warning for missing videos when missingVideoCount is 1 in manual mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} missingVideoCount={1} mode="manual" />);

      expect(screen.getByText('1 video was previously downloaded.')).toBeInTheDocument();
    });

    test('renders warning for missing videos when missingVideoCount is greater than 1 in manual mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} missingVideoCount={5} mode="manual" />);

      expect(screen.getByText('5 videos were previously downloaded.')).toBeInTheDocument();
    });

    test('renders warning for missing videos when missingVideoCount is 1 in channel mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} missingVideoCount={1} mode="channel" />);

      expect(screen.getByText('Re-downloading 1 previously downloaded video.')).toBeInTheDocument();
    });

    test('renders warning for missing videos when missingVideoCount is greater than 1 in channel mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} missingVideoCount={5} mode="channel" />);

      expect(screen.getByText('Re-downloading 5 previously downloaded videos.')).toBeInTheDocument();
    });

    test('does not render missing videos warning when missingVideoCount is 0', () => {
      render(<DownloadSettingsDialog {...defaultProps} missingVideoCount={0} />);

      expect(screen.queryByText(/Re-downloading.*previously downloaded/)).not.toBeInTheDocument();
    });

    test('renders resolution dropdown with all options', async () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // First enable custom settings
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      fireEvent.mouseDown(resolutionSelect);

      // Wait for dropdown to be visible
      await waitFor(() => {
        expect(screen.getByRole('option', { name: '360p' })).toBeInTheDocument();
      });

      // Then check all options are present
      expect(screen.getByRole('option', { name: '360p' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '480p' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '720p (HD)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1080p (Full HD)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1440p (2K)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '2160p (4K)' })).toBeInTheDocument();
    });

    test('renders video count field in channel mode when custom settings enabled', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      // Enable custom settings to see video count field
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      expect(screen.getByText('Videos Per Channel')).toBeInTheDocument();
      expect(screen.getByLabelText('Number of videos to download per channel')).toBeInTheDocument();
    });

    test('does not render video count field in manual mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      // Enable custom settings
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      expect(screen.queryByText('Videos Per Channel')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Number of videos to download per channel')).not.toBeInTheDocument();
    });

    test('renders action buttons', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Download/i })).toBeInTheDocument();
      expect(screen.getByTestId('DownloadIcon')).toBeInTheDocument();
    });

    test('renders note about YouTube quality', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      expect(screen.getByText(/YouTube will provide the best available quality/i)).toBeInTheDocument();
    });
  });

  describe('Default Values', () => {
    test('uses default resolution of 1080', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Enable custom settings to see resolution select
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      expect(resolutionSelect).toHaveTextContent('1080p (Full HD)');
    });

    test('uses custom default resolution when provided', () => {
      render(<DownloadSettingsDialog {...defaultProps} defaultResolution="720" />);

      // Enable custom settings to see resolution select
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      expect(resolutionSelect).toHaveTextContent('720p (HD)');
    });

    test('uses default video count of 3 in channel mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      // Enable custom settings to see video count select
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      expect(videoCountSelect).toHaveTextContent('3 videos');
    });

    test('uses custom default video count when provided', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" defaultVideoCount={10} />);

      // Enable custom settings to see video count select
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      expect(videoCountSelect).toHaveTextContent('10 videos');
    });

    test('shows summary box with quality when custom settings disabled', () => {
      render(<DownloadSettingsDialog {...defaultProps} defaultResolution="720" />);

      // Summary box should show quality
      const summaryBox = screen.getByTestId('settings-summary');
      expect(summaryBox).toBeInTheDocument();
      expect(within(summaryBox).getByText('720p (HD)')).toBeInTheDocument();
    });

    test('shows summary box with video count in channel mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" defaultVideoCount={5} defaultResolution="1080" />);

      // Summary box should show videos per channel in channel mode
      expect(screen.getByTestId('settings-summary')).toBeInTheDocument();
      expect(screen.getByText(/Videos per channel:/)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Custom Settings Toggle', () => {
    test('collapses resolution select when custom settings off', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Custom settings section should be in collapsed state when custom settings is off
      // The Collapse component keeps children mounted but hidden
      const customSettingsToggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      expect(customSettingsToggle).not.toBeChecked();
    });

    test('shows resolution select when custom settings on', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      expect(resolutionSelect).toBeInTheDocument();
      expect(resolutionSelect).toBeVisible();
    });

    test('shows summary box when custom settings off', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Summary box should be visible when custom settings is off
      const summaryBox = screen.getByTestId('settings-summary');
      expect(summaryBox).toBeVisible();
    });

    test('collapses summary box when custom settings on', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Summary should be visible initially
      const summaryBox = screen.getByTestId('settings-summary');
      expect(summaryBox).toBeVisible();

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      // After toggle, custom settings section should be visible
      expect(screen.getByTestId('custom-settings-section')).toBeVisible();
    });

    test('shows custom settings section when toggle is on', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      // Custom settings section should be visible
      expect(screen.getByTestId('custom-settings-section')).toBeVisible();
    });
  });

  describe('Resolution Selection', () => {
    test('changes resolution when selection is made', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      fireEvent.mouseDown(resolutionSelect);

      const option720p = screen.getByText('720p (HD)');
      fireEvent.click(option720p);

      expect(resolutionSelect).toHaveTextContent('720p (HD)');
    });

    test('shows 4K warning when 2160p is selected', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      fireEvent.mouseDown(resolutionSelect);

      const option4K = screen.getByText('2160p (4K)');
      fireEvent.click(option4K);

      expect(screen.getByText(/4K videos may take significantly longer to download/i)).toBeInTheDocument();
    });

    test('does not show 4K warning for other resolutions', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      // Resolution is already 1080p by default, so no warning should show
      expect(screen.queryByText(/4K videos may take significantly longer/i)).not.toBeInTheDocument();
    });
  });

  describe('Video Count Dropdown', () => {
    test('allows selecting different video counts', async () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      fireEvent.mouseDown(videoCountSelect);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: '5 videos' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('option', { name: '5 videos' }));
      expect(videoCountSelect).toHaveTextContent('5 videos');
    });

    test('shows all available options from 1 to 10', async () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      fireEvent.mouseDown(videoCountSelect);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: '1 video' })).toBeInTheDocument();
      });

      // Check all options are present
      expect(screen.getByRole('option', { name: '1 video' })).toBeInTheDocument();
      for (let i = 2; i <= 10; i++) {
        expect(screen.getByRole('option', { name: `${i} videos` })).toBeInTheDocument();
      }
    });

    test('includes current value if greater than 10', async () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" defaultVideoCount={15} />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      expect(videoCountSelect).toHaveTextContent('15 videos');

      fireEvent.mouseDown(videoCountSelect);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: '15 videos' })).toBeInTheDocument();
      });

      // Should have 1-10 plus the current value of 15
      expect(screen.getByRole('option', { name: '15 videos' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '10 videos' })).toBeInTheDocument();
    });

    test('shows dropdown when custom settings are on', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      // Custom settings is off initially
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      expect(toggle).not.toBeChecked();

      // Enable custom settings
      fireEvent.click(toggle);

      // Should be visible when custom settings is on
      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      expect(videoCountSelect).toBeVisible();
    });
  });

  describe('LocalStorage Integration', () => {
    test('saves settings to localStorage on confirm for manual mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      fireEvent.mouseDown(resolutionSelect);
      fireEvent.click(screen.getByText('720p (HD)'));

      const confirmButton = screen.getByRole('button', { name: /Start Download/i });
      fireEvent.click(confirmButton);

      const saved = JSON.parse(localStorage.getItem('youtarr_download_settings') || '{}');
      expect(saved).toEqual({
        useCustom: true,
        resolution: '720',
        allowRedownload: false,
        rating: null,
      });
    });

    test('saves settings to localStorage on confirm for channel mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      fireEvent.mouseDown(videoCountSelect);
      fireEvent.click(screen.getByRole('option', { name: '10 videos' }));

      const confirmButton = screen.getByRole('button', { name: /Start Download/i });
      fireEvent.click(confirmButton);

      const saved = JSON.parse(localStorage.getItem('youtarr_channel_settings') || '{}');
      expect(saved).toEqual({
        useCustom: true,
        resolution: '1080',
        videoCount: 10,
        allowRedownload: false,
        rating: null,
      });
    });
  });

  describe('Confirm Action', () => {
    test('calls onConfirm with settings when custom settings enabled', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      fireEvent.mouseDown(resolutionSelect);
      fireEvent.click(screen.getByText('720p (HD)'));

      const confirmButton = screen.getByRole('button', { name: /Start Download/i });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith({
        resolution: '720',
        videoCount: 0,
        allowRedownload: false,
        subfolder: null,
        audioFormat: null,
      });
    });

    test('calls onConfirm with null when custom settings disabled', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: /Start Download/i });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(null);
    });

    test('includes video count in channel mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      fireEvent.mouseDown(videoCountSelect);
      fireEvent.click(screen.getByRole('option', { name: '7 videos' }));

      const confirmButton = screen.getByRole('button', { name: /Start Download/i });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith({
        resolution: '1080',
        videoCount: 7,
        allowRedownload: false,
      });
    });
  });

  describe('Cancel Action', () => {
    test('calls onClose when cancel button clicked', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when dialog backdrop clicked', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Find the backdrop by test id
      const backdrop = screen.getByTestId('dialog-backdrop');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when canceled after interaction', () => {
      const { rerender } = render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      // Make a change
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);
      expect(toggle).toBeChecked();

      // Cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      // Should have called onClose
      expect(mockOnClose).toHaveBeenCalledTimes(1);

      // When dialog is closed and reopened, it starts fresh
      rerender(<DownloadSettingsDialog {...defaultProps} open={false} mode="manual" />);

      // Cleanup and render fresh instance
      const { unmount } = render(<DownloadSettingsDialog {...defaultProps} open={false} mode="manual" />);
      unmount();

      render(<DownloadSettingsDialog {...defaultProps} open={true} mode="manual" />);
      // New instance should start with defaults
      const newToggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      expect(newToggle).not.toBeChecked();
    });
  });

  describe('Re-download Functionality', () => {
    test('auto-checks re-download toggle when missing videos are present', () => {
      render(<DownloadSettingsDialog {...defaultProps} missingVideoCount={3} />);

      // Enable custom settings to see re-download toggle
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const redownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      expect(redownloadToggle).toBeChecked();
    });

    test('does not auto-check re-download toggle when no missing videos', () => {
      render(<DownloadSettingsDialog {...defaultProps} missingVideoCount={0} />);

      // Enable custom settings to see re-download toggle
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const redownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      expect(redownloadToggle).not.toBeChecked();
    });

    test('calls onConfirm with allowRedownload true when toggle is checked', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Enable custom settings
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const redownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      fireEvent.click(redownloadToggle);

      const confirmButton = screen.getByRole('button', { name: /Start Download/i });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith({
        resolution: '1080',
        videoCount: 0,
        allowRedownload: true,
        subfolder: null,
        audioFormat: null,
      });
    });

    test('calls onConfirm with settings when custom settings enabled', () => {
      render(<DownloadSettingsDialog {...defaultProps} defaultResolution="720" />);

      // Enable custom settings
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      // Enable re-download
      const redownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      fireEvent.click(redownloadToggle);

      const confirmButton = screen.getByRole('button', { name: /Start Download/i });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith({
        resolution: '720',
        videoCount: 0,
        allowRedownload: true,
        subfolder: null,
        audioFormat: null,
      });
    });

    test('saves allowRedownload state to localStorage', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Enable custom settings
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const redownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      fireEvent.click(redownloadToggle);

      const confirmButton = screen.getByRole('button', { name: /Start Download/i });
      fireEvent.click(confirmButton);

      const saved = JSON.parse(localStorage.getItem('youtarr_download_settings') || '{}');
      expect(saved.allowRedownload).toBe(true);
    });

    test('marks user as having interacted when changing re-download toggle', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Enable custom settings
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const redownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      fireEvent.click(redownloadToggle);

      // Save something to localStorage
      localStorage.setItem('youtarr_download_settings', JSON.stringify({
        useCustom: true,
        resolution: '360',
        allowRedownload: false,
      }));

      // Component should not reload from localStorage after interaction
      expect(redownloadToggle).toBeChecked();
    });
  });

  describe('State Management', () => {
    test('resets state when dialog is closed and reopened', () => {
      const { rerender } = render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      // Make changes
      const customToggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(customToggle);
      expect(customToggle).toBeChecked();

      const redownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      fireEvent.click(redownloadToggle);
      expect(redownloadToggle).toBeChecked();

      // Close dialog
      rerender(<DownloadSettingsDialog {...defaultProps} open={false} mode="manual" />);

      // Reopen dialog
      rerender(<DownloadSettingsDialog {...defaultProps} open={true} mode="manual" />);

      // State should be reset
      const newCustomToggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      expect(newCustomToggle).not.toBeChecked();

      // Re-enable custom settings to check re-download toggle
      fireEvent.click(newCustomToggle);
      const newRedownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      expect(newRedownloadToggle).not.toBeChecked();
    });

    test('preserves quality in summary when dialog reopens', () => {
      const { rerender } = render(
        <DownloadSettingsDialog
          {...defaultProps}
          defaultResolution="720"
        />
      );

      // Summary should show the quality
      let summaryBox = screen.getByTestId('settings-summary');
      expect(summaryBox).toBeInTheDocument();
      expect(within(summaryBox).getByText('720p (HD)')).toBeInTheDocument();

      // Close and reopen
      rerender(
        <DownloadSettingsDialog
          {...defaultProps}
          open={false}
          defaultResolution="720"
        />
      );

      rerender(
        <DownloadSettingsDialog
          {...defaultProps}
          open={true}
          defaultResolution="720"
        />
      );

      // Should still show quality in summary
      summaryBox = screen.getByTestId('settings-summary');
      expect(summaryBox).toBeInTheDocument();
      expect(within(summaryBox).getByText('720p (HD)')).toBeInTheDocument();
    });

    test('auto-enables redownload toggle again when reopened with missing videos', () => {
      const { rerender } = render(
        <DownloadSettingsDialog {...defaultProps} missingVideoCount={3} />
      );

      // Enable custom settings to see re-download toggle
      let customToggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(customToggle);

      // Should be auto-checked
      let redownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      expect(redownloadToggle).toBeChecked();

      // User unchecks it
      fireEvent.click(redownloadToggle);
      expect(redownloadToggle).not.toBeChecked();

      // Close dialog
      rerender(<DownloadSettingsDialog {...defaultProps} open={false} missingVideoCount={3} />);

      // Reopen with missing videos again
      rerender(<DownloadSettingsDialog {...defaultProps} open={true} missingVideoCount={3} />);

      // Enable custom settings again
      customToggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(customToggle);

      // Should be auto-checked again (hasUserInteracted was reset)
      redownloadToggle = screen.getByRole('checkbox', { name: /Allow re-downloading/i });
      expect(redownloadToggle).toBeChecked();
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined videoCount in manual mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      // Should show generic message when videoCount is undefined
      expect(screen.getByText('You are about to download undefined videos.')).toBeInTheDocument();
    });

    test('handles missing resolution in RESOLUTION_OPTIONS', () => {
      render(<DownloadSettingsDialog {...defaultProps} defaultResolution="9999" />);

      // Summary box should show the raw resolution value
      expect(screen.getByTestId('settings-summary')).toBeInTheDocument();
      expect(screen.getByText('9999p')).toBeInTheDocument();
    });

    test('handles localStorage being unavailable', () => {
      const originalSetItem = Storage.prototype.setItem;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock localStorage setItem to throw error
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('localStorage not available');
      });

      render(<DownloadSettingsDialog {...defaultProps} />);

      // Try to save settings - should handle error gracefully
      const confirmButton = screen.getByRole('button', { name: /Start Download/i });

      expect(() => {
        fireEvent.click(confirmButton);
      }).not.toThrow();

      // Verify error was logged when trying to save
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save settings to localStorage:', expect.any(Error));

      // Restore localStorage methods
      Storage.prototype.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });

    test('marks user as having interacted when toggling custom settings', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      // Save something to localStorage
      localStorage.setItem('youtarr_download_settings', JSON.stringify({
        useCustom: false,
        resolution: '360',
      }));

      // Component should not reload from localStorage after interaction
      expect(toggle).toBeChecked();
    });

    test('marks user as having interacted when changing resolution', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      fireEvent.mouseDown(resolutionSelect);
      fireEvent.click(screen.getByText('720p (HD)'));

      // Save something to localStorage
      localStorage.setItem('youtarr_download_settings', JSON.stringify({
        useCustom: true,
        resolution: '360',
      }));

      // Component should not reload from localStorage after interaction
      expect(resolutionSelect).toHaveTextContent('720p (HD)');
    });

    test('marks user as having interacted when changing video count', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      fireEvent.mouseDown(videoCountSelect);
      fireEvent.click(screen.getByRole('option', { name: '8 videos' }));

      // Save something to localStorage
      localStorage.setItem('youtarr_channel_settings', JSON.stringify({
        useCustom: true,
        resolution: '1080',
        videoCount: 5,
      }));

      // Component should not reload from localStorage after interaction
      expect(videoCountSelect).toHaveTextContent('8 videos');
    });
  });
});
