# HCA Sports Analytics Solution

## Chat Context Export

- Export date: 2026-09-05
- Workspace: `D:\Personal\R&D\SportsAnalyticTool`
- Source site: <https://hcamatchcentre.sportsmechanics.in/>
- Application URL used during validation: <http://localhost:3000/>

This file preserves the working context, decisions, implementation history, validation evidence, and known limitations from the assistant/user collaboration.

## Original Objective

Build an analytics solution for Hyderabad Cricket Association tournament, team, and player performance across the last three available seasons, initially 2024, 2025, and 2026.

The requested capabilities evolved to include:

- Complete leaderboard extraction for batting and bowling.
- Team and Player section extraction.
- Local SQLite analytics database.
- Analyst-facing UI.
- Container deployment.
- Docker-free local operation.
- Local RBAC simulation before authentication is added.
- Enterprise architecture review and corrective actions.
- Low-latency UI with lazy loading and visible loading status.
- Evaluation of Node.js versus Python.
- A durable chat/project context export.

## Source Extraction History

### 2026 leaderboard extraction

The HCA Match Centre exposes JSONP feed files through S3 resources rather than requiring OCR or screenshot scraping.

Discovered source patterns:

- Competition catalog: `https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/competition.js`
- Batting feed: `https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/{competitionId}-toprunsscorers.js`
- Bowling feed: `https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/{competitionId}-mostwickets.js`
- Team aggregate feed: `https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/{competitionId}-teamoverallstats.js`
- Team Player feed: `https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/{competitionId}-{teamId}-playerstats.js`

Season mapping confirmed from the live catalog:

| Calendar year | Season ID |
| --- | --- |
| 2024 | 113 |
| 2025 | 114 |
| 2026 | 115 |

Tournament extraction results:

- 2024: 27 tournaments discovered and processed successfully.
- 2025: 27 tournaments discovered; 26 processed successfully.
- 2025 missing feed: `SYED MUSTHAQ ALI SELECTIONS`, with batting and bowling endpoints returning `404 Not Found`.
- 2026: 9 tournaments discovered and processed successfully.

The extractor preserves the source response objects and includes source endpoint and raw object-key information in the Markdown outputs.

## Generated Data Outputs

Leaderboard Markdown files:

- `exports/hca_2024_leaderboard_extract.md`
- `exports/hca_2025_leaderboard_extract.md`
- `exports/hca_2026_leaderboard_extract.md`

Raw leaderboard snapshots:

- `data/leaderboards/hca_2024_raw/`
- `data/leaderboards/hca_2025_raw/`
- `data/leaderboards/hca_2026_raw/`

Raw Team and Player snapshots:

- `data/hca_database_raw/`

## Database Solution

The local database is SQLite, accessed through `better-sqlite3` in read-only mode by the application.

Current database:

- `data/hca_analytics.sqlite`

Important tables:

- `seasons`
- `tournaments`
- `teams`
- `tournament_teams`
- `team_stats`
- `player_stats`
- `batting_leaderboard`
- `bowling_leaderboard`
- `source_feeds`

Analytical views:

- `v_player_season_analysis`
- `v_team_season_analysis`

Validated database coverage during the work:

- 63 tournaments across 2024-2026.
- 669 teams.
- 1,441 tournament-team memberships.
- 1,314 team-stat rows.
- 17,875 player-stat rows.
- 17,896 batting leaderboard rows.
- 12,497 bowling leaderboard rows.
- 95 failed source feeds recorded rather than hidden.

The application summary KPI query was later corrected to avoid SQL join multiplication inflating the match count. The corrected live summary returned:

- 63 tournaments.
- 669 teams.
- 7,661 distinct players.
- 6,808 matches.

## Analyst Report

Generated report:

- `exports/hca_expert_analytics_report.md`

The report includes:

- Evidence contract and scope.
- Batting and bowling leader tables.
- Team performance by season.
- Multi-season player trend signals.
- Minimum-sample confidence tiers.
- Data-quality checks.
- Failed-feed disclosure.
- Analyst review guidance.
- Future data requirements.

The report intentionally does not infer injuries, opposition strength, pitch effects, selection certainty, or causality because those fields are not in the source data.

## Application Design

The current application is a local analyst workbench:

- Backend: Node.js 22 and Express 5.
- Database driver: `better-sqlite3`.
- Frontend: static HTML, CSS, and browser JavaScript.
- UI design: dark green analyst workspace with lime accent, responsive layout, tables, filters, player detail dialog, and quality section.
- Static assets: `public/index.html`, `public/app.js`, `public/styles.css`.

Runtime code:

- `src/server.js`
- `src/rbac.js`
- `src/build_hca_database.js`
- `src/generate_analyst_report.js`
- `src/extract_hca_leaderboard.js`

## Low-Latency Changes

The application was redesigned for bounded, low-latency reads:

- Player and Team API endpoints accept `page` and `pageSize`.
- Server caps page size at 100.
- API responses use `{ rows, page, pageSize, total }`.
- Options are cached for 30 seconds.
- Player, Team, and Data Quality sections load lazily when opened.
- Browser invalidates section data after filters or role changes.
- A visible ARIA live region reports loading and error status.
- The browser does not receive an unbounded dataset.

