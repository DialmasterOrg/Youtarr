// models/index.js
const Job = require('./job');
const JobVideo = require('./jobvideo');
const JobVideoDownload = require('./jobvideodownload');
const Video = require('./video');
const Channel = require('./channel');
const Session = require('./session');
const ApiKey = require('./apikey');
const Playlist = require('./playlist');
const PlaylistVideo = require('./playlistvideo');
const PlaylistSyncState = require('./playlistsyncstate');
const Subfolder = require('./subfolder');
const VideoWatchStatus = require('./videowatchstatus');
const MediaServerUser = require('./mediaserveruser');
const WatchStatusSyncCursor = require('./watchstatussynccursor');
const ApiKeyChannelGrant = require('./apikeychannelgrant');
const ExternalRequest = require('./externalrequest');
const ExternalApiUsageBucket = require('./externalapiusagebucket');

Job.hasMany(JobVideo, { foreignKey: 'job_id', as: 'jobVideos' });
Job.hasMany(JobVideoDownload, { foreignKey: 'job_id', as: 'jobVideoDownloads' });

JobVideo.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });
JobVideo.belongsTo(Video, { foreignKey: 'video_id', as: 'video' });

JobVideoDownload.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });

Video.hasMany(JobVideo, { foreignKey: 'video_id', as: 'jobVideos' });

Playlist.hasMany(PlaylistVideo, { foreignKey: 'playlist_id', sourceKey: 'playlist_id' });
PlaylistVideo.belongsTo(Playlist, { foreignKey: 'playlist_id', targetKey: 'playlist_id' });

Playlist.hasMany(PlaylistSyncState, { foreignKey: 'playlist_id', sourceKey: 'id' });
PlaylistSyncState.belongsTo(Playlist, { foreignKey: 'playlist_id', targetKey: 'id' });

Video.hasMany(VideoWatchStatus, { foreignKey: 'video_id', as: 'watchStatuses' });
VideoWatchStatus.belongsTo(Video, { foreignKey: 'video_id', as: 'video' });

ApiKey.hasMany(ApiKeyChannelGrant, { foreignKey: 'api_key_id', as: 'channelGrants' });
ApiKeyChannelGrant.belongsTo(ApiKey, { foreignKey: 'api_key_id', as: 'apiKey' });
Channel.hasMany(ApiKeyChannelGrant, { foreignKey: 'channel_id', as: 'apiKeyGrants' });
ApiKeyChannelGrant.belongsTo(Channel, { foreignKey: 'channel_id', as: 'channel' });
ApiKey.hasMany(ExternalRequest, { foreignKey: 'api_key_id', as: 'externalRequests' });
ExternalRequest.belongsTo(ApiKey, { foreignKey: 'api_key_id', as: 'apiKey' });
Channel.hasMany(ExternalRequest, { foreignKey: 'channel_id', as: 'externalRequests' });
ExternalRequest.belongsTo(Channel, { foreignKey: 'channel_id', as: 'channel' });
Job.hasMany(ExternalRequest, { foreignKey: 'job_id', as: 'externalRequests' });
ExternalRequest.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });
ApiKey.hasMany(ExternalApiUsageBucket, { foreignKey: 'api_key_id', as: 'usageBuckets' });
ExternalApiUsageBucket.belongsTo(ApiKey, { foreignKey: 'api_key_id', as: 'apiKey' });

module.exports = {
  Job,
  JobVideo,
  JobVideoDownload,
  Video,
  Channel,
  Session,
  ApiKey,
  Playlist,
  PlaylistVideo,
  PlaylistSyncState,
  Subfolder,
  VideoWatchStatus,
  MediaServerUser,
  WatchStatusSyncCursor,
  ApiKeyChannelGrant,
  ExternalRequest,
  ExternalApiUsageBucket,
};
