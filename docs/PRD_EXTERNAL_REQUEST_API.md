# PRD: Youtarr External API and Request Management

## Document Status

- Status: Draft for maintainer review
- Target project: Youtarr
- Last updated: 2026-07-29
- Audience: Any external client integrating with a Youtarr instance
- Primary use case: Provide a stable, documented, API-key-protected Youtarr API for browsing eligible content and submitting approval-backed requests.

This API is a Youtarr product capability. Its contract, authorization model, documentation, and delivery plan must remain client-agnostic and must not depend on any one downstream application.

## Background

Youtarr already supports:

- session-authenticated web UI access
- API key creation in the **API Keys & External Access** settings section
- a REST API with Swagger/OpenAPI docs
- a limited API-key workflow for `POST /api/videos/download`

Today, API keys are intentionally restricted to a single endpoint that queues individual video downloads. That is a good security baseline, but it is too narrow for integrations that need to:

- show available channels
- show videos within those channels, including thumbnails and download state
- request videos to be downloaded
- optionally request new channels
- operate without exposing the full Youtarr web UI

This PRD defines a safety-first expansion of Youtarr so it can support general-purpose external integrations while keeping the main app protected behind separate middleware if desired.

## Current Implementation Status

As of 2026-07-29:

- The upstream API enhancement is tracked in issue `#568`; no implementation PR is open.
- The current `api-expansion` branch is a design branch. Relative to upstream `dev`, it adds this PRD and clarifies the authenticated thumbnail/asset contract; it does not contain the broader API implementation.
- Existing API keys, their management UI, and the legacy `POST /api/videos/download` flow provide the baseline to evolve.
- The dedicated `/external-api/v1` namespace, expanded roles and policies, channel grants, catalog endpoints, durable request lifecycle, administrator queue, and operational hardening remain to be implemented.

Implementation therefore begins with the foundation phase below. Later phases must not be described as complete until their individual PRs are merged and their acceptance checks pass.

## Problem Statement

Instance owners and integration authors need a limited, API-key-protected surface of Youtarr without exposing the full admin UI. External clients need read access to eligible content and limited request access, while instance owners need:

- strict API-key enforcement
- simple reverse-proxy isolation
- approval controls for risky actions
- auditing and revocation
- predictable paging and filtering for very large channels

## Goals

1. Add a dedicated external API namespace that can be exposed separately from the main app.
2. Require API-key authentication for every external API request.
3. Support read access to channels and channel videos for external clients.
4. Support request-based workflows for downloading videos and optionally adding channels.
5. Add role/scoped API keys with approval-related behavior.
6. Add an in-app request queue for approving or rejecting outstanding requests.
7. Document safe reverse-proxy deployment patterns clearly.
8. Break implementation into manageable PR-sized phases.
9. Keep the public contract generic so browser extensions, native apps, automations, dashboards, and other third-party clients can integrate without consumer-specific behavior.

## Non-Goals

- Replacing session auth for the main Youtarr web UI in this implementation program
- Building multi-user household accounts
- Exposing every existing Youtarr endpoint to API keys
- Full external CRUD over all settings and channel management
- Solving public-internet hardening beyond Youtarr's documented safe deployment patterns
- Adding behavior, fields, or terminology that exists only for one named downstream client

## Users and Personas

### Instance Admin

The Youtarr owner who manages channels, downloads, settings, and approvals.

### External Viewer

A client/device allowed to browse approved channels and videos only.

### External Requester

A client/device allowed to browse approved content and submit requests for download or new channels/videos, subject to auto-approval or admin review.

### External Admin

A future phase role that can use a constrained web UI backed by API keys instead of session auth.

## Product Principles

### Safety First

External access must default to least privilege. The new API should be easy to place behind a separate reverse-proxy path rule such as `/external-api/*`, while the rest of Youtarr remains behind stronger middleware or private-only access.

### Explicit Separation

External API routes should live under their own prefix instead of reusing the mixed existing route shape. This simplifies:

