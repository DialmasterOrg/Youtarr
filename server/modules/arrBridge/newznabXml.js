// Writes the Newznab documents: capabilities, search results and errors.
// Every value is escaped here.
const { escapeXml } = require('../feeds/rssWriter');
const { NEWZNAB_CATEGORIES } = require('./arrBridgeConfig');
const { MAX_LIMIT, DEFAULT_LIMIT } = require('./newznabRequest');

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const ITEM_CATEGORIES = { tv: [5000, 5040], movie: [2000, 2040] };

/**
 * No id parameters and no raw search engine, on purpose: with an id Sonarr
 * sends no title, and a release it matched by id alone is grabbed but never
 * imported. With "title" it sends the series title untouched; its q has a
 * leading "The" removed.
 * @returns {string}
 */
function renderCaps() {
  const categories = NEWZNAB_CATEGORIES.flatMap((category) => [
    `    <category id="${category.id}" name="${escapeXml(category.name)}">`,
    ...category.subcategories.map((sub) => `      <subcat id="${sub.id}" name="${escapeXml(sub.name)}"/>`),
    '    </category>',
  ]);
  return [
    XML_HEADER,
    '<caps>',
    '  <server version="1.0" title="Youtarr" strapline="YouTube videos through Youtarr"/>',
    `  <limits max="${MAX_LIMIT}" default="${DEFAULT_LIMIT}"/>`,
    '  <registration available="no" open="no"/>',
    '  <searching>',
    '    <search available="yes" supportedParams="q"/>',
    '    <tv-search available="yes" supportedParams="q,title,season,ep"/>',
    '    <movie-search available="yes" supportedParams="q"/>',
    '  </searching>',
    '  <categories>',
    ...categories,
    '  </categories>',
    '</caps>',
    '',
  ].join('\n');
}

function renderError(code, description) {
  return `${XML_HEADER}\n<error code="${Number(code)}" description="${escapeXml(description)}"/>\n`;
}

// Size is always 0: Sonarr rejects a realistic YouTube size as too small for
// the series runtime, and 0 skips that check in Sonarr and Radarr.
function renderItem(item) {
  const link = escapeXml(item.link);
  return [
    '    <item>',
    `      <title>${escapeXml(item.title)}</title>`,
    `      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>`,
    `      <link>${link}</link>`,
    `      <comments>${escapeXml(item.comments)}</comments>`,
    `      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>`,
    `      <enclosure url="${link}" length="0" type="application/x-nzb"/>`,
    ...ITEM_CATEGORIES[item.kind].map((id) => `      <newznab:attr name="category" value="${id}"/>`),
    '      <newznab:attr name="size" value="0"/>',
    '    </item>',
  ].join('\n');
}

/**
 * @param {Array<Object>} items - { title, guid, link, comments, pubDate, kind }
 * @returns {string} The search result document
 */
function renderSearch(items) {
  return [
    XML_HEADER,
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:newznab="http://www.newznab.com/DTD/2010/feeds/attributes/">',
    '  <channel>',
    '    <title>Youtarr</title>',
    '    <description>YouTube videos through Youtarr</description>',
    `    <newznab:response offset="0" total="${items.length}"/>`,
    ...items.map(renderItem),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

module.exports = { renderCaps, renderError, renderSearch };
