import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelTvMediaServers from '../ChannelTvMediaServers';
import type { UseLibraryCheckResult } from '../../../../hooks/useLibraryCheck';
import type { LibraryCheckResponse, PlexMappingState } from '../../../../types/libraryCheck';

let mockCheck: UseLibraryCheckResult;

jest.mock('../../../../hooks/useLibraryCheck', () => ({
  useLibraryCheck: () => mockCheck,
}));

const checkWith = (plexMapping: PlexMappingState): LibraryCheckResponse => ({
  servers: [{ serverType: 'plex', name: 'Plex', reachable: true, error: null }],
  folders: [{
    name: 'TV Shows',
    layout: 'tv',
    hasFiles: true,
    channels: 1,
    servers: [{
      serverType: 'plex',
      status: 'ok',
      libraries: [{ id: '41', name: 'YouTube TV', type: 'tv', location: 'Q:\\Y\\__TV Shows', relation: 'exact' }],
      issues: [],
      plexMapping,
    }],
  }],
});

function setCheck(overrides: Partial<UseLibraryCheckResult>) {
  mockCheck = {
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined),
    applyPlexMapping: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ChannelTvMediaServers', () => {
  test('shows progress while the check runs', () => {
    setCheck({ loading: true });
    render(<ChannelTvMediaServers token="token" folder="TV Shows" />);

    expect(screen.getByText('Checking media server libraries...')).toBeInTheDocument();
  });

  test('falls back to the setup notes without configured media servers', () => {
    setCheck({ data: { servers: [], folders: [] } });
    render(<ChannelTvMediaServers token="token" folder="TV Shows" />);

    expect(screen.getByText('Media server setup')).toBeInTheDocument();
  });

  test("shows the libraries that hold the channel's folder", () => {
    setCheck({ data: checkWith({ mappedLibraryId: '41', suggestedLibraryId: '41' }) });
    render(<ChannelTvMediaServers token="token" folder="TV Shows" />);

    expect(screen.getByText(/YouTube TV/)).toBeInTheDocument();
  });

  test('maps the folder to the one Plex TV library that holds it', async () => {
    setCheck({ data: checkWith({ mappedLibraryId: null, suggestedLibraryId: '41' }) });
    render(<ChannelTvMediaServers token="token" folder="TV Shows" />);

    await waitFor(() => expect(mockCheck.applyPlexMapping).toHaveBeenCalledWith('TV Shows', '41'));
    expect(await screen.findByText('New episodes now refresh the Plex library YouTube TV.')).toBeInTheDocument();
  });

  test('leaves an existing mapping alone', () => {
    setCheck({ data: checkWith({ mappedLibraryId: '37', suggestedLibraryId: '41' }) });
    render(<ChannelTvMediaServers token="token" folder="TV Shows" />);

    expect(mockCheck.applyPlexMapping).not.toHaveBeenCalled();
  });

  test('maps only once for the same folder and library', async () => {
    setCheck({ data: checkWith({ mappedLibraryId: null, suggestedLibraryId: '41' }) });
    const { rerender } = render(<ChannelTvMediaServers token="token" folder="TV Shows" />);
    await waitFor(() => expect(mockCheck.applyPlexMapping).toHaveBeenCalledTimes(1));

    rerender(<ChannelTvMediaServers token="token" folder="TV Shows" />);

    expect(mockCheck.applyPlexMapping).toHaveBeenCalledTimes(1);
  });

  test('checks again on request', async () => {
    const user = userEvent.setup();
    setCheck({ data: checkWith({ mappedLibraryId: '41', suggestedLibraryId: '41' }) });
    render(<ChannelTvMediaServers token="token" folder="TV Shows" />);

    await user.click(screen.getByRole('button', { name: 'Check again' }));

    expect(mockCheck.refetch).toHaveBeenCalled();
  });
});
