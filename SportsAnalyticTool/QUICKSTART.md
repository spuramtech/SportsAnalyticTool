# HCA Performance Lab — Quick Start

Follow these steps in order. Each step has a verification check before moving to the next.

---

## Step 1 — Open a PowerShell window in the project folder

Press **Win + X → Windows PowerShell** (or Windows Terminal), then run:

```powershell
cd "D:\Personal\R&D\SportsAnalyticTool"
```

Confirm you are in the right place:

```powershell
Get-ChildItem package.json, src\server.js, data\hca_analytics.sqlite
```

You should see all three files listed. If `data\hca_analytics.sqlite` is missing, run the database build first (see Step 4 below).

---

## Step 2 — Install dependencies (first time only)

```powershell
npm install
```

Wait for it to finish. When it succeeds the last line looks like:

```
added 26 packages ...
```

If you see an error about `better-sqlite3`, use Node.js 22 LTS and retry:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

---

## Step 3 — Start the server

```powershell
npm start
```

The terminal must show:

```
HCA Analytics running on http://0.0.0.0:3000
```

**Keep this PowerShell window open.** The app stops if you close it or press Ctrl+C.

---

## Step 4 — Open the app in a browser

Open any browser and go to:

```
http://localhost:3000
```

You should see the HCA Performance Lab dashboard with an Overview section at the top.

> If the page is blank or shows a connection error, check the troubleshooting section below before anything else.

---

## Step 5 — Verify the API is responding (optional sanity check)

Open a **second** PowerShell window (leave the server running in the first) and run:

```powershell
Invoke-RestMethod http://localhost:3000/api/summary
```

This should print counts for tournaments, teams, players, and matches. If it does, the server and database are both healthy.

---

## Stopping the app

Go back to the PowerShell window running `npm start` and press:

```
Ctrl+C
```

---

## Rebuilding the database (only when data needs refreshing)

Run this only to pull fresh data from the HCA feeds. It requires internet access and takes several minutes:

```powershell
npm run build-database
npm run generate-report
npm start
```

---

## Troubleshooting

### Server starts but browser shows "This site can't be reached"

Port 3000 may be blocked or in use.

**Check if another process is using port 3000:**

```powershell
netstat -ano | Select-String ":3000"
```

If a process is listed, start the app on a different port:

```powershell
$env:PORT = 3001
npm start
```

Then open `http://localhost:3001` instead.

**Check Windows Firewall is not blocking localhost connections.** Localhost traffic should never be blocked, but if you have strict outbound rules, temporarily disable them.

---

### `npm start` crashes immediately with a database error

The message will mention `better-sqlite3` or `SQLITE_ERROR`.

Confirm the database file exists and is not zero bytes:

```powershell
Get-Item data\hca_analytics.sqlite | Select-Object Name, Length
```

If the file is missing or shows 0 bytes, rebuild it:

```powershell
npm run build-database
npm start
```

If the file exists but the error persists, the file may be corrupted. Delete it and rebuild:

```powershell
Remove-Item data\hca_analytics.sqlite
npm run build-database
npm start
```

---

### `npm start` crashes with "Cannot find module 'express'"

Dependencies are not installed. Run:

```powershell
npm install
npm start
```

---

### App loads but all sections show errors or no data

Check the API directly:

```powershell
Invoke-RestMethod http://localhost:3000/api/summary
```

If this returns an error, check the terminal window running `npm start` for the error message. Most commonly this means the database tables are empty — rebuild with `npm run build-database`.

---

### `node src/server.js` started but nothing loads

Running `node src/server.js` directly instead of `npm start` works the same way. The key step most people miss is **opening the browser** at `http://localhost:3000` while the terminal window stays open and running.

---

## Common commands reference

| What you want to do | Command |
|---|---|
| Start the app | `npm start` |
| Start on a different port | `$env:PORT=3001; npm start` |
| Rebuild the database | `npm run build-database` |
| Regenerate the analytics report | `npm run generate-report` |
| Check the API is alive | `Invoke-RestMethod http://localhost:3000/api/summary` |
| Stop the app | `Ctrl+C` in the server terminal |

---

Full documentation: [docs/HCA_UI_SETUP.md](docs/HCA_UI_SETUP.md)