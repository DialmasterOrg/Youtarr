const logger = require('../../logger');
const ytDlpRunner = require('../ytDlpRunner');

function isExpectedYtdlpSkipMessage(message = '') {
  const normalized = String(message);
  if (ytDlpRunner.isMembersOnlyError(normalized)) {
    return true;
  }
  const expectedPatterns = [
    /this live event will begin/i,
    /will begin in (?:a few moments|\d+)/i,
    /premiere (?:will begin|starts|is upcoming)/i,
    /premieres? in \d+/i,
    /pre[- ]release/i,
    /this video is not yet available/i,
    /release time of video is not known/i,
  ];

  return expectedPatterns.some(pattern => pattern.test(normalized));
}

// Narrower predicate than isExpectedYtdlpSkipMessage: only matches members-only
// patterns, not upcoming-premiere or pre-release ones. Used to decide whether
// to stamp channelvideos.availability with 'subscriber_only', which would be
// wrong for premiere/pre-release skips (those are temporary states).
function isMembersOnlyMessage(message = '') {
  return ytDlpRunner.isMembersOnlyError(message);
}

function extractYoutubeIdFromYtdlpError(message = '') {
  const match = String(message).match(/\[youtube\]\s+([a-zA-Z0-9_-]{11}):/);
  return match ? match[1] : null;
}

function extractChannelIdFromYtdlpError(message = '') {
  const match = String(message).match(/\[youtube:tab\]\s+(UC[a-zA-Z0-9_-]{22}):/);
  return match ? match[1] : null;
}

// Per-download classification and bookkeeping of yt-dlp ERROR lines.
// One instance per doDownload run.
class YtdlpErrorTracker {
  constructor({ persistMembersOnlyAvailability, persistTerminatedChannel, emitWarningMessage }) {
    this.persistMembersOnlyAvailability = persistMembersOnlyAvailability;
    this.persistTerminatedChannel = persistTerminatedChannel;
    this.emitWarningMessage = emitWarningMessage;

    this.failedVideos = new Map(); // youtubeId -> { url, error, youtubeId }
    // Count of yt-dlp errors that we treat as expected skips (members-only,
    // upcoming live, premiere, etc.). Only the count drives downstream
    // behavior; per-skip context goes to the structured log.
    this.expectedSkipCount = 0;
    // Set of youtube_id values that yt-dlp specifically rejected as
    // members-only. Tracked separately from expectedSkipCount so the final
    // summary can call out membership-gated skips (the user can't fix
    // those by waiting like with premieres). Set semantics dedupe across
    // stdout+stderr emitting the same error for one video (the persist
    // call itself is not deduped; it's idempotent).
    this.membersOnlyVideoIds = new Set();
    // Count of yt-dlp errors that are NOT expected skips. Incremented in
    // both stdout and stderr handlers regardless of whether currentVideoId
    // is known, so unassociated errors still block the
    // "complete with only expected skips" classification.
    this.unexpectedErrorCount = 0;
    // seenTerminatedChannelIds: sync dedupe across stdout/stderr.
    // terminatedChannelIds: only successful persists; drives hasOnlyHandledErrors.
    // terminatedChannels: rich entries for the summary, populated on success only.
    // terminationFailures: channel ids seen terminated but not
    //   auto-disabled (row missing or update threw). Surfaced
    //   separately so the multi-group finalizer can warn on them.
    // persistencePromises: awaited by the exit handler before final state.
    this.seenTerminatedChannelIds = new Set();
    this.terminatedChannelIds = new Set();
    this.terminatedChannels = [];
    this.terminationFailures = [];
    this.persistencePromises = [];
    this.currentVideoId = null; // Track the current video being processed
    this.lastErrorMessage = null; // Store the last error message seen
  }

  // Called when yt-dlp starts extracting a new URL; clears the per-video error.
  trackVideoStart(youtubeId) {
    this.currentVideoId = youtubeId;
    this.lastErrorMessage = null;
  }

