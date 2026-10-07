import { detectSetup, pathOptions, pathSteps, setupLines } from '../tvSetupPaths';
import type { LibraryFolder } from '../../../types/tvShows';
import type { LibraryCheckResponse } from '../../../types/libraryCheck';

const f = (name: string, extra: Partial<LibraryFolder> = {}): LibraryFolder => ({
  name, layout: 'videos', isDefault: false, hasFiles: false, channels: 0, ...extra,
});
const servers = [{ serverType: 'jellyfin' as const, name: 'Jellyfin' }];
const check = (mainExact: boolean, kidsExact: boolean): LibraryCheckResponse => ({
  servers: [{ serverType: 'jellyfin', name: 'Jellyfin', reachable: true, error: null, downloadsPath: '/yt' }],
  folders: [
    { name: '', layout: 'videos', hasFiles: true, channels: 3, servers: [{ serverType: 'jellyfin', status: mainExact ? 'ok' : 'missing', issues: [],
      libraries: mainExact ? [{ id: '1', name: 'YouTube', type: 'videos', location: '/yt', relation: 'exact' }] : [] }] },
    { name: 'Kids', layout: 'videos', hasFiles: true, channels: 2, servers: [{ serverType: 'jellyfin', status: 'ok', issues: [],
      libraries: [kidsExact
        ? { id: '2', name: 'Kids', type: 'videos', location: '/yt/__Kids', relation: 'exact' }
        : { id: '1', name: 'YouTube', type: 'videos', location: '/yt', relation: 'covers' }] }] },
  ],
});
const folders = [f('', { channels: 3, channelsChosen: 3, fileCount: 10 }), f('Kids', { channels: 2, fileCount: 5 })];

describe('tvSetupPaths', () => {
  test('detects a whole-folder library with channels in the main folder', () => {
    const setup = detectSetup(folders, check(true, false), servers);
    expect(setup.servers[0]).toMatchObject({ kind: 'whole', whole: { name: 'YouTube', location: '/yt' } });
    expect(setupLines(setup)).toEqual([
      '1 Video folder in use: __Kids.',
      '3 channels download straight into the main folder.',
      'Jellyfin: YouTube (Movies) shows your whole downloads folder.',
    ]);
  });

  test('path A recommended; B unavailable while Video folders are in use on Jellyfin', () => {
    const options = pathOptions(detectSetup(folders, check(true, false), servers), servers);
    expect(options.map((option) => [option.key, option.recommended, option.disabledReason])).toEqual([
      ['A', true, null],
      ['B', false, 'You use Video folders (__Kids): Jellyfin and Emby would show each one as an extra show.'],
      ['C', false, null],
    ]);
  });

  test('path A steps edit the whole-folder library with exact paths', () => {
    const steps = pathSteps('A', detectSetup(folders, check(true, false), servers), {});
    expect(steps.youtarr.map((step) => step.text)).toEqual([
      'Give the 3 channels in the main folder a Video folder (Channel Settings > Library folder moves their videos).',
      'Add a TV show folder.',
      'Switch the channels you want as shows to it: Channel Settings > Library folder, or TV Show > Show this channel as TV show. Each switch shows its moves first.',
    ]);
    expect(steps.servers[0].steps[0]).toMatchObject({
      text: 'Edit YouTube: remove /yt and add your Video folders:',
      paths: [{ text: '/yt/__Kids', copyable: true }],
      after: 'It keeps its type.',
    });
  });

  test('path C with a library on the folder itself says to rebuild it', () => {
    const steps = pathSteps('C', detectSetup(folders, check(false, true), servers), { folder: 'Kids' });
    expect(steps.youtarr[0]).toMatchObject({ text: 'Open __Kids and choose Move to TV shows. You review every move first.', action: { kind: 'openFolder', folder: 'Kids' } });
    expect(steps.servers[0].steps[0].text).toBe("Jellyfin can't change a library's type: remove Kids and create a Shows library pointed at /yt/__Kids.");
  });

  test('path C whole-folder lists the other Video folders', () => {
    const withTwo = [...folders, f('Music', { channels: 1 })];
    const steps = pathSteps('C', detectSetup(withTwo, check(true, false), servers), { folder: 'Kids' });
    expect(steps.servers[0].steps[0]).toMatchObject({
      text: 'Edit YouTube: remove /yt and add your other Video folders:',
      paths: [{ text: '/yt/__Music', copyable: true }],
    });
  });

  test('path C whole-folder with no other Video folder lists no paths', () => {
    const step = pathSteps('C', detectSetup(folders, check(true, false), servers), { folder: 'kids' }).servers[0].steps[0];
    expect(step.text).toBe('Remove YouTube: no other Video folder is in use.');
    expect(step.paths).toBeUndefined();
    expect(step.after).toBe('Then add a Shows library pointed at /yt/__kids only.');
  });

  test('without servers the steps cover each server type', () => {
    const steps = pathSteps('A', detectSetup(folders, null, []), {});
    expect(steps.servers.map((group) => group.name)).toEqual(['Plex', 'Jellyfin', 'Emby']);
  });
});
