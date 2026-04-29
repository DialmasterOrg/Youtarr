const YoutubeApiErrorCode = Object.freeze({
  KEY_INVALID: 'KEY_INVALID',
  KEY_RESTRICTED: 'KEY_RESTRICTED',
  API_NOT_ENABLED: 'API_NOT_ENABLED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CANCELED: 'CANCELED',
  // Channel ID shape we don't recognize (e.g. legacy/topic channels that don't
  // start with "UC..."). Not an API failure - just signals "skip the API path
  // and fall back to yt-dlp" without warn-level noise.
  INVALID_CHANNEL_ID: 'INVALID_CHANNEL_ID',
  UNKNOWN: 'UNKNOWN',
});

function firstReason(errorResponse) {
  const errors = errorResponse?.error?.errors;
  if (Array.isArray(errors) && errors.length > 0 && typeof errors[0].reason === 'string') {
    return errors[0].reason;
  }
  return null;
}

function messageContains(errorResponse, needle) {
  const message = errorResponse?.error?.message;
  return typeof message === 'string' && message.includes(needle);
}

function classifyYoutubeApiError(err) {
  if (err && (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED')) {
    return YoutubeApiErrorCode.CANCELED;
  }

  if (err && err.response && typeof err.response.status === 'number') {
    const status = err.response.status;
    const data = err.response.data;
    const reason = firstReason(data);

    if (status === 400) {
      if (reason === 'keyInvalid' || messageContains(data, 'API_KEY_INVALID')) {
        return YoutubeApiErrorCode.KEY_INVALID;
      }
      return YoutubeApiErrorCode.UNKNOWN;
    }

    if (status === 403) {
      if (reason === 'quotaExceeded') return YoutubeApiErrorCode.QUOTA_EXCEEDED;
      if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
        return YoutubeApiErrorCode.RATE_LIMITED;
      }
      if (reason === 'accessNotConfigured') return YoutubeApiErrorCode.API_NOT_ENABLED;
      if (reason === 'ipRefererBlocked' || reason === 'ipBlocked') {
        return YoutubeApiErrorCode.KEY_RESTRICTED;
      }
      if (messageContains(data, 'API_KEY_SERVICE_BLOCKED')) {
        return YoutubeApiErrorCode.API_NOT_ENABLED;
      }
      if (messageContains(data, 'API_KEY_HTTP_REFERRER_BLOCKED')) {
        return YoutubeApiErrorCode.KEY_RESTRICTED;
      }
      return YoutubeApiErrorCode.UNKNOWN;
    }

    if (status === 404) return YoutubeApiErrorCode.NOT_FOUND;
    if (status >= 500 && status < 600) return YoutubeApiErrorCode.SERVER_ERROR;

    return YoutubeApiErrorCode.UNKNOWN;
  }

  if (err && (err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND')) {
    return YoutubeApiErrorCode.NETWORK_ERROR;
  }

  return YoutubeApiErrorCode.UNKNOWN;
}

module.exports = { classifyYoutubeApiError, YoutubeApiErrorCode };
