// Run with a parent-enforced timeout: regressions may block the event loop.
const {
  getScheduleError,
  isValidSchedule,
  getNextRun,
  violatesMinimumInterval,
  normalizeToMinimumInterval,
} = require('../../scheduleConfig');

const expressions = JSON.parse(process.argv[2]);
process.stdout.write(JSON.stringify(expressions.map((expression) => ({
  error: getScheduleError(expression),
  valid: isValidSchedule(expression),
  next: getNextRun(expression),
  violatesMinimum: violatesMinimumInterval(expression),
  normalized: normalizeToMinimumInterval(expression),
}))));
