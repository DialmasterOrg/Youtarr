const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareReleaseNotes, prependChangelog } = require('../release-notes');

const repository = 'DialmasterOrg/Youtarr';
const repoUrl = `https://github.com/${repository}`;

function prepare({ version = '1.84.0', level = '##', body = '### Features\n\n* A new feature', previousTag = 'vv1.83.1' } = {}) {
  return prepareReleaseNotes({
    repository,
    newTag: `v${version}`,
    previousTag,
    changelog: `${level} [${version}](${repoUrl}/compare/${previousTag}...v${version}) (2026-09-18)\n\n${body}`
  });
}

for (const [version, level] of [['2.0.0', '##'], ['1.84.0', '##'], ['1.83.2', '###']]) {
  test(`release ${version} has one heading and extractable notes`, () => {
    const notes = prepare({ version, level });
    const history = prepare({ version: '1.83.1', level: '###', previousTag: 'v1.83.0' });
    const changelog = prependChangelog(prependChangelog('', history.entry), notes.entry);
    // Consumers such as Renovate stop at the next heading of the same level.
    const section = changelog.split(/^## /m)[1];
    assert.ok(section.startsWith(`[v${version}]`));
    assert.ok(section.includes('### Features\n\n* A new feature'));
    assert.equal((notes.entry.match(/^#{2,3} \[v?\d/gm) || []).length, 1);
    assert.equal(notes.compare_url, `${repoUrl}/compare/v1.83.1...v${version}`);
    assert.equal(notes.previous_tag, 'v1.83.1');
  });
}

test('preserves category headings, links, and shell-sensitive commit text', () => {
  const body = '### Bug Fixes\n\n* Keep `code`, $HOME, $(echo nope), "quotes", and [links](https://example.com)\n\n### Documentation\n\n* Update docs';
  assert.equal(prepare({ body, previousTag: 'v1.83.1' }).body, body);
});

test('accepts CRLF notes without changing the generated date', () => {
  const notes = prepareReleaseNotes({
    repository,
    newTag: 'v1.84.0',
    previousTag: 'v1.83.1',
    changelog: `\r\n## [1.84.0](${repoUrl}/compare/v1.83.1...v1.84.0) (2026-09-17)\r\n\r\n### Features\r\n\r\n* Feature\r\n`
  });
  assert.ok(notes.entry.includes(' - 2026-09-17\n\n### Features'));
  assert.equal(notes.body, '### Features\n\n* Feature');
});

test('gives releases without listed changes a nonempty body', () => {
  assert.equal(prepare({ body: '' }).body, 'No changes listed.');
});

test('rejects unexpected generated headings instead of publishing malformed notes', () => {
  const input = { repository, newTag: 'v1.84.0', previousTag: 'v1.83.1' };
  for (const changelog of ['', '### Features\n\n* Feature', `## [1.85.0](${repoUrl}) (2026-09-18)`]) {
    assert.throws(() => prepareReleaseNotes({ ...input, changelog }), /expected release version heading/);
  }
  assert.throws(() => prepare({ version: 'v1.84.0' }), /one v prefix/);
});

test('prepending preserves existing entries and writes one top-level title', () => {
  const oldEntry = prepare({ version: '1.83.1', level: '###', previousTag: 'v1.83.0' }).entry;
  const newEntry = prepare().entry;
  const existing = prependChangelog('', oldEntry);
  assert.equal(prependChangelog(existing, newEntry), `# Changelog\n\n${newEntry}\n\n${oldEntry}\n`);
  assert.throws(() => prependChangelog('Unexpected file content', newEntry), /must start with # Changelog/);
});
