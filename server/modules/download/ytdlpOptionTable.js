// yt-dlp custom-args policy table.
//
// Security control for the Settings "Custom yt-dlp options" field: every option
// a user supplies is resolved to its canonical yt-dlp name (exact match, then
// unique long-option prefix, then short alias) and then checked against this
// policy. ALLOW and WARN are explicit allowlists; EVERY other known option and
// every unrecognized token is blocked (fail closed).
//
// OPTION_SPECS (ytdlpOptionSpecs.js) is generated from yt-dlp's own parser by
// scripts/generate-ytdlp-option-specs.py; regenerate it periodically. yt-dlp
// updates itself at runtime, so an option added by a newer release is blocked
// as unknown until the specs are regenerated and the option is classified here.
// The ALLOW / WARN / BLOCK policy below is maintained by hand.
//
// Advisories GHSA-xj5v-qwfw-gp7j / GHSA-jprg-87hp-2phh.

const OPTION_SPECS = require('./ytdlpOptionSpecs');

const BUCKET = { ALLOW: 'allow', WARN: 'warn', BLOCK: 'block' };

// Safe tuning knobs. Accepted as-is.
const ALLOW = new Set([
  '--ignore-errors',
  '--ignore-no-formats-error',
  '--live-from-start',
  '--wait-for-video',
  '--no-wait-for-video',
  '--mark-watched',
  '--no-mark-watched',
  '--default-search',
  '--no-live-from-start',
  '--no-ignore-no-formats-error',
  '--socket-timeout',
  '--impersonate',
  '--legacy-server-connect',
  '--no-check-certificates',
  '--prefer-insecure',
  '--user-agent',
  '--referer',
  '--bidi-workaround',
  '--geo-verification-proxy',
  '--xff',
  '--geo-bypass',
  '--geo-bypass-country',
  '--geo-bypass-ip-block',
  '--no-geo-bypass',
  '--match-title',
  '--reject-title',
  '--min-filesize',
  '--max-filesize',
  '--date',
  '--datebefore',
  '--dateafter',
  '--min-views',
  '--max-views',
  '--match-filters',
  '--break-match-filters',
  '--no-break-match-filters',
  '--no-playlist',
  '--yes-playlist',
  '--age-limit',
  '--break-on-existing',
  '--no-break-on-existing',
  '--break-on-reject',
  '--break-per-input',
  '--no-break-per-input',
  '--skip-playlist-after-errors',
  '--format',
  '--format-sort',
  '--format-sort-reset',
  '--format-sort-force',
  '--no-format-sort-force',
  '--video-multistreams',
  '--no-video-multistreams',
  '--audio-multistreams',
  '--no-audio-multistreams',
  '--prefer-free-formats',
  '--no-prefer-free-formats',
  '--check-formats',
  '--check-all-formats',
  '--no-check-formats',
  '--write-subs',
  '--no-write-subs',
  '--write-auto-subs',
  '--no-write-auto-subs',
  '--all-subs',
  '--sub-format',
  '--sub-langs',
  '--concurrent-fragments',
  '--throttled-rate',
  '--retries',
  '--file-access-retries',
  '--fragment-retries',
  '--retry-sleep',
  '--skip-unavailable-fragments',
  '--abort-on-unavailable-fragments',
  '--keep-fragments',
  '--no-keep-fragments',
  '--buffer-size',
  '--resize-buffer',
  '--no-resize-buffer',
  '--http-chunk-size',
  '--playlist-reverse',
  '--no-playlist-reverse',
  '--playlist-random',
  '--lazy-playlist',
  '--no-lazy-playlist',
  '--hls-prefer-native',
  '--hls-prefer-ffmpeg',
  '--hls-use-mpegts',
  '--no-hls-use-mpegts',
  '--hls-split-discontinuity',
  '--no-hls-split-discontinuity',
  '--download-sections',
  '--encoding',
  '--sleep-interval',
  '--max-sleep-interval',
  '--sleep-subtitles',
  '--no-overwrites',
  '--force-overwrites',
  '--no-force-overwrites',
  '--continue',
  '--no-continue',
  '--part',
  '--no-part',
  '--mtime',
  '--no-mtime',
  '--audio-quality',
  '--post-overwrites',
  '--no-post-overwrites',
  '--embed-subs',
  '--no-embed-subs',
  '--embed-thumbnail',
  '--no-embed-thumbnail',
  '--embed-metadata',
  '--no-embed-metadata',
  '--embed-chapters',
  '--no-embed-chapters',
  '--xattrs',
  '--concat-playlist',
  '--fixup',
  '--convert-subs',
  '--no-split-chapters',
  '--remove-chapters',
  '--no-remove-chapters',
  '--force-keyframes-at-cuts',
  '--no-force-keyframes-at-cuts',
  '--write-description',
  '--no-write-description',
  '--write-comments',
  '--no-write-comments',
  '--extractor-args',
  '--extractor-retries',
  '--allow-dynamic-mpd',
  '--ignore-dynamic-mpd',
  '--no-allow-unplayable-formats',
  '--no-restrict-filenames',
  '--no-colors',
]);

