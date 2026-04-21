# Youtarr vs alternatives

*As of April 2026. These projects move fast; verify current state before committing.*

## At a glance

All three monitor YouTube channels and archive new videos with yt-dlp, but they sit at very different points on the complexity/feature curve.

- **Pick Tube Archivist** if you want a full self-hosted YouTube media server with in-app playback, full-text search across subtitles and comments, and you're willing to run a multi-container stack.
- **Pick Pinchflat** if you want the simplest single-container install, the most flexible filename/folder templating, and a podcast-RSS workflow. One caveat: the project has been in maintenance-only mode since September 2025 (small fixes still land, no new features). It still works and is still widely recommended, but don't expect the roadmap to move.
- **Pick Youtarr** if your library centers on Plex (or Plex plus Jellyfin/Emby/Kodi) and you want polished in-browser playback, integrated YouTube search, and a documented REST API. The tradeoff is a smaller community and a few things the other two do better (transcript search, custom filename templates).

Short summary of each:

- **Youtarr** (Node.js/Express + React + MariaDB, ISC). Plex-first automation tool. Unique strengths: automatic Plex library refresh with per-subfolder library mapping, channel grouping into user-defined subfolders (`__kids`/`__music`/`__news`, whatever), per-video content ratings, integrated in-app YouTube search, in-browser playback, a Swagger-documented REST API, MP3-only audio extraction, per-channel regex title filters, bulk channel import from Google Takeout CSV or a one-time cookies file, per-video protection against auto-deletion, backup/restore scripts, in-app yt-dlp updates, and Apprise notifications. Weaker than the competition on flexible filename templating, full-text transcript/comment search, multi-user RBAC, first-class playlist sources, podcast RSS output, and sheer community size.

- **Pinchflat** (Elixir/Phoenix + SQLite, AGPL-3.0). Single-container media manager by Kieran Eglin. Community favorite for its "just works" install, powerful filename templating, per-source filters (regex, duration, date cutoff), audio-only Media Profiles that produce podcast-app-compatible RSS feeds, and first-class SponsorBlock + cookies handling. No built-in player by design, no REST API, single-user HTTP basic auth only.

- **Tube Archivist** (Python/Django + Elasticsearch + Redis, GPL-3.0). Multi-container YouTube media server by Simon (bbilly1). The only one of the three with a real built-in video player, full-text search over subtitles and comments, comments archiving, LDAP/forward-auth, per-channel SponsorBlock overrides, dedicated Jellyfin and Plex companion projects, and scale-tested support for very large libraries. The cost: three containers, 2-4 GB RAM minimum, a host `vm.max_map_count` tweak, occasional breaking upgrades, and a fixed (non-configurable) filename/folder structure.

## Project health

| | Youtarr | Pinchflat | Tube Archivist |
|---|---|---|---|
| First commit | May 2023 | Jan 2024 | Sept 2021 |
| Primary maintainer | Chris Dial (dialmaster) | Kieran Eglin (kieraneglin) | Simon (bbilly1) + MerlinScheurer |
| License | ISC | AGPL-3.0 | GPL-3.0 |
| Stars | ~1,030 | ~4,800 | ~7,600 |
| Forks | 38 | ~130 | 359 |
| Latest release | Apr 2026 | Sept 2025 | Mar 2026 |
| Release cadence | 3-5/month | Maintenance-only since Sept 2025 | Roughly monthly |
| Docker pulls | 100K+ | 100K+ | 1M+ |

## Architecture and tech stack

**Youtarr** runs two containers: a Node.js app and MariaDB. yt-dlp, ffmpeg, and Deno are bundled in the app image, with an in-app "Update yt-dlp" action. Multi-arch images cover ARM64. No Redis, no Elasticsearch. Comfortable on a small NAS or Pi.

**Pinchflat** is the most resource-efficient. A single container, SQLite storage, no external services. yt-dlp runs as a subprocess and auto-updates daily. SQLite on network shares is a known pain point with a documented workaround. Also fine on a NAS or Pi.

**Tube Archivist** is a three-container stack: the Django app, Elasticsearch, and Redis. The host needs a `vm.max_map_count=262144` sysctl tweak and permissive ulimits. Elasticsearch is the reason for both the memory cost (2-4 GB minimum) and the killer feature: full-text search across subtitles and comments. Runs best on a homelab with a few gigabytes of RAM to spare, not a small NAS.

## Feature comparison

Legend: ✅ supported, ❌ not supported, ⚠️ partial/caveat, "unclear" = not documented clearly enough to confirm.

