// Stderr line classifiers shared by the output router and the job finalizer
// so both agree on what counts as a 403.

// yt-dlp's PO-token advisory mentions "HTTP Error 403" without any request
// failing. It prints on every free-account cookie run, so it can't count as
// a 403.
const PO_TOKEN_ADVISORY_PATTERN = /require a GVS PO Token/i;

// Account-level SABR experiment. The per-client debug line ("forcing SABR
// streaming for this client") is normal for web/web_safari and isn't matched.
const SABR_RESTRICTION_PATTERN = /SABR-only streaming experiment/i;

const HTTP_403_PATTERNS = ['http error 403', '403: forbidden'];
const SPONSORBLOCK_ERROR_PATTERN = /^(?:(?:ERROR|WARNING):\s*)?Unable to communicate with SponsorBlock API\b/i;

function isNonFatalSponsorBlockError(line) {
  return SPONSORBLOCK_ERROR_PATTERN.test(String(line).trim());
}

function isPoTokenAdvisory(line) {
  return PO_TOKEN_ADVISORY_PATTERN.test(line);
}

function isSabrRestriction(line) {
  return SABR_RESTRICTION_PATTERN.test(line);
}

// A SponsorBlock lookup failure is not a YouTube authentication failure.
function containsHttp403(text) {
  return String(text).split('\n').some((line) => {
    if (isPoTokenAdvisory(line) || isNonFatalSponsorBlockError(line)) return false;
    const lower = line.toLowerCase();
    return HTTP_403_PATTERNS.some((pattern) => lower.includes(pattern));
  });
}

module.exports = {
  PO_TOKEN_ADVISORY_PATTERN,
  SABR_RESTRICTION_PATTERN,
  containsHttp403,
  isNonFatalSponsorBlockError,
  isPoTokenAdvisory,
  isSabrRestriction,
};
