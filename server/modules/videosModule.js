const { Sequelize, sequelize } = require('../db.js');
const { Video } = require('../models');

class VideosModule {
  constructor() {}

  async getVideos() {
    try {
      const videos = await sequelize.query(
        `
        SELECT
          Videos.id,
          Videos.youtubeId,
          Videos.youTubeChannelName,
          Videos.youTubeVideoName,
          Videos.duration,
          Videos.originalDate,
          Videos.description,
          Videos.channel_id,
          COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, '%Y%m%d')) AS timeCreated
        FROM
          Videos
        LEFT JOIN
          JobVideos ON Videos.id = JobVideos.video_id
        LEFT JOIN
          Jobs ON Jobs.id = JobVideos.job_id
        ORDER BY
          COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, '%Y%m%d')) DESC
        LIMIT 150
      `,
        {
          type: Sequelize.QueryTypes.SELECT,
          model: Video,
          mapToModel: true,
          raw: true,
        }
      );

      return videos;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}

module.exports = new VideosModule();