A local warm sample of 20 requests to the bounded player endpoint produced approximately:

- Minimum: 47.79 ms.
- Median: 50.51 ms.
- Maximum: 56.58 ms.

This is a development-machine smoke measurement, not a production SLA or cross-language benchmark.

## Node.js Versus Python Decision

The current stack remains Node.js plus SQLite because:

- The workload is read-heavy.
- The database is local SQLite.
- The API is lightweight.
- `better-sqlite3` avoids ORM and database-network overhead.
- The UI and API can run in one small process.
- Python would not automatically provide lower latency for this workload.

Python/FastAPI becomes attractive when the solution adds:

- Polars or pandas feature engineering.
- scikit-learn model scoring.
- PyTorch or other deep-learning workloads.
- Notebook-driven production pipelines.
- Statistical modeling beyond SQL aggregates.

A future Python model service can be added behind a versioned API without replacing the Node UI/API serving layer. A fair Node/Python comparison requires identical SQL, indexes, response sizes, concurrency, hardware, warm/cold-cache conditions, and runtime versions.

Detailed decision document:

- `docs/HCA_PERFORMANCE_ARCHITECTURE.md`

## RBAC Design

Authentication is intentionally disabled for the local pilot. Authorization is implemented through server-side permission middleware.

Local roles:

- `viewer`: overview, players, teams.
- `analyst`: viewer plus quality.
- `coach`: overview, players, teams, player detail.
- `data_engineer`: overview and quality.
- `admin`: all current read permissions.

The local browser role selector sends `X-Dev-Role`. The server remains authoritative; UI hiding is only a usability feature.

Validated role behavior:

- Viewer: Player access `200`, Quality access `403`.
- Analyst: Player and Quality access `200`.
- Coach: Player access `200`, Quality access `403`.
- Data Engineer: Quality access `200`, Player access `403`.
- Admin: all current read access `200`.

RBAC documents:

- `src/rbac.js`
- `docs/HCA_RBAC_DESIGN.md`

## Architecture Review

The solution architecture review classified the system as suitable for a controlled internal pilot, not production-ready.

Highest-priority gaps identified:

- No authentication or authorization for shared deployment.
- No analyst decision audit trail.
- Ingestion is not transactionally staged or atomically published.
- No source schema-drift detection.
- No canonical player/team identity mastering.
- No contextual opposition, venue, workload, fitness, or ball-by-ball model.
- No automated test suite or CI quality gate.
- Container build not verified when Docker Desktop was unavailable.
- Minimal operational observability.
- No formal retention/privacy policy.

Review document:

- `docs/HCA_SOLUTION_ARCHITECTURE_REVIEW.md`

## Project Organization

The application was reorganized under:

```text
SportsAnalyticTool/
  src/                    Runtime, RBAC, extraction, ingestion, reporting
  public/                 UI
  data/                   SQLite and raw source data
  exports/                Generated Markdown reports and extracts
  docs/                   Setup and architecture documents
  README.md               Entry-point instructions
  package.json            npm scripts
  Dockerfile              Container image
  docker-compose.yml      Compose deployment
```

The existing SQLite snapshot was moved and reused. Normal local startup does not rebuild the database.

## Commands

From `D:\Personal\R&D\SportsAnalyticTool`:

### Install dependencies

```powershell
npm install
```

### Start the existing application snapshot

```powershell
npm start
```

Open <http://localhost:3000/>.

### Explicitly refresh the database

Only run when a source refresh is required:

```powershell
npm run build-database
npm run generate-report
```

Restart `npm start` after a rebuild.

### Extract leaderboard files explicitly

```powershell
npm run extract-leaderboards
```

## Validation History

Checks performed during the project:

- Live source inspection through browser and network resources.
- JSONP parsing from source feeds.
- Raw snapshot preservation.
- Database row-count and schema checks.
- Node syntax checks.
- VS Code diagnostics with no errors in reviewed runtime files.
- npm audit with zero known vulnerabilities at the time of review.
- Local API smoke tests.
- Browser UI smoke tests.
- RBAC role matrix tests.
- Lazy-loading UI check.
- Pagination envelope tests.
- Local latency sample.

## Known Limitations

- Docker image build was not completed in this environment because Docker Desktop's Linux engine was unavailable at the time of testing.
- Authentication is not implemented; local `X-Dev-Role` simulation must never be exposed to a shared or production network.
- Source feed failures remain and are explicitly recorded.
- API query results are descriptive and not causal.
- Player totals can represent player/team records rather than a fully mastered global identity until canonical identity mapping is added.
- Production readiness still requires atomic dataset publishing, authentication, audit logging, schema contracts, CI tests, monitoring, backups, and contextual cricket data.

## Next Recommended Work

1. Add automated API and browser tests.
2. Implement staged/atomic dataset snapshots.
3. Add canonical player and team identity dimensions.
4. Add authentication and persistent analyst decision audit records.
5. Add match-level and ball-by-ball context.
6. Build and test the container in Linux CI.
7. Establish p50/p95 performance budgets under expected concurrent analyst load.
