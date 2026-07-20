# Changelog

## [v1.76.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.76.1) - 2026-07-20

### [1.76.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.76.0...v1.76.1) (2026-07-20)


### Bug Fixes

* surface emby/jellyfin api key auth failures ([1420bd1](https://github.com/DialmasterOrg/Youtarr/commit/1420bd1803cba5f64742a5bd07b5d593f3e73f40))


### Documentation

* update CHANGELOG for v1.76.0 [skip ci] ([ee965d4](https://github.com/DialmasterOrg/Youtarr/commit/ee965d4d644a6eb695a6da17aadea12bb884eb03))





## [v1.76.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.76.0) - 2026-07-19

## [1.76.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.75.0...v1.76.0) (2026-07-19)


### Features

* auto-refresh download history page ([246099c](https://github.com/DialmasterOrg/Youtarr/commit/246099cd773797462e2ddf4b93e4f4dabba33e77))
* filter video listings by watched status ([174dc5d](https://github.com/DialmasterOrg/Youtarr/commit/174dc5d6aa9a7f834229076fb319af6d7f1cf185)), closes [#706](https://github.com/DialmasterOrg/Youtarr/issues/706)
* show watched chip on playlist page videos ([6a0fa89](https://github.com/DialmasterOrg/Youtarr/commit/6a0fa89af7867719bacb1af6fe7dec2621222a16)), closes [#706](https://github.com/DialmasterOrg/Youtarr/issues/706)
* sync watch status for all media server users ([20bb6b1](https://github.com/DialmasterOrg/Youtarr/commit/20bb6b1f2ef68d1303f473d941164d54c69206b7)), closes [#706](https://github.com/DialmasterOrg/Youtarr/issues/706)
* sync watch status from media servers ([56edc40](https://github.com/DialmasterOrg/Youtarr/commit/56edc40485b08244b0968374892368e7e2740bfb)), closes [#706](https://github.com/DialmasterOrg/Youtarr/issues/706)


### Bug Fixes

* correct watched-threshold info in ui and docs ([2924e61](https://github.com/DialmasterOrg/Youtarr/commit/2924e615038c0e3cb9a5df11a7503a98c66c77f6)), closes [#706](https://github.com/DialmasterOrg/Youtarr/issues/706)
* hide channel toolbar in playlists view ([bd8ece6](https://github.com/DialmasterOrg/Youtarr/commit/bd8ece67523c46d8ed28e568314250c9e35e4af2))
* sync emby last-watched time and play count ([c450d68](https://github.com/DialmasterOrg/Youtarr/commit/c450d6899bf1c128f0b97f60245c5bcbdab5ca8c)), closes [#706](https://github.com/DialmasterOrg/Youtarr/issues/706)
* sync watch status for missing videos ([2de2f61](https://github.com/DialmasterOrg/Youtarr/commit/2de2f61c8c5d135beeb4a48656eb53710a62b257)), closes [#706](https://github.com/DialmasterOrg/Youtarr/issues/706)
* unhandled yt-dlp spawn error crashing tests ([ca49e14](https://github.com/DialmasterOrg/Youtarr/commit/ca49e14c74f9a166d970edccaf6a461bc477a551)), closes [#653](https://github.com/DialmasterOrg/Youtarr/issues/653)
* watched chip missing from mobile videos list ([ab939d1](https://github.com/DialmasterOrg/Youtarr/commit/ab939d1511762e9fec04aaa7fbf22ce03f8efe79)), closes [#706](https://github.com/DialmasterOrg/Youtarr/issues/706)


### Code Refactoring

* decompose channelModule into sub-modules ([9082862](https://github.com/DialmasterOrg/Youtarr/commit/90828621d22afe3b95604b25a58af70a2ecf5f56)), closes [#653](https://github.com/DialmasterOrg/Youtarr/issues/653)


### Documentation

* add watch status sync to the user docs ([a570350](https://github.com/DialmasterOrg/Youtarr/commit/a570350c366f77edd0dd04726ecb9c856d2dec97)), closes [#706](https://github.com/DialmasterOrg/Youtarr/issues/706)
* link to youtarr.com homepage in readme ([599fe46](https://github.com/DialmasterOrg/Youtarr/commit/599fe460e84cd37691a069e871920f0c815cc954))
* update CHANGELOG for v1.75.0 [skip ci] ([fb06f45](https://github.com/DialmasterOrg/Youtarr/commit/fb06f45603235279f1782da1329a1461d7365c09))





## [v1.75.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.75.0) - 2026-07-14

## [1.75.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.74.0...v1.75.0) (2026-07-14)


### Features

* add global flat folder structure option ([eb6a073](https://github.com/DialmasterOrg/Youtarr/commit/eb6a0730befea3f3d6b03b8298d2d025e1659545)), closes [#692](https://github.com/DialmasterOrg/Youtarr/issues/692)
* add in-app youtube channel search ([f56cf23](https://github.com/DialmasterOrg/Youtarr/commit/f56cf231e73e8b0f5e31c82e296b86859e3aa4d7)), closes [#545](https://github.com/DialmasterOrg/Youtarr/issues/545)
* add video only override to download dialog ([9db17bd](https://github.com/DialmasterOrg/Youtarr/commit/9db17bda9ea4f4402b351f8cf349aa7de85cbb4a)), closes [#711](https://github.com/DialmasterOrg/Youtarr/issues/711)
* support mp3 playback in video modal ([ba4e765](https://github.com/DialmasterOrg/Youtarr/commit/ba4e765a3b76a2d5aa37ef6b22e5a22e2c8d7849))


### Bug Fixes

* honor channel settings for manual downloads ([f2e8b98](https://github.com/DialmasterOrg/Youtarr/commit/f2e8b988336293f810f40c7b770f18d870e36495)), closes [#692](https://github.com/DialmasterOrg/Youtarr/issues/692)


### Documentation

* make recent changelog entries user-facing [skip ci] ([7c45ad2](https://github.com/DialmasterOrg/Youtarr/commit/7c45ad2c00a5d5795d2d5ba1038d30305837df8a))
* update CHANGELOG for v1.74.0 [skip ci] ([f5fd5a7](https://github.com/DialmasterOrg/Youtarr/commit/f5fd5a723f583a91d2460038136621927e99ddc9))
* Update comparsion doc Github info ([0604943](https://github.com/DialmasterOrg/Youtarr/commit/06049434e5492edf6694179a3948eae5ef904b9a))
* Update Youtarr comparison document ([cee3c8f](https://github.com/DialmasterOrg/Youtarr/commit/cee3c8fd0fd680e29e520b6bfe938ecbd5718515))





## [v1.74.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.74.0) - 2026-07-10

## [1.74.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.73.0...v1.74.0) (2026-07-10)


### Features

* Playlists have a new Sort Order setting: keep YouTube's playlist order or reverse it, so playlists that add new videos at the top can play oldest-first in media server playlists and .m3u files ([95fe232](https://github.com/DialmasterOrg/Youtarr/commit/95fe232942765084b44c7cadd1c80e966ae7bf1d)), closes [#687](https://github.com/DialmasterOrg/Youtarr/issues/687)


### Bug Fixes

* The new Plex TV Series filename preset (added in [#605](https://github.com/DialmasterOrg/Youtarr/pull/605)) now caps video titles at 64 bytes like the other presets, so long titles no longer trigger the oversized-title warning or produce paths too long for Plex on Windows ([a6c05d0](https://github.com/DialmasterOrg/Youtarr/commit/a6c05d0d178be44660e0362b3a6e1cd6f1de88e5))
* The playlist page help text now explains that "Refresh from YouTube" re-checks the entire playlist, and that large playlists can take a few minutes ([0c363fa](https://github.com/DialmasterOrg/Youtarr/commit/0c363fa9a1e61804b505deef95a7b2a02366bf23)), closes [#699](https://github.com/DialmasterOrg/Youtarr/issues/699)
* Downloads to FUSE-backed storage (rclone mounts and similar) no longer get stuck retrying a failing file move; moves and copies now fall back to a plain copy that these mounts accept ([bc5b9c6](https://github.com/DialmasterOrg/Youtarr/commit/bc5b9c681ed850a5a6666d57d6aa540ae3a1a773)), closes [#370](https://github.com/DialmasterOrg/Youtarr/issues/370) [#693](https://github.com/DialmasterOrg/Youtarr/issues/693)
* Playlist download runs that find nothing new no longer clutter Download History; like channel runs, they only show when "Show jobs with no videos" is checked ([43527d8](https://github.com/DialmasterOrg/Youtarr/commit/43527d831498c20aed7e5382c4ec3e388e9a3071))
* Playlist auto-downloads now catch new videos added anywhere in a playlist, not just at the end. Refreshes also fetch the full playlist (up to 5000 videos), playlist-only setups no longer record a failed channel job every cycle, and the playlist page gets clearer sort options and progress indicators ([f0b8c56](https://github.com/DialmasterOrg/Youtarr/commit/f0b8c56613f324c456dbc88bafc07d4d829b7c7c)), closes [#680](https://github.com/DialmasterOrg/Youtarr/issues/680)
* Audio-only (MP3) playlists now sync to Plex, Jellyfin, and Emby as music playlists and show up in .m3u files; previously they never synced at all. Syncing audio requires a music library covering your output directory. Also adds a downloaded / not downloaded filter to the playlist page ([bde4653](https://github.com/DialmasterOrg/Youtarr/commit/bde46533cfcaa58c28a969700fdc3c9ef9b3dc6b)), closes [#699](https://github.com/DialmasterOrg/Youtarr/issues/699)
* A playlist's Download Type setting now decides whether it syncs as a music or video playlist, instead of guessing from the files on disk; one video download can no longer flip a music playlist to video, and the playlist page shows how many items don't match the playlist's type ([9647c86](https://github.com/DialmasterOrg/Youtarr/commit/9647c8623e7c9fc7efff102fcc8a8aa0d86559f4)), closes [#699](https://github.com/DialmasterOrg/Youtarr/issues/699)


### Documentation

* update CHANGELOG for v1.73.0 [skip ci] ([7e88b16](https://github.com/DialmasterOrg/Youtarr/commit/7e88b1689cf580f8233f9893733ff38e137ed0d5))





## [v1.73.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.73.0) - 2026-07-04

## [1.73.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.72.1...v1.73.0) (2026-07-04)


### Features

* Playlists can now be removed from the Subscriptions page. Auto-downloads stop and the playlist disappears from the UI, but downloaded videos, media server playlists, and .m3u files are left alone; re-subscribing restores the playlist with its saved settings ([5f372ec](https://github.com/DialmasterOrg/Youtarr/commit/5f372ec9304eff10cb5a4c02abb43f696e36e05d)), closes [#676](https://github.com/DialmasterOrg/Youtarr/issues/676)
* The header now shows an animated indicator whenever a download is running or queued; clicking it opens the activity page ([2d48838](https://github.com/DialmasterOrg/Youtarr/commit/2d48838bc93447dc76fc6bf5d4153be5b9ce4e85))
* Channel pages have a new "Download All" button that queues every video from a tab you haven't downloaded before, showing an accurate video count before you confirm. Large channels can take days, so these jobs are exempt from the usual 6-hour runtime cap ([6e131fd](https://github.com/DialmasterOrg/Youtarr/commit/6e131fdb0e1de7be3f26791110ec0907bfb454c3)), closes [#660](https://github.com/DialmasterOrg/Youtarr/issues/660)
* Failed downloads now show a plain-language likely cause and suggested fix (for example, YouTube bot checks or stale cookies) in Download History, live progress, and notifications, instead of only the raw yt-dlp error ([e6a3612](https://github.com/DialmasterOrg/Youtarr/commit/e6a36121d3de54185eaa43010c31dd34497a386f)), closes [#672](https://github.com/DialmasterOrg/Youtarr/issues/672)
* Playlist pages have a new "Load More" button that fetches the complete playlist (up to 5000 videos); previously only the first 100 videos were ever shown ([9d5d6c5](https://github.com/DialmasterOrg/Youtarr/commit/9d5d6c5dcb6daa6e820f13a8e9b97c0ee7ea94d6)), closes [#682](https://github.com/DialmasterOrg/Youtarr/issues/682)
* A new download setting can write -fanart.jpg files from video thumbnails, which some media server clients (like Plex on NVIDIA Shield) use for background previews ([99a72aa](https://github.com/DialmasterOrg/Youtarr/commit/99a72aa43872e153dbb71edff5a7b2b2c4e3f4eb))
* Videos that fail mid-download with an HTTP 403 error are automatically retried in a follow-up job, since a fresh attempt usually succeeds; a new setting controls how many retries are allowed (0-3, default 1) ([3a18648](https://github.com/DialmasterOrg/Youtarr/commit/3a18648667b873e8306d12a8046d6eeb88500aaa)), closes [#672](https://github.com/DialmasterOrg/Youtarr/issues/672)
* Subfolders are now saved permanently, so folders created in settings no longer disappear on refresh and every subfolder picker shows the same list; a new Manage Subfolders dialog shows where each folder is used and lets you delete unused ones ([b82befe](https://github.com/DialmasterOrg/Youtarr/commit/b82befe6b9977f0decb374158e569af0963315c0)), closes [#679](https://github.com/DialmasterOrg/Youtarr/issues/679)
* Videos now appear on the Videos, Channel, and Playlist pages as each download finishes, instead of only after the whole batch completes. Audio-only downloads also now count as downloaded on playlist pages ([a6e0bdf](https://github.com/DialmasterOrg/Youtarr/commit/a6e0bdf87a4bf0a707271b520bc66e34602db226)), closes [#662](https://github.com/DialmasterOrg/Youtarr/issues/662)


### Documentation

* update CHANGELOG for v1.72.1 [skip ci] ([789f6a1](https://github.com/DialmasterOrg/Youtarr/commit/789f6a186d3ccaeb66e3a624eaeb479b54859cf6))





## [v1.72.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.72.1) - 2026-06-27

### [1.72.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.72.0...v1.72.1) (2026-06-27)


### Bug Fixes

* Enabling Shorts auto-download on channels that only have a Shorts tab now saves correctly instead of failing with a validation error ([f6df56a](https://github.com/DialmasterOrg/Youtarr/commit/f6df56a54d8487b0c4924c23756e3acba05ce0e4)), closes [#671](https://github.com/DialmasterOrg/Youtarr/issues/671)


### Documentation

* update CHANGELOG for v1.72.0 [skip ci] ([6411280](https://github.com/DialmasterOrg/Youtarr/commit/6411280f776540ebf5499afec4a9dd56723e9299))





## [v1.72.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.72.0) - 2026-06-21

## [1.72.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.71.0...v1.72.0) (2026-06-21)


### Features

* Downloaded indicators now look the same everywhere: distinct icons for video and audio files, the full file path in the tooltip, and playlist videos use the same indicator instead of a generic "Downloaded" chip ([f54983e](https://github.com/DialmasterOrg/Youtarr/commit/f54983eb4fdf015c8e2081213cc64b488889f9f9)), closes [#666](https://github.com/DialmasterOrg/Youtarr/issues/666)


### Bug Fixes

* Titles and channel names in YouTube search results now show apostrophes and other special characters correctly instead of raw HTML codes like `&#39;` ([9e4c68c](https://github.com/DialmasterOrg/Youtarr/commit/9e4c68cd9eee5428aedc2b53e550ea27ef74515d)), closes [#39](https://github.com/DialmasterOrg/Youtarr/issues/39) [#652](https://github.com/DialmasterOrg/Youtarr/issues/652)
* Removed channels, including the hidden ones playlists create behind the scenes, no longer override playlist and global download settings; resolution, audio format, subfolder, and rating now resolve from settings you can actually see and change ([e211451](https://github.com/DialmasterOrg/Youtarr/commit/e211451a08064c8ed736f94767ec2e958bfb62b1)), closes [#663](https://github.com/DialmasterOrg/Youtarr/issues/663)
* Upgrading older installs no longer fails the full-Unicode database migration on tables with foreign keys ([295be30](https://github.com/DialmasterOrg/Youtarr/commit/295be301aa3e7091ee0bc4a0035c622714d40d88)), closes [#658](https://github.com/DialmasterOrg/Youtarr/issues/658)
* Tapping the downloaded indicator on a video no longer also selects that video ([9c9fcfd](https://github.com/DialmasterOrg/Youtarr/commit/9c9fcfd5edb7922b7998eaf0be5aa123e432d52b)), closes [#666](https://github.com/DialmasterOrg/Youtarr/issues/666)


### Build Systems

* **deps:** Updated multer to 2.2.0 to patch two high-severity denial-of-service advisories ([61ee9aa](https://github.com/DialmasterOrg/Youtarr/commit/61ee9aa397fd068eaf928b022e4a25c4a1ecd965))
* **deps:** Pinned form-data to 4.0.6 to clear a high-severity security advisory pulled in through axios ([077e599](https://github.com/DialmasterOrg/Youtarr/commit/077e5998b11d8c6af5cf4465d1263360df633484)), closes [#654](https://github.com/DialmasterOrg/Youtarr/issues/654)


### Documentation

* The Unraid install guide now points at the actively maintained community template instead of a stale copy ([6ea90ad](https://github.com/DialmasterOrg/Youtarr/commit/6ea90adfd903c16e6257eab1f2718953b4bc67d4))
* update CHANGELOG for v1.71.0 [skip ci] ([4b89e45](https://github.com/DialmasterOrg/Youtarr/commit/4b89e45d9d00aac92d99b0b2828b5a8ec7052cfd))





## [v1.71.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.71.0) - 2026-06-14

## [1.71.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.70.0...v1.71.0) (2026-06-14)


### Features

* Internal: new channel records now start with their duration, title filter, and audio format fields initialized ([565a686](https://github.com/DialmasterOrg/Youtarr/commit/565a6866a3451827a00dfbd29a2729cff04b9755))
* "playlists" can no longer be used as a subfolder name; it's reserved for Youtarr's generated playlist files ([5adc508](https://github.com/DialmasterOrg/Youtarr/commit/5adc508bbd066bcbe92f424b8e4a0543a55d918a))
* The Jellyfin/Emby user picker is now a dropdown that loads accounts when opened and shows the saved user's name instead of a raw ID, with manual entry as a fallback; the API key field is masked without triggering the browser's password manager ([4e75b50](https://github.com/DialmasterOrg/Youtarr/commit/4e75b5062670acafa948605a8c62673f212ca1ad)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Added the Jellyfin and Emby connection settings (URL, API key, user, and video libraries); both API keys are redacted from all log output ([7ca409d](https://github.com/DialmasterOrg/Youtarr/commit/7ca409d38283cb138640c73323d2fe427d011104))
* Scheduled download runs now check playlists for new videos right after channels ([0466f02](https://github.com/DialmasterOrg/Youtarr/commit/0466f023039ccd05c21c8e9de9e0e24c0ef70b0b))
* Internal: added the database tables that track playlists, their videos, and media server sync state ([b8604a5](https://github.com/DialmasterOrg/Youtarr/commit/b8604a5d9306f39b8af041d14a0a4945bc4d68a3))
* Playlist downloads skip videos that are already downloaded or ignored, and track the source channel for videos whose channel isn't subscribed ([a752a3c](https://github.com/DialmasterOrg/Youtarr/commit/a752a3ced224f993378c41b8ed53916148edb101))
* Scheduled and manual download runs now include auto-download playlists alongside channels; playlists refresh from YouTube first, download only the newest videos, and honor manual override settings ([e39baa0](https://github.com/DialmasterOrg/Youtarr/commit/e39baa0bf5f93321ac7810d0edd123403ce175c9)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Emby playlists marked public are now visible to every Emby user instead of only the configured account ([bd710f2](https://github.com/DialmasterOrg/Youtarr/commit/bd710f208dc5050778a579688afb0cce27041725)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Playlists now generate .m3u files with relative paths, as a fallback for players without native playlist sync ([97074d4](https://github.com/DialmasterOrg/Youtarr/commit/97074d45c8875126140e16435bffadfa2e888795))
* Internal: added a single entry point for the new media server sync modules ([2b0a47b](https://github.com/DialmasterOrg/Youtarr/commit/2b0a47bd85087534a77ec07bdddfa8d251e53acf))
* Internal: added the shared interface that all media server adapters implement ([17cd0ee](https://github.com/DialmasterOrg/Youtarr/commit/17cd0ee9b4456f8c510dab82e725a43e3332c937))
* Playlists can now sync natively to Emby through its REST API ([9818505](https://github.com/DialmasterOrg/Youtarr/commit/98185053247489ef1037a89ef8f65f828b1c943f))
* Playlists can now sync natively to Jellyfin through its REST API ([785b2e2](https://github.com/DialmasterOrg/Youtarr/commit/785b2e2cf7bbfe9cb782cea468b7e7f2299f1134))
* Internal: added the orchestrator that decides which media servers each playlist syncs to and records per-server sync state ([9f07399](https://github.com/DialmasterOrg/Youtarr/commit/9f0739981cb416651ca7a988c988d48384d48675))
* Playlists can now sync natively to Plex through its REST API ([b5a4d28](https://github.com/DialmasterOrg/Youtarr/commit/b5a4d285e08f4a5e3f27d69527cf8e1f603f3dda))
* Internal: added the registry that detects which media servers are configured for playlist sync ([ca1ba9e](https://github.com/DialmasterOrg/Youtarr/commit/ca1ba9e41bb376d326a1408a711de753cf551999))
* Internal: added the Playlist database model ([99d058d](https://github.com/DialmasterOrg/Youtarr/commit/99d058de4e240b1b2bf425ebb130806cafccc014))
* Internal: added the database model that tracks each playlist's per-server sync state ([98fd51b](https://github.com/DialmasterOrg/Youtarr/commit/98fd51b1716e2bc86f18e80c91201e3c80fe0863))
* Internal: added the database model that tracks the videos in each playlist ([4c750ed](https://github.com/DialmasterOrg/Youtarr/commit/4c750edf5c7ebfa621ba155d6d546771b956827d))
* Internal: wired the playlist models and their associations into the app ([9cc092b](https://github.com/DialmasterOrg/Youtarr/commit/9cc092b4c000e199e82eaae97d668833402d2890))
* Playlist titles, uploaders, and video lists are now fetched from YouTube via yt-dlp ([d5b4228](https://github.com/DialmasterOrg/Youtarr/commit/d5b4228ba432fea59a5f093a2d6bfb5f8cbf53c1))
* Playlists have an auto-download toggle on the detail page and an indicator in the subscriptions list; new playlists start with auto-download off, making it opt-in ([331dad5](https://github.com/DialmasterOrg/Youtarr/commit/331dad5e9f486237dd8e1866c8a91cbd99be331d)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* The playlist settings dialog now covers subfolder, resolution, audio format, and rating, using the same dropdowns as channel and manual downloads ([d992574](https://github.com/DialmasterOrg/Youtarr/commit/d992574d6fa5453a8acab6c1e6658b44a513dafb)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* The Playlists tab has a "How playlists work" help guide covering subscriptions, download paths, auto-download, .m3u files, and per-server sync caveats ([b8ec821](https://github.com/DialmasterOrg/Youtarr/commit/b8ec8214b1a5bea6762bfedf501cdecb6040f788)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Playlist downloads can now override download settings at download time; settings resolve per video, with override beating channel, then playlist, then global defaults ([e84e8e5](https://github.com/DialmasterOrg/Youtarr/commit/e84e8e54cc96e1641ef49843bdcf4232ce4b19a3)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* The playlist page has per-video checkboxes and a "Download Selected" action alongside download-all; the selection survives a failed download ([f88437c](https://github.com/DialmasterOrg/Youtarr/commit/f88437c3fa1f4436f11c33c0c116dfe5ce208682)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Playlist videos now list newest-first with a sort dropdown, and more videos load automatically as you scroll instead of stopping at the first 50 ([a37a5b1](https://github.com/DialmasterOrg/Youtarr/commit/a37a5b1cbd3714563d64487f8eea92d98f6d6349)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* The playlist page header is organized into Library & Downloads and Media Server Sync groups with inline help, and the bulk download button now reads "Download N new" so you can see how many videos are actually new before confirming ([29fd4b9](https://github.com/DialmasterOrg/Youtarr/commit/29fd4b9802c2926c21a6a9e10477bc4c79b9c790)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Added the playlist detail page and the Jellyfin and Emby settings sections, and renamed the Channels page to Channels & Playlists (old /channels links redirect) ([ef5eb86](https://github.com/DialmasterOrg/Youtarr/commit/ef5eb8669c048ecaaaae653a58fac57bd2f115fd))
* Plex playlist visibility is now a scope selector (admin, unclaimed server, or a specific user), and changing scope cleans up playlists stranded under the old scope instead of duplicating them ([835df1d](https://github.com/DialmasterOrg/Youtarr/commit/835df1d026834d502c129e634dc3c9bd1f39eda9)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* An advanced setting lets Plex playlists be created under a different account or anonymous session, fixing playlists that never appeared in Plex Web on unclaimed servers with unauthenticated LAN access ([bb516d4](https://github.com/DialmasterOrg/Youtarr/commit/bb516d4aa782e19b6d41d0cceb73b18ee3caf1e7))
* Internal: added the /api/mediaservers routes that back the connection test and user lookup in Settings ([c8070fb](https://github.com/DialmasterOrg/Youtarr/commit/c8070fb06f12e132d43b19d830f9e272447f9464))
* Internal: added the /api/playlists routes for subscribing to and managing playlists ([453b46f](https://github.com/DialmasterOrg/Youtarr/commit/453b46f1b9547c53182d6a69dc0a17f4c7ab6d0d))
* A new API endpoint queues a download of every not-yet-downloaded video in a playlist ([ecb2e0d](https://github.com/DialmasterOrg/Youtarr/commit/ecb2e0d55fb81b9dc7d4bc07707a1f239f1a6b4a))
* Internal: wired the new playlist and media server routes into the server ([7db92f8](https://github.com/DialmasterOrg/Youtarr/commit/7db92f8b80ae9bb95cb44ae90cb4ba95d6c065a4))
* Channel and playlist pages have a back button that returns to Channels & Playlists with the matching tab selected ([e66c938](https://github.com/DialmasterOrg/Youtarr/commit/e66c93874a37c2336d4a68307e401785523db0eb)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* The Channels & Playlists page now shows only the add controls for the current tab, and the redundant "All" tab is gone ([e3ac30f](https://github.com/DialmasterOrg/Youtarr/commit/e3ac30f84deb71f36ceaed538cf4c93989dbe826)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)


### Bug Fixes

* Fixed a crash when starting playlist downloads ([db3982e](https://github.com/DialmasterOrg/Youtarr/commit/db3982e760586e4eb2ecf5bdf6eb07b61f7180f1))
* When a run downloads both channel and playlist videos, the end-of-run summary and notification now report the combined total instead of only the last job's videos ([3813bf2](https://github.com/DialmasterOrg/Youtarr/commit/3813bf2aba0a4f96621cce72a9f0aac4cab7fa9f)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* The download dialog no longer presents the global resolution as if it applied to every channel; quality resolves per channel or playlist with the global setting as fallback, and the dialog now says so ([964a8c8](https://github.com/DialmasterOrg/Youtarr/commit/964a8c850243cedcf86ba1199b7c4405e55e56ef)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Playlist sync now matches files correctly when Plex runs on Windows and Youtarr runs on Linux, or the other way around ([c9fa3a6](https://github.com/DialmasterOrg/Youtarr/commit/c9fa3a68c09671e623cf94b7c4549bf423804fef))
* Fixed Emby playlist creation, which failed with a server error because Emby's API expects a different request format than Jellyfin's; a failed first sync also no longer blocks every later attempt ([ab5c6b5](https://github.com/DialmasterOrg/Youtarr/commit/ab5c6b57d1a8c19b4f59f192929c698059bb6c2d))
* Jellyfin and Emby playlist updates now delete and recreate the playlist, working around a server-side bug that rejects removing items ([bddf01c](https://github.com/DialmasterOrg/Youtarr/commit/bddf01c26070f5f4a94b81fcfa561e44764d76bc))
* Playlist sync now finds downloaded videos on the media server even when Youtarr and the server see the media folder at different paths ([bf1348b](https://github.com/DialmasterOrg/Youtarr/commit/bf1348b0aa789f8133e20161407de5616aabb4ec))
* Playlist sync now recognizes Plex configured with the classic IP and port fields, not just a full URL ([e5ef1b9](https://github.com/DialmasterOrg/Youtarr/commit/e5ef1b97be9a2fe45d6d72b1c9cb04a055eddc5c))
* Subscribing to a playlist no longer fails its first sync; Youtarr waits until at least one video is downloaded before creating the server playlist ([350dadd](https://github.com/DialmasterOrg/Youtarr/commit/350daddb93a1e74b83744b03608fea19aef69de2))
* If a synced playlist was deleted on the media server, the next sync recreates it instead of failing every time ([eae455a](https://github.com/DialmasterOrg/Youtarr/commit/eae455ad9a4068c069f4e7407e3e0f26f0cd8cee))
* Fixed an error on the first playlist download when a video's channel wasn't tracked yet ([acbcfdf](https://github.com/DialmasterOrg/Youtarr/commit/acbcfdffea64577299e7e1ae0febdc94288c4075))
* Videos downloaded through playlists now go to your configured default subfolder instead of the root of the media directory, where media servers often can't see them ([209ae02](https://github.com/DialmasterOrg/Youtarr/commit/209ae024e182677066f94c9a6409f86cd078e9dc))
* Re-adding a previously removed channel now restores it with its old settings; before, re-adding looked like a no-op and imports flagged the channel as already subscribed ([297ec55](https://github.com/DialmasterOrg/Youtarr/commit/297ec5500055ff05b6282655cef9aa3b20d99529)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Playlist videos that YouTube lists without channel information now get their channel filled in after download instead of staying unattributed ([dc86dbe](https://github.com/DialmasterOrg/Youtarr/commit/dc86dbedb98ec6b912a8164d67b6b13bb0dc5bdb)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Channel videos no longer show invented published dates: real dates show as-is, approximate dates are marked with "~", and unknown dates show "Pending"; a migration backfills accurate dates for already-downloaded videos ([34ee615](https://github.com/DialmasterOrg/Youtarr/commit/34ee615783fbdb8993e49ffd121640fe89d6566e))
* Subscription import summaries no longer show all zeros when the import finishes ([19c6f92](https://github.com/DialmasterOrg/Youtarr/commit/19c6f92d8cad32701cacd3116ee083a675ff4835)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Newly subscribed channels now download into your configured default subfolder instead of the root of the media directory ([f9dc4e5](https://github.com/DialmasterOrg/Youtarr/commit/f9dc4e573a1dd0c1df77dafc2a3dcf1271acc7d6)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Manual and playlist downloads no longer finish as "Complete with Warnings" when the only output was harmless yt-dlp notices ([86a54db](https://github.com/DialmasterOrg/Youtarr/commit/86a54db61409295ec3ca5a5afcad369c80305c27)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Private and members-only videos no longer show up in playlists as bare video IDs or get queued for downloads that can only fail; they drop out of the list automatically ([b2828f2](https://github.com/DialmasterOrg/Youtarr/commit/b2828f29c836c38c4484a79c44fb167b1077bd4c)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Re-downloading deleted videos now works from the playlist page and video modal: the dialog warns about previously downloaded videos, pre-checks re-download, and no longer silently skips them; custom settings only override the values you actually change ([8397911](https://github.com/DialmasterOrg/Youtarr/commit/8397911f7e11f0ab8d9ea48bcf4eacffccdb32ff)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Videos from VEVO and auto-generated "Topic" channels now download into the subscribed channel's folder with its quality and rating settings, instead of being routed by the uploader listed in the video's metadata ([525ade5](https://github.com/DialmasterOrg/Youtarr/commit/525ade5758a70ba9e8929109bf728793772338ab)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Fixed the Jellyfin/Emby "Test Connection" and user lookup, which always failed because the request used the wrong field names ([98d4c0e](https://github.com/DialmasterOrg/Youtarr/commit/98d4c0ea666e1327420aa7da6975162e0895ea18)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* An unreachable media server now stops that server's sync with one concise warning, instead of retrying every video and logging errors that included the API token ([2c91fb7](https://github.com/DialmasterOrg/Youtarr/commit/2c91fb74b34cdf7de60bbda224f9b1a7aa6d139d)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Updated the navigation dropdown labels to match the new Channels & Playlists naming ([1f59dc1](https://github.com/DialmasterOrg/Youtarr/commit/1f59dc19ff5fdf8bdc95499da9aed19d5d8945ba))
* Jellyfin and Emby no longer import the generated .m3u files as duplicate playlists; the playlists folder now carries an ".ignore" marker their library scanners honor ([9b180f9](https://github.com/DialmasterOrg/Youtarr/commit/9b180f90596ac012023ca5ef48f0dd1ed37a04ad)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Media server sync is more resilient: requests time out after 30 seconds instead of hanging, concurrent syncs of the same playlist no longer race and create duplicates, and manual sync runs in the background instead of holding the request open ([041008c](https://github.com/DialmasterOrg/Youtarr/commit/041008cbb6dec4c636efbc149ea4057561d443b7)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)


### Documentation

* Added a troubleshooting guide for reverse proxies that don't forward WebSocket connections, which left the Activity page showing no progress during downloads ([3e9d217](https://github.com/DialmasterOrg/Youtarr/commit/3e9d2178c87edcb150b33b98a2a55bde84ca9d24))
* Documented playlist support across the usage guide, README, and the Plex, Jellyfin, and Emby guides ([acae0fb](https://github.com/DialmasterOrg/Youtarr/commit/acae0fb95f57623d8ffa324e8fc812a6acb5f6fe)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* Documented that Plex shows playlists shared from another account under the "Media" sidebar source, not the recipient's Playlists section ([73c6cd3](https://github.com/DialmasterOrg/Youtarr/commit/73c6cd3802056b89a7682cfa80ed21afd5f10e00)), closes [#144](https://github.com/DialmasterOrg/Youtarr/issues/144)
* update CHANGELOG for v1.70.0 [skip ci] ([f193ffd](https://github.com/DialmasterOrg/Youtarr/commit/f193ffd55344803b68a91f0de3faf2c443420752))


### Code Refactoring

* The anonymous Plex playlist mode now uses an explicit "UNCLAIMED_SERVER" value instead of easy-to-confuse empty-string handling ([e49cb8b](https://github.com/DialmasterOrg/Youtarr/commit/e49cb8bc556f5f44c14dec91f087182290341555))
* Internal cleanup of the download executor, with hardening so a failed download can no longer leave a job stuck "In Progress" and stall the queue ([708bf11](https://github.com/DialmasterOrg/Youtarr/commit/708bf114d73bc9a57ac26aad386ba1a1b5a98313)), closes [#645](https://github.com/DialmasterOrg/Youtarr/issues/645)
* Internal cleanup: split the 1500-line download executor into focused modules, with no intended behavior changes ([af70884](https://github.com/DialmasterOrg/Youtarr/commit/af708845eefddd58ca9a18f98cb7a725b0f8496c)), closes [#645](https://github.com/DialmasterOrg/Youtarr/issues/645)





## [v1.70.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.70.0) - 2026-05-30

## [1.70.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.69.2...v1.70.0) (2026-05-30)


### Features

* Channels terminated by YouTube are now detected and flagged in the UI, and their scheduled downloads stop instead of silently failing every run; the flag clears automatically if the channel comes back ([04fb599](https://github.com/DialmasterOrg/Youtarr/commit/04fb599037b641bebddcd1a8aa16dedf199b2c2c)), closes [#621](https://github.com/DialmasterOrg/Youtarr/issues/621)


### Documentation

* update CHANGELOG for v1.69.2 [skip ci] ([6265702](https://github.com/DialmasterOrg/Youtarr/commit/626570272fe212951774423d0fb66bd2e28e20fc))





## [v1.69.2](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.69.2) - 2026-05-15

### [1.69.2](https://github.com/DialmasterOrg/Youtarr/compare/vv1.69.1...v1.69.2) (2026-05-15)


### Documentation

* update CHANGELOG for v1.69.1 [skip ci] ([4594e27](https://github.com/DialmasterOrg/Youtarr/commit/4594e27a4b073c7c7a4c163ab10aec8c38f2292c))





## [v1.69.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.69.1) - 2026-05-13

### [1.69.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.69.0...v1.69.1) (2026-05-13)


### Bug Fixes

* stop Settings crash on missing config field ([a891836](https://github.com/DialmasterOrg/Youtarr/commit/a891836248b506319890a7c14f99cbffd8613b8f)), closes [#611](https://github.com/DialmasterOrg/Youtarr/issues/611)


### Documentation

* update CHANGELOG for v1.69.0 [skip ci] ([244c571](https://github.com/DialmasterOrg/Youtarr/commit/244c5716bc654aa7c2bc7f5679ed51687cae1d91))





## [v1.69.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.69.0) - 2026-05-11

## [1.69.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.68.0...v1.69.0) (2026-05-11)


### Features

* add customizable video filename template ([8e1600a](https://github.com/DialmasterOrg/Youtarr/commit/8e1600a2d96d3db04849e9e05af5e25ea9a945aa)), closes [#369](https://github.com/DialmasterOrg/Youtarr/issues/369)
* add manual rescan and recognize more formats ([851e593](https://github.com/DialmasterOrg/Youtarr/commit/851e593106f5a6c3804495b848f43867866cc9fb))
* **config:** render filename preview via yt-dlp ([24aad30](https://github.com/DialmasterOrg/Youtarr/commit/24aad30c5c89fff2817f03f22b7ce75a7f3a5bdd)), closes [#369](https://github.com/DialmasterOrg/Youtarr/issues/369)


### Bug Fixes

* reduce bind-mount mariadb corruption risk ([9ce4ef7](https://github.com/DialmasterOrg/Youtarr/commit/9ce4ef7609ef4686d157bc5b2dc1e4aefe69f975))
* **deps:** bump axios to clear high-sev advisory ([6f01c15](https://github.com/DialmasterOrg/Youtarr/commit/6f01c154e572e7d9dd276d22dc91803827ab9a26))
* **migrate:** preserve source db collation ([f6c0664](https://github.com/DialmasterOrg/Youtarr/commit/f6c066413c45ea3fcc56d9ba93a595b6d4f880cb)), closes [#598](https://github.com/DialmasterOrg/Youtarr/issues/598)
* **setup:** replace localhost gate with one-time token ([4e1b423](https://github.com/DialmasterOrg/Youtarr/commit/4e1b423f0cf988355ab4280ed6eecc4a520a8755)), closes [#431](https://github.com/DialmasterOrg/Youtarr/issues/431)
* restore members-only video detection ([e0ed879](https://github.com/DialmasterOrg/Youtarr/commit/e0ed8798bdeafebce3ceb7030f2b2df5f4cf043d)), closes [yt-dlp/yt-dlp#16665](https://github.com/yt-dlp/yt-dlp/issues/16665)
* stop clobbering channelvideo publishedAt on empty refresh ([1af2022](https://github.com/DialmasterOrg/Youtarr/commit/1af2022fe551178904e1aa73979dd1c8034b100a)), closes [#608](https://github.com/DialmasterOrg/Youtarr/issues/608)


### Documentation

* update CHANGELOG for v1.68.0 [skip ci] ([99e7f6b](https://github.com/DialmasterOrg/Youtarr/commit/99e7f6b0c2ff37c2f6005167fb572389232e11da))
* **unraid:** expand mariadb setup guidance ([38a0e1a](https://github.com/DialmasterOrg/Youtarr/commit/38a0e1a297625cc1ccccbf8a726d2564abc30b0c))





## [v1.68.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.68.0) - 2026-04-29

## [1.68.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.67.0...v1.68.0) (2026-04-29)


### Features

* add nightly yt-dlp auto-update ([1402505](https://github.com/DialmasterOrg/Youtarr/commit/1402505e6bb32ffca3a021e80d1b4f73520b3b1e))
* add yt-dlp ip family, rate limit, custom args ([228ee4e](https://github.com/DialmasterOrg/Youtarr/commit/228ee4e0dd06151eba01b006077676d3bb82321d)), closes [#527](https://github.com/DialmasterOrg/Youtarr/issues/527) [#529](https://github.com/DialmasterOrg/Youtarr/issues/529) [#535](https://github.com/DialmasterOrg/Youtarr/issues/535)
* expand youtube api coverage to all tabs ([4063f61](https://github.com/DialmasterOrg/Youtarr/commit/4063f618a52fbaeb570c2ac27a89461bdd490442))
* harden youtube data api integration ([f285feb](https://github.com/DialmasterOrg/Youtarr/commit/f285feba68ad2e03a45de2ea53269053e77059d8))
* support optional YouTube Data API v3 key with yt-dlp fallback ([2a3ef33](https://github.com/DialmasterOrg/Youtarr/commit/2a3ef338dbca6866b0d1c17ae97c17a8b48c81b2))
* **auth:** lower username minimum to 1 char ([02996ce](https://github.com/DialmasterOrg/Youtarr/commit/02996ce86dcfb75592ce4121f850457f3a2ef18b)), closes [#581](https://github.com/DialmasterOrg/Youtarr/issues/581)
* **find-videos:** add filter and bulk download ([e69a01d](https://github.com/DialmasterOrg/Youtarr/commit/e69a01d845ec086511137023862b8ca1102072d3))


### Bug Fixes

* **downloads:** persist successful videos when some fail ([ad3e2c1](https://github.com/DialmasterOrg/Youtarr/commit/ad3e2c18152db0f6dfb91e2677c8e8af96c9ebae))
* **downloads:** tolerate expected yt-dlp skips ([7b8f90a](https://github.com/DialmasterOrg/Youtarr/commit/7b8f90abec5b88fabd36d9acfb04d74474ce6816))
* **videos:** handle ENOTEMPTY on SMB delete ([1e5c701](https://github.com/DialmasterOrg/Youtarr/commit/1e5c70168b7934ff7518cac7276cf9394d00d568)), closes [#370](https://github.com/DialmasterOrg/Youtarr/issues/370)


### Documentation

* update CHANGELOG for v1.67.0 [skip ci] ([4a4e4f2](https://github.com/DialmasterOrg/Youtarr/commit/4a4e4f258c6394722106593363a28d106bd1993a))





## [v1.67.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.67.0) - 2026-04-24

## [1.67.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.66.4...v1.67.0) (2026-04-24)


### Features

* add downloaded filter chip to video lists ([f63432d](https://github.com/DialmasterOrg/Youtarr/commit/f63432de2b78e3ded2a446e0f9c9a6ce439d2cb7))
* add Missing and Ignored video filters ([9e01949](https://github.com/DialmasterOrg/Youtarr/commit/9e01949c2e1db80577aab3c943c40c5f471eba10))
* add per-page selector to library and extract shared pagination bar ([551651c](https://github.com/DialmasterOrg/Youtarr/commit/551651c4ef5f3d3f6fb414aa4ca97a0ca42a31ba))
* let protected/missing/ignored chips filter in either direction ([420a556](https://github.com/DialmasterOrg/Youtarr/commit/420a55668710a51c50e2ecad16e8b27ee84db681))
* redesign library page with table and grid views ([fdbb30d](https://github.com/DialmasterOrg/Youtarr/commit/fdbb30d324151858aff9b74fd43f79e11823d065))
* show downloaded date on channel page video views ([a189b2d](https://github.com/DialmasterOrg/Youtarr/commit/a189b2dbd877808288374644aa7aa40e39920ac8))
* show pagination controls at top and bottom of video lists ([e473ec0](https://github.com/DialmasterOrg/Youtarr/commit/e473ec08f8aea93f9871e411d1c216c68db69f3f))
* show thumbnails and missing indicators in download history ([8561611](https://github.com/DialmasterOrg/Youtarr/commit/8561611141445e2d8b090670069d690d3107ff49))
* unify channel and library video lists with shared VideoList ([7149db4](https://github.com/DialmasterOrg/Youtarr/commit/7149db4bacb68b102ab938324f83c8413dd4ddb0))
* unify pagination and inline loading on lists ([d78469b](https://github.com/DialmasterOrg/Youtarr/commit/d78469bd7ba354d36855f123137b47898180115e))


### Bug Fixes

* address code review on video list selection and route tests ([c9d4519](https://github.com/DialmasterOrg/Youtarr/commit/c9d45197d2d5dd05a2781d93384d6a448877c54c))
* pin delete icon right on mobile grid and restore thumbnail clicks for missing videos ([d27d42a](https://github.com/DialmasterOrg/Youtarr/commit/d27d42aee0e00fe403ae9c10738cc1ee65018ab1))
* return 404 instead of 500 for unsubscribed channel settings ([e81b61b](https://github.com/DialmasterOrg/Youtarr/commit/e81b61bc07ac6d19a0fe4a503a8bc44607a59691))
* set group-writable umask and protect config.json secrets ([d0c04b8](https://github.com/DialmasterOrg/Youtarr/commit/d0c04b8e5b886f95b82af2ecf8fc85eeee056b09))
* use native date picker and clarify "published" in video date filters ([28e8e04](https://github.com/DialmasterOrg/Youtarr/commit/28e8e0485a888234cb1b526bd2cdc63afbf4efa6))


### Continuous Integration

* gate pr on claude verdict, not infra errors ([2a81dad](https://github.com/DialmasterOrg/Youtarr/commit/2a81dade577cdfa9a2bf99ff1e0180cc2d251b8a))


### Code Refactoring

* extract shared video list chips, filters, and pagination hook ([02003e5](https://github.com/DialmasterOrg/Youtarr/commit/02003e5cf3254576e181700981fa9b17187f6744))


### Tests

* cover shared VideoList filter panel, toolbar, and selection pill ([ebf6c74](https://github.com/DialmasterOrg/Youtarr/commit/ebf6c74d82ba33493e7c779068b484af0ddfc53b))


### Documentation

* add component extraction, placement, and test authoring rules ([7bcfd86](https://github.com/DialmasterOrg/Youtarr/commit/7bcfd86317d2b550c3ab74fba079a823d198b694))
* expand comparison doc to cover Pinchflat and Tube Archivist ([59cf253](https://github.com/DialmasterOrg/Youtarr/commit/59cf25326216db619f7bdea8604af10496969fbc))
* update CHANGELOG for v1.66.4 [skip ci] ([a4dd486](https://github.com/DialmasterOrg/Youtarr/commit/a4dd486894f993434b8c733fa82fda292518475b))





## [v1.66.4](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.66.4) - 2026-04-20

### [1.66.4](https://github.com/DialmasterOrg/Youtarr/compare/vv1.66.3...v1.66.4) (2026-04-20)


### Bug Fixes

* restore download progress bar fill ([94ba9e0](https://github.com/DialmasterOrg/Youtarr/commit/94ba9e02e191e3ede55b31838b8a9c1a5293cd17))


### Documentation

* update CHANGELOG for v1.66.3 [skip ci] ([68e6029](https://github.com/DialmasterOrg/Youtarr/commit/68e602923d0c250f16bea6f241b635b183c2217f))





## [v1.66.3](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.66.3) - 2026-04-20

### [1.66.3](https://github.com/DialmasterOrg/Youtarr/compare/vv1.66.2...v1.66.3) (2026-04-20)


### Bug Fixes

* download true 1440p/2160p with VP9/AV1 remuxed into MP4 ([#534](https://github.com/DialmasterOrg/Youtarr/issues/534)) ([a5bab33](https://github.com/DialmasterOrg/Youtarr/commit/a5bab3317b7a1d71df6ed400c22ea7366aa18798))
* restore update available notification banner ([c391795](https://github.com/DialmasterOrg/Youtarr/commit/c39179551cbd7c17449c3c463bc0002d0976e75b))


### Documentation

* update CHANGELOG for v1.66.2 [skip ci] ([0cffcbf](https://github.com/DialmasterOrg/Youtarr/commit/0cffcbf54bf65c32376b850532bf331dbdda7ffa))





## [v1.66.2](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.66.2) - 2026-04-19

### [1.66.2](https://github.com/DialmasterOrg/Youtarr/compare/vv1.66.1...v1.66.2) (2026-04-19)


### Bug Fixes

* **websocket:** memoize context value to prevent render loop ([6b68082](https://github.com/DialmasterOrg/Youtarr/commit/6b68082648853fbc09d42429f5d536daab9c158e))


### Documentation

* backfill v1.66.0 payload into v1.66.1 CHANGELOG [skip ci] ([118f5ec](https://github.com/DialmasterOrg/Youtarr/commit/118f5ec9de449dfb1a8e0ef56f049ea16e6911e5))
* update CHANGELOG for v1.66.1 [skip ci] ([1281f17](https://github.com/DialmasterOrg/Youtarr/commit/1281f17184c77d546c99a3cb2e8e8d72eae4f16c))





## [v1.66.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.66.1) - 2026-04-19

### [1.66.1](https://github.com/DialmasterOrg/Youtarr/compare/v1.65.0...v1.66.1) (2026-04-19)


### Features

* **client:** add token-first tailwind baseline and storybook setup ([6aa9ec6](https://github.com/DialmasterOrg/Youtarr/commit/6aa9ec6105c4a3e967f0a727538ef0b81e1c49ed))
* **client:** port origin/main 4-theme engine and appearance controls ([6258283](https://github.com/DialmasterOrg/Youtarr/commit/625828370e8ec094f542f06f5152599cc92db5f7))
* add new theme tokens and styles for overlays, authentication surfaces, and navigation ([fd3ca94](https://github.com/DialmasterOrg/Youtarr/commit/fd3ca94d34efa33107cf6773a2ec79296b5a8715))
* add PageControls component for pagination functionality and update NavSidebar styles ([4787a97](https://github.com/DialmasterOrg/Youtarr/commit/4787a978cbc1276dd843f2f94ea2a02c830634fa))
* add PageControls component for pagination functionality and update NavSidebar styles ([1bd9b44](https://github.com/DialmasterOrg/Youtarr/commit/1bd9b448cba86b6aef9127100534d47e85d39db6))
* Enhance mobile navigation and action bar functionality ([93930fe](https://github.com/DialmasterOrg/Youtarr/commit/93930fe7dc11ea2c259494f28e74afd5964252d0))
* enhance Plex integration UI and improve snackbar styling ([fa62032](https://github.com/DialmasterOrg/Youtarr/commit/fa6203253f73a0ce25e5d6c26611b4f80b04987b))
* enhance UI components and theme management ([96f7b1b](https://github.com/DialmasterOrg/Youtarr/commit/96f7b1b2ddcf25c9ec7e34a89ee202a0c2240f9e))
* Integrate recent features and depedency PR's ([f5dc949](https://github.com/DialmasterOrg/Youtarr/commit/f5dc949ad031c11dc856c17c3d4bec6979b1da65))
* Integrated Claude Code Review Feedback (for the most part) ([34278e0](https://github.com/DialmasterOrg/Youtarr/commit/34278e0ffe0ce2ba4d4d8bc5d5e5aa41ef602c94))
* Refactor layout of URL input and bulk import button for improved responsiveness ([a5cf734](https://github.com/DialmasterOrg/Youtarr/commit/a5cf73480c09f7e98d8e938f323432222a70e21a))
* theme migration - playful/linear/neumorphic/flat themes, dark mode, layout refactor ([1588c25](https://github.com/DialmasterOrg/Youtarr/commit/1588c25a4db3ed9f01489d2634232159762a9a8e))
* **ui:** add Radix+Tailwind primitives, wire success/warning/info semantic tokens ([8a7bd21](https://github.com/DialmasterOrg/Youtarr/commit/8a7bd219c622e67c35250137948846a3c8786144))
* enhance ChannelVideosHeader with action menu for bulk operations ([e72b285](https://github.com/DialmasterOrg/Youtarr/commit/e72b28500e60c124f70a3d67bead57df11790796))
* Enhance theme integration with new themed chip styles and responsive adjustments ([5b07821](https://github.com/DialmasterOrg/Youtarr/commit/5b0782126fab7996188a5c802c9d45ac815b96d7))
* migrate Storybook configuration to TypeScript and enhance layout components with new stories and tests ([fe83842](https://github.com/DialmasterOrg/Youtarr/commit/fe8384242bcadb3a1901ab6f690ccda012d0f0fe))
* Refactor theme handling and background decorations ([884412c](https://github.com/DialmasterOrg/Youtarr/commit/884412cff8f970faf62a78e5f63caf51b2121c60))
* Update navigation logic and improve UI components for better user experience ([0b442f9](https://github.com/DialmasterOrg/Youtarr/commit/0b442f9e47b49b75f23d6b20a20b7ad3cbd3177d))
* Update UI components for improved theme handling and loading states ([2834c60](https://github.com/DialmasterOrg/Youtarr/commit/2834c60945d540825020dcd26f4840457057d010))
* **downloads:** improve Manual Download chip layout and bulk import UX ([45566c1](https://github.com/DialmasterOrg/Youtarr/commit/45566c19d713d070dcdc37d3db9790a11ab4f27b))
* **find-videos:** add table/list view toggle and enrich results for modal ([b1cef12](https://github.com/DialmasterOrg/Youtarr/commit/b1cef1242eed364c3f48b1d23f2236cbc2aba944))
* **videos:** add Find on YouTube search page ([26c6c73](https://github.com/DialmasterOrg/Youtarr/commit/26c6c734e0cb2b47eac133d3aa4eff074376c6fc))


### Bug Fixes

* **release:** pass changelog through env vars, not ${{ }} text substitution ([6da1269](https://github.com/DialmasterOrg/Youtarr/commit/6da12693625f51b32c00b8e9e6fb352424473e37))
* **release:** remove empty template braces from shell comment ([5dec3ed](https://github.com/DialmasterOrg/Youtarr/commit/5dec3ed855475f58c6fd7793ab34b1b175b127b5))
* a lot of visual cleanup of theme alignment ([c14ba66](https://github.com/DialmasterOrg/Youtarr/commit/c14ba66fdcc34ebdcecaa7907091c01d2361a8aa))
* add data-testid attributes for improved testability in UI components ([da0aa81](https://github.com/DialmasterOrg/Youtarr/commit/da0aa81443e0ce128f046e6ded68483864ce3af7))
* add Tabs component tests and enhance Dialog component with context support ([cbb4a3b](https://github.com/DialmasterOrg/Youtarr/commit/cbb4a3bc5b1c7866f4d0332c02d48bce2100e260))
* Adjust NavHeader and NavSidebar styles for improved layout and responsiveness ([8f07637](https://github.com/DialmasterOrg/Youtarr/commit/8f076371652fda04fd60422a4af73998db1d774a))
* channel page infinite-scroll races and thumbnail modal click ([fe755e6](https://github.com/DialmasterOrg/Youtarr/commit/fe755e6ccbeff3a25980331081362220dd9185e4))
* Complete UI/UX improvements - mobile responsive tweaks and accessibility enhancements ([ffb2d19](https://github.com/DialmasterOrg/Youtarr/commit/ffb2d196063fc6a4ba6df7b3e5f130cb93b052de))
* keep pagination visible and show skeleton on channel page change ([d7ac86c](https://github.com/DialmasterOrg/Youtarr/commit/d7ac86cdec0c82a2dd8c258b053b2b68b7144e48))
* resolve videos red overlay, settings links, playful sidebar layout, drawer height, nav button routing, text weight, and per-theme animations ([041d99a](https://github.com/DialmasterOrg/Youtarr/commit/041d99a166b49f3dcb4f72637b6d62cf6a35ed70))
* restore /settings/plex token and clean up subfolder mappings layout ([618feed](https://github.com/DialmasterOrg/Youtarr/commit/618feedd8be6153a4adc151338b66abb9fd441c0))
* Still working through build/test errors after theme refactor. ([1ce745d](https://github.com/DialmasterOrg/Youtarr/commit/1ce745db48457d4fb083e018e01ccb2ac9b623af))
* Test and linting error cleanup ([924646e](https://github.com/DialmasterOrg/Youtarr/commit/924646e58997109dc481455e5cec183d06e2035a))
* Update dependencies in package-lock.json for improved stability and performance ([a176875](https://github.com/DialmasterOrg/Youtarr/commit/a176875d5db4e6f22c839e04c237f98a5422538a))
* Update playful theme styles and improve mobile responsiveness ([d81aac1](https://github.com/DialmasterOrg/Youtarr/commit/d81aac19346b1fcd942f36380774b9915194c1eb))
* update routing in DownloadManager, adjust sidebar navigation, and refine video box styles ([2e58cc6](https://github.com/DialmasterOrg/Youtarr/commit/2e58cc61394734f92670d15159156fcad06f7d53))
* Update test selectors and styles for DownloadSettingsDialog, NavHeader, and overlay behavior ([df64853](https://github.com/DialmasterOrg/Youtarr/commit/df64853f4dc2479cc6f0dd99e5c26da643c44210))
* update video status handling and UI components ([36f6467](https://github.com/DialmasterOrg/Youtarr/commit/36f64671274467c83769473f3c5221831e7d38bb))
* update workflow and text field styles for improved functionality and clarity ([001ece9](https://github.com/DialmasterOrg/Youtarr/commit/001ece9498b03ea254b119453a9f079c0b23cbfd))
* Working through updating the tests for components after theme refactor ([993013e](https://github.com/DialmasterOrg/Youtarr/commit/993013e3af9d8389189738a24dfee4ee36bc4580))
* **channels:** lift floating Save button above mobile bottom nav ([f790459](https://github.com/DialmasterOrg/Youtarr/commit/f790459f134322f16c07e61d915026cd06e20d7f))
* **channels:** persist auto-download tabs and tighten settings dialog ([8d04506](https://github.com/DialmasterOrg/Youtarr/commit/8d045067ff76bea8d72f0bf005b5a2104d07793b))
* **channels:** remove excess bottom padding on mobile ChannelVideos ([45b367d](https://github.com/DialmasterOrg/Youtarr/commit/45b367d9ec69077eb42f98cfaa1a07b8de227ee3))
* **channels:** restore download icon on auto-download chips ([dd3ab3f](https://github.com/DialmasterOrg/Youtarr/commit/dd3ab3faa9dfe94b01be6ccbfe0ed25d4398cd2b))
* **downloads:** hide first-video thumbnail and channel caption on mobile multi-video cards ([8c09c32](https://github.com/DialmasterOrg/Youtarr/commit/8c09c3274c8636884163b6d70e844a8e5e6eb85c))
* **downloads:** open VideoModal from history, clean up mobile layout ([f052e3e](https://github.com/DialmasterOrg/Youtarr/commit/f052e3e993f7dba512686401274024b273601b36))
* **downloads:** redirect to activity page after starting a download ([2a22409](https://github.com/DialmasterOrg/Youtarr/commit/2a22409b72a3c7a8751ec4698df2586363d299b9))
* **downloads:** refresh job video data from DB before serving /runningjobs ([83bc2d6](https://github.com/DialmasterOrg/Youtarr/commit/83bc2d6309c04b77f2b5a0525fd3f538e0223671))
* **downloads:** show "Multiple (N)" title in mobile history for multi-video jobs ([3e85adb](https://github.com/DialmasterOrg/Youtarr/commit/3e85adb5b078c30725e3791aa441402f62735419))
* **settings:** align Stall Detection Window field with sibling selects ([3f72471](https://github.com/DialmasterOrg/Youtarr/commit/3f72471c8e3ad34a182d8dbb7bef7d7e24654272))
* **settings:** keep history side effects out of setState updater ([50b1c2a](https://github.com/DialmasterOrg/Youtarr/commit/50b1c2a71f4b7af291f1c6f283f9178d23b5039e))
* **settings:** restore yt-dlp UI and tighten unsaved-changes flow ([24e4d23](https://github.com/DialmasterOrg/Youtarr/commit/24e4d235d61c49b5fcf16308bee9bfcb00e8c401))
* **settings:** tighten layout and alignment in Core Settings page ([ed6c010](https://github.com/DialmasterOrg/Youtarr/commit/ed6c0105a9cbc9da354ccf689cf72788a5d8ab63))
* **ui:** align settings icon with title text in DownloadSettingsDialog ([20ed515](https://github.com/DialmasterOrg/Youtarr/commit/20ed515d0360415cdc1ddc339ed4fec24cb58c71))
* **ui:** clamp Popover position within viewport ([5234394](https://github.com/DialmasterOrg/Youtarr/commit/523439441209cf3c5bf8f116e820297d42ff2f00))
* **ui:** enlarge mobile VideoModal back button and align with title ([8bd26d6](https://github.com/DialmasterOrg/Youtarr/commit/8bd26d6564a2c2b6219bab6fa08e830f1e63c954))
* **ui:** keep bottom snackbars above mobile nav ([9c0be35](https://github.com/DialmasterOrg/Youtarr/commit/9c0be3544e330785a6ccaf9326346640e3704a48))
* **ui:** rewrite Channel Display Guide for accuracy and layout ([6f6e248](https://github.com/DialmasterOrg/Youtarr/commit/6f6e248806a222745b7f5c23842ebc79db93ae98))
* **ui:** show placeholder and rename Rating label on ChannelPage ([c578735](https://github.com/DialmasterOrg/Youtarr/commit/c578735cea7c9d46b67d3f2e0d452e7a3542f29b))
* **ui:** silence Radix DialogTitle and orphan label a11y warnings ([5889bfa](https://github.com/DialmasterOrg/Youtarr/commit/5889bfac96bfc524e8d815a315a0f60e500da989))
* **videos:** align header and fit mobile pagination ([7628010](https://github.com/DialmasterOrg/Youtarr/commit/762801049b2dd380f24299e54ecb67b01cfff846))
* **videos:** smoother pagination transitions ([ce7b2e9](https://github.com/DialmasterOrg/Youtarr/commit/ce7b2e9fe5fd8c88f0a8e92a7b6343db9eecf014))
* **videos:** unblock backend tests and address PR review ([eca44a1](https://github.com/DialmasterOrg/Youtarr/commit/eca44a1b52dfd0075c333a39c96dbc24285b42ca))


### Styles

* **find-videos:** widen search input on desktop and make Search button look like a button ([b6fc83f](https://github.com/DialmasterOrg/Youtarr/commit/b6fc83f650fbb1c264e0419d82b9ef87ad769f00))


### Tests

* unblock CI lint and restore lost coverage ([1ee835e](https://github.com/DialmasterOrg/Youtarr/commit/1ee835e1ee6b5d08fd40e7a26d902b68cbefe5bb))
* **frontend:** add coverage for hooks, VideoModal, and post-refactor components ([0f7267c](https://github.com/DialmasterOrg/Youtarr/commit/0f7267cf4b5e36d22b6d42f57a4a07dab2344136))


### Documentation

* Add pinchflat comparison [skip ci] ([ab7978e](https://github.com/DialmasterOrg/Youtarr/commit/ab7978eab79dc1aea1713fc97cc0b60009df5ff3))
* refresh CLAUDE.md for Tailwind/Radix retheme ([e701f7b](https://github.com/DialmasterOrg/Youtarr/commit/e701f7b25b5019148d271807213e75d0dce96398))
* restructure README Quick Start and move dev builds to DEVELOPMENT.md ([5474aa9](https://github.com/DialmasterOrg/Youtarr/commit/5474aa935c9f58d0aa44afc81fd9fd0195368f5e))
* update CHANGELOG for v1.65.0 [skip ci] ([88fb5d5](https://github.com/DialmasterOrg/Youtarr/commit/88fb5d582962dcd91fe9874c6794cc4ff2ac17e4))


### Code Refactoring

* enhance test coverage and improve component accessibility ([a25f785](https://github.com/DialmasterOrg/Youtarr/commit/a25f785a45211865b62d6a6149ed821bf0c2cbee))
* remove neumorphic theme and related styles; update NavSidebar and RatingBadge components ([3d3321c](https://github.com/DialmasterOrg/Youtarr/commit/3d3321c57572afb8dbdc93cb5c78a29c939cf893))
* replace any types in ui primitives with narrower types ([9a9d41f](https://github.com/DialmasterOrg/Youtarr/commit/9a9d41f2b7b09e1dcca16d0471165f56f6ac0d3a))
* split NavHeader into chrome, actions, and top-nav items ([37300e7](https://github.com/DialmasterOrg/Youtarr/commit/37300e7dfca939b6ebca00fdd4cfc3c744577052))
* split NavSidebar into orchestrator, desktop, mobile, and drawer content ([480dcb2](https://github.com/DialmasterOrg/Youtarr/commit/480dcb29cf84561b2427bf8269e83fd26bdacadf))
* split ui/layout.tsx into focused primitive files ([f90ca99](https://github.com/DialmasterOrg/Youtarr/commit/f90ca9910280419b64d7f98c0a215e1a3379c617))
* **nav:** rename Subscriptions to Imports and clarify Channels sub-item ([470fb8b](https://github.com/DialmasterOrg/Youtarr/commit/470fb8b9b539e2186201fa86c1a8318e47ae3e14))
* **ui:** drop silent sx prop from non-honoring wrappers ([e2f7c72](https://github.com/DialmasterOrg/Youtarr/commit/e2f7c727b162f30cce025b2e2c50666534be7970))
* **video-search:** export error classes directly on module.exports ([b2473a5](https://github.com/DialmasterOrg/Youtarr/commit/b2473a5b4332f066627e25cc7e30e700dfdb725b))
* **videos:** address PR review nits on Find on YouTube ([e09393d](https://github.com/DialmasterOrg/Youtarr/commit/e09393d7c9f37aeef056ac37e9b31be75d85e388))



## [v1.65.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.65.0) - 2026-04-13

## [1.65.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.64.0...v1.65.0) (2026-04-13)


### Features

* **api:** add PATCH /api/videos/:id/protected endpoint ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([ad2c493](https://github.com/DialmasterOrg/Youtarr/commit/ad2c493cb845a125a41aa7f6a2d0d60c14af881e))
* **backend:** add setVideoProtection method to videosModule ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([2a499ec](https://github.com/DialmasterOrg/Youtarr/commit/2a499eca005873cb58d9570bc7b4bf85c40f354c))
* **backend:** exclude protected videos from auto-deletion ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([cc617aa](https://github.com/DialmasterOrg/Youtarr/commit/cc617aa9d5e235a666719178c36f81a8cf5345a8))
* **channels:** add manual tab override with yt-dlp redetect ([89fb2ec](https://github.com/DialmasterOrg/Youtarr/commit/89fb2ec6c9c30f0a7f3e5f29ce7e44f82010a0ac))
* **channels:** add selectable page size for channel videos ([#288](https://github.com/DialmasterOrg/Youtarr/issues/288)) ([8c4007a](https://github.com/DialmasterOrg/Youtarr/commit/8c4007a50d3b9822862974ee0457b9565621a1f9))
* **db:** add protected column to Videos table ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([c9f7009](https://github.com/DialmasterOrg/Youtarr/commit/c9f7009d48f9eb2048da2bd07c7f35967297438a))
* **frontend:** add useVideoProtection shared hook ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([7c87eb8](https://github.com/DialmasterOrg/Youtarr/commit/7c87eb877a34ca995d5242bae683827dac08f9b1))
* **plex:** add per-subfolder library mapping to plexModule ([5dbccea](https://github.com/DialmasterOrg/Youtarr/commit/5dbccea42e09b46297b7809e2ad85bdaab0ae46d)), closes [#310](https://github.com/DialmasterOrg/Youtarr/issues/310)
* **plex:** add PlexSubfolderMappings UI component ([80619cb](https://github.com/DialmasterOrg/Youtarr/commit/80619cb36f4bed3b3575eaa98502475e9351636e))
* **plex:** wire subfolder-aware refresh into download and channel settings ([a82afb8](https://github.com/DialmasterOrg/Youtarr/commit/a82afb8f536d3535a24a134d08b328adb725e3ed))
* **types:** add protected field to VideoData and ChannelVideo ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([88ef370](https://github.com/DialmasterOrg/Youtarr/commit/88ef37068f29beaa55a7daa2c907fffadc8c5421))
* **ui:** add protected filter chip to ChannelPage ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([55d00c0](https://github.com/DialmasterOrg/Youtarr/commit/55d00c02820c1046cef3b85234c71c03287c73c7))
* **ui:** add shield icon and protected filter to VideosPage ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([4c4194e](https://github.com/DialmasterOrg/Youtarr/commit/4c4194ecc24595836007f47807b9805aecde64ac))
* **ui:** add shield icon to VideoCard ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([fa40cbe](https://github.com/DialmasterOrg/Youtarr/commit/fa40cbe13505e3b24170e9685e940fc1af622f4c))
* **ui:** add shield icon to VideoListItem and VideoTableView ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([079007e](https://github.com/DialmasterOrg/Youtarr/commit/079007e14f0d7e8ad63dd945a775b137c3a5d7d5))
* **ui:** wire up video protection toggle in ChannelVideos ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([e9792c1](https://github.com/DialmasterOrg/Youtarr/commit/e9792c13dedd9b19dfa59b9f53558aa8b542cd97))
* **videos:** add video modal with detail view and streaming ([#522](https://github.com/DialmasterOrg/Youtarr/issues/522)) ([58290cb](https://github.com/DialmasterOrg/Youtarr/commit/58290cb5036a4504201c7e3c075c18b79fcb4f18))
* **videos:** polish video modal UI/UX ([0339f85](https://github.com/DialmasterOrg/Youtarr/commit/0339f8524ea32e4a68e621d009a16df08aec4985))


### Bug Fixes

* **db:** correct helpers require path in migration ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([4411e25](https://github.com/DialmasterOrg/Youtarr/commit/4411e25d72ae85919738ecd7c2d8ac2ddaed1ae3))
* **ui:** improve protected filter chip placement on VideosPage ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([85f8c19](https://github.com/DialmasterOrg/Youtarr/commit/85f8c192dec5e4afb82c0517b7c19d8b06c7f790))
* address PR review - table handler, error leak, server-side filter ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([fb4f311](https://github.com/DialmasterOrg/Youtarr/commit/fb4f3114a37eb4ff1d73ba32aa5991b98703f8d6))
* guard shield on removed videos, clean up redundant check and loading state ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([a53b046](https://github.com/DialmasterOrg/Youtarr/commit/a53b0469dfed8bc7973f5e77dabfde0be62e7c13))
* **plex:** normalize subfolder sentinels before Plex library refresh ([83cc231](https://github.com/DialmasterOrg/Youtarr/commit/83cc231d87be52b70f9137882c26c2a38e294fa3))
* address PR review feedback for plex subfolder mappings ([9fbcd6c](https://github.com/DialmasterOrg/Youtarr/commit/9fbcd6c08f9076fc6a8dd12e2bd543f543e51405))
* **deps:** patch critical axios and vite vulnerabilities ([671a936](https://github.com/DialmasterOrg/Youtarr/commit/671a936c0a37e62101035f23e9ef2160c895b360))
* **plex:** subfolder mappings honor per-channel and default subfolders ([aed5f6b](https://github.com/DialmasterOrg/Youtarr/commit/aed5f6bc287a345539d7f095952251c7bc3cc4a3))
* **plex:** use Promise.allSettled in refreshLibrariesForSubfolders ([fc69cf8](https://github.com/DialmasterOrg/Youtarr/commit/fc69cf838f2ac5e222e6e03cb92e53c9f213ddfc))
* **scripts:** reset-server-data also clears dev and arm db volumes ([7bc28a5](https://github.com/DialmasterOrg/Youtarr/commit/7bc28a529ea616763a891177416a749510f9aa4a))
* **videos:** address PR review feedback on video modal ([3a74331](https://github.com/DialmasterOrg/Youtarr/commit/3a743314c59911bf6d52ff217d1dadcbacbbdebc))
* **videos:** video modal behaved poorly for members-only videos ([777fc99](https://github.com/DialmasterOrg/Youtarr/commit/777fc9989b77f7eb7b55c6e95a53a22ce54fbbeb))
* **videos:** video modal download flow was broken and metadata displayed incorrectly ([67efb46](https://github.com/DialmasterOrg/Youtarr/commit/67efb46256cb9ca6d532f44880a2cfae3eb4a3a9))
* **videos:** video player info tooltip was not reachable on mobile ([0c29fc5](https://github.com/DialmasterOrg/Youtarr/commit/0c29fc546aaf01070202a6bad2481638a3ab3de2))


### Code Refactoring

* **plex:** cache library list and decompose display rendering ([cc66880](https://github.com/DialmasterOrg/Youtarr/commit/cc668801a9372dcb0d3b8ecb4182a79d096bbd91))
* **ui:** extract ProtectionShieldButton shared component ([#505](https://github.com/DialmasterOrg/Youtarr/issues/505)) ([79faba1](https://github.com/DialmasterOrg/Youtarr/commit/79faba121ce7803ba40ec2d817d614d68a1ea279))


### Tests

* **plex:** add PlexSubfolderMappings component tests ([243f1bf](https://github.com/DialmasterOrg/Youtarr/commit/243f1bfeaea9e994440797b383c1000ab352f41e))
* **plex:** add tests for per-subfolder library refresh methods ([dfd7f19](https://github.com/DialmasterOrg/Youtarr/commit/dfd7f1903e98b0a8ca3a4b586092a7916506df69))


### Documentation

* add plexSubfolderLibraryMappings configuration documentation ([fad0ed8](https://github.com/DialmasterOrg/Youtarr/commit/fad0ed8651fbc1c1828ee5f09a30d8f0937a0bfa))
* Add warnings about external DB restarts ([131b2e4](https://github.com/DialmasterOrg/Youtarr/commit/131b2e4233f3c1466f7d6df6468d6a3c0f3c9822))
* document video detail modal and in-app playback ([270fadf](https://github.com/DialmasterOrg/Youtarr/commit/270fadf2adec97c51a1e40a75b8872637088efc5))
* refine project guidelines and dev workflow documentation ([1d51772](https://github.com/DialmasterOrg/Youtarr/commit/1d5177273b3d6f789d6e9777d15b846df0b44778))
* update CHANGELOG for v1.64.0 [skip ci] ([9f3cb9e](https://github.com/DialmasterOrg/Youtarr/commit/9f3cb9e394160775b30494710a70f5c7fe3067c7))





## [v1.64.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.64.0) - 2026-04-08

## [1.64.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.63.0...v1.64.0) (2026-04-08)


### Features

* add dateadded element to NFO output ([#444](https://github.com/DialmasterOrg/Youtarr/issues/444)) ([7ae6487](https://github.com/DialmasterOrg/Youtarr/commit/7ae6487a7ad64fdce382ee33006e8d705a4b2b09))
* add formatDateAdded method to NfoGenerator ([#444](https://github.com/DialmasterOrg/Youtarr/issues/444)) ([ea7eefd](https://github.com/DialmasterOrg/Youtarr/commit/ea7eefd8b2c9861869359388d6780dd580fc7c3d))
* **channels:** add optional initialSettings param to upsertChannel for new rows ([01b7b0d](https://github.com/DialmasterOrg/Youtarr/commit/01b7b0dec2450fa95005bbcfbd3f1f3fc25deb54))
* **subscriptions:** add constants and concurrency limiter for import module ([595e577](https://github.com/DialmasterOrg/Youtarr/commit/595e577dedc4f0534130281352b50bb47deb1624))
* **subscriptions:** add import job runner with concurrency, cancellation, belt-and-suspenders dedup ([04964f4](https://github.com/DialmasterOrg/Youtarr/commit/04964f47b798e1ce15aacf7185068f416622db10))
* **subscriptions:** add og:image thumbnail enricher with concurrency cap ([4481172](https://github.com/DialmasterOrg/Youtarr/commit/4481172c8dcb262113c914422441d7b152aaee21))
* **subscriptions:** add one-time cookies yt-dlp fetcher with temp file isolation ([a12f552](https://github.com/DialmasterOrg/Youtarr/commit/a12f552606c5dcace9c0130c91c8bfced899a7fc))
* **subscriptions:** add ReviewTable, MobileCard, BulkActionsBar, RowSettingsPopover/Sheet ([cb8f267](https://github.com/DialmasterOrg/Youtarr/commit/cb8f26782c8e3a04689c3ae1e435faf7cd171ae5))
* **subscriptions:** add settings chips to mobile import cards ([d1a7e5d](https://github.com/DialmasterOrg/Youtarr/commit/d1a7e5d04a48cb70857b00538bf4682307047f8e))
* **subscriptions:** add subfolder, quality, and rating chips to import table rows ([502c013](https://github.com/DialmasterOrg/Youtarr/commit/502c013ce4aaad308db9424a2ce0ab7d73b1c502))
* **subscriptions:** add subscription import API routes ([b61df39](https://github.com/DialmasterOrg/Youtarr/commit/b61df391511210065d5ca52d9b304517650e3271))
* **subscriptions:** add SubscriptionImportModule singleton with preview and import orchestration ([99aedd8](https://github.com/DialmasterOrg/Youtarr/commit/99aedd8b008964c38c6130afb56dec7dacb8a947))
* **subscriptions:** add Takeout CSV parser with quoted field and BOM support ([9be7221](https://github.com/DialmasterOrg/Youtarr/commit/9be722178e9e06b444557c1ded32b920d6857662))
* **subscriptions:** add types, useActiveImport hook, ActiveImportBanner, import page skeleton, and route ([a72048b](https://github.com/DialmasterOrg/Youtarr/commit/a72048b2f6996af8e8915a3baa2b70bee39c22f4))
* **subscriptions:** add useImportFlow state machine, SourcePicker, ChannelThumbnail, DisclaimerBanner ([2929439](https://github.com/DialmasterOrg/Youtarr/commit/292943992e93a52d50bbb277882ee701fb1b3259))
* **subscriptions:** add yt-dlp error classifier for friendly user messages ([4b21d27](https://github.com/DialmasterOrg/Youtarr/commit/4b21d27e9f8973996fab018dcc2daa6a6f074860))
* **subscriptions:** fetch subfolders and config in import page ([2b0a08b](https://github.com/DialmasterOrg/Youtarr/commit/2b0a08bcf5fc875679847918ebdaa569d8331d88))
* **subscriptions:** migrate jobs.output to MEDIUMTEXT for import results ([47763c2](https://github.com/DialmasterOrg/Youtarr/commit/47763c2301180cf90cab5a1788a62800f7f5aa95))
* **subscriptions:** replace subfolder text field with SubfolderAutocomplete in mobile sheet ([1465453](https://github.com/DialmasterOrg/Youtarr/commit/1465453d10efc18ce0feb1494a63fd846413f02a))
* **subscriptions:** replace subfolder text field with SubfolderAutocomplete in popover ([8769597](https://github.com/DialmasterOrg/Youtarr/commit/87695975bb334402ec3ca05d774f15a831a88ecf))
* **subscriptions:** sort imported channels alphabetically in preview ([a57b6be](https://github.com/DialmasterOrg/Youtarr/commit/a57b6be538af3939e6a2fb757a90338c5e0ddee2))
* **subscriptions:** thread subfolder and config props through review table ([c7c4e46](https://github.com/DialmasterOrg/Youtarr/commit/c7c4e46af937facce9d4dcbb8cbb0502cf16e213))
* **subscriptions:** wire subscription import routes and module init ([34a4452](https://github.com/DialmasterOrg/Youtarr/commit/34a4452d0327e9e591cda6618cc4e9d233ce18f0))


### Bug Fixes

* add backend tests to pre-commit hook and fix cronJobs test mock ([a92325f](https://github.com/DialmasterOrg/Youtarr/commit/a92325f8f80c3e67fa08221e89417a41990b2dc2))
* make orphan directory scan resilient to per-subfolder errors ([be17371](https://github.com/DialmasterOrg/Youtarr/commit/be17371d7cd6c33244ac898f188a059806425abc))
* proactively clean up orphan empty channel directories ([#443](https://github.com/DialmasterOrg/Youtarr/issues/443)) ([ddd7c4a](https://github.com/DialmasterOrg/Youtarr/commit/ddd7c4a75fef99fdffd58419aa2ab20e25543762))
* **channels:** pass initialSettings through getChannelInfo to upsertChannel ([713bf88](https://github.com/DialmasterOrg/Youtarr/commit/713bf88ebbe82d3813a6c660b789549b9bfd68f0))
* **downloads:** filter out Import Subscriptions jobs from download history ([b641bb1](https://github.com/DialmasterOrg/Youtarr/commit/b641bb1e4506a5476e9e4305242d46687db51ce6))
* **subscriptions:** address code review findings for import banner and settings ([2878fd5](https://github.com/DialmasterOrg/Youtarr/commit/2878fd5276e1c13e36beb55408c1290ed8b31ce2))
* **subscriptions:** address multiple import settings and display issues ([9764046](https://github.com/DialmasterOrg/Youtarr/commit/976404614f178d9ee64f41439bf7e76da90b80ff))
* **subscriptions:** default imported channels to global default subfolder ([7abdb24](https://github.com/DialmasterOrg/Youtarr/commit/7abdb24ed9dd97dae34a04b893631c0b995bb86f))
* **subscriptions:** fix settings mapping, job persistence, and code review findings ([ab3680b](https://github.com/DialmasterOrg/Youtarr/commit/ab3680bd4ee193546f359855fe27b1471e3f298d))
* **subscriptions:** resolve integration issues from manual testing ([91ee35e](https://github.com/DialmasterOrg/Youtarr/commit/91ee35eb4342d9264079cc2683c908d170356403))


### Styles

* **subscriptions:** move import statement to top of file ([bd9c64d](https://github.com/DialmasterOrg/Youtarr/commit/bd9c64d294e0a87efb20f1f00bb3e4554a1c89e0))


### Documentation

* add subscription import documentation to usage guide, troubleshooting, and CLAUDE.md ([06c3354](https://github.com/DialmasterOrg/Youtarr/commit/06c33546a1884597e938d598abba627b715a13c1))
* update CHANGELOG for v1.63.0 [skip ci] ([b087e43](https://github.com/DialmasterOrg/Youtarr/commit/b087e43eb667cd673345fa1e6cab181008c52cac))





## [v1.63.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.63.0) - 2026-04-04

## [1.63.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.62.0...v1.63.0) (2026-04-04)


### Features

* add notifications for automatically removed videos ([062fee6](https://github.com/DialmasterOrg/Youtarr/commit/062fee6dacc7e748d747d7f6ca4003b4c6d844ab)), closes [#218](https://github.com/DialmasterOrg/Youtarr/issues/218)


### Bug Fixes

* show actual total deleted count in auto-removal notification truncation ([17df3ac](https://github.com/DialmasterOrg/Youtarr/commit/17df3acfd40f4edda03a9bdcff8686f5bcabadd5))
* tighten Claude review workflow permissions and expand CLAUDE.md ([ccbe8ac](https://github.com/DialmasterOrg/Youtarr/commit/ccbe8aca5d5b4fb985e6c027721040226745679d))


### Documentation

* update CHANGELOG for v1.62.0 [skip ci] ([d763ba5](https://github.com/DialmasterOrg/Youtarr/commit/d763ba51e25f356fc7f4ca4d4a25f6d038c632ae))





## [v1.62.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.62.0) - 2026-04-03

## [1.62.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.61.1...v1.62.0) (2026-04-03)


### Features

* announce production releases in Discord ([03a5f0e](https://github.com/DialmasterOrg/Youtarr/commit/03a5f0e81f5d8ab228932be3f767b1dd9bf9927e))


### Bug Fixes

* remove dependabot and patch lodash vulnerability ([86a6e93](https://github.com/DialmasterOrg/Youtarr/commit/86a6e9354d24aeb1577d73579a3f5157007e09e5))


### Documentation

* update CHANGELOG for v1.61.1 [skip ci] ([994cc95](https://github.com/DialmasterOrg/Youtarr/commit/994cc95785acbb5ae0edf9b663607dc5fcbe6c5d))





## [v1.61.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.61.1) - 2026-04-03

### [1.61.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.61.0...v1.61.1) (2026-04-03)


### Bug Fixes

* patch high-severity dependency vulns ([0841f8b](https://github.com/DialmasterOrg/Youtarr/commit/0841f8beae12b5f09dd6b8b531985f58eec4cb19))


### Documentation

* update CHANGELOG for v1.61.0 [skip ci] ([f96fcae](https://github.com/DialmasterOrg/Youtarr/commit/f96fcaeb7342fb80271a66d97af9772836f306db))





## [v1.61.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.61.0) - 2026-03-21

## [1.61.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.60.1...v1.61.0) (2026-03-21)


### Features

* add bulk import video downloads ([#327](https://github.com/DialmasterOrg/Youtarr/issues/327)) ([1875cc7](https://github.com/DialmasterOrg/Youtarr/commit/1875cc7c8d7d72eef48c16946aba863562e08ffa))
* auto-clean empty channel directories ([#443](https://github.com/DialmasterOrg/Youtarr/issues/443)) ([26f16d8](https://github.com/DialmasterOrg/Youtarr/commit/26f16d8bc5f9209f565d9904389f832bb05a9b7e))


### Bug Fixes

* yt-dlp update failure when run as non-root user ([#451](https://github.com/DialmasterOrg/Youtarr/issues/451)) ([45021fa](https://github.com/DialmasterOrg/Youtarr/commit/45021fae9b0b0af6db8a67c5a45dc3b2669de1b6))


### Documentation

* update CHANGELOG for v1.60.1 [skip ci] ([1c57705](https://github.com/DialmasterOrg/Youtarr/commit/1c577053d91f64e2e5e535a74c5638e0e5fb7ae4))
## [v1.60.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.60.1) - 2026-03-05

### [1.60.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.60.0...v1.60.1) (2026-03-05)


### Documentation

* update CHANGELOG for v1.60.0 [skip ci] ([a43e9a1](https://github.com/DialmasterOrg/Youtarr/commit/a43e9a1356e9723647cc0dd0a1c07661d4aa8985))


## [v1.60.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.60.0) - 2026-03-02

## [1.60.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.59.0...v1.60.0) (2026-03-02)


### Features

* **client:** migrate Storybook config and parity play coverage ([6bb59e6](https://github.com/DialmasterOrg/Youtarr/commit/6bb59e698a65a8ea5fa7316a518b2b1c63217883))
* add Storybook test job to CI workflow ([a22959e](https://github.com/DialmasterOrg/Youtarr/commit/a22959e3f3b38626d5a68d02538514c4508d362f))
* channel flat file structure option ([#258](https://github.com/DialmasterOrg/Youtarr/issues/258)) ([86dd6c6](https://github.com/DialmasterOrg/Youtarr/commit/86dd6c63180b6c9ee862b2425219868c33f83273))
* enhance Storybook integration with caching, add MSW handlers, and improve test accessibility ([4a9b020](https://github.com/DialmasterOrg/Youtarr/commit/4a9b02078b2ffe3a8d4e22be745964135c5d6c18))
* enhance Storybook integration with CI and update documentation ([2bf81e3](https://github.com/DialmasterOrg/Youtarr/commit/2bf81e35b91b468899d2e59250dfa8478ec0dde2))
* update CI workflow for Storybook validation and simplify related scripts ([50d7f9a](https://github.com/DialmasterOrg/Youtarr/commit/50d7f9a7c7405859b608768bc4bee138baf1d8e8))


### Bug Fixes

* add 15s timeout to HTTP thumbnail download to prevent long hangs ([#405](https://github.com/DialmasterOrg/Youtarr/issues/405)) ([80eb2f1](https://github.com/DialmasterOrg/Youtarr/commit/80eb2f13ef873cc3ead863c81f7b1436f2547cde))
* address code review for flat file feat ([#442](https://github.com/DialmasterOrg/Youtarr/issues/442)) ([426334c](https://github.com/DialmasterOrg/Youtarr/commit/426334cfb38c68749a64c7258ed090f3c0caee9b))
* address issues raised during review/testing ([c2408fc](https://github.com/DialmasterOrg/Youtarr/commit/c2408fc476b3188de11c2b9c0014e1211a8fd90c))
* Addressed nested router issue and filled gap in storybook testing ([43f1220](https://github.com/DialmasterOrg/Youtarr/commit/43f1220f25ba8a0ff665e3e3792bc380a87a3d0f))
* correct import path for DEFAULT_CONFIG in MSW handlers ([0120489](https://github.com/DialmasterOrg/Youtarr/commit/012048918ec9fe9b2aca1d88489252dfc0ed5e4a))
* resolve CI lint failure ([0cc17ba](https://github.com/DialmasterOrg/Youtarr/commit/0cc17ba665d9878206f430c4eda46c2d69e23dd3))
* stale NFS mounts ([#434](https://github.com/DialmasterOrg/Youtarr/issues/434)) ([cd9a334](https://github.com/DialmasterOrg/Youtarr/commit/cd9a334884f3cbe06b4872faacbce38c5fd54b04))
* Storybook failing to load/update docs ([8f28929](https://github.com/DialmasterOrg/Youtarr/commit/8f28929d91b0dbd690aa7c69417c80e432f7655e))
* Storybook MemoryRouter story issues ([7014f8e](https://github.com/DialmasterOrg/Youtarr/commit/7014f8e5e063494bd26cd8f2e8003ebcd9ddd40e))


### Documentation

* update CHANGELOG for v1.59.0 [skip ci] ([4752a38](https://github.com/DialmasterOrg/Youtarr/commit/4752a3888fd3f7d70c9e64042a57bef0d46390e4))





## [v1.59.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.59.0) - 2026-02-16

## [1.59.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.58.0...v1.59.0) (2026-02-16)


### Features

* add default_rating handling in settings and channel mapping ([cec6610](https://github.com/DialmasterOrg/Youtarr/commit/cec661079a74356e445f88fa1e1b95060005ba19))
* add Vite environment variables and enhance location mocking utilities for tests ([a4e52de](https://github.com/DialmasterOrg/Youtarr/commit/a4e52de6d05eed3ae3940b2c85b225a3c2d4c28f))
* enhance testing setup with window.location mock and aligned endpoint calls with upstream-dev ([a364a44](https://github.com/DialmasterOrg/Youtarr/commit/a364a44eca9b9104689961e6d1deb7e919b80a7a))
* enhance URL validation to support sync/async handlers and improve error handling ([d5d9cdc](https://github.com/DialmasterOrg/Youtarr/commit/d5d9cdcef625cbdd98776e9bacd8818279c9eaa5))
* implement age limit mapping and validation for content ratings ([1b0a8fa](https://github.com/DialmasterOrg/Youtarr/commit/1b0a8fa17516bea1ba9fda875c3f4c7f5d153798))
* Implement content rating system across various components ([349322d](https://github.com/DialmasterOrg/Youtarr/commit/349322d65e761c5fb4749e413063b1d23d183d28))
* implement locationUtils for robust window.location mocking in tests and refactor components to use it ([86c0a1b](https://github.com/DialmasterOrg/Youtarr/commit/86c0a1bd49729cc8639966277d68e6ccca3fda3b))
* implement safe JSON parsing for fetch responses and remove unused location mock ([9500926](https://github.com/DialmasterOrg/Youtarr/commit/950092680396981806bf16f2c47634296d9a47aa))
* migrate client to Vite, update dependencies, and refactor tests ([cf0f67c](https://github.com/DialmasterOrg/Youtarr/commit/cf0f67cc7dcdb9b4cc50715ca97a7a2a07fe0052))
* Pull content rating feature from full-stack and updated existing testing. ([c679d17](https://github.com/DialmasterOrg/Youtarr/commit/c679d173964c1456365ca24c0f0093c14cde8046))
* update cache control settings across API calls and static assets ([7c9842b](https://github.com/DialmasterOrg/Youtarr/commit/7c9842b4db9b23af214adf593b926ef5a89870b5))
* update video rating handling to support null values and normalize ratings in API ([d40de38](https://github.com/DialmasterOrg/Youtarr/commit/d40de38dca5c54ac898fde604dd79fb01922a760))


### Bug Fixes

* **#426:** use configurable tmp path ([8edefdf](https://github.com/DialmasterOrg/Youtarr/commit/8edefdf8b87c4d4fabf0bc59714be26ddd3996ca)), closes [#426](https://github.com/DialmasterOrg/Youtarr/issues/426)
* **ci:** Claude Code gh workflow [skip ci] ([e103335](https://github.com/DialmasterOrg/Youtarr/commit/e1033355554c8b7dc060313eedd637567b7b9292))
* **ci:** Claude Code gh workflow [skip ci] ([3ab9525](https://github.com/DialmasterOrg/Youtarr/commit/3ab9525f228a5dd196b75f789446105b2fc4ea66))
* **ci:** grant gh CLI permissions to Claude Code workflow [skip ci] ([2ff9f19](https://github.com/DialmasterOrg/Youtarr/commit/2ff9f19babc38f7b7499d5a94fb303ab6f061506))
* **ci:** grant gh CLI permissions to Claude Code workflow [skip ci] ([60f903c](https://github.com/DialmasterOrg/Youtarr/commit/60f903c50a845d3a1becdd570abd4d79e64b0fdb))
* Improve content rating reliability and Plex metadata embedding ([29ac65d](https://github.com/DialmasterOrg/Youtarr/commit/29ac65d4ca5dff622b393f0f8ef40131aeb5e412))
* update import paths for locationUtils in multiple components and tests ([c97b740](https://github.com/DialmasterOrg/Youtarr/commit/c97b74092486cbe8898b0148664a47d7c4a51cfa))
* **ci:** Claude Code gh workflow [skip ci] ([af6cf50](https://github.com/DialmasterOrg/Youtarr/commit/af6cf505214076a988165fbba5913a041f50d589))
* **ci:** Claude Code gh workflow [skip ci] ([42d6816](https://github.com/DialmasterOrg/Youtarr/commit/42d68160f9f2f7c820ece5cdd14f8937474f7332))
* **ci:** Claude Code gh workflow [skip ci] ([c23a3bc](https://github.com/DialmasterOrg/Youtarr/commit/c23a3bc6382d102d2d4a718d54b17ea8155c983e))
* **ci:** Claude Code gh workflow again [skip ci] ([6b29f5c](https://github.com/DialmasterOrg/Youtarr/commit/6b29f5ce30adea6fe19993e1b268446fbd5b5a7c))
* **ci:** Claude Code gh workflow again [skip ci] ([4d4d73c](https://github.com/DialmasterOrg/Youtarr/commit/4d4d73cf1513116f26ff1fb90123da99ab57b389))
* **ci:** Claude Code gh workflow again [skip ci] ([609d38a](https://github.com/DialmasterOrg/Youtarr/commit/609d38ae43471d11f65dbe5d32a4f7d1cff50ced))
* **ci:** stop Claude running disallowed commands ([d6571fa](https://github.com/DialmasterOrg/Youtarr/commit/d6571fa9962f00961921ebf085ddae2aa0349602))
* **tests:** correct --year in AtomicParsley test ([f826275](https://github.com/DialmasterOrg/Youtarr/commit/f826275e7de04509b8564033c0a8dffe80704eaa))
* **tests:** prevent Jest hanging by mocking tempPathManager ([185ff04](https://github.com/DialmasterOrg/Youtarr/commit/185ff04d3c81c1b524fb70a49088acb1b14b698e))
* Addressed test error and implemented code review suggestions. ([ce2315f](https://github.com/DialmasterOrg/Youtarr/commit/ce2315fd51a6407f2e63a448de8fef1dea6dd4e7))
* Better helper text for content rating setting ([9a26bbb](https://github.com/DialmasterOrg/Youtarr/commit/9a26bbb3ea6c3eb03bff86d85da8fa1792a28221))
* option for original date (year) metadata ([1c8e7d6](https://github.com/DialmasterOrg/Youtarr/commit/1c8e7d665297f06530445cc7dd58a0f89c66073b))
* Update tests to include rating field in VideoTableView and DownloadSettingsDialog ([3745388](https://github.com/DialmasterOrg/Youtarr/commit/3745388ba0f4f6ab636c5e37fa140adb0617bcd3))


### Tests

* include Channel in models mock and set https mock statusCode=200 to fix CI ([e106d14](https://github.com/DialmasterOrg/Youtarr/commit/e106d14bcf55c3f10b314f705eb0ca7bb9896324))


### Code Refactoring

* update TypeScript version and remove unused files ([2d301be](https://github.com/DialmasterOrg/Youtarr/commit/2d301be1c6964ea1aa1c9fb0e357315e9e619a0b))


### Documentation

* document backfill-ratings.js script in USAGE_GUIDE ([79e5c74](https://github.com/DialmasterOrg/Youtarr/commit/79e5c749eb398a341bdc0524810396f8642e8ca4))
* fix Vite dev server port in documentation [skip ci] ([cd49ed9](https://github.com/DialmasterOrg/Youtarr/commit/cd49ed924ef2c36d1249ab4ff7c733f1a8be31a2))
* PR guidelines / expectations CONTRIBUTING.md [skip ci] ([d404bf8](https://github.com/DialmasterOrg/Youtarr/commit/d404bf80ab6476a923cdf64ee24c24669ca6035a))
* PR guidelines / expectations CONTRIBUTING.md [skip ci] ([cce2e81](https://github.com/DialmasterOrg/Youtarr/commit/cce2e8179793091eff7049dba00a2512cf196adf))
* update CHANGELOG for v1.58.0 [skip ci] ([bc52fad](https://github.com/DialmasterOrg/Youtarr/commit/bc52fad6e4ceed59486ab63b21d89cfdbb6ccc65))





## [v1.58.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.58.0) - 2026-01-31

## [1.58.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.57.1...v1.58.0) (2026-01-31)


### Features

* add backup and restore scripts ([1efe59f](https://github.com/DialmasterOrg/Youtarr/commit/1efe59fbd4f108470aca28fd89b0f14daf60d0ff))
* add in-app yt-dlp update functionality ([8900fb9](https://github.com/DialmasterOrg/Youtarr/commit/8900fb92122e32a364d5f9e775e4927e1a72f9d2))


### Bug Fixes

* patch form-data security vuln (CVE-2025-7783) ([1830341](https://github.com/DialmasterOrg/Youtarr/commit/1830341ae06edc073f21153d793bbc2a65381605))
* use byte-based truncation for yt-dlp output templates ([#404](https://github.com/DialmasterOrg/Youtarr/issues/404)) ([09a58f9](https://github.com/DialmasterOrg/Youtarr/commit/09a58f97f80510d29d6245c27f0fc0183dd8f0b1))


### Continuous Integration

* add Claude Code review workflow for PRs ([a808618](https://github.com/DialmasterOrg/Youtarr/commit/a8086182e9ee7276e42304df2aa81ff18eda2ec0))
* Claude Code review workflow fix ([cb9a074](https://github.com/DialmasterOrg/Youtarr/commit/cb9a074f64f5b866756856a80bdd552eb08b09a4))


### Documentation

* update CHANGELOG for v1.57.1 [skip ci] ([247f063](https://github.com/DialmasterOrg/Youtarr/commit/247f063682f36f0ba8d8793580a2d33444feeb52))





## [v1.57.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.57.1) - 2026-01-30

### [1.57.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.57.0...v1.57.1) (2026-01-30)


### Bug Fixes

* exclude broken android_sdkless player client to prevent 403 errors ([ff60d21](https://github.com/DialmasterOrg/Youtarr/commit/ff60d21d0816f4aed9c48a2c0bb4ff5e38094a48)), closes [#15712](https://github.com/DialmasterOrg/Youtarr/issues/15712)
* Revert previous fix attempt for 403 ([60f7cf5](https://github.com/DialmasterOrg/Youtarr/commit/60f7cf5148d12412ab13d3cbc7e6d04ef6be7820))


### Documentation

* update CHANGELOG for v1.57.0 [skip ci] ([2898ad5](https://github.com/DialmasterOrg/Youtarr/commit/2898ad509546479deb72a7695d5de6e6db366fec))





## [v1.57.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.57.0) - 2026-01-19

## [1.57.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.56.0...v1.57.0) (2026-01-19)


### Features

* Channel videos enhancements ([b37f4e1](https://github.com/DialmasterOrg/Youtarr/commit/b37f4e1ea833ff697ecb773155ff734aae6c73f8))
* Channel videos filtering ([dcd3046](https://github.com/DialmasterOrg/Youtarr/commit/dcd30462301d2d01bdace19887ac7f56279489a2))
* **#309:** add support for mp3-only download ([dd57bbc](https://github.com/DialmasterOrg/Youtarr/commit/dd57bbc5c8371d9b82cad1eafaaf4617dac7f67d)), closes [#309](https://github.com/DialmasterOrg/Youtarr/issues/309)


### Bug Fixes

* resolve coverage badges workflow failure ([a87640d](https://github.com/DialmasterOrg/Youtarr/commit/a87640d46764cf83f98c04513984a57102f2014a))


### Documentation

* update CHANGELOG for v1.56.0 [skip ci] ([cee0c56](https://github.com/DialmasterOrg/Youtarr/commit/cee0c56e4b42aa58bdea7bd370747af69d16346e))





## [v1.56.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.56.0) - 2026-01-04

## [1.56.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.55.0...v1.56.0) (2026-01-04)


### Features

* add --dev flag to start scripts for bleeding-edge builds ([1d985c7](https://github.com/DialmasterOrg/Youtarr/commit/1d985c7d03a7051576d83b80c244bfab717cfc41))
* add API key auth to verifyToken middleware ([a0ef720](https://github.com/DialmasterOrg/Youtarr/commit/a0ef720989e47055db5e12f619fe838feafbd8b5))
* add API key routes and download endpoint ([c755f86](https://github.com/DialmasterOrg/Youtarr/commit/c755f863afa67ac52457c0235efd88a1cefffe46))
* add apiKeyModule with security features ([850ee7b](https://github.com/DialmasterOrg/Youtarr/commit/850ee7b04727beba47ff53ff600ab3fb9e48a82a))
* add ApiKeys table and model ([2346c40](https://github.com/DialmasterOrg/Youtarr/commit/2346c40d62af366e722070bd353453cba8aa490a))
* add ApiKeysSection component with bookmarklet ([72f54e5](https://github.com/DialmasterOrg/Youtarr/commit/72f54e5010ed11e0cc0cae78c477e361853e7244))
* add download source indicator for API-triggered downloads ([43ca979](https://github.com/DialmasterOrg/Youtarr/commit/43ca979834f37445cedf1bdd75d2c5e4e891e831))
* add endpoint to test individual notification webhooks ([228c3a7](https://github.com/DialmasterOrg/Youtarr/commit/228c3a71130a054946b5631b7b87c99624e6b3d4))
* add individual test buttons and rich formatting toggle for notifications ([1ba61f3](https://github.com/DialmasterOrg/Youtarr/commit/1ba61f3bc10bb58440207ea809efca258e1d8fba))
* always stage to hidden temp directory ([6010ef9](https://github.com/DialmasterOrg/Youtarr/commit/6010ef9a63640bbfec62f6c75b9b75e20322caa0))
* auto-migrate Discord webhooks to Apprise format on upgrade ([b243b2a](https://github.com/DialmasterOrg/Youtarr/commit/b243b2adb403a44ddb636854d1637905482d2a7d))
* **#349:** add changelog page to web UI ([bc8edb3](https://github.com/DialmasterOrg/Youtarr/commit/bc8edb33e0a0f7567f5798ee98b3f39766d6221f)), closes [#349](https://github.com/DialmasterOrg/Youtarr/issues/349)
* **#381:** regex examples in channel title filter ([ac7419d](https://github.com/DialmasterOrg/Youtarr/commit/ac7419d17f94dcf748e75f6ff42e14f727e24fda)), closes [#381](https://github.com/DialmasterOrg/Youtarr/issues/381)
* add logger redaction and rate limiting for API keys ([7f9934d](https://github.com/DialmasterOrg/Youtarr/commit/7f9934d0f05dbebbed9d34e0e6db0daff3f14eec))
* implement dev branch workflow with RC builds ([17b5242](https://github.com/DialmasterOrg/Youtarr/commit/17b5242e2b25e8b09ad466b04e413f6dc6d1f26f)), closes [#378](https://github.com/DialmasterOrg/Youtarr/issues/378)
* integrate ApiKeysSection in Configuration page ([7682998](https://github.com/DialmasterOrg/Youtarr/commit/7682998eaa7ab818356bd3a568da9519b381330a))
* make API keys section collapsible and add swagger docs ([67821f4](https://github.com/DialmasterOrg/Youtarr/commit/67821f4c0893282b0c5a961302e22c45f10eb14e))


### Bug Fixes

* change RC tag format from version-based to dev-rc.<sha> ([4a5dd6a](https://github.com/DialmasterOrg/Youtarr/commit/4a5dd6a9bb469859903dce09af13cf917d204781))
* correct InfoTooltip prop name ([50166ec](https://github.com/DialmasterOrg/Youtarr/commit/50166ecd07454952eedc4470a91e5d7eb549992c))
* filter dev tags from version update notification ([d06963e](https://github.com/DialmasterOrg/Youtarr/commit/d06963e9d02ced682ecca559ca8a400df4a8e240))
* make temp path test platform-agnostic ([c6ffc3c](https://github.com/DialmasterOrg/Youtarr/commit/c6ffc3c95b9207f01d60cdbe978cd04f6305c1dc))
* only log notification success when at least one succeeds ([b26feee](https://github.com/DialmasterOrg/Youtarr/commit/b26feeef73685824cb6a8a0e49cf50779b08e627))
* rate limiter IPv6 validation error ([b556bfa](https://github.com/DialmasterOrg/Youtarr/commit/b556bfafc714876506b3c5b232d13f6457629a55))
* resolve ESLint waitFor multiple assertions errors ([ccb21d7](https://github.com/DialmasterOrg/Youtarr/commit/ccb21d72152bb146740fc23b07d42d66da2e36ca))
* route Slack notifications through Apprise markdown mode ([77a3fda](https://github.com/DialmasterOrg/Youtarr/commit/77a3fda29adbaf85e7af325ca3d632bb4c926a86))
* sync frontend notification service names with backend registry ([aca08f4](https://github.com/DialmasterOrg/Youtarr/commit/aca08f4c9ebd3aadd7e7fd4a586122f675edaa12))
* theme-aware color for dark mode support ([fb7c014](https://github.com/DialmasterOrg/Youtarr/commit/fb7c014ea737986d5ab42c258c2e9ef0df2d3730))
* update notification test to match new success logging format ([74c1394](https://github.com/DialmasterOrg/Youtarr/commit/74c13949a7e3f2126664881436e125a62574343d))


### Performance Improvements

* optimize Dockerfile with multi-stage Apprise build to reduce image size ([b3f6f18](https://github.com/DialmasterOrg/Youtarr/commit/b3f6f181983467978cebc7ab6e23a952f4e4d551))


### Styles

* remove trailing whitespace in notification modules ([93fc3e3](https://github.com/DialmasterOrg/Youtarr/commit/93fc3e30898d0c6020a3bea0bf088c69f198656a))


### Tests

* add comprehensive API key security tests ([f5cb315](https://github.com/DialmasterOrg/Youtarr/commit/f5cb3159e9f69ea13498aaf2e3122db62d8082a4))
* add migration tests and update notification tests ([4e10aea](https://github.com/DialmasterOrg/Youtarr/commit/4e10aead13d4917609b3d2122e88c9a4a524154d))
* fix notification tests for refactored module ([6f7e064](https://github.com/DialmasterOrg/Youtarr/commit/6f7e0646946c3ef6d2893b641aee7894ee45a367))
* make version filter test more flexible ([3637d11](https://github.com/DialmasterOrg/Youtarr/commit/3637d11013417f3937ffecea36271437012606e0))
* update frontend tests for refactored NotificationsSection ([278c9af](https://github.com/DialmasterOrg/Youtarr/commit/278c9afaba1466aa7e536d37544eb93deb2f24ab))


### Code Refactoring

* introduce service registry pattern for notification routing ([99349ba](https://github.com/DialmasterOrg/Youtarr/commit/99349bafecc7fb895ae4cc534d44a42333fbbe47))
* remove unused getApiKey function ([1069361](https://github.com/DialmasterOrg/Youtarr/commit/106936128a6ec7aede4cee40231ece393bad7742))
* remove unused notification formatters and senders ([0ea6efd](https://github.com/DialmasterOrg/Youtarr/commit/0ea6efddcff1fe4d8214c06b95ed841a43acf6a2))
* split notification module into separate formatters and senders ([88007cb](https://github.com/DialmasterOrg/Youtarr/commit/88007cb838ab86c5a62ae47a08b307ba9134ddc6))


### Documentation

* update CHANGELOG for v1.55.0 [skip ci] ([10a9e95](https://github.com/DialmasterOrg/Youtarr/commit/10a9e95fb8d8558e999b8154ec151a4f3f4a1e37))
* update notification configuration documentation ([86b1013](https://github.com/DialmasterOrg/Youtarr/commit/86b10135bbd5c62870903e50f16332873c68abaa))
* **unraid:** add instructions for running as non-root user ([276febc](https://github.com/DialmasterOrg/Youtarr/commit/276febc05f2b097e0baba2c4bb0c404de8d88b7d))
* add API integration guide ([b4b6fa4](https://github.com/DialmasterOrg/Youtarr/commit/b4b6fa4d4172b3a5fe163a7ec04ccf0e5b10967c))
* add API key settings to CONFIG and USAGE_GUIDE ([dee27de](https://github.com/DialmasterOrg/Youtarr/commit/dee27dec3bf5bb8303bf4c3b8b5807c19409a37c))
* clarify API keys support single videos only ([7ae79b4](https://github.com/DialmasterOrg/Youtarr/commit/7ae79b447645fedfa4c2e0db936a69d54279c075))
* update CONTRIBUTING.md and DEVELOPMENT.md for dev branch workflow ([4ff0f47](https://github.com/DialmasterOrg/Youtarr/commit/4ff0f47268bd8e1644826b8de08a8080333b29f7))





## [v1.55.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.55.0) - 2025-12-10

## [1.55.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.54.1...v1.55.0) (2025-12-10)


### Features

* add swagger-jsdoc and swagger-ui-express dependencies ([8a23f4f](https://github.com/DialmasterOrg/Youtarr/commit/8a23f4fa889d0f7c75e41a7c14fb3640f8cb635a))
* add Swagger/OpenAPI configuration with API documentation ([70d2613](https://github.com/DialmasterOrg/Youtarr/commit/70d26136ea1978ef1b35f8c7b2ac439d8a8c7dae))
* **#287:** subfolder enhance / optimize perf ([81a0a03](https://github.com/DialmasterOrg/Youtarr/commit/81a0a03a0ea1f7411c494ecea8125f845ea719eb)), closes [#287](https://github.com/DialmasterOrg/Youtarr/issues/287)


### Bug Fixes

* **ci:** move coverage comment to separate workflow for fork PR support ([04658f5](https://github.com/DialmasterOrg/Youtarr/commit/04658f5d49357aef4f3645b44442aefc1477f9cb))
* auto-detect ARM architecture for MariaDB volume configuration ([ef8974d](https://github.com/DialmasterOrg/Youtarr/commit/ef8974dcccb2d199abdb9cac820a55e5effc8832))


### Tests

* update backend tests for modular route structure ([6389d6b](https://github.com/DialmasterOrg/Youtarr/commit/6389d6b3df78a12ec93da7d97619ddf3d74dd002))


### Code Refactoring

* extract API routes into modular route files ([16b7faf](https://github.com/DialmasterOrg/Youtarr/commit/16b7faf6e9a87e73e8139948874db8e388eac481))
* update server.js to use modular route system ([c776022](https://github.com/DialmasterOrg/Youtarr/commit/c7760229614097f4ca29091276e1feb36da8e80c))


### Documentation

* add ARM architecture guidance for manual docker compose users ([956bebc](https://github.com/DialmasterOrg/Youtarr/commit/956bebccf87b388d232da4d30df7ccc9f47afdb9))
* add contributors page ([0459771](https://github.com/DialmasterOrg/Youtarr/commit/04597714e05a0b8f2c6bc4f08e4dddebd5e877c4))
* Add link to Patreon ([07ca0ed](https://github.com/DialmasterOrg/Youtarr/commit/07ca0ed937284f8430e2be1800015c306f27ce79))
* update CHANGELOG for v1.54.1 [skip ci] ([be3f89e](https://github.com/DialmasterOrg/Youtarr/commit/be3f89e1b3d2ebc97307fd27a9abe286942b8387))





## [v1.54.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.54.1) - 2025-11-24

### [1.54.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.54.0...v1.54.1) (2025-11-24)


### Bug Fixes

* **downloads:** special chars in channel names ([a4c2276](https://github.com/DialmasterOrg/Youtarr/commit/a4c2276c9d46d8390b848789c4a92ae873f6ca34))


### Documentation

* update CHANGELOG for v1.54.0 [skip ci] ([ca3beb7](https://github.com/DialmasterOrg/Youtarr/commit/ca3beb778815fa6fd7e83ac3ae87ac87c324eddf))





## [v1.54.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.54.0) - 2025-11-24

## [1.54.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.53.2...v1.54.0) (2025-11-24)


### Features

* **channels:** add pagination/sort/filtering to Your Channels ([ed2406c](https://github.com/DialmasterOrg/Youtarr/commit/ed2406cff2e90f262a01f5af073ab496743f1a57))


### Documentation

* update CHANGELOG for v1.53.2 [skip ci] ([1a30714](https://github.com/DialmasterOrg/Youtarr/commit/1a30714cd6b3a0003e846cf2e9e2a5d2af490198))





## [v1.53.2](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.53.2) - 2025-11-22

### [1.53.2](https://github.com/DialmasterOrg/Youtarr/compare/vv1.53.1...v1.53.2) (2025-11-22)


### Bug Fixes

* improve database resilience and platform compatibility ([974c743](https://github.com/DialmasterOrg/Youtarr/commit/974c7433859cd552a997fa10bbf91ac7c17b482b))
* **db:** resolve custom user auth issues and improve config clarity ([21b7ada](https://github.com/DialmasterOrg/Youtarr/commit/21b7adac2779608ec0c68231a7be5f9f8bf05eac))


### Documentation

* major documentation restructure ([0bc28b6](https://github.com/DialmasterOrg/Youtarr/commit/0bc28b67cc071c154d56b51f04f2c93b1bab926a))
* update CHANGELOG for v1.53.1 [skip ci] ([aa3c2a6](https://github.com/DialmasterOrg/Youtarr/commit/aa3c2a6d5037e677d651d3ab06d5df1eb45e9897))





## [v1.53.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.53.1) - 2025-11-19

### [1.53.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.53.0...v1.53.1) (2025-11-19)


### Bug Fixes

* increase video validation timeout from 10s to 60s ([d5d074c](https://github.com/DialmasterOrg/Youtarr/commit/d5d074c932054dce04a8281eddaee1fc66180207))


### Documentation

* update CHANGELOG for v1.53.0 [skip ci] ([66395f6](https://github.com/DialmasterOrg/Youtarr/commit/66395f6dde6019e74a1d60b0c53caeb53534e1da))





## [v1.53.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.53.0) - 2025-11-19

## [1.53.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.52.0...v1.53.0) (2025-11-19)


### Features

* add ARM64 multi-architecture Docker image support ([729384d](https://github.com/DialmasterOrg/Youtarr/commit/729384d22ca49baa40e7289a38f54eddb48e7270))


### Bug Fixes

* add crossorigin attribute to manifest link to prevent CORS warnings ([49fd64b](https://github.com/DialmasterOrg/Youtarr/commit/49fd64b238363496881b734d52bf6129f66bc20c))
* Channel List styling ([9154773](https://github.com/DialmasterOrg/Youtarr/commit/915477324c27ca6f335f158e8c30c4caa6674a03))


### Documentation

* add Apple Silicon troubleshooting for MariaDB virtiofs corruption ([b566139](https://github.com/DialmasterOrg/Youtarr/commit/b566139fe364fc654ebbe57ab0f6e2c52b9fe4de))
* update CHANGELOG for v1.52.0 [skip ci] ([9cfffb7](https://github.com/DialmasterOrg/Youtarr/commit/9cfffb70d7797a20387b8d94b1a292f7482e05ac))





## [v1.52.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.52.0) - 2025-11-15

## [1.52.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.51.1...v1.52.0) (2025-11-15)


### Features

* add dark mode theme support with toggle in configuration ([2a4cf68](https://github.com/DialmasterOrg/Youtarr/commit/2a4cf681cb5651dee538ed08bcd48ab7ab9d49b2))


### Documentation

* update CHANGELOG for v1.51.1 [skip ci] ([c3efa2d](https://github.com/DialmasterOrg/Youtarr/commit/c3efa2d02c16e905ca393ef72cf176dfa8f5764a))





## [v1.51.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.51.1) - 2025-11-15

### [1.51.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.51.0...v1.51.1) (2025-11-15)


### Bug Fixes

* relocate config.example.json to /app/server for Elfhosted compatibility ([0db5ade](https://github.com/DialmasterOrg/Youtarr/commit/0db5adeb78fd3dafd57ef60e5b462be6138e0686))


### Documentation

* update CHANGELOG for v1.51.0 [skip ci] ([0182737](https://github.com/DialmasterOrg/Youtarr/commit/01827370268c5ccc64ba81d412a92b242874f219))





## [v1.51.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.51.0) - 2025-11-15

## [1.51.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.50.1...v1.51.0) (2025-11-15)


### Features

* add advanced settings section with proxy and rate limiting ([21c4a01](https://github.com/DialmasterOrg/Youtarr/commit/21c4a01be541b2fc677507357240d8215d9f43f1))
* surface yt-dlp version and normalize rate-limit IP ([b94cd6a](https://github.com/DialmasterOrg/Youtarr/commit/b94cd6a74dd9e98fdd89938f5f6990bc0b54bd57))


### Code Refactoring

* Configuration ([8e41f97](https://github.com/DialmasterOrg/Youtarr/commit/8e41f97ba0bf45a9f26097beb1ddb1b02b843697))


### Documentation

* update CHANGELOG for v1.50.1 [skip ci] ([dd19493](https://github.com/DialmasterOrg/Youtarr/commit/dd194936cee8340b8142cd4aff926ed90ca4fd01))





## [v1.50.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.50.1) - 2025-11-13

### [1.50.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.50.0...v1.50.1) (2025-11-13)


### Bug Fixes

* terminated download history and Channel UI ([748d46e](https://github.com/DialmasterOrg/Youtarr/commit/748d46ed0082c9a43b7f3d1a5b443552b0aa16a3))


### Documentation

* improve AUTH_PRESET credential documentation and validation feedback ([b372829](https://github.com/DialmasterOrg/Youtarr/commit/b3728297fe1755c29fb6d1cbbb1e1be0540ad91e))
* update CHANGELOG for v1.50.0 [skip ci] ([e823431](https://github.com/DialmasterOrg/Youtarr/commit/e823431a25bc6a8e5ce6dbb00f16b8c6c6568bfa))





## [v1.50.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.50.0) - 2025-11-11

## [1.50.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.49.1...v1.50.0) (2025-11-11)


### Features

* add HTTPS support for Plex server connections ([30e5b75](https://github.com/DialmasterOrg/Youtarr/commit/30e5b7510dcba95a91c58c7d980b56a6eddd9d90))
* improve update instructions and add colorized console output ([99187b6](https://github.com/DialmasterOrg/Youtarr/commit/99187b616ffb6b5eade16de0eb72875e77155ecd))


### Documentation

* update CHANGELOG for v1.49.1 [skip ci] ([b2d8db0](https://github.com/DialmasterOrg/Youtarr/commit/b2d8db08cc802128515b704b0adedcd9ec4fcb87))





## [v1.49.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.49.1) - 2025-11-10

### [1.49.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.49.0...v1.49.1) (2025-11-10)


### Bug Fixes

* Fix for yt-dlp temp directory behavior on elfhosted ([d2f68a4](https://github.com/DialmasterOrg/Youtarr/commit/d2f68a4863480309978c1c25ea5603cab43a9f47))
* Set TMPDIR for all yt-dlp invocations ([dfee084](https://github.com/DialmasterOrg/Youtarr/commit/dfee084cd732c8a95c26668b5831be343d16bf8a))


### Documentation

* update CHANGELOG for v1.49.0 [skip ci] ([8e18cda](https://github.com/DialmasterOrg/Youtarr/commit/8e18cda81ef38131187b0b10140b64264436a0b2))





## [v1.49.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.49.0) - 2025-11-10

## [1.49.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.48.0...v1.49.0) (2025-11-10)


### Features

* add database health check and error overlay ([935b181](https://github.com/DialmasterOrg/Youtarr/commit/935b181104bf734204f543535340658c570aa35c))
* enhance database error handling with auto-recovery and improved UX ([1c37193](https://github.com/DialmasterOrg/Youtarr/commit/1c37193ab00dadfa9d13e3cfaff67689b1eb9424))


### Bug Fixes

* Use canonical channel thumbs part 2 ([58930ee](https://github.com/DialmasterOrg/Youtarr/commit/58930ee9e071fe2937a88923d6e7b0a8ac42d7e2))
* Use canonical YT URL for channel video thumbs ([339e52c](https://github.com/DialmasterOrg/Youtarr/commit/339e52c3e1281e72e8bd8c2fdcbd66f2f707a7bb))


### Code Refactoring

* startup scripts, infra, documentation ([b02316f](https://github.com/DialmasterOrg/Youtarr/commit/b02316fbf880481cfd58c408df7266b947089273))


### Documentation

* improve Docker Compose installation documentation ([690dba6](https://github.com/DialmasterOrg/Youtarr/commit/690dba6ac00d200cf68421af947d1ae2fca07788))
* streamline development documentation and remove deprecated scripts ([cf2418a](https://github.com/DialmasterOrg/Youtarr/commit/cf2418ad13093f07d1f1ce259cbaadbee7329522))
* update CHANGELOG for v1.48.0 [skip ci] ([e9ca9dc](https://github.com/DialmasterOrg/Youtarr/commit/e9ca9dc0c3bd19c9d0d65845dc4e413fdb45f54f))





## [v1.48.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.48.0) - 2025-11-05

## [1.48.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.47.1...v1.48.0) (2025-11-05)


### Features

* add ignore flag for channel videos to prevent auto-downloads ([8573795](https://github.com/DialmasterOrg/Youtarr/commit/85737952fcd34b43f79020f9139dc7ab78b3806d))


### Bug Fixes

* prevent page reload when toggling video ignore status ([e7b1679](https://github.com/DialmasterOrg/Youtarr/commit/e7b1679d909e2c537d2568220b120cb5d920ba77))


### Documentation

* update CHANGELOG for v1.47.1 [skip ci] ([9fc9197](https://github.com/DialmasterOrg/Youtarr/commit/9fc9197b361c549f2e1c6fba3197d247dc41dd08))





## [v1.47.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.47.1) - 2025-11-04

### [1.47.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.47.0...v1.47.1) (2025-11-04)


### Bug Fixes

* prevent timeout during long video post-processing operations ([3678372](https://github.com/DialmasterOrg/Youtarr/commit/3678372ac998620f0d3acd0c62afabe87d8290f4))


### Documentation

* add Synology NAS installation guide ([9d92498](https://github.com/DialmasterOrg/Youtarr/commit/9d924985c1006b447c4ffdfbd0facb301d0fe121))
* Remove time references ([cdb560f](https://github.com/DialmasterOrg/Youtarr/commit/cdb560f8f7279ab2031c853f2de1589eacd91f52))
* update CHANGELOG for v1.47.0 [skip ci] ([c347b73](https://github.com/DialmasterOrg/Youtarr/commit/c347b739d35592e85006cdd0cb0a0c9aed0c03fc))





## [v1.47.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.47.0) - 2025-11-03

## [1.47.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.46.2...v1.47.0) (2025-11-03)


### Features

* add channel download filters with duration and regex support ([a4996e1](https://github.com/DialmasterOrg/Youtarr/commit/a4996e1d4dccfef4e350d5507a2078ab654f5414))
* add filter indicators to channel manager and channel page UI ([71c15a6](https://github.com/DialmasterOrg/Youtarr/commit/71c15a605bcd51c9e93345deef170e9298a0e455))


### Bug Fixes

* Channel settings text for MB ([f41869c](https://github.com/DialmasterOrg/Youtarr/commit/f41869cf6dbbb58be8325267faa47132ca2bc29e))


### Documentation

* remove migrations volume mount references and improve Docker setup docs ([f94c8d0](https://github.com/DialmasterOrg/Youtarr/commit/f94c8d04439e580f9b822217b267a3e5ebbd6e2d))
* update CHANGELOG for v1.46.2 [skip ci] ([8084df4](https://github.com/DialmasterOrg/Youtarr/commit/8084df489f72104af834c649703aedfb7401ece4))





## [v1.46.2](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.46.2) - 2025-11-02

### [1.46.2](https://github.com/DialmasterOrg/Youtarr/compare/vv1.46.1...v1.46.2) (2025-11-02)


### Bug Fixes

* display current channel name during grouped channel downloads ([81a03a3](https://github.com/DialmasterOrg/Youtarr/commit/81a03a3662294452edff9ccfe08c0c089f2925bf))
* ensure all videos from multi-group downloads are persisted and displayed correctly ([4372305](https://github.com/DialmasterOrg/Youtarr/commit/43723057da7cd5e9a7fe0f05cbed910d8891b4e1))
* ensure database updates complete and job history shows all videos ([0ac02fa](https://github.com/DialmasterOrg/Youtarr/commit/0ac02fa5695904ad7fb62609dc97f1884651cbeb))
* persist manual download videos to database before job completion ([26f3abc](https://github.com/DialmasterOrg/Youtarr/commit/26f3abcf7f8db390c8180838f2c7de511265f051))
* prevent premature job completion in multi-group downloads ([4f33e34](https://github.com/DialmasterOrg/Youtarr/commit/4f33e34b6332b9a748120a84471bd61a0254233a))
* update channel sub_folder in database before file operations ([18a8f82](https://github.com/DialmasterOrg/Youtarr/commit/18a8f825c37e93642e130490344dc5d1b56e0515))
* **docker:** remove migrations volume mount from production compose files ([f9aa22b](https://github.com/DialmasterOrg/Youtarr/commit/f9aa22b14d456999dbcd3db3b230813fc08a3e75))


### Documentation

* update CHANGELOG for v1.46.0 [skip ci] ([0f4e0c1](https://github.com/DialmasterOrg/Youtarr/commit/0f4e0c1d867bba7ff60f029cad78cd6caba8a800))
* update CHANGELOG for v1.46.1 [skip ci] ([5111eee](https://github.com/DialmasterOrg/Youtarr/commit/5111eeee29ad66ee0d00607e9893692e5308b3c8))
* **docker:** remove migrations volume and add critical warning ([f34a3fd](https://github.com/DialmasterOrg/Youtarr/commit/f34a3fdc602634fbf8791bae7e7fe4cdf663c197))





## [v1.46.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.46.1) - 2025-11-01

### [1.46.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.46.0...v1.46.1) (2025-11-01)





## [v1.46.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.46.0) - 2025-10-30

## [1.46.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.45.1...v1.46.0) (2025-10-30)


### Features

* use video filename for video posters instead of generic poster.jpg ([c779e03](https://github.com/DialmasterOrg/Youtarr/commit/c779e0369e0a3c4fbdb830cf852a4a4b0cc639c7))


### Bug Fixes

* prevent stuck pending jobs blocking download queue ([c69ea6e](https://github.com/DialmasterOrg/Youtarr/commit/c69ea6e10afbec87c2cf2fb5615b54b13c7459f7))


### Documentation

* update CHANGELOG for v1.45.1 [skip ci] ([20c3b4a](https://github.com/DialmasterOrg/Youtarr/commit/20c3b4aa65fd086a881c09238622dbb5ebb7dc3e))





## [v1.45.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.45.1) - 2025-10-26

### [1.45.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.45.0...v1.45.1) (2025-10-26)


### Bug Fixes

* **#120:** fix download history for channel downloads ([f82a15c](https://github.com/DialmasterOrg/Youtarr/commit/f82a15cb62993ca0eb8f85f76b64b0787746f5fa))


### Documentation

* update CHANGELOG for v1.45.0 [skip ci] ([be51d54](https://github.com/DialmasterOrg/Youtarr/commit/be51d548a5d4471f7179c5537814cc9d3adb25f2))





## [v1.45.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.45.0) - 2025-10-26

## [1.45.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.44.0...v1.45.0) (2025-10-26)


### Features

* **#120:** channel level overrides WIP... ([3095632](https://github.com/DialmasterOrg/Youtarr/commit/309563210b5a759cbd55388c841710af55e5ab4f)), closes [#120](https://github.com/DialmasterOrg/Youtarr/issues/120)
* **#120:** sync channel settings updates and honor queued override settings ([c0ae2f8](https://github.com/DialmasterOrg/Youtarr/commit/c0ae2f8bfedfbeb51f37dd7dc79f2b71dc66f0e0)), closes [#120](https://github.com/DialmasterOrg/Youtarr/issues/120)


### Documentation

* update CHANGELOG for v1.44.0 [skip ci] ([0c7b34b](https://github.com/DialmasterOrg/Youtarr/commit/0c7b34bd9e1e8ceb1e52d426872d107086569530))
* **#120:** document channel-level configuration overrides ([2878a2d](https://github.com/DialmasterOrg/Youtarr/commit/2878a2d2d7615fc156ea06ad7614c9d0864f228b)), closes [#120](https://github.com/DialmasterOrg/Youtarr/issues/120)





## [v1.44.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.44.0) - 2025-10-22

## [1.44.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.43.0...v1.44.0) (2025-10-22)


### Features

* **downloads:** show 403 errors in UI + new yt-dlp ([43f450e](https://github.com/DialmasterOrg/Youtarr/commit/43f450e360ead51d6055160bf0e165227ac38c58))


### Performance Improvements

* **downloads:** throttle websocket progress updates to reduce overhead ([08b5833](https://github.com/DialmasterOrg/Youtarr/commit/08b5833a307330a366a6a8817104e24988f1d1fb))


### Documentation

* update CHANGELOG for v1.43.0 [skip ci] ([cd23bb9](https://github.com/DialmasterOrg/Youtarr/commit/cd23bb92f478f7ec37b07469960e2f265ac73548))





## [v1.43.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.43.0) - 2025-10-18

## [1.43.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.42.2...v1.43.0) (2025-10-18)


### Features

* adopt structured logging with pino for backend ([36acfe2](https://github.com/DialmasterOrg/Youtarr/commit/36acfe2ce0e3de3ce4e4a2ae345daf11657a8fcf))
* **subtitles:** add subtitle download support and fix filename handling ([149cb0b](https://github.com/DialmasterOrg/Youtarr/commit/149cb0bd4c5ddac4a2f182f0b3ef5a127bd33970)), closes [#243](https://github.com/DialmasterOrg/Youtarr/issues/243)


### Bug Fixes

* improve ffmpeg thumbnail processing quality and logging ([c76e02f](https://github.com/DialmasterOrg/Youtarr/commit/c76e02fb75543c1b4eb4613592167a262b4e154e))


### Documentation

* update CHANGELOG for v1.42.2 [skip ci] ([b265452](https://github.com/DialmasterOrg/Youtarr/commit/b26545278f931d7c21e7788ff591b9a7a3d73adb))





## [v1.42.2](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.42.2) - 2025-10-12

### [1.42.2](https://github.com/DialmasterOrg/Youtarr/compare/vv1.42.1...v1.42.2) (2025-10-12)


### Bug Fixes

* improve loading message clarity during video fetching ([d4a4e62](https://github.com/DialmasterOrg/Youtarr/commit/d4a4e62f0e0220bc9c2d22a1b9a30ae51fa70e12))
* prevent downloads of live streaming videos ([42b79d5](https://github.com/DialmasterOrg/Youtarr/commit/42b79d5d05d8606f0605758af8bb272950ddfc68))


### Documentation

* clarify docker compose environment variable requirements ([c42512d](https://github.com/DialmasterOrg/Youtarr/commit/c42512d9b482e8b7f9cd9d249cfc081501178199))
* update CHANGELOG for v1.42.1 [skip ci] ([f5f75d4](https://github.com/DialmasterOrg/Youtarr/commit/f5f75d47527f5e7de8cb7949c17b3e9b67380f33))





## [v1.42.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.42.1) - 2025-10-12

### [1.42.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.42.0...v1.42.1) (2025-10-12)


### Bug Fixes

* prevent infinite loop in config file watcher ([edbc1ba](https://github.com/DialmasterOrg/Youtarr/commit/edbc1ba8d7b05b203a765da318cc7711cff192c2))
* refine ChannelVideos UI for better desktop/mobile experience ([011517f](https://github.com/DialmasterOrg/Youtarr/commit/011517f58c8770d4f0fcdf6ac054be4468c36fdf))


### Documentation

* update CHANGELOG for v1.42.0 [skip ci] ([dfbfbbd](https://github.com/DialmasterOrg/Youtarr/commit/dfbfbbdde6db7c4a2bb691b6a2346a1fdd7270cb))





## [v1.42.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.42.0) - 2025-10-11

## [1.42.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.41.0...v1.42.0) (2025-10-11)


### Features

* add temp directory download processing with Elfhosted platform support ([f000dbe](https://github.com/DialmasterOrg/Youtarr/commit/f000dbea602c8bb764466d1d538ab1e0c65f05a9))


### Bug Fixes

* replace lastFetched with per-tab lastFetchedByTab tracking ([e0485fe](https://github.com/DialmasterOrg/Youtarr/commit/e0485fe43ebd0b3e9ebab555228a15ef7e1f172f))


### Documentation

* update CHANGELOG for v1.41.0 [skip ci] ([a21d892](https://github.com/DialmasterOrg/Youtarr/commit/a21d892c335fbdc53bb5eba47c1c8f2cfa0bac0c))





## [v1.41.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.41.0) - 2025-10-11

## [1.41.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.40.0...v1.41.0) (2025-10-11)


### Features

* implement job termination cleanup and video recovery ([f5e41cf](https://github.com/DialmasterOrg/Youtarr/commit/f5e41cf0f62e5031bdecd0c14dc9d922e57c39b2))


### Bug Fixes

* resolve channel addition failure when only shorts tab exists ([3c7f970](https://github.com/DialmasterOrg/Youtarr/commit/3c7f9704288d36afc71c0c23f376629af077915c))


### Tests

* update channelModule tests for recent API changes ([9844a97](https://github.com/DialmasterOrg/Youtarr/commit/9844a97b6570c7685b88b9f390016d765d46d02b))


### Documentation

* update CHANGELOG for v1.40.0 [skip ci] ([f8ff819](https://github.com/DialmasterOrg/Youtarr/commit/f8ff8198d5433000de782e6d7d7b78cd035cfe3b))





## [v1.40.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.40.0) - 2025-10-09

## [1.40.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.39.1...v1.40.0) (2025-10-09)


### Features

* add job termination and improve channel page loading states ([c0a0dd4](https://github.com/DialmasterOrg/Youtarr/commit/c0a0dd41938145db0ac8b199d0ccc53cd53d22a5))
* add queued jobs visibility to download progress ([4633894](https://github.com/DialmasterOrg/Youtarr/commit/46338947d36afbc8b5e846a7965a95d2ff64d67c))


### Bug Fixes

* ensure channelvideos publishedAt always reflects YouTube sort order ([6862900](https://github.com/DialmasterOrg/Youtarr/commit/6862900613b00020cad98d0a6b3c8a0bed154999))
* ensure ETA remains visible on mobile in download progress ([f8e8358](https://github.com/DialmasterOrg/Youtarr/commit/f8e83589e77d447bdb03c04aebc0d4ae96fb3139))


### Documentation

* update CHANGELOG for v1.39.1 [skip ci] ([69259de](https://github.com/DialmasterOrg/Youtarr/commit/69259debae98736f38ee84a69ffb7b9a9d71ddba))





## [v1.39.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.39.1) - 2025-10-09

### [1.39.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.39.0...v1.39.1) (2025-10-09)


### Bug Fixes

* prevent overlapping channel downloads and improve ETA display ([2f53786](https://github.com/DialmasterOrg/Youtarr/commit/2f5378694d8b470290805704ca43d594e8ca7794))


### Documentation

* update CHANGELOG for v1.39.0 [skip ci] ([05605fd](https://github.com/DialmasterOrg/Youtarr/commit/05605fdbd54633bfa5fb87cb591e99fe8e45a48e))





## [v1.39.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.39.0) - 2025-10-08

## [1.39.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.38.0...v1.39.0) (2025-10-08)


### Features

* add support for downloading shorts and live streams from YouTube channels ([c020e0b](https://github.com/DialmasterOrg/Youtarr/commit/c020e0b4533459ed143119e1f59a1dc0a5a2b26e))
* handle missing and approximate publish dates ([a0b4708](https://github.com/DialmasterOrg/Youtarr/commit/a0b4708d2ba6cc73560c88389de30c2002b0672b))


### Code Refactoring

* Break up ChannelVideos into more maintainable structure ([6de14a7](https://github.com/DialmasterOrg/Youtarr/commit/6de14a7d7d323eddbcaeaa1015939ad8407c49de))


### Documentation

* update CHANGELOG for v1.38.0 [skip ci] ([695dc98](https://github.com/DialmasterOrg/Youtarr/commit/695dc98e97c26e394981e511bbbea6d3b3ad341b))
* Update Readme for live/shorts support ([9a409f5](https://github.com/DialmasterOrg/Youtarr/commit/9a409f51d9a6b1cd4d9fc05440153c4630bca560))





## [v1.38.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.38.0) - 2025-10-06

## [1.38.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.37.0...v1.38.0) (2025-10-06)


### Features

* add automatic video removal with dry-run preview ([fb16aea](https://github.com/DialmasterOrg/Youtarr/commit/fb16aeab59dcec73e04885212c8bb2434ea43535))
* add video codec preference configuration ([08661fb](https://github.com/DialmasterOrg/Youtarr/commit/08661fbb0d7bdbb81c77c0d89ab3436e4a11fe88))
* add video deletion functionality to channel page ([2300f1c](https://github.com/DialmasterOrg/Youtarr/commit/2300f1cadebc0b9805d8e311ee304f4118807756))
* standardize health checks with curl and update endpoint path ([e5b243d](https://github.com/DialmasterOrg/Youtarr/commit/e5b243d102d36e4392367c68e1d5d30ce1eef1e7))


### Bug Fixes

* newly uploaded videos get last_downloaded_at ([5cb5fb8](https://github.com/DialmasterOrg/Youtarr/commit/5cb5fb8a19035e92ba2ec2e224735dd6a1096f76))


### Tests

* speed up Configuration component tests ([77be651](https://github.com/DialmasterOrg/Youtarr/commit/77be65154f6381540ca4b298a7377bd917e2b375))


### Documentation

* update CHANGELOG for v1.37.0 [skip ci] ([e87427c](https://github.com/DialmasterOrg/Youtarr/commit/e87427cbccd2a19e9419c37c80e23f3796d2a5ad))
* Update documentation for Unraid ([e0eeb67](https://github.com/DialmasterOrg/Youtarr/commit/e0eeb67dac121f68170c8987d6dce914bd48edb4))
* Update documentation for video removal ([d540ac2](https://github.com/DialmasterOrg/Youtarr/commit/d540ac2a4dd50336b13dd8730bc3489aabfc6aa9))





## [v1.37.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.37.0) - 2025-10-04

## [1.37.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.36.0...v1.37.0) (2025-10-04)


### Features

* bootstrap admin credentials from AUTH_PRESET env vars ([3ff5988](https://github.com/DialmasterOrg/Youtarr/commit/3ff598819ddbb0b86f78fd69842b00cc0199287b))


### Documentation

* update CHANGELOG for v1.36.0 [skip ci] ([37581eb](https://github.com/DialmasterOrg/Youtarr/commit/37581eb26abac8ae2eb198d3cf3c3414f0472d4d))





## [v1.36.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.36.0) - 2025-10-04

## [1.36.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.35.0...v1.36.0) (2025-10-04)


### Features

* add external database support with helper scripts and documentation ([4173099](https://github.com/DialmasterOrg/Youtarr/commit/41730995f3f097cb9a38851dec73f26cf6de66e2))
* include migrations in Docker image for UNRAID support ([ae6abaf](https://github.com/DialmasterOrg/Youtarr/commit/ae6abaff08ad597e9c56c2d7fe4dec4326e7e76b))


### Documentation

* update CHANGELOG for v1.35.0 [skip ci] ([6643127](https://github.com/DialmasterOrg/Youtarr/commit/6643127f00a1b7e95fc9b40bda10593369fd7d35))





## [v1.35.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.35.0) - 2025-10-04

## [1.35.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.34.0...v1.35.0) (2025-10-04)


### Features

* add --no-auth flag ([5e12a17](https://github.com/DialmasterOrg/Youtarr/commit/5e12a17ee70be331967854fec309bed4fd12cb75))
* add Discord notifications for new video downloads ([974202e](https://github.com/DialmasterOrg/Youtarr/commit/974202e68e996232a5b86a335bee3868e0823157))
* support YouTube live stream URL format ([5a70eaf](https://github.com/DialmasterOrg/Youtarr/commit/5a70eaf4def1c8da8bb9e67513b83abdcb525243))
* track video download timestamps and improve metadata ([a409879](https://github.com/DialmasterOrg/Youtarr/commit/a409879dcde88f57ce7b2d6be2dad30705af2847))


### Documentation

* update CHANGELOG for v1.34.0 [skip ci] ([45b3507](https://github.com/DialmasterOrg/Youtarr/commit/45b35079bc543fd397b81a90598435af8865a716))





## [v1.34.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.34.0) - 2025-10-03

## [1.34.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.33.0...v1.34.0) (2025-10-03)


### Features

* add media_type and youtube_removed fields to video tracking ([516809f](https://github.com/DialmasterOrg/Youtarr/commit/516809fd7e8eb6047d0809ad3c1a0307e226c042))
* display media type badges on channelvideos ([2cfaf7c](https://github.com/DialmasterOrg/Youtarr/commit/2cfaf7cdd15a83e2ab96a183a8db1bda4fbaeeab))
* surface removed YouTube status and media types ([c8d003a](https://github.com/DialmasterOrg/Youtarr/commit/c8d003ac2dd850d8e259e7a23cc2cc4f268e0d82))


### Bug Fixes

* apply local thumbnail fallback to all YouTube-removed videos ([fe48162](https://github.com/DialmasterOrg/Youtarr/commit/fe48162810d0cc006ba6ef197c6f82e9c6852d2d))
* private videos and small UI issue ([fbb8fb6](https://github.com/DialmasterOrg/Youtarr/commit/fbb8fb6112edefd1c13ad194388af7779da770c6))
* remove auto-scroll when changing pagination pages ([e2bca11](https://github.com/DialmasterOrg/Youtarr/commit/e2bca11891b007bedcf8032a7d84ae5b5d0cdd65))
* upgrade axios to 1.12.0 to resolve security vulnerabilities ([dbc3f40](https://github.com/DialmasterOrg/Youtarr/commit/dbc3f4080d95125afa5b1311f00e65d52cbb261c)), closes [#85](https://github.com/DialmasterOrg/Youtarr/issues/85) [#69](https://github.com/DialmasterOrg/Youtarr/issues/69)


### Tests

* fix password mismatch test timeout in CI ([f4352c6](https://github.com/DialmasterOrg/Youtarr/commit/f4352c6e034e1e13438eff88a4077f4f24bef442))
* Fix tests failing only in CICD ([3f80332](https://github.com/DialmasterOrg/Youtarr/commit/3f80332b82bd2d6096becc647cdf20307567dc6c))


### Documentation

* update CHANGELOG for v1.33.0 [skip ci] ([dc6884b](https://github.com/DialmasterOrg/Youtarr/commit/dc6884bf3192ad6dd1a588dff0f9e215fcfb8d68))





## [v1.33.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.33.0) - 2025-10-01

## [1.33.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.32.0...v1.33.0) (2025-10-01)


### Features

* add compact list view and always-visible pagination for mobile ([f7bd856](https://github.com/DialmasterOrg/Youtarr/commit/f7bd85602f7b04019a5ac145ac08abad33bd143a))
* enchanced videos page with grid view and server-side pagination ([4d89541](https://github.com/DialmasterOrg/Youtarr/commit/4d8954115800f7b99e1fa2c23943311fe47ee43a))


### Bug Fixes

* remove duration filter from yt-dlp command ([555fbb3](https://github.com/DialmasterOrg/Youtarr/commit/555fbb3f6cf4c90e3c33f3beef3132541f37f119))


### Tests

* fix timing issue in password mismatch validation test ([7e40fba](https://github.com/DialmasterOrg/Youtarr/commit/7e40fbafcc41388e9c9f52e644bd9b37fbc2f71a))


### Documentation

* update CHANGELOG for v1.32.0 [skip ci] ([3732f89](https://github.com/DialmasterOrg/Youtarr/commit/3732f89463baaa57b2393238ca7150193c68ecc1))
* Update README [skip ci] ([40fe088](https://github.com/DialmasterOrg/Youtarr/commit/40fe088e1c82b55424efd8272119359fa15e7566))





## [v1.32.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.32.0) - 2025-09-28

## [1.32.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.31.0...v1.32.0) (2025-09-28)


### Features

* add channel search functionality to videos page filter menu ([1c9a385](https://github.com/DialmasterOrg/Youtarr/commit/1c9a385dd3726153a6346aa02fb8370dbf9569e4))
* add default resolution fetching to channel videos page ([81a118e](https://github.com/DialmasterOrg/Youtarr/commit/81a118e41c0d4d9d29903810eb6fcfa5cdd63187))
* improve manual download UX with better previously-downloaded video handling ([eee2964](https://github.com/DialmasterOrg/Youtarr/commit/eee29646b0c0bafd043e0a53ff3aac8f2bb6604e))
* video related enhancements ([e3cc418](https://github.com/DialmasterOrg/Youtarr/commit/e3cc41889fabdf3900842f60ddc58d9fdfb256ce))


### Bug Fixes

* improve database connection pooling and file metadata backfill reliability ([ead286e](https://github.com/DialmasterOrg/Youtarr/commit/ead286eb7cd852662a6bc666afa25556696cc6d0))
* improve video file detection with recursive subdirectory scanning ([fcef079](https://github.com/DialmasterOrg/Youtarr/commit/fcef0795c708393fee5aac53901d5e3e03d50493))
* remove spurious 0 rendering in video thumbnails ([49ce770](https://github.com/DialmasterOrg/Youtarr/commit/49ce7709d6ea8f1f04e11be893f46f140c2398c2))
* resolve video file path mismatches for special characters and timing issues ([e03e9b2](https://github.com/DialmasterOrg/Youtarr/commit/e03e9b26b778cf4bfdb0ce1a055871a872a72c59))
* use parameterized queries for video metadata updates to handle Unicode paths ([ef5f442](https://github.com/DialmasterOrg/Youtarr/commit/ef5f4429069f20d58638816d58b14aec669a22a4))


### Tests

* add unit tests for videoFileLocator module ([612ace1](https://github.com/DialmasterOrg/Youtarr/commit/612ace19ec8f69805e949a35d6ba2613417af173))


### Documentation

* update CHANGELOG for v1.31.0 [skip ci] ([89f5708](https://github.com/DialmasterOrg/Youtarr/commit/89f5708b66af3a6e628b984733272282251ac700))
* Update README.md [skip ci] ([7915689](https://github.com/DialmasterOrg/Youtarr/commit/791568965ac6e2ff563c10441d3d37e320568c5b))





## [v1.31.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.31.0) - 2025-09-27

## [1.31.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.30.0...v1.31.0) (2025-09-27)


### Features

* add Deno runtime to Docker image for future yt-dlp YouTube support ([6977506](https://github.com/DialmasterOrg/Youtarr/commit/6977506e3e61958b82475e111d865b190308c3e3)), closes [yt-dlp/yt-dlp#14404](https://github.com/yt-dlp/yt-dlp/issues/14404)


### Bug Fixes

* clean up yt-dlp temporary files on successful downloads ([e8cefd7](https://github.com/DialmasterOrg/Youtarr/commit/e8cefd709d3b75c685d92db43a34890600050fb4))
* correct coverage file paths and YAML syntax in CI workflows ([68a29af](https://github.com/DialmasterOrg/Youtarr/commit/68a29afd0e97c12fa6c29cd452ef5fe496994c31))
* prevent workflow loops and fix badge updates [skip ci] ([d65fc28](https://github.com/DialmasterOrg/Youtarr/commit/d65fc286ffaf987bc031699cfa4c747893d05c40))
* use ACTION_RUNNER_TOKEN for coverage badge updates to bypass branch protection ([d3172a2](https://github.com/DialmasterOrg/Youtarr/commit/d3172a2ea54f0556abf8f0a7cf26cea99e4b7899))


### Tests

* add more test coverage ([05627d9](https://github.com/DialmasterOrg/Youtarr/commit/05627d966d329b0ed20a98f777347bc14ba3d7ef))
* add more test coverage & CI ([b251448](https://github.com/DialmasterOrg/Youtarr/commit/b251448566d127e57116f99c59322fab97d965cb))
* more test coverage ([5cff61b](https://github.com/DialmasterOrg/Youtarr/commit/5cff61bd20f1896cf188930da05cf226fe7b9739))
* more test coverage and CI coverage checks ([e033507](https://github.com/DialmasterOrg/Youtarr/commit/e033507d45f0f1e38df39d073ba485bcbc3b0aaa))


### Documentation

* update CHANGELOG for v1.30.0 ([e468186](https://github.com/DialmasterOrg/Youtarr/commit/e4681867d183a1388ee06b0c1abf08081cd7bc3d))





## [v1.30.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.30.0) - 2025-09-27

## [1.30.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.29.3...v1.30.0) (2025-09-27)


### Features

* improve Plex connectivity setup and download error handling ([7020bf6](https://github.com/DialmasterOrg/Youtarr/commit/7020bf68647b483d2880029dfb410cb224c5525f))


### Bug Fixes

* hide Account & Security section when internal auth is disabled ([1ccdd22](https://github.com/DialmasterOrg/Youtarr/commit/1ccdd22c951e20dbd6f354a72207eeb4fcdc5587))


### Tests

* stabilize WSL Plex path suggestion scenario ([2ad2dc9](https://github.com/DialmasterOrg/Youtarr/commit/2ad2dc92d16244faa8ea0fd6080ece7c0881b237))


### Documentation

* update CHANGELOG for v1.29.3 ([26d4b13](https://github.com/DialmasterOrg/Youtarr/commit/26d4b13562520e2a9cf7b339f21664a3ea099aa0))





## [v1.29.3](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.29.3) - 2025-09-26

### [1.29.3](https://github.com/DialmasterOrg/Youtarr/compare/vv1.29.2...v1.29.3) (2025-09-26)


### Bug Fixes

* allow platform auth to bypass plex setup ([25c2731](https://github.com/DialmasterOrg/Youtarr/commit/25c2731c9506724bd2494596cc0acd2ba281fa4f))
* remove Python dependency from setup scripts ([82d4179](https://github.com/DialmasterOrg/Youtarr/commit/82d41793db0e405b3504d5b1587f3d731f68c188))


### Documentation

* update CHANGELOG for v1.29.2 ([9cda97a](https://github.com/DialmasterOrg/Youtarr/commit/9cda97aaf4d5934e9955ee787e674f28392fcad1))





## [v1.29.2](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.29.2) - 2025-09-26

### [1.29.2](https://github.com/DialmasterOrg/Youtarr/compare/vv1.29.1...v1.29.2) (2025-09-26)


### Bug Fixes

* prevent config overwrite while loading on Configuration page ([4790685](https://github.com/DialmasterOrg/Youtarr/commit/47906852cd58fa59ab0568a7884f384f959d5190))


### Code Refactoring

* modularize download pipeline and expand tests ([b6d1cc8](https://github.com/DialmasterOrg/Youtarr/commit/b6d1cc8c52e6db3da679c54751a9238ece8a3eb8))


### Documentation

* update CHANGELOG for v1.29.1 ([449b27e](https://github.com/DialmasterOrg/Youtarr/commit/449b27e92f995e6ebc37a4ce44817c9e6ac8efa6))
* Update README. Remove screenshots ([74ac5e4](https://github.com/DialmasterOrg/Youtarr/commit/74ac5e44615bba55d39e216406bf5d41b4708372))





## [v1.29.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.29.1) - 2025-09-24

### [1.29.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.29.0...v1.29.1) (2025-09-24)


### Bug Fixes

* disable Docker build caching to ensure latest yt-dlp is downloaded ([ca360d4](https://github.com/DialmasterOrg/Youtarr/commit/ca360d48f490d22afab59d540dab555239e36a83))


### Documentation

* update CHANGELOG for v1.29.0 ([2c2080b](https://github.com/DialmasterOrg/Youtarr/commit/2c2080b5382c0ed7e0d1fdc3419fc6b3da67d6e2))





## [v1.29.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.29.0) - 2025-09-24

## [1.29.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.28.0...v1.29.0) (2025-09-24)


### Features

* add Kodi/Jellyfin/Emby compatibility ([4dcaded](https://github.com/DialmasterOrg/Youtarr/commit/4dcaded4ec79ec8283230a6509757cb207bda0a2))
* add NFO file generation for Jellyfin/Kodi/Emby compatibility ([abd1c1e](https://github.com/DialmasterOrg/Youtarr/commit/abd1c1ee970166872e2958c00232e9d94c15e7e3))


### Bug Fixes

* prevent server crash on invalid YouTube channel URLs ([4f51213](https://github.com/DialmasterOrg/Youtarr/commit/4f51213b9cfbc64ae0f36ff33961caf7426f244d))


### Documentation

* update CHANGELOG for v1.28.0 ([281180d](https://github.com/DialmasterOrg/Youtarr/commit/281180dd35ad063016164a16ea5ec84aa8dd85ef))





## [v1.28.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.28.0) - 2025-09-24

## [1.28.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.27.0...v1.28.0) (2025-09-24)


### Features

* improve UI, nav, download progress feedback ([c53bbe1](https://github.com/DialmasterOrg/Youtarr/commit/c53bbe19ff1fa64dfa0aa6464a794bd25d036c31))
* **ui:** enhance navigation with icons and consistent styling ([d29cf8c](https://github.com/DialmasterOrg/Youtarr/commit/d29cf8c9f711833ea8903dfebc6bddae081a9a2e))


### Bug Fixes

* simplify video extraction to use direct tab URLs ([0fdf2ee](https://github.com/DialmasterOrg/Youtarr/commit/0fdf2ee46a5cf6444b55554032f755e4b7621dcf))


### Documentation

* update CHANGELOG for v1.27.0 ([c2633d7](https://github.com/DialmasterOrg/Youtarr/commit/c2633d78d56b05db6d18968aef0d002e5bb9f8ea))





## [v1.27.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.27.0) - 2025-09-23

## [1.27.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.26.1...v1.27.0) (2025-09-23)


### Features

* improve UI layout for channel page and video selection buttons ([3707768](https://github.com/DialmasterOrg/Youtarr/commit/37077682459b59d8f72e4073034f11e5d039f1e4))


### Bug Fixes

* hide update notification for Elfhosted platform users ([c3d2fca](https://github.com/DialmasterOrg/Youtarr/commit/c3d2fca86c5dfe48813c2ca4858c985fa21aeb97))
* make AppBar fixed on mobile to prevent scrolling off screen ([76bbb06](https://github.com/DialmasterOrg/Youtarr/commit/76bbb069888baf8777943d0530eb6c0d3c0108e9))
* migrate incorrect cronSchedule config field to channelDownloadFrequency ([b3cdbe4](https://github.com/DialmasterOrg/Youtarr/commit/b3cdbe47fb0e249df2ca4dda059682752c89e853))


### Documentation

* update CHANGELOG for v1.26.1 ([ddc4b33](https://github.com/DialmasterOrg/Youtarr/commit/ddc4b33c1d1f9d92fcf8d7c94e9399b19e275c31))





## [v1.26.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.26.1) - 2025-09-23

### [1.26.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.26.0...v1.26.1) (2025-09-23)


### Bug Fixes

* ensure DATA_PATH environment variable overrides config.json youtubeOutputDirectory ([2203c1d](https://github.com/DialmasterOrg/Youtarr/commit/2203c1dead76eb6c36d76c6a250712961c68c9c7))


### Documentation

* update CHANGELOG for v1.26.0 ([2f1bde0](https://github.com/DialmasterOrg/Youtarr/commit/2f1bde0eb53eee653cfad62df967af531d2dc2a9))





## [v1.26.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.26.0) - 2025-09-23

## [1.26.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.25.0...v1.26.0) (2025-09-23)


### Features

* add persistent warning for /tmp video directory and Elfhosted platform support ([ddb3047](https://github.com/DialmasterOrg/Youtarr/commit/ddb30478072d824f39dc816314d75eb3577864c9))


### Bug Fixes

* use system temp directory for batch download channel files ([3ab7c24](https://github.com/DialmasterOrg/Youtarr/commit/3ab7c24a76b39b62f850c16f0433716ec6e6f040))


### Documentation

* update CHANGELOG for v1.25.0 ([4793e9a](https://github.com/DialmasterOrg/Youtarr/commit/4793e9ac8e9a22c20359f14d079ca2cdc111ecdd))





## [v1.25.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.25.0) - 2025-09-22

## [1.25.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.24.0...v1.25.0) (2025-09-22)


### Features

* auto-create config.json for Docker deployments without setup.sh ([78131c0](https://github.com/DialmasterOrg/Youtarr/commit/78131c007b982eafe1bf9c50265043e86c7764c8))


### Bug Fixes

* extend minimum download timeout to 20 minutes ([28d8097](https://github.com/DialmasterOrg/Youtarr/commit/28d8097b1dca86da2dc8a00a4f9165124644d049))
* use system temp directory for channel JSON files ([9e79264](https://github.com/DialmasterOrg/Youtarr/commit/9e7926434225c3d1359e1f1e5195f1b13d96ce70))


### Documentation

* update CHANGELOG for v1.24.0 ([0f8470f](https://github.com/DialmasterOrg/Youtarr/commit/0f8470fe92becbf579c6b3f10415c2f155e4b8c3))





## [v1.24.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.24.0) - 2025-09-22

## [1.24.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.23.0...v1.24.0) (2025-09-22)


### Features

* add YouTube cookie support for bot detection bypass ([1fb5ef5](https://github.com/DialmasterOrg/Youtarr/commit/1fb5ef547cc96cafa9e6f844d65285597e32b09a))
* enhance download progress with visual feedback and persistence ([cf55319](https://github.com/DialmasterOrg/Youtarr/commit/cf5531911088da27e907082d2eb4ee20645b05cb))


### Bug Fixes

* Better yt-dlp error handling ([0ae6cea](https://github.com/DialmasterOrg/Youtarr/commit/0ae6ceaaddc54660ec9690315c1e5fd1185daf47))
* handle non-zero exit codes when all videos are skipped ([3317112](https://github.com/DialmasterOrg/Youtarr/commit/3317112cedcd98d1693622d661488b477aa1aa1c))
* prevent download progress replay on page reload ([f4e355b](https://github.com/DialmasterOrg/Youtarr/commit/f4e355b928bd59fbbad9cf76bd48d31fe65b9814))
* prevent negative video count display and remove duplicate completion messages ([ca564e7](https://github.com/DialmasterOrg/Youtarr/commit/ca564e728c256c1b2590896f569f5896fc95e019))
* remove debug logging for yt-dlp exit code investigation ([ba39138](https://github.com/DialmasterOrg/Youtarr/commit/ba3913846d8de7098b5b49825039e3be26dee47a))
* set executable permission on husky pre-commit hook ([54bf8c2](https://github.com/DialmasterOrg/Youtarr/commit/54bf8c285019683ab492a304d104408e0febc1fa))


### Documentation

* update CHANGELOG for v1.23.0 ([63966ab](https://github.com/DialmasterOrg/Youtarr/commit/63966ab22f6e8773430a69fd87e63b836e3269fd))





## [v1.23.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.23.0) - 2025-09-20

## [1.23.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.22.0...v1.23.0) (2025-09-20)


### Features

* add full platform deployment support for Elfhosted/Kubernetes ([4fccc0a](https://github.com/DialmasterOrg/Youtarr/commit/4fccc0afad1bff33e2b5f5341048c0f4623d0d82))


### Documentation

* update CHANGELOG for v1.22.0 ([96652ce](https://github.com/DialmasterOrg/Youtarr/commit/96652ce73f58283430c7232f8ffbc0e973007107))





## [v1.22.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.22.0) - 2025-09-18

## [1.22.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.21.0...v1.22.0) (2025-09-18)


### Features

* add configurable storage path for Kubernetes/Elfhosted platforms ([e5f0f2d](https://github.com/DialmasterOrg/Youtarr/commit/e5f0f2dd74626dcf0a3768a7cbabd3ce41c629e4))


### Documentation

* update CHANGELOG for v1.21.0 ([d2b2970](https://github.com/DialmasterOrg/Youtarr/commit/d2b2970b212ab1c4df367e9e4492ad8b6ec3982c))





## [v1.21.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.21.0) - 2025-09-18

## [1.21.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.20.0...v1.21.0) (2025-09-18)


### Features

* add select all button for undownloaded videos in channel view ([6d57070](https://github.com/DialmasterOrg/Youtarr/commit/6d57070f85029e7254bc2ba27dc6dbba8ddf20be))
* add SponsorBlock integration for automatic segment handling ([67dcf1f](https://github.com/DialmasterOrg/Youtarr/commit/67dcf1f5b17c84cc6b04b5b404ffbabcbdf9a4ab))


### Documentation

* update CHANGELOG for v1.20.0 ([bc86963](https://github.com/DialmasterOrg/Youtarr/commit/bc869638948c7ecdf5c3754badf96eb9a1961076))





## [v1.20.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.20.0) - 2025-09-18

## [1.20.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.19.0...v1.20.0) (2025-09-18)


### Features

* set downloaded video timestamps to original YouTube upload date ([40d360c](https://github.com/DialmasterOrg/Youtarr/commit/40d360c491bd17321984d4a34f4cea6109d6f05b))


### Bug Fixes

* Do not write unused playlist-metafiles for channels ([4661cde](https://github.com/DialmasterOrg/Youtarr/commit/4661cde1bb10351316ad59abe1d5b23a7e182fd9))
* Lint fix, remove unneccesary line ([f302394](https://github.com/DialmasterOrg/Youtarr/commit/f3023947c48e28fa7e34213ec33936f5e56110dd))


### Documentation

* add SSH tunneling instructions for headless server setup ([00946df](https://github.com/DialmasterOrg/Youtarr/commit/00946dfa5c0607adf050293fb78dcda9055b2925))
* update CHANGELOG for v1.19.0 ([cc7cc40](https://github.com/DialmasterOrg/Youtarr/commit/cc7cc405993e1c4c6830893a125b18764b72b2a1))





## [v1.19.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.19.0) - 2025-09-16

## [1.19.0](https://github.com/DialmasterOrg/Youtarr/compare/vv1.18.1...v1.19.0) (2025-09-16)


### Features

* add advanced manual download UI with video validation and custom settings ([0802b45](https://github.com/DialmasterOrg/Youtarr/commit/0802b45e86426f4a068c88642cd3f4dd5942dbd5))
* add dynamic workflow and job names for dry run clarity ([efbb640](https://github.com/DialmasterOrg/Youtarr/commit/efbb640237d894b86103a4966883881e5133c3c9))


### Bug Fixes

* enable new channels properly and add loading states to channel manager ([98fba9d](https://github.com/DialmasterOrg/Youtarr/commit/98fba9d5b83ce54a05589e94c2e7ba71c67da5a2))


### Documentation

* add ISC license and update README with standalone functionality ([92dc88d](https://github.com/DialmasterOrg/Youtarr/commit/92dc88d8944d1f7ceafa4dcd535858fc31b9d24d))
* update CHANGELOG for v1.18.1 ([f219b15](https://github.com/DialmasterOrg/Youtarr/commit/f219b15796a10c6acec79fe75304698dc949de2e))
* update documentation for accuracy and clarity ([24aac9d](https://github.com/DialmasterOrg/Youtarr/commit/24aac9d7b076ffdbab39dd9370dea93488304712))
* Update README with new download UI changes ([b4d958f](https://github.com/DialmasterOrg/Youtarr/commit/b4d958f114329b57f2e0b4dc00497703f489b79d))





## [v1.18.1](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.18.1) - 2025-09-14

### [1.18.1](https://github.com/DialmasterOrg/Youtarr/compare/vv1.18.0...v1.18.1) (2025-09-14)


### Bug Fixes

* update package versions before Docker build and optimize CI triggers ([78394c5](https://github.com/DialmasterOrg/Youtarr/commit/78394c5dc9b0ed2ec34c9bbe0f06235b3a393760))


### Documentation

* update CHANGELOG for v1.18.0 ([f526a80](https://github.com/DialmasterOrg/Youtarr/commit/f526a80e07675506d29e69b14cea6e7810337517))





## [v1.18.0](https://github.com/DialmasterOrg/Youtarr/releases/tag/v1.18.0) - 2025-09-14

## [1.18.0](https://github.com/DialmasterOrg/Youtarr/compare/v1.17.31...v1.18.0) (2025-09-14)


### Features

* Create Release workflow enhancement ([2bfbbf0](https://github.com/DialmasterOrg/Youtarr/commit/2bfbbf07df623abc4b3c8783161b4511ebea7a2a))




 
           
