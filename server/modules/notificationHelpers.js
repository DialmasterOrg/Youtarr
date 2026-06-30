/**
 * Notification Helpers
 *
 * Re-exports from serviceRegistry for backward compatibility.
 * New code should import directly from notifications/serviceRegistry.
 */

const {
  getDefaultNameForUrl
} = require('./notifications/serviceRegistry');

module.exports = {
  getDefaultNameForUrl
};
