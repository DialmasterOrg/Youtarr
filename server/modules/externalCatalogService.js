const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const configModule = require('./configModule');
const { normalizeExternalPolicy, ratingPolicy } = require('./externalEligibility');
const {
  CatalogError,
  decodePageCursor,
  encodePageCursor,
  pagination,
} = require('./externalPagination');

const TAB_MEDIA_TYPES = { videos: 'video', shorts: 'short', streams: 'livestream' };
const SAFE_THUMBNAIL_HOSTS = ['ytimg.com', 'ggpht.com', 'googleusercontent.com'];
const ACTIVE_REQUEST_STATUSES = ['pending', 'approved', 'processing'];
const MAX_PAGE = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TITLE_LENGTH = 500;
const MAX_PUBLIC_URL_LENGTH = 2048;

function boundedString(value, maximum) {
  if (value === null || value === undefined) return null;
  return String(value).slice(0, maximum);
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

function normalizeSearch(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 200) {
    throw new CatalogError('search must be a string of 200 characters or fewer');
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new CatalogError('search must not be blank');
  return normalized;
}

function normalizeDate(value, name, endOfDay = false) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 40) throw new CatalogError(`${name} must be a date`);
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : value;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) throw new CatalogError(`${name} must be a valid date`);
  return parsed.toISOString();
}

function normalizePolicy(policy) {
  return normalizeExternalPolicy(policy, CatalogError);
}

function ratingSql(policy, effectiveRatingSql) {
  const { recognizedRatings, allowedRatings } = ratingPolicy(policy);
  const clauses = [`${effectiveRatingSql} IN (:allowedRatings)`];
  if (policy.allowUnrated) {
    clauses.push(`(${effectiveRatingSql} IS NULL OR ${effectiveRatingSql} NOT IN (:recognizedRatings))`);
  }
  return {
    sql: `(${clauses.join(' OR ')})`,
    replacements: { allowedRatings, recognizedRatings },
  };
}


function paginationDto(page, pageSize, total, maximumPage = MAX_PAGE) {
  const totalPages = total === 0 ? 0 : Math.min(maximumPage, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    nextCursor: page < totalPages ? encodePageCursor(page + 1) : null,
  };
}

function catalogCursorFingerprint(endpoint, filters) {
  return crypto.createHash('sha256')
    .update(JSON.stringify({ endpoint, ...filters }))
    .digest('base64url')
    .slice(0, 32);
}

function decodeCatalogCursor(value, expected) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 500) {
    throw new CatalogError('cursor is invalid');
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (parsed?.v !== 2 ||
        parsed.endpoint !== expected.endpoint ||
        parsed.sortBy !== expected.sortBy ||
        parsed.sortOrder !== expected.sortOrder ||
        parsed.fingerprint !== expected.fingerprint ||
        !Number.isSafeInteger(parsed.page) || parsed.page < 2 ||
        !Number.isSafeInteger(parsed.channelDatabaseId) || parsed.channelDatabaseId < 1 ||
        typeof parsed.youtubeId !== 'string' || parsed.youtubeId.length === 0 ||
        parsed.youtubeId.length > 32 ||
        !Object.prototype.hasOwnProperty.call(parsed, 'sortValue')) {
      throw new Error('invalid cursor');
    }
    return parsed;
  } catch (_error) {
    throw new CatalogError('cursor is invalid');
  }
}

function encodeCatalogCursor({
  endpoint, sortBy, sortOrder, fingerprint, page,
  sortValue, channelDatabaseId, youtubeId,
}) {
  return Buffer.from(JSON.stringify({
    v: 2,
    endpoint,
    sortBy,
    sortOrder,
    fingerprint,
    page,
    sortValue,
    channelDatabaseId,
    youtubeId,
  }), 'utf8').toString('base64url');
}

function catalogPagination(query, cursorSpec) {
  if (query.cursor !== undefined && query.page !== undefined) {
    throw new CatalogError('cursor and page cannot be used together');
  }
  const pageSize = parseInteger(query.pageSize, 50, 1, 100, 'pageSize');
  if (query.cursor !== undefined) {
    const cursor = decodeCatalogCursor(query.cursor, cursorSpec);
    return { page: cursor.page, pageSize, offset: null, cursor };
  }
  const page = parseInteger(query.page, 1, 1, MAX_PAGE, 'page');
  return { page, pageSize, offset: (page - 1) * pageSize, cursor: null };
}

