import React from 'react';
import { screen } from '@testing-library/react';
import { DownloadsHereSection } from '../DownloadsHereSection';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import type { LibraryFolderDetail } from '../../../../types/tvShows';

const detail = (extra: Partial<LibraryFolderDetail> = {}): LibraryFolderDetail => ({
  name: 'Kids', layout: 'videos', channels: [], followers: { count: 0, sample: [] }, playlists: [], titleShows: [], example: null, ...extra,
});

describe('DownloadsHereSection', () => {
  test('the default folder lists choosers, followers and the fallback', () => {
    renderInPage(<DownloadsHereSection folder={folder('Kids', { isDefault: true, fileCount: 12 })} detail={detail({
      channels: [{ channelId: 'UC1', name: 'Blippi', videoCount: 12 }],
      followers: { count: 5, sample: ['Abe', 'Bea', 'Cy'] },
    })} />);
    expect(screen.getByText('12 videos on disk')).toBeInTheDocument();
    expect(screen.getByText('1 chose this folder')).toBeInTheDocument();
    expect(screen.getByText('5 follow the default')).toBeInTheDocument();
    expect(screen.getByText('Set to the default folder: Abe, Bea, Cy and 2 more')).toBeInTheDocument();
    expect(screen.getByText(/Downloads with no more specific folder land here/)).toBeInTheDocument();
  });

  test('a holds-videos folder says nothing downloads here now', () => {
    renderInPage(<DownloadsHereSection folder={folder('Old', { fileCount: 1, hasFiles: true })} detail={detail()} />);
    expect(screen.getByText('Nothing downloads here now. 1 video is on disk.')).toBeInTheDocument();
  });

  test('gives the playlist and title show links 44px targets on phones', () => {
    renderInPage(<DownloadsHereSection folder={folder('Kids', { layout: 'tv', channels: 1, playlists: 1, titleShows: 1 })} detail={detail({
      layout: 'tv',
      playlists: [{ playlistId: 'PL1', name: 'Songs', videoCount: 4 }],
      titleShows: [{ id: 7, name: 'Lessons', channelId: 'UC1', channelName: 'Blippi', episodeCount: 9 }],
    })} />, { value: makePageValue({ phone: true }) });
    expect(screen.getByRole('link', { name: 'Songs' })).toHaveClass('inline-flex', 'min-h-[44px]', 'items-center');
    expect(screen.getByRole('link', { name: 'Lessons' })).toHaveClass('inline-flex', 'min-h-[44px]', 'items-center');
  });

  test('an unused folder offers choosing channels', () => {
    renderInPage(<DownloadsHereSection folder={folder('New')} detail={detail()} />);
    expect(screen.getByRole('link', { name: 'Choose channels for __New' })).toHaveAttribute('href', '/subscriptions');
  });
});
