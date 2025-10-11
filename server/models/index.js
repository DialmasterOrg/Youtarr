// models/index.js
const Job = require('./job');
const JobVideo = require('./jobvideo');
const JobVideoDownload = require('./jobvideodownload');
const Video = require('./video');
const Channel = require('./channel');
const Session = require('./session');

Job.hasMany(JobVideo, { foreignKey: 'job_id', as: 'jobVideos' });
Job.hasMany(JobVideoDownload, { foreignKey: 'job_id', as: 'jobVideoDownloads' });

JobVideo.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });
JobVideo.belongsTo(Video, { foreignKey: 'video_id', as: 'video' });

JobVideoDownload.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });

Video.hasMany(JobVideo, { foreignKey: 'video_id', as: 'jobVideos' });

module.exports = {
  Job,
  JobVideo,
  JobVideoDownload,
  Video,
  Channel,
  Session,
};
