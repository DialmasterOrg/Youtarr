import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LibraryDownloadsGroup from './LibraryDownloadsGroup';

const baseProps = {
  autoDownload: false,
  onToggleAutoDownload: jest.fn(),
  togglePending: false,
  newCount: 37,
  onRefresh: jest.fn(),
  onDownloadAll: jest.fn(),
  onOpenSettings: jest.fn(),
  actionRunning: false,
};

describe('LibraryDownloadsGroup', () => {
  test('shows the not-downloaded count on the download button', () => {
    render(<LibraryDownloadsGroup {...baseProps} />);
    expect(screen.getByRole('button', { name: /Download 37 new/i })).toBeInTheDocument();
  });

  test('calls onRefresh when Refresh from YouTube is clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();
    render(<LibraryDownloadsGroup {...baseProps} onRefresh={onRefresh} />);
    await user.click(screen.getByRole('button', { name: /Refresh from YouTube/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('disables download when there are no new videos', () => {
    render(<LibraryDownloadsGroup {...baseProps} newCount={0} />);
    expect(screen.getByRole('button', { name: /Download 0 new/i })).toBeDisabled();
  });

  test('toggles auto-download', async () => {
    const user = userEvent.setup();
    const onToggleAutoDownload = jest.fn();
    render(
      <LibraryDownloadsGroup {...baseProps} autoDownload={false} onToggleAutoDownload={onToggleAutoDownload} />
    );
    await user.click(screen.getByRole('checkbox', { name: /Auto-download new videos/i }));
    expect(onToggleAutoDownload).toHaveBeenCalledWith(true);
  });
});
