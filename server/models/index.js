// models/index.js
const Job = require('./job');
const JobVideo = require('./jobvideo');
const Video = require('./video');
const Channel = require('./channel');
const Session = require('./session');
const ChannelProfile = require('./channelprofile');
const ProfileFilter = require('./profilefilter');
const VideoProfileMapping = require('./videoprofilemapping');

Job.hasMany(JobVideo, { foreignKey: 'job_id', as: 'jobVideos' });

JobVideo.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });
JobVideo.belongsTo(Video, { foreignKey: 'video_id', as: 'video' });

Video.hasMany(JobVideo, { foreignKey: 'video_id', as: 'jobVideos' });
Video.hasMany(VideoProfileMapping, { foreignKey: 'video_id', as: 'profileMappings' });

Channel.hasMany(ChannelProfile, { foreignKey: 'channel_id', as: 'profiles' });

ChannelProfile.belongsTo(Channel, { foreignKey: 'channel_id', as: 'channel' });
ChannelProfile.hasMany(ProfileFilter, { foreignKey: 'profile_id', as: 'filters' });
ChannelProfile.hasMany(VideoProfileMapping, { foreignKey: 'profile_id', as: 'videoMappings' });

ProfileFilter.belongsTo(ChannelProfile, { foreignKey: 'profile_id', as: 'profile' });

VideoProfileMapping.belongsTo(Video, { foreignKey: 'video_id', as: 'video' });
VideoProfileMapping.belongsTo(ChannelProfile, { foreignKey: 'profile_id', as: 'profile' });

module.exports = {
  Job,
  JobVideo,
  Video,
  Channel,
  Session,
  ChannelProfile,
  ProfileFilter,
  VideoProfileMapping,
};
