import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import {manifest, discoverMarkdownSources} from './manifest.mjs';
import {DocumentationLinkError, formatLinkAnnotation, extractHeadingSlugs, rewriteLinks, assertManifest, generate} from './generate-content.mjs';

test('manifest has unique ids and slugs', () => { assert.equal(new Set(manifest.map((x) => x.id)).size, manifest.length); assert.equal(new Set(manifest.map((x) => x.slug)).size, manifest.length); });
test('canonical corpus covers every eligible source exactly once', () => {
  const eligible = discoverMarkdownSources();
  const sources = manifest.map((item) => item.source);
  assert.deepEqual(sources, eligible);
  assert.equal(new Set(sources).size, sources.length);
  for (const source of ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'LICENSE.md', 'CONTRIBUTORS.md']) assert.ok(sources.includes(source));
  assert.ok(sources.some((source) => source.endsWith('YOUTARR_DOWNLOADS_FOLDER_STRUCTURE.md')));
  assert.ok(sources.includes('docs/platforms/asustor.md'));
});
test('source discovery adds Markdown files and excludes CLAUDE.md', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-manifest-'));
  fs.mkdirSync(path.join(tmp, 'docs', 'nested'), {recursive: true});
  fs.writeFileSync(path.join(tmp, 'README.md'), '# README');
  fs.writeFileSync(path.join(tmp, 'docs', 'new-guide.md'), '# New guide');
  fs.writeFileSync(path.join(tmp, 'docs', 'nested', 'guide.md'), '# Nested guide');
  fs.writeFileSync(path.join(tmp, 'docs', 'CLAUDE.md'), '# Internal instructions');
  assert.deepEqual(discoverMarkdownSources(tmp), ['README.md', 'docs/nested/guide.md', 'docs/new-guide.md'].sort((a, b) => a.localeCompare(b)));
});
test('manifest sources are relative and safe', () => manifest.forEach((x) => { assert.ok(!x.source.startsWith('/')); assert.ok(!x.source.includes('..')); }));
test('manifest validation rejects missing, duplicate, and unsafe entries', () => {
  assert.throws(() => assertManifest([{id:'x', slug:'x', source:'missing.md'}]), /missing source/);
  assert.throws(() => assertManifest([{id:'x', slug:'x', source:'README.md'}, {id:'x', slug:'y', source:'README.md'}]), /duplicate/);
  assert.throws(() => assertManifest([{id:'x', slug:'x', source:'README.md'}, {id:'y', slug:'x', source:'README.md'}]), /duplicate/);
  assert.throws(() => assertManifest([{id:'../x', slug:'x', source:'README.md'}]), /unsafe/);
  assert.throws(() => assertManifest([{id:'x', slug:'bad_slug', source:'README.md'}]), /unsafe/);
  assert.throws(() => assertManifest([{id:'x', slug:'x', source:'../README.md'}]), /unsafe/);
});
test('same-page and cross-page links use rendered Docusaurus anchors', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-docs-'));
  fs.mkdirSync(path.join(tmp, 'docs'));
  const sectionHeading = 'Section';
  const partHeading = 'Part';
  const slugger = new GithubSlugger();
  const sectionSlug = slugger.slug(sectionHeading);
  const partSlug = slugger.slug(partHeading);
  fs.writeFileSync(path.join(tmp, 'docs', 'a.md'), `# ${sectionHeading}\n[Section](#${sectionSlug})\n[B](b.md#${partSlug})`);
  fs.writeFileSync(path.join(tmp, 'docs', 'b.md'), `# ${partHeading}`);
  const routes = new Map([['docs/a.md', 'a'], ['docs/b.md', 'b']]);
  const rewritten = rewriteLinks(fs.readFileSync(path.join(tmp, 'docs', 'a.md'), 'utf8'), 'docs/a.md', routes, tmp);
  assert.ok(rewritten.includes(`[Section](#${sectionSlug})`));
  assert.ok(rewritten.includes(`/docs/b#${partSlug}`));
  assert.equal(rewriteLinks('[Missing](#missing)', 'docs/a.md', routes, tmp), '[Missing](#missing)');
  assert.throws(() => rewriteLinks('[X](missing.md)', 'docs/a.md', routes, tmp), /Broken link "missing.md"/);
  assert.throws(() => rewriteLinks('![x](missing.png)', 'docs/a.md', routes, tmp), /Broken link "missing.png"/);
});

