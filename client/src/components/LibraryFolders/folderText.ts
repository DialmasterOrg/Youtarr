import type { LibraryFolder, LibraryFolderDetail, LibraryLayout } from '../../types/tvShows';
import { folderState } from '../../utils/libraryAttention';

/** Labels, plurals and the sentences built from a folder's usage (UI 5.6.1, 5.7.3, 5.7.5, 7.3). */

export const SEP = ' \u00b7 ';

export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

export function countOf(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

export function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function units(layout: LibraryLayout): { one: string; many: string } {
  return layout === 'tv' ? { one: 'episode', many: 'episodes' } : { one: 'video', many: 'videos' };
}

export function layoutName(layout: LibraryLayout): string {
  return layout === 'tv' ? 'TV shows' : 'Videos';
}

export function otherLayout(layout: LibraryLayout): LibraryLayout {
  return layout === 'tv' ? 'videos' : 'tv';
}

/** "__Kids"; the main folder is "Main folder" alone or at a sentence start, "the main folder" mid-sentence. */
export function folderLabel(name: string, midSentence = false): string {
  if (name) return `__${name}`;
  return midSentence ? 'the main folder' : 'Main folder';
}

export function filesSummary(folder: LibraryFolder): string | null {
  const count = folder.fileCount ?? 0;
  if (count > 0) {
    const unit = units(folder.layout);
    return `${countOf(count, unit.one, unit.many)} on disk`;
  }
  return folder.hasFiles ? "Holds files Youtarr doesn't track" : null;
}

function channelsSummary(folder: LibraryFolder): string | null {
  const chosen = folder.channelsChosen ?? 0;
  const following = folder.channelsFollowing ?? 0;
  if (folder.isDefault && following > 0) {
    const follow = `${formatCount(following)} ${following === 1 ? 'follows' : 'follow'} the default`;
    return chosen > 0 ? `${formatCount(chosen)} chose this folder, ${follow}` : follow;
  }
  return folder.channels > 0 ? countOf(folder.channels, 'channel', 'channels') : null;
}

export function rowSummary(folder: LibraryFolder): string {
  const state = folderState(folder);
  if (state === 'emptyMain') return `Nothing saved here${SEP}Downloads go to subfolders`;
  if (state === 'unused') return unusedSummary(folder);
  const files = filesSummary(folder);
  if (state === 'holdsVideos') return ['Nothing downloads here now', files].filter(Boolean).join(SEP);
  const parts = [
    channelsSummary(folder),
    (folder.playlists ?? 0) > 0 ? countOf(folder.playlists ?? 0, 'playlist', 'playlists') : null,
    (folder.titleShows ?? 0) > 0 ? countOf(folder.titleShows ?? 0, 'title show', 'title shows') : null,
    files,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(SEP) : 'Nothing downloaded yet';
}

export function unusedSummary(folder: LibraryFolder): string {
  return [`Unused${SEP}Empty`, deleteReasons(folder)[0]].filter(Boolean).join(SEP);
}

const blockerCount = (folder: LibraryFolder, code: string): number => (
  folder.deleteBlockers?.find((blocker) => blocker.code === code)?.count ?? 0
);
const hasBlocker = (folder: LibraryFolder, code: string): boolean => Boolean(folder.deleteBlockers?.some((b) => b.code === code));

/** Every reason delete is refused, in guard order (UI 5.7.5). */
export function deleteReasons(folder: LibraryFolder): string[] {
  const reasons: string[] = [];
  const channels = blockerCount(folder, 'channels');
  const playlists = blockerCount(folder, 'playlists');
  const titleShows = folder.titleShows ?? 0;
  const users = [
    channels > 0 ? countOf(channels, 'channel', 'channels') : null,
    playlists > 0 ? countOf(playlists, 'playlist', 'playlists') : null,
    titleShows > 0 ? countOf(titleShows, 'title show', 'title shows') : null,
  ].filter((part): part is string => Boolean(part));
  if (users.length > 0) {
    reasons.push(`${joinList(users)} ${channels + playlists + titleShows === 1 ? 'downloads' : 'download'} here`);
  }
  const disabled = blockerCount(folder, 'disabledChannels');
  if (disabled > 0) {
    reasons.push(disabled === 1 ? '1 unsubscribed channel still points here' : `${formatCount(disabled)} unsubscribed channels still point here`);
  }
  const shows = blockerCount(folder, 'shows');
  if (shows > 0) reasons.push(`it holds ${countOf(shows, 'TV show', 'TV shows')} with numbered episodes`);
  if (hasBlocker(folder, 'default')) reasons.push("it's the default folder");
  if (hasBlocker(folder, 'files')) {
    const count = folder.fileCount ?? 0;
    const unit = units(folder.layout);
    reasons.push(count > 0 ? `it holds ${countOf(count, `downloaded ${unit.one}`, `downloaded ${unit.many}`)}` : 'it still holds files on disk');
  }
  return reasons;
}

export function deleteReasonText(folder: LibraryFolder): string {
  if (!folder.name) return "The main folder is the downloads folder itself, so it can't be deleted.";
  if (folder.deletable) {
    const mapped = folder.plexMapping && folder.plexMapping.choice !== 'none';
    return `Empty and unused, so you can delete it.${mapped ? ' Its Plex refresh setting is removed too.' : ''}`;
  }
  const reasons = deleteReasons(folder);
  return reasons.length > 0 ? `Can't delete: ${reasons.join('; ')}.` : "Can't delete it right now.";
}

export function verbLabel(folder: LibraryFolder): string {
  return `${folder.layoutChangeNeedsReview ? 'Move to' : 'Use for'} ${layoutName(otherLayout(folder.layout))}`;
}

export const REORGANIZING_LAYOUT_TEXT = 'Downloads are being reorganized. Change folder layouts when that finishes.';
export const REORGANIZING_DEFAULT_TEXT = 'Downloads are being reorganized. Change the default folder when that finishes.';

export interface LayoutConsequence {
  text: string;
  blocked: boolean;
}

export function layoutConsequence({ folder, titleShows, reorganizing }: {
  folder: LibraryFolder;
  /** From the folder detail; null while it loads */
  titleShows: LibraryFolderDetail['titleShows'] | null;
  reorganizing: boolean;
}): LayoutConsequence {
  const target = otherLayout(folder.layout);
  if (reorganizing) return { text: REORGANIZING_LAYOUT_TEXT, blocked: true };
  if (folder.layout === 'tv') {
    const shows = titleShows ?? [];
    if (shows.length === 1) {
      return {
        text: `${shows[0].name} is a title show, and title shows need a TV folder. Move it to another TV folder first, `
          + `in ${shows[0].channelName}'s Channel Settings > TV Show.`,
        blocked: true,
      };
    }
    if (shows.length > 1) {
      return {
        text: `${joinList(shows.map((show) => show.name))} are title shows, and title shows need a TV folder. `
          + 'Move them to another TV folder first, in Channel Settings > TV Show.',
        blocked: true,
      };
    }
    if (!titleShows && (folder.titleShows ?? 0) > 0) {
      return { text: 'Title shows need a TV folder. Move them to another TV folder first, in Channel Settings > TV Show.', blocked: true };
    }
  }
  if (folder.layoutChangeNeedsReview) {
    return { text: `Its downloads move into the ${layoutName(target)} layout. You review every move first; downloads wait meanwhile.`, blocked: false };
  }
  return { text: 'Nothing needs to move, so it switches at once.', blocked: false };
}

/**
 * After the main folder's channel links: the channels that follow the default folder into it
 * (named up to the server's sample), and what moves them out.
 */
export function followersLine(followers: LibraryFolderDetail['followers'], afterLinks: boolean): string | null {
  if (followers.count <= 0) return null;
  const rest = followers.count - followers.sample.length;
  const names = joinList(rest > 0 ? [...followers.sample, `${formatCount(rest)} more`] : followers.sample);
  const lead = `${formatCount(followers.count)}${afterLinks ? ' more' : ''} ${followers.count === 1 ? 'follows' : 'follow'} the default folder`;
  return `${lead}${names ? ` (${names})` : ''}: make another folder the default, or set their Library folder in Channel Settings.`;
}

export function movingNotice(name: string, target: LibraryLayout): string {
  return `Moving ${folderLabel(name, true)}'s downloads to the ${layoutName(target)} layout. Downloads wait until it finishes.`;
}

export interface MakeDefaultText {
  title: string;
  body: string;
  sameLayoutNote: string | null;
  warning: string | null;
  tvLine: string | null;
  confirmLabel: string;
}

export function makeDefaultText({ folder, current }: { folder: LibraryFolder; current: LibraryFolder | null }): MakeDefaultText {
  const label = folderLabel(folder.name, true);
  const currentLabel = current ? folderLabel(current.name, true) : 'the main folder';
  const following = current?.channelsFollowing ?? 0;
  const fallback = "It's also the fallback for downloads with no more specific folder: videos from channels you don't "
    + 'subscribe to, unless a playlist or a single download picks another folder.';
  const body = following > 0
    ? `Channels set to the default folder (${formatCount(following)}) will download to ${label} instead of ${currentLabel}. ${fallback}`
    : `Channels you set to the default folder later will download to ${label} instead of ${currentLabel}. ${fallback}`;
  const sameLayout = !current || current.layout === folder.layout;
  const target = folder.layout;
  return {
    title: `Make ${label} the default folder?`,
    body,
    sameLayoutNote: sameLayout ? `Videos they already downloaded stay where they are. Keep a library on ${currentLabel} to watch them.` : null,
    warning: folder.makeDefaultNeedsReview && current
      ? `${folderLabel(folder.name)} uses ${layoutName(folder.layout)} and ${currentLabel} uses ${layoutName(current.layout)}, `
        + `so channels that follow the default become ${target === 'tv' ? 'TV shows' : 'movie-style channels'} and their `
        + 'downloaded videos move. You review every move first.'
      : null,
    tvLine: target === 'tv' ? `Each channel you don't subscribe to becomes its own show in ${label}.` : null,
    confirmLabel: folder.makeDefaultNeedsReview ? 'Review the move' : 'Make default',
  };
}