- reverse-proxy rules
- auth policy
- logging
- documentation
- future rate-limiting and abuse controls

### Requests, Not Direct Power

Risky actions should be modeled as requests first unless a key's policy explicitly allows auto-approval.

### Client-Agnostic Contract

The external API exposes Youtarr resources and workflows, not consumer-specific screens or recommendation logic. Examples may illustrate how a client could use the API, but no named integration defines the contract.

## Proposed Solution Overview

Add a new external API namespace:

- Proposed prefix: `/external-api/v1`

All routes under this prefix:

- require `x-api-key`
- reject session-token-only access
- are governed by API key scopes/role policies
- are documented separately in Swagger/OpenAPI

Program capabilities:

1. Read channel list
2. Read channel video lists with paging and filters
3. Submit video download requests
4. Submit new channel requests
5. Submit approval-backed downloaded-video deletion requests
6. Read a bounded, policy-filtered cross-channel video feed
7. Review and process pending requests in a new Requests section in the main web UI

## Authentication and Authorization

### External API Authentication

- All `/external-api/v1/*` endpoints require `x-api-key`.
- Requests without a valid API key return `401`.
- Session tokens (`x-access-token`) do not grant access to this namespace.
- No external endpoint is anonymous.

### API Key Model

Expand the existing API key model to support role/scope metadata.

#### Access levels

- `view`: read-only access to allowed external browse endpoints
- `request`: includes `view` plus ability to create requests
- `delete`: includes `request` plus delete requests where allowed by policy
- `admin`: the broadest external API policy scope; it does not grant session administration or request-review authority

#### Key policy flags

- `autoApproveVideoRequests`
- `autoApproveDeleteRequests`
- `autoApproveChannelRequests`

These flags should only be available where they make sense for the selected access level.

#### Notes

- Existing keys should migrate safely with a legacy-compatible default, likely equivalent to a narrowly scoped request key for the current single-video endpoint.
- Keys remain hashed at rest.
- Keys remain one-time-view on creation.
- Keys should display metadata such as scope, last used, usage count, and created date.

## External API Surface

The exact path names can change during tech design, but the namespace and capabilities should remain stable.

### 1. Channels List

Purpose: allow external clients to display approved channels.

Example:

- `GET /external-api/v1/channels`

Suggested query support:

- `page`
- `pageSize`
- `search`
- `subfolder`
- `sortBy`
- `sortOrder`

Suggested response fields:

- `id`
- `channelId`
- `title`
- `thumbnailUrl`
- `description` or truncated summary
- `subfolder`
- `videoCount`
- `downloadedCount`
- `lastFetchedAt`

Notes:

- Reuse existing internal channel pagination semantics where possible.
- Return enough metadata for a client to render a browsable channel list without needing extra follow-up calls for basic display.
- Thumbnail references must be usable by authenticated external clients without requiring a Youtarr session cookie.

### 2. Channel Videos

Purpose: allow external clients to browse a channel's videos, thumbnails, metadata, and download state.

Example:

- `GET /external-api/v1/channels/:channelId/videos`

Suggested query support:

- `page`
- `pageSize`
- `offset`
- `limit`
- `status=all|downloaded|not_downloaded|requested|pending`
- `search`
- `sortBy`
- `sortOrder`
- `tabType=videos|shorts|streams`
- `dateFrom`
- `dateTo`
- `minDuration`
- `maxDuration`
- `maxRating`

Suggested response fields:

- `youtubeId`
- `title`
- `thumbnailUrl`
- `publishedAt`
- `duration`
- `description`
- `isDownloaded`
- `isRequested`
- `requestStatus`
- `rating`
- `channelId`
- `channelTitle`

#### Thumbnail and media asset delivery

This needs to be explicit because external clients may not be logged into the main Youtarr web UI.

Requirements:

- Thumbnail and related image assets exposed to external clients must be retrievable with API-key-based access, not only browser session auth.
- The external API should not return asset URLs that silently depend on existing Youtarr login cookies.
- The asset delivery contract must work for native clients that can attach an API key to each request.

Recommended approach:

- Return external-API-scoped asset URLs such as `/external-api/v1/assets/...` or `/external-api/v1/thumbnails/...`.
- Protect those asset endpoints with the same `x-api-key` requirement as the rest of the external namespace.
- Keep those asset URLs stable enough for clients to render list views without custom scraping or cookie-sharing.

Compatibility note:

- If some thumbnail values currently point directly to YouTube-hosted images, that is acceptable as a fallback for non-sensitive public imagery.
- If Youtarr serves locally cached thumbnails, posters, or protected assets, the PRD should assume those must be reachable through authenticated external asset endpoints.

#### Paging requirements

This area is critical because some channels have thousands of videos.

Requirements:

- Support deterministic paging over stable, explicit sort orders.
- Prefer `page + pageSize` as the public contract for consistency with current Youtarr behavior.
- Also consider `offset + limit` support if that improves client UX for "videos 30-40" style access.
- Response must include paging metadata:
- `page`
- `pageSize`
- `total`
- `totalPages`
- optionally `offset` and `limit` if supported

#### Data sourcing behavior

The implementation should not require a full fresh YouTube fetch for every external browse request.

Expected behavior:

- External browse endpoints primarily serve from Youtarr's cached/database-backed channel video records.
- Existing channel refresh behavior remains separate from external browsing.
- If the channel has not yet been fully indexed, the API should return a truthful partial-state indicator rather than blocking for a long-running scrape.

Potential response metadata:

- `dataSource=cache|partial_cache`
- `isFullyIndexed`
- `lastIndexedAt`
- `indexingHint`

This keeps response latency predictable and avoids coupling player UX to yt-dlp fetch timing.

### 3. Video Download Request

Purpose: allow external clients to request a video download.

Example:

- `POST /external-api/v1/requests/videos`

Request body:

- `youtubeId` or canonical YouTube URL
- optional `channelId`
- optional client metadata

Behavior:

- If the key policy allows auto-approval, create and execute the download immediately.
- Otherwise, create a pending request record for approval.
- Duplicate requests should be idempotent or return a clear "already requested/downloaded" response.

Response should indicate:

- `status=approved|pending|duplicate|already_downloaded|rejected`
- `requestId`
- `message`

### 4. Channel Request

Purpose: allow external clients to request that a new channel be added.

Example:

- `POST /external-api/v1/requests/channels`

Request body:

- channel URL

Behavior:

- validate URL
- resolve channel metadata when practical
- create pending or auto-approved request based on key policy

This supports the future simplified requester UI and direct client integrations.

### 5. Request Status

Purpose: allow external clients to check the status of their requests.

Examples:

- `GET /external-api/v1/requests`
- `GET /external-api/v1/requests/:requestId`

Suggested filters:

- `status=pending|approved|rejected|completed`
- `type=video|channel|delete`

This is especially useful for mobile apps that need to reflect whether a request is still waiting on admin approval.

### 6. Downloaded-Video Deletion Request

Purpose: allow an authorized external client to request deletion of an already-downloaded video asset.

Example:

- `POST /external-api/v1/requests/delete-videos`

Behavior:

- always use the durable request lifecycle
- never directly delete through the external API
- revalidate role, grants, content policy, and downloaded state before approval
- never remove a channel subscription
- complete idempotently when the asset is already absent

### 7. Cross-Channel Video Feed

Purpose: allow external clients to discover eligible videos across their granted channels without defining recommendation behavior inside Youtarr.

Example:

- `GET /external-api/v1/videos`

Behavior:

- use the same grant, channel-state, rating, and media-type policy as all other catalog endpoints
- return stable, bounded pages from cached Youtarr data
- expose generic candidate records only; do not accept client profiles, playback history, or ranking signals

## Request Approval Workflow

