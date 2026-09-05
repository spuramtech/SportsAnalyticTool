# HCA Performance Lab

## 1. Purpose

HCA Performance Lab is a local, container-ready analyst UI for reviewing the extracted Hyderabad Cricket Association data from 2024-2026. It provides:

- Season and tournament filters
- Player output and opportunity metrics
- Team results and efficiency metrics
- Player season detail drill-through
- Data-quality and failed-source visibility
- SQLite-backed API access to the existing analytical database
- Local RBAC role simulation without authentication
- Lazy section loading with visible request status

The UI is decision support. It does not make automatic selection decisions and does not infer fitness, injury, opposition strength, venue effects, or causality from fields that are not present in the source data.

## 2. Prerequisites

### Local development

- Node.js 22 or later
- npm 10 or later
- `data\hca_analytics.sqlite`

### Container deployment

- Docker Engine 24 or later
- Docker Compose v2

## 3. Install and run locally without Docker

This is the simplest way to run the application on Windows. Docker is not required.

### 3.1 Open the project folder

In PowerShell, move to the folder containing `package.json`:

```powershell
cd "D:\Personal\R&D"
```

You should see these important files:

- `package.json`
- `src\server.js`
- `data\hca_analytics.sqlite`
- `public\index.html`

### 3.2 Confirm Node.js and npm

```powershell
node --version
npm --version
```

Node.js 22 or later is recommended. If `node` is not recognized, install the current Node.js LTS release and reopen PowerShell.

### 3.3 Install dependencies

Run this once after downloading or cloning the project:

```powershell
npm install
```

This installs Express for the API/static server and `better-sqlite3` for read-only database access.

### 3.4 Start with the existing database snapshot

The repository already contains `data\hca_analytics.sqlite`. To start the UI without downloading anything:

```powershell
npm start
```

The terminal should show:

```text
HCA Analytics running on http://0.0.0.0:3000
```

