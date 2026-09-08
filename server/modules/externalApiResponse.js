const DEFAULT_CODES = {
  400: 'invalid_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  429: 'rate_limited',
  500: 'internal_error',
  503: 'service_unavailable',
};

function externalErrorBody(status, message, { code, requestId } = {}) {
  return {
    error: {
      code: code || DEFAULT_CODES[status] || 'request_failed',
      message,
      ...(requestId ? { requestId } : {}),
    },
  };
}

function setExternalSecurityHeaders(res) {
  res.set('Cache-Control', 'private, no-store');
  res.set('Pragma', 'no-cache');
  res.vary('x-api-key');
  res.set('X-Content-Type-Options', 'nosniff');
}

function sendExternalError(res, status, message, options) {
  setExternalSecurityHeaders(res);
  return res.status(status).json(externalErrorBody(status, message, options));
}

module.exports = { externalErrorBody, sendExternalError, setExternalSecurityHeaders };
