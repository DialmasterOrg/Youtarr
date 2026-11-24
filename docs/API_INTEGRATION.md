# API Integration Guide

This guide covers how to use Youtarr's API for external integrations, including bookmarklets, mobile shortcuts, and automation tools.

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Rate Limiting](#rate-limiting)
- [Bookmarklet Setup](#bookmarklet-setup)
- [Mobile Shortcuts](#mobile-shortcuts)
- [Examples](#examples)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

Youtarr provides an API endpoint that allows you to add YouTube videos to your download queue from external tools. This enables workflows like:

- **Browser Bookmarklet**: One-click download while browsing YouTube
- **Apple Shortcuts**: Share videos from the YouTube app on iOS
- **Android Tasker/Automate**: Automated download workflows
- **Home Assistant/n8n**: Smart home and automation integrations
- **CLI Scripts**: Download individual videos

> **Note**: API keys currently support **single video downloads only**. Playlists, channels, and batch operations are not supported via the API at this time. Use the web UI for those features.

## Authentication

### API Keys

API keys are the recommended authentication method for external integrations. They provide:

- Persistent access (no expiration)
- Scoped permissions (each key reaches one endpoint only)
- Easy revocation if compromised
- Rate limiting per key

There are two kinds of key, chosen when the key is created:

| Key type | Reaches | Use it for |
|----------|---------|------------|
| Download key (default) | `POST /api/videos/download` | Bookmarklets, phone shortcuts, automation that queues videos |
| Read-only status key | `GET /api/status/summary` | Dashboards and monitoring tools |

A key of one type is refused on the other endpoint with a 403, so a status key stored in a dashboard can never start a download.

#### Creating an API Key

1. Navigate to **Settings -> API Keys & Bookmarklet** in Youtarr
2. Click **Create Key**
3. Enter a descriptive name (e.g., "iPhone Shortcut", "Bookmarklet")
4. For a dashboard or monitoring tool, tick **Read-only status key**
5. **Important**: Copy and save the key immediately - it will not be shown again!

#### Using API Keys

Include the API key in the `x-api-key` header:

```bash
curl -X POST https://your-youtarr-server.com/api/videos/download \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY_HERE" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### Session Tokens

You can also use session tokens (the same tokens used by the web UI) via the `x-access-token` header. However, these expire after 7 days and are less suitable for automation.

## API Endpoints

### POST /api/videos/download

Add a single YouTube video to the download queue.

> **Scope Limitation**: This endpoint only accepts individual video URLs. Playlist URLs, channel URLs, and batch requests are not supported via API keys. Use the web UI for those operations.

Accepted URLs are watch, Shorts, live, and embed links on `youtube.com`, `m.youtube.com`, or `music.youtube.com`, plus `youtu.be` links. A watch URL opened from a playlist (`watch?v=VIDEO_ID&list=...`) downloads only that video; the playlist part is ignored.

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |
| `x-api-key` | Yes* | Your API key |
| `x-access-token` | Yes* | Session token (alternative to API key) |

*One of `x-api-key` or `x-access-token` is required.

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "resolution": "1080",
  "subfolder": "Movies"
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `url` | Yes | string | YouTube video URL |
| `resolution` | No | string | Override resolution (360, 480, 720, 1080, 1440, 2160) |
| `subfolder` | No | string | Override download subfolder |

Any other body fields are ignored. Folder layout (flat or one folder per video) is not selectable per request: it follows the channel's setting, or the global default for untracked channels.

**Note:** A download requested with a legacy API key is handled like a manual download, so when cookies are enabled it can download members-only videos the cookies' account is a member of. Anyone holding a key can use that membership; keep keys to people you trust with it. See [Members-Only Videos](CONFIG.md#members-only-videos).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Video queued for download",
  "queued": 1,
  "acceptedIds": ["VIDEO_ID"],
  "alreadyActiveIds": [],
  "video": {}
}
```

> **Note**: `video` is currently always an empty object, so clients should not rely on it for the title, thumbnail, or duration. Use the YouTube ID in `acceptedIds` instead.

**Duplicate submissions:** URLs are normalized to YouTube video IDs. A video already queued or downloading is not queued again, even when re-downloads are allowed. A successful response includes `queued`, `acceptedIds`, and `alreadyActiveIds`; an already-active single-video request returns HTTP 200 with `queued: 0` and an explanatory message. Queue acceptance is confirmed before responding; download execution continues in the background.

**Error Responses:**

| Status | Response | Description |
|--------|----------|-------------|
| 400 | `{"success": false, "error": "URL is required"}` | Missing or invalid URL |
| 400 | `{"success": false, "error": "Bot detection encountered. ...", "errorCode": "COOKIES_REQUIRED"}` | YouTube would not return the video, so nothing was queued. `errorCode` says why: `COOKIES_REQUIRED` (YouTube's bot check, often temporary, so retrying later can work), `TIMEOUT`, `VIDEO_UNAVAILABLE`, `COOKIES_REJECTED` (members-only video and the configured cookies could not be used) or `FETCH_FAILED` (any other failure; the reason is in the server log) |
| 401 | `{"error": "Invalid API key"}` | Invalid or missing authentication |
| 403 | `{"error": "API keys can only access the download endpoint"}` | API key used on wrong endpoint |
| 403 | `{"error": "Status API keys can only access the status summary endpoint"}` | A read-only status key was used; it cannot start downloads |
| 409 | `{"success": false, "error": "Downloads are paused: ..."}` | A storage limit (Settings -> Storage Limits) was reached, or the downloads folder looks unavailable (for example a share that is not mounted); the message says which. Retry once that is resolved |
| 429 | `{"success": false, "error": "Rate limit exceeded"}` | Too many requests |

### GET /api/status/summary

A read-only snapshot for dashboards and monitoring tools: library totals, the download queue, the last finished run and the ten most recent downloads, in one request.

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `x-api-key` | Yes* | A read-only status key |
| `x-access-token` | Yes* | Session token (alternative to a status key) |

*One of `x-api-key` or `x-access-token` is required. A download key or an External API key is refused with a 403.

```bash
curl https://your-youtarr-server.com/api/status/summary \
  -H "x-api-key: YOUR_STATUS_KEY_HERE"
```

**Success Response (200):**
```json
{
  "version": "1.94.0",
  "ytDlp": { "version": "2026.11.16" },
  "library": { "channels": 42, "videos": 1234, "storageBytes": 123456789012 },
  "downloads": {
    "paused": false,
    "activeJob": { "type": "Channel Downloads", "createdAt": "2026-11-17T20:00:00.000Z" },
    "queuedJobs": 2,
    "videosDownloading": 1,
    "videosQueued": 5
  },
  "lastRun": {
    "status": "success",
    "finishedAt": "2026-11-17T19:05:00.000Z",
    "lastCheckedAt": "2026-11-17T21:00:00.000Z",
    "downloaded": 3,
    "failed": 0
  },
  "recentDownloads": [
    {
      "youtubeId": "VIDEO_ID",
      "title": "Video title",
      "channel": "Channel name",
      "downloadedAt": "2026-11-17T19:04:00.000Z"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `version` | The running Youtarr version |
| `ytDlp.version` | The installed yt-dlp version, or `null` before it is known |
| `library.channels` | Subscribed channels |
| `library.videos` | Downloaded videos that are still on disk |
| `library.storageBytes` | Size of those videos, from the file sizes Youtarr recorded (thumbnails, subtitles and other sidecar files are not counted) |
| `downloads.paused` | `true` while a storage limit, or a downloads folder that looks unavailable, is holding downloads |
| `downloads.activeJob` | The job that is running, or `null` |
| `downloads.queuedJobs` | Jobs waiting behind it |
| `downloads.videosDownloading` | Videos being downloaded now |
| `downloads.videosQueued` | Videos waiting in the queue that Youtarr already knows by ID (manual and API downloads; a channel check does not know its videos in advance) |
| `lastRun` | The last finished run that downloaded or failed something. `status` is `success`, `warning` or `error`. `lastCheckedAt` is later than `finishedAt` when a newer check found nothing to download. After Youtarr restarts it is rebuilt from the newest finished job in the download history, with `finishedAt` set to `null`, until a run finishes. `null` only when there is no such run at all |
| `recentDownloads` | Up to ten videos, newest first |

Library figures and `recentDownloads` are cached for up to 30 seconds; the queue and last-run fields are current. The response never contains filesystem paths. Treat fields you do not recognize as additions, not errors.

**Error Responses:**

| Status | Response | Description |
|--------|----------|-------------|
| 401 | `{"error": "Invalid API key"}` | Unknown or revoked key |
| 403 | `{"error": "API keys can only access the download endpoint"}` | A download key or an External API key was used |
| 429 | `{"error": "Rate limit exceeded. Try again later."}` | More than 60 requests in a minute from one status key |
| 500 | `{"error": "Failed to build status summary"}` | The database could not be read |

**Note:** With `AUTH_ENABLED=false` every Youtarr endpoint is open, this one included, so a dashboard that insists on a key can be given any placeholder value.

### API Key Management Endpoints

These endpoints are only accessible via session authentication (not API keys).

#### GET /api/keys
List all API keys (keys are not shown, only metadata).

#### POST /api/keys
Create a new API key.

**Request Body:**
```json
{
  "name": "My Integration"
}
```

Add `"role": "status_read"` to create a read-only status key instead of a download key.

**Response:**
```json
{
  "success": true,
  "message": "API key created. Save this key - it will not be shown again!",
  "id": 1,
  "name": "My Integration",
  "key": "abc123...",
  "prefix": "abc123"
}
```

#### DELETE /api/keys/:id
Delete an API key.

## Rate Limiting

API keys are rate-limited to prevent abuse. The default limit is **10 requests per minute** per API key.

You can adjust this limit with the **Rate Limit (requests/min)** field on **Settings -> API Keys & Bookmarklet**.

That setting covers download keys. A read-only status key has its own fixed limit of 60 requests per minute.

When rate limited, you'll receive a `429` response with:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again later."
}
```

The response includes standard rate limit headers:
- `RateLimit-Limit`: Maximum requests per window
- `RateLimit-Remaining`: Remaining requests in current window
- `RateLimit-Reset`: When the window resets

## Bookmarklet Setup

A bookmarklet is a browser bookmark that runs JavaScript when clicked. Youtarr generates a ready-to-use bookmarklet when you create an API key.

### Installation

1. Create an API key in Youtarr
2. In the success dialog, drag the **"📥 Send to Youtarr"** button to your bookmarks bar
3. Alternatively, copy the bookmarklet code and create a bookmark manually

### Usage

1. Navigate to any YouTube video page
2. Click the bookmarklet in your bookmarks bar
3. An alert will confirm the video was added to Youtarr

### Manual Bookmarklet Code

If you need to create the bookmarklet manually:

```javascript
javascript:(function(){
  var k='YOUR_API_KEY';
  var s='https://your-youtarr-server.com';
  var u=location.href;
  if(!/youtube\.com|youtu\.be/.test(u)){
    alert('Not YouTube');
    return;
  }
  fetch(s+'/api/videos/download',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':k},
    body:JSON.stringify({url:u})
  })
  .then(function(r){return r.json()})
  .then(function(d){
    alert(d.success?'✓ Added: '+(d.video&&d.video.title?d.video.title:'Queued'):'✗ '+d.error)
  })
  .catch(function(){alert('✗ Connection failed')})
})();
```

Replace `YOUR_API_KEY` and `https://your-youtarr-server.com` with your values.

## Mobile Shortcuts

### Apple Shortcuts (iOS/macOS)

1. Create a new Shortcut
2. Add **"Get URLs from Input"** (for Share Sheet integration)
3. Add **"Get Contents of URL"** with:
   - **URL**: `https://your-youtarr-server.com/api/videos/download`
   - **Method**: POST
   - **Headers**: Add `x-api-key` with your API key
   - **Request Body**: JSON with `{"url": "Shortcut Input"}`
4. Add **"Show Notification"** to confirm success
5. Enable "Show in Share Sheet" and select YouTube

Now you can share videos from the YouTube app directly to Youtarr!

### Android (Tasker/Automate)

Create an HTTP Request action with:
- **Method**: POST
- **URL**: `https://your-youtarr-server.com/api/videos/download`
- **Headers**: `Content-Type: application/json`, `x-api-key: YOUR_KEY`
- **Body**: `{"url": "%clipboard"}`

Trigger it with a widget or when copying YouTube URLs.

## Examples

### cURL

```bash
# Basic download
curl -X POST https://youtarr.example.com/api/videos/download \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# With resolution override
curl -X POST https://youtarr.example.com/api/videos/download \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "resolution": "720"}'
```

### Python

```python
import requests

API_KEY = "your_api_key"
SERVER = "https://youtarr.example.com"

def download_video(url, resolution=None):
    payload = {"url": url}
    if resolution:
        payload["resolution"] = resolution
    
    response = requests.post(
        f"{SERVER}/api/videos/download",
        json=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY
        }
    )
    return response.json()

result = download_video("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
print(result)
```

### JavaScript (Node.js)

```javascript
const fetch = require('node-fetch');

const API_KEY = 'your_api_key';
const SERVER = 'https://youtarr.example.com';

async function downloadVideo(url) {
  const response = await fetch(`${SERVER}/api/videos/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({ url })
  });
  return response.json();
}

downloadVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  .then(console.log);
```

### Home Assistant (REST Command)

```yaml
rest_command:
  youtarr_download:
    url: "https://youtarr.example.com/api/videos/download"
    method: POST
    headers:
      Content-Type: application/json
      x-api-key: "YOUR_API_KEY"
    payload: '{"url": "{{ url }}"}'
```

Usage in automation:
```yaml
action:
  - service: rest_command.youtarr_download
    data:
      url: "https://www.youtube.com/watch?v=VIDEO_ID"
```

## Security Considerations

1. **Use HTTPS**: Always use HTTPS in production to protect your API keys in transit
2. **Keep Keys Secret**: Never share your API keys or commit them to public repositories
3. **Rotate Keys**: If a key is compromised, delete it immediately and create a new one
4. **Use Descriptive Names**: Name your keys by purpose (e.g., "iPhone", "Work Laptop") so you can identify and revoke specific keys if needed
5. **Monitor Usage**: Check the "Last Used" column to identify unused or suspicious keys
6. **External Auth Proxies**: If using Cloudflare Zero Trust, Authelia, or similar, you'll need to bypass authentication for `/api/videos/download`. This is safe only while Youtarr's own authentication is on: with `AUTH_ENABLED=false`, Youtarr skips the API key check entirely, and the bypass leaves the endpoint open to anyone who can reach it. See [Troubleshooting](#cors-error--blocked-by-external-auth-cloudflare-zero-trust-authelia-etc) for setup instructions.

## Troubleshooting

### "Not YouTube" Alert
The bookmarklet only works on youtube.com or youtu.be pages. Make sure you're on a video page.

### "Connection failed" Alert
- Check your Youtarr server is running and accessible
- Verify the server URL in your bookmarklet is correct
- Check browser console for CORS errors

### 401 Unauthorized
- Verify your API key is correct and active
- Check the key hasn't been deleted

### 429 Rate Limited
- Wait a minute before trying again
- Consider increasing the rate limit in Settings -> API Keys & Bookmarklet

### CORS Error / Blocked by External Auth (Cloudflare Zero Trust, Authelia, etc.)

If you're running Youtarr behind an authentication proxy like Cloudflare Zero Trust, Authelia, or similar, bookmarklets and external API calls will fail with CORS errors because:

1. The bookmarklet runs from `youtube.com` (cross-origin)
2. Browser sends a preflight OPTIONS request (no auth headers)
3. Your auth proxy blocks the request before it reaches Youtarr

**Solution for Cloudflare Zero Trust:**

1. Go to **Zero Trust Dashboard → Access → Applications**
2. Create a **new application** for the API endpoint:
   - **Application URL**: `yourdomain.com/api/videos/download`
3. Add a policy with:
   - **Action**: **Bypass** (not "Allow" - Allow still requires authentication)
   - **Selector**: Everyone
4. Save the application

The `/api/videos/download` endpoint is still protected by Youtarr's API key authentication, so this bypass is safe **as long as Youtarr's own authentication is enabled**.

> **Warning**: If you run Youtarr with `AUTH_ENABLED=false` and rely on the proxy for all authentication (see [Authentication](AUTHENTICATION.md)), Youtarr accepts every request without checking the API key. Bypassing the proxy for this path then lets anyone who can reach your server queue downloads. Keep Youtarr's authentication on if you add this bypass.

**Solution for other auth proxies (Authelia, Authentik, etc.):**

Configure your proxy to skip authentication for the `/api/videos/download` path. The exact configuration varies by proxy - consult your proxy's documentation for path-based bypass rules.

The Sonarr/Radarr bridge needs the same kind of bypass for the `/arr/` path, because Sonarr and Radarr can't log in either. See [Sonarr and Radarr](SONARR_RADARR.md#login-proxies).


### Live video status

Authenticated web clients can read `GET /api/jobs/video-activity` for `{ instanceId, revision, videos }`. Each `videos` entry is keyed by YouTube ID and contains `{ jobId, state }`, where state is `queued` or `downloading`. The `videoActivityUpdated` WebSocket event signals that clients should refresh this snapshot. Re-fetch on reconnect; a changed `instanceId` indicates a server restart and resets revision ordering.

`POST /api/videos/local-status` accepts `{ "youtubeIds": ["dQw4w9WgXcQ"] }` (up to 500 IDs) and returns `{ results }` containing local download status and file metadata. It does not contact YouTube. Use it to refresh search results after downloads finish.
