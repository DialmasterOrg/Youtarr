/**
 * Title shows as the API sees them. Each change (add, edit, retire, restore,
 * reorder, an episode assignment, using a duplicate's copy, re-checking
 * titles) becomes the channel's full set of drafts plus overrides and goes
 * through titleShowSaver, which saves it or asks for the reorganize.
 */

const { Channel, Video, VideoClassification, EpisodeConflict, TvShow } = require('../../models');
const ChannelVideo = require('../../models/channelvideo');
const configModule = require('../configModule');
const videoActivity = require('../download/videoActivity');
const { getLayoutResolver, listTvFolders } = require('./libraryLayouts');
const { effectiveLibraryFolder, showDirectory } = require('./channelFolders');
const sidecarWriter = require('../sidecarWriter');
const logger = require('../../logger');
const titleShowStore = require('./titleShowStore');
const titleShowSaver = require('./titleShowSaver');
const titleShowQueries = require('./titleShowQueries');
const episodeConflicts = require('./episodeConflicts');
const { summarizePlan } = require('./titlePreview');
const { defaultLibraryFolder } = require('./titleShowDrafts');
const { episodeCode } = require('./episodeNaming');
const { SOURCE } = require('./titleNumbering');
const { KIND_TITLE_SHOW } = require('./constants');

const ASSIGNMENT_FIELDS = ['showId', 'season', 'episode', 'notAnEpisode', 'automatic'];

function serviceError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function publicShow(show, counts) {
  return {
    id: show.id,
    name: show.name,
    folderName: show.folderName,
    libraryFolder: show.libraryFolder,
    position: show.position,
    retired: show.retired,
    excludeTerms: show.excludeTerms,
    seasonNames: show.seasonNames,
    patterns: show.patterns.map((pattern) => ({
      text: pattern.text,
      kind: pattern.kind,
      seasonSource: pattern.seasonSource,
      seasonFixed: pattern.seasonFixed,
      episodeSource: pattern.episodeSource,
      compiledRegex: pattern.compiledRegex,
    })),
    counts: counts || null,
  };
}

function parseDetails(text) {
  try {
    return JSON.parse(text || '{}') || {};
  } catch (err) {
    return {};
  }
}

class TitleShowService {
  async currentDrafts(channelId) {
    return (await titleShowStore.listTitleShows(channelId)).map(titleShowStore.toDraft);
  }

  async refreshedChannel(channel) {
    return (await Channel.findOne({ where: { channel_id: channel.channel_id } })) || channel;
  }

  /**
   * A channel's title shows (retired ones included), conflicts, show-only
   * switch and where new shows go.
   */
  async getChannelShows(channel) {
    const channelId = channel.channel_id;
    const shows = await titleShowStore.listTitleShows(channelId, { includeRetired: true });
    const counts = await titleShowQueries.countsByShow(shows.map((show) => show.id));
    const conflictRows = await episodeConflicts.listForChannel(channelId);
    const ids = [...new Set(conflictRows.flatMap((row) => [row.youtubeId, row.duplicateOf].filter(Boolean)))];
    const videos = await titleShowQueries.describeVideos(channelId, ids);
    const layoutOf = await getLayoutResolver();
    const tvFolders = await listTvFolders();
    const describe = (id) => videos.get(id) || { title: null, downloaded: false, videoId: null };
    return {
      shows: shows.map((show) => publicShow(show, counts.get(show.id))),
      conflicts: conflictRows.map((row) => ({
        ...row,
        ...describe(row.youtubeId),
        duplicateOfTitle: row.duplicateOf ? describe(row.duplicateOf).title : null,
      })),
      showOnlyDownloads: Boolean(channel.tv_show_only_downloads),
      tvFolders,
      defaultLibraryFolder: defaultLibraryFolder({
        channelFolder: effectiveLibraryFolder(channel.sub_folder),
        defaultFolder: configModule.getDefaultSubfolder() || '',
        tvFolders,
        layoutOf,
      }),
    };
  }

