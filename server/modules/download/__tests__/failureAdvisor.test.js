/* eslint-env jest */

const { adviseFailures, mergeDiagnoses } = require('../failureAdvisor');

const failedVideo = (overrides = {}) => ({
  youtubeId: 'abc123def45',
  title: 'Some Video',
  channel: 'Some Channel',
  error: 'unable to download video data: HTTP Error 403: Forbidden',
  url: null,
  ...overrides,
});

const context = (overrides = {}) => ({
  cookiesEnabled: false,
  httpForbiddenDetected: false,
  botDetected: false,
  ...overrides,
});

describe('failureAdvisor', () => {
  describe('http-403 advice', () => {
    it('diagnoses a 403 failure with cookies enabled as a cookie problem', () => {
      const videos = [failedVideo()];
      const diagnoses = adviseFailures(videos, context({ cookiesEnabled: true }));

      expect(videos[0].diagnosisKey).toBe('http-403-cookies-enabled');
      expect(diagnoses).toHaveLength(1);
      expect(diagnoses[0].key).toBe('http-403-cookies-enabled');
      expect(diagnoses[0].count).toBe(1);
      expect(diagnoses[0].message).toMatch(/re-export fresh cookies/i);
      expect(diagnoses[0].message).toMatch(/disable cookies/i);
    });

    it('diagnoses a 403 failure without cookies as possibly fixable by cookies', () => {
      const videos = [failedVideo()];
      const diagnoses = adviseFailures(videos, context({ cookiesEnabled: false }));

      expect(videos[0].diagnosisKey).toBe('http-403-cookies-disabled');
      expect(diagnoses[0].message).toMatch(/uploading YouTube cookies/i);
    });

    it('matches fragment-shaped failures only when the run-level 403 flag is set', () => {
      const fragmentVideo = () => failedVideo({ error: 'fragment 3 not found, unable to continue' });

      const flagged = [fragmentVideo()];
      adviseFailures(flagged, context({ httpForbiddenDetected: true }));
      expect(flagged[0].diagnosisKey).toBe('http-403-cookies-disabled');

      const unflagged = [fragmentVideo()];
      const diagnoses = adviseFailures(unflagged, context({ httpForbiddenDetected: false }));
      expect(unflagged[0].diagnosisKey).toBeUndefined();
      expect(diagnoses).toEqual([]);
    });
  });

  describe('bot-check advice', () => {
    it('diagnoses the bot-check error with cookies enabled as stale cookies', () => {
      const videos = [failedVideo({ error: 'Sign in to confirm you\'re not a bot. Use --cookies for authentication' })];
      const diagnoses = adviseFailures(videos, context({ cookiesEnabled: true }));

      expect(videos[0].diagnosisKey).toBe('bot-check-cookies-enabled');
      expect(diagnoses[0].message).toMatch(/expired or rotated/i);
    });

    it('diagnoses the bot-check error without cookies as needing cookies', () => {
      const videos = [failedVideo({ error: 'Sign in to confirm you\'re not a bot' })];
      const diagnoses = adviseFailures(videos, context({ cookiesEnabled: false }));

      expect(videos[0].diagnosisKey).toBe('bot-check-cookies-disabled');
      expect(diagnoses[0].message).toMatch(/upload youtube cookies/i);
    });

    it('applies bot-check advice to download failures when bot detection fired run-wide', () => {
      const videos = [failedVideo({ error: 'Unable to extract video data' })];
      adviseFailures(videos, context({ botDetected: true }));

      expect(videos[0].diagnosisKey).toBe('bot-check-cookies-disabled');
    });

    it('leaves unrelated failures undecorated even when bot detection fired run-wide', () => {
      const videos = [failedVideo({ error: 'Postprocessing failed with exit code 1' })];
      const diagnoses = adviseFailures(videos, context({ botDetected: true }));

      expect(videos[0].diagnosisKey).toBeUndefined();
      expect(diagnoses).toEqual([]);
    });

    it('prefers bot-check over http-403 when both match', () => {
      const videos = [failedVideo({ error: 'HTTP Error 403: Forbidden. Sign in to confirm you\'re not a bot' })];
      adviseFailures(videos, context({ cookiesEnabled: true }));

      expect(videos[0].diagnosisKey).toBe('bot-check-cookies-enabled');
    });
  });

  describe('aggregation', () => {
    it('dedupes repeated diagnoses into one entry with a count', () => {
      const videos = [failedVideo(), failedVideo({ youtubeId: 'second00000' }), failedVideo({ youtubeId: 'third000000' })];
      const diagnoses = adviseFailures(videos, context({ cookiesEnabled: true }));

      expect(diagnoses).toHaveLength(1);
      expect(diagnoses[0].count).toBe(3);
    });

    it('reports each distinct diagnosis separately', () => {
      const videos = [
        failedVideo(),
        failedVideo({ youtubeId: 'second00000', error: 'Sign in to confirm you\'re not a bot' }),
      ];
      const diagnoses = adviseFailures(videos, context());

      expect(diagnoses.map((d) => d.key).sort()).toEqual([
        'bot-check-cookies-disabled',
        'http-403-cookies-disabled',
      ]);
    });
  });

  describe('mergeDiagnoses', () => {
    const diagnosis = (overrides = {}) => ({
      key: 'http-403-cookies-enabled',
      title: 'YouTube blocked the download while using your cookies',
      message: 'advice text',
      count: 1,
      ...overrides,
    });

    it('sums counts for the same key and keeps distinct keys separate', () => {
      const merged = mergeDiagnoses(
        [diagnosis({ count: 2 })],
        [diagnosis({ count: 3 }), diagnosis({ key: 'bot-check-cookies-disabled', count: 1 })]
      );

      expect(merged).toHaveLength(2);
      expect(merged.find((d) => d.key === 'http-403-cookies-enabled').count).toBe(5);
      expect(merged.find((d) => d.key === 'bot-check-cookies-disabled').count).toBe(1);
    });

    it('preserves title and message from the first occurrence', () => {
      const merged = mergeDiagnoses([diagnosis()], [diagnosis({ title: 'other', message: 'other' })]);

      expect(merged[0].title).toBe('YouTube blocked the download while using your cookies');
      expect(merged[0].message).toBe('advice text');
    });

    it('tolerates missing or non-array inputs', () => {
      expect(mergeDiagnoses(null, [diagnosis()])).toHaveLength(1);
      expect(mergeDiagnoses([diagnosis()], undefined)).toHaveLength(1);
      expect(mergeDiagnoses(null, null)).toEqual([]);
      expect(mergeDiagnoses([null], [diagnosis()])).toHaveLength(1);
    });
  });

  describe('defensive behavior', () => {
    it('leaves unrecognized failures undecorated', () => {
      const videos = [failedVideo({ error: 'Video unavailable. This video is private' })];
      const diagnoses = adviseFailures(videos, context());

      expect(videos[0].diagnosisKey).toBeUndefined();
      expect(diagnoses).toEqual([]);
    });

    it('returns an empty list for empty or non-array input', () => {
      expect(adviseFailures([], context())).toEqual([]);
      expect(adviseFailures(null, context())).toEqual([]);
      expect(adviseFailures(undefined, context())).toEqual([]);
    });

    it('tolerates null entries and videos without an error string', () => {
      const videos = [null, failedVideo({ error: undefined }), failedVideo()];
      const diagnoses = adviseFailures(videos, context({ cookiesEnabled: true }));

      expect(diagnoses).toHaveLength(1);
      expect(diagnoses[0].count).toBe(1);
    });

    it('defaults to a safe context when none is provided', () => {
      const videos = [failedVideo()];
      const diagnoses = adviseFailures(videos);

      expect(videos[0].diagnosisKey).toBe('http-403-cookies-disabled');
      expect(diagnoses).toHaveLength(1);
    });
  });
});
