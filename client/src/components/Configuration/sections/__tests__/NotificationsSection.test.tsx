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
      expect(screen.getByText(/Apprise/i)).toBeInTheDocument();
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

  describe('Apprise URLs Management - Visibility', () => {
    test('does not show URL input field when notifications are disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByLabelText(/Add Notification URL/i)).not.toBeInTheDocument();
    });

    test('shows URL input field when notifications are enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Add Notification URL/i)).toBeInTheDocument();
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

  describe('Apprise URLs List', () => {
    test('displays configured URLs count', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [
            { url: 'discord://webhook1', name: 'Discord', richFormatting: true },
            { url: 'tgram://bot/chat', name: 'Telegram', richFormatting: true }
          ]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Configured Notification Services \(2\)/i)).toBeInTheDocument();
    });

    test('displays user-friendly names for known services', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [
            { url: 'https://discord.com/api/webhooks/123/abcdefgh', name: 'Discord Webhook', richFormatting: true }
          ]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Discord Webhook/i)).toBeInTheDocument();
    });

    test('shows delete button for each URL', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [
            { url: 'discord://webhook1', name: 'Discord', richFormatting: true }
          ]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('button', { name: /Remove notification URL/i })).toBeInTheDocument();
    });

    test('removes URL when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [
            { url: 'discord://webhook1', name: 'Discord Webhook', richFormatting: true },
            { url: 'tgram://bot/chat', name: 'Telegram Bot', richFormatting: true }
          ]
        }),
        onConfigChange
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const deleteButtons = screen.getAllByRole('button', { name: /Remove notification URL/i });
      await user.click(deleteButtons[0]);

      expect(onConfigChange).toHaveBeenCalledWith({
        appriseUrls: [{ url: 'tgram://bot/chat', name: 'Telegram Bot', richFormatting: true }]
      });
    });
  });

  describe('Adding New URLs', () => {
    test('adds URL when Add button is clicked', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: []
        }),
        onConfigChange
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Notification URL/i);
      await user.type(input, 'discord://webhook_id/token');

      const addButton = screen.getByRole('button', { name: /Add/i });
      await user.click(addButton);

      expect(onConfigChange).toHaveBeenCalledWith({
        appriseUrls: [{ url: 'discord://webhook_id/token', name: 'Discord Webhook', richFormatting: true }]
      });
    });

    test('adds URL when Enter is pressed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: []
        }),
        onConfigChange
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Notification URL/i);
      await user.type(input, 'tgram://bot/chat{enter}');

      expect(onConfigChange).toHaveBeenCalledWith({
        appriseUrls: [{ url: 'tgram://bot/chat', name: 'Telegram Bot', richFormatting: true }]
      });
    });

    test('shows warning when trying to add empty URL', async () => {
      const user = userEvent.setup();
      const setSnackbar = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: []
        }),
        setSnackbar
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const addButton = screen.getByRole('button', { name: /Add/i });
      await user.click(addButton);

      expect(setSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Please enter a notification URL',
        severity: 'warning'
      });
    });

    test('shows warning when trying to add duplicate URL', async () => {
      const user = userEvent.setup();
      const setSnackbar = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [
            { url: 'discord://existing', name: 'Discord', richFormatting: true }
          ]
        }),
        setSnackbar
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Add Notification URL/i);
      await user.type(input, 'discord://existing');

      const addButton = screen.getByRole('button', { name: /Add/i });
      await user.click(addButton);

      expect(setSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'This URL is already added',
        severity: 'warning'
      });
    });

    test('clears input after successful add', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: []
        }),
        onConfigChange
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Notification URL/i) as HTMLInputElement;
      await user.type(input, 'discord://webhook');

      const addButton = screen.getByRole('button', { name: /Add/i });
      await user.click(addButton);

      expect(input).toHaveValue('');
    });
  });

  describe('Individual Webhook Test Buttons', () => {
    test('renders test button for each configured webhook', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [
            { url: 'discord://webhook1', name: 'Discord', richFormatting: true },
            { url: 'tgram://bot/chat', name: 'Telegram', richFormatting: true }
          ]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const testButtons = screen.getAllByRole('button', { name: /Test notification/i });
      expect(testButtons).toHaveLength(2);
    });

    test('displays save reminder text when webhooks are configured', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [{ url: 'discord://test', name: 'Discord', richFormatting: true }]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/save your configuration/i)).toBeInTheDocument();
    });

    test('sends test notification to single webhook on click', async () => {
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
          appriseUrls: [{ url: 'discord://webhook_id/token', name: 'My Discord', richFormatting: true }]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const testButton = screen.getByRole('button', { name: /Test notification/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/notifications/test-single', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': 'my-auth-token',
          },
          body: JSON.stringify({
            url: 'discord://webhook_id/token',
            name: 'My Discord',
            richFormatting: true
          })
        });
      });
    });

    test('shows success message after successful test', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ success: true })
      });

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [{ url: 'discord://test', name: 'Discord', richFormatting: true }]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const testButton = screen.getByRole('button', { name: /Test notification/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Sent successfully/i)).toBeInTheDocument();
      });
    });

    test('shows error message when test fails', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({ message: 'Connection refused' })
      });

      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [{ url: 'discord://test', name: 'Discord', richFormatting: true }]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const testButton = screen.getByRole('button', { name: /Test notification/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Connection refused/i)).toBeInTheDocument();
      });
    });
  });

  describe('Common URL Examples', () => {
    test('displays common URL format examples', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Common URL formats:/i)).toBeInTheDocument();
      expect(screen.getByText(/Discord:/i)).toBeInTheDocument();
      expect(screen.getByText(/Telegram:/i)).toBeInTheDocument();
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
    test('enabling notifications shows URL input and button', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      const { rerender } = renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByLabelText(/Add Notification URL/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-notification-button')).not.toBeInTheDocument();

      // Simulate enabling notifications
      rerender(
        <NotificationsSection
          {...props}
          config={createConfig({ notificationsEnabled: true })}
        />
      );

      expect(screen.getByLabelText(/Add Notification URL/i)).toBeInTheDocument();
      expect(screen.getByTestId('test-notification-button')).toBeInTheDocument();
    });

    test('disabling notifications hides URL input and button', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      const { rerender } = renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Add Notification URL/i)).toBeInTheDocument();
      expect(screen.getByTestId('test-notification-button')).toBeInTheDocument();

      // Simulate disabling notifications
      rerender(
        <NotificationsSection
          {...props}
          config={createConfig({ notificationsEnabled: false })}
        />
      );

      expect(screen.queryByLabelText(/Add Notification URL/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-notification-button')).not.toBeInTheDocument();
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

      expect(screen.getByLabelText(/Add Notification URL/i)).toBeInTheDocument();
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

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });

    test('accordion has proper aria attributes', () => {
      const props = createSectionProps();
      const { container } = renderWithProviders(<NotificationsSection {...props} />);
      const accordionButton = within(container).getByRole('button', { name: /Notifications/i });
      expect(accordionButton).toHaveAttribute('aria-expanded');
    });

    test('delete buttons have accessible labels', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [
            { url: 'discord://test', name: 'Discord', richFormatting: true }
          ]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('button', { name: /Remove notification URL/i })).toBeInTheDocument();
    });
  });
});
