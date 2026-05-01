import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import useMediaQuery from '../../hooks/useMediaQuery';
import Subscriptions from '../Subscriptions';
import { renderWithProviders, createMockWebSocketContext } from '../../test-utils';
import { Channel } from '../../types/Channel';

// Mock custom hooks
jest.mock('../../hooks/useMediaQuery');

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock custom hooks
const mockRefetchChannels = jest.fn();
const mockAddChannel = jest.fn();
const mockQueueChannelForDeletion = jest.fn();
const mockUndoChanges = jest.fn();
const mockSaveChanges = jest.fn();

jest.mock('../Subscriptions/hooks/useChannelList', () => ({
  useChannelList: jest.fn(),
}));

jest.mock('../Subscriptions/hooks/useChannelMutations', () => ({
  useChannelMutations: jest.fn(),
}));

jest.mock('../../hooks/useConfig', () => ({
  useConfig: jest.fn(),
}));

// Mock child components
jest.mock('../Subscriptions/components/ChannelCard', () => ({
  __esModule: true,
  default: function MockChannelCard({ channel, onNavigate, onDelete, isPendingAddition }: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': `channel-card-${channel.url}`,
      'data-pending': isPendingAddition,
    },
      React.createElement('div', null, channel.uploader),
      React.createElement('button', {
        'data-testid': `navigate-${channel.url}`,
        onClick: onNavigate,
      }, 'Navigate'),
      React.createElement('button', {
        'data-testid': `delete-${channel.url}`,
        onClick: onDelete,
      }, 'Delete')
    );
  }
}));

jest.mock('../Subscriptions/components/ChannelListRow', () => ({
  __esModule: true,
  default: function MockChannelListRow({ channel, onNavigate, onDelete, isPendingAddition }: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': `channel-row-${channel.url}`,
      'data-pending': isPendingAddition,
    },
      React.createElement('div', null, channel.uploader),
      React.createElement('button', {
        'data-testid': `navigate-${channel.url}`,
        onClick: onNavigate,
      }, 'Navigate'),
      React.createElement('button', {
        'data-testid': `delete-${channel.url}`,
        onClick: onDelete,
      }, 'Delete')
    );
  },
  CHANNEL_LIST_DESKTOP_TEMPLATE: '2fr 1fr 1fr 1fr auto',
}));

jest.mock('../Subscriptions/components/PendingSaveBanner', () => ({
  __esModule: true,
  default: function MockPendingSaveBanner({ show }: any) {
    const React = require('react');
    return show ? React.createElement('div', { 'data-testid': 'pending-save-banner' }, 'Pending changes') : null;
  }
}));

jest.mock('../Subscriptions/HelpDialog', () => ({
  __esModule: true,
  default: function MockHelpDialog({ open, onClose }: any) {
    const React = require('react');
    return open ? React.createElement('div', {
      'data-testid': 'help-dialog',
      onClick: onClose,
    }, 'Help Dialog') : null;
  }
}));

const { useChannelList } = require('../Subscriptions/hooks/useChannelList');
const { useChannelMutations } = require('../Subscriptions/hooks/useChannelMutations');
const { useConfig } = require('../../hooks/useConfig');