| Feature | Youtarr | Pinchflat | Tube Archivist |
|---|---|---|---|
| **Subscriptions & sources** | | | |
| Channel subscriptions + auto-download | ✅ Per-tab controls (videos/shorts/streams) | ✅ "Sources", the core model | ✅ Subscriptions page; separate "add to queue" for back-catalog |
| Playlist as first-class source | ⚠️ WIP | ✅ Yes (also user-created) | ✅ Yes, including reverse sort |
| Individual/one-off downloads | ✅ Pre-validated URL preview; bulk video-URL import; bulk channel import from Takeout CSV or one-time cookies | ⚠️ Supported but not the design goal; docs suggest the "unlisted playlist" workaround | ✅ Accepts video/channel/playlist URLs |
| Integrated YouTube search inside the UI | ✅ "Find on YouTube" with "already downloaded" state | ❌ | ⚠️ Search operates on archived library; browser extension adds YouTube-side one-click archive |
| Cron/scheduled fetching | ✅ Cron-based download scheduling | ✅ Per-source `index_frequency_minutes`; daily retention/update checks | ✅ Full cron UI at /settings/scheduling/ |
| **Downloads & filtering** | | | |
| Quality/format selection | ✅ 360p-4K, global + per-channel; true 1440p/2160p via VP9/AV1-to-MP4 remux | ✅ Via Media Profile (res sort + format string) | ✅ yt-dlp format/sort strings |
| Audio-only (MP3) extraction | ✅ MP3-only download available | ✅ First-class; audio-only Media Profile | ❌ Listed on open roadmap |
| Duration/date filters | ✅ Per-channel | ✅ Strong: cutoff date, min/max duration, shorts/livestream rules | ⚠️ Via page size + type toggles; no arbitrary duration filter |
| Title regex filter (per-channel/source) | ✅ Per-channel title filter with regex examples | ✅ Documented in Advanced Source mode | ❌ Not user-facing |
| Bandwidth / rate limiting | ⚠️ Not yet available | ✅ App-wide rate limit | ⚠️ No dedicated MB/s cap; uses yt-dlp sleep intervals |
| Archive tracking (no re-downloads) | ✅ Smart dedup | ✅ Per-source index | ✅ Indexed + ignore list |
| **Metadata & files** | | | |
| NFO files | ✅ Generated for Jellyfin/Kodi/Emby ordering | ✅ First-class (`nfo_filepath` on every item) | ⚠️ Only via user script `RoninTech/ta-helper` |
| Thumbnails / channel posters | ✅ Poster + per-video thumbs | ✅ Via yt-dlp | ✅ Downloaded and can be embedded |
| Embedded MP4 tags | ✅ Title/genre/studio/keywords + optional original-year metadata | ✅ Via `--embed-metadata` | ✅ Can embed full TA metadata into MP4 tags |
| JSON info-sidecar | ⚠️ Written via `--write-info-json`, moved to `jobs/info/` rather than kept alongside the video | ✅ Via `--write-info-json` | ⚠️ Only via user script `lamusmaser/create_info_json` |
| Subtitles (user + auto-generated) | ⚠️ Language configurable from YouTube, no auto-gen | ✅ Yes, including auto-gen, configurable langs | ✅ Yes, language regex supported |
| Chapters | ✅ Via Sponsorblock | ✅ Via yt-dlp + SponsorBlock chapter marks | ✅ Inherited from yt-dlp + in-player seeking |
| Comments archiving | ❌ | ❌ | ✅ Configurable; slow by nature |
| SponsorBlock | ✅ Global settings | ✅ With chapter-marking option | ✅ Global + per-channel override |
| Custom file-naming template | ❌ Fixed scheme | ✅ Very flexible per Media Profile | ❌ Fixed `<channel-id>/<video-id>.mp4` (explicit design choice) |
| Channel-grouping subfolders (kids/music/etc.) | ✅ eg `__kids`, `__music`, `__news`, each mappable to a different Plex library | ⚠️ Achievable via output template | ❌ Not configurable |
| Retention / auto-prune | ✅ Age + free-space with dry-run; per-video "protection" shield; Apprise notifications on auto-removal | ✅ Per-source "auto-delete after N days" | ✅ Global + per-channel |
| **Playback & viewing** | | | |
| In-browser video player | ✅ Detail modal + streaming | ❌ Intentionally out of scope | ✅ Full HTML5 player with SponsorBlock skip, keyboard shortcuts, Cast |
| Watched-state tracking | ❌ | ❌ | ✅ With threshold + "Continue watching" |
| Full-text search across transcripts | ❌ | ❌ | ✅ Flagship feature via Elasticsearch |
| Search across comments | ❌ | ❌ | ⚠️ Comments archived; dedicated comment-search UI still on roadmap |
| **Integrations** | | | |
| Plex library refresh | ✅ Native (auto-refresh after downloads); HTTPS to Plex; per-subfolder library mapping | ⚠️ Indirect via NFO + filepaths | ⚠️ Via community `tubearchivist-plex` Scanner + Agent |
| Jellyfin integration | ✅ NFO-compatible | ✅ NFO-compatible; community reports "just works" | ✅ Dedicated `tubearchivist-jf-plugin` with bidirectional watched-state sync |
| Emby | ✅ NFO-compatible | ✅ NFO-compatible | ❌ No plugin |
| Kodi | ✅ NFO-compatible | ✅ NFO-compatible | ⚠️ Only via user-script-generated NFOs |
| Content ratings (G/PG/R/TV-*) | ✅ Per-video/per-channel badges + policies | ❌ | ❌ |
| Podcast RSS feed output | ❌ | ✅ Beta; used with AntennaPod/Pocket Casts | ❌ Roadmap item |
| Prometheus metrics | ❌ | ✅ Opt-in `ENABLE_PROMETHEUS` | ⚠️ Dormant `tubearchivist-metrics` companion |
| **Access, API & notifications** | | | |
| REST/GraphQL API | ✅ 40+ endpoints, Swagger UI at `/swagger`, API keys with rate-limiting | ❌ Open feature request | ✅ REST + OpenAPI docs at `/api/docs/` |
| Multi-user / RBAC | ❌ Single admin + API keys | ❌ Single HTTP basic-auth user | ⚠️ Superuser/staff/read-only roles; library is still shared across users |
| Apprise notifications | ✅ | ✅ | ✅ |
| Cookies (private/unlisted/members-only) | ✅ Persistent `cookies.txt` for downloads + separate one-time cookies file for bulk import (auto-deleted after use) [^1] | ✅ Three modes: Disabled / When Needed / All Ops | ✅ Plus PO-token provider support for bot-detection bypass |
| Backup / restore | ✅ In-app backup & restore scripts | ⚠️ File-level (copy `/config`) | ⚠️ Documented manual multi-step procedure |
| Responsive / mobile-friendly UI | ✅ Responsive; mobile screenshots | ⚠️ Likely responsive (Tailwind); not explicitly claimed | ✅ |
| Live-stream / premiere handling | ⚠️ Streams in per-tab controls; in-progress stream handling not supported | ✅ Per-source shorts/livestream rules | ✅ Streams as a separate per-channel tab; disable via page size 0 |
| Member-only channel content | ❌ | ⚠️ Via cookies; distinguished for retry logic | ⚠️ Works implicitly if cookie has membership |

