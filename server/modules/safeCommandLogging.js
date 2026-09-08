const { URL } = require('url');

const SENSITIVE_VALUE_FLAGS = new Set([
  '--proxy',
  '--cookies',
  '--cookies-from-browser',
  '--add-header',
  '--add-headers',
  '--http-header',
  '--username',
  '--password',
  '--video-password',
  '--client-certificate',
  '--client-certificate-key',
  '--client-certificate-password',
  '--paths',
  '--paths-home',
  '--output',
  '-o',
  '--download-archive',
  '--cache-dir',
  '--ffmpeg-location',
  '--config-locations',
  '--exec',
]);
const SENSITIVE_FLAG_PATTERN = [...SENSITIVE_VALUE_FLAGS]
  .sort((left, right) => right.length - left.length)
  .map((flag) => flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const SENSITIVE_VALUE_PATTERN = new RegExp(
  `((${SENSITIVE_FLAG_PATTERN})(?:=|\\s+))(?:"[^"]*"|'[^']*'|\\S+)`,
  'gi'
);

function safeUrlHost(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.hostname : null;
  } catch (_error) {
    return null;
  }
}

function summarizeCommandArgs(args) {
  if (!Array.isArray(args)) return { argumentCount: 0, flags: [], targetHosts: [] };
  const flags = [];
  const hosts = [];
  let redactNext = false;
  for (const value of args) {
    const token = String(value);
    if (redactNext) {
      redactNext = false;
      continue;
    }
    if (token.startsWith('-')) {
      const flag = token.split('=', 1)[0];
      flags.push(flag);
      if (SENSITIVE_VALUE_FLAGS.has(flag) && !token.includes('=')) redactNext = true;
      continue;
    }
    const host = safeUrlHost(token);
    if (host) hosts.push(host);
  }
  return {
    argumentCount: args.length,
    flags: [...new Set(flags)].sort(),
    targetHosts: [...new Set(hosts)].sort(),
  };
}

function redactSensitiveText(value) {
  let text = String(value ?? '');
  text = text.replace(
    /((?:--add-header|--add-headers|--http-header)(?:=|\s+))[^\r\n]*/gi,
    '$1[REDACTED]'
  );
  text = text.replace(
    SENSITIVE_VALUE_PATTERN,
    '$1[REDACTED]'
  );
  text = text.replace(
    /\b(Authorization|Proxy-Authorization|Cookie|Set-Cookie)\s*:\s*[^\r\n]*/gi,
    '$1: [REDACTED]'
  );
  text = text.replace(
    /\b(https?:\/\/)([^/\s:@]+):([^@\s/]+)@/gi,
    '$1[REDACTED]@'
  );
  text = text.replace(
    /([?&](?:token|key|api_key|apikey|auth|authorization|signature|sig)=)[^&#\s]*/gi,
    '$1[REDACTED]'
  );
  text = text.replace(/\bfile:\/\/[^\s"'<>]+/gi, '[REDACTED_PATH]');
  text = text.replace(
    /(^|[\s"'=(])(?:\/(?:[^/\s"'<>]+\/)*[^/\s"'<>]+|[A-Za-z]:\\(?:[^\\\s"'<>]+\\)*[^\\\s"'<>]+)/g,
    '$1[REDACTED_PATH]'
  );
  return text;
}

module.exports = {
  SENSITIVE_VALUE_FLAGS,
  summarizeCommandArgs,
  redactSensitiveText,
  safeUrlHost,
};
