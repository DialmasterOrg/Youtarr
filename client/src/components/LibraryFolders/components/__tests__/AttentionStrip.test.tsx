import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttentionStrip } from '../AttentionStrip';
import { makePageValue, renderInPage } from '../../__tests__/renderPage';
import type { AttentionItem } from '../../../../utils/libraryAttention';

const items: AttentionItem[] = [
  { kind: 'library', key: 'l', serverType: 'jellyfin', serverName: 'Jellyfin', libraryId: '1', libraryName: 'YouTube', code: 'nfoSaver',
    short: 'saves NFO files', folders: ['Kids', 'Music'], text: 'Jellyfin library YouTube saves NFO files (affects 2 folders)' },
  { kind: 'folder', key: 'f', folder: 'Docs', label: '__Docs', layout: 'videos',
    servers: [{ serverType: 'plex', name: 'Plex', display: 'noLibrary', issueCount: 0, firstMessage: null }], text: '__Docs (Plex)' },
];

describe('AttentionStrip', () => {
  test('renders nothing without items', () => {
    renderInPage(<AttentionStrip items={[]} />);
    expect(screen.queryByText(/Needs attention/)).not.toBeInTheDocument();
  });

  test('jumps to a folder, and to the first affected folder of a library-wide item', async () => {
    const value = makePageValue();
    renderInPage(<AttentionStrip items={items} />, { value });
    await userEvent.click(screen.getByRole('button', { name: '__Docs (Plex)' }));
    await userEvent.click(screen.getByRole('button', { name: /Jellyfin library YouTube/ }));
    expect(value.jumpTo).toHaveBeenNthCalledWith(1, 'Docs');
    expect(value.jumpTo).toHaveBeenNthCalledWith(2, 'Kids', 'jellyfin');
  });

  test('on phones keeps the check status and a refresh button', async () => {
    const value = makePageValue({ phone: true, check: { ...makePageValue().check, refetch: jest.fn() } });
    renderInPage(<AttentionStrip items={items} />, { value });
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Check media servers again' }));
    expect(value.check.refetch).toHaveBeenCalled();
  });
});
