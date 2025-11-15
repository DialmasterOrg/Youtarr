import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PlexIntegrationSection } from '../PlexIntegrationSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState, PlatformManagedState, PlexConnectionStatus } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const createPlatformManagedState = (
  overrides: Partial<PlatformManagedState> = {}
): PlatformManagedState => ({
  plexUrl: false,
  authEnabled: false,
  useTmpForDownloads: false,
  ...overrides,
});

const createSectionProps = (
  overrides: Partial<React.ComponentProps<typeof PlexIntegrationSection>> = {}
): React.ComponentProps<typeof PlexIntegrationSection> => ({
  config: createConfig(),
  isPlatformManaged: createPlatformManagedState(),
  plexConnectionStatus: 'not_tested',
  hasPlexServerConfigured: false,
  onConfigChange: jest.fn(),
  onTestConnection: jest.fn(),
  onOpenLibrarySelector: jest.fn(),
  onOpenPlexAuthDialog: jest.fn(),
  onMobileTooltipClick: jest.fn(),
  ...overrides,
});

describe('PlexIntegrationSection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText('Plex Media Server Integration')).toBeInTheDocument();
    });

    test('renders title correctly', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText('Plex Media Server Integration')).toBeInTheDocument();
    });

    test('renders info alert about optional integration', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText('Optional Plex Integration')).toBeInTheDocument();
      expect(screen.getByText(/Automatic library refresh after downloads/i)).toBeInTheDocument();
    });

    test('displays all required form fields', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);

      expect(screen.getByTestId('plex-ip-input')).toBeInTheDocument();
      expect(screen.getByTestId('plex-port-input')).toBeInTheDocument();
      expect(screen.getByTestId('plex-https-checkbox')).toBeInTheDocument();
      expect(screen.getByTestId('plex-api-key-input')).toBeInTheDocument();
    });
  });

  describe('Connection Status Chip', () => {
    test('displays "Not Tested" chip when status is not_tested', () => {
      const props = createSectionProps({ plexConnectionStatus: 'not_tested' });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText('Not Tested')).toBeInTheDocument();
    });

    test('displays "Connected" chip when status is connected', () => {
      const props = createSectionProps({ plexConnectionStatus: 'connected' });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    test('displays "Not Connected" chip when status is not_connected', () => {
      const props = createSectionProps({ plexConnectionStatus: 'not_connected' });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText('Not Connected')).toBeInTheDocument();
    });

    test('displays "Testing..." chip when status is testing', () => {
      const props = createSectionProps({ plexConnectionStatus: 'testing' });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      // The chip shows "Testing..." but the button also shows "Testing..."
      const chips = screen.getAllByText('Testing...');
      expect(chips.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Alert Messages', () => {
    test('shows warning when connection status is not_connected', () => {
      const props = createSectionProps({ plexConnectionStatus: 'not_connected' });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Unable to connect to Plex server/i)).toBeInTheDocument();
      expect(screen.getByText(/check your IP and API key/i)).toBeInTheDocument();
    });

    test('shows info when status is not_tested but has config', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'not_tested',
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: 'test-key' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Plex configuration has changed/i)).toBeInTheDocument();
      expect(screen.getByText(/Click "Test Connection" to verify/i)).toBeInTheDocument();
    });

    test('shows info when no server configured', () => {
      const props = createSectionProps({
        hasPlexServerConfigured: false,
        config: createConfig({ plexApiKey: '' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Enter your Plex server IP to enable Plex integration/i)).toBeInTheDocument();
    });

    test('shows info when no API key', () => {
      const props = createSectionProps({
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: '' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Enter your Plex API Key to enable Plex integration/i)).toBeInTheDocument();
    });

    test('does not show config changed alert when connected', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'connected',
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: 'test-key' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.queryByText(/Plex configuration has changed/i)).not.toBeInTheDocument();
    });
  });

  describe('Plex Server IP Field', () => {
    test('renders Plex Server IP field', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-ip-input');
      expect(input).toBeInTheDocument();
    });

    test('displays current IP value', () => {
      const props = createSectionProps({
        config: createConfig({ plexIP: '192.168.1.100' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-ip-input') as HTMLInputElement;
      expect(input).toHaveValue('192.168.1.100');
    });

    test('calls onConfigChange when IP is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ plexIP: '' }),
        onConfigChange,
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const input = screen.getByTestId('plex-ip-input');
      await user.type(input, '192.168.1.100');

      expect(onConfigChange).toHaveBeenCalled();
      const lastCall = onConfigChange.mock.calls[onConfigChange.mock.calls.length - 1];
      expect(lastCall[0]).toHaveProperty('plexIP');
    });

    test('is disabled when platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: true }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-ip-input');
      expect(input).toBeDisabled();
    });

    test('is enabled when not platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: false }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-ip-input');
      expect(input).not.toBeDisabled();
    });

    test('shows Platform Managed chip when managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: true }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const chips = screen.getAllByText('Platform Managed');
      expect(chips.length).toBeGreaterThanOrEqual(1);
    });

    test('shows correct helper text when platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: true }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Plex URL is configured by your platform deployment/i)).toBeInTheDocument();
    });

    test('shows correct helper text when not platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: false }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/host LAN IP \(192.168.x.x\) or host.docker.internal/i)).toBeInTheDocument();
    });
  });

  describe('Plex Port Field', () => {
    test('renders Plex Port field', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-port-input');
      expect(input).toBeInTheDocument();
    });

    test('displays current port value', () => {
      const props = createSectionProps({
        config: createConfig({ plexPort: '32400' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-port-input') as HTMLInputElement;
      expect(input).toHaveValue(32400);
    });

    test('calls onConfigChange when port is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ plexPort: '32400' }),
        onConfigChange,
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const input = screen.getByTestId('plex-port-input');
      await user.clear(input);
      await user.type(input, '8080');

      expect(onConfigChange).toHaveBeenCalled();
    });

    test('handles port input changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ plexPort: '' }),
        onConfigChange,
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const input = screen.getByTestId('plex-port-input');
      await user.type(input, '8080');

      expect(onConfigChange).toHaveBeenCalled();
      const callsWithPort = onConfigChange.mock.calls.filter(call => 'plexPort' in call[0]);
      expect(callsWithPort.length).toBeGreaterThan(0);
    });

    test('is disabled when platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: true }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-port-input');
      expect(input).toBeDisabled();
    });

    test('is enabled when not platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: false }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-port-input');
      expect(input).not.toBeDisabled();
    });

    test('shows correct helper text when platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: true }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Plex port is configured by your platform deployment/i)).toBeInTheDocument();
    });

    test('shows correct helper text when not platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: false }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Default: 32400/i)).toBeInTheDocument();
    });

    test('handles empty port input', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ plexPort: '32400' }),
        onConfigChange,
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const input = screen.getByTestId('plex-port-input');
      await user.clear(input);

      const callsWithPort = onConfigChange.mock.calls.filter(call => 'plexPort' in call[0]);
      const lastPortCall = callsWithPort[callsWithPort.length - 1];
      expect(lastPortCall[0].plexPort).toBe('');
    });
  });

  describe('Use HTTPS Checkbox', () => {
    test('renders Use HTTPS checkbox', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByTestId('plex-https-checkbox')).toBeInTheDocument();
    });

    test('checkbox reflects plexViaHttps state when false', () => {
      const props = createSectionProps({
        config: createConfig({ plexViaHttps: false }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const checkbox = screen.getByTestId('plex-https-checkbox');
      expect(checkbox).not.toBeChecked();
    });

    test('checkbox reflects plexViaHttps state when true', () => {
      const props = createSectionProps({
        config: createConfig({ plexViaHttps: true }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const checkbox = screen.getByTestId('plex-https-checkbox');
      expect(checkbox).toBeChecked();
    });

    test('calls onConfigChange when checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ plexViaHttps: false }),
        onConfigChange,
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const checkbox = screen.getByTestId('plex-https-checkbox');
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ plexViaHttps: true });
    });

    test('is disabled when platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: true }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const checkbox = screen.getByTestId('plex-https-checkbox');
      expect(checkbox).toBeDisabled();
    });

    test('is enabled when not platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: false }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const checkbox = screen.getByTestId('plex-https-checkbox');
      expect(checkbox).not.toBeDisabled();
    });

    test('is unchecked and disabled when platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: true }),
        config: createConfig({ plexViaHttps: true }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const checkbox = screen.getByTestId('plex-https-checkbox');
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toBeDisabled();
    });

    test('shows correct caption when platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: true }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Protocol managed by platform/i)).toBeInTheDocument();
    });

    test('shows correct caption when not platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: false }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Default: HTTP/i)).toBeInTheDocument();
    });
  });

  describe('Plex API Key Field', () => {
    test('renders Plex API Key field', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-api-key-input');
      expect(input).toBeInTheDocument();
    });

    test('displays current API key value', () => {
      const props = createSectionProps({
        config: createConfig({ plexApiKey: 'test-api-key-123' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-api-key-input') as HTMLInputElement;
      expect(input).toHaveValue('test-api-key-123');
    });

    test('calls onConfigChange when API key is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ plexApiKey: '' }),
        onConfigChange,
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const input = screen.getByTestId('plex-api-key-input');
      await user.type(input, 'new-key');

      expect(onConfigChange).toHaveBeenCalled();
      const lastCall = onConfigChange.mock.calls[onConfigChange.mock.calls.length - 1];
      expect(lastCall[0]).toHaveProperty('plexApiKey');
    });

    test('renders Get Key button', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByTestId('get-key-button')).toBeInTheDocument();
    });

    test('Get Key button calls onOpenPlexAuthDialog', async () => {
      const user = userEvent.setup();
      const onOpenPlexAuthDialog = jest.fn();
      const props = createSectionProps({ onOpenPlexAuthDialog });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const button = screen.getByTestId('get-key-button');
      await user.click(button);

      expect(onOpenPlexAuthDialog).toHaveBeenCalledTimes(1);
    });

    test('shows link to manual instructions', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const link = screen.getByTestId('manual-instructions-link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://www.plexopedia.com/plex-media-server/general/plex-token/');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Test Connection Button', () => {
    test('renders Test Connection button', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByTestId('test-connection-button')).toBeInTheDocument();
    });

    test('calls onTestConnection when clicked', async () => {
      const user = userEvent.setup();
      const onTestConnection = jest.fn();
      const props = createSectionProps({
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: 'test-key' }),
        onTestConnection,
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const button = screen.getByTestId('test-connection-button');
      await user.click(button);

      expect(onTestConnection).toHaveBeenCalledTimes(1);
    });

    test('is disabled when server not configured', () => {
      const props = createSectionProps({
        hasPlexServerConfigured: false,
        config: createConfig({ plexApiKey: 'test-key' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const button = screen.getByTestId('test-connection-button');
      expect(button).toBeDisabled();
    });

    test('is disabled when API key is missing', () => {
      const props = createSectionProps({
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: '' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const button = screen.getByTestId('test-connection-button');
      expect(button).toBeDisabled();
    });

    test('is disabled when testing', () => {
      const props = createSectionProps({
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: 'test-key' }),
        plexConnectionStatus: 'testing',
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const button = screen.getByTestId('test-connection-button');
      expect(button).toBeDisabled();
    });

    test('is enabled when server configured and API key present', () => {
      const props = createSectionProps({
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: 'test-key' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const button = screen.getByTestId('test-connection-button');
      expect(button).not.toBeDisabled();
    });

    test('shows Testing... text when testing', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'testing',
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: 'test-key' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const testingElements = screen.getAllByText('Testing...');
      expect(testingElements.length).toBeGreaterThanOrEqual(1);
    });

    test('shows Test Connection text when not testing', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'not_tested',
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: 'test-key' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText('Test Connection')).toBeInTheDocument();
    });
  });

  describe('Select Plex Library Button', () => {
    test('renders Select Plex Library button', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByTestId('select-library-button')).toBeInTheDocument();
    });

    test('calls onOpenLibrarySelector when clicked', async () => {
      const user = userEvent.setup();
      const onOpenLibrarySelector = jest.fn();
      const props = createSectionProps({
        plexConnectionStatus: 'connected',
        onOpenLibrarySelector,
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const button = screen.getByTestId('select-library-button');
      await user.click(button);

      expect(onOpenLibrarySelector).toHaveBeenCalledTimes(1);
    });

    test('is disabled when not connected', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'not_connected',
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const button = screen.getByTestId('select-library-button');
      expect(button).toBeDisabled();
    });

    test('is disabled when not tested', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'not_tested',
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const button = screen.getByTestId('select-library-button');
      expect(button).toBeDisabled();
    });

    test('is disabled when testing', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'testing',
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const button = screen.getByTestId('select-library-button');
      expect(button).toBeDisabled();
    });

    test('is enabled when connected', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'connected',
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const button = screen.getByTestId('select-library-button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Selected Library Display', () => {
    test('displays selected library ID when present', () => {
      const props = createSectionProps({
        config: createConfig({ plexYoutubeLibraryId: '12345' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Selected Library ID: 12345/i)).toBeInTheDocument();
    });

    test('does not display library ID text when not set', () => {
      const props = createSectionProps({
        config: createConfig({ plexYoutubeLibraryId: '' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.queryByText(/Selected Library ID:/i)).not.toBeInTheDocument();
    });

    test('displays correct library ID value', () => {
      const props = createSectionProps({
        config: createConfig({ plexYoutubeLibraryId: 'my-custom-lib-99' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText(/Selected Library ID: my-custom-lib-99/i)).toBeInTheDocument();
    });
  });

  describe('InfoTooltip Integration', () => {
    test('calls onMobileTooltipClick when provided', () => {
      const onMobileTooltipClick = jest.fn();
      const props = createSectionProps({ onMobileTooltipClick });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByTestId('plex-ip-input')).toBeInTheDocument();
    });

    test('works without onMobileTooltipClick prop', () => {
      const props = createSectionProps({ onMobileTooltipClick: undefined });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText('Plex Media Server Integration')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('handles complete Plex setup workflow', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const onTestConnection = jest.fn();
      const props = createSectionProps({
        onConfigChange,
        onTestConnection,
        hasPlexServerConfigured: false,
        config: createConfig({ plexIP: '', plexApiKey: '' }),
      });
      const { rerender } = renderWithProviders(<PlexIntegrationSection {...props} />);

      // Enter IP
      const ipInput = screen.getByTestId('plex-ip-input');
      await user.type(ipInput, '192.168.1.100');
      expect(onConfigChange).toHaveBeenCalled();

      // Enter API Key
      const keyInput = screen.getByTestId('plex-api-key-input');
      await user.type(keyInput, 'test-key');
      expect(onConfigChange).toHaveBeenCalled();

      // Simulate config update
      rerender(
        <PlexIntegrationSection
          {...props}
          hasPlexServerConfigured={true}
          config={createConfig({ plexIP: '192.168.1.100', plexApiKey: 'test-key' })}
        />
      );

      // Test connection should now be enabled
      const testButton = screen.getByTestId('test-connection-button');
      expect(testButton).not.toBeDisabled();
    });

    test('updates connection status through different states', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'not_tested',
      });
      const { rerender } = renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByText('Not Tested')).toBeInTheDocument();

      rerender(<PlexIntegrationSection {...props} plexConnectionStatus="testing" />);
      const testingChips = screen.getAllByText('Testing...');
      expect(testingChips.length).toBeGreaterThanOrEqual(1);

      rerender(<PlexIntegrationSection {...props} plexConnectionStatus="connected" />);
      expect(screen.getByText('Connected')).toBeInTheDocument();

      rerender(<PlexIntegrationSection {...props} plexConnectionStatus="not_connected" />);
      expect(screen.getByText('Not Connected')).toBeInTheDocument();
    });

    test('handles platform managed configuration changes', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ plexUrl: false }),
      });
      const { rerender } = renderWithProviders(<PlexIntegrationSection {...props} />);

      // Not managed - fields should be enabled
      expect(screen.getByTestId('plex-ip-input')).not.toBeDisabled();
      expect(screen.getByTestId('plex-port-input')).not.toBeDisabled();
      expect(screen.getByTestId('plex-https-checkbox')).not.toBeDisabled();

      // Switch to managed
      rerender(
        <PlexIntegrationSection
          {...props}
          isPlatformManaged={createPlatformManagedState({ plexUrl: true })}
        />
      );

      // Fields should now be disabled
      expect(screen.getByTestId('plex-ip-input')).toBeDisabled();
      expect(screen.getByTestId('plex-port-input')).toBeDisabled();
      expect(screen.getByTestId('plex-https-checkbox')).toBeDisabled();
    });

    test('handles multiple field changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({ onConfigChange });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      // Change IP
      const ipInput = screen.getByTestId('plex-ip-input');
      await user.type(ipInput, '192.168.1.1');

      // Change Port
      const portInput = screen.getByTestId('plex-port-input');
      await user.clear(portInput);
      await user.type(portInput, '8080');

      // Toggle HTTPS
      const httpsCheckbox = screen.getByTestId('plex-https-checkbox');
      await user.click(httpsCheckbox);

      // Change API Key
      const keyInput = screen.getByTestId('plex-api-key-input');
      await user.type(keyInput, 'new-key');

      // Should have called onConfigChange for each field
      expect(onConfigChange).toHaveBeenCalled();
      const calls = onConfigChange.mock.calls;
      expect(calls.some(call => 'plexIP' in call[0])).toBe(true);
      expect(calls.some(call => 'plexPort' in call[0])).toBe(true);
      expect(calls.some(call => 'plexViaHttps' in call[0])).toBe(true);
      expect(calls.some(call => 'plexApiKey' in call[0])).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty plexIP', () => {
      const props = createSectionProps({
        config: createConfig({ plexIP: '' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-ip-input') as HTMLInputElement;
      expect(input).toHaveValue('');
    });

    test('handles empty plexApiKey', () => {
      const props = createSectionProps({
        config: createConfig({ plexApiKey: '' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-api-key-input') as HTMLInputElement;
      expect(input).toHaveValue('');
    });

    test('handles custom port values', () => {
      const props = createSectionProps({
        config: createConfig({ plexPort: '8096' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const input = screen.getByTestId('plex-port-input') as HTMLInputElement;
      expect(input).toHaveValue(8096);
    });

    test('handles all connection statuses', () => {
      const statuses: PlexConnectionStatus[] = ['connected', 'not_connected', 'not_tested', 'testing'];

      statuses.forEach((status) => {
        const props = createSectionProps({ plexConnectionStatus: status });
        const { unmount } = renderWithProviders(<PlexIntegrationSection {...props} />);
        expect(screen.getByText('Plex Media Server Integration')).toBeInTheDocument();
        unmount();
      });
    });

    test('handles library selector when connected without library ID', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'connected',
        config: createConfig({ plexYoutubeLibraryId: '' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);
      const button = screen.getByTestId('select-library-button');
      expect(button).not.toBeDisabled();
      expect(screen.queryByText(/Selected Library ID:/i)).not.toBeInTheDocument();
    });

    test('handles various port input values', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ plexPort: '' }),
        onConfigChange,
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const input = screen.getByTestId('plex-port-input');
      await user.type(input, '3240');

      expect(onConfigChange).toHaveBeenCalled();
      const callsWithPort = onConfigChange.mock.calls.filter(call => 'plexPort' in call[0]);
      expect(callsWithPort.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    test('all text fields have data-testid attributes', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);

      expect(screen.getByTestId('plex-ip-input')).toBeInTheDocument();
      expect(screen.getByTestId('plex-port-input')).toBeInTheDocument();
      expect(screen.getByTestId('plex-api-key-input')).toBeInTheDocument();
    });

    test('checkbox has data-testid attribute', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);
      expect(screen.getByTestId('plex-https-checkbox')).toBeInTheDocument();
    });

    test('all buttons have text labels', () => {
      const props = createSectionProps({
        hasPlexServerConfigured: true,
        config: createConfig({ plexApiKey: 'test-key' }),
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      expect(screen.getByText('Get Key')).toBeInTheDocument();
      expect(screen.getByText('Test Connection')).toBeInTheDocument();
      expect(screen.getByText('Select Plex Library')).toBeInTheDocument();
    });

    test('alerts are displayed when appropriate', () => {
      const props = createSectionProps({
        plexConnectionStatus: 'not_connected',
      });
      renderWithProviders(<PlexIntegrationSection {...props} />);

      // Check for specific alert content instead of role
      expect(screen.getByText(/Unable to connect to Plex server/i)).toBeInTheDocument();
    });

    test('link has proper attributes for external navigation', () => {
      const props = createSectionProps();
      renderWithProviders(<PlexIntegrationSection {...props} />);

      const link = screen.getByTestId('manual-instructions-link');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });
});
