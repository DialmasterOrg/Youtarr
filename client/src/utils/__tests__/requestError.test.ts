import { describeRequestError, serverErrorMessage } from '../requestError';

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

describe('serverErrorMessage', () => {
  const failedWith = (data: unknown) =>
    Object.assign(new Error('Request failed with status code 400'), { response: { status: 400, data } });

  test("gives the server's error text", () => {
    expect(serverErrorMessage(failedWith({ error: 'Channel not found' }), 'Failed to load')).toBe('Channel not found');
  });

  test('gives the fallback when the server sent no error text', () => {
    expect(serverErrorMessage(failedWith({}), 'Failed to load')).toBe('Failed to load');
  });

  test('gives the fallback when the error text is empty', () => {
    expect(serverErrorMessage(failedWith({ error: '' }), 'Failed to load')).toBe('Failed to load');
  });

  test('gives the fallback when the error field is not text', () => {
    expect(serverErrorMessage(failedWith({ error: { code: 7 } }), 'Failed to load')).toBe('Failed to load');
  });

  test('gives the fallback, not the transport message, when the request got no answer', () => {
    expect(serverErrorMessage(new Error('Network Error'), 'Failed to load')).toBe('Failed to load');
  });

  test('gives the fallback for something thrown that is not an error', () => {
    expect(serverErrorMessage(null, 'Failed to load')).toBe('Failed to load');
    expect(serverErrorMessage('offline', 'Failed to load')).toBe('Failed to load');
  });
});
