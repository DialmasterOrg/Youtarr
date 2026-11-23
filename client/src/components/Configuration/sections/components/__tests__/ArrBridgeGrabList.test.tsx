import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeGrabList } from '../ArrBridgeGrabList';
import { renderWithProviders } from '../../../../../test-utils';
import { ArrGrab, ArrGrabRetryOutcome } from '../../../utils/arrBridgeSetup';
import { ArrPagedList } from '../../../hooks/useArrBridgePagedList';
import { ArrGrabRetry } from '../../../hooks/useArrBridgeGrabRetry';

const grab = (overrides: Partial<ArrGrab> = {}): ArrGrab => ({
  id: 'g1',
  releaseTitle: 'Beyblade.S01E29.1080p.WEB-DL-BEYBLADEOfficial',
  youtubeId: 'g7VYYfoNaf0',
  videoTitle: 'BEYBLADE EN Episode 29: Play it Again Dizzi!',
  channelName: 'BEYBLADE Official',
  kind: 'tv',
  category: 'tv',
  state: 'handed-off',
  failMessage: null,
  blockedAt: null,
  nextTryAt: null,
  retryRequested: false,
  downloadsPaused: false,
  hiddenUntil: null,
  libraryCopy: null,
  createdAt: '2025-06-10T10:00:00.000Z',
  completedAt: '2025-06-10T10:05:00.000Z',
  removedAt: '2025-06-10T10:07:00.000Z',
  ...overrides,
});

interface SetupOptions extends Partial<ArrPagedList<ArrGrab>> {
  grabs?: ArrGrab[];
  busyId?: string | null;
  outcomes?: Record<string, ArrGrabRetryOutcome>;
}

const setup = ({ grabs = [grab()], busyId = null, outcomes = {}, ...overrides }: SetupOptions = {}) => {
  const retry: ArrGrabRetry = { retry: jest.fn().mockResolvedValue(undefined), busyId, outcomes };
  const list: ArrPagedList<ArrGrab> = {
    items: grabs,
    total: grabs.length,
    page: 1,
    pageSize: 10,
    query: '',
    loading: false,
    error: null,
    setPage: jest.fn(),
    setQuery: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeGrabList list={list} retry={retry} />);
  return { ...list, retry };
};

const rows = () => within(screen.getByRole('list', { name: 'Recent grabs' })).getAllByRole('listitem');

