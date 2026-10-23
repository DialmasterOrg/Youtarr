class ExternalWorkLimitError extends Error {
  constructor(message = 'External API work queue is full') {
    super(message);
    this.name = 'ExternalWorkLimitError';
    this.code = 'work_queue_full';
  }
}

function createExternalWorkLimiter({
  // Youtarr's downloader already permits one running download. Reserve one
  // slot from the global ceiling of three for that asynchronous queue.
  concurrency = Number(process.env.EXTERNAL_API_WORK_CONCURRENCY || 2),
  maxQueue = Number(process.env.EXTERNAL_API_WORK_QUEUE || 20),
} = {}) {
  const limit = Number.isSafeInteger(concurrency) && concurrency > 0
    ? Math.min(concurrency, 2)
    : 2;
  const queueLimit = Number.isSafeInteger(maxQueue) && maxQueue >= 0
    ? Math.min(maxQueue, 100)
    : 20;
  let active = 0;
  const queue = [];

  const drain = () => {
    while (active < limit && queue.length > 0) {
      const item = queue.shift();
      active += 1;
      Promise.resolve()
        .then(item.work)
        .then(item.resolve, item.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  };

  const run = (work) => new Promise((resolve, reject) => {
    if (typeof work !== 'function') {
      reject(new TypeError('work must be a function'));
      return;
    }
    if (active >= limit && queue.length >= queueLimit) {
      reject(new ExternalWorkLimitError());
      return;
    }
    queue.push({ work, resolve, reject });
    drain();
  });

  const status = () => ({ active, queued: queue.length, concurrency: limit, maxQueue: queueLimit });
  return { run, status };
}

module.exports = {
  createExternalWorkLimiter,
  ExternalWorkLimitError,
  sharedExternalWorkLimiter: createExternalWorkLimiter(),
};
