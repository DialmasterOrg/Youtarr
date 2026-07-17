module.exports = {
  serverRegistry: require('./serverRegistry'),
  mediaServerSync: require('./mediaServerSync'),
  watchStatusSync: require('./watchStatusSync'),
  watchStatusScheduler: require('./watchStatusScheduler'),
  adapters: {
    BaseAdapter: require('./adapters/baseAdapter'),
    PlexAdapter: require('./adapters/plexAdapter'),
    JellyfinAdapter: require('./adapters/jellyfinAdapter'),
    EmbyAdapter: require('./adapters/embyAdapter'),
  },
};
