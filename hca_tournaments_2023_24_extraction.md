# HCA Tournaments 2023-24 — Player Data Extraction Design

**Source:** https://www.hycricket.org/tournaments-2023-24.html  
**Base URL:** `https://www.hycricket.org/`  
**Target DB:** `hca_players.db` (SQLite)

---

## 1. What Is Available

The page covers two categories of tournaments:

| Category | Tournaments |
|---|---|
| **HCA Internal** | U-14 Boys Selection, Senior Zonal Matches, A-Div 3-Day, A-Div 1-Day, A-Div T20, B-Div 2-Day, C-Div Institutional, C-Div 1-Day, Women's U-19 1-Day |
| **BCCI National** | Ranji Trophy, Vijay Hazare, Syed Mushtaq Ali T20, Vinoo Mankad (U-19 Youth LA), Cooch Behar (U-19 Boys), CK Nayudu (U-23 Boys), Vijay Merchant (U-16 Boys), Men's U-23 State-A, Senior Women's T20, Senior Women's OD, Women's U-19 OD, Women's U-19 T20, Women's U-15 OD, Women's U-23 T20, Women's U-23 OD, U-14 Boys SZ |

Player-level data is stored in two file types:

- **HTML pages** — directly parseable: match lists, century makers, 5-wicket takers, points tables, Ranji performance page
- **PDF files** — require PDF extraction: match scorecards, batting/bowling aggregates, individual performance summaries

---

## 2. Source Map — Every Player-Data URL

### 2.1 HCA Internal Tournaments

#### U-14 Boys Selection
| Data | URL | Type |
|---|---|---|
| Practice match scorecards | `data-2023-24/u-14-selection/matches.html` | HTML |
| Century makers | `data-2023-24/u-14-selection/centuries.html` | HTML |
| 5+ wicket takers | `data-2023-24/u-14-selection/5-wkt-takers.html` | HTML |
| Phase-1 probables | `data-2023-24/under-14-probables/teams.html` | HTML |
| State team (SZ League) | `data-2023-24/u-14-selection/Hyderabad_U14_Boys_Team_for_SZ_Boys_League_Tournament.pdf` | PDF |
| Team for Madurai | `data-2023-24/u-14-selection/Hyderabad_U14_Boys_B_Team_to_TN.pdf` | PDF |
| Phase-2 selection | `data-2023-24/u-14-selection/U-14-selection-phase-2.pdf` | PDF |

#### Men's Senior Zonal Matches
| Data | URL | Type |
|---|---|---|
| League scorecards | `data-2023-24/zonal-matches-srs/league.html` | HTML |
| Century makers | `data-2023-24/zonal-matches-srs/centuries.html` | HTML |
| 5+ wicket takers | `data-2023-24/zonal-matches-srs/5-wkt-takers.html` | HTML |
| Team squads | `data-2023-24/zonal-matches-srs/Teams_for_Senior_Zonals.pdf` | PDF |

#### A Division 3-Day League
| Data | URL | Type |
|---|---|---|
| Pool-A matches | `data-2023-24/01-A-3DAY-2023-24/league-pool-A.html` | HTML |
| Pool-B matches | `data-2023-24/01-A-3DAY-2023-24/league-pool-B.html` | HTML |
| Century makers | `data-2023-24/01-A-3DAY-2023-24/century-makers.html` | HTML |
| 5+ wicket takers | `data-2023-24/01-A-3DAY-2023-24/5wkt-takers.html` | HTML |
| Batting aggregate stats | `data-2023-24/01-A-3DAY-2023-24/stats-batting.pdf` | PDF |
| Bowling aggregate stats | `data-2023-24/01-A-3DAY-2023-24/stats-bowling.pdf` | PDF |

#### A Division 1-Day League
| Data | URL | Type |
|---|---|---|
| Pool-A matches | `data-2023-24/01-A-1DAY-2023-24/league-pool-A.html` | HTML |
| Pool-B matches | `data-2023-24/01-A-1DAY-2023-24/league-pool-B.html` | HTML |
| Pool-C matches | `data-2023-24/01-A-1DAY-2023-24/league-pool-C.html` | HTML |
| Pool-D matches | `data-2023-24/01-A-1DAY-2023-24/league-pool-D.html` | HTML |
| Semi-finals & Final | `data-2023-24/01-A-1DAY-2023-24/KO-stage.html` | HTML |
| Century makers | `data-2023-24/01-A-1DAY-2023-24/century-makers.html` | HTML |
| 5+ wicket takers | `data-2023-24/01-A-1DAY-2023-24/5wkt-takers.html` | HTML |
| Batting aggregate stats | `data-2023-24/01-A-1DAY-2023-24/stats-batting.pdf` | PDF |
| Bowling aggregate stats | `data-2023-24/01-A-1DAY-2023-24/stats-bowling.pdf` | PDF |

