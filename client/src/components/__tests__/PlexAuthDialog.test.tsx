import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PlexAuthDialog from '../PlexAuthDialog';

describe('PlexAuthDialog', () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  let originalFetch: typeof fetch | undefined;
  let originalOpen: typeof window.open | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    originalFetch = global.fetch;
    global.fetch = jest.fn() as unknown as typeof fetch;
    originalOpen = window.open;
    window.open = jest.fn() as unknown as typeof window.open;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (global as any).fetch;
    }
    window.open = originalOpen as typeof window.open;
  });

  test('renders instructions and existing key notice when provided', () => {
    render(
      <PlexAuthDialog
        open
        onClose={onClose}
        onSuccess={onSuccess}
        currentApiKey="abc123"
      />
    );

    expect(
      screen.getByText(/authenticate with your Plex account/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you already have a Plex API key configured/i)
    ).toBeInTheDocument();
  });

  test('completes Plex authentication flow and reports success', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const popup = { focus: jest.fn(), close: jest.fn() };
    (window.open as jest.Mock).mockReturnValue(popup);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authUrl: 'https://plex.example/auth', pinId: 'pin123' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authToken: 'token-abc' })
      });

    render(
      <PlexAuthDialog
        open
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /authenticate with plex/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/plex/auth-url');
    });

    expect(window.open).toHaveBeenCalledWith('https://plex.example/auth', '_blank');
    expect(popup.focus).toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('token-abc');
    });

    expect(
      screen.getByText(/Plex API Key obtained successfully/i)
    ).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(onClose).toHaveBeenCalled();
    expect(popup.close).toHaveBeenCalled();
  });

  test('shows error when polling returns invalid token', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const popup = { focus: jest.fn(), close: jest.fn() };
    (window.open as jest.Mock).mockReturnValue(popup);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authUrl: 'https://plex.example/auth', pinId: 'pin123' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authToken: 'invalid' })
      });

    render(
      <PlexAuthDialog
        open
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /authenticate with plex/i })
    );

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/invalid Plex Account/i)
      ).toBeInTheDocument();
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(popup.close).toHaveBeenCalled();
  });

  test('displays error when initial auth request fails', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    (window.open as jest.Mock).mockReturnValue({ focus: jest.fn(), close: jest.fn() });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({})
    });

    render(
      <PlexAuthDialog
        open
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /authenticate with plex/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Error: Failed to get Plex authentication URL/i)
      ).toBeInTheDocument();
    });

    expect(window.open).not.toHaveBeenCalled();
  });
});
