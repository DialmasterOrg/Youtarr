const { normalizeUrlToVideoId } = require('../youtubeUrlParser');
const MessageEmitter = require('../messageEmitter');
const { VIDEO_ID_PATTERN } = require('../constants/youtube');

// Transient queue ownership. Jobs cannot resume after a server restart, so
// activity must not outlive this process or be persisted as file availability.
class VideoActivity {
  constructor() {
    this.entries = new Map();
    this.revision = 0;
    this.instanceId = require('uuid').v4();
  }

  changed() {
    this.revision += 1;
    MessageEmitter.emitMessage('broadcast', null, 'download', 'videoActivityUpdated', {
      revision: this.revision,
      instanceId: this.instanceId,
    });
  }

  snapshot() {
    return {
      instanceId: this.instanceId,
      revision: this.revision,
      videos: Object.fromEntries([...this.entries].map(([id, owners]) => {
        const entries = [...owners].map(([jobId, state]) => ({ jobId, state }));
        return [id, entries.find(entry => entry.state === 'downloading') || entries[0]];
      })),
    };
  }

  isActive(youtubeId) {
    return this.entries.has(youtubeId);
  }

  // Synchronous check-and-claim, before job creation's first await. Unknown
  // URLs (e.g. playlists) retain existing behavior and are tracked on discovery.
  claim(jobId, urls) {
    const acceptedUrls = [];
    const acceptedIds = [];
    const alreadyActiveIds = new Set();
    const seen = new Set();
    for (const url of urls) {
      let id;
      try {
        id = normalizeUrlToVideoId(url).id;
      } catch {
        acceptedUrls.push(url);
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      if (this.entries.has(id)) {
        alreadyActiveIds.add(id);
        continue;
      }
      this.entries.set(id, new Map([[jobId, 'queued']]));
      acceptedUrls.push(url);
      acceptedIds.push(id);
    }
    if (acceptedIds.length) this.changed();
    return { acceptedUrls, acceptedIds, alreadyActiveIds: [...alreadyActiveIds] };
  }

  start(jobId, youtubeId) {
    if (!VIDEO_ID_PATTERN.test(youtubeId)) return;
    let changed = false;
    // A new extraction ends the previous attempt, even if its stderr only
    // contained recoverable errors. Other jobs' queue ownership survives.
    for (const [id, owners] of this.entries) {
      if (owners.get(jobId) === 'downloading' && id !== youtubeId) {
        owners.delete(jobId);
        if (!owners.size) this.entries.delete(id);
        changed = true;
      }
    }
    const owners = this.entries.get(youtubeId) || new Map();
    if (owners.get(jobId) !== 'downloading') {
      owners.set(jobId, 'downloading');
      this.entries.set(youtubeId, owners);
      changed = true;
    }
    if (changed) this.changed();
  }

  finish(jobId, youtubeId) {
    const owners = this.entries.get(youtubeId);
    if (owners?.delete(jobId)) {
      if (!owners.size) this.entries.delete(youtubeId);
      this.changed();
    }
  }

  finishJob(jobId) {
    let changed = false;
    for (const [id, owners] of this.entries) {
      if (owners.delete(jobId)) {
        if (!owners.size) this.entries.delete(id);
        changed = true;
      }
    }
    if (changed) this.changed();
  }
}

module.exports = new VideoActivity();
module.exports.VideoActivity = VideoActivity;
