# Youtarr External API

`/external-api/v1` is Youtarr's constrained integration boundary for approved
clients. It is enabled by default and never accepts a Youtarr browser session
or a legacy download key. Set `EXTERNAL_API_ENABLED=false` to disable the
namespace for a deployment.

## Enablement and authentication

Create an external-role key in **Settings → API Keys → API Keys & External
Access**. The key is revealed once. Send it only in the `x-api-key` header over
HTTPS. Set `EXTERNAL_API_ENABLED=false` and restart Youtarr if the namespace
should be disabled.

Existing keys migrate as `legacy_download`. They continue to work only with
`POST /api/videos/download`. Conversely, external-role keys cannot use that
legacy endpoint, so its direct-download behavior cannot bypass external
policies or approval.

Every external key includes catalog and owner-request reads. Request
capabilities are independently configurable:

| Permission | Added scope |
| --- | --- |
| Request videos | `video:request` |
| Request channels | `channel:request` |
| Delete downloaded videos | `video:delete` |

The `role` value remains as a backward-compatible summary for older clients,
but `capabilities.scopes` is authoritative. Clients must not infer a
permission that is absent from the scopes array. `admin` remains a policy
summary only and does not authorize remote approval. Review always requires a
normal Youtarr administrator session.

## Policy and grants

Every external key has:

- independent video-request, channel-request, and downloaded-video-deletion
  permissions; catalog and owner-status reads are always included;
- a maximum allowed movie/TV rating;
- an allow/disallow decision for unrated or unrecognized ratings;
- allowed media types (`video`, `short`, and/or `livestream`);
- separate auto-approval decisions that are valid only when their parent
  permission is enabled;
- durable workload ceilings, defaulting to 5 active jobs, 30 accepted writes
  per UTC hour, and 200 per UTC day (administrators may select lower values);
- an explicit set of granted Youtarr channel database IDs.

The HTTP contract retains a compact `maxRatingLevel` value, but the
administrator UI presents the actual rating ceilings:

| Level | Administrator label | Movie ratings | TV ratings |
| --- | --- | --- | --- |
| 1 | General audiences | G | TV-Y, TV-G |
| 2 | Parental guidance | PG | TV-Y7, TV-PG |
| 3 | Teen | PG-13 | TV-14 |
| 4 | Mature | R, NC-17 | TV-MA |

YouTube usually does not supply a useful content rating. Youtarr therefore
uses the video's explicit/manual rating when present, then the channel's
manually assigned default rating. If neither is recognized, the key's
`allowUnrated` decision applies. The same calculation is used for catalog
visibility, counts, assets, catalog rows, request creation, and approval
revalidation.

Youtarr applies one server-side eligibility decision to lists, counts, direct
IDs, assets, catalog feeds, request creation, and approval revalidation.
Disabled or terminated channels never qualify. A missing grant is treated the
same as a nonexistent target.

## Error contract

All JSON responses under `/external-api/*`, including feature-off and
unknown-route responses, use private, no-store cache headers and vary on
`x-api-key`. Errors use:

```json
{
  "error": {
    "code": "not_found",
    "message": "External API route not found",
    "requestId": "server-generated-identifier"
  }
}
```

Clients must treat unknown additive fields and unknown enum values as
forward-compatible. They must not infer target existence from 403/404
differences.

The standardized statuses are 400 (malformed or invalid request), 401
(authentication), 403 (missing scope), 404 (unknown or hidden resource), 405
(method), 413 (body size), 415 (content type), 429 (rate/quota), 500
(unexpected failure), and 503 (bounded downstream capacity). Compressed
request bodies are not accepted. CORS is disabled.

The sanitized cross-client decoding fixture is
`fixtures/external-api-v1/contract.json`; its reviewable checksum is recorded
beside it in `SHA256SUMS`. Fixture version 3 covers capabilities, channels,
cursor-paginated mixed-media catalog pages, rich and sparse video details,
every request type and status, video-request outcomes, and forward-compatible
unknown enum samples. The fixture contains no credentials or private
deployment address. Consumer repositories should vendor the JSON and checksum
unchanged and pin the producing Youtarr commit used for synchronization.

