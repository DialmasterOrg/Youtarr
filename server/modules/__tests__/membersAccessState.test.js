/* eslint-env jest */
const { isBlockedState, isVideoId, isCookiesRejected, STATE } = require('../membersAccessState');

describe('isBlockedState', () => {
  test.each([
    [STATE.NO_COOKIES, true],
    [STATE.DENIED, true],
    [STATE.UNCHECKED, false],
    [STATE.CONFIRMED, false],
    [undefined, false],
  ])('%s is blocked: %s', (state, blocked) => {
    expect(isBlockedState(state)).toBe(blocked);
  });
});

describe('isVideoId', () => {
  test('accepts an 11-character video id', () => {
    expect(isVideoId('bb-bbbbbb_b')).toBe(true);
  });

  test.each(['a(', 'a)|.*|(?:b', 'aaaaaaaaaaaa', '', null])('rejects %p', (value) => {
    expect(isVideoId(value)).toBe(false);
  });
});

describe('isCookiesRejected', () => {
  test('matches the rotated-cookies warning', () => {
    expect(isCookiesRejected('WARNING: [youtube] The provided YouTube account cookies are no longer valid.')).toBe(true);
  });

  test('ignores a plain members-only refusal', () => {
    expect(isCookiesRejected('ERROR: Join this channel to get access to members-only content')).toBe(false);
  });
});
