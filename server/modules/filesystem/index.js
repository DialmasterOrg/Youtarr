/**
 * Filesystem module - centralized file and path operations
 *
 * This module consolidates all file/folder path handling into one place:
 * - constants: Shared constants (prefixes, patterns, extensions)
 * - pathBuilder: Pure path construction functions
 * - fileOperations: Resilient file I/O with retries
 * - directoryManager: Directory lifecycle management
 *
 * Usage:
 *   const filesystem = require('./filesystem');
 *   // or import specific modules:
 *   const { pathBuilder, fileOperations } = require('./filesystem');
 */

const constants = require('./constants');
const pathBuilder = require('./pathBuilder');
const fileOperations = require('./fileOperations');
const directoryManager = require('./directoryManager');
const sanitizer = require('./sanitizer');

module.exports = {
  // Re-export all constants
  ...constants,

  // Re-export all pathBuilder functions
  ...pathBuilder,

  // Re-export all fileOperations functions
  ...fileOperations,

  // Re-export all directoryManager functions
  ...directoryManager,

  // Re-export all sanitizer functions
  ...sanitizer,

  // Also export as namespaced modules for explicit imports
  constants,
  pathBuilder,
  fileOperations,
  directoryManager,
  sanitizer
};
