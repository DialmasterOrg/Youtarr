---
paths:
  - "server/modules/tvShows/libraryFolders.js"
  - "server/modules/tvShows/libraryLayouts.js"
  - "server/modules/tvShows/folderUsage.js"
  - "server/modules/tvShows/folderDetail.js"
  - "server/modules/tvShows/layoutGuards.js"
  - "server/modules/subfolderModule.js"
  - "server/modules/subfolderDeletion.js"
  - "server/routes/subfolders.js"
  - "server/modules/mediaServers/libraryMatcher.js"
  - "server/modules/mediaServers/libraryLocator.js"
  - "server/modules/mediaServers/libraryCheck.js"
  - "server/modules/mediaServers/plexRefreshMappings.js"
  - "server/modules/mediaServers/plexMappingEntries.js"
  - "server/modules/mediaServers/adapters/libraryOptions.js"
  - "client/src/components/LibraryFolders/**/*"
  - "client/src/components/shared/LibraryCheck/**/*"
  - "client/src/components/shared/LayoutChip.tsx"
  - "client/src/components/shared/SubfolderAutocomplete.tsx"
  - "client/src/components/Configuration/sections/components/LibraryFoldersCard.tsx"
  - "client/src/components/Configuration/sections/components/libraryCardText.ts"
  - "client/src/hooks/useLibraryFolders.ts"
  - "client/src/hooks/useLibraryCheck.ts"
  - "client/src/utils/libraryAttention.ts"
  - "client/src/utils/libraryLayouts.ts"
  - "client/src/types/libraryCheck.ts"
---

# Library folders

The Library folders page and API (`/settings/library`): the downloads folder's `__` subfolders, each folder's Videos or TV shows layout, the default folder, and which media server library holds each folder.

## Folders and who owns their settings

- `defaultSubfolder`, `plexSubfolderLibraryMappings` and `mainFolderLayout` are written only by the Library folders endpoints (`/api/library-folders/*`, `/api/subfolders`) and the reorganize they hand off to (`reorganize/settingsApplier`).
- `/updateconfig` keeps the stored values of those three, re-reading them right before it saves, because a Settings save sends stale copies and its template check can wait on yt-dlp while the Library folders API saves.
- On the client those fields are untracked (`trackChanges: false`). `useConfig`'s `CONFIG_PATCHED_EVENT` takes the server-saved value into both the draft and the saved copy as a plain replace, with no draft merge.
- `libraryFolders.setDefaultFolder` is the only direct writer of `defaultSubfolder`: a same-layout switch saves at once, a layout-changing one goes through `checkDefaultSubfolderChange`, and one that needs review is applied, or rolled back, by the reorganize.
- `createLibraryFolder` creates the `__` directory, then the registry row. A new, empty folder nothing uses takes its layout in the insert; anything else is registered as Videos and switched through `setFolderLayout`, whose guards send downloaded videos to the reorganize.
- `POST /api/subfolders` goes through `createLibraryFolder` with an optional `layout`: 201 when created, 200 when the folder already existed.
- Channel Settings' TV folder setup creates the folder with `{ layout: 'tv' }` in one request, so the main-folder refusal comes first.
- A TV main folder gets a `.plexignore` with `__*/*`, which is why Plex does not show its subfolders twice.
- A new install over an empty downloads folder (nothing but `__` folders and hidden entries) defaults `defaultSubfolder` to `Videos`, so adding a TV folder later never means moving downloads.
- `config/config.example.json` keeps `""` for it, because `mergeWithTemplate` fills missing keys of existing configs from the template.
- `subfolderModule.register(name, { layout, throwOnError })` idempotently upserts a name; a new row takes the layout, and download-time callers rely on it never throwing.
- `subfolderDeletion` (pure `deletionBlockers`/`deletionBlockReason`) is shared by `subfolderModule.delete` and the page's delete blockers, so the two cannot drift.
- Delete blockers: a non-empty disk path, channels (enabled or not), playlists, the default folder, and TV shows with numbered episodes in the folder.
- A channel show whose tracked channel has since moved back to a Videos folder does not block; a title show always does.
- A Plex refresh mapping never blocks a delete: the delete removes the folder's entry, and a folder known only from a mapping is deleted the same way.
- `folderUsage.describeUsage` counts disabled channels when deciding whether a layout change or a default switch needs the reorganize.
- `GET /api/channels/using-global-file-structure` leaves out channels in TV folders, whose episodes always go into Season folders.
- `SubfolderAutocomplete` has two modes, `channel` and `download`, and no way to hide its add action: the default folder is chosen on the Library folders page, not in a picker.

