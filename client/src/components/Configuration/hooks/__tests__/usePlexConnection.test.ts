import { renderHook, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { usePlexConnection } from '../usePlexConnection';
import { ConfigState } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('usePlexConnection', () => {
  const mockToken = 'test-token-123';
  const mockSetConfig = jest.fn();
  const mockSetInitialConfig = jest.fn();
  const mockSetSnackbar = jest.fn();

  const mockConfig: ConfigState = {
    channelAutoDownload: false,
    channelDownloadFrequency: '6',
    channelFilesToDownload: 3,
    preferredResolution: '1080',
    videoCodec: 'default',
    plexApiKey: 'test-plex-key',
    plexYoutubeLibraryId: '1',
    plexIP: '192.168.1.100',
    plexPort: '32400',
    plexViaHttps: false,
    sponsorblockEnabled: true,
    sponsorblockAction: 'remove',
    sponsorblockCategories: {
      sponsor: true,
      intro: false,
      outro: false,
      selfpromo: true,
      preview: false,
      filler: false,
      interaction: false,
      music_offtopic: false,
    },
    sponsorblockApiUrl: '',
    downloadSocketTimeoutSeconds: 30,
    downloadThrottledRate: '100K',
    downloadRetryCount: 2,
    enableStallDetection: true,
    stallDetectionWindowSeconds: 30,
    stallDetectionRateThreshold: '100K',
    cookiesEnabled: false,
    customCookiesUploaded: false,
    writeChannelPosters: true,
    writeVideoNfoFiles: true,
    notificationsEnabled: false,
    notificationService: 'discord',
    discordWebhookUrl: '',
    autoRemovalEnabled: false,
    autoRemovalFreeSpaceThreshold: '',
    autoRemovalVideoAgeThreshold: '',
    useTmpForDownloads: false,
    tmpFilePath: '/tmp/youtarr-downloads',
    subtitlesEnabled: false,
    subtitleLanguage: 'en',
    youtubeOutputDirectory: '/videos',
    uuid: 'test-uuid',
    envAuthApplied: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('returns expected functions and state', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      expect(result.current.plexConnectionStatus).toBe('not_tested');
      expect(result.current.openPlexLibrarySelector).toBe(false);
      expect(result.current.openPlexAuthDialog).toBe(false);
      expect(result.current.setPlexConnectionStatus).toBeDefined();
      expect(result.current.setOpenPlexAuthDialog).toBeDefined();
      expect(result.current.checkPlexConnection).toBeDefined();
      expect(result.current.testPlexConnection).toBeDefined();
      expect(result.current.openLibrarySelector).toBeDefined();
      expect(result.current.closeLibrarySelector).toBeDefined();
      expect(result.current.setLibraryId).toBeDefined();
      expect(result.current.handlePlexAuthSuccess).toBeDefined();
    });

    test('works with null token', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: null,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      expect(result.current.plexConnectionStatus).toBe('not_tested');
      expect(result.current.checkPlexConnection).toBeDefined();
      expect(result.current.testPlexConnection).toBeDefined();
    });
  });

  describe('Initial Plex Connection Check', () => {
    test('checks Plex connection on mount when server is configured', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(result.current.plexConnectionStatus).toBe('connected');
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/getplexlibraries', {
        headers: {
          'x-access-token': mockToken,
        },
      });
    });

    test('does not check connection when server is not configured', () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('does not check connection when plexApiKey is missing', () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const configWithoutApiKey = { ...mockConfig, plexApiKey: '' };

      renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithoutApiKey,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('sets connection status to not_connected when libraries are empty', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(result.current.plexConnectionStatus).toBe('not_connected');
      });
    });

    test('sets connection status to not_connected on error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(result.current.plexConnectionStatus).toBe('not_connected');
      });
    });

    test('only checks connection once on initial mount', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue([{ id: '1', title: 'YouTube' }]),
      } as any);

      const { rerender } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender();
      rerender();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkPlexConnection Function', () => {
    test('can be called manually to check connection', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      // Wait for initial check
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '2', title: 'Library' }]),
      } as any);

      act(() => {
        result.current.checkPlexConnection();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    test('does not make request when server is not configured', () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      act(() => {
        result.current.checkPlexConnection();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('uses empty string for token when null', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);

      renderHook(() =>
        usePlexConnection({
          token: null,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]?.headers).toEqual({
        'x-access-token': '',
      });
    });
  });

  describe('testPlexConnection Function', () => {
    test('shows warning when server is not configured', async () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Please enter your Plex server address before testing the connection.',
        severity: 'warning',
      });
    });

    test('shows warning when API key is missing', async () => {
      const configWithoutApiKey = { ...mockConfig, plexApiKey: '' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithoutApiKey,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Please enter your Plex API Key',
        severity: 'warning',
      });
    });

    test('normalizes port to default 32400 when empty', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithoutPort = { ...mockConfig, plexPort: '', plexApiKey: 'test-key' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithoutPort,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const callArgs = mockFetch.mock.calls[1]; // Second call is testPlexConnection
      const url = callArgs[0] as string;
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('testPort')).toBe('32400');
    });

    test('clamps port value to valid range (1-65535)', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithInvalidPort = { ...mockConfig, plexPort: '99999' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithInvalidPort,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(mockSetConfig).toHaveBeenCalled();
      });

      const setConfigCallback = mockSetConfig.mock.calls[0][0];
      const newConfig = setConfigCallback(configWithInvalidPort);
      expect(newConfig.plexPort).toBe('65535');
    });

    test('strips non-numeric characters from port', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithBadPort = { ...mockConfig, plexPort: 'abc123def', plexApiKey: 'test-key' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithBadPort,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const callArgs = mockFetch.mock.calls[1]; // Second call
      const url = callArgs[0] as string;
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('testPort')).toBe('123');
    });

    test('sets status to testing during connection test', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
              } as any);
            }, 100);
          })
      );

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      let testPromise: Promise<void>;
      act(() => {
        testPromise = result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(result.current.plexConnectionStatus).toBe('testing');
      });

      await act(async () => {
        await testPromise;
      });
    });

    test('makes fetch request with correct test parameters', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      // Wait for initial check
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const callArgs = mockFetch.mock.calls[1]; // Second call
      const url = callArgs[0] as string;
      expect(url).toContain('/getplexlibraries?');
      expect(callArgs[1]?.headers).toEqual({
        'x-access-token': mockToken,
      });

      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('testApiKey')).toBe(mockConfig.plexApiKey);
      expect(params.get('testIP')).toBe(mockConfig.plexIP);
      expect(params.get('testPort')).toBe(mockConfig.plexPort);
      expect(params.get('testUseHttps')).toBe('false');
    });

    test('includes HTTPS parameter when plexViaHttps is true', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const httpsConfig = { ...mockConfig, plexViaHttps: true, plexApiKey: 'test-key' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: httpsConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      const callArgs = mockFetch.mock.calls[1]; // Second call
      const url = callArgs[0] as string;
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('testUseHttps')).toBe('true');
    });

    test('handles successful connection with libraries', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const mockLibraries = [
        { id: '1', title: 'YouTube' },
        { id: '2', title: 'Movies' },
      ];
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockLibraries),
      } as any);

      const configWithKey = { ...mockConfig, plexApiKey: 'test-key' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithKey,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(result.current.plexConnectionStatus).toBe('connected');
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Plex connection successful! Credentials saved automatically.',
        severity: 'success',
      });
    });

    test('updates initial config on successful connection', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithKey = { ...mockConfig, plexApiKey: 'test-key' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithKey,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(mockSetInitialConfig).toHaveBeenCalled();
      });

      const setInitialConfigCallback = mockSetInitialConfig.mock.calls[0][0];
      const prevConfig = { ...mockConfig, plexIP: 'old-ip' };
      const newConfig = setInitialConfigCallback(prevConfig);

      expect(newConfig.plexIP).toBe(configWithKey.plexIP);
      expect(newConfig.plexApiKey).toBe(configWithKey.plexApiKey);
      expect(newConfig.plexPort).toBe(configWithKey.plexPort);
      expect(newConfig.plexViaHttps).toBe(configWithKey.plexViaHttps);
    });

    test('handles connection failure with no libraries', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);

      const configWithKey = { ...mockConfig, plexApiKey: 'test-key' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithKey,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(result.current.plexConnectionStatus).toBe('not_connected');
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Could not retrieve Plex libraries. Check your settings.',
        severity: 'error',
      });
    });

    test('handles connection failure with non-array response', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ error: 'Invalid response' }),
      } as any);

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(result.current.plexConnectionStatus).toBe('not_connected');
      });
    });

    test('handles network error during connection test', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(result.current.plexConnectionStatus).toBe('not_connected');
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Failed to connect to Plex server. Check IP and API key.',
        severity: 'error',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error testing Plex connection:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    test('does not update initial config on connection failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalled();
      });

      expect(mockSetInitialConfig).not.toHaveBeenCalled();
    });

    test('uses empty string for token when null', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const { result } = renderHook(() =>
        usePlexConnection({
          token: null,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]?.headers).toEqual({
        'x-access-token': '',
      });
    });
  });

  describe('Library Selector Functions', () => {
    test('openLibrarySelector sets state to true', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      expect(result.current.openPlexLibrarySelector).toBe(false);

      act(() => {
        result.current.openLibrarySelector();
      });

      expect(result.current.openPlexLibrarySelector).toBe(true);
    });

    test('closeLibrarySelector sets state to false', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      act(() => {
        result.current.openLibrarySelector();
      });

      expect(result.current.openPlexLibrarySelector).toBe(true);

      act(() => {
        result.current.closeLibrarySelector();
      });

      expect(result.current.openPlexLibrarySelector).toBe(false);
    });

    test('setLibraryId updates config and closes selector', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      act(() => {
        result.current.openLibrarySelector();
      });

      expect(result.current.openPlexLibrarySelector).toBe(true);

      act(() => {
        result.current.setLibraryId({
          libraryId: '5',
          libraryTitle: 'YouTube Videos',
        });
      });

      expect(mockSetConfig).toHaveBeenCalledWith(expect.any(Function));
      const setConfigCallback = mockSetConfig.mock.calls[0][0];
      const newConfig = setConfigCallback(mockConfig);
      expect(newConfig.plexYoutubeLibraryId).toBe('5');

      expect(result.current.openPlexLibrarySelector).toBe(false);
    });
  });

  describe('Plex Auth Dialog Functions', () => {
    test('setOpenPlexAuthDialog can open dialog', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      expect(result.current.openPlexAuthDialog).toBe(false);

      act(() => {
        result.current.setOpenPlexAuthDialog(true);
      });

      expect(result.current.openPlexAuthDialog).toBe(true);
    });

    test('setOpenPlexAuthDialog can close dialog', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      act(() => {
        result.current.setOpenPlexAuthDialog(true);
      });

      expect(result.current.openPlexAuthDialog).toBe(true);

      act(() => {
        result.current.setOpenPlexAuthDialog(false);
      });

      expect(result.current.openPlexAuthDialog).toBe(false);
    });
  });

  describe('handlePlexAuthSuccess Function', () => {
    test('updates config with new API key', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      act(() => {
        result.current.handlePlexAuthSuccess('new-api-key-123');
      });

      expect(mockSetConfig).toHaveBeenCalledWith(expect.any(Function));
      const setConfigCallback = mockSetConfig.mock.calls[0][0];
      const newConfig = setConfigCallback(mockConfig);
      expect(newConfig.plexApiKey).toBe('new-api-key-123');
    });

    test('resets connection status to not_tested', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      act(() => {
        result.current.setPlexConnectionStatus('connected');
      });

      expect(result.current.plexConnectionStatus).toBe('connected');

      act(() => {
        result.current.handlePlexAuthSuccess('new-api-key-123');
      });

      expect(result.current.plexConnectionStatus).toBe('not_tested');
    });

    test('shows success snackbar', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      act(() => {
        result.current.handlePlexAuthSuccess('new-api-key-123');
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Plex API Key obtained successfully! Click "Test Connection" to verify and save.',
        severity: 'success',
      });
    });
  });

  describe('Hook Stability', () => {
    test('checkPlexConnection function reference updates with dependencies', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithoutKey = { ...mockConfig, plexApiKey: '' };

      const { result, rerender } = renderHook(
        ({ token, hasPlexServerConfigured }) =>
          usePlexConnection({
            token,
            config: configWithoutKey,
            setConfig: mockSetConfig,
            setInitialConfig: mockSetInitialConfig,
            setSnackbar: mockSetSnackbar,
            hasPlexServerConfigured,
          }),
        {
          initialProps: {
            token: 'token-1',
            hasPlexServerConfigured: false,
          },
        }
      );

      const firstRef = result.current.checkPlexConnection;

      rerender({
        token: 'token-2',
        hasPlexServerConfigured: false,
      });

      const secondRef = result.current.checkPlexConnection;

      expect(firstRef).not.toBe(secondRef);
    });

    test('functions are properly defined', () => {
      const configWithoutKey = { ...mockConfig, plexApiKey: '' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithoutKey,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      // Verify all functions are defined and callable
      expect(typeof result.current.testPlexConnection).toBe('function');
      expect(typeof result.current.openLibrarySelector).toBe('function');
      expect(typeof result.current.closeLibrarySelector).toBe('function');
      expect(typeof result.current.setLibraryId).toBe('function');
      expect(typeof result.current.handlePlexAuthSuccess).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    test('handles missing plexIP in test parameters', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithoutIP = { ...mockConfig, plexIP: '' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithoutIP,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestInfo = callArgs[0];
      const requestUrl =
        requestInfo instanceof Request ? requestInfo.url : requestInfo;
      const params = new URL(requestUrl, 'http://localhost').searchParams;
      expect(params.has('testIP')).toBe(false);
    });

    test('handles port with leading zeros', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithLeadingZeros = { ...mockConfig, plexPort: '00032400', plexApiKey: 'test-key' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithLeadingZeros,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      const callArgs = mockFetch.mock.calls[1]; // Second call
      const url = callArgs[0] as string;
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('testPort')).toBe('32400');
    });

    test('handles port number 0 (below minimum)', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithZeroPort = { ...mockConfig, plexPort: '0' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithZeroPort,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(mockSetConfig).toHaveBeenCalled();
      });

      const setConfigCallback = mockSetConfig.mock.calls[0][0];
      const newConfig = setConfigCallback(configWithZeroPort);
      expect(newConfig.plexPort).toBe('1');
    });

    test('handles null initial config when updating Plex credentials', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithKey = { ...mockConfig, plexApiKey: 'test-key' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithKey,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(mockSetInitialConfig).toHaveBeenCalled();
      });

      const setInitialConfigCallback = mockSetInitialConfig.mock.calls[0][0];
      const newConfig = setInitialConfigCallback(null);

      expect(newConfig.plexIP).toBe(configWithKey.plexIP);
      expect(newConfig.plexApiKey).toBe(configWithKey.plexApiKey);
      expect(newConfig.plexPort).toBe(configWithKey.plexPort);
      expect(newConfig.plexViaHttps).toBe(configWithKey.plexViaHttps);
    });

    test('can perform multiple library selections', () => {
      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
        })
      );

      act(() => {
        result.current.setLibraryId({
          libraryId: '1',
          libraryTitle: 'Library 1',
        });
      });

      expect(mockSetConfig).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.openLibrarySelector();
        result.current.setLibraryId({
          libraryId: '2',
          libraryTitle: 'Library 2',
        });
      });

      expect(mockSetConfig).toHaveBeenCalledTimes(2);

      const setConfigCallback = mockSetConfig.mock.calls[1][0];
      const newConfig = setConfigCallback(mockConfig);
      expect(newConfig.plexYoutubeLibraryId).toBe('2');
    });

    test('handles 401 Unauthorized error during connection test', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValueOnce({ error: 'Unauthorized' }),
      } as any);

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: mockConfig,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(result.current.plexConnectionStatus).toBe('not_connected');
      });
    });

    test('handles whitespace in port field', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock for initial connection check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([]),
      } as any);
      // Mock for testPlexConnection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce([{ id: '1', title: 'YouTube' }]),
      } as any);

      const configWithWhitespace = { ...mockConfig, plexPort: '  32400  ', plexApiKey: 'test-key' };

      const { result } = renderHook(() =>
        usePlexConnection({
          token: mockToken,
          config: configWithWhitespace,
          setConfig: mockSetConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      const callArgs = mockFetch.mock.calls[1]; // Second call
      const url = callArgs[0] as string;
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('testPort')).toBe('32400');
    });
  });

  describe('Callback Dependencies', () => {
    test('includes all dependencies in useCallback', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue([{ id: '1', title: 'YouTube' }]),
      } as any);

      const newSetConfig = jest.fn();
      const newSetInitialConfig = jest.fn();
      const newSetSnackbar = jest.fn();
      const newToken = 'new-token';
      const newConfig = { ...mockConfig, plexIP: '10.0.0.1', plexApiKey: 'test-key' };

      const configWithKey = { ...mockConfig, plexApiKey: 'original-key' };

      const { result, rerender } = renderHook(
        (props) => usePlexConnection(props),
        {
          initialProps: {
            token: mockToken,
            config: configWithKey,
            setConfig: mockSetConfig,
            setInitialConfig: mockSetInitialConfig,
            setSnackbar: mockSetSnackbar,
            hasPlexServerConfigured: true,
          },
        }
      );

      // Wait for initial check to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({
        token: newToken,
        config: newConfig,
        setConfig: newSetConfig,
        setInitialConfig: newSetInitialConfig,
        setSnackbar: newSetSnackbar,
        hasPlexServerConfigured: true,
      });

      await act(async () => {
        await result.current.testPlexConnection();
      });

      await waitFor(() => {
        expect(newSetInitialConfig).toHaveBeenCalled();
      });
      expect(newSetSnackbar).toHaveBeenCalled();

      expect(mockSetConfig).not.toHaveBeenCalled();
      expect(mockSetInitialConfig).not.toHaveBeenCalled();
      expect(mockSetSnackbar).not.toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[1]; // Second call is testPlexConnection
      expect(callArgs[1]?.headers).toEqual({
        'x-access-token': newToken,
      });

      const url = callArgs[0] as string;
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('testIP')).toBe('10.0.0.1');
    });
  });
});
