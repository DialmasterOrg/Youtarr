import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PlaylistHelpDialog from '../PlaylistHelpDialog';
import { renderWithProviders } from '../../../test-utils';

describe('PlaylistHelpDialog', () => {
  const renderDialog = (overrides = {}) =>
    renderWithProviders(
      <PlaylistHelpDialog open onClose={jest.fn()} isMobile={false} {...overrides} />
    );

  test('renders the title when open', () => {
    renderDialog();
    expect(screen.getByText('How playlists work')).toBeInTheDocument();
  });

  test('renders all five section headings', () => {
    renderDialog();
    expect(screen.getByText('Subscribing to a playlist')).toBeInTheDocument();
    expect(screen.getByText('Where the videos are saved')).toBeInTheDocument();
    expect(screen.getByText('Downloading automatically')).toBeInTheDocument();
    expect(screen.getByText('Playlist files (.m3u)')).toBeInTheDocument();
    expect(screen.getByText('Syncing to Plex, Jellyfin, and Emby')).toBeInTheDocument();
  });

  test('calls onClose when the Close button is clicked', async () => {
    const onClose = jest.fn();
    renderDialog({ onClose });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('does not render content when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('How playlists work')).not.toBeInTheDocument();
  });
});
