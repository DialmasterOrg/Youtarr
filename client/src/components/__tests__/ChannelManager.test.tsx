import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import axios from 'axios';
import useMediaQuery from '@mui/material/useMediaQuery';
import ChannelManager from '../ChannelManager';
import { BrowserRouter } from 'react-router-dom';
import { Channel } from '../../types/Channel';
import { renderWithProviders, createMockWebSocketContext } from '../../test-utils';

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
  { url: 'https://www.youtube.com/@TechChannel/videos', uploader: 'Tech Channel', channel_id: 'UC123456' },
  { url: 'https://www.youtube.com/@GamingChannel/videos', uploader: 'Gaming Channel', channel_id: 'UC789012' },
  { url: 'https://www.youtube.com/@CookingChannel/videos', uploader: 'Cooking Channel', channel_id: 'UC345678' },
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
      const texts = listItems.map((li) => (within(li).queryByText(/Channel$/)?.textContent ?? '').trim()).filter(Boolean);
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
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel/videos', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      await addChannel(user, '@NewChannel');
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
        '/addchannelinfo',
        { url: 'https://www.youtube.com/@NewChannel/videos' },
        { headers: { 'x-access-token': mockToken } }
      ));
    });

    test('adds a new channel without @ prefix', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel/videos', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      await addChannel(user, 'NewChannel');
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
        '/addchannelinfo',
        { url: 'https://www.youtube.com/@NewChannel/videos' },
        expect.any(Object)
      ));
    });

    test('normalizes various YouTube URL formats', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@TestChannel/videos', uploader: 'Test Channel', channel_id: 'UCtest' });
      renderChannelManager();
      await addChannel(user, 'youtube.com/@TestChannel');
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
        '/addchannelinfo',
        { url: 'https://www.youtube.com/@TestChannel/videos' },
        expect.any(Object)
      ));
    });

    test('adds channel using Enter key', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel/videos', uploader: 'New Channel', channel_id: 'UCnew123' });
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
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel/videos', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      const input = await screen.findByLabelText('Add a new channel');
      await user.type(input, '@NewChannel');
      await user.click(screen.getByTestId('add-channel-button'));
      await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
    });

    test('highlights newly added channels', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel/videos', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      await addChannel(user, '@NewChannel');
      const listItems = screen.getAllByRole('listitem');
      const listItem = listItems.find((li) => within(li).queryByText('New Channel')) as HTMLElement;
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
      const techItem = listItems.find((li) => within(li).queryByText('Tech Channel')) as HTMLElement;
      const delBtn = within(techItem).getByTestId('delete-channel-button');
      await user.click(delBtn);
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

      const remainingDeleteButtons = screen.getAllByTestId('delete-channel-button');
      expect(remainingDeleteButtons.length).toBe(initialCount - 1);
    });

    test('immediately removes unsaved channels on delete', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      mockAddChannelSuccessOnce({ url: 'https://www.youtube.com/@NewChannel/videos', uploader: 'New Channel', channel_id: 'UCnew123' });
      renderChannelManager();
      await addChannel(user, '@NewChannel');
      const deleteButtons = screen.getAllByTestId('delete-channel-button');
      await user.click(deleteButtons[0]);
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
      const techItem = listItems.find((li) => within(li).queryByText('Tech Channel')) as HTMLElement;
      const delBtn = within(techItem).getByTestId('delete-channel-button');
      await user.click(delBtn);
      await user.click(screen.getByRole('button', { name: /save changes/i }));
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
        '/updatechannels',
        expect.arrayContaining([
          'https://www.youtube.com/@GamingChannel/videos',
          'https://www.youtube.com/@CookingChannel/videos',
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

    test('shows mobile tooltip as snackbar', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      renderChannelManager();
      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
      await user.click(screen.getByTestId('info-button'));
      expect(await screen.findByText(/Enter a YouTube channel/)).toBeInTheDocument();
    });

    test('closes mobile tooltip snackbar', async () => {
      const user = userEvent.setup();
      mockGetChannelsOnce([]);
      renderChannelManager();
      await user.click(screen.getByTestId('info-button'));
      await user.click(screen.getByRole('button', { name: /close/i }));
      await waitFor(() => expect(screen.queryByText(/Enter a YouTube channel/)).not.toBeInTheDocument());
    });

    test('displays smaller font size for mobile', async () => {
      mockGetChannelsOnce(mockChannels);
      renderChannelManager();
      await screen.findByText('Tech Channel');
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toHaveAttribute('data-size', 'small');
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
          url: 'https://www.youtube.com/@NoNameChannel/videos',
          uploader: '',
          channel_id: 'UCnoname'
        }
      ];

      mockGetChannelsOnce(channelsWithoutUploader as any);
      renderChannelManager();
      expect(await screen.findByText('https://www.youtube.com/@NoNameChannel/videos')).toBeInTheDocument();
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
      ['@New', 'https://www.youtube.com/@New/videos'],
      ['New', 'https://www.youtube.com/@New/videos'],
      ['youtube.com/@TestChannel', 'https://www.youtube.com/@TestChannel/videos'],
      ['m.youtube.com/@MobileChannel', 'https://www.youtube.com/@MobileChannel/videos'],
      ['https://www.youtube.com/@TestChannel/', 'https://www.youtube.com/@TestChannel/videos'],
      ['https://www.youtube.com/c/TestChannel', 'https://www.youtube.com/c/TestChannel/videos'],
      ['https://www.youtube.com/channel/UCtest123', 'https://www.youtube.com/channel/UCtest123/videos'],
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