[^1]: The persistent `cookies.txt` is intended for a throwaway account, since download cookies risk suspension and rotate quickly on active accounts. The one-time cookies file is used only for bulk channel import and deleted immediately after, so you can safely import from your real account.

## Install and operational complexity

**Youtarr** sits in the middle. One `git clone` + `./start.sh` spins up the two containers and walks you through output path, timezone, and admin credentials. MariaDB adds weight versus Pinchflat's SQLite. Updates run via `./start.sh --pull-latest`. In-app backup/restore scripts, an in-app yt-dlp update, bulk channel import, per-video auto-deletion protection, and per-subfolder Plex library mapping are all available. Documentation covers Plex, Jellyfin, Emby, Kodi, Synology, Unraid, external DB, authentication, and backup/restore, plus Swagger API docs.

**Pinchflat** is the clear winner for simplicity. A single `docker run` with two volumes and one port. No DB to provision, no Redis, no Elasticsearch, no kernel knobs. Everything configurable lives under environment variables plus the web UI. Documentation is GitHub Wiki-based, no standalone docs site, but the wiki is well-written and honest about edge cases. Updates are "pull the new image." The one recurring gotcha is SQLite on network shares, with a documented workaround that carries a data-loss caveat.

**Tube Archivist** is the heaviest. You need Docker Compose for three services, a host-level sysctl change, `chown 1000:0` on the Elasticsearch volume, and enough RAM for ES's JVM heap plus its on-disk caches. Documentation is the best of the three: a proper MkDocs site with install guides for docker-compose, Podman, Proxmox LXC, Synology, and Unraid, plus an in-tree Swagger API reference. The real operational cost is version migrations; the README warns of breaking changes and recommends updating at least monthly. If you're comfortable reading release notes before `docker compose pull`, this is fine. If you want a set-and-forget tool, it is not.
