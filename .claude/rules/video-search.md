---
paths:
  - "server/modules/videoSearchModule.js"
  - "server/modules/videoLocalStatus.js"
  - "server/modules/youtubeExistenceCheck.js"
  - "server/modules/youtubeApi/**/*"
  - "server/routes/videoSearch.js"
  - "server/routes/videoDetail.js"
  - "client/src/components/FindVideos/**/*"
  - "client/src/components/VideosPage/hooks/useVideoByYoutubeId.ts"
  - "client/src/components/shared/AvailabilityChip.tsx"
  - "client/src/components/shared/VideoModal/**/*"
---

# Video search and local status

Find Videos search, the local status set on search results, and the single-video lookup.

- `videoLocalStatus` sets `inArchive` on each result: the id is in `config/complete.list` but has no Videos row, so yt-dlp would skip it. One archive read per call, through `archiveModule.filterArchivedVideoIds`, which treats an unreadable archive as empty.
- Channel-ignored videos are never `inArchive`, because ignoring writes the archive entry on purpose. That lookup is `archiveOnlyIds`, shared with channel Download all and playlist selection.
- The channel page, video modal and Find Videos count `inArchive` videos as previously downloaded when opening the download dialog, which turns on "Allow re-downloading"; the modal's own local-status lookup then keeps it current.
- `channelSubscribed` (an enabled Channel row for the result's `channelId`) is set only on results carrying a channel id, so the local-status endpoint's refresh never clears it.
- `videoSearchModule` (`POST /api/videos/search`): YouTube Data API when a key is set, else yt-dlp `ytsearch`. Results stay in the source's relevance order, which the client cannot recompute; every other order is applied client-side (`FindVideos/sortResults.ts`, nulls last either way).
- The yt-dlp search path drops `live_status` `is_live`/`is_upcoming` entries, as the API path already did, because a download would record the stream; a VOD with a null duration is kept.
- `GET /api/videos/:youtubeId` (`routes/videoDetail.js`, rate-limited) returns one row in `/getVideos` shape through `videosModule.getVideoByYoutubeId`, with no removal filter, so a deleted or missing video still opens until the trash is emptied.
- `VideosPage` drops the `?video=` parameter after the lookup so a refresh does not reopen the modal; a 404 or 400 shows "Video not found"; API keys get 403.
- `shared/AvailabilityChip` on coarse-pointer devices opens its tooltip on tap without reaching the row underneath; mouse clicks, and taps on fine-pointer touchscreens, pass through, for rows that expand on click.
