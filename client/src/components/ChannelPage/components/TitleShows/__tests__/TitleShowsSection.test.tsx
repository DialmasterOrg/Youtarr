import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChannelTitleShows, TitleShow } from '../../../../../types/titleShows';
import { ReorganizeRequiredError } from '../../../../shared/Reorganize/reorganizeErrors';

const mockHook = {
  data: null as ChannelTitleShows | null,
  loading: false,
  error: null as string | null,
  refetch: jest.fn(),
  createShow: jest.fn(),
  updateShow: jest.fn(),
  retireShow: jest.fn(),
  restoreShow: jest.fn(),
  reorderShows: jest.fn(),
  setShowOnly: jest.fn(),
  takeDuplicateCopy: jest.fn(),
  recheck: jest.fn(),
};
jest.mock('../../../hooks/useTitleShows', () => ({
  ...jest.requireActual('../../../hooks/useTitleShows'),
  useTitleShows: () => mockHook,
}));

const mockDeleteVideos = jest.fn();
jest.mock('../../../../shared/useVideoDeletion', () => ({ useVideoDeletion: () => ({ deleteVideos: mockDeleteVideos }) }));

function mockDialog(testId: string) {
  return {
    __esModule: true,
    default: function MockDialog(props: { open: boolean; drafts?: unknown; change?: unknown; onClose: () => void }) {
      const React = require('react');
      if (!props.open) return null;
      return React.createElement('div', { 'data-testid': testId }, JSON.stringify(props.drafts ?? props.change ?? null));
    },
  };
}
jest.mock('../TitleShowEditorDialog', () => ({
  __esModule: true,
  default: function MockEditor(props: { open: boolean; drafts: unknown; onRestore?: (showId: number) => Promise<void> }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', null,
      React.createElement('div', { 'data-testid': 'editor' }, JSON.stringify(props.drafts)),
      React.createElement('button', { type: 'button', onClick: () => { void props.onRestore?.(5); } }, 'Restore the removed show'));
  },
}));
jest.mock('../../../../shared/Reorganize/ReorganizeDialog', () => ({
  __esModule: true,
  default: function MockReview(props: { open: boolean; change: unknown; onApplied?: (result: unknown) => void }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', null,
      React.createElement('div', { 'data-testid': 'review' }, JSON.stringify(props.change)),
      React.createElement('button', { type: 'button', onClick: () => props.onApplied?.({ operationId: 55, applied: false }) }, 'Move'));
  },
}));

const mockOutcome: { operationId: number | null; onFinished: (() => void) | null } = { operationId: null, onFinished: null };
jest.mock('../../../../shared/Reorganize/hooks/useReorganizeOutcome', () => ({
  useReorganizeOutcome: (_token: string | null, operationId: number | null, onFinished: () => void) => {
    mockOutcome.operationId = operationId;
    mockOutcome.onFinished = onFinished;
  },
}));
jest.mock('../../../../shared/EpisodeAssign/EpisodeAssignDialog', () => mockDialog('assign'));

import TitleShowsSection from '../TitleShowsSection';

function show(id: number, extra: Partial<TitleShow> = {}): TitleShow {
  return {
    id, name: `Show ${id}`, folderName: `Show ${id}`, libraryFolder: 'TV', position: id, retired: false, excludeTerms: [],
    seasonNames: {}, counts: null,
    patterns: [{ text: 'Ep {episode}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title', compiledRegex: 'x' }],
    ...extra,
  };
}

const STATE: ChannelTitleShows = {
  shows: [show(3), show(4), show(5, { retired: true })],
  conflicts: [],
  showOnlyDownloads: false,
  tvFolders: ['TV'],
  defaultLibraryFolder: 'TV',
};

