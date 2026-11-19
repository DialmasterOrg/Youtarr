const { RequestError, requestPagination, requestPaginationDto, dto,
  normalizeChannelUrl, normalizeIdempotencyKey } = require('../externalRequestPrimitives');

test('request pages share bounded cursors and retain request-specific errors', () => {
  const page = requestPaginationDto(1, 10, 25);
  expect(requestPagination({ cursor: page.nextCursor, pageSize: '10' }))
    .toEqual({ page: 2, pageSize: 10, offset: 10 });
  expect(() => requestPagination({ cursor: page.nextCursor, page: '2' })).toThrow(RequestError);
  expect(() => requestPagination({ page: '101' })).toThrow(RequestError);
  expect(() => requestPagination({ cursor: 'invalid' })).toThrow(RequestError);
  expect(requestPaginationDto(100, 10, 10000).nextCursor).toBeNull();
});

test('public request DTOs omit key hashes, jobs and deduplication identifiers', () => {
  const result = dto({ id: 'request', request_type: 'channel', status: 'completed',
    grant_to_requesting_key: false, key_hash: 'private-hash', job_id: 'internal-job',
    active_dedupe_key: 'internal-dedupe', idempotency_hash: 'private-idempotency' });
  expect(result.grantToRequestingKey).toBe(false);
  expect(JSON.stringify(result)).not.toMatch(/private|internal/);
});

test('channel targets remain canonical and idempotency keys are bounded hashes', () => {
  expect(normalizeChannelUrl('youtube.com/@Family')).toBe('https://www.youtube.com/@Family');
  expect(() => normalizeChannelUrl('https://youtube.com.attacker.test/@Family')).toThrow(RequestError);
  expect(() => normalizeChannelUrl('https://youtube.com/@Family/%zz')).toThrow(RequestError);
  expect(normalizeIdempotencyKey('local-test')).toMatch(/^[a-f0-9]{64}$/);
  expect(() => normalizeIdempotencyKey('x'.repeat(201))).toThrow(RequestError);
});
