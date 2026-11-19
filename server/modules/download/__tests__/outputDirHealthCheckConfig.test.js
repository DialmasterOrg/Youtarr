/* eslint-env jest */
const {
  OUTPUT_DIR_HEALTHCHECK_TIMEOUT_VARIABLE,
  resolveOutputDirHealthCheckTimeout,
} = require('../outputDirHealthCheckConfig');

describe('resolveOutputDirHealthCheckTimeout', () => {
  test('names the environment variable', () => {
    expect(OUTPUT_DIR_HEALTHCHECK_TIMEOUT_VARIABLE).toBe('OUTPUT_DIR_HEALTHCHECK_TIMEOUT');
  });

  test('defaults to 10 seconds when the variable is unset', () => {
    expect(resolveOutputDirHealthCheckTimeout({})).toEqual({ timeoutMs: 10000, warning: null });
  });

  test('treats a blank value as unset', () => {
    expect(resolveOutputDirHealthCheckTimeout({ OUTPUT_DIR_HEALTHCHECK_TIMEOUT: '  ' }))
      .toEqual({ timeoutMs: 10000, warning: null });
  });

  test.each([
    ['45', 45000],
    ['1', 1000],
    [' 120 ', 120000],
    ['3600', 3600000],
  ])('reads OUTPUT_DIR_HEALTHCHECK_TIMEOUT=%p as whole seconds', (value, timeoutMs) => {
    expect(resolveOutputDirHealthCheckTimeout({ OUTPUT_DIR_HEALTHCHECK_TIMEOUT: value }))
      .toEqual({ timeoutMs, warning: null });
  });

  // Node clamps timer delays above 2147483647 ms to 1 ms, so an unbounded
  // value would make every health check fail instantly.
  test.each(['0', '-5', '2.5', '45s', '45000ms', 'fast', '3601', '2147484'])(
    'falls back to 10 seconds with a warning for OUTPUT_DIR_HEALTHCHECK_TIMEOUT=%p',
    (value) => {
      expect(resolveOutputDirHealthCheckTimeout({ OUTPUT_DIR_HEALTHCHECK_TIMEOUT: value })).toEqual({
        timeoutMs: 10000,
        warning: { variable: 'OUTPUT_DIR_HEALTHCHECK_TIMEOUT', value, fallback: 10 },
      });
    }
  );
});
