import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  PlexPlaylistScopeControl,
  deriveScopeMode,
  UNCLAIMED_SERVER_SENTINEL,
} from '../PlexPlaylistScopeControl';

describe('deriveScopeMode', () => {
  test('empty value -> admin', () => {
    expect(deriveScopeMode('')).toBe('admin');
  });
  test('sentinel value -> unclaimed', () => {
    expect(deriveScopeMode(UNCLAIMED_SERVER_SENTINEL)).toBe('unclaimed');
  });
  test('any other token -> user', () => {
    expect(deriveScopeMode('abc-token')).toBe('user');
  });
});

describe('PlexPlaylistScopeControl', () => {
  test('renders the admin-visibility/sharing info note', () => {
    render(<PlexPlaylistScopeControl value="" onChange={jest.fn()} />);
    expect(screen.getByText(/share it from Plex Web/i)).toBeInTheDocument();
  });

  test('does not show the token field in admin mode', () => {
    render(<PlexPlaylistScopeControl value="" onChange={jest.fn()} />);
    expect(screen.queryByTestId('plex-playlist-token-input')).not.toBeInTheDocument();
  });

  test('shows the token field pre-filled when a specific user token is configured', () => {
    render(<PlexPlaylistScopeControl value="user-token-123" onChange={jest.fn()} />);
    expect(screen.getByTestId('plex-playlist-token-input')).toHaveValue('user-token-123');
  });

  test('editing the token field reports the new value', () => {
    const onChange = jest.fn();
    render(<PlexPlaylistScopeControl value="old" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('plex-playlist-token-input'), {
      target: { value: 'new-token' },
    });
    expect(onChange).toHaveBeenCalledWith('new-token');
  });

  test('selecting the unclaimed-server mode reports the sentinel', async () => {
    const onChange = jest.fn();
    render(<PlexPlaylistScopeControl value="" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole('button', { name: /Use my Plex admin account/i }));
    fireEvent.click(await screen.findByRole('option', { name: /Unclaimed server/i }));
    expect(onChange).toHaveBeenCalledWith(UNCLAIMED_SERVER_SENTINEL);
  });

  test('shows the unclaimed-server hint when the server is unclaimed and mode is not already unclaimed', () => {
    render(<PlexPlaylistScopeControl value="" onChange={jest.fn()} serverClaimed={false} />);
    expect(screen.getByTestId('plex-unclaimed-hint')).toBeInTheDocument();
  });

  test('hides the unclaimed-server hint when the server is claimed', () => {
    render(<PlexPlaylistScopeControl value="" onChange={jest.fn()} serverClaimed={true} />);
    expect(screen.queryByTestId('plex-unclaimed-hint')).not.toBeInTheDocument();
  });

  test('hides the unclaimed-server hint when already in unclaimed mode', () => {
    render(
      <PlexPlaylistScopeControl
        value={UNCLAIMED_SERVER_SENTINEL}
        onChange={jest.fn()}
        serverClaimed={false}
      />
    );
    expect(screen.queryByTestId('plex-unclaimed-hint')).not.toBeInTheDocument();
  });
});