## Endpoints

### Capabilities

`GET /external-api/v1/capabilities`

Returns the API/server version, effective role/scopes, policy, feature flags,
and effective quota limits/remaining allowance. Clients should call this
before presenting optional actions.

### Granted catalog

`GET /external-api/v1/channels`

Query parameters:

- `cursor` (opaque) or `page` (default 1), plus `pageSize` (1–100);
- `search` (maximum 200 characters);
- `subfolder` (exact match, maximum 255 characters);
- `sortBy`: `title`, `videoCount`, `downloadedCount`, or `id`;
- `sortOrder`: `asc` or `desc`.

`GET /external-api/v1/channels/{channelDatabaseId}/videos`

Query parameters:

- `cursor` (preferred) or `page` (compatibility only), plus `pageSize` and
  `search`;
- `tabType`: `videos`, `shorts`, or `streams`;
- `status`: `all`, `requestable`, `available`, `downloaded`, or `requested`;
- `minDuration`, `maxDuration`, `dateFrom`, and `dateTo`;
- `sortBy`: `date`, `title`, or `duration`;
- `sortOrder`: `asc` or `desc`.

Video status has these exact meanings:

- `all` (or omitted): every policy-eligible cached row;
- `requestable`: not downloaded and without a `pending`, `approved`, or
  `processing` video request owned by the calling key;
- `available`: not downloaded, including rows with an active request;
- `downloaded`: a `Videos` row exists with `removed=false`;
- `requested`: an active request exists for the calling key.

Responses include an opaque `nextCursor` while more rows remain. Video cursors
are stable keyset cursors bound to the calling key, endpoint, filters, and
sorting used to create them. A client must restart at the first page after
changing any filter, sort, or page size. Cursors avoid offset drift but do not
freeze a database snapshot, so a newly indexed or state-changing row may
appear only on a later refresh.

Existing numeric `page` parameters remain supported through page 100 for
compatibility. Use cursors whenever completeness matters. Clients must not use
`total` to preallocate a fixed snapshot. Catalog endpoints read Youtarr's cache
and do not trigger YouTube network fetches.

### Cross-channel video catalog

`GET /external-api/v1/videos`

Returns the complete policy-filtered catalog across every channel granted to
the calling key. One cursor chain combines dozens of channels; clients must not
list channels and request each channel's videos unless they are rendering
channel-specific screens. `pageSize` is limited to 100. It accepts `search`,
`tabType`, `status`, duration/date bounds, `sortBy`, and `sortOrder` with the
same meanings as the channel video catalog.

Complete catalog traversal:

```http
GET /external-api/v1/videos?pageSize=100
GET /external-api/v1/videos?pageSize=100&cursor={nextCursor}
```

Only immediately requestable videos:

```http
GET /external-api/v1/videos?status=requestable&pageSize=100
```

Not downloaded, including pending/approved/processing requests:

```http
GET /external-api/v1/videos?status=available&pageSize=100
```

Downloaded inventory:

```http
GET /external-api/v1/videos?status=downloaded&pageSize=100
```

Pass each response's `nextCursor` back with the same filters and sorting until
it is `null`. Request creation remains idempotent and revalidates current
download/request state, closing the race between reading a page and submitting
a request.

Youtarr supplies candidates only. Client-side history, scoring signals, and
ranking state remain outside Youtarr and must never be sent to it.

### Video detail

`GET /external-api/v1/videos/{youtubeId}`

Returns one policy-filtered video with the catalog identity and request status
plus the full curated metadata used by Youtarr's video detail modal. This
includes the complete description, engagement counts, tags, categories,
availability, upload data, technical video fields, related-file summaries, and
available resolutions. The lookup is intentionally one video at a time and may
populate Youtarr's metadata cache when no cached `.info.json` exists. These
lookups share Youtarr's bounded external-work queue and return 503 when that
queue is full.

Downloaded-video details include timestamps, sizes, protection state, and
resolution. Youtarr filesystem paths are never exposed because they are neither
safe nor usable by a remote client. Missing, hidden, ungranted, and
policy-ineligible videos all return the same 404 contract.

