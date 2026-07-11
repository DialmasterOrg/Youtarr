const configModule = require('../configModule');
const { resolveEffectiveSubfolder, ROOT_SENTINEL } = require('../filesystem');

const DEFAULT_RESOLUTION = '1080';

/**
 * Single home for download-settings precedence: override > channel > playlist > global.
 *
 * Two timing classes:
 * - Command settings (resolution, audioFormat, skipVideoFolder) are built into the
 *   yt-dlp invocation pre-download and drive grouping. Resolved here from whatever
 *   channel info is available pre-download. skipVideoFolder resolves override > channel
 *   (explicit true/false) > global defaultSkipVideoFolder.
 * - Routing settings (subfolder, rating) are applied per-video at finalize time by the
 *   post-processor, which reads the true channel from .info.json. The grouper only
 *   forwards the dialog override (hard) and the playlist default (soft); channel and
 *   global tiers are resolved at finalize via resolveFinalSubfolder / the rating mapper.
 */
class DownloadSettingsResolver {
  resolveCommandSettings({ override = {}, channel = null, playlist = {}, config = null } = {}) {
    const cfg = config || configModule.config || {};
    const ov = override || {};
    const pl = playlist || {};

    const resolution =
      ov.resolution ||
      (channel && channel.video_quality) ||
      pl.video_quality ||
      cfg.preferredResolution ||
      DEFAULT_RESOLUTION;

    // Stricter undefined/null check is intentional: an explicit audioFormat of ''
    // is treated as a deliberate choice, unlike resolution which uses `||`.
    const audioFormat =
      ov.audioFormat !== undefined && ov.audioFormat !== null
        ? ov.audioFormat
        : (channel && channel.audio_format) || pl.audio_format || null;

    const skipVideoFolder = this.resolveSkipVideoFolder({ override: ov, channel, config: cfg });

    return { resolution, audioFormat, skipVideoFolder };
  }

  /**
   * Flat-structure precedence: override > channel explicit true/false > global default.
   * channel.skip_video_folder is tri-state: true = flat, false = explicitly per-video
   * subfolders, null/undefined = inherit the global defaultSkipVideoFolder setting.
   */
  resolveSkipVideoFolder({ override = {}, channel = null, config = null } = {}) {
    const cfg = config || configModule.config || {};
    const ov = override || {};
    if (ov.skipVideoFolder !== undefined) {
      return !!ov.skipVideoFolder;
    }
    if (channel && channel.skip_video_folder !== null && channel.skip_video_folder !== undefined) {
      return !!channel.skip_video_folder;
    }
    return !!cfg.defaultSkipVideoFolder;
  }

  buildRoutingDirectives({ override = {}, playlist = {} } = {}) {
    const ov = override || {};
    const pl = playlist || {};
    const directives = {};
    if (ov.subfolder !== undefined && ov.subfolder !== null) {
      directives.subfolderOverride = ov.subfolder;
    }
    // When a playlist is in context, always express its subfolder choice so it
    // survives the env round-trip to the finalizer. An explicit null/'' (root)
    // is forwarded as ROOT_SENTINEL; a bare {} (no playlist) emits nothing and
    // lets the finalizer fall through to channel -> global.
    if (pl.default_sub_folder !== undefined) {
      directives.subfolderFallback = pl.default_sub_folder || ROOT_SENTINEL;
    }
    if (ov.rating !== undefined && ov.rating !== null) {
      directives.ratingOverride = ov.rating;
    }
    if (pl.default_rating) {
      directives.ratingFallback = pl.default_rating;
    }
    return directives;
  }

  /**
   * Finalize-time subfolder precedence: hard override > tracked channel > soft fallback > global.
   * A tracked channel always has a setting: a null sub_folder means the channel's
   * explicit "download to root", which wins over the playlist soft fallback. The soft
   * fallback only applies when the video's real channel is untracked (channelRecord null).
   *
   * Param contract: `globalDefault` must already be a resolved value, not a sentinel.
   * `hardOverride` is expected to be null/absent (not an empty string) when there is no
   * override; callers coerce e.g. `process.env.YOUTARR_SUBFOLDER_OVERRIDE || null`.
   */
  resolveFinalSubfolder({ hardOverride = null, channelRecord = null, softFallback = null, globalDefault = null } = {}) {
    if (hardOverride) {
      return resolveEffectiveSubfolder(hardOverride, globalDefault);
    }
    if (channelRecord) {
      return resolveEffectiveSubfolder(channelRecord.sub_folder, globalDefault);
    }
    if (softFallback) {
      return resolveEffectiveSubfolder(softFallback, globalDefault);
    }
    return globalDefault || null;
  }
}

module.exports = new DownloadSettingsResolver();
