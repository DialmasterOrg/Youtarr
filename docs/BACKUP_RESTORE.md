# Youtarr Backup and Restore

This guide explains how to backup and restore your Youtarr installation, enabling disaster recovery and migration to new systems.

## Requirements

- Docker and Docker Compose (for database operations)
- `jq` command-line JSON processor (for parsing backup manifest)
- `tar` and `gzip`

On Debian/Ubuntu, install jq with:

```
sudo apt install jq
```

## Quick Start

### Create a Backup

```
# Full backup to default location ./backups/
./scripts/backup.sh

# Backup to custom location
./scripts/backup.sh --output-dir /mnt/external/backups

# Skip thumbnails (they auto-regenerate)
./scripts/backup.sh --skip-images
```

### Restore from Backup

```
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

**Note:** Video metadata files are critical because they cannot be regenerated. Thumbnails are optional because they auto-regenerate when channels are accessed.

### What's NOT Backed Up

**Video files in `YOUTUBE_OUTPUT_DIR` are NOT included** - these must be backed up separately by you. This is intentional because:

- Video files can be very large
- They’re typically stored on external/NAS storage
- They can be re-downloaded if lost (though this takes time)

## Backup Options

### Full Backup to default location `./backups/`

```
./scripts/backup.sh
```

Creates a complete backup including metadata and thumbnails. Best for full disaster recovery.

### Skip Thumbnails

```
./scripts/backup.sh --skip-images
```

Skips channel thumbnail images to reduce backup size. Thumbnails auto-regenerate when channels are accessed.

### Custom Output Location

```
./scripts/backup.sh --output-dir /mnt/backup/youtarr
```

Saves the backup to a different directory (default is `./backups/`).

## Restore Options

### Full Restore

```
./scripts/restore.sh backup.tar.gz
```

Restores everything from the backup. You'll be prompted to type `RESTORE` (case-sensitive) to confirm.

### Config-Only Restore

```
./scripts/restore.sh backup.tar.gz --skip-db
```

Restores only configuration files, skipping the database.

### Force Restore (No Prompts)

```
./scripts/restore.sh backup.tar.gz --force
```

Skips the confirmation prompt. Use with caution in scripts.

## Migration Scenarios

### Moving to a New Computer

1. On the old computer:
   ```
   ./scripts/backup.sh --output-dir /mnt/external
   ```
2. Copy your video files from `YOUTUBE_OUTPUT_DIR` to the new location.
3. On the new computer:
   ```
   git clone https://github.com/DialmasterOrg/Youtarr.git
   cd Youtarr
   ./scripts/restore.sh /path/to/youtarr-backup.tar.gz
   ```
4. Update `.env` if your video path has changed.
5. Start Youtarr:
   ```
   ./start.sh
   ```

## Troubleshooting

### "No .env file found"

Initialize Youtarr first:

```
./start.sh
./stop.sh
./scripts/backup.sh
```

### "Database failed to become ready"

- Wait and try again
- Ensure Docker is running: `docker ps`
- Check for port conflicts on `DB_PORT`

### "YOUTUBE_OUTPUT_DIR does not exist"

After restoring, update `YOUTUBE_OUTPUT_DIR` in `.env` to your current path or create the directory.

### Restore fails with permission errors

Some files may need elevated permissions:

```
sudo ./scripts/restore.sh backup.tar.gz
```

## Security Considerations

Backup archives contain sensitive data (DB credentials, tokens, session data). Store backups securely and consider encrypting them if storing offsite.

Example:

```
./scripts/backup.sh
+gpg -c backups/youtarr-backup-*.tar.gz
```
