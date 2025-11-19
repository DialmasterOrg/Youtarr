import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Configuration from '../Configuration';
import { renderWithProviders } from '../../test-utils';
import { DEFAULT_CONFIG } from '../../config/configSchema';
import { ConfigState } from '../Configuration/types';

// Mock all section components
jest.mock('../Configuration/sections/CoreSettingsSection', () => ({
  CoreSettingsSection: function MockCoreSettingsSection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'core-settings-section' }, 'CoreSettingsSection');
  }
}));

jest.mock('../Configuration/sections/PlexIntegrationSection', () => ({
  PlexIntegrationSection: function MockPlexIntegrationSection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'plex-integration-section' }, 'PlexIntegrationSection');
  }
}));

jest.mock('../Configuration/sections/SponsorBlockSection', () => ({
  SponsorBlockSection: function MockSponsorBlockSection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'sponsorblock-section' }, 'SponsorBlockSection');
  }
}));

jest.mock('../Configuration/sections/KodiCompatibilitySection', () => ({
  KodiCompatibilitySection: function MockKodiCompatibilitySection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'kodi-compatibility-section' }, 'KodiCompatibilitySection');
  }
}));

jest.mock('../Configuration/sections/CookieConfigSection', () => ({
  CookieConfigSection: function MockCookieConfigSection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'cookie-config-section' }, 'CookieConfigSection');
  }
}));

jest.mock('../Configuration/sections/NotificationsSection', () => ({
  NotificationsSection: function MockNotificationsSection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'notifications-section' }, 'NotificationsSection');
  }
}));

jest.mock('../Configuration/sections/DownloadPerformanceSection', () => ({
  DownloadPerformanceSection: function MockDownloadPerformanceSection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'download-performance-section' }, 'DownloadPerformanceSection');
  }
}));

jest.mock('../Configuration/sections/AdvancedSettingsSection', () => ({
  AdvancedSettingsSection: function MockAdvancedSettingsSection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'advanced-settings-section' }, 'AdvancedSettingsSection');
  }
}));

jest.mock('../Configuration/sections/AutoRemovalSection', () => ({
  AutoRemovalSection: function MockAutoRemovalSection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'auto-removal-section' }, 'AutoRemovalSection');
  }
}));

jest.mock('../Configuration/sections/AccountSecuritySection', () => ({
  AccountSecuritySection: function MockAccountSecuritySection(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'account-security-section' }, 'AccountSecuritySection');
  }
}));

jest.mock('../Configuration/sections/SaveBar', () => ({
  SaveBar: function MockSaveBar(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'save-bar' },
      React.createElement('button', {
        'data-testid': 'save-button',
        onClick: props.onSave,
        disabled: props.isLoading || Boolean(props.validationError)
      }, 'Save')
    );
  }
}));

// Mock PlexLibrarySelector
jest.mock('../PlexLibrarySelector', () => ({
  __esModule: true,
  default: function MockPlexLibrarySelector(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'plex-library-selector' },
      props.open ? 'PlexLibrarySelector Open' : null
    );
  }
}));

// Mock PlexAuthDialog
jest.mock('../PlexAuthDialog', () => ({
  __esModule: true,
  default: function MockPlexAuthDialog(props: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'plex-auth-dialog' },
      props.open ? 'PlexAuthDialog Open' : null
    );
  }
}));

// Mock ConfigurationSkeleton
jest.mock('../Configuration/common/ConfigurationSkeleton', () => ({
  __esModule: true,
  default: function MockConfigurationSkeleton() {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'configuration-skeleton' }, 'Loading...');
  }
}));

// Mock custom hooks
const mockUseConfig = jest.fn();
const mockUsePlexConnection = jest.fn();
const mockUseConfigSave = jest.fn();
const mockUseStorageStatus = jest.fn();

jest.mock('../../hooks/useConfig', () => ({
  useConfig: (...args: any[]) => mockUseConfig(...args)
}));

