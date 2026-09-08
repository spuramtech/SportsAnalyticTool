# Results Deep Analytics Extraction Design

## Objective

Extract match-level results from the HCA Match Centre Results section and persist the structured data needed for over-by-over and ball-by-ball analysis of:

- Players and player roles.
- Batting and bowling performance.
- Overs, balls, scoring patterns, extras, wickets, and dismissals.
- Grounds and match context.
- Umpires and officials when populated by the source.
- Toss, result, target, revised overs, and match state.
- Fall of wickets and partnerships.
- Field-position coordinates when supplied by the source.

The design is evidence-led. Fields are stored only when returned by the HCA feed. Empty official, weather, or venue-detail fields remain null; no values are inferred.

## Verified Source Feeds

The live match page was inspected for match `3838` and exposed these structured resources:

| Purpose | Endpoint pattern |
| --- | --- |
| Result/fixture catalog | `https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/{competitionId}-matchschedule.js` |
| Match metadata | `https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/{matchId}-matchsummary.js` |
| Squads | `https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/{matchId}-squad.js` |
| Innings detail | `https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/{matchId}-Innings{inningsNo}.js` |

Verified `matchsummary` fields include:

- `MatchID`, `CompetitionID`, `CompetitionName`.
- `Team1`, `Team2`, team IDs, logos, and match name.
- `MatchDate`, `MatchType`.
- Toss details.
- `GroundName`.
- Result comments and points comments.
- Target, revised overs, current innings, required run rate.
- `GroundUmpire1`, `GroundUmpire2`, `ThirdUmpire`, and `Referee` fields when populated.

Verified `InningsN` object sections include:

- `BattingCard`.
- `BowlingCard`.
- `FallOfWickets`.
- `PartnershipScores`.
- `OverHistory`.
- `WagonWheel` and wagon-wheel summaries.
- `ManhattanGraph` and `ManhattanWickets`.
- Head-to-head sections.

Verified `OverHistory` ball fields include:

- Match and innings identifiers.
- Batting team, striker, non-striker, and bowler IDs/names.
- Over number, ball number, and commentary labels.
- Total runs, bat runs, extras, wides, no-balls, byes, and leg-byes.
- Dot, one, two, three, four, and six flags.
- Wicket flag, wicket type, dismissed batter, and bowler-wicket flag.
- Commentary text.
- `Xpitch` and `Ypitch` coordinates when available.
- Video file reference when supplied.

## Extraction Scope

The Python loader reads the competition catalog for configured seasons, downloads each competition's match schedule, and selects completed/result matches. It then fetches match summary, squad, and all available innings feeds.

Default seasons:

- 2024 / SeasonID 113.
- 2025 / SeasonID 114.
- 2026 / SeasonID 115.

The loader is resumable:

- Raw feed responses are written before normalization.
- A `source_feeds` table records status and errors.
- Existing successful match feeds are skipped unless `--refresh` is supplied.
- A failed match does not stop other matches.
- Database writes use SQLite transactions per match.

## SQLite Data Model

### Source and identity tables

- `seasons`: calendar year and source season ID.
- `competitions`: competition catalog records.
- `matches`: one row per match summary/schedule record.
- `teams`: source team IDs and names.
- `match_teams`: team participation and batting order.
- `players`: source player IDs and canonical source names.
- `match_squads`: squad membership, team, and source role text.
- `officials`: match officials as returned by the match summary.

### Performance tables

- `innings`: innings number, batting team, bowling team, totals, overs, result context.
- `batting_cards`: one row per innings/player batting record.
- `bowling_cards`: one row per innings/player bowling record.
- `ball_events`: one row per `OverHistory` item.
- `fall_of_wickets`: wicket number, batter, score, and fall over.
- `partnerships`: partnership runs, batter contributions, balls, and over interval.
- `wagon_wheel_events`: source wagon-wheel fields when present.
- `manhattan_points`: source over/run graph fields when present.

### Provenance tables

- `source_feeds`: endpoint, status, HTTP error, raw path, and fetch timestamp.
- `raw_payloads`: optional compressed/raw JSON payload reference by match and feed type.

## Deep Analysis Enabled

