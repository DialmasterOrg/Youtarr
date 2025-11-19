# Development Guide

## Prerequisites

For development, you'll need:

1. **Node.js 18+ and npm** (needed for the build script that compiles the client and installs dependencies before Docker runs)
2. **Docker** and Docker Compose (v2 or v1)
3. **Git** for version control
4. A code editor (VS Code recommended)

**Note:** Runtime dependencies (MariaDB, yt-dlp, ffmpeg, Node) run inside the dev containers, but the `build-dev` script uses your host Node.js to install packages and build the frontend before the Docker image is created.

## Project Structure

```
Youtarr/
├── client/                                   # React frontend
│   ├── src/
│   │   ├── components/                       # React components
│   │   ├── types/                            # TypeScript definitions
│   │   └── providers/                        # Context providers
│   └── package.json
├── server/                                   # Node.js backend
│   ├── models/                               # Sequelize models
│   ├── modules/                              # Business logic
│   ├── db.js                                 # Database connection
│   └── server.js                             # Express server
├── migrations/                               # Database migrations
├── config/                                   # Configuration files
├── scripts/                                  # Utility scripts
├── docker-compose.external-db.yml            # Config that does not start internal DB (dev & prod)
└── docker-compose.yml                        # Docker Compose configuration with internal db (dev & prod)
```

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/dialmaster/Youtarr.git
cd Youtarr
```

### 2. Build Development Environment

```bash
# First build (installs dependencies and builds the client)
./scripts/build-dev.sh --install-deps

# Subsequent builds (after code changes)
./scripts/build-dev.sh
```

Optional flags:
- `--install-deps` - Runs `npm install` in the root and `client/` before building (required on a clean clone or after dependency changes)
- `--no-cache` - Force rebuild to get latest yt-dlp version

The script runs `npm run build` for the client and then invokes `docker build`, so make sure Node.js 18+ and npm are available locally.

### 3. Configure .env (optional)

- Copy `.env.example` to `.env`
  - This is optional, if not created manually it will be created by the `./scripts/start-dev.sh`
    script
  - Edit `.env` to configure your YOUTUBE_OUTPUT_DIR
    - This will be the directory that is mounted by Youtarr where downloaded videos will be placed
    - It defaults to `./downloads`
  - Leave `AUTH_PRESET_USERNAME` and `AUTH_PRESET_PASSWORD` blank to configure your login via
    UI on first startup (credentials will be saved to `config/config.json`)

### 4. Start Development Environment

```bash
# Start both app and database containers
./scripts/start-dev.sh
```

Optional flags:
- `--no-auth` - Disable authentication (only use behind auth gateway or if not exposed outside your network)
- `--debug`   - Set logging level to "debug" (defaults to `info`)

This starts:
- **Backend/Frontend** on http://localhost:3087 (serves pre-built static React files)
- **WebSocket** on the same HTTP server/port (3087)
- **MariaDB** database on port 3321 (by default, port can be overridden)

**Note:** The development setup serves a production build of the frontend. Code changes require rebuilding (see below).

### 5. Access the Application

Navigate to http://localhost:3087 and create your admin account.

### 6. Stop Development Environment

```bash
./stop.sh
```

## How Docker Development Works

### Build-and-Test Workflow

The development setup is a "build-and-test-in-Docker" workflow that ensures your code works in a containerized environment:

**Build Phase** (`./scripts/build-dev.sh`):
1. Runs `npm install` on your host (if `--install-deps` is used)
2. Builds the React frontend (`npm run build` in client directory) - creates production build
3. Builds a Docker image with the pre-built static files

**Runtime Phase** (`./scripts/start-dev.sh`):
- Runs the Node.js Express server with `node server/server.js` (no hot reload)
- Serves the pre-built React static files from `/app/client/build`
- Application accessible at http://localhost:3087

### Volume Mounts

The development setup mounts these directories only:

```yaml
volumes:
  - ./server/images:/usr/src/app/server/images  # Generated thumbnails
  - ./config:/usr/src/app/config                # Configuration files
  - ./jobs:/usr/src/app/jobs                    # Job state