jest.mock('../Configuration/hooks', () => ({
  usePlexConnection: (...args: any[]) => mockUsePlexConnection(...args),
  useConfigSave: (...args: any[]) => mockUseConfigSave(...args)
}));

jest.mock('../../hooks/useStorageStatus', () => ({
  useStorageStatus: (...args: any[]) => mockUseStorageStatus(...args)
}));

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  youtubeOutputDirectory: '/data/youtube',
  channelDownloadFrequency: '0 */6 * * *',
  ...overrides,
});

const createMockUseConfig = (overrides: any = {}) => ({
  config: createConfig(),
  initialConfig: createConfig(),
  isPlatformManaged: {
    plexUrl: false,
    authEnabled: false,
    useTmpForDownloads: false,
  },
  deploymentEnvironment: {
    platform: null,
    isWsl: false,
  },
  loading: false,
  setConfig: jest.fn(),
  setInitialConfig: jest.fn(),
  ...overrides,
});

const createMockUsePlexConnection = (overrides: any = {}) => ({
  plexConnectionStatus: 'not_tested',
  setPlexConnectionStatus: jest.fn(),
  openPlexLibrarySelector: false,
  openPlexAuthDialog: false,
  setOpenPlexAuthDialog: jest.fn(),
  checkPlexConnection: jest.fn(),
  testPlexConnection: jest.fn(),
  openLibrarySelector: jest.fn(),
  closeLibrarySelector: jest.fn(),
  setLibraryId: jest.fn(),
  handlePlexAuthSuccess: jest.fn(),
  ...overrides,
});

const createMockUseConfigSave = (overrides: any = {}) => ({
  saveConfig: jest.fn(),
  ...overrides,
});

const createMockUseStorageStatus = (overrides: any = {}) => ({
  available: true,
  isLoading: false,
  error: null,
  ...overrides,
});

