# Youtarr Backup and Restore

This guide explains how to backup and restore your Youtarr installation, enabling disaster recovery and migration to new systems.

## Requirements

- Docker and Docker Compose (for database operations)
- `jq` command-line JSON processor (for parsing backup manifest)
- `tar` and `gzip` (standard on most systems)

On Debian/Ubuntu, install jq with: `sudo apt install jq`

## Quick Start

### Create a Backup

```bash
# Full backup to default location ./backups/
./scripts/backup.sh

# Backup to custom location
./scripts/backup.sh --output-dir /mnt/external/backups

# Skip thumbnails (they auto-regenerate)
./scripts/backup.sh --skip-images
```

### Restore from Backup

```bash
# Stop Youtarr first
./stop.sh

# Restore from backup
./scripts/restore.sh ./backups/youtarr-backup-20240115-120000.tar.gz

# Start Youtarr
./start.sh
```

## What Gets Backed Up

| Component | Path | Criticality | Typical Size |
|-----------|------|-------------|--------------|
| Environment config | `.env` | Critical | ~1KB |
| App settings | `config/config.json` | Critical | ~2KB |
| YouTube cookies | `config/cookies.user.txt` | High (if exists) | ~8KB |
| Download history | `config/complete.list` | Critical | ~2KB |
| Database | MariaDB dump | Critical | Variable |
| Video metadata | `jobs/info/*.info.json` | Critical | Variable |
| Thumbnails | `server/images/*` | Optional | Variable |

**Note:** Video metadata files are critical because they cannot be regenerated - they're only created during the initial download. Thumbnails are optional because they auto-regenerate when channels are accessed.

### What's NOT Backed Up

**Video files in `YOUTUBE_OUTPUT_DIR` are NOT included** - these must be backed up separately by you. This is intentional because:

- Video files can be very large (hundreds of GB to TB)
- They're typically stored on external/NAS storage
- They can be re-downloaded if lost (though this takes time)

## Backup Options

### Full Backup to default location ./backups/

```bash
./scripts/backup.sh
```

Creates a complete backup including metadata and thumbnails. Best for full disaster recovery.

**Typical size:** 10-200MB depending on your library size

### Skip Thumbnails

```bash
./scripts/backup.sh --skip-images
```

Skips channel thumbnail images to reduce backup size. Thumbnails auto-regenerate when channels are accessed, so this is safe to use.

### Custom Output Location

```bash
./scripts/backup.sh --output-dir /mnt/backup/youtarr
```

Saves the backup to a different directory (default is `./backups/`).

## Restore Options

### Full Restore

```bash
./scripts/restore.sh backup.tar.gz
```

Restores everything from the backup. You'll be prompted to type `RESTORE` (case-sensitive) to confirm.

**Important notes:**
- The database is completely replaced (DROP + CREATE) - this is not a merge
- The script may use `sudo` automatically for files with restricted permissions
- On non-ARM systems, the existing `database/` directory is cleared before import

### Config-Only Restore

```bash
./scripts/restore.sh backup.tar.gz --skip-db
```

Restores only configuration files, skipping the database. Useful when:
- Database is on an external server
- You only want to restore settings

### Force Restore (No Prompts)

```bash
./scripts/restore.sh backup.tar.gz --force
```

Skips the confirmation prompt. Use with caution in scripts.

## Migration Scenarios

### Moving to a New Computer

1. **On the old computer:**
   ```bash
   ./scripts/backup.sh --output-dir /mnt/external
   ```

2. **Copy your video files** from `YOUTUBE_OUTPUT_DIR` to the new location

3. **On the new computer:**
   ```bash
   git clone https://github.com/DialmasterOrg/Youtarr.git
   cd Youtarr
   ./scripts/restore.sh /path/to/youtarr-backup.tar.gz
   ```

4. **Update `.env`** if your video path has changed:
   ```bash
   # Edit .env and update YOUTUBE_OUTPUT_DIR to the new path
   nano .env
   ```

