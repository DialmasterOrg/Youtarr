import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ReorganizeOperationBody from '../ReorganizeOperationBody';
import { ReorganizeOperation } from '../../../../types/reorganize';

const operation = (overrides: Partial<ReorganizeOperation> = {}): ReorganizeOperation => ({
  id: 3, label: 'Chan', status: 'running', total: 4, done: 1, failed: 1, failedItems: [], ...overrides,
});

function renderBody(op: ReorganizeOperation | null, extra: { error?: string | null; onRetry?: () => void } = {}) {
  const onRetry = extra.onRetry ?? jest.fn();
  render(<ReorganizeOperationBody operation={op} error={extra.error ?? null} retrying={false} onRetry={onRetry} />);
  return { onRetry, user: userEvent.setup() };
}

describe('ReorganizeOperationBody', () => {
  test('shows progress while running', () => {
    renderBody(operation());

    expect(screen.getByText('Moving videos for Chan: 2 of 4.')).toBeInTheDocument();
    expect(screen.getByText(/You can close this window/)).toBeInTheDocument();
  });

  test('reports a finished move', () => {
    renderBody(operation({ status: 'completed', done: 4, failed: 0 }));

    expect(screen.getByText('Moved 4 videos.')).toBeInTheDocument();
  });

  test('lists the videos that could not move and retries them', async () => {
    const { onRetry, user } = renderBody(operation({
      status: 'partial', done: 3, failed: 1,
      failedItems: [{ id: 8, youtubeId: 'a1', title: 'First', channelId: 'UC1', error: 'A file already exists' }],
    }));

    expect(screen.getByText('Moved 3 videos. 1 video could not be moved and stays where it was.')).toBeInTheDocument();
    expect(screen.getByText('A file already exists')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry these videos' }));

    expect(onRetry).toHaveBeenCalled();
  });

  test('shows why a move failed', () => {
    renderBody(operation({ status: 'failed', done: 0, error: 'No video could be moved, so the settings change was undone.' }));

    expect(screen.getByText('No video could be moved, so the settings change was undone.')).toBeInTheDocument();
  });

  test('shows a load error before the operation is known', () => {
    renderBody(null, { error: 'Reorganize not found' });

    expect(screen.getByText('Reorganize not found')).toBeInTheDocument();
  });
});
