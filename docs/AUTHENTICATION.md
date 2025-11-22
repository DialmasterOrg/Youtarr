# Authentication Setup and Management

This document covers all aspects of authentication in Youtarr, including initial setup, configuration options, troubleshooting, and security best practices.

## Table of Contents
- [Overview](#overview)
- [Initial Setup](#initial-setup)
- [Authentication Methods](#authentication-methods)
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
- Plex OAuth for API token retrieval
- Optional authentication bypass for platform deployments

## Initial Setup

### Method 1: Web UI Setup (Localhost Only)

On first launch, Youtarr requires authentication setup from `localhost` for security:

1. Access Youtarr from the same machine:
   ```
   http://localhost:3087
   ```

2. Complete the setup wizard:
   - Enter desired username (3-32 characters)
   - Enter password (8-64 characters)
   - Confirm password

3. Credentials are saved to `config/config.json`

### Method 2: Environment Variables (Headless/Automated)

For remote or automated deployments:

**IMPORTANT**: If `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` do not meet minimum length requirements they will be ignored!

1. Add to `.env` file:
   ```bash
   AUTH_PRESET_USERNAME=admin                 # Min 3 characters
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

4. Access from localhost to set new credentials

### Remote Access for Initial Setup

#### SSH Port Forwarding

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

1. **Use HTTPS with reverse proxy**:
   - Nginx/Caddy/Traefik with SSL
   - Let's Encrypt certificates

2. **Firewall rules**:
   ```bash
   # Allow only local network
   iptables -A INPUT -p tcp --dport 3087 -s 192.168.0.0/16 -j ACCEPT
   iptables -A INPUT -p tcp --dport 3087 -j DROP
   ```

3. **VPN Access**:
   - Use WireGuard/OpenVPN for remote access
   - Avoid exposing to internet directly

### Authentication Hardening

1. **Change default credentials immediately**
2. **Use unique username** (not "admin")
3. **Enable fail2ban** for brute force protection
4. **Monitor access logs**:
   ```bash
   docker logs youtarr | grep "Login"
   ```

## Troubleshooting

### Cannot Access Initial Setup

**Problem**: "Initial setup can only be performed from localhost" error

**Solutions**:
1. Use SSH port forwarding (see above)
2. Use environment variables for headless setup
3. Access from Docker host machine directly

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
