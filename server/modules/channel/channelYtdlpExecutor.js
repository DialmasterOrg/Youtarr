const fs = require('fs-extra');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const tempPathManager = require('../download/tempPathManager');

class ChannelYtdlpExecutor {
  /**
   * Execute yt-dlp command with promise-based handling
   * NOTE: Args should be pre-built using ytdlpCommandBuilder methods which include
   * common arguments (cookies, proxy, sleep-requests, etc.)
   * @param {Array} args - Pre-built arguments for yt-dlp command
   * @param {string|null} outputFile - Optional output file path
   * @returns {Promise<string>} - Output content if outputFile provided
   */
  async executeYtDlpCommand(args, outputFile = null) {
    const ytDlp = spawn('yt-dlp', args, {
      env: {
        ...process.env,
        TMPDIR: tempPathManager.getTempBasePath()
      }
    });

    if (outputFile) {
      const writeStream = fs.createWriteStream(outputFile);
      ytDlp.stdout.pipe(writeStream);
    }

    // Capture stderr to detect bot challenges
    let stderrBuffer = '';
    ytDlp.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    await new Promise((resolve, reject) => {
      ytDlp.on('exit', (code) => {
        // Check for bot detection
        if (stderrBuffer.includes('Sign in to confirm you\'re not a bot') ||
            stderrBuffer.includes('Sign in to confirm that you\'re not a bot')) {
          const error = new Error('Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.');
          error.code = 'COOKIES_REQUIRED';
          reject(error);
        } else if (code === 0) {
          resolve();
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
          error.stderr = stderrBuffer;
          reject(error);
        }
      });
      ytDlp.on('error', reject);
    });

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
