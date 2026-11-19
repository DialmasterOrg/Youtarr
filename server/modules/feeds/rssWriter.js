// Writes the RSS 2.0 document for a feed. Every value is escaped here, so callers
// pass plain text, and pass an item's HTML body as a plain string.

// XML 1.0 forbids the other control characters, U+FFFE, U+FFFF and unpaired
// surrogates. A strict reader rejects the whole feed over a single one, so one
// odd video description would otherwise break the feed until it scrolled off.
const XML_ILLEGAL_CHARACTERS = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;

function escapeXml(text) {
  return String(text ?? '')
    .replace(XML_ILLEGAL_CHARACTERS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const toRfc822 = (date) => new Date(date).toUTCString();

function renderItem(item) {
  return [
    '    <item>',
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(item.link)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>`,
    `      <pubDate>${toRfc822(item.pubDate)}</pubDate>`,
    `      <dc:creator>${escapeXml(item.creator)}</dc:creator>`,
    `      <media:thumbnail url="${escapeXml(item.thumbnailUrl)}"/>`,
    `      <description>${escapeXml(item.description)}</description>`,
    '    </item>',
  ].join('\n');
}

/**
 * @param {Object} feed
 * @param {string} feed.title
 * @param {string} feed.link - Absolute URL of the feed's home page
 * @param {string} feed.description
 * @param {Date|string|null} feed.lastBuildDate - Leave out while the feed is empty
 * @param {Array<Object>} feed.items - { title, link, guid, pubDate, creator, thumbnailUrl, description }
 * @returns {string} The RSS document
 */
function renderRss({ title, link, description, lastBuildDate, items }) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">',
    '  <channel>',
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(link)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
  ];
  if (lastBuildDate) {
    lines.push(`    <lastBuildDate>${toRfc822(lastBuildDate)}</lastBuildDate>`);
  }
  lines.push(...items.map(renderItem), '  </channel>', '</rss>', '');
  return lines.join('\n');
}

module.exports = { renderRss, escapeXml };
