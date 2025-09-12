import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LocalLogin from '../LocalLogin';

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn()
}));

const axios = require('axios');

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

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

describe('LocalLogin Component', () => {
  const mockSetToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.location.href = '';
  });

  test('renders login form with username and password fields', () => {
    render(<LocalLogin setToken={mockSetToken} />);
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('updates input values when user types', async () => {
    const user = userEvent.setup();
    render(<LocalLogin setToken={mockSetToken} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    
    expect(usernameInput).toHaveValue('testuser');
    expect(passwordInput).toHaveValue('testpass');
  });

  test('handles successful login', async () => {
    const user = userEvent.setup();
    const mockToken = 'test-token-123';
    
    axios.post.mockResolvedValueOnce({
      data: { token: mockToken }
    });
    
    render(<LocalLogin setToken={mockSetToken} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/auth/login', {
        username: 'testuser',
        password: 'testpass'
      });
    });
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', mockToken);
    expect(mockSetToken).toHaveBeenCalledWith(mockToken);
    expect(window.location.href).toBe('/configuration');
  });

  test('displays error for invalid credentials (401)', async () => {
    const user = userEvent.setup();
    
    axios.post.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { error: 'Unauthorized' }
      }
    });
    
    render(<LocalLogin setToken={mockSetToken} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(usernameInput, 'wronguser');
    await user.type(passwordInput, 'wrongpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
    });
  });

  test('displays rate limit error (429)', async () => {
    const user = userEvent.setup();
    
    axios.post.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { 
          error: 'Rate limit exceeded. Please wait 15 minutes.' 
        }
      }
    });
    
    render(<LocalLogin setToken={mockSetToken} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
    });
  });

  test('redirects to setup page when setup is required', async () => {
    const user = userEvent.setup();
    
    axios.post.mockRejectedValueOnce({
      response: {
        data: { 
          requiresSetup: true 
        }
      }
    });
    
    render(<LocalLogin setToken={mockSetToken} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(window.location.href).toBe('/setup');
    });
  });

  test('displays generic error message for unknown errors', async () => {
    const user = userEvent.setup();
    
    axios.post.mockRejectedValueOnce(new Error('Network error'));
    
    render(<LocalLogin setToken={mockSetToken} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/login failed. please try again/i)).toBeInTheDocument();
    });
  });

  test('disables submit button and shows loading text during login', async () => {
    const user = userEvent.setup();
    
    // Create a promise that we can control
    let resolveLogin: any;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    
    axios.post.mockReturnValueOnce(loginPromise);
    
    render(<LocalLogin setToken={mockSetToken} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    // Check loading state
    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    
    // Resolve the login
    resolveLogin({ data: { token: 'test-token' } });
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /login/i })).not.toBeDisabled();
    });
  });

  test('prevents form submission with empty fields', async () => {
    render(<LocalLogin setToken={mockSetToken} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    // Check that required attribute is set
    expect(usernameInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('required');
  });
});