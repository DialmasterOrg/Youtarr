const corpus = require('./fixtures/channelTitleCorpus.json');

const STATUSES = ['assigned', 'duplicate', 'unsupported', 'unmatched'];
const videos = corpus.channels.flatMap((channel) => channel.videos.map((video) => ({ channel, video })));

describe('channel title corpus fixture', () => {
  it('lists every video once', () => {
    const ids = videos.map(({ video }) => video.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only known statuses', () => {
    expect(videos.filter(({ video }) => !STATUSES.includes(video.expected.status))).toEqual([]);
  });

  it('refers only to shows defined for the same channel', () => {
    const unknown = videos.filter(({ channel, video }) => {
      const shows = channel.shows.map((show) => show.key);
      const target = video.expected.show || (video.expected.intended && video.expected.intended.show);
      return target !== undefined && !shows.includes(target);
    });
    expect(unknown).toEqual([]);
  });

  it('gives every assigned or duplicate video a season and an episode or episode source', () => {
    const incomplete = videos.filter(({ video: { expected } }) => ['assigned', 'duplicate'].includes(expected.status)
      && !(Number.isInteger(expected.season) && (Number.isInteger(expected.episode) || expected.episodeSource)));
    expect(incomplete).toEqual([]);
  });

  it('points each duplicate at an older upload in the same channel that holds the number', () => {
    const wrong = videos.filter(({ channel, video }) => {
      if (video.expected.status !== 'duplicate') {
        return false;
      }
      const winner = channel.videos.find((other) => other.id === video.expected.duplicateOf);
      return !winner
        || winner.listingIndex <= video.listingIndex
        || winner.expected.status !== 'assigned'
        || winner.expected.season !== video.expected.season
        || winner.expected.episode !== video.expected.episode;
    });
    expect(wrong).toEqual([]);
  });

  it('keeps each channel in listing order', () => {
    const outOfOrder = corpus.channels.filter((channel) => channel.videos
      .some((video, index) => index > 0 && channel.videos[index - 1].listingIndex >= video.listingIndex));
    expect(outOfOrder).toEqual([]);
  });
});
