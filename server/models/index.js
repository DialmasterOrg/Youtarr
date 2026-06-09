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
};
