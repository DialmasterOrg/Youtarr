import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../test-utils';
import { LibraryFoldersCard } from '../LibraryFoldersCard';
import { DEFAULT_CONFIG } from '../../../../../config/configSchema';
import { useLibraryFolders } from '../../../../../hooks/useLibraryFolders';
import { useLibraryCheck } from '../../../../../hooks/useLibraryCheck';
import { useMediaServerStatus } from '../../../../../hooks/useMediaServerStatus';
import { useContainerWidth } from '../../../../../hooks/useContainerWidth';
import type { LibraryFolder } from '../../../../../types/tvShows';
import type { LibraryCheckFolder, LibraryCheckResponse } from '../../../../../types/libraryCheck';
import type { MediaServerStatus } from '../../../../../types/playlist';
import type { DeploymentEnvironment, PlatformManagedState } from '../../../types';

jest.mock('../../../../../hooks/useLibraryFolders', () => ({ useLibraryFolders: jest.fn() }));
jest.mock('../../../../../hooks/useLibraryCheck', () => ({ useLibraryCheck: jest.fn() }));
jest.mock('../../../../../hooks/useMediaServerStatus', () => ({ useMediaServerStatus: jest.fn() }));
jest.mock('../../../../../hooks/useContainerWidth', () => ({ useContainerWidth: jest.fn() }));

const f = (name: string, extra: Partial<LibraryFolder> = {}): LibraryFolder => ({ name, layout: 'videos', isDefault: false, hasFiles: false, channels: 0, ...extra });
const missing = (name: string): LibraryCheckFolder => ({ name, layout: 'videos', hasFiles: true, channels: 1, servers: [{ serverType: 'plex', status: 'missing', libraries: [], issues: [] }] });
const config = { ...DEFAULT_CONFIG, youtubeOutputDirectory: '/data/yt' };
const PLATFORM_MANAGED: PlatformManagedState = { plexUrl: false, authEnabled: false, useTmpForDownloads: false, ytdlpUpdates: false };
const PLEX_ONLY: MediaServerStatus = { plex: true, jellyfin: false, emby: false };
const NO_SERVERS: MediaServerStatus = { plex: false, jellyfin: false, emby: false };
const PLEX_CHECK: LibraryCheckResponse = { servers: [{ serverType: 'plex', name: 'Plex', reachable: true, error: null }], folders: [] };

interface SetupOptions {
  folders?: LibraryFolder[];
  foldersLoading?: boolean;
  foldersLoaded?: boolean;
  check?: LibraryCheckResponse | null;
  checkLoading?: boolean;
  servers?: MediaServerStatus;
  serversLoading?: boolean;
  width?: number;
  isPlatformManaged?: PlatformManagedState;
  deploymentEnvironment?: DeploymentEnvironment;
}

function setup({
  folders = [f(''), f('Kids', { isDefault: true, channels: 2 })], foldersLoading = false, foldersLoaded = true,
  check = PLEX_CHECK, checkLoading = false, servers = PLEX_ONLY, serversLoading = false, width = 1000,
  isPlatformManaged = PLATFORM_MANAGED, deploymentEnvironment = { isWsl: false },
}: SetupOptions = {}) {
  (useLibraryFolders as jest.Mock).mockReturnValue({ folders, loading: foldersLoading, loaded: foldersLoaded, error: null, refetch: jest.fn() });
  (useLibraryCheck as jest.Mock).mockReturnValue({
    data: check, loading: checkLoading, error: null, lastCheckedAt: check ? Date.now() : null, refetch: jest.fn(),
  });
  (useMediaServerStatus as jest.Mock).mockReturnValue({ status: servers, loading: serversLoading });
  (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), width]);
  renderWithProviders(
    <LibraryFoldersCard token="token" config={config} isPlatformManaged={isPlatformManaged} deploymentEnvironment={deploymentEnvironment} />
  );
}

const ONE_MISSING = { folders: [f(''), f('A', { channels: 1 })], check: { ...PLEX_CHECK, folders: [missing('A')] } };

