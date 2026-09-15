# Incremental Sync Design — HCA Performance Lab

## Problem Statement

`build_hca_database.js` is a full-rebuild script: every run fetches every feed URL regardless of whether data already exists. With ~50+ tournaments and multiple teams per tournament, a full run makes 200–400 HTTP requests and takes several minutes.

**Goals:**
- Fetch only what is missing or explicitly requested
- Allow granular sync: catalog only, one tournament, one team, or specific players
- Expose a UI so non-technical users can trigger targeted syncs without touching the CLI
- Keep the existing full-rebuild script working for first-time or forced refreshes

---

## Current State

```
build_hca_database.js          ← standalone Node script, runs outside the server
  └─ fetches ALL feeds          ← always, no skip logic
  └─ writes raw JSON to disk    ← data/hca_database_raw/{competitionId}/
  └─ INSERT OR IGNORE to DB     ← data not overwritten, but still fetched

server.js                       ← opens DB readonly, no write endpoints
  └─ source_feeds table         ← tracks URL/status/fetched_at — already exists
  └─ no sync endpoints
```

### What `source_feeds` already gives us

`source_feeds (source_url PK, status, fetched_at, raw_path, error)` already records
every URL that has ever been fetched. This is the foundation for skip logic — we just
need to read it before deciding whether to re-fetch.

---

## Proposed Architecture

```
┌──────────────────────────────────────────────────────┐
│  src/sync-engine.js   (new)                          │
│  ─────────────────────────────────────────────────── │
│  syncCatalog()         → refreshes catalog/teams     │
│  syncTournament(id)    → team stats + all team feeds  │
│  syncTeam(compId, tid) → one team's player stats     │
│  syncFull()            → catalog + all tournaments    │
│  All functions return an async generator (progress)  │
└──────────────────────────────────────────────────────┘
         │ used by
         ▼
┌──────────────────────────────────────────────────────┐
│  src/sync-routes.js   (new)                          │
│  ─────────────────────────────────────────────────── │
│  POST /api/sync/catalog                              │
│  POST /api/sync/tournament/:id                       │
│  POST /api/sync/tournaments      { ids: [1,2,3] }    │
│  POST /api/sync/team/:cid/:tid                       │
│  POST /api/sync/full                                 │
│  GET  /api/sync/status           summary per scope   │
│  GET  /api/sync/progress/:jobId  SSE stream          │
└──────────────────────────────────────────────────────┘
         │ mounted in
         ▼
┌──────────────────────────────────────────────────────┐
│  src/server.js   (updated)                           │
│  ─────────────────────────────────────────────────── │
│  DB opened read-write (remove { readonly: true })    │
│  read queries unchanged                              │
│  sync routes mounted at /api/sync (admin/data_eng)   │
└──────────────────────────────────────────────────────┘
         │ writes to
         ▼
┌──────────────────────────────────────────────────────┐
│  SQLite DB                                           │
│  ─────────────────────────────────────────────────── │
│  [existing] source_feeds  ← skip-logic anchor        │
│  [existing] tournaments, teams, team_stats, etc.     │
│  [new] sync_jobs           ← job history             │
└──────────────────────────────────────────────────────┘
```

---

## Schema Changes

One new table. No changes to existing tables.

```sql
CREATE TABLE IF NOT EXISTS sync_jobs (
  job_id     TEXT PRIMARY KEY,          -- UUID v4
  scope      TEXT NOT NULL,             -- 'catalog' | 'tournament:28' | 'team:28:145' | 'full'
  requested_at TEXT NOT NULL,           -- ISO 8601
  completed_at TEXT,
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | running | success | partial | failed
  total      INTEGER DEFAULT 0,         -- total feeds to fetch
  done       INTEGER DEFAULT 0,         -- feeds processed so far
  errors     INTEGER DEFAULT 0,         -- feeds that failed
  inserted   INTEGER DEFAULT 0,         -- new DB rows written
  skipped    INTEGER DEFAULT 0,         -- feeds skipped (already current)
  summary    TEXT                       -- JSON blob: per-feed results
);
```

No changes to `source_feeds`, `player_stats`, etc. The skip logic reads `source_feeds`
directly: if a URL has `status = 'success'` and the caller did not pass `?force=true`,
the feed is skipped.

---

## Skip Logic

```javascript
// In sync-engine.js
async function shouldFetch(db, url, force = false) {
  if (force) return true;
  const row = db.prepare('SELECT status FROM source_feeds WHERE source_url = ?').get(url);
  return !row || row.status !== 'success';
}
```

**Behaviour table:**

| `source_feeds` row | `force` flag | Action |
|---|---|---|
| Missing | any | Fetch |
| `status = 'success'` | false | **Skip** |
| `status = 'success'` | true | Re-fetch and `INSERT OR REPLACE` |
| `status = 'failed'` | any | Retry |

When skipping, `skipped` counter increments but the feed record is not touched.
When force-re-fetching, data rows use `INSERT OR REPLACE` instead of `INSERT OR IGNORE`
so stats can be updated.

---

## API Endpoints

### `GET /api/sync/status`

