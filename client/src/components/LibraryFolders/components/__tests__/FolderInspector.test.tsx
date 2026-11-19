import React from 'react';
import { screen } from '@testing-library/react';
import { FolderInspector } from '../FolderInspector';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import { useLibraryFolderDetail } from '../../hooks/useLibraryFolderDetail';

jest.mock('../../hooks/useLibraryFolderDetail', () => ({ useLibraryFolderDetail: jest.fn() }));
jest.mock('../MediaServersSection', () => ({ MediaServersSection: () => {
  const React = require('react');
  return React.createElement('p', null, 'media servers');
} }));
jest.mock('../LayoutSection', () => ({ LayoutSection: () => {
  const React = require('react');
  return React.createElement('p', null, 'layout section');
} }));
jest.mock('../DownloadsHereSection', () => ({ DownloadsHereSection: ({ detail }: { detail: { channels: Array<{ name: string }> } | null }) => {
  const React = require('react');
  return React.createElement('p', null, `downloads here${detail ? `: ${detail.channels.map((channel) => channel.name).join(', ')}` : ''}`);
} }));

describe('FolderInspector', () => {
  beforeEach(() => (useLibraryFolderDetail as jest.Mock).mockReturnValue({ detail: null }));

  test('renders the sections in order and loads the detail', () => {
    renderInPage(<FolderInspector folder={folder('Kids')} />);
    expect(screen.getByRole('heading', { name: '__Kids' })).toBeInTheDocument();
    expect(screen.getByText('media servers')).toBeInTheDocument();
    expect(useLibraryFolderDetail).toHaveBeenCalledWith('token', 'Kids');
  });

  test('puts the servers first, then what downloads here, then the layout', () => {
    const { container } = renderInPage(<FolderInspector folder={folder('Kids')} />);
    const text = container.textContent ?? '';
    expect(text.indexOf('media servers')).toBeLessThan(text.indexOf('downloads here'));
    expect(text.indexOf('downloads here')).toBeLessThan(text.indexOf('layout section'));
  });

  test('leaves Delete to the header menu', () => {
    renderInPage(<FolderInspector folder={folder('Kids')} />);
    expect(screen.queryByRole('button', { name: 'Delete folder' })).not.toBeInTheDocument();
  });

  test('the main folder takes the page\'s main folder detail instead of loading it again', () => {
    const value = makePageValue({ mainDetail: {
      name: '', layout: 'videos', channels: [{ channelId: 'UC1', name: 'Blippi', videoCount: 3 }],
      followers: { count: 0, sample: [] }, playlists: [], titleShows: [], example: null,
    } });
    renderInPage(<FolderInspector folder={folder('', { isDefault: true })} />, { value });
    expect(screen.getByText('downloads here: Blippi')).toBeInTheDocument();
    expect(useLibraryFolderDetail).toHaveBeenCalledWith('token', null);
  });

  test('takes focus after an attention jump and clears the target', () => {
    const value = makePageValue({ focusTarget: { folder: 'kids' } });
    renderInPage(<FolderInspector folder={folder('Kids')} />, { value });
    expect(screen.getByRole('heading', { name: '__Kids' })).toHaveFocus();
    expect(value.clearFocusTarget).toHaveBeenCalled();
  });

  test('an attention jump to a server focuses the heading without scrolling and scrolls the card', () => {
    const card = document.createElement('div');
    card.id = 'server-card-plex';
    card.scrollIntoView = jest.fn();
    document.body.appendChild(card);
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus');
    const value = makePageValue({ focusTarget: { folder: 'kids', serverType: 'plex' } });
    renderInPage(<FolderInspector folder={folder('Kids')} />, { value });
    expect(card.scrollIntoView).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(screen.getByRole('heading', { name: '__Kids' })).toHaveFocus();
    expect(value.clearFocusTarget).toHaveBeenCalled();
    focusSpy.mockRestore();
    card.remove();
  });
});