describe('LibraryFoldersCard', () => {
  test('facts: downloads folder, default folder with a Change link, counts', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Manage library folders' })).toHaveAttribute('href', '/settings/library');
    expect(screen.getByText('/data/yt')).toBeInTheDocument();
    expect(screen.getByText('__Kids')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change' })).toHaveAttribute('href', '/settings/library/Kids');
    expect(screen.getByText('2 Videos folders')).toBeInTheDocument();
    expect(screen.getByText('0 TV folders')).toBeInTheDocument();
  });

  test('main folder only', () => {
    setup({ folders: [f('', { isDefault: true })] });
    expect(screen.getByText('Main folder only')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Change' })).not.toBeInTheDocument();
  });

  test('a TV default folder says unsubscribed channels become shows', () => {
    setup({ folders: [f(''), f('Shows', { isDefault: true, layout: 'tv', channels: 1 })] });
    expect(screen.getByText(/Each channel you don't subscribe to becomes its own show\./)).toBeInTheDocument();
  });

  test('a downloads folder set by DATA_PATH says so', () => {
    setup({ isPlatformManaged: { ...PLATFORM_MANAGED, youtubeOutputDirectory: true } });
    expect(screen.getByText('Set by the DATA_PATH environment variable.')).toBeInTheDocument();
  });

  test('an Elfhosted downloads folder says the platform sets it', () => {
    setup({ deploymentEnvironment: { isWsl: false, platform: 'Elfhosted' } });
    expect(screen.getByText('This path is configured by your platform deployment and cannot be changed here.')).toBeInTheDocument();
  });

  test('an attention row is named by what it shows', () => {
    setup(ONE_MISSING);
    expect(screen.getByRole('link', { name: /__A.*Plex: No library.*Review/ })).toHaveAttribute('href', '/settings/library/A');
  });

  test('a wide card shows the row message', () => {
    setup(ONE_MISSING);
    expect(screen.getByText('No Plex Other Videos library holds __A.')).toBeInTheDocument();
  });

  test('a medium card drops the row message', () => {
    setup({ ...ONE_MISSING, width: 700 });
    expect(screen.queryByText('No Plex Other Videos library holds __A.')).not.toBeInTheDocument();
  });

  test('a partial check with issues counts them and says which server could not be reached', () => {
    setup({
      folders: [f(''), f('A', { channels: 1 })],
      servers: { plex: true, jellyfin: true, emby: false },
      check: {
        servers: [
          { serverType: 'plex', name: 'Plex', reachable: true, error: null },
          { serverType: 'jellyfin', name: 'Jellyfin', reachable: false, error: 'timeout' },
        ],
        folders: [{
          name: 'A', layout: 'videos', hasFiles: true, channels: 1, servers: [
            { serverType: 'plex', status: 'missing', libraries: [], issues: [] },
            { serverType: 'jellyfin', status: 'unreachable', libraries: [], issues: [] },
          ],
        }],
      },
    });
    expect(screen.getByText('1 needs attention')).toBeInTheDocument();
    expect(screen.getByText(/Jellyfin couldn't be reached\./)).toBeInTheDocument();
    expect(screen.queryByText('All folders OK')).not.toBeInTheDocument();
  });

  test('lists at most three attention rows, then a link to the rest', () => {
    const names = ['A', 'B', 'C', 'D'];
    setup({
      folders: [f(''), ...names.map((name) => f(name, { channels: 1 }))],
      check: { servers: [{ serverType: 'plex', name: 'Plex', reachable: true, error: null }], folders: names.map(missing) },
    });
    expect(screen.getByText('4 need attention')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Review/ })).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'And 1 more on Library folders' })).toHaveAttribute('href', '/settings/library');
  });

  test('a library-wide issue is one row linking to the first folder it affects', () => {
    const nfoSaver = (name: string): LibraryCheckFolder => ({
      name, layout: 'videos', hasFiles: true, channels: 1, servers: [{
        serverType: 'jellyfin', status: 'warning',
        libraries: [{ id: '7', name: 'YouTube', type: 'videos', location: '/media/yt', relation: 'covers' }],
        issues: [{ code: 'nfoSaver', message: 'YouTube saves NFO files.', libraryId: '7' }],
      }],
    });
    setup({
      folders: [f(''), f('A', { channels: 1 }), f('B', { channels: 1 })],
      check: { servers: [{ serverType: 'jellyfin', name: 'Jellyfin', reachable: true, error: null }], folders: [nfoSaver('A'), nfoSaver('B')] },
      servers: { plex: false, jellyfin: true, emby: false },
    });
    const rows = screen.getAllByRole('link', { name: /Review/ });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('href', '/settings/library/A');
    expect(rows[0]).toHaveTextContent('affects 2 folders');
  });

  test('loading folders marks the card busy and shows no counts', () => {
    setup({ folders: [], foldersLoaded: false });
    expect(screen.getByRole('region', { name: 'Library folders' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/Videos folders?$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Main folder')).not.toBeInTheDocument();
  });

  test('a running first check shows the spinner text', () => {
    setup({ check: null, checkLoading: true });
    expect(screen.getByText('Checking media servers...')).toBeInTheDocument();
  });

  test('media server status still loading reads as checking, not as no media server', () => {
    setup({ check: null, servers: NO_SERVERS, serversLoading: true });
    expect(screen.getByText('Checking media servers...')).toBeInTheDocument();
    expect(screen.queryByText('Not checked')).not.toBeInTheDocument();
  });

  test('no media servers links each server settings page', () => {
    setup({ check: { servers: [], folders: [] }, servers: NO_SERVERS });
    expect(screen.getByText('Not checked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plex' })).toHaveAttribute('href', '/settings/plex');
    expect(screen.getByRole('link', { name: 'Jellyfin' })).toHaveAttribute('href', '/settings/jellyfin');
    expect(screen.getByRole('link', { name: 'Emby' })).toHaveAttribute('href', '/settings/emby');
  });

  test('a failed folder list shows Try again', () => {
    (useLibraryFolders as jest.Mock).mockReturnValue({ folders: [], loading: false, loaded: true, error: 'boom', refetch: jest.fn() });
    (useLibraryCheck as jest.Mock).mockReturnValue({ data: null, loading: false, error: null, lastCheckedAt: null, refetch: jest.fn() });
    (useMediaServerStatus as jest.Mock).mockReturnValue({ status: { plex: false, jellyfin: false, emby: false } });
    (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), 1000]);
    renderWithProviders(
      <LibraryFoldersCard token="token" config={config} isPlatformManaged={PLATFORM_MANAGED} deploymentEnvironment={{ isWsl: false }} />
    );
    expect(screen.getByText("Couldn't load library folders: boom.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  test('a narrow card keeps the partial-check qualification', () => {
    setup({ width: 400, check: { servers: [
      { serverType: 'plex', name: 'Plex', reachable: true, error: null },
      { serverType: 'jellyfin', name: 'Jellyfin', reachable: false, error: 'x' },
    ], folders: [] } });
    expect(screen.getByText(/Jellyfin couldn't be reached\./)).toBeInTheDocument();
  });
});
