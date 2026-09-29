// HTTP mapping for scheduledTaskManager run blockers, shared by every route
// that starts a scheduled task.

const NOT_REGISTERED = 'not-registered';

function toIso(date) {
  return date ? date.toISOString() : null;
}

function toRunNowState(blocker) {
  if (!blocker) return { available: true, reason: null, message: null, availableAt: null };
  return { available: false, reason: blocker.reason, message: blocker.message, availableAt: toIso(blocker.availableAt) };
}

function sendRunBlocked(res, blocker, messages = {}) {
  const status = blocker.reason === NOT_REGISTERED ? 503 : 409;
  return res.status(status).json({
    error: messages[blocker.reason] || blocker.message,
    reason: blocker.reason,
    availableAt: toIso(blocker.availableAt),
  });
}

module.exports = { sendRunBlocked, toRunNowState };
