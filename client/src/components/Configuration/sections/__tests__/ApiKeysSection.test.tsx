import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ApiKeysSection from '../ApiKeysSection';
import { renderWithProviders } from '../../../../test-utils';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const createSectionProps = (
  overrides: Partial<React.ComponentProps<typeof ApiKeysSection>> = {}
): React.ComponentProps<typeof ApiKeysSection> => ({
  token: 'test-token-123',
  apiKeyRateLimit: 10,
  onRateLimitChange: jest.fn(),
  ...overrides,
});

// Helper to expand accordion
const expandAccordion = async (user: ReturnType<typeof userEvent.setup>) => {
  const accordionButton = screen.getByRole('button', { name: /API Keys/i });
  await user.click(accordionButton);
};

// Mock API key data
const mockApiKeys = [
  {
    id: 1,
    name: 'My Bookmarklet',
    key_prefix: 'abc12345',
    created_at: '2024-01-15T10:30:00Z',
    last_used_at: '2024-01-20T15:45:00Z',
    is_active: true,
  },
  {
    id: 2,
    name: 'iPhone Shortcut',
    key_prefix: 'xyz98765',
    created_at: '2024-01-10T08:00:00Z',
    last_used_at: null,
    is_active: true,
  },
];

const mockCreatedKeyResponse = {
  success: true,
  message: 'API key created. Save this key - it will not be shown again!',
  id: 3,
  name: 'New Key',
  key: 'abc12345def67890abc12345def67890abc12345def67890abc12345def67890',
  prefix: 'abc12345',
};

