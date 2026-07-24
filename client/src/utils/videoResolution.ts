/**
 * Display-side interpretation of a video's stored pixel dimensions
 * (Videos.video_resolution, e.g. "1920x1080") into the resolution tier label
 * shown by the listing chips and the video detail modal. The database stores
 * only measured facts; changing how tiers are labeled is a change here, with
 * no migration or re-probe of the library.
 */

// YouTube's transcode ladder. Downloaded files always come off this ladder,
// so snapping absorbs encoder rounding (854x480 crops, mod-16 sizes).
const TIER_LADDER = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320];

const WIDE_ASPECT = 16 / 9;

// A computed value this close below a rung is encoder rounding (mod-16 crops
// like 1904x816 computing to 1071) and rounds up; anything further below a
// rung belongs to the rung beneath it.
const SNAP_UP_TOLERANCE = 1.05;

function snapToLadder(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const eligible = TIER_LADDER.filter((tier) => tier <= value * SNAP_UP_TOLERANCE);
  return eligible.length > 0 ? eligible[eligible.length - 1] : TIER_LADDER[0];
}

function ceilToLadder(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  for (const tier of TIER_LADDER) {
    if (tier >= value) return tier;
  }
  return TIER_LADDER[TIER_LADDER.length - 1];
}

/**
 * Parse a stored "WIDTHxHEIGHT" string. Returns null for missing, malformed,
 * or zero values (the backend stamps "0x0" when a probe failed).
 */
export function parseResolution(
  value: string | null | undefined
): { width: number; height: number } | null {
  if (!value) return null;
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * Map pixel dimensions to the resolution tier shown in the app.
 *
 * Landscape: YouTube fits each video into a 16:9 bounding box per tier, so
 * videos wider than 16:9 max out the box's long edge (tier = long edge *
 * 9/16: cinemascope 1920x816 -> 1080) while squarer ones max the short edge
 * (16:9 1920x1080 -> 1080, 4:3 640x480 -> 480), floor-snapped to the ladder.
 *
 * Vertical (height > width): labeled by the SELECTION class, the smallest
 * rung >= pixel height, because the yt-dlp format cap selects on pixel
 * height. This deliberately diverges from YouTube's short-edge naming
 * (YouTube calls 1080x1920 "1080p") so the label always matches the
 * resolution the user selected: a 1080 cap downloads 608x1080 -> 1080p, a
 * 2160 cap downloads 1080x1920 -> 2160p.
 */
export function tierFromDimensions(
  width: number | null | undefined,
  height: number | null | undefined
): number | null {
  const hasWidth = typeof width === 'number' && Number.isFinite(width) && width > 0;
  const hasHeight = typeof height === 'number' && Number.isFinite(height) && height > 0;
  if (!hasWidth || !hasHeight) {
    return hasHeight ? snapToLadder(height as number) : null;
  }

  const w = width as number;
  const h = height as number;
  if (h > w) {
    return ceilToLadder(h);
  }

  if (w / h >= WIDE_ASPECT) {
    return snapToLadder((w * 9) / 16);
  }
  return snapToLadder(h);
}

/**
 * Tier label for a stored "WIDTHxHEIGHT" string, e.g. "1080p".
 * Null when the value is missing, malformed, or the "0x0" probe-failed
 * sentinel; callers render no chip in that case.
 */
export function resolutionTierLabel(value: string | null | undefined): string | null {
  const dims = parseResolution(value);
  if (!dims) return null;
  const tier = tierFromDimensions(dims.width, dims.height);
  return tier !== null ? `${tier}p` : null;
}
