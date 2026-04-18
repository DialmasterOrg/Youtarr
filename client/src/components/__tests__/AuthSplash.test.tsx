import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('axios', () => {
  const post = jest.fn();
  const isAxiosError = jest.fn();
  return {
    __esModule: true,
    default: { post, isAxiosError },
    post,
    isAxiosError,
  };
});

const mockUseThemeEngine = jest.fn();
jest.mock('../../contexts/ThemeEngineContext', () => ({
  useThemeEngine: () => mockUseThemeEngine(),
}));

jest.mock('../../lib/icons', () => {
  const React = require('react');
  return {
    __esModule: true,
    Info: () => React.createElement('span', { 'data-testid': 'IconInfo' }),
  };
});

import { AuthSplash } from '../AuthSplash';

const axios = require('axios');

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('AuthSplash', () => {
  const setToken = jest.fn();

  beforeEach(() => {
    setToken.mockReset();
    axios.post.mockReset();
    axios.isAxiosError.mockReset();
    localStorageMock.setItem.mockReset();
    mockUseThemeEngine.mockReturnValue({ showHeaderLogo: false, showHeaderWordmark: false });
    globalThis.setMockLocation('http://localhost/login');
  });

  test('renders form with username and password fields and the version label', () => {
    render(<AuthSplash setToken={setToken} />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByText(/Youtarr v\d+/)).toBeInTheDocument();
  });

  test('renders plain title when neither logo nor wordmark are shown', () => {
    render(<AuthSplash setToken={setToken} />);
    // Plain text title appears as a heading
    expect(screen.getByRole('heading', { name: 'Youtarr' })).toBeInTheDocument();
  });

  test('renders the wordmark image when showHeaderWordmark is true', () => {
    mockUseThemeEngine.mockReturnValue({ showHeaderLogo: true, showHeaderWordmark: true });
    render(<AuthSplash setToken={setToken} />);
    // Logo + wordmark images both render
    expect(screen.getByAltText('Youtarr logo')).toBeInTheDocument();
    expect(screen.getByAltText('Youtarr')).toBeInTheDocument();
    // No plain heading in this branch
    expect(screen.queryByRole('heading', { name: 'Youtarr' })).not.toBeInTheDocument();
  });

  test('renders only the logo when showHeaderLogo is true and wordmark is false', () => {
    mockUseThemeEngine.mockReturnValue({ showHeaderLogo: true, showHeaderWordmark: false });
    render(<AuthSplash setToken={setToken} />);
    expect(screen.getByAltText('Youtarr logo')).toBeInTheDocument();
    expect(screen.queryByAltText('Youtarr')).not.toBeInTheDocument();
    // Plain title is shown when wordmark is false
    expect(screen.getByRole('heading', { name: 'Youtarr' })).toBeInTheDocument();
  });

  test('logs in successfully and navigates to /channels', async () => {
    axios.post.mockResolvedValueOnce({ data: { token: 'tok-123' } });
    render(<AuthSplash setToken={setToken} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/auth/login', { username: 'alice', password: 'secret' });
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'tok-123');
    expect(setToken).toHaveBeenCalledWith('tok-123');
  });

  test('shows generic error when failure is not an Axios error', async () => {
    axios.isAxiosError.mockReturnValue(false);
    axios.post.mockRejectedValueOnce(new Error('weird'));
    render(<AuthSplash setToken={setToken} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
    expect(setToken).not.toHaveBeenCalled();
  });

  test('does not show an error when response indicates setup is required', async () => {
    axios.isAxiosError.mockReturnValue(true);
    axios.post.mockRejectedValueOnce({ response: { data: { requiresSetup: true } } });
    render(<AuthSplash setToken={setToken} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Wait for the request to settle
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
    });
    // setup-required branch: no error displayed, setToken not called
    expect(screen.queryByText(/Login failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid username/)).not.toBeInTheDocument();
    expect(setToken).not.toHaveBeenCalled();
  });

  test('shows rate-limit message from response when status is 429', async () => {
    axios.isAxiosError.mockReturnValue(true);
    axios.post.mockRejectedValueOnce({
      response: { status: 429, data: { error: 'Slow down' } },
    });
    render(<AuthSplash setToken={setToken} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Slow down')).toBeInTheDocument();
    });
  });

  test('falls back to default rate-limit message when 429 has no error field', async () => {
    axios.isAxiosError.mockReturnValue(true);
    axios.post.mockRejectedValueOnce({ response: { status: 429, data: {} } });
    render(<AuthSplash setToken={setToken} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/Too many login attempts/)).toBeInTheDocument();
    });
  });

  test('shows "Invalid username or password" on 401', async () => {
    axios.isAxiosError.mockReturnValue(true);
    axios.post.mockRejectedValueOnce({ response: { status: 401, data: {} } });
    render(<AuthSplash setToken={setToken} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
    });
  });

  test('shows server-provided error message when response.data.error is present', async () => {
    axios.isAxiosError.mockReturnValue(true);
    axios.post.mockRejectedValueOnce({
      response: { status: 500, data: { error: 'Server boom' } },
    });
    render(<AuthSplash setToken={setToken} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Server boom')).toBeInTheDocument();
    });
  });

  test('shows "Signing in..." label and disables submit while request is pending', async () => {
    let resolvePost!: (value: any) => void;
    axios.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve;
      })
    );

    render(<AuthSplash setToken={setToken} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Signing in/i })).toBeDisabled();
    });

    resolvePost({ data: { token: 'tok' } });

    await waitFor(() => {
      expect(setToken).toHaveBeenCalledWith('tok');
    });
  });
});