Add a new Requests area to the main Youtarr web UI for session-authenticated admins.

### UI requirements

- show pending requests
- show approved/rejected/completed history as useful follow-up scope
- filter by request type and status
- display requester key name/prefix for auditing
- approve or reject individual requests
- bulk approve/reject may be added later, but not required for initial delivery

### Initial request types

- video download request
- channel add request

### Later request type in this implementation program

- delete downloaded video

### Potential future request types

- delete channel
- refresh channel

## Configuration UX Changes

Extend the existing **API Keys & External Access** section instead of creating a parallel configuration area.

### Additions

- access level selector: `view`, `request`, `delete`, `admin`
- auto-approve toggles appropriate to the role
- clearer description of what each access level can do
- visibility into rate limits, last used, and request policy
- migration/labeling for legacy keys

### Recommended UX constraints

- `view` cannot create requests
- `request` can create requests but cannot directly delete content
- `delete` only enables delete request flows, not unrestricted deletion
- `admin` should be clearly labeled as high-risk

## Security Requirements

### Namespace Separation

The external API must have its own top-level prefix, recommended as `/external-api/v1`, to enable safe reverse-proxy handling.

### Mandatory API-Key Protection

- Every endpoint under the external prefix requires a valid API key.
- No endpoint under the external prefix is accessible with no auth.
- No fallback to session auth on the external prefix.

### Reverse Proxy Guidance

Documentation must include safe examples for:

- Traefik
- Caddy
- Nginx

Recommended pattern:

- protect the main Youtarr UI with stronger middleware, private network access, or SSO
- optionally expose only `/external-api/*`
- keep Swagger/docs for the external API behind admin access unless intentionally exposed

### Logging and Auditing

Log for each external request:

- API key id/prefix/name
- path
- method
- result
- request id where applicable

### Rate Limiting

The foundation PR should keep per-key rate limiting and extend it to the new external namespace.

Consider:

- different limits for browse vs write endpoints
- lower limits for request-creation endpoints

### Error Handling

Use clear API responses for:

- invalid key
- insufficient scope
- duplicate request
- already downloaded
- resource not found
- approval required
- rate limited

## Future: API-Key-Backed Simplified Web UI

This is intentionally outside the initial implementation program and must not block the external API.

Goal: allow API keys to authenticate into a simplified Youtarr web experience.

### Role-based UI behavior

- `view`: videos-only UI, browse existing videos and metadata
- `request`: channel list + channel detail pages + ability to request videos and request new channels
- `admin`: near-full UI access

### Restrictions

- request users should not gain access to settings
- request users should not gain ignore/delete/admin controls unless explicitly authorized
- UI should be capability-driven from server-provided key scope, not hardcoded only in the client

This work should be treated as a separate PRD or technical design.

## Functional Requirements Summary

1. Youtarr must expose a dedicated external API prefix.
2. All external API endpoints must require API keys.
3. The API key model must support access levels and approval-related policy flags.
4. External clients must be able to list channels.
5. External clients must be able to list channel videos with paging, filters, download-state metadata, and usable authenticated thumbnail references.
6. External clients must be able to create video download requests.
7. External clients must be able to create channel-add requests.
8. Authorized external clients must be able to create approval-backed downloaded-video deletion requests.
9. External clients must be able to read a bounded, policy-filtered cross-channel video feed without consumer-specific ranking behavior.
10. Admins must be able to approve or reject pending requests in the web UI.
11. Documentation must explain safe reverse-proxy deployment.
12. Existing API key behavior must remain backward compatible during migration.

## Success Metrics

- Admin can safely expose only the external API via reverse proxy.
- External client can render channels and videos without session auth.
- External client can fetch thumbnail/image assets needed for those views using API-key-protected routes.
- External requester can submit a video request that appears in the approval queue.
- Admin can approve the request and the download proceeds normally.
- No external endpoint is accessible without an API key.
- Existing bookmarklet/single-video flows continue to work.

