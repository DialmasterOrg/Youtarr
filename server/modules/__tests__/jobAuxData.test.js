/* eslint-env jest */

jest.mock('../../logger');

const { serializeAuxData, parseAuxData, MAX_PERSISTED_FAILED_VIDEOS } = require('../jobAuxData');

describe('jobAuxData', () => {
  describe('serializeAuxData', () => {
    test('serializes data minus the videos array', () => {
      const data = {
        videos: [{ youtubeId: 'a' }],
        failedVideos: [{ youtubeId: 'b', error: 'HTTP Error 403: Forbidden' }],
        diagnoses: [{ key: 'http-403-no-cookies' }],
        cumulativeSkipped: 3
      };

      const parsed = JSON.parse(serializeAuxData(data));

      expect(parsed.videos).toBeUndefined();
      expect(parsed.failedVideos).toHaveLength(1);
      expect(parsed.diagnoses).toHaveLength(1);
      expect(parsed.cumulativeSkipped).toBe(3);
    });

    test('returns null when data is missing or holds only videos', () => {
      expect(serializeAuxData(undefined)).toBeNull();
      expect(serializeAuxData(null)).toBeNull();
      expect(serializeAuxData({ videos: [{ youtubeId: 'a' }] })).toBeNull();
    });

    test('caps persisted failedVideos at the limit, keeping the newest', () => {
      const failedVideos = Array.from({ length: MAX_PERSISTED_FAILED_VIDEOS + 50 }, (_, i) => ({
        youtubeId: `vid${i}`, error: 'err'
      }));

      const parsed = JSON.parse(serializeAuxData({ failedVideos }));

      expect(parsed.failedVideos).toHaveLength(MAX_PERSISTED_FAILED_VIDEOS);
      expect(parsed.failedVideos[0].youtubeId).toBe('vid50');
      expect(parsed.failedVideos[MAX_PERSISTED_FAILED_VIDEOS - 1].youtubeId).toBe(
        `vid${MAX_PERSISTED_FAILED_VIDEOS + 49}`
      );
    });

    test('returns null instead of throwing on unserializable data', () => {
      const circular = {};
      circular.self = circular;

      expect(serializeAuxData({ failedVideos: [], loop: circular })).toBeNull();
    });
  });

  describe('parseAuxData', () => {
    test('parses a serialized round trip', () => {
      const raw = serializeAuxData({ failedVideos: [{ youtubeId: 'b', error: 'err' }] });

      expect(parseAuxData(raw).failedVideos).toEqual([{ youtubeId: 'b', error: 'err' }]);
    });

    test('returns empty object for null, invalid JSON, and non-objects', () => {
      expect(parseAuxData(null)).toEqual({});
      expect(parseAuxData(undefined)).toEqual({});
      expect(parseAuxData('not json{')).toEqual({});
      expect(parseAuxData('"a string"')).toEqual({});
      expect(parseAuxData('42')).toEqual({});
    });
  });
});
