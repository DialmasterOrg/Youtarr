import { folderServerPath, joinServerPath, serverLibraryType, setupRows } from '../libraryTypes';

describe('libraryTypes', () => {
  test('joins a folder onto the server path in its own spelling', () => {
    expect(joinServerPath('/data/yt', 'Kids')).toBe('/data/yt/__Kids');
    expect(joinServerPath('Q:\\Youtube_test\\', 'Kids')).toBe('Q:\\Youtube_test\\__Kids');
    expect(joinServerPath('\\\\nas\\media\\yt', '')).toBe('\\\\nas\\media\\yt');
  });

  test('keeps the UNC separator for a subfolder', () => {
    expect(folderServerPath('Kids', '\\\\nas\\media\\yt', 'Plex')).toEqual({ text: '\\\\nas\\media\\yt\\__Kids', copyable: true });
  });

  test('describes the path when the server path is unknown', () => {
    expect(folderServerPath('Kids', null, 'Plex')).toEqual({ text: '__Kids in your downloads folder, as Plex sees it', copyable: false });
    expect(folderServerPath('', undefined, 'Emby')).toEqual({ text: 'Your downloads folder, as Emby sees it', copyable: false });
  });

  test('names library types per server and layout', () => {
    expect(serverLibraryType('plex', 'videos')).toBe('Plex Other Videos');
    expect(serverLibraryType('emby', 'tv')).toBe('Emby TV shows');
  });

  test('setup rows for a Jellyfin TV folder', () => {
    const rows = setupRows('jellyfin', 'tv', { text: '/yt/__TV', copyable: true });
    expect(rows.map((row) => [row.key, row.value])).toEqual([
      ['Content type', 'Shows'],
      ['Folder (as Jellyfin sees it)', '/yt/__TV'],
      ['Metadata savers', 'Nfo: off'],
      ['Downloaders', 'All off'],
      ['Image fetchers', 'All off'],
    ]);
  });
});