test('broken links across documents are reported together with original source lines and fixes', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-link-errors-'));
  t.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
  fs.mkdirSync(path.join(tmp, 'docs'));
  fs.writeFileSync(path.join(tmp, 'docker-compose-gluetun.yml'), 'services: {}');
  fs.writeFileSync(path.join(tmp, 'docs', 'BACKUP_RESTORE.md'), '# Backup\n');
  fs.writeFileSync(path.join(tmp, 'docs', 'GLUETUN_INTEGRATION.md'), [
    '---', 'title: Gluetun', '---', '', '# Gluetun', '',
    '[Backup](docs/BACKUP_RESTORE.md#backup)',
    '[Compose](/docker-compose-gluetun.yml)',
    '[Compose](docker-compose-gluetun.yml)',
  ].join('\r\n'));
  fs.writeFileSync(path.join(tmp, 'docs', 'OTHER.md'), '# Other\n![Screenshot](missing.png)\n');
  await assert.rejects(generate({root: tmp, outputRoot: path.join(tmp, 'output')}), (error) => {
    assert.ok(error instanceof DocumentationLinkError);
    assert.equal(error.issues.length, 4);
    assert.match(error.message, /Found 4 broken documentation links/);
    assert.deepEqual(error.issues.map(({source, line}) => [source, line]), [
      ['docs/GLUETUN_INTEGRATION.md', 7],
      ['docs/GLUETUN_INTEGRATION.md', 8],
      ['docs/GLUETUN_INTEGRATION.md', 9],
      ['docs/OTHER.md', 2],
    ]);
    assert.match(error.issues[0].message, /Looked for "docs\/docs\/BACKUP_RESTORE.md"/);
    assert.match(error.issues[0].message, /Try "BACKUP_RESTORE.md#backup"/);
    assert.match(error.issues[1].message, /A leading \/ points to the filesystem root/);
    assert.match(error.issues[1].message, /full GitHub URL/);
    assert.doesNotMatch(error.issues[1].message, /Try /);
    assert.match(error.issues[2].message, /Looked for "docs\/docker-compose-gluetun.yml"/);
    assert.match(error.issues[2].message, /full GitHub URL/);
    assert.doesNotMatch(error.issues[2].message, /Try /);
    assert.match(error.issues[3].message, /Check the filename, capitalization/);
    assert.doesNotMatch(error.issues[3].message, /Try /);
    return true;
  });
});

test('asset suggestions never offer relative paths for unpublished non-Markdown files', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-asset-hints-'));
  t.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
  fs.mkdirSync(path.join(tmp, 'docs', 'images'), {recursive: true});
  fs.mkdirSync(path.join(tmp, 'docs-assets'));
  fs.writeFileSync(path.join(tmp, 'docs', 'images', 'status.png'), 'image fixture');
  fs.writeFileSync(path.join(tmp, 'docs-assets', 'status.png'), 'image fixture');
  fs.writeFileSync(path.join(tmp, 'docs', 'compose.yml'), 'services: {}');
  fs.writeFileSync(path.join(tmp, 'docs', 'guide.md'), '# Guide');
  const routes = new Map([['docs/guide.md', 'guide']]);
  const body = [
    '![Docs image](docs/images/status.png)',
    '![Repository image](docs-assets/status.png)',
    '[Compose](docs/compose.yml)',
    '[Directory](docs/images)',
  ].join('\n');
  assert.throws(() => rewriteLinks(body, 'docs/guide.md', routes, tmp), (error) => {
    assert.ok(error instanceof DocumentationLinkError);
    assert.equal(error.issues.length, 4);
    for (const issue of error.issues.slice(0, 2)) {
      assert.match(issue.message, /Publish this image under website\/static\//);
      assert.doesNotMatch(issue.message, /GitHub URL/);
    }
    assert.match(error.issues[2].message, /full GitHub URL/);
    for (const issue of error.issues) assert.doesNotMatch(issue.message, /Try /);
    return true;
  });
});

