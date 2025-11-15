import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useConfigSave } from '../useConfigSave';
import { ConfigState } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('useConfigSave', () => {
  const mockToken = 'test-token-123';
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

  const mockSetInitialConfig = jest.fn();
  const mockSetSnackbar = jest.fn();
  const mockCheckPlexConnection = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('returns saveConfig function', () => {
      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      expect(result.current.saveConfig).toBeDefined();
      expect(typeof result.current.saveConfig).toBe('function');
    });

    test('works with null token', () => {
      const { result } = renderHook(() =>
        useConfigSave({
          token: null,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      expect(result.current.saveConfig).toBeDefined();
      expect(typeof result.current.saveConfig).toBe('function');
    });
  });

  describe('Successful Configuration Save', () => {
    test('makes fetch request with correct parameters', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/updateconfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': mockToken,
        },
        body: JSON.stringify(mockConfig),
      });
    });

    test('uses empty string for token when null', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: null,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]?.headers).toEqual({
        'Content-Type': 'application/json',
        'x-access-token': '',
      });
    });

    test('updates initial config on successful save', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockSetInitialConfig).toHaveBeenCalledTimes(1);
      });
      expect(mockSetInitialConfig).toHaveBeenCalledWith(mockConfig);
    });

    test('displays success snackbar on successful save', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });
      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Configuration saved successfully',
        severity: 'success',
      });
    });

    test('calls checkPlexConnection when Plex is configured', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockCheckPlexConnection).toHaveBeenCalledTimes(1);
      });
    });

    test('does not call checkPlexConnection when Plex is not configured', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockSetInitialConfig).toHaveBeenCalledTimes(1);
      });

      expect(mockCheckPlexConnection).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('displays error snackbar when response is not ok', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({ error: 'Internal server error' }),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });
      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Failed to save configuration',
        severity: 'error',
      });
    });

    test('does not update initial config on error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({ error: 'Internal server error' }),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });

      expect(mockSetInitialConfig).not.toHaveBeenCalled();
    });

    test('does not call checkPlexConnection on error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({ error: 'Internal server error' }),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });

      expect(mockCheckPlexConnection).not.toHaveBeenCalled();
    });

    test('handles network error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });
      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Failed to save configuration',
        severity: 'error',
      });
    });

    test('handles 401 Unauthorized error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValueOnce({ error: 'Unauthorized' }),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalled();
      });
      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Failed to save configuration',
        severity: 'error',
      });
    });

    test('handles 403 Forbidden error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValueOnce({ error: 'Access forbidden' }),
      } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalled();
      });
      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Failed to save configuration',
        severity: 'error',
      });
    });
  });

  describe('Different Configuration Scenarios', () => {
    test('saves configuration with Plex enabled', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const plexConfig: ConfigState = {
        ...mockConfig,
        plexApiKey: 'plex-key-123',
        plexIP: '192.168.1.100',
        plexPort: '32400',
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: plexConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.plexApiKey).toBe('plex-key-123');
      expect(callBody.plexIP).toBe('192.168.1.100');
      expect(callBody.plexPort).toBe('32400');

      await waitFor(() => {
        expect(mockCheckPlexConnection).toHaveBeenCalledTimes(1);
      });
    });

    test('saves configuration with SponsorBlock enabled', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const sponsorBlockConfig: ConfigState = {
        ...mockConfig,
        sponsorblockEnabled: true,
        sponsorblockAction: 'mark',
        sponsorblockCategories: {
          sponsor: true,
          intro: true,
          outro: true,
          selfpromo: false,
          preview: false,
          filler: true,
          interaction: false,
          music_offtopic: false,
        },
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: sponsorBlockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.sponsorblockEnabled).toBe(true);
      expect(callBody.sponsorblockAction).toBe('mark');
      expect(callBody.sponsorblockCategories.sponsor).toBe(true);
      expect(callBody.sponsorblockCategories.intro).toBe(true);
      expect(callBody.sponsorblockCategories.filler).toBe(true);
    });

    test('saves configuration with auto removal enabled', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const autoRemovalConfig: ConfigState = {
        ...mockConfig,
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: '10',
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: autoRemovalConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.autoRemovalEnabled).toBe(true);
      expect(callBody.autoRemovalVideoAgeThreshold).toBe('30');
      expect(callBody.autoRemovalFreeSpaceThreshold).toBe('10');
    });

    test('saves configuration with cookies enabled', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const cookiesConfig: ConfigState = {
        ...mockConfig,
        cookiesEnabled: true,
        customCookiesUploaded: true,
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: cookiesConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.cookiesEnabled).toBe(true);
      expect(callBody.customCookiesUploaded).toBe(true);
    });

    test('saves configuration with notifications enabled', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const notificationsConfig: ConfigState = {
        ...mockConfig,
        notificationsEnabled: true,
        notificationService: 'discord',
        discordWebhookUrl: 'https://discord.com/api/webhooks/123',
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: notificationsConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.notificationsEnabled).toBe(true);
      expect(callBody.notificationService).toBe('discord');
      expect(callBody.discordWebhookUrl).toBe('https://discord.com/api/webhooks/123');
    });

    test('saves configuration with subtitles enabled', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const subtitlesConfig: ConfigState = {
        ...mockConfig,
        subtitlesEnabled: true,
        subtitleLanguage: 'es',
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: subtitlesConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.subtitlesEnabled).toBe(true);
      expect(callBody.subtitleLanguage).toBe('es');
    });
  });

  describe('Hook Stability', () => {
    test('saveConfig function reference remains stable', () => {
      const { result, rerender } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      const firstRef = result.current.saveConfig;

      rerender();

      const secondRef = result.current.saveConfig;

      expect(firstRef).toBe(secondRef);
    });

    test('saveConfig updates when token changes', () => {
      const { result, rerender } = renderHook(
        ({ token }) =>
          useConfigSave({
            token,
            config: mockConfig,
            setInitialConfig: mockSetInitialConfig,
            setSnackbar: mockSetSnackbar,
            hasPlexServerConfigured: false,
            checkPlexConnection: mockCheckPlexConnection,
          }),
        { initialProps: { token: 'token-1' } }
      );

      const firstRef = result.current.saveConfig;

      rerender({ token: 'token-2' });

      const secondRef = result.current.saveConfig;

      // The function reference should change when token changes
      expect(firstRef).not.toBe(secondRef);
    });

    test('saveConfig updates when config changes', () => {
      const { result, rerender } = renderHook(
        ({ config }) =>
          useConfigSave({
            token: mockToken,
            config,
            setInitialConfig: mockSetInitialConfig,
            setSnackbar: mockSetSnackbar,
            hasPlexServerConfigured: false,
            checkPlexConnection: mockCheckPlexConnection,
          }),
        { initialProps: { config: mockConfig } }
      );

      const firstRef = result.current.saveConfig;

      const updatedConfig = { ...mockConfig, plexIP: '192.168.1.200' };
      rerender({ config: updatedConfig });

      const secondRef = result.current.saveConfig;

      // The function reference should change when config changes
      expect(firstRef).not.toBe(secondRef);
    });

    test('saveConfig updates when hasPlexServerConfigured changes', () => {
      const { result, rerender } = renderHook(
        ({ hasPlexServerConfigured }) =>
          useConfigSave({
            token: mockToken,
            config: mockConfig,
            setInitialConfig: mockSetInitialConfig,
            setSnackbar: mockSetSnackbar,
            hasPlexServerConfigured,
            checkPlexConnection: mockCheckPlexConnection,
          }),
        { initialProps: { hasPlexServerConfigured: false } }
      );

      const firstRef = result.current.saveConfig;

      rerender({ hasPlexServerConfigured: true });

      const secondRef = result.current.saveConfig;

      // The function reference should change when hasPlexServerConfigured changes
      expect(firstRef).not.toBe(secondRef);
    });

    test('can be called multiple times sequentially', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({}),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({}),
        } as any);

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: mockConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();
      await result.current.saveConfig();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string values in config', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const emptyConfig: ConfigState = {
        ...mockConfig,
        plexApiKey: '',
        discordWebhookUrl: '',
        autoRemovalFreeSpaceThreshold: '',
        autoRemovalVideoAgeThreshold: '',
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: emptyConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.plexApiKey).toBe('');
      expect(callBody.discordWebhookUrl).toBe('');
      expect(callBody.autoRemovalFreeSpaceThreshold).toBe('');
      expect(callBody.autoRemovalVideoAgeThreshold).toBe('');
    });

    test('handles numeric values in config', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const numericConfig: ConfigState = {
        ...mockConfig,
        channelFilesToDownload: 10,
        downloadSocketTimeoutSeconds: 60,
        downloadRetryCount: 5,
        stallDetectionWindowSeconds: 45,
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: numericConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.channelFilesToDownload).toBe(10);
      expect(callBody.downloadSocketTimeoutSeconds).toBe(60);
      expect(callBody.downloadRetryCount).toBe(5);
      expect(callBody.stallDetectionWindowSeconds).toBe(45);
    });

    test('handles boolean values in config', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const booleanConfig: ConfigState = {
        ...mockConfig,
        channelAutoDownload: true,
        plexViaHttps: true,
        sponsorblockEnabled: false,
        enableStallDetection: false,
        cookiesEnabled: true,
        writeChannelPosters: false,
        writeVideoNfoFiles: false,
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: booleanConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.channelAutoDownload).toBe(true);
      expect(callBody.plexViaHttps).toBe(true);
      expect(callBody.sponsorblockEnabled).toBe(false);
      expect(callBody.enableStallDetection).toBe(false);
      expect(callBody.cookiesEnabled).toBe(true);
      expect(callBody.writeChannelPosters).toBe(false);
      expect(callBody.writeVideoNfoFiles).toBe(false);
    });

    test('handles Plex HTTPS configuration', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const httpsConfig: ConfigState = {
        ...mockConfig,
        plexViaHttps: true,
        plexIP: 'plex.example.com',
        plexPort: '443',
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: httpsConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: true,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.plexViaHttps).toBe(true);
      expect(callBody.plexIP).toBe('plex.example.com');
      expect(callBody.plexPort).toBe('443');
    });

    test('handles different video codec settings', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const codecConfig: ConfigState = {
        ...mockConfig,
        videoCodec: 'h264',
        preferredResolution: '4320',
      };

      const { result } = renderHook(() =>
        useConfigSave({
          token: mockToken,
          config: codecConfig,
          setInitialConfig: mockSetInitialConfig,
          setSnackbar: mockSetSnackbar,
          hasPlexServerConfigured: false,
          checkPlexConnection: mockCheckPlexConnection,
        })
      );

      await result.current.saveConfig();

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.videoCodec).toBe('h264');
      expect(callBody.preferredResolution).toBe('4320');
    });
  });

  describe('Callback Dependencies', () => {
    test('includes all dependencies in useCallback', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const newSetInitialConfig = jest.fn();
      const newSetSnackbar = jest.fn();
      const newCheckPlexConnection = jest.fn();
      const newToken = 'new-token';
      const newConfig = { ...mockConfig, plexIP: '10.0.0.1' };

      const { result, rerender } = renderHook(
        (props) => useConfigSave(props),
        {
          initialProps: {
            token: mockToken,
            config: mockConfig,
            setInitialConfig: mockSetInitialConfig,
            setSnackbar: mockSetSnackbar,
            hasPlexServerConfigured: false,
            checkPlexConnection: mockCheckPlexConnection,
          },
        }
      );

      rerender({
        token: newToken,
        config: newConfig,
        setInitialConfig: newSetInitialConfig,
        setSnackbar: newSetSnackbar,
        hasPlexServerConfigured: true,
        checkPlexConnection: newCheckPlexConnection,
      });

      await result.current.saveConfig();

      // Verify new callbacks were used
      await waitFor(() => {
        expect(newSetInitialConfig).toHaveBeenCalled();
      });
      expect(newSetInitialConfig).toHaveBeenCalledWith(newConfig);
      expect(newSetSnackbar).toHaveBeenCalled();
      expect(newCheckPlexConnection).toHaveBeenCalled();

      // Verify old callbacks were not used
      expect(mockSetInitialConfig).not.toHaveBeenCalled();
      expect(mockSetSnackbar).not.toHaveBeenCalled();
      expect(mockCheckPlexConnection).not.toHaveBeenCalled();

      // Verify new token was used
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]?.headers).toEqual({
        'Content-Type': 'application/json',
        'x-access-token': newToken,
      });

      // Verify new config was sent
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.plexIP).toBe('10.0.0.1');
    });
  });
});
