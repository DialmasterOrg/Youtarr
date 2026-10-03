/**
 * NFO files for TV layout: <stem>.nfo (episodedetails) next to each episode
 * and tvshow.nfo in the show folder. Read by Jellyfin, Emby, Kodi and Plex's
 * NFO agents. Both are written whatever writeVideoNfoFiles says: without the
 * episode NFO, Jellyfin titles episodes after the file name.
 *
 * Never written: lockdata (Jellyfin would stop re-reading the NFO),
 * dateadded (it would change on every rewrite), and relative artwork paths
 * (Jellyfin rejects them).
 */

const fs = require('fs');
const path = require('path');
const nfoGenerator = require('../nfoGenerator');

const TV_SHOW_NFO_NAME = 'tvshow.nfo';
const SHOW_STUDIO = 'YouTube';
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const escape = (text) => nfoGenerator.escapeXml(text);

function element(name, value) {
  return `  <${name}>${escape(value)}</${name}>\n`;
}

/**
 * The day a date-numbered episode code stands for (season = year, episode =
 * MMDDHHMM, possibly bumped past 59 minutes), or null when it isn't a date.
 */
function dateFromEpisodeCode(season, episode) {
  const month = Math.floor(episode / 1000000);
  const day = Math.floor(episode / 10000) % 100;
  const date = new Date(Date.UTC(season, month - 1, day));
  if (season < 1000 || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${season}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * @param {Object} params
 * @param {Object} params.info - yt-dlp info dict (with normalized_rating applied)
 * @param {string} params.showTitle
 * @param {number} params.season
 * @param {number} params.episode
 * @param {string} [params.episodeTitle] - Defaults to the video title; never channel-prefixed
 * @returns {string}
 */
function buildEpisodeNfo({ info, showTitle, season, episode, episodeTitle }) {
  const title = episodeTitle || info.fulltitle || info.title || 'Unknown Title';
  const aired = nfoGenerator.formatDate(info.upload_date);
  const studio = info.uploader || info.channel || info.uploader_id || info.channel_id || '';
  const runtime = nfoGenerator.calculateRuntime(info.duration);

  let xml = XML_HEADER;
  xml += '<episodedetails>\n';
  xml += element('title', title);
  xml += element('showtitle', showTitle);
  xml += `  <season>${season}</season>\n`;
  xml += `  <episode>${episode}</episode>\n`;
  if (info.description) xml += element('plot', info.description);
  if (aired) {
    xml += element('aired', aired);
    xml += element('premiered', aired);
  }
  if (runtime > 0) xml += `  <runtime>${runtime}</runtime>\n`;
  if (studio) xml += element('studio', studio);
  for (const genre of info.categories || []) xml += element('genre', genre);
  for (const tag of info.tags || []) xml += element('tag', tag);
  if (info.normalized_rating) xml += element('mpaa', info.normalized_rating);
  if (info.id) xml += `  <uniqueid type="youtube" default="true">${escape(info.id)}</uniqueid>\n`;
  xml += '</episodedetails>\n';
  return xml;
}

/**
 * @param {Object} params
 * @param {string} params.title - Show title
 * @param {string} [params.plot]
 * @param {string} [params.premiered] - YYYY-MM-DD of the earliest episode
 * @param {string} params.externalKey - Stable show id (the channel id for channel shows)
 * @returns {string}
 */
function buildTvShowNfo({ title, plot, premiered, externalKey }) {
  let xml = XML_HEADER;
  xml += '<tvshow>\n';
  xml += element('title', title);
  if (plot) xml += element('plot', plot);
  if (premiered) xml += element('premiered', premiered);
  xml += element('studio', SHOW_STUDIO);
  // The custom id keeps Jellyfin's played state across a folder rename and
  // stops Jellyfin 12 merging two same-named shows.
  xml += `  <uniqueid type="youtube" default="true">${escape(externalKey)}</uniqueid>\n`;
  xml += `  <uniqueid type="custom">${escape(externalKey)}</uniqueid>\n`;
  xml += '</tvshow>\n';
  return xml;
}

/**
 * Write tvshow.nfo when it is missing or its content would change.
 * @returns {Promise<boolean>} true when the file was written
 */
async function writeTvShowNfoIfChanged(showDir, params) {
  const nfoPath = path.join(showDir, TV_SHOW_NFO_NAME);
  const xml = buildTvShowNfo(params);
  let current = null;
  try {
    current = await fs.promises.readFile(nfoPath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (current === xml) return false;
  await fs.promises.writeFile(nfoPath, xml, 'utf8');
  return true;
}

module.exports = {
  TV_SHOW_NFO_NAME,
  dateFromEpisodeCode,
  buildEpisodeNfo,
  buildTvShowNfo,
  writeTvShowNfoIfChanged
};