test('GitHub annotations attach errors to source lines and escape workflow command characters', () => {
  assert.equal(formatLinkAnnotation({source: 'docs/guide.md', line: 12, message: 'Broken link "missing.md".'}),
    '::error file=docs/guide.md,line=12,title=Broken documentation link::Broken link "missing.md".');
  const annotation = formatLinkAnnotation({
    source: 'docs/a,b:c%\r\n.md',
    line: 3,
    message: 'Missing 100%\r\n::warning::example',
  });
  assert.equal(annotation, '::error file=docs/a%2Cb%3Ac%25%0D%0A.md,line=3,title=Broken documentation link::Missing 100%25%0D%0A::warning::example');
});

test('link checks ignore code examples but still report links after code blocks', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-code-links-'));
  t.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
  const body = [
    'Use `result.current[1](64)` or `[Example](missing.md)`.',
    '',
    '````markdown',
    '```js',
    'result.current[1](32);',
    '```',
    '[Example](missing.md)',
    '````',
    '',
    '    [Indented example](missing.md)',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(tmp, 'a.md'), body);
  const routes = new Map([['a.md', 'a']]);
  assert.equal(rewriteLinks(body, 'a.md', routes, tmp), body);
  assert.throws(() => rewriteLinks(body + '\n[Real link](missing.md)', 'a.md', routes, tmp), (error) => {
    assert.ok(error instanceof DocumentationLinkError);
    assert.equal(error.issues.length, 1);
    assert.equal(error.issues[0].line, 12);
    return true;
  });
});

test('heading extraction uses parsed headings and visible text', () => {
  const linkedHeadingText = 'Linked heading';
  const setextHeadingText = 'Setext heading';
  const customHeadingText = 'Custom heading';
  const realHeadingText = 'Real heading';
  const markdown = [
    `## [${linkedHeadingText}](https://example.com)`,
    '',
    '````markdown',
    '```markdown',
    '# Not a heading',
    '```',
    '````',
    '',
    setextHeadingText,
    '================',
    '',
    `### ${customHeadingText} {#custom-anchor}`,
    `# ${realHeadingText}`,
  ].join('\n');
  const slugger = new GithubSlugger();
  const expected = [
    slugger.slug(linkedHeadingText),
    slugger.slug(setextHeadingText),
    'custom-anchor',
    slugger.slug(realHeadingText),
  ];
  assert.deepEqual(extractHeadingSlugs(markdown), expected);
});

test('heading extraction ignores headings inside fenced code blocks', () => {
  assert.deepEqual(extractHeadingSlugs('````markdown\n```markdown\n# Not a heading\n```\n````\n# Real heading\n'), ['real-heading']);
});

