/**
 * Creates a function that limits concurrent executions to `max` at a time.
 * Tasks beyond the limit queue and run as earlier tasks complete.
 *
 * Usage:
 *   const limit = createLimiter(3);
 *   const results = await Promise.all(items.map((item) => limit(() => work(item))));
 *
 * @param {number} max - Maximum concurrent tasks (must be >= 1)
 * @returns {(task: () => Promise<any>) => Promise<any>}
 */
function createLimiter(max) {
  if (!Number.isInteger(max) || max < 1) {
    throw new Error('concurrencyLimiter: max must be a positive integer');
  }

  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= max || queue.length === 0) return;
    active += 1;
    const { task, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(task)
      .then(
        (value) => { active -= 1; resolve(value); next(); },
        (err) => { active -= 1; reject(err); next(); }
      );
  };

  return function run(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
  };
}

module.exports = createLimiter;
