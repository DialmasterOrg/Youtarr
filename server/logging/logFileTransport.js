const build = require('pino-abstract-transport');
const { prettyFactory } = require('pino-pretty');
const pinoRoll = require('pino-roll');

// Post-processor output reaches the server's log with pino-pretty's colors
// already embedded in the message text.
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/g;

// Resolves on drain, or on error/close so a failed file never stalls the loop.
function waitForDrain(stream) {
  return new Promise((resolve) => {
    const done = () => {
      stream.off('drain', done);
      stream.off('error', done);
      stream.off('close', done);
      resolve();
    };
    stream.on('drain', done);
    stream.on('error', done);
    stream.on('close', done);
  });
}

module.exports = async function logFileTransport({ file, maxSizeBytes, maxFiles, prettyOptions }) {
  const pretty = prettyFactory({ ...prettyOptions, colorize: false });
  let destination = null;
  let stopped = false;

  // The console shares this worker thread; a file error must never reach it.
  const stop = (err) => {
    if (stopped) return;
    stopped = true;
    process.stderr.write(`Youtarr stopped writing log files: ${err.message}\n`);
  };

  try {
    destination = await pinoRoll({
      file,
      size: `${maxSizeBytes}b`,
      // removeOtherLogFiles also prunes files from earlier runs; without it
      // pino-roll only deletes files this process created.
      limit: { count: maxFiles, removeOtherLogFiles: true },
      mkdir: true,
    });
    destination.on('error', stop);
  } catch (err) {
    stop(err);
  }

  return build(async function writeLines(source) {
    for await (const record of source) {
      if (stopped) continue;
      // Without waiting, a slow disk would let the buffer grow without bound.
      if (!destination.write(pretty(record).replace(ANSI_ESCAPE_PATTERN, ''))) {
        await waitForDrain(destination);
      }
    }
  }, {
    async close() {
      if (!destination || stopped) return;
      await new Promise((resolve) => {
        destination.once('close', resolve);
        destination.end();
      });
    },
  });
};
