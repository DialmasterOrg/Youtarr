/**
 * @deprecated This file is kept for backward compatibility.
 * The notification module has been refactored into server/modules/notifications/
 * 
 * All functionality is now in:
 * - server/modules/notifications/index.js (main orchestrator)
 * - server/modules/notifications/formatters/ (message formatters)
 * - server/modules/notifications/senders/ (HTTP/CLI senders)
 */

module.exports = require('./notifications');
