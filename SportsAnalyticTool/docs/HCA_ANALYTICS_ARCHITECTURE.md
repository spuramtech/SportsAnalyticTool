# HCA Cricket Analytics Architecture

## Purpose

This system supports expert review of Hyderabad Cricket Association tournaments, teams, and players across the 2024-2026 source period. It is a decision-support system, not an automated selector. Every reported value is traceable to a captured feed or is explicitly labelled as a calculated metric.

## Current Architecture

```text
HCA Match Centre
  -> JSONP competition catalog
  -> teamoverallstats feeds
  -> team-specific playerstats feeds
  -> batting and bowling leaderboard feeds
  -> raw feed archive
  -> SQLite source-of-truth database
  -> analysis views
  -> analyst report and review workflow
```

## Data Model

- `seasons`: source season IDs and calendar years.
- `tournaments`: competition identity, dates, format, and raw catalog object.
- `teams`: canonical team IDs and names from the catalog.
- `tournament_teams`: team participation by tournament.
- `team_stats`: wins, losses, points, scoring, conceding, wickets, and source provenance.
- `player_stats`: player identity, batting and bowling attributes, opportunity, output, and raw source object.
- `batting_leaderboard` and `bowling_leaderboard`: original leaderboard rows and ranks.
- `source_feeds`: endpoint status, fetch timestamp, raw path, and failure reason.
- `v_player_season_analysis` and `v_team_season_analysis`: reproducible analytical views.

## Analytical Controls

1. **Traceability:** raw JSON is retained and every derived row has a source URL.
2. **Role separation:** batting and bowling are evaluated separately; all-round conclusions require both evidence streams.
3. **Opportunity normalization:** totals are paired with balls faced, legal balls bowled, strike rate, economy, and bowling average.
4. **Minimum sample thresholds:** main player tables require 3 matches and 3 batting innings plus 100 runs, or 3 bowling matches, 60 legal balls, and 3 wickets.
5. **Cohort awareness:** comparisons should be made within season and tournament before cross-season aggregation.
6. **Missingness disclosure:** failed feeds and missing context are reported, never replaced with guessed values.
7. **Human approval:** recommendations are review hypotheses until validated with video, workload, fitness, opposition, venue, and selection context.

## Validation Position

The controls follow common high-performance sports analytics practices: a governed source layer, reproducible definitions, role-specific measures, sample-size safeguards, trend analysis, and a human review gate. This implementation has **not** been certified against or benchmarked with any named top-ten sports organization. Such a claim would require their published protocols, a shared benchmark dataset, and independent validation.

## Key Metric Definitions

- Batting strike rate: `100 * runs / balls faced`.
- Bowling economy: `6 * runs conceded / legal balls bowled`.
- Win rate: `100 * wins / matches`.
- Run ratio: `runs scored / runs conceded`.
- High-confidence batting sample: at least 3 matches, 3 innings, and 100 runs.
- High-confidence bowling sample: at least 3 bowling matches, 60 legal balls, and 3 wickets.

## Analyst Workflow

1. Confirm the source-feed quality section and exclude unresolved failed feeds from selection decisions.
2. Review tournament and season cohort tables, not only cross-season totals.
3. Review player output and opportunity together.
4. Flag improving, declining, and inconsistent performers for video and coaching review.
5. Add contextual evidence: role, workload, availability, opposition, venue, weather, pitch, and phase of play.
6. Set measurable next-cycle targets and record the decision and rationale.
7. Re-run the report after new source data arrives and compare decisions against outcomes.

## Required Next Enhancements

- Match-level and ball-by-ball facts for opposition and phase analysis.
- Player availability, injury, workload, age-group, and training data.
- Fielding events and video-coded tactical events.
- Data versioning and a decision log with analyst approvals.
- Automated anomaly alerts for implausible rates, duplicate identities, and sudden feed schema changes.
- A dashboard layer with role filters, confidence filters, tournament cohorts, and drill-through to raw source objects.

## Rebuild Commands

```powershell
npm install
npm run build-database
npm run generate-report
```

Outputs:

- `hca_analytics.sqlite`
- `hca_expert_analytics_report.md`
- `hca_database_raw/`