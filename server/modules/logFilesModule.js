const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');
const { LOG_DIRECTORY, LOG_FILE_NAME_PATTERN } = require('../logging/logFileConfig');
const { createLogScrubber } = require('../logging/logScrubber');

// Line by line, so a secret is never split across two chunks and missed.
async function* readScrubbedLines(files, scrubLine) {
  for (const file of files) {
    const input = fs.createReadStream(file.path);
    try {
      for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
        yield `${scrubLine(line)}\n`;
      }
    } catch (err) {
      // Rotation can delete the oldest file between listing and reading.
      if (err.code !== 'ENOENT') throw err;
    } finally {
      // Also runs when the client disconnects mid-download.
      input.destroy();
    }
  }
}

class LogFilesModule {
  /**
   * Log files oldest first. pino-roll numbers files upward, so sort
   * numerically: youtarr.10.log is newer than youtarr.9.log.
   */
  async listLogFiles() {
    let names;
    try {
      names = await fs.promises.readdir(LOG_DIRECTORY);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    return names
      .map((name) => ({ name, match: LOG_FILE_NAME_PATTERN.exec(name) }))
      .filter(({ match }) => match)
      .map(({ name, match }) => ({ name, number: Number(match[1]), path: path.join(LOG_DIRECTORY, name) }))
      .sort((a, b) => a.number - b.number);
  }

  /**
   * The files' contents in order, with the keys and tokens from config hidden.
   */
  createCombinedStream(files, config) {
    return Readable.from(readScrubbedLines(files, createLogScrubber(config)));
  }
}

module.exports = new LogFilesModule();
