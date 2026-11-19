// Classifies the real-title corpus with its draft shows through the real
// pattern compiler, Python matcher and numbering, and compares every video
// with the classification the corpus expects.
const corpus = require('./fixtures/channelTitleCorpus.json');
const { compilePattern } = require('../patternCompiler');
const { matchVideos } = require('../titleMatcher');
const { planNumbers } = require('../titleNumbering');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 2);

function toShows(channel) {
  return channel.shows.map((show) => ({
    key: show.key,
    excludeTerms: show.excludeTerms,
    patterns: show.patterns.map((entry, index) => ({
      key: `${show.key}#${index}`,
      compiledRegex: compilePattern({ text: entry.pattern, kind: 'simple' }).compiledRegex,
      seasonSource: entry.season,
      seasonFixed: entry.seasonFixed === undefined ? null : entry.seasonFixed,
      episodeSource: entry.episode,
    })),
  }));
}

// listingIndex 0 is the newest upload: the only order a flat listing gives.
function toVideos(channel) {
  return channel.videos.map((video) => ({
    youtubeId: video.id,
    title: video.title,
    publishedAtMs: NOW - video.listingIndex * DAY,
    available: true,
    downloaded: false,
  }));
}

async function classify(channel) {
  const matches = await matchVideos(toShows(channel), toVideos(channel));
  return planNumbers({ videos: toVideos(channel), matches, stored: new Map(), highWater: new Map() });
}

function outcome(video, result) {
  const row = result.rows.get(video.id);
  if (!row) return { status: 'unmatched' };
  const base = { status: row.status, show: row.showKey };
  if (row.status === 'duplicate') {
    const duplicate = result.duplicates.find((entry) => entry.youtubeId === video.id);
    return { ...base, season: duplicate.season, episode: duplicate.episode, duplicateOf: duplicate.duplicateOf };
  }
  if (row.status === 'unsupported') {
    const entry = result.unsupported.find((item) => item.youtubeId === video.id);
    return { ...base, reason: entry.reason };
  }
  return { ...base, season: row.season, episode: row.episode, episodeTitle: row.episodeTitle, source: row.source };
}

function expectedOutcome(expected) {
  if (expected.status === 'unmatched') return { status: 'unmatched' };
  const base = { status: expected.status, show: expected.show };
  if (expected.status === 'duplicate') {
    return { ...base, season: expected.season, episode: expected.episode, duplicateOf: expected.duplicateOf };
  }
  if (expected.status === 'unsupported') return { ...base, reason: expected.reason };
  return {
    ...base,
    season: expected.season,
    episode: expected.episodeSource ? expect.any(Number) : expected.episode,
    episodeTitle: expected.episodeTitle,
    source: expected.episodeSource || 'title',
  };
}

describe.each(corpus.channels.map((channel) => [channel.name, channel]))('title corpus: %s', (name, channel) => {
  let result;

  beforeAll(async () => {
    result = await classify(channel);
  });

  it.each(channel.videos.map((video) => [video.id, video.title, video]))('%s %s', (id, title, video) => {
    expect(outcome(video, result)).toEqual(expectedOutcome(video.expected));
  });
});
