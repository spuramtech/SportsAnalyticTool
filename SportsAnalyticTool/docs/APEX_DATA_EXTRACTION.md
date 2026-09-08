# Apex Team — Data Extraction Guide

How to use `scripts/extract_results.py` to pull ball-by-ball match results for **Apex** (team\_id 25) into `data/hca_results.sqlite`, and how to sync by year, tournament, or team.

---

## 1. Background

`extract_results.py` fetches live match feeds from the HCA S3 endpoint and writes a local SQLite database (`data/hca_results.sqlite`) with the following tables:

| Table | Content |
|---|---|
| `seasons` | Season ID ↔ year mapping |
| `competitions` | Tournament catalogue |
| `matches` | One row per completed match |
| `match_teams` | Teams per match |
| `match_squads` | Player rosters per match |
| `batting_cards` | Per-innings batting scorecard |
| `bowling_cards` | Per-innings bowling figures |
| `ball_events` | Ball-by-ball over history |
| `fall_of_wickets` | FOW records |
| `partnerships` | Partnership scores |
| `source_feeds` | Feed audit log (success / failed) |

The script is **resumable** — already-processed matches are skipped unless `--refresh` is passed.

---

## 2. Prerequisites

- Python 3.12 or later (`py --version`)
- Internet access to `hycamcfeeds.s3.ap-south-1.amazonaws.com`
- Working directory: `D:\Personal\R&D\SportsAnalyticTool`

```powershell
cd "D:\Personal\R&D\SportsAnalyticTool"
```

---

## 3. Apex competition reference

Apex's competition IDs (from `data/hca_analytics.sqlite`):

| Year | Competition ID | Tournament | Dates | M | W | L | Pts |
|---|---|---|---|---|---|---|---|
| 2024 | 1 | A1 Division 3-Day League Championship | 8 Jul – 1 Sep 2024 | 3 | 0 | 3 | 1 |
| 2024 | 15 | B Division 2-Day One-Day KO Tournament | 30 Oct – 4 Nov 2024 | 1 | 0 | 1 | 0 |
| 2025 | 31 | B Division Two-Day League Championship | 7 Jul 2025 – 27 Mar 2026 | 9 | 4 | 4 | 22 |
| 2025 | 42 | B Division T20 League / KO Tournament | 19 Nov 2025 – 6 Jan 2026 | 7 | 5 | 2 | 12 |
| **2026** | **57** | **B Division T20 League / KO Tournament** | 12 May – 7 Jun 2026 | 5 | 2 | 3 | 8 |
| **2026** | **60** | **B Division Two-Day League Championship** | 20 Jul – 28 Aug 2026 | 5 | 3 | 2 | 6 |

Season ID mapping used internally by the feeds:

| Season year | Season ID |
|---|---|
| 2024 | 113 |
| 2025 | 114 |
| 2026 | 115 |

---

## 4. Sync patterns

### 4.1 Sync by Year

Pull **all competitions** in a given season. This downloads every team's data for the year.

```powershell
# 2026 only
py scripts\extract_results.py --years 2026

# 2025 only
py scripts\extract_results.py --years 2025

# All three seasons
py scripts\extract_results.py --years 2024 2025 2026
```

### 4.2 Sync by Tournament (competition ID)

Pull one or more specific tournaments. Useful for incremental refreshes or when only certain competitions have new data.

```powershell
# Apex's 2026 T20 tournament (comp 57)
py scripts\extract_results.py --years 2026 --competition-ids 57

# Apex's 2026 Two-Day League (comp 60)
py scripts\extract_results.py --years 2026 --competition-ids 60

# Both 2026 tournaments together
py scripts\extract_results.py --years 2026 --competition-ids 57 60
```

### 4.3 Sync by Team (Apex — all years)

The script downloads **all teams** in a competition, so team filtering is applied as a two-step process:

**Step 1 — Find which competition IDs the team plays in.**
Run the helper query against `hca_analytics.sqlite`:

```powershell
py scripts\_apex_competitions.py
```

Or query directly:

```powershell
py -c "
import sqlite3
conn = sqlite3.connect('data/hca_analytics.sqlite')
rows = conn.execute('''
    SELECT ts.competition_id, t.name, t.season_id
    FROM team_stats ts
    JOIN tournaments t ON ts.competition_id = t.competition_id
    WHERE ts.team_name = \"Apex\"
    ORDER BY t.season_id, ts.competition_id
''').fetchall()
for r in rows: print(r)
conn.close()
"
```

**Step 2 — Run the extraction with those IDs.**

```powershell
# All Apex competitions, all years
py scripts\extract_results.py --years 2024 2025 2026 --competition-ids 1 15 31 42 57 60

# Apex competitions, 2026 only
py scripts\extract_results.py --years 2026 --competition-ids 57 60
```

