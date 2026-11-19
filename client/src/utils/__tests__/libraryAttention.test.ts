import {
  buildAttention, checkStatus, folderState, isOverlapIssue, joinNames, plexMappingChoice, serverStatuses, timeAgo,
} from '../libraryAttention';
import type { LibraryFolder } from '../../types/tvShows';
import type { LibraryCheckResponse, LibraryCheckServerReport } from '../../types/libraryCheck';

const folder = (name: string, extra: Partial<LibraryFolder> = {}): LibraryFolder => ({
  name, layout: 'videos', isDefault: false, hasFiles: false, channels: 0, ...extra,
});
const report = (serverType: 'plex' | 'jellyfin', extra: Partial<LibraryCheckServerReport> = {}): LibraryCheckServerReport => ({
  serverType, status: 'ok', libraries: [{ id: '1', name: 'YouTube', type: 'videos', location: '/yt', relation: 'exact' }], issues: [], ...extra,
});
const nfo = { code: 'nfoSaver', message: 'YouTube saves NFO files...', libraryId: '1' };
const servers = [
  { serverType: 'plex' as const, name: 'Plex', reachable: true, error: null },
  { serverType: 'jellyfin' as const, name: 'Jellyfin', reachable: true, error: null },
];
const state = (data: LibraryCheckResponse | null, extra = {}) => ({ data, loading: false, error: null, lastCheckedAt: 0, ...extra });

describe('libraryAttention', () => {
  test('folder states', () => {
    expect(folderState(folder('Kids', { channels: 2 }))).toBe('active');
    expect(folderState(folder('Old', { fileCount: 4 }))).toBe('holdsVideos');
    expect(folderState(folder('Raw', { hasFiles: true, fileCount: 0 }))).toBe('holdsVideos');
    expect(folderState(folder('Empty'))).toBe('unused');
    expect(folderState(folder(''))).toBe('emptyMain');
    expect(folderState(folder('', { isDefault: true }))).toBe('active');
  });

  test('a missing library is red only for folders that need one', () => {
    const data = { servers, folders: [
      { name: 'Kids', layout: 'videos' as const, hasFiles: true, channels: 1, servers: [report('plex', { status: 'missing', libraries: [] })] },
      { name: 'Empty', layout: 'videos' as const, hasFiles: false, channels: 0, servers: [report('plex', { status: 'missing', libraries: [] })] },
    ] };
    expect(serverStatuses(folder('Kids', { channels: 1 }), state(data), [])[0]).toMatchObject({ display: 'noLibrary', word: 'No library' });
    expect(serverStatuses(folder('Empty'), state(data), [])[0]).toMatchObject({ display: 'fine', word: 'No library' });
  });

  test('shows the configured servers as checking before the first answer', () => {
    expect(serverStatuses(folder('Kids'), state(null, { loading: true }), ['plex'])).toEqual([
      expect.objectContaining({ serverType: 'plex', display: 'checking', word: 'Checking...' }),
    ]);
  });

  test('counts a library-wide issue once across folders and keeps folder items separate', () => {
    const data: LibraryCheckResponse = { servers, folders: [
      { name: 'A', layout: 'videos', hasFiles: true, channels: 1, servers: [report('jellyfin', { status: 'warning', issues: [nfo] })] },
      { name: 'B', layout: 'videos', hasFiles: true, channels: 1, servers: [report('jellyfin', { status: 'warning', issues: [nfo] })] },
      { name: 'C', layout: 'videos', hasFiles: true, channels: 1, servers: [report('plex', { status: 'missing', libraries: [] })] },
    ] };
    const folders = ['A', 'B', 'C'].map((name) => folder(name, { channels: 1 }));

    const items = buildAttention(folders, state(data), []);

    expect(items.map((item) => item.text)).toEqual([
      'Jellyfin library YouTube saves NFO files (affects 2 folders)',
      '__C (Plex)',
    ]);
  });

  test('never counts an unreachable server', () => {
    const data = {
      servers: [{ serverType: 'plex' as const, name: 'Plex', reachable: false, error: 'ECONNREFUSED' }, servers[1]],
      folders: [{ name: 'A', layout: 'videos' as const, hasFiles: true, channels: 1, servers: [
        { serverType: 'plex' as const, status: 'unreachable' as const, libraries: [], issues: [{ code: 'unreachable', message: 'x' }] },
        report('jellyfin', { status: 'warning', issues: [{ code: 'wrongType', message: 'Wrong type', libraryId: '1' }] }),
      ] }],
    };

    const items = buildAttention([folder('A', { channels: 1 })], state(data), []);
    expect(items.map((item) => item.text)).toEqual(['__A (Jellyfin)']);
    expect(checkStatus(state(data), [])).toMatchObject({ kind: 'partial', checked: ['Jellyfin'], unreachable: [{ name: 'Plex', error: 'ECONNREFUSED' }] });
  });

  test('check status kinds', () => {
    expect(checkStatus(state({ servers: [], folders: [] }), []).kind).toBe('none');
    expect(checkStatus(state({ servers, folders: [] }), []).kind).toBe('full');
    expect(checkStatus(state(null, { error: 'boom', lastCheckedAt: null }), ['plex']).kind).toBe('failed');
    expect(checkStatus(state(null, { loading: true, lastCheckedAt: null }), ['plex']).kind).toBe('checking');
  });

  test('joins names and phrases times', () => {
    expect(joinNames(['Plex'])).toBe('Plex');
    expect(joinNames(['Plex', 'Jellyfin', 'Emby'])).toBe('Plex, Jellyfin and Emby');
    expect(joinNames(['Plex', 'Emby'], 'or')).toBe('Plex or Emby');
    expect(timeAgo(1_000, 30_000, null)).toBe('just now');
    expect(timeAgo(0, 5 * 60_000, null)).toBe('5 min ago');
    expect(timeAgo(0, 3 * 3_600_000, null)).toBe('3 h ago');
  });

  test('isOverlapIssue is true for nestedLibrary and overlap only', () => {
    expect(isOverlapIssue('nestedLibrary')).toBe(true);
    expect(isOverlapIssue('overlap')).toBe(true);
    expect(isOverlapIssue('overlapTv')).toBe(false);
    expect(isOverlapIssue('noLibrary')).toBe(false);
  });

  test('plexMappingChoice: an explicit choice wins', () => {
    expect(plexMappingChoice({ mappedLibraryId: '4', suggestedLibraryId: null, choice: 'default' })).toBe('default');
  });

  test('plexMappingChoice: no choice with a mapped library is library', () => {
    expect(plexMappingChoice({ mappedLibraryId: '4', suggestedLibraryId: null })).toBe('library');
  });

  test('plexMappingChoice: neither is none', () => {
    expect(plexMappingChoice({ mappedLibraryId: null, suggestedLibraryId: '4' })).toBe('none');
    expect(plexMappingChoice(undefined)).toBe('none');
  });
});
