import { sanitizeWindowsFilename } from './sanitize';

export interface RenderResult {
  rendered: string;
  length: number;
  warnings: string[];
}

// yt-dlp template format: %(field_spec)[format_spec][conversion].
// Supported truncation forms are `.NB` for byte limits and `.Ns` for character
// limits; `.N` without a conversion char is rejected by yt-dlp and by validatePrefix.
const TOKEN_RE = /%\(([^)]+)\)(?:(\.\d+B)|(\.\d+)?([sdjlqUDS]))/g;

interface TokenSpec {
  field: string;
  fallbackChain: string[];
  dateFormat: string | null;
  byteLimit: number | null;
  charLimit: number | null;
  pipeFallback: string | null;
}

function parseSpec(rawInner: string, rawFormat: string): TokenSpec {
  // rawInner = contents inside %(...) — e.g. 'title', 'uploader,channel,uploader_id',
  //   'title|fallback', 'upload_date>%Y-%m-%d'.
  // rawFormat = format specifier between `)` and conversion char — e.g. '.76B', '.40'.
  let working = rawInner;
  let pipeFallback: string | null = null;
  if (working.includes('|')) {
    const idx = working.indexOf('|');
    pipeFallback = working.slice(idx + 1);
    working = working.slice(0, idx);
  }

  let dateFormat: string | null = null;
  if (working.includes('>')) {
    const idx = working.indexOf('>');
    dateFormat = working.slice(idx + 1);
    working = working.slice(0, idx);
  }

  let byteLimit: number | null = null;
  let charLimit: number | null = null;
  const truncMatch = rawFormat.match(/\.(\d+)(B?)$/);
  if (truncMatch) {
    const n = Number(truncMatch[1]);
    if (truncMatch[2] === 'B') byteLimit = n;
    else charLimit = n;
  }

  const fallbackChain = working.split(',').map((s) => s.trim()).filter(Boolean);
  const field = fallbackChain[0] ?? '';

  return { field, fallbackChain, dateFormat, byteLimit, charLimit, pipeFallback };
}

function resolveValue(
  spec: TokenSpec,
  metadata: Record<string, unknown>,
  warnings: string[],
  rawToken: string
): string | null {
  for (const candidate of spec.fallbackChain) {
    const value = metadata[candidate];
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }
  if (spec.pipeFallback !== null) return spec.pipeFallback;
  warnings.push(`Unsupported or missing field: ${rawToken}`);
  return null;
}

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function applyDateFormat(value: string, fmt: string): string {
  // yt-dlp upload_date is 'YYYYMMDD'. Implement the strftime tokens it documents:
  // %Y %y %m %d %H %M %S %j %B %b %A %a
  const year = value.slice(0, 4);
  const monthNum = value.slice(4, 6);
  const day = value.slice(6, 8);
  const monthIdx = Number(monthNum) - 1;
  const dateObj = new Date(`${year}-${monthNum}-${day}T00:00:00Z`);
  const map: Record<string, string> = {
    '%Y': year,
    '%y': year.slice(2),
    '%m': monthNum,
    '%d': day,
    '%H': '00',
    '%M': '00',
    '%S': '00',
    '%j': '001',
    '%B': MONTHS_LONG[monthIdx] ?? '',
    '%b': MONTHS_SHORT[monthIdx] ?? '',
    '%A': isNaN(dateObj.getTime()) ? '' : DAYS_LONG[dateObj.getUTCDay()],
    '%a': isNaN(dateObj.getTime()) ? '' : DAYS_SHORT[dateObj.getUTCDay()],
  };
  return fmt.replace(/%[YymdHMSjBbAa]/g, (tok) => map[tok] ?? tok);
}

function truncateBytes(value: string, limit: number): string {
  // UTF-8 byte truncation matching yt-dlp's .NB behavior.
  const enc = new TextEncoder();
  const bytes = enc.encode(value);
  if (bytes.length <= limit) return value;
  // Walk back until we land on a complete UTF-8 character boundary
  let cut = limit;
  while (cut > 0 && (bytes[cut] & 0xc0) === 0x80) cut -= 1;
  return new TextDecoder().decode(bytes.subarray(0, cut));
}

export interface PreviewResult {
  fileLine: string;
  folderLine: string;
  fileLineLength: number;
  folderLineLength: number;
  warnings: string[];
}

interface SubstituteResult {
  rendered: string;
  warnings: string[];
}

function substituteAndSanitize(
  prefix: string,
  metadata: Record<string, unknown>
): SubstituteResult {
  const warnings: string[] = [];
  const trimmedPrefix = prefix.replace(/\s+$/, '');

  const substituted = trimmedPrefix.replace(TOKEN_RE, (full, rawInner, byteFormat, charFormat) => {
    const rawFormat = String(byteFormat ?? charFormat ?? '');
    const spec = parseSpec(String(rawInner), String(rawFormat));
    const value = resolveValue(spec, metadata, warnings, full);
    if (value === null) return full; // leave literal so user sees what failed

    let out = value;
    if (spec.dateFormat) out = applyDateFormat(out, spec.dateFormat);
    if (spec.byteLimit !== null) out = truncateBytes(out, spec.byteLimit);
    else if (spec.charLimit !== null) out = out.slice(0, spec.charLimit);
    return out;
  });

  const sanitized = sanitizeWindowsFilename(substituted);
  return { rendered: sanitized, warnings };
}

export function renderTemplate(
  prefix: string,
  metadata: Record<string, unknown>
): RenderResult {
  const { rendered: sanitized, warnings } = substituteAndSanitize(prefix, metadata);
  const ext = String(metadata.ext ?? 'mp4');
  const id = String(metadata.id ?? '???????????');
  const suffix = `[${id}].${ext}`;
  const rendered = sanitized.length === 0 ? suffix : `${sanitized} ${suffix}`;

  return { rendered, length: rendered.length, warnings };
}

/**
 * Render both the per-video folder name and the file name from the same prefix,
 * mirroring the backend composers in `server/modules/filesystem/constants.js`:
 *   - File:   `<prefix> [<id>].<ext>`  (or `[<id>].<ext>` when prefix is empty)
 *   - Folder: `<prefix> - <id>`         (or `<id>` when prefix is empty)
 * Empty prefixes are invalid in saved config, but the preview still renders
 * them while the input displays its validation error.
 *
 * Both lines share a single substitution pass, so warnings are deduplicated
 * across them.
 */
export function renderForPreview(
  prefix: string,
  metadata: Record<string, unknown>
): PreviewResult {
  const { rendered: sanitized, warnings } = substituteAndSanitize(prefix, metadata);
  const ext = String(metadata.ext ?? 'mp4');
  const id = String(metadata.id ?? '???????????');

  const fileLine = sanitized.length === 0
    ? `[${id}].${ext}`
    : `${sanitized} [${id}].${ext}`;
  const folderLine = sanitized.length === 0
    ? id
    : `${sanitized} - ${id}`;

  return {
    fileLine,
    folderLine,
    fileLineLength: fileLine.length,
    folderLineLength: folderLine.length,
    warnings,
  };
}
