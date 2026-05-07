// Bundled at build time so the live preview has zero-network mock data.
// Source of truth: client/src/utils/filenameTemplate/sample-video.info.json
// Sanitized from `yt-dlp --skip-download --write-info-json -o ...` output.
//
// We override `ext` to 'mp4' because Youtarr always remuxes to MP4 on output
// (see ytdlpCommandBuilder's --merge-output-format mp4), regardless of what
// the source format's ext is in the captured fixture.
import sampleData from './sample-video.info.json';

export const SAMPLE_VIDEO_METADATA: Record<string, unknown> = {
  ...(sampleData as Record<string, unknown>),
  ext: 'mp4',
};
