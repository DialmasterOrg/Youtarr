// Translates the summary watchStatusSync.syncAll resolves with into the
// scheduled task run record. syncAll never rejects: skips and per-server
// failures come back inside the summary, so they have to be read out here.

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function toRunRecord(summary) {
  if (!summary || typeof summary !== 'object') {
    return { status: 'error', outcome: 'error', message: 'The sync returned no result.', details: null };
  }
  if (summary.skipped) {
    return { status: 'skipped', outcome: 'skipped', message: `${capitalize(summary.skipped)}.`, details: null };
  }
  if (summary.error) {
    return { status: 'error', outcome: 'error', message: summary.error, details: null };
  }

  const servers = Object.entries(summary.servers || {});
  const failed = servers.filter(([, result]) => result && result.error);
  const updated = servers.reduce((sum, [, result]) => sum + (Number(result && result.updated) || 0), 0);
  const details = { servers: servers.length, failed: failed.length, updated };

  if (failed.length > 0) {
    const failures = failed.map(([name, result]) => `${name} failed: ${result.error}`).join('; ');
    return {
      status: 'error',
      outcome: 'partial',
      message: `Synced ${servers.length - failed.length} of ${servers.length} servers (${updated} videos updated); ${failures}`,
      details,
    };
  }
  return {
    status: 'success',
    outcome: 'completed',
    message: `Synced ${servers.length} server${servers.length === 1 ? '' : 's'}, ${updated} videos updated.`,
    details,
  };
}

module.exports = { toRunRecord };
