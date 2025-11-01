# Changelog

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




 
           