  // Called when a destination path reveals the video id (does not clear lastErrorMessage).
  trackVideoFromDestination(youtubeId) {
    this.currentVideoId = youtubeId;
  }

  recordExpectedSkip(reason, source) {
    this.expectedSkipCount += 1;
    logger.info({ youtubeId: this.currentVideoId, reason, source }, 'Expected video skip from yt-dlp');
  }

  // Shared by stdout and stderr. Returns true when the line was consumed
  // by an expected skip or termination, so the caller can suppress it.
  handleErrorLine(line, source) {
    const errorMatch = line.match(/ERROR:\s*(.+)/);
    if (!errorMatch) return false;

    this.lastErrorMessage = errorMatch[1].trim();

    if (isExpectedYtdlpSkipMessage(this.lastErrorMessage)) {
      this.recordExpectedSkip(this.lastErrorMessage, source);
      if (isMembersOnlyMessage(this.lastErrorMessage)) {
        const membersOnlyVideoId = extractYoutubeIdFromYtdlpError(this.lastErrorMessage) || this.currentVideoId;
        if (membersOnlyVideoId) {
          this.membersOnlyVideoIds.add(membersOnlyVideoId);
          this.persistMembersOnlyAvailability(membersOnlyVideoId);
        }
      }
      return true;
    }

    if (ytDlpRunner.isTerminatedAccountError(this.lastErrorMessage)) {
      const channelId = extractChannelIdFromYtdlpError(this.lastErrorMessage);
      if (channelId) {
        if (!this.seenTerminatedChannelIds.has(channelId)) {
          this.seenTerminatedChannelIds.add(channelId);
          logger.warn({ channelId, source }, 'Detected terminated YouTube channel');

          // Broadcast after the lookup so we can name the uploader, not
          // the raw ID. Only mark as handled on success; persistence
          // failure stays in the unexpected-error branch so we don't
          // tell the user "disabled" when nothing was actually disabled.
          const lookupPromise = this.persistTerminatedChannel(channelId).then(row => {
            if (row) {
              this.terminatedChannelIds.add(channelId);
              this.terminatedChannels.push({
                channelId,
                uploader: row.uploader || null,
                url: row.url || null,
                terminatedAt: row.terminated_at || null
              });
              const displayName = row.uploader || channelId;
              this.emitWarningMessage(
                `Channel "${displayName}" marked terminated by YouTube; scheduled downloads disabled`
              );
            } else {
              this.unexpectedErrorCount += 1;
              this.terminationFailures.push(channelId);
              logger.warn({ channelId, source }, 'Termination detected but could not be auto-disabled; channel will continue to retry');
              this.emitWarningMessage(
                `Channel ${channelId} reported as terminated by YouTube but could not be auto-disabled`
              );
            }
          });
          this.persistencePromises.push(lookupPromise);
        }
        return true;
      }
      // No channel id: fall through to the unexpected-error branch.
    }

    this.unexpectedErrorCount += 1;
    const errorLogMessage = source === 'stderr'
      ? 'Error detected in stderr'
      : 'Error detected during download';
    logger.warn({ error: this.lastErrorMessage, currentVideoId: this.currentVideoId }, errorLogMessage);
    if (this.currentVideoId && !this.failedVideos.has(this.currentVideoId)) {
      this.failedVideos.set(this.currentVideoId, {
        youtubeId: this.currentVideoId,
        error: this.lastErrorMessage,
        url: null
      });
      logger.info({ youtubeId: this.currentVideoId, error: this.lastErrorMessage }, 'Recorded video failure');
    }
    return false;
  }

  // Barrier before final-state derivation so the final broadcast can name
  // uploaders instead of raw channel IDs.
  async settlePersistence() {
    if (this.persistencePromises.length > 0) {
      await Promise.allSettled(this.persistencePromises);
    }
  }
}

module.exports = {
  YtdlpErrorTracker,
  isExpectedYtdlpSkipMessage,
  isMembersOnlyMessage,
  extractYoutubeIdFromYtdlpError,
  extractChannelIdFromYtdlpError,
};