### Assets

- `GET /external-api/v1/assets/channels/{channelDatabaseId}/thumbnail`
- `GET /external-api/v1/assets/videos/{youtubeId}/thumbnail`

Local assets require the same key, grant, channel state, rating, and media
policy as their catalog row. Youtarr rejects unsafe identifiers, traversal,
symlinks, and resources outside its image directory. Responses are private and
do not redirect.

Catalog responses always return these Youtarr API asset paths, never a direct
Google/YouTube image URL. The client fetches the image bytes with the same
`x-api-key` header used for JSON requests. Youtarr serves its optimized local
JPEG when available; otherwise the video asset endpoint securely fetches an
allow-listed YouTube/Google thumbnail without redirecting the client. Upstream
responses are bounded by timeout, content type, and size.

### Create requests

Video:

```http
POST /external-api/v1/requests/videos
```

```json
{
  "youtubeId": "abcdefghijk",
  "channelId": 8,
  "idempotencyKey": "optional, 1–200 characters"
}
```

Channel:

```http
POST /external-api/v1/requests/channels
```

```json
{
  "channelUrl": "https://www.youtube.com/@example",
  "idempotencyKey": "optional, 1–200 characters"
}
```

Only canonical YouTube handle, `/channel/`, `/c/`, and `/user/` URLs are
accepted. Approval provisions/enables the channel. By default it also grants
the resulting channel to the requesting key; the administrator may turn that
off during approval. That decision is stored with the request so an
idempotent recovery cannot broaden the grant after interrupted execution.
Uncached channel metadata resolution terminates after two minutes.

Downloaded-video deletion:

```http
POST /external-api/v1/requests/delete-videos
```

```json
{
  "youtubeId": "abcdefghijk",
  "channelId": 8,
  "idempotencyKey": "optional, 1–200 characters"
}
```

Deletion applies only to the downloaded video asset. It never removes or
disables a channel subscription. Missing and already-removed targets complete
idempotently and retain a terminal request record for audit.

Created requests return HTTP 202 and `outcome: "created"`. Duplicates and
already-terminal targets return HTTP 200 with `duplicate`,
`already_downloaded`, or `already_deleted`.

### Owner-scoped request reads

- `GET /external-api/v1/requests`
- `GET /external-api/v1/requests/{requestId}`

Reads expose only records owned by the calling key. List paging accepts either
an opaque `cursor` or the compatible `page` parameter, is limited to 100 rows,
rejects pages beyond 100, and accepts an exact `status` filter.

Statuses are `pending`, `approved`, `processing`, `completed`, `rejected`,
`failed`, or `cancelled`. Youtarr reconciles downloader state before returning
results. A terminal downloader job without a produced video becomes `failed`;
it does not remain stuck in `processing`. Video deletion is reconciled to
completed when the asset is already absent. Interrupted channel/deletion
execution can be reclaimed after a five-minute stale window and rerun through
its idempotent operation.

## Administrator review

The web queue uses session-only endpoints under `/api/external-requests`:

- list with `status`, `requestType`, and `apiKeyId` filters;
- request detail;
- approve;
- reject with a 1–300 character reason.

Approval locks the current request, reloads the current key policy, and
revalidates authorization and target state immediately before execution.
Revocation or a policy/grant change therefore takes effect immediately.

## Rate limits

External reads are limited to 120 requests per minute per key. Request writes
are limited to 10 per minute per key. Review actions have a separate
session-only limit of 30 per minute.

## Deployment and operations

Youtarr authenticates every external request with `x-api-key` and enforces the
key's role, independent request permissions, channel grants, content policy,
quotas, and request limits. External-key authentication remains active when
`AUTH_ENABLED=false`; browser sessions, legacy download keys,
`Authorization`, and `x-access-token` do not authenticate this namespace.

The operator owns TLS, the public hostname, firewalling the Youtarr origin,
and the reverse proxy. Keep the Youtarr origin port private and publish only
`/external-api/v1` and its descendants. Do not expose the complete application
port: that would also publish the SPA, setup and health routes, Swagger,
images, WebSocket, session management, and legacy APIs.

