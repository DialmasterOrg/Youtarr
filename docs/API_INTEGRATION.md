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

## Overview

Youtarr provides an API endpoint that allows you to add YouTube videos to your download queue from external tools. This enables workflows like:

- **Browser Bookmarklet**: One-click download while browsing YouTube
- **Apple Shortcuts**: Share videos from the YouTube app on iOS
- **Android Tasker/Automate**: Automated download workflows
- **Home Assistant/n8n**: Smart home and automation integrations
- **CLI Scripts**: Batch download operations

## Authentication

### API Keys

API keys are the recommended authentication method for external integrations. They provide:

- Persistent access (no expiration)
- Scoped permissions (download endpoint only)
- Easy revocation if compromised
- Rate limiting per key

#### Creating an API Key

1. Navigate to **Configuration** in Youtarr
2. Scroll to **API Keys & External Access**
3. Click **Create Key**
4. Enter a descriptive name (e.g., "iPhone Shortcut", "Bookmarklet")
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

Add a YouTube video to the download queue.

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

**Success Response (200):**
```json
{
  "success": true,
  "message": "Video queued for download",
  "video": {
    "title": "Video Title",
    "thumbnail": "https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg",
    "duration": 360
  }
}
```

**Error Responses:**

| Status | Response | Description |
|--------|----------|-------------|
| 400 | `{"success": false, "error": "URL is required"}` | Missing or invalid URL |
| 401 | `{"error": "Invalid API key"}` | Invalid or missing authentication |
| 403 | `{"error": "API keys can only access the download endpoint"}` | API key used on wrong endpoint |
| 429 | `{"success": false, "error": "Rate limit exceeded"}` | Too many requests |

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

You can adjust this limit in **Configuration → API Keys & External Access → Rate Limit**.

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
- Consider increasing the rate limit in Configuration

