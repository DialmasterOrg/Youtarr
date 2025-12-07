const express = require('express');
const router = express.Router();

/**
 * Creates job routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.jobModule - Job module
 * @param {Object} deps.downloadModule - Download module
 * @returns {express.Router}
 */
module.exports = function createJobRoutes({ verifyToken, jobModule, downloadModule }) {
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
  router.get('/runningjobs', verifyToken, (req, res) => {
    const runningJobs = jobModule.getRunningJobs();
    res.json(runningJobs);
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

