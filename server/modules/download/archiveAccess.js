// A purge must not rewrite complete.list while yt-dlp is using it or while
// finalization still relies on the archive's starting line count.
class ArchiveAccess {
  constructor() {
    this.downloads = 0;
    this.purgeFinished = null;
  }

  async withDownload(run) {
    while (this.purgeFinished) await this.purgeFinished;
    this.downloads += 1;
    try {
      return await run();
    } finally {
      this.downloads -= 1;
    }
  }

  // Whether a purge that removes archive entries would be refused right now.
  isDownloading() {
    return this.downloads > 0;
  }

  // Claim synchronously, before the purge's first await. New downloads wait
  // for release; a purge requested during a download is refused immediately.
  acquirePurge() {
    if (this.downloads > 0 || this.purgeFinished) {
      const error = new Error('Wait for active downloads to finish before emptying trash with archive removal.');
      error.code = 'ARCHIVE_BUSY';
      throw error;
    }
    let finish;
    this.purgeFinished = new Promise((resolve) => { finish = resolve; });
    return () => {
      this.purgeFinished = null;
      finish();
    };
  }
}

module.exports = new ArchiveAccess();
module.exports.ArchiveAccess = ArchiveAccess;
