#!/usr/bin/env node
/**
 * Regenerates server/modules/filesystem/__tests__/fixtures/ytdlpTitleSanitizer.json,
 * the expected output of sanitizeFilenameLikeYtDlp, by rendering every corpus
 * title through the yt-dlp inside the Youtarr image (offline, from fake info
 * files). Each title is rendered the way a movie-style filename renders it,
 * `%(title)s [%(id)s].%(ext)s` with --windows-filenames, so the fixture holds
 * exactly the text yt-dlp puts in front of the ` [id]` suffix.
 *
 * Usage: node scripts/generate-sanitizer-fixtures.js [image]
 *   image defaults to youtarr-dev:latest (build it with ./scripts/build-dev.sh)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_IMAGE = 'youtarr-dev:latest';
const OUTPUT_PATH = path.join(
  __dirname, '..', 'server', 'modules', 'filesystem', '__tests__', 'fixtures', 'ytdlpTitleSanitizer.json'
);
const ID_PREFIX = 'fixture';
const OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s';

const CORPUS = [
  'Simple title',
  'AC/DC - Back In Black',
  'Back\\slash title',
  'Title: Subtitle',
  'Live at 12:30:45 tonight',
  'Score 3:2 final',
  'Ratio 16:9:4',
  'Ends with colon:',
  '1:2:3',
  'He said "hello"',
  '"Fully quoted"',
  'What? Why?!',
  '??',
  'Wild*card | pipe <angle> brackets',
  'Mixed /\\:*?"<>| all',
  'Trailing dot.',
  'Trailing dots...',
  'Trailing space ',
  '  Leading spaces',
  '.hidden start',
  '-dash start',
  '__double__underscore__',
  'Line one\nLine two',
  'Repeated \n\n\n newlines',
  '\nLeading newline',
  'Trailing newline\n',
  'Tab\tseparated',
  'Bell\u0007char',
  'Delete\u007fchar',
  'Zero\u{200b}width space',
  'Emoji 🎮 gaming 🔥🔥',
  'Flag 🇺🇸 and family 👨‍👩‍👧',
  'Math 𝓗𝓮𝓵𝓵𝓸 bold',
  'Fullwidth ＡＢＣ １２３ ：？',
  'CJK 日本語のタイトル 中文标题 한국어',
  'Accents café naïve Ærøskøbing',
  'RTL עברית العربية',
  'Percent %(title)s literal',
  'BEYBLADE | Ep.19 Under the Microscope | Ep.20 It\'s All Relative',
  'Hermitcraft 10: Episode 43 - THE LAST DAY! (the end of an era, thanks for watching)',
  `${'a'.repeat(62)}??::`,
  'あ'.repeat(30),
  `${'a'.repeat(63)}😀tail`,
  `${'a'.repeat(62)}éb`,
  `${'b'.repeat(61)}日本`,
];

function buildEntries() {
  return CORPUS.map((title, index) => {
    const id = `${ID_PREFIX}${String(index).padStart(4, '0')}`;
    return {
      id,
      title,
      extractor: 'youtube',
      extractor_key: 'Youtube',
      webpage_url: `https://www.youtube.com/watch?v=${id}`,
      ext: 'mp4',
      duration: 60,
      is_live: false,
      live_status: 'not_live',
      availability: 'public',
      formats: [{ format_id: '18', ext: 'mp4', url: 'https://example.invalid/video.mp4', vcodec: 'avc1', acodec: 'mp4a' }],
    };
  });
}

function runYtDlp(image, entries) {
  const script = [
    'cat > /tmp/entries.json',
    `yt-dlp --load-info-json /tmp/entries.json --skip-download --windows-filenames --print filename -o '${OUTPUT_TEMPLATE}'`,
  ].join(' && ');
  const stdout = execFileSync(
    'docker',
    ['run', '--rm', '-i', '--network', 'none', '-e', 'PYTHONIOENCODING=utf-8', '-e', 'LC_ALL=C.UTF-8',
      '--entrypoint', 'sh', image, '-c', script],
    { input: JSON.stringify(entries), encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
  );
  const version = execFileSync(
    'docker', ['run', '--rm', '--network', 'none', '--entrypoint', 'yt-dlp', image, '--version'],
    { encoding: 'utf8' }
  ).trim();
  return { lines: stdout.split('\n').filter((line) => line.length > 0), version };
}

function parseLines(lines, entries) {
  if (lines.length !== entries.length) {
    throw new Error(`Expected ${entries.length} filenames from yt-dlp, got ${lines.length}`);
  }
  return lines.map((line, index) => {
    const suffix = ` [${entries[index].id}].mp4`;
    if (!line.endsWith(suffix)) {
      throw new Error(`Line ${index} does not end with ${suffix}: ${line}`);
    }
    return { input: entries[index].title, expected: line.slice(0, -suffix.length) };
  });
}

function main() {
  const image = process.argv[2] || DEFAULT_IMAGE;
  const entries = buildEntries();
  const { lines, version } = runYtDlp(image, entries);
  const fixture = {
    description: `Titles rendered by yt-dlp ${version} as "${OUTPUT_TEMPLATE}" with --windows-filenames; `
      + 'expected is the text before the " [id]" suffix. Regenerate with scripts/generate-sanitizer-fixtures.js.',
    ytDlpVersion: version,
    cases: parseLines(lines, entries),
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`Wrote ${fixture.cases.length} cases to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();