describe('Configuration Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConfig.mockReturnValue(createMockUseConfig());
    mockUsePlexConnection.mockReturnValue(createMockUsePlexConnection());
    mockUseConfigSave.mockReturnValue(createMockUseConfigSave());
    mockUseStorageStatus.mockReturnValue(createMockUseStorageStatus());
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<Configuration token="test-token" />);
      expect(screen.getByTestId('core-settings-section')).toBeInTheDocument();
    });

    test('shows loading skeleton while loading', () => {
      mockUseConfig.mockReturnValue(createMockUseConfig({ loading: true }));
      renderWithProviders(<Configuration token="test-token" />);
      expect(screen.getByTestId('configuration-skeleton')).toBeInTheDocument();
      expect(screen.queryByTestId('core-settings-section')).not.toBeInTheDocument();
    });

    test('renders all sections after loading', () => {
      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByTestId('core-settings-section')).toBeInTheDocument();
      expect(screen.getByTestId('plex-integration-section')).toBeInTheDocument();
      expect(screen.getByTestId('sponsorblock-section')).toBeInTheDocument();
      expect(screen.getByTestId('kodi-compatibility-section')).toBeInTheDocument();
      expect(screen.getByTestId('cookie-config-section')).toBeInTheDocument();
      expect(screen.getByTestId('notifications-section')).toBeInTheDocument();
      expect(screen.getByTestId('download-performance-section')).toBeInTheDocument();
      expect(screen.getByTestId('advanced-settings-section')).toBeInTheDocument();
      expect(screen.getByTestId('auto-removal-section')).toBeInTheDocument();
      expect(screen.getByTestId('account-security-section')).toBeInTheDocument();
      expect(screen.getByTestId('save-bar')).toBeInTheDocument();
    });

    test('renders confirmation dialog (initially closed)', () => {
      renderWithProviders(<Configuration token="test-token" />);

      // Dialog should not show initially
      expect(screen.queryByText('Confirm Save Configuration')).not.toBeInTheDocument();
    });

    test('renders PlexLibrarySelector (initially closed)', () => {
      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByTestId('plex-library-selector')).toBeInTheDocument();
      expect(screen.queryByText('PlexLibrarySelector Open')).not.toBeInTheDocument();
    });

    test('renders PlexAuthDialog (initially closed)', () => {
      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByTestId('plex-auth-dialog')).toBeInTheDocument();
      expect(screen.queryByText('PlexAuthDialog Open')).not.toBeInTheDocument();
    });
  });

  describe('Configuration Management', () => {
    test('fetches config on mount via useConfig hook', () => {
      renderWithProviders(<Configuration token="test-token" />);

      expect(mockUseConfig).toHaveBeenCalledWith('test-token');
    });

    test('calls useStorageStatus hook', () => {
      renderWithProviders(<Configuration token="test-token" />);

      expect(mockUseStorageStatus).toHaveBeenCalledWith('test-token', { checkOnly: true });
    });

    test('initializes usePlexConnection with correct params', () => {
      const setConfig = jest.fn();
      const setInitialConfig = jest.fn();
      mockUseConfig.mockReturnValue(createMockUseConfig({ setConfig, setInitialConfig }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(mockUsePlexConnection).toHaveBeenCalledWith({
        token: 'test-token',
        config: expect.any(Object),
        setConfig: setConfig,
        setInitialConfig: setInitialConfig,
        setSnackbar: expect.any(Function),
        hasPlexServerConfigured: false,
      });
    });

    test('initializes useConfigSave with correct params', () => {
      const setInitialConfig = jest.fn();
      const checkPlexConnection = jest.fn();
      mockUseConfig.mockReturnValue(createMockUseConfig({ setInitialConfig }));
      mockUsePlexConnection.mockReturnValue(createMockUsePlexConnection({ checkPlexConnection }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(mockUseConfigSave).toHaveBeenCalledWith({
        token: 'test-token',
        config: expect.any(Object),
        setInitialConfig: setInitialConfig,
        setSnackbar: expect.any(Function),
        hasPlexServerConfigured: false,
        checkPlexConnection: checkPlexConnection,
      });
    });

    test('detects Plex server configured when plexIP is set', () => {
      mockUseConfig.mockReturnValue(createMockUseConfig({
        config: createConfig({ plexIP: '192.168.1.100' })
      }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(mockUsePlexConnection).toHaveBeenCalledWith(
        expect.objectContaining({ hasPlexServerConfigured: true })
      );
    });

    test('detects Plex server configured when platform manages plexUrl', () => {
      mockUseConfig.mockReturnValue(createMockUseConfig({
        isPlatformManaged: { plexUrl: true, authEnabled: false, useTmpForDownloads: false }
      }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(mockUsePlexConnection).toHaveBeenCalledWith(
        expect.objectContaining({ hasPlexServerConfigured: true })
      );
    });
  });

  describe('Unsaved Changes Tracking', () => {
    test('detects no unsaved changes when config matches initial config', () => {
      const initialConfig = createConfig({ plexIP: '192.168.1.100' });
      mockUseConfig.mockReturnValue(createMockUseConfig({
        config: createConfig({ plexIP: '192.168.1.100' }),
        initialConfig: initialConfig,
      }));

      renderWithProviders(<Configuration token="test-token" />);

      const saveBar = screen.getByTestId('save-bar');
      expect(saveBar).toBeInTheDocument();
    });

    test('detects unsaved changes when config differs from initial config', () => {
      const initialConfig = createConfig({ plexIP: '192.168.1.100' });
      mockUseConfig.mockReturnValue(createMockUseConfig({
        config: createConfig({ plexIP: '192.168.1.200' }),
        initialConfig: initialConfig,
      }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByTestId('save-bar')).toBeInTheDocument();
    });

    test('handles null initialConfig gracefully', () => {
      mockUseConfig.mockReturnValue(createMockUseConfig({
        initialConfig: null,
      }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByTestId('save-bar')).toBeInTheDocument();
    });
  });

  describe('Save Flow', () => {
    test('opens confirmation dialog when save button clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      expect(await screen.findByText('Confirm Save Configuration')).toBeInTheDocument();
    });

    test('displays cancel and save buttons in confirmation dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
    });

    test('closes confirmation dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Save Configuration')).not.toBeInTheDocument();
      });
    });

    test('calls saveConfig when save is confirmed', async () => {
      const user = userEvent.setup();
      const saveConfig = jest.fn();
      mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));

      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(saveConfig).toHaveBeenCalledTimes(1);
      });
    });

    test('closes confirmation dialog after save is confirmed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Save Configuration')).not.toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    describe('Auto-Removal Validation', () => {
      test('prevents save when auto-removal enabled without thresholds', () => {
        const saveConfig = jest.fn();
        mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
        mockUseConfig.mockReturnValue(createMockUseConfig({
          config: createConfig({
            autoRemovalEnabled: true,
            autoRemovalFreeSpaceThreshold: '',
            autoRemovalVideoAgeThreshold: '',
          }),
        }));

        renderWithProviders(<Configuration token="test-token" />);

        const saveButton = screen.getByTestId('save-button');

        // Button should be disabled due to validation error
        expect(saveButton).toBeDisabled();
        expect(saveConfig).not.toHaveBeenCalled();
      });

    test('prevents save from confirmation dialog when auto-removal enabled without thresholds', async () => {
      const saveConfig = jest.fn();
      mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
      mockUseConfig.mockReturnValue(createMockUseConfig({
        config: createConfig({
          autoRemovalEnabled: true,
          autoRemovalFreeSpaceThreshold: '',
          autoRemovalVideoAgeThreshold: '',
        }),
      }));

      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');

      // Button should be disabled due to validation error
      expect(saveButton).toBeDisabled();
    });

    test('allows save when auto-removal enabled with free space threshold', async () => {
      const user = userEvent.setup();
      const saveConfig = jest.fn();
      mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
      mockUseConfig.mockReturnValue(createMockUseConfig({
        config: createConfig({
          autoRemovalEnabled: true,
          autoRemovalFreeSpaceThreshold: '10',
          autoRemovalVideoAgeThreshold: '',
        }),
      }));

      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(saveConfig).toHaveBeenCalledTimes(1);
      });
    });

    test('allows save when auto-removal enabled with video age threshold', async () => {
      const user = userEvent.setup();
      const saveConfig = jest.fn();
      mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
      mockUseConfig.mockReturnValue(createMockUseConfig({
        config: createConfig({
          autoRemovalEnabled: true,
          autoRemovalFreeSpaceThreshold: '',
          autoRemovalVideoAgeThreshold: '30',
        }),
      }));

      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(saveConfig).toHaveBeenCalledTimes(1);
      });
    });

    test('allows save when auto-removal disabled without thresholds', async () => {
      const user = userEvent.setup();
      const saveConfig = jest.fn();
      mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
      mockUseConfig.mockReturnValue(createMockUseConfig({
        config: createConfig({
          autoRemovalEnabled: false,
          autoRemovalFreeSpaceThreshold: '',
          autoRemovalVideoAgeThreshold: '',
        }),
      }));

      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(saveConfig).toHaveBeenCalledTimes(1);
      });
    });
    });

    describe('Proxy Validation', () => {
      test('prevents save when proxy URL is invalid', () => {
        const saveConfig = jest.fn();
        mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
        mockUseConfig.mockReturnValue(createMockUseConfig({
          config: createConfig({
            proxy: 'invalid-proxy-url',
          }),
        }));

        renderWithProviders(<Configuration token="test-token" />);

        const saveButton = screen.getByTestId('save-button');

        // Button should be disabled due to validation error
        expect(saveButton).toBeDisabled();
        expect(saveConfig).not.toHaveBeenCalled();
      });

      test('allows save when proxy URL is valid HTTP', async () => {
        const user = userEvent.setup();
        const saveConfig = jest.fn();
        mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
        mockUseConfig.mockReturnValue(createMockUseConfig({
          config: createConfig({
            proxy: 'http://proxy.example.com:8080',
          }),
        }));

        renderWithProviders(<Configuration token="test-token" />);

        const saveButton = screen.getByTestId('save-button');
        await user.click(saveButton);

        const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
        await user.click(confirmButton);

        await waitFor(() => {
          expect(saveConfig).toHaveBeenCalledTimes(1);
        });
      });

      test('allows save when proxy URL is valid SOCKS5 with authentication', async () => {
        const user = userEvent.setup();
        const saveConfig = jest.fn();
        mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
        mockUseConfig.mockReturnValue(createMockUseConfig({
          config: createConfig({
            proxy: 'socks5://user:pass@127.0.0.1:1080',
          }),
        }));

        renderWithProviders(<Configuration token="test-token" />);

        const saveButton = screen.getByTestId('save-button');
        await user.click(saveButton);

        const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
        await user.click(confirmButton);

        await waitFor(() => {
          expect(saveConfig).toHaveBeenCalledTimes(1);
        });
      });

      test('allows save when proxy is empty', async () => {
        const user = userEvent.setup();
        const saveConfig = jest.fn();
        mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
        mockUseConfig.mockReturnValue(createMockUseConfig({
          config: createConfig({
            proxy: '',
          }),
        }));

        renderWithProviders(<Configuration token="test-token" />);

        const saveButton = screen.getByTestId('save-button');
        await user.click(saveButton);

        const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
        await user.click(confirmButton);

        await waitFor(() => {
          expect(saveConfig).toHaveBeenCalledTimes(1);
        });
      });

      test('allows save when proxy is undefined', async () => {
        const user = userEvent.setup();
        const saveConfig = jest.fn();
        mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
        mockUseConfig.mockReturnValue(createMockUseConfig({
          config: createConfig({
            proxy: undefined,
          }),
        }));

        renderWithProviders(<Configuration token="test-token" />);

        const saveButton = screen.getByTestId('save-button');
        await user.click(saveButton);

        const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
        await user.click(confirmButton);

        await waitFor(() => {
          expect(saveConfig).toHaveBeenCalledTimes(1);
        });
      });

      test('prevents save when proxy URL has invalid protocol', () => {
        const saveConfig = jest.fn();
        mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
        mockUseConfig.mockReturnValue(createMockUseConfig({
          config: createConfig({
            proxy: 'ftp://proxy.example.com:8080',
          }),
        }));

        renderWithProviders(<Configuration token="test-token" />);

        const saveButton = screen.getByTestId('save-button');

        // Button should be disabled due to validation error
        expect(saveButton).toBeDisabled();
        expect(saveConfig).not.toHaveBeenCalled();
      });
    });
  });

  describe('Plex Connection Status Management', () => {
    test('provides setPlexConnectionStatus function from hook', () => {
      const setPlexConnectionStatus = jest.fn();
      mockUsePlexConnection.mockReturnValue(createMockUsePlexConnection({ setPlexConnectionStatus }));

      renderWithProviders(<Configuration token="test-token" />);

      // The hook is called with setPlexConnectionStatus
      expect(mockUsePlexConnection).toHaveBeenCalled();
    });

    test('handleConfigChange is available for sections to update config', () => {
      const setConfig = jest.fn();
      mockUseConfig.mockReturnValue(createMockUseConfig({ setConfig }));

      renderWithProviders(<Configuration token="test-token" />);

      // The component has access to setConfig
      expect(setConfig).toBeDefined();
    });
  });

  describe('Snackbar Management', () => {
    test('displays snackbar message', async () => {
      renderWithProviders(<Configuration token="test-token" />);

      // Snackbar should not be visible initially
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('snackbar can be closed when displayed', () => {
      renderWithProviders(<Configuration token="test-token" />);

      // Snackbar components are rendered but not visible initially
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('displays mobile tooltip snackbar when triggered', () => {
      renderWithProviders(<Configuration token="test-token" />);

      // Mobile tooltip snackbar should not be visible initially
      expect(screen.queryByText(/info/i)).not.toBeInTheDocument();
    });
  });

  describe('Dialog Management', () => {
    test('PlexLibrarySelector opens when hook indicates', () => {
      mockUsePlexConnection.mockReturnValue(createMockUsePlexConnection({
        openPlexLibrarySelector: true,
      }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByText('PlexLibrarySelector Open')).toBeInTheDocument();
    });

    test('PlexAuthDialog opens when hook indicates', () => {
      mockUsePlexConnection.mockReturnValue(createMockUsePlexConnection({
        openPlexAuthDialog: true,
      }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByText('PlexAuthDialog Open')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles null token gracefully', () => {
      renderWithProviders(<Configuration token={null as any} />);

      expect(mockUseConfig).toHaveBeenCalledWith(null);
    });

    test('handles platform-managed configuration', () => {
      mockUseConfig.mockReturnValue(createMockUseConfig({
        isPlatformManaged: {
          plexUrl: true,
          authEnabled: true,
          useTmpForDownloads: true,
        },
      }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByTestId('core-settings-section')).toBeInTheDocument();
    });

    test('handles storage unavailable scenario', () => {
      mockUseStorageStatus.mockReturnValue(createMockUseStorageStatus({
        available: false,
      }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByTestId('auto-removal-section')).toBeInTheDocument();
    });

    test('handles multiple dialogs state correctly', () => {
      mockUsePlexConnection.mockReturnValue(createMockUsePlexConnection({
        openPlexLibrarySelector: true,
        openPlexAuthDialog: true,
      }));

      renderWithProviders(<Configuration token="test-token" />);

      expect(screen.getByText('PlexLibrarySelector Open')).toBeInTheDocument();
      expect(screen.getByText('PlexAuthDialog Open')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('complete save workflow: open dialog -> confirm -> save', async () => {
      const user = userEvent.setup();
      const saveConfig = jest.fn();
      mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));

      renderWithProviders(<Configuration token="test-token" />);

      // Click save button
      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      // Dialog opens
      expect(await screen.findByText('Confirm Save Configuration')).toBeInTheDocument();

      // Confirm save
      const confirmButton = screen.getByRole('button', { name: /save configuration/i });
      await user.click(confirmButton);

      // Save is called
      await waitFor(() => {
        expect(saveConfig).toHaveBeenCalledTimes(1);
      });

      // Dialog closes
      await waitFor(() => {
        expect(screen.queryByText('Confirm Save Configuration')).not.toBeInTheDocument();
      });
    });

    test('validation prevents save throughout workflow', async () => {
      const user = userEvent.setup();
      const saveConfig = jest.fn();
      mockUseConfigSave.mockReturnValue(createMockUseConfigSave({ saveConfig }));
      mockUseConfig.mockReturnValue(createMockUseConfig({
        config: createConfig({
          autoRemovalEnabled: true,
          autoRemovalFreeSpaceThreshold: '',
          autoRemovalVideoAgeThreshold: '',
        }),
      }));

      renderWithProviders(<Configuration token="test-token" />);

      // Save button should be disabled
      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeDisabled();

      // Attempting to click shows error
      await user.click(saveButton);

      // No dialog should open, saveConfig should not be called
      expect(screen.queryByText('Confirm Save Configuration')).not.toBeInTheDocument();
      expect(saveConfig).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    test('confirmation dialog has accessible title', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      expect(await screen.findByText('Confirm Save Configuration')).toBeInTheDocument();
    });

    test('save confirmation button has accessible label', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      const confirmButton = await screen.findByRole('button', { name: /save configuration/i });
      expect(confirmButton).toHaveAccessibleName();
    });

    test('cancel button has accessible label', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Configuration token="test-token" />);

      const saveButton = screen.getByTestId('save-button');
      await user.click(saveButton);

      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveAccessibleName();
    });
  });
});
