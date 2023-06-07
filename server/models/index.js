// models/index.js
const Job = require('./job');
const JobVideo = require('./jobvideo');
const Video = require('./video');
const Channel = require('./channel');

Job.hasMany(JobVideo, { foreignKey: 'job_id', as: 'jobVideos' });

JobVideo.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });
JobVideo.belongsTo(Video, { foreignKey: 'video_id', as: 'video' });

Video.hasMany(JobVideo, { foreignKey: 'video_id', as: 'jobVideos' });

module.exports = {
  Job,
  JobVideo,
  Video,
  Channel,
};
