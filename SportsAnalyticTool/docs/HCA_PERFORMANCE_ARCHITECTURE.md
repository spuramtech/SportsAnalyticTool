# HCA Performance Lab: Low-Latency Architecture Decision

## Decision summary

Keep the application on **Node.js 22 + Express 5 + better-sqlite3 + vanilla browser JavaScript** for the current local and small-team analyst workload.

This is not a claim that Node.js is universally faster than Python. It is a workload-specific decision based on the current facts:

- The database is a local SQLite file.
- The application is read-heavy.
- Queries are synchronous and short-lived.
- `better-sqlite3` avoids ORM and database-network overhead.
- The UI is static and can be served from the same process.
- The current dataset is small enough for SQLite and bounded API responses.

Python FastAPI is a valid future option, but moving to Python now would add a second runtime and would not inherently improve SQLite query latency. The dominant latency factors here are SQL shape, indexes, payload size, browser rendering, and network distance, not the language alone.

## Target request path

```text
Browser
  -> static HTML/CSS/JS
  -> one bounded API request when a section is opened
  -> prepared SQLite query against local read-only snapshot
  -> compact JSON envelope with pagination metadata
  -> incremental table rendering
```

## Changes implemented

### Lazy loading

- Overview loads its KPI and preview data initially.
- Player, Team, and Data Quality sections load only when first opened.
- Loaded sections are cached in the browser until a filter or role changes.
- Filter and role changes invalidate section data and reload the active section.

### Loading and error visibility

- `#loading-status` is an ARIA live region.
- Requests show labels such as `Loading player pool...` and `Checking source quality...`.
- Failures remain visible instead of leaving an empty table with no explanation.
- A small CSS spinner is used only while a request is active.

### API response discipline

- Player and team endpoints accept `page` and `pageSize`.
- `pageSize` is capped at 100 server-side.
- Responses are `{ rows, page, pageSize, total }`.
- The API does not send an unbounded dataset to the browser.
- Options are cached for 30 seconds because they change infrequently.

### Server-side cache

A short 30-second in-process cache is used only for static options. The current SQLite database is read-only and refreshed explicitly, so this avoids stale analytical results while reducing repeated filter-option queries.

## Why not Python now?

A Python FastAPI implementation could be appropriate when the system needs Python-native modeling, pandas/Polars pipelines, scikit-learn, PyTorch, or a separate analytical service. It is not justified solely for UI latency.

A fair comparison requires a benchmark with identical:

- SQLite file and indexes
- SQL statements and filters
- JSON response sizes
- concurrency level
- warm/cold cache conditions
- hardware and runtime versions

Without that benchmark, claiming Python or Node is faster would be speculation. The current design keeps the fast path simple and leaves room for a Python model service later if advanced analytics require it.

## When to change the stack

Move the serving layer to PostgreSQL or a columnar analytical store when one or more of these become true:

- Multiple analysts need concurrent writes or saved decisions.
- The database grows beyond the practical local SQLite snapshot model.
- Match-level and ball-by-ball queries require broad scans and complex joins.
- A shared deployment needs HA, backups, row-level security, and operational monitoring.

Add a Python service when one or more of these become true:

- Feature engineering or model scoring becomes a first-class workload.
- Analysts need reproducible notebooks and Python libraries in production pipelines.
- Ranking requires statistical models beyond SQL aggregates.

The UI/API can remain Node while a Python scoring service is introduced behind a versioned API.

## Validation performed

- JavaScript syntax checks for server and browser client.
- API smoke tests for summary, paginated players, paginated teams, and role enforcement.
- Browser smoke test for the UI shell, local role selector, and section navigation.
- Existing database used without a rebuild.

## Remaining production gates

- Add automated browser and API tests to CI.
- Add atomic dataset snapshots before shared deployment.
- Add authentication and audit logging.
- Add database indexes based on measured query plans.
- Benchmark p50/p95 latency under expected concurrent analyst load.
- Add match-level context before using the output for selection or causal claims.