#### A Division T20 League
| Data | URL | Type |
|---|---|---|
| Pool-A matches | `data-2023-24/01-A-T20-2023-24/league-pool-A.html` | HTML |
| Pool-B matches | `data-2023-24/01-A-T20-2023-24/league-pool-B.html` | HTML |
| Pool-C matches | `data-2023-24/01-A-T20-2023-24/league-pool-C.html` | HTML |
| Pool-D matches | `data-2023-24/01-A-T20-2023-24/league-pool-D.html` | HTML |
| Knockout stage | `data-2023-24/01-A-T20-2023-24/KO-Stage.html` | HTML |
| Century makers | `data-2023-24/01-A-T20-2023-24/century-makers.html` | HTML |
| 5+ wicket takers | `data-2023-24/01-A-T20-2023-24/5wkt-takers.html` | HTML |

#### B Division 2-Day League
| Data | URL | Type |
|---|---|---|
| Pool-A matches | `data-2023-24/01-B-2DAY-2023-24/league-pool-A.html` | HTML |
| Pool-B matches | `data-2023-24/01-B-2DAY-2023-24/league-pool-B.html` | HTML |
| Pool-C matches | `data-2023-24/01-B-2DAY-2023-24/league-pool-C.html` | HTML |
| Pool-D matches | `data-2023-24/01-B-2DAY-2023-24/league-pool-D.html` | HTML |
| Pool-E matches | `data-2023-24/01-B-2DAY-2023-24/league-pool-E.html` | HTML |
| Century makers | `data-2023-24/01-B-2DAY-2023-24/century-makers.html` | HTML |
| 5+ wicket takers | `data-2023-24/01-B-2DAY-2023-24/5wkt-takers.html` | HTML |

#### C Division Institutional & 1-Day
| Data | URL | Type |
|---|---|---|
| Institutional league matches | `data-2023-24/01-C-Inst-2023-24/league.html` | HTML |
| 1-Day league matches | `data-2023-24/01-C-1D-2023-24/league.html` | HTML |
| 1-Day century makers | `data-2023-24/01-C-1D-2023-24/centuries.html` | HTML |
| 1-Day 5+ wicket takers | `data-2023-24/01-C-1D-2023-24/5-wkt-takers.html` | HTML |

#### Women's U-19 1-Day Selection
| Data | URL | Type |
|---|---|---|
| League rounds 1–5 | `data-2023-24/01-W-U19-1D-2023-24/league-5-rounds.html` | HTML |

---

### 2.2 BCCI National Tournaments

Each BCCI tournament follows the same pattern:  
- One PDF per match (scorecard)  
- One `points.html` for standings  
- One `performance.pdf` or `performance.html` with aggregated individual stats

| Tournament | Folder | Match PDFs | Performance |
|---|---|---|---|
| Women's U-19 OD Trophy | `bcci-women-u-19-OD/` | 5 matches | `performance.pdf` |
| Vinoo Mankad Trophy (U-19 Boys LA) | `v-mankad-2023/` | 5 + 1 QF | `performance.pdf` |
| Syed Mushtaq Ali Trophy (T20) | `M-Ali-Trophy/` | 7 matches | `performance.pdf` |
| Senior Women's T20 | `bcci-sr_women-T20/` | 6 matches | `performance.pdf` |
| Men's U-23 State-A Trophy | `men-u-25-state-A/` | 7 matches | `performance.pdf` |
| Women's U-19 T20 Trophy | `bcci-women-u-19-T20/` | 5 matches | `performance.pdf` |
| Women's U-15 OD Trophy | `bcci-women-u-15-OD/` | 5 matches | *(none listed)* |
| Cooch Behar Trophy (U-19 Boys) | `cooch-behar/` | 5 matches | `performance.pdf` |
| Vijay Hazare OD Trophy | `vijay-hazare/` | 7 matches | `performance.pdf` |
| Women's U-23 T20 Trophy | `bcci-women-u23-t20/` | 7 + 2 KO | *(none listed)* |
| Vijay Merchant Trophy (U-16 Boys) | `v-merchant/` | 5 matches | `performance.pdf` |
| Senior Women's OD Trophy | `bcci-sr_women-OD/` | 6 matches | *(none listed)* |
| Ranji Trophy | `Ranji-2023-24/` | 5 + SF + Final | `performance.html` |
| Col CK Nayudu Trophy (U-23 Boys) | `ck-nayudu/` | 7 matches | `performance.pdf` |
| Women's U-23 OD Trophy | `bcci-women-u23-OD/` | 6 matches | *(none listed)* |
| U-14 Boys SZ Inter-State | `U-14_SZ-2023-24/` | 6 matches | `performance.pdf` |

