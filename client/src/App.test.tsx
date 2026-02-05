import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App, { windowUtils } from './App';
import { useMediaQuery } from '@mui/material';

// Mock axios before any imports that use it
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn(),
      eject: jest.fn(),
    },
    response: {
      use: jest.fn(() => 0), // Return mock interceptor ID
      eject: jest.fn(),
    },
  },
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

jest.mock('./components/ChangelogPage', () => {
  return function ChangelogPage() {
    return <div data-testid="changelog-page">Changelog Page Component</div>;
  };
});

jest.mock('./components/ErrorBoundary', () => {
  return function ErrorBoundary({ children }: { children: React.ReactNode; fallbackMessage?: string }) {
    return <>{children}</>;
  };
});

jest.mock('./components/DatabaseErrorOverlay', () => {
  return function DatabaseErrorOverlay({
    errors,
    onRetry,
    recovered = false,
    countdown = 15
  }: {
    errors: string[];
    onRetry: () => void;
    recovered?: boolean;
    countdown?: number;
  }) {
    return (
      <div data-testid="database-error-overlay">
        {recovered ? 'Database Recovered' : 'Database Error Overlay'}
        <div data-testid="error-count">{errors.length} errors</div>
        <div data-testid="countdown">Countdown: {countdown}</div>
        <div data-testid="recovered-status">{recovered ? 'recovered' : 'error'}</div>
        <button onClick={onRetry}>Retry</button>
      </div>
    );
  };
});

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

// Store the original location for restoration in afterEach
const originalLocation = window.location;

