# Changelog

## [Unreleased]

### Chores
* start UI modernization (initial planning and templates) — private work tracked in `feat/ui-modernization`

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




 
           
