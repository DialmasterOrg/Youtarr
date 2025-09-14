# Development Guide

## Prerequisites

For development, you'll need:

1. **Node.js** (v18 or higher) and npm
2. **Docker** and Docker Compose (for database)
3. **Git** for version control
4. A code editor (VS Code recommended)

## Project Structure

```
Youtarr/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── types/       # TypeScript definitions
│   │   └── providers/   # Context providers
│   └── package.json
├── server/              # Node.js backend
│   ├── models/          # Sequelize models
│   ├── modules/         # Business logic
│   ├── db.js           # Database connection
│   └── server.js       # Express server
├── migrations/          # Database migrations
├── config/             # Configuration files
├── scripts/            # Utility scripts
└── docker-compose.yml  # Docker configuration
```

## Development Setup

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/dialmaster/Youtarr.git
cd Youtarr

# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Database Setup

For development, you can run just the database in Docker:

```bash
# Start only the database container
npm run start:db
```

This starts MariaDB on port 3321.

### 3. Configuration

Run the setup script to configure the YouTube download directory:
```bash
./setup.sh
```

### 4. Environment Variables

Create a `.env` file in the root directory:
```env
DB_HOST=localhost
DB_PORT=3321
DB_USER=root
DB_PASSWORD=123qweasd
DB_NAME=youtarr
NODE_ENV=development
```

## Running in Development Mode

### Option 1: Full Development Mode (Recommended)

```bash
# Run both frontend and backend with hot reload
npm run dev
```

This starts:
- Backend on http://localhost:3011 (with nodemon)
- Frontend on http://localhost:3000 (with webpack dev server)
- WebSocket served on the same HTTP server/port (3011)

### Option 2: Separate Frontend/Backend

**Terminal 1 - Backend**:
```bash
npm run start:dev
```

**Terminal 2 - Frontend**:
```bash
npm run client
```

### Option 3: Production Build Testing

```bash
# Build frontend
npm run build

# Run production server locally
npm start
```

## Available Scripts

### Root Directory Scripts

```bash
npm run dev          # Run full dev environment
npm run start:dev    # Backend only with nodemon
npm run start:db     # Start database container
npm run client       # Frontend dev server
npm run build        # Build frontend for production
npm run lint         # Run ESLint on all code
npm test            # Run tests
```

### Database Scripts

```bash
# Create a new migration
npm run db:migrate:create -- --name your-migration-name

# Run migrations
npm run db:migrate

# Undo last migration
npm run db:migrate:undo

# Check database status
./scripts/check-database-charset.sh
```

## Code Style and Linting

### ESLint Configuration

The project uses ESLint for code quality. Configuration is in `.eslintrc.json`.

```bash
# Lint all code
npm run lint

# Lint with auto-fix
npm run lint -- --fix

# Lint specific directory
npx eslint server/ --fix
```

### Pre-commit Hooks

Husky is configured to run linting before commits. To bypass (not recommended):
```bash
git commit --no-verify
```

## Testing

### Frontend Tests

```bash
cd client
npm test                 # Run tests in watch mode
npm test -- --coverage   # With coverage report
npm test -- --watchAll=false  # Run once
```

### Backend Tests

Backend tests use Jest at the repo root:
```bash
# Run all tests (backend + frontend)
npm test

# Backend only
npm run test:backend

# Coverage (backend + frontend)
npm run test:coverage
```

## Database Development

### Working with Migrations

```bash
# Create a new migration
cd server
npx sequelize-cli migration:generate --name add-new-feature

# Run pending migrations
npx sequelize-cli db:migrate

# Undo last migration
npx sequelize-cli db:migrate:undo

# Undo all migrations
npx sequelize-cli db:migrate:undo:all
```

### Database Schema

Key tables:
- `config` - Application configuration
- `channels` - YouTube channels
- `videos` - Downloaded videos
- `jobs` - Background job queue
- `sessions` - User sessions (new)

### Direct Database Access

```bash
# Development database
mysql -h localhost -P 3321 -u root -p123qweasd youtarr

# Docker database
docker exec -it youtarr-db mysql -u root -p123qweasd youtarr
```

