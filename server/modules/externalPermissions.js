const BASE_SCOPES = ['catalog:read', 'requests:read'];

const DEFINITIONS = {
  allowVideoRequests: {
    snake: 'allow_video_requests',
    roles: ['request', 'delete', 'admin'],
    scope: 'video:request',
  },
  allowChannelRequests: {
    snake: 'allow_channel_requests',
    roles: ['request', 'delete', 'admin'],
    scope: 'channel:request',
  },
  allowDeleteVideoRequests: {
    snake: 'allow_delete_video_requests',
    roles: ['delete', 'admin'],
    scope: 'video:delete',
  },
};

function normalizeExternalPermissions(source = {}) {
  const hasExplicitPermissions = Object.entries(DEFINITIONS).some(
    ([name, definition]) =>
      source[name] !== undefined || source[definition.snake] !== undefined,
  );
  const permissions = {};
  for (const [name, definition] of Object.entries(DEFINITIONS)) {
    const value = source[name] ?? source[definition.snake];
    if (value !== undefined && value !== null && typeof value !== 'boolean') {
      return null;
    }
    permissions[name] = value ??
      (hasExplicitPermissions ? false : definition.roles.includes(source.role));
  }
  return permissions;
}

function scopesForExternalKey(source) {
  const permissions = normalizeExternalPermissions(source);
  if (!permissions) return null;
  return [
    ...BASE_SCOPES,
    ...Object.entries(DEFINITIONS)
      .filter(([name]) => permissions[name])
      .map(([, definition]) => definition.scope),
  ];
}

function hasExternalScope(source, scope) {
  return scopesForExternalKey(source)?.includes(scope) === true;
}

function roleForExternalPermissions(permissions, preferredRole) {
  if (preferredRole === 'admin') return 'admin';
  if (permissions.allowDeleteVideoRequests) return 'delete';
  if (permissions.allowVideoRequests || permissions.allowChannelRequests) return 'request';
  return 'view';
}

module.exports = {
  BASE_SCOPES,
  DEFINITIONS,
  normalizeExternalPermissions,
  scopesForExternalKey,
  hasExternalScope,
  roleForExternalPermissions,
};
