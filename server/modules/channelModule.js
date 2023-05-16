const configModule = require('./configModule');
const cron = require('node-cron');
const fs = require("fs");
const path = require("path");

class ChannelModule {
  constructor() {
    this.channelAutoDownload = this.channelAutoDownload.bind(this);
    this.scheduleTask();
  }

  channelAutoDownload() {
    console.log('The current time is ' + new Date());
    console.log('Running new Channel Downloads at interval: ' + configModule.getConfig().channelDownloadFrequency);
  }

  scheduleTask() {
    // Stop the old task if exists
    if (this.task) {
      this.task.stop();
    }

    // Schedule the new task if enabled
    if (configModule.getConfig().channelAutoDownload) {
      this.task = cron.schedule(configModule.getConfig().channelDownloadFrequency, this.channelAutoDownload);
      console.log("Auto-downloads enabled, task scheduled!");
    } else {
      console.log("Auto-downloads disabled");
    }
  }

  readChannels() {
    let channels = [];
    try {
      const data = fs.readFileSync(path.join(__dirname, '../../config/channels.list'), 'utf-8');
      channels = data.split('\n').filter(line => line.trim() !== ''); // filter out any empty lines
    } catch (err) {
      console.error('Error reading channels.list:', err);
    }
    return channels;
  }

  writeChannels(channels) {
    try {
      const data = channels.join('\n');
      fs.writeFileSync(path.join(__dirname, '../../config/channels.list'), data);
    } catch (err) {
      console.error('Error writing to channels.list:', err);
    }
  }


  subscribe() {
    configModule.onConfigChange(this.scheduleTask.bind(this));
  }
}

module.exports = new ChannelModule();
