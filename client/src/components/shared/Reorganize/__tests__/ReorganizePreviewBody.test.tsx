import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReorganizePreviewBody from '../ReorganizePreviewBody';
import { ReorganizePreview } from '../../../../types/reorganize';

const TOTALS = {
  videos: 2, toTv: 2, toVideos: 0, betweenFolders: 0, unchanged: 1, missing: 0, collisions: 0, noName: 0, noDate: 0,
  unsafeName: 0, overridePlaced: 0, adopted: 0, uploadDateOnly: 0, downloadTime: 0, movieTags: 0, audioToTv: 0,
};

const preview = (overrides: Partial<ReorganizePreview> = {}): ReorganizePreview => ({
  revision: 'rev',
  needed: true,
  change: { type: 'channel', channelId: 'UC1', subFolder: 'TV', label: 'Chan' },
  totals: TOTALS,
  shows: [{ name: 'Chan', libraryFolder: 'TV', folderName: 'Chan', action: 'create' }],
  items: [
    { youtubeId: 'a1', title: 'First', from: '__Kids/Chan/A [a1].mp4', to: '__TV/Chan/Season 2024/S2024E01 - First [a1].mp4', episode: 'S2024E01', flags: [] },
    { youtubeId: 'b2', title: 'Second', from: '__Kids/Chan/B [b2].mp4', to: '__TV/Chan/Season 2024/S2024E02 - Second [b2].mp4', episode: 'S2024E02', flags: [] },
  ],
  problems: [],
  watchState: [],
  blocked: null,
  ...overrides,
});

describe('ReorganizePreviewBody', () => {
  test('summarizes what moves for whom', () => {
    render(<ReorganizePreviewBody preview={preview()} />);

    expect(screen.getByText('2 downloaded videos move for Chan.')).toBeInTheDocument();
    expect(screen.getByText('2 videos become TV episodes.')).toBeInTheDocument();
    expect(screen.getByText('1 video is already where it belongs.')).toBeInTheDocument();
  });

  test('says when a title episode\'s number is held by another video', () => {
    render(<ReorganizePreviewBody preview={preview({ totals: { ...TOTALS, episodeTaken: 1 } })} />);

    expect(screen.getByText(/1 video waiting for its upload year has an episode number another video holds/)).toBeInTheDocument();
  });

  test('names a new title show', () => {
    render(<ReorganizePreviewBody preview={preview({
      shows: [{ name: 'Beyblade', libraryFolder: 'TV', folderName: 'Beyblade', action: 'create', kind: 'title' }],
    })} />);

    expect(screen.getByText('New show: __TV/Beyblade')).toBeInTheDocument();
  });

  test('lists each move with its old and new path and episode', () => {
    render(<ReorganizePreviewBody preview={preview()} />);

    const moves = within(screen.getByRole('list', { name: 'Planned moves' }));
    expect(moves.getAllByRole('listitem')).toHaveLength(2);
    expect(moves.getByText('From: __Kids/Chan/A [a1].mp4')).toBeInTheDocument();
    expect(moves.getByText('To: __TV/Chan/Season 2024/S2024E01 - First [a1].mp4')).toBeInTheDocument();
    expect(moves.getByText('S2024E01')).toBeInTheDocument();
  });

  test('names the shows it creates', () => {
    render(<ReorganizePreviewBody preview={preview()} />);

    expect(screen.getByText('New show: __TV/Chan')).toBeInTheDocument();
  });

  test('says when only part of the list is shown', () => {
    render(<ReorganizePreviewBody preview={preview({ totals: { ...TOTALS, videos: 250 } })} />);

    expect(screen.getByText('Showing the first 2 of 250.')).toBeInTheDocument();
  });

  test('warns about videos that can\'t move', () => {
    render(<ReorganizePreviewBody preview={preview({ totals: { ...TOTALS, missing: 1, collisions: 2 } })} />);

    expect(screen.getByText('1 video has no file on disk and is left as recorded.')).toBeInTheDocument();
    expect(screen.getByText(/2 files would replace a file that is already there/)).toBeInTheDocument();
  });

  test('explains the watch state media servers lose', () => {
    render(<ReorganizePreviewBody preview={preview({ watchState: [{ serverType: 'jellyfin', videos: 3, users: 2 }] })} />);

    expect(screen.getByText(/Youtarr keeps its own watched state/)).toBeInTheDocument();
    expect(screen.getByText('Jellyfin: 3 videos watched or in progress (2 users).')).toBeInTheDocument();
  });

  test('says why the move can\'t start yet', () => {
    render(<ReorganizePreviewBody preview={preview({ blocked: { reason: 'download-running', message: 'Wait for the current download to finish, then try again.' } })} />);

    expect(screen.getByText(/Wait for the current download to finish/)).toBeInTheDocument();
  });

  test('says when nothing has to move', () => {
    render(<ReorganizePreviewBody preview={preview({ needed: false })} />);

    expect(screen.getByText(/No downloaded files need to move/)).toBeInTheDocument();
  });

  test('still lists the problems when nothing can move, and why the change is refused', () => {
    render(<ReorganizePreviewBody preview={preview({
      needed: false,
      items: [],
      totals: { ...TOTALS, videos: 0, toTv: 0, unchanged: 0, noName: 3 },
      blocked: { reason: 'problems', message: 'None of the downloaded videos can be moved: 3 could not be given a destination.' },
    })} />);

    expect(screen.getByText('3 videos could not be given a file name and stay where they are.')).toBeInTheDocument();
    expect(screen.getByText(/None of the downloaded videos can be moved/)).toBeInTheDocument();
    expect(screen.queryByText(/once that finishes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No downloaded files need to move/)).not.toBeInTheDocument();
  });

  test('warns about a destination outside the downloads folder', () => {
    render(<ReorganizePreviewBody preview={preview({ totals: { ...TOTALS, unsafeName: 1 } })} />);

    expect(screen.getByText(/1 video would land outside the downloads folder/)).toBeInTheDocument();
  });

  test('says how many videos keep movie tags, in one sentence', () => {
    render(<ReorganizePreviewBody preview={preview({ totals: { ...TOTALS, movieTags: 1 } })} />);

    expect(screen.getByText(/^1 video keeps movie tags inside the video file\./)).toBeInTheDocument();
  });

  test('says how many MP3 files move into a TV folder', () => {
    render(<ReorganizePreviewBody preview={preview({ totals: { ...TOTALS, audioToTv: 2 } })} />);

    expect(screen.getByText(/2 MP3 files move into a TV folder, where TV libraries don't show them\./)).toBeInTheDocument();
  });

  describe('media server libraries', () => {
    const libraryCheck = (status: 'ok' | 'missing') => ({
      servers: [{ serverType: 'jellyfin' as const, name: 'Jellyfin', reachable: true, error: null }],
      folders: [{
        name: 'TV',
        layout: 'tv' as const,
        hasFiles: true,
        channels: 1,
        servers: [{ serverType: 'jellyfin' as const, status, libraries: [], issues: [] }],
      }],
    });

    test('points out a TV folder no library holds yet', () => {
      render(<ReorganizePreviewBody preview={preview()} libraryCheck={libraryCheck('missing')} />);

      expect(screen.getByText(/Check the media server libraries for these TV folders/)).toBeInTheDocument();
      expect(screen.getByText(/Add a Shows library for __TV/)).toBeInTheDocument();
    });

    test('says nothing when every library is fine', () => {
      render(<ReorganizePreviewBody preview={preview()} libraryCheck={libraryCheck('ok')} />);

      expect(screen.queryByText(/Check the media server libraries/)).not.toBeInTheDocument();
    });
  });
});
