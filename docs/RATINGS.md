# Content Ratings Feature

This document describes the new content/parental ratings feature for Youtarr, including how to use the backfill script to populate existing videos with rating data.

## Overview

The content ratings feature allows Youtarr to ingest, store, and display content/parental ratings (e.g., "R", "PG-13", "TV-14", "TV-MA") from YouTube videos. These ratings are embedded in video metadata (NFO files and MP4 tags) for compatibility with Plex, Kodi, and Jellyfin.

## Supported Rating Systems

### MPAA Ratings (Movies)
- **G** - General Audiences
- **PG** - Parental Guidance  
- **PG-13** - Parents Strongly Cautioned
- **R** - Restricted (under 17 requires parental accompaniment)
- **NC-17** - No one under 17 admitted

### TV Parental Guidance Ratings
- **TV-Y** - Young children (ages 2-6)
- **TV-Y7** - Children (ages 7+)
- **TV-G** - General audience
- **TV-PG** - Parental guidance suggested
- **TV-14** - 14+ (parental guidance suggested)
- **TV-MA** - Mature audiences (18+)

## How Ratings Are Determined

The app uses the following priority order to determine a video's rating:

1. **Explicit YouTube ratings** (from YouTube Data API):
   - MPAA ratings (mpaaR, mpaaPg13, etc.)
   - TV Parental Guidance ratings (tvpg14, tvpgMA, etc.)
   - YouTube age-restricted flag (ytAgeRestricted → treated as "R")

2. **yt-dlp age limit** (fallback heuristic):
   - age >= 18 → R
   - age 16-17 → PG-13
   - age 13-15 → TV-14
   - age 7-12 → TV-PG
   - age 0-6 → TV-G

3. **Channel default rating** (if video has no rating):
   - Each channel can specify a default rating for unrated videos
   - This is useful for channels with consistent content

## Database Schema

Three new fields were added to the database:

### Videos Table
- `content_rating` (JSON) - Raw rating object from YouTube/yt-dlp
- `age_limit` (INTEGER) - Age limit from yt-dlp
- `normalized_rating` (STRING) - Normalized rating (R, PG-13, TV-14, etc.)
- `rating_source` (STRING) - Source of the rating (e.g., "youtube:mpaaR", "yt-dlp:age_limit")

### channelvideos Table
- `content_rating` (JSON) - Raw rating object
- `age_limit` (INTEGER) - Age limit
- `normalized_rating` (STRING) - Normalized rating

### channels Table
- `default_rating` (STRING) - Optional default rating for unrated videos in this channel

## Backfill Script

The rating backfill happens automatically during database migration as part of deployment. A new migration file (`20260112000000-backfill-ratings-on-migration.js`) will:

1. Process the first 100 unrated videos during migration
2. Fetch metadata from yt-dlp
3. Map ratings and store them
4. Log progress to console

For additional backfill (if you have many videos):

Use the `scripts/backfill-ratings.js` script to backfill remaining videos that weren't processed during migration.

### Prerequisites
- Node.js and npm packages installed
- Database migrations must be run (happens automatically on deployment)
- App database must be accessible
- Reasonable internet connection (for yt-dlp queries)

### Automatic Backfill (During Migration)
Backfill runs automatically when you deploy:
```bash
npx sequelize-cli db:migrate
```
This will process up to the first 100 unrated videos and populate their ratings.

### Manual Backfill (for remaining videos)
Test the backfill without making changes:
```bash
node scripts/backfill-ratings.js --dry-run
```

#### Actual Backfill
Run the backfill and update the database:
```bash
node scripts/backfill-ratings.js
```

### How It Works

1. Finds all videos in the database with `normalized_rating = NULL`
2. Fetches fresh metadata from yt-dlp for each video (using YouTube ID)
3. Extracts and maps rating fields to normalized values
4. Updates the database with rating information
5. Logs all results to a timestamped log file (e.g., `backfill-ratings-2026-01-11T12-34-56.log`)

### Rate Limiting

- Processes videos in batches of 10
- Delays 500ms between yt-dlp requests to avoid rate limiting
- Respects YouTube's terms of service

### Log Output

The script creates a detailed log file that includes:
- Timestamp of each operation
- Video ID and title
- Result (processed, skipped, failed)
- Rating mapped and source
- Summary statistics

Example log entry:
```
[2026-01-11T12:34:56.789Z] Processing Batch 1/5 (10 videos)
[2026-01-11T12:34:56.890Z]   Fetching: AbCdEfGh12I - My Cool Video
[2026-01-11T12:34:57.401Z]     SUCCESS: AbCdEfGh12I -> R (youtube:mpaaR)
[2026-01-11T12:34:57.923Z]   Fetching: XyZaBcDeF456 - Another Video
[2026-01-11T12:34:58.434Z]     NO RATING: XyZaBcDeF456 - no rating data available
```

### Success Criteria

- `Processed`: Video successfully updated with rating
- `Skipped`: Video already had rating or no rating data was available
- `Failed`: Error occurred during yt-dlp query or database update

## NFO and Metadata Embedding

After ratings are backfilled and new videos are downloaded:

### NFO Files
Generated `.nfo` files include:
```xml
<mpaa>R</mpaa>
<ratings>
  <rating name="mpaa">R</rating>
  <rating name="source">youtube:mpaaR</rating>
</ratings>
```

### MP4 Metadata
FFmpeg embeds metadata tags:
```
-metadata rating=R
-metadata content_rating=youtube
-metadata age_limit=18
```

## Plex Integration

Ratings are surfaced in Plex through:

1. **NFO `<mpaa>` tag** - Primary method Plex uses for ratings
2. **MP4 embedded metadata** - Backup ingestion method
3. **Genre/Collections** - Plex can group by rating if configured

### Recommended Plex Settings

To ensure Plex properly displays ratings:

1. Enable NFO file scanning in library settings
2. Set library agent to include metadata from local files
3. Refresh library to re-scan rating metadata

## Channel Default Ratings

You can set a channel-level default rating to apply to unrated videos. This is useful for:

- **Kids' channels**: Set default to "TV-Y" or "TV-G"
- **Adult channels**: Set default to "TV-MA" or "R"
- **Mixed channels**: Leave unset to let each video's actual rating stand

To set a channel default (via API or future UI):
```
PATCH /api/channels/{id}
{
  "default_rating": "TV-14"
}
```

## Troubleshooting

### Script hangs or is slow
- yt-dlp may be rate-limited by YouTube
- Try running during off-peak hours
- Increase `RATE_LIMIT_DELAY_MS` in the script if needed

### Videos have no rating after backfill
- Video may not have a public rating on YouTube
- Check the log file for details
- Video will use channel `default_rating` if set

### yt-dlp errors during backfill
- Video may have been deleted from YouTube
- Age-restricted videos may require special handling
- Check logs for specific error messages

## Performance Notes

- Backfill processes ~10-20 videos per minute depending on network
- For 1000 videos, expect 1-2 hours to complete
- Logs are written asynchronously to minimize impact
- Database is updated in real-time (not batched)

## Future Enhancements

- Manual rating override UI in video details
- Auto-apply rating rules (e.g., auto-set to R if age_limit >= 18)
- Rating-based filtering and sorting
- Plex custom field mapping
- Country-specific rating systems (BBFC, FSK, etc.)
