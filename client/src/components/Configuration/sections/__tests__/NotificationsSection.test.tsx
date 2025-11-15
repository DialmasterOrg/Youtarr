import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { NotificationsSection } from '../NotificationsSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const createSectionProps = (
  overrides: Partial<React.ComponentProps<typeof NotificationsSection>> = {}
): React.ComponentProps<typeof NotificationsSection> => ({
  token: 'test-token-123',
  config: createConfig(),
  onConfigChange: jest.fn(),
  setSnackbar: jest.fn(),
  onMobileTooltipClick: jest.fn(),
  ...overrides,
});

// Helper to expand accordion
const expandAccordion = async (user: ReturnType<typeof userEvent.setup>) => {
  const accordionButton = screen.getByRole('button', { name: /Notifications/i });
  await user.click(accordionButton);
};

describe('NotificationsSection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    test('renders with ConfigurationAccordion wrapper', () => {
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    test('renders info alert with title and description', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Get Notified of New Downloads')).toBeInTheDocument();
      expect(screen.getByText(/Receive notifications when new videos are downloaded/i)).toBeInTheDocument();
      expect(screen.getByText(/Currently supports Discord webhooks/i)).toBeInTheDocument();
    });

    test('displays "Disabled" chip when notifications are disabled', () => {
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      renderWithProviders(<NotificationsSection {...props} />);
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    test('displays "Enabled" chip when notifications are enabled', () => {
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    test('accordion is collapsed by default', () => {
      const props = createSectionProps();
      const { container } = renderWithProviders(<NotificationsSection {...props} />);
      const accordionButton = within(container).getByRole('button', { name: /Notifications/i });
      expect(accordionButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Enable Notifications Switch', () => {
    test('renders Enable Notifications switch', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByTestId('notifications-enabled-switch')).toBeInTheDocument();
    });

    test('switch reflects notificationsEnabled state when false', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const switchControl = screen.getByTestId('notifications-enabled-switch');
      expect(switchControl).not.toBeChecked();
    });

    test('switch reflects notificationsEnabled state when true', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const switchControl = screen.getByTestId('notifications-enabled-switch');
      expect(switchControl).toBeChecked();
    });

    test('calls onConfigChange when switch is toggled on', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false }),
        onConfigChange
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const switchControl = screen.getByTestId('notifications-enabled-switch');
      await user.click(switchControl);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ notificationsEnabled: true });
    });

    test('calls onConfigChange when switch is toggled off', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true }),
        onConfigChange
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const switchControl = screen.getByTestId('notifications-enabled-switch');
      await user.click(switchControl);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ notificationsEnabled: false });
    });
  });

  describe('Discord Webhook URL Field - Visibility', () => {
    test('does not show Discord webhook field when notifications are disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByLabelText(/Discord Webhook URL/i)).not.toBeInTheDocument();
    });

    test('shows Discord webhook field when notifications are enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Discord Webhook URL/i)).toBeInTheDocument();
    });

    test('does not show test button when notifications are disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByTestId('test-notification-button')).not.toBeInTheDocument();
    });

    test('shows test button when notifications are enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByTestId('test-notification-button')).toBeInTheDocument();
    });
  });

  describe('Discord Webhook URL Field - Functionality', () => {
    test('displays current webhook URL value', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc'
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Discord Webhook URL/i) as HTMLInputElement;
      expect(input).toHaveValue('https://discord.com/api/webhooks/123/abc');
    });

    test('displays empty string when webhook URL is not set', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: ''
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Discord Webhook URL/i) as HTMLInputElement;
      expect(input).toHaveValue('');
    });

    test('has correct placeholder text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Discord Webhook URL/i);
      expect(input).toHaveAttribute('placeholder', 'https://discord.com/api/webhooks/...');
    });

    test('displays helper text with instructions', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Get your webhook URL from Discord/i)).toBeInTheDocument();
      expect(screen.getByText(/Server Settings → Integrations → Webhooks/i)).toBeInTheDocument();
    });

    test('displays link to Discord webhook documentation', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const link = screen.getByRole('link', { name: /How to get a webhook URL/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('calls onConfigChange when webhook URL is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true, discordWebhookUrl: '' }),
        onConfigChange
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Discord Webhook URL/i);
      await user.type(input, 'https://discord.com/test');

      expect(onConfigChange).toHaveBeenCalled();
      // Check that discordWebhookUrl was set in the calls
      const calls = onConfigChange.mock.calls;
      expect(calls[calls.length - 1][0]).toHaveProperty('discordWebhookUrl');
    });

    test('input has correct name attribute', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Discord Webhook URL/i);
      expect(input).toHaveAttribute('name', 'discordWebhookUrl');
    });
  });

  describe('Send Test Notification Button', () => {
    test('renders with correct initial text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByTestId('test-notification-button')).toHaveTextContent('Send Test Notification');
    });

    test('displays save reminder text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Make sure to save your configuration before testing/i)).toBeInTheDocument();
    });

    test('is not disabled initially', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true, discordWebhookUrl: 'https://discord.com/test' })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      expect(button).not.toBeDisabled();
    });

    test('shows warning snackbar when webhook URL is empty', async () => {
      const user = userEvent.setup();
      const setSnackbar = jest.fn();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true, discordWebhookUrl: '' }),
        setSnackbar
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      expect(setSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Please enter a Discord webhook URL first',
        severity: 'warning'
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('shows warning snackbar when webhook URL is only whitespace', async () => {
      const user = userEvent.setup();
      const setSnackbar = jest.fn();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true, discordWebhookUrl: '   ' }),
        setSnackbar
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      expect(setSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Please enter a Discord webhook URL first',
        severity: 'warning'
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Send Test Notification - Success Flow', () => {
    test('sends test notification request with correct parameters', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ success: true })
      });

      const props = createSectionProps({
        token: 'my-auth-token',
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc'
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/notifications/test', {
          method: 'POST',
          headers: {
            'x-access-token': 'my-auth-token',
          },
        });
      });
    });

    test('uses empty string for token when token is null', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ success: true })
      });

      const props = createSectionProps({
        token: null,
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/notifications/test', {
          method: 'POST',
          headers: {
            'x-access-token': '',
          },
        });
      });
    });

    test('shows success snackbar on successful test', async () => {
      const user = userEvent.setup();
      const setSnackbar = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ success: true })
      });

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        }),
        setSnackbar
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(setSnackbar).toHaveBeenCalledWith({
          open: true,
          message: 'Test notification sent! Check your Discord channel.',
          severity: 'success'
        });
      });
    });

    test('button shows "Sending..." during request', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(fetchPromise);

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      // Button should show "Sending..." and be disabled
      await waitFor(() => {
        expect(screen.getByTestId('test-notification-button')).toHaveTextContent('Sending...');
      });
      expect(screen.getByTestId('test-notification-button')).toBeDisabled();

      // Resolve the promise
      resolvePromise!({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ success: true })
      });

      // Button should go back to original state
      await waitFor(() => {
        expect(screen.getByTestId('test-notification-button')).toHaveTextContent('Send Test Notification');
      });
    });

    test('button is re-enabled after successful request', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ success: true })
      });

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('test-notification-button')).toHaveTextContent('Send Test Notification');
      });
      expect(screen.getByTestId('test-notification-button')).not.toBeDisabled();
    });
  });

  describe('Send Test Notification - Error Flow', () => {
    test('shows error snackbar when response is not ok with error message', async () => {
      const user = userEvent.setup();
      const setSnackbar = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce({ message: 'Invalid webhook URL' })
      });

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        }),
        setSnackbar
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(setSnackbar).toHaveBeenCalledWith({
          open: true,
          message: 'Invalid webhook URL',
          severity: 'error'
        });
      });
    });

    test('shows default error message when response has no message', async () => {
      const user = userEvent.setup();
      const setSnackbar = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({})
      });

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        }),
        setSnackbar
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(setSnackbar).toHaveBeenCalledWith({
          open: true,
          message: 'Failed to send test notification',
          severity: 'error'
        });
      });
    });

    test('shows error snackbar when fetch throws exception', async () => {
      const user = userEvent.setup();
      const setSnackbar = jest.fn();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        }),
        setSnackbar
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(setSnackbar).toHaveBeenCalledWith({
          open: true,
          message: 'Failed to send test notification',
          severity: 'error'
        });
      });
    });

    test('button is re-enabled after error', async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('test-notification-button')).toHaveTextContent('Send Test Notification');
      });
      expect(screen.getByTestId('test-notification-button')).not.toBeDisabled();
    });
  });

  describe('InfoTooltip Integration', () => {
    test('renders section with InfoTooltip support', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
    });

    test('works without onMobileTooltipClick prop', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({ onMobileTooltipClick: undefined });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('enabling notifications shows webhook field and button', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      const { rerender } = renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByLabelText(/Discord Webhook URL/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-notification-button')).not.toBeInTheDocument();

      // Simulate enabling notifications
      rerender(
        <NotificationsSection
          {...props}
          config={createConfig({ notificationsEnabled: true })}
        />
      );

      expect(screen.getByLabelText(/Discord Webhook URL/i)).toBeInTheDocument();
      expect(screen.getByTestId('test-notification-button')).toBeInTheDocument();
    });

    test('disabling notifications hides webhook field and button', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      const { rerender } = renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Discord Webhook URL/i)).toBeInTheDocument();
      expect(screen.getByTestId('test-notification-button')).toBeInTheDocument();

      // Simulate disabling notifications
      rerender(
        <NotificationsSection
          {...props}
          config={createConfig({ notificationsEnabled: false })}
        />
      );

      expect(screen.queryByLabelText(/Discord Webhook URL/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-notification-button')).not.toBeInTheDocument();
    });

    test('handles complete workflow: enable, configure, and test', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const setSnackbar = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ success: true })
      });

      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false, discordWebhookUrl: '' }),
        onConfigChange,
        setSnackbar
      });
      const { rerender } = renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      // Enable notifications
      const switchControl = screen.getByTestId('notifications-enabled-switch');
      await user.click(switchControl);
      expect(onConfigChange).toHaveBeenCalledWith({ notificationsEnabled: true });

      // Rerender with notifications enabled
      rerender(
        <NotificationsSection
          {...props}
          config={createConfig({ notificationsEnabled: true, discordWebhookUrl: '' })}
        />
      );

      // Change webhook URL
      const input = screen.getByLabelText(/Discord Webhook URL/i);
      await user.type(input, 'https://discord.com/api/webhooks/test');

      // Rerender with webhook URL set
      rerender(
        <NotificationsSection
          {...props}
          config={createConfig({
            notificationsEnabled: true,
            discordWebhookUrl: 'https://discord.com/api/webhooks/test'
          })}
        />
      );

      // Send test notification
      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      expect(setSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Test notification sent! Check your Discord channel.',
        severity: 'success'
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty token', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ success: true })
      });

      const props = createSectionProps({
        token: '',
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/notifications/test', {
          method: 'POST',
          headers: {
            'x-access-token': '',
          },
        });
      });
    });

    test('handles very long webhook URL', async () => {
      const user = userEvent.setup();
      const longUrl = 'https://discord.com/api/webhooks/123456789012345678/very-long-token-that-goes-on-and-on-with-many-characters-abcdefghijklmnopqrstuvwxyz0123456789';
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: longUrl
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Discord Webhook URL/i) as HTMLInputElement;
      expect(input).toHaveValue(longUrl);
    });

    test('handles special characters in webhook URL', async () => {
      const user = userEvent.setup();
      const urlWithSpecialChars = 'https://discord.com/api/webhooks/123/abc-def_ghi.jkl~mno';
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: urlWithSpecialChars
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Discord Webhook URL/i) as HTMLInputElement;
      expect(input).toHaveValue(urlWithSpecialChars);
    });

    test('handles rapid toggle of notifications switch', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false }),
        onConfigChange
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const switchControl = screen.getByTestId('notifications-enabled-switch');

      // Rapidly toggle multiple times
      await user.click(switchControl);
      await user.click(switchControl);
      await user.click(switchControl);

      expect(onConfigChange).toHaveBeenCalledTimes(3);
    });

    test('handles JSON parse error in error response', async () => {
      const user = userEvent.setup();
      const setSnackbar = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockRejectedValueOnce(new Error('JSON parse error'))
      });

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          discordWebhookUrl: 'https://discord.com/api/webhooks/test'
        }),
        setSnackbar
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const button = screen.getByTestId('test-notification-button');
      await user.click(button);

      await waitFor(() => {
        expect(setSnackbar).toHaveBeenCalledWith({
          open: true,
          message: 'Failed to send test notification',
          severity: 'error'
        });
      });
    });
  });

  describe('Accessibility', () => {
    test('switch has accessible structure', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByTestId('notifications-enabled-switch')).toBeInTheDocument();
      expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
    });

    test('text input has accessible label', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Discord Webhook URL/i)).toBeInTheDocument();
    });

    test('button has accessible text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByTestId('test-notification-button')).toHaveTextContent('Send Test Notification');
    });

    test('alert has proper role', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    test('external link has proper attributes for security', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const link = screen.getByRole('link', { name: /How to get a webhook URL/i });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('accordion has proper aria attributes', () => {
      const props = createSectionProps();
      const { container } = renderWithProviders(<NotificationsSection {...props} />);
      const accordionButton = within(container).getByRole('button', { name: /Notifications/i });
      expect(accordionButton).toHaveAttribute('aria-expanded');
    });
  });
});
