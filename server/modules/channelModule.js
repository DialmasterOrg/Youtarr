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
// YouTube API removed - using yt-dlp for all video fetching

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
      '-4',
      '--playlist-end',
      '1',
      '--playlist-items',
      '0',
      channelUrl,
    ]);

    const imagePath = path.resolve(
      __dirname,
      '../images/channelthumb-%(channel_id)s.jpg'
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

  // YouTube API methods removed - using yt-dlp instead

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
      plainVideoObject.added = completeListArray.includes(
        `youtube ${plainVideoObject.youtube_id}`
      );
      return plainVideoObject;
    });
  }

  // Fetch channel videos using yt-dlp (no API key required)
  async fetchChannelVideosViaYtDlp(channelId) {
    console.log('Fetching videos via yt-dlp for channel:', channelId);

    // Get channel URL from database
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    if (!channel || !channel.url) {
      throw new Error('Channel not found in database');
    }

    const outputFilePath = path.join(__dirname, `channel-videos-${uuidv4()}.json`);
    const writeStream = fs.createWriteStream(outputFilePath);

    // Use yt-dlp to get channel videos metadata without downloading
    // Using --flat-playlist for speed, but with approximate_date to get timestamps
    const ytDlp = spawn('yt-dlp', [
      '--flat-playlist',
      '--dump-single-json',
      '--extractor-args', 'youtubetab:approximate_date',  // Get approximate timestamps for videos
      '--playlist-end', '50', // Get latest 50 videos
      '-4',
      channel.url,
    ]);

    ytDlp.stdout.pipe(writeStream);

    // Handle ytDlp exit
    await new Promise((resolve, reject) => {
      ytDlp.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
      ytDlp.on('error', reject);
    });

    try {
      // Read and parse the JSON output
      const fileContent = await fsPromises.readFile(outputFilePath, 'utf8');
      const jsonOutput = JSON.parse(fileContent);

      // Process entries from the playlist
      const videos = [];
      if (jsonOutput.entries && Array.isArray(jsonOutput.entries)) {
        for (const entry of jsonOutput.entries) {
          // Skip shorts (videos under 70 seconds)
          if (entry.duration && entry.duration < 70) {
            continue;
          }

          // Parse the published date from various possible fields
          let publishedAt = null;
          
          // First try timestamp (from approximate_date extractor arg)
          if (entry.timestamp) {
            publishedAt = new Date(entry.timestamp * 1000).toISOString();
          } 
          // Fallback to upload_date if timestamp not available
          else if (entry.upload_date) {
            const year = entry.upload_date.substring(0, 4);
            const month = entry.upload_date.substring(4, 6);
            const day = entry.upload_date.substring(6, 8);
            publishedAt = new Date(`${year}-${month}-${day}`).toISOString();
          } 
          // If no date info available, use 90 days ago as fallback
          else {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            publishedAt = ninetyDaysAgo.toISOString();
          }

          // Get thumbnail - with flat-playlist, we need to construct the URL
          let thumbnail = '';
          if (entry.thumbnail) {
            // If yt-dlp provides a thumbnail URL, use it
            thumbnail = entry.thumbnail;
          } else if (entry.thumbnails && Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
            // If we have thumbnails array, pick the best one
            const mediumThumb = entry.thumbnails.find(t => t.id === 'medium' || t.id === '3');
            thumbnail = mediumThumb ? mediumThumb.url : entry.thumbnails[entry.thumbnails.length - 1].url;
          } else if (entry.id) {
            // Fallback: construct YouTube thumbnail URL from video ID
            // YouTube's thumbnail URL pattern is predictable
            thumbnail = `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`;
          }

          videos.push({
            title: entry.title || 'Untitled',
            youtube_id: entry.id,
            publishedAt: publishedAt,  // Always has a value now (either real date or 90 days ago)
            thumbnail: thumbnail,
            duration: entry.duration || 0,
          });
        }
      }

      // Clean up temp file
      await fsPromises.unlink(outputFilePath);

      return videos;
    } catch (error) {
      // Clean up temp file on error
      try {
        await fsPromises.unlink(outputFilePath);
      } catch (unlinkError) {
        // Ignore unlink errors
      }
      throw error;
    }
  }

  async getChannelVideos(channelId) {
    // Get channel from DB
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    let result = {
      videos: [],
      videoFail: false,
      failureReason: null,
      dataSource: 'cache',
      lastFetched: channel ? channel.lastFetched : null,
    };

    try {
      // First, check current state of videos in DB
      let newestVideos = await this.fetchNewestVideosFromDb(channelId);

      // Check if we need to fetch new data
      // Fetch if: no lastFetched, more than 6 hours old, OR if we have no videos in DB
      const needsRefresh = channel &&
        (!channel.lastFetched ||
         new Date() - new Date(channel.lastFetched) > 6 * 60 * 60 * 1000 ||
         newestVideos.length === 0);

      if (needsRefresh) {
        // Always use yt-dlp for fetching videos
        console.log('Fetching videos using yt-dlp');
        await this.fetchAndSaveVideosViaYtDlp(channel, channelId);
        result.dataSource = 'yt_dlp';

        // Re-fetch videos from database after updating
        newestVideos = await this.fetchNewestVideosFromDb(channelId);
      }

      // Use the videos we have (either from cache or freshly fetched)
      result.videos = newestVideos;
      result.lastFetched = channel ? channel.lastFetched : null;

      // Only show failure if we have no videos at all
      if (newestVideos.length === 0) {
        result.videoFail = true;
        result.failureReason = 'fetch_error';
      }

      return result;
    } catch (error) {
      console.error('Error fetching channel videos:', error);

      // Try to return cached data
      const cachedVideos = await this.fetchNewestVideosFromDb(channelId);

      result.videos = cachedVideos;
      result.videoFail = cachedVideos.length === 0;
      result.failureReason = cachedVideos.length === 0 ? 'fetch_error' : null;
      result.dataSource = 'cache';
      result.lastFetched = channel ? channel.lastFetched : null;

      return result;
    }
  }

  // Helper method to fetch and save videos using yt-dlp
  async fetchAndSaveVideosViaYtDlp(channel, channelId) {
    try {
      const videos = await this.fetchChannelVideosViaYtDlp(channelId);

      console.log('Found ' + videos.length + ' videos via yt-dlp');
      if (videos.length > 0) {
        await this.insertVideosIntoDb(videos, channelId);
      }

      // Update channel lastFetched
      if (channel) {
        channel.lastFetched = new Date();
        await channel.save();
      }
    } catch (ytdlpError) {
      console.error('yt-dlp error:', ytdlpError);
      throw ytdlpError;
    }
  }
}

module.exports = new ChannelModule();
