const { Op } = require('sequelize');

const FINAL_JOB_STATUSES = new Set([
  'Complete', 'Complete with Warnings', 'Error', 'Failed', 'Terminated', 'Killed',
]);

/**
 * Closes processing video requests whose download job has ended: completed
 * when the video is now on disk, failed otherwise. Runs from the job-ended
 * hook and the executor's sweep, never from reads, so a request's status does
 * not depend on who happens to read it.
 */
function createExternalRequestReconciliation({ models, now, jobLookup = () => null }) {
  const { ExternalRequest, Video, Job } = models;

  async function endedJobIdsFor(records, knownEnded) {
    const ended = new Set(knownEnded);
    const unknown = [];
    for (const record of records) {
      const jobId = record.job_id || record.id;
      if (ended.has(jobId)) continue;
      const liveJob = jobLookup(jobId);
      if (liveJob) {
        if (FINAL_JOB_STATUSES.has(liveJob.status)) ended.add(jobId);
      } else {
        unknown.push(jobId);
      }
    }
    if (unknown.length === 0) return ended;
    const stored = await Job.findAll({
      where: { id: { [Op.in]: [...new Set(unknown)] } },
      attributes: ['id', 'status'],
    });
    const storedById = new Map(stored.map((job) => [job.id, job.status]));
    for (const jobId of unknown) {
      // A job neither running nor stored was lost (for example, with a
      // restart before it was saved); its request can never complete.
      if (!storedById.has(jobId) || FINAL_JOB_STATUSES.has(storedById.get(jobId))) {
        ended.add(jobId);
      }
    }
    return ended;
  }

  async function resolveVideoRequests(records, { endedJobIds = [] } = {}) {
    const processing = records.filter(
      (record) => record.request_type === 'video' && record.status === 'processing'
    );
    if (processing.length === 0) return [];
    const videos = await Video.findAll({
      where: { youtubeId: [...new Set(processing.map((record) => record.youtube_id))], removed: false },
      attributes: ['youtubeId'],
    });
    const downloaded = new Set(videos.map((video) => video.youtubeId));
    const ended = await endedJobIdsFor(
      processing.filter((record) => !downloaded.has(record.youtube_id)),
      endedJobIds
    );
    const resolved = [];
    for (const record of processing) {
      const finishedAt = now();
      const values = downloaded.has(record.youtube_id)
        ? { status: 'completed', completed_at: finishedAt }
        : ended.has(record.job_id || record.id)
          ? { status: 'failed', message: 'Download did not complete' }
          : null;
      if (!values) continue;
      const [updated] = await ExternalRequest.update(
        { ...values, active_dedupe_key: null, updated_at: finishedAt },
        { where: { id: record.id, status: 'processing' } }
      );
      if (updated === 1) resolved.push(record.id);
    }
    return resolved;
  }

  return { resolveVideoRequests };
}

module.exports = { createExternalRequestReconciliation, FINAL_JOB_STATUSES };
