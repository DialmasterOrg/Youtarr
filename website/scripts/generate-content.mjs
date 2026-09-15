import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import GithubSlugger from 'github-slugger';
import { createManifest, ROOT } from './manifest.mjs';

const stripFrontMatter = (markdown) => markdown.replace(/^---[\s\S]*?---\s*/, '');
const normalizeAnchorForMatch = (anchor) => anchor.replace(/[\uFE0E\uFE0F]/g, '');

export function extractHeadingSlugs(markdown) {
  const slugger = new GithubSlugger();
  const slugs = [];
  let fenced = false;
  let fenceCharacter;

  for (const line of stripFrontMatter(markdown).split('\n')) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (!fenced) {
        fenced = true;
        fenceCharacter = fence[1][0];
      } else if (fence[1][0] === fenceCharacter) {
        fenced = false;
        fenceCharacter = undefined;
      }
      continue;
    }

    if (fenced) continue;

    const heading = line.match(/^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/);
    if (!heading) continue;

    const headingText = heading[1].replace(/[ \t]+#+[ \t]*$/, '').trim();
    slugs.push(slugger.slug(headingText));
  }

  return slugs;
}

function createHeadingIndex(routes, root) {
  return new Map([...routes.keys()].map((source) => {
    const markdown = fs.readFileSync(path.join(root, source), 'utf8');
    return [source, new Map(extractHeadingSlugs(markdown).map((slug) => [normalizeAnchorForMatch(slug), slug]))];
  }));
}

function resolveAnchor(anchor, targetSource, headingIndex) {
  const requestedSlug = anchor.slice(1);
  const targetSlugs = headingIndex.get(targetSource);
  const resolvedSlug = targetSlugs?.get(normalizeAnchorForMatch(requestedSlug));
  return resolvedSlug ? `#${resolvedSlug}` : anchor;
}

export function rewriteLinks(body, source, routes, root = ROOT, headingIndex = createHeadingIndex(routes, root)) {
  const sourceFile = source.startsWith('docs/') ? path.join(root, source) : path.join(root, source);
  let fenced = false;
  const htmlTags = new Set(['details','summary','img','br','a','div','span','p','table','thead','tbody','tr','th','td','figure','figcaption','video','source','sup','sub']);
  const sanitize = (text) => text.replace(/<([A-Z][A-Z0-9_ -]*)>/g, '&lt;$1&gt;').replace(/<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?>/g, (tag, name) => htmlTags.has(name.toLowerCase()) ? tag : tag.replace(/</g, '&lt;').replace(/>/g, '&gt;')).replace(/<(?=[^A-Za-z\/])/g, '&lt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  const safeMdx = body.split('\n').map((line) => { if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return line; } if (fenced) return line; let output = ''; let cursor = 0; const codeSpan = /(`+)([\s\S]*?)\1/g; let match; while ((match = codeSpan.exec(line))) { output += sanitize(line.slice(cursor, match.index)) + match[0]; cursor = codeSpan.lastIndex; } return output + sanitize(line.slice(cursor)); }).join('\n');
  return safeMdx.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g, (all, label, href) => {
    if (href.startsWith('#')) {
      const anchor = resolveAnchor(href, source, headingIndex);
      if (href.startsWith('#-')) return `${label}(/docs/${routes.get(source)}${anchor})`;
      return anchor === href ? all : `${label}(${anchor})`;
    }
    if (/^(?:[a-z]+:|\/\/|data:)/i.test(href)) return all;
    const [target, ...anchorParts] = href.split('#');
    if (!target) return all;
    if (!target.toLowerCase().endsWith('.md')) {
      if (!fs.existsSync(path.resolve(path.dirname(sourceFile), target))) throw new Error(`unresolved relative asset ${source}:${href}`);
      return all;
    }
    const resolved = path.normalize(path.relative(root, path.resolve(path.dirname(sourceFile), target))).replaceAll('\\', '/');
    const canonical = resolved;
    if (!routes.has(canonical)) throw new Error(`unresolved canonical link ${source}:${href}`);
    const anchor = anchorParts.length ? resolveAnchor(`#${anchorParts.join('#')}`, canonical, headingIndex) : '';
    return `${label}(/docs/${routes.get(canonical)}${anchor})`;
  });
}

export function assertManifest(manifest, root = ROOT) {
  const ids = new Set(), slugs = new Set();
  for (const item of manifest) {
    if (!item.source || path.isAbsolute(item.source) || item.source.split('/').includes('..')) throw new Error(`unsafe source ${item.source}`);
    if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(item.slug) || !/^[a-z0-9-]+$/.test(item.id)) throw new Error(`unsafe id/slug ${item.id}/${item.slug}`);
    if (ids.has(item.id) || slugs.has(item.slug)) throw new Error(`duplicate id/slug ${item.id}/${item.slug}`);
    ids.add(item.id); slugs.add(item.slug);
    const source = path.join(root, item.source);
    if (!fs.existsSync(source)) throw new Error(`missing source ${item.source}`);
  }
}