test('emoji-prefixed Docker anchors use the actual Docusaurus slug', () => {
  const dockerSource = fs.readFileSync(path.resolve(new URL('../../docs/DOCKER.md', import.meta.url).pathname), 'utf8');
  const dockerLink = dockerSource.match(/\[[^\]]+\]\(#-important-do-not-mount-the-migrations-directory\)/)?.[0];
  assert.ok(dockerLink);
  const dockerHeading = dockerSource.match(/^##\s+(.+Do Not Mount the Migrations Directory)$/m)?.[1];
  assert.ok(dockerHeading);
  const slugger = new GithubSlugger();
  const expectedAnchor = `#${slugger.slug(dockerHeading)}`;
  assert.ok(expectedAnchor.slice(1).startsWith('\uFE0F-'));
  assert.equal(
    rewriteLinks(dockerLink, 'docs/DOCKER.md', new Map([['docs/DOCKER.md', 'docker']])),
    dockerLink.replace(/\((#[^)]+)\)/, `(/docs/docker${expectedAnchor})`),
  );
});

test('heading anchor resolution preserves exact IDs and rejects ambiguous normalized matches', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-anchor-collision-'));
  fs.mkdirSync(path.join(tmp, 'docs'));
  const warningHeading = `${String.fromCodePoint(0x26a0)}${String.fromCodePoint(0xfe0f)} Warning`;
  const hyphenHeading = '-Warning';
  fs.writeFileSync(path.join(tmp, 'docs', 'a.md'), [
    `[Exact](b.md#${new GithubSlugger().slug(warningHeading)})`,
    `[Ambiguous](b.md#${String.fromCodePoint(0xfe0f)}-${String.fromCodePoint(0xfe0f)}warning)`,
  ].join('\n'));
  fs.writeFileSync(path.join(tmp, 'docs', 'b.md'), `## ${warningHeading}\n## ${hyphenHeading}`);
  const routes = new Map([['docs/a.md', 'a'], ['docs/b.md', 'b']]);
  const slugger = new GithubSlugger();
  const exactSlug = slugger.slug(warningHeading);
  const secondSlug = slugger.slug(hyphenHeading);
  const rewritten = rewriteLinks(fs.readFileSync(path.join(tmp, 'docs', 'a.md'), 'utf8'), 'docs/a.md', routes, tmp);
  assert.ok(rewritten.includes(`[Exact](/docs/b#${exactSlug})`));
  assert.ok(rewritten.includes(`[Ambiguous](/docs/b#${String.fromCodePoint(0xfe0f)}-${String.fromCodePoint(0xfe0f)}warning)`));
  assert.equal(secondSlug, '-warning');
});
test('safe MDX preserves intentional HTML, inline code, and escapes placeholders/braces', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-html-'));
  const tick = String.fromCharCode(96);
  const variable = String.fromCharCode(36) + '{YOUTUBE_OUTPUT_DIR}';
  const placeholder = String.fromCharCode(36) + '{VALUE}';
  fs.writeFileSync(path.join(tmp, 'a.md'), '<details><summary>More</summary><img src="x.png" /></details>\nUse <YOUR_PATH> and {unsafe}; run ' + tick + variable + tick + ' and ' + tick + 'echo ' + placeholder + tick);
  const routes = new Map([['a.md', 'a']]);
  const output = rewriteLinks(fs.readFileSync(path.join(tmp, 'a.md'), 'utf8'), 'a.md', routes, tmp);
  assert.match(output, /<details><summary>More<\/summary><img src="x\.png" \/><\/details>/);
  assert.match(output, /&amp;#123;|&#123;/);
  assert.match(output, /&lt;YOUR_PATH&gt;/);
  assert.ok(output.includes(tick + variable + tick));
  assert.ok(output.includes(tick + 'echo ' + placeholder + tick));
});
test('generated OpenAPI is nonempty and representative quick-start is complete', () => { const spec = JSON.parse(fs.readFileSync(new URL('../.generated/static/openapi/youtarr.openapi.json', import.meta.url))); assert.ok(Object.keys(spec.paths).length); const quick = fs.readFileSync(new URL('../.generated/docs/quick-start.md', import.meta.url), 'utf8'); for (const script of ['start.sh', 'start-with-external-db.sh', 'scripts/start-dev.sh', 'scripts/start-dev-external-db.sh']) assert.ok(quick.includes(script)); assert.match(quick, /DB_HOST.*DB_USER.*DB_PASSWORD/s); });
test('generated compose quick-start instructions stay runnable', () => {
  const quick = fs.readFileSync(new URL('../.generated/docs/quick-start.md', import.meta.url), 'utf8');
  assert.ok(quick.includes('docker compose -f docker-compose.external-db.yml up -d'));
  assert.ok(!quick.includes('docker compose -f docker-compose.yml -f docker-compose.external-db.yml up -d'));
  assert.ok(quick.includes('[Development Guide](/docs/development)'));
  assert.ok(!quick.includes('docker compose -f docker-compose.dev.yml up -d'));
  assert.ok(quick.includes('External database compose (standalone)'));
});
test('generator accepts injected output and applies OpenAPI security inheritance', async () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-generated-'));
  await generate({
    root: path.resolve(new URL('../..', import.meta.url).pathname),
    outputRoot,
    swaggerSpec: {
      openapi: '3.0.0',
      info: {title: 'Fixture', version: '1.0.0'},
      security: [{ApiKeyAuth: []}],
      paths: {
        '/inherited': {get: {summary: 'Inherited'}},
        '/public': {get: {summary: 'Public', security: []}},
        '/explicit': {get: {summary: 'Explicit', security: [{SessionAuth: []}]}},
      },
    },
  });
  assert.ok(fs.existsSync(path.join(outputRoot, 'docs/quick-start.md')));
  assert.match(fs.readFileSync(path.join(outputRoot, 'static/openapi/youtarr.openapi.json'), 'utf8'), /Fixture/);
  const api = fs.readFileSync(path.join(outputRoot, 'docs/api.md'), 'utf8');
  assert.match(api, /\| GET \| \/inherited \| Inherited \| Yes \|/);
  assert.match(api, /\| GET \| \/public \| Public \| No \|/);
  assert.match(api, /\| GET \| \/explicit \| Explicit \| Yes \|/);
});