// Safe, but will probably break downloads or override something Youtarr owns.
// Still passed to yt-dlp; the UI shows the reason.
const WARN = new Map([
  ['--simulate', 'this will probably break downloads or Youtarr output handling'],
  ['--no-simulate', 'this will probably break downloads or Youtarr output handling'],
  ['--skip-download', 'this will probably break downloads or Youtarr output handling'],
  ['--quiet', 'this will probably break downloads or Youtarr output handling'],
  ['--no-quiet', 'this will probably break downloads or Youtarr output handling'],
  ['--no-warnings', 'this will probably break downloads or Youtarr output handling'],
  ['--verbose', 'this will probably break downloads or Youtarr output handling'],
  ['--no-progress', 'this will probably break downloads or Youtarr output handling'],
  ['--progress', 'this will probably break downloads or Youtarr output handling'],
  ['--newline', 'this will probably break downloads or Youtarr output handling'],
  ['--console-title', 'this will probably break downloads or Youtarr output handling'],
  ['--progress-template', 'this will probably break downloads or Youtarr output handling'],
  ['--progress-delta', 'this will probably break downloads or Youtarr output handling'],
  ['--print', 'this will probably break downloads or Youtarr output handling'],
  ['--print-json', 'this will probably break downloads or Youtarr output handling'],
  ['--dump-json', 'this will probably break downloads or Youtarr output handling'],
  ['--dump-single-json', 'this will probably break downloads or Youtarr output handling'],
  ['--get-description', 'this will probably break downloads or Youtarr output handling'],
  ['--get-duration', 'this will probably break downloads or Youtarr output handling'],
  ['--get-filename', 'this will probably break downloads or Youtarr output handling'],
  ['--get-format', 'this will probably break downloads or Youtarr output handling'],
  ['--get-id', 'this will probably break downloads or Youtarr output handling'],
  ['--get-thumbnail', 'this will probably break downloads or Youtarr output handling'],
  ['--get-title', 'this will probably break downloads or Youtarr output handling'],
  ['--get-url', 'this will probably break downloads or Youtarr output handling'],
  ['--list-formats', 'this will probably break downloads or Youtarr output handling'],
  ['--list-subs', 'this will probably break downloads or Youtarr output handling'],
  ['--list-thumbnails', 'this will probably break downloads or Youtarr output handling'],
  ['--list-extractors', 'this will probably break downloads or Youtarr output handling'],
  ['--extractor-descriptions', 'this will probably break downloads or Youtarr output handling'],
  ['--flat-playlist', 'this will probably break downloads or Youtarr output handling'],
  ['--no-flat-playlist', 'this will probably break downloads or Youtarr output handling'],
  ['--test', 'this will probably break downloads or Youtarr output handling'],
  ['--color', 'this will probably break downloads or Youtarr output handling'],
  ['--playlist-start', 'this will probably break downloads or Youtarr output handling'],
  ['--playlist-end', 'this will probably break downloads or Youtarr output handling'],
  ['--playlist-items', 'this will probably break downloads or Youtarr output handling'],
  ['--write-link', 'this will probably break downloads or Youtarr output handling'],
  ['--write-url-link', 'this will probably break downloads or Youtarr output handling'],
  ['--write-webloc-link', 'this will probably break downloads or Youtarr output handling'],
  ['--write-desktop-link', 'this will probably break downloads or Youtarr output handling'],
  ['--abort-on-error', 'this stops the whole batch on the first failed video'],
  ['--no-abort-on-error', 'this overrides Youtarr\'s --ignore-errors, so one failed post-processing step skips the rest of that video\'s post-processing, including Youtarr\'s own'],
  ['--all-formats', 'this downloads every available format of each video'],
  ['--allow-unplayable-formats', 'this disables post-processing and can produce unplayable files'],
  ['--extract-audio', 'this turns every video download into an audio-only file'],
  ['--audio-format', 'Youtarr only picks up .mp3 files for MP3 downloads, so another format is not found'],
  ['--keep-video', 'Youtarr sets this for MP3 downloads; overriding it can delete the video or leave files Youtarr does not track'],
  ['--no-keep-video', 'Youtarr sets this for MP3 downloads; overriding it can delete the video or leave files Youtarr does not track'],
  ['--merge-output-format', 'Youtarr only picks up .mp4 video files, so another container is not found'],
  ['--remux-video', 'Youtarr only picks up .mp4 video files, so another container is not found'],
  ['--recode-video', 'Youtarr only picks up .mp4 video files, so another container is not found'],
  ['--split-chapters', 'this writes extra per-chapter files that Youtarr does not track'],
  ['--max-downloads', 'this makes yt-dlp exit early, which Youtarr reads as a failure'],
  ['--no-match-filters', 'this clears the filters Youtarr applies to channel downloads'],
  ['--restrict-filenames', 'this changes filenames Youtarr expects to control'],
  ['--windows-filenames', 'this changes filenames Youtarr expects to control'],
  ['--no-windows-filenames', 'this changes filenames Youtarr expects to control'],
  ['--trim-filenames', 'this changes filenames Youtarr expects to control'],
  ['--output-na-placeholder', 'this changes filenames Youtarr expects to control'],
  ['--autonumber-start', 'this changes filenames Youtarr expects to control'],
  ['--autonumber-size', 'this changes filenames Youtarr expects to control'],
  ['--write-info-json', 'Youtarr already manages the .info.json sidecar'],
  ['--no-write-info-json', 'Youtarr already manages the .info.json sidecar'],
  ['--clean-info-json', 'Youtarr already manages the .info.json sidecar'],
  ['--no-clean-info-json', 'Youtarr already manages the .info.json sidecar'],
  ['--embed-info-json', 'Youtarr already manages the .info.json sidecar'],
  ['--no-embed-info-json', 'Youtarr already manages the .info.json sidecar'],
  ['--write-playlist-metafiles', 'Youtarr already manages playlist metadata files'],
  ['--no-write-playlist-metafiles', 'Youtarr already manages playlist metadata files'],
  ['--write-thumbnail', 'Youtarr already manages thumbnails'],
  ['--write-all-thumbnails', 'Youtarr already manages thumbnails'],
  ['--no-write-thumbnail', 'Youtarr already manages thumbnails'],
  ['--convert-thumbnails', 'Youtarr already manages thumbnails'],
  ['--sponsorblock-mark', 'SponsorBlock has dedicated settings in Youtarr'],
  ['--sponsorblock-remove', 'SponsorBlock has dedicated settings in Youtarr'],
  ['--sponsorblock-chapter-title', 'SponsorBlock has dedicated settings in Youtarr'],
  ['--sponsorblock-api', 'SponsorBlock has dedicated settings in Youtarr'],
  ['--no-sponsorblock', 'SponsorBlock has dedicated settings in Youtarr'],
  ['--source-address', 'the IP family is a dedicated Youtarr setting'],
  ['--force-write-archive', 'Youtarr manages the download archive'],
  ['--rm-cache-dir', 'Youtarr manages the yt-dlp cache'],
]);

