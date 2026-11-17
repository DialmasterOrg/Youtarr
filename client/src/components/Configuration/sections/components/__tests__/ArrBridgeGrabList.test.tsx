import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeGrabList } from '../ArrBridgeGrabList';
import { renderWithProviders } from '../../../../../test-utils';
import { ArrGrab } from '../../../utils/arrBridgeSetup';

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
  libraryCopy: null,
  createdAt: '2025-06-10T10:00:00.000Z',
  completedAt: '2025-06-10T10:05:00.000Z',
  removedAt: '2025-06-10T10:07:00.000Z',
  ...overrides,
});

const setup = (overrides: Partial<React.ComponentProps<typeof ArrBridgeGrabList>> = {}) => {
  const props: React.ComponentProps<typeof ArrBridgeGrabList> = {
    grabs: [grab()],
    loading: false,
    error: null,
    onRefresh: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeGrabList {...props} />);
  return props;
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
    const props = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(props.onRefresh).toHaveBeenCalledTimes(1);
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

  describe('a long list', () => {
    const many = (count: number) => Array.from({ length: count }, (_, index) => grab({ id: `g${index}` }));

    test('shows the newest 10 and offers the rest', () => {
      setup({ grabs: many(14) });

      expect(rows()).toHaveLength(10);
      expect(screen.getByRole('button', { name: 'Show all 14' })).toBeInTheDocument();
    });

    test('shows them all when asked, and can fold them away again', () => {
      setup({ grabs: many(14) });

      fireEvent.click(screen.getByRole('button', { name: 'Show all 14' }));
      expect(rows()).toHaveLength(14);

      fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
      expect(rows()).toHaveLength(10);
    });

    test('10 or fewer need no button', () => {
      setup({ grabs: many(10) });

      expect(rows()).toHaveLength(10);
      expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
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
