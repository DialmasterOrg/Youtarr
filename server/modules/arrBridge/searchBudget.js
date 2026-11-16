// Counts the YouTube Data API quota units the bridge's searches spend in a
// Pacific day (Google resets quotas at midnight Pacific). In memory only: a
// restart starts the count again, by design.
const ARR_BRIDGE_DAILY_API_UNITS = 5000;
const QUOTA_TIME_ZONE = 'America/Los_Angeles';

const pacificDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: QUOTA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * @param {Object} [options]
 * @param {number} [options.dailyUnits]
 * @param {Function} [options.now] - () => Date
 * @param {Object} [options.logger]
 * @returns {{ allowsApi: () => boolean, spend: (units: number) => void }}
 */
function createSearchBudget({ dailyUnits = ARR_BRIDGE_DAILY_API_UNITS, now = () => new Date(), logger } = {}) {
  let day = null;
  let spentUnits = 0;
  let reported = false;

  function rollDay() {
    const today = pacificDate.format(now());
    if (today === day) return;
    day = today;
    spentUnits = 0;
    reported = false;
  }

  // A soft cap: the search that crosses the line still runs on the API.
  function allowsApi() {
    rollDay();
    return spentUnits < dailyUnits;
  }

  function spend(units) {
    if (typeof units !== 'number' || !Number.isFinite(units) || units <= 0) return;
    rollDay();
    spentUnits += units;
    if (spentUnits >= dailyUnits && !reported) {
      reported = true;
      logger?.info(
        { spentUnits, dailyUnits },
        'Sonarr/Radarr searches used their share of today\'s YouTube API quota; using yt-dlp until it resets'
      );
    }
  }

  return { allowsApi, spend };
}

module.exports = { createSearchBudget, ARR_BRIDGE_DAILY_API_UNITS };