Returns per-tournament sync state derived from `source_feeds` and `sync_jobs`.

```json
{
  "catalog": { "last_synced": "2026-09-12T07:30:00Z", "status": "success" },
  "tournaments": [
    {
      "competition_id": 28,
      "name": "HCA T20 2025",
      "season_year": 2025,
      "team_feeds": 12,
      "feeds_ok": 11,
      "feeds_failed": 1,
      "last_synced": "2026-09-12T07:31:15Z",
      "sync_status": "partial"
    }
  ]
}
```

### `POST /api/sync/catalog`

Fetches `competition.js`, updates `tournaments` and `teams` tables.
Returns `{ job_id, status: "started" }`.

### `POST /api/sync/tournament/:id`

Fetches `{id}-teamoverallstats.js` + all `{teamId}-playerstats.js` for that competition.
Body (optional): `{ "force": true }` to re-fetch already-successful feeds.

### `POST /api/sync/tournaments`

Body: `{ "ids": [28, 34, 45], "force": false }`

Queues one job covering all listed tournaments. Progress SSE reports per-tournament
progress, not just per-feed.

### `POST /api/sync/team/:competitionId/:teamId`

Fetches a single player-stats feed. Useful for targeted retries.

### `POST /api/sync/full`

Full rebuild equivalent. Restricted to `admin` role.

### `GET /api/sync/progress/:jobId`

Server-Sent Events stream. Each event:

```
event: progress
data: {"done":5,"total":50,"errors":1,"inserted":42,"skipped":3,"latest":"Team Hyderabad Blues — 18 records"}

event: complete
data: {"status":"partial","done":50,"total":50,"errors":2,"inserted":380,"skipped":10}
```

Client closes the EventSource on `complete` or `error` events.

---

## Sync Engine — Key Functions

```javascript
// src/sync-engine.js (pseudocode outline)

async function* syncTournament(db, competitionId, { force = false } = {}) {
  const teams = db.prepare(
    'SELECT DISTINCT team_id FROM tournament_teams WHERE competition_id = ?'
  ).all(competitionId);

  const jobs = [
    { kind: 'team', url: teamStatsUrl(competitionId) },
    ...teams.map(r => ({ kind: 'player', url: playerStatsUrl(competitionId, r.team_id), teamId: r.team_id }))
  ];

  let done = 0, inserted = 0, errors = 0, skipped = 0;

  for (const job of jobs) {
    if (!(await shouldFetch(db, job.url, force))) {
      skipped++;
      yield { event: 'progress', done: ++done, total: jobs.length, skipped, errors, inserted, latest: `Skipped ${job.url}` };
      continue;
    }
    try {
      const { data } = await fetchFeed(job.url);
      const n = writeJobData(db, job, data, force);  // returns row count
      inserted += n;
      markFeed(db, job.url, 'success');
      yield { event: 'progress', done: ++done, total: jobs.length, skipped, errors, inserted, latest: `OK — ${n} records` };
    } catch (err) {
      errors++;
      markFeed(db, job.url, 'failed', err.message);
      yield { event: 'progress', done: ++done, total: jobs.length, skipped, errors, inserted, latest: `FAIL — ${err.message}` };
    }
  }

  yield { event: 'complete', status: errors ? 'partial' : 'success', done, total: jobs.length, skipped, errors, inserted };
}
```

`writeJobData` uses `INSERT OR IGNORE` by default and `INSERT OR REPLACE` when `force = true`.

---

## Raw JSON Storage Strategy

Currently raw JSON is written to disk (`data/hca_database_raw/`) **and** stored in the
`raw_json` column of each table. The disk files are only used during the initial load.

**Recommendation: keep both, but make disk the authoritative cache.**

| Path | Purpose |
|---|---|
| `data/hca_database_raw/{competitionId}/teamoverallstats.json` | Disk cache — checked before network |
| `data/hca_database_raw/{competitionId}/{teamId}-playerstats.json` | Disk cache |
| `raw_json` column in `team_stats` / `player_stats` | In-DB copy for API access (already in use) |

Before making a network request the sync engine checks whether the corresponding disk
file exists **and** `source_feeds.status = 'success'`. If both are true and `force` is
false, the sync is skipped entirely — no network, no disk read.

This means a machine with a populated `data/hca_database_raw/` directory can rebuild the
DB from local files without any network access (useful for dev resets):

```powershell
node src/build-from-cache.js   # new script — reads disk files, skips HTTP
```

---

## UI — Sync Manager Panel

**Access:** `data_engineer` and `admin` roles only (new permission `write:sync`).

