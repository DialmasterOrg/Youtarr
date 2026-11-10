---
paths:
  - "server/modules/externalApi/**/*"
  - "server/routes/externalApi.js"
  - "server/routes/externalRequests.js"
  - "server/middleware/externalApiAuth.js"
  - "client/src/components/ExternalRequests/**/*"
  - "client/src/components/Configuration/sections/ApiKeysSection.tsx"
  - "client/src/components/Configuration/sections/ApiKeysSection/**/*"
---

# External API

The opt-in `/external-api/v1` surface for external tools: catalog reads and download, channel and delete requests under per-key grants.

- `routes/externalApi.js` + `middleware/externalApiAuth.js`: mandatory external-key authentication, bounded UTF-8 JSON bodies, private responses and per-key limits. All business logic lives in `modules/externalApi/`.
- `externalApiConfig.js` (feature availability, `isExternalApiPath`), `externalApiResponse.js`, `externalPermissions.js` and `externalEligibility.js` centralize the shared rules; `apiKeyChannelGrantModule.js` manages per-key channel grants. `externalEligibility` maps TV-Y7 to level 2 locally, since `ratingMapper` has no numeric TV-Y7.
- `externalCatalogService` is the cached, grant-filtered catalog and asset lookup. Reads never spawn yt-dlp or write: video detail uses `videoMetadataModule.getCachedVideoMetadata` (cached `.info.json` only).
- Its raw SQL stays portable (snake_case aliases, `POSITION(... IN ...)`), keyset cursors (v3) tie-break on `cv.id`, and single-channel lookups go through `Channel.findOne` with the `apiKeyGrants` include.
- `externalCatalogRequests.js` batches the current page's request status, `externalPagination.js` shares bounded page cursors, and `externalThumbnailProxy.js` enforces upstream image URL, size and timeout limits.
- `externalRequestService`: auto-approved requests are stored `approved` with `approval_source='auto'`; reads never change request state. `externalRequestReviewService` owns idempotent administrator approve/reject (approve only marks `approved` and wakes the executor); `externalQuotaService` counts `approved` + `processing` as active jobs.
- `externalRequestExecutor` is the background executor, started in `server.js` only when the External API is enabled: it sweeps every minute and wakes on create/approve and on `jobModule.onJobEnded`.
- The executor rechecks authority, claims `approved` -> `processing`, queues downloads through `downloadModule.doSpecificDownloads` with the request id as the job id, provisions, enables and grants channels, and deletes videos through `videoDeletionModule`.
- It holds requests with a message while downloads are paused or the video is busy, and recovers interrupted rows at startup.
- `externalRequestTargets.js` validates grant, channel, video and policy targets; `externalRequestReconciliation.js` closes processing video requests whose job ended; `externalRequestPrimitives.js` shares validation and DTOs.
- Key-before-request locks serialize decisions; `externalWorkLimiter.js` bounds expensive work. `routes/externalRequests.js` exposes admin management endpoints that reject every API key; their UI lives in `client/src/components/ExternalRequests/`.
