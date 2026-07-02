// Control markers passed from the per-video yt-dlp --exec post-processor
// (a separate Node process) to the parent via the yt-dlp stdout stream.
// YtdlpOutputRouter watches for these lines; they are not yt-dlp output.
const VIDEO_PERSISTED_MARKER = '[Youtarr:videoPersisted] ';

module.exports = { VIDEO_PERSISTED_MARKER };
