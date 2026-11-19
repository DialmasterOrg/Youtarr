const configModule = require('../configModule');
const { resolveEffectiveSubfolder, ROOT_SENTINEL } = require('../filesystem');
const { LAYOUT_TV, isMp3Format } = require('../tvShows/constants');

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

  /**
   * Pre-download estimate of the finalize-time subfolder, for decisions that
   * depend on the destination's layout: resolveFinalSubfolder's precedence, fed
   * the channel the grouper could attribute (null when untracked) and the
   * routing directives it forwards. The finalizer may still know better once
   * the .info.json names the real channel.
   *
   * @returns {string|null} Subfolder name, or null for the main folder
   */
  predictFinalSubfolder({ override = {}, channel = null, playlist = {}, globalDefault = null } = {}) {
    const directives = this.buildRoutingDirectives({ override, playlist });
    return this.resolveFinalSubfolder({
      hardOverride: directives.subfolderOverride || null,
      channelRecord: channel,
      softFallback: directives.subfolderFallback || null,
      globalDefault,
    });
  }

  /**
   * TV folders are video-only. Saved settings that would send MP3 there are
   * refused at save time; a download-time MP3 type (dialog override, playlist
   * default) whose destination has the TV layout is downgraded to video-only.
   *
   * @param {Object} params
   * @param {string|null} params.audioFormat - Resolved download type (null = video-only)
   * @param {string|null} params.subfolder - Destination subfolder, null for the main folder
   * @param {(libraryFolder: string) => string} params.layoutOf - Layout of a library folder ('' = main)
   * @returns {string|null}
   */
  coerceAudioFormatForLayout({ audioFormat, subfolder, layoutOf }) {
    if (!isMp3Format(audioFormat)) return audioFormat;
    return layoutOf(subfolder || '') === LAYOUT_TV ? null : audioFormat;
  }
}

module.exports = new DownloadSettingsResolver();
