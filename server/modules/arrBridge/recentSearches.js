// Records one search Sonarr or Radarr sent, for the Settings page: what was
// asked, which YouTube searches ran, and what became of every result.
// searchHistory stores the finished record. It is handed request fields,
// search results and release names, never the origin, a feed link or a key.
const MAX_TEXT_LENGTH = 200;

const OUTCOME = Object.freeze({
  OFFERED: 'offered',
  NOTHING: 'nothing',
  NOT_SEARCHED: 'not-searched',
  FAILED: 'failed',
});
// Why a request ran no search, or why its search failed. An "empty" request
// carries newznabRequest's EMPTY_REASON code instead.
const NOTE = Object.freeze({
  NO_QUERY: 'no-query',
  DAILY_NEEDS_API: 'daily-needs-api',
  NO_SEARCH_TEXT: 'no-search-text',
  NOT_SEARCHABLE: 'not-searchable',
  SEARCH_HELD_TOO_LONG: 'search-held-too-long',
  SEARCH_FAILED: 'search-failed',
});
// Why an episode request was not searched by the episode's title.
const TITLE_STAGE_SKIPPED = Object.freeze({
  NO_CONNECTION: 'no-connection',
  UNKNOWN_SERIES: 'unknown-series',
  NO_USABLE_TITLE: 'no-usable-title',
  NO_RUNTIME: 'no-runtime',
});
const CANDIDATE_OFFERED = 'offered';
const CANDIDATE_REJECTED = 'rejected';

const cut = (text) => (typeof text === 'string' ? text.slice(0, MAX_TEXT_LENGTH) : null);

function candidateRecord(result) {
  return {
    youtubeId: cut(result.youtubeId),
    title: cut(result.title),
    channelName: cut(result.channelName),
    duration: typeof result.duration === 'number' ? result.duration : null,
    outcome: CANDIDATE_REJECTED,
    reason: null,
    releaseTitle: null,
  };
}

function askedOf(request) {
  return {
    text: cut(request.text),
    textSource: request.textSource ?? null,
    season: request.season ?? null,
    episode: request.episode ?? null,
    year: request.year ?? null,
    month: request.month ?? null,
    day: request.day ?? null,
    limit: request.limit ?? null,
  };
}

/**
 * @param {Object} [options]
 * @param {Function} [options.save] - (entry) => void; gets each finished record. It must not throw.
 * @returns {{ start: Function }}
 */
function createRecentSearches({ save = () => {} } = {}) {
  /**
   * Starts the record of one request. Nothing is handed on until answered()
   * or failed() is called; only the first of those counts.
   * @param {Object} request - From parseNewznabRequest
   * @param {Date} at - When the request arrived
   * @returns {{ stage: Function, skipTitleStage: Function, notSearched: Function,
   *   answered: Function, failed: Function }}
   */
  function start(request, at) {
    const stages = [];
    let note = null;
    let titleStageSkipped = null;
    let finished = false;

    function finish(outcome, offered) {
      if (finished) return;
      finished = true;
      save({
        at,
        kind: request.kind ?? null,
        shape: request.shape,
        asked: askedOf(request),
        outcome,
        offered,
        note,
        titleStageSkipped,
        stages,
      });
    }

    return {
      /**
       * One YouTube search and its results. Every result counts as left out
       * until offer() says otherwise.
       * @param {{matcher: string, query: string}} plan
       * @param {Array<Object>} results - The search results, as the filters will see them
       * @returns {{ reject: Function, offer: Function }} Both take a result object of `results`
       */
      stage({ matcher, query }, results) {
        const records = new Map(results.map((result) => [result, candidateRecord(result)]));
        stages.push({ matcher, query: cut(query), results: results.length, candidates: [...records.values()] });
        return {
          reject(candidate, reason) {
            const record = records.get(candidate);
            if (record) record.reason = reason;
          },
          offer(candidate, releaseTitle) {
            const record = records.get(candidate);
            if (!record) return;
            record.outcome = CANDIDATE_OFFERED;
            record.reason = null;
            record.releaseTitle = cut(releaseTitle);
          },
        };
      },
      skipTitleStage(reason) {
        titleStageSkipped = reason;
      },
      notSearched(reason) {
        note = reason;
      },
      answered(offered) {
        if (offered > 0) return finish(OUTCOME.OFFERED, offered);
        return finish(stages.length > 0 ? OUTCOME.NOTHING : OUTCOME.NOT_SEARCHED, 0);
      },
      failed(reason) {
        note = reason;
        finish(OUTCOME.FAILED, 0);
      },
    };
  }

  return { start };
}

module.exports = { createRecentSearches, OUTCOME, NOTE, TITLE_STAGE_SKIPPED };
