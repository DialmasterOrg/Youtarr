// Pure decision logic mapping known download-failure signatures to
// plain-language diagnoses with fix guidance. The finalizer runs this over
// the reportable failed videos. Advice text is stored once per job in the
// returned list; videos only carry a short diagnosisKey. No I/O here: disk
// measurements arrive in the context.

const { isTransient403Failure } = require('./transient403RetryPlanner');
const { isBotCheck } = require('../ytdlpBotCheck');
const { KIND, ADVICE: YOUTUBE_BLOCK_ADVICE, adviceKey } = require('../youtubeBlockAdvice');

// When bot detection fired run-wide, only download/extraction-shaped failures
// are attributed to it; unrelated errors (postprocessing, disk) in the same
// run stay undiagnosed rather than getting misleading bot-check advice.
const DOWNLOAD_FAILURE_PATTERN = /unable to (download|extract)/i;

const ADVICE = {
  'temp-out-of-space': {
    title: 'Not enough disk space to finish the download',
    message:
      'There was not enough free space in the temporary download folder to ' +
      'finish this video. Merging the video and audio needs roughly twice ' +
      'the video\'s size. Free up space there, then try again. The server ' +
      'log names the folder and how much space it had; where downloads are ' +
      'staged depends on "External temp directory" in Settings.',
  },
  // The YouTube refusals are worded in youtubeBlockAdvice, with every other
  // text about them.
  ...YOUTUBE_BLOCK_ADVICE,
};

// The diagnoses that mean YouTube refused this server or these cookies, which
// often passes on its own. The "anonymous-retry" ones are left out: there the
// video failed with and without cookies and may really be unavailable.
const YOUTUBE_BLOCK_KEYS = new Set([
  'http-403-cookies-enabled',
  'http-403-cookies-disabled',
  'bot-check-cookies-enabled',
  'bot-check-cookies-disabled',
]);

const isYoutubeBlock = (key) => YOUTUBE_BLOCK_KEYS.has(key);

// Ordered registry; first match wins. Out-of-space comes first: the finalizer
// measured it for that video (tempSpaceProbe), so it is not a guess from the
// error text. Bot-check outranks http-403 because a bot-flagged run blocks the
// 403 retry plan and the bot advice is the more specific diagnosis.
const REGISTRY = [
  {
    matches: (video, context) =>
      Boolean(context.outOfSpaceVideoIds && context.outOfSpaceVideoIds.has(video.youtubeId)),
    keyFor: () => 'temp-out-of-space',
  },
  {
    matches: (video, context) => {
      const error = String(video.error || '');
      if (isBotCheck(error)) return true;
      return context.botDetected === true && DOWNLOAD_FAILURE_PATTERN.test(error);
    },
    keyFor: (context) => adviceKey(KIND.BOT_CHECK, context),
  },
  {
    matches: (video, context) =>
      isTransient403Failure(video, { httpForbiddenDetected: context.httpForbiddenDetected === true }),
    keyFor: (context) => adviceKey(KIND.HTTP_403, context),
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
  isYoutubeBlock,
  ADVICE,
  REGISTRY,
};
