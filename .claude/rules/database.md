---
paths:
  - "migrations/**/*"
  - "server/models/**/*"
  - "server/db.js"
---

# Database

MariaDB 10.3 (bundled) with utf8mb4, the Sequelize models, and the migrations that run at container startup.

- Never amend a migration that has already run: Umzug skips recorded ones. Add a new migration, and test upgrades with `up({ to })`, not by deleting `SequelizeMeta` rows.
- Collation is `utf8mb4_unicode_ci` on every table from `20260907000000-normalize-utf8mb4-unicode-collation` onward. Older installs had `utf8mb4_general_ci` legacy tables beside `unicode_ci` newer ones, which breaks any SQL comparing string columns across them; migrations sorted before it must not compare string columns across tables.
- `migrations/lib/unicodeCollation.js` is the lowercase-table-name collation helper (`jobsUuidCollation.js` is legacy). It drops the foreign keys on the jobs UUID chain before converting and recreates them from information_schema (stored names and rules, never assumed) after restoring `utf8mb4_bin`.
- That drop is needed because MariaDB 10.4.31+, 10.5.22+, 10.6.15+, 10.11.5+, 11.x and 12.x refuse to alter a foreign-key column even with `FOREIGN_KEY_CHECKS=0`. A key missing after an interrupted run is recreated from the canonical definition as `<table>_job_id_fk`.
- MariaDB 12.1+ keeps `<Table>_ibfk_N` names across renames and auto-names new constraints `1`, `2`, so Elfhosted-style databases carry mixed-case constraint names on lowercase tables. Test any migration that alters a foreign-key column against `mariadb:12.3` as well as the bundled 10.3.
- Associations live in `server/models/index.js`; there is no Channel-Video association, so a Channel include of Video throws. Job hasMany JobVideos and JobVideoDownloads, Video hasMany JobVideos and VideoWatchStatuses, Playlist hasMany PlaylistVideos and PlaylistSyncStates, ApiKey and Channel hasMany ApiKeyChannelGrants and ExternalRequests.
