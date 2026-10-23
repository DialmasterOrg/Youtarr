import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WatchStateRestores } from '../WatchStateRestores';
import { UseWatchStateHoldsResult } from '../../../hooks/useWatchStateHolds';

const mockUseWatchStateHolds = jest.fn();
jest.mock('../../../hooks/useWatchStateHolds', () => ({
  useWatchStateHolds: (token: string | null) => mockUseWatchStateHolds(token),
}));

function hookResult(overrides: Partial<UseWatchStateHoldsResult> = {}): UseWatchStateHoldsResult {
  return {
    holds: [],
    counts: { pending: 0, failed: 0 },
    loading: false,
    error: null,
    busyId: null,
    retry: jest.fn(),
    dismiss: jest.fn(),
    refetch: jest.fn(),
    ...overrides,
  };
}

const FAILED = {
  id: 4, state: 'failed' as const, serverType: 'jellyfin' as const, serverUserId: 'u1', serverUserName: 'Ann',
  youtubeId: 'a1', title: 'Big Build', channelName: 'Chan', played: true, positionMs: null, attempts: 5,
  lastAttemptAt: null, lastError: 'HTTP 404', expiresAt: '2026-10-17T00:00:00Z',
};

describe('WatchStateRestores', () => {
  test('shows nothing when no restore is waiting', () => {
    mockUseWatchStateHolds.mockReturnValue(hookResult());
    render(<WatchStateRestores token="token" />);

    expect(screen.queryByText('Watch state restores')).not.toBeInTheDocument();
  });

  test('counts restores still waiting for the media servers', () => {
    mockUseWatchStateHolds.mockReturnValue(hookResult({ counts: { pending: 3, failed: 0 } }));
    render(<WatchStateRestores token="token" />);

    expect(screen.getByText('3 restores are waiting for the media servers.')).toBeInTheDocument();
  });

  test('lists failed restores with retry and dismiss', async () => {
    const result = hookResult({ holds: [FAILED], counts: { pending: 0, failed: 1 } });
    mockUseWatchStateHolds.mockReturnValue(result);
    const user = userEvent.setup();
    render(<WatchStateRestores token="token" />);

    const list = within(screen.getByRole('list', { name: 'Failed restores' }));
    expect(list.getByText('Big Build')).toBeInTheDocument();
    expect(list.getByText('Jellyfin, Ann: watched. HTTP 404')).toBeInTheDocument();

    await user.click(list.getByRole('button', { name: 'Retry' }));
    await user.click(list.getByRole('button', { name: 'Dismiss' }));

    expect(result.retry).toHaveBeenCalledWith(4);
    expect(result.dismiss).toHaveBeenCalledWith(4);
  });
});