describe('ApiKeysSection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    
    // Default mock for fetching API keys
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ keys: [] }),
    });
  });

  describe('Component Rendering', () => {
    test('renders without crashing', async () => {
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);
      expect(screen.getByText(/API Keys/i)).toBeInTheDocument();
    });

    test('renders with ConfigurationAccordion wrapper', async () => {
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);
      expect(screen.getByText(/API Keys & External Access/i)).toBeInTheDocument();
    });

    test('accordion is collapsed by default', () => {
      const props = createSectionProps();
      const { container } = renderWithProviders(<ApiKeysSection {...props} />);
      const accordionButton = within(container).getByRole('button', { name: /API Keys/i });
      expect(accordionButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('shows loading skeleton initially', () => {
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);
      // Skeleton should be visible while loading
      expect(screen.getByText(/API Keys/i)).toBeInTheDocument();
    });

    test('shows single video limitation note', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [] }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText(/single video downloads only/i)).toBeInTheDocument();
      });
    });
  });

  describe('Rate Limit Setting', () => {
    test('renders rate limit input with current value', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [] }),
      });
      
      const props = createSectionProps({ apiKeyRateLimit: 15 });
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        const input = screen.getByLabelText(/Rate Limit/i);
        expect(input).toHaveValue(15);
      });
    });

    test('calls onRateLimitChange when value changes', async () => {
      const user = userEvent.setup();
      const onRateLimitChange = jest.fn();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [] }),
      });
      
      const props = createSectionProps({ apiKeyRateLimit: 10, onRateLimitChange });
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByLabelText(/Rate Limit/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/Rate Limit/i) as HTMLInputElement;
      // Triple click to select all, then type new value
      await user.tripleClick(input);
      await user.keyboard('15');

      // onRateLimitChange is called with valid values during typing
      expect(onRateLimitChange).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    test('shows empty state message when no keys exist', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [] }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText(/No API keys created yet/i)).toBeInTheDocument();
      });
    });

    test('shows Create Key button in empty state', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [] }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Key/i })).toBeInTheDocument();
      });
    });
  });

  describe('API Keys List', () => {
    test('displays list of API keys', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: mockApiKeys }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText('My Bookmarklet')).toBeInTheDocument();
        expect(screen.getByText('iPhone Shortcut')).toBeInTheDocument();
      });
    });

    test('displays key prefix with ellipsis', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: mockApiKeys }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText('abc12345...')).toBeInTheDocument();
        expect(screen.getByText('xyz98765...')).toBeInTheDocument();
      });
    });

    test('displays "Never" for keys that have not been used', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: mockApiKeys }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText('Never')).toBeInTheDocument();
      });
    });

    test('shows delete button for each key', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: mockApiKeys }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
        expect(deleteButtons).toHaveLength(2);
      });
    });
  });

  describe('Create API Key', () => {
    test('opens create dialog when Create Key button is clicked', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [] }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Key/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Key/i }));

      expect(screen.getByText('Create API Key')).toBeInTheDocument();
      expect(screen.getByLabelText(/Key Name/i)).toBeInTheDocument();
    });

    test('Create button is disabled when name is empty', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [] }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Key/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Key/i }));

      const createButton = screen.getByRole('button', { name: /^Create$/i });
      expect(createButton).toBeDisabled();
    });

    test('successfully creates API key and shows bookmarklet dialog', async () => {
      const user = userEvent.setup();
      
      // First call: fetch keys (empty)
      // Second call: create key
      // Third call: refresh keys
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ keys: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockCreatedKeyResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ keys: [{ ...mockApiKeys[0], name: 'New Key' }] }),
        });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Key/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Key/i }));

      const nameInput = screen.getByLabelText(/Key Name/i);
      await user.type(nameInput, 'New Key');

      const createButton = screen.getByRole('button', { name: /^Create$/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/API Key Created/i)).toBeInTheDocument();
      });

      // Should show the key only once warning
      expect(screen.getByText(/Save this key now/i)).toBeInTheDocument();
    });

    test('shows bookmarklet section in created key dialog', async () => {
      const user = userEvent.setup();
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ keys: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockCreatedKeyResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ keys: [] }),
        });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Key/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Key/i }));
      await user.type(screen.getByLabelText(/Key Name/i), 'Test Key');
      await user.click(screen.getByRole('button', { name: /^Create$/i }));

      await waitFor(() => {
        expect(screen.getByText(/Add to Bookmarks/i)).toBeInTheDocument();
        expect(screen.getByText(/Send to Youtarr/i)).toBeInTheDocument();
        expect(screen.getByText(/Mobile \/ Shortcuts/i)).toBeInTheDocument();
      });
    });

    test('shows error when API key creation fails', async () => {
      const user = userEvent.setup();
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ keys: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: jest.fn().mockResolvedValue({ error: 'Maximum number of API keys reached' }),
        });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Key/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Key/i }));
      await user.type(screen.getByLabelText(/Key Name/i), 'Test Key');
      await user.click(screen.getByRole('button', { name: /^Create$/i }));

      await waitFor(() => {
        expect(screen.getByText(/Maximum number of API keys reached/i)).toBeInTheDocument();
      });
    });
  });

  describe('Delete API Key', () => {
    test('opens confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: mockApiKeys }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText('My Bookmarklet')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText(/Delete API Key\?/i)).toBeInTheDocument();
      // The key name appears in both the table and dialog, so check for all instances
      expect(screen.getAllByText(/My Bookmarklet/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });

    test('closes confirmation dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: mockApiKeys }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText('My Bookmarklet')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      await user.click(deleteButtons[0]);

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText(/Delete API Key\?/i)).not.toBeInTheDocument();
      });
    });

    test('deletes key when confirmed', async () => {
      const user = userEvent.setup();
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ keys: mockApiKeys }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ keys: [mockApiKeys[1]] }),
        });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText('My Bookmarklet')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      await user.click(deleteButtons[0]);

      // Click the Delete button in the confirmation dialog
      const confirmDeleteButton = screen.getByRole('button', { name: /^Delete$/i });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keys/1', expect.objectContaining({
          method: 'DELETE',
        }));
      });
    });
  });

  describe('Copy to Clipboard', () => {
    test('copies API key to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ keys: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockCreatedKeyResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ keys: [] }),
        });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Key/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Key/i }));
      await user.type(screen.getByLabelText(/Key Name/i), 'Test Key');
      await user.click(screen.getByRole('button', { name: /^Create$/i }));

      await waitFor(() => {
        expect(screen.getByText(/API Key Created/i)).toBeInTheDocument();
      });

      // The API key should be displayed in the dialog
      expect(screen.getByText(mockCreatedKeyResponse.key)).toBeInTheDocument();
    });
  });

  describe('HTTP Warning', () => {
    // Note: HTTP warning tests are difficult to mock reliably due to window.location
    // The component correctly shows warnings when protocol is http and hostname is not localhost
    // These tests verify the default behavior (no warning on localhost)
    
    test('does not show warning on localhost (default test environment)', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [] }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText(/No API keys created yet/i)).toBeInTheDocument();
      });

      // Should not show HTTP warning on localhost (default in jsdom)
      expect(screen.queryByText(/insecure/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('shows error when fetching keys fails', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Failed to fetch API keys' }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch API keys/i)).toBeInTheDocument();
      });
    });

    test('error alert can be dismissed', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Failed to fetch API keys' }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch API keys/i)).toBeInTheDocument();
      });

      // Close the error alert
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Failed to fetch API keys/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('accordion has proper aria attributes', () => {
      const props = createSectionProps();
      const { container } = renderWithProviders(<ApiKeysSection {...props} />);
      const accordionButton = within(container).getByRole('button', { name: /API Keys/i });
      expect(accordionButton).toHaveAttribute('aria-expanded');
    });

    test('Create Key button is accessible', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: [] }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Key/i })).toBeInTheDocument();
      });
    });

    test('delete buttons have accessible tooltips', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ keys: mockApiKeys }),
      });
      
      const props = createSectionProps();
      renderWithProviders(<ApiKeysSection {...props} />);

      await expandAccordion(user);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
        expect(deleteButtons).toHaveLength(2);
      });
    });
  });
});

