# Youtarr Usage Guide

This guide provides step-by-step instructions for common tasks in Youtarr. After completing the [Installation Guide](INSTALLATION.md), use this guide to learn how to use Youtarr's features effectively.

## Table of Contents

- [Download Individual Videos](#download-individual-videos)
- [Subscribe to Channels](#subscribe-to-channels)
- [Configure Automation](#configure-automation)
- [Configure SponsorBlock](#configure-sponsorblock)
- [Enable Download Notifications](#enable-download-notifications)
- [Re-download Missing Videos](#re-download-missing-videos)
- [Organize Channels with Multi-Library Support](#organize-channels-with-multi-library-support)
- [Browse and Filter Channel Videos](#browse-and-filter-channel-videos)

## Download Individual Videos

Download specific YouTube videos manually without subscribing to channels.

1. **Navigate to the Downloads page**
   - Click "Manage Downloads" in the navigation menu

2. **Paste YouTube URLs**
   - Paste a single YouTube URL into the field and press **Enter** or click the **+** icon to add it
   - Repeat for each video you want to queue
   - Every URL is validated and previewed with video metadata before it is added

3. **Customize resolution settings** (optional)
   - Choose a specific resolution for this download
   - Or leave it at the default to use your global quality setting

4. **Click "Start Download"**
   - The download will begin immediately
   - Progress is displayed in real-time
   - You can continue using Youtarr while downloads run in the background

## Subscribe to Channels

Subscribe to YouTube channels to automatically download new videos as they're published.

1. **Go to the Channels page**
   - Click "Channels" in the navigation menu

2. **Add a channel**
   - Click the "Add Channel" button
   - Enter the channel URL or @handle
     - Examples:
       - `@MrBeast`
       - `https://youtube.com/@MrBeast`
       - `https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA`

3. **Queue downloads when you're ready**
   - Newly added channels wait until you run a channel download or a scheduled cron cycle
   - Use the **Manage Downloads -> Channel Download** tab and click **Download new from all channels** to fetch the latest videos immediately
   - The dialog lets you override resolution/video count for that run; otherwise the global defaults apply

4. **Configure channel-specific settings** (optional)
   - Click on a channel to open its detail page
   - Click the settings icon (gear) to access channel settings:
     - **Custom subfolder**: Organize channels into separate media libraries (e.g., `__kids`, `__music`)
     - **Quality override**: Set a channel-specific resolution preference that overrides the global setting
     - **Auto-download controls**: Enable/disable automatic downloads separately for:
       - `Videos`
       - `Shorts`
       - `Live`

## Configure Automation

Set up automatic downloads on a schedule so Youtarr checks for new videos periodically.

1. **Visit the Configuration page**
   - Click "Configuration" in the navigation menu

2. **Set download schedule**
   - Open the Configuration -> Core Settings card
   - Pick how often the cron job should run (defaults to hourly)
   - Use the drop-down to choose one of the preset cron intervals
   - For in-depth field descriptions (and manual edits via config.json), see [Configuration Reference](CONFIG.md)

3. **Choose video resolution**
   - In the same Configuration card choose your preferred maximum resolution
   - Options range from 360p up through 2160p (4K); YouTube provides the best quality available up to that limit

4. **Configure download limits** (optional)
   - Set maximum number of new videos to download per channel refresh

5. **Enable Automatic Video Removal** (optional)
   - Toggle "Enable Automatic Video Removal"
   - Set age threshold (e.g., delete videos older than 30 days)
   - Set free-space threshold (e.g., delete oldest videos when disk space drops below 50GB)
   - **Use "Preview Automatic Removal"** to simulate deletions before saving
     - This shows you exactly which videos would be deleted without actually removing them
     - Highly recommended before enabling auto-cleanup

6. **Save configuration**
   - Click "Save" to apply your settings
   - Changes take effect immediately for the next scheduled run

## Configure SponsorBlock

Automatically remove or mark sponsored segments, intros, outros, and other unwanted content using the crowdsourced [SponsorBlock](https://sponsor.ajay.app/) database.

1. **Go to Configuration page -> SponsorBlock Integration section**

2. **Enable SponsorBlock**
   - Toggle the "Enable SponsorBlock" switch

3. **Choose action**
   - **Remove segments entirely**: Cuts out selected segment types from the video file
   - **Mark as chapters**: Adds chapter markers so you can skip manually (doesn't modify video)

4. **Select which types of segments to handle**
   - **Sponsor**: Paid promotions and sponsorships
   - **Intro**: Intro sequences and animations
   - **Outro**: End cards and credits
   - **Self Promotion**: Creator promoting their own products/services
   - **Interaction Reminder**: "Like and subscribe" requests
   - **Music: Non-Music Section**: Non-music in music videos
   - **Preview/Recap**: Recaps of previous episodes
   - **Filler**: Tangential content not related to main topic

5. **Save configuration**
   - All new downloads will automatically process selected segments
   - Existing videos are not retroactively processed

## Enable Download Notifications

Get Discord notifications when new videos finish downloading.

1. **Create a Discord webhook**
   - In Discord, go to: Server Settings -> Integrations -> Webhooks
   - Click "New Webhook"
   - Choose the channel for notifications
   - Copy the webhook URL

2. **Open Youtarr Configuration -> Notifications**

3. **Enable notifications**
   - Toggle notifications on
   - Paste your Discord webhook URL

4. **Save configuration**

5. **Test the notification**
   - Click "Send Test Notification" to verify delivery
   - Check your Discord channel for the test message

**Note**: Youtarr sends notifications after successful downloads that include at least one new video. It won't spam for every single video - notifications are batched per download job.

## Re-download Missing Videos

Videos can become "missing" if they're manually deleted from disk or moved. This feature helps you recover them.

1. **Identify missing videos**
   - Go to "Downloaded Videos" or a specific channel's video page
   - Look for videos marked with a cloud-off icon (indicates missing from disk)
   - The video metadata is still in Youtarr's database, but the file is gone

2. **Select videos to re-download**
   - Check the boxes next to the missing videos you want to restore
   - Use **Select All This Page** if you want to grab everything currently visible

3. **Choose resolution**
   - Select your preferred resolution for the re-download
   - You can choose a different quality than the original when the download dialog opens

4. **Queue for download**
   - Click **Download Selected** and enable **Allow re-downloading previously fetched videos** in the dialog
   - Confirm with **Start Download**; the job will run through the normal downloads queue
   - Original metadata (watch status, etc.) is preserved

## Organize Channels with Multi-Library Support

Create separate media server libraries for different content types (e.g., kids content, music videos, educational content).

### Why Use Multi-Library Support?

- **Parental Controls**: Keep kids content separate with different access restrictions
- **Sharing Rules**: Share specific libraries with specific users
- **Better Organization**: Group similar content together
- **Cleaner Interface**: Users only see relevant content in each library

### How to Set Up Multi-Library Organization

1. **Plan your library structure**
   - Decide on subfolder names (convention: use `__` prefix like `__kids`, `__music`)
   - Examples:
     - `__kids` - Child-friendly YouTube channels
     - `__music` - Music videos and concerts
     - `__news` - News and current events
     - `__education` - Educational content
     - `__gaming` - Gaming content

2. **Assign channels to subfolders**
   - Go to Channels page
   - Click on a channel
   - Click the settings icon (gear)
   - Enter the subfolder name in the "Custom Subfolder" field
   - Save changes

3. **Configure your media server**
   - Create separate libraries in your media server (Plex/Jellyfin/etc.)
   - Point each library to a specific subfolder:
     - Library 1: `/path/to/downloads/__kids`
     - Library 2: `/path/to/downloads/__music`
     - Library 3: `/path/to/downloads` (for channels without a subfolder)

4. **Apply restrictions and sharing**
   - Configure library-specific access controls in your media server
   - Set age ratings and content restrictions per library
   - Share specific libraries with specific users

## Browse and Filter Channel Videos

Explore all videos available from your subscribed channels, even if you haven't downloaded them yet. This feature uses yt-dlp to fetch channel information directly from YouTube - no API key required.

### Using the Channel Video Browser

**Note:** *By default Youtarr only fetches the most recent 50 videos data per tab. To fetch ALL video data, click the `Refresh All` button.*

1. **Navigate to a channel**
   - Go to Channels page
   - Click on any subscribed channel

2. **Browse by content type**
   - Use the tabs to filter:
     - **Videos**: Long-form content
     - **Shorts**: Short-form vertical videos
     - **Streams**: Live streams and premieres

3. **Use filtering and view controls**
   - **Search**: Filter by title or keywords
   - **Hide downloaded**: Toggle this option to focus on videos that still need to be fetched
   - **View mode**: Switch between table/grid/list layouts; table view exposes sortable columns
   - **Sorting**: In table view click the column headers to sort by publish date, title, duration, or file size

4. **Live status indicators**
   - Videos currently streaming show a **LIVE** indicator
   - Youtarr won't download live streams until they finish

5. **Download from the browser**
   - Select specific videos you want to download
   - Click "Download Selected"
   - Choose quality and start the download

6. **Publish date accuracy note**
   - YouTube's API doesn't provide exact publish times for older videos
   - Recent videos have accurate timestamps

### Ignore Videos from Auto-Downloads

Mark specific videos to exclude them from automatic channel downloads.

1. **Find the video** you want to ignore
   - Browse the channel's video list

2. **Click the ignore button**
   - For videos not yet downloaded, click the "ignore" icon
   - Video will be skipped during automatic channel refreshes

3. **Bulk ignore**
   - Select multiple videos
   - Click "Ignore Selected" to bulk-ignore

4. **View ignored videos**
   - Ignored videos are tracked in `config/complete.list`
   - They won't appear in download recommendations
   - You can still manually download them if you change your mind

## Next Steps

Now that you know how to use Youtarr's features, check out these guides for advanced topics:

- [Configuration Reference](CONFIG.md) - Detailed explanation of all settings
- [Media Server Setup](MEDIA_SERVERS.md) - Configure Plex, Kodi, Jellyfin, or Emby
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Solutions to common issues
- [Database Management](DATABASE.md) - Advanced database operations

## Getting Help

- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
- [GitHub Issues](https://github.com/DialmasterOrg/Youtarr/issues) - Report bugs or request features
- [Discord Server](https://discord.gg/68rvWnYMtD) - Join the community for help and discussion
