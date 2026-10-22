/* eslint-env jest */
const {
  OPTION_SPECS,
  ALLOW,
  WARN,
  BLOCK,
  BUCKET,
  GENERIC_BLOCK_REASON,
  getBucket,
} = require('../ytdlpOptionTable');

const canonicals = new Set(OPTION_SPECS.map((spec) => spec.canonical));
const policyKeys = [...ALLOW, ...WARN.keys(), ...BLOCK.keys()];

describe('ytdlpOptionTable', () => {
  test('every ALLOW / WARN / BLOCK key is a canonical yt-dlp option name', () => {
    expect(policyKeys.filter((key) => !canonicals.has(key))).toEqual([]);
  });

  test('no option is classified in more than one bucket', () => {
    expect(policyKeys.filter((key, i) => policyKeys.indexOf(key) !== i)).toEqual([]);
  });

  test('no spelling belongs to more than one option', () => {
    const spellings = OPTION_SPECS.flatMap((spec) => spec.strings);
    expect(spellings.filter((s, i) => spellings.indexOf(s) !== i)).toEqual([]);
  });

  test('a known option that is not classified is blocked with the generic reason', () => {
    expect(canonicals.has('--sponskrub')).toBe(true);
    expect(getBucket('--sponskrub')).toEqual({ bucket: BUCKET.BLOCK, reason: GENERIC_BLOCK_REASON });
  });
});
