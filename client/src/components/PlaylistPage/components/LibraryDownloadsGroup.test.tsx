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
  refreshing: false,
};

describe('LibraryDownloadsGroup', () => {
  test('shows the not-downloaded count on the download button', () => {
    render(<LibraryDownloadsGroup {...baseProps} />);
    expect(screen.getByRole('button', { name: /Download all 37 videos/i })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /Download all 0 videos/i })).toBeDisabled();
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

  test('shows a spinner and Refreshing... label while refreshing', () => {
    render(<LibraryDownloadsGroup {...baseProps} refreshing />);
    const button = screen.getByRole('button', { name: /Refreshing.../i });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('shows the normal label and no spinner when not refreshing', () => {
    render(<LibraryDownloadsGroup {...baseProps} refreshing={false} />);
    expect(screen.getByRole('button', { name: /Refresh from YouTube/i })).not.toBeDisabled();
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });

  test('opens playlist settings from the Playlist settings button', async () => {
    const user = userEvent.setup();
    const onOpenSettings = jest.fn();
    render(<LibraryDownloadsGroup {...baseProps} onOpenSettings={onOpenSettings} />);
    await user.click(screen.getByRole('button', { name: /Playlist settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});


test('opens the batch chooser and download-all confirmation through their own buttons', async () => {
  const user = userEvent.setup();
  const onChooseExisting = jest.fn();
  const onDownloadAll = jest.fn();
  render(<LibraryDownloadsGroup {...baseProps} onChooseExisting={onChooseExisting} onDownloadAll={onDownloadAll} />);
  await user.click(screen.getByRole('button', { name: 'Choose existing videos' }));
  expect(onChooseExisting).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Download all 37 videos' }));
  expect(onDownloadAll).toHaveBeenCalledTimes(1);
});

test.each([{ togglePending: true }, { actionRunning: true }])('prevents changing following while busy: %j', (busy) => {
  render(<LibraryDownloadsGroup {...baseProps} {...busy} onChooseExisting={jest.fn()} />);
  expect(screen.getByRole('checkbox', { name: 'Auto-download new videos' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Choose existing videos' })).toBeDisabled();
});

test('disables actions while a download action is running', () => {
  render(<LibraryDownloadsGroup {...baseProps} actionRunning />);
  expect(screen.getByRole('button', { name: 'Refresh from YouTube' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Download all 37 videos' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Playlist settings' })).toBeDisabled();
});

test('an enabled playlist without a starting point explains why downloads are waiting', () => {
  render(<LibraryDownloadsGroup {...baseProps} autoDownload />);
  expect(screen.getByRole('alert')).toHaveTextContent('No automatic downloads can start yet');
  expect(screen.getByRole('alert')).toHaveTextContent('retry on scheduled runs');
});

test('an oversized setup error remains visible while auto-download is off', async () => {
  const user = userEvent.setup();
  const onToggleAutoDownload = jest.fn();
  render(<LibraryDownloadsGroup {...baseProps} setupError="PLAYLIST_TOO_LARGE" onToggleAutoDownload={onToggleAutoDownload} />);
  expect(screen.getByRole('alert')).toHaveTextContent('supports up to 5,000 entries');
  await user.click(screen.getByRole('button', { name: 'Retry following setup' }));
  expect(onToggleAutoDownload).toHaveBeenCalledWith(true);
});

test('paused incomplete setup offers a retry without promising scheduled retries', () => {
  render(<LibraryDownloadsGroup {...baseProps} setupError="PLAYLIST_REFRESH_INCOMPLETE" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Retry setup when you are ready');
  expect(screen.getByRole('alert')).not.toHaveTextContent('retry on scheduled runs');
});


test('keeps saved selections visible when automatic retries are paused', () => {
  render(<LibraryDownloadsGroup {...baseProps} hasFollowingBaseline followingRequestedCount={1} />);
  expect(screen.getByText(/1 selected video is not downloaded yet/)).toHaveTextContent('Automatic retries are paused.');
});

test.each([0, null, undefined])('does not show an outstanding selection message for count=%s', (count) => {
  render(<LibraryDownloadsGroup {...baseProps} followingRequestedCount={count} />);
  expect(screen.queryByText(/selected videos? (is|are) not downloaded yet/)).not.toBeInTheDocument();
});

describe('download filters', () => {
  test('says how many undownloaded videos the filters skip', () => {
    render(<LibraryDownloadsGroup {...baseProps} filteredCount={4} />);
    expect(screen.getByText(/4 undownloaded videos are skipped by this playlist's download filters/)).toBeInTheDocument();
  });

  test('uses the singular for one skipped video', () => {
    render(<LibraryDownloadsGroup {...baseProps} filteredCount={1} />);
    expect(screen.getByText(/1 undownloaded video is skipped by this playlist's download filters/)).toBeInTheDocument();
  });

  test.each([0, null, undefined])('says nothing about skipped videos for count=%s', (count) => {
    render(<LibraryDownloadsGroup {...baseProps} filteredCount={count} />);
    expect(screen.queryByText(/skipped by this playlist's download filters/)).not.toBeInTheDocument();
  });

  test('warns that automatic downloads are on hold when the title filter cannot be checked', () => {
    render(<LibraryDownloadsGroup {...baseProps} hasFollowingBaseline filteredCount={4} filterError="Invalid regex pattern: bad" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Automatic downloads and Download all are on hold');
    expect(alert).toHaveTextContent('Invalid regex pattern: bad');
  });

  test('does not count videos as skipped while the title filter cannot be checked', () => {
    render(<LibraryDownloadsGroup {...baseProps} hasFollowingBaseline filteredCount={4} filterError="Invalid regex pattern: bad" />);
    expect(screen.queryByText(/skipped by this playlist's download filters/)).not.toBeInTheDocument();
  });
});