### Over-level

- Runs per over and run-rate progression.
- Dot-ball percentage by innings, bowler, batter, and phase.
- Boundary and extras pressure by over.
- Wickets and dismissal clusters by over.
- Powerplay/middle/death analysis where format overs are known from schedule data.
- Chase progression against target and required run rate.

### Batter

- Runs, balls, strike rate, boundary profile, dot-ball exposure.
- Performance against pace/spin fields when populated.
- Dismissal type and dismissal over.
- Partnership contribution and partnership survival.
- Scoring zones from source coordinate fields where available.

### Bowler

- Overs, maidens, runs, wickets, economy, legal balls.
- Dot balls, boundary concessions, wides, and no-balls.
- Wicket timing and dismissal type.
- Batter/bowler head-to-head fields where returned.
- Over-by-over spell progression.

### Team

- Innings totals and run-rate progression.
- Chase control, target gap, wickets in hand, and required run rate.
- Partnership dependency and collapse points.
- Bowling pressure through dots, wickets, and extras.
- Ground-level comparisons only when match coverage is sufficient.

### Ground and officials

- Ground match counts and average innings output.
- Ground-specific scoring and wicket patterns.
- Umpire assignment counts and match metadata joins.
- No umpire quality or bias conclusions without a complete, validated decision dataset. The current feed may leave official fields blank.

## Data Quality Rules

1. Do not treat absent innings feeds as zero innings; record the feed failure.
2. Preserve raw source values and source URLs.
3. Keep source IDs unchanged.
4. Validate ball totals against innings totals where the source fields permit.
5. Flag, do not silently correct, duplicate ball identifiers.
6. Keep `OverHistory` ball order and source over/ball labels.
7. Distinguish null, empty string, zero, and unavailable feed.
8. Record schema fingerprints so source changes are visible.
9. Avoid cross-season player identity merges unless source IDs support them.
10. Never infer umpire, weather, pitch, injury, or opposition-strength conclusions from missing fields.

## Australia and England Planning Lens

This is a planning lens, not a claim about private team processes. Public high-performance cricket programs commonly emphasize repeatable processes, role clarity, phase-based analysis, scenario training, and post-match review. The implementation therefore exposes evidence for:

- New-ball batting and bowling.
- Middle-overs control.
- Death-over scoring and defence.
- Chase versus defend scenarios.
- Wicket-loss clusters.
- Boundary and dot-ball trade-offs.
- Extras as controllable pressure.
- Ground and match-context comparisons.
- Player role and workload evidence.

The system does not claim to reproduce confidential Australia or England planning methods. It provides source-grounded inputs that an analyst can use in a similar structured review process.

## Running the Python Extractor

The solution uses only Python standard-library modules: `urllib`, `json`, `sqlite3`, `argparse`, `concurrent.futures`, and `pathlib`.

From the project root:

```powershell
python scripts/extract_results.py --years 2024 2025 2026
```

Useful options:

```powershell
python scripts/extract_results.py --years 2026 --competition-ids 61 62 63 65 --workers 8
python scripts/extract_results.py --years 2026 --refresh
python scripts/extract_results.py --years 2026 --db data/hca_results.sqlite
```

Outputs:

- SQLite database: `data/hca_results.sqlite`.
- Raw feeds: `data/results_raw/`.
- Source errors and feed status: SQLite `source_feeds` table.

## Validation Plan

Before analytical use:

1. Run the extractor for one known completed match.
2. Confirm the match summary, squad, innings, ball events, fall-of-wickets, and partnership counts.
3. Compare innings totals and scorecard values to the live Match Centre page.
4. Query one over and manually inspect its ball sequence and commentary.
5. Check that missing umpire fields remain null.
6. Run duplicate and schema-quality queries.
7. Expand to one competition, then all configured seasons.

## Explicit Non-Claims

- No claim is made that the source contains every match ever played by HCA.
- No claim is made that every result page is complete or that every match has all innings feeds.
- No claim is made about umpire performance or bias.
- No claim is made about player ability, injuries, fitness, or future selection from these fields alone.
- No claim is made that this reproduces confidential Australia or England team systems.