Set `TRUST_PROXY` to the exact trusted proxy hop or subnet. Never use an
unrestricted setting on an origin reachable by untrusted clients.

The proxy must:

- allow only `GET`, `HEAD`, and `POST` for `/external-api/v1` paths;
- limit request bodies to 16 KiB and enforce connection/header/read timeouts;
- forward `x-api-key` and `Content-Type`, while removing `Cookie`,
  `Authorization`, and `x-access-token`;
- reject WebSocket upgrades, unmatched hosts, other versions, and all other
  application paths;
- disable response caching and hide `Set-Cookie`;
- apply TLS, connection, and edge rate limits appropriate for the deployment.

Start with auto-approval disabled, a database and configuration backup, and a
view-only key with the minimum channel grants. Confirm the private Youtarr
application and proxy rules before exposing the service. Revoke a compromised
key immediately; to shut down the whole namespace, set
`EXTERNAL_API_ENABLED=false` and restart Youtarr.

Each key defaults to at most 5 active jobs, 30 accepted writes per UTC hour,
and 200 per UTC day. Administrators may select lower limits. A shared
application ceiling also bounds downloader, deletion, and channel-provisioning
work. `/external-api/v1/capabilities` reports effective limits and remaining
allowance.

Monitor 401, 403, 404, 429, 500, and 503 rates without logging API keys.
Youtarr sanitizes downloader command logging, including proxy credentials,
cookies, headers, and paths; rotate credentials and expire older logs if they
may contain secrets.

## Configuration and administration

1. In **Settings → API Keys → API Keys & External Access**, create an external
   key and save the raw secret; it is shown only once.
2. The session-authenticated `GET /api/keys` management response includes
   `channel_grant_count`: the number of grants whose channels are currently
   enabled and non-terminated. It is not part of the `/external-api/v1` contract.
3. Choose the smallest request permissions, rating ceiling, media types,
   quotas, and enabled channel grants.
4. Use the administrator **External Requests** queue to approve or reject
   pending requests when auto-approval is not enabled.

Saving an external key with zero approved channels is intentional and does not
backfill or grant access. That key fails closed: catalog reads and requests
return no granted content until an administrator adds enabled, non-terminated
channel grants.

Existing keys migrate as `legacy_download` and remain limited to
`POST /api/videos/download`. They cannot use `/external-api/v1`. External
keys cannot use the legacy direct-download endpoint.

## Synthetic consumer contract

The canonical, production-free consumer dataset lives in
`fixtures/external-api-v1/contract.json`. Validate its published checksum with
`npm run test:external-fixture`.

Its `representativeProfile` records only sanitized structural observations
from a deployed catalog: channel/page scale, media-type mix, common rating and
nullability patterns, and authenticated artwork URL shape. It contains no
production titles, identifiers, descriptions, request records, or credentials.
The ordinary catalog rows follow that profile; deliberately unusual enum,
duration, rating, sparse-detail, and failure cases remain separate edge data.
Fixture tests derive the profile back from the rows and fail when they drift.

Run the lightweight contract server with:

```sh
npm run test:external-contract-server
```

The executable mounts the real `/external-api/v1` router and authentication
middleware with deterministic catalog, request, quota, and artwork adapters.
It prints a JSON object containing its loopback base URL and synthetic API key;
it never starts the full Youtarr application or requires MySQL. Route tests
exercise the same server and keep the fixture, checksum, response envelopes,
query validation, headers, status codes, and request behavior release-gated.

The `/__contract/scenario` and `/__contract/state` endpoints exist only on this
test executable. They let consumer UI suites select deterministic empty,
safety-filtered, unauthorized, transport, unsupported-version, malformed,
delayed, and server-error responses and inspect accepted synthetic writes. They
are not mounted by Youtarr itself.

For normal Youtarr API integrations such as bookmarklets and mobile shortcuts,
see [API Integration](API_INTEGRATION.md). This document is the authoritative
reference for the versioned external API contract, endpoint behavior, and
deployment requirements.
