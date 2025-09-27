import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from './App';
import { useMediaQuery } from '@mui/material';

// Mock axios before any imports that use it
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require('axios');

// Mock fetch
global.fetch = jest.fn();

// Mock components
jest.mock('./components/Configuration', () => {
  return function Configuration({ token }: { token: string }) {
    return <div data-testid="configuration-page">Configuration Component - Token: {token}</div>;
  };
});

jest.mock('./components/ChannelManager', () => {
  return function ChannelManager({ token }: { token: string }) {
    return <div data-testid="channel-manager-page">Channel Manager Component - Token: {token}</div>;
  };
});

jest.mock('./components/DownloadManager', () => {
  return function DownloadManager({ token }: { token: string }) {
    return <div data-testid="download-manager-page">Download Manager Component - Token: {token}</div>;
  };
});

jest.mock('./components/VideosPage', () => {
  return function VideosPage({ token }: { token: string }) {
    return <div data-testid="videos-page">Videos Page Component - Token: {token}</div>;
  };
});

jest.mock('./components/LocalLogin', () => {
  return function LocalLogin({ setToken }: { setToken: (token: string | null) => void }) {
    return (
      <div data-testid="login-page">
        <button onClick={() => {
          setToken('mock-token');
        }}>Mock Login</button>
      </div>
    );
  };
});

jest.mock('./components/InitialSetup', () => {
  return function InitialSetup({ onSetupComplete }: { onSetupComplete: (token: string) => void }) {
    return (
      <div data-testid="setup-page">
        <button onClick={() => {
          onSetupComplete('setup-token');
        }}>Complete Setup</button>
      </div>
    );
  };
});

jest.mock('./components/ChannelPage', () => {
  return function ChannelPage({ token }: { token: string }) {
    return <div data-testid="channel-page">Channel Page Component - Token: {token}</div>;
  };
});

jest.mock('./components/StorageStatus', () => {
  return function StorageStatus({ token }: { token: string | null }) {
    return <div data-testid="storage-status">Storage Status - Token: {token}</div>;
  };
});

jest.mock('./components/ErrorBoundary', () => {
  return function ErrorBoundary({ children }: { children: React.ReactNode; fallbackMessage?: string }) {
    return <>{children}</>;
  };
});

// Mock window.location with proper URL
delete (window as any).location;
window.location = {
  href: 'http://localhost/',
  origin: 'http://localhost',
  pathname: '/',
  search: '',
  hash: '',
  protocol: 'http:',
  host: 'localhost',
  hostname: 'localhost',
  port: '',
  replace: jest.fn(),
  reload: jest.fn(),
  assign: jest.fn()
} as any;

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

// Mock matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock MUI's useTheme and useMediaQuery hooks
jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({
    breakpoints: {
      down: jest.fn(() => 'sm'),
      up: jest.fn(),
      between: jest.fn(),
      values: { xs: 0, sm: 600, md: 960, lg: 1280, xl: 1920 }
    },
    palette: {},
    spacing: jest.fn()
  })
}));

jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useMediaQuery: jest.fn(() => false) // Default to desktop view
}));

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.location.href = 'http://localhost/';
    window.location.pathname = '/';
    localStorageMock.getItem.mockReturnValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ requiresSetup: false }),
    });
    axios.get.mockResolvedValue({ data: { version: 'v1.0.0' } });
  });

  test('renders the app with header and navigation drawer', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByAltText('Youtarr')).toBeInTheDocument();
    });

    expect(screen.getByText('YouTube Video Manager')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Your Channels')).toBeInTheDocument();
    expect(screen.getByText('Manage Downloads')).toBeInTheDocument();
    expect(screen.getByText('Downloaded Videos')).toBeInTheDocument();
  });

  test('shows login link when not authenticated', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ requiresSetup: false }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });
  });

  test('shows logout button when authenticated', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/data/videos' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  test('handles logout action', async () => {
    const user = userEvent.setup();
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/data/videos' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    // Clear previous calls from component mount (plexAuthToken cleanup)
    localStorageMock.removeItem.mockClear();

    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('plexAuthToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledTimes(2);
  });

  test('validates auth token on mount', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true, // Valid token
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/data/videos' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/auth/validate', {
        headers: {
          'x-access-token': 'test-token',
        },
      });
    });
  });

  test('removes invalid auth token', async () => {
    localStorageMock.getItem.mockReturnValue('invalid-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: false, // Invalid token
      });

    render(<App />);

    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });
  });

  test('fetches and displays server version', async () => {
    axios.get.mockResolvedValue({ data: { version: 'v1.2.0' } });

    render(<App />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/getCurrentReleaseVersion');
    });
  });

  test('displays version mismatch warning when server version differs', async () => {
    axios.get.mockResolvedValue({ data: { version: 'v2.0.0' } });
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/data/videos' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/New version \(v2.0.0\) available!/)).toBeInTheDocument();
    });
  });

  test('shows warning when output directory is in /tmp', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/tmp/videos' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Your video directory is mounted to \/tmp/)).toBeInTheDocument();
    });
  });

  test('handles platform managed authentication', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        requiresSetup: false,
        platformManaged: true
      }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Platform Authentication')).toBeInTheDocument();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'platform-managed-auth');
  });

  test('displays ElfHosted branding when platform is elfhosted', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          youtubeOutputDirectory: '/data/videos',
          deploymentEnvironment: { platform: 'elfhosted' }
        }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByAltText('ElfHosted')).toBeInTheDocument();
    });
  });

  test('renders authenticated pages when user has token', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/data/videos' }),
      });

    render(<App />);

    await waitFor(() => {
      // Navigation menu should have all authenticated routes
      expect(screen.getByText('Configuration')).toBeInTheDocument();
    });

    expect(screen.getByText('Your Channels')).toBeInTheDocument();
    expect(screen.getByText('Manage Downloads')).toBeInTheDocument();
    expect(screen.getByText('Downloaded Videos')).toBeInTheDocument();
  });

  test('shows mobile menu button on mobile devices', async () => {
    // Mock mobile view
    (useMediaQuery as jest.Mock).mockReturnValue(true);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText('open drawer')).toBeInTheDocument();
    });
  });

  test('clears old plexAuthToken on mount', async () => {
    // Mock getItem to return a value for plexAuthToken on first call
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'plexAuthToken') return 'old-plex-token';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('plexAuthToken');
    });
  });

  test('handles auth validation failure gracefully', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockRejectedValueOnce(new Error('Auth validation failed'));

    render(<App />);

    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });
  });

  test('does not show version warning for elfhosted platform', async () => {
    axios.get.mockResolvedValue({ data: { version: 'v2.0.0' } });
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          youtubeOutputDirectory: '/data/videos',
          deploymentEnvironment: { platform: 'elfhosted' }
        }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByAltText('ElfHosted')).toBeInTheDocument();
    });

    expect(screen.queryByText(/New version.*available/)).not.toBeInTheDocument();
  });

  test('displays storage status component', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/data/videos' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('storage-status')).toBeInTheDocument();
    });
  });

  test('displays loading state while checking setup', () => {
    // Don't resolve the fetch promise immediately
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<App />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('closes tmp warning snackbar when dismissed', async () => {
    const user = userEvent.setup();
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiresSetup: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/tmp/videos' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Your video directory is mounted to \/tmp/)).toBeInTheDocument();
    });

    // Find and click the close button within the alert
    // First verify the warning is shown
    screen.getByText(/Your video directory is mounted to \/tmp/);
    // Look for all buttons and click the last one (which is the close button)
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons[closeButtons.length - 1];
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText(/Your video directory is mounted to \/tmp/)).not.toBeInTheDocument();
    });
  });
});