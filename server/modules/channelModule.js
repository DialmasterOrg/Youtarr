const configModule = require('./configModule');
const downloadModule = require('./downloadModule');
const cron = require('node-cron');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const Channel = require('../models/channel');
const ChannelVideo = require('../models/channelvideo');
//const Video = require('../models/video');
const MessageEmitter = require('./messageEmitter.js'); // import the helper function
const { google } = require('googleapis');
const { parse } = require('iso8601-duration');

const { v4: uuidv4 } = require('uuid');
const { spawn, execSync } = require('child_process');

class ChannelModule {
  constructor() {
    this.channelAutoDownload = this.channelAutoDownload.bind(this);
    this.scheduleTask();
    this.subscribe();
    this.populateMissingChannelInfo();
  }

  async populateMissingChannelInfo() {
    // Read channels from channels.list
    const channelPromises = await this.readChannels();

    // For each channel, check if it has an entry in the database
    for (let channelObj of channelPromises) {
      const foundChannel = await Channel.findOne({
        where: { url: channelObj.url },
      });

      // If the channel does not exist in the database or if the uploader is missing, fetch its data
      if (!foundChannel || !foundChannel.uploader) {
        await this.getChannelInfo(channelObj.url);
      }
    }
  }

  channelAutoDownload() {
    console.log('The current time is ' + new Date());
    console.log(
      'Running new Channel Downloads at interval: ' +
        configModule.getConfig().channelDownloadFrequency
    );
    downloadModule.doChannelDownloads();
  }

  async getChannelInfo(channelUrlOrId, emitMessage = true) {
    // Check if there is already an entry in the database for this channel

    // If channelUrlOrId starts with 'http', then it is a url, otherwise it is a channel id
    // Set the variables channelUrl and channelId accordingly
    let channelUrl = '';
    let channelId = '';
    let foundChannel = null;
    if (channelUrlOrId.startsWith('http')) {
      channelUrl = channelUrlOrId;
      foundChannel = await Channel.findOne({
        where: { url: channelUrl },
      });
    } else {
      channelId = channelUrlOrId;
      foundChannel = await Channel.findOne({
        where: { channel_id: channelId },
      });
    }

    // If the channel exists in the database, then return it
    if (foundChannel) {
      if (emitMessage) {
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'channel',
          'channelsUpdated',
          { text: 'Channel Updated' }
        );
      }
      return {
        id: foundChannel.channel_id,
        uploader: foundChannel.uploader,
        uploader_id: foundChannel.uploader_id,
        title: foundChannel.title,
        description: foundChannel.description,
        url: foundChannel.url,
      };
    }

    // Otherwise we need to get the data for it...
    const outputFilePath = path.join(__dirname, `channel-${uuidv4()}.json`); // Define the output file path

    // Open a writable stream
    const writeStream = fs.createWriteStream(outputFilePath);

    // Run yt-dlp command and write the output to a file for json
    const ytDlp = spawn('yt-dlp', [
      '--skip-download',
      '--dump-single-json',
      '--playlist-end',
      '1',
      '--playlist-items',
      '0',
      channelUrl,
    ]);

    const imagePath = path.resolve(
      __dirname,
      '../images/channelthumb-%(uploader_id)s.jpg'
    );

    // Doesn't matter when this finishes...
    const ytDlpGetThumb = spawn('yt-dlp', [
      '--skip-download',
      '--write-thumbnail',
      '--playlist-end',
      '1',
      '--playlist-items',
      '0',
      '--convert-thumbnails',
      'jpg',
      '-o',
      `${imagePath}`,
      channelUrl,
    ]);

    // Pipe the stdout to the writeStream
    ytDlp.stdout.pipe(writeStream);

    // Handle ytDlp exit
    await new Promise((resolve, reject) => {
      ytDlp.on('exit', resolve);
      ytDlp.on('error', reject);
    });

    // Handle ytDlpGetThumb exit
    await new Promise((resolve, reject) => {
      ytDlpGetThumb.on('exit', resolve);
      ytDlpGetThumb.on('error', reject);
    });

