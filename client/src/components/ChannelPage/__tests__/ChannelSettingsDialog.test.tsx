import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelSettingsDialog from '../ChannelSettingsDialog';
import { useConfig } from '../../../hooks/useConfig';
import { DEFAULT_CONFIG } from '../../../config/configSchema';

// Mock the useConfig hook
const mockRefetchConfig = jest.fn();

jest.mock('../../../hooks/useConfig', () => ({
  useConfig: jest.fn(),
}));

const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;

describe('ChannelSettingsDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSettingsSaved = jest.fn();
  let mockFetch: jest.Mock;

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    channelId: 'channel123',
    channelName: 'Test Channel',
    token: 'test-token',
    onSettingsSaved: mockOnSettingsSaved,
  };

  const mockChannelSettings = {
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
    audio_format: null,
  };

  const mockSubfolders = ['__Sports', '__Music', '__Tech'];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    mockRefetchConfig.mockResolvedValue(undefined);
    // Reset mockUseConfig to default
    mockUseConfig.mockReturnValue({
      config: { ...DEFAULT_CONFIG, preferredResolution: '1080' },
      refetch: mockRefetchConfig,
      loading: false,
      error: null,
      initialConfig: null,
      isPlatformManaged: {
        plexUrl: false,
        authEnabled: true,
        useTmpForDownloads: false
      },
      deploymentEnvironment: {
        platform: null,
        isWsl: false,
      },
      setConfig: jest.fn(),
      setInitialConfig: jest.fn(),
    });
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Component Rendering', () => {
    test('renders dialog when open is true', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      expect(screen.getByText('Channel Settings: Test Channel')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/channels/channel123/settings', {
          headers: { 'x-access-token': 'test-token' },
        });
      });
    });

    test('does not render dialog when open is false', () => {
      render(<ChannelSettingsDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Channel Settings: Test Channel')).not.toBeInTheDocument();
    });

    test('shows loading spinner while fetching data', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<ChannelSettingsDialog {...defaultProps} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('renders all form controls after loading', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      expect(screen.getByLabelText('Channel Video Quality Override')).toBeInTheDocument();
      expect(screen.getByLabelText('Subfolder')).toBeInTheDocument();
      expect(screen.getByLabelText('Min Duration (mins)')).toBeInTheDocument();
      expect(screen.getByLabelText('Max Duration (mins)')).toBeInTheDocument();
      expect(screen.getByLabelText('Title Filter (Python Regex)')).toBeInTheDocument();
    });
  });

  describe('Data Loading', () => {
    test('loads channel settings on dialog open', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            sub_folder: 'Sports',
            video_quality: '720',
            min_duration: 300,
            max_duration: 3600,
            title_filter_regex: '(?i)highlight',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/channels/channel123/settings', {
          headers: { 'x-access-token': 'test-token' },
        });
      });

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const subfolderInput = screen.getByLabelText('Subfolder');
      expect(subfolderInput).toHaveValue('__Sports');

      const minDurationInput = screen.getByLabelText('Min Duration (mins)');
      expect(minDurationInput).toHaveValue(5);

      const maxDurationInput = screen.getByLabelText('Max Duration (mins)');
      expect(maxDurationInput).toHaveValue(60);

      const regexInput = screen.getByLabelText('Title Filter (Python Regex)');
      expect(regexInput).toHaveValue('(?i)highlight');
    });

    test('loads subfolders list', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(['__Sports', '__Music']),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/channels/subfolders', {
          headers: { 'x-access-token': 'test-token' },
        });
      });
    });

    test('refetches config when dialog opens', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockRefetchConfig).toHaveBeenCalled();
      });
    });

    test('shows error when settings load fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load channel settings')).toBeInTheDocument();
      });
    });

    test('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    test('continues loading if subfolder fetch fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockRejectedValueOnce(new Error('Subfolder error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      expect(screen.getByLabelText('Subfolder')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Video Quality Settings', () => {
    test('displays quality options in dropdown', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('360p')).toBeInTheDocument();
      expect(within(listbox).getByText('480p')).toBeInTheDocument();
      expect(within(listbox).getByText('720p (HD)')).toBeInTheDocument();
      expect(within(listbox).getByText('1080p (Full HD)')).toBeInTheDocument();
      expect(within(listbox).getByText('1440p (2K)')).toBeInTheDocument();
      expect(within(listbox).getByText('2160p (4K)')).toBeInTheDocument();
    });

    test('changes video quality selection', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);

      const option720 = screen.getByText('720p (HD)');
      await user.click(option720);

      expect(screen.getByText(/Effective channel quality: 720p \(channel\)/i)).toBeInTheDocument();
    });

    test('shows global quality when no channel override', async () => {
      // Set useConfig to return 720p
      mockUseConfig.mockReturnValue({
        config: { ...DEFAULT_CONFIG, preferredResolution: '720' },
        refetch: mockRefetchConfig,
        loading: false,
        error: null,
        initialConfig: null,
        isPlatformManaged: {
          plexUrl: false,
          authEnabled: true,
          useTmpForDownloads: false
        },
        deploymentEnvironment: {
          platform: null,
          isWsl: false,
        },
        setConfig: jest.fn(),
        setInitialConfig: jest.fn(),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Effective channel quality: 720p \(global\)/i)).toBeInTheDocument();
      });
    });

    test('shows channel quality when override is set', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            ...mockChannelSettings,
            video_quality: '1440',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Effective channel quality: 1440p \(channel\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('Subfolder Settings', () => {
    test('renders subfolder autocomplete with existing value', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            ...mockChannelSettings,
            sub_folder: 'Sports',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const subfolderInput = screen.getByLabelText('Subfolder');
      expect(subfolderInput).toHaveValue('__Sports');
    });

    test('allows adding new subfolder via Add Subfolder dialog', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Open the subfolder dropdown
      const subfolderInput = screen.getByLabelText('Subfolder');
      await user.click(subfolderInput);

      // Click "Add Subfolder" option
      const addOption = await screen.findByText('Add Subfolder');
      await user.click(addOption);

      // The Add Subfolder dialog should open
      expect(screen.getByText('Add New Subfolder')).toBeInTheDocument();

      // Enter a new subfolder name
      const dialogInput = screen.getByLabelText('Subfolder Name');
      await user.type(dialogInput, 'Gaming');

      // Click Add button
      const addButton = screen.getByRole('button', { name: 'Add Subfolder' });
      await user.click(addButton);

      // The dialog should close and the new value should be selected
      await waitFor(() => {
        expect(screen.queryByText('Add New Subfolder')).not.toBeInTheDocument();
      });

      // The input should show the new subfolder
      expect(subfolderInput).toHaveValue('__Gaming');
    });

    test('sends clean subfolder name when saving via Add Subfolder', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            settings: { ...mockChannelSettings, sub_folder: 'Gaming' },
          }),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Open the subfolder dropdown and add a new subfolder
      const subfolderInput = screen.getByLabelText('Subfolder');
      await user.click(subfolderInput);

      const addOption = await screen.findByText('Add Subfolder');
      await user.click(addOption);

      const dialogInput = screen.getByLabelText('Subfolder Name');
      await user.type(dialogInput, 'Gaming');

      const addButton = screen.getByRole('button', { name: 'Add Subfolder' });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.queryByText('Add New Subfolder')).not.toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      // Verify the component sends the clean subfolder name to API
      await waitFor(() => {
        const putCall = mockFetch.mock.calls.find(
          call => call[0] === '/api/channels/channel123/settings' && call[1]?.method === 'PUT'
        );
        expect(putCall).toBeDefined();
      });

      const putCall = mockFetch.mock.calls.find(
        call => call[0] === '/api/channels/channel123/settings' && call[1]?.method === 'PUT'
      );
      const body = JSON.parse(putCall[1].body);
      // Should send the clean subfolder name to API (without __ prefix)
      expect(body.sub_folder).toBe('Gaming');
    });

    test('shows warning about moving folder', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Changing the subfolder will move the channel's existing folder/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Duration Filters', () => {
    test('converts seconds to minutes when loading', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            ...mockChannelSettings,
            min_duration: 180,
            max_duration: 1800,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const minDurationInput = screen.getByLabelText('Min Duration (mins)');
      expect(minDurationInput).toHaveValue(3);

      const maxDurationInput = screen.getByLabelText('Max Duration (mins)');
      expect(maxDurationInput).toHaveValue(30);
    });

    test('converts minutes to seconds when saving', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            settings: { ...mockChannelSettings, min_duration: 600, max_duration: 3600 },
          }),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const minDurationInput = screen.getByLabelText('Min Duration (mins)');
      await user.clear(minDurationInput);
      await user.type(minDurationInput, '10');

      const maxDurationInput = screen.getByLabelText('Max Duration (mins)');
      await user.clear(maxDurationInput);
      await user.type(maxDurationInput, '60');

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/channels/channel123/settings',
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('"min_duration":600'),
          })
        );
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/channels/channel123/settings',
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('"max_duration":3600'),
          })
        );
      });
    });

    test('allows only numeric input for duration', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const minDurationInput = screen.getByLabelText('Min Duration (mins)');
      await user.type(minDurationInput, 'abc');

      expect(minDurationInput).toHaveValue(null);
    });

    test('clears duration when input is empty', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            ...mockChannelSettings,
            min_duration: 300,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const minDurationInput = screen.getByLabelText('Min Duration (mins)');
      expect(minDurationInput).toHaveValue(5);

      await user.clear(minDurationInput);

      expect(minDurationInput).toHaveValue(null);
    });
  });

  describe('Title Filter Regex', () => {
    test('renders title filter input', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      expect(screen.getByLabelText('Title Filter (Python Regex)')).toBeInTheDocument();
      expect(
        screen.getByText(/Only download videos with titles matching regex pattern/i)
      ).toBeInTheDocument();
    });

    test('updates regex value on input', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const regexInput = screen.getByLabelText('Title Filter (Python Regex)');
      await user.type(regexInput, '(?i)podcast');

      expect(regexInput).toHaveValue('(?i)podcast');
    });

    test('renders preview button', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Preview Regex' })).toBeInTheDocument();
    });

    test('disables preview button when no regex entered', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const previewButton = screen.getByRole('button', { name: 'Preview Regex' });
      expect(previewButton).toBeDisabled();
    });

    test('loads preview when button clicked', async () => {
      const user = userEvent.setup();

      const mockPreviewResult = {
        videos: [
          { video_id: '1', title: 'Test Video 1', upload_date: '2024-01-01', matches: true },
          { video_id: '2', title: 'Another Video', upload_date: '2024-01-02', matches: false },
        ],
        totalCount: 2,
        matchCount: 1,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            ...mockChannelSettings,
            title_filter_regex: '(?i)test',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockPreviewResult),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const previewButton = screen.getByRole('button', { name: 'Preview Regex' });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('1 of 2 recent videos match')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Video 1')).toBeInTheDocument();
      expect(screen.getByText('Another Video')).toBeInTheDocument();
    });

    test('shows error when preview fails', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            ...mockChannelSettings,
            title_filter_regex: '(?i)test',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: jest.fn().mockResolvedValueOnce({ error: 'Invalid regex' }),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const previewButton = screen.getByRole('button', { name: 'Preview Regex' });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid regex')).toBeInTheDocument();
      });
    });

    test('renders documentation link', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const docLink = screen.getByTitle('Python regex documentation');
      expect(docLink).toHaveAttribute(
        'href',
        'https://docs.python.org/3/library/re.html#regular-expression-syntax'
      );
      expect(docLink).toHaveAttribute('target', '_blank');
      expect(docLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Save Functionality', () => {
    test('saves settings when save button clicked', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            settings: { ...mockChannelSettings, video_quality: '720' },
          }),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/channels/channel123/settings',
          expect.objectContaining({
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-access-token': 'test-token',
            },
          })
        );
      });
    });

    test('shows success message after save', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            settings: { ...mockChannelSettings, video_quality: '720' },
          }),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
      });
    });

    test('calls onSettingsSaved callback after successful save', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            settings: { ...mockChannelSettings, video_quality: '720' },
          }),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSettingsSaved).toHaveBeenCalledWith({
          ...mockChannelSettings,
          video_quality: '720',
        });
      });
    });

    test('closes dialog after successful save', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            settings: { ...mockChannelSettings, video_quality: '720' },
          }),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(mockOnClose).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });

    test('shows error when save fails', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: jest.fn().mockRejectedValueOnce(new Error('Parse error')),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Server error: 500 Internal Server Error')).toBeInTheDocument();
      });
    });

    test('shows specific error for 409 conflict', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Change quality to enable save button
      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Cannot change subfolder while downloads are in progress/i)
        ).toBeInTheDocument();
      });
    });

    test('disables save button when no changes made', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: 'Save' });
      expect(saveButton).toBeDisabled();
    });

    test('enables save button when changes are made', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: 'Save' });
      expect(saveButton).toBeDisabled();

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Cancel Functionality', () => {
    test('closes dialog when cancel button clicked', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('reverts changes when cancel is clicked', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      const { rerender } = render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      expect(screen.getByText(/Effective channel quality: 720p \(channel\)/i)).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();

      rerender(<ChannelSettingsDialog {...defaultProps} open={false} />);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      rerender(<ChannelSettingsDialog {...defaultProps} open={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Effective channel quality: 1080p \(global\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('State Reset on Dialog Close', () => {
    test('reloads data when dialog reopens', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      const { rerender } = render(<ChannelSettingsDialog {...defaultProps} open={true} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      rerender(<ChannelSettingsDialog {...defaultProps} open={false} />);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      rerender(<ChannelSettingsDialog {...defaultProps} open={true} />);

      await waitFor(() => {
        // 2 calls on first open (settings + subfolders) + 2 calls on second open
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });
    });
  });

  describe('Informational Alerts', () => {
    test('renders subfolder organization info', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Subfolder Organization')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Subfolders are automatically prefixed with/i)
      ).toBeInTheDocument();
    });

    test('renders download filters info', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Download Filters')).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          /These filters only apply to channel downloads\. Manually selected videos will always download\./i
        )
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles missing onSettingsSaved callback', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            settings: { ...mockChannelSettings, video_quality: '720' },
          }),
        });

      render(<ChannelSettingsDialog {...defaultProps} onSettingsSaved={undefined} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      const saveButton = screen.getByRole('button', { name: 'Save' });

      expect(() => user.click(saveButton)).not.toThrow();
    });

    test('handles null token', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      render(<ChannelSettingsDialog {...defaultProps} token={null} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/channels/channel123/settings',
          expect.objectContaining({
            headers: { 'x-access-token': '' },
          })
        );
      });
    });

    test('closes error alert when close button clicked', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load channel settings')).toBeInTheDocument();
      });

      const alerts = screen.getAllByRole('button', { name: /close/i });
      await user.click(alerts[0]);

      await waitFor(() => {
        expect(screen.queryByText('Failed to load channel settings')).not.toBeInTheDocument();
      });
    });

    test('handles folderMoved result in response', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockChannelSettings),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            settings: { ...mockChannelSettings, sub_folder: 'NewFolder' },
            folderMoved: true,
            moveResult: { success: true, from: 'OldFolder', to: 'NewFolder' },
          }),
        });

      render(<ChannelSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Change quality to enable save button
      const qualitySelect = screen.getByLabelText('Channel Video Quality Override');
      await user.click(qualitySelect);
      await user.click(screen.getByText('720p (HD)'));

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Channel folder moved:',
          expect.objectContaining({ success: true })
        );
      });

      consoleSpy.mockRestore();
    });
  });
});
