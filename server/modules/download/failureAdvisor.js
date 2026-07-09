// Pure decision logic mapping known download-failure signatures to
// plain-language diagnoses with fix guidance. The finalizer runs this over
// the reportable failed videos. Advice text is stored once per job in the
// returned list; videos only carry a short diagnosisKey. No I/O here.

const { isTransient403Failure } = require('./transient403RetryPlanner');

const BOT_CHECK_PATTERN = /sign in to confirm.*not a bot/i;

// When bot detection fired run-wide, only download/extraction-shaped failures
// are attributed to it; unrelated errors (postprocessing, disk) in the same
// run stay undiagnosed rather than getting misleading bot-check advice.
const DOWNLOAD_FAILURE_PATTERN = /unable to (download|extract)/i;

const ADVICE = {
  'http-403-cookies-enabled': {
    title: 'YouTube blocked the download while using your cookies',
    message:
      'YouTube blocked this download while using your uploaded cookies. ' +
      'Cookies that are stale or rotated are the most common cause. First: ' +
      're-export fresh cookies from your browser and upload them in ' +
      'Settings -> Cookies. If fresh cookies still fail, ' +
      'temporarily disable cookies and retry - many videos download fine ' +
      'without them.',
  },
  'http-403-cookies-disabled': {
    title: 'YouTube blocked the download',
    message:
      'YouTube blocked this download. This is sometimes temporary - ' +
      'retrying later can work. If it keeps failing, uploading YouTube ' +
      'cookies from your browser (Settings -> Cookies) often ' +
      'resolves it.',
  },
  'bot-check-cookies-enabled': {
    title: 'YouTube bot check despite cookies',
    message:
      'YouTube flagged this download as automated even though cookies are ' +
      'configured - they are likely expired or rotated. Re-export fresh ' +
      'cookies from your browser and upload them again.',
  },
  'bot-check-cookies-disabled': {
    title: 'YouTube is asking for sign-in verification',
    message:
      'YouTube is asking for sign-in verification. Upload YouTube cookies ' +
      'from your browser in Settings -> Cookies to resolve ' +
      'this.',
  },
};

// Ordered registry; first match wins. Bot-check outranks http-403 because a
// bot-flagged run blocks the 403 retry plan and the bot advice is the more
// specific diagnosis.
const REGISTRY = [
  {
    matches: (video, context) => {
      const error = String(video.error || '');
      if (BOT_CHECK_PATTERN.test(error)) return true;
      return context.botDetected === true && DOWNLOAD_FAILURE_PATTERN.test(error);
    },
    keyFor: (context) =>
      context.cookiesEnabled ? 'bot-check-cookies-enabled' : 'bot-check-cookies-disabled',
  },
  {
    matches: (video, context) =>
      isTransient403Failure(video, { httpForbiddenDetected: context.httpForbiddenDetected === true }),
    keyFor: (context) =>
      context.cookiesEnabled ? 'http-403-cookies-enabled' : 'http-403-cookies-disabled',
  },
];

// Stamps diagnosisKey onto each matched video (in place, so the key flows
// into the persisted job payload) and returns the deduped advice list:
// [{ key, title, message, count }]. Unmatched videos are left untouched.
function adviseFailures(failedVideos, context = {}) {
  if (!Array.isArray(failedVideos)) return [];

  const counts = new Map();
  for (const video of failedVideos) {
    if (!video) continue;
    const entry = REGISTRY.find((candidate) => candidate.matches(video, context));
    if (!entry) continue;
    const key = entry.keyFor(context);
    video.diagnosisKey = key;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].map(([key, count]) => ({
    key,
    title: ADVICE[key].title,
    message: ADVICE[key].message,
    count,
  }));
}

// Merges diagnosis lists from separate finalize passes (download groups of
// one job, jobs of one run): dedupe by key, sum counts, first occurrence's
// text wins.
function mergeDiagnoses(existing, incoming) {
  const merged = new Map();
  for (const diagnosis of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (!diagnosis || !diagnosis.key) continue;
    const current = merged.get(diagnosis.key);
    if (current) {
      current.count += diagnosis.count || 0;
    } else {
      merged.set(diagnosis.key, { ...diagnosis, count: diagnosis.count || 0 });
    }
  }
  return [...merged.values()];
}

module.exports = {
  adviseFailures,
  mergeDiagnoses,
  ADVICE,
  REGISTRY,
};
