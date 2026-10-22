const {
  normalizeExternalPermissions,
  scopesForExternalKey,
  hasExternalScope,
  roleForExternalPermissions,
} = require('../externalPermissions');

describe('external API key permissions', () => {
  test('falls back to cumulative roles for pre-migration-shaped keys', () => {
    expect(normalizeExternalPermissions({ role: 'request' })).toEqual({
      allowVideoRequests: true,
      allowChannelRequests: true,
      allowDeleteVideoRequests: false,
    });
    expect(scopesForExternalKey({ role: 'delete' })).toEqual([
      'catalog:read',
      'requests:read',
      'video:request',
      'channel:request',
      'video:delete',
    ]);
  });

  test('uses explicit permissions independently of the summary role', () => {
    const key = {
      role: 'request',
      allowVideoRequests: true,
      allowChannelRequests: false,
      allowDeleteVideoRequests: false,
    };
    expect(scopesForExternalKey(key)).toEqual([
      'catalog:read',
      'requests:read',
      'video:request',
    ]);
    expect(hasExternalScope(key, 'channel:request')).toBe(false);
  });

  test('defaults omitted granular permissions off instead of expanding from the summary role', () => {
    expect(normalizeExternalPermissions({
      role: 'delete',
      allowVideoRequests: true,
    })).toEqual({
      allowVideoRequests: true,
      allowChannelRequests: false,
      allowDeleteVideoRequests: false,
    });
  });

  test('fails closed for invalid permission values', () => {
    expect(normalizeExternalPermissions({
      role: 'request',
      allowVideoRequests: 'yes',
    })).toBeNull();
    expect(scopesForExternalKey({
      role: 'request',
      allowVideoRequests: 'yes',
    })).toBeNull();
  });

  test('derives the backward-compatible summary role', () => {
    expect(roleForExternalPermissions({
      allowVideoRequests: false,
      allowChannelRequests: true,
      allowDeleteVideoRequests: false,
    })).toBe('request');
    expect(roleForExternalPermissions({
      allowVideoRequests: false,
      allowChannelRequests: false,
      allowDeleteVideoRequests: true,
    })).toBe('delete');
  });
});
