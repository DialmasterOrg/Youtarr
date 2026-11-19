import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerRow } from '../ServerRow';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import type { ServerStatus } from '../../../../utils/libraryAttention';

jest.mock('../PlexRefreshControl', () => ({ PlexRefreshControl: () => {
  const React = require('react');
  return React.createElement('div', null, 'plex control');
} }));

const okStatus = (serverType: 'plex' | 'jellyfin', name: string): ServerStatus => ({
  serverType, name, display: 'ok', word: 'YouTube',
  report: { serverType, status: 'ok', issues: [], libraries: [{ id: '1', name: 'YouTube', type: 'videos', location: '/yt', relation: 'exact' }] },
});
const active = folder('Kids', { channels: 1 });

describe('ServerRow', () => {
  test('a server that is fine takes one line naming its library', () => {
    renderInPage(<ServerRow folder={active} status={okStatus('jellyfin', 'Jellyfin')} />);
    expect(screen.getByRole('region', { name: 'Jellyfin' })).toHaveTextContent('JellyfinYouTube · MoviesOK');
  });

  test('on phones the library text takes its own line under the server name', () => {
    renderInPage(<ServerRow folder={active} status={okStatus('jellyfin', 'Jellyfin')} />, { value: makePageValue({ phone: true }) });
    expect(screen.getByText('YouTube · Movies')).toHaveClass('col-span-2', 'col-start-2');
  });

  test('keeps the server card id, so an attention jump scrolls to it', () => {
    renderInPage(<ServerRow folder={active} status={okStatus('jellyfin', 'Jellyfin')} />);
    expect(screen.getByRole('region', { name: 'Jellyfin' })).toHaveAttribute('id', 'server-card-jellyfin');
  });

  test('Plex carries the refresh setting when the folder needs a library', () => {
    renderInPage(<ServerRow folder={active} status={okStatus('plex', 'Plex')} />);
    expect(screen.getByText('plex control')).toBeInTheDocument();
  });

  test('other servers never carry the refresh setting', () => {
    renderInPage(<ServerRow folder={active} status={okStatus('jellyfin', 'Jellyfin')} />);
    expect(screen.queryByText('plex control')).not.toBeInTheDocument();
  });

  test('an unreachable server offers Check again', async () => {
    const value = makePageValue();
    renderInPage(<ServerRow folder={active} status={{
      serverType: 'plex', name: 'Plex', display: 'unchecked', word: 'Not checked',
      report: { serverType: 'plex', status: 'unreachable', libraries: [], issues: [] },
    }} />, { value });
    expect(screen.getByText("Couldn't be reached, so this folder wasn't checked.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(value.check.refetch).toHaveBeenCalled();
  });

  test('a failed check offers Try again', () => {
    const base = makePageValue();
    renderInPage(<ServerRow folder={active} status={{ serverType: 'emby', name: 'Emby', display: 'unchecked', word: 'Not checked', report: null }} />,
      { value: makePageValue({ check: { ...base.check, error: 'boom' } }) });
    expect(screen.getByText('Not checked. The library check failed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  test('an unused folder is fine without a library', () => {
    renderInPage(<ServerRow folder={folder('Empty')} status={{ serverType: 'emby', name: 'Emby', display: 'fine', word: 'No library', report: null }} />);
    expect(screen.getByText('Not in a library. Fine while nothing downloads here.')).toBeInTheDocument();
  });

  test('the empty main folder needs no library', () => {
    renderInPage(<ServerRow folder={folder('')} status={{ serverType: 'emby', name: 'Emby', display: 'fine', word: 'No library', report: null }} />);
    expect(screen.getByText("Not in a library, and doesn't need one while you use subfolders.")).toBeInTheDocument();
  });
});
