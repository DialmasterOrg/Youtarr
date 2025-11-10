import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Configuration from '../Configuration';
import { renderWithProviders } from '../../test-utils';
import React from 'react';

jest.mock('axios', () => ({
  post: jest.fn()
}));

const axios = require('axios');

// Set delay: null to make user interactions instant in tests
const createUser = () =>
  userEvent.setup({
    pointerEventsCheck: PointerEventsCheckLevel.Never,
    delay: null
  });

const setInputValue = async (
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string
) => {
  fireEvent.change(input, { target: { value } });
  await waitFor(() => expect(input).toHaveValue(value));
};

const buildMockResponse = <T,>(data: T, ok = true) => ({
  ok,
  json: () => Promise.resolve(data),
}) as unknown as Response;

const defaultCookieStatus = {
  cookiesEnabled: false,
  customCookiesUploaded: false,
  customFileExists: false,
};

type ConfigOverrides = Partial<typeof mockConfig> & {
  deploymentEnvironment?: {
    platform: string | null;
    isWsl: boolean;
  };
  isPlatformManaged?: {
    plexUrl: boolean;
    authEnabled: boolean;
    useTmpForDownloads: boolean;
  };
};

const primeInitialFetches = (
  configOverrides: ConfigOverrides = {},
  cookieStatusOverrides: Partial<typeof defaultCookieStatus> = {},
  additionalResponses: Array<{ data: unknown; ok?: boolean }> = [],
) => {
  const configResponse = { ...mockConfig, ...configOverrides };
  const cookieResponse = { ...defaultCookieStatus, ...cookieStatusOverrides };

  const mockFetch = global.fetch as jest.Mock;

  mockFetch
    .mockResolvedValueOnce(buildMockResponse(configResponse))
    .mockResolvedValueOnce(buildMockResponse(cookieResponse));

  additionalResponses.forEach(({ data, ok }) => {
    mockFetch.mockResolvedValueOnce(buildMockResponse(data, ok));
  });

  // Default any subsequent fetch calls to return empty arrays unless a test overrides them.
  mockFetch.mockResolvedValue(buildMockResponse([]));
};

jest.mock('../PlexLibrarySelector', () => {
  const React = require('react');

  const MockPlexLibrarySelector = ({ open, setLibraryId, handleClose }: any) => {
    React.useEffect(() => {
      if (!open) {
        return;
      }

      setLibraryId('mock-library', 'WSL Library');
      handleClose();
    }, [open, setLibraryId, handleClose]);

    return open ? <div data-testid="mock-plex-library-selector" /> : null;
  };

  return {
    __esModule: true,
    default: MockPlexLibrarySelector
  };
});

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@mui/material/useMediaQuery', () => jest.fn().mockReturnValue(false));

global.fetch = jest.fn() as jest.Mock;

const mockConfig = {
  channelAutoDownload: false,
  channelDownloadFrequency: '0 */4 * * *',
  channelFilesToDownload: 3,
  preferredResolution: '1080',
  videoCodec: 'default',
  initialSetup: false,
  plexApiKey: 'test-plex-key',
  youtubeOutputDirectory: '/videos',
  plexYoutubeLibraryId: 'lib-123',
  plexIP: '192.168.1.100',
  plexPort: '32400',
  uuid: 'uuid-123',
  sponsorblockEnabled: false,
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
};

