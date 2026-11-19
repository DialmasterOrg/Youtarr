import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import LibraryFolders from '..';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { TooltipProvider } from '../../ui/tooltip';
import type { LibraryFolder } from '../../../types/tvShows';
import type { LibraryCheckResponse } from '../../../types/libraryCheck';
import type { ReorganizeOperation } from '../../../types/reorganize';
import { folder } from './renderPage';
import { useLibraryFolders } from '../../../hooks/useLibraryFolders';
import { useLibraryCheck } from '../../../hooks/useLibraryCheck';
import { useMediaServerStatus } from '../../../hooks/useMediaServerStatus';
import { useContainerWidth } from '../../../hooks/useContainerWidth';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

jest.mock('../../../hooks/useLibraryFolders', () => ({ useLibraryFolders: jest.fn(), LIBRARY_FOLDERS_UPDATED_EVENT: 'library-folders-updated' }));
jest.mock('../../../hooks/useLibraryCheck', () => ({ useLibraryCheck: jest.fn() }));
jest.mock('../../../hooks/useMediaServerStatus', () => ({ useMediaServerStatus: jest.fn() }));
jest.mock('../../../hooks/useContainerWidth', () => ({ useContainerWidth: jest.fn() }));
jest.mock('../../../hooks/useMediaQuery', () => ({ __esModule: true, default: jest.fn(), useMediaQuery: jest.fn() }));
let mockOperation: ReorganizeOperation | null = null;
jest.mock('../../shared/Reorganize', () => ({
  ...jest.requireActual('../../shared/Reorganize'),
  ReorganizeDialog: ({ onApplied }: { onApplied?: (result: { operationId: number; applied: boolean }) => void }) => {
    const React = require('react');
    return React.createElement('button', { type: 'button', onClick: () => onApplied?.({ operationId: 3, applied: true }) }, 'start move 3');
  },
  useActiveReorganize: () => ({ operation: mockOperation }),
  useReorganizeOutcome: () => undefined,
}));
jest.mock('../hooks/useLibraryFolderDetail', () => ({ useLibraryFolderDetail: () => ({ detail: null }) }));
jest.mock('../components/FolderInspector', () => ({ FolderInspector: ({ folder: selected }: { folder: LibraryFolder }) => {
  const React = require('react');
  const { useLibraryPage } = require('../LibraryFoldersContext');
  const page = useLibraryPage();
  const target = page.focusTarget ? `${page.focusTarget.folder}:${page.focusTarget.serverType ?? ''}` : 'none';
  return React.createElement('div', null,
    React.createElement('p', null, `inspector ${selected.name || 'main'}`),
    React.createElement('p', null, `focus target ${target}`),
    React.createElement('button', { type: 'button', onClick: () => page.openDelete(selected) }, 'Open delete'));
} }));
jest.mock('../components/dialogs/DeleteFolderDialog', () => ({
  DeleteFolderDialog: ({ folder: target, onDeleted }: { folder: LibraryFolder; onDeleted: (deleted: LibraryFolder) => void }) => {
    const React = require('react');
    return React.createElement('button', { type: 'button', onClick: () => onDeleted(target) }, 'Confirm delete');
  },
}));

const folders = [folder('', { channels: 1 }), folder('Kids', { isDefault: true, channels: 3 }), folder('Empty')];

function libraryResult(overrides: Record<string, unknown> = {}) {
  return { folders, loading: false, loaded: true, error: null, refetch: jest.fn(), setFolderLayout: jest.fn(), layoutOf: () => 'videos', ...overrides };
}

const page = (
  <LibraryFolders token="token" config={{ ...DEFAULT_CONFIG, youtubeOutputDirectory: '/data' }}
    isPlatformManaged={{ plexUrl: false, authEnabled: true, useTmpForDownloads: false, ytdlpUpdates: false }}
    deploymentEnvironment={{ isWsl: false, timezone: 'UTC' }} plexLibraries={[]} plexConnectionStatus="not_tested" setSnackbar={jest.fn()} />
);

