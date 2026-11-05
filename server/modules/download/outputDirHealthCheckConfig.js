// The pre-download output directory health check (downloadExecutor
// .checkOutputDirectoryHealth) gives up after a fixed time so a stale NFS
// mount fails the job instead of hanging it. A slow but healthy share can
// need longer than the default (issue #988), so the limit is configurable
// through this environment variable, in whole seconds.
const OUTPUT_DIR_HEALTHCHECK_TIMEOUT_VARIABLE = 'OUTPUT_DIR_HEALTHCHECK_TIMEOUT';
const DEFAULT_OUTPUT_DIR_HEALTHCHECK_TIMEOUT_SECONDS = 10;
// Bounded well below Node's timer limit (2147483647 ms, above which a delay
// is clamped to 1 ms and every check would fail instantly); a share that needs
// longer than this to write one small file is not going to take a download.
const MAX_OUTPUT_DIR_HEALTHCHECK_TIMEOUT_SECONDS = 60 * 60;
const MS_PER_SECOND = 1000;
const WHOLE_SECONDS_PATTERN = /^[1-9]\d*$/;

function resolveOutputDirHealthCheckTimeout(env) {
  const fallbackMs = DEFAULT_OUTPUT_DIR_HEALTHCHECK_TIMEOUT_SECONDS * MS_PER_SECOND;
  const raw = env[OUTPUT_DIR_HEALTHCHECK_TIMEOUT_VARIABLE];
  const trimmed = raw === undefined || raw === null ? '' : String(raw).trim();
  if (trimmed === '') {
    return { timeoutMs: fallbackMs, warning: null };
  }
  if (!WHOLE_SECONDS_PATTERN.test(trimmed) || Number(trimmed) > MAX_OUTPUT_DIR_HEALTHCHECK_TIMEOUT_SECONDS) {
    return {
      timeoutMs: fallbackMs,
      warning: {
        variable: OUTPUT_DIR_HEALTHCHECK_TIMEOUT_VARIABLE,
        value: raw,
        fallback: DEFAULT_OUTPUT_DIR_HEALTHCHECK_TIMEOUT_SECONDS,
      },
    };
  }
  return { timeoutMs: Number(trimmed) * MS_PER_SECOND, warning: null };
}

module.exports = {
  OUTPUT_DIR_HEALTHCHECK_TIMEOUT_VARIABLE,
  DEFAULT_OUTPUT_DIR_HEALTHCHECK_TIMEOUT_SECONDS,
  MAX_OUTPUT_DIR_HEALTHCHECK_TIMEOUT_SECONDS,
  resolveOutputDirHealthCheckTimeout,
};
