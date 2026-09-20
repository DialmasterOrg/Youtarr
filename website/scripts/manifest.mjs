import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const rootMarkdownFiles = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'LICENSE.md', 'CONTRIBUTORS.md'];

const sectionFor = (source) => {
  if (/^(INSTALLATION|DOCKER|platforms\/)/.test(source)) return 'Getting Started';
  if (/^(USAGE_GUIDE|MEDIA_|YOUTARR_(VS_|DOWNLOADS_)|media-servers\/)/.test(source)) return 'Using Youtarr';
  if (/^(CONFIG|ENVIRONMENT|AUTHENTICATION|DATABASE|BACKUP_RESTORE|TROUBLESHOOTING)/.test(source)) return 'Operations';
  if (/^(DEVELOPMENT|API_INTEGRATION|development\/)/.test(source)) return 'Developers';
  return 'Project';
};

const titleFor = (source) => source.replace(/\.md$/i, '').split('/').at(-1).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const slugFor = (source) => source.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9/]+/g, '-').replace(/\/+$/g, '');

export function discoverMarkdownSources(root = ROOT) {
  const localDocsRoot = path.join(root, 'docs');
  const walk = (dir, prefix = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? walk(path.join(dir, entry.name), `${prefix}${entry.name}/`)
    : entry.name.endsWith('.md') && entry.name !== 'CLAUDE.md' ? [`${prefix}${entry.name}`] : []);

  const files = [
    ...rootMarkdownFiles.filter((file) => fs.existsSync(path.join(root, file))),
    ...(fs.existsSync(localDocsRoot) ? walk(localDocsRoot).map((file) => `docs/${file}`) : []),
  ];
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

export function createManifest(root = ROOT) {
  return discoverMarkdownSources(root).map((source, index) => {
    const inDocs = source.startsWith('docs/');
    const relative = inDocs ? source.slice(5) : source;
    const id = slugFor(relative).replaceAll('/', '-');
    const slug = slugFor(relative);
    return {source, id, slug, title: titleFor(relative), section: sectionFor(relative), order: index, sourceEditUrl: `https://github.com/DialmasterOrg/Youtarr/edit/main/${source}`};
  });
}

export const manifest = createManifest();