function catalogSeekSql(sortExpression, sortOrder, cursor) {
  if (!cursor) return '';
  const operator = sortOrder === 'asc' ? '>' : '<';
  return `AND (
    ${sortExpression} ${operator} :cursorSortValue
    OR (
      ${sortExpression} = :cursorSortValue
      AND (
        c.id > :cursorChannelDatabaseId
        OR (c.id = :cursorChannelDatabaseId AND cv.youtube_id > :cursorYoutubeId)
      )
    )
  )`;
}

function catalogPaginationDto({
  page, pageSize, total, hasMore, lastRow, cursorSpec,
}) {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    nextCursor: hasMore && lastRow
      ? encodeCatalogCursor({
        ...cursorSpec,
        page: page + 1,
        sortValue: lastRow.cursor_sort_value,
        channelDatabaseId: Number(lastRow.channel_database_id),
        youtubeId: lastRow.youtube_id,
      })
      : null,
  };
}

function lastFetched(channel, mediaType = null) {
  try {
    const values = JSON.parse(channel.lastFetchedByTab || '{}');
    if (mediaType) return values[mediaType] || null;
    const dates = Object.values(values).filter(Boolean).map((value) => new Date(value));
    if (dates.length === 0 || dates.some((value) => Number.isNaN(value.getTime()))) return null;
    return new Date(Math.max(...dates.map((value) => value.getTime()))).toISOString();
  } catch (_error) {
    return null;
  }
}

function publicVideoThumbnail(value) {
  if (typeof value !== 'string' || value.length > MAX_PUBLIC_URL_LENGTH) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' ||
        !SAFE_THUMBNAIL_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      return null;
    }
    return url.toString();
  } catch (_error) {
    return null;
  }
}

function videoThumbnailUrl(youtubeId) {
  return `/external-api/v1/assets/videos/${youtubeId}/thumbnail`;
}

