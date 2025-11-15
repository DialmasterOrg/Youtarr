import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import InitialSetup from '../InitialSetup';

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

const axios = require('axios');

// Mock localStorage
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

  describe('Initial Status Check', () => {
    test('checks setup status on component mount', async () => {
      axios.get.mockResolvedValueOnce({
        data: { isLocalhost: true }
      });

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/setup/status');
      });
    });

    test('handles setup status check failure gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Setup status check failed:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Non-localhost Access', () => {
    test('displays security warning when accessing from non-localhost', async () => {
      axios.get.mockResolvedValueOnce({
        data: { isLocalhost: false }
      });

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(screen.getByText('🔒 Security Protection Active')).toBeInTheDocument();
      });

      expect(screen.getByText(/initial password setup must be performed from the server itself/i)).toBeInTheDocument();
      expect(screen.getByText('http://localhost:3087')).toBeInTheDocument();
      expect(screen.getByText(/this security measure prevents unauthorized users/i)).toBeInTheDocument();
    });

    test('does not show setup form when not on localhost', async () => {
      axios.get.mockResolvedValueOnce({
        data: { isLocalhost: false }
      });

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(screen.getByText('🔒 Security Protection Active')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /complete setup/i })).not.toBeInTheDocument();
    });
  });

  describe('Localhost Setup Form', () => {
    beforeEach(() => {
      axios.get.mockResolvedValueOnce({
        data: { isLocalhost: true }
      });
    });

    test('renders setup form with all required fields', async () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for the form to be rendered after axios call
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      // Check all form fields are present
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /complete setup/i })).toBeInTheDocument();
    });

    test('shows important changes alert with information', async () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(screen.getByText('Important')).toBeInTheDocument();
      });

      expect(screen.getByText(/youtarr uses local authentication by default/i)).toBeInTheDocument();
      expect(screen.getByText(/initial setup requires access via localhost/i)).toBeInTheDocument();
    });

    test('has admin as default username', async () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        const usernameInput = screen.getByLabelText(/username/i);
        expect(usernameInput).toHaveValue('admin');
      });
    });

    test('updates input values when user types', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.clear(usernameInput);
      await user.type(usernameInput, 'newuser');
      await user.type(passwordInput, 'testpassword123');
      await user.type(confirmPasswordInput, 'testpassword123');

      expect(usernameInput).toHaveValue('newuser');
      expect(passwordInput).toHaveValue('testpassword123');
      expect(confirmPasswordInput).toHaveValue('testpassword123');
    });

    test('submit button is disabled while checking localhost status', () => {
      axios.get.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      const submitButton = screen.getByRole('button', { name: /complete setup/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Password Strength Indicator', () => {
    beforeEach(() => {
      axios.get.mockResolvedValueOnce({
        data: { isLocalhost: true }
      });
    });

    test('shows password strength as "Too short" for passwords under 8 characters', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      await user.type(passwordInput, 'short');

      expect(screen.getByText(/password strength: too short/i)).toBeInTheDocument();
    });

    test('shows password strength as "Fair" for 8-11 character passwords', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      await user.type(passwordInput, 'fairpass');

      expect(screen.getByText(/password strength: fair/i)).toBeInTheDocument();
    });

    test('shows password strength as "Good" for 12-15 character passwords', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      await user.type(passwordInput, 'goodpassword');

      expect(screen.getByText(/password strength: good/i)).toBeInTheDocument();
    });

    test('shows password strength as "Strong" for 16+ character passwords', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      await user.type(passwordInput, 'verystrongpassword123');

      expect(screen.getByText(/password strength: strong/i)).toBeInTheDocument();
    });

    test('shows "Enter password" when password field is empty', async () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/password strength: enter password/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      axios.get.mockResolvedValueOnce({
        data: { isLocalhost: true }
      });
    });

    test('shows error when passwords do not match', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /complete setup/i });

      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'differentpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('shows error when password is less than 8 characters', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /complete setup/i });

      await user.type(passwordInput, 'short');
      await user.type(confirmPasswordInput, 'short');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('clears error when submitting again', async () => {
      const user = userEvent.setup();
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /complete setup/i });

      // First submission with error
      await user.type(passwordInput, 'short');
      await user.type(confirmPasswordInput, 'short');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });

      // Second submission with valid data
      await user.clear(passwordInput);
      await user.clear(confirmPasswordInput);
      await user.type(passwordInput, 'validpassword123');
      await user.type(confirmPasswordInput, 'validpassword123');

      axios.post.mockResolvedValueOnce({
        data: { token: 'test-token' }
      });

      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Password must be at least 8 characters')).not.toBeInTheDocument();
      });
    });
  });

  describe('Successful Setup', () => {
    beforeEach(() => {
      axios.get.mockResolvedValueOnce({
        data: { isLocalhost: true }
      });
    });

    test('handles successful setup and calls onSetupComplete', async () => {
      const user = userEvent.setup();
      const mockToken = 'test-auth-token';

      axios.post.mockResolvedValueOnce({
        data: { token: mockToken }
      });

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /complete setup/i });

      await user.clear(usernameInput);
      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpassword123');
      await user.type(confirmPasswordInput, 'testpassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith('/setup/create-auth', {
          username: 'testuser',
          password: 'testpassword123'
        });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', mockToken);
      expect(mockOnSetupComplete).toHaveBeenCalledWith(mockToken);
    });

    test('shows loading state during setup', async () => {
      const user = userEvent.setup();

      // Create a promise we can control
      let resolveSetup: any;
      const setupPromise = new Promise((resolve) => {
        resolveSetup = resolve;
      });

      axios.post.mockReturnValueOnce(setupPromise);

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /complete setup/i });

      await user.type(passwordInput, 'testpassword123');
      await user.type(confirmPasswordInput, 'testpassword123');
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByRole('button', { name: /setting up/i })).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Resolve the setup
      resolveSetup({ data: { token: 'test-token' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /complete setup/i })).not.toBeDisabled();
      });
    });
  });

  describe('Setup Failure', () => {
    beforeEach(() => {
      axios.get.mockResolvedValueOnce({
        data: { isLocalhost: true }
      });
    });

    test('displays server error message when setup fails', async () => {
      const user = userEvent.setup();

      axios.post.mockRejectedValueOnce({
        response: {
          data: { error: 'Database connection failed' }
        }
      });

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /complete setup/i });

      await user.type(passwordInput, 'testpassword123');
      await user.type(confirmPasswordInput, 'testpassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Database connection failed')).toBeInTheDocument();
      });

      expect(mockOnSetupComplete).not.toHaveBeenCalled();
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    test('displays generic error message for unknown errors', async () => {
      const user = userEvent.setup();

      axios.post.mockRejectedValueOnce(new Error('Network error'));

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /complete setup/i });

      await user.type(passwordInput, 'testpassword123');
      await user.type(confirmPasswordInput, 'testpassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Setup failed')).toBeInTheDocument();
      });

      expect(mockOnSetupComplete).not.toHaveBeenCalled();
    });

    test('re-enables button after failed setup', async () => {
      const user = userEvent.setup();

      axios.post.mockRejectedValueOnce({
        response: {
          data: { error: 'Setup error' }
        }
      });

      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText('Welcome to Youtarr Setup')).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /complete setup/i });

      await user.type(passwordInput, 'testpassword123');
      await user.type(confirmPasswordInput, 'testpassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Setup error')).toBeInTheDocument();
      });

      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent('Complete Setup');
    });
  });

  describe('UI Elements', () => {
    beforeEach(() => {
      axios.get.mockResolvedValueOnce({
        data: { isLocalhost: true }
      });
    });

    test('displays helper text for username field', async () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(screen.getByText('Choose a username for login')).toBeInTheDocument();
      });
    });

    test('displays footer message about post-setup access', async () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/after setup, you can access youtarr from anywhere/i)).toBeInTheDocument();
      });
    });

    test('all input fields are marked as required', async () => {
      render(<InitialSetup onSetupComplete={mockOnSetupComplete} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toHaveAttribute('required');
      });

      expect(screen.getByLabelText(/^Password/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('required');
    });
  });
});