describe('Subscriptions Component', () => {
  const mockToken = 'test-token';

  const mockChannels: Channel[] = [
    {
      url: 'https://www.youtube.com/@channel1',
      uploader: 'Test Channel 1',
      channel_id: 'UC1234',
      auto_download_enabled_tabs: 'video',
      sub_folder: null,
      video_quality: '1080',
    },
    {
      url: 'https://www.youtube.com/@channel2',
      uploader: 'Test Channel 2',
      channel_id: 'UC5678',
      auto_download_enabled_tabs: 'video,short',
      sub_folder: 'music',
      video_quality: '720',
    },
  ];

  const renderSubscriptions = (props = {}) => {
    const wsCtx = createMockWebSocketContext();
    return renderWithProviders(
      <Subscriptions token={mockToken} {...props} />,
      { websocketValue: wsCtx }
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    mockNavigate.mockClear();

    // Default mock responses
    useChannelList.mockReturnValue({
      channels: [],
      total: 0,
      totalPages: 1,
      loading: false,
      error: null,
      refetch: mockRefetchChannels,
      subFolders: [],
    });

    useChannelMutations.mockReturnValue({
      pendingAdditions: [],
      deletedChannels: [],
      isAddingChannel: false,
      isSaving: false,
      addChannel: mockAddChannel,
      queueChannelForDeletion: mockQueueChannelForDeletion,
      undoChanges: mockUndoChanges,
      saveChanges: mockSaveChanges,
      hasPendingChanges: false,
    });

    useConfig.mockReturnValue({
      config: { preferredResolution: '1080' },
    });
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderSubscriptions();
      expect(screen.getByText('Channels & Playlists')).toBeInTheDocument();
    });

    test('throws error when WebSocketContext is not provided', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<Subscriptions token={mockToken} />);
      }).toThrow('WebSocketContext not found');

      spy.mockRestore();
    });

    test('displays help button', () => {
      renderSubscriptions();
      const helpButton = screen.getByRole('button', { name: /learn how channel downloads work/i });
      expect(helpButton).toBeInTheDocument();
    });

    test('displays add channel input and button', () => {
      renderSubscriptions();
      expect(screen.getByPlaceholderText('Paste a channel URL or @handle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^channel$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
    });

    test('shows loading state when fetching channels', () => {
      useChannelList.mockReturnValue({
        channels: [],
        total: 0,
        totalPages: 1,
        loading: true,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('keeps channel list rendered during a refetch when items already loaded', () => {
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: true,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();
      expect(screen.getByTestId(`channel-row-${mockChannels[0].url}`)).toBeInTheDocument();
      expect(screen.getByTestId(`channel-row-${mockChannels[1].url}`)).toBeInTheDocument();
      expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
    });

    test('shows error message when channel fetch fails', () => {
      useChannelList.mockReturnValue({
        channels: [],
        total: 0,
        totalPages: 1,
        loading: false,
        error: 'Failed to load channels',
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load channels')).toBeInTheDocument();
    });

    test('displays channels in list view', () => {
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();
      expect(screen.getByTestId(`channel-row-${mockChannels[0].url}`)).toBeInTheDocument();
      expect(screen.getByTestId(`channel-row-${mockChannels[1].url}`)).toBeInTheDocument();
    });

    test('shows no channels message when empty', () => {
      renderSubscriptions();
      expect(screen.getByText('No channels found. Try adjusting your filter.')).toBeInTheDocument();
    });

    test('displays total channel count', () => {
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 42,
        totalPages: 3,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();
      expect(screen.getByText('Total channels: 42')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    test('renders view mode toggle buttons on desktop', () => {
      renderSubscriptions();
      expect(screen.getByLabelText('List view')).toBeInTheDocument();
      expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    });

    test('renders the mobile view mode toggle on mobile', () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);
      renderSubscriptions();
      expect(screen.getByLabelText('List view')).toBeInTheDocument();
      expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    });

    test('switches to grid view when grid button clicked', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();

      await user.click(screen.getByLabelText('Grid view'));

      await waitFor(() => {
        expect(screen.getByTestId(`channel-card-${mockChannels[0].url}`)).toBeInTheDocument();
      });
    });

    test('displays list column headers in list view on desktop', () => {
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();
      expect(screen.getAllByText('Channel').length).toBeGreaterThan(0);
      expect(screen.getByText('Quality / Folder')).toBeInTheDocument();
      expect(screen.getByText('Auto downloads')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
  });

  describe('Adding Channels', () => {
    test('adds channel when Channel button clicked', async () => {
      const user = userEvent.setup();
      mockAddChannel.mockResolvedValue({ success: true });

      renderSubscriptions();

      const input = screen.getByPlaceholderText('Paste a channel URL or @handle');
      await user.type(input, 'https://www.youtube.com/@newchannel');
      await user.click(screen.getByRole('button', { name: /^channel$/i }));

      await waitFor(() => {
        expect(mockAddChannel).toHaveBeenCalledWith('https://www.youtube.com/@newchannel');
      });
    });

    test('adds channel when Enter key pressed in input', async () => {
      const user = userEvent.setup();
      mockAddChannel.mockResolvedValue({ success: true });

      renderSubscriptions();

      const input = screen.getByPlaceholderText('Paste a channel URL or @handle');
      await user.type(input, 'https://www.youtube.com/@newchannel');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockAddChannel).toHaveBeenCalledWith('https://www.youtube.com/@newchannel');
      });
    });

    test('does not add channel when input is empty', () => {
      renderSubscriptions();

      const addButton = screen.getByRole('button', { name: /^channel$/i });
      // Button should be disabled when input is empty
      expect(addButton).toBeDisabled();
      expect(mockAddChannel).not.toHaveBeenCalled();
    });

    test('clears input after successful channel add', async () => {
      const user = userEvent.setup();
      mockAddChannel.mockResolvedValue({ success: true });

      renderSubscriptions();

      const input = screen.getByPlaceholderText('Paste a channel URL or @handle') as HTMLInputElement;
      await user.type(input, 'https://www.youtube.com/@newchannel');
      await user.click(screen.getByRole('button', { name: /^channel$/i }));

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    test('shows error dialog when channel add fails', async () => {
      const user = userEvent.setup();
      mockAddChannel.mockResolvedValue({
        success: false,
        message: 'Channel not found'
      });

      renderSubscriptions();

      const input = screen.getByPlaceholderText('Paste a channel URL or @handle');
      await user.type(input, 'https://www.youtube.com/@invalid');
      await user.click(screen.getByRole('button', { name: /^channel$/i }));

      await waitFor(() => {
        expect(screen.getByText('Channel not found')).toBeInTheDocument();
      });
    });

    test('disables add button when channel is being added', () => {
      useChannelMutations.mockReturnValue({
        pendingAdditions: [],
        deletedChannels: [],
        isAddingChannel: true,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: false,
      });

      renderSubscriptions();
      expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();
    });

    test('shows success message when channel add returns message', async () => {
      const user = userEvent.setup();
      mockAddChannel.mockResolvedValue({
        success: true,
        message: 'Channel already exists'
      });

      renderSubscriptions();

      const input = screen.getByPlaceholderText('Paste a channel URL or @handle');
      await user.type(input, 'https://www.youtube.com/@existing');
      await user.click(screen.getByRole('button', { name: /^channel$/i }));

      await waitFor(() => {
        expect(screen.getByText('Channel already exists')).toBeInTheDocument();
      });
    });

    test('navigates to imports when Import button clicked', async () => {
      const user = userEvent.setup();

      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /import/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/subscriptions/imports');
    });
  });

  describe('Deleting Channels', () => {
    test('shows delete confirmation dialog when delete clicked', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();

      await user.click(screen.getByTestId(`delete-${mockChannels[0].url}`));

      await waitFor(() => {
        expect(screen.getByText('Remove channel?')).toBeInTheDocument();
      });
      expect(screen.getByText(/Removing this channel will stop automatic downloads/)).toBeInTheDocument();
    });

    test('queues channel for deletion when confirmed', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();

      await user.click(screen.getByTestId(`delete-${mockChannels[0].url}`));

      await waitFor(() => {
        expect(screen.getByText('Remove channel?')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /remove/i }));

      expect(mockQueueChannelForDeletion).toHaveBeenCalledWith(mockChannels[0]);
    });

    test('closes dialog when cancel clicked', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();

      await user.click(screen.getByTestId(`delete-${mockChannels[0].url}`));

      await waitFor(() => {
        expect(screen.getByText('Remove channel?')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Remove channel?')).not.toBeInTheDocument();
      });
      expect(mockQueueChannelForDeletion).not.toHaveBeenCalled();
    });
  });

  describe('Pending Changes Management', () => {
    test('displays pending save banner when there are pending additions', () => {
      useChannelMutations.mockReturnValue({
        pendingAdditions: [mockChannels[0]],
        deletedChannels: [],
        isAddingChannel: false,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: true,
      });

      renderSubscriptions();
      expect(screen.getByTestId('pending-save-banner')).toBeInTheDocument();
    });

    test('displays save and undo buttons when there are pending changes', () => {
      useChannelMutations.mockReturnValue({
        pendingAdditions: [mockChannels[0]],
        deletedChannels: [],
        isAddingChannel: false,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: true,
      });

      renderSubscriptions();
      expect(screen.getByLabelText('Save changes')).toBeInTheDocument();
      expect(screen.getByLabelText('Undo changes')).toBeInTheDocument();
    });

    test('calls saveChanges when save button clicked', async () => {
      const user = userEvent.setup();
      mockSaveChanges.mockResolvedValue({ success: true, message: 'Saved' });

      useChannelMutations.mockReturnValue({
        pendingAdditions: [mockChannels[0]],
        deletedChannels: [],
        isAddingChannel: false,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: true,
      });

      renderSubscriptions();

      await user.click(screen.getByLabelText('Save changes'));

      await waitFor(() => {
        expect(mockSaveChanges).toHaveBeenCalled();
      });
    });

    test('calls undoChanges when undo button clicked', async () => {
      const user = userEvent.setup();

      useChannelMutations.mockReturnValue({
        pendingAdditions: [mockChannels[0]],
        deletedChannels: [],
        isAddingChannel: false,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: true,
      });

      renderSubscriptions();

      await user.click(screen.getByLabelText('Undo changes'));

      expect(mockUndoChanges).toHaveBeenCalled();
    });

    test('shows success message after save', async () => {
      const user = userEvent.setup();
      mockSaveChanges.mockResolvedValue({
        success: true,
        message: 'Channels updated successfully'
      });

      useChannelMutations.mockReturnValue({
        pendingAdditions: [mockChannels[0]],
        deletedChannels: [],
        isAddingChannel: false,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: true,
      });

      renderSubscriptions();

      await user.click(screen.getByLabelText('Save changes'));

      await waitFor(() => {
        expect(screen.getByText('Channels updated successfully')).toBeInTheDocument();
      });
    });

    test('disables save button while saving', () => {
      useChannelMutations.mockReturnValue({
        pendingAdditions: [mockChannels[0]],
        deletedChannels: [],
        isAddingChannel: false,
        isSaving: true,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: true,
      });

      renderSubscriptions();
      expect(screen.getByLabelText('Save changes')).toBeDisabled();
    });

    test('marks pending additions with visual indicator', () => {
      const pendingChannel: Channel = {
        url: 'https://www.youtube.com/@pending',
        uploader: 'Pending Channel',
        channel_id: 'UCPEND',
        auto_download_enabled_tabs: 'video',
      };

      useChannelList.mockReturnValue({
        channels: [],
        total: 0,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      useChannelMutations.mockReturnValue({
        pendingAdditions: [pendingChannel],
        deletedChannels: [],
        isAddingChannel: false,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: true,
      });

      renderSubscriptions();

      const pendingCard = screen.getByTestId(`channel-row-${pendingChannel.url}`);
      expect(pendingCard).toHaveAttribute('data-pending', 'true');
    });

    test('hides deleted channels from display', () => {
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      useChannelMutations.mockReturnValue({
        pendingAdditions: [],
        deletedChannels: [mockChannels[0].url],
        isAddingChannel: false,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: true,
      });

      renderSubscriptions();

      expect(screen.queryByTestId(`channel-row-${mockChannels[0].url}`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`channel-row-${mockChannels[1].url}`)).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    test('displays sort button', () => {
      renderSubscriptions();
      expect(screen.getByRole('button', { name: /sort alphabetically/i })).toBeInTheDocument();
    });

    test('toggles sort order when sort button clicked', async () => {
      const user = userEvent.setup();
      renderSubscriptions();

      // Initially ascending
      expect(screen.getByRole('button', { name: /sort alphabetically \(A → Z\)/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /sort alphabetically/i }));

      // After click, should be descending (resets page to 1)
      await waitFor(() => {
        expect(useChannelList).toHaveBeenCalledWith(
          expect.objectContaining({ sortOrder: 'desc' })
        );
      });
    });
  });

  describe('Filtering', () => {
    test('displays filter button', () => {
      renderSubscriptions();
      expect(screen.getByRole('button', { name: /filter by channel name/i })).toBeInTheDocument();
    });

    test('opens filter popover when filter button clicked', async () => {
      const user = userEvent.setup();
      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /filter by channel name/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Filter channels')).toBeInTheDocument();
      });
    });

    test('closes filter popover when filter button is clicked again', async () => {
      const user = userEvent.setup();
      renderSubscriptions();

      const filterButton = screen.getByRole('button', { name: /filter by channel name/i });
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Filter channels')).toBeInTheDocument();
      });

      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.queryByLabelText('Filter channels')).not.toBeInTheDocument();
      });
    });

    test('applies filter when text entered', async () => {
      const user = userEvent.setup();
      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /filter by channel name/i }));

      const filterInput = await screen.findByLabelText('Filter channels');
      await user.type(filterInput, 'test');

      await waitFor(() => {
        expect(useChannelList).toHaveBeenCalledWith(
          expect.objectContaining({ searchTerm: 'test' })
        );
      });
    });

    test('clears filter when clear button clicked', async () => {
      const user = userEvent.setup();
      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /filter by channel name/i }));

      const filterInput = await screen.findByLabelText('Filter channels');
      await user.type(filterInput, 'test');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filter/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /clear filter/i }));

      await waitFor(() => {
        expect(useChannelList).toHaveBeenCalledWith(
          expect.objectContaining({ searchTerm: '' })
        );
      });
    });

    test('highlights filter button when filter is active', async () => {
      const user = userEvent.setup();
      renderSubscriptions();

      const filterButton = screen.getByRole('button', { name: /filter by channel name/i });

      await user.click(filterButton);
      const filterInput = await screen.findByLabelText('Filter channels');
      await user.type(filterInput, 'test');

      // Close the popover by clicking outside
      await user.click(document.body);

      // The filter button should now have primary color
      await waitFor(() => {
        expect(filterButton).toHaveClass('icon-btn-primary');
      });
    });

    test('resets page to 1 when filter applied', async () => {
      const user = userEvent.setup();
      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /filter by channel name/i }));
      const filterInput = await screen.findByLabelText('Filter channels');
      await user.type(filterInput, 'test');

      await waitFor(() => {
        expect(useChannelList).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1 })
        );
      });
    });

    test('opens the mobile filter sheet from the toolbar button', async () => {
      const user = userEvent.setup();
      (useMediaQuery as jest.Mock).mockReturnValue(true);

      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /filters/i }));

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'channel-filter-sheet-title');
      expect(within(dialog).getByLabelText('Filter channels')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /done/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Folder Filtering', () => {
    test('displays folder filter button', () => {
      renderSubscriptions();
      expect(screen.getByRole('button', { name: /filter or group by folder/i })).toBeInTheDocument();
    });

    test('opens folder menu when folder button clicked', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: ['music', 'news'],
      });

      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /filter or group by folder/i }));

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /all folders/i })).toBeInTheDocument();
      });
    });

    test('displays available folders in menu', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: ['music', 'news'],
      });

      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /filter or group by folder/i }));

      await waitFor(() => {
        expect(screen.getByText('__music/')).toBeInTheDocument();
      });
      expect(screen.getByText('__news/')).toBeInTheDocument();
    });

    test('filters by selected folder', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: ['music', 'news'],
      });

      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /filter or group by folder/i }));
      await user.click(screen.getByText('__music/'));

      await waitFor(() => {
        expect(useChannelList).toHaveBeenCalledWith(
          expect.objectContaining({ subFolder: 'music' })
        );
      });
    });

    test('clears folder filter when "All folders" selected', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: ['music'],
      });

      renderSubscriptions();

      // First select a folder
      await user.click(screen.getByRole('button', { name: /filter or group by folder/i }));
      await user.click(screen.getByText('__music/'));

      // Then clear it
      await user.click(screen.getByRole('button', { name: /filtering by __music\//i }));
      await user.click(screen.getByRole('menuitem', { name: /all folders/i }));

      await waitFor(() => {
        expect(useChannelList).toHaveBeenCalledWith(
          expect.objectContaining({ subFolder: undefined })
        );
      });
    });
  });

  describe('Pagination', () => {
    test('displays pagination when multiple pages exist', () => {
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 50,
        totalPages: 3,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();
      expect(screen.getAllByRole('navigation', { name: /pagination/i }).length).toBeGreaterThan(0);
    });

    test('changes page when pagination button clicked', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 50,
        totalPages: 3,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();

      const [nextButton] = screen.getAllByRole('button', { name: /go to page 2/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(useChannelList).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        );
      });
    });

    test('adjusts page if current page exceeds total pages', () => {
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 5,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();

      // The component should automatically adjust if page > pageCount
      expect(useChannelList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });
  });

  describe('Navigation', () => {
    test('navigates to channel page when channel clicked', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();

      await user.click(screen.getByTestId(`navigate-${mockChannels[0].url}`));

      expect(mockNavigate).toHaveBeenCalledWith(`/channel/${mockChannels[0].channel_id}`);
    });

    test('does not navigate when channel_id is missing', async () => {
      const user = userEvent.setup();
      const channelWithoutId: Channel = {
        url: 'https://www.youtube.com/@nochannel',
        uploader: 'No ID Channel',
        channel_id: undefined as any,
      };

      useChannelList.mockReturnValue({
        channels: [channelWithoutId],
        total: 1,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();

      await user.click(screen.getByTestId(`navigate-${channelWithoutId.url}`));

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Integration', () => {
    test('subscribes to websocket on mount', () => {
      const wsCtx = createMockWebSocketContext();
      renderWithProviders(
        <Subscriptions token={mockToken} />,
        { websocketValue: wsCtx }
      );

      expect(wsCtx.subscribe).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function)
      );
    });

    test('unsubscribes from websocket on unmount', () => {
      const wsCtx = createMockWebSocketContext();
      const { unmount } = renderWithProviders(
        <Subscriptions token={mockToken} />,
        { websocketValue: wsCtx }
      );

      unmount();

      expect(wsCtx.unsubscribe).toHaveBeenCalled();
    });

    test('refetches channels when channelsUpdated message received', async () => {
      useChannelMutations.mockReturnValue({
        pendingAdditions: [],
        deletedChannels: [],
        isAddingChannel: false,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: false,
      });

      const wsCtx = createMockWebSocketContext();
      renderWithProviders(
        <Subscriptions token={mockToken} />,
        { websocketValue: wsCtx }
      );

      const [messageFilter, handleMessage] = wsCtx.subscribe.mock.calls[0];

      // Test filter
      expect(messageFilter({
        destination: 'broadcast',
        source: 'channel',
        type: 'channelsUpdated',
      })).toBe(true);

      expect(messageFilter({
        destination: 'private',
        source: 'channel',
        type: 'channelsUpdated',
      })).toBe(false);

      // Trigger message handler
      handleMessage();

      await waitFor(() => {
        expect(mockRefetchChannels).toHaveBeenCalled();
      });
    });

    test('does not refetch when there are pending changes', () => {
      useChannelMutations.mockReturnValue({
        pendingAdditions: [mockChannels[0]],
        deletedChannels: [],
        isAddingChannel: false,
        isSaving: false,
        addChannel: mockAddChannel,
        queueChannelForDeletion: mockQueueChannelForDeletion,
        undoChanges: mockUndoChanges,
        saveChanges: mockSaveChanges,
        hasPendingChanges: true,
      });

      const wsCtx = createMockWebSocketContext();
      renderWithProviders(
        <Subscriptions token={mockToken} />,
        { websocketValue: wsCtx }
      );

      const [, handleMessage] = wsCtx.subscribe.mock.calls[0];

      // Trigger message handler
      handleMessage();

      // Should not refetch when there are pending changes
      expect(mockRefetchChannels).not.toHaveBeenCalled();
    });
  });

  describe('Help Dialog', () => {
    test('opens help dialog when help button clicked', async () => {
      const user = userEvent.setup();
      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /learn how channel downloads work/i }));

      await waitFor(() => {
        expect(screen.getByTestId('help-dialog')).toBeInTheDocument();
      });
    });

    test('closes help dialog when close action triggered', async () => {
      const user = userEvent.setup();
      renderSubscriptions();

      await user.click(screen.getByRole('button', { name: /learn how channel downloads work/i }));

      const helpDialog = await screen.findByTestId('help-dialog');
      await user.click(helpDialog);

      await waitFor(() => {
        expect(screen.queryByTestId('help-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    test('uses the default persisted page size on initial render', () => {
      renderSubscriptions();

      expect(useChannelList).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 16 })
      );
    });
  });

  describe('Edge Cases', () => {
    test('handles null token gracefully', () => {
      renderSubscriptions({ token: null });
      expect(screen.getByText('Channels & Playlists')).toBeInTheDocument();
    });

    test('handles empty subfolder list', () => {
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 2,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: [],
      });

      renderSubscriptions();
      expect(screen.getByText('Channels & Playlists')).toBeInTheDocument();
    });

    test('closes dialog when close button clicked', async () => {
      const user = userEvent.setup();
      mockAddChannel.mockResolvedValue({
        success: false,
        message: 'Test error'
      });

      renderSubscriptions();

      const input = screen.getByPlaceholderText('Paste a channel URL or @handle');
      await user.type(input, '@test');
      await user.click(screen.getByRole('button', { name: /^channel$/i }));

      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /close/i }));

      await waitFor(() => {
        expect(screen.queryByText('Test error')).not.toBeInTheDocument();
      });
    });

    test('handles combined filter and folder selection', async () => {
      const user = userEvent.setup();
      useChannelList.mockReturnValue({
        channels: mockChannels,
        total: 10,
        totalPages: 1,
        loading: false,
        error: null,
        refetch: mockRefetchChannels,
        subFolders: ['music'],
      });

      renderSubscriptions();

      // Apply text filter
      await user.click(screen.getByRole('button', { name: /filter by channel name/i }));
      const filterInput = await screen.findByLabelText('Filter channels');
      await user.type(filterInput, 'test');

      // Close the filter popover by clicking elsewhere
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByLabelText('Filter channels')).not.toBeInTheDocument();
      });

      // Apply folder filter
      await user.click(screen.getByRole('button', { name: /filter or group by folder/i }));

      await waitFor(() => {
        expect(screen.getByText('__music/')).toBeInTheDocument();
      });

      await user.click(screen.getByText('__music/'));

      await waitFor(() => {
        expect(screen.getByText('Total matching channels: 10')).toBeInTheDocument();
      });
    });
  });
});