describe('ArrBridgeGrabList', () => {
  test('shows one row per grab with its release, video and state', () => {
    setup({ grabs: [grab(), grab({ id: 'g2', state: 'downloading', releaseTitle: 'Plan.9.1957.1080p.WEB-DL-X' })] });

    expect(rows()).toHaveLength(2);
    const first = within(rows()[0]);
    expect(first.getByText('Beyblade.S01E29.1080p.WEB-DL-BEYBLADEOfficial')).toBeInTheDocument();
    expect(first.getByText('BEYBLADE Official')).toBeInTheDocument();
    expect(first.getByText('Taken by Sonarr/Radarr')).toBeInTheDocument();
    expect(within(rows()[1]).getByText('Downloading')).toBeInTheDocument();
  });

  test('links the video to YouTube', () => {
    setup();

    expect(screen.getByRole('link', { name: 'BEYBLADE EN Episode 29: Play it Again Dizzi!' })).toHaveAttribute(
      'href', 'https://www.youtube.com/watch?v=g7VYYfoNaf0'
    );
  });

  test('shows the video id when Youtarr does not know the title', () => {
    setup({ grabs: [grab({ videoTitle: null, channelName: null })] });

    expect(screen.getByRole('link', { name: 'g7VYYfoNaf0' })).toBeInTheDocument();
  });

  test('shows why a grab failed', () => {
    setup({ grabs: [grab({ state: 'failed', failMessage: 'The video is members-only.' })] });

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('The video is members-only.')).toBeInTheDocument();
  });

  test('says what a grab that is ready is waiting for', () => {
    setup({ grabs: [grab({ state: 'ready' })] });

    expect(screen.getByText('Ready to import')).toBeInTheDocument();
    expect(screen.getByText(/check the app's queue/)).toBeInTheDocument();
  });

  test('Refresh asks for the list again', () => {
    const list = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(list.refresh).toHaveBeenCalledTimes(1);
  });

  test('the filter box says what it matches and hands on what is typed', () => {
    const list = setup();

    fireEvent.change(screen.getByLabelText('Filter grabs'), { target: { value: 'beyblade' } });

    expect(list.setQuery).toHaveBeenCalledWith('beyblade');
    expect(screen.getByText(/the release name, the video's title, its channel or its video id/)).toBeInTheDocument();
  });

  test('says so when the filter matches no grab', () => {
    setup({ grabs: [], query: 'zzz' });

    expect(screen.getByText('No grabs match this filter.')).toBeInTheDocument();
  });

  test('says so when nothing was grabbed yet', () => {
    setup({ grabs: [] });

    expect(screen.getByText('Nothing grabbed yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recent grabs' })).not.toBeInTheDocument();
  });

  test('shows that it is loading, with Refresh off', () => {
    setup({ grabs: [], loading: true });

    expect(screen.getByText('Loading the recent grabs...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  });

  test('shows an error in place of the list', () => {
    setup({ error: 'Could not load the recent grabs.' });

    expect(screen.getByText('Could not load the recent grabs.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recent grabs' })).not.toBeInTheDocument();
  });

  describe('a grab that waits while YouTube blocks downloads', () => {
    const NEXT_TRY = '2025-06-10T11:02:00.000Z';
    const nextTryTime = new Date(NEXT_TRY).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const blocked = (overrides: Partial<ArrGrab> = {}) => grab({
      state: 'blocked', blockedAt: '2025-06-10T10:02:00.000Z', nextTryAt: NEXT_TRY, completedAt: null, removedAt: null,
      ...overrides,
    });

    test('says that YouTube blocked it and when Youtarr checks again', () => {
      setup({ grabs: [blocked()] });

      const row = within(rows()[0]);
      expect(row.getByText('Waiting: blocked by YouTube')).toBeInTheDocument();
      expect(row.getByText(`YouTube blocked this download. Youtarr checks again at ${nextTryTime}.`)).toBeInTheDocument();
    });

    test('says so when it only waits behind another grab\'s block', () => {
      setup({ grabs: [blocked({ blockedAt: null })] });

      expect(
        screen.getByText(`YouTube blocked another grab, so this one waits too. Youtarr checks again at ${nextTryTime}.`)
      ).toBeInTheDocument();
    });

    test('says a check is coming soon when one is due', () => {
      setup({ grabs: [blocked({ nextTryAt: null })] });

      expect(screen.getByText('YouTube blocked this download. Youtarr checks again soon.')).toBeInTheDocument();
    });

    test('gives the cookie advice and says how to stop the wait', () => {
      setup({ grabs: [blocked()] });

      // An external cookie file cannot be replaced from Settings, which only
      // refreshes its status, so the advice names where each setup is fixed.
      expect(screen.getByText(/upload fresh YouTube cookies in Settings -> Cookies/)).toBeInTheDocument();
      expect(screen.getByText(/replace your external cookie file on the server/)).toBeInTheDocument();
      expect(screen.getByText(/To stop, remove it from the queue in Sonarr or Radarr\./)).toBeInTheDocument();
    });

    test('Try again asks for a try of that grab', () => {
      const { retry } = setup({ grabs: [blocked({ id: 'g7' })] });

      fireEvent.click(screen.getByRole('button', { name: /^Try again/ }));

      expect(retry.retry).toHaveBeenCalledWith('g7');
    });

    test('names the release on each Try again button, so they can be told apart', () => {
      setup({ grabs: [blocked({ id: 'g7', releaseTitle: 'Plan.9.1957.720p.YT.WEB-DL-X' }), blocked({ id: 'g8' })] });

      expect(screen.getByRole('button', { name: 'Try again: Plan.9.1957.720p.YT.WEB-DL-X' })).toHaveTextContent('Try again');
      expect(
        screen.getByRole('button', { name: 'Try again: Beyblade.S01E29.1080p.WEB-DL-BEYBLADEOfficial' })
      ).toBeInTheDocument();
    });

    test('shows that a try is being asked for, with every Try again off', () => {
      setup({ grabs: [blocked({ id: 'g7' }), blocked({ id: 'g8' })], busyId: 'g7' });

      const trying = within(rows()[0]).getByRole('button', { name: /^Trying:/ });
      expect(trying).toBeDisabled();
      expect(trying).toHaveTextContent('Trying...');
      expect(within(rows()[1]).getByRole('button', { name: /^Try again/ })).toBeDisabled();
    });

    test('offers no Try again on a grab that is not blocked', () => {
      setup({ grabs: [grab({ state: 'waiting' }), grab({ id: 'g2', state: 'downloading' })] });

      expect(screen.queryByRole('button', { name: /^Try again/ })).not.toBeInTheDocument();
    });

    test.each([
      ['started', 'downloading', 'Trying again now.'],
      ['queued', 'downloading', 'Queued. It starts when the current download finishes.'],
      ['ready', 'ready', 'The video is already in your Youtarr library, so it is ready to import.'],
      ['deferred', 'blocked', 'Youtarr could not start it right now. It waits for the next check.'],
      ['not-waiting', 'blocked', 'This grab is no longer waiting. Refresh the list.'],
      ['failed', 'blocked', 'Could not try again. Try once more in a moment.'],
    ] as const)('says what a try that ended as "%s" led to', (outcome, state, text) => {
      setup({ grabs: [blocked({ state })], outcomes: { g1: outcome } });

      expect(within(rows()[0]).getByRole('status')).toHaveTextContent(text);
    });

    test('drops "Trying again now" once the grab is back to waiting, blocked again', () => {
      setup({ grabs: [blocked()], outcomes: { g1: 'started' } });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByText(`YouTube blocked this download. Youtarr checks again at ${nextTryTime}.`)).toBeInTheDocument();
    });

    test('shows the outcome only on the grab that was tried', () => {
      setup({ grabs: [blocked(), blocked({ id: 'g2' })], outcomes: { g2: 'failed' } });

      expect(within(rows()[0]).queryByRole('status')).not.toBeInTheDocument();
      expect(within(rows()[1]).getByRole('status')).toBeInTheDocument();
    });

    describe('with a try the server still has to carry out', () => {
      const PAUSED_NOTE = 'Downloads are paused, so this will start when they resume.';

      test('says the try starts when downloads resume, whatever this browser remembers', () => {
        setup({ grabs: [blocked({ retryRequested: true, downloadsPaused: true })] });

        expect(screen.getByText(PAUSED_NOTE)).toBeInTheDocument();
      });

      test('says so once, also right after the click that asked for it', () => {
        setup({ grabs: [blocked({ retryRequested: true, downloadsPaused: true })], outcomes: { g1: 'paused' } });

        expect(screen.getAllByText(PAUSED_NOTE)).toHaveLength(1);
      });

      test('says the try comes in a moment once downloads run again', () => {
        setup({ grabs: [blocked({ retryRequested: true })] });

        expect(screen.getByText('Youtarr will try again in a moment.')).toBeInTheDocument();
      });

      test('says nothing of it once the try was made and blocked again', () => {
        setup({ grabs: [blocked({ retryRequested: false })], outcomes: { g1: 'paused' } });

        expect(screen.queryByText(PAUSED_NOTE)).not.toBeInTheDocument();
      });
    });

    test('promises no time on any blocked grab while downloads are paused', () => {
      setup({ grabs: [blocked({ downloadsPaused: true }), blocked({ id: 'g2', blockedAt: null, downloadsPaused: true })] });

      expect(screen.getByText('YouTube blocked this download. Youtarr checks again when downloads resume.')).toBeInTheDocument();
      expect(screen.getByText(
        'YouTube blocked another grab, so this one waits too. Youtarr checks again when downloads resume.'
      )).toBeInTheDocument();
      expect(screen.queryByText(/checks again at/)).not.toBeInTheDocument();
    });
  });

  describe('a failed grab', () => {
    const HIDDEN_UNTIL = '2025-06-17T10:05:00.000Z';

    test('says the release is blocklisted and until when Youtarr will not offer the video', () => {
      setup({ grabs: [grab({ state: 'failed', failMessage: 'Video unavailable', hiddenUntil: HIDDEN_UNTIL })] });

      expect(screen.getByText(
        `This release is now blocklisted in Sonarr or Radarr, and Youtarr will not offer this video again until ${
          new Date(HIDDEN_UNTIL).toLocaleDateString()
        }.`
      )).toBeInTheDocument();
    });

    test('says nothing of that once the video is offered again', () => {
      setup({ grabs: [grab({ state: 'failed', failMessage: 'Video unavailable', hiddenUntil: null })] });

      expect(screen.queryByText(/blocklisted/)).not.toBeInTheDocument();
    });
  });

  describe('a list of several pages', () => {
    const many = (count: number) => Array.from({ length: count }, (_, index) => grab({ id: `g${index}` }));

    test('shows the page it was given and where that is in the list', () => {
      setup({ grabs: many(10), total: 34, page: 2 });

      expect(rows()).toHaveLength(10);
      expect(screen.getByText('11 to 20 of 34')).toBeInTheDocument();
    });

    test('a page button asks for that page', () => {
      const list = setup({ grabs: many(10), total: 34, page: 2 });

      fireEvent.click(screen.getByRole('button', { name: 'go to next page' }));

      expect(list.setPage).toHaveBeenCalledWith(3);
    });
  });

  describe('the copy in Youtarr of a grab that was taken', () => {
    test.each([
      ['removed', 'Imported. Youtarr removed its own copy.'],
      ['kept', 'Youtarr kept its copy: Sonarr or Radarr did not confirm the import through the connection in step 3.'],
      ['checking', 'Asking Sonarr or Radarr whether it was imported, before Youtarr removes its own copy.'],
    ] as const)('says what happened when it is %s', (libraryCopy, text) => {
      setup({ grabs: [grab({ libraryCopy })] });

      expect(within(rows()[0]).getByText(text)).toBeInTheDocument();
    });

    test('says nothing when removing after the import was never asked for', () => {
      setup({ grabs: [grab({ libraryCopy: null })] });

      expect(within(rows()[0]).queryByText(/its own copy|kept its copy/)).not.toBeInTheDocument();
    });
  });
});
