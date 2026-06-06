import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MediaServerPlaylistSection } from '../MediaServerPlaylistSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState } from '../../types';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn(() => false),
}));

const axios = require('axios');

const baseConfig = (overrides: Partial<ConfigState> = {}): ConfigState =>
  ({
    embyEnabled: true,
    embyUrl: 'http://192.168.1.174:8096',
    embyApiKey: 'secret-key',
    embyUserId: '',
    ...overrides,
  } as ConfigState);

describe('MediaServerPlaylistSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the integration title for the given kind', () => {
    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );
    expect(screen.getByText('Emby Integration')).toBeInTheDocument();
  });

  test('posts the prefixed field keys when testing the connection', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: true, version: '4.7.0' } });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /test connection/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/mediaservers/emby/test',
        {
          embyUrl: 'http://192.168.1.174:8096',
          embyApiKey: 'secret-key',
          embyUserId: undefined,
        },
        { headers: { 'x-access-token': 'tok' } }
      );
    });
  });

  test('shows the connected message on a successful test', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: true, version: '4.7.0' } });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /test connection/i }));

    expect(await screen.findByText('Connected (v4.7.0)')).toBeInTheDocument();
  });

  test('uses jellyfin-prefixed keys when kind is jellyfin', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: true } });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="jellyfin"
        config={
          {
            jellyfinEnabled: true,
            jellyfinUrl: 'http://jelly:8096',
            jellyfinApiKey: 'jkey',
            jellyfinUserId: 'u1',
          } as ConfigState
        }
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /test connection/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/mediaservers/jellyfin/test',
        { jellyfinUrl: 'http://jelly:8096', jellyfinApiKey: 'jkey', jellyfinUserId: 'u1' },
        { headers: { 'x-access-token': 'tok' } }
      );
    });
  });
});
