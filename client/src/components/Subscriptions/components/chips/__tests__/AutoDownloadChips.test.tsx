import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutoDownloadChips from '../AutoDownloadChips';
import { renderWithProviders } from '../../../../../test-utils';
import { TabDownloadStatsByTab } from '../../../../../types/Channel';

const tabStats: TabDownloadStatsByTab = {
  videos: { total: 449, fetchedAt: null, downloaded: 120, ignored: 0, percent: 26 },
  shorts: { total: null, fetchedAt: null, downloaded: 2, ignored: 0, percent: null },
};

describe('AutoDownloadChips', () => {
  test('renders nothing when available tabs are missing', () => {
    renderWithProviders(
      <AutoDownloadChips availableTabs={null} autoDownloadTabs="video" isMobile={false} />
    );

    expect(screen.queryAllByTestId(/auto-download-chip-/)).toHaveLength(0);
  });

  test('renders chips for available tabs and marks enabled ones', () => {
    renderWithProviders(
      <AutoDownloadChips
        availableTabs="videos,shorts,streams"
        autoDownloadTabs="video,livestream"
        isMobile={false}
      />
    );

    const videoChip = screen.getByTestId('auto-download-chip-videos');
    const shortsChip = screen.getByTestId('auto-download-chip-shorts');
    const streamsChip = screen.getByTestId('auto-download-chip-streams');

    expect(videoChip).toHaveTextContent('Videos');
    expect(videoChip).toHaveAttribute('data-autodownload', 'true');

    expect(shortsChip).toHaveTextContent('Shorts');
    expect(shortsChip).toHaveAttribute('data-autodownload', 'false');

    expect(streamsChip).toHaveTextContent('Live');
    expect(streamsChip).toHaveAttribute('data-autodownload', 'true');
  });

  test('handles whitespace and empty entries when parsing tab lists', () => {
    renderWithProviders(
      <AutoDownloadChips
        availableTabs=" videos , ,shorts , streams "
        autoDownloadTabs=" short , livestream "
        isMobile={false}
      />
    );

    expect(screen.getAllByTestId(/auto-download-chip-/)).toHaveLength(3);
    expect(screen.getByTestId('auto-download-chip-videos')).toHaveAttribute('data-autodownload', 'false');
    expect(screen.getByTestId('auto-download-chip-shorts')).toHaveAttribute('data-autodownload', 'true');
    expect(screen.getByTestId('auto-download-chip-streams')).toHaveAttribute('data-autodownload', 'true');
  });

  test('filters out unknown tab types', () => {
    renderWithProviders(
      <AutoDownloadChips availableTabs="clips,community" autoDownloadTabs="video,livestream" isMobile={false} />
    );

    expect(screen.queryAllByTestId(/auto-download-chip-/)).toHaveLength(0);
  });

  test('renders chips without auto downloads when autoDownloadTabs is empty', () => {
    renderWithProviders(
      <AutoDownloadChips availableTabs="videos,streams" autoDownloadTabs="" isMobile={false} />
    );

    expect(screen.getByTestId('auto-download-chip-videos')).toHaveAttribute('data-autodownload', 'false');
    expect(screen.getByTestId('auto-download-chip-streams')).toHaveAttribute('data-autodownload', 'false');
  });

  describe('download percentages', () => {
    test('shows the tab percentage in the chip label', () => {
      renderWithProviders(<AutoDownloadChips availableTabs="videos,shorts" autoDownloadTabs="video" isMobile={false} tabStats={tabStats} />);

      expect(screen.getByTestId('auto-download-chip-videos')).toHaveTextContent('Videos 26%');
    });

    test('shows no percentage for a tab without a total', () => {
      renderWithProviders(<AutoDownloadChips availableTabs="videos,shorts" autoDownloadTabs="video" isMobile={false} tabStats={tabStats} />);

      expect(screen.getByTestId('auto-download-chip-shorts')).toHaveTextContent(/^Shorts$/);
    });

    test('leaves the percentage explanation to the page, not each row', () => {
      renderWithProviders(<AutoDownloadChips availableTabs="videos" autoDownloadTabs="video" isMobile={false} tabStats={tabStats} />);

      expect(screen.queryByRole('button', { name: 'Download percentage info' })).not.toBeInTheDocument();
    });

    test('shows less than 1% for a tab with a few downloads', () => {
      renderWithProviders(
        <AutoDownloadChips
          availableTabs="videos"
          autoDownloadTabs="video"
          isMobile={false}
          tabStats={{ videos: { total: 6070, fetchedAt: null, downloaded: 9, ignored: 0, percent: 0 } }}
        />
      );

      expect(screen.getByTestId('auto-download-chip-videos')).toHaveTextContent('Videos <1%');
    });
  });
});