5. **Start Youtarr:**
   ```bash
   ./start.sh
   ```

### Disaster Recovery (System Drive Failure)

If your system drive fails but your video files survive (on external/NAS storage):

1. **Install fresh OS and Docker**

2. **Clone Youtarr:**
   ```bash
   git clone https://github.com/DialmasterOrg/Youtarr.git
   cd Youtarr
   ```

3. **Restore from your offsite backup:**
   ```bash
   ./scripts/restore.sh /path/to/backup.tar.gz
   ```

4. **Verify video path in `.env`:**
   ```bash
   cat .env | grep YOUTUBE_OUTPUT_DIR
   # Update if the path has changed
   ```

5. **Start Youtarr:**
   ```bash
   ./start.sh
   ```

Your channels, settings, and download history will be restored. Videos should appear since they reference the same output directory.

### Upgrading to New Hardware

Same as "Moving to a New Computer" - backup, transfer, restore.

## Backup Archive Structure

The backup creates a timestamped `.tar.gz` archive with this structure:

```
youtarr-backup-YYYYMMDD-HHMMSS/
  manifest.json           # Backup metadata
  env.backup              # Your .env file
  config/
    config.json           # Application settings
    cookies.user.txt      # YouTube cookies (if present)
    complete.list         # Download history
  database/
    youtarr.sql           # Full database dump
  metadata/
    jobs/info/            # Video metadata files (always included)
    server/images/        # Thumbnail images (unless --skip-images)
```

## ARM/Apple Silicon Notes

Youtarr automatically detects ARM architecture (Apple Silicon, Raspberry Pi) and handles it appropriately:

- **Backup:** Works the same on all architectures
- **Restore:** Uses named volumes for MariaDB on ARM (instead of bind mounts)
- **Cross-architecture:** You can backup on x86 and restore on ARM (or vice versa)

The database dump is architecture-independent SQL, so migrations between architectures work seamlessly.

## Automated Backups

You can schedule regular backups using cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * /path/to/Youtarr/scripts/backup.sh --output-dir /mnt/backup/youtarr
```

Consider these best practices:
- Store backups on a different drive than your system
- Use `--skip-images` if you want smaller backups (thumbnails auto-regenerate)
- Test restores periodically

## Troubleshooting

### "No .env file found"

The backup script requires Youtarr to be initialized first:

```bash
./start.sh  # Initialize Youtarr
./stop.sh   # Stop it
./scripts/backup.sh  # Now backup will work
```

### "Database failed to become ready"

The database container may take longer to start on some systems:

1. Wait a moment and try again
2. Check Docker is running: `docker ps`
3. Check for port conflicts on 3321

### "YOUTUBE_OUTPUT_DIR does not exist"

After restoring, the video path from the backup might not exist on your new system:

1. Edit `.env` and update `YOUTUBE_OUTPUT_DIR` to point to your videos
2. Or create the directory and copy/mount your videos there

### Restore fails with permission errors

Some files may need elevated permissions:

```bash
# Run with sudo if needed
sudo ./scripts/restore.sh backup.tar.gz
```

### Database import fails

If the database import fails:

1. Try starting Youtarr normally (it will create a fresh database):
   ```bash
   ./start.sh
   ```

2. Then try a config-only restore:
   ```bash
   ./stop.sh
   ./scripts/restore.sh backup.tar.gz --skip-db
   ./start.sh
   ```

You'll lose your channel subscriptions but keep your settings. Videos will still exist; you'll need to re-add channels.

## Security Considerations

Backup archives contain sensitive data:
- Database credentials (in `.env`)
- Plex API keys (in `config/config.json`)
- YouTube API keys (if configured)
- Session data

Store backups securely and consider encrypting them if storing offsite:

```bash
# Create encrypted backup
./scripts/backup.sh
gpg -c backups/youtarr-backup-*.tar.gz

# Decrypt before restore
gpg -d backup.tar.gz.gpg > backup.tar.gz
./scripts/restore.sh backup.tar.gz
```
