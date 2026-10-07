import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlexRefreshControl } from '../PlexRefreshControl';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import { usePlexRefreshMapping } from '../../hooks/usePlexRefreshMapping';

jest.mock('../../hooks/usePlexRefreshMapping', () => ({
  PLEX_MAPPING_SAVE_ERROR: 'Could not save the Plex library mapping.',
  usePlexRefreshMapping: jest.fn(),
}));

const libraries = [{ id: '37', title: 'YouTube', type: 'movie' }, { id: '41', title: 'YouTube TV', type: 'show' }, { id: '40', title: 'Music', type: 'artist' }];
const connected = () => makePageValue({
  plexLibraries: libraries, plexConnectionStatus: 'connected',
  config: { ...makePageValue().config, plexYoutubeLibraryId: '37' },
});

describe('PlexRefreshControl', () => {
  let setMapping: jest.Mock;
  let removeMapping: jest.Mock;
  beforeEach(() => {
    setMapping = jest.fn().mockResolvedValue(undefined);
    removeMapping = jest.fn().mockResolvedValue(undefined);
    (usePlexRefreshMapping as jest.Mock).mockReturnValue({ saving: false, setMapping, removeMapping });
  });

  test('lists the default and movie/show libraries and saves a choice', async () => {
    renderInPage(<PlexRefreshControl folder={folder('TV', { layout: 'tv', channels: 1 })} report={null} />, { value: connected() });
    await userEvent.click(screen.getByRole('combobox', { name: 'After downloads here, Plex refreshes' }));
    expect(await screen.findByRole('option', { name: 'Default library (YouTube)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Music' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'YouTube TV' }));
    expect(setMapping).toHaveBeenCalledWith('TV', '41');
  });

  test('an explicit default reads as the user\'s choice and can be removed', async () => {
    renderInPage(<PlexRefreshControl folder={folder('TV', { layout: 'tv', plexMapping: { choice: 'default', libraryId: null } })} report={null} />, { value: connected() });
    expect(screen.getByText("You chose the default library for this folder, so Youtarr won't change it.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove setting' }));
    expect(removeMapping).toHaveBeenCalledWith('TV');
  });

  test('shows a read-only line when Plex is unreachable, still removable', async () => {
    renderInPage(<PlexRefreshControl folder={folder('TV', { layout: 'tv', plexMapping: { choice: 'library', libraryId: '41' } })} report={null} />,
      { value: makePageValue({ plexConnectionStatus: 'not_connected' }) });
    expect(screen.getByText(/After downloads here, Plex refreshes library 41/)).toBeInTheDocument();
    expect(screen.getByText("(Plex couldn't be reached)")).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove setting' }));
    expect(removeMapping).toHaveBeenCalledWith('TV');
  });

  test.each(['testing', 'not_tested'] as const)('does not call Plex unreachable while its connection is %s', (status) => {
    renderInPage(<PlexRefreshControl folder={folder('TV', { layout: 'tv', plexMapping: { choice: 'library', libraryId: '41' } })} report={null} />,
      { value: makePageValue({ plexConnectionStatus: status }) });
    expect(screen.getByText(/After downloads here, Plex refreshes library 41/)).toBeInTheDocument();
    expect(screen.queryByText("(Plex couldn't be reached)")).not.toBeInTheDocument();
  });

  test('reports a failed save', async () => {
    setMapping.mockRejectedValue(new Error('Plex doesn\'t list library 41.'));
    renderInPage(<PlexRefreshControl folder={folder('TV', { layout: 'tv', channels: 1 })} report={null} />, { value: connected() });
    await userEvent.click(screen.getByRole('combobox', { name: 'After downloads here, Plex refreshes' }));
    await userEvent.click(await screen.findByRole('option', { name: 'YouTube TV' }));
    expect(await screen.findByText("Plex doesn't list library 41.")).toBeInTheDocument();
  });

  test('keeps a mapped library of another type in the options', async () => {
    renderInPage(<PlexRefreshControl folder={folder('TV', { layout: 'tv', plexMapping: { choice: 'library', libraryId: '40' } })} report={null} />, { value: connected() });
    expect(screen.getByRole('combobox', { name: 'After downloads here, Plex refreshes' })).toHaveTextContent('Music');
  });

  test('choosing the default library saves an explicit default', async () => {
    renderInPage(<PlexRefreshControl folder={folder('TV', { layout: 'tv', plexMapping: { choice: 'library', libraryId: '41' } })} report={null} />, { value: connected() });
    await userEvent.click(screen.getByRole('combobox', { name: 'After downloads here, Plex refreshes' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Default library (YouTube)' }));
    expect(setMapping).toHaveBeenCalledWith('TV', null);
  });

  test('keeps the chosen library showing after a successful save until the folder reloads', async () => {
    renderInPage(<PlexRefreshControl folder={folder('TV', { layout: 'tv', channels: 1 })} report={null} />, { value: connected() });
    const select = screen.getByRole('combobox', { name: 'After downloads here, Plex refreshes' });
    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: 'YouTube TV' }));
    await waitFor(() => expect(setMapping).toHaveBeenCalled());
    expect(select).toHaveTextContent('YouTube TV');
  });

  test('goes back to the saved library when the save fails', async () => {
    setMapping.mockRejectedValue(new Error('nope'));
    renderInPage(<PlexRefreshControl folder={folder('TV', { layout: 'tv', channels: 1 })} report={null} />, { value: connected() });
    const select = screen.getByRole('combobox', { name: 'After downloads here, Plex refreshes' });
    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: 'YouTube TV' }));
    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(select).toHaveTextContent('Default library (YouTube)');
  });
});
