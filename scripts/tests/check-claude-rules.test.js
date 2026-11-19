const { test } = require('node:test');
const assert = require('node:assert/strict');
const { expandBraces, findProblems, globMatchesAny, parsePaths } = require('../check-claude-rules');

const rule = (...globs) => `---\npaths:\n${globs.map((glob) => `  - "${glob}"`).join('\n')}\n---\n\n# Rule\n`;

test('a double star directory glob matches any depth under its root', () => {
  assert.equal(globMatchesAny('server/**/*', ['server/a.js']), true);
  assert.equal(globMatchesAny('server/**/*', ['server/modules/deep/a.js']), true);
  assert.equal(globMatchesAny('server/**/*', ['client/a.js']), false);
});

test('a leading double star also matches at the repository root', () => {
  assert.equal(globMatchesAny('**/__tests__/**/*', ['__tests__/a.js']), true);
  assert.equal(globMatchesAny('**/__tests__/**/*', ['server/__tests__/a.js']), true);
  assert.equal(globMatchesAny('**/*.test.js', ['a.test.js']), true);
});

test('a single star stays inside one path segment', () => {
  assert.equal(globMatchesAny('hooks/use*.ts', ['hooks/useThing.ts']), true);
  assert.equal(globMatchesAny('hooks/use*.ts', ['hooks/nested/useThing.ts']), false);
});

test('a dot in a glob is literal', () => {
  assert.equal(globMatchesAny('server/db.js', ['server/db.js']), true);
  assert.equal(globMatchesAny('server/db.js', ['server/dbxjs']), false);
});

test('brace groups expand into every option', () => {
  assert.deepEqual(expandBraces('src/a.{ts,tsx}'), ['src/a.ts', 'src/a.tsx']);
  assert.equal(globMatchesAny('src/a.{ts,tsx}', ['src/a.tsx']), true);
});

test('parsePaths reads quoted and unquoted list items', () => {
  assert.deepEqual(parsePaths('---\npaths:\n  - "a/**/*"\n  - b.js\n---\nBody'), ['a/**/*', 'b.js']);
});

test('parsePaths ignores list items outside the paths key', () => {
  assert.deepEqual(parsePaths('---\npaths:\n  - "a.js"\nother:\n  - "b.js"\n---\n'), ['a.js']);
});

test('parsePaths returns null without frontmatter, a paths key, or any items', () => {
  assert.equal(parsePaths('# No frontmatter\n- "a.js"\n'), null);
  assert.equal(parsePaths('---\ndescription: x\n---\n'), null);
  assert.equal(parsePaths('---\npaths:\n---\n'), null);
});

test('findProblems reports nothing when every glob matches a file', () => {
  assert.deepEqual(findProblems([{ name: 'a.md', content: rule('src/**/*') }], ['src/a.js']), []);
});

test('findProblems names the rule and each glob that matches no file', () => {
  const problems = findProblems([{ name: 'a.md', content: rule('src/**/*', 'gone.js') }], ['src/a.js']);
  assert.deepEqual(problems, ['a.md: "gone.js" matches no file']);
});

test('findProblems reports a rule with no paths list', () => {
  const problems = findProblems([{ name: 'a.md', content: '# Rule\n' }], ['src/a.js']);
  assert.deepEqual(problems, ['a.md: no "paths:" list in its frontmatter']);
});
