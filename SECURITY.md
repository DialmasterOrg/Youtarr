# Security Policy

## Supported Versions

Youtarr provides security support for the latest stable release only:

| Version | Supported |
| --- | --- |
| Latest stable release (`latest` Docker tag and newest `vX.Y.Z` tag) | Yes |
| Older stable releases | No |
| Development builds (`dev-latest`, `dev-rc.<sha>`, or unreleased branch builds) | No |

Youtarr is supported as a Docker-based application. Direct host-side Node.js
production deployments are unsupported.

## Reporting a Vulnerability

Please report security vulnerabilities using GitHub private vulnerability
reporting for this repository:

https://github.com/DialmasterOrg/Youtarr/security/advisories/new

Do not report vulnerabilities through public GitHub issues, public pull
requests, Discord, or other public channels. Public reports can expose users
before a fix is available.

## What to Include

Include as much of the following as you can:

- The Youtarr version, Docker tag, or image digest you tested.
- Your install method, such as helper scripts, Docker Compose, external
  database, or platform-managed deployment.
- Host OS, Docker version, browser, and database type/version when relevant.
- Clear reproduction steps and the security impact.
- Redacted logs, screenshots, or proof-of-concept details that help verify the
  issue.

Do not include secrets in a report. Redact `.env` values, config files,
cookies, API tokens, Discord webhook URLs, Plex tokens, database passwords,
YouTube credentials, and any other private data.

## Scope

Examples of in-scope issues include:

- Authentication or authorization bypasses.
- Stored or reflected cross-site scripting in the web UI.
- CSRF or unsafe state-changing requests.
- Path traversal, unintended file writes, or unintended file deletion.
- Exposure of secrets through logs, API responses, config handling, Docker
  images, or build context.
- Supply-chain or release-process issues that could affect published Youtarr
  artifacts.
- Database migration or data exposure issues with a security impact.

Examples of out-of-scope issues include:

- Generic scanner output without a Youtarr-specific exploit path.
- Issues requiring administrator or root access to the Docker host, unless they
  cross a meaningful trust boundary.
- Vulnerabilities in upstream services such as YouTube, Plex, Discord, Docker,
  MariaDB, or yt-dlp unless Youtarr makes them exploitable in a specific way.
- Social engineering, spam, physical attacks, or denial of service by simply
  overwhelming a self-hosted instance.

## Response Expectations

We aim to acknowledge valid reports within 3 business days and provide an
initial triage response within 7 days.

For confirmed high or critical vulnerabilities, we aim to release a fix within
30 days when feasible. Timelines may vary based on complexity, required
coordination, and maintainer availability.

After a fix is available, we may publish a GitHub Security Advisory, release
notes, or both. Reporter credit is offered unless anonymity is requested.
