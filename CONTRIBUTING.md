# Contributing to Youtarr

Thank you for your interest in contributing to Youtarr! This document will help you get started with contributing to the project. We welcome contributions of all kinds, from bug fixes and new features to documentation improvements and test coverage.

## Table of Contents

- [Quick Start for Contributors](#quick-start-for-contributors)
- [Ways to Contribute](#ways-to-contribute)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [CI/CD Information](#cicd-information)
- [Testing Guidelines](#testing-guidelines)
- [Database Migrations](#database-migrations)
- [Getting Help](#getting-help)
- [Project Resources](#project-resources)
- [License](#license)

## Quick Start for Contributors

### Prerequisites

- **Docker & Docker Compose** - Required for development and testing
- **Node.js 18+** - For building the application
- **Git** - Version control
- **Bash shell** - Git Bash for Windows users

### Setup

```bash
# Clone the repository
git clone https://github.com/DialmasterOrg/Youtarr.git
cd Youtarr

# Build the development Docker image
./scripts/build-dev.sh

# Start the development environment
./scripts/start-dev.sh

# Access the app at http://localhost:3087
```

For detailed setup instructions and troubleshooting, see the [Development Guide](docs/DEVELOPMENT.md).

## Ways to Contribute

### Bug Reports and Fixes
Found a bug? Check the [GitHub Issues](https://github.com/DialmasterOrg/Youtarr/issues) to see if it's already reported. If not, create a new issue with:
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Docker version, etc.)
- Relevant logs or screenshots

### New Features
Have an idea for a new feature? Open an issue to discuss it before starting development. This helps ensure the feature aligns with the project's direction and prevents duplicate work.

### Documentation Improvements
Documentation is crucial for user adoption. Contributions that improve clarity, fix errors, or add missing information are highly valued. This includes:
- Installation and setup guides
- Configuration documentation
- Troubleshooting guides
- Code comments and inline documentation

### Test Coverage Improvements
We maintain a 70% minimum test coverage threshold. Contributions that add tests for uncovered code or improve existing tests are welcome.

### Platform and Media Server Support
Help expand platform compatibility (new NAS systems, architectures) or improve media server integrations (Plex, Kodi, Jellyfin, Emby).

## Development Workflow

Youtarr uses a **Docker-based build-and-test workflow**. This is different from typical Node.js development:

- **No hot reload**: Code changes require rebuilding the Docker image
- **Build-test-iterate cycle**: Make changes → rebuild → test in Docker
- **Production-like environment**: Ensures consistency between development and production

### Development Commands

```bash
# Build the development image (after making code changes)
./scripts/build-dev.sh

# Start the development environment
./scripts/start-dev.sh

# View logs
docker compose logs -f

# Stop the environment
./stop.sh
```

### Running Tests

**Always run tests from the project root:**

```bash
# Run all tests
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run specific test file
npm run test:frontend -- client/src/hooks/__tests__/useStorageStatus.test.ts
npm run test:backend -- server/modules/__tests__/videosModule.test.js
```

**Important**: Tests run on your host machine (not in Docker) since they're isolated unit tests. The Docker environment is for integration testing and running the full application.

For more details on the development setup, see [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Coding Standards

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) format, which automatically determines version bumps:

- `feat:` - New feature (triggers **minor** version bump)
- `fix:` - Bug fix (triggers **patch** version bump)
- `docs:` - Documentation only changes
- `style:` - Code style changes (formatting, whitespace)
- `refactor:` - Code refactoring without behavior changes
- `test:` - Adding or updating tests
- `chore:` - Build process, dependencies, tooling
- `BREAKING CHANGE:` - In commit body or footer (triggers **major** version bump)

**Examples:**

```
feat: add support for multi-language subtitles

fix: resolve database connection timeout on startup

docs: update installation guide with troubleshooting steps

test: add integration tests for download module
```

### Code Style

- **ESLint**: Enforced for both frontend (TypeScript/React) and backend (Node.js)
- **TypeScript**: Full type checking required for frontend code
- **Indentation**: 2 spaces
- **Line endings**: Unix (LF)
- **Quotes**: Single quotes preferred
- **Semicolons**: Required

Code style is automatically checked by pre-commit hooks and CI.

### Testing Requirements

- **Minimum Coverage**: 70% for both frontend and backend
- **Current Coverage**: 84% backend, 83% frontend
- **All tests must pass**: No skipped tests allowed (`test.skip()` is not permitted)
- **React Testing Library**: Use Testing Library queries, avoid direct DOM access

### Pre-commit Hooks

Husky automatically runs these checks before each commit:
1. ESLint (frontend and backend)
2. TypeScript type checking
3. Frontend tests

If any check fails, the commit is blocked. Fix the issues and try again.

## Branching Strategy

Youtarr uses a **dev → main** branching model to ensure stable releases:

```
feature/xxx ──┐
              │
feature/yyy ──┼──→ dev (bleeding edge) ──→ main (stable releases)
              │
fix/zzz ──────┘
```

### Branch Overview

| Branch | Purpose | Docker Tag |
|--------|---------|------------|
| `main` | Stable, released code | `latest`, `vX.X.X` |
| `dev` | Integration branch for upcoming release | `dev-latest`, `dev-rc.<sha>` |
| `feature/*`, `fix/*` | Individual changes | None |

### Workflow Summary

1. **Feature development**: Branch from `dev`, create PR back to `dev`
2. **RC builds**: Merging to `dev` automatically builds release candidate images
3. **Releases**: PR from `dev` → `main` triggers a full release
4. **Hotfixes**: Can merge directly to `main` (then merge back to `dev`)

## Pull Request Process

### Before Submitting

1. **Create a feature branch** from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes** following the coding standards above

3. **Test thoroughly**:
   - Run all tests locally and ensure they pass
   - Test in the Docker environment (`./scripts/build-dev.sh && ./scripts/start-dev.sh`)
   - Verify coverage meets the 70% threshold

4. **Update documentation** if you've:
   - Changed configuration options
   - Added new features
   - Modified setup/installation steps
   - Changed environment variables

### Submitting Your PR

When you're ready, push your branch and create a pull request **targeting the `dev` branch** on GitHub. Your PR will be reviewed by the maintainer.

**PR Checklist:**

- [ ] PR targets `dev` branch (not `main`)
- [ ] Tests pass locally (`npm test`)
- [ ] Coverage meets 70% threshold
- [ ] Conventional commit format used
- [ ] ESLint passes (`npm run lint`)
- [ ] TypeScript compiles without errors (`npm run lint:ts`)
- [ ] Documentation updated if needed
- [ ] Tested in Docker environment
- [ ] No commented-out code or debug statements

### What Happens Next

1. **Automated CI checks** run on your PR:
   - ESLint (frontend + backend)
   - TypeScript type checking
   - Backend tests (70% coverage required)
   - Frontend tests (70% coverage required)
   - Coverage report posted as PR comment

2. **Code review** by the maintainer
   - Feedback may be provided for improvements
   - Additional changes may be requested

3. **Merge to dev**
   - Once approved, your PR is merged to `dev`
   - A release candidate (RC) Docker image is automatically built
   - RC images are tagged as `dev-latest` and `dev-rc.<commit-sha>`

4. **Release to main**
   - When ready, the maintainer creates a PR from `dev` → `main`
   - Merging to `main` triggers the full release workflow
   - Version bumps are automatic based on commit message prefixes
   - Production Docker images are tagged as `latest` and `vX.X.X`

## CI/CD Information

### Checks on Pull Requests

Every PR (to `dev` or `main`) triggers automated checks:

- **ESLint**: Code style and linting
- **TypeScript**: Type checking and compilation
- **Backend Tests**: Jest tests with coverage reporting
- **Frontend Tests**: React Testing Library tests with coverage
- **Coverage Thresholds**: Both frontend and backend must maintain 70% coverage

### Coverage Reporting

The CI system automatically posts a coverage report as a comment on your PR, showing:
- Current coverage percentages
- Coverage changes from the base branch
- Which files are covered/uncovered

### Interpreting CI Failures

If CI checks fail:

1. **ESLint failures**: Run `npm run lint` locally to see errors
2. **TypeScript errors**: Run `npm run lint:ts` to check types
3. **Test failures**: Run `npm test` to see which tests failed
4. **Coverage drops**: Add tests to increase coverage above 70%

### Release Candidate Builds (dev branch)

When code is merged to `dev`, an RC build is automatically triggered:
- Builds multi-architecture Docker images (amd64 + arm64)
- Pushes to Docker Hub with tags:
  - `dialmaster/youtarr:dev-latest` (always the latest dev build)
  - `dialmaster/youtarr:dev-rc.<commit-sha>` (specific RC build)

These RC images allow testing bleeding-edge features before stable release.

### Production Releases (main branch)

When code is merged from `dev` to `main`, a production release is triggered:
- Analyzes conventional commit messages to determine version bump
- Updates version in `package.json`
- Generates `CHANGELOG.md` entries
- Creates GitHub release with release notes
- Builds multi-architecture Docker images (amd64 + arm64)
- Publishes to Docker Hub with tags:
  - `dialmaster/youtarr:latest` (stable release for end-users)
  - `dialmaster/youtarr:vX.X.X` (specific version)

You don't need to worry about versioning or releases - just use the correct commit message prefix.

## Testing Guidelines

### General Principles

- **Write meaningful tests**: Test behavior, not implementation details
- **No skipped tests**: All tests must run and pass (no `test.skip()`)
- **Use descriptive test names**: Clearly describe what is being tested
- **Follow AAA pattern**: Arrange, Act, Assert

### React Testing Library

When writing frontend tests:

- **Use Testing Library queries**: `getBy...`, `queryBy...`, `findBy...`
- **Avoid direct DOM access**: No `querySelector`, `parentElement`, etc.
- **Query by role when possible**: `getByRole('button', { name: 'Submit' })`
- **Use `screen` for queries**: Import from `@testing-library/react`

### Jest Mocking

- **Mock external dependencies**: axios, WebSocket, etc.
- **Use `jest.fn()` for mock functions**: Allows assertion on calls
- **Mock React components with `React.createElement`**: Avoids JSX hoisting issues
- **Clean up mocks**: `jest.clearAllMocks()` in `beforeEach`

### Running Specific Tests

```bash
# Run a specific test file
npm run test:frontend -- path/to/test.test.ts

# Run tests matching a pattern
npm run test:frontend -- --testNamePattern="should fetch data"

# Run tests in watch mode (during development)
npm run test:frontend -- --watch
```

### Testing Async Code

Use `waitFor` from Testing Library for async operations:

```typescript
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(result.current.loading).toBe(false);
});
```

For more detailed testing patterns and examples, refer to the test files in the codebase and the [Development Guide](docs/DEVELOPMENT.md).

## Database Migrations

### When to Create a Migration

Create a migration when you:
- Add, remove, or modify database tables
- Change column types or constraints
- Add or remove indexes
- Modify associations between models

### How to Create a Migration

**Always use the migration script:**

```bash
./scripts/db-create-migration.sh your-migration-name
```

Or using npm:

```bash
npm run db:create-migration -- --name your-migration-name
```

**Never manually create migration files.** The script ensures proper timestamping and configuration.

### Migration Best Practices

- **One change per migration**: Keep migrations focused and atomic
- **Include both up and down**: Always implement rollback logic
- **Test migrations**: Run them locally before committing
- **UTF-8 support**: Use `charset: 'utf8mb4'` for full Unicode support (including emoji)

For more information on database management, see [DATABASE.md](docs/DATABASE.md).

## Getting Help

### Questions and Discussion

- **Discord Server**: Join our [Discord community](https://discord.gg/68rvWnYMtD) for real-time help and discussion
- **GitHub Issues**: For bug reports, feature requests, and questions
- **Existing Issues**: Search before creating new issues to avoid duplicates

### Documentation

- [Development Guide](docs/DEVELOPMENT.md) - Comprehensive development documentation
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Installation Guide](docs/INSTALLATION.md) - Setup and installation
- [Configuration Reference](docs/CONFIG.md) - All configuration options

### Community

If you get stuck or need help:
1. Check the documentation links above
2. Search existing GitHub issues
3. Create a new issue with details about your problem

## Project Resources

### Documentation
- [Installation Guide](docs/INSTALLATION.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Configuration Reference](docs/CONFIG.md)
- [Database Management](docs/DATABASE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Media Servers](docs/MEDIA_SERVERS.md)

### Repository
- [GitHub Repository](https://github.com/DialmasterOrg/Youtarr)
- [Issue Tracker](https://github.com/DialmasterOrg/Youtarr/issues)
- [Changelog](CHANGELOG.md)

### Support the Project
- [GitHub Sponsors](https://github.com/sponsors/DialmasterOrg)
- [Patreon](https://www.patreon.com/ChrisDial)

## License

Youtarr is licensed under the ISC License. See [LICENSE.md](LICENSE.md) for full details.

By contributing to Youtarr, you agree that your contributions will be licensed under the same ISC License.

---

Thank you for contributing to Youtarr!
