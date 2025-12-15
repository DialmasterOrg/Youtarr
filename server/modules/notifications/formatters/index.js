/**
 * Notification formatters index
 */

const discordFormatter = require('./discordFormatter');
const discordMarkdownFormatter = require('./discordMarkdownFormatter');
const slackFormatter = require('./slackFormatter');
const slackMarkdownFormatter = require('./slackMarkdownFormatter');
const telegramFormatter = require('./telegramFormatter');
const emailFormatter = require('./emailFormatter');
const plainFormatter = require('./plainFormatter');

module.exports = {
  discordFormatter,
  discordMarkdownFormatter,
  slackFormatter,
  slackMarkdownFormatter,
  telegramFormatter,
  emailFormatter,
  plainFormatter
};

