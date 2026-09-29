// Translates the summary watchStatusSync.syncAll resolves with into the
// scheduled task run record. syncAll never rejects: skips and per-server
// failures come back inside the summary, so they have to be read out here.

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const plural = (count, noun) => `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;

function describeChanges(changed) {
  if (changed === 0) return 'no watch status changes';
  if (changed === 1) return '1 had a watch status change';
  return `${changed.toLocaleString('en-US')} had watch status changes`;
}

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
  const synced = servers.length - failed.length;
  const checked = Number(summary.totals && summary.totals.checked) || 0;
  const changed = Number(summary.totals && summary.totals.changed) || 0;
  const details = { servers: servers.length, failed: failed.length, checked, changed };

  const serverCount = failed.length > 0 ? `${synced} of ${servers.length}` : `${servers.length}`;
  const counts = `Checked ${plural(checked, 'video')} on ${serverCount} ${servers.length === 1 ? 'server' : 'servers'}; `
    + `${describeChanges(changed)}.`;

  if (failed.length > 0) {
    const failures = failed.map(([name, result]) => `${capitalize(name)} failed: ${result.error}.`).join(' ');
    return {
      status: 'error',
      outcome: 'partial',
      message: synced > 0 ? `${counts} ${failures}` : failures,
      details,
    };
  }
  return { status: 'success', outcome: 'completed', message: counts, details };
}

module.exports = { toRunRecord };
