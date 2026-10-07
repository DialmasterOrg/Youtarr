const fs = require('fs-extra');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const { pipeline } = require('stream/promises');
const { v4: uuidv4 } = require('uuid');
const { spawnYtDlp } = require('../ytdlpProcess');
const tempPathManager = require('../download/tempPathManager');
const { redactSensitiveText } = require('../safeCommandLogging');

class ChannelYtdlpExecutor {
  /**
   * Execute yt-dlp command with promise-based handling
   * NOTE: Args should be pre-built using ytdlpCommandBuilder methods which include
   * common arguments (cookies, proxy, sleep-requests, etc.)
   * @param {Array} args - Pre-built arguments for yt-dlp command
   * @param {string|null} outputFile - Optional output file path
   * @param {Object} options - Options object
   * @param {Function} options.onStdoutData - Called with each raw stdout chunk as it arrives
   * @param {number|null} options.timeoutMs - Optional deadline for bounded metadata calls
   * @returns {Promise<string>} - Output content if outputFile provided
   */
  async executeYtDlpCommand(args, outputFile = null, { onStdoutData, timeoutMs = null } = {}) {
    const ytDlp = spawnYtDlp(args, {
      env: {
        ...process.env,
        TMPDIR: tempPathManager.getTempBasePath()
      }
    });

    // Attach immediately: if setup below throws before the promise adds its
    // real handler, a spawn failure (e.g. ENOENT) would be an unhandled
    // 'error' event and take down the whole process.
    ytDlp.on('error', () => {});

    // The child's exit does not mean its output is on disk: stdout can still be
    // draining and the write stream flushing, so the file is read only after
    // the pipeline finishes. A write stream failure rejects instead of being
    // an unhandled 'error' event.
    const outputWritten = outputFile
      ? pipeline(ytDlp.stdout, fs.createWriteStream(outputFile))
      : null;

    if (onStdoutData) {
      ytDlp.stdout.on('data', onStdoutData);
    }

    // Capture stderr to detect bot challenges
    let stderrBuffer = '';
    ytDlp.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    const exited = new Promise((resolve, reject) => {
      let settled = false;
      let forceKill;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback(value);
      };
      const timeout = timeoutMs > 0 ? setTimeout(() => {
        const error = new Error(`yt-dlp channel metadata request timed out after ${timeoutMs}ms`);
        error.code = 'YT_DLP_TIMEOUT';
        if (typeof ytDlp.kill === 'function') {
          forceKill = setTimeout(() => ytDlp.kill('SIGKILL'), 5000);
          forceKill.unref?.();
          ytDlp.kill('SIGTERM');
        }
        finish(reject, error);
      }, timeoutMs) : null;
      timeout?.unref?.();

      ytDlp.on('exit', (code) => {
        clearTimeout(forceKill);
        // Check for bot detection
        if (stderrBuffer.includes('Sign in to confirm you\'re not a bot') ||
            stderrBuffer.includes('Sign in to confirm that you\'re not a bot')) {
          const error = new Error('Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.');
          error.code = 'COOKIES_REQUIRED';
          finish(reject, error);
        } else if (code === 0) {
          finish(resolve);
        } else {
          // Check for common error patterns in stderr
          let errorMessage = `yt-dlp exited with code ${code}`;
          let errorCode = 'YT_DLP_ERROR';

          if (stderrBuffer.includes('Unable to extract') ||
              stderrBuffer.includes('does not exist') ||
              stderrBuffer.includes('This channel does not exist') ||
              stderrBuffer.includes('ERROR: [youtube]')) {
            errorMessage = 'Channel not found or invalid URL';
            errorCode = 'CHANNEL_NOT_FOUND';
          } else if (stderrBuffer.includes('Unable to download webpage')) {
            errorMessage = 'Network error: Unable to connect to YouTube';
            errorCode = 'NETWORK_ERROR';
          }

          const error = new Error(errorMessage);
          error.code = errorCode;
          error.stderr = redactSensitiveText(stderrBuffer);
          finish(reject, error);
        }
      });
      ytDlp.on('error', (error) => finish(reject, error));

    });

    await Promise.all([exited, outputWritten]);

    if (outputFile) {
      const content = await fsPromises.readFile(outputFile, 'utf8');
      await fsPromises.unlink(outputFile);
      return content;
    }
  }

  /**
   * Execute file operation with temporary file handling
   * @param {string} prefix - Prefix for temp file name
   * @param {Function} callback - Async callback that receives the temp file path
   * @returns {Promise<any>} - Result from callback
   */
  async withTempFile(prefix, callback) {
    const tempFilePath = path.join(os.tmpdir(), `${prefix}-${uuidv4()}.json`);
    try {
      const result = await callback(tempFilePath);
      try {
        await fsPromises.unlink(tempFilePath);
      } catch (err) {
        // Ignore cleanup errors
      }
      return result;
    } catch (error) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch (err) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}

module.exports = new ChannelYtdlpExecutor();