> All match scorecard URLs follow the pattern:  
> `https://www.hycricket.org/data-2023-24/<folder>/v-<opponent>.pdf`

---

## 3. Data Available Per Player

### From HTML pages (century makers, 5-wicket takers)
- Player name
- Team / club
- Score or figures
- Match / opponent
- Venue (sometimes)

### From HTML match pages (league.html, KO-stage.html)
- Match date
- Teams
- Result
- Score summary (sometimes inning-by-inning)
- Links to individual scorecard details (if present)

### From PDF scorecards (per match)
- Full batting scorecard: player name, runs, balls, 4s, 6s, dismissal, bowler
- Full bowling scorecard: player name, overs, maidens, runs, wickets, economy
- Fall of wickets
- Extras
- Match result

### From PDF/HTML performance summaries
- Player name
- Matches played
- Batting: innings, runs, HS, average, 50s, 100s
- Bowling: wickets, overs, economy, best figures

---

## 4. Proposed DB Schema

```sql
-- One row per tournament
CREATE TABLE tournaments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    season        TEXT DEFAULT '2023-24',
    name          TEXT NOT NULL,           -- e.g. 'Ranji Trophy'
    category      TEXT,                    -- 'BCCI' | 'HCA'
    format        TEXT,                    -- '3-Day' | '1-Day' | 'T20'
    gender        TEXT,                    -- 'Men' | 'Women'
    age_group     TEXT                     -- 'Senior' | 'U-23' | 'U-19' | 'U-16' | 'U-15' | 'U-14'
);

-- One row per match
CREATE TABLE matches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id   INTEGER REFERENCES tournaments(id),
    match_date      TEXT,
    stage           TEXT,    -- 'League' | 'SF' | 'Final' | 'QF' | 'Pool-A' etc.
    home_team       TEXT,    -- always 'Hyderabad' for BCCI matches
    away_team       TEXT,
    result          TEXT,
    source_url      TEXT     -- the PDF or HTML URL this row came from
);

-- Per-match batting performances (from scorecards)
CREATE TABLE batting_performances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id        INTEGER REFERENCES matches(id),
    tournament_id   INTEGER REFERENCES tournaments(id),
    player_name     TEXT NOT NULL,
    team            TEXT,
    innings_no      INTEGER,   -- 1 or 2
    runs            INTEGER,
    balls           INTEGER,
    fours           INTEGER,
    sixes           INTEGER,
    strike_rate     REAL,
    dismissal       TEXT,
    bowler          TEXT,
    fielder         TEXT,
    source_url      TEXT
);

-- Per-match bowling performances (from scorecards)
CREATE TABLE bowling_performances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id        INTEGER REFERENCES matches(id),
    tournament_id   INTEGER REFERENCES tournaments(id),
    player_name     TEXT NOT NULL,
    team            TEXT,
    innings_no      INTEGER,
    overs           REAL,
    maidens         INTEGER,
    runs            INTEGER,
    wickets         INTEGER,
    economy         REAL,
    source_url      TEXT
);

-- Aggregated tournament stats (from performance.pdf / performance.html)
CREATE TABLE tournament_stats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id   INTEGER REFERENCES tournaments(id),
    player_name     TEXT NOT NULL,
    team            TEXT,
    -- batting
    bat_matches     INTEGER,
    bat_innings     INTEGER,
    bat_runs        INTEGER,
    bat_hs          TEXT,
    bat_average     REAL,
    bat_fifties     INTEGER,
    bat_hundreds    INTEGER,
    -- bowling
    bowl_wickets    INTEGER,
    bowl_overs      REAL,
    bowl_economy    REAL,
    bowl_best       TEXT,
    source_url      TEXT
);

-- Notable performances (centuries, 5-wkt hauls) — from HTML pages
CREATE TABLE notable_performances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id   INTEGER REFERENCES tournaments(id),
    type            TEXT,      -- 'century' | '5-wicket'
    player_name     TEXT NOT NULL,
    team            TEXT,
    value           TEXT,      -- score e.g. '143' or figures e.g. '6/32'
    opponent        TEXT,
    match_date      TEXT,
    source_url      TEXT
);
```

