// Read-only key for dashboards and monitors: it reaches only the status
// summary endpoint and can never start a download.
const STATUS_READ_ROLE = 'status_read';

const STATUS_SUMMARY_PATH = '/api/status/summary';

module.exports = {
  STATUS_READ_ROLE,
  STATUS_SUMMARY_PATH,
};
