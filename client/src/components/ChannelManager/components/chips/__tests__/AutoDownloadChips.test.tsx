import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutoDownloadChips from '../AutoDownloadChips';
import { renderWithProviders } from '../../../../../test-utils';

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
});