Open [http://localhost:3000](http://localhost:3000) in a browser. Keep the PowerShell window open while using the application. Press `Ctrl+C` to stop it.

### 3.5 Rebuild the database from the HCA feeds

Use this only when you need to refresh or recreate the data. It requires internet access to the HCA feed endpoints and may take several minutes because it downloads Team and Player feeds across 2024-2026:

```powershell
npm run build-database
npm run generate-report
```

Then restart the application:

```powershell
npm start
```

The web server opens the SQLite database when it starts, so a running server must be restarted after a rebuild.

### 3.6 Run with a different port

If port 3000 is already in use, choose another port:

```powershell
$env:PORT=3001
npm start
```

Open `http://localhost:3001`. To remove the setting from the current PowerShell session:

```powershell
Remove-Item Env:PORT
```

### 3.7 Use another database file

The server defaults to `data\hca_analytics.sqlite`. To point it at another read-only database:

```powershell
$env:DATABASE_PATH="D:\data\hca_analytics.sqlite"
npm start
```

The custom database must contain the tables created by `src\build_hca_database.js`, including `seasons`, `tournaments`, `team_stats`, `player_stats`, and `source_feeds`.

### 3.8 Verify the local application

With the server running, check the API from a second PowerShell window:

```powershell
Invoke-RestMethod http://localhost:3000/api/summary
Invoke-RestMethod "http://localhost:3000/api/players?year=2025&search=reddy"
Invoke-WebRequest -UseBasicParsing http://localhost:3000/ | Select-Object StatusCode
```

The first command should return summary counts, the second should return matching player records, and the last should return status code `200`.

### 3.9 Local-only operating modes

- **UI only, existing data:** `npm start`
- **Refresh data and report:** `npm run build-database`, then `npm run generate-report`
- **Generate report only:** `npm run generate-report`

The UI does not need the raw feed directories at runtime. It only needs the SQLite database. The raw directories are required when rebuilding or auditing source provenance.

### Performance note

The serving path uses Node.js with `better-sqlite3` and bounded API responses. The Player, Team, and Data Quality sections are lazy-loaded when opened, and the UI displays loading or error status during requests. A warm local sample of 20 requests to the bounded player endpoint completed with an observed median of approximately 50 ms on the development machine; this is an environment-specific smoke measurement, not a production SLA.

### 3.10 Stop the local server

Return to the PowerShell window running `npm start` and press:

```text
Ctrl+C
```

The process is local-only unless you deliberately expose port 3000 through your firewall or network configuration.

## 4. Install and run locally (short form)

The short form is:

```powershell
npm install
npm run generate-report
npm start
```

Open `http://localhost:3000`.

The server reads the database in read-only mode. Rebuild data separately with:

```powershell
npm run build-database
npm run generate-report
```

Then restart `npm start` to pick up the rebuilt database.

## 5. Run with Docker Compose

```powershell
docker compose up --build -d
```

Open `http://localhost:3000`.

The compose file mounts `data\hca_analytics.sqlite` read-only at `/app/data/hca_analytics.sqlite`. This keeps the database outside the image and makes refreshes operationally simple. After rebuilding the database on the host, restart the service:

```powershell
docker compose restart hca-analytics
```

Check status and logs:

```powershell
docker compose ps
docker compose logs -f hca-analytics
```

Stop the service:

```powershell
docker compose down
```

## 6. Build and run the image directly

```powershell
docker build -t hca-analytics:local .
docker run --rm -p 3000:3000 `
  -e DATABASE_PATH=/app/data/hca_analytics.sqlite `
  hca-analytics:local
```

For production-like operation, mount the database read-only:

```powershell
docker run -d --name hca-analytics `
  -p 3000:3000 `
  -e DATABASE_PATH=/app/data/hca_analytics.sqlite `
  -v "${PWD}/data/hca_analytics.sqlite:/app/data/hca_analytics.sqlite:ro" `
  --restart unless-stopped `
  hca-analytics:local
```

## 7. Local RBAC testing

Authentication is intentionally disabled during the local pilot, but every protected API route still evaluates an explicit role. The browser role selector sends the role as `X-Dev-Role`. This lets the team test least-privilege behavior before connecting an identity provider.

Available local roles:

| Role | Access |
| --- | --- |
| `viewer` | Overview, player performance, and team performance |
| `analyst` | Viewer access plus data-quality and failed-feed review |
| `coach` | Overview, player/team performance, and player detail drill-through |
| `data_engineer` | Overview and data-quality/source operations |
| `admin` | All current pilot read permissions |

The default role is `analyst`. Select another role in the **Local role** control and refresh the page sections. A direct API role test looks like:

```powershell
Invoke-RestMethod http://localhost:3000/api/session -Headers @{ 'X-Dev-Role' = 'viewer' }
Invoke-RestMethod http://localhost:3000/api/quality -Headers @{ 'X-Dev-Role' = 'viewer' }
```

The first request succeeds. The second returns HTTP `403`, because `viewer` does not have `read:quality`. This is role simulation, not authentication or security. Do not expose the app to a shared network until real authentication, authorization claim validation, TLS, and audit logging are added.

Implementation files:

- `src/rbac.js`: role definitions, permissions, and request-context adapter
- `src/server.js`: route-level permission enforcement
- `public/app.js`: local role selector and capability-aware data loading

When authentication is added later, replace the `context(request)` input adapter with validated identity-provider claims. Keep the permission names and route guards unchanged.

## 8. API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/options` | Available years and tournaments |
| `GET /api/summary?year=2025&tournament=61` | KPI summary |
| `GET /api/players?year=2025&search=reddy` | Player table, filtered and ranked by runs |
| `GET /api/teams?year=2025` | Team performance table |
| `GET /api/players/:playerId` | Player season/tournament detail |
| `GET /api/quality` | Source failures and data checks |
| `GET /api/session` | Current simulated role and permissions |
| `GET /api/roles` | Roles available for local testing |

## 9. UI workflow

1. Start on **Overview** to confirm coverage and feed gaps.
2. Select a season or tournament and apply filters.
3. Use **Player pool** to compare runs, strike rate, wickets, economy, and evidence tier.
4. Select a player row to inspect tournament-level records.
5. Use **Team performance** to compare wins, points, win rate, and run ratio together.
6. Review **Data quality** before using any output in a selection or planning meeting.

## 10. Data and decision safeguards

- Player rankings use opportunity-adjusted values where available.
- High evidence requires 3 matches, 3 batting innings, and 100 runs, or 3 bowling matches, 60 legal balls, and 3 wickets.
- Missing feeds are reported as missing; they are not interpreted as zero.
- The UI does not claim that a player is better without cohort and sample context.
- Coaching decisions must add video, workload, fitness, role, opposition, venue, and phase-of-play context.

## 11. Production hardening checklist

Before exposing the service outside a trusted network:

- Put it behind HTTPS and an authenticated reverse proxy.
- Restrict access to authorized analysts and coaching staff.
- Back up the SQLite database and raw feed archive.
- Pin the Node and dependency versions in CI.
- Run a scheduled data refresh with an approval gate.
- Monitor `/api/summary` and container health status.
- Keep an analyst decision log separate from source data.
- Add match-level and ball-by-ball data before making tactical or selection claims.

## 12. Troubleshooting

### Database not found

Confirm `data\hca_analytics.sqlite` exists and that `DATABASE_PATH` points to it.

### `npm start` says the port is already in use

Use another port in the current PowerShell session:

```powershell
$env:PORT=3001
npm start
```

### `npm install` fails while installing `better-sqlite3`

Use Node.js 22 LTS, remove `node_modules`, and retry:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

Do not delete `package-lock.json`; it keeps dependency versions reproducible.

### UI loads but shows an error

Check:

```powershell
curl http://localhost:3000/api/summary
```

Then inspect server logs. The API expects the database tables produced by `src\build_hca_database.js`.

### New data is not visible

Rebuild the database, regenerate the report, then restart the server or container. The running process opens the database when it starts.

## 13. File map

- `src/server.js`: read-only Express API and static file server
- `src/rbac.js`: local RBAC policy and authentication integration boundary
- `public/index.html`: UI structure
- `public/app.js`: filters, navigation, API calls, and detail drawer
- `public/styles.css`: responsive analyst workbench styling
- `src/build_hca_database.js`: source ingestion and SQLite build
- `src/generate_analyst_report.js`: analytical views and Markdown report
- `src/extract_hca_leaderboard.js`: leaderboard feed extraction
- `Dockerfile`: production container image
- `docker-compose.yml`: local container deployment
- `data/hca_analytics.sqlite`: current database snapshot
- `data/leaderboards/`: raw leaderboard feed snapshots
- `exports/`: generated extracts and reports
