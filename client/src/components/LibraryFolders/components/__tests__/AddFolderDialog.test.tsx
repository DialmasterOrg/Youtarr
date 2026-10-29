import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddFolderDialog } from '../dialogs/AddFolderDialog';
import { folderNameError } from '../dialogs/AddFolderNameStep';
import { folder, inPage, makePageValue, renderInPage } from '../../__tests__/renderPage';
import { useCreateLibraryFolder } from '../../hooks/useCreateLibraryFolder';
import { useLibraryCheck } from '../../../../hooks/useLibraryCheck';
import { ReorganizeRequiredError } from '../../../shared/Reorganize';

jest.mock('../../hooks/useCreateLibraryFolder', () => ({ useCreateLibraryFolder: jest.fn() }));
jest.mock('../../../../hooks/useLibraryCheck', () => ({ useLibraryCheck: jest.fn() }));

describe('folderNameError', () => {
  test('mirrors the server rules', () => {
    expect(folderNameError('__Kids', [])).toBe('Leave out the underscores: Youtarr adds __ for you.');
    expect(folderNameError('Kids!', [])).toBe('Use letters, numbers, spaces, hyphens and underscores only.');
    expect(folderNameError('x'.repeat(101), [])).toBe('Use 100 characters or fewer.');
    expect(folderNameError('Playlists', [])).toBe('"playlists" is reserved for Youtarr\'s playlist files.');
    expect(folderNameError('kids', ['Kids'])).toBe('There is already a folder named __kids.');
    expect(folderNameError('Science Shows', ['Kids'])).toBeNull();
  });
});