After extraction, query `data/hca_results.sqlite` filtered by team name — see [Section 5](#5-querying-apex-data-after-extraction).

### 4.4 Force refresh (re-download already-processed matches)

```powershell
py scripts\extract_results.py --years 2026 --competition-ids 57 60 --refresh
```

---

## 5. Querying Apex data after extraction

Once `data/hca_results.sqlite` is populated, use these queries.

### 5.1 Apex matches

```sql
SELECT m.match_id, m.match_date, m.match_type, m.team1_name, m.team2_name,
       m.result_text, m.ground_name, m.city
FROM matches m
JOIN match_teams mt ON mt.match_id = m.match_id
JOIN teams t ON t.team_id = mt.team_id
WHERE t.team_name = 'Apex'
ORDER BY m.match_date;
```

### 5.2 Apex batting scorecards (all matches)

```sql
SELECT m.match_date, m.team1_name || ' vs ' || m.team2_name AS fixture,
       bc.innings_no, bc.player_name, bc.runs, bc.balls,
       bc.fours, bc.sixes, bc.strike_rate, bc.out_desc
FROM batting_cards bc
JOIN matches m ON m.match_id = bc.match_id
JOIN match_teams mt ON mt.match_id = bc.match_id AND mt.team_id = bc.team_id
JOIN teams t ON t.team_id = mt.team_id
WHERE t.team_name = 'Apex'
ORDER BY m.match_date, bc.innings_no, bc.runs DESC;
```

### 5.3 Apex bowling figures

```sql
SELECT m.match_date, m.team1_name || ' vs ' || m.team2_name AS fixture,
       bc.innings_no, bc.player_name, bc.overs, bc.maidens,
       bc.runs, bc.wickets, bc.economy, bc.wides, bc.no_balls
FROM bowling_cards bc
JOIN matches m ON m.match_id = bc.match_id
JOIN match_teams mt ON mt.match_id = bc.match_id AND mt.team_id = bc.team_id
JOIN teams t ON t.team_id = mt.team_id
WHERE t.team_name = 'Apex'
ORDER BY m.match_date, bc.innings_no;
```

### 5.4 Apex player career aggregates (across all extracted matches)

```sql
SELECT bc.player_name,
       COUNT(DISTINCT bc.match_id) AS matches,
       SUM(bc.runs) AS total_runs,
       ROUND(AVG(bc.strike_rate), 1) AS avg_sr,
       MAX(bc.runs) AS hs,
       SUM(bc.fours) AS fours,
       SUM(bc.sixes) AS sixes
FROM batting_cards bc
JOIN match_teams mt ON mt.match_id = bc.match_id AND mt.team_id = bc.team_id
JOIN teams t ON t.team_id = mt.team_id
WHERE t.team_name = 'Apex'
GROUP BY bc.player_name
ORDER BY total_runs DESC;
```

### 5.5 Apex ball-by-ball (specific match)

Replace `<match_id>` with the value from query 5.1:

```sql
SELECT be.over_no, be.ball_no, be.striker_name, be.bowler_name,
       be.runs, be.is_wicket, be.wicket_type, be.commentary
FROM ball_events be
WHERE be.match_id = <match_id>
ORDER BY be.innings_no, be.over_no, be.ball_no;
```

---

## 6. Common options reference

| Goal | Command |
|---|---|
| Apex 2026 full sync | `py scripts\extract_results.py --years 2026 --competition-ids 57 60` |
| Apex all-years full sync | `py scripts\extract_results.py --years 2024 2025 2026 --competition-ids 1 15 31 42 57 60` |
| Force re-download 2026 | `py scripts\extract_results.py --years 2026 --competition-ids 57 60 --refresh` |
| Custom database path | `py scripts\extract_results.py --years 2026 --db data\apex_2026.sqlite` |
| Custom raw feed cache | `py scripts\extract_results.py --years 2026 --raw-dir data\apex_raw` |
| Reduce parallel workers | `py scripts\extract_results.py --years 2026 --competition-ids 57 60 --workers 2` |

---

## 7. Proposed enhancement — `--team` filter

The script currently downloads all teams in each competition. Adding a `--team` flag would skip ball-by-ball extraction for matches where the team is not a participant, reducing download size for team-specific syncs.

**Proposed flag:**

```
--team "Apex"
```

**Behaviour:**
1. Fetch the match schedule for each competition as normal.
2. For each completed match, check whether the team appears in `Team1` or `Team2` of the schedule row.
3. Skip `extract_match` entirely for non-matching fixtures.
4. Record the skip in `source_feeds` with `status = "skipped_team_filter"`.

**Implementation sketch (in `main()`):**

```python
parser.add_argument("--team", type=str, default=None,
                    help="Only extract matches involving this team name (case-insensitive substring match)")

# Inside the competition loop, after building `matches`:
if args.team:
    team_lower = args.team.lower()
    matches = [
        row for row in matches
        if team_lower in (row.get("Team1") or "").lower()
        or team_lower in (row.get("Team2") or "").lower()
    ]
```

This keeps the schedule and competition records intact while limiting ball-by-ball downloads to Apex fixtures only.

---

## 8. Troubleshooting

**`database is locked`** — Multiple workers competing to write. Lower workers to 1 or 2:
```powershell
py scripts\extract_results.py --years 2026 --competition-ids 57 60 --workers 2
```

**Feed 404 / timeout** — The S3 feed for a match may not be available yet (upcoming fixture or delayed upload). The script logs these in `source_feeds` with `status = "failed"` and moves on.

**No new data after re-run** — The script skips matches already in the database. Use `--refresh` to force re-download.

**`hca_results.sqlite` not found** — Run the extraction at least once before querying. The file is created automatically in `data/`.

**Check feed failures after a run:**
```sql
SELECT feed_type, status, error, source_url
FROM source_feeds
WHERE status = 'failed'
ORDER BY fetched_at DESC;
```