## Sequential Implementation Strategy

Implementation will use three sequential, independently reviewable PRs. PRs will not be stacked: after each merge, the next PR will be rebased onto the updated upstream branch and its focused and regression checks will be rerun.

Documentation and tests ship with the behavior they describe. Each PR must be independently testable at its own boundary, and later PRs must not be required to prove an earlier PR safe.

### PR 1: Preparation, Data Model, and Migrations

**Purpose**

Create the persistence and configuration foundation required by the API without exposing new runtime routes.

**Includes**

- extend `ApiKeys` with role, policy, media, auto-approval, revocation, and legacy-compatibility fields
- migrate existing keys to a `legacy_download` scope that preserves the current `POST /api/videos/download` behavior
- add `ApiKeyChannelGrants` with unique key/channel membership and indexed foreign keys
- add `ExternalRequests` with opaque ID, owner, type, status, idempotency/deduplication data, nullable video/channel targets, persisted grant decision, job linkage, messages, and timestamps
- add indexes for owner/status reads, management filters, active-target deduplication, and bounded catalog queries
- add Sequelize models, associations, shared enums/constants, and validation primitives
- add `EXTERNAL_API_ENABLED=false` configuration and environment documentation
- document upgrade, rollback, re-application, data-retention, and destructive rollback implications

**Excludes**

- `/external-api/v1` routes
- external authentication and authorization middleware
- request execution or approval behavior
- API-key policy management endpoints
- administrator GUI

**Required test coverage**

- migration unit tests for every `up` and `down` path, including missing/existing table and column behavior
- isolated MariaDB integration tests for fresh install, pre-feature upgrade, current-schema restart, idempotent re-run, rollback, and re-application
- model and association Jest tests for defaults, enum validation, foreign keys, uniqueness, ownership, and timestamps
- API-key module regression tests proving existing key creation, hashing, one-time reveal, usage tracking, and legacy downloads remain unchanged
- negative tests for invalid roles, request types/statuses, malformed policy data, duplicate grants, duplicate active requests, and orphaned references
- rollback tests proving request/grant rows are removed only as documented and that database rollback does not claim to restore deleted media

**Acceptance**

- all migration paths pass against a real supported database, not only mocked Sequelize calls
- existing installations and existing API keys upgrade without losing access to the legacy endpoint
- the application can start safely with the new schema while the external namespace remains disabled
- no new public or management API behavior is reachable

### PR 2: External API Surface and Backend Control Plane

**Purpose**

Deliver the complete headless integration contract and all session-authenticated backend controls. After this PR, the feature must be fully usable and testable through an ordinary API client without the new GUI.

**Includes**

- disabled-by-default `/external-api/v1` namespace and normalized error envelope
- API-key-only authentication that rejects missing, invalid, revoked, legacy-only, and session-only credentials
- cumulative role checks, per-key channel grants, rating/media policy, auto-approval policy, and separate read/write rate limits
- capabilities, granted-channel, channel-video, cross-channel-video, and authenticated asset endpoints
- owner-scoped video, channel, and downloaded-video deletion request creation/list/detail endpoints
- idempotency, concurrent deduplication, reconciliation, bounded stale-work recovery, and terminal-state handling
- approval-time revalidation and integration with existing downloader, channel provisioning, and downloaded-video deletion operations
- session-authenticated management endpoints for listing/detailing/approving/rejecting requests
- session-authenticated API-key endpoints for transactional role, policy, auto-approval, and grant management
- immediate key revocation and namespace-wide feature shutdown
- OpenAPI contract, operator documentation, proxy examples, migration/rollback runbook, legacy deprecation guidance, correlation IDs, and redacted structured logging

**Excludes**

- Requests page
- API-key policy/grant editor UI
- external-client-specific recommendation behavior
- API-key access to session administration or request-review authority

**Required test coverage**

