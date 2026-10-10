import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaServersSection } from '../MediaServersSection';
import { emptyCheck, folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import type { LibraryFolderDetail } from '../../../../types/tvShows';

const mainDetail = (extra: Partial<LibraryFolderDetail> = {}): LibraryFolderDetail => ({
  name: '', layout: 'videos', channels: [{ channelId: 'UC1', name: 'Blippi', videoCount: 3 }],
  followers: { count: 0, sample: [] }, playlists: [], titleShows: [], example: null, ...extra,
});

jest.mock('../ServerCard', () => ({ ServerCard: ({ status }: { status: { name: string } }) => {
  const React = require('react');
  return React.createElement('div', null, `card ${status.name}`);
} }));
jest.mock('../PlexRefreshControl', () => ({ PlexRefreshControl: () => {
  const React = require('react');
  return React.createElement('div', null, 'plex control');
} }));

describe('MediaServersSection', () => {
  test('without servers: the intro, settings links and a setup box per server type', () => {
    renderInPage(<MediaServersSection folder={folder('Kids', { channels: 1 })} />);
    expect(screen.getByText(/No media server is connected, so Youtarr can't check your libraries/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jellyfin settings' })).toHaveAttribute('href', '/settings/jellyfin');
    expect(screen.getAllByText(/^Create it in /)).toHaveLength(4);
  });

  test('shows no no-server intro, links or setup boxes until the servers are known', () => {
    renderInPage(<MediaServersSection folder={folder('Kids', { channels: 1 })} />, { value: makePageValue({ serversKnown: false }) });
    expect(screen.queryByText(/No media server is connected/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Plex settings' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Create it in /)).not.toBeInTheDocument();
    expect(screen.queryByText(/aren't connected/)).not.toBeInTheDocument();
  });

  test('one card per server and the footer note', () => {
    const check = { ...makePageValue().check, data: { ...emptyCheck, servers: [{ serverType: 'plex' as const, name: 'Plex', reachable: true, error: null, downloadsPath: null }] } };
    const value = makePageValue({ servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'], check });
    renderInPage(<MediaServersSection folder={folder('Kids', { channels: 1 })} />, { value });
    expect(screen.getByText('card Plex')).toBeInTheDocument();
    expect(screen.getByText("Jellyfin and Emby aren't connected. Kodi isn't checked: add __Kids as a Movies source.")).toBeInTheDocument();
  });

  test('gives the settings links 44px targets on phones', () => {
    renderInPage(<MediaServersSection folder={folder('Kids', { channels: 1 })} />, { value: makePageValue({ phone: true }) });
    expect(screen.getByRole('link', { name: 'Plex settings' })).toHaveClass('min-h-[44px]');
  });

  test('an active main folder beside a TV folder offers the main folder move', async () => {
    const value = makePageValue({
      servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'],
      folders: [folder('', { isDefault: true, channels: 3 }), folder('TV', { layout: 'tv', channels: 1 })],
    });
    renderInPage(<MediaServersSection folder={value.folders[0]} />, { value });
    await userEvent.click(screen.getByRole('button', { name: "Move the main folder's downloads" }));
    expect(value.reviewChange).toHaveBeenCalledWith({ type: 'mainFolderMove' }, { kind: 'default', folder: '' });
  });

  test('the main folder move button has a 44px target on phones', () => {
    const value = makePageValue({
      phone: true, servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'],
      folders: [folder('', { isDefault: true, channels: 1 }), folder('TV', { layout: 'tv', channels: 1 })],
    });
    renderInPage(<MediaServersSection folder={value.folders[0]} />, { value });
    expect(screen.getByRole('button', { name: "Move the main folder's downloads" })).toHaveClass('min-h-[44px]');
  });

  test('no longer lists channels to fix one at a time', () => {
    const value = makePageValue({
      servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'],
      folders: [folder('', { isDefault: true, channels: 1 }), folder('TV', { layout: 'tv', channels: 1 })],
      mainDetail: mainDetail(),
    });
    renderInPage(<MediaServersSection folder={value.folders[0]} />, { value });
    expect(screen.queryByRole('link', { name: 'Blippi' })).not.toBeInTheDocument();
  });

  test('gives the intro\'s Start using TV shows button a 44px target on phones', () => {
    const value = makePageValue({
      phone: true, servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'],
      folders: [folder('', { isDefault: true, channels: 2 }), folder('Kids', { channels: 1 })],
    });
    renderInPage(<MediaServersSection folder={value.folders[0]} />, { value });
    expect(screen.getByRole('button', { name: 'Start using TV shows' })).toHaveClass('inline-flex', 'min-h-[44px]', 'items-center');
  });

  test('gives the intro\'s folder link a 44px target on phones', () => {
    const plex = { serverType: 'plex' as const, name: 'Plex', reachable: true, error: null, downloadsPath: '/data' };
    const data = { servers: [plex], folders: [
      { name: '', layout: 'videos' as const, hasFiles: false, channels: 0, servers: [{
        serverType: 'plex' as const, status: 'ok' as const, issues: [],
        libraries: [{ id: '1', name: 'YouTube', type: 'videos' as const, location: '/data', relation: 'exact' as const }],
      }] },
      { name: 'Shows', layout: 'tv' as const, hasFiles: false, channels: 1, servers: [{
        serverType: 'plex' as const, status: 'warning' as const, issues: [{ code: 'overlap', message: 'Shown twice', libraryId: '1' }],
        libraries: [{ id: '1', name: 'YouTube', type: 'videos' as const, location: '/data', relation: 'covers' as const }],
      }] },
    ] };
    const value = makePageValue({
      phone: true, servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'],
      check: { ...makePageValue().check, data },
      folders: [folder(''), folder('Shows', { layout: 'tv', isDefault: true, channels: 1 })],
    });
    renderInPage(<MediaServersSection folder={value.folders[0]} />, { value });
    expect(screen.getByRole('button', { name: '__Shows' })).toHaveClass('inline-flex', 'min-h-[44px]', 'items-center');
  });

  test('puts the Plex refresh line right after the intro, before the other servers', () => {
    const servers = [{ serverType: 'plex' as const, name: 'Plex' }, { serverType: 'jellyfin' as const, name: 'Jellyfin' }];
    const check = { ...makePageValue().check, data: { ...emptyCheck, servers: servers.map((server) => ({ ...server, reachable: true, error: null, downloadsPath: null })) } };
    const value = makePageValue({ servers, configuredServers: ['plex', 'jellyfin'], check });
    const { container } = renderInPage(<MediaServersSection folder={folder('Kids', { channels: 1 })} />, { value });
    const text = container.textContent ?? '';
    expect(text.indexOf('plex control')).toBeGreaterThan(-1);
    expect(text.indexOf('plex control')).toBeLessThan(text.indexOf('card Jellyfin'));
  });
});
