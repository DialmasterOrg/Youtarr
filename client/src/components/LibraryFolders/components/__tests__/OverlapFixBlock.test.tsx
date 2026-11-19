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

  test('an active Videos main folder offers the main folder move instead of channel links', async () => {
    const value = makePageValue({
      folders: [folder('', { channels: 1, channelsChosen: 1 }), folder('TV', { layout: 'tv', channels: 1 })], mainDetail: mainDetail(),
    });
    renderInPage(<OverlapFixBlock issue={issue} server={{ serverType: 'jellyfin', name: 'Jellyfin' }} report={report} downloadsPath={null} />, { value });
    expect(screen.getByText(/1 channel still downloads straight into the main folder, which YouTube would stop showing/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Blippi' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Move the main folder's downloads" }));
    expect(value.reviewChange).toHaveBeenCalledWith({ type: 'mainFolderMove' }, { kind: 'default', folder: '' });
  });

  test('a Videos main folder holding files offers the move', async () => {
    const value = makePageValue({ folders: [folder('', { hasFiles: true, fileCount: 4 }), folder('TV', { layout: 'tv', channels: 1 })] });
    renderInPage(<OverlapFixBlock issue={issue} server={{ serverType: 'jellyfin', name: 'Jellyfin' }} report={report} downloadsPath={null} />, { value });
    expect(screen.getByText(/Move them into a Video folder first:/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Move the main folder's downloads" }));
    expect(value.reviewChange).toHaveBeenCalledWith({ type: 'mainFolderMove' }, { kind: 'default', folder: '' });
  });

  test('a TV main folder keeps the channel links and no move button', () => {
    const value = makePageValue({
      folders: [folder('', { layout: 'tv', channels: 1, channelsChosen: 1 }), folder('TV', { layout: 'tv', channels: 1 })], mainDetail: mainDetail({ layout: 'tv' }),
    });
    renderInPage(<OverlapFixBlock issue={issue} server={{ serverType: 'jellyfin', name: 'Jellyfin' }} report={report} downloadsPath={null} />, { value });
    expect(screen.getByRole('link', { name: 'Blippi' })).toHaveAttribute('href', '/channel/UC1');
    expect(screen.queryByRole('button', { name: "Move the main folder's downloads" })).not.toBeInTheDocument();
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
