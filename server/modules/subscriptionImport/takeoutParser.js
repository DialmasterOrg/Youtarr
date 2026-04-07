'use strict';

const logger = require('../../logger');

// Channel ID pattern: starts with UC followed by 10+ word characters or hyphens.
// Real YouTube channel IDs are 24 chars total (UC + 22), but we use a loose lower
// bound so test fixtures and edge cases are not rejected incorrectly.
const CHANNEL_ID_RE = /^UC[\w-]{10,}$/;

// UTF-8 BOM character
const UTF8_BOM = '\uFEFF';

/**
 * Custom error class for CSV parse failures.
 */
class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Parse a single CSV line, handling quoted fields and escaped double-quotes.
 * Returns an array of field strings. The Google Takeout format uses exactly
 * 3 columns: Channel Id, Channel Url, Channel Title.
 *
 * @param {string} line - A single CSV line
 * @returns {string[]} - Array of parsed field values
 */
function parseCsvLine(line) {
  const fields = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      // End of line — push empty field if we haven't consumed everything
      fields.push('');
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let field = '';
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // Escaped double-quote
            field += '"';
            i += 2;
          } else {
            // Closing quote
            i++;
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      // Advance past the comma separator if present
      if (i < line.length && line[i] === ',') {
        i++;
      }
    } else {
      // Unquoted field — read until comma or end of line
      let field = '';
      while (i < line.length && line[i] !== ',') {
        field += line[i];
        i++;
      }
      fields.push(field);
      if (i < line.length && line[i] === ',') {
        i++; // skip comma
      } else {
        break; // end of line
      }
    }
  }

  return fields;
}

/**
 * Parse a Google Takeout subscriptions CSV buffer into an array of channel objects.
 *
 * The Takeout CSV has exactly 3 columns in this order regardless of locale:
 *   Channel Id, Channel Url, Channel Title
 *
 * @param {Buffer} buffer - Raw file buffer (may include UTF-8 BOM)
 * @returns {{ channelId: string, url: string, title: string }[]}
 * @throws {ParseError} on empty file, missing header, or no valid channel rows
 */
function parseCsv(buffer) {
  let text = buffer.toString('utf8');

  // Strip UTF-8 BOM if present
  if (text.startsWith(UTF8_BOM)) {
    text = text.slice(1);
  }

  if (text.trim().length === 0) {
    throw new ParseError('Empty file: the CSV buffer contains no content');
  }

  const lines = text.split('\n');

  // The first non-empty line must be a header (3 columns, middle column looks like a URL header)
  // We don't verify exact header text (locale-dependent) but do require exactly 3 comma-separated
  // columns in the first line. We detect a header by confirming the first field does NOT look like
  // a channel ID — if it starts with UC and is long enough, the header is missing.
  const firstLine = lines[0].trim();
  const headerFields = parseCsvLine(firstLine);

  if (headerFields.length < 3) {
    throw new ParseError('Missing header: expected 3 columns (Channel Id, Channel Url, Channel Title)');
  }

  // If the first field looks like a real channel ID, there's no header
  if (CHANNEL_ID_RE.test(headerFields[0])) {
    throw new ParseError('Missing header: first row appears to be data, not a header row');
  }

  logger.debug({ lineCount: lines.length - 1 }, 'Parsing Takeout CSV');

  const seen = new Set();
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip blank lines
    if (line.length === 0) {
      continue;
    }

    const fields = parseCsvLine(line);
    if (fields.length < 3) {
      logger.debug({ lineNumber: i + 1, line }, 'Skipping malformed CSV row (fewer than 3 fields)');
      continue;
    }

    const channelId = fields[0].trim();
    const rawUrl = fields[1].trim();
    const title = fields[2].trim();

    // Validate channel ID format
    if (!CHANNEL_ID_RE.test(channelId)) {
      logger.debug({ lineNumber: i + 1, channelId }, 'Skipping row with invalid channel ID');
      continue;
    }

    // Deduplicate by channel ID — keep the first occurrence
    if (seen.has(channelId)) {
      logger.debug({ channelId }, 'Skipping duplicate channel ID');
      continue;
    }
    seen.add(channelId);

    // Normalize http:// to https://
    const url = rawUrl.replace(/^http:\/\//, 'https://');

    results.push({ channelId, url, title });
  }

  if (results.length === 0) {
    throw new ParseError('No valid channel rows found after filtering invalid channel IDs');
  }

  logger.info({ channelCount: results.length }, 'Takeout CSV parsed successfully');
  return results;
}

module.exports = { parseCsv, ParseError };
