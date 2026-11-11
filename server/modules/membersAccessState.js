// Members-only access states and the pure checks on them. Kept apart from
// membersAccess, which loads models at require time, so test mocks of
// membersAccess can share the real implementations.

const ACCESS = Object.freeze({
  CONFIRMED: 'confirmed',
  DENIED: 'denied',
});

// What the client is told about a members-only video.
const STATE = Object.freeze({
  NO_COOKIES: 'no_cookies',
  UNCHECKED: 'unchecked',
  CONFIRMED: 'confirmed',
  DENIED: 'denied',
});

// Ids reach membersAccess from yt-dlp output, where an uploader controls the
// title text, and go into a yt-dlp regex; anything else is dropped.
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// yt-dlp prints this when YouTube rejected the cookies. YouTube then answers a
// members-only video with the same "Join this channel" error a non-member gets,
// so that error says nothing about the account's membership.
const COOKIES_REJECTED_PATTERNS = [
  /cookies are no longer valid/i,
  /cookies.*rotated/i,
];

function isCookiesRejected(output = '') {
  const text = String(output);
  return COOKIES_REJECTED_PATTERNS.some((pattern) => pattern.test(text));
}

function isBlockedState(state) {
  return state === STATE.NO_COOKIES || state === STATE.DENIED;
}

function isVideoId(id) {
  return typeof id === 'string' && VIDEO_ID_PATTERN.test(id);
}

module.exports = { ACCESS, STATE, isCookiesRejected, isBlockedState, isVideoId };
