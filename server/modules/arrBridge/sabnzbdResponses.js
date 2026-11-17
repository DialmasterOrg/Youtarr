// The SABnzbd API payloads Sonarr and Radarr read. Pure. The field sets are
// the ones both apps' Test buttons and import paths accepted.
const { SAB_VERSION } = require('./arrBridgeConfig');

const BYTES_PER_MB = 1024 * 1024;
const CATCH_ALL_CATEGORY = '*';

const pad2 = (value) => String(value).padStart(2, '0');
const toMb = (bytes) => (bytes || 0) / BYTES_PER_MB;

/**
 * Sonarr parses this strictly as h:mm:ss.
 * @param {number} seconds
 * @returns {string}
 */
function formatTimeleft(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 3600)}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
}

const version = () => ({ version: SAB_VERSION });
const error = (message) => ({ status: false, error: message });
const added = (id) => ({ status: true, nzo_ids: [id] });
const fullStatus = ({ completeDir }) => ({ status: { completedir: completeDir } });

/**
 * Sorting and pre-check are off: either would make the apps refuse the client
 * or look for the download somewhere else.
 * @param {Object} options
 * @param {string} options.completeDir - The staging root as the apps see it
 * @param {Array<{name: string}>} options.categories
 */
function getConfig({ completeDir, categories }) {
  const category = (name, order) => ({
    name, order, pp: '', script: 'Default', dir: name, newzbin: '', priority: -100,
  });
  return {
    config: {
      misc: {
        complete_dir: completeDir,
        pre_check: false,
        history_retention: '',
        history_retention_option: 'all',
        history_retention_number: 0,
        enable_tv_sorting: false,
        tv_categories: [],
        enable_movie_sorting: false,
        movie_categories: [],
        enable_date_sorting: false,
        date_categories: [],
      },
      categories: [
        { name: CATCH_ALL_CATEGORY, order: 0, pp: '3', script: 'None', dir: '', newzbin: '', priority: 0 },
        ...categories.map((entry, index) => category(entry.name, index + 1)),
      ],
      sorters: [],
    },
  };
}

// Live progress when this grab's job is the one downloading and yt-dlp has
// reported a size; otherwise the estimate carried from the search.
function queueProgress(grab, activity) {
  const running = Boolean(activity) && !activity.terminal && activity.jobId === grab.job_id;
  const progress = running ? activity.activity?.progress : null;
  if (progress && progress.totalBytes > 0) {
    return {
      running,
      totalMb: toMb(progress.totalBytes),
      leftMb: toMb(Math.max(0, progress.totalBytes - progress.downloadedBytes)),
      etaSeconds: progress.etaSeconds,
    };
  }
  const totalMb = toMb(Number(grab.estimated_bytes));
  return { running, totalMb, leftMb: totalMb, etaSeconds: 0 };
}

/**
 * @param {Object} options
 * @param {Array<Object>} options.grabs - Pending and queued grab rows
 * @param {Object|null} options.activity - downloadModule.getCurrentActivitySnapshot()
 * @param {boolean} options.paused - Downloads are paused by the storage guard
 */
function queue({ grabs, activity, paused }) {
  const slots = grabs.map((grab, index) => {
    const { running, totalMb, leftMb, etaSeconds } = queueProgress(grab, activity);
    const percentage = totalMb > 0 ? Math.round(((totalMb - leftMb) / totalMb) * 100) : 0;
    return {
      status: paused ? 'Paused' : running ? 'Downloading' : 'Queued',
      index,
      password: '',
      avg_age: '0d',
      script: 'None',
      mb: totalMb.toFixed(2),
      mbleft: leftMb.toFixed(2),
      mbmissing: '0.0',
      size: `${totalMb.toFixed(1)} MB`,
      sizeleft: `${leftMb.toFixed(1)} MB`,
      filename: grab.release_title,
      labels: [],
      priority: 'Normal',
      cat: grab.category,
      timeleft: formatTimeleft(etaSeconds),
      percentage: String(percentage),
      nzo_id: grab.id,
      unpackopts: '3',
    };
  });
  return {
    queue: {
      status: paused ? 'Paused' : slots.length > 0 ? 'Downloading' : 'Idle',
      paused,
      paused_all: false,
      noofslots_total: slots.length,
      noofslots: slots.length,
      limit: 0,
      start: 0,
      timeleft: '0:00:00',
      speed: '0 ',
      kbpersec: '0.00',
      size: '0 B',
      sizeleft: '0 B',
      mb: '0.00',
      mbleft: '0.00',
      slots,
      version: SAB_VERSION,
    },
  };
}

const epochSeconds = (date) => (date ? Math.floor(new Date(date).getTime() / 1000) : 0);

/**
 * The apps find the file to import from `name` (the release title) and
 * `storage` (the staged file), never from their own grab history.
 * @param {Object} options
 * @param {Array<Object>} options.grabs - Completed and failed grab rows, newest first
 * @param {Function} options.storagePathFor - (grab) => the staged file path as the apps see it
 */
function history({ grabs, storagePathFor }) {
  const slots = grabs.map((grab) => {
    const completed = grab.status === 'completed';
    const bytes = completed ? Number(grab.bytes) || 0 : 0;
    return {
      action_line: '',
      duplicate_key: '',
      meta: null,
      fail_message: completed ? '' : grab.fail_message || 'Download failed',
      loaded: false,
      size: `${toMb(bytes).toFixed(1)} MB`,
      category: grab.category,
      pp: 'D',
      retry: 0,
      script: 'None',
      nzb_name: `${grab.release_title}.nzb`,
      download_time: Math.max(0, epochSeconds(grab.completed_at) - epochSeconds(grab.created_at)),
      storage: completed ? storagePathFor(grab) : '',
      has_rating: false,
      status: completed ? 'Completed' : 'Failed',
      script_line: '',
      completed: epochSeconds(grab.completed_at),
      nzo_id: grab.id,
      downloaded: bytes,
      report: '',
      password: '',
      path: '',
      postproc_time: 0,
      name: grab.release_title,
      url: `${grab.release_title}.nzb`,
      md5sum: '',
      archive: false,
      bytes,
      url_info: '',
      stage_log: [],
    };
  });
  return { history: { noofslots: slots.length, ppslots: 0, slots } };
}

module.exports = { formatTimeleft, version, error, added, fullStatus, getConfig, queue, history };
