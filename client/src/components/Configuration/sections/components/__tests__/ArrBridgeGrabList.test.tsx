import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeGrabList } from '../ArrBridgeGrabList';
import { renderWithProviders } from '../../../../../test-utils';
import { ArrGrab } from '../../../utils/arrBridgeSetup';
import { ArrPagedList } from '../../../hooks/useArrBridgePagedList';

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

const setup = ({ grabs = [grab()], ...overrides }: Partial<ArrPagedList<ArrGrab>> & { grabs?: ArrGrab[] } = {}) => {
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
  renderWithProviders(<ArrBridgeGrabList list={list} />);
  return list;
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
