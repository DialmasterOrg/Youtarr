const { validateSubFolderName } = require('../subfolderValidation');

describe('validateSubFolderName', () => {
  test('accepts null and empty (root)', () => {
    expect(validateSubFolderName(null)).toEqual({ valid: true });
    expect(validateSubFolderName('   ')).toEqual({ valid: true });
  });

  test('accepts the global-default and root sentinels', () => {
    expect(validateSubFolderName('##USE_GLOBAL_DEFAULT##')).toEqual({ valid: true });
    expect(validateSubFolderName('##ROOT##')).toEqual({ valid: true });
  });

  test('rejects the reserved name "playlists" case-insensitively', () => {
    expect(validateSubFolderName('Playlists').valid).toBe(false);
  });

  test('rejects names over 100 chars', () => {
    expect(validateSubFolderName('a'.repeat(101)).valid).toBe(false);
  });

  test('rejects invalid characters and traversal', () => {
    expect(validateSubFolderName('bad/name').valid).toBe(false);
    expect(validateSubFolderName('..').valid).toBe(false);
    expect(validateSubFolderName('na*me').valid).toBe(false);
  });

  test('rejects the __ prefix', () => {
    expect(validateSubFolderName('__Sneaky').valid).toBe(false);
  });

  test('accepts a normal name', () => {
    expect(validateSubFolderName('Sports')).toEqual({ valid: true });
  });
});
