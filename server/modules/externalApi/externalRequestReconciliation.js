const { Op } = require('sequelize');
const { parseAuxData } = require('../jobAuxData');
const { MAX_AUTO_RETRY_COUNT } = require('../download/transient403RetryPlanner');

const FINAL_JOB_STATUSES = new Set([
  'Complete', 'Complete with Warnings', 'Error', 'Failed', 'Terminated', 'Killed',
]);

/**
 * Follow each video's durable retry handoffs before deciding whether its
 * download ended. Both job-ended events and the recovery sweep use this path;
 * reads never drive request state. No transactions span the download work.
 */
function createExternalRequestReconciliation({ models, now, jobLookup = () => null }) {
  const { ExternalRequest, Video, Job } = models;

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
    const knownEnded = new Set(endedJobIds);
    const jobs = new Map();

    async function loadJobs(ids) {
      const missing = [];
      for (const id of new Set(ids)) {
        if (jobs.has(id)) continue;
        const live = jobLookup(id);
        if (live) jobs.set(id, live);
        else { jobs.set(id, null); missing.push(id); }
      }
      if (missing.length === 0) return;
      const stored = await Job.findAll({
        where: { id: { [Op.in]: missing } },
        attributes: ['id', 'status', 'aux_data'],
      });
      for (const job of stored) jobs.set(job.id, { status: job.status, data: parseAuxData(job.aux_data) });
    }

    await loadJobs(processing.filter((record) => !downloaded.has(record.youtube_id))
      .map((record) => record.job_id || record.id));
    const decisions = [];
    for (const record of processing) {
      const finishedAt = now();
      let jobId = record.job_id || record.id;
      let ended = false;
      if (!downloaded.has(record.youtube_id)) {
        const visited = new Set();
        // The planner permits at most three retries. Bound malformed/cyclic
        // history too, so corrupted job data cannot stall the executor.
        for (let hop = 0; hop <= MAX_AUTO_RETRY_COUNT; hop += 1) {
          if (visited.has(jobId)) { ended = true; break; }
          visited.add(jobId);
          await loadJobs([jobId]);
          const job = jobs.get(jobId);
          ended = !job || knownEnded.has(jobId) || FINAL_JOB_STATUSES.has(job.status);
          if (!ended) break;
          const failure = job?.data?.failedVideos?.find((video) => video.youtubeId === record.youtube_id);
          if (!failure?.autoRetryQueued || typeof failure.autoRetryJobId !== 'string') break;
          jobId = failure.autoRetryJobId;
        }
      }
      decisions.push({ record, jobId, ended, finishedAt });
    }
    // A retry can persist its video and turn terminal after the first video
    // query. Observe the final job first, then recheck presence before failing;
    // otherwise a stale absence can win the CAS against the completion event.
    const failedCandidates = decisions.filter(({ record, ended }) => ended && !downloaded.has(record.youtube_id));
    if (failedCandidates.length > 0) {
      const finishedVideos = await Video.findAll({
        where: { youtubeId: [...new Set(failedCandidates.map(({ record }) => record.youtube_id))], removed: false },
        attributes: ['youtubeId'],
      });
      finishedVideos.forEach((video) => downloaded.add(video.youtubeId));
    }
    const resolved = [];
    for (const { record, jobId, ended, finishedAt } of decisions) {
      const terminal = downloaded.has(record.youtube_id)
        ? { status: 'completed', completed_at: finishedAt }
        : ended ? { status: 'failed', message: 'Download did not complete' } : null;
      if (!terminal && jobId === (record.job_id || record.id)) continue;
      const [updated] = await ExternalRequest.update(
        { ...(terminal || {}), job_id: jobId,
          ...(terminal ? { active_dedupe_key: null } : {}), updated_at: finishedAt },
        // An old event/sweep cannot overwrite a newer retry handoff.
        { where: { id: record.id, status: 'processing', job_id: record.job_id || null } }
      );
      if (updated === 1 && terminal) resolved.push(record.id);
    }
    return resolved;
  }

  return { resolveVideoRequests };
}

module.exports = { createExternalRequestReconciliation, FINAL_JOB_STATUSES };
