import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import ChannelManager from '../../ChannelManager';
import { useChannelList } from '../hooks/useChannelList';
import { useChannelMutations } from '../hooks/useChannelMutations';

jest.mock('../hooks/useChannelList');
jest.mock('../hooks/useChannelMutations');

const mockUseChannelList = useChannelList as jest.MockedFunction<typeof useChannelList>;
const mockUseChannelMutations = useChannelMutations as jest.MockedFunction<typeof useChannelMutations>;

describe('ChannelManager loading flow', () => {
  it('clears syncing state within 3 seconds', async () => {
    let listState = {
      channels: [],
      total: 0,
      totalPages: 0,
      loading: true,
      error: null,
      refetch: jest.fn(),
      subFolders: [],
    };

    mockUseChannelList.mockImplementation(() => listState as any);
    mockUseChannelMutations.mockReturnValue({
      pendingAdditions: [],
      deletedChannels: [],
      isAddingChannel: false,
      isSaving: false,
      addChannel: jest.fn().mockResolvedValue({ success: true }),
      queueChannelForDeletion: jest.fn(),
      undoChanges: jest.fn(),
      saveChanges: jest.fn().mockResolvedValue({}),
      hasPendingChanges: false,
    } as any);

    const { rerender } = renderWithProviders(<ChannelManager token="test-token" />);

    expect(screen.getByText(/syncing channels\.{3}/i)).toBeInTheDocument();

    listState = {
      channels: [{
        url: 'https://youtube.com/@test',
        uploader: 'Test Channel',
        channel_id: 'UC_TEST',
        auto_download_enabled_tabs: 'video',
      }],
      total: 1,
      totalPages: 1,
      loading: false,
      error: null,
      refetch: jest.fn(),
      subFolders: [],
    };

    rerender(<ChannelManager token="test-token" />);

    await waitFor(() => {
      expect(screen.queryByText(/syncing channels\.{3}/i)).not.toBeInTheDocument();
      expect(screen.getByText('Test Channel')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
