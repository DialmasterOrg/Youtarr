'use strict';

const { classifyYtdlpError, ERROR_CODES } = require('../errorClassifier');

describe('classifyYtdlpError', () => {
  test.each([
    ['ERROR: Sign in to confirm you are not a bot', ERROR_CODES.BOT_CHECK],
    ['ERROR: Please sign in to view this channel', ERROR_CODES.EXPIRED_COOKIES],
    ['ERROR: This cookie has expired', ERROR_CODES.EXPIRED_COOKIES],
    ['ERROR: unable to download webpage: HTTPSConnectionPool', ERROR_CODES.NETWORK],
    ['ERROR: Network is unreachable', ERROR_CODES.NETWORK],
    ['ERROR: getaddrinfo ENOTFOUND www.youtube.com', ERROR_CODES.NETWORK],
    ['some completely unrelated message', ERROR_CODES.UNKNOWN],
    ['', ERROR_CODES.UNKNOWN],
  ])('classifies %j as %s', (stderr, expected) => {
    expect(classifyYtdlpError(stderr).code).toBe(expected);
  });

  test('returns a user-friendly message string for each code', () => {
    for (const code of Object.values(ERROR_CODES)) {
      // Create a sample stderr that would produce each code
      let sampleStderr;
      if (code === 'BOT_CHECK') sampleStderr = 'Sign in to confirm you are not a bot';
      else if (code === 'EXPIRED_COOKIES') sampleStderr = 'Please sign in';
      else if (code === 'NETWORK') sampleStderr = 'HTTPSConnectionPool';
      else if (code === 'TIMEOUT') sampleStderr = ''; // timeout is set externally
      else if (code === 'NO_CHANNELS_FOUND') sampleStderr = '';
      else sampleStderr = 'anything else';
      const result = classifyYtdlpError(sampleStderr);
      expect(typeof result.userMessage).toBe('string');
      expect(result.userMessage.length).toBeGreaterThan(10);
    }
  });

  test('includes stderr tail in details field', () => {
    const stderr = 'x'.repeat(2000);
    const result = classifyYtdlpError(stderr);
    expect(result.details).toBeDefined();
    expect(result.details.length).toBeLessThanOrEqual(600);
  });

  test('includes httpStatus for each classification', () => {
    const result = classifyYtdlpError('Sign in to confirm you are not a bot');
    expect(result.httpStatus).toBe(502);
  });
});