---

## 5. Extraction Strategy

### Phase 1 — Seed the `tournaments` table
Insert one row per tournament manually from the source map in Section 2. This is small and static — 25 rows.

### Phase 2 — HTML pages (BeautifulSoup)

Scrape in this order:

1. **Notable performances** (century makers, 5-wkt takers HTML pages)  
   - 33 HTML pages across all tournaments  
   - Parse tables: player name, club/team, score/figures, opponent, date

2. **Match index pages** (league.html, KO-stage.html)  
   - Extract match dates, teams, result → insert into `matches`  
   - Collect any per-match HTML scorecard links

3. **Points tables** (points.html)  
   - Team standings — not player-level, skip or store separately

4. **Ranji performance page** (`Ranji-2023-24/performance.html`)  
   - This is an HTML aggregate, parse directly into `tournament_stats`

### Phase 3 — PDF files (pdfplumber or pypdf)

Two sub-types of PDF:

**Match scorecards** (~85 PDFs across all tournaments)  
- Extract text with `pdfplumber`  
- Locate batting and bowling sections by keyword anchors (`Batting`, `Bowling`, `Fall of Wickets`)  
- Map rows into `batting_performances` and `bowling_performances`

**Performance summary PDFs** (~13 PDFs)  
- Tabular data — use `pdfplumber.extract_table()` which handles column alignment  
- Map rows into `tournament_stats`

**Aggregate stats PDFs** (A-Div batting/bowling stats)  
- Same approach as performance summaries

### Deduplication
Player names in HCA pages are not normalised (e.g. "Abdul Khader" vs "M Abdul Khader"). Deduplicate within a tournament by exact name + team. Cross-tournament deduplication requires a fuzzy name match pass after loading.

### Rate limiting
Add a 0.5 s delay between HTTP requests. PDF files are large — stream them with `requests` and `io.BytesIO`, do not write to disk unless needed.

---

## 6. Extraction Order (Priority)

| Priority | Phase | Source | Effort |
|---|---|---|---|
| 1 | HTML | Century makers & 5-wkt takers (all tournaments) | Low |
| 2 | HTML | Ranji performance.html | Low |
| 3 | PDF | BCCI tournament performance.pdf files (13) | Medium |
| 4 | PDF | BCCI match scorecards — Ranji, Vijay Hazare, Mushtaq Ali (19 matches) | High |
| 5 | HTML | HCA internal match league pages | Medium |
| 6 | PDF | HCA internal batting/bowling aggregate PDFs (A-Div) | Medium |
| 7 | PDF | All remaining BCCI match scorecards (~65 PDFs) | High |

---

## 7. Dependencies

```
requests          # HTTP fetching
beautifulsoup4    # HTML parsing
pdfplumber        # PDF table + text extraction (preferred over pypdf for tables)
sqlite3           # built-in
```

Install:
```bash
pip install requests beautifulsoup4 pdfplumber
```

---

## 8. Known Limitations

| Issue | Impact | Mitigation |
|---|---|---|
| Most BCCI scorecard data is in PDFs | Cannot use simple HTML scraping | Use `pdfplumber`; layout varies per PDF so parser needs to be flexible |
| Women's U-15, Women's U-23, Senior Women's OD have no `performance.pdf` | Aggregate stats not available | Only per-match scorecards available for those tournaments |
| Player name inconsistency across tournaments | Cannot auto-link to `player_index` table | Post-load fuzzy matching or manual review |
| No individual scorecard HTML pages for internal tournaments | Match-level detail limited | Use century makers and 5-wkt taker HTML pages as primary player source |
| PDFs may be image-based scans | `pdfplumber` returns empty text on image PDFs | Detect empty extraction; flag for manual OCR review |