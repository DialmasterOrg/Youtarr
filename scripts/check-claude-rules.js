#!/usr/bin/env node
// Claude Code silently stops loading a .claude/rules file for a renamed or
// deleted path, so this fails the lint when a path glob matches no file.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RULES_DIR = path.join(ROOT, '.claude', 'rules');
const GIT_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;

function expandBraces(glob) {
  const group = glob.match(/\{([^{}]*)\}/);
  if (!group) return [glob];
  const before = glob.slice(0, group.index);
  const after = glob.slice(group.index + group[0].length);
  return group[1].split(',').flatMap((option) => expandBraces(`${before}${option}${after}`));
}

function globToRegExp(glob) {
  let source = '';
  let i = 0;
  while (i < glob.length) {
    if (glob.startsWith('**/', i)) {
      source += '(?:.*/)?';
      i += 3;
    } else if (glob.startsWith('**', i)) {
      source += '.*';
      i += 2;
    } else if (glob[i] === '*') {
      source += '[^/]*';
      i += 1;
    } else if (glob[i] === '?') {
      source += '[^/]';
      i += 1;
    } else {
      source += glob[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
      i += 1;
    }
  }
  return new RegExp(`^${source}$`);
}

function globMatchesAny(glob, files) {
  const patterns = expandBraces(glob).map(globToRegExp);
  return files.some((file) => patterns.some((pattern) => pattern.test(file)));
}

function parsePaths(markdown) {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return null;
  const lines = frontmatter[1].split(/\r?\n/);
  const start = lines.findIndex((line) => /^paths:\s*$/.test(line));
  if (start === -1) return null;
  const globs = [];
  for (const line of lines.slice(start + 1)) {
    const item = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
    if (!item) break;
    globs.push(item[1]);
  }
  return globs.length > 0 ? globs : null;
}

function findProblems(rules, files) {
  return rules.flatMap(({ name, content }) => {
    const globs = parsePaths(content);
    if (!globs) return [`${name}: no "paths:" list in its frontmatter`];
    return globs
      .filter((glob) => !globMatchesAny(glob, files))
      .map((glob) => `${name}: "${glob}" matches no file`);
  });
}

function listRepoFiles(root) {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: GIT_OUTPUT_LIMIT_BYTES,
  });
  return output.split('\n').filter((file) => file && fs.existsSync(path.join(root, file)));
}

function main() {
  const rules = fs.readdirSync(RULES_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ name, content: fs.readFileSync(path.join(RULES_DIR, name), 'utf8') }));
  const problems = findProblems(rules, listRepoFiles(ROOT));
  if (problems.length === 0) {
    console.log(`Claude rule paths OK (${rules.length} files)`);
    return 0;
  }
  console.error(`Claude rule paths are out of date in .claude/rules:\n  ${problems.join('\n  ')}`);
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { expandBraces, findProblems, globMatchesAny, globToRegExp, parsePaths };
