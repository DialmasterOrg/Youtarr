import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderShelf } from '../FolderShelf';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';

let mockWidth = 900;
jest.mock('../../../../hooks/useContainerWidth', () => ({ useContainerWidth: () => [jest.fn(), mockWidth] }));

const unused = ['A', 'B', 'C', 'D', 'E'].map((name) => folder(name));
const folders = [folder('Zoo', { channels: 1 }), folder('', { channels: 2 }), folder('Kids', { isDefault: true }), folder('Old', { fileCount: 3 }), ...unused];

describe('FolderShelf', () => {
  beforeEach(() => { mockWidth = 900; });

  test('orders main, default, active, holds videos, then the first three unused', () => {
    renderInPage(<FolderShelf layout="videos" folders={folders} selectedName={null} focusName={null} onFocused={jest.fn()} />);
    const shelf = screen.getByRole('region', { name: /Video folders/ });
    expect(within(shelf).getAllByText(/^(Main folder|__\w+)$/).map((el) => el.textContent)).toEqual([
      'Main folder', '__Kids', '__Zoo', '__Old', '__A', '__B', '__C',
    ]);
    expect(screen.getByRole('button', { name: 'Show 2 more unused' })).toBeInTheDocument();
  });

  test('starts expanded when the selected folder is a hidden unused one', () => {
    renderInPage(<FolderShelf layout="videos" folders={folders} selectedName="E" focusName={null} onFocused={jest.fn()} />);
    expect(screen.getByRole('button', { name: /^__E/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument();
  });

  test('expands and focuses a hidden unused folder that is the focus target', () => {
    const onFocused = jest.fn();
    renderInPage(<FolderShelf layout="videos" folders={folders} selectedName={null} focusName="E" onFocused={onFocused} />);
    expect(screen.getByRole('button', { name: /^__E/ })).toHaveFocus();
    expect(onFocused).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument();
  });

  test('on phones the Add button is labelled in full', () => {
    renderInPage(<FolderShelf layout="tv" folders={[folder('TV', { layout: 'tv', channels: 1 })]} selectedName={null} focusName={null} onFocused={jest.fn()} />,
      { value: makePageValue({ phone: true }) });
    expect(screen.getByRole('button', { name: 'Add a TV show folder' })).toHaveTextContent('Add');
  });

  test('its Add button presets the layout', async () => {
    const value = makePageValue();
    renderInPage(<FolderShelf layout="tv" folders={[folder('TV', { layout: 'tv', channels: 1 })]} selectedName={null} focusName={null} onFocused={jest.fn()} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Add TV folder' }));
    expect(value.openAddFolder).toHaveBeenCalledWith('tv');
  });

  test('without servers the header names every library type', () => {
    renderInPage(<FolderShelf layout="tv" folders={[folder('TV', { layout: 'tv', channels: 1 })]} selectedName={null} focusName={null} onFocused={jest.fn()} />);
    expect(screen.getByText(/Library type: Plex TV Shows, Jellyfin Shows, Emby TV shows, Kodi TV shows source/)).toBeInTheDocument();
  });

  test('with three servers on a narrow shelf, rows stack their status', () => {
    mockWidth = 600;
    const three = [
      { serverType: 'plex' as const, name: 'Plex' }, { serverType: 'jellyfin' as const, name: 'Jellyfin' }, { serverType: 'emby' as const, name: 'Emby' },
    ];
    const base = makePageValue();
    const value = makePageValue({
      servers: three,
      check: { ...base.check, data: { servers: three.map((server) => ({ ...server, reachable: true, error: null })), folders: [] } },
    });
    renderInPage(<FolderShelf layout="videos" folders={[folder('Kids', { channels: 1 })]} selectedName={null} focusName={null} onFocused={jest.fn()} />, { value });
    expect(screen.getByRole('button', { name: /__Kids/ })).toHaveTextContent('PlexNot checked');
  });
});