    // When all channel data is fetched, emit a message
    if (emitMessage) {
      console.log('Channel data fetched -- emitting message!');
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'channel',
        'channelsUpdated',
        { text: 'Channel Updated' }
      );
    }
    // Read the file content
    const fileContent = await fsPromises.readFile(outputFilePath, 'utf8');

    // Parse the returned JSON
    const jsonOutput = JSON.parse(fileContent);

    const realImagePath = path.resolve(
      __dirname,
      `../images/channelthumb-${jsonOutput.id}.jpg`
    );
    const smallImagePath = path.resolve(
      __dirname,
      `../images/channelthumb-${jsonOutput.id}-small.jpg`
    );

    // Resize the image using ffmpeg
    try {
      execSync(
        `${configModule.ffmpegPath} -y -i ${realImagePath} -vf "scale=iw*0.4:ih*0.4" ${smallImagePath}`,
        { stdio: 'inherit' }
      );
      // Delete the original image (realImagePath) and move the small image to the original image path
      await fsPromises.rename(smallImagePath, realImagePath);
      console.log('Image resized successfully');
    } catch (err) {
      console.log(`Error resizing image: ${err}`);
    }

    // Delete the file after parsing it
    await fsPromises.unlink(outputFilePath);

    // Check to see if there is already an entry in the database for this channel url
    // Using the Channel Sequelize model. If so, then update it, otherwise create a new entry
    // The Channel model is defined in server\models\channel.js and does not include timestamps
    const [channel, created] = await Channel.findOrCreate({
      where: { url: channelUrl },
      defaults: {
        channel_id: jsonOutput.id,
        title: jsonOutput.title,
        description: jsonOutput.description,
        uploader: jsonOutput.uploader,
        url: channelUrl,
      },
    });

    // If the channel already exists, then update it
    if (!created) {
      await channel.update({
        channel_id: jsonOutput.id,
        title: jsonOutput.title,
        description: jsonOutput.description,
        uploader: jsonOutput.uploader,
        url: channelUrl,
      });
    }

    // Return only the relevant properties
    return {
      id: jsonOutput.id,
      uploader: jsonOutput.uploader,
      uploader_id: jsonOutput.uploader_id,
      title: jsonOutput.title,
      description: jsonOutput.description,
      url: channelUrl,
    };
  }

  scheduleTask() {
    console.log(
      'Scheduling task to run at: ' +
        configModule.getConfig().channelDownloadFrequency
    );
    // Stop the old task if exists
    if (this.task) {
      console.log('Stopping old task');
      this.task.stop();
    }

    // Schedule the new task if enabled
    if (configModule.getConfig().channelAutoDownload) {
      this.task = cron.schedule(
        configModule.getConfig().channelDownloadFrequency,
        this.channelAutoDownload
      );
      console.log('Auto-downloads enabled, task scheduled!');
    } else {
      console.log('Auto-downloads disabled');
    }
  }

  readChannels() {
    let channels = [];
    try {
      const data = fs.readFileSync(
        path.join(__dirname, '../../config/channels.list'),
        'utf-8'
      );
      channels = data.split('\n').filter((line) => line.trim() !== ''); // filter out any empty lines
    } catch (err) {
      console.error('Error reading channels.list:', err);
    }
    // Foreach channel, get the channel uploader and return an array of objects with the channel url and uploader
    // Use the Channel Sequelize model to get the channel info from the database
    // The Channel model is defined in server\models\channel.js and does not include timestamps
    const channelPromises = channels.map((channel) => {
      return Channel.findOne({
        where: { url: channel },
      }).then((foundChannel) => {
        return {
          url: channel,
          uploader: foundChannel ? foundChannel.uploader : '',
          channel_id: foundChannel ? foundChannel.channel_id : '',
        };
      });
    });

    return Promise.all(channelPromises);
  }

  async writeChannels(channels) {
    try {
      const data = channels.join('\n');
      fs.writeFileSync(
        path.join(__dirname, '../../config/channels.list'),
        data
      );

      // For each channel, get the channel info and write it to the database
      for (let channel of channels) {
        await this.getChannelInfo(channel);
      }
    } catch (err) {
      console.error(
        'Error writing to channels.list or fetching channel info:',
        err
      );
    }
  }

  subscribe() {
    configModule.onConfigChange(this.scheduleTask.bind(this));
  }

  // Fetch YouTube video data using Google APIs
  async fetchYoutubeVideos(youtube, channelId) {
    return new Promise((resolve, reject) => {
      youtube.search.list(
        {
          part: 'snippet',
          channelId: channelId,
          maxResults: 50,
          order: 'date',
          type: 'video, creatorContentType',
        },
        (err, res) => {
          if (err) {
            console.error('The API returned an errors: ' + err);
            reject(err);
          } else {
            resolve(res.data.items);
          }
        }
      );
    });
  }

  // Fetch video details
  async fetchVideoDetails(youtube, videoIds) {
    return new Promise((resolve, reject) => {
      youtube.videos.list(
        {
          part: 'contentDetails',
          id: videoIds,
        },
        (err, res) => {
          if (err) {
            console.error('The API returned an errors: ' + err);
            reject(err);
          } else {
            resolve(res.data.items);
          }
        }
      );
    });
  }

  // Insert videos into DB
  async insertVideosIntoDb(videos, channelId) {
    for (const video of videos) {
      await ChannelVideo.findOrCreate({
        where: { youtube_id: video.youtube_id, channel_id: channelId },
        defaults: video,
      });
    }
  }

  // Fetch videos for this channel from the DB,
  // also add whether they have already been downloaded
  async fetchNewestVideosFromDb(channelId) {
    const videos = await ChannelVideo.findAll({
      where: {
        channel_id: channelId,
      },
      order: [['publishedAt', 'DESC']],
      limit: 50,
    });

    const completePath = path.join(__dirname, '../../config/complete.list');
    const completeList = fs.readFileSync(completePath, 'utf-8');
    const completeListArray = completeList
      .split(/\r?\n/) // split on \n and \r\n
      .filter((line) => line.trim() !== '');

    return videos.map((video) => {
      const plainVideoObject = video.toJSON();
      console.log(
        `Looking for video in complete list: youtube ${plainVideoObject.youtube_id}`
      );
      plainVideoObject.added = completeListArray.includes(
        `youtube ${plainVideoObject.youtube_id}`
      );
      return plainVideoObject;
    });
  }

  async getChannelVideos(channelId) {
    const youtube = google.youtube({
      version: 'v3',
      auth: configModule.getConfig().youtubeApiKey,
    });

    try {
      const videos = await this.fetchYoutubeVideos(youtube, channelId);
      const videoIds = videos.map((video) => video.id.videoId).join(',');

      const videoDetails = await this.fetchVideoDetails(youtube, videoIds);

      const videoPromises = videoDetails.map((videoDetail) => {
        const snippet = videos.find(
          (v) => v.id.videoId === videoDetail.id
        ).snippet;

        // Parse the ISO 8601 duration into an object
        const duration = parse(videoDetail.contentDetails.duration);

        const totalDurationSeconds =
          duration.seconds + duration.minutes * 60 + duration.hours * 3600;

        // Attempt to filter out "shorts" videos
        if (totalDurationSeconds < 70) {
          return null;
        }

        return {
          title: snippet.title,
          youtube_id: videoDetail.id,
          publishedAt: snippet.publishedAt,
          thumbnail: snippet.thumbnails.medium.url,
          duration: totalDurationSeconds, // Add the duration field
        };
      });
      let videosOutput = await Promise.all(videoPromises);
      videosOutput = videosOutput.filter((video) => video !== null);
      console.log('Found ' + videosOutput.length + ' videos');
      if (videosOutput.length > 0) {
        await this.insertVideosIntoDb(videosOutput, channelId);
      }
      const newestVideos = await this.fetchNewestVideosFromDb(channelId);

      return newestVideos;
    } catch (error) {
      // In case of error, return whatever the DB has
      const newestVideos = await this.fetchNewestVideosFromDb(channelId);
      return newestVideos;
    }
  }
}

module.exports = new ChannelModule();
