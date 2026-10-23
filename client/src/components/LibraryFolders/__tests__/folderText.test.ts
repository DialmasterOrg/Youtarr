import {
  deleteReasonText, followersLine, layoutConsequence, rowSummary, verbLabel, makeDefaultText,
} from '../folderText';
import type { LibraryFolder } from '../../../types/tvShows';

const f = (name: string, extra: Partial<LibraryFolder> = {}): LibraryFolder => ({
  name, layout: 'videos', isDefault: false, hasFiles: false, channels: 0, deleteBlockers: [], deletable: true, ...extra,
});

describe('followersLine', () => {
  test('names the sample and how many more after the channel links', () => {
    expect(followersLine({ count: 5, sample: ['Blippi', 'Cocomelon', 'Numberblocks'] }, true))
      .toBe('5 more follow the default folder (Blippi, Cocomelon, Numberblocks and 2 more): make another folder the default, '
        + 'or set their Library folder in Channel Settings.');
  });

  test('without channel links before it, and a single follower', () => {
    expect(followersLine({ count: 1, sample: ['Blippi'] }, false))
      .toBe('1 follows the default folder (Blippi): make another folder the default, or set their Library folder in Channel Settings.');
  });

  test('nothing when no channel follows the default folder', () => {
    expect(followersLine({ count: 0, sample: [] }, true)).toBeNull();
  });
});

describe('folderText', () => {
  test('row summaries per state', () => {
    expect(rowSummary(f('Kids', { isDefault: true, channels: 24, channelsChosen: 3, channelsFollowing: 21, playlists: 1, fileCount: 1208 })))
      .toBe('3 chose this folder, 21 follow the default \u00b7 1 playlist \u00b7 1,208 videos on disk');
    expect(rowSummary(f('TV', { layout: 'tv', channels: 4, titleShows: 1, fileCount: 233 })))
      .toBe('4 channels \u00b7 1 title show \u00b7 233 episodes on disk');
    expect(rowSummary(f('Old', { fileCount: 31, hasFiles: true })))
      .toBe('Nothing downloads here now \u00b7 31 videos on disk');
    expect(rowSummary(f('Raw', { hasFiles: true, fileCount: 0 })))
      .toBe("Nothing downloads here now \u00b7 Holds files Youtarr doesn't track");
    expect(rowSummary(f(''))).toBe('Nothing saved here \u00b7 Downloads go to subfolders');
    expect(rowSummary(f('New', { isDefault: true }))).toBe('Nothing downloaded yet');
    expect(rowSummary(f('Gone', { deletable: false, deleteBlockers: [{ code: 'disabledChannels', count: 1 }] })))
      .toBe('Unused \u00b7 Empty \u00b7 1 unsubscribed channel still points here');
  });

  test('delete reasons', () => {
    expect(deleteReasonText(f(''))).toBe("The main folder is the downloads folder itself, so it can't be deleted.");
    expect(deleteReasonText(f('X', { plexMapping: { choice: 'library', libraryId: '3' } })))
      .toBe('Empty and unused, so you can delete it. Its Plex refresh setting is removed too.');
    expect(deleteReasonText(f('TV', {
      layout: 'tv', deletable: false, fileCount: 58, channels: 2,
      deleteBlockers: [{ code: 'channels', count: 2 }, { code: 'files' }],
    }))).toBe("Can't delete: 2 channels download here; it holds 58 downloaded episodes.");
  });

  test('layout consequence and verb follow the server flag', () => {
    expect(verbLabel(f('Kids', { layoutChangeNeedsReview: true }))).toBe('Move to TV shows');
    expect(verbLabel(f('Kids'))).toBe('Use for TV shows');
    expect(layoutConsequence({ folder: f('Kids'), titleShows: [], reorganizing: false }).text)
      .toBe('Nothing needs to move, so it switches at once.');
    expect(layoutConsequence({
      folder: f('TV', { layout: 'tv' }),
      titleShows: [{ id: 1, name: 'Lessons', channelId: 'UC1', channelName: 'Prof', episodeCount: 3 }],
      reorganizing: false,
    })).toEqual({
      text: "Lessons is a title show, and title shows need a TV folder. Move it to another TV folder first, in Prof's Channel Settings > TV Show.",
      blocked: true,
    });
    expect(layoutConsequence({ folder: f('Kids'), titleShows: [], reorganizing: true }).blocked).toBe(true);
  });

  test('make default copy for a same-layout and a cross-layout switch', () => {
    const same = makeDefaultText({ folder: f('Music'), current: f('Kids', { isDefault: true, channelsFollowing: 3 }) });
    expect(same.body).toMatch(/^Channels set to the default folder \(3\) will download to __Music instead of __Kids\./);
    expect(same.sameLayoutNote).toBe('Videos they already downloaded stay where they are. Keep a library on __Kids to watch them.');
    const cross = makeDefaultText({
      folder: f('TV', { layout: 'tv', makeDefaultNeedsReview: true }),
      current: f('Kids', { isDefault: true, channelsFollowing: 3 }),
    });
    expect(cross.confirmLabel).toBe('Review the move');
    expect(cross.warning).toBe('__TV uses TV shows and __Kids uses Videos, so channels that follow the default become TV shows and their downloaded videos move. You review every move first.');
    expect(cross.tvLine).toBe("Each channel you don't subscribe to becomes its own show in __TV.");
  });
});
