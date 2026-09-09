'use strict';

class CatalogError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CatalogError';
    this.status = status;
  }
}

function parseInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new CatalogError(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new CatalogError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function decodePageCursor(value, maximumPage) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 200) {
    throw new CatalogError('cursor is invalid');
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (parsed?.v !== 1 || !Number.isSafeInteger(parsed.page) ||
        parsed.page < 1 || parsed.page > maximumPage) {
      throw new Error('invalid cursor');
    }
    return parsed.page;
  } catch (_error) {
    throw new CatalogError('cursor is invalid');
  }
}

function encodePageCursor(page) {
  return Buffer.from(JSON.stringify({ v: 1, page }), 'utf8').toString('base64url');
}

function pagination(query, maximumPage = 100) {
  if (query.cursor !== undefined && query.page !== undefined) {
    throw new CatalogError('cursor and page cannot be used together');
  }
  const cursorPage = decodePageCursor(query.cursor, maximumPage);
  const page = cursorPage || parseInteger(query.page, 1, 1, maximumPage, 'page');
  const pageSize = parseInteger(query.pageSize, 50, 1, 100, 'pageSize');
  return { page, pageSize, offset: (page - 1) * pageSize };
}

module.exports = {
  CatalogError,
  decodePageCursor,
  encodePageCursor,
  pagination,
};