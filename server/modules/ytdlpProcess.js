const { spawn, spawnSync } = require('child_process');
const { prepareExternalCookies } = require('./externalCookies');
const uploadedCookies = require('./uploadedCookies');

// yt-dlp writes its cookie jar back on exit, so neither the external source nor
// the uploaded file is ever passed to it. Every invocation gets its own
// writable copy instead.
function prepareCookies(args) {
  const external = prepareExternalCookies(args);
  const uploaded = uploadedCookies.prepare(external.args);
  const cleanups = [external.cleanup, uploaded.cleanup].filter(Boolean);
  return {
    args: uploaded.args,
    cleanup: cleanups.length > 0 ? () => cleanups.forEach((cleanup) => cleanup()) : null,
  };
}

// Keep the existing ChildProcess API and event handling at each call site.
function spawnYtDlp(args, options) {
  const prepared = prepareCookies(args);
  try {
    const child = spawn('yt-dlp', prepared.args, options);
    if (prepared.cleanup) {
      // 'close' also follows a failed spawn. An 'error' alone can mean a failed
      // kill while yt-dlp is still running, so do not remove its file then.
      child.once('close', prepared.cleanup);
    }
    return child;
  } catch (error) {
    prepared.cleanup?.();
    throw error;
  }
}

function spawnYtDlpSync(args, options) {
  const prepared = prepareCookies(args);
  try {
    return spawnSync('yt-dlp', prepared.args, options);
  } finally {
    prepared.cleanup?.();
  }
}

module.exports = { spawnYtDlp, spawnYtDlpSync };
