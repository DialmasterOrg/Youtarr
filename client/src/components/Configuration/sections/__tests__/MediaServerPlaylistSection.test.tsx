import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
    // Configured + enabled, so it fetches the user on mount first; the test-connection POST is second.
    axios.post.mockResolvedValueOnce({ data: { users: [{ id: 'u1', name: 'Alice' }] } });
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

  test('resolves an already-configured user to its name on mount', async () => {
    axios.post.mockResolvedValueOnce({
      data: { users: [{ id: 'u2', name: 'Bob' }] },
    });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig({ embyUserId: 'u2' })}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/mediaservers/emby/users',
        {
          embyUrl: 'http://192.168.1.174:8096',
          embyApiKey: 'secret-key',
          embyUserId: 'u2',
        },
        { headers: { 'x-access-token': 'tok' } }
      );
    });

    expect(await screen.findByText('Bob')).toBeInTheDocument();
  });

  test('does not auto-fetch on mount when no user is selected', () => {
    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    expect(axios.post).not.toHaveBeenCalled();
  });

  test('opening the user dropdown fetches the list from the server', async () => {
    axios.post.mockResolvedValueOnce({
      data: { users: [{ id: 'u1', name: 'Alice' }] },
    });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    fireEvent.mouseDown(screen.getByTestId('emby-user-select'));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/mediaservers/emby/users',
        {
          embyUrl: 'http://192.168.1.174:8096',
          embyApiKey: 'secret-key',
          embyUserId: undefined,
        },
        { headers: { 'x-access-token': 'tok' } }
      );
    });

    expect(await screen.findByRole('option', { name: 'Alice' })).toBeInTheDocument();
  });

  test('refetches the user list each time the dropdown opens', async () => {
    // Mount resolve (userId set) is the first POST; opening the dropdown refetches.
    axios.post.mockResolvedValueOnce({
      data: { users: [{ id: 'u2', name: 'Bob' }] },
    });
    axios.post.mockResolvedValueOnce({
      data: {
        users: [
          { id: 'u2', name: 'Bob' },
          { id: 'u3', name: 'Carol' },
        ],
      },
    });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig({ embyUserId: 'u2' })}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    fireEvent.mouseDown(screen.getByTestId('emby-user-select'));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(2);
    });
    // The account added server-side since mount is now selectable.
    expect(await screen.findByRole('option', { name: 'Carol' })).toBeInTheDocument();
  });

  test('selecting a user from the dropdown reports its id', async () => {
    const onConfigChange = jest.fn();
    axios.post.mockResolvedValueOnce({
      data: {
        users: [
          { id: 'u1', name: 'Alice' },
          { id: 'u2', name: 'Bob' },
        ],
      },
    });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={onConfigChange}
      />
    );

    fireEvent.mouseDown(screen.getByTestId('emby-user-select'));
    fireEvent.click(await screen.findByRole('option', { name: 'Bob' }));

    expect(onConfigChange).toHaveBeenCalledWith({ embyUserId: 'u2' });
  });

  test('the manual-entry toggle reveals a text field that reports the typed id', async () => {
    const onConfigChange = jest.fn();

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={onConfigChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /enter id manually/i }));
    fireEvent.change(screen.getByTestId('emby-user-id-input'), {
      target: { value: 'manual-id' },
    });

    expect(onConfigChange).toHaveBeenCalledWith({ embyUserId: 'manual-id' });
  });

  test('disables the picker and prompts for credentials when url/key are missing', () => {
    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig({ embyUrl: '', embyApiKey: '' })}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    expect(
      screen.getByText(/Enter the Emby URL and API key above/i)
    ).toBeInTheDocument();
  });

  test('shows the placeholder when no user is selected', () => {
    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    expect(screen.getByText('Select a user')).toBeInTheDocument();
  });

  test('a failed mount resolve stays silent and falls back to the id', async () => {
    axios.post.mockRejectedValueOnce(new Error('network down'));

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig({ embyUserId: 'u2' })}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/Failed to fetch users/i)).not.toBeInTheDocument();
    // The trigger still shows the configured id rather than reverting to the placeholder.
    expect(screen.getByText('u2')).toBeInTheDocument();
  });

  test('masks the API key without a password input so the browser does not offer to save it', () => {
    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    const input = screen.getByTestId('emby-api-key-input');
    // Not a real password field: that is what stops Chrome's "save password" prompt.
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveStyle({ WebkitTextSecurity: 'disc' });

    fireEvent.click(screen.getByRole('button', { name: /show emby api key/i }));
    expect(input).toHaveStyle({ WebkitTextSecurity: 'none' });
  });

  test('shows "No users found" when the server returns an empty list', async () => {
    axios.post.mockResolvedValueOnce({ data: { users: [] } });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    fireEvent.mouseDown(screen.getByTestId('emby-user-select'));

    expect(await screen.findByText('No users found')).toBeInTheDocument();
  });

  test('shows Connection Failed on the chip after a failed test', async () => {
    axios.post.mockRejectedValueOnce(new Error('boom'));
    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig()}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /test connection/i }));
    expect(await screen.findByText('Connection Failed')).toBeInTheDocument();
  });

  test('warns when the saved user ID does not look like a server user ID', async () => {
    // A non-empty saved userId triggers the mount-time eager fetch; resolve it so the
    // effect settles inside the test instead of leaking a state update past teardown.
    axios.post.mockResolvedValueOnce({ data: { users: [] } });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig({ embyUserId: 'admin' })}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/mediaservers/emby/users',
        {
          embyUrl: 'http://192.168.1.174:8096',
          embyApiKey: 'secret-key',
          embyUserId: 'admin',
        },
        { headers: { 'x-access-token': 'tok' } }
      );
    });

    expect(screen.getByText(/doesn't look like an Emby user ID/i)).toBeInTheDocument();
  });

  test('does not warn for a 32-character hex user ID', async () => {
    const hexUserId = 'a'.repeat(32);
    axios.post.mockResolvedValueOnce({ data: { users: [] } });

    renderWithProviders(
      <MediaServerPlaylistSection
        kind="emby"
        config={baseConfig({ embyUserId: hexUserId })}
        token="tok"
        onConfigChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/mediaservers/emby/users',
        {
          embyUrl: 'http://192.168.1.174:8096',
          embyApiKey: 'secret-key',
          embyUserId: hexUserId,
        },
        { headers: { 'x-access-token': 'tok' } }
      );
    });

    expect(screen.queryByText(/doesn't look like an Emby user ID/i)).not.toBeInTheDocument();
  });
});
