import { afterwardsLine, checkStatusText, footerNote, inspectorIntro, statusDescription } from '../mediaServerText';
import type { LibraryFolder } from '../../../types/tvShows';
import type { LibraryCheckResponse } from '../../../types/libraryCheck';

const f = (name: string, extra: Partial<LibraryFolder> = {}): LibraryFolder => ({
  name, layout: 'videos', isDefault: false, hasFiles: false, channels: 0, ...extra,
});
const plex = { serverType: 'plex' as const, name: 'Plex' };
const jellyfin = { serverType: 'jellyfin' as const, name: 'Jellyfin' };
const wholeFolder: LibraryCheckResponse = {
  servers: [{ serverType: 'plex', name: 'Plex', reachable: true, error: null, downloadsPath: '/yt' }],
  folders: [
    { name: '', layout: 'videos', hasFiles: false, channels: 0, servers: [{ serverType: 'plex', status: 'ok', issues: [],
      libraries: [{ id: '37', name: 'YouTube', type: 'videos', location: '/yt', relation: 'exact' }] }] },
    { name: 'Kids', layout: 'videos', hasFiles: true, channels: 2, servers: [{ serverType: 'plex', status: 'ok', issues: [],
      libraries: [{ id: '37', name: 'YouTube', type: 'videos', location: '/yt', relation: 'covers' }] }] },
  ],
};

describe('mediaServerText', () => {
  test('a Videos subfolder held by a whole-folder library says so', () => {
    expect(inspectorIntro({ folder: f('Kids', { channels: 2 }), folders: [f(''), f('Kids', { channels: 2 })], check: wholeFolder, servers: [plex] }))
      .toEqual({ text: 'Shown by YouTube, which is pointed at the whole downloads folder.' });
  });

  test('the main folder of a whole-folder setup without TV folders', () => {
    expect(inspectorIntro({ folder: f(''), folders: [f(''), f('Kids', { channels: 2 })], check: wholeFolder, servers: [plex] }))
      .toEqual({ text: 'YouTube shows your whole downloads folder, including every subfolder. That works while every folder uses Videos.' });
  });

  test('a fresh install where everything downloads into the main folder', () => {
    expect(inspectorIntro({ folder: f('', { isDefault: true }), folders: [f('', { isDefault: true })], check: null, servers: [plex, jellyfin] }))
      .toEqual({ text: 'Everything downloads here. A Plex Other Videos and a Jellyfin Movies library on the downloads folder shows it.' });
  });

  test('a TV subfolder needs its own library', () => {
    expect(inspectorIntro({ folder: f('TV', { layout: 'tv', channels: 1 }), folders: [f(''), f('TV', { layout: 'tv', channels: 1 })], check: null, servers: [plex, jellyfin] }))
      .toEqual({ text: "TV show folders need their own Plex TV Shows and Jellyfin Shows library, pointed at __TV itself. A library on a parent folder doesn't count on Jellyfin and Emby." });
  });

  test('footer note names the servers not connected and Kodi', () => {
    expect(footerNote(f('TV', { layout: 'tv' }), [plex])).toBe(
      "Jellyfin and Emby aren't connected. Kodi isn't checked: add __TV as a TV shows source set to Local information only."
    );
    expect(footerNote(f(''), [plex, jellyfin, { serverType: 'emby', name: 'Emby' }])).toBe("Kodi isn't checked.");
  });

  test('status description for screen readers', () => {
    expect(statusDescription({ ...plex, display: 'ok', word: 'YouTube', report: wholeFolder.folders[1].servers[0] }))
      .toBe('Plex: OK, shown by YouTube through the whole downloads folder.');
  });

  test('afterwards lines per check result', () => {
    expect(afterwardsLine(plex, { serverType: 'plex', status: 'missing', libraries: [], issues: [] }, { target: 'tv', label: '__Kids' }))
      .toBe('Plex: needs a TV Shows library on __Kids.');
    expect(afterwardsLine(plex, null, { target: 'tv', label: '__Kids' }))
      .toBe("Plex: couldn't be checked. It needs a TV Shows library on __Kids.");
  });

  test('holding videos in the main folder with no counted files does not say 0 videos', () => {
    expect(inspectorIntro({ folder: f('', { hasFiles: true, fileCount: 0 }), folders: [f('', { hasFiles: true, fileCount: 0 })], check: null, servers: [plex] })?.text)
      .toMatch(/^No library shows the files still in the main folder\. To watch them,/);
  });

  test('status description while checking has three dots', () => {
    expect(statusDescription({ ...plex, display: 'checking', word: 'Checking...', report: null })).toBe('Plex: Checking...');
  });
});

describe('checkStatusText', () => {
  const base = { running: false, checked: [] as string[], unreachable: [] as Array<{ name: string; error: string | null }>, lastCheckedAt: 0, hasEarlierResults: true, error: null };
  const servers = [{ serverType: 'plex' as const, name: 'Plex' }, { serverType: 'jellyfin' as const, name: 'Jellyfin' }];

  test('full, partial and failed checks', () => {
    expect(checkStatusText({ ...base, kind: 'full', checked: ['Plex', 'Jellyfin'] }, servers, 30_000, null)).toBe('Checked Plex and Jellyfin just now');
    expect(checkStatusText({ ...base, kind: 'partial', checked: ['Plex'], unreachable: [{ name: 'Jellyfin', error: 'x' }] }, servers, 30_000, null))
      .toBe("Checked Plex just now. Jellyfin couldn't be reached.");
    expect(checkStatusText({ ...base, kind: 'failed' }, servers, 5 * 60_000, null)).toBe('Last checked 5 min ago. The latest check failed.');
    expect(checkStatusText({ ...base, kind: 'failed', hasEarlierResults: false, lastCheckedAt: null }, servers, 0, null)).toBe('Not checked');
  });

  test('running and no servers', () => {
    expect(checkStatusText({ ...base, kind: 'full', running: true }, servers, 0, null)).toBe('Checking Plex and Jellyfin...');
    expect(checkStatusText({ ...base, kind: 'none' }, [], 0, null)).toBe('No media server connected.');
    expect(checkStatusText({ ...base, kind: 'checking', running: true }, [], 0, null)).toBe('No media server connected.');
  });
});
