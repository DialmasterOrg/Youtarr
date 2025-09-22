# Changelog

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




 
           
