const { classifyYoutubeApiError, YoutubeApiErrorCode } = require('../errorClassifier');

describe('classifyYoutubeApiError', () => {
  test('classifies 400 API_KEY_INVALID', () => {
    const err = {
      response: {
        status: 400,
        data: { error: { errors: [{ reason: 'keyInvalid' }] } },
      },
    };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.KEY_INVALID);
  });

  test('classifies 400 badRequest as KEY_INVALID when API_KEY_INVALID is in message', () => {
    const err = {
      response: {
        status: 400,
        data: { error: { message: 'API key not valid. Please pass a valid API key. [API_KEY_INVALID]' } },
      },
    };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.KEY_INVALID);
  });

  test('classifies 403 quotaExceeded', () => {
    const err = {
      response: {
        status: 403,
        data: { error: { errors: [{ reason: 'quotaExceeded' }] } },
      },
    };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.QUOTA_EXCEEDED);
  });

  test('classifies 403 rateLimitExceeded', () => {
    const err = {
      response: {
        status: 403,
        data: { error: { errors: [{ reason: 'rateLimitExceeded' }] } },
      },
    };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.RATE_LIMITED);
  });

  test('classifies 403 accessNotConfigured as API_NOT_ENABLED', () => {
    const err = {
      response: {
        status: 403,
        data: { error: { errors: [{ reason: 'accessNotConfigured' }] } },
      },
    };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.API_NOT_ENABLED);
  });

  test('classifies 403 ipRefererBlocked as KEY_RESTRICTED', () => {
    const err = {
      response: {
        status: 403,
        data: { error: { errors: [{ reason: 'ipRefererBlocked' }] } },
      },
    };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.KEY_RESTRICTED);
  });

  test('classifies 404 as NOT_FOUND', () => {
    const err = { response: { status: 404, data: {} } };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.NOT_FOUND);
  });

  test('classifies 5xx as SERVER_ERROR', () => {
    const err = { response: { status: 503, data: {} } };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.SERVER_ERROR);
  });

  test('classifies network error as NETWORK_ERROR', () => {
    const err = { code: 'ECONNREFUSED' };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.NETWORK_ERROR);
  });

  test('classifies timeout as NETWORK_ERROR', () => {
    const err = { code: 'ECONNABORTED' };
    expect(classifyYoutubeApiError(err)).toBe(YoutubeApiErrorCode.NETWORK_ERROR);
  });

  test('classifies unknown as UNKNOWN', () => {
    expect(classifyYoutubeApiError(new Error('weird'))).toBe(YoutubeApiErrorCode.UNKNOWN);
  });
});