  async saveAndDescribe(channel, rawShows, rawOverrides) {
    const params = rawOverrides ? { channel, rawShows, rawOverrides } : { channel, rawShows };
    await titleShowSaver.save(params);
    await this.refreshShowMetadata(channel.channel_id);
    return this.getChannelShows(await this.refreshedChannel(channel));
  }

  /**
   * Media servers read a title show's name and season names from its NFO
   * files, and a save that changes them moves no file: rewrite them (a show
   * folder that doesn't exist yet is skipped).
   */
  async refreshShowMetadata(channelId) {
    const shows = await TvShow.findAll({ where: { channel_id: channelId, kind: KIND_TITLE_SHOW, retired_at: null } });
    for (const show of shows) {
      try {
        await sidecarWriter.writeShowMetadata({ show, showDir: showDirectory(show) });
      } catch (err) {
        logger.warn({ err, showId: show.id }, 'Could not update a title show\'s NFO files');
      }
    }
  }

  async createShow(channel, rawDraft) {
    const drafts = await this.currentDrafts(channel.channel_id);
    // Always a new show: an id would make it a second copy of an existing one.
    const draft = { ...rawDraft };
    delete draft.id;
    return this.saveAndDescribe(channel, [...drafts, draft]);
  }

  async updateShow(channel, showId, rawDraft) {
    const drafts = await this.currentDrafts(channel.channel_id);
    if (!drafts.some((draft) => draft.id === showId)) throw serviceError('Show not found', 404);
    return this.saveAndDescribe(channel, drafts.map((draft) => (draft.id === showId ? { ...rawDraft, id: showId } : draft)));
  }

  async retireShow(channel, showId) {
    const drafts = await this.currentDrafts(channel.channel_id);
    if (!drafts.some((draft) => draft.id === showId)) throw serviceError('Show not found', 404);
    return this.saveAndDescribe(channel, drafts.filter((draft) => draft.id !== showId));
  }

  async restoreShow(channel, showId) {
    const shows = await titleShowStore.listTitleShows(channel.channel_id, { includeRetired: true });
    const show = shows.find((entry) => entry.id === showId);
    if (!show) throw serviceError('Show not found', 404);
    if (!show.retired) throw serviceError('That show isn\'t removed.', 400);
    const active = shows.filter((entry) => !entry.retired).map(titleShowStore.toDraft);
    return this.saveAndDescribe(channel, [...active, titleShowStore.toDraft(show)]);
  }

  async reorderShows(channel, showIds) {
    const drafts = await this.currentDrafts(channel.channel_id);
    const ids = drafts.map((draft) => draft.id);
    const valid = Array.isArray(showIds) && showIds.length === ids.length
      && new Set(showIds).size === ids.length && showIds.every((id) => ids.includes(id));
    if (!valid) throw serviceError('showIds must list every show of the channel once.', 400);
    return this.saveAndDescribe(channel, showIds.map((id) => drafts.find((draft) => draft.id === id)));
  }

  /** Classify the channel's titles again with its current shows (after a classification error). */
  async recheck(channel) {
    await titleShowSaver.save({ channel, rawShows: await this.currentDrafts(channel.channel_id) });
    return this.getChannelShows(await this.refreshedChannel(channel));
  }

  async setShowOnly(channel, enabled) {
    await channel.update({ tv_show_only_downloads: enabled });
    return { showOnlyDownloads: enabled };
  }

  /**
   * What a set of draft shows would do, without saving anything.
   */
  async preview(channel, { shows, overrides = [] }) {
    const { drafts, plan } = await titleShowSaver.prepare({ channel, rawShows: shows, rawOverrides: overrides });
    return {
      ...summarizePlan(plan, { videos: plan.videos, isQueued: (id) => videoActivity.isActive(id) }),
      compiled: drafts.map((draft) => ({ key: draft.key, patterns: draft.patterns.map((pattern) => pattern.compiledRegex) })),
    };
  }