```

**Important:** Source code (client/src/, server/*.js) is NOT mounted. This means:
- ❌ No hot reload or live reload
- ❌ Code changes are NOT automatically reflected
- ✅ You must rebuild after every code change

### When to Rebuild

You **must** rebuild (`./scripts/build-dev.sh`) for:
- **Any** frontend code changes (React components, styles, etc.)
- **Any** backend code changes (server.js, modules, etc.)
- Installing new npm dependencies (use `--install-deps` flag)
- Updating system dependencies (yt-dlp, ffmpeg - use `--no-cache` flag)
- Changing Dockerfile
- First time setup

### Benefits of This Approach

- ✅ Tests your code in the actual Docker environment it will run in
- ✅ Catches Docker-specific issues early
- ✅ Consistent behavior between development and production
- ✅ Database runs in Docker (no local MariaDB installation needed)
- ✅ Includes all system dependencies (yt-dlp, ffmpeg)

## Development Workflow

### Daily Development

```bash
# Start development environment
./scripts/start-dev.sh

# Make code changes in your editor

# After making changes, rebuild and restart:
./scripts/build-dev.sh
./scripts/start-dev.sh  # Automatically stops and restarts containers

# View logs
docker compose logs -f

# Stop when done
./stop.sh
```

**Note:** Youtarr only supports the Docker-based workflow described here. Always build and test inside the dev containers rather than trying to run the backend or frontend directly on the host.

### Working with Containers

```bash
# View running containers
docker compose ps

# Execute commands in app container
docker compose exec youtarr bash

# Execute commands in database container
docker compose exec youtarr-db bash

# Restart a specific service
docker compose restart youtarr

# View logs for specific service
docker compose logs -f youtarr
docker compose logs -f youtarr-db
```

### Database Access

```bash
# From host
mysql -h localhost -P 3321 -u root -p123qweasd youtarr

# From inside container
docker compose exec youtarr-db mysql -u root -p123qweasd youtarr
```

## Code Style and Linting

### ESLint Configuration

The project uses ESLint for code quality. Configuration is in `.eslintrc.json`.

```bash
# Lint all code
npm run lint

# Lint with auto-fix
npm run lint:fix

# Lint specific areas
npm run lint:frontend
npm run lint:backend

# TypeScript type checking
npm run lint:ts
```

### Pre-commit Hooks

Husky is configured to run linting before commits. To bypass (not recommended):
```bash
git commit --no-verify
```

## Testing

### Running Tests

All tests run on your host machine (not in Docker) since they're isolated unit tests:

```bash
# Run all tests (backend + frontend)
npm test

# Backend tests only
npm run test:backend

# Frontend tests only
npm run test:frontend

# Run with coverage
npm run test:coverage

# Watch mode (backend)
npm run test:watch
```

### Frontend Tests

```bash
cd client
npm test                         # Watch mode
npm test -- --coverage           # With coverage
npm test -- --watchAll=false     # Run once
```

### Test Guidelines

See CLAUDE.md for comprehensive testing guidelines including:
- React Testing Library best practices
- Jest mocking patterns
- Avoiding common linting errors
- Never skip tests policy

## Database Development

### Working with Migrations

```bash
# Create a new migration
./scripts/db-create-migration.sh migration-name

# Or use npm script
npm run db:create-migration -- --name migration-name

# Migrations run automatically on container startup
# To run manually inside container:
docker compose exec youtarr npm run db:migrate
```

### Database Schema

Key tables:
- `config` - Application configuration
- `channels` - YouTube channels
- `videos` - Downloaded videos
- `jobs` - Background job queue
- `jobvideos` - Job-video relationships
- `channelvideos` - Channel-video relationships
- `sessions` - User sessions

### Backend Debugging

**Option 1: Container Debugging with VS Code**

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Docker: Attach to Node",
      "remoteRoot": "/usr/src/app",
      "localRoot": "${workspaceFolder}",
      "protocol": "inspector",
      "port": 9229,
      "restart": true,
      "sourceMaps": true
    }
  ]
}
```

Modify `docker-compose.yml` to expose debug port:
```yaml
ports:
  - "3011:3011"
  - "9229:9229"  # Debug port
command: node --inspect=0.0.0.0:9229 server/server.js
```

**Option 2: Console Debugging**

```javascript
console.log('Debug info:', variable);
debugger; // Breakpoint
```

**Option 3: Exec into Container**

```bash
docker compose exec youtarr bash
# Now you can run commands, inspect files, etc.
```

### Frontend Debugging

