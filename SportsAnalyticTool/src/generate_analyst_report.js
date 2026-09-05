const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'hca_analytics.sqlite');
const REPORT_PATH = path.join(ROOT, 'exports', 'hca_expert_analytics_report.md');
const db = new Database(DB_PATH);

function sqlRows(query, params = {}) {
  return db.prepare(query).all(params);
}

function value(value) {
  return value === null || value === undefined ? '' : String(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function table(rows, columns) {
  if (!rows.length) return '_No rows met the stated evidence threshold._';
  return [
    `| ${columns.map(column => column.label).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => value(row[column.key])).join(' | ')} |`),
  ].join('\n');
}

function createAnalysisViews() {
  db.exec(`
    DROP VIEW IF EXISTS v_player_season_analysis;
    CREATE VIEW v_player_season_analysis AS
    SELECT
      s.season_year AS season_year,
      p.competition_id,
      t.name AS tournament_name,
      p.team_id,
      p.team_name,
      p.player_id,
      TRIM(p.player_name) AS player_name,
      p.matches,
      p.innings,
      p.total_runs,
      p.balls_faced,
      CASE WHEN p.balls_faced > 0 THEN ROUND(100.0 * p.total_runs / p.balls_faced, 2) END AS calculated_strike_rate,
      p.batting_average,
      p.highest_score,
      p.matches_bowled,
      p.total_runs_conceded,
      p.total_legal_balls_bowled,
      CASE WHEN p.total_legal_balls_bowled > 0 THEN ROUND(6.0 * p.total_runs_conceded / p.total_legal_balls_bowled, 2) END AS calculated_economy,
      p.bowling_average,
      p.economy_rate,
      p.wickets_taken,
      p.maidens,
      CASE
        WHEN p.matches >= 3 AND p.innings >= 3 AND p.total_runs >= 100 THEN 'Batting: usable sample'
        WHEN p.matches >= 2 AND p.innings >= 2 THEN 'Batting: developing sample'
        ELSE 'Batting: insufficient sample'
      END AS batting_evidence_tier,
      CASE
        WHEN p.matches_bowled >= 3 AND p.total_legal_balls_bowled >= 60 AND p.wickets_taken >= 3 THEN 'Bowling: usable sample'
        WHEN p.matches_bowled >= 2 AND p.total_legal_balls_bowled >= 24 THEN 'Bowling: developing sample'
        ELSE 'Bowling: insufficient sample'
      END AS bowling_evidence_tier
    FROM player_stats p
    JOIN tournaments t ON t.competition_id = p.competition_id
    JOIN seasons s ON s.season_id = t.season_id;

    DROP VIEW IF EXISTS v_team_season_analysis;
    CREATE VIEW v_team_season_analysis AS
    SELECT
      s.season_year,
      ts.competition_id,
      t.name AS tournament_name,
      ts.team_id,
      ts.team_name,
      ts.matches,
      ts.wins,
      ts.losses,
      ts.tied,
      ts.draws,
      ts.abandoned,
      ts.points,
      CASE WHEN ts.matches > 0 THEN ROUND(100.0 * ts.wins / ts.matches, 2) END AS win_rate,
      ts.runs_scored,
      ts.runs_conceded,
      ts.wickets_taken,
      CASE WHEN ts.runs_conceded > 0 THEN ROUND(1.0 * ts.runs_scored / ts.runs_conceded, 3) END AS run_ratio
    FROM team_stats ts
    JOIN tournaments t ON t.competition_id = ts.competition_id
    JOIN seasons s ON s.season_id = t.season_id;
  `);
}

function qualityChecks() {
  return [
    ['duplicate_player_keys', db.prepare('SELECT COUNT(*) AS n FROM (SELECT competition_id, team_id, player_id, COUNT(*) c FROM player_stats GROUP BY competition_id, team_id, player_id HAVING c > 1)').get().n, 'must be 0'],
    ['negative_runs', db.prepare('SELECT COUNT(*) AS n FROM player_stats WHERE total_runs < 0 OR total_runs_conceded < 0').get().n, 'must be 0'],
    ['negative_wickets', db.prepare('SELECT COUNT(*) AS n FROM player_stats WHERE wickets_taken < 0').get().n, 'must be 0'],
    ['missing_player_ids', db.prepare("SELECT COUNT(*) AS n FROM player_stats WHERE player_id IS NULL OR player_id = ''").get().n, 'investigate before selection'],
    ['failed_source_feeds', db.prepare("SELECT COUNT(*) AS n FROM source_feeds WHERE status = 'failed'").get().n, 'exclude or disclose'],
    ['player_stats_rows', db.prepare('SELECT COUNT(*) AS n FROM player_stats').get().n, 'coverage denominator'],
  ];
}

function buildReport() {
  createAnalysisViews();
  const checks = qualityChecks();
  const latestYear = db.prepare('SELECT MAX(season_year) AS year FROM seasons').get().year;
  const topBatters = sqlRows(`
    SELECT player_name, team_name, season_year, SUM(total_runs) runs, SUM(balls_faced) balls,
      ROUND(100.0 * SUM(total_runs) / NULLIF(SUM(balls_faced), 0), 2) strike_rate,
      COUNT(DISTINCT competition_id) tournaments, SUM(matches) matches,
      CASE WHEN SUM(matches) >= 3 AND SUM(innings) >= 3 AND SUM(total_runs) >= 100 THEN 'High' ELSE 'Limited' END confidence
    FROM v_player_season_analysis
    GROUP BY season_year, player_id, team_id
    HAVING SUM(matches) >= 3 AND SUM(innings) >= 3 AND SUM(total_runs) >= 100
    ORDER BY runs DESC, strike_rate DESC LIMIT 25
  `);
  const topBowlers = sqlRows(`
    SELECT player_name, team_name, season_year, SUM(wickets_taken) wickets, SUM(total_legal_balls_bowled) legal_balls,
      ROUND(6.0 * SUM(total_runs_conceded) / NULLIF(SUM(total_legal_balls_bowled), 0), 2) economy,
      ROUND(SUM(total_runs_conceded) / NULLIF(SUM(wickets_taken), 0), 2) bowling_average,
      COUNT(DISTINCT competition_id) tournaments, SUM(matches_bowled) matches_bowled,
      CASE WHEN SUM(matches_bowled) >= 3 AND SUM(total_legal_balls_bowled) >= 60 AND SUM(wickets_taken) >= 3 THEN 'High' ELSE 'Limited' END confidence
    FROM v_player_season_analysis
    GROUP BY season_year, player_id, team_id
    HAVING SUM(matches_bowled) >= 3 AND SUM(total_legal_balls_bowled) >= 60 AND SUM(wickets_taken) >= 3
    ORDER BY wickets DESC, economy ASC LIMIT 25
  `);
  const teams = sqlRows(`
    SELECT team_name, season_year, SUM(matches) matches, SUM(wins) wins, SUM(losses) losses,
      ROUND(100.0 * SUM(wins) / NULLIF(SUM(matches), 0), 2) win_rate,
      SUM(points) points, SUM(runs_scored) runs_scored, SUM(runs_conceded) runs_conceded,
      ROUND(1.0 * SUM(runs_scored) / NULLIF(SUM(runs_conceded), 0), 3) run_ratio
    FROM v_team_season_analysis
    GROUP BY season_year, team_id
    HAVING SUM(matches) > 0
    ORDER BY season_year DESC, win_rate DESC, points DESC LIMIT 50
  `);
  const trends = sqlRows(`
    SELECT player_name, player_id,
      MIN(season_year) first_year, MAX(season_year) latest_year,
      SUM(CASE WHEN season_year = :latestYear THEN total_runs ELSE 0 END) latest_runs,
      SUM(CASE WHEN season_year < :latestYear THEN total_runs ELSE 0 END) prior_runs,
      SUM(CASE WHEN season_year = :latestYear THEN wickets_taken ELSE 0 END) latest_wickets,
      SUM(CASE WHEN season_year < :latestYear THEN wickets_taken ELSE 0 END) prior_wickets,
      COUNT(DISTINCT season_year) seasons_observed
    FROM v_player_season_analysis
    GROUP BY player_id
    HAVING seasons_observed >= 2 AND (latest_runs > 0 OR latest_wickets > 0)
    ORDER BY latest_runs DESC, latest_wickets DESC LIMIT 30
  `, { latestYear });
  const failedSources = sqlRows("SELECT source_url, error FROM source_feeds WHERE status = 'failed' ORDER BY source_url");
  const generatedAt = new Date().toISOString();
  const checkTable = table(checks.map(([check, observed, rule]) => ({ check, observed, rule })), [
    { key: 'check', label: 'Check' }, { key: 'observed', label: 'Observed' }, { key: 'rule', label: 'Interpretation' },
  ]);
  const battingTable = table(topBatters, [
    { key: 'player_name', label: 'Player' }, { key: 'team_name', label: 'Team' }, { key: 'season_year', label: 'Season' },
    { key: 'runs', label: 'Runs' }, { key: 'balls', label: 'Balls' }, { key: 'strike_rate', label: 'Calculated SR' },
    { key: 'matches', label: 'Matches' }, { key: 'tournaments', label: 'Tournaments' }, { key: 'confidence', label: 'Confidence' },
  ]);
  const bowlingTable = table(topBowlers, [
    { key: 'player_name', label: 'Player' }, { key: 'team_name', label: 'Team' }, { key: 'season_year', label: 'Season' },
    { key: 'wickets', label: 'Wickets' }, { key: 'legal_balls', label: 'Legal balls' }, { key: 'economy', label: 'Calculated Econ' },
    { key: 'bowling_average', label: 'Calculated Avg' }, { key: 'matches_bowled', label: 'Matches' }, { key: 'confidence', label: 'Confidence' },
  ]);
  const teamTable = table(teams, [
    { key: 'team_name', label: 'Team' }, { key: 'season_year', label: 'Season' }, { key: 'matches', label: 'Matches' },
    { key: 'wins', label: 'Wins' }, { key: 'losses', label: 'Losses' }, { key: 'win_rate', label: 'Win rate %' },
    { key: 'points', label: 'Points' }, { key: 'run_ratio', label: 'Run ratio' },
  ]);
  const trendTable = table(trends, [
    { key: 'player_name', label: 'Player' }, { key: 'first_year', label: 'First season' }, { key: 'latest_year', label: 'Latest season' },
    { key: 'prior_runs', label: 'Prior runs' }, { key: 'latest_runs', label: 'Latest runs' }, { key: 'prior_wickets', label: 'Prior wickets' },
    { key: 'latest_wickets', label: 'Latest wickets' }, { key: 'seasons_observed', label: 'Seasons observed' },
  ]);
  const failures = failedSources.length ? failedSources.map(row => `- ${row.source_url}: ${row.error}`).join('\n') : '- None.';
  const report = `# HCA Expert Cricket Analytics Report

## Scope and Evidence Contract
- Generated: ${generatedAt}
- Coverage: HCA tournament, team, player, batting, and bowling feeds for 2024-2026.
- Latest observed season: ${latestYear}
- This report is descriptive and decision-support oriented. It does not infer injuries, opposition strength, pitch conditions, selection certainty, or causality because those fields are not present in the source data.
- Player and team recommendations require the confidence and sample-size rules below; small samples are explicitly excluded from the main rankings.

## Operating Model
1. **Source control:** preserve raw feed payloads, endpoint, fetch status, and extraction timestamp in \`source_feeds\`.
2. **Role separation:** evaluate batting and bowling independently; a player can appear in both tracks.
3. **Opportunity adjustment:** report runs per balls faced and wickets per legal ball alongside totals; never use totals alone to select a player.
4. **Cohort discipline:** compare players within the tournament and season context before making cross-season decisions.
5. **Evidence tiers:** High confidence requires at least 3 matches, 3 innings, and 100 runs for batting, or 3 bowling matches, 60 legal balls, and 3 wickets for bowling.
6. **Human review gate:** recommendations are hypotheses for an analyst or coach to review against video, role, fitness, opposition, and workload data that this source does not provide.

## Data Quality Validation
${checkTable}

## Batting Leaders With Evidence Threshold
${battingTable}

## Bowling Leaders With Evidence Threshold
${bowlingTable}

## Team Performance By Season
${teamTable}

## Multi-Season Player Trend Signals
${trendTable}

## Analyst Review And Future Planning Framework
### Player review
- **Retain / accelerate:** use only when the player has a High confidence tier and remains productive across at least two observed seasons.
- **Develop:** use when performance is positive but the evidence tier is Limited or the player has only one season; assign a measurable next-season target rather than a selection conclusion.
- **Monitor:** use when the latest season differs sharply from prior output. Validate role, workload, opposition, and match context before intervention.
- **Do not select from this report alone:** a high total without a sufficient opportunity sample, or a missing source feed, is not evidence of superior underlying ability.

### Team review
- Compare win rate, points, run ratio, runs scored, runs conceded, and wickets taken together.
- Investigate teams with strong win rate but weak run ratio, or strong run ratio but weak win rate; these are review signals, not diagnoses.
- Build the next planning cycle around role depth: top-order batting, middle-order conversion, new-ball control, death-overs control, and fielding. Only the batting and bowling portions are currently measurable from this source.

### Recommended next data additions
- Match-by-match scorecards and opposition strength.
- Venue, pitch, weather, toss, and innings context.
- Player workload, availability, injury, age-group, and training data.
- Ball-by-ball phases, fielding events, and video-coded tactical events.
- Selection outcomes and targets to measure whether recommendations improve results.

## Source Failures And Missingness
${failures}

## Reproducibility
- Database: \`hca_analytics.sqlite\`
- Builder: \`npm run build-database\`
- Report generator: \`node generate_analyst_report.js\`
- Analysis views created in the database: \`v_player_season_analysis\`, \`v_team_season_analysis\`.
`;
  fs.writeFileSync(REPORT_PATH, report);
  db.close();
  console.log(`Wrote ${REPORT_PATH}`);
}

buildReport();