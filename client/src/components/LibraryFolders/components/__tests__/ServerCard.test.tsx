import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerCard } from '../ServerCard';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import type { ServerStatus } from '../../../../utils/libraryAttention';

jest.mock('../PlexRefreshControl', () => ({ PlexRefreshControl: () => null }));
jest.mock('../OverlapFixBlock', () => ({ OverlapFixBlock: () => {
  const React = require('react');
  return React.createElement('div', null, 'overlap fix');
} }));

const statusOf = (extra: Partial<ServerStatus>): ServerStatus => ({
  serverType: 'jellyfin', name: 'Jellyfin', display: 'issues', word: '1 issue',
  report: { serverType: 'jellyfin', status: 'warning', libraries: [{ id: '9', name: 'YouTube', type: 'videos', location: '/yt', relation: 'exact' }], issues: [] },
  ...extra,
});

describe('ServerCard', () => {
  test('marks a library-wide issue and gives its hint', () => {
    const status = statusOf({ report: { ...statusOf({}).report!, issues: [{ code: 'nfoSaver', message: 'YouTube saves NFO files.', libraryId: '9' }] } });
    renderInPage(<ServerCard folder={folder('Kids', { channels: 1 })} status={status} downloadsPath="/yt" />);
    expect(screen.getByText('Library setting')).toBeInTheDocument();
    expect(screen.getByText('In Jellyfin: Dashboard, Libraries, YouTube, Metadata savers.')).toBeInTheDocument();
  });

  test('no library: the line and a setup box for the folder', () => {
    const status = statusOf({ display: 'noLibrary', word: 'No library', report: { serverType: 'jellyfin', status: 'missing', libraries: [], issues: [{ code: 'noLibrary', message: 'x' }] } });
    renderInPage(<ServerCard folder={folder('TV', { layout: 'tv', channels: 1 })} status={status} downloadsPath="/yt" />);
    expect(screen.getByText('No Jellyfin Shows library holds __TV.')).toBeInTheDocument();
    expect(screen.getByText('Create it in Jellyfin')).toBeInTheDocument();
  });

  test('an overlap issue gets the fix block', () => {
    const status = statusOf({ report: { ...statusOf({}).report!, issues: [{ code: 'nestedLibrary', message: 'nested', libraryId: '9' }] } });
    renderInPage(<ServerCard folder={folder('TV', { layout: 'tv', channels: 1 })} status={status} downloadsPath="/yt" />);
    expect(screen.getByText('overlap fix')).toBeInTheDocument();
  });

  test('Refresh this library applies the suggested Plex mapping', async () => {
    const value = makePageValue();
    const status: ServerStatus = { serverType: 'plex', name: 'Plex', display: 'issues', word: '1 issue', report: {
      serverType: 'plex', status: 'warning', libraries: [{ id: '41', name: 'YouTube TV', type: 'tv', location: 'Q:\\Y\\__TV', relation: 'exact' }],
      issues: [{ code: 'plexMappingMissing', message: "New episodes in __TV don't refresh YouTube TV.", libraryId: '41' }],
    } };
    renderInPage(<ServerCard folder={folder('TV', { layout: 'tv', channels: 1 })} status={status} downloadsPath={'Q:\\Y'} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Refresh this library' }));
    expect(value.check.applyPlexMapping).toHaveBeenCalledWith('TV', '41');
  });

  test('leaves the section id off a compact card', () => {
    const status = statusOf({ report: { ...statusOf({}).report!, issues: [{ code: 'nfoSaver', message: 'x', libraryId: '9' }] } });
    const { unmount } = renderInPage(<ServerCard folder={folder('Kids', { channels: 1 })} status={status} downloadsPath="/yt" />);
    expect(screen.getByRole('region', { name: 'Jellyfin' })).toHaveAttribute('id', 'server-card-jellyfin');
    unmount();
    renderInPage(<ServerCard folder={folder('Kids', { channels: 1 })} status={status} downloadsPath="/yt" compact />);
    expect(screen.getByRole('region', { name: 'Jellyfin' })).not.toHaveAttribute('id');
  });
});