// Explicit block reasons for the security-, credential-, and managed-resource
// groups. Any known option not in ALLOW / WARN / BLOCK is blocked with a
// generic reason; any unrecognized token is blocked as unknown.
const BLOCK = new Map([
  ['--exec', 'can run programs or load code on the server'],
  ['--exec-before-download', 'can run programs or load code on the server'],
  ['--use-postprocessor', 'can run programs or load code on the server'],
  ['--netrc-cmd', 'can run programs or load code on the server'],
  ['--downloader', 'can run programs or load code on the server'],
  ['--ffmpeg-location', 'can run programs or load code on the server'],
  ['--plugin-dirs', 'can run programs or load code on the server'],
  ['--js-runtimes', 'can run programs or load code on the server'],
  ['--remote-components', 'can run programs or load code on the server'],
  ['--postprocessor-args', 'passes raw arguments to ffmpeg or another program, which can read or write files on the server'],
  ['--downloader-args', 'passes raw arguments to ffmpeg or another program, which can read or write files on the server'],
  ['--no-exec', 'this removes Youtarr\'s own post-processing step'],
  ['--parse-metadata', 'can rewrite the video details Youtarr names files and writes NFO files from'],
  ['--metadata-from-title', 'can rewrite the video details Youtarr names files and writes NFO files from'],
  ['--replace-in-metadata', 'can rewrite the video details Youtarr names files and writes NFO files from'],
  ['--alias', 'expands into other options that this check cannot see'],
  ['--preset-alias', 'expands into other options that this check cannot see'],
  ['--compat-options', 'changes yt-dlp defaults that Youtarr relies on'],
  ['--use-extractors', 'changes which site extractors yt-dlp uses; Youtarr relies on the YouTube extractor'],
  ['--force-generic-extractor', 'changes which site extractors yt-dlp uses; Youtarr relies on the YouTube extractor'],
  ['--config-locations', 'can read or write files on the server'],
  ['--load-info-json', 'can read or write files on the server'],
  ['--batch-file', 'can read or write files on the server'],
  ['--enable-file-urls', 'can read or write files on the server'],
  ['--print-to-file', 'can read or write files on the server'],
  ['--write-pages', 'can read or write files on the server'],
  ['--load-pages', 'can read or write files on the server'],
  ['--no-config-locations', 'Youtarr manages how yt-dlp is set up'],
  ['--ignore-config', 'Youtarr manages how yt-dlp is set up'],
  ['--no-batch-file', 'Youtarr manages how yt-dlp is set up'],
  ['--no-plugin-dirs', 'Youtarr manages how yt-dlp is set up'],
  ['--no-js-runtimes', 'Youtarr manages how yt-dlp is set up'],
  ['--no-remote-components', 'Youtarr manages how yt-dlp is set up'],
  ['--update', 'can replace the yt-dlp binary; update yt-dlp from Settings > YT-DLP instead'],
  ['--update-to', 'can replace the yt-dlp binary; update yt-dlp from Settings > YT-DLP instead'],
  ['--no-update', 'Youtarr manages yt-dlp updates'],
  ['--output', 'Youtarr controls where and how files are saved'],
  ['--paths', 'Youtarr controls where and how files are saved'],
  ['--id', 'Youtarr controls where and how files are saved'],
  ['--cookies', 'Youtarr manages cookies; upload a cookies file in Settings > Cookies instead'],
  ['--no-cookies', 'Youtarr manages cookies; upload a cookies file in Settings > Cookies instead'],
  ['--cookies-from-browser', 'Youtarr manages cookies; upload a cookies file in Settings > Cookies instead'],
  ['--no-cookies-from-browser', 'Youtarr manages cookies; upload a cookies file in Settings > Cookies instead'],
  ['--download-archive', 'Youtarr manages the download archive'],
  ['--no-download-archive', 'Youtarr manages the download archive'],
  ['--cache-dir', 'Youtarr manages the yt-dlp cache'],
  ['--no-cache-dir', 'Youtarr manages the yt-dlp cache'],
  ['--proxy', 'Youtarr manages this; use the matching setting instead'],
  ['--force-ipv4', 'Youtarr manages this; use the matching setting instead'],
  ['--force-ipv6', 'Youtarr manages this; use the matching setting instead'],
  ['--limit-rate', 'Youtarr manages this; use the matching setting instead'],
  ['--sleep-requests', 'Youtarr manages this; use the matching setting instead'],
  ['--username', 'credentials do not belong in custom arguments'],
  ['--password', 'credentials do not belong in custom arguments'],
  ['--video-password', 'credentials do not belong in custom arguments'],
  ['--twofactor', 'credentials do not belong in custom arguments'],
  ['--ap-mso', 'credentials do not belong in custom arguments'],
  ['--ap-username', 'credentials do not belong in custom arguments'],
  ['--ap-password', 'credentials do not belong in custom arguments'],
  ['--netrc', 'credentials do not belong in custom arguments'],
  ['--netrc-location', 'credentials do not belong in custom arguments'],
  ['--client-certificate', 'credentials do not belong in custom arguments'],
  ['--client-certificate-key', 'credentials do not belong in custom arguments'],
  ['--client-certificate-password', 'credentials do not belong in custom arguments'],
  ['--add-headers', 'headers can carry sign-in cookies or tokens, which would be saved and logged in plain text; use --user-agent or --referer, or upload a cookies file in Settings > Cookies'],
  ['--print-traffic', 'writes request headers, including cookies, to the logs'],
  ['--dump-pages', 'writes raw web pages, which can contain account details, to the logs'],
]);