- route-level Jest/Supertest coverage for every external and management endpoint, success response, validation error, and normalized error envelope
- authentication matrix covering missing, malformed, invalid, revoked, legacy, insufficient-role, ungranted, session-only, and mixed session/API-key credentials
- authorization matrix covering roles, grants, enabled/terminated channels, rating ceilings, unrated behavior, media types, direct IDs, counts, lists, assets, candidates, request creation, and approval revalidation
- pagination/filter tests for stable ordering, tie-breakers, maximum page size, empty pages, invalid parameters, and large channels
- asset tests covering public thumbnails, authenticated local assets, traversal, symlinks, redirects, missing files, unauthorized resources, and secret-free URLs
- request lifecycle Jest tests for pending, auto-approved, processing, completed, rejected, failed, cancelled, already-downloaded, missing-output, and already-deleted behavior
- idempotency and concurrency tests proving duplicate submissions cannot create multiple active requests
- recovery tests for interrupted channel and delete work, stale claims, repeated approval, and terminal-state reconciliation
- integration tests proving video requests reach the downloader, channel approval provisions/enables the canonical channel, and delete approval removes only the downloaded asset
- management API tests proving API keys cannot review requests or manage keys even when a browser session is also present
- rate-limit, feature-off `404`, immediate-revocation, log-redaction, correlation-ID, proxy allow/deny, and legacy-endpoint regression tests
- performance tests with thousands of cached videos covering query plans, bounded pages, timing, and memory
- OpenAPI validation proving every published endpoint, schema, status, security requirement, and example matches runtime behavior

**Acceptance**

- the complete contract works without the GUI through documented API calls
- every externally visible resource applies one shared authorization and eligibility policy
- all request types deterministically reach a correct terminal or recoverable state
- the external namespace can be shut down without exposing the main UI or other private routes
- existing session routes and the legacy download endpoint retain regression coverage

### PR 3: Administrator GUI

**Purpose**

Add the Youtarr administrator experience on top of the stable management API from PR 2 without introducing new backend contract or authorization behavior.

**Includes**

- responsive, session-only Requests page with filters, history, details, current-state warnings, approve/reject actions, bounded rejection reasons, requester identity, target/job state, and audit information
- desktop table and tablet/mobile card presentations without compressed columns or horizontal overflow
- video/delete thumbnails and established video-chip treatments
- channel identity, thumbnail/handle, and concise canonical target presentation
- empty, loading, error, retry, long-content, stale-state, media-failure, and action-in-progress states
- role, human-readable rating, media-type, auto-approval, and channel-grant controls in the existing API Keys & External Access section
- transactional create/edit flows, privilege-increase confirmation, one-time secret reveal, and immediate-revocation guidance
- Requests routing/navigation and direct links between request review and API-key management
- administrator/user documentation and responsive screenshots

**Excludes**

- migrations
- new backend endpoints
- new authorization decisions or request-state transitions
- external-client UI

**Required Jest coverage**

- request-list rendering, paging, filters, sorting, empty/loading/error/retry states, and response-shape validation
- request-detail rendering for video, channel, and delete requests
- approve/reject flows, confirmation, bounded rejection reason, optimistic/in-progress behavior, API failures, stale-state conflicts, and post-action refresh
- role/policy/grant creation and editing, validation, privilege-increase confirmation, transactional failures, secret reveal/copy guidance, and revocation
- route and navigation coverage for `/requests`, direct links, browser back/forward behavior, and protected session-only rendering
- responsive rendering assertions for desktop table and mobile card selection
- keyboard navigation, focus placement/restoration, dialog behavior, screen-reader names, reduced-motion behavior, and touch-target semantics
- regression coverage for the existing bookmarklet, legacy key display, Configuration/Settings routes, navigation shell, and supported themes

**Required Storybook coverage**

