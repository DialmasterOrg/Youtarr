// How a job's output begins when it failed before yt-dlp ran. The
// Sonarr/Radarr bridge (arrBridge/grabExecutor) reads these to tell a job
// that never tried its video from one that did, so the writers and that
// check share them: a new failure written before yt-dlp runs belongs here.
const OUTPUT_DIR_UNAVAILABLE = 'Output directory is not accessible';
const DOWNLOAD_PROCESS_ERROR = 'Download process error';
const JOB_NOT_STARTED = 'Job could not be started';

module.exports = { OUTPUT_DIR_UNAVAILABLE, DOWNLOAD_PROCESS_ERROR, JOB_NOT_STARTED };