describe('Configuration Component', () => {
  const mockToken = 'test-token';

const renderConfiguration = async ({
    token = mockToken,
    configOverrides = {},
    cookieOverrides = {},
    additionalFetchResponses = [],
  }: {
    token?: string | null;
    configOverrides?: ConfigOverrides;
    cookieOverrides?: Partial<typeof defaultCookieStatus>;
    additionalFetchResponses?: Array<{ data: unknown; ok?: boolean }>;
  } = {}) => {
    primeInitialFetches(configOverrides, cookieOverrides, additionalFetchResponses);
    renderWithProviders(<Configuration token={token} />);
    await screen.findByText('Core Settings');
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Component Loading and Rendering', () => {
    test('displays loading skeleton while fetching configuration', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(() => {})
      );

      renderWithProviders(<Configuration token={mockToken} />);

      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });

    test('fetches and displays configuration on mount', async () => {
      await renderConfiguration();

      expect(global.fetch).toHaveBeenCalledWith('/getconfig', {
        headers: { 'x-access-token': mockToken },
      });

      const outputDirInput = screen.getByRole('textbox', { name: /YouTube Output Directory/i });
      expect(outputDirInput).toHaveValue('/videos');
    });

    test('handles fetch error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    test('renders without token', async () => {
      await renderConfiguration({ token: null });

      expect(global.fetch).toHaveBeenCalledWith('/getconfig', {
        headers: { 'x-access-token': '' },
      });
    });
  });

  describe('Core Settings', () => {
    const setupComponent = async () => {
      await renderConfiguration();
    };

    test('YouTube output directory is always disabled', async () => {
      await setupComponent();
      const input = screen.getByRole('textbox', { name: /YouTube Output Directory/i });

      expect(input).toBeDisabled();
      expect(input).toHaveValue('/videos');
    });

    test('YouTube output directory shows environment variable helper text', async () => {
      await setupComponent();

      await screen.findByText(/Configured via YOUTUBE_OUTPUT_DIR environment variable/i);
    });

    test('toggles useTmpForDownloads checkbox', async () => {
      await setupComponent();
      const user = createUser();
      const checkbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });

      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    test('disables useTmpForDownloads when platform managed', async () => {
      await renderConfiguration({
        configOverrides: {
          useTmpForDownloads: true,
          isPlatformManaged: {
            plexUrl: false,
            authEnabled: true,
            useTmpForDownloads: true
          },
          deploymentEnvironment: {
            platform: 'elfhosted',
            isWsl: false
          }
        }
      });

      const checkbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });
      expect(checkbox).toBeDisabled();
      expect(checkbox).toBeChecked();

      const managedLabel = screen.getByText('Managed by Elfhosted');
      expect(managedLabel).toBeInTheDocument();
    });

    test('shows platform managed chip for generic platform', async () => {
      await renderConfiguration({
        configOverrides: {
          useTmpForDownloads: false,
          isPlatformManaged: {
            plexUrl: false,
            authEnabled: true,
            useTmpForDownloads: true
          },
          deploymentEnvironment: {
            platform: 'other-platform',
            isWsl: false
          }
        }
      });

      const checkbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });
      expect(checkbox).toBeDisabled();

      const managedLabel = screen.getByText('Platform Managed');
      expect(managedLabel).toBeInTheDocument();
    });

    test('toggles automatic downloads', async () => {
      await setupComponent();
      const user = createUser();
      const checkbox = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });

      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    test('changes download frequency', async () => {
      await setupComponent();
      const user = createUser();

      const checkbox = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });
      await user.click(checkbox);

      // Wait for the select to be enabled after checkbox is checked
      await screen.findAllByText('Download Frequency');

      // MUI Select renders as a div with role="button"
      const frequencySelect = screen.getByRole('button', { name: /Every 4 hours/i });
      await user.click(frequencySelect);

      // Wait for menu to open and click option
      const dailyOption = await screen.findByRole('option', { name: 'Daily' });
      await user.click(dailyOption);

      // Verify the selection was made
      await screen.findByRole('button', { name: /Daily/i });
    });

    test('changes files to download per channel', async () => {
      await setupComponent();
      const user = createUser();

      // MUI Select renders as a div with role="button" showing current value
      const selectButton = screen.getByRole('button', { name: /3 videos/i });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: '5 videos' });
      await user.click(option);

      await screen.findByRole('button', { name: /5 videos/i });
    });

    test('changes preferred resolution', async () => {
      await setupComponent();
      const user = createUser();

      // MUI Select renders as a div with role="button" showing current value
      const selectButton = screen.getByRole('button', { name: /1080p/i });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: '4K (2160p)' });
      await user.click(option);

      await screen.findByRole('button', { name: /4K \(2160p\)/i });
    });

    test('changes preferred video codec', async () => {
      await setupComponent();
      const user = createUser();

      // MUI Select renders as a div with role="button" showing current value
      const selectButton = screen.getByRole('button', { name: /Default \(No Preference\)/i });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: 'H.264/AVC (Best Compatibility)' });
      await user.click(option);

      await screen.findByRole('button', { name: /H\.264\/AVC \(Best Compatibility\)/i });
    });

    test('changes preferred video codec to H.265', async () => {
      await setupComponent();
      const user = createUser();

      // MUI Select renders as a div with role="button" showing current value
      const selectButton = screen.getByRole('button', { name: /Default \(No Preference\)/i });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: 'H.265/HEVC (Balanced)' });
      await user.click(option);

      await screen.findByRole('button', { name: /H\.265\/HEVC \(Balanced\)/i });
    });
  });

  describe('Plex Integration', () => {
    const setupComponent = async (configOverrides: ConfigOverrides = {}) => {
      await renderConfiguration({ configOverrides });
    };

    test('expands Plex accordion and shows configuration', async () => {
      await setupComponent();
      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      fireEvent.click(accordion);

      await screen.findByText('Completely Optional Plex Integration');

      const plexIpInput = screen.getByRole('textbox', { name: /Plex Server IP/i });
      expect(plexIpInput).toHaveValue('192.168.1.100');

      const plexPortInput = screen.getByRole('spinbutton', { name: /Plex Port/i });
      expect(plexPortInput).toHaveValue(32400);
    });

    test('keeps Plex actions enabled when platform manages Plex URL', async () => {
      const platformManagedConfig = {
        ...mockConfig,
        plexIP: '',
        plexPort: '32400',
        isPlatformManaged: {
          youtubeOutputDirectory: false,
          plexUrl: true,
          authEnabled: true,
          useTmpForDownloads: false,
        },
      };

      await setupComponent(platformManagedConfig);

      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      fireEvent.click(accordion);

      const testButton = await screen.findByRole('button', { name: /^Test Connection$/i });
      expect(testButton).not.toBeDisabled();

      const plexPortInput = await screen.findByRole('spinbutton', { name: /Plex Port/i });
      expect(plexPortInput).toBeDisabled();
    });

    test('tests Plex connection successfully', async () => {
      await setupComponent();
      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      fireEvent.click(accordion);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { key: '1', title: 'Library 1' },
          { key: '2', title: 'Library 2' },
        ]),
      } as Response);

      const testButtons = await screen.findAllByRole('button', { name: /^Test Connection$/i });
      fireEvent.click(testButtons[0]);

      await screen.findByText(/Plex connection successful/i);

      const calls = (global.fetch as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toContain('testIP=192.168.1.100');
      expect(lastCall[0]).toContain('testPort=32400');
    });

    test('handles failed Plex connection test', async () => {
      await setupComponent();
      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      fireEvent.click(accordion);

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const testButtons = await screen.findAllByRole('button', { name: /^Test Connection$/i });
      fireEvent.click(testButtons[0]);

      await screen.findByText(/Failed to connect to Plex server/i);
    });

    test('opens library selector when connected', async () => {
      await setupComponent();
      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      fireEvent.click(accordion);

      (global.fetch as jest.Mock).mockResolvedValueOnce(buildMockResponse([
        { key: '1', title: 'Library 1' },
      ]));

      const testButtons = await screen.findAllByRole('button', { name: /^Test Connection$/i });
      fireEvent.click(testButtons[0]);

      await screen.findByText(/Plex connection successful/i);

      const selectLibraryButton = screen.getByRole('button', { name: /Select Plex Library/i });
      expect(selectLibraryButton).not.toBeDisabled();
    });

  });

  describe('SponsorBlock Settings', () => {
    const setupComponent = async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');
    };

    test('toggles SponsorBlock and configures settings', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Optional: SponsorBlock Integration');
      await user.click(accordion);

      const enableCheckbox = screen.getByRole('checkbox', { name: /Enable SponsorBlock/i });
      await user.click(enableCheckbox);

      await screen.findAllByText('Action for Segments');

      // MUI Select renders as a button showing current value
      const actionSelect = screen.getByRole('button', { name: /Remove segments from video/i });
      await user.click(actionSelect);

      const markOption = await screen.findByRole('option', { name: 'Mark segments as chapters' });
      await user.click(markOption);

      await screen.findByRole('button', { name: /Mark segments as chapters/i });
    });

    test('configures SponsorBlock categories', async () => {
      jest.useFakeTimers();

      await renderConfiguration({
        configOverrides: {
          sponsorblockEnabled: true,
          sponsorblockCategories: {
            ...mockConfig.sponsorblockCategories,
            intro: false,
          },
        },
      });

      try {
        const accordion = screen.getByText('Optional: SponsorBlock Integration');
        fireEvent.click(accordion);

        await act(async () => {
          jest.runOnlyPendingTimers();
        });

        const introCheckbox = screen.getByRole('checkbox', { name: /Intro/i });
        expect(introCheckbox).not.toBeChecked();

        fireEvent.click(introCheckbox);
        expect(introCheckbox).toBeChecked();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Cookie Configuration', () => {
    const setupComponent = async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');
    };

    test('toggles cookies and shows upload button', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Cookie Configuration');
      await user.click(accordion);

      const enableSwitch = screen.getByRole('checkbox', { name: /Enable Cookies/i });
      await user.click(enableSwitch);

      await screen.findByText('Upload Cookie File');
    });

    test('handles cookie deletion', async () => {
      const configWithCookies = { ...mockConfig, customCookiesUploaded: true };

      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(configWithCookies),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: true,
            customCookiesUploaded: true,
            customFileExists: true,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');

      const user = createUser();
      const accordion = screen.getByText('Cookie Configuration');
      await user.click(accordion);

      const enableSwitch = screen.getByRole('checkbox', { name: /Enable Cookies/i });
      await user.click(enableSwitch);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          cookieStatus: {
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          },
        }),
      } as Response);

      const deleteButton = await screen.findByText('Delete Custom Cookies');
      await user.click(deleteButton);

      await screen.findByText('Custom cookies deleted');
    });
  });

  describe('Download Performance Settings', () => {
    const setupComponent = async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');
    };

    test('configures download performance settings', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Download Performance Settings');
      await user.click(accordion);

      await screen.findAllByText('Socket Timeout');

      // MUI Select renders as a button showing current value
      const timeoutSelect = screen.getByRole('button', { name: /30 seconds/i });
      await user.click(timeoutSelect);

      const option = await screen.findByRole('option', { name: '10 seconds' });
      await user.click(option);

      await screen.findByRole('button', { name: /10 seconds/i });
    });

    test('toggles and configures stall detection', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Download Performance Settings');
      await user.click(accordion);

      const stallDetectionSwitch = screen.getByRole('checkbox', { name: /Enable Stall Detection/i });
      expect(stallDetectionSwitch).toBeChecked();

      await user.click(stallDetectionSwitch);
      expect(stallDetectionSwitch).not.toBeChecked();

      await user.click(stallDetectionSwitch);
      expect(stallDetectionSwitch).toBeChecked();

      const windowInput = await screen.findByLabelText('Stall Detection Window (seconds)');
      expect(windowInput).toHaveValue(30);
    });
  });

  describe('Kodi/Emby/Jellyfin Compatibility', () => {
    const setupComponent = async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');
    };

    test('toggles NFO file generation', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Optional: Kodi, Emby and Jellyfin compatibility');
      await user.click(accordion);

      const nfoSwitch = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      expect(nfoSwitch).toBeChecked();

      await user.click(nfoSwitch);
      expect(nfoSwitch).not.toBeChecked();
    });

    test('toggles channel poster generation', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Optional: Kodi, Emby and Jellyfin compatibility');
      await user.click(accordion);

      const posterSwitch = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });
      expect(posterSwitch).toBeChecked();

      await user.click(posterSwitch);
      expect(posterSwitch).not.toBeChecked();
    });
  });

  describe('Notifications', () => {
    test('shows notifications accordion and toggles settings', async () => {
      await renderConfiguration();
      const user = createUser();

      const accordion = screen.getByText('Optional: Notifications');
      expect(accordion).toBeInTheDocument();

      await user.click(accordion);

      const enableSwitch = screen.getByRole('checkbox', { name: /Enable Notifications/i });
      expect(enableSwitch).not.toBeChecked();

      await user.click(enableSwitch);
      expect(enableSwitch).toBeChecked();

      const webhookInput = await screen.findByRole('textbox', { name: /Discord Webhook URL/i });
      expect(webhookInput).toBeInTheDocument();
      expect(webhookInput).toHaveValue('');

      fireEvent.change(webhookInput, { target: { value: 'https://discord.com/api/webhooks/123/test' } });
      expect(webhookInput).toHaveValue('https://discord.com/api/webhooks/123/test');
    });

    test('shows enabled chip when notifications are configured', async () => {
      const enabledConfig = { ...mockConfig, notificationsEnabled: true, discordWebhookUrl: 'https://discord.com/api/webhooks/test' };
      await renderConfiguration({ configOverrides: enabledConfig });

      const enabledChip = screen.getByText('Enabled');
      expect(enabledChip).toBeInTheDocument();
    });

    test('validates webhook URL before sending test notification', async () => {
      await renderConfiguration();
      const user = createUser();

      const accordion = screen.getByText('Optional: Notifications');
      await user.click(accordion);

      const enableSwitch = screen.getByRole('checkbox', { name: /Enable Notifications/i });
      await user.click(enableSwitch);

      const testButton = await screen.findByRole('button', { name: /Send Test Notification/i });
      await user.click(testButton);

      await screen.findByText('Please enter a Discord webhook URL first');
    });

    test('sends test notification successfully', async () => {
      await renderConfiguration();
      const user = createUser();

      const accordion = screen.getByText('Optional: Notifications');
      await user.click(accordion);

      const enableSwitch = screen.getByRole('checkbox', { name: /Enable Notifications/i });
      await user.click(enableSwitch);

      const webhookInput = await screen.findByRole('textbox', { name: /Discord Webhook URL/i });
      fireEvent.change(webhookInput, { target: { value: 'https://discord.com/api/webhooks/123/test' } });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ success: true })
      } as unknown as Response);

      const testButton = screen.getByRole('button', { name: /Send Test Notification/i });
      await user.click(testButton);

      await screen.findByText('Test notification sent! Check your Discord channel.');

      const calls = (global.fetch as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe('/api/notifications/test');
      expect(lastCall[1]).toMatchObject({
        method: 'POST',
        headers: {
          'x-access-token': mockToken,
        },
      });
    });

    test('handles test notification errors', async () => {
      await renderConfiguration();
      const user = createUser();

      const accordion = screen.getByText('Optional: Notifications');
      await user.click(accordion);

      const enableSwitch = screen.getByRole('checkbox', { name: /Enable Notifications/i });
      await user.click(enableSwitch);

      const webhookInput = await screen.findByRole('textbox', { name: /Discord Webhook URL/i });
      fireEvent.change(webhookInput, { target: { value: 'https://discord.com/api/webhooks/123/test' } });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValueOnce({ message: 'Invalid webhook URL' })
      } as unknown as Response);

      const testButton = screen.getByRole('button', { name: /Send Test Notification/i });
      await user.click(testButton);

      await screen.findByText('Invalid webhook URL');
    });
  });

  describe('Password Change', () => {
    const setupComponent = async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');
    };

    test('shows and hides password change form', async () => {
      await setupComponent();
      const user = createUser();

      // First, verify the button exists and is not showing the form
      const changePasswordButton = await screen.findByRole('button', { name: 'Change Password' });
      expect(changePasswordButton).toBeInTheDocument();

      // Initially, password fields should not be visible
      expect(screen.queryByLabelText(/Current Password/i)).not.toBeInTheDocument();

      // Click the button to show the form
      await user.click(changePasswordButton);

      // Wait for form to render
      await screen.findByLabelText(/Current Password/i);

      // Check that all three password fields are visible
      const passwordFields = screen.getAllByLabelText(/password/i);
      expect(passwordFields).toHaveLength(3); // Current, New, and Confirm New

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      await waitFor(() => expect(screen.queryByLabelText(/Current Password/i)).not.toBeInTheDocument(), { timeout: 500 });
    });

    test('validates password requirements', async () => {
      await setupComponent();
      const user = createUser();

      const changePasswordButton = await screen.findByRole('button', { name: 'Change Password' });
      await user.click(changePasswordButton);

      await screen.findByLabelText(/Current Password/i);

      axios.post.mockResolvedValueOnce({ data: { success: true } });

      // Get all password fields and identify them by order
      const passwordFields = screen.getAllByLabelText(/password/i) as HTMLInputElement[];
      const currentPasswordInput = passwordFields[0]; // Current Password
      const newPasswordInput = passwordFields[1]; // New Password
      const confirmPasswordInput = passwordFields[2]; // Confirm New Password

      await setInputValue(currentPasswordInput, 'oldpass');
      await setInputValue(newPasswordInput, 'short');
      await setInputValue(confirmPasswordInput, 'short');

      const updateButton = screen.getByRole('button', { name: 'Update Password' });
      await user.click(updateButton);

      await screen.findByText('Password must be at least 8 characters');
    });

    test('handles password mismatch', async () => {
      await setupComponent();
      const user = createUser();

      const changePasswordButton = await screen.findByRole('button', { name: 'Change Password' });
      await user.click(changePasswordButton);

      await screen.findByLabelText(/Current Password/i);

      // Get all password fields and identify them by order
      const passwordFields = screen.getAllByLabelText(/password/i) as HTMLInputElement[];
      const currentPasswordInput = passwordFields[0]; // Current Password
      const newPasswordInput = passwordFields[1]; // New Password
      const confirmPasswordInput = passwordFields[2]; // Confirm New Password

      await setInputValue(currentPasswordInput, 'oldpassword');
      await setInputValue(newPasswordInput, 'newpassword123');
      await setInputValue(confirmPasswordInput, 'different123');

      const updateButton = screen.getByRole('button', { name: 'Update Password' });
      await user.click(updateButton);

      await screen.findByText('Passwords do not match');
    }, 10000);

    test('successfully changes password', async () => {
      await setupComponent();
      const user = createUser();

      const changePasswordButton = await screen.findByRole('button', { name: 'Change Password' });
      await user.click(changePasswordButton);

      await screen.findByLabelText(/Current Password/i);

      axios.post.mockResolvedValueOnce({ data: { success: true } });

      // Get all password fields and identify them by order
      const passwordFields = screen.getAllByLabelText(/password/i) as HTMLInputElement[];
      const currentPasswordInput = passwordFields[0]; // Current Password
      const newPasswordInput = passwordFields[1]; // New Password
      const confirmPasswordInput = passwordFields[2]; // Confirm New Password

      await setInputValue(currentPasswordInput, 'oldpassword');
      await setInputValue(newPasswordInput, 'newpassword123');
      await setInputValue(confirmPasswordInput, 'newpassword123');

      const updateButton = screen.getByRole('button', { name: 'Update Password' });
      await user.click(updateButton);

      await screen.findByText('Password updated successfully');

      expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument();
    });
  });

  describe('Save Configuration', () => {
    const setupComponent = async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');
    };

    test('saves configuration successfully', async () => {
      await setupComponent();
      const user = createUser();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      const saveButton = screen.getByRole('button', { name: /Save Configuration/i });
      await user.click(saveButton);

      await screen.findByText('Configuration saved successfully');

      expect(global.fetch).toHaveBeenCalledWith('/updateconfig', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': mockToken,
        },
        body: expect.any(String),
      }));
    });

    test('shows unsaved changes indicator', async () => {
      await setupComponent();
      const user = createUser();

      const checkbox = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });
      await user.click(checkbox);

      await screen.findByRole('button', { name: /Save Configuration \(Unsaved Changes\)/i });
    });

    test('tracks useTmpForDownloads in unsaved changes', async () => {
      await setupComponent();
      const user = createUser();

      const checkbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });
      await user.click(checkbox);

      await screen.findByRole('button', { name: /Save Configuration \(Unsaved Changes\)/i });
    });

    test('saves useTmpForDownloads setting', async () => {
      await setupComponent();
      const user = createUser();

      const checkbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });
      await user.click(checkbox);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      const saveButton = screen.getByRole('button', { name: /Save Configuration/i });
      await user.click(saveButton);

      await screen.findByText('Configuration saved successfully');

      const calls = (global.fetch as jest.Mock).mock.calls;
      const saveCall = calls.find(call => call[0] === '/updateconfig');
      expect(saveCall).toBeDefined();

      const requestBody = JSON.parse(saveCall[1].body);
      expect(requestBody.useTmpForDownloads).toBe(true);
    });

    test('does not show restart warning after saving configuration', async () => {
      await setupComponent();
      const user = createUser();

      const checkbox = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });
      await user.click(checkbox);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      const saveButton = screen.getByRole('button', { name: /Save Configuration/i });
      await user.click(saveButton);

      await screen.findByText('Configuration saved successfully');

      // Verify no YouTube directory restart warning appears
      expect(screen.queryByText(/Please restart Youtarr for YouTube directory changes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/RESTART REQUIRED.*Directory has been changed/i)).not.toBeInTheDocument();
    });


    test('shows confirmation dialog for initial setup', async () => {
      const configWithInitialSetup = { ...mockConfig, initialSetup: true };

      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(configWithInitialSetup),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');

      const user = createUser();
      const saveButton = screen.getByRole('button', { name: /Save Configuration/i });
      await user.click(saveButton);

      await screen.findByText('Confirm Save Configuration');

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      await waitFor(() => expect(screen.queryByText('Confirm Save Configuration')).not.toBeInTheDocument(), { timeout: 500 });
    });

    test('handles save configuration error', async () => {
      await setupComponent();
      const user = createUser();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Save failed' }),
      } as Response);

      const saveButton = screen.getByRole('button', { name: /Save Configuration/i });
      await user.click(saveButton);

      await screen.findByText('Failed to save configuration');
    });
  });

  describe('Platform-specific Features', () => {
    test('shows platform managed indicators for Elfhosted', async () => {
      const platformManagedConfig = {
        ...mockConfig,
        isPlatformManaged: {
          plexUrl: true,
          authEnabled: true,
          useTmpForDownloads: false,
        },
        deploymentEnvironment: {
          platform: 'elfhosted',
          isWsl: false,
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(platformManagedConfig),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');

      // Elfhosted should show special helper text
      await screen.findByText(/This path is configured by your platform deployment/i);

      const outputDirInput = screen.getByRole('textbox', { name: /YouTube Output Directory/i });
      expect(outputDirInput).toBeDisabled();
    });


    test('shows Docker volume indicator', async () => {
      const dockerConfig = {
        ...mockConfig,
        deploymentEnvironment: {
          platform: null,
          isWsl: false,
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(dockerConfig),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');

      // Docker Volume chip should always show for non-Elfhosted deployments
      const dockerLabels = screen.getAllByText('Docker Volume');
      expect(dockerLabels.length).toBeGreaterThan(0);

      const outputDirInput = screen.getByRole('textbox', { name: /YouTube Output Directory/i });
      expect(outputDirInput).toBeDisabled();
    });
  });

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      const useMediaQuery = require('@mui/material/useMediaQuery');
      useMediaQuery.mockReturnValue(true);
    });

    test('handles mobile tooltip interactions', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      renderWithProviders(<Configuration token={mockToken} />);

      await screen.findByText('Core Settings');

      const user = createUser();

      const infoButtons = screen.queryAllByTestId('InfoIcon');
      expect(infoButtons.length).toBeGreaterThan(0);

      await user.click(infoButtons[0]);

      await screen.findByRole('alert');
    });
  });
});
