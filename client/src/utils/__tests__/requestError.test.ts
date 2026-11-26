import { describeRequestError } from '../requestError';

// Shaped like an axios error: the request it was for rides along.
const axiosLikeError = (message: string, status?: number) =>
  Object.assign(new Error(message), {
    config: { headers: { 'x-access-token': 'secret-session-token' } },
    ...(status === undefined ? {} : { response: { status, data: {} } }),
  });

describe('describeRequestError', () => {
  test('gives the message and status when the server answered', () => {
    expect(describeRequestError(axiosLikeError('Request failed with status code 503', 503))).toEqual({
      message: 'Request failed with status code 503',
      status: 503,
    });
  });

  test('gives only the message when the request got no answer', () => {
    expect(describeRequestError(axiosLikeError('Network Error'))).toEqual({ message: 'Network Error' });
  });

  test('never includes the request headers', () => {
    const summary = describeRequestError(axiosLikeError('Request failed with status code 500', 500));

    expect(JSON.stringify(summary)).not.toContain('secret-session-token');
  });

  test('describes something thrown that is not an error', () => {
    expect(describeRequestError('offline')).toEqual({ message: 'offline' });
  });
});