const GENERIC_BLOCK_REASON =
  'this option is not allowed in custom arguments';
const UNKNOWN_REASON =
  'Youtarr does not recognize this yt-dlp option';

const byString = new Map();
const longSpellings = [];
for (const spec of OPTION_SPECS) {
  for (const s of spec.strings) {
    byString.set(s, spec);
    if (s.startsWith('--')) longSpellings.push(s);
  }
}

/**
 * Classify a canonical option name into its policy bucket.
 * @param {string} canonical
 * @returns {{ bucket: string, reason: string|null }}
 */
function getBucket(canonical) {
  if (ALLOW.has(canonical)) return { bucket: BUCKET.ALLOW, reason: null };
  if (WARN.has(canonical)) return { bucket: BUCKET.WARN, reason: WARN.get(canonical) };
  if (BLOCK.has(canonical)) return { bucket: BUCKET.BLOCK, reason: BLOCK.get(canonical) };
  return { bucket: BUCKET.BLOCK, reason: GENERIC_BLOCK_REASON };
}

/**
 * Resolve a long option name (without any =value) the way yt-dlp's optparse
 * does: exact match first, then a unique prefix. A prefix that matches several
 * spellings of the SAME option counts as one match.
 * @param {string} name e.g. "--embed-th"
 * @returns {{ spec: Object } | { ambiguous: string[] } | { unknown: true }}
 */
function resolveLongName(name) {
  const exact = byString.get(name);
  if (exact) return { spec: exact };
  const matches = longSpellings.filter((s) => s.startsWith(name));
  if (matches.length === 0) return { unknown: true };
  const specsMatched = new Set(matches.map((s) => byString.get(s)));
  if (specsMatched.size === 1) return { spec: [...specsMatched][0] };
  const canonicals = [...new Set([...specsMatched].map((s) => s.canonical))].sort();
  return { ambiguous: canonicals };
}

/**
 * Resolve a single short option spelling (e.g. "-N"). Short options are never
 * abbreviated, so this is an exact lookup.
 * @param {string} shortName e.g. "-N"
 * @returns {Object|null} spec or null
 */
function resolveShortName(shortName) {
  return byString.get(shortName) || null;
}

module.exports = {
  BUCKET,
  OPTION_SPECS,
  ALLOW,
  WARN,
  BLOCK,
  GENERIC_BLOCK_REASON,
  UNKNOWN_REASON,
  getBucket,
  resolveLongName,
  resolveShortName,
};
