import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverlapFixBlock } from '../OverlapFixBlock';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import type { LibraryFolderDetail } from '../../../../types/tvShows';

const report = { serverType: 'jellyfin' as const, status: 'missing' as const, issues: [],
  libraries: [{ id: '1', name: 'YouTube', type: 'videos' as const, location: 'Q:\\Y', relation: 'covers' as const }] };
const issue = { code: 'nestedLibrary', message: 'YouTube (at Q:\\Y) includes __TV...', libraryId: '1' };
const mainDetail = (extra: Partial<LibraryFolderDetail> = {}): LibraryFolderDetail => ({
  name: '', layout: 'videos', channels: [{ channelId: 'UC1', name: 'Blippi', videoCount: 3 }],
  followers: { count: 0, sample: [] }, playlists: [], titleShows: [], example: null, ...extra,
});

describe('OverlapFixBlock', () => {
  test('lists the library edit with the Video folders as the server sees them', () => {
    const value = makePageValue({ folders: [folder(''), folder('Kids', { channels: 2 }), folder('TV', { layout: 'tv', channels: 1 })] });
    renderInPage(<OverlapFixBlock issue={issue} server={{ serverType: 'jellyfin', name: 'Jellyfin' }} report={report} downloadsPath={'Q:\\Y'} />, { value });
    expect(screen.getByText('Fix it in Jellyfin')).toBeInTheDocument();
    expect(screen.getByText('Edit YouTube (Movies library) and remove its folder Q:\\Y.')).toBeInTheDocument();
    expect(screen.getByText('Q:\\Y\\__Kids')).toBeInTheDocument();
  });

  test('names the channels still in the main folder from the page\'s main folder detail', () => {
    const value = makePageValue({
      folders: [folder('', { channels: 1, channelsChosen: 1 }), folder('TV', { layout: 'tv', channels: 1 })], mainDetail: mainDetail(),
    });
    renderInPage(<OverlapFixBlock issue={issue} server={{ serverType: 'jellyfin', name: 'Jellyfin' }} report={report} downloadsPath={null} />, { value });
    expect(screen.getByText(/1 channel still downloads straight into the main folder, which YouTube would stop showing/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Blippi' })).toHaveAttribute('href', '/channel/UC1');
  });

  test('after the links, says which channels follow the default folder and how to move them', () => {
    const value = makePageValue({
      folders: [folder('', { isDefault: true, channels: 4, channelsChosen: 1, channelsFollowing: 3 }), folder('TV', { layout: 'tv', channels: 1 })],
      mainDetail: mainDetail({ followers: { count: 3, sample: ['Cocomelon', 'Numberblocks', 'Peppa'] } }),
    });
    renderInPage(<OverlapFixBlock issue={issue} server={{ serverType: 'jellyfin', name: 'Jellyfin' }} report={report} downloadsPath={null} />, { value });
    expect(screen.getByText('3 more follow the default folder (Cocomelon, Numberblocks and Peppa): make another folder the default, '
      + 'or set their Library folder in Channel Settings.')).toBeInTheDocument();
  });

  test('opens the panel', async () => {
    const value = makePageValue();
    renderInPage(<OverlapFixBlock issue={issue} server={{ serverType: 'jellyfin', name: 'Jellyfin' }} report={report} downloadsPath={null} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'See all your options' }));
    expect(value.openStartTv).toHaveBeenCalled();
  });

  test('gives the options button a 44px target on phones', () => {
    renderInPage(<OverlapFixBlock issue={issue} server={{ serverType: 'jellyfin', name: 'Jellyfin' }} report={report} downloadsPath={null} />, { value: makePageValue({ phone: true }) });
    expect(screen.getByRole('button', { name: 'See all your options' })).toHaveClass('min-h-[44px]');
  });
});
