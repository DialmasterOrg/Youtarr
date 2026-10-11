import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(screen.getByText('1 chose this folder')).toBeInTheDocument();
    expect(screen.getByText('5 follow the default')).toBeInTheDocument();
    expect(screen.getByText('Set to the default folder: Abe, Bea, Cy and 2 more')).toBeInTheDocument();
    expect(screen.getByText('Unsubscribed channels and single downloads')).toBeInTheDocument();
  });

  test.each(['When playlist videos land here', 'Where title shows are edited', 'About the fallback'])(
    'keeps the %s button out of a paragraph, where the popover\'s blocks would be invalid markup', (label) => {
      renderInPage(<DownloadsHereSection folder={folder('TV', { layout: 'tv', isDefault: true, playlists: 1, titleShows: 1 })} detail={detail({
        layout: 'tv',
        playlists: [{ playlistId: 'PL1', name: 'Songs', videoCount: 4 }],
        titleShows: [{ id: 7, name: 'Lessons', channelId: 'UC1', channelName: 'Blippi', episodeCount: 9 }],
      })} />);
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
      expect(screen.queryAllByRole('paragraph').filter((paragraph) => within(paragraph).queryByRole('button', { name: label }))).toHaveLength(0);
    }
  );

  test('the fallback explains itself behind the info button', async () => {
    renderInPage(<DownloadsHereSection folder={folder('Kids', { isDefault: true })} detail={detail()} />);
    expect(screen.queryByText(/Downloads with no more specific folder land here/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'About the fallback' }));
    expect(screen.getByText(/Downloads with no more specific folder land here/)).toBeInTheDocument();
  });

  test('how downloads pick a folder sits behind the heading\'s info button', async () => {
    renderInPage(<DownloadsHereSection folder={folder('Kids', { channels: 1 })} detail={detail()} />);
    expect(screen.queryByText(/A channel picks its folder in Channel Settings/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'How downloads pick a folder' }));
    expect(screen.getByText(/A channel picks its folder in Channel Settings/)).toBeInTheDocument();
  });

  test('a long playlist list shows three and the rest on request', async () => {
    const playlists = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((name, index) => ({ playlistId: `PL${index}`, name, videoCount: 1 }));
    renderInPage(<DownloadsHereSection folder={folder('Kids', { playlists: 6 })} detail={detail({ playlists })} />);
    expect(screen.queryByRole('link', { name: 'Four' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'and 3 more' }));
    expect(screen.getByRole('link', { name: 'Six' })).toBeInTheDocument();
  });

  test('four playlists show in full', () => {
    const playlists = ['One', 'Two', 'Three', 'Four'].map((name, index) => ({ playlistId: `PL${index}`, name, videoCount: 1 }));
    renderInPage(<DownloadsHereSection folder={folder('Kids', { playlists: 4 })} detail={detail({ playlists })} />);
    expect(screen.getByRole('link', { name: 'Four' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more$/ })).not.toBeInTheDocument();
  });

  test('a long channel list shows three and the rest on request', async () => {
    const channels = ['Abe', 'Bea', 'Cy', 'Di', 'Ed'].map((name, index) => ({ channelId: `UC${index}`, name, videoCount: 1 }));
    renderInPage(<DownloadsHereSection folder={folder('Kids', { channels: 5 })} detail={detail({ channels })} />);
    expect(screen.queryByRole('link', { name: 'Di' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'and 2 more' }));
    expect(screen.getByRole('link', { name: 'Ed' })).toBeInTheDocument();
  });

  test('title shows say where they are edited once, not on every line', async () => {
    renderInPage(<DownloadsHereSection folder={folder('TV', { layout: 'tv', titleShows: 2 })} detail={detail({
      layout: 'tv',
      titleShows: [
        { id: 7, name: 'Lessons', channelId: 'UC1', channelName: 'Blippi', episodeCount: 9 },
        { id: 8, name: 'Songs', channelId: 'UC1', channelName: 'Blippi', episodeCount: 2 },
      ],
    })} />);
    expect(screen.queryByText(/Channel Settings > TV Show/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Where title shows are edited' }));
    expect(screen.getByText(/Channel Settings > TV Show/)).toBeInTheDocument();
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

  test('the empty main folder says downloads go to subfolders', () => {
    renderInPage(<DownloadsHereSection folder={folder('')} detail={detail({ name: '' })} />);
    expect(screen.getByText('Nothing is saved here. Downloads go to subfolders.')).toBeInTheDocument();
  });

  test('on phones playlists list one per row', () => {
    const playlists = ['One', 'Two', 'Three'].map((name, index) => ({ playlistId: `PL${index}`, name, videoCount: 1 }));
    renderInPage(<DownloadsHereSection folder={folder('Kids', { playlists: 3 })} detail={detail({ playlists })} />, { value: makePageValue({ phone: true }) });
    expect(within(screen.getByRole('list', { name: 'Playlists' })).getAllByRole('listitem')).toHaveLength(3);
  });

  test('an unused folder offers choosing channels', () => {
    renderInPage(<DownloadsHereSection folder={folder('New')} detail={detail()} />);
    expect(screen.getByRole('link', { name: 'Choose channels for __New' })).toHaveAttribute('href', '/subscriptions');
  });
});