function pageAt(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/settings/library/*" element={page} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>
  );
}

function HistoryBack() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>history back</button>;
}

function checkResult(data: LibraryCheckResponse | null, extra: Record<string, unknown> = {}) {
  return { data, loading: false, error: null, lastCheckedAt: 0, refetch: jest.fn(), applyPlexMapping: jest.fn(), ...extra };
}

function renderAt(path: string, width: number) {
  (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), width]);
  return render(pageAt(path));
}

describe('LibraryFolders page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockOperation = null;
    jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    (useLibraryFolders as jest.Mock).mockReturnValue(libraryResult());
    (useLibraryCheck as jest.Mock).mockReturnValue(checkResult({ servers: [], folders: [] }));
    (useMediaServerStatus as jest.Mock).mockReturnValue({ status: { plex: false, jellyfin: false, emby: false }, loading: false });
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('a running move marks its folder Moving', () => {
    mockOperation = { id: 3, label: 'Kids', status: 'running', change: { type: 'folderLayout', folder: 'kids', layout: 'tv' } };
    renderAt('/settings/library', 1100);
    expect(screen.getByRole('button', { name: /__Kids/ })).toHaveTextContent('Moving');
    expect(screen.getByRole('button', { name: /^Main folder/ })).not.toHaveTextContent('Moving');
  });

  test('when a running reorganize ends, the folders and the check are fetched again', () => {
    const refetchFolders = jest.fn();
    const refetchCheck = jest.fn();
    (useLibraryFolders as jest.Mock).mockReturnValue(libraryResult({ refetch: refetchFolders }));
    (useLibraryCheck as jest.Mock).mockReturnValue(checkResult({ servers: [], folders: [] }, { refetch: refetchCheck }));
    mockOperation = { id: 3, label: 'Elsewhere', status: 'running' };
    const { rerender } = renderAt('/settings/library', 1100);
    expect(refetchFolders).not.toHaveBeenCalled();

    mockOperation = null;
    rerender(pageAt('/settings/library'));

    expect(refetchFolders).toHaveBeenCalledTimes(1);
    expect(refetchCheck).toHaveBeenCalledTimes(1);
  });

  test('a move this page started is left to its own follow-up when it ends, so the page refreshes once', async () => {
    const refetchFolders = jest.fn();
    (useLibraryFolders as jest.Mock).mockReturnValue(libraryResult({ refetch: refetchFolders }));
    const { rerender } = renderAt('/settings/library', 1100);
    await userEvent.click(screen.getByRole('button', { name: 'start move 3' }));
    mockOperation = { id: 3, label: 'Kids', status: 'running' };
    rerender(pageAt('/settings/library'));

    mockOperation = null;
    rerender(pageAt('/settings/library'));

    expect(refetchFolders).not.toHaveBeenCalled();
  });

  test('narrow: Back returns to the list and focuses the folder\'s row', async () => {
    renderAt('/settings/library', 800);
    await userEvent.click(screen.getByRole('button', { name: /__Kids/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Library folders' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /__Kids/ })).toHaveFocus());
  });

  test('narrow: the guide stays expanded after Back when a TV folder was created meanwhile', async () => {
    const { rerender } = renderAt('/settings/library', 800);
    expect(screen.getByRole('button', { name: 'Hide the guide' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /__Kids/ }));
    await screen.findByText('inspector Kids');
    (useLibraryFolders as jest.Mock).mockReturnValue(libraryResult({ folders: [...folders, folder('Shows', { layout: 'tv' })] }));
    rerender(pageAt('/settings/library/Kids'));

    await userEvent.click(await screen.findByRole('button', { name: 'Library folders' }));

    expect(await screen.findByRole('button', { name: 'Hide the guide' })).toHaveAttribute('aria-expanded', 'true');
  });

  test('narrow: deleting from a detail opened from the list goes back instead of adding a list entry', async () => {
    (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), 800]);
    render(
      <MemoryRouter initialEntries={['/settings', '/settings/library']} initialIndex={1}>
        <TooltipProvider>
          <HistoryBack />
          <Routes>
            <Route path="/settings" element={<p>settings index</p>} />
            <Route path="/settings/library/*" element={page} />
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /__Kids/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Open delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(await screen.findByRole('region', { name: /Video folders/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'history back' }));

    expect(await screen.findByText('settings index')).toBeInTheDocument();
  });

  test('an attention jump selects the folder and points the inspector at the server', async () => {
    (useMediaServerStatus as jest.Mock).mockReturnValue({ status: { plex: false, jellyfin: true, emby: false }, loading: false });
    (useLibraryCheck as jest.Mock).mockReturnValue(checkResult({
      servers: [{ serverType: 'jellyfin', name: 'Jellyfin', reachable: true, error: null, downloadsPath: '/data' }],
      folders: [{ name: 'Empty', layout: 'videos', hasFiles: false, channels: 0, servers: [{
        serverType: 'jellyfin', status: 'warning', issues: [{ code: 'nfoSaver', message: 'Saves NFO files', libraryId: '5' }],
        libraries: [{ id: '5', name: 'Spare', type: 'videos', location: '/data/__Empty', relation: 'exact' }],
      }] }],
    }));
    renderAt('/settings/library', 1100);
    await screen.findByText('inspector Kids');

    await userEvent.click(screen.getByRole('button', { name: 'Jellyfin library Spare saves NFO files' }));

    expect(await screen.findByText('inspector Empty')).toBeInTheDocument();
    expect(screen.getByText('focus target Empty:jellyfin')).toBeInTheDocument();
  });

  test('while the media server status loads, nothing says no server is connected', () => {
    (useMediaServerStatus as jest.Mock).mockReturnValue({ status: { plex: false, jellyfin: false, emby: false }, loading: true });
    (useLibraryCheck as jest.Mock).mockReturnValue(checkResult(null, { loading: true }));
    renderAt('/settings/library', 1100);
    expect(screen.queryByText(/No media server connected/)).not.toBeInTheDocument();
  });

  test('two columns select the default folder and show its inspector', async () => {
    renderAt('/settings/library', 1100);
    expect(await screen.findByText('inspector Kids')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Library folders' })).toBeInTheDocument();
  });

  test('narrow: the list, then a pushed detail screen', async () => {
    renderAt('/settings/library', 800);
    expect(screen.queryByText(/^inspector/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /__Kids/ }));
    expect(await screen.findByText('inspector Kids')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Library folders' })).toBeInTheDocument();
  });

  test('a folder list error shows Retry and keeps the header', async () => {
    const refetch = jest.fn();
    (useLibraryFolders as jest.Mock).mockReturnValue(libraryResult({ folders: [], error: 'Failed to load library folders', refetch }));
    renderAt('/settings/library', 1100);
    expect(screen.getByText('Failed to load library folders')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Library folders' })).toBeInTheDocument();
  });

  test('without TV folders, the No TV folders row follows the Video folders shelf', () => {
    renderAt('/settings/library', 1100);
    const regions = screen.getAllByRole('region');
    const videos = screen.getByRole('region', { name: /Video folders/ });
    const tv = screen.getByRole('region', { name: 'TV show folders' });
    expect(regions.indexOf(videos)).toBeLessThan(regions.indexOf(tv));
  });

  test('with a TV folder, the TV show folders shelf comes first', () => {
    (useLibraryFolders as jest.Mock).mockReturnValue(libraryResult({ folders: [...folders, folder('Shows', { layout: 'tv', channels: 2 })] }));
    renderAt('/settings/library', 1100);
    const regions = screen.getAllByRole('region');
    const tv = screen.getByRole('region', { name: 'TV show folders' });
    const videos = screen.getByRole('region', { name: /Video folders/ });
    expect(regions.indexOf(tv)).toBeLessThan(regions.indexOf(videos));
  });

  test('an unknown folder URL shows the not-found notice', async () => {
    renderAt('/settings/library/Gone', 1100);
    expect(await screen.findByText("Library folder __Gone wasn't found. It may have been deleted.")).toBeInTheDocument();
  });

  test('a folder URL waits while the list reloads instead of reporting it missing', () => {
    (useLibraryFolders as jest.Mock).mockReturnValue(libraryResult({ loading: true }));
    renderAt('/settings/library/New', 1100);
    expect(screen.queryByText(/wasn't found/)).not.toBeInTheDocument();
  });

  test('selecting another folder starts the inspector scrolled to the top', async () => {
    renderAt('/settings/library', 1100);
    await screen.findByText('inspector Kids');
    screen.getByRole('complementary').scrollTop = 240;
    await userEvent.click(screen.getByRole('button', { name: /^Main folder/ }));
    await screen.findByText('inspector main');
    expect(screen.getByRole('complementary').scrollTop).toBe(0);
  });

  test('after deleting the last TV folder, focus lands on the Video folders heading once the list drops it', async () => {
    (useLibraryFolders as jest.Mock).mockReturnValue(libraryResult({ folders: [...folders, folder('Shows', { layout: 'tv' })] }));
    const { rerender } = renderAt('/settings/library/Shows', 1100);
    await userEvent.click(await screen.findByRole('button', { name: 'Open delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    (useLibraryFolders as jest.Mock).mockReturnValue(libraryResult());
    rerender(pageAt('/settings/library/Shows'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Video folders' })).toHaveFocus());
  });

  test('narrow: opening a folder scrolls the window to the top', async () => {
    renderAt('/settings/library', 800);
    await userEvent.click(screen.getByRole('button', { name: /__Kids/ }));
    await screen.findByText('inspector Kids');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
