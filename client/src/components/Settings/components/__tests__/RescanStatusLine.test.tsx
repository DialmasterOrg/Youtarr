import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RescanStatusLine from '../RescanStatusLine';
import { renderWithProviders } from '../../../../test-utils';
import type { RescanLastRun, RescanProgress } from '../../../../hooks/useRescanStatus';

const lastRun = (overrides: Partial<RescanLastRun> = {}): RescanLastRun => ({
  startedAt: '2026-11-21T09:30:00.000Z',
  completedAt: '2026-11-21T09:33:33.000Z',
  trigger: 'scheduled',
  status: 'completed',
  videosUpdated: 1,
  videosMarkedMissing: 0,
  videosScanned: 16797,
  filesFoundOnDisk: 16799,
  errorMessage: null,
  ...overrides,
});

const walking: RescanProgress = {
  phase: 'walk', foldersScanned: 4210, filesFound: 3980, videosProcessed: 0, videosTotal: 0, startedAt: '2026-11-21T14:34:00.000Z',
};

const renderLine = (props: Partial<React.ComponentProps<typeof RescanStatusLine>> = {}) =>
  renderWithProviders(<RescanStatusLine running={false} progress={null} lastRun={null} {...props} />);

describe('RescanStatusLine', () => {
  test('says when no rescan has run yet', () => {
    renderLine();
    expect(screen.getByText('No rescan has run yet.')).toBeInTheDocument();
  });

  test('shows what the last rescan found against the videos it checked, and how long it took', () => {
    renderLine({ lastRun: lastRun() });
    expect(screen.getByText(/, took 3m 33s\./)).toBeInTheDocument();
    expect(screen.getByText(/Found 16,799 video files on disk for 16,797 videos: updated 1, marked 0 missing\./)).toBeInTheDocument();
  });

  test('makes a folder holding far fewer files than videos obvious, with the missing count', () => {
    renderLine({ lastRun: lastRun({ filesFoundOnDisk: 2, videosScanned: 16801, videosUpdated: 0, videosMissing: 16800 }) });
    expect(screen.getByText(/Found 2 video files on disk for 16,801 videos: updated 0, marked 0 missing\. 16,800 videos are missing\./)).toBeInTheDocument();
  });

  test('leaves out counts for a rescan that stopped before checking anything', () => {
    renderLine({ lastRun: lastRun({ status: 'error', videosScanned: 0, filesFoundOnDisk: 0, errorMessage: 'The downloads folder is empty.' }) });
    expect(screen.queryByText(/video files on disk/)).not.toBeInTheDocument();
  });

  test('explains that a run stopped at the time limit starts over', () => {
    renderLine({ lastRun: lastRun({ status: 'timed-out', videosScanned: 0 }) });
    expect(screen.getByText(/It stopped at the time limit, so the next run starts over\./)).toBeInTheDocument();
  });

  test('says when the downloads folder check was skipped', () => {
    renderLine({ lastRun: lastRun({ libraryCheckSkipped: true }) });
    expect(screen.getByText(/The downloads folder check was skipped\./)).toBeInTheDocument();
  });

  test('shows walk progress while a rescan runs, with the last run\'s length to expect', () => {
    renderLine({ running: true, progress: walking, lastRun: lastRun() });
    expect(screen.getByText(
      'Rescan in progress. Scanning the downloads folder: 4,210 folders and 3,980 video files so far. The last rescan took 3m 33s.'
    )).toBeInTheDocument();
  });

  test('shows how far the check of each video has got', () => {
    renderLine({ running: true, progress: { ...walking, phase: 'rows', videosProcessed: 5000, videosTotal: 16801 } });
    expect(screen.getByText(/Checking videos against the files found: 5,000 of 16,801\./)).toBeInTheDocument();
  });

  test('says a rescan is in progress before its first progress report', () => {
    renderLine({ running: true });
    expect(screen.getByText('Rescan in progress.')).toBeInTheDocument();
  });
});
