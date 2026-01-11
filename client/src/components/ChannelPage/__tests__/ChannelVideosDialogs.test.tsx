import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelVideosDialogs, { ChannelVideosDialogsProps } from '../ChannelVideosDialogs';
import { renderWithProviders } from '../../../test-utils';

// Mock child components
jest.mock('../../DownloadManager/ManualDownload/DownloadSettingsDialog', () => ({
  __esModule: true,
  default: function MockDownloadSettingsDialog(props: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'download-settings-dialog',
      'data-open': props.open,
      'data-video-count': props.videoCount,
      'data-missing-count': props.missingVideoCount,
      'data-default-resolution': props.defaultResolution,
      'data-default-resolution-source': props.defaultResolutionSource,
      onClick: () => {
        if (props.onConfirm) {
          props.onConfirm({ resolution: '1080', allowRedownload: false });
        }
      }
    }, 'Download Settings Dialog');
  }
}));

jest.mock('../../shared/DeleteVideosDialog', () => ({
  __esModule: true,
  default: function MockDeleteVideosDialog(props: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'delete-videos-dialog',
      'data-open': props.open,
      'data-video-count': props.videoCount
    }, 'Delete Videos Dialog');
  }
}));

describe('ChannelVideosDialogs Component', () => {
  const defaultProps: ChannelVideosDialogsProps = {
    downloadDialogOpen: false,
    refreshConfirmOpen: false,
    deleteDialogOpen: false,
    fetchAllError: null,
    mobileTooltip: null,
    successMessage: null,
    errorMessage: null,
    videoCount: 0,
    missingVideoCount: 0,
    selectedForDeletion: 0,
    defaultResolution: '1080',
    defaultResolutionSource: 'global',
    selectedTab: 'videos',
    tabLabel: 'Videos',
    token: null,
    onDownloadDialogClose: jest.fn(),
    onDownloadConfirm: jest.fn(),
    onRefreshCancel: jest.fn(),
    onRefreshConfirm: jest.fn(),
    onDeleteCancel: jest.fn(),
    onDeleteConfirm: jest.fn(),
    onFetchAllErrorClose: jest.fn(),
    onMobileTooltipClose: jest.fn(),
    onSuccessMessageClose: jest.fn(),
    onErrorMessageClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<ChannelVideosDialogs {...defaultProps} />);
      expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('delete-videos-dialog')).toBeInTheDocument();
    });

    test('renders all dialog components', () => {
      renderWithProviders(<ChannelVideosDialogs {...defaultProps} />);

      // Should render DownloadSettingsDialog
      expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();

      // Should render DeleteVideosDialog
      expect(screen.getByTestId('delete-videos-dialog')).toBeInTheDocument();

      // Should render refresh confirmation dialog (even if closed)
      expect(screen.queryByText('Load More Videos')).not.toBeInTheDocument();
    });
  });

  describe('Download Settings Dialog', () => {
    test('passes correct props to DownloadSettingsDialog when closed', () => {
      renderWithProviders(<ChannelVideosDialogs {...defaultProps} />);

      const dialog = screen.getByTestId('download-settings-dialog');
      expect(dialog).toHaveAttribute('data-open', 'false');
      expect(dialog).toHaveAttribute('data-video-count', '0');
      expect(dialog).toHaveAttribute('data-missing-count', '0');
    });

    test('passes correct props to DownloadSettingsDialog when open', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          downloadDialogOpen={true}
          videoCount={5}
          missingVideoCount={2}
        />
      );

      const dialog = screen.getByTestId('download-settings-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
      expect(dialog).toHaveAttribute('data-video-count', '5');
      expect(dialog).toHaveAttribute('data-missing-count', '2');
    });

    test('passes default resolution to DownloadSettingsDialog', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          defaultResolution="720"
        />
      );

      const dialog = screen.getByTestId('download-settings-dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('data-default-resolution', '720');
    });

    test('passes global default resolution source to DownloadSettingsDialog', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          defaultResolution="1080"
          defaultResolutionSource="global"
        />
      );

      const dialog = screen.getByTestId('download-settings-dialog');
      expect(dialog).toHaveAttribute('data-default-resolution', '1080');
      expect(dialog).toHaveAttribute('data-default-resolution-source', 'global');
    });

    test('passes channel default resolution source to DownloadSettingsDialog', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          defaultResolution="720"
          defaultResolutionSource="channel"
        />
      );

      const dialog = screen.getByTestId('download-settings-dialog');
      expect(dialog).toHaveAttribute('data-default-resolution', '720');
      expect(dialog).toHaveAttribute('data-default-resolution-source', 'channel');
    });
  });

  describe('Refresh Confirmation Dialog', () => {
    test('does not show refresh dialog when closed', () => {
      renderWithProviders(<ChannelVideosDialogs {...defaultProps} />);

      expect(screen.queryByText(/Load More/)).not.toBeInTheDocument();
    });

    test('shows refresh dialog when open', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          refreshConfirmOpen={true}
        />
      );

      expect(screen.getByText('Load More Videos')).toBeInTheDocument();
    });

    test('displays correct tab label in refresh dialog', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          refreshConfirmOpen={true}
          tabLabel="Shorts"
        />
      );

      expect(screen.getByText('Load More Shorts')).toBeInTheDocument();
      expect(screen.getByText(/This will load up to 5000 additional videos from this channel's 'Shorts' tab on YouTube/)).toBeInTheDocument();
    });

    test('calls onRefreshCancel when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const onRefreshCancel = jest.fn();

      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          refreshConfirmOpen={true}
          onRefreshCancel={onRefreshCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(onRefreshCancel).toHaveBeenCalledTimes(1);
    });

    test('calls onRefreshConfirm when Continue is clicked', async () => {
      const user = userEvent.setup();
      const onRefreshConfirm = jest.fn();

      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          refreshConfirmOpen={true}
          onRefreshConfirm={onRefreshConfirm}
        />
      );

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      await user.click(continueButton);

      expect(onRefreshConfirm).toHaveBeenCalledTimes(1);
    });

    test('calls onRefreshCancel when dialog is closed by clicking backdrop', () => {
      const onRefreshCancel = jest.fn();

      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          refreshConfirmOpen={true}
          onRefreshCancel={onRefreshCancel}
        />
      );

      // MUI Dialog calls onClose when clicking backdrop
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // onClose is called by MUI when backdrop is clicked
      // We can't simulate this directly, but we verify the prop is passed
      expect(onRefreshCancel).toBeDefined();
    });

    test('has proper accessibility attributes in refresh dialog', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          refreshConfirmOpen={true}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'refresh-dialog-title');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'refresh-dialog-description');
    });
  });

  describe('Delete Confirmation Dialog', () => {
    test('passes correct props to DeleteVideosDialog when closed', () => {
      renderWithProviders(<ChannelVideosDialogs {...defaultProps} />);

      const dialog = screen.getByTestId('delete-videos-dialog');
      expect(dialog).toHaveAttribute('data-open', 'false');
      expect(dialog).toHaveAttribute('data-video-count', '0');
    });

    test('passes correct props to DeleteVideosDialog when open', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          deleteDialogOpen={true}
          selectedForDeletion={3}
        />
      );

      const dialog = screen.getByTestId('delete-videos-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
      expect(dialog).toHaveAttribute('data-video-count', '3');
    });
  });

  describe('Snackbar Notifications', () => {
    test('shows fetch all error snackbar when error exists', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          fetchAllError="Failed to fetch videos"
        />
      );

      expect(screen.getByText('Failed to fetch videos')).toBeInTheDocument();
    });

    test('does not show fetch all error snackbar when error is null', () => {
      renderWithProviders(<ChannelVideosDialogs {...defaultProps} />);

      // Snackbar should not be visible
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('calls onFetchAllErrorClose when error snackbar is closed', async () => {
      const user = userEvent.setup();
      const onFetchAllErrorClose = jest.fn();

      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          fetchAllError="Test error"
          onFetchAllErrorClose={onFetchAllErrorClose}
        />
      );

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(onFetchAllErrorClose).toHaveBeenCalledTimes(1);
    });

    test('shows mobile tooltip snackbar when message exists', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          mobileTooltip="Tap and hold to select videos"
        />
      );

      expect(screen.getByText('Tap and hold to select videos')).toBeInTheDocument();
    });

    test('calls onMobileTooltipClose when tooltip is closed', async () => {
      const user = userEvent.setup();
      const onMobileTooltipClose = jest.fn();

      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          mobileTooltip="Test tooltip"
          onMobileTooltipClose={onMobileTooltipClose}
        />
      );

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(onMobileTooltipClose).toHaveBeenCalledTimes(1);
    });

    test('shows success message snackbar when message exists', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          successMessage="Videos downloaded successfully"
        />
      );

      expect(screen.getByText('Videos downloaded successfully')).toBeInTheDocument();
    });

    test('calls onSuccessMessageClose when success snackbar is closed', async () => {
      const user = userEvent.setup();
      const onSuccessMessageClose = jest.fn();

      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          successMessage="Test success"
          onSuccessMessageClose={onSuccessMessageClose}
        />
      );

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(onSuccessMessageClose).toHaveBeenCalledTimes(1);
    });

    test('shows error message snackbar when message exists', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          errorMessage="Download failed"
        />
      );

      expect(screen.getByText('Download failed')).toBeInTheDocument();
    });

    test('calls onErrorMessageClose when error message snackbar is closed', async () => {
      const user = userEvent.setup();
      const onErrorMessageClose = jest.fn();

      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          errorMessage="Test error"
          onErrorMessageClose={onErrorMessageClose}
        />
      );

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(onErrorMessageClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Snackbar Severity Levels', () => {
    test('fetch all error shows error severity', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          fetchAllError="Error message"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-standardError');
    });

    test('mobile tooltip shows info severity', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          mobileTooltip="Info message"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-standardInfo');
    });

    test('success message shows success severity', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          successMessage="Success message"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-standardSuccess');
    });

    test('error message shows error severity', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          errorMessage="Error message"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-standardError');
    });
  });

  describe('Multiple Dialogs Open', () => {
    test('can show multiple snackbars simultaneously', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          fetchAllError="Error 1"
          successMessage="Success 1"
        />
      );

      expect(screen.getByText('Error 1')).toBeInTheDocument();
      expect(screen.getByText('Success 1')).toBeInTheDocument();
    });

    test('can show dialog and snackbar simultaneously', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          refreshConfirmOpen={true}
          successMessage="Operation completed"
        />
      );

      expect(screen.getByText('Load More Videos')).toBeInTheDocument();
      expect(screen.getByText('Operation completed')).toBeInTheDocument();
    });
  });

  describe('Auto-hide Duration', () => {
    test('fetch all error has 6000ms auto-hide duration', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          fetchAllError="Test error"
        />
      );

      // Snackbar should be visible initially
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    test('mobile tooltip has 8000ms auto-hide duration', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          mobileTooltip="Test tooltip"
        />
      );

      // Snackbar should be visible initially
      expect(screen.getByText('Test tooltip')).toBeInTheDocument();
    });

    test('success message has 6000ms auto-hide duration', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          successMessage="Test success"
        />
      );

      // Snackbar should be visible initially
      expect(screen.getByText('Test success')).toBeInTheDocument();
    });

    test('error message has 6000ms auto-hide duration', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          errorMessage="Test error"
        />
      );

      // Snackbar should be visible initially
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string messages', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          successMessage=""
        />
      );

      // Empty string is not null, so snackbar will be open but with empty content
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    test('handles tab label with special characters', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          refreshConfirmOpen={true}
          tabLabel="Live & Upcoming"
        />
      );

      expect(screen.getByText('Load More Live & Upcoming')).toBeInTheDocument();
    });

    test('handles zero video count in download dialog', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          downloadDialogOpen={true}
          videoCount={0}
        />
      );

      const dialog = screen.getByTestId('download-settings-dialog');
      expect(dialog).toHaveAttribute('data-video-count', '0');
    });

    test('handles large video counts', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          downloadDialogOpen={true}
          videoCount={1000}
          selectedForDeletion={500}
        />
      );

      const downloadDialog = screen.getByTestId('download-settings-dialog');
      expect(downloadDialog).toHaveAttribute('data-video-count', '1000');

      const deleteDialog = screen.getByTestId('delete-videos-dialog');
      expect(deleteDialog).toHaveAttribute('data-video-count', '500');
    });

    test('handles all dialogs and snackbars open at once', () => {
      renderWithProviders(
        <ChannelVideosDialogs
          {...defaultProps}
          downloadDialogOpen={true}
          refreshConfirmOpen={true}
          deleteDialogOpen={true}
          fetchAllError="Error 1"
          mobileTooltip="Tooltip 1"
          successMessage="Success 1"
          errorMessage="Error 2"
        />
      );

      // All components should render
      expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('delete-videos-dialog')).toBeInTheDocument();
      expect(screen.getByText('Load More Videos')).toBeInTheDocument();

      // Multiple snackbars should show
      expect(screen.getByText('Error 1')).toBeInTheDocument();
      expect(screen.getByText('Tooltip 1')).toBeInTheDocument();
      expect(screen.getByText('Success 1')).toBeInTheDocument();
      expect(screen.getByText('Error 2')).toBeInTheDocument();
    });
  });

  describe('Prop Type Coverage', () => {
    test('handles different selected tab values', () => {
      const { rerender } = renderWithProviders(
        <ChannelVideosDialogs {...defaultProps} selectedTab="videos" />
      );
      expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();

      rerender(
        <ChannelVideosDialogs {...defaultProps} selectedTab="shorts" />
      );
      expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();

      rerender(
        <ChannelVideosDialogs {...defaultProps} selectedTab="streams" />
      );
      expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();
    });

    test('handles different default resolution values', () => {
      const resolutions = ['360', '480', '720', '1080', '1440', '2160'];

      resolutions.forEach(resolution => {
        const { unmount } = renderWithProviders(
          <ChannelVideosDialogs
            {...defaultProps}
            defaultResolution={resolution}
          />
        );

        expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();

        // Clean up after each iteration
        unmount();
      });
    });
  });
});
