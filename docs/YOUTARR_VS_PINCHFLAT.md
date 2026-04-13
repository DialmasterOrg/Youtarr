# Youtarr vs Pinchflat

[Pinchflat](https://github.com/kieraneglin/pinchflat) is a self-hosted YouTube archiver built on Elixir/Phoenix, and it's the closest thing to Youtarr out there. The two tools overlap a lot, so I put this page together to make the comparison easier.

## A quick note on history

I started Youtarr in May 2023; Pinchflat showed up in January 2024. The two projects arrived at similar ideas independently and have evolved in parallel since. That's a big reason there's so much overlap, and why a side-by-side is useful.

## The shared baseline

Both tools wrap [yt-dlp](https://github.com/yt-dlp/yt-dlp), and both end up doing the same basic thing: pulling YouTube channels (and playlists) down to disk with metadata your media server can read. What works well in both:

- **Media servers**: Plex, Jellyfin, Emby, Kodi via NFO metadata + thumbnails
- **yt-dlp**: quality/codec selection, SponsorBlock, cookies, Shorts & livestream toggles, custom arguments
- **Filtering**: per-source duration, date cutoff, and (Pinchflat) regex title match / (Youtarr) keyword and rating-based selection
- **Automation**: scheduled checks, retention/auto-deletion, notifications via [Apprise](https://github.com/caronc/apprise)
- **Deployment**: Docker + Compose, ARM/x86_64, reverse-proxy friendly

If that covers what you need, either one will work fine.

## Where they differ

### Youtarr emphasizes

- **Deep Plex integration.** OAuth setup, automatic library refresh after download, and per-subfolder library mapping so `__kids`, `__music`, and `__news` can each refresh a different Plex library.
- **In-app browsing and playback.** Click any thumbnail to open a detail modal and stream the downloaded file right in your browser, no media server required.
- **Content ratings.** Per-video and per-channel MPAA/TV ratings (`G`, `PG`, `PG-13`, `TV-Y`, `TV-MA`, etc.), useful for building out family-friendly libraries.
- **REST API + Swagger.** Full OpenAPI-documented REST API with API-key auth and rate limiting; I built it with bookmarklets, iOS Shortcuts, Home Assistant, and general automation in mind.
- **Bulk channel import.** One-shot import from a Google Takeout subscriptions CSV, or from a one-time cookies file that Youtarr deletes right after use.
- **Headless-friendly auth.** `AUTH_PRESET_*` env vars for automated / managed deployments, with first-class support on [ElfHosted](https://docs.elfhosted.com/app/youtarr/).

### Pinchflat emphasizes

- **Single-container simplicity.** One image with SQLite inside, no separate DB container. Youtarr runs two containers (app + MariaDB), or can point at an external MySQL/MariaDB.
- **Fast RSS-based new-video indexing.** A two-tier system that checks YouTube RSS feeds often for new uploads and falls back to full yt-dlp scans less often. Youtarr uses a cron-based channel refresh.
- **Per-source RSS / podcast feeds.** Every source exposes a UUID-protected RSS feed with media streaming, handy if you want to consume downloaded channels in a podcast client.
- **Lifecycle scripts.** Run arbitrary commands on download or delete events (alpha feature). Youtarr doesn't offer this today.
- **Larger community.** More stars, more Unraid/TrueNAS writeups, longer track record of user-submitted integrations.

Both are actively maintained, and you can run them side-by-side on different channel sets while you make up your mind.