  /** "Use this copy instead": the duplicate takes the number its holder has. */
  async useDuplicateCopy(channel, youtubeId) {
    const conflict = await EpisodeConflict.findByPk(youtubeId);
    if (!conflict || conflict.channel_id !== channel.channel_id || conflict.kind !== 'duplicate') {
      throw serviceError('No duplicate of this channel with that id', 404);
    }
    const { season, episode } = parseDetails(conflict.details);
    return this.saveAndDescribe(channel, await this.currentDrafts(channel.channel_id), [
      { youtubeId, showId: conflict.show_id, season, episode },
    ]);
  }

  async missingEpisodes(channel, showId) {
    const result = await titleShowQueries.missingEpisodes(channel.channel_id, showId);
    if (!result) throw serviceError('Show not found', 404);
    return result;
  }

  // The tracked channel a video belongs to: its classification's owner, else
  // the channel it was downloaded or listed under.
  async ownerChannelOf(youtubeId, classification) {
    let channelId = classification ? classification.channel_id : null;
    if (!channelId) {
      const download = await Video.findOne({ where: { youtubeId }, attributes: ['channel_id'] });
      channelId = download ? download.channel_id : null;
    }
    if (!channelId) {
      const listed = await ChannelVideo.findOne({ where: { youtube_id: youtubeId }, attributes: ['channel_id'] });
      channelId = listed ? listed.channel_id : null;
    }
    return channelId ? Channel.findOne({ where: { channel_id: channelId } }) : null;
  }

  /**
   * A video's episode: its classification and the title shows it can join.
   */
  async getVideoEpisode(youtubeId) {
    const row = await VideoClassification.findByPk(youtubeId);
    const channel = await this.ownerChannelOf(youtubeId, row);
    if (!channel) return { channelId: null, assignable: false, classification: null, shows: [] };
    const shows = await titleShowStore.listTitleShows(channel.channel_id);
    let classification = null;
    if (row) {
      const show = await TvShow.findByPk(row.show_id);
      const numbered = row.season !== null && row.episode !== null;
      classification = {
        showId: row.show_id,
        showName: show ? show.name : null,
        kind: show ? show.kind : null,
        status: row.status,
        season: row.season,
        episode: row.episode,
        code: numbered ? episodeCode({ season: row.season, episode: row.episode, dateNumbered: row.source === SOURCE.DATE }) : null,
        source: row.source,
        notAnEpisode: Boolean(row.title_opt_out),
      };
    }
    return {
      channelId: channel.channel_id,
      assignable: Boolean(channel.enabled) && shows.length > 0,
      classification,
      shows: shows.map((show) => ({ id: show.id, name: show.name, seasonNames: show.seasonNames })),
    };
  }

  /**
   * Assign a video to a title show episode by hand, mark it "Not an
   * episode", or return it to automatic classification.
   * @param {Object} body - { showId, season, episode } | { notAnEpisode: true } | { automatic: true }
   */
  async assignEpisode(youtubeId, body) {
    const row = await VideoClassification.findByPk(youtubeId);
    const channel = await this.ownerChannelOf(youtubeId, row);
    if (!channel || !channel.enabled) throw serviceError('This video\'s channel isn\'t subscribed.', 400);
    const rawShows = await this.currentDrafts(channel.channel_id);
    if (rawShows.length === 0) throw serviceError('This video\'s channel has no shows.', 400);
    if (row && row.channel_id !== channel.channel_id) throw serviceError('This video belongs to another channel\'s show.', 400);
    if (body && body.notAnEpisode) {
      // "Not an episode" takes a video out of the title shows; a channel-show
      // episode, or a video in no show, has nothing to leave.
      const show = row && !row.title_opt_out ? await TvShow.findByPk(row.show_id) : null;
      if (!show || show.kind !== KIND_TITLE_SHOW) throw serviceError('Only an episode of a title show can be marked "Not an episode".', 400);
    }
    const override = { youtubeId };
    for (const field of ASSIGNMENT_FIELDS) if (body && body[field] !== undefined) override[field] = body[field];
    await titleShowSaver.save({ channel, rawShows, rawOverrides: [override] });
    return this.getVideoEpisode(youtubeId);
  }
}

module.exports = new TitleShowService();
