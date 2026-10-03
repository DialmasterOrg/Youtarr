import {
  effectiveLibraryFolder,
  buildLayoutResolver,
  libraryFolderLabel,
  VIDEOS_EVERYWHERE,
} from '../libraryLayouts';

describe('libraryLayouts utils', () => {
  describe('effectiveLibraryFolder', () => {
    test('follows the default subfolder for the global default sentinel', () => {
      expect(effectiveLibraryFolder('##USE_GLOBAL_DEFAULT##', 'Kids')).toBe('Kids');
    });

    test('maps the root sentinel to the main folder', () => {
      expect(effectiveLibraryFolder('##ROOT##', 'Kids')).toBe('');
    });

    test('maps an empty value to the main folder', () => {
      expect(effectiveLibraryFolder(null, 'Kids')).toBe('');
    });

    test('returns a named subfolder trimmed', () => {
      expect(effectiveLibraryFolder(' TV ', null)).toBe('TV');
    });
  });

  describe('buildLayoutResolver', () => {
    const layoutOf = buildLayoutResolver([
      { name: '', layout: 'videos', isDefault: true, hasFiles: false, channels: 0 },
      { name: 'TV Shows', layout: 'tv', isDefault: false, hasFiles: false, channels: 2 },
    ]);

    test('resolves folders ignoring case', () => {
      expect(layoutOf('tv shows')).toBe('tv');
    });

    test('treats unknown folders as videos', () => {
      expect(layoutOf('Other')).toBe('videos');
    });
  });

  test('labels the main folder and subfolders', () => {
    expect([libraryFolderLabel(''), libraryFolderLabel('TV')]).toEqual(['Main folder', '__TV']);
  });

  test('resolves everything to videos before folders load', () => {
    expect(VIDEOS_EVERYWHERE('TV')).toBe('videos');
  });
});
