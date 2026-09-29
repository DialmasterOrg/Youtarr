// Columns another writer (a download, a deletion, the rescan, library repair)
// can change on a videos row. A write decided from an earlier read must only
// land if all of them are still as read; otherwise it would undo that writer.
const GUARDED_COLUMNS = [
  'filePath',
  'fileSize',
  'audioFilePath',
  'audioFileSize',
  'video_resolution',
  'last_downloaded_at',
];

/**
 * Build a `where` clause that matches the row only while it is unchanged since
 * `row` was read. Use as `Video.update(changes, { where: unchangedSinceRead(row) })`;
 * zero affected rows means another writer changed it in the meantime, provided
 * `changes` includes at least one column whose value really differs. Sequelize's
 * MySQL dialect connects with `-FOUND_ROWS`, so mysql2 reports rows changed, not
 * rows matched, and a write that changes nothing also reports zero.
 * @param {Object} row - The row as read, raw or a model instance; must include every guarded column
 * @returns {Object}
 */
function unchangedSinceRead(row) {
  const where = {
    id: row.id,
    // Raw queries return BOOLEAN columns as 0/1.
    removed: Boolean(row.removed),
  };
  for (const column of GUARDED_COLUMNS) {
    if (row[column] === undefined) {
      throw new Error(`unchangedSinceRead: row is missing guarded column "${column}"`);
    }
    // Sequelize turns null into IS NULL.
    where[column] = row[column];
  }
  return where;
}

module.exports = { unchangedSinceRead, GUARDED_COLUMNS };