export async function generate({root = ROOT, outputRoot, swaggerSpec} = {}) {
  const website = path.resolve(new URL('..', import.meta.url).pathname);
  const outRoot = outputRoot || path.join(website, '.generated');
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(outRoot, 'docs'), { recursive: true });
  const manifest = createManifest(root); assertManifest(manifest, root);
  const routes = new Map(manifest.map((item) => [item.source, item.slug]));
  const headingIndex = createHeadingIndex(routes, root);
  for (const item of manifest) {
    const sourceFile = path.join(root, item.source);
    const body = fs.readFileSync(sourceFile, 'utf8').replace(/^---[\s\S]*?---\s*/, '');
    const rewritten = rewriteLinks(body, item.source, routes, root, headingIndex);
    const dest = path.join(outRoot, 'docs', `${item.slug}.md`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, `---\nid: ${item.id}\ntitle: ${item.title}\nslug: /${item.slug}\neditUrl: ${item.sourceEditUrl}\n---\n\n${rewritten.trim()}\n`);
  }
  const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
  const compose = [['docker-compose.yml', 'Base compose (required)'], ['docker-compose.arm.yml', 'ARM/NAS override (use with base)'], ['docker-compose.external-db.yml', 'External database override (use with base)'], ['docker-compose.dev.yml', 'Development compose (alternative)']];
  let quick = '# Quick start\n\n## Prerequisites\n\nInstall Docker Engine with Compose v2 (Docker Desktop on Windows/macOS). Windows users can run the shell scripts from WSL.\n\n## Configure and start\n\n```bash\ngit clone https://github.com/DialmasterOrg/Youtarr.git\ncd Youtarr\ncp .env.example .env\n# Edit .env and set YOUTUBE_OUTPUT_DIR=./downloads (or an absolute host path)\nmkdir -p downloads config jobs server/images database\n\n# Standard bundled database\ndocker compose -f docker-compose.yml up -d\n# ARM/NAS or Docker Desktop safer named-volume database\ndocker compose -f docker-compose.yml -f docker-compose.arm.yml up -d\n# External MariaDB/MySQL (DB_HOST, DB_USER, DB_PASSWORD are required)\ndocker compose -f docker-compose.yml -f docker-compose.external-db.yml up -d\n# Source-built standalone development stack\ndocker compose -f docker-compose.dev.yml up -d\n```\n\nThe ARM and external database files are overrides and must be layered with the base file; development is a separate source-built alternative. For external DB, set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and optionally `DB_PORT`/`DB_NAME` in `.env`.\n\n## Verify, open, and stop\n\nRun the matching `docker compose ... ps`, then open `http://localhost:3087`. Complete the setup-token wizard on first access, or inspect matching `docker compose ... logs -f youtarr` output. Stop the selected project with the same file flags and `down` (for example, `docker compose -f docker-compose.yml down`).\n\nOn Windows, use Docker Desktop Compose commands above or run the referenced shell scripts under WSL. Generation only references scripts; it never executes them.\n';
  for (const [file, title] of compose) quick += `\n## ${title}\n\n~~~yaml\n${read(file)}~~~\n`;
  quick += '\n## Script alternatives\n\n`start.sh`, `start-with-external-db.sh`, `scripts/start-dev.sh`, and `scripts/start-dev-external-db.sh` are Linux/macOS shell entry points. On Windows, use Docker Desktop Compose commands above or run these scripts under WSL; scripts are references only and are not executed by this generator.\n';
  fs.writeFileSync(path.join(outRoot, 'docs', 'quick-start.md'), `---\nid: quick-start\ntitle: Quick start\nslug: /quick-start\n---\n\n${quick}`);

  let imported;
  if (!swaggerSpec) { try { imported = await import(pathToFileURL(path.join(root, 'server/swagger.js'))); } catch (error) { throw new Error(`Unable to import swaggerSpec: ${error.message}`); } }
  const spec = swaggerSpec || imported.swaggerSpec;
  if (!spec || typeof spec !== 'object' || !/^3\.([0-9]+)\.[0-9]+$/.test(spec.openapi || '') || !spec.info?.title || !spec.info?.version || !spec.paths || !Object.keys(spec.paths).length) throw new Error('Invalid or empty swaggerSpec');
  fs.mkdirSync(path.join(outRoot, 'static/openapi'), { recursive: true });
  fs.writeFileSync(path.join(outRoot, 'static/openapi/youtarr.openapi.json'), JSON.stringify(spec, null, 2));
  const globalSecurityRequired = Array.isArray(spec.security) && spec.security.length > 0;
  const rows = Object.entries(spec.paths).flatMap(([endpoint, methods]) => Object.entries(methods)
    .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method))
    .map(([method, operation]) => {
      const hasSecurityOverride = Object.prototype.hasOwnProperty.call(operation, 'security');
      const authRequired = hasSecurityOverride
        ? Array.isArray(operation.security) && operation.security.length > 0
        : globalSecurityRequired;
      return `| ${method.toUpperCase()} | ${endpoint.replaceAll('{', '&#123;').replaceAll('}', '&#125;')} | ${(operation.summary || operation.description || '').replaceAll('|', '\\|')} | ${authRequired ? 'Yes' : 'No'} |`;
    })).join('\n');
  fs.writeFileSync(path.join(outRoot, 'docs/api.md'), `---\nid: api\ntitle: API reference\nslug: /api\n---\n\n# API reference\n\n<a href="/Youtarr/openapi/youtarr.openapi.json" download>Download the OpenAPI JSON</a>.\n\n| Method | Endpoint | Summary | Auth |\n|---|---|---|---|\n${rows}\n`);
  fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) generate().then((m) => console.log(`Generated ${m.length} canonical docs`)).catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
