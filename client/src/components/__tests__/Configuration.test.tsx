import { screen, waitFor } from '@testing-library/react';
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
    inDocker: boolean;
    dockerAutoCreated: boolean;
    platform: string | null;
    isWsl: boolean;
  };
  isPlatformManaged?: {
    youtubeOutputDirectory: boolean;
    plexUrl: boolean;
    authEnabled: boolean;
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

jest.mock('../PlexLibrarySelector', () => ({
  __esModule: true,
  default: ({ open, setLibraryId, handleClose }: any) => {
    if (!open) {
      return null;
    }

    return (
      <div>
        <button
          type="button"
          onClick={() =>
            setLibraryId({
              libraryId: 'mock-library',
              libraryTitle: 'WSL Library',
              selectedPath: 'Q:\\Youtube_test'
            })
          }
        >
          Mock Save Selection
        </button>
        <button type="button" onClick={handleClose}>
          Mock Close
        </button>
      </div>
    );
  }
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@mui/material/useMediaQuery', () => jest.fn().mockReturnValue(false));

jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({
    breakpoints: { down: () => false },
  }),
}));

global.fetch = jest.fn() as jest.Mock;

const mockConfig = {
  channelAutoDownload: false,
  channelDownloadFrequency: '0 */4 * * *',
  channelFilesToDownload: 3,
  preferredResolution: '1080',
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

    test('updates YouTube output directory', async () => {
      await setupComponent();
      const user = createUser();
      const input = screen.getByRole('textbox', { name: /YouTube Output Directory/i });

      await user.clear(input);
      await user.type(input, '/new/path');

      expect(input).toHaveValue('/new/path');
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
  });

  describe('Plex Integration', () => {
    const setupComponent = async (configOverrides: ConfigOverrides = {}) => {
      await renderConfiguration({ configOverrides });
    };

    test('expands Plex accordion and shows configuration', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      await user.click(accordion);

      await screen.findByText('Plex Integration is Optional');

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
        },
      };

      await setupComponent(platformManagedConfig);

      const user = createUser();
      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      await user.click(accordion);

      const testButton = await screen.findByRole('button', { name: /^Test Connection$/i });
      expect(testButton).not.toBeDisabled();

      const plexPortInput = await screen.findByRole('spinbutton', { name: /Plex Port/i });
      expect(plexPortInput).toBeDisabled();
    });

    test('tests Plex connection successfully', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      await user.click(accordion);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { key: '1', title: 'Library 1' },
          { key: '2', title: 'Library 2' },
        ]),
      } as Response);

      const testButtons = await screen.findAllByRole('button', { name: /^Test Connection$/i });
      await user.click(testButtons[0]);

      await screen.findByText(/Plex connection successful/i);

      const calls = (global.fetch as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toContain('testIP=192.168.1.100');
      expect(lastCall[0]).toContain('testPort=32400');
    });

    test('handles failed Plex connection test', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      await user.click(accordion);

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const testButtons = await screen.findAllByRole('button', { name: /^Test Connection$/i });
      await user.click(testButtons[0]);

      await screen.findByText(/Failed to connect to Plex server/i);
    });

    test('opens library selector when connected', async () => {
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      await user.click(accordion);

      (global.fetch as jest.Mock).mockResolvedValueOnce(buildMockResponse([
        { key: '1', title: 'Library 1' },
      ]));

      const testButtons = await screen.findAllByRole('button', { name: /^Test Connection$/i });
      await user.click(testButtons[0]);

      await screen.findByText(/Plex connection successful/i);

      const selectLibraryButton = screen.getByRole('button', { name: /Select Plex Library/i });
      expect(selectLibraryButton).not.toBeDisabled();
    });

    test('suggests translated path for WSL when selecting Plex library', async () => {
      await renderConfiguration({
        configOverrides: {
          deploymentEnvironment: {
            inDocker: false,
            dockerAutoCreated: false,
            platform: null,
            isWsl: true,
          },
        },
        additionalFetchResponses: [
          { data: [
            {
              key: '1',
              title: 'WSL Library',
            },
          ] },
        ],
      });

      const user = createUser();

      const accordion = screen.getByText('Optional: Plex Media Server Integration');
      await user.click(accordion);

      const selectLibraryButton = await screen.findByRole('button', { name: /Select Plex Library/i });

      await waitFor(() => expect(selectLibraryButton).not.toBeDisabled(), { timeout: 500 });

      await user.click(selectLibraryButton);

      const mockSaveButton = await screen.findByRole('button', { name: /Mock Save Selection/i });
      await user.click(mockSaveButton);

      await screen.findByText(/reports its media path as/i);

      expect(screen.getByText(/\/mnt\/q\/Youtube_test/i)).toBeInTheDocument();

      const applyButton = screen.getByRole('button', { name: /Use Suggested Path/i });
      await user.click(applyButton);

      const outputField = screen.getByRole('textbox', { name: /YouTube Output Directory/i });
      await waitFor(() => expect(outputField).toHaveValue('/mnt/q/Youtube_test'), { timeout: 500 });

      expect(screen.queryByText(/Use Suggested Path/i)).not.toBeInTheDocument();
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
      await setupComponent();
      const user = createUser();

      const accordion = screen.getByText('Optional: SponsorBlock Integration');
      await user.click(accordion);

      const enableCheckbox = screen.getByRole('checkbox', { name: /Enable SponsorBlock/i });
      await user.click(enableCheckbox);

      const introCheckbox = await screen.findByRole('checkbox', { name: /Intro/i });
      expect(introCheckbox).not.toBeChecked();

      await user.click(introCheckbox);
      expect(introCheckbox).toBeChecked();
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
      const passwordFields = screen.getAllByLabelText(/password/i);
      const currentPasswordInput = passwordFields[0]; // Current Password
      const newPasswordInput = passwordFields[1]; // New Password
      const confirmPasswordInput = passwordFields[2]; // Confirm New Password

      await user.type(currentPasswordInput, 'oldpass');
      await user.type(newPasswordInput, 'short');
      await user.type(confirmPasswordInput, 'short');

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
      const passwordFields = screen.getAllByLabelText(/password/i);
      const currentPasswordInput = passwordFields[0]; // Current Password
      const newPasswordInput = passwordFields[1]; // New Password
      const confirmPasswordInput = passwordFields[2]; // Confirm New Password

      await user.type(currentPasswordInput, 'oldpassword');
      await user.type(newPasswordInput, 'newpassword123');
      await user.type(confirmPasswordInput, 'different123');

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
      const passwordFields = screen.getAllByLabelText(/password/i);
      const currentPasswordInput = passwordFields[0]; // Current Password
      const newPasswordInput = passwordFields[1]; // New Password
      const confirmPasswordInput = passwordFields[2]; // Confirm New Password

      await user.type(currentPasswordInput, 'oldpassword');
      await user.type(newPasswordInput, 'newpassword123');
      await user.type(confirmPasswordInput, 'newpassword123');

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

    test('shows restart warning when YouTube directory changes', async () => {
      await setupComponent();
      const user = createUser();

      const input = screen.getByRole('textbox', { name: /YouTube Output Directory/i });
      await user.clear(input);
      await user.type(input, '/new/youtube/path');

      const saveButton = screen.getByRole('button', { name: /Save Configuration/i });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      await user.click(saveButton);

      await screen.findByText(/Please restart Youtarr for YouTube directory changes/i);
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
    test('shows platform managed indicators', async () => {
      const platformManagedConfig = {
        ...mockConfig,
      };

      const configWithPlatform = {
        ...platformManagedConfig,
        isPlatformManaged: {
          youtubeOutputDirectory: true,
          plexUrl: true,
          authEnabled: true,
        },
        deploymentEnvironment: {
          inDocker: true,
          dockerAutoCreated: false,
          platform: 'elfhosted',
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(configWithPlatform),
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

      const managedLabels = screen.getAllByText('Managed by Elfhosted');
      expect(managedLabels.length).toBeGreaterThan(0);

      const outputDirInput = screen.getByRole('textbox', { name: /YouTube Output Directory/i });
      expect(outputDirInput).toBeDisabled();
    });

    test('hides Account & Security section when auth is disabled', async () => {
      const authDisabledConfig = {
        ...mockConfig,
        authEnabled: false,
        isPlatformManaged: {
          youtubeOutputDirectory: false,
          plexUrl: false,
          authEnabled: false,
        },
        deploymentEnvironment: {
          inDocker: false,
          dockerAutoCreated: false,
          platform: null,
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(authDisabledConfig),
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

      expect(screen.queryByText('Account & Security')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Change Password/i })).not.toBeInTheDocument();
    });

    test('shows Docker volume indicator', async () => {
      const dockerConfig = {
        ...mockConfig,
        deploymentEnvironment: {
          inDocker: true,
          dockerAutoCreated: true,
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
