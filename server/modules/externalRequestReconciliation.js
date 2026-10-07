function createExternalRequestReconciliation({ models, now }) {
  const { Video, Job } = models;
  async function reconcile(records, transaction = null) {
    const processing = records.filter((record) => record.status === 'processing');
    const mediaRequests = processing.filter(
      (record) => ['video', 'delete_video'].includes(record.request_type)
    );
    const youtubeIds = [...new Set(mediaRequests.map((record) => record.youtube_id))];
    if (youtubeIds.length === 0) return records;
    const videos = await Video.findAll({
      where: { youtubeId: youtubeIds, removed: false },
      attributes: ['youtubeId'],
      ...(transaction ? { transaction } : {}),
    });
    const completed = new Set(videos.map((video) => video.youtubeId));
    const completedAt = now();
    const completedRecords = mediaRequests.filter((record) =>
      (record.request_type === 'video' && completed.has(record.youtube_id)) ||
      (record.request_type === 'delete_video' && !completed.has(record.youtube_id))
    );
    await Promise.all(completedRecords.map(async (record) => {
      await record.update({
        status: 'completed',
        active_dedupe_key: null,
        completed_at: completedAt,
        updated_at: completedAt,
      }, ...(transaction ? [{ transaction }] : []));
    }));
    const unresolved = mediaRequests.filter(
      (record) => record.request_type === 'video' &&
        !completed.has(record.youtube_id) && record.job_id
    );
    if (unresolved.length > 0) {
      const jobs = await Job.findAll({
        where: { id: [...new Set(unresolved.map((record) => record.job_id))] },
        attributes: ['id', 'status'],
        ...(transaction ? { transaction } : {}),
      });
      const terminalFailures = new Set(
        jobs
          .filter((job) => [
            'Error', 'Killed', 'Terminated', 'Complete', 'Complete with Warnings',
          ].includes(job.status))
          .map((job) => job.id)
      );
      await Promise.all(unresolved
        .filter((record) => terminalFailures.has(record.job_id))
        .map((record) => record.update({
          status: 'failed',
          active_dedupe_key: null,
          message: 'Download did not complete',
          updated_at: completedAt,
        }, ...(transaction ? [{ transaction }] : []))));
    }
    return records;
  }

  return reconcile;
}

module.exports = { createExternalRequestReconciliation };