```
┌─────────────────────────────────────────────────────────────────┐
│  Data Sync Manager                        [Refresh Catalog]      │
├──────────────────────────────────────────────────────────────────┤
│  Filter: [All years ▾]  [All status ▾]  [Search tournament...]   │
├──┬──────────────────────┬──────┬─────────────────┬─────────────┤
│  │ Tournament           │ Year │ Last Synced      │ Status      │
├──┼──────────────────────┼──────┼─────────────────┼─────────────┤
│☑ │ HCA T20 Elite        │ 2025 │ 2026-09-12 07:31 │ ● Success   │
│☑ │ HCA One Day Trophy   │ 2025 │ Never            │ ○ Pending   │
│☐ │ HCA Under-23         │ 2026 │ 2026-09-10 09:00 │ ⚠ Partial   │
│☐ │ HCA Women's T20      │ 2025 │ 2026-09-12 07:31 │ ● Success   │
├──┴──────────────────────┴──────┴─────────────────┴─────────────┤
│  [Sync Selected (2)]  [Sync All]  [☐ Force re-fetch]           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Progress — HCA One Day Trophy  (job abc-123)                   │
│  ─────────────────────────────────────────────────────────────  │
│  ████████████░░░░░░░░░░  62%   31 / 50 feeds                   │
│                                                                  │
│  ✓ teamoverallstats — 8 records                                  │
│  ✓ 145-playerstats — 22 records                                  │
│  ✓ 148-playerstats — 19 records                                  │
│  ⚠ 151-playerstats — 404 Not Found                               │
│  ⟳ 153-playerstats — fetching…                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Interaction flow:**
1. User opens sync panel → `GET /api/sync/status` populates the table
2. User selects tournaments → clicks **Sync Selected**
3. Browser `POST /api/sync/tournaments { ids: [...] }` → receives `{ job_id }`
4. Browser opens `EventSource /api/sync/progress/{job_id}` → progress log updates live
5. On `complete` event → EventSource closed, status table refreshed

---

## RBAC Changes

Add a new permission `write:sync` to the roles that should be able to trigger syncs:

| Role | `write:sync` |
|---|---|
| viewer | ✗ |
| analyst | ✗ |
| coach | ✗ |
| data_engineer | ✓ |
| admin | ✓ |

All `POST /api/sync/*` endpoints check `requirePermission('write:sync')`.
`GET /api/sync/status` can be `read:quality` (already available to analyst+).

---

## Implementation Phases

### Phase 1 — Skip logic in build script (no UI, no server changes)

Update `build_hca_database.js` to skip URLs already in `source_feeds` with
`status = 'success'`. Add `--force` flag to override.

**Effort:** ~30 min. **Value:** immediate — subsequent runs go from minutes to seconds.

```
node src/build_hca_database.js            # skips already-fetched feeds
node src/build_hca_database.js --force    # re-fetches everything
node src/build_hca_database.js --tournament 28   # only tournament 28
```

### Phase 2 — Sync engine + write endpoints (no UI)

- Create `src/sync-engine.js` with `syncCatalog`, `syncTournament`, `syncTeam`, `syncFull`
- Create `src/sync-routes.js` with POST endpoints + SSE progress
- Reopen DB in read-write mode in `server.js`
- Add `sync_jobs` table to schema
- Add `write:sync` permission to RBAC

**Effort:** ~3–4 hours. **Value:** programmatic sync via API calls.

### Phase 3 — Sync Manager UI

- Add "Sync" nav tab (visible to `data_engineer` / `admin` only)
- Tournament table with checkboxes + status badges
- Progress log panel with SSE
- Force re-fetch checkbox

**Effort:** ~3–4 hours. **Value:** non-technical operators can refresh data without CLI.

### Phase 4 — Disk-cache rebuild (offline mode)

- `src/build-from-cache.js` — reads existing disk JSON, skips HTTP, repopulates DB
- Useful for DB corruption recovery without network access

**Effort:** ~1 hour.

---

## Files to Create / Modify

| File | Action | Phase |
|---|---|---|
| `src/build_hca_database.js` | Add skip logic + `--force` + `--tournament` flags | 1 |
| `src/sync-engine.js` | New — sync functions + skip/force logic | 2 |
| `src/sync-routes.js` | New — Express routes + SSE | 2 |
| `src/server.js` | Remove `readonly`, mount sync-routes, update DB open | 2 |
| `src/rbac.js` | Add `write:sync` permission | 2 |
| `public/app.js` | Add sync panel render + SSE client | 3 |
| `public/index.html` | Add Sync nav tab | 3 |
| `src/build-from-cache.js` | New — offline DB rebuild from disk cache | 4 |

---

## Notes and Constraints

- **better-sqlite3 is synchronous.** All DB writes inside sync must be inside a transaction
  or a single `.run()` call. The async fetch and the synchronous write remain separated
  (fetch all in a batch → write all in a transaction) as they are today.
- **Server-Sent Events require the response to stay open.** The SSE endpoint cannot be
  behind a timeout proxy. For production, set `app.set('keepAliveTimeout', 0)` or expose
  the sync endpoint on a second port.
- **Concurrent sync jobs.** Phase 2 implementation will reject a second POST if a job
  is already `running` for the same scope. A simple in-memory set of active scopes is
  sufficient — no queue needed for local use.
- **Force re-fetch updates existing rows.** When `force = true`, data tables switch from
  `INSERT OR IGNORE` to `INSERT OR REPLACE`. This means stats can go backwards if the
  upstream feed is corrected. Log the change in `sync_jobs.summary` so it is traceable.
