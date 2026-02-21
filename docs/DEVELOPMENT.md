# Development Guide

## Prerequisites

For development, you'll need:

1. **Node.js 20.19+ and npm** (needed for the build script that compiles the client and installs dependencies before Docker runs)
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
git clone https://github.com/DialmasterOrg/Youtarr.git
cd Youtarr
```

### 2. Build Development Environment
```bash
# Install root dependencies
npm i

# First build (installs dependencies and builds the client)
./scripts/build-dev.sh --install-deps

# Subsequent builds (after code changes)
./scripts/build-dev.sh
```

Optional flags:
- `--install-deps` - Runs `npm install` in the root and `client/` before building (required on a clean clone or after dependency changes)
- `--no-cache` - Force rebuild to get latest yt-dlp version
- `SKIP_DEV_IMAGE_PRUNE=1` - Skip automatic cleanup of old untagged `youtarr-dev` images (pruning is enabled by default to keep Docker storage from filling)

The script runs `npm run build` for the client and then invokes `docker build`, so make sure Node.js 20.19+ and npm are available locally.

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

**Step 1: Full Docker Development**

Build and run the full stack using the pre-built static frontend served by the app container.

```bash
# Start both app and database containers (serves static frontend)
./scripts/start-dev.sh
```

This starts:
- **Backend** on http://localhost:3011 (Node.js Express server with `--watch` for auto-restart)
- **Frontend (static, served by the app container)** on http://localhost:3087
- **MariaDB** database on port 3321

Optional flags:
- `--no-auth` - Disable authentication (only use behind auth gateway or if not exposed outside your network)
- `--debug`   - Set logging level to "debug" (defaults to `info`)

**Step 2: Vite Dev Server (Hot Module Reload — optional)**

For faster, iterative frontend development you can run the Vite dev server with HMR. This is optional; run it when you want instant frontend reloads while developing UI.

```bash
# Terminal 1: Start backend in Docker
./scripts/start-dev.sh

# Terminal 2: Start Vite dev server (HMR)
cd client
npm run dev
```

Then access:
- **Frontend (HMR)** at http://localhost:3000

The Vite dev server will proxy API and WebSocket requests to the backend at port `3011` so API calls work the same as the full-stack run.

### 5. Storybook (Component Development)

Use Storybook to develop and document components in isolation.

```bash
# Start Storybook Server
npm run storybook
```

Storybook runs on http://localhost:6006. Story validation is done via Jest tests (see `client/src/tests/storybook_coverage.test.js`).

### 6. Access the Application

Navigate to:
- **Docker static build**: http://localhost:3087
- **Vite dev server (if running)**: http://localhost:3000

Create your admin account on first access.

### 7. Stop Development Environment

```bash
./stop.sh
```

## Resetting local development environment
**!IMPORTANT!**: This COMPLETELY resets your local environment and REMOVES all data except your downloaded videos!

**DATABASE AND CONFIGURATION IS REMOVED AND NOT BACKED UP!**

*This can be useful for local development and testing*

```bash
./scripts/reset-server-data.sh
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
  - ./server/images:/app/server/images          # Generated thumbnails
  - ./config:/app/config                        # Configuration files
  -  ./jobs:/app/jobs                           # Job state
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

**Vite Dev Server Workflow (Recommended for Frontend)**

```bash
# Terminal 1: Start backend
./scripts/start-dev.sh

# Terminal 2: Start Vite with HMR
cd client
npm run dev

# Make code changes - frontend updates instantly!
# Backend changes auto-restart via --watch

# View logs
docker compose -f docker-compose.dev.yml logs -f youtarr

# Stop when done
./stop.sh
```

**Full Docker Workflow (For Testing Production Build)**

```bash
# Start development environment
./scripts/start-dev.sh

# Make code changes in your editor

# After making changes, rebuild and restart:
./scripts/build-dev.sh
./scripts/start-dev.sh  # Automatically stops and restarts containers

# View logs
docker compose -f docker-compose.dev.yml logs -f

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

The project uses ESLint for code quality. Configuration is in `.eslintrc.js`.

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

Husky is configured to run linting, typescript checks and tests before commits. To bypass (not recommended):
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

## Database Development

### Working with Migrations

```bash
# Create a new migration
./scripts/db-create-migration.sh migration-name

