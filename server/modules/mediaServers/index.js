module.exports = {
  serverRegistry: require('./serverRegistry'),
  mediaServerSync: require('./mediaServerSync'),
  adapters: {
    BaseAdapter: require('./adapters/baseAdapter'),
    PlexAdapter: require('./adapters/plexAdapter'),
    JellyfinAdapter: require('./adapters/jellyfinAdapter'),
    EmbyAdapter: require('./adapters/embyAdapter'),
  },
};
