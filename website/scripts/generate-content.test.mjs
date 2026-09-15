import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import {manifest, discoverMarkdownSources} from './manifest.mjs';
import {extractHeadingSlugs, rewriteLinks, assertManifest, generate} from './generate-content.mjs';

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
  fs.writeFileSync(path.join(tmp, 'docs', 'a.md'), '# Section\n[Section](#section)\n[B](b.md#part)');
  fs.writeFileSync(path.join(tmp, 'docs', 'b.md'), '# Part');
  const routes = new Map([['docs/a.md', 'a'], ['docs/b.md', 'b']]);
  const rewritten = rewriteLinks(fs.readFileSync(path.join(tmp, 'docs', 'a.md'), 'utf8'), 'docs/a.md', routes, tmp);
  assert.match(rewritten, /\[Section\]\(#section\)/);
  assert.match(rewritten, /\/docs\/b#part/);
  assert.equal(rewriteLinks('[Missing](#missing)', 'docs/a.md', routes, tmp), '[Missing](#missing)');
  assert.throws(() => rewriteLinks('[X](missing.md)', 'docs/a.md', routes, tmp), /unresolved canonical link/);
  assert.throws(() => rewriteLinks('![x](missing.png)', 'docs/a.md', routes, tmp), /unresolved relative asset/);
});

test('heading extraction ignores fenced code blocks', () => {
  assert.deepEqual(extractHeadingSlugs('```markdown\n# Not a heading\n```\n# Real heading\n'), ['real-heading']);
});

test('emoji-prefixed Docker anchors use the actual Docusaurus slug', () => {
  const dockerSource = fs.readFileSync(path.resolve(new URL('../../docs/DOCKER.md', import.meta.url).pathname), 'utf8');
  const dockerLink = dockerSource.match(/\[[^\]]+\]\(#-important-do-not-mount-the-migrations-directory\)/)?.[0];
  assert.ok(dockerLink);
  const dockerHeading = dockerSource.match(/^##\s+(.+Do Not Mount the Migrations Directory)$/m)?.[1];
  assert.ok(dockerHeading);
  const slugger = new GithubSlugger();
  let expectedAnchor;
  for (const heading of dockerSource.match(/^#{1,6}\s+(.+)$/gm) || []) {
    const headingText = heading.replace(/^#{1,6}\s+/, '');
    const slug = slugger.slug(headingText);
    if (headingText === dockerHeading) expectedAnchor = `#${slug}`;
  }
  assert.ok(expectedAnchor);
  assert.equal(
    rewriteLinks(dockerLink, 'docs/DOCKER.md', new Map([['docs/DOCKER.md', 'docker']])),
    dockerLink.replace(/\((#[^)]+)\)/, `(/docs/docker${expectedAnchor})`),
  );
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
