const titleFilterRegex = require('./titleFilterRegex');
const logger = require('../logger');

// A playlist's automatic download filters: min/max duration and a title
// pattern. They decide which tracked videos automatic downloads skip; they
// never remove a video from the playlist. Title patterns run through
// titleFilterRegex (Python re), so they match exactly as channel filters do.
// Durations are exact seconds, unlike a channel maximum (which covers its
// whole final minute): values saved through the API before the settings dialog
// existed keep their meaning, and the dialog saves "10 minutes" as 659.
class PlaylistFilters {
  /**
   * @param {{ min_duration: ?number, max_duration: ?number, title_filter_regex: ?string }} settings
   * @returns {boolean}
   */
  hasFilters(settings) {
    return settings.min_duration != null || settings.max_duration != null || Boolean(this._pattern(settings));
  }

  /**
   * The videos the filters skip.
   *
   * When the title pattern cannot be evaluated, every video is reported as
   * filtered and `error` says why: holding automatic downloads is safer than
   * downloading everything the filter was meant to keep out.
   *
   * @param {Object} settings - A playlist row, or the same filter fields
   * @param {Array<{ youtube_id: string, title: ?string, duration: ?number }>} rows
   * @returns {Promise<{ filteredIds: Set<string>, error: ?string }>}
   */
  async findFilteredIds(settings, rows) {
    const filteredIds = new Set();
    if (!this.hasFilters(settings)) return { filteredIds, error: null };

    const remaining = [];
    for (const row of rows) {
      if (this._durationPasses(settings, row.duration)) remaining.push(row);
      else filteredIds.add(row.youtube_id);
    }

    const pattern = this._pattern(settings);
    if (!pattern || !remaining.length) return { filteredIds, error: null };

    try {
      const matches = await titleFilterRegex.matchTitles(pattern, remaining.map((row) => row.title || ''));
      remaining.forEach((row, index) => {
        if (!matches[index]) filteredIds.add(row.youtube_id);
      });
      return { filteredIds, error: null };
    } catch (err) {
      logger.warn({ err, playlist_id: settings.playlist_id }, 'Playlist title filter could not be evaluated');
      return { filteredIds: new Set(rows.map((row) => row.youtube_id)), error: err.message };
    }
  }

  _pattern(settings) {
    return typeof settings.title_filter_regex === 'string' ? settings.title_filter_regex.trim() : '';
  }

  _durationPasses(settings, duration) {
    const { min_duration: min, max_duration: max } = settings;
    if (min == null && max == null) return true;
    // An unknown length cannot pass a duration limit, as in yt-dlp's match filter.
    if (typeof duration !== 'number') return false;
    if (min != null && duration < min) return false;
    if (max != null && duration > max) return false;
    return true;
  }
}

module.exports = new PlaylistFilters();