describe('TitleShowsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHook.data = STATE;
    mockHook.error = null;
    Object.values(mockHook).forEach((value) => {
      if (jest.isMockFunction(value)) value.mockResolvedValue(undefined);
    });
  });

  const renderSection = () => render(<TitleShowsSection token="token" channelId="UC1" />);

  test('lists the active shows and the removed ones', () => {
    renderSection();
    expect(screen.getByRole('button', { name: 'Edit Show 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Show 5' })).toBeInTheDocument();
  });

  test('opens the editor for a new show with the channel\'s shows as drafts', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Add show' }));
    const drafts = JSON.parse(screen.getByTestId('editor').textContent || '[]');
    expect(drafts.map((draft: { id: number }) => draft.id)).toEqual([3, 4]);
    expect(drafts[0]).not.toHaveProperty('counts');
  });

  test('reorders the shows', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Move Show 3 down' }));
    await waitFor(() => expect(mockHook.reorderShows).toHaveBeenCalledWith([4, 3]));
  });

  test('opens the review when removing a show moves downloaded videos', async () => {
    const change = { type: 'titleShows' as const, channelId: 'UC1', shows: [] };
    mockHook.retireShow.mockRejectedValueOnce(new ReorganizeRequiredError('Review the move first.', change));
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Show 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByTestId('review')).toHaveTextContent('titleShows');
  });

  test('reloads the shows when the move a change started ends, not when it starts', async () => {
    const change = { type: 'titleShows' as const, channelId: 'UC1', shows: [] };
    mockHook.retireShow.mockRejectedValueOnce(new ReorganizeRequiredError('Review the move first.', change));
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Show 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Move' }));
    expect([mockOutcome.operationId, mockHook.refetch.mock.calls.length]).toEqual([55, 0]);
    act(() => { mockOutcome.onFinished?.(); });
    expect(mockHook.refetch).toHaveBeenCalled();
  });

  test('tells the settings dialog when the move a change started ends', async () => {
    const onMoveEnded = jest.fn();
    const change = { type: 'titleShows' as const, channelId: 'UC1', shows: [] };
    mockHook.retireShow.mockRejectedValueOnce(new ReorganizeRequiredError('Review the move first.', change));
    render(<TitleShowsSection token="token" channelId="UC1" onMoveEnded={onMoveEnded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Show 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Move' }));
    expect(onMoveEnded).not.toHaveBeenCalled();
    act(() => { mockOutcome.onFinished?.(); });
    expect(onMoveEnded).toHaveBeenCalledTimes(1);
  });

  test('reloads the shows when the channel\'s TV layout or folder changes', () => {
    const { rerender } = render(<TitleShowsSection token="token" channelId="UC1" tvKey="videos|Kids" />);
    expect(mockHook.refetch).not.toHaveBeenCalled();
    rerender(<TitleShowsSection token="token" channelId="UC1" tvKey="tv|TV Shows" />);
    expect(mockHook.refetch).toHaveBeenCalledTimes(1);
  });

  test('shows a refused action', async () => {
    mockHook.restoreShow.mockRejectedValueOnce(new Error('A reorganize is moving this channel\'s files.'));
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Show 5' }));
    expect(await screen.findByText('A reorganize is moving this channel\'s files.')).toBeInTheDocument();
  });

  test('opens the review when the editor restores a removed show whose videos move', async () => {
    const change = { type: 'titleShows' as const, channelId: 'UC1', shows: [] };
    mockHook.restoreShow.mockRejectedValueOnce(new ReorganizeRequiredError('Review the move first.', change));
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Add show' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore the removed show' }));
    expect(await screen.findByTestId('review')).toHaveTextContent('titleShows');
  });

  test('shows a refused restore from the editor', async () => {
    mockHook.restoreShow.mockRejectedValueOnce(new Error('A reorganize is moving this channel\'s files.'));
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Add show' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore the removed show' }));
    expect(await screen.findByText('A reorganize is moving this channel\'s files.')).toBeInTheDocument();
  });

  test('limits downloads to the shows', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('checkbox', { name: /Only download videos that belong to a show/ }));
    await waitFor(() => expect(mockHook.setShowOnly).toHaveBeenCalledWith(true));
  });

  test('keeps the show-only switch off without shows', () => {
    mockHook.data = { ...STATE, shows: [] };
    renderSection();
    expect(screen.getByRole('checkbox', { name: /Only download videos that belong to a show/ })).toBeDisabled();
  });

  test('assigns a video that is not a duplicate by hand', () => {
    mockHook.data = {
      ...STATE,
      conflicts: [{
        youtubeId: 'JN49nXLOqQI', kind: 'duplicate', showId: 3, duplicateOf: 'y7xVT7DTt2k', season: 1, episode: 20, message: null,
        suppressed: true, title: 'Re-upload', downloaded: false, videoId: null, duplicateOfTitle: 'Original',
      }],
    };
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Not a duplicate' }));
    expect(screen.getByTestId('assign')).toBeInTheDocument();
  });

  test('reports a failed load', () => {
    mockHook.data = null;
    mockHook.error = 'Failed to load the channel\'s shows';
    renderSection();
    expect(screen.getByText('Failed to load the channel\'s shows')).toBeInTheDocument();
  });
});
