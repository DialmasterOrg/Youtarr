// Run by scheduleConfig.test.js in a child process with TZ set before Node starts.
// Usage: node nextRunInZone.js '<cron expression>' <year> <month0> <day> <hour> <minute>
// Prints JSON with the prediction, a brute-force reference, and the offsets.
const path = require('path');
const TimeMatcher = require('node-cron/src/time-matcher');
const { getNextRun } = require(path.join(__dirname, '..', '..', 'scheduleConfig'));

const MS_PER_MINUTE = 60 * 1000;
const REFERENCE_WINDOW_MS = 3 * 60 * MS_PER_MINUTE;

const [expression, ...parts] = process.argv.slice(2);
const [year, month, day, hour, minute] = parts.map(Number);
const start = new Date(year, month, day, hour, minute, 0, 0);

// Step by instant rather than local fields: any setter on a Date inside a
// repeated period re-resolves to its first occurrence and hides the bug.
const matcher = new TimeMatcher(expression);
let expected = null;
for (let t = start.getTime() + MS_PER_MINUTE; t <= start.getTime() + REFERENCE_WINDOW_MS; t += MS_PER_MINUTE) {
  const candidate = new Date(t);
  if (matcher.match(candidate)) {
    expected = candidate;
    break;
  }
}

const next = getNextRun(expression, start);
process.stdout.write(JSON.stringify({
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  start: start.toISOString(),
  startOffset: start.getTimezoneOffset(),
  expected: expected && expected.toISOString(),
  expectedOffset: expected && expected.getTimezoneOffset(),
  next: next && next.toISOString(),
}));
