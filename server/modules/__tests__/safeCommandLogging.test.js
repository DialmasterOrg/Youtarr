const {
  summarizeCommandArgs,
  redactSensitiveText,
} = require('../safeCommandLogging');

describe('safe command logging', () => {
  test('summarizes command arguments without retaining values', () => {
    const summary = summarizeCommandArgs([
      '--proxy', 'https://user:secret@proxy.example:8443',
      '--cookies', '/private/cookies.txt',
      '--add-header', 'Authorization: Bearer sentinel',
      'https://www.youtube.com/watch?v=abcdefghijk',
    ]);
    expect(summary).toEqual({
      argumentCount: 7,
      flags: ['--add-header', '--cookies', '--proxy'],
      targetHosts: ['www.youtube.com'],
    });
    expect(JSON.stringify(summary)).not.toMatch(/secret|cookies\.txt|sentinel/);
  });

  test('redacts proxy, cookie, header, query, and filesystem sentinels', () => {
    const result = redactSensitiveText(
      'failed --proxy https://user:secret@proxy.example ' +
      '--cookies /private/cookies.txt --add-header "Cookie: cookie-sentinel" ' +
      'Authorization: Bearer bearer-sentinel\n' +
      '--client-certificate-password cert-sentinel ' +
      '--client-certificate-key=relative/private-key.pem ' +
      'https://x.test/a?token=query-sentinel&ok=1 ' +
      'Destination: /downloads/private/path-sentinel/video.mp4'
    );
    expect(result).not.toMatch(
      /user:secret|cookies\.txt|cookie-sentinel|bearer-sentinel|cert-sentinel|private-key|query-sentinel|path-sentinel/
    );
    expect(result).toContain('[REDACTED]');
    expect(result).toContain('[REDACTED_PATH]');
  });
});