- stories for the Requests page and its independently meaningful table, card, detail, and action-dialog components
- desktop, tablet, and mobile viewports
- every request type and lifecycle status
- empty, loading, error, retry, stale, long-content, media-failure, and action-in-progress states
- API-key policy cards/editor states, including least privilege, elevated privilege, validation errors, and revoked keys
- light/dark and supported theme-token coverage
- `play` interactions for filtering, opening details, approving, rejecting, retrying, editing policy/grants, confirmation, and revocation
- every critical story added to the existing Jest Storybook parity suite through `runStoryWithPlay`
- successful static Storybook build
- CI-enforced accessibility assertions; merely loading the a11y addon without a failing check is not sufficient

**Acceptance**

- backend behavior from PR 2 is consumed without contract changes
- desktop and mobile workflows complete without overflow or inaccessible controls
- Jest component/interaction tests and Storybook interaction coverage pass for every critical state
- keyboard, screen-reader, focus, contrast, reduced-motion, and responsive touch-target checks pass

## Test Strategy and Merge Gates

Test ownership follows the implementation:

- PR 1 owns schema, migration, model, and legacy compatibility tests.
- PR 2 owns backend module, route, authorization, lifecycle, integration, performance, OpenAPI, operational, and proxy-isolation tests.
- PR 3 owns frontend Jest, Storybook, responsive, interaction, and accessibility tests.

The repository currently provides backend Jest, frontend Jest, a static Storybook build, and Jest-driven Storybook `play` coverage. The implementation must extend those real harnesses rather than creating parallel one-off test systems.

At minimum, every PR must pass the checks relevant to its diff:

```text
npm run lint
npm run lint:ts
npm run test:backend
npm run test:frontend
npm run test:coverage
cd client && npm run build
cd client && npm run build-storybook
cd client && npm test -- src/tests/storybook_coverage.test.js --passWithNoTests
```

PR 1 must additionally run the isolated real-database migration matrix. PR 2 must additionally run deterministic request-worker, proxy allow/deny, large-catalog performance, and API contract validation suites. PR 3 must additionally run the blocking accessibility and responsive browser validation introduced for the feature.

Coverage percentage alone is not sufficient. Each requirement and state transition must map to at least one named test, and every defect found during implementation or review must receive a regression test at the lowest useful layer.

## Definition of Done for Every PR

Each PR must:

- state its purpose, included behavior, and explicit exclusions
- update the authoritative API contract and the relevant operator or administrator guide
- describe API, data, authorization, migration, rollback, and compatibility implications
- include focused acceptance tests plus regression coverage for existing behavior
- include responsive screenshots or Storybook states when UI changes
- report only the phase that is actually complete
- identify dependent follow-ups and known limitations
- remain small enough to review as one cohesive ownership seam

## Open Questions

1. Should the public external browse contract use `page/pageSize` only, or support both `page/pageSize` and `offset/limit`?
2. Should a `request` key be able to auto-approve downloads only for videos belonging to already-subscribed channels?
3. Should channel requests always require approval even when video requests can auto-approve?
4. Are there additional safeguards required beyond the approval-backed, downloaded-asset-only deletion model defined here?
5. Should external clients be allowed to browse only certain subfolders/libraries per key in a later phase?
6. Should Swagger expose external endpoints publicly, or only when the main admin UI is accessible?
7. Should the role currently named `admin` be renamed before implementation to avoid implying external request-review authority?

## Recommendations

- Use `/external-api/v1` as the dedicated prefix.
- Deliver the API through the sequential Youtarr PR program above; do not bundle consumer integrations into those reviews.
- Treat destructive operations as approval-backed requests, not direct actions.
- Reuse existing channel/video pagination and filtering logic where possible, but define a cleaner external contract.
- Make documentation part of the feature, not follow-up work.
- Evaluate every endpoint and response field as a reusable Youtarr capability rather than against one consuming application.

## References

- Existing Youtarr API key docs currently describe API keys as limited to single-video downloads.
- Existing Youtarr channel/video routes already support paging and filters for session-authenticated use.
- Existing **API Keys & External Access** settings UX is the right place to extend key capabilities.
