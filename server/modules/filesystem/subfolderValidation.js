/**
 * Pure validation for user-supplied subfolder names.
 * Shared by channelSettingsModule and subfolderModule.
 */
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL, SUBFOLDER_PREFIX } = require('./constants');

const RESERVED_SUB_FOLDERS = ['playlists'];
const VALID_NAME_PATTERN = /^[a-zA-Z0-9\s\-_]+$/;
const MAX_SUBFOLDER_LENGTH = 100;

/**
 * @param {string|null} subFolder
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSubFolderName(subFolder) {
  if (!subFolder || subFolder.trim() === '') {
    return { valid: true };
  }
  if (subFolder === GLOBAL_DEFAULT_SENTINEL || subFolder === ROOT_SENTINEL) {
    return { valid: true };
  }

  const trimmed = subFolder.trim();

  if (RESERVED_SUB_FOLDERS.includes(trimmed.toLowerCase())) {
    return { valid: false, error: `Subfolder name "${trimmed}" is reserved by Youtarr and cannot be used` };
  }
  if (trimmed.length > MAX_SUBFOLDER_LENGTH) {
    return { valid: false, error: 'Subfolder name must be 100 characters or less' };
  }
  if (!VALID_NAME_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Subfolder name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    return { valid: false, error: 'Invalid subfolder name' };
  }
  if (trimmed.startsWith(SUBFOLDER_PREFIX)) {
    return { valid: false, error: `Subfolder names cannot start with ${SUBFOLDER_PREFIX} (reserved prefix)` };
  }

  return { valid: true };
}

module.exports = { validateSubFolderName };
