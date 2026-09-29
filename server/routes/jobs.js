const express = require('express');

/**
 * Creates job routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.jobModule - Job module
 * @param {Object} deps.downloadModule - Download module
 * @returns {express.Router}
 */
module.exports = function createJobRoutes({ verifyToken, jobModule, downloadModule, videoActivity, storageGuard }) {
  const router = express.Router();
  /**
   * @swagger
   * /api/jobs/video-activity:
   *   get:
   *     summary: Get queued and downloading video activity
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Transient activity snapshot; entries disappear when work ends
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 instanceId:
   *                   type: string
   *                 revision:
   *                   type: integer
   *                 videos:
   *                   type: object
   *                   additionalProperties:
   *                     type: object
   *                     properties:
   *                       jobId:
   *                         type: string
   *                       state:
   *                         type: string
   *                         enum: [queued, downloading]
   *       401:
   *         description: Authentication required
   */
  // Lightweight live activity; deliberately excludes download history and files.
  router.get('/api/jobs/video-activity', verifyToken, (req, res) => {
    res.json(videoActivity.snapshot());
  });

  /**
   * @swagger
   * /jobstatus/{jobId}:
   *   get:
   *     summary: Get job status
   *     description: Retrieve the status of a specific download job.
   *     tags: [Jobs]
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *         description: Job ID
   *     responses:
   *       200:
   *         description: Job status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 jobId:
   *                   type: string
   *                 jobType:
   *                   type: string
   *                 status:
   *                   type: string
   *                 progress:
   *                   type: number
   *       404:
   *         description: Job not found
   */
  router.get('/jobstatus/:jobId', verifyToken, (req, res) => {
    const jobId = req.params.jobId;
    const job = jobModule.getJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
    } else {
      res.json(job);
    }
  });

  /**
   * @swagger
   * /runningjobs:
   *   get:
   *     summary: Get running jobs
   *     description: Retrieve a list of currently running download jobs.
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: List of running jobs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   jobId:
   *                     type: string
   *                   jobType:
   *                     type: string
   *                   status:
   *                     type: string
   *                   progress:
   *                     type: number
   */
  router.get('/runningjobs', verifyToken, async (req, res) => {
    try {
      const runningJobs = await jobModule.getRunningJobsWithFreshVideos();
      res.json(runningJobs);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to get running jobs');
      res.status(500).json({ error: 'Failed to get running jobs' });
    }
  });

  /**
   * @swagger
   * /api/jobs/current-activity:
   *   get:
   *     summary: Get current download activity
   *     description: >
   *       Snapshot of the current (or most recent) download run for the
   *       activity page. Combines the live progress monitor state with the
   *       last stored final-state message so a freshly-opened page can render
   *       immediately without waiting for a WebSocket broadcast.
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Current activity snapshot
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 jobId:
   *                   type: string
   *                   nullable: true
   *                 capturedAt:
   *                   type: number
   *                   nullable: true
   *                   description: Epoch ms of the monitor's last activity
   *                 terminal:
   *                   type: boolean
   *                   description: True when yt-dlp is not currently running
   *                 activity:
   *                   type: object
   *                   nullable: true
   *                   description: Structured progress payload (same shape as downloadProgress broadcasts)
   *                 lastFinalActivity:
   *                   type: object
   *                   nullable: true
   *                   description: Last stored final-state downloadProgress payload, if any
   *       500:
   *         description: Failed to get current download activity
   */
  router.get('/api/jobs/current-activity', verifyToken, (req, res) => {
    try {
      res.json(downloadModule.getCurrentActivitySnapshot());
    } catch (error) {
      req.log.error({ err: error }, 'Failed to get current download activity');
      res.status(500).json({ error: 'Failed to get current download activity' });
    }
  });

  /**
   * @swagger
   * /api/jobs/download-pause:
   *   get:
   *     summary: Get the storage download pause state
   *     description: >
   *       Whether downloads are paused because a storage limit was reached
   *       (downloadPauseUsageLimit or downloadPauseMinFreeSpace), with the
   *       reasons and current measurements. Measured fresh on each request.
   *       Changes are also broadcast as downloadPauseChanged WebSocket messages.
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Download pause status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 paused:
   *                   type: boolean
   *                 pausedSince:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                 reasons:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       type:
   *                         type: string
   *                         enum: [usage, freeSpace]
   *                       currentBytes:
   *                         type: number
   *                       limitBytes:
   *                         type: number
   *                       text:
   *                         type: string
   *                 usage:
   *                   type: object
   *                   description: Configured usage limit and total size of downloaded videos (always measured for this endpoint; downloadedBytes is null when it could not be measured)
   *                 freeSpace:
   *                   type: object
   *                   description: Configured free-space minimum and available bytes (null when not configured or unavailable)
   *                 checkedAt:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *       500:
   *         description: Failed to get the download pause state
   */
  router.get('/api/jobs/download-pause', verifyToken, async (req, res) => {
    try {
      res.json(await storageGuard.refresh({ includeUsage: true }));
    } catch (error) {
      req.log.error({ err: error }, 'Failed to get download pause state');
      res.status(500).json({ error: 'Failed to get download pause state' });
    }
  });

  /**
   * @swagger
   * /api/jobs/terminate:
   *   post:
   *     summary: Terminate current job
   *     description: Terminate the currently running download job.
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job termination initiated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 jobId:
   *                   type: string
   *                 message:
   *                   type: string
   *       400:
   *         description: No job is currently running
   *       500:
   *         description: Failed to terminate job
   */
  router.post('/api/jobs/terminate', verifyToken, (req, res) => {
    const inProgressJobId = jobModule.getInProgressJobId();

    if (!inProgressJobId) {
      return res.status(400).json({
        error: 'No job is currently running',
        success: false
      });
    }

    const terminatedJobId = downloadModule.terminateCurrentDownload();

    if (terminatedJobId) {
      res.json({
        success: true,
        jobId: terminatedJobId,
        message: 'Download termination initiated'
      });
    } else {
      res.status(500).json({
        error: 'Failed to terminate job',
        success: false
      });
    }
  });

  return router;
};