describe('AddFolderDialog', () => {
  let createFolder: jest.Mock;
  beforeEach(() => {
    createFolder = jest.fn().mockResolvedValue({ name: 'Science', layout: 'tv', created: true, existingContent: false });
    (useCreateLibraryFolder as jest.Mock).mockReturnValue({ creating: false, createFolder });
    (useLibraryCheck as jest.Mock).mockReturnValue({ data: null, loading: false, error: null, lastCheckedAt: null, refetch: jest.fn(), applyPlexMapping: jest.fn() });
  });

  test('creates with the preset layout, selects it and goes to step 2', async () => {
    const onCreated = jest.fn();
    renderInPage(<AddFolderDialog open initialLayout="tv" onClose={jest.fn()} onCreated={onCreated} onNeedsReview={jest.fn()} />,
      { value: makePageValue({ folders: [folder('', { isDefault: true })] }) });
    expect(screen.getByRole('radio', { name: /TV shows/ })).toBeChecked();
    await userEvent.type(screen.getByLabelText('Folder name'), 'Science');
    await userEvent.click(screen.getByRole('button', { name: 'Create __Science' }));
    expect(createFolder).toHaveBeenCalledWith('Science', 'tv');
    expect(onCreated).toHaveBeenCalledWith('Science');
    expect(await screen.findByRole('heading', { name: 'Set up your media servers' })).toBeInTheDocument();
    expect(screen.getByText(/Next: choose channels for __Science/)).toBeInTheDocument();
  });

  test('shows a server error on step 1', async () => {
    createFolder.mockRejectedValue(new Error("Couldn't create the folder on disk: EACCES"));
    renderInPage(<AddFolderDialog open initialLayout="videos" onClose={jest.fn()} onCreated={jest.fn()} onNeedsReview={jest.fn()} />);
    await userEvent.type(screen.getByLabelText('Folder name'), 'Science');
    await userEvent.click(screen.getByRole('button', { name: 'Create __Science' }));
    expect(await screen.findByText("Couldn't create the folder on disk: EACCES")).toBeInTheDocument();
    expect(screen.getByLabelText('Folder name')).toHaveAttribute('aria-invalid', 'true');
  });

  test('hands a directory with files over to the review', async () => {
    const change = { type: 'folderLayout' as const, folder: 'Old', layout: 'tv' as const };
    createFolder.mockRejectedValue(new ReorganizeRequiredError('Review the move', change));
    const onNeedsReview = jest.fn();
    const onCreated = jest.fn();
    renderInPage(<AddFolderDialog open initialLayout="tv" onClose={jest.fn()} onCreated={onCreated} onNeedsReview={onNeedsReview} />);
    await userEvent.type(screen.getByLabelText('Folder name'), 'Old');
    await userEvent.click(screen.getByRole('button', { name: 'Create __Old' }));
    expect(onNeedsReview).toHaveBeenCalledWith(change, 'Old');
    expect(onCreated).not.toHaveBeenCalled();
  });

  test('step 2 auto-applies the one Plex TV library when nothing was chosen', async () => {
    const applyPlexMapping = jest.fn().mockResolvedValue(undefined);
    (useLibraryCheck as jest.Mock).mockReturnValue({ loading: false, error: null, lastCheckedAt: null, refetch: jest.fn(), applyPlexMapping, data: {
      servers: [{ serverType: 'plex', name: 'Plex', reachable: true, error: null, downloadsPath: 'Q:\\Y' }],
      folders: [{ name: 'Science', layout: 'tv', hasFiles: false, channels: 0, servers: [{
        serverType: 'plex', status: 'ok', issues: [], plexMapping: { mappedLibraryId: null, suggestedLibraryId: '41', choice: 'none' },
        libraries: [{ id: '41', name: 'YouTube TV', type: 'tv', location: 'Q:\\Y\\__Science', relation: 'exact' }],
      }] }],
    } });
    renderInPage(<AddFolderDialog open initialLayout="tv" onClose={jest.fn()} onCreated={jest.fn()} onNeedsReview={jest.fn()} />,
      { value: makePageValue({ servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'] }) });
    await userEvent.type(screen.getByLabelText('Folder name'), 'Science');
    await userEvent.click(screen.getByRole('button', { name: 'Create __Science' }));
    expect(await screen.findByText('New episodes in __Science now refresh YouTube TV.')).toBeInTheDocument();
    expect(applyPlexMapping).toHaveBeenCalledWith('Science', '41');
  });

  test('step 2 moves focus to its heading when no media server is connected', async () => {
    renderInPage(<AddFolderDialog open initialLayout="videos" onClose={jest.fn()} onCreated={jest.fn()} onNeedsReview={jest.fn()} />);
    await userEvent.type(screen.getByLabelText('Folder name'), 'Science');
    await userEvent.click(screen.getByRole('button', { name: 'Create __Science' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Set up your media servers' })).toHaveFocus());
  });

  test('step 2 moves focus to the first server section, which stays put when the check answers', async () => {
    const checking = { data: null, loading: true, error: null, lastCheckedAt: null, refetch: jest.fn(), applyPlexMapping: jest.fn() };
    (useLibraryCheck as jest.Mock).mockReturnValue(checking);
    const value = makePageValue({
      servers: [{ serverType: 'plex', name: 'Plex' }, { serverType: 'jellyfin', name: 'Jellyfin' }], configuredServers: ['plex', 'jellyfin'],
    });
    const { rerender } = renderInPage(<AddFolderDialog open initialLayout="videos" onClose={jest.fn()} onCreated={jest.fn()} onNeedsReview={jest.fn()} />, { value });
    await userEvent.type(screen.getByLabelText('Folder name'), 'Science');
    await userEvent.click(screen.getByRole('button', { name: 'Create __Science' }));
    await waitFor(() => expect(screen.getByTestId('add-folder-server-plex')).toHaveFocus());
    expect(within(screen.getByTestId('add-folder-server-plex')).getByText('Checking Plex...')).toBeInTheDocument();

    (useLibraryCheck as jest.Mock).mockReturnValue({ ...checking, loading: false, data: {
      servers: [{ serverType: 'plex', name: 'Plex', reachable: true, error: null, downloadsPath: '/data' },
        { serverType: 'jellyfin', name: 'Jellyfin', reachable: true, error: null, downloadsPath: '/data' }],
      folders: [],
    } });
    rerender(inPage(<AddFolderDialog open initialLayout="videos" onClose={jest.fn()} onCreated={jest.fn()} onNeedsReview={jest.fn()} />, value));
    expect(screen.queryByText('Checking Plex...')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-folder-server-plex')).toHaveFocus();
  });

  test('step 2 gives See your options a 44px target on phones', async () => {
    (useLibraryCheck as jest.Mock).mockReturnValue({ loading: false, error: null, lastCheckedAt: null, refetch: jest.fn(), applyPlexMapping: jest.fn(), data: {
      servers: [{ serverType: 'jellyfin', name: 'Jellyfin', reachable: true, error: null, downloadsPath: '/data' }],
      folders: [{ name: 'Science', layout: 'tv', hasFiles: false, channels: 0, servers: [{
        serverType: 'jellyfin', status: 'missing', issues: [{ code: 'nestedLibrary', message: 'Nested', libraryId: '1' }],
        libraries: [{ id: '1', name: 'YouTube', type: 'videos', location: '/data', relation: 'covers' }],
      }] }],
    } });
    renderInPage(<AddFolderDialog open initialLayout="tv" onClose={jest.fn()} onCreated={jest.fn()} onNeedsReview={jest.fn()} />,
      { value: makePageValue({ phone: true, servers: [{ serverType: 'jellyfin', name: 'Jellyfin' }], configuredServers: ['jellyfin'] }) });
    await userEvent.type(screen.getByLabelText('Folder name'), 'Science');
    await userEvent.click(screen.getByRole('button', { name: 'Create __Science' }));
    expect(await screen.findByRole('button', { name: 'See your options' })).toHaveClass('inline-flex', 'min-h-[44px]', 'items-center');
  });

  const stepTwoNote = async (configured: Array<'plex' | 'jellyfin' | 'emby'>) => {
    const names = { plex: 'Plex', jellyfin: 'Jellyfin', emby: 'Emby' };
    (useLibraryCheck as jest.Mock).mockReturnValue({ data: { servers: [], folders: [] }, loading: false, error: null, lastCheckedAt: null, refetch: jest.fn(), applyPlexMapping: jest.fn() });
    renderInPage(<AddFolderDialog open initialLayout="videos" onClose={jest.fn()} onCreated={jest.fn()} onNeedsReview={jest.fn()} />,
      { value: makePageValue({ servers: configured.map((serverType) => ({ serverType, name: names[serverType] })), configuredServers: configured }) });
    await userEvent.type(screen.getByLabelText('Folder name'), 'Science');
    await userEvent.click(screen.getByRole('button', { name: 'Create __Science' }));
    await screen.findByRole('heading', { name: 'Set up your media servers' });
  };

  test('step 2 mentions only Kodi when every server is connected', async () => {
    await stepTwoNote(['plex', 'jellyfin', 'emby']);
    expect(screen.getByText("Kodi isn't checked. Kodi: a TV shows source set to Local information only.")).toBeInTheDocument();
  });

  test('step 2 names each server that is not connected', async () => {
    await stepTwoNote(['plex']);
    expect(screen.getByText("Jellyfin and Emby aren't connected and Kodi isn't checked. Emby: a TV shows library, NFO reader on, NFO saver and downloaders off. Kodi: a TV shows source set to Local information only.")).toBeInTheDocument();
  });
});
