/**
 * Notification formatters index
 */

const discordFormatter = require('./discordFormatter');
const slackMarkdownFormatter = require('./slackMarkdownFormatter');
const telegramFormatter = require('./telegramFormatter');
const emailFormatter = require('./emailFormatter');
const plainFormatter = require('./plainFormatter');

module.exports = {
  discordFormatter,
  slackMarkdownFormatter,
  telegramFormatter,
  emailFormatter,
  plainFormatter
};

