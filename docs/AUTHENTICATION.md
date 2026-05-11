# Authentication Setup and Management

This document covers all aspects of authentication in Youtarr, including initial setup, configuration options, troubleshooting, and security best practices.

## Table of Contents
- [Overview](#overview)
- [Initial Setup](#initial-setup)
- [Authentication Methods](#authentication-methods)
- [API Keys](#api-keys)
- [Session Management](#session-management)
- [Password Management](#password-management)
- [Plex OAuth Integration](#plex-oauth-integration)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Youtarr implements a secure authentication system to protect your instance from unauthorized access. Authentication is required by default and can be configured through multiple methods.

### Key Features
- Local username/password authentication
- Bcrypt password hashing
- Session-based authentication with 7-day expiry
- **API Keys for external integrations** (bookmarklets, mobile shortcuts, automation)
- Plex OAuth for API token retrieval
- Optional authentication bypass for platform deployments

## Initial Setup

### Method 1: Web UI Setup with One-Time Token

On first launch, Youtarr generates a one-time setup token and surfaces it through two channels: your container logs and a file in your data volume. You can complete setup from localhost, your trusted LAN, a VPN, or an SSH tunnel.

1. Retrieve the setup token. Either:
   - **From container logs:** `docker logs youtarr` (look for the "Youtarr initial setup required" log entry; the token-bearing entry is emitted at `LOG_LEVEL=info`), or
   - **From the data volume:** read `config/setup-token` on the host (mounted from the container's `/app/config/setup-token`). The file is written with mode `0600`, so if your container runs as a UID that does not match your host user (for example, the container runs as root or as `YOUTARR_UID=1000` while you log in as a different user), the read will fail with "Permission denied". Use `sudo cat /path/to/youtarr/config/setup-token`, or fall back to the container-logs path above.

2. Open Youtarr in a browser, e.g. `http://localhost:3087` or `http://<your-LAN-IP>:3087`.

3. Complete the setup wizard:
   - Paste the setup token (64 hex characters)
   - Enter desired username (1-32 characters)
   - Enter password (8-64 characters)
   - Confirm password

4. The token is consumed on success. Credentials are saved to `config/config.json`.

Knowledge of the token requires either Docker access (for the logs) or filesystem access to the data volume (for the file), both of which already imply admin status on the host. The token survives container restarts while setup is incomplete, so you have time to fetch it.

If you wipe or recreate the `config/` volume, Youtarr loses the saved credentials and setup token state; run initial setup again on the next boot.

Plain HTTP is intended for localhost and private LAN/VPN access only. Do not expose Youtarr setup or login directly to the internet over HTTP; put it behind HTTPS and normal network controls first.

Treat startup logs as sensitive while setup is incomplete. If you ship container logs to Loki, Splunk, CloudWatch, or another external system, redact or drop the `setupToken` field/log entry until the one-time setup token has been consumed. When `LOG_LEVEL=warn`, Youtarr logs setup guidance without the token; use `config/setup-token` to retrieve the token in that mode.

### Method 2: Environment Variables (Headless/Automated)

For remote or automated deployments:

**IMPORTANT**: If `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` do not meet minimum length requirements they will be ignored!

1. Add to `.env` file:
   ```bash
   AUTH_PRESET_USERNAME=admin                 # Min 1 character
   AUTH_PRESET_PASSWORD=your-secure-password  # Min 8 characters
   ```

2. Start Youtarr:
   `./start.sh` or `docker compose up -d`

3. Credentials are automatically configured

**Note**: Environment variables override existing credentials on each restart.

### Method 3: Interactive Headless Setup

Using the start script:
```bash
./start.sh --headless-auth
```
- Prompts for username and password
- Saves to `.env` as AUTH_PRESET variables
- Starts container with configured credentials

## Authentication Methods

### Local Authentication

#### How It Works
1. Username and password stored in `config/config.json`
2. Password hashed using bcrypt (10 rounds)
3. Session created upon successful login
4. Token stored in browser `localStorage` (`authToken`) and attached to subsequent API calls via the `x-access-token` header

#### Configuration Fields
```json
{
  "username": "admin",
  "passwordHash": "$2b$10$..."
}
```

### Platform Authentication (AUTH_ENABLED=false)

For deployments behind external authentication or not exposed to the internet:

1. Set in `.env`:
   ```bash
   AUTH_ENABLED=false
   ```

2. Youtarr bypasses internal authentication, no auth will be required to access Youtarr.

**Warning**: Only disable when using:
- VPN access
- Reverse proxy with authentication
- Platform auth (Cloudflare Access, Authelia, etc.)
- Never expose to internet without protection!

## API Keys

API Keys provide persistent authentication for external integrations like bookmarklets, mobile shortcuts, and automation tools.

### Key Features
- **Persistent**: No expiration (unlike session tokens)
- **Scoped**: Limited to single video downloads only
- **Secure**: SHA-256 hashed, stored securely
- **Rate Limited**: Configurable requests per minute
- **Revocable**: Can be deleted instantly if compromised

### Current Limitations
- API keys can only download **individual videos**
- Playlists, channels, and batch operations require the web UI
- Maximum of 20 active API keys per instance

### Creating API Keys

1. Navigate to **Configuration** in the web UI
2. Scroll to **API Keys & External Access**
3. Click **Create Key**
4. Enter a descriptive name (e.g., "iPhone Shortcut", "Bookmarklet")
5. **Important**: Copy and save the key immediately - it will not be shown again!

### Using API Keys

Include the API key in the `x-api-key` header:

```bash
curl -X POST https://your-server.com/api/videos/download \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### Security Best Practices
- **Use HTTPS**: API keys are transmitted in headers; use HTTPS to protect them
- **Descriptive Names**: Name keys by purpose (e.g., "Work Laptop", "iPhone") for easy identification
- **Monitor Usage**: Check "Last Used" to identify suspicious or unused keys
- **Rotate If Compromised**: Delete and recreate keys if you suspect exposure
- **Don't Share Keys**: Each user/device should have its own key

### API Key Management

#### Via Web UI
- View all keys in Configuration → API Keys & External Access
- Delete keys by clicking the trash icon
- See last usage time for each key

#### Via Database (Advanced)
```bash
# List active API keys
docker exec youtarr-db mysql -u root -p123qweasd youtarr -e "
SELECT id, name, key_prefix, created_at, last_used_at
FROM ApiKeys
WHERE is_active = 1;
"

# Revoke a key by ID
docker exec youtarr-db mysql -u root -p123qweasd youtarr -e "
UPDATE ApiKeys SET is_active = 0 WHERE id = 1;
"
```

For detailed API documentation and examples (bookmarklets, mobile shortcuts, Python, cURL, etc.), see [API Integration Guide](API_INTEGRATION.md).

## Session Management

### Session Configuration
- **Duration**: 7 days
- **Storage**: Database table `Sessions`
- **Browser storage**: Token persisted as `authToken` in `localStorage`
- **Client header**: Token forwarded on each API request via `x-access-token`

### Session Security
- Sessions expire after 7 days
- Automatic cleanup of expired sessions (daily at 3 AM)
- Password changes do **not** automatically revoke existing sessions—use the Sessions UI or the SQL commands below to force a logout
- Multiple concurrent sessions per user are supported (each browser/device maintains its own token)

### Manual Session Management

#### View Active Sessions
```bash
docker exec youtarr-db mysql -u root -p123qweasd youtarr -e "
SELECT id, session_token, username, expires_at, is_active
FROM Sessions
WHERE expires_at > NOW()
  AND is_active = 1;
"
```

#### Clear All Sessions (Force Re-login)
```bash
docker exec youtarr-db mysql -u root -p123qweasd youtarr -e "
DELETE FROM Sessions;
"
```

## Password Management

### Changing Password via UI

1. Log in to Youtarr
2. Navigate to Configuration
3. Click "Change Password"
4. Enter current password
5. Enter new password (8-64 characters)
6. Confirm new password
7. Save changes

### Reset Forgotten Password if locked out of Youtarr

#### Option 1: Environment Variables
1. Stop Youtarr:
   `./stop.sh` or `docker compose down`

2. Edit `.env`:
   ```bash
   AUTH_PRESET_USERNAME=admin
   AUTH_PRESET_PASSWORD=new-password
   ```

3. Restart:
   `./start.sh` or `docker compose up -d`

4. Log in with new credentials, they will be saved to `config/config.json`

5. (Optional) Remove from `.env` after login and restart Youtarr to allow changing credentials through web UI

#### Option 2: Direct Config Edit
1. Stop Youtarr:
   `./stop.sh` or `docker compose down`

2. Edit `config/config.json`:
   - Delete `username` and `passwordHash` lines
     - *Ensure that your .json file is valid, the last item in the json config cannot have a trailing comma.*

3. Restart:
   `./start.sh` or `docker compose up -d`

4. Open Youtarr and set new credentials with the one-time setup token from the container logs or `config/setup-token`

### Remote Access for Initial Setup

#### SSH Port Forwarding

> SSH port forwarding is no longer required for security reasons (the localhost gate has been removed). It remains useful as a way to retrieve the setup token over a secure channel if you don't want to enable HTTPS for your Youtarr instance yet.

**From Windows:**
```bash
# PowerShell or Command Prompt
ssh -L 3087:localhost:3087 username@server-ip
# Open http://localhost:3087 in browser
```

**From Linux/Mac:**
```bash
ssh -L 3087:localhost:3087 username@server-ip
# Open http://localhost:3087 in browser
```

This creates a secure tunnel for initial setup.

## Plex OAuth Integration

### Purpose
Plex OAuth is used to obtain API tokens for Plex integration, not for Youtarr authentication.

### Setup Process

1. Navigate to Configuration page
2. Click "Get Key" next to Plex API Key field
3. Redirected to Plex authentication
4. Log in with Plex account (must be server admin)
5. Authorize Youtarr
6. Token automatically populated
7. Save configuration

### Manual Token Retrieval

If OAuth fails, get token manually:
1. Visit [Plex Token Guide](https://www.plexopedia.com/plex-media-server/general/plex-token/)
2. Follow instructions to get X-Plex-Token
3. Enter token in Configuration page
4. Save changes

### Token Management

#### Revoke Token
```bash
# Stop Youtarr
./stop.sh

# Clear token from config
# Edit config/config.json, set: "plexApiKey": ""

# Restart
./start.sh
```

## Security Best Practices

### Strong Passwords
- Minimum 8 characters (enforced)
- Use mix of upper/lowercase, numbers, symbols
- Avoid dictionary words
- Consider using password manager

### Environment Security

1. **Protect .env file**:
   ```bash
   chmod 600 .env
   ```

2. **Protect config directory**:
   ```bash
   chmod 700 config
   chmod 600 config/config.json
   ```

### Network Security

1. **Keep HTTP local**:
   - Plain HTTP is acceptable for localhost, a private LAN, VPN, or SSH tunnel
   - Do not port-forward Youtarr directly to the internet over HTTP

2. **Use HTTPS with reverse proxy for external access**:
   - Nginx/Caddy/Traefik with SSL
   - Let's Encrypt certificates

3. **Firewall rules**:
   ```bash
   # Allow only local network
   iptables -A INPUT -p tcp --dport 3087 -s 192.168.0.0/16 -j ACCEPT
   iptables -A INPUT -p tcp --dport 3087 -j DROP
   ```

4. **VPN Access**:
   - Use WireGuard/OpenVPN for remote access
   - Avoid exposing to internet directly

5. **Proxy trust**:
   - Youtarr keeps the historical `TRUST_PROXY=true` default for compatibility with existing reverse-proxy installs
   - Youtarr's own rate-limit, session, and setup audit IPs use the direct peer IP until `TRUST_PROXY` is explicitly configured
   - Set `TRUST_PROXY=false` when exposing the app directly without a reverse proxy
   - Set `TRUST_PROXY` to a specific hop count or trusted subnet when your reverse proxy setup needs forwarded client IPs

### Authentication Hardening

1. **Change default credentials immediately**
2. **Use unique username** (not "admin")
3. **Enable fail2ban** for brute force protection
4. **Monitor access logs**:
   ```bash
   docker logs youtarr | grep "Login"
   ```

## Troubleshooting

### Cannot Find the Setup Token

**Problem**: First-time setup wizard asks for a token and you don't know where to find it.

**Solutions**:
1. **Container logs:** `docker logs youtarr | grep -A5 "initial setup required"`. The token-bearing setup log entry is emitted at `LOG_LEVEL=info` on every startup until setup completes.
2. **Data volume:** the token is also written to `config/setup-token` (mode 0600) in your data volume. From the host: `cat /path/to/youtarr/config/setup-token`. If you see "Permission denied", the container is running as a UID that does not match your host user; use `sudo cat ...` or retrieve the token from the container logs (option 1 above) instead.
3. **Lost before setup is complete?** Stop Youtarr, delete `config/setup-token`, restart. A new token will be generated and logged.
4. **Already completed setup and need to reset?** Stop Youtarr, remove `username` and `passwordHash` from `config/config.json`, restart, then complete setup again with the newly generated token.
5. **Headless without log access?** Use the env-var path instead: set `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` in `.env` (see Method 2 above).

### Invalid Credentials Error

**Causes**:
1. Incorrect username or password
2. Caps Lock enabled
3. Leading/trailing spaces in credentials

**Debug**:
```bash
# Check if credentials exist
docker exec youtarr cat /app/config/config.json | grep username
```

### Session Expired

**Symptoms**:
- "Invalid or expired token" error
- Redirected to login page

**Solutions**:
1. Log in again (normal after 7 days)
2. Clear the `authToken` entry (Site Data / Local Storage) for the Youtarr origin if the browser continues to reuse an expired token
3. Check system time synchronization

### Authentication Loop

**Problem**: Repeatedly redirected to login

**Causes**:
1. Stale `authToken` cached in browser storage
2. Reverse proxy misconfiguration
3. Session storage full

**Solutions**:
1. Clear the `authToken` value from browser storage (or choose "Log out" to request a new session)
2. Check reverse proxy headers:
   ```nginx
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Real-IP $remote_addr;
   ```