1. React Developer Tools browser extension
2. Network tab for API calls
3. Console for errors and logs
4. Source maps are included in the production build for debugging

### Database Debugging

Enable Sequelize logging in `db.js`:
```javascript
const sequelize = new Sequelize({
  // ... other config
  logging: console.log  // Enable SQL logging
});
```

## API Development

### API Endpoints

Key endpoints (all require authentication except setup):

- **Setup:** `GET /setup/status`, `POST /setup/create-auth`
- **Auth:** `POST /auth/login`, `POST /auth/logout`, `GET /auth/sessions`
- **Config:** `GET /getconfig`, `POST /updateconfig`
- **Channels:** `GET /getchannels`, `POST /updatechannels`
- **Downloads:** `POST /triggerspecificdownloads`, `GET /jobstatus/:jobId`
- **Plex:** `GET /getplexlibraries`, `GET /plex/auth-url`

### Authentication

All API endpoints (except setup and login) require authentication:
```javascript
headers: {
  'x-access-token': 'session-token-here'
}
```

### WebSocket Events

WebSocket shares the HTTP port (3011) and emits:
- `downloadProgress` - Download progress updates
- `downloadComplete` - Video download finished
- `channelsUpdated` - Channel list changed

## Contributing

### Git Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature
   ```

2. Make changes and commit:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. Push and create pull request

### Commit Message Convention

Follow conventional commits for automatic versioning:

- `feat:` - New feature (minor version bump)
- `fix:` - Bug fix (patch version bump)
- `docs:` - Documentation only
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build process or auxiliary tool changes
- `BREAKING CHANGE:` - Breaking change (major version bump)

### Code Review Checklist

Before submitting PR:
- [ ] Code passes linting (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Database migrations included (if needed)
- [ ] Documentation updated
- [ ] No sensitive data in commits
- [ ] Follows existing code style

## Building for Production

### Docker Build

```bash
# Build production image
docker build -t youtarr:local .

# Test locally
docker compose up -d
```

### Release Process

Releases are automated via GitHub Actions:

1. Merge changes to `main` branch
2. Go to Actions → "Create Release V2" → Run workflow
3. Workflow will:
   - Bump version based on commit messages
   - Build optimized Docker image (~600MB)
   - Push to Docker Hub with version and latest tags

## Troubleshooting Development Issues

### Containers Won't Start

```bash
# Check container status
docker compose ps

# View logs
docker compose logs

# Rebuild from scratch
docker compose down -v
./scripts/build-dev.sh --no-cache
./scripts/start-dev.sh
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3011  # Mac/Linux
netstat -ano | findstr :3011  # Windows

# Or stop all Docker containers
docker compose down
```

### Database Connection Issues

1. Check database is running:
   ```bash
   docker compose ps youtarr-db
   ```

2. Check database logs:
   ```bash
   docker compose logs youtarr-db
   ```

3. Test connection:
   ```bash
   mysql -h localhost -P 3321 -u root -p123qweasd
   ```

### Code Changes Not Reflected

Code changes **always** require a rebuild since source code is not mounted in the container:

```bash
# Rebuild and restart (start-dev.sh automatically stops first)
./scripts/build-dev.sh
./scripts/start-dev.sh
```

**Note:** This is expected behavior - the development setup builds the code into the image, it doesn't use live file mounting for source code.

### Module Not Found Errors

```bash
# Rebuild with fresh dependencies
./scripts/build-dev.sh --install-deps
```

## Security Considerations

### Development Security

- Never commit `.env` files
- Use environment variables for secrets
- Sanitize user inputs
- Validate all API inputs
- Use prepared statements for SQL (Sequelize handles this)
- Keep dependencies updated

### Security Testing

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Check frontend
cd client && npm audit
```

## Performance Profiling

### Backend Profiling

Add to `server.js` for request timing:
```javascript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} - ${Date.now() - start}ms`);
  });
  next();
});
```

### Frontend Profiling

Use React DevTools Profiler to identify performance bottlenecks.

## Additional Resources

- **[Setup Guide](SETUP.md)** - User installation instructions
- **[Synology Guide](SYNOLOGY.md)** - Synology NAS installation
- **[Media Server Guide](MEDIA_SERVERS.md)** - Plex, Kodi, Jellyfin, Emby setup
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common user issues
- **[Docker Guide](DOCKER.md)** - Production Docker configuration
