# HCA Performance Lab

Local analyst workbench for Hyderabad Cricket Association tournament, team, player, and leaderboard data.

## Start the application locally

The SQLite database is already included. Starting the app does **not** rebuild or download data.

```powershell
npm install
npm start
```

Open <http://localhost:3000>.

## Refresh data only when needed

These commands download source feeds and replace the data snapshot. Run them deliberately, not as part of normal startup:

```powershell
npm run build-database
npm run generate-report
```

Then restart `npm start`.

## Project structure

```text
src/                    Node server, RBAC, ingestion, extraction, reporting
public/                 Browser UI assets
data/
  hca_analytics.sqlite  Current local SQLite snapshot
  hca_database_raw/     Team and Player raw feed archive
  leaderboards/         2024-2026 leaderboard raw snapshots
exports/                Generated Markdown extracts and reports
docs/                   Architecture, setup, review, and RBAC documentation
```

## Local RBAC simulation

Authentication is disabled for the local pilot. Select a role in the UI or send `X-Dev-Role` to test permissions:

```powershell
Invoke-RestMethod http://localhost:3000/api/session -Headers @{ 'X-Dev-Role' = 'viewer' }
```

Available roles: `viewer`, `analyst`, `coach`, `data_engineer`, and `admin`.

## Key documentation

- [Local setup and deployment](docs/HCA_UI_SETUP.md)
- [RBAC design](docs/HCA_RBAC_DESIGN.md)
- [Analytics architecture](docs/HCA_ANALYTICS_ARCHITECTURE.md)
- [Solution architecture review](docs/HCA_SOLUTION_ARCHITECTURE_REVIEW.md)
- [Low-latency architecture decision](docs/HCA_PERFORMANCE_ARCHITECTURE.md)
