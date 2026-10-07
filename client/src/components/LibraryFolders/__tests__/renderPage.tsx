import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '../../ui/tooltip';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import type { LibraryFolder } from '../../../types/tvShows';
import type { LibraryCheckResponse } from '../../../types/libraryCheck';
import { LibraryPageProvider, LibraryPageValue } from '../LibraryFoldersContext';

export const folder = (name: string, extra: Partial<LibraryFolder> = {}): LibraryFolder => ({
  name, layout: 'videos', isDefault: false, hasFiles: false, channels: 0,
  channelsChosen: 0, channelsFollowing: 0, playlists: 0, titleShows: 0, fileCount: 0,
  layoutChangeNeedsReview: false, makeDefaultNeedsReview: false,
  plexMapping: { choice: 'none', libraryId: null }, deleteBlockers: [], deletable: true, ...extra,
});

export const emptyCheck: LibraryCheckResponse = { servers: [], folders: [] };

export function makePageValue(overrides: Partial<LibraryPageValue> = {}): LibraryPageValue {
  return {
    token: 'token',
    config: { ...DEFAULT_CONFIG, youtubeOutputDirectory: '/usr/src/app/data' },
    isPlatformManaged: { plexUrl: false, authEnabled: true, useTmpForDownloads: false, ytdlpUpdates: false },
    timeZone: 'UTC',
    phone: false,
    twoColumn: true,
    folders: [folder('', { isDefault: true })],
    foldersLoaded: true,
    mainDetail: null,
    check: { data: emptyCheck, loading: false, error: null, lastCheckedAt: Date.now(), refetch: jest.fn().mockResolvedValue(undefined), applyPlexMapping: jest.fn().mockResolvedValue(undefined) },
    configuredServers: [],
    serversKnown: true,
    servers: [],
    plexLibraries: [],
    plexConnectionStatus: 'not_tested',
    reorganizing: false,
    movingFolders: [],
    layoutResult: null,
    busyLayoutFolder: null,
    changeLayout: jest.fn().mockResolvedValue(undefined),
    selectFolder: jest.fn(),
    openAddFolder: jest.fn(),
    openStartTv: jest.fn(),
    openMainFolderTv: jest.fn(),
    openMakeDefault: jest.fn(),
    openDelete: jest.fn(),
    reviewChange: jest.fn(),
    jumpTo: jest.fn(),
    focusTarget: null,
    clearFocusTarget: jest.fn(),
    notify: jest.fn(),
    ...overrides,
  };
}

/** The tree renderInPage renders, for rerender with a new page value. */
export function inPage(ui: React.ReactElement, value: LibraryPageValue = makePageValue(), route = '/settings/library') {
  return (
    <MemoryRouter initialEntries={[route]}>
      <TooltipProvider>
        <LibraryPageProvider value={value}>
          <Routes>
            <Route path="/settings/library/*" element={ui} />
            <Route path="*" element={<div>other page</div>} />
          </Routes>
        </LibraryPageProvider>
      </TooltipProvider>
    </MemoryRouter>
  );
}

export function renderInPage(ui: React.ReactElement, { value = makePageValue(), route = '/settings/library' }: {
  value?: LibraryPageValue; route?: string;
} = {}) {
  return render(inPage(ui, value, route));
}