## Library check

- `libraryMatcher` (pure) finds a folder by a location ending in `__<name>` (its parent is the main folder) and by sampled downloads paired with Youtarr's paths by `[id]`; a stale copy in another subfolder is ignored.
- It keeps the server's own root and separator (`Q:\Youtube_test`, `\\nas\media\yt`). `downloadsPath` is null unless exactly one place is known.
- An exact match whose last segment is not `__<name>` is flagged `folderSegmentMissing`: a mount at the folder itself.
- `libraryLocator.scopeFor(adapter)` gives the library ids that may hold Youtarr's files, or null when the main folder cannot be found.
- The scope is the matcher's related libraries plus every sampled library whose sample was inconclusive (no files, unreadable, or `[id]`-named files Youtarr cannot place), so only a library whose sample shows plainly unrelated files is left out.
- Plex `fetchWatchStates`, `resolveItemMatchesByPaths` and `resolveItemIdsByFilepaths`, and Jellyfin and Emby `resolveItemMatchesByPaths`, take the scope as `{ libraryIds }`. The configured Plex YouTube library and the mapped sections are always in scope.
- `libraryCheck.check({ folders, layout })`: `layout` checks the given folders as that layout, because the reorganize preview passes `tv` for folders still saved as Videos.
- Jellyfin and Emby show a folder in one library only, so a library inside another library's folder is skipped and a TV folder under a root library counts as missing (`nestedLibrary`).
- Plex shows a nested folder twice (`overlap`/`overlapTv`); a TV main folder's Plex library is exempt thanks to `.plexignore`.
- A Videos folder counts as held by a music library pointed at it (MP3 channels); a music library at a parent folder says nothing about the videos. TV folders need a video library.
- A null `MetadataSavers` on Jellyfin or Emby is resolved through the server's `/System/Configuration` defaults (`adapters/libraryOptions.js`).
- `applyPlexMapping(folder, libraryId)` adds the suggested mapping and never replaces an entry, an explicit default choice included.
- An entry with `libraryId: null` is the explicit choice of the default library, which automatic mapping leaves alone; `plexMappingMissing`/`plexMappingMismatch` are not raised for it.
- `plexMappingEntries` (pure) matches a folder ignoring case, and the main folder's entry has `subfolder: null`; `plexModule.getLibraryIdForSubfolder` resolves through it.
- `plexRefreshMappings.setMapping` needs a Plex connection for a library id, which must be one Plex lists; `null` and `removeMapping` need none.

## Client

- The page's layout follows its measured content box (`hooks/useContainerWidth`, a ResizeObserver; two columns from 1012px), not the viewport.
- `utils/libraryAttention` is shared with Core's Library folders card and Channel Settings' `ChannelTvMediaServers`, so all three show the same attention count.
- `useLibraryCheck` hands the saved `plexSubfolderLibraryMappings` to `useConfig` through `CONFIG_PATCHED_EVENT` and refetches on `LIBRARY_FOLDERS_UPDATED_EVENT`.
- `useReorganizeHandoff` reads the default folder back at each run end, since the server undoes a default switch when nothing moved.
- `useSelectedFolder` keeps the URL and the selection in step (`~main` is the main folder); an unknown key is replaced with a notice.