// Delete and replace window.location with a plain mock object
// This bypasses JSDOM's non-configurable location
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
delete (window as any).location;
(window as any).location = {
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
  assign: jest.fn(),
  toString: () => 'http://localhost/',
} as any;

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

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Location is mocked at module scope, no restoration needed
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
  // Helper function to create a standard fetch mock with common endpoints
  const createFetchMock = (overrides: Record<string, any> = {}) => {
    return (url: string, options?: any) => {
      // Check for overrides first
      if (overrides[url]) {
        return Promise.resolve(overrides[url]);
      }

      // Default responses
      if (url === '/api/db-status') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'healthy' }),
        });
      }
      if (url === '/setup/status') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ requiresSetup: false }),
        });
      }
      if (url === '/auth/validate') {
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        });
      }
      if (url === '/getconfig') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ youtubeOutputDirectory: '/data/videos' }),
        });
      }
      // Default fallback
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({})
      });
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/');
    localStorageMock.getItem.mockReturnValue(null);
    (global.fetch as jest.Mock).mockImplementation(createFetchMock());
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
    expect(screen.getByText('Changelog')).toBeInTheDocument();
  });

  test('shows login link when not authenticated', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });
  });

  test('shows logout button when authenticated', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  test('handles logout action', async () => {
    const user = userEvent.setup();
    localStorageMock.getItem.mockReturnValue('test-token');

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

    // Mock fetch responses in the order they are called:
    // 1. /getconfig
    // 2. /api/db-status
    // 3. /setup/status
    // 4. /auth/validate
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          preferredResolution: '1080',
          darkModeEnabled: false,
          youtubeOutputDirectory: '/tmp',
        }),
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ requiresSetup: false }),
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }));

    render(<App />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/auth/validate', {
        headers: {
          'x-access-token': 'test-token',
        },
        cache: 'no-cache',
      });
    });
  });

  test('removes invalid auth token', async () => {
    localStorageMock.getItem.mockReturnValue('invalid-token');
    (global.fetch as jest.Mock).mockImplementation(createFetchMock({
      '/auth/validate': {
        ok: false, // Invalid token
      }
    }));

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

  test('displays yt-dlp version when provided by server', async () => {
    axios.get.mockResolvedValue({ data: { version: 'v1.2.0', ytDlpVersion: '2025.09.23' } });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/yt-dlp: 2025.09.23/)).toBeInTheDocument();
    });
  });

  test('displays version mismatch warning when server version differs', async () => {
    axios.get.mockResolvedValue({ data: { version: 'v2.0.0' } });
    localStorageMock.getItem.mockReturnValue('test-token');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/New version \(v2.0.0\) available!/)).toBeInTheDocument();
    });
  });

  test('shows warning when output directory is in /tmp', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock).mockImplementation(createFetchMock({
      '/getconfig': {
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/tmp/videos' }),
      }
    }));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Your video directory is mounted to \/tmp/)).toBeInTheDocument();
    });
  });

  test('handles platform managed authentication', async () => {
    (global.fetch as jest.Mock).mockImplementation(createFetchMock({
      '/setup/status': {
        ok: true,
        json: async () => ({
          requiresSetup: false,
          platformManaged: true
        }),
      }
    }));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Platform Authentication')).toBeInTheDocument();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'platform-managed-auth');
  });

  test('displays ElfHosted branding when platform is elfhosted', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock).mockImplementation(createFetchMock({
      '/getconfig': {
        ok: true,
        json: async () => ({
          youtubeOutputDirectory: '/data/videos',
          deploymentEnvironment: { platform: 'elfhosted' }
        }),
      }
    }));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByAltText('ElfHosted')).toBeInTheDocument();
    });
  });

  test('renders authenticated pages when user has token', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');

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
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url === '/api/db-status') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'healthy' }),
        });
      }
      if (url === '/setup/status') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ requiresSetup: false }),
        });
      }
      if (url === '/auth/validate') {
        return Promise.reject(new Error('Auth validation failed'));
      }
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({})
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });
  });

  test('does not show version warning for elfhosted platform', async () => {
    axios.get.mockResolvedValue({ data: { version: 'v2.0.0' } });
    localStorageMock.getItem.mockReturnValue('test-token');
    (global.fetch as jest.Mock).mockImplementation(createFetchMock({
      '/getconfig': {
        ok: true,
        json: async () => ({
          youtubeOutputDirectory: '/data/videos',
          deploymentEnvironment: { platform: 'elfhosted' }
        }),
      }
    }));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByAltText('ElfHosted')).toBeInTheDocument();
    });

    expect(screen.queryByText(/New version.*available/)).not.toBeInTheDocument();
  });

  test('displays storage status component', async () => {
    localStorageMock.getItem.mockReturnValue('test-token');

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
    (global.fetch as jest.Mock).mockImplementation(createFetchMock({
      '/getconfig': {
        ok: true,
        json: async () => ({ youtubeOutputDirectory: '/tmp/videos' }),
      }
    }));

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

  describe('Database Error Handling', () => {
    test('calls /api/db-status on mount', async () => {
      render(<App />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/db-status', {
          cache: 'no-cache'
        });
      });
    });

    test('does not show overlay when database is healthy', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByAltText('Youtarr')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('database-error-overlay')).not.toBeInTheDocument();
    });

    test('shows overlay when database has errors', async () => {
      (global.fetch as jest.Mock).mockImplementation(createFetchMock({
        '/api/db-status': {
          ok: true,
          json: async () => ({
            status: 'error',
            database: {
              errors: ['Connection refused', 'Failed to connect to database']
            }
          }),
        }
      }));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('database-error-overlay')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-count')).toHaveTextContent('2 errors');
    });

    test('extracts errors correctly from response', async () => {
      (global.fetch as jest.Mock).mockImplementation(createFetchMock({
        '/api/db-status': {
          ok: true,
          json: async () => ({
            status: 'error',
            database: {
              errors: ['Test error 1', 'Test error 2', 'Test error 3']
            }
          }),
        }
      }));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('error-count')).toHaveTextContent('3 errors');
      });
    });

    test('shows unknown error when errors array is missing', async () => {
      (global.fetch as jest.Mock).mockImplementation(createFetchMock({
        '/api/db-status': {
          ok: true,
          json: async () => ({
            status: 'error',
            database: {}
          }),
        }
      }));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('database-error-overlay')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-count')).toHaveTextContent('1 errors');
    });

    test('retry button calls window.location.reload', async () => {
      const user = userEvent.setup();
      
      const reloadSpy = jest.spyOn(windowUtils, 'reload').mockImplementation(() => {});

      (global.fetch as jest.Mock).mockImplementation(createFetchMock({
        '/api/db-status': {
          ok: true,
          json: async () => ({
            status: 'error',
            database: {
              errors: ['Connection error']
            }
          }),
        }
      }));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('database-error-overlay')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);

      expect(reloadSpy).toHaveBeenCalled();
      reloadSpy.mockRestore();
    });

    test('gracefully handles fetch failure by assuming healthy database', async () => {
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/db-status') {
          return Promise.reject(new Error('Network error'));
        }
        if (url === '/setup/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ requiresSetup: false }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({})
        });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByAltText('Youtarr')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('database-error-overlay')).not.toBeInTheDocument();
    });

    test('shows overlay when status is not healthy (including checking)', async () => {
      // Current implementation treats any non-"healthy" status as an error
      (global.fetch as jest.Mock).mockImplementation(createFetchMock({
        '/api/db-status': {
          ok: true,
          json: async () => ({
            status: 'checking',
            database: {
              errors: ['Database is still initializing']
            }
          }),
        }
      }));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('database-error-overlay')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-count')).toHaveTextContent('1 errors');
    });

    test('starts polling when database is in error state', async () => {
      jest.useFakeTimers();
      try {
        (global.fetch as jest.Mock).mockImplementation(createFetchMock({
          '/api/db-status': {
            ok: true,
            json: async () => ({
              status: 'error',
              database: {
                errors: ['Connection error']
              }
            }),
          }
        }));

        render(<App />);

        // Wait for initial error state
        await waitFor(() => {
          expect(screen.getByTestId('database-error-overlay')).toBeInTheDocument();
        });

        // Fast-forward 15 seconds to trigger polling
        act(() => {
          jest.advanceTimersByTime(15000);
        });

        // Should have made another call to /api/db-status
        await waitFor(() => {
          expect(fetch).toHaveBeenCalledTimes(3); // initial mount, setup check, and one poll
        });
      } finally {
        jest.useRealTimers();
      }
    });

    test('shows recovery state when database becomes healthy', async () => {
      jest.useFakeTimers();
      try {
        let callCount = 0;

        (global.fetch as jest.Mock).mockImplementation((url) => {
          if (url === '/api/db-status') {
            callCount++;
            if (callCount === 1) {
              // First call: error
              return Promise.resolve({
                ok: true,
                json: async () => ({
                  status: 'error',
                  database: { errors: ['Connection error'] }
                }),
              });
            } else {
              // Subsequent calls: healthy
              return Promise.resolve({
                ok: true,
                json: async () => ({ status: 'healthy' }),
              });
            }
          }
          if (url === '/setup/status') {
            return Promise.resolve({
              ok: true,
              json: async () => ({ requiresSetup: false }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({})
          });
        });

        render(<App />);

        // Wait for initial error state
        await waitFor(() => {
          expect(screen.getByTestId('recovered-status')).toHaveTextContent('error');
        });

        // Fast-forward to trigger polling and recovery
        act(() => {
          jest.advanceTimersByTime(15000);
        });

        // Should show recovery state
        await waitFor(() => {
          expect(screen.getByTestId('recovered-status')).toHaveTextContent('recovered');
        });
      } finally {
        jest.useRealTimers();
      }
    });

    test('axios interceptor is registered on mount', async () => {
      render(<App />);

      // Wait for app to load
      await waitFor(() => {
        expect(screen.getByAltText('Youtarr')).toBeInTheDocument();
      });

      // Verify interceptor was registered
      const mockAxios = require('axios');
      expect(mockAxios.interceptors.response.use).toHaveBeenCalled();
    });

    test('countdown updates during polling', async () => {
      jest.useFakeTimers();
      try {
        (global.fetch as jest.Mock).mockImplementation(createFetchMock({
          '/api/db-status': {
            ok: true,
            json: async () => ({
              status: 'error',
              database: {
                errors: ['Connection error']
              }
            }),
          }
        }));

        render(<App />);

        // Wait for overlay to appear first
        await waitFor(() => {
          expect(screen.getByTestId('database-error-overlay')).toBeInTheDocument();
        });

        // Then check initial countdown
        await waitFor(() => {
          expect(screen.getByTestId('countdown')).toHaveTextContent('Countdown: 15');
        });

        // Advance by 5 seconds
        act(() => {
          jest.advanceTimersByTime(5000);
        });

        // Countdown should decrease
        await waitFor(() => {
          expect(screen.getByTestId('countdown')).toHaveTextContent('Countdown: 10');
        });
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
