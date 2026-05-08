import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import InitialSetup from '../InitialSetup';

// Mock axios. Include isAxiosError so the component's narrowing works.
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: jest.fn((err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError)),
}));

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

describe('InitialSetup Component', () => {
  const mockOnSetupComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Setup form rendering', () => {
    test('renders all required fields including the setup token field', () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      expect(screen.getByLabelText(/setup token/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /complete setup/i })).toBeInTheDocument();
    });

    test('displays setup-token alert with reference to logs and config file', () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      expect(screen.getByText('Setup token required')).toBeInTheDocument();
      expect(screen.getAllByText(/docker logs youtarr/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/config\/setup-token/).length).toBeGreaterThan(0);
      expect(screen.getByText(/AUTH_PRESET_USERNAME/)).toBeInTheDocument();
      expect(screen.getByText(/AUTH_PRESET_PASSWORD/)).toBeInTheDocument();
      expect(screen.getByText(/restart Youtarr/i)).toBeInTheDocument();
    });

    test('uses admin as the default username', () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      expect(screen.getByLabelText(/^username/i)).toHaveValue('admin');
    });

    test('does not call /setup/status', () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('all four input fields are marked as required', () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      expect(screen.getByLabelText(/setup token/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/^username/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/^password/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('required');
    });

    test('submit button is enabled by default', () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      expect(screen.getByRole('button', { name: /complete setup/i })).toBeEnabled();
    });
  });

  describe('Password strength indicator', () => {
    test('shows "Too short" for passwords under 8 characters', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/^password/i), 'short');

      expect(screen.getByText(/password strength: too short/i)).toBeInTheDocument();
    });

    test('shows "Fair" for 8-11 character passwords', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/^password/i), 'fairpass');

      expect(screen.getByText(/password strength: fair/i)).toBeInTheDocument();
    });

    test('shows "Good" for 12-15 character passwords', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/^password/i), 'goodpassword');

      expect(screen.getByText(/password strength: good/i)).toBeInTheDocument();
    });

    test('shows "Strong" for 16+ character passwords', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/^password/i), 'verystrongpassword123');

      expect(screen.getByText(/password strength: strong/i)).toBeInTheDocument();
    });

    test('shows "Enter password" when the password field is empty', () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      expect(screen.getByText(/password strength: enter password/i)).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    const fillTokenAndPasswords = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText(/setup token/i), 'sample-token');
    };

    test('does not submit when token is only whitespace', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/setup token/i), '   ');
      await user.type(screen.getByLabelText(/^password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      expect(await screen.findByText('Setup token is required')).toBeInTheDocument();
      expect(axios.post).not.toHaveBeenCalled();
      expect(mockOnSetupComplete).not.toHaveBeenCalled();
    });

    test('shows error when passwords do not match', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await fillTokenAndPasswords(user);
      await user.type(screen.getByLabelText(/^password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'different');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('shows error when password is shorter than 8 chars', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await fillTokenAndPasswords(user);
      await user.type(screen.getByLabelText(/^password/i), 'short');
      await user.type(screen.getByLabelText(/confirm password/i), 'short');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('clears the inline error when the next submission succeeds', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await fillTokenAndPasswords(user);
      await user.type(screen.getByLabelText(/^password/i), 'short');
      await user.type(screen.getByLabelText(/confirm password/i), 'short');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      await screen.findByText(/password must be at least 8 characters/i);

      await user.clear(screen.getByLabelText(/^password/i));
      await user.clear(screen.getByLabelText(/confirm password/i));
      await user.type(screen.getByLabelText(/^password/i), 'validpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'validpassword123');

      axios.post.mockResolvedValueOnce({ data: { token: 'session-token' } });

      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      await waitFor(() => {
        expect(screen.queryByText(/password must be at least 8 characters/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Successful setup', () => {
    test('posts the token, username, and password and calls onSetupComplete', async () => {
      const user = userEvent.setup();
      const sessionToken = 'returned-session-token';

      axios.post.mockResolvedValueOnce({ data: { token: sessionToken } });

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/setup token/i), '  my-setup-token  ');
      await user.clear(screen.getByLabelText(/^username/i));
      await user.type(screen.getByLabelText(/^username/i), 'newuser');
      await user.type(screen.getByLabelText(/^password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith('/setup/create-auth', {
          token: 'my-setup-token',
          username: 'newuser',
          password: 'password123',
        });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', sessionToken);
      expect(mockOnSetupComplete).toHaveBeenCalledWith(sessionToken);
    });

    test('shows the loading state while the request is in flight', async () => {
      const user = userEvent.setup();
      let resolveSetup: (value: unknown) => void = () => {};
      const setupPromise = new Promise((resolve) => { resolveSetup = resolve; });
      axios.post.mockReturnValueOnce(setupPromise);

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/setup token/i), 'token');
      await user.type(screen.getByLabelText(/^password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      expect(screen.getByRole('button', { name: /setting up/i })).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      resolveSetup({ data: { token: 'tok' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /complete setup/i })).not.toBeDisabled();
      });
    });
  });

  describe('Setup failure', () => {
    test('surfaces the server "Invalid setup token" error', async () => {
      const user = userEvent.setup();
      const axiosError = { isAxiosError: true, response: { status: 401, data: { error: 'Invalid setup token' } } };
      axios.isAxiosError.mockImplementation((err: unknown) => Boolean((err as typeof axiosError)?.isAxiosError));
      axios.post.mockRejectedValueOnce(axiosError);

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/setup token/i), 'wrong-token');
      await user.type(screen.getByLabelText(/^password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      expect(await screen.findByText('Invalid setup token')).toBeInTheDocument();
      expect(mockOnSetupComplete).not.toHaveBeenCalled();
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    test('surfaces a generic "Setup failed" message for non-axios errors', async () => {
      const user = userEvent.setup();
      axios.post.mockRejectedValueOnce(new Error('Network error'));

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/setup token/i), 'token');
      await user.type(screen.getByLabelText(/^password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      expect(await screen.findByText('Setup failed')).toBeInTheDocument();
      expect(mockOnSetupComplete).not.toHaveBeenCalled();
    });

    test('re-enables the submit button after a failed attempt', async () => {
      const user = userEvent.setup();
      const axiosError = { isAxiosError: true, response: { status: 500, data: { error: 'Server error' } } };
      axios.isAxiosError.mockImplementation((err: unknown) => Boolean((err as typeof axiosError)?.isAxiosError));
      axios.post.mockRejectedValueOnce(axiosError);

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await user.type(screen.getByLabelText(/setup token/i), 'token');
      await user.type(screen.getByLabelText(/^password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /complete setup/i }));

      await screen.findByText('Server error');

      const button = screen.getByRole('button', { name: /complete setup/i });
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent('Complete Setup');
    });
  });

  describe('Helper UI text', () => {
    test('displays the username helper text', () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      expect(screen.getByText('Choose a username for login')).toBeInTheDocument();
    });

    test('displays the post-setup access footer', () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      expect(screen.getByText(/after setup, you can access youtarr normally/i)).toBeInTheDocument();
    });
  });
});