# Migrations run automatically on container startup
```

### Database Schema

See [DATABASE.md](DATABASE.md)

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

### API Documentation (Swagger)

Youtarr provides interactive API documentation via Swagger UI:

- **Swagger UI**: http://localhost:3087/swagger
- **OpenAPI JSON**: http://localhost:3087/swagger.json

The Swagger documentation includes:
- All available endpoints with request/response schemas
- Authentication requirements
- Try-it-out functionality for testing endpoints
- Request body examples and parameter descriptions

### API Structure

Routes are organized into modular files under `./server/routes/`:

```
server/routes/
├── auth.js       # Authentication endpoints
├── channels.js   # Channel management
├── config.js     # Configuration endpoints
├── health.js     # Health check endpoints
├── jobs.js       # Download job management
├── plex.js       # Plex integration
├── setup.js      # Initial setup endpoints
├── videos.js     # Video management
└── index.js      # Route registration
```

### Key Endpoints

All endpoints require authentication except setup and health checks:

- **Setup:** `GET /setup/status`, `POST /setup/create-auth`
- **Auth:** `POST /auth/login`, `POST /auth/logout`, `GET /auth/sessions`
- **Config:** `GET /getconfig`, `POST /updateconfig`
- **Channels:** `GET /getchannels`, `POST /updatechannels`
- **Downloads:** `POST /triggerspecificdownloads`, `GET /jobstatus/:jobId`
- **Plex:** `GET /getplexlibraries`, `GET /plex/auth-url`
- **Health:** `GET /api/health`, `GET /api/db-status`

For the complete list of 40+ endpoints, see the [Swagger documentation](http://localhost:3087/swagger).

### Authentication

All API endpoints (except setup, login, and health checks) require authentication:
```javascript
headers: {
  'x-access-token': 'session-token-here'
}
```

### Adding New Endpoints

When adding new API endpoints:

1. Add the route to the appropriate file in `./server/routes/`
2. Include JSDoc annotations for Swagger documentation:

```javascript
/**
 * @swagger
 * /api/your-endpoint:
 *   get:
 *     summary: Brief description
 *     description: Detailed description of what the endpoint does.
 *     tags: [CategoryTag]
 *     parameters:
 *       - in: query
 *         name: paramName
 *         schema:
 *           type: string
 *         description: Parameter description
 *     responses:
 *       200:
 *         description: Success response description
 */
router.get('/api/your-endpoint', verifyToken, async (req, res) => {
  // Implementation
});
```

3. The Swagger documentation will automatically update on the next server restart

### WebSocket Events

WebSocket shares the HTTP port (3011 in container, 3087 on host) and emits:
- `downloadProgress` - Download progress updates
- `downloadComplete` - Video download finished
- `channelsUpdated` - Channel list changed

## Contributing

### Branching Strategy

Youtarr uses a **dev → main** branching model:

| Branch | Purpose | Docker Tag |
|--------|---------|------------|
| `main` | Stable, released code | `latest`, `vX.X.X` |
| `dev` | Integration branch for upcoming release | `dev-latest`, `dev-rc.<sha>` |
| `feature/*`, `fix/*` | Individual changes | None |

### Git Workflow

1. **Start from dev branch**:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/your-feature
   ```

2. Make changes and commit:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. Push and create pull request **targeting `dev`** (not `main`)

4. After merge to `dev`, an RC Docker image is automatically built

5. When ready, maintainer creates PR from `dev` → `main` for production release

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
- [ ] PR targets `dev` branch
- [ ] Code passes linting (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Database migrations included (if needed)
- [ ] Documentation updated
- [ ] No sensitive data in commits
- [ ] Follows existing code style

## Building Images

### Docker Build

```bash
# Build local image
./scripts/build-dev.sh

# Test locally
./scripts/start-dev.sh
```

### Release Process

Releases are automated via GitHub Actions with a two-stage workflow:

**Release Candidates (automatic on dev merge):**
1. Merge your PR to `dev` branch
2. RC workflow automatically:
   - Builds multi-arch Docker images (amd64 + arm64)
   - Pushes `dev-latest` and `dev-rc.<sha>` tags to Docker Hub

**Production Releases (automatic on main merge):**
1. Maintainer creates PR from `dev` → `main`
2. After merge, release workflow automatically:
   - Bumps version based on commit messages
   - Updates CHANGELOG.md
   - Creates GitHub release
   - Builds optimized Docker image (~600MB)
   - Pushes `latest` and `vX.X.X` tags to Docker Hub

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
