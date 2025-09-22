const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class YtDlpRunner {
  constructor() {
    this.defaultTimeout = 10000;
  }

  /**
   * Run yt-dlp with specified arguments
   * @param {string[]} args - Array of arguments to pass to yt-dlp
   * @param {Object} options - Options for execution
   * @param {number} options.timeoutMs - Timeout in milliseconds (default: 10000)
   * @param {string} options.pipeToFile - Optional file path to pipe output to
   * @param {boolean} options.useCookies - Whether to use cookies if configured (default: true)
   * @returns {Promise<string>} - stdout output or empty string if piped to file
   */
  async run(args, options = {}) {
    const { timeoutMs = this.defaultTimeout, pipeToFile, useCookies = true } = options;

    // Add cookies if configured and requested
    let finalArgs = [...args];
    if (useCookies) {
      const configModule = require('./configModule');
      const cookiesPath = configModule.getCookiesPath();
      if (cookiesPath) {
        finalArgs = ['--cookies', cookiesPath, ...args];
      }
    }

    return new Promise((resolve, reject) => {
      if (!Array.isArray(args)) {
        reject(new Error('Arguments must be provided as an array'));
        return;
      }

      const ytDlpProcess = spawn('yt-dlp', finalArgs, {
        shell: false,
        timeout: timeoutMs
      });

      let stdout = '';
      let stderr = '';
      let fileStream = null;

      if (pipeToFile) {
        try {
          const dir = path.dirname(pipeToFile);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fileStream = fs.createWriteStream(pipeToFile);
        } catch (error) {
          reject(new Error(`Failed to create output file: ${error.message}`));
          ytDlpProcess.kill();
          return;
        }
      }

      ytDlpProcess.stdout.on('data', (data) => {
        if (fileStream) {
          fileStream.write(data);
        } else {
          stdout += data.toString();
        }
      });

      ytDlpProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytDlpProcess.on('close', (code) => {
        if (fileStream) {
          fileStream.end();
        }

        // Check for bot detection
        if (stderr.includes('Sign in to confirm you\'re not a bot') ||
            stderr.includes('Sign in to confirm that you\'re not a bot')) {
          const error = new Error('Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.');
          error.code = 'COOKIES_REQUIRED';
          reject(error);
        } else if (code === 0) {
          resolve(stdout);
        } else if (code === null) {
          reject(new Error(`yt-dlp process timed out after ${timeoutMs}ms`));
        } else {
          const errorMessage = stderr || `yt-dlp process exited with code ${code}`;
          reject(new Error(errorMessage));
        }
      });

      ytDlpProcess.on('error', (error) => {
        if (fileStream) {
          fileStream.end();
        }

        if (error.code === 'ENOENT') {
          reject(new Error('yt-dlp not found. Please ensure yt-dlp is installed.'));
        } else {
          reject(error);
        }
      });

      if (timeoutMs) {
        setTimeout(() => {
          if (!ytDlpProcess.killed) {
            ytDlpProcess.kill('SIGTERM');
            setTimeout(() => {
              if (!ytDlpProcess.killed) {
                ytDlpProcess.kill('SIGKILL');
              }
            }, 1000);
          }
        }, timeoutMs);
      }
    });
  }

  /**
   * Fetch video metadata using yt-dlp
   * @param {string} url - YouTube URL to fetch metadata for
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<Object>} - Parsed JSON metadata
   */
  async fetchMetadata(url, timeoutMs = 10000) {
    const args = [
      '--skip-download',
      '--dump-single-json',
      '-4',
      url
    ];

    try {
      const stdout = await this.run(args, { timeoutMs });
      return JSON.parse(stdout);
    } catch (error) {
      if (error.message.includes('timed out')) {
        throw new Error('Failed to fetch video metadata: Request timed out');
      }
      throw new Error(`Failed to fetch video metadata: ${error.message}`);
    }
  }
}

module.exports = new YtDlpRunner();