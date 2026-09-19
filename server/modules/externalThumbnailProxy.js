const THUMBNAIL_FETCH_TIMEOUT_MS = 10000;
const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

class ThumbnailProxyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ThumbnailProxyError';
  }
}

async function fetchExternalThumbnail(url, fetchImpl = global.fetch) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'image/jpeg,image/png,image/webp' },
      redirect: 'error',
      signal: AbortSignal.timeout(THUMBNAIL_FETCH_TIMEOUT_MS),
    });
  } catch (_error) {
    throw new ThumbnailProxyError('Thumbnail fetch failed');
  }
  if (!response.ok) throw new ThumbnailProxyError('Thumbnail fetch failed');

  const contentType = String(response.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new ThumbnailProxyError('Thumbnail response was not an image');
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > THUMBNAIL_MAX_BYTES) {
    throw new ThumbnailProxyError('Thumbnail response was too large');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new ThumbnailProxyError('Thumbnail response had no body');
  const chunks = [];
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > THUMBNAIL_MAX_BYTES) {
        await reader.cancel();
        throw new ThumbnailProxyError('Thumbnail response was too large');
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof ThumbnailProxyError) throw error;
    throw new ThumbnailProxyError('Thumbnail fetch failed');
  }

  return {
    body: Buffer.concat(chunks, totalBytes),
    contentType,
  };
}

module.exports = {
  fetchExternalThumbnail,
  ThumbnailProxyError,
  THUMBNAIL_FETCH_TIMEOUT_MS,
  THUMBNAIL_MAX_BYTES,
};
