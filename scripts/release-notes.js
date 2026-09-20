const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

function prepareReleaseNotes({ newTag, previousTag, repository, changelog }) {
  if (!/^v\d+\.\d+\.\d+$/.test(newTag)) {
    throw new Error(`Expected a stable release tag with one v prefix: ${newTag}`);
  }
  if (!/^v+\d+\.\d+\.\d+$/.test(previousTag)) {
    throw new Error(`Unexpected previous release tag: ${previousTag}`);
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error('Expected an owner/repository name');
  }

  const notes = changelog.replace(/\r\n/g, '\n').trim();
  // The generator uses ## for minor/major releases and ### for patches.
  // Remove only its leading version heading, never the category headings.
  const heading = /^#{2,3} \[v?(\d+\.\d+\.\d+)\]\(https:\/\/[^\s)]+\) \((\d{4}-\d{2}-\d{2})\)(?:\n|$)/.exec(notes);
  if (!heading || `v${heading[1]}` !== newTag) {
    throw new Error('Generated notes must start with the expected release version heading');
  }

  const body = notes.slice(heading[0].length).trim() || 'No changes listed.';
  const canonicalPreviousTag = previousTag.replace(/^v+/, 'v');
  const repoUrl = `https://github.com/${repository}`;
  const compareUrl = `${repoUrl}/compare/${canonicalPreviousTag}...${newTag}`;
  const entry = `## [${newTag}](${repoUrl}/releases/tag/${newTag}) - ${heading[2]}\n\n${body}\n\n**Full Changelog**: ${compareUrl}`;

  return { body, entry, compare_url: compareUrl, previous_tag: canonicalPreviousTag };
}

function prependChangelog(existing, entry) {
  if (existing && !/^# Changelog(?:\r?\n|$)/.test(existing)) {
    throw new Error('CHANGELOG.md must start with # Changelog');
  }
  const history = existing.replace(/^# Changelog\s*/, '').trim();
  return `# Changelog\n\n${entry.trim()}\n${history ? `\n${history}\n` : ''}`;
}

if (require.main === module) {
  if (process.argv[2] === 'prepare') {
    const result = prepareReleaseNotes({
      newTag: process.env.NEW_TAG,
      previousTag: process.env.PREVIOUS_TAG,
      repository: process.env.REPO,
      changelog: process.env.CHANGELOG_BODY || ''
    });
    // Historical vv tags remain valid commit-analysis baselines. Public compare
    // links use the canonical release tags, which must already exist locally.
    execFileSync('git', ['rev-parse', '--verify', `refs/tags/${result.previous_tag}`], { stdio: 'pipe' });
    for (const [name, value] of Object.entries(result)) {
      const delimiter = `release_notes_${randomUUID()}`;
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
    }
  } else if (process.argv[2] === 'update') {
    const entry = process.env.CHANGELOG_ENTRY;
    if (!entry || !entry.startsWith('## [v')) {
      throw new Error('CHANGELOG_ENTRY must contain a prepared release entry');
    }
    const existing = fs.existsSync('CHANGELOG.md') ? fs.readFileSync('CHANGELOG.md', 'utf8') : '';
    fs.writeFileSync('CHANGELOG.md', prependChangelog(existing, entry));
  } else {
    throw new Error('Usage: node scripts/release-notes.js prepare|update');
  }
}

module.exports = { prepareReleaseNotes, prependChangelog };
