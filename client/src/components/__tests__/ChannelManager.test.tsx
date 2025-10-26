import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import axios from 'axios';
import useMediaQuery from '@mui/material/useMediaQuery';
import ChannelManager from '../ChannelManager';
import { BrowserRouter } from 'react-router-dom';
import { Channel } from '../../types/Channel';
import { renderWithProviders, createMockWebSocketContext } from '../../test-utils';
jest.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: { preferredResolution: '1080' },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('axios', () => {
  const mock = {
    get: jest.fn(),
    post: jest.fn(),
  };
  return {
    __esModule: true,
    default: mock,
    get: mock.get,
    post: mock.post,
  };
});
jest.mock('@mui/material/useMediaQuery');

jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({
    breakpoints: { down: () => false },
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockedAxios = axios as unknown as { get: jest.Mock; post: jest.Mock };

const mockChannels: Channel[] = [
  { url: 'https://www.youtube.com/@TechChannel', uploader: 'Tech Channel', channel_id: 'UC123456' },
  { url: 'https://www.youtube.com/@GamingChannel', uploader: 'Gaming Channel', channel_id: 'UC789012' },
  { url: 'https://www.youtube.com/@CookingChannel', uploader: 'Cooking Channel', channel_id: 'UC345678' },
];

describe('ChannelManager Component', () => {
  const mockToken = 'test-token';
  let wsCtx: ReturnType<typeof createMockWebSocketContext>;

  const renderChannelManager = (token: string | null = mockToken) => {
    wsCtx = createMockWebSocketContext();
    return renderWithProviders(<ChannelManager token={token} />, { websocketValue: wsCtx });
  };

  const mockGetChannelsOnce = (channels: Channel[]) => {
    mockedAxios.get.mockResolvedValueOnce({ data: channels } as any);
  };

  const mockAddChannelSuccessOnce = (channelInfo: Channel) => {
    mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success', channelInfo } } as any);
  };

  const addChannel = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
    const input = await screen.findByLabelText('Add a new channel');
    await user.type(input, value);
    await user.click(screen.getByTestId('add-channel-button'));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    mockNavigate.mockClear();
  });

  describe('Component Rendering', () => {
    test('renders channel manager with title and fetches', async () => {
      mockGetChannelsOnce([]);
      renderChannelManager();
      expect(screen.getByText('Your Channels')).toBeInTheDocument();
      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    });

    test('fetches and displays channels when token is provided', async () => {
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();

      await screen.findByText('Tech Channel');
      expect(mockedAxios.get).toHaveBeenCalledWith('/getchannels', { headers: { 'x-access-token': mockToken } });
      expect(screen.getByText('Gaming Channel')).toBeInTheDocument();
      expect(screen.getByText('Cooking Channel')).toBeInTheDocument();
    });

    test('does not fetch channels when token is null', () => {
      renderChannelManager(null);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    test('sorts channels alphabetically by uploader name', async () => {
      const unsortedChannels = [
        { url: 'url3', uploader: 'Zebra Channel', channel_id: 'UC333' },
        { url: 'url1', uploader: 'Alpha Channel', channel_id: 'UC111' },
        { url: 'url2', uploader: 'Beta Channel', channel_id: 'UC222' }
      ];

      mockGetChannelsOnce(unsortedChannels as any);
      renderChannelManager();

      await screen.findByText('Alpha Channel');
      const listItems = screen.getAllByRole('listitem');
      const texts = listItems.map((li: HTMLElement) => (within(li).queryByText(/Channel$/)?.textContent ?? '').trim()).filter(Boolean);
      expect(texts).toEqual(['Alpha Channel', 'Beta Channel', 'Zebra Channel']);
    });

  });

  describe('Thumbnail Handling', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockedAxios.get.mockReset();
      mockedAxios.post.mockReset();
    });

    test('displays channel thumbnails with correct source', async () => {
      mockGetChannelsOnce([mockChannels[0]]);
      renderChannelManager();
      await screen.findByText('Tech Channel');

      const thumbnail = screen.getByAltText('Tech Channel thumbnail') as HTMLImageElement;
      expect(thumbnail).toHaveAttribute('src', '/images/channelthumb-UC123456.jpg');
    });

    test('handles thumbnail loading errors by hiding the image', async () => {
      mockGetChannelsOnce([mockChannels[0]]);
      renderChannelManager();
      await screen.findByText('Tech Channel');

      const thumbnail = screen.getByAltText('Tech Channel thumbnail') as HTMLImageElement;
      fireEvent.error(thumbnail);
      expect(thumbnail.style.display).toBe('none');
    });

    test('shows thumbnail on successful load', async () => {
      mockGetChannelsOnce([mockChannels[0]]);
      renderChannelManager();
      await screen.findByText('Tech Channel');

      const thumbnail = screen.getByAltText('Tech Channel thumbnail') as HTMLImageElement;
      fireEvent.load(thumbnail);
      expect(thumbnail.style.display).toBe('');
    });
  });

  describe('Adding Channels', () => {
    test('adds a new channel with @ handle format', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      await addChannel(user, '@NewChannel');
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
        '/addchannelinfo',
        { url: 'https://www.youtube.com/@NewChannel' },
        { headers: { 'x-access-token': mockToken } }
      ));
    });

    test('adds a new channel without @ prefix', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      await addChannel(user, 'NewChannel');
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
        '/addchannelinfo',
        { url: 'https://www.youtube.com/@NewChannel' },
        expect.any(Object)
      ));
    });

    test('normalizes various YouTube URL formats', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UCtest' });
      renderChannelManager();
      await addChannel(user, 'youtube.com/@TestChannel');
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
        '/addchannelinfo',
        { url: 'https://www.youtube.com/@TestChannel' },
        expect.any(Object)
      ));
    });

    test('adds channel using Enter key', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      const input = await screen.findByLabelText('Add a new channel');
      await user.type(input, '@NewChannel{Enter}');
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    });

    test('shows error dialog for invalid channel URL', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      renderChannelManager();
      const input = await screen.findByLabelText('Add a new channel');
      await user.type(input, 'not a valid url with spaces');
      await user.click(screen.getByTestId('add-channel-button'));
      expect(await screen.findByText(/Invalid channel URL/)).toBeInTheDocument();
      expect(screen.getByText(/youtube.com\/@ChannelName/)).toBeInTheDocument();
    });

    test('shows error dialog when channel already exists', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const input = screen.getByLabelText('Add a new channel');
      await user.type(input, '@TechChannel');
      await user.click(screen.getByTestId('add-channel-button'));
      expect(await screen.findByText('Channel already exists')).toBeInTheDocument();
    });

    test('clears input after adding channel', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      const input = await screen.findByLabelText('Add a new channel');
      await user.type(input, '@NewChannel');
      await user.click(screen.getByTestId('add-channel-button'));
      await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
    });

    test('highlights newly added channels', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      await addChannel(user, '@NewChannel');
      const listItems = screen.getAllByRole('listitem');
      const listItem = listItems.find((li: HTMLElement) => within(li).queryByText('New Channel')) as HTMLElement;
      expect(listItem).toHaveAttribute('data-state', 'new');
    });
  });

  describe('Deleting Channels', () => {
    test('marks Tech Channel for deletion and flags list item', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const listItems = screen.getAllByRole('listitem');
      const techItem = listItems.find((li: HTMLElement) => within(li).queryByText('Tech Channel')) as HTMLElement;
      const delBtn = within(techItem).getByTestId('delete-channel-button');
      await user.click(delBtn);

      // Confirm deletion in the dialog
      await screen.findByText(/Removing this channel will stop automatic downloads/);
      await user.click(screen.getByRole('button', { name: /^OK$/i }));

      expect(techItem).toHaveAttribute('data-state', 'deleted');
    });

    test('removes delete button after marking for deletion', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');

      const initialDeleteButtons = screen.getAllByTestId('delete-channel-button');
      const initialCount = initialDeleteButtons.length;

      await user.click(initialDeleteButtons[0]);

      // Confirm deletion in the dialog
      await screen.findByText(/Removing this channel will stop automatic downloads/);
      await user.click(screen.getByRole('button', { name: /^OK$/i }));

      const remainingDeleteButtons = screen.getAllByTestId('delete-channel-button');
      expect(remainingDeleteButtons.length).toBe(initialCount - 1);
    });

    test('cancels deletion when Cancel is clicked', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const listItems = screen.getAllByRole('listitem');
      const techItem = listItems.find((li: HTMLElement) => within(li).queryByText('Tech Channel')) as HTMLElement;
      const delBtn = within(techItem).getByTestId('delete-channel-button');
      await user.click(delBtn);

      // Cancel deletion in the dialog
      await screen.findByText(/Removing this channel will stop automatic downloads/);
      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      // Channel should not be marked as deleted
      expect(techItem).not.toHaveAttribute('data-state', 'deleted');
      // Delete button should still be present
      expect(within(techItem).getByTestId('delete-channel-button')).toBeInTheDocument();
    });

    test('immediately removes unsaved channels on delete', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      await addChannel(user, '@NewChannel');
      const deleteButtons = screen.getAllByTestId('delete-channel-button');
      await user.click(deleteButtons[0]);

      // Confirm deletion in the dialog
      await screen.findByText(/Removing this channel will stop automatic downloads/);
      await user.click(screen.getByRole('button', { name: /^OK$/i }));

      expect(screen.queryByText('New Channel')).not.toBeInTheDocument();
    });
  });

  describe('Saving and Undoing Changes', () => {
    test('saves changes successfully', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce(mockChannels);
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success' } } as any);
      mockedAxios.get.mockResolvedValueOnce({ data: mockChannels } as any);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const listItems = screen.getAllByRole('listitem');
      const techItem = listItems.find((li: HTMLElement) => within(li).queryByText('Tech Channel')) as HTMLElement;
      const delBtn = within(techItem).getByTestId('delete-channel-button');
      await user.click(delBtn);

      // Confirm deletion in the dialog
      await screen.findByText(/Removing this channel will stop automatic downloads/);
      await user.click(screen.getByRole('button', { name: /^OK$/i }));

      // Wait for dialog to close
      await waitFor(() => expect(screen.queryByText(/Removing this channel will stop automatic downloads/)).not.toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /save changes/i }));
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
        '/updatechannels',
        expect.arrayContaining([
          'https://www.youtube.com/@GamingChannel',
          'https://www.youtube.com/@CookingChannel',
          // Deleted Tech Channel excluded
        ]),
        { headers: { 'x-access-token': mockToken } }
      ));
      expect(await screen.findByText('Channels updated successfully')).toBeInTheDocument();
    });

    test('undoes all changes', async () => {
      const user = userEvent.setup();
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockChannels } as any)
        .mockResolvedValueOnce({ data: mockChannels } as any);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const deleteButtons = screen.getAllByTestId('delete-channel-button');
      await user.click(deleteButtons[0]);

      // Confirm deletion in the dialog
      await screen.findByText(/Removing this channel will stop automatic downloads/);
      await user.click(screen.getByRole('button', { name: /^OK$/i }));

      // Wait for dialog to close
      await waitFor(() => expect(screen.queryByText(/Removing this channel will stop automatic downloads/)).not.toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /undo/i }));
      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
    });

    test('disables save button when no changes', async () => {
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    });

    test('enables save button when changes are made', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const deleteButtons = screen.getAllByTestId('delete-channel-button');
      await user.click(deleteButtons[0]);

      // Confirm deletion in the dialog
      await screen.findByText(/Removing this channel will stop automatic downloads/);
      await user.click(screen.getByRole('button', { name: /^OK$/i }));

      // Wait for dialog to close
      await waitFor(() => expect(screen.queryByText(/Removing this channel will stop automatic downloads/)).not.toBeInTheDocument());

      expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled();
    });

    test('disables undo button when no changes', async () => {
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    });

    test('enables undo button when changes are made', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const deleteButtons = screen.getAllByTestId('delete-channel-button');
      await user.click(deleteButtons[0]);

      // Confirm deletion in the dialog
      await screen.findByText(/Removing this channel will stop automatic downloads/);
      await user.click(screen.getByRole('button', { name: /^OK$/i }));

      // Wait for dialog to close
      await waitFor(() => expect(screen.queryByText(/Removing this channel will stop automatic downloads/)).not.toBeInTheDocument());

      expect(screen.getByRole('button', { name: /undo/i })).toBeEnabled();
    });
  });

  describe('Navigation', () => {
    test('navigates to channel page on click', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      await user.click(screen.getByText('Tech Channel'));
      expect(mockNavigate).toHaveBeenCalledWith('/channel/UC123456');
    });

    test('has a dedicated clickable area for channel', async () => {
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      expect(screen.getByTestId('channel-click-area-UC123456')).toBeInTheDocument();
    });
  });

  describe('WebSocket Integration', () => {
    test('subscribes to WebSocket on mount', async () => {
      mockGetChannelsOnce([]);
      renderChannelManager();
      await waitFor(() => expect(wsCtx.subscribe).toHaveBeenCalled());

      const [filterArg] = wsCtx.subscribe.mock.calls[0];
      const testMessage = {
        destination: 'broadcast',
        source: 'channel',
        type: 'channelsUpdated',
        payload: {}
      };

      expect(filterArg(testMessage)).toBe(true);
    });

    test('unsubscribes from WebSocket on unmount', async () => {
      mockGetChannelsOnce([]);
      const { unmount } = renderChannelManager();
      await waitFor(() => expect(wsCtx.subscribe).toHaveBeenCalled());
      unmount();
      expect(wsCtx.unsubscribe).toHaveBeenCalled();
    });

    test('reloads channels on WebSocket message', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: [] } as any)
        .mockResolvedValueOnce({ data: mockChannels } as any);
      renderChannelManager();
      await waitFor(() => expect(wsCtx.subscribe).toHaveBeenCalled());
      const callback = wsCtx.subscribe.mock.calls[0][1];
      callback({ type: 'channelsUpdated' });
      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
      expect(await screen.findByText('Tech Channel')).toBeInTheDocument();
    });
  });

  describe('Dialog Interactions', () => {
    test('closes dialog when Close button is clicked', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      renderChannelManager();
      const input = await screen.findByLabelText('Add a new channel');
      await user.type(input, 'not a valid url at all!!!');
      await user.click(screen.getByTestId('add-channel-button'));
      await screen.findByText(/Invalid channel URL/);
      await user.click(screen.getByRole('button', { name: /close/i }));
      await waitFor(() => expect(screen.queryByText(/Invalid channel URL/)).not.toBeInTheDocument());
    });
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);
    });

    test('renders with mobile-specific styles', async () => {
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const thumbnails = screen.getAllByRole('img') as HTMLImageElement[];
      thumbnails.forEach((img) => expect(img).toHaveAttribute('data-size', 'small'));
    });

    test('displays smaller font size for mobile', async () => {
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toHaveAttribute('data-size', 'small');
    });
  });

  describe('Auto Download Badges', () => {
    test('displays video badge for channels with video auto-download enabled', async () => {
      const channelWithVideoTab: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', available_tabs: 'videos', auto_download_enabled_tabs: 'video' }
      ];
      mockGetChannelsOnce(channelWithVideoTab);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('Videos')).toBeInTheDocument();
    });

    test('displays shorts badge for channels with shorts auto-download enabled', async () => {
      const channelWithShortsTab: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', available_tabs: 'shorts', auto_download_enabled_tabs: 'short' }
      ];
      mockGetChannelsOnce(channelWithShortsTab);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('Shorts')).toBeInTheDocument();
    });

    test('displays live badge for channels with livestream auto-download enabled', async () => {
      const channelWithLiveTab: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', available_tabs: 'streams', auto_download_enabled_tabs: 'livestream' }
      ];
      mockGetChannelsOnce(channelWithLiveTab);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    test('displays multiple badges for channels with multiple tabs enabled', async () => {
      const channelWithMultipleTabs: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', available_tabs: 'videos,shorts,streams', auto_download_enabled_tabs: 'video,short,livestream' }
      ];
      mockGetChannelsOnce(channelWithMultipleTabs);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('Videos')).toBeInTheDocument();
      expect(screen.getByText('Shorts')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    test('handles tabs with whitespace in the comma-separated string', async () => {
      const channelWithSpaces: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', available_tabs: 'videos , shorts , streams', auto_download_enabled_tabs: 'video , short , livestream' }
      ];
      mockGetChannelsOnce(channelWithSpaces);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('Videos')).toBeInTheDocument();
      expect(screen.getByText('Shorts')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    test('does not render badges when auto_download_enabled_tabs is undefined', async () => {
      const channelWithoutTabs: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123' }
      ];
      mockGetChannelsOnce(channelWithoutTabs);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.queryByText('Videos')).not.toBeInTheDocument();
      expect(screen.queryByText('Shorts')).not.toBeInTheDocument();
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });

    test('does not render badges when auto_download_enabled_tabs is empty string', async () => {
      const channelWithEmptyTabs: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', auto_download_enabled_tabs: '' }
      ];
      mockGetChannelsOnce(channelWithEmptyTabs);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.queryByText('Videos')).not.toBeInTheDocument();
      expect(screen.queryByText('Shorts')).not.toBeInTheDocument();
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });

    test('ignores unknown tab types in the string', async () => {
      const channelWithUnknownTab: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', available_tabs: 'videos,unknown,shorts', auto_download_enabled_tabs: 'video,unknown,short' }
      ];
      mockGetChannelsOnce(channelWithUnknownTab);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('Videos')).toBeInTheDocument();
      expect(screen.getByText('Shorts')).toBeInTheDocument();
      expect(screen.queryByText('unknown')).not.toBeInTheDocument();
    });

    test('displays download icon only for auto-download enabled tabs', async () => {
      const channelWithPartialAutoDownload: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', available_tabs: 'videos,shorts', auto_download_enabled_tabs: 'video' }
      ];
      mockGetChannelsOnce(channelWithPartialAutoDownload);
      renderChannelManager();
      await screen.findByText('Test Channel');

      // Both tabs should be displayed
      expect(screen.getByText('Videos')).toBeInTheDocument();
      expect(screen.getByText('Shorts')).toBeInTheDocument();

      // Only one download icon should be present (for the video tab which has auto-download enabled)
      const downloadIcons = screen.queryAllByTestId('FileDownloadIcon');
      expect(downloadIcons).toHaveLength(1);
    });

    test('displays tabs without download icons when auto_download_enabled_tabs is empty', async () => {
      const channelWithNoAutoDownload: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', available_tabs: 'videos,shorts', auto_download_enabled_tabs: '' }
      ];
      mockGetChannelsOnce(channelWithNoAutoDownload);
      renderChannelManager();
      await screen.findByText('Test Channel');

      // Both chips should be present but without download icons
      expect(screen.getByText('Videos')).toBeInTheDocument();
      expect(screen.getByText('Shorts')).toBeInTheDocument();
      expect(screen.queryAllByTestId('FileDownloadIcon')).toHaveLength(0);
    });
  });

  describe('Channel Configuration Display', () => {
    test('displays custom subfolder for channel', async () => {
      const channelWithSubFolder: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', sub_folder: 'Tech Videos' }
      ];
      mockGetChannelsOnce(channelWithSubFolder);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('__Tech Videos/')).toBeInTheDocument();
    });

    test('displays default folder when sub_folder is null', async () => {
      const channelWithoutSubFolder: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', sub_folder: null }
      ];
      mockGetChannelsOnce(channelWithoutSubFolder);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('default')).toBeInTheDocument();
    });

    test('displays default folder when sub_folder is undefined', async () => {
      const channelWithoutSubFolder: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123' }
      ];
      mockGetChannelsOnce(channelWithoutSubFolder);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('default')).toBeInTheDocument();
    });

    test('displays custom video quality with settings icon', async () => {
      const channelWithCustomQuality: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', video_quality: '720' }
      ];
      mockGetChannelsOnce(channelWithCustomQuality);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('720p')).toBeInTheDocument();
      // Settings icon indicates channel-specific override
      expect(screen.getByTestId('SettingsIcon')).toBeInTheDocument();
    });

    test('displays global video quality without settings icon', async () => {
      const channelWithoutQuality: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123' }
      ];
      mockGetChannelsOnce(channelWithoutQuality);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByText('1080p')).toBeInTheDocument();
      // No settings icon for global default
      expect(screen.queryByTestId('SettingsIcon')).not.toBeInTheDocument();
    });

    test('displays folder icon for subfolder display', async () => {
      const channelWithSubFolder: Channel[] = [
        { url: 'https://www.youtube.com/@TestChannel', uploader: 'Test Channel', channel_id: 'UC123', sub_folder: 'Test' }
      ];
      mockGetChannelsOnce(channelWithSubFolder);
      renderChannelManager();
      await screen.findByText('Test Channel');
      expect(screen.getByTestId('FolderIcon')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty channel list', async () => {
      mockGetChannelsOnce([]);
      renderChannelManager();
      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.queryAllByRole('listitem').length).toBe(0);
    });

    test('displays URL when uploader name is not available', async () => {
      const channelsWithoutUploader = [
        {
          url: 'https://www.youtube.com/@NoNameChannel',
          uploader: '',
          channel_id: 'UCnoname'
        }
      ];

      mockGetChannelsOnce(channelsWithoutUploader as any);
      renderChannelManager();
      expect(await screen.findByText('https://www.youtube.com/@NoNameChannel')).toBeInTheDocument();
    });

    test('handles API error when adding channel', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedAxios.get.mockResolvedValueOnce({ data: [] } as any);
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'error' } } as any);
      renderChannelManager();
      const input = await screen.findByLabelText('Add a new channel');
      await user.type(input, '@NewChannel');
      await user.click(screen.getByTestId('add-channel-button'));
      await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to add channel info'));
      consoleErrorSpy.mockRestore();
    });

    test('throws error when WebSocketContext is not found', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <BrowserRouter>
            <ChannelManager token={mockToken} />
          </BrowserRouter>
        );
      }).toThrow('WebSocketContext not found');

      consoleErrorSpy.mockRestore();
    });

    test.each([
      ['@New', 'https://www.youtube.com/@New'],
      ['New', 'https://www.youtube.com/@New'],
      ['youtube.com/@TestChannel', 'https://www.youtube.com/@TestChannel'],
      ['m.youtube.com/@MobileChannel', 'https://www.youtube.com/@MobileChannel'],
      ['https://www.youtube.com/@TestChannel/', 'https://www.youtube.com/@TestChannel'],
      ['https://www.youtube.com/c/TestChannel', 'https://www.youtube.com/c/TestChannel'],
      ['https://www.youtube.com/channel/UCtest123', 'https://www.youtube.com/channel/UCtest123'],
    ])('normalizes %s to %s and posts', async (inputValue, normalized) => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValueOnce({ data: [] } as any);
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success', channelInfo: { url: normalized, uploader: 'X', channel_id: 'ID' } } } as any);
      renderChannelManager();
      const input = await screen.findByLabelText('Add a new channel');
      await user.type(input, String(inputValue));
      await user.click(screen.getByTestId('add-channel-button'));
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith('/addchannelinfo', { url: normalized }, expect.any(Object)));
    });

    test('rejects non-YouTube URLs', async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValueOnce({ data: [] } as any);
      renderChannelManager();
      const input = await screen.findByLabelText('Add a new channel');
      await user.type(input, 'https://vimeo.com/channel');
      await user.click(screen.getByTestId('add-channel-button'));
      expect(await screen.findByText(/Invalid channel URL/)).toBeInTheDocument();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
});
