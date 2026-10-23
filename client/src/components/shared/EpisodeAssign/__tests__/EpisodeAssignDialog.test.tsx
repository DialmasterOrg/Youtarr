import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { VideoEpisode } from '../../../../types/titleShows';
import { ReorganizeRequiredError } from '../../Reorganize/reorganizeErrors';

const mockAssign = jest.fn();
let mockState: { data: VideoEpisode | null; loading: boolean; error: string | null };

jest.mock('../useVideoEpisode', () => ({
  useVideoEpisode: () => ({ ...mockState, refetch: jest.fn(), assign: mockAssign }),
}));

let mockStartResult: { operationId: number | null; applied: boolean } = { operationId: 77, applied: false };
jest.mock('../../Reorganize/ReorganizeDialog', () => ({
  __esModule: true,
  default: function MockReorganizeDialog(props: { open: boolean; change: unknown; onApplied?: (result: unknown) => void }) {
    const React = require('react');
    return props.open
      ? React.createElement('button', { 'data-testid': 'reorganize-dialog', onClick: () => props.onApplied?.(mockStartResult) }, JSON.stringify(props.change))
      : null;
  },
}));

// The tracked operation and what runs when it ends.
const mockOutcome: { operationId: number | null; onFinished: (() => void) | null } = { operationId: null, onFinished: null };
jest.mock('../../Reorganize/hooks/useReorganizeOutcome', () => ({
  useReorganizeOutcome: (_token: string | null, operationId: number | null, onFinished: () => void) => {
    mockOutcome.operationId = operationId;
    mockOutcome.onFinished = onFinished;
  },
}));

import EpisodeAssignDialog from '../EpisodeAssignDialog';

const SHOWS: VideoEpisode['shows'] = [{ id: 3, name: 'Beyblade', seasonNames: { 2: 'V-Force' } }, { id: 4, name: 'Clips', seasonNames: {} }];

function episode(classification: VideoEpisode['classification'] = null, extra: Partial<VideoEpisode> = {}): VideoEpisode {
  return { channelId: 'UC1', assignable: true, classification, shows: SHOWS, ...extra };
}

const titleEpisode = (extra = {}) => ({
  showId: 3, showName: 'Beyblade', kind: 'title' as const, status: 'assigned', season: 1, episode: 20, code: 'S01E20',
  source: 'title', notAnEpisode: false, ...extra,
});

function renderDialog(props: Partial<React.ComponentProps<typeof EpisodeAssignDialog>> = {}) {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  render(
    <EpisodeAssignDialog open token="token" youtubeId="abcdefghijk" videoTitle="Ep 20" onClose={onClose} onSaved={onSaved} {...props} />
  );
  return { onClose, onSaved };
}

