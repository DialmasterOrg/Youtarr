export interface ParsedUrl {
  url: string;
  youtubeId: string;
}

export interface BulkParseResult {
  valid: ParsedUrl[];
  duplicates: string[];
  invalid: string[];
  playlistLines: string[];
}

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

function extractVideoId(raw: string): string | null {
  let trimmed = raw.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const pathSegments = parsed.pathname.split('/').filter(Boolean);

  const isYoutubeDomain =
    hostname === 'youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'music.youtube.com';

  if (hostname === 'youtu.be') {
    const candidate = pathSegments[0];
    if (candidate && VIDEO_ID_PATTERN.test(candidate)) {
      return candidate;
    }
    return null;
  }

  if (!isYoutubeDomain) return null;

  if (pathSegments[0] === 'watch') {
    const candidate = parsed.searchParams.get('v');
    if (candidate && VIDEO_ID_PATTERN.test(candidate)) {
      return candidate;
    }
  } else if (
    pathSegments[0] === 'shorts' ||
    pathSegments[0] === 'embed' ||
    pathSegments[0] === 'live'
  ) {
    const candidate = pathSegments[1];
    if (candidate && VIDEO_ID_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isPlaylistUrl(line: string): boolean {
  return /[?&]list=|\/playlist\b/i.test(line);
}

function isLikelyUrl(line: string): boolean {
  return /youtube\.com|youtu\.be/i.test(line);
}

export function parseYoutubeUrls(
  text: string,
  existingIds: Set<string>
): BulkParseResult {
  const lines = text
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const valid: ParsedUrl[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  const playlistLines: string[] = [];
  const seenIds = new Set<string>();

  for (const line of lines) {
    if (isPlaylistUrl(line) && !extractVideoId(line)) {
      playlistLines.push(line);
      continue;
    }

    const videoId = extractVideoId(line);

    if (!videoId) {
      if (isLikelyUrl(line)) {
        invalid.push(line);
      } else if (line.length > 0) {
        invalid.push(line);
      }
      continue;
    }

    if (existingIds.has(videoId) || seenIds.has(videoId)) {
      duplicates.push(line);
      continue;
    }

    seenIds.add(videoId);
    valid.push({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      youtubeId: videoId,
    });
  }

  return { valid, duplicates, invalid, playlistLines };
}
