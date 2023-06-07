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
          Jobs.timeCreated
        FROM
          Videos
        INNER JOIN
          JobVideos ON Videos.id = JobVideos.video_id
        INNER JOIN
          Jobs ON Jobs.id = JobVideos.job_id
        ORDER BY
          Jobs.timeCreated DESC
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