describe('EpisodeAssignDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssign.mockResolvedValue(undefined);
    mockState = { data: episode(), loading: false, error: null };
  });

  test('keeps Assign off while the next video loads', () => {
    mockState.data = episode(titleEpisode());
    const { rerender } = render(<EpisodeAssignDialog open token="token" youtubeId="aaaaaaaaaaa" onClose={jest.fn()} />);
    mockState = { data: null, loading: true, error: null };
    rerender(<EpisodeAssignDialog open token="token" youtubeId="bbbbbbbbbbb" onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  });

  test('keeps Assign off when the video could not be loaded', () => {
    mockState.data = episode(titleEpisode());
    const { rerender } = render(<EpisodeAssignDialog open token="token" youtubeId="aaaaaaaaaaa" onClose={jest.fn()} />);
    mockState = { data: null, loading: false, error: 'Failed to load the episode' };
    rerender(<EpisodeAssignDialog open token="token" youtubeId="bbbbbbbbbbb" onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  });

  test('starts the next video from its own episode, not the previous one\'s values', async () => {
    mockState.data = episode(titleEpisode());
    const { rerender } = render(<EpisodeAssignDialog open token="token" youtubeId="aaaaaaaaaaa" onClose={jest.fn()} />);
    await userEvent.clear(screen.getByLabelText('Episode'));
    await userEvent.type(screen.getByLabelText('Episode'), '33');
    mockState = { data: null, loading: true, error: null };
    rerender(<EpisodeAssignDialog open token="token" youtubeId="bbbbbbbbbbb" onClose={jest.fn()} />);
    mockState = { data: episode(null), loading: false, error: null };
    rerender(<EpisodeAssignDialog open token="token" youtubeId="bbbbbbbbbbb" onClose={jest.fn()} />);
    expect(screen.getByLabelText('Episode')).toHaveValue(null);
  });

  test('says where the video is now', () => {
    mockState.data = episode(titleEpisode());
    renderDialog();
    expect(screen.getByText('Now: S01E20 of Beyblade.')).toBeInTheDocument();
  });

  test('starts from the current episode', () => {
    mockState.data = episode(titleEpisode());
    renderDialog();
    expect(screen.getByLabelText('Season')).toHaveValue(1);
    expect(screen.getByLabelText('Episode')).toHaveValue(20);
  });

  test('assigns the chosen season and episode', async () => {
    const { onSaved } = renderDialog();
    await userEvent.type(screen.getByLabelText('Episode'), '51');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(mockAssign).toHaveBeenCalledWith({ showId: 3, season: 1, episode: 51 }));
    expect(onSaved).toHaveBeenCalled();
  });

  test('marks the video as not an episode', async () => {
    mockState.data = episode(titleEpisode());
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Not an episode' }));
    await waitFor(() => expect(mockAssign).toHaveBeenCalledWith({ notAnEpisode: true }));
  });

  test('returns a hand-numbered video to automatic classification', async () => {
    mockState.data = episode(titleEpisode({ source: 'manual' }));
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Back to automatic' }));
    await waitFor(() => expect(mockAssign).toHaveBeenCalledWith({ automatic: true }));
  });

  test('offers no way back for an automatic classification', () => {
    mockState.data = episode(titleEpisode());
    renderDialog();
    expect(screen.queryByRole('button', { name: 'Back to automatic' })).not.toBeInTheDocument();
  });

  test('refuses an episode number below 1', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Episode'), '0');
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  });

  test('assigns an upload-year season', async () => {
    renderDialog();
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2024');
    await userEvent.type(screen.getByLabelText('Episode'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(mockAssign).toHaveBeenCalledWith({ showId: 3, season: 2024, episode: 5 }));
  });

  test('refuses a season between the title and year ranges', async () => {
    renderDialog();
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '200');
    await userEvent.type(screen.getByLabelText('Episode'), '5');
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  });

  test('says which seasons can be assigned when the season is out of range', async () => {
    renderDialog();
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '200');
    expect(screen.getByText('0-199, or a year 1928-2500')).toBeInTheDocument();
  });

  test('says nothing about the range for an upload-year season', async () => {
    renderDialog();
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2024');
    expect(screen.queryByText('0-199, or a year 1928-2500')).not.toBeInTheDocument();
  });

  test('explains a channel without shows', () => {
    mockState.data = episode(null, { assignable: false, shows: [] });
    renderDialog();
    expect(screen.getByText(/Add a show in Channel Settings/)).toBeInTheDocument();
  });

  test('shows the server\'s refusal', async () => {
    mockAssign.mockRejectedValueOnce(new Error('The season must be between 0 and 199.'));
    renderDialog();
    await userEvent.type(screen.getByLabelText('Episode'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(await screen.findByText('The season must be between 0 and 199.')).toBeInTheDocument();
  });

  describe('when the file has to move', () => {
    const change = { type: 'titleShows' as const, channelId: 'UC1', shows: [], overrides: [] };

    const startMove = async () => {
      mockAssign.mockRejectedValueOnce(new ReorganizeRequiredError('Review the move first.', change));
      const { onSaved, onClose } = renderDialog();
      await userEvent.type(screen.getByLabelText('Episode'), '3');
      await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
      await userEvent.click(await screen.findByTestId('reorganize-dialog'));
      return { onSaved, onClose };
    };

    beforeEach(() => {
      mockStartResult = { operationId: 77, applied: false };
      mockOutcome.operationId = null;
      mockOutcome.onFinished = null;
    });

    test('waits for the move to end before reporting the episode saved', async () => {
      const { onSaved } = await startMove();
      expect(onSaved).not.toHaveBeenCalled();
    });

    test('follows the move it started', async () => {
      await startMove();
      expect(mockOutcome.operationId).toBe(77);
    });

    test('reports the episode saved when the move ends', async () => {
      const { onSaved } = await startMove();
      act(() => { mockOutcome.onFinished?.(); });
      expect(onSaved).toHaveBeenCalled();
    });

    test('reports a change applied without a move as saved at once', async () => {
      mockStartResult = { operationId: null, applied: true };
      const { onSaved } = await startMove();
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
