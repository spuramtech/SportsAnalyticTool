# Local Run — HCA Performance Lab

## Prerequisites

- Node.js 22+
- `data\hca_analytics.sqlite` present

## Start (existing data)

```powershell
cd "D:\Personal\R&D\SportsAnalyticTool"
npm install   # once after first clone
npm start
```

Open <http://localhost:3000>. Press `Ctrl+C` to stop.

## Rebuild data

Run these only when you need to refresh from the HCA feeds. Requires internet access.

```powershell
npm run build-database
npm run generate-report
npm start
```

## Common options

| Scenario | Command |
|---|---|
| Different port | `$env:PORT=3001; npm start` |
| Different database | `$env:DATABASE_PATH="D:\data\other.sqlite"; npm start` |
| Generate report only | `npm run generate-report` |
| Extract leaderboards | `npm run extract-leaderboards` |

## Quick API checks

```powershell
Invoke-RestMethod http://localhost:3000/api/summary
Invoke-RestMethod "http://localhost:3000/api/players?year=2025&search=reddy"
Invoke-RestMethod http://localhost:3000/api/session -Headers @{ 'X-Dev-Role' = 'viewer' }
```

## RBAC roles

| Role | Access |
|---|---|
| `viewer` | Overview, players, teams |
| `analyst` | Viewer + data quality |
| `coach` | Overview, players/teams, player detail |
| `data_engineer` | Overview + data quality/source ops |
| `admin` | All pilot read permissions |

Default role is `analyst`. Select another in the UI or pass `X-Dev-Role` header.

## Troubleshooting

**Port in use** — use `$env:PORT=3001` before `npm start`.

**`npm install` fails on `better-sqlite3`** — ensure Node.js 22 LTS, then:
```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

**No data visible** — confirm `data\hca_analytics.sqlite` exists. Rebuild with `npm run build-database` if missing.

**New data not showing** — rebuild the database and restart the server; the database is opened at startup.

---

Full setup and Docker instructions: [docs/HCA_UI_SETUP.md](docs/HCA_UI_SETUP.md)