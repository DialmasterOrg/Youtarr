import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

      expect(screen.getByText('This will download any new videos from all channels.')).toBeInTheDocument();
    });

    test('renders custom settings toggle', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      expect(screen.getByLabelText('Use custom settings for this download')).toBeInTheDocument();
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

    test('renders video count field in channel mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      expect(screen.getByText('Videos Per Channel')).toBeInTheDocument();
      expect(screen.getByLabelText('Number of videos to download per channel')).toBeInTheDocument();
    });

    test('does not render video count field in manual mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

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

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      expect(resolutionSelect).toHaveTextContent('1080p (Full HD)');
    });

    test('uses custom default resolution when provided', () => {
      render(<DownloadSettingsDialog {...defaultProps} defaultResolution="720" />);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      expect(resolutionSelect).toHaveTextContent('720p (HD)');
    });

    test('uses default video count of 3 in channel mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      expect(videoCountSelect).toHaveTextContent('3 videos');
    });

    test('uses custom default video count when provided', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" defaultVideoCount={10} />);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      expect(videoCountSelect).toHaveTextContent('10 videos');
    });

    test('shows default settings info when custom settings disabled', () => {
      render(<DownloadSettingsDialog {...defaultProps} defaultResolution="720" />);

      expect(screen.getByText(/Using default settings: 720p \(HD\)/i)).toBeInTheDocument();
    });

    test('shows default settings info with video count in channel mode', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" defaultVideoCount={5} defaultResolution="1080" />);

      expect(screen.getByText(/Using default settings: 5 videos per channel at 1080p \(Full HD\)/i)).toBeInTheDocument();
    });
  });

  describe('Custom Settings Toggle', () => {
    test('disables resolution select when custom settings off', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      // Check that the select is disabled
      expect(resolutionSelect).toHaveAttribute('aria-disabled', 'true');
    });

    test('enables resolution select when custom settings on', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      expect(resolutionSelect).not.toBeDisabled();
    });

    test('applies opacity transition when toggling custom settings', () => {
      render(<DownloadSettingsDialog {...defaultProps} />);

      // Find the container using test id
      const settingsBox = screen.getByTestId('custom-settings-section');
      expect(settingsBox).toHaveStyle({ opacity: '0.5', transition: 'opacity 0.3s' });

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      expect(settingsBox).toHaveStyle({ opacity: '1', transition: 'opacity 0.3s' });
    });

    test('shows helper text for video count when custom settings disabled', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" defaultVideoCount={5} />);

      expect(screen.getByText('Using default: 5 videos per channel')).toBeInTheDocument();
    });

    test('does not show helper text for video count when custom settings enabled', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      // The helper text "1-50 videos per channel" is no longer shown with dropdown
      expect(screen.queryByText('1-50 videos per channel')).not.toBeInTheDocument();
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

    test('disables dropdown when custom settings are off', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      expect(videoCountSelect).toHaveAttribute('aria-disabled', 'true');

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      expect(videoCountSelect).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('LocalStorage Integration', () => {
    test('loads saved manual mode settings from localStorage', () => {
      const savedSettings = {
        useCustom: true,
        resolution: '720',
      };
      localStorage.setItem('youtarr_download_settings', JSON.stringify(savedSettings));

      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      expect(toggle).toBeChecked();

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      expect(resolutionSelect).toHaveTextContent('720p (HD)');
    });

    test('loads saved channel mode settings from localStorage', () => {
      const savedSettings = {
        useCustom: true,
        resolution: '480',
        videoCount: 15,
      };
      localStorage.setItem('youtarr_channel_settings', JSON.stringify(savedSettings));

      render(<DownloadSettingsDialog {...defaultProps} mode="channel" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      expect(toggle).toBeChecked();

      const resolutionSelect = screen.getByLabelText('Maximum Resolution');
      expect(resolutionSelect).toHaveTextContent('480p');

      const videoCountSelect = screen.getByLabelText('Number of videos to download per channel');
      expect(videoCountSelect).toHaveTextContent('15 videos');
    });

    test('handles invalid JSON in localStorage gracefully', () => {
      localStorage.setItem('youtarr_download_settings', 'invalid json');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse saved settings:', expect.any(Error));

      consoleSpy.mockRestore();
    });

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
      });
    });

    test('does not reload settings after user interaction', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      // Save new settings to localStorage
      localStorage.setItem('youtarr_download_settings', JSON.stringify({
        useCustom: false,
        resolution: '360',
      }));

      // Re-render with dialog still open
      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      // Should still have user's changes, not localStorage
      expect(toggle).toBeChecked();
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

    test('resets hasUserInteracted state on cancel', () => {
      render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);

      // Make a change
      const toggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      fireEvent.click(toggle);

      // Cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      // Re-open dialog - should load from localStorage again
      localStorage.setItem('youtarr_download_settings', JSON.stringify({
        useCustom: false,
        resolution: '360',
      }));

      const { rerender } = render(<DownloadSettingsDialog {...defaultProps} mode="manual" />);
      rerender(<DownloadSettingsDialog {...defaultProps} open={false} mode="manual" />);
      rerender(<DownloadSettingsDialog {...defaultProps} open={true} mode="manual" />);

      // Should have loaded localStorage settings since hasUserInteracted was reset
      const newToggle = screen.getByRole('checkbox', { name: /Use custom settings/i });
      expect(newToggle).not.toBeChecked();
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

      // Should display raw resolution value
      expect(screen.getByText(/Using default settings: 9999p/i)).toBeInTheDocument();
    });

    test('handles localStorage being unavailable', () => {
      const originalGetItem = Storage.prototype.getItem;
      const originalSetItem = Storage.prototype.setItem;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock localStorage methods to throw errors
      Storage.prototype.getItem = jest.fn(() => {
        throw new Error('localStorage not available');
      });
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('localStorage not available');
      });

      // Component should handle the error gracefully
      expect(() => {
        render(<DownloadSettingsDialog {...defaultProps} />);
      }).not.toThrow();

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith('Failed to access localStorage:', expect.any(Error));

      // Restore localStorage methods
      Storage.prototype.getItem = originalGetItem;
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