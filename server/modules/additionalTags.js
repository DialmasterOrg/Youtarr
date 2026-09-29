/**
 * Shared parsing for Channel.additional_tags (pipe-separated custom tags).
 * Used by channelSettingsModule validation and the post-download metadata
 * embed; previously each had its own copy of the split/trim/filter parse.
 */

/**
 * Parse a pipe-separated additional_tags string into a trimmed, non-empty array.
 * @param {string|null|undefined} tags
 * @returns {string[]}
 */
function parseAdditionalTags(tags) {
  if (!tags) return [];
  return tags.split('|').map((t) => t.trim()).filter((t) => t.length > 0);
}

module.exports = {
  parseAdditionalTags,
};
