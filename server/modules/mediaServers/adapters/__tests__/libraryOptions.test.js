const { libraryTypeOf, nfoSaverOf, onlineFetchersOf, needsServerDefaults } = require('../libraryOptions');

describe('libraryOptions', () => {
  describe('libraryTypeOf', () => {
    test.each([
      ['tvshows', 'tv'],
      ['movies', 'videos'],
      ['homevideos', 'videos'],
      ['mixed', 'mixed'],
      [undefined, 'mixed'],
      ['music', 'music'],
      ['playlists', 'other'],
    ])('reads %s as %s', (collectionType, type) => {
      expect(libraryTypeOf(collectionType)).toBe(type);
    });
  });

  describe('nfoSaverOf', () => {
    test('is on when the library lists the NFO saver', () => {
      expect(nfoSaverOf({ MetadataSavers: ['Nfo'] }, 'tv', null)).toBe(true);
    });

    test('is off for an empty saver list', () => {
      expect(nfoSaverOf({ MetadataSavers: [] }, 'tv', null)).toBe(false);
    });

    test('is off for unset savers when the library does not save metadata locally', () => {
      expect(nfoSaverOf({ MetadataSavers: null, SaveLocalMetadata: false }, 'tv', null)).toBe(false);
    });

    test('follows the server default for unset savers', () => {
      const disabled = [
        { ItemType: 'Series', DisabledMetadataSavers: ['Nfo'] },
        { ItemType: 'Episode', DisabledMetadataSavers: ['Nfo'] },
      ];
      expect(nfoSaverOf({ MetadataSavers: null, SaveLocalMetadata: true }, 'tv', disabled)).toBe(false);
      expect(nfoSaverOf({ MetadataSavers: null, SaveLocalMetadata: true }, 'tv', [])).toBe(true);
    });

    test('is unknown for unset savers when the server default could not be read', () => {
      expect(nfoSaverOf({ MetadataSavers: null, SaveLocalMetadata: true }, 'tv', null)).toBeNull();
    });
  });

  describe('onlineFetchersOf', () => {
    test('is on when a show or episode fetcher is enabled', () => {
      const options = { TypeOptions: [{ Type: 'Series', MetadataFetchers: [] }, { Type: 'Episode', MetadataFetchers: ['TheMovieDb'] }] };
      expect(onlineFetchersOf(options, 'tv')).toBe(true);
    });

    test('ignores fetchers of other item types', () => {
      const options = { TypeOptions: [{ Type: 'Movie', MetadataFetchers: ['TheMovieDb'] }, { Type: 'Series', MetadataFetchers: [] }] };
      expect(onlineFetchersOf(options, 'tv')).toBe(false);
    });

    test('is unknown when the library has no settings for these item types', () => {
      expect(onlineFetchersOf({ TypeOptions: [] }, 'tv')).toBeNull();
    });
  });

  test('needs the server defaults only for a library with unset savers that saves locally', () => {
    expect(needsServerDefaults([{ LibraryOptions: { MetadataSavers: [] } }])).toBe(false);
    expect(needsServerDefaults([{ LibraryOptions: { MetadataSavers: null, SaveLocalMetadata: false } }])).toBe(false);
    expect(needsServerDefaults([{ LibraryOptions: { MetadataSavers: null, SaveLocalMetadata: true } }])).toBe(true);
  });
});
