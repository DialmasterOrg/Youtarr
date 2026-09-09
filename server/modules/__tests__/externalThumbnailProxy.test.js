const {
  fetchExternalThumbnail,
  ThumbnailProxyError,
  THUMBNAIL_MAX_BYTES,
} = require('../externalThumbnailProxy');

function response({ body = Buffer.from('jpeg'), contentType = 'image/jpeg', length, ok = true } = {}) {
  return new Response(body, {
    status: ok ? 200 : 404,
    headers: {
      'content-type': contentType,
      ...(length === undefined ? {} : { 'content-length': String(length) }),
    },
  });
}

describe('external thumbnail proxy', () => {
  test('returns bounded image bytes without following redirects', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response());

    const result = await fetchExternalThumbnail('https://i.ytimg.com/image.jpg', fetchImpl);

    expect(result).toEqual({
      body: Buffer.from('jpeg'),
      contentType: 'image/jpeg',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://i.ytimg.com/image.jpg',
      expect.objectContaining({ redirect: 'error' })
    );
  });

  test.each([
    ['non-image content', response({ contentType: 'text/html' })],
    ['oversized declared body', response({ length: THUMBNAIL_MAX_BYTES + 1 })],
    ['upstream failure', response({ ok: false })],
  ])('rejects %s', async (_name, upstreamResponse) => {
    await expect(fetchExternalThumbnail(
      'https://i.ytimg.com/image.jpg',
      jest.fn().mockResolvedValue(upstreamResponse)
    )).rejects.toBeInstanceOf(ThumbnailProxyError);
  });

  test('rejects an oversized streamed body', async () => {
    const body = Buffer.alloc(THUMBNAIL_MAX_BYTES + 1);
    await expect(fetchExternalThumbnail(
      'https://i.ytimg.com/image.jpg',
      jest.fn().mockResolvedValue(response({ body }))
    )).rejects.toBeInstanceOf(ThumbnailProxyError);
  });
});
