import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartTvShowsDialog } from '../dialogs/StartTvShowsDialog';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import type { LibraryCheckResponse } from '../../../../types/libraryCheck';

const wholeFolderCheck: LibraryCheckResponse = {
  servers: [{ serverType: 'plex', name: 'Plex', reachable: true, error: null, downloadsPath: '/data' }],
  folders: [{ name: '', layout: 'videos', hasFiles: true, channels: 4, servers: [{
    serverType: 'plex', status: 'ok', issues: [], libraries: [{ id: '1', name: 'YouTube', type: 'videos', location: '/data', relation: 'exact' }],
  }] }],
};

describe('StartTvShowsDialog', () => {
  test('path A lists the main folder\'s channels, then the ones that follow the default folder', () => {
    renderInPage(<StartTvShowsDialog open onClose={jest.fn()} />, { value: makePageValue({
      folders: [folder('', { isDefault: true, channels: 4, channelsChosen: 1, channelsFollowing: 3 })],
      servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'],
      check: { ...makePageValue().check, data: wholeFolderCheck },
      mainDetail: {
        name: '', layout: 'videos', channels: [{ channelId: 'UC1', name: 'Blippi', videoCount: 3 }],
        followers: { count: 5, sample: ['Cocomelon', 'Numberblocks', 'Peppa'] }, playlists: [], titleShows: [], example: null,
      },
    }) });
    expect(screen.getByRole('link', { name: 'Blippi' })).toHaveAttribute('href', '/channel/UC1');
    expect(screen.getByText('5 more follow the default folder (Cocomelon, Numberblocks, Peppa and 2 more): make another folder the default, '
      + 'or set their Library folder in Channel Settings.')).toBeInTheDocument();
  });

  test('everything in the main folder: A preselected, B available, the steps and the guide link', () => {
    renderInPage(<StartTvShowsDialog open onClose={jest.fn()} />, {
      value: makePageValue({ folders: [folder('', { isDefault: true, channels: 3, fileCount: 10 })] }),
    });
    expect(screen.getByText('Everything downloads into the main folder.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Add a TV show folder next to your Video folders/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Make the whole downloads folder TV shows/ })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Read the full guide' })).toHaveAttribute('href', 'https://dialmasterorg.github.io/Youtarr/docs/usage-guide/#move-an-existing-setup-to-tv-shows');
  });

  test('a path action closes the panel and opens the flow', async () => {
    const value = makePageValue({ folders: [folder('', { isDefault: true })] });
    const onClose = jest.fn();
    renderInPage(<StartTvShowsDialog open onClose={onClose} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Add TV folder' }));
    expect(onClose).toHaveBeenCalled();
    expect(value.openAddFolder).toHaveBeenCalledWith('tv');
  });

  test('path B selects the main folder and opens its confirm', async () => {
    const value = makePageValue({ folders: [folder('', { isDefault: true })] });
    renderInPage(<StartTvShowsDialog open onClose={jest.fn()} />, { value });
    await userEvent.click(screen.getByRole('radio', { name: /Make the whole downloads folder TV shows/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Use the main folder for TV shows' }));
    expect(value.selectFolder).toHaveBeenCalledWith('');
    expect(value.openMainFolderTv).toHaveBeenCalled();
  });

  test('path C opens the chosen Video folder', async () => {
    const value = makePageValue({ folders: [folder(''), folder('Kids', { channels: 2 }), folder('Docs', { fileCount: 3 })] });
    renderInPage(<StartTvShowsDialog open onClose={jest.fn()} />, { value });
    await userEvent.click(screen.getByRole('radio', { name: /Turn a Video folder into a TV show folder/ }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Folder' }));
    await userEvent.click(await screen.findByRole('option', { name: '__Kids' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open __Kids' }));
    expect(value.selectFolder).toHaveBeenCalledWith('Kids');
  });

  test('B is unavailable while Video folders are in use on Jellyfin', () => {
    renderInPage(<StartTvShowsDialog open onClose={jest.fn()} />, { value: makePageValue({
      folders: [folder(''), folder('Kids', { channels: 2 })], servers: [{ serverType: 'jellyfin', name: 'Jellyfin' }],
    }) });
    expect(screen.getByRole('radio', { name: /Make the whole downloads folder TV shows/ })).toBeDisabled();
    expect(screen.getByText(/You use Video folders \(__Kids\)/)).toBeInTheDocument();
  });
});
