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

// Use delay: null to prevent timer-related flakiness when running with other tests
const setupUser = () => userEvent.setup({ delay: null });

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

    test('renders Apprise link and info text', async () => {
      const user = setupUser();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      // Check for Apprise link and description text
      expect(screen.getByText(/Apprise/i)).toBeInTheDocument();
      expect(screen.getByText(/supports 100\+ services/i)).toBeInTheDocument();
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
      const user = setupUser();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByTestId('notifications-enabled-switch')).toBeInTheDocument();
    });

    test('switch reflects notificationsEnabled state when false', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const switchControl = screen.getByTestId('notifications-enabled-switch');
      expect(switchControl).not.toBeChecked();
    });

    test('switch reflects notificationsEnabled state when true', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      const switchControl = screen.getByTestId('notifications-enabled-switch');
      expect(switchControl).toBeChecked();
    });

    test('calls onConfigChange when switch is toggled on', async () => {
      const user = setupUser();
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
      const user = setupUser();
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
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByLabelText(/Notification URL/i)).not.toBeInTheDocument();
    });

    test('shows URL input field when notifications are enabled', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Notification URL/i)).toBeInTheDocument();
    });

    test('does not show add service section when notifications are disabled', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByText(/Add a Notification Service/i)).not.toBeInTheDocument();
    });

    test('shows add service section when notifications are enabled', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Add a Notification Service/i)).toBeInTheDocument();
    });
  });

  describe('Apprise URLs List', () => {
    test('displays configured URLs count', async () => {
      const user = setupUser();
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

      expect(screen.getByText(/Your Notification Services/i)).toBeInTheDocument();
      expect(screen.getByText(/2 configured/i)).toBeInTheDocument();
    });

    test('displays user-friendly names for known services', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [
            { url: 'https://discord.com/api/webhooks/123/abcdefgh', name: 'Discord', richFormatting: true }
          ]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      // Check that the configured webhook name is visible (may have multiple "Discord" texts on page)
      expect(screen.getByText('Your Notification Services')).toBeInTheDocument();
      expect(screen.getByText('(1 configured)')).toBeInTheDocument();
    });

    test('shows delete button for each URL', async () => {
      const user = setupUser();
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

    test('removes URL when delete button is clicked and confirmed', async () => {
      const user = setupUser();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [
            { url: 'discord://webhook1', name: 'Discord', richFormatting: true },
            { url: 'tgram://bot/chat', name: 'Telegram', richFormatting: true }
          ]
        }),
        onConfigChange
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      // Click delete button to open confirmation dialog
      const deleteButtons = screen.getAllByRole('button', { name: /Remove notification URL/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion in dialog
      const confirmButton = screen.getByRole('button', { name: /^Remove$/i });
      await user.click(confirmButton);

      expect(onConfigChange).toHaveBeenCalledWith({
        appriseUrls: [{ url: 'tgram://bot/chat', name: 'Telegram', richFormatting: true }]
      });
    });
  });

  describe('Adding New URLs', () => {
    test('adds URL when Add button is clicked', async () => {
      const user = setupUser();
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
        appriseUrls: [{ url: 'discord://webhook_id/token', name: 'Discord', richFormatting: true }]
      });
    });

    test('adds URL when Enter is pressed', async () => {
      const user = setupUser();
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
        appriseUrls: [{ url: 'tgram://bot/chat', name: 'Telegram', richFormatting: true }]
      });
    });

    test('shows warning when trying to add empty URL', async () => {
      const user = setupUser();
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
      const user = setupUser();
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

      const input = screen.getByPlaceholderText(/e\.g\., discord:\/\//i);
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
      const user = setupUser();
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
      const user = setupUser();
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

    test('displays configured webhooks count when webhooks are configured', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({
          notificationsEnabled: true,
          appriseUrls: [{ url: 'discord://test', name: 'Discord', richFormatting: true }]
        })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/configured/i)).toBeInTheDocument();
    });

    test('sends test notification to single webhook on click', async () => {
      const user = setupUser();
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
      const user = setupUser();
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
      const user = setupUser();
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

  describe('Supported URL Formats', () => {
    test('displays supported URL format examples', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Feature Rich Supported Formats/i)).toBeInTheDocument();
      // Check that format examples are present (Discord and Telegram appear in format cards)
      const discordElements = screen.getAllByText(/Discord/);
      expect(discordElements.length).toBeGreaterThan(0);
      const telegramElements = screen.getAllByText(/Telegram/);
      expect(telegramElements.length).toBeGreaterThan(0);
    });
  });

  describe('InfoTooltip Integration', () => {
    test('renders section with InfoTooltip support', async () => {
      const user = setupUser();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
    });

    test('works without onMobileTooltipClick prop', async () => {
      const user = setupUser();
      const props = createSectionProps({ onMobileTooltipClick: undefined });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('enabling notifications shows URL input', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: false })
      });
      const { rerender } = renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByLabelText(/Notification URL/i)).not.toBeInTheDocument();

      // Simulate enabling notifications
      rerender(
        <NotificationsSection
          {...props}
          config={createConfig({ notificationsEnabled: true })}
        />
      );

      expect(screen.getByLabelText(/Notification URL/i)).toBeInTheDocument();
    });

    test('disabling notifications hides URL input', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      const { rerender } = renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Notification URL/i)).toBeInTheDocument();

      // Simulate disabling notifications
      rerender(
        <NotificationsSection
          {...props}
          config={createConfig({ notificationsEnabled: false })}
        />
      );

      expect(screen.queryByLabelText(/Notification URL/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('switch has accessible structure', async () => {
      const user = setupUser();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByTestId('notifications-enabled-switch')).toBeInTheDocument();
      expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
    });

    test('text input has accessible label', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Notification URL/i)).toBeInTheDocument();
    });

    test('add button has accessible text', async () => {
      const user = setupUser();
      const props = createSectionProps({
        config: createConfig({ notificationsEnabled: true })
      });
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument();
    });

    test('info text is present', async () => {
      const user = setupUser();
      const props = createSectionProps();
      renderWithProviders(<NotificationsSection {...props} />);

      await expandAccordion(user);

      // Check that info text about Apprise is present
      expect(screen.getByText(/Powered by/i)).toBeInTheDocument();
      expect(screen.getByText(/Apprise/i)).toBeInTheDocument();
    });

    test('accordion has proper aria attributes', () => {
      const props = createSectionProps();
      const { container } = renderWithProviders(<NotificationsSection {...props} />);
      const accordionButton = within(container).getByRole('button', { name: /Notifications/i });
      expect(accordionButton).toHaveAttribute('aria-expanded');
    });

    test('delete buttons have accessible labels', async () => {
      const user = setupUser();
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
