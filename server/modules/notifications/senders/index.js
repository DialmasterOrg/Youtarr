/**
 * Notification senders index
 */

const discordSender = require('./discordSender');
const slackSender = require('./slackSender');
const appriseSender = require('./appriseSender');

module.exports = {
  discordSender,
  slackSender,
  appriseSender
};

