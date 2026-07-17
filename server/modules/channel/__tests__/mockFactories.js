/* eslint-env jest */

// Shared mock factories for channel/ sub-module tests. Each factory returns
// a FRESH mock so jest.mock factories can call these after every
// jest.resetModules(). Require this file ONCE at the top of the test file
// into a `mock`-prefixed const; never re-require it inside a jest.mock
// factory.
//
// Not a test suite: jest's testMatch only collects *.test.js files, so this
// helper can live under __tests__ without being run.

function mockChannelModel() {
  const { Model } = require('sequelize');
  class MockChannel extends Model {}
  MockChannel.findOne = jest.fn();
  MockChannel.findOrCreate = jest.fn();
  MockChannel.create = jest.fn();
  MockChannel.findAll = jest.fn();
  MockChannel.update = jest.fn();
  MockChannel.init = jest.fn(() => MockChannel);
  return MockChannel;
}

function mockChannelVideoModel() {
  const { Model } = require('sequelize');
  class MockChannelVideo extends Model {}
  MockChannelVideo.findAll = jest.fn();
  MockChannelVideo.findOrCreate = jest.fn();
  MockChannelVideo.count = jest.fn();
  MockChannelVideo.findOne = jest.fn();
  MockChannelVideo.update = jest.fn();
  MockChannelVideo.init = jest.fn(() => MockChannelVideo);
  return MockChannelVideo;
}

function mockVideoModel() {
  const { Model } = require('sequelize');
  class MockVideo extends Model {}
  MockVideo.findAll = jest.fn();
  MockVideo.init = jest.fn(() => MockVideo);
  return MockVideo;
}

function mockConfigModule() {
  const EventEmitter = require('events');
  const mockConfig = new EventEmitter();
  mockConfig.getConfig = jest.fn().mockReturnValue({
    channelDownloadFrequency: '0 */6 * * *',
    channelAutoDownload: true,
    channelFilesToDownload: 3,
    preferredResolution: '1080',
    writeChannelPosters: true
  });
  mockConfig.onConfigChange = jest.fn();
  mockConfig.ffmpegPath = '/usr/bin/ffmpeg';
  mockConfig.getImagePath = jest.fn().mockReturnValue('/path/to/images');
  mockConfig.directoryPath = '/path/to/videos';
  mockConfig.getCookiesPath = jest.fn().mockReturnValue(null);
  return mockConfig;
}

function mockYoutubeApi() {
  return {
    isAvailable: jest.fn(() => false),
    getApiKey: jest.fn(() => null),
    client: {
      getChannelInfo: jest.fn(),
      detectAvailableTabs: jest.fn(),
    },
    YoutubeApiErrorCode: { QUOTA_EXCEEDED: 'QUOTA_EXCEEDED' },
  };
}

function mockDb() {
  const mockSequelize = {
    query: jest.fn().mockResolvedValue([]),
    define: jest.fn(() => {
      return class MockModel {
        static init() { return this; }
      };
    }),
    models: {},
    authenticate: jest.fn().mockResolvedValue(),
  };
  return {
    sequelize: mockSequelize,
    Sequelize: require('sequelize').Sequelize
  };
}

function mockFilesystem() {
  return {
    sanitizeNameLikeYtDlp: jest.fn((name) => name),
    GLOBAL_DEFAULT_SENTINEL: '##USE_GLOBAL_DEFAULT##',
    copySyncWithFallback: jest.fn(),
  };
}

function mockFileCheckModule() {
  return {
    checkVideoFiles: jest.fn(),
    applyVideoUpdates: jest.fn(),
  };
}

module.exports = {
  mockChannelModel,
  mockChannelVideoModel,
  mockVideoModel,
  mockConfigModule,
  mockYoutubeApi,
  mockDb,
  mockFilesystem,
  mockFileCheckModule,
};