## API Development

### API Endpoints

Key endpoints (all require authentication except setup):

- Setup: `GET /setup/status`, `POST /setup/create-auth`
- Auth: `POST /auth/login`, `POST /auth/logout`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/change-password`, `GET /auth/validate`
- Config: `GET /getconfig`, `POST /updateconfig`, `GET /storage-status`, `GET /getCurrentReleaseVersion`
- Channels: `GET /getchannels`, `POST /updatechannels`, `POST /addchannelinfo`, `GET /getchannelinfo/:channelId`, `GET /getchannelvideos/:channelId`
- Downloads/Jobs: `POST /triggerspecificdownloads`, `POST /triggerchanneldownloads`, `GET /jobstatus/:jobId`, `GET /runningjobs`, `GET /getVideos`
- Plex: `GET /getplexlibraries`, `GET /plex/auth-url`, `GET /plex/check-pin/:pinId`

### Authentication

All API endpoints (except setup and login) require authentication:
```javascript
headers: {
  'x-access-token': 'session-token-here'
}
```

### WebSocket Events

WebSocket shares the HTTP port (3011) and emits broadcast messages including:
- `downloadProgress` - Download progress updates
- `downloadComplete` - Video download finished (with list)
- `channelsUpdated` - Channel list or metadata changed

## Frontend Development

### Component Structure

```
components/
├── ChannelManager.tsx     # Channel management
├── Configuration.tsx       # App settings
├── DownloadManager/       # Download queue
├── InitialSetup.tsx       # First-time setup (new)
├── LocalLogin.tsx         # Login form (new)
├── Navigation.tsx         # App navigation
└── VideosPage.tsx         # Video browser
```

### State Management

- React Context for WebSocket connection
- Local state for component data
- Session token in localStorage

### TypeScript

Type definitions in `client/src/types/`:
- Strict typing for all components
- Interface definitions for API responses
- Proper error handling types

## Debugging

### Backend Debugging

1. **VS Code Debug Configuration**:

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/server/server.js",
      "envFile": "${workspaceFolder}/.env"
    }
  ]
}
```

2. **Console Debugging**:
```javascript
console.log('Debug info:', variable);
debugger; // Breakpoint
```

### Frontend Debugging

1. React Developer Tools browser extension
2. Redux DevTools (if using Redux)
3. Network tab for API calls
4. Console for errors and logs

### Database Debugging

Enable Sequelize logging:
```javascript
// In db.js
const sequelize = new Sequelize({
  // ... other config
  logging: console.log  // Enable SQL logging
});
```

## Contributing

### Git Workflow

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature
   ```

3. Make changes and commit:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

4. Push and create pull request

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
- [ ] Tests pass (if applicable)
- [ ] Database migrations included (if needed)
- [ ] Documentation updated
- [ ] No sensitive data in commits
- [ ] Follows existing code style

## Building for Production

### Docker Build

```bash
# Build Docker image
docker build -t youtarr:local .

# Test locally
docker run -p 3087:3011 youtarr:local
```

### Manual Build

```bash
# Install production dependencies
npm ci --production

# Build frontend
npm run build

# Start production server
NODE_ENV=production npm start
```

## Troubleshooting Development Issues

### Port Already in Use

```bash
# Find process using port
lsof -i :3011  # Mac/Linux
netstat -ano | findstr :3011  # Windows

# Kill process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

### Database Connection Issues

1. Check database is running:
   ```bash
   docker ps | grep youtarr-db
   ```

2. Verify credentials in `.env`

3. Test connection:
   ```bash
   mysql -h localhost -P 3321 -u root -p123qweasd
   ```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Same for frontend
cd client
rm -rf node_modules package-lock.json
npm install
```

## Performance Profiling

### Backend Profiling

```javascript
// Add to server.js for request timing
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

## Security Considerations

### Development Security

- Never commit `.env` files
- Use environment variables for secrets
- Sanitize user inputs
- Validate all API inputs
- Use prepared statements for SQL
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