async function listChannels(key, query = {}) {
  const policy = normalizePolicy(key);
  const { page, pageSize, offset } = pagination(query);
  const search = normalizeSearch(query.search);
  const sortColumns = {
    title: 'title',
    videoCount: 'videoCount',
    downloadedCount: 'downloadedCount',
    id: 'id',
  };
  const sortBy = query.sortBy || 'title';
  if (!Object.prototype.hasOwnProperty.call(sortColumns, sortBy)) {
    throw new CatalogError('sortBy must be title, videoCount, downloadedCount, or id');
  }
  const sortOrder = (query.sortOrder || 'asc').toLowerCase();
  if (!['asc', 'desc'].includes(sortOrder)) throw new CatalogError('sortOrder must be asc or desc');

  const effectiveRating =
    'COALESCE(NULLIF(v.normalized_rating, \'\'), NULLIF(c.default_rating, \'\'))';
  const ratings = ratingSql(policy, effectiveRating);
  const videoPolicy = `cv.youtube_removed = false AND cv.ignored = false
    AND cv.media_type IN (:allowedMediaTypes) AND ${ratings.sql}`;
  const whereSearch = search
    ? `AND (
      LOCATE(:search, LOWER(COALESCE(c.title, c.uploader, ''))) > 0
      OR LOCATE(:search, LOWER(COALESCE(c.description, ''))) > 0
    )`
    : '';
  const subfolder = query.subfolder === undefined || query.subfolder === ''
    ? null
    : String(query.subfolder);
  if (subfolder && subfolder.length > 255) {
    throw new CatalogError('subfolder must be 255 characters or fewer');
  }
  const whereSubfolder = subfolder ? 'AND c.sub_folder = :subfolder' : '';
  const replacements = {
    keyId: key.id, allowedMediaTypes: policy.allowedMediaTypes, search,
    subfolder, pageSize, offset, ...ratings.replacements,
  };

  const countRows = await sequelize.query(
    `SELECT COUNT(*) AS total
       FROM channels c
       INNER JOIN api_key_channel_grants g
         ON g.channel_id = c.id AND g.api_key_id = :keyId
      WHERE c.enabled = true AND c.terminated_at IS NULL ${whereSearch} ${whereSubfolder}`,
    { replacements, type: QueryTypes.SELECT }
  );
  const rows = await sequelize.query(
    `SELECT c.id, c.channel_id, COALESCE(c.title, c.uploader, '') AS title,
            c.description, c.sub_folder, c.last_fetched_by_tab AS lastFetchedByTab,
            (SELECT COUNT(*) FROM channelvideos cv
               LEFT JOIN videos v ON v.youtube_id = cv.youtube_id
              WHERE cv.channel_id = c.channel_id AND ${videoPolicy}) AS videoCount,
            (SELECT COUNT(*) FROM channelvideos cv
               INNER JOIN videos v ON v.youtube_id = cv.youtube_id AND v.removed = false
              WHERE cv.channel_id = c.channel_id AND ${videoPolicy}) AS downloadedCount
       FROM channels c
       INNER JOIN api_key_channel_grants g
         ON g.channel_id = c.id AND g.api_key_id = :keyId
      WHERE c.enabled = true AND c.terminated_at IS NULL ${whereSearch} ${whereSubfolder}
      ORDER BY ${sortColumns[sortBy]} ${sortOrder.toUpperCase()}, c.id ASC
      LIMIT :pageSize OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT }
  );
  const total = Number(countRows[0]?.total || 0);
  return {
    data: rows.map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      title: boundedString(row.title, MAX_TITLE_LENGTH),
      descriptionSummary: row.description ? row.description.trim().slice(0, 240) : null,
      thumbnailUrl: `/external-api/v1/assets/channels/${row.id}/thumbnail`,
      subfolder: boundedString(row.sub_folder, 255),
      videoCount: Number(row.videoCount || 0),
      downloadedCount: Number(row.downloadedCount || 0),
      lastFetchedAt: lastFetched(row),
    })),
    pagination: paginationDto(page, pageSize, total),
    dataSource: 'cache',
  };
}

async function listChannelVideos(key, channelDatabaseId, query = {}) {
  const policy = normalizePolicy(key);
  const id = parseInteger(channelDatabaseId, null, 1, Number.MAX_SAFE_INTEGER, 'channel id');
  const search = normalizeSearch(query.search);
  const tabType = query.tabType || 'videos';
  const mediaType = TAB_MEDIA_TYPES[tabType];
  if (!mediaType) throw new CatalogError('tabType must be videos, shorts, or streams');
  if (!policy.allowedMediaTypes.includes(mediaType)) throw new CatalogError('Media type is not allowed', 403);
  const sortColumns = { date: 'cv.published_at', title: 'cv.title', duration: 'cv.duration' };
  const sortExpressions = {
    date: 'COALESCE(cv.published_at, \'\')',
    title: 'LOWER(COALESCE(cv.title, \'\'))',
    duration: 'COALESCE(cv.duration, -1)',
  };
  const sortBy = query.sortBy || 'date';
  if (!sortColumns[sortBy]) throw new CatalogError('sortBy must be date, title, or duration');
  const sortOrder = (query.sortOrder || 'desc').toLowerCase();
  if (!['asc', 'desc'].includes(sortOrder)) throw new CatalogError('sortOrder must be asc or desc');
  const minDuration = parseInteger(query.minDuration, null, 0, 604800, 'minDuration');
  const maxDuration = parseInteger(query.maxDuration, null, 0, 604800, 'maxDuration');
  if (minDuration !== null && maxDuration !== null && minDuration > maxDuration) {
    throw new CatalogError('minDuration cannot exceed maxDuration');
  }
  const dateFrom = normalizeDate(query.dateFrom, 'dateFrom');
  const dateTo = normalizeDate(query.dateTo, 'dateTo', true);
  if (dateFrom && dateTo && dateFrom > dateTo) throw new CatalogError('dateFrom cannot exceed dateTo');
  const status = query.status && query.status !== 'all' ? query.status : null;
  if (status && !['downloaded', 'available', 'requested', 'requestable'].includes(status)) {
    throw new CatalogError('status must be all, downloaded, available, requested, or requestable');
  }
  const cursorSpec = {
    endpoint: `channel:${id}:videos`,
    sortBy,
    sortOrder,
    fingerprint: catalogCursorFingerprint(`channel:${id}:videos`, {
      keyId: key.id,
      search,
      tabType,
      status: status || 'all',
      minDuration,
      maxDuration,
      dateFrom,
      dateTo,
      pageSize: parseInteger(query.pageSize, 50, 1, 100, 'pageSize'),
    }),
  };
  const { page, pageSize, offset, cursor } = catalogPagination(query, cursorSpec);

  const channelRows = await sequelize.query(
    `SELECT c.id, c.channel_id, COALESCE(c.title, c.uploader, '') AS title, c.last_fetched_by_tab AS lastFetchedByTab
       FROM channels c
       INNER JOIN api_key_channel_grants g
         ON g.channel_id = c.id AND g.api_key_id = :keyId
      WHERE c.id = :channelDatabaseId AND c.enabled = true AND c.terminated_at IS NULL
      LIMIT 1`,
    { replacements: { keyId: key.id, channelDatabaseId: id }, type: QueryTypes.SELECT }
  );
  if (channelRows.length === 0) throw new CatalogError('Channel not found', 404);
  const channel = channelRows[0];
  const effectiveRating =
    'COALESCE(NULLIF(v.normalized_rating, \'\'), NULLIF(c.default_rating, \'\'))';
  const ratings = ratingSql(policy, effectiveRating);
  const filters = [
    'cv.channel_id = c.channel_id',
    'cv.media_type = :mediaType',
    'cv.youtube_removed = false',
    'cv.ignored = false',
    ratings.sql,
  ];
  if (minDuration !== null) filters.push('cv.duration >= :minDuration');
  if (maxDuration !== null) filters.push('cv.duration <= :maxDuration');
  if (search) filters.push('LOCATE(:search, LOWER(COALESCE(cv.title, \'\'))) > 0');
  if (dateFrom) filters.push('cv.published_at >= :dateFrom');
  if (dateTo) filters.push('cv.published_at <= :dateTo');
  if (status === 'downloaded') filters.push('v.id IS NOT NULL AND v.removed = false');
  if (status === 'available') filters.push('(v.id IS NULL OR v.removed = true)');
  const activeRequestSql = `EXISTS (
      SELECT 1 FROM external_requests er
       WHERE er.api_key_id = :keyId
         AND er.request_type = 'video'
         AND er.youtube_id = cv.youtube_id
         AND er.status IN ('pending', 'approved', 'processing')
    )`;
  if (status === 'requested') filters.push(activeRequestSql);
  if (status === 'requestable') {
    filters.push('(v.id IS NULL OR v.removed = true)');
    filters.push(`NOT ${activeRequestSql}`);
  }
  const replacements = {
    keyId: key.id, channelDatabaseId: id, mediaType, minDuration, maxDuration, search, dateFrom, dateTo,
    fetchLimit: pageSize + 1, offset,
    cursorSortValue: cursor?.sortValue,
    cursorChannelDatabaseId: cursor?.channelDatabaseId,
    cursorYoutubeId: cursor?.youtubeId,
    ...ratings.replacements,
  };
  const from = `FROM channelvideos cv
    INNER JOIN channels c ON c.id = :channelDatabaseId AND c.channel_id = cv.channel_id
    LEFT JOIN videos v ON v.youtube_id = cv.youtube_id
    WHERE ${filters.join(' AND ')}`;
  const seekSql = catalogSeekSql(sortExpressions[sortBy], sortOrder, cursor);
  const countRows = await sequelize.query(
    `SELECT COUNT(*) AS total ${from}`,
    { replacements, type: QueryTypes.SELECT }
  );
  const fetchedRows = await sequelize.query(
    `SELECT cv.youtube_id, cv.title, cv.thumbnail, cv.published_at AS publishedAt, cv.published_at_source,
            cv.duration, cv.media_type, v.description, v.id AS downloaded_id,
            v.removed AS downloaded_removed, ${effectiveRating} AS rating,
            c.id AS channel_database_id,
            ${sortExpressions[sortBy]} AS cursor_sort_value,
            (SELECT er.status
               FROM external_requests er
              WHERE er.api_key_id = :keyId
                AND er.request_type = 'video'
                AND er.youtube_id = cv.youtube_id
              ORDER BY er.created_at DESC, er.id DESC
              LIMIT 1) AS request_status
       ${from}
       ${seekSql}
      ORDER BY ${sortExpressions[sortBy]} ${sortOrder.toUpperCase()}, c.id ASC, cv.youtube_id ASC
      LIMIT :fetchLimit${cursor ? '' : ' OFFSET :offset'}`,
    { replacements, type: QueryTypes.SELECT }
  );
  const hasMore = fetchedRows.length > pageSize;
  const rows = fetchedRows.slice(0, pageSize);
  const total = Number(countRows[0]?.total || 0);
  const lastIndexedAt = lastFetched(channel, mediaType);
  return {
    data: rows.map((row) => ({
      youtubeId: row.youtube_id,
      title: boundedString(row.title, MAX_TITLE_LENGTH),
      thumbnailUrl: videoThumbnailUrl(row.youtube_id),
      publishedAt: row.published_at_source === 'estimated' ? null : row.publishedAt,
      duration: row.duration,
      description: boundedString(row.description, MAX_DESCRIPTION_LENGTH),
      isDownloaded: Boolean(row.downloaded_id) && !row.downloaded_removed,
      isRequested: ACTIVE_REQUEST_STATUSES.includes(row.request_status),
      requestStatus: row.request_status || null,
      rating: row.rating || null,
      channelId: channel.channel_id,
      channelTitle: channel.title,
      mediaType: row.media_type,
    })),
    pagination: catalogPaginationDto({
      page,
      pageSize,
      total,
      hasMore,
      lastRow: rows[rows.length - 1],
      cursorSpec,
    }),
    dataSource: 'cache',
    isFullyIndexed: Boolean(lastIndexedAt),
    lastIndexedAt,
    indexingHint: lastIndexedAt ? null : 'This channel tab has not been indexed yet.',
  };
}

async function listVideos(key, query = {}) {
  const policy = normalizePolicy(key);
  const search = normalizeSearch(query.search);
  const tabType = query.tabType || null;
  const mediaType = tabType ? TAB_MEDIA_TYPES[tabType] : null;
  if (tabType && !mediaType) throw new CatalogError('tabType must be videos, shorts, or streams');
  if (mediaType && !policy.allowedMediaTypes.includes(mediaType)) {
    throw new CatalogError('Media type is not allowed', 403);
  }
  const sortColumns = { date: 'cv.published_at', title: 'cv.title', duration: 'cv.duration' };
  const sortExpressions = {
    date: 'COALESCE(cv.published_at, \'\')',
    title: 'LOWER(COALESCE(cv.title, \'\'))',
    duration: 'COALESCE(cv.duration, -1)',
  };
  const sortBy = query.sortBy || 'date';
  if (!sortColumns[sortBy]) throw new CatalogError('sortBy must be date, title, or duration');
  const sortOrder = (query.sortOrder || 'desc').toLowerCase();
  if (!['asc', 'desc'].includes(sortOrder)) throw new CatalogError('sortOrder must be asc or desc');
  const minDuration = parseInteger(query.minDuration, null, 0, 604800, 'minDuration');
  const maxDuration = parseInteger(query.maxDuration, null, 0, 604800, 'maxDuration');
  if (minDuration !== null && maxDuration !== null && minDuration > maxDuration) {
    throw new CatalogError('minDuration cannot exceed maxDuration');
  }
  const dateFrom = normalizeDate(query.dateFrom, 'dateFrom');
  const dateTo = normalizeDate(query.dateTo, 'dateTo', true);
  if (dateFrom && dateTo && dateFrom > dateTo) throw new CatalogError('dateFrom cannot exceed dateTo');
  const status = query.status && query.status !== 'all' ? query.status : null;
  if (status && !['downloaded', 'available', 'requested', 'requestable'].includes(status)) {
    throw new CatalogError('status must be all, downloaded, available, requested, or requestable');
  }
  const cursorSpec = {
    endpoint: 'videos',
    sortBy,
    sortOrder,
    fingerprint: catalogCursorFingerprint('videos', {
      keyId: key.id,
      search,
      tabType,
      status: status || 'all',
      minDuration,
      maxDuration,
      dateFrom,
      dateTo,
      pageSize: parseInteger(query.pageSize, 50, 1, 100, 'pageSize'),
    }),
  };
  const { page, pageSize, offset, cursor } = catalogPagination(query, cursorSpec);
  const effectiveRating =
    'COALESCE(NULLIF(v.normalized_rating, \'\'), NULLIF(c.default_rating, \'\'))';
  const ratings = ratingSql(policy, effectiveRating);
  const filters = [
    'c.enabled = true',
    'c.terminated_at IS NULL',
    'cv.youtube_removed = false',
    'cv.ignored = false',
    'cv.media_type IN (:allowedMediaTypes)',
    ratings.sql,
  ];
  if (mediaType) filters.push('cv.media_type = :mediaType');
  if (search) filters.push('LOCATE(:search, LOWER(COALESCE(cv.title, \'\'))) > 0');
  if (minDuration !== null) filters.push('cv.duration >= :minDuration');
  if (maxDuration !== null) filters.push('cv.duration <= :maxDuration');
  if (dateFrom) filters.push('cv.published_at >= :dateFrom');
  if (dateTo) filters.push('cv.published_at <= :dateTo');
  if (status === 'downloaded') filters.push('v.id IS NOT NULL AND v.removed = false');
  if (status === 'available') filters.push('(v.id IS NULL OR v.removed = true)');
  const activeRequestSql = `EXISTS (
      SELECT 1 FROM external_requests er2
       WHERE er2.api_key_id = :keyId
         AND er2.request_type = 'video'
         AND er2.youtube_id = cv.youtube_id
         AND er2.status IN ('pending', 'approved', 'processing')
    )`;
  if (status === 'requested') filters.push(activeRequestSql);
  if (status === 'requestable') {
    filters.push('(v.id IS NULL OR v.removed = true)');
    filters.push(`NOT ${activeRequestSql}`);
  }
  const replacements = {
    keyId: key.id,
    allowedMediaTypes: policy.allowedMediaTypes,
    mediaType,
    search,
    minDuration,
    maxDuration,
    dateFrom,
    dateTo,
    fetchLimit: pageSize + 1,
    offset,
    cursorSortValue: cursor?.sortValue,
    cursorChannelDatabaseId: cursor?.channelDatabaseId,
    cursorYoutubeId: cursor?.youtubeId,
    ...ratings.replacements,
  };
  const from = `FROM channelvideos cv
    INNER JOIN channels c ON c.channel_id = cv.channel_id
    INNER JOIN api_key_channel_grants g
      ON g.channel_id = c.id AND g.api_key_id = :keyId
    LEFT JOIN videos v ON v.youtube_id = cv.youtube_id
    WHERE ${filters.join(' AND ')}`;
  const seekSql = catalogSeekSql(sortExpressions[sortBy], sortOrder, cursor);
  const countRows = await sequelize.query(
    `SELECT COUNT(*) AS total ${from}`,
    { replacements, type: QueryTypes.SELECT }
  );
  const fetchedRows = await sequelize.query(
    `SELECT cv.youtube_id, cv.title, cv.thumbnail, cv.published_at AS publishedAt, cv.published_at_source,
            cv.duration, cv.media_type, v.description, v.id AS downloaded_id,
            v.removed AS downloaded_removed, ${effectiveRating} AS rating,
            c.id AS channel_database_id, c.channel_id, COALESCE(c.title, c.uploader, '') AS channel_title,
            ${sortExpressions[sortBy]} AS cursor_sort_value,
            (SELECT er.status
               FROM external_requests er
              WHERE er.api_key_id = :keyId
                AND er.request_type = 'video'
                AND er.youtube_id = cv.youtube_id
              ORDER BY er.created_at DESC, er.id DESC
              LIMIT 1) AS request_status
       ${from}
       ${seekSql}
      ORDER BY ${sortExpressions[sortBy]} ${sortOrder.toUpperCase()}, c.id ASC, cv.youtube_id ASC
      LIMIT :fetchLimit${cursor ? '' : ' OFFSET :offset'}`,
    { replacements, type: QueryTypes.SELECT }
  );
  const hasMore = fetchedRows.length > pageSize;
  const rows = fetchedRows.slice(0, pageSize);
  const total = Number(countRows[0]?.total || 0);
  return {
    data: rows.map((row) => ({
      youtubeId: row.youtube_id,
      title: boundedString(row.title, MAX_TITLE_LENGTH),
      thumbnailUrl: videoThumbnailUrl(row.youtube_id),
      publishedAt: row.published_at_source === 'estimated' ? null : row.publishedAt,
      duration: row.duration,
      description: boundedString(row.description, MAX_DESCRIPTION_LENGTH),
      isDownloaded: Boolean(row.downloaded_id) && !row.downloaded_removed,
      isRequested: ACTIVE_REQUEST_STATUSES.includes(row.request_status),
      requestStatus: row.request_status || null,
      rating: row.rating || null,
      channelDatabaseId: row.channel_database_id,
      channelId: row.channel_id,
      channelTitle: row.channel_title,
      mediaType: row.media_type,
    })),
    pagination: catalogPaginationDto({
      page,
      pageSize,
      total,
      hasMore,
      lastRow: rows[rows.length - 1],
      cursorSpec,
    }),
    dataSource: 'cache',
    isFullyIndexed: true,
    lastIndexedAt: null,
    indexingHint: null,
  };
}

async function getVideoDetail(key, youtubeId, metadataService = null) {
  const policy = normalizePolicy(key);
  if (typeof youtubeId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
    throw new CatalogError('Video not found', 404);
  }
  const effectiveRating =
    'COALESCE(NULLIF(v.normalized_rating, \'\'), NULLIF(c.default_rating, \'\'))';
  const ratings = ratingSql(policy, effectiveRating);
  const rows = await sequelize.query(
    `SELECT cv.youtube_id, cv.title, cv.published_at AS publishedAt, cv.published_at_source,
            cv.duration, cv.media_type, cv.availability,
            v.description, v.id AS downloaded_id, v.removed AS downloaded_removed,
            v.last_downloaded_at, v.file_size AS fileSize, v.audio_file_size AS audioFileSize, v.protected,
            v.rating_source, v.video_resolution, ${effectiveRating} AS rating,
            c.id AS channel_database_id, c.channel_id,
            COALESCE(c.title, c.uploader, '') AS channel_title,
            (SELECT er.status
               FROM external_requests er
              WHERE er.api_key_id = :keyId
                AND er.request_type = 'video'
                AND er.youtube_id = cv.youtube_id
              ORDER BY er.created_at DESC, er.id DESC
              LIMIT 1) AS request_status
       FROM channelvideos cv
       INNER JOIN channels c ON c.channel_id = cv.channel_id
       INNER JOIN api_key_channel_grants g
         ON g.channel_id = c.id AND g.api_key_id = :keyId
       LEFT JOIN videos v ON v.youtube_id = cv.youtube_id
      WHERE cv.youtube_id = :youtubeId
        AND c.enabled = true AND c.terminated_at IS NULL
        AND cv.youtube_removed = false AND cv.ignored = false
        AND cv.media_type IN (:allowedMediaTypes)
        AND ${ratings.sql}
      ORDER BY c.id ASC
      LIMIT 1`,
    {
      replacements: {
        keyId: key.id,
        youtubeId,
        allowedMediaTypes: policy.allowedMediaTypes,
        ...ratings.replacements,
      },
      type: QueryTypes.SELECT,
    }
  );
  const row = rows[0];
  if (!row) throw new CatalogError('Video not found', 404);

  const metadataProvider = metadataService || require('./videoMetadataModule');
  const metadata = await metadataProvider.getVideoMetadata(youtubeId);
  const isDownloaded = Boolean(row.downloaded_id) && !row.downloaded_removed;
  return {
    youtubeId: row.youtube_id,
    title: boundedString(row.title, MAX_TITLE_LENGTH),
    thumbnailUrl: videoThumbnailUrl(row.youtube_id),
    publishedAt: row.published_at_source === 'estimated' ? null : row.publishedAt,
    duration: row.duration,
    isDownloaded,
    isRequested: ACTIVE_REQUEST_STATUSES.includes(row.request_status),
    requestStatus: row.request_status || null,
    rating: row.rating || null,
    ratingSource: row.rating_source || null,
    channelDatabaseId: row.channel_database_id,
    channelId: row.channel_id,
    channelTitle: boundedString(row.channel_title, MAX_TITLE_LENGTH),
    mediaType: row.media_type,
    availability: metadata?.availability ?? row.availability ?? null,
    downloadedAt: isDownloaded && row.last_downloaded_at
      ? new Date(row.last_downloaded_at).toISOString()
      : null,
    fileSize: isDownloaded && row.fileSize != null ? Number(row.fileSize) : null,
    audioFileSize: isDownloaded && row.audioFileSize != null ? Number(row.audioFileSize) : null,
    isProtected: isDownloaded ? Boolean(row.protected) : false,
    videoResolution: isDownloaded ? row.video_resolution || null : null,
    metadata: {
      ...(metadata || {}),
      description: metadata?.description ?? row.description ?? null,
    },
  };
}

async function getChannelThumbnail(key, channelDatabaseId) {
  normalizePolicy(key);
  const id = parseInteger(channelDatabaseId, null, 1, Number.MAX_SAFE_INTEGER, 'channel id');
  const rows = await sequelize.query(
    `SELECT c.channel_id
       FROM channels c
       INNER JOIN api_key_channel_grants g
         ON g.channel_id = c.id AND g.api_key_id = :keyId
      WHERE c.id = :channelDatabaseId AND c.enabled = true AND c.terminated_at IS NULL
      LIMIT 1`,
    { replacements: { keyId: key.id, channelDatabaseId: id }, type: QueryTypes.SELECT }
  );
  const channelId = rows[0]?.channel_id;
  if (!channelId || !/^[A-Za-z0-9_-]+$/.test(channelId)) throw new CatalogError('Thumbnail not found', 404);
  try {
    const imageDirectory = await fs.realpath(path.resolve(configModule.getImagePath()));
    const candidatePath = path.resolve(imageDirectory, `channelthumb-${channelId}.jpg`);
    if (path.dirname(candidatePath) !== imageDirectory) throw new Error('unsafe path');
    const stat = await fs.lstat(candidatePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file');
    const absolutePath = await fs.realpath(candidatePath);
    if (path.dirname(absolutePath) !== imageDirectory) throw new Error('unsafe target');
    return absolutePath;
  } catch (_error) {
    throw new CatalogError('Thumbnail not found', 404);
  }
}

async function getVideoThumbnail(key, youtubeId) {
  const policy = normalizePolicy(key);
  if (typeof youtubeId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
    throw new CatalogError('Thumbnail not found', 404);
  }
  const effectiveRating =
    'COALESCE(NULLIF(v.normalized_rating, \'\'), NULLIF(c.default_rating, \'\'))';
  const ratings = ratingSql(policy, effectiveRating);
  const rows = await sequelize.query(
    `SELECT cv.youtube_id, cv.thumbnail
       FROM channelvideos cv
       INNER JOIN channels c ON c.channel_id = cv.channel_id
       INNER JOIN api_key_channel_grants g
         ON g.channel_id = c.id AND g.api_key_id = :keyId
       LEFT JOIN videos v ON v.youtube_id = cv.youtube_id
      WHERE cv.youtube_id = :youtubeId
        AND c.enabled = true AND c.terminated_at IS NULL
        AND cv.youtube_removed = false AND cv.ignored = false
        AND cv.media_type IN (:allowedMediaTypes)
        AND ${ratings.sql}
      LIMIT 1`,
    {
      replacements: {
        keyId: key.id,
        youtubeId,
        allowedMediaTypes: policy.allowedMediaTypes,
        ...ratings.replacements,
      },
      type: QueryTypes.SELECT,
    }
  );
  if (rows.length === 0) throw new CatalogError('Thumbnail not found', 404);
  try {
    const imageDirectory = await fs.realpath(path.resolve(configModule.getImagePath()));
    const candidatePath = path.resolve(imageDirectory, `videothumb-${youtubeId}.jpg`);
    if (path.dirname(candidatePath) !== imageDirectory) throw new Error('unsafe path');
    const stat = await fs.lstat(candidatePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file');
    const absolutePath = await fs.realpath(candidatePath);
    if (path.dirname(absolutePath) !== imageDirectory) throw new Error('unsafe target');
    return { source: 'local', absolutePath };
  } catch (_error) {
    const upstreamUrl = publicVideoThumbnail(rows[0].thumbnail) ||
      `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    return { source: 'upstream', url: upstreamUrl };
  }
}

module.exports = {
  listChannels,
  listChannelVideos,
  listVideos,
  getVideoDetail,
  getChannelThumbnail,
  getVideoThumbnail,
  CatalogError,
  normalizePolicy,
  publicVideoThumbnail,
  videoThumbnailUrl,
  decodeCursor: decodePageCursor,
  encodeCursor: encodePageCursor,
  pagination,
  decodeCatalogCursor,
  encodeCatalogCursor,
  paginationDto,
};
