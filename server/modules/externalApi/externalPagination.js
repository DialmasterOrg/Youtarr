'use strict';

class CatalogError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CatalogError';
    this.status = status;
  }
}

function parseInteger(value, fallback, minimum, maximum, name, ErrorType = CatalogError) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new ErrorType(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ErrorType(`${name} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function decodePageCursor(value, maximumPage, ErrorType = CatalogError) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 200) {
    throw new ErrorType('cursor is invalid');
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (parsed?.v !== 1 || !Number.isSafeInteger(parsed.page) ||
        parsed.page < 1 || parsed.page > maximumPage) {
      throw new Error('invalid cursor');
    }
    return parsed.page;
  } catch (_error) {
    throw new ErrorType('cursor is invalid');
  }
}

function encodePageCursor(page) {
  return Buffer.from(JSON.stringify({ v: 1, page }), 'utf8').toString('base64url');
}

function pagination(query, maximumPage = 100, ErrorType = CatalogError) {
  if (query.cursor !== undefined && query.page !== undefined) {
    throw new ErrorType('cursor and page cannot be used together');
  }
  const cursorPage = decodePageCursor(query.cursor, maximumPage, ErrorType);
  const page = cursorPage || parseInteger(query.page, 1, 1, maximumPage, 'page', ErrorType);
  const pageSize = parseInteger(query.pageSize, 50, 1, 100, 'pageSize', ErrorType);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function paginationDto(page, pageSize, total, maximumPage = 100) {
  const totalPages = total === 0 ? 0 : Math.min(maximumPage, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    nextCursor: page < totalPages ? encodePageCursor(page + 1) : null,
  };
}

module.exports = {
  parseInteger,
  paginationDto,
  CatalogError,
  decodePageCursor,
  encodePageCursor,
  pagination,
};
