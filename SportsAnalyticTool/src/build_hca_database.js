const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds';
const DB_PATH = path.join(ROOT, 'data', 'hca_analytics.sqlite');
const RAW_ROOT = path.join(ROOT, 'data', 'hca_database_raw');
const YEARS = { 2024: '113', 2025: '114', 2026: '115' };

function parseJsonp(text) {
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start < 0 || end <= start) throw new Error('response is not JSONP');
  return JSON.parse(text.slice(start + 1, end));
}

async function fetchFeed(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const text = await response.text();
  return { text, data: parseJsonp(text) };
}

function feedUrl(competitionId, suffix) {
  return `${BASE}/stats/${competitionId}-${suffix}.js`;
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function setup(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS seasons (season_id TEXT PRIMARY KEY, season_year INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tournaments (
      competition_id INTEGER PRIMARY KEY, season_id TEXT NOT NULL, name TEXT, competition_type TEXT,
      division_name TEXT, category_id TEXT, match_type_name TEXT, start_date TEXT, end_date TEXT, raw_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (team_id INTEGER PRIMARY KEY, name TEXT NOT NULL, raw_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tournament_teams (
      competition_id INTEGER NOT NULL, team_id INTEGER NOT NULL,
      PRIMARY KEY (competition_id, team_id)
    );
    CREATE TABLE IF NOT EXISTS team_stats (
      competition_id INTEGER NOT NULL, team_id INTEGER NOT NULL, team_name TEXT, matches REAL, innings REAL,
      wins REAL, losses REAL, tied REAL, draws REAL, abandoned REAL, points REAL, runs_scored REAL,
      runs_conceded REAL, wickets_taken REAL, wicket_lost REAL, bowling_average REAL, raw_json TEXT NOT NULL,
      source_url TEXT NOT NULL, PRIMARY KEY (competition_id, team_id)
    );
    CREATE TABLE IF NOT EXISTS player_stats (
      competition_id INTEGER NOT NULL, team_id INTEGER NOT NULL, player_id TEXT NOT NULL, player_name TEXT,
      team_name TEXT, batting_type TEXT, bowling_type TEXT, matches REAL, innings REAL, total_runs REAL,
      balls_faced REAL, batting_average TEXT, strike_rate REAL, highest_score TEXT, matches_bowled REAL,
      total_runs_conceded REAL, total_legal_balls_bowled REAL, bowling_average REAL, economy_rate REAL,
      wickets_taken REAL, maidens REAL, raw_json TEXT NOT NULL, source_url TEXT NOT NULL,
      PRIMARY KEY (competition_id, team_id, player_id)
    );
    CREATE TABLE IF NOT EXISTS batting_leaderboard (
      competition_id INTEGER NOT NULL, season_id TEXT NOT NULL, player_id TEXT, player_name TEXT,
      team_id INTEGER, team_name TEXT, rank INTEGER, raw_json TEXT NOT NULL, source_url TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bowling_leaderboard (
      competition_id INTEGER NOT NULL, season_id TEXT NOT NULL, player_id TEXT, player_name TEXT,
      team_id INTEGER, team_name TEXT, rank INTEGER, raw_json TEXT NOT NULL, source_url TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS source_feeds (
      source_url TEXT PRIMARY KEY, status TEXT NOT NULL, fetched_at TEXT NOT NULL, raw_path TEXT, error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_player_name ON player_stats(player_name);
    CREATE INDEX IF NOT EXISTS idx_player_team ON player_stats(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_name ON teams(name);
    CREATE INDEX IF NOT EXISTS idx_batting_player ON batting_leaderboard(player_id);
    CREATE INDEX IF NOT EXISTS idx_bowling_player ON bowling_leaderboard(player_id);
  `);
  db.exec(`
    DELETE FROM tournament_teams;
    DELETE FROM team_stats;
    DELETE FROM player_stats;
    DELETE FROM batting_leaderboard;
    DELETE FROM bowling_leaderboard;
    DELETE FROM source_feeds;
  `);
}

function recordFeed(db, url, status, rawPath, error) {
  db.prepare(`INSERT OR REPLACE INTO source_feeds VALUES (?, ?, ?, ?, ?)`).run(
    url, status, new Date().toISOString(), rawPath || null, error || null,
  );
}

function loadLeaderboards(db, year, seasonId) {
  const rawDir = path.join(ROOT, 'data', 'leaderboards', `hca_${year}_raw`);
  if (!fs.existsSync(rawDir)) return;
  const battingInsert = db.prepare(`INSERT INTO batting_leaderboard VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const bowlingInsert = db.prepare(`INSERT INTO bowling_leaderboard VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const file of fs.readdirSync(rawDir)) {
    const match = file.match(/^(\d+)-(toprunsscorers|mostwickets)\.json$/);
    if (!match) continue;
    const competitionId = Number(match[1]);
    const payload = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
    const rows = payload[match[2]] || [];
    const source = feedUrl(competitionId, match[2]);
    rows.forEach((row, index) => {
      const values = [competitionId, seasonId, String(row.PlayerId ?? row.BowlerID ?? ''), row.StrikerName || row.BowlerName,
        row.TeamID ?? null, row.TeamName ?? null, index + 1, json(row), source];
      if (match[2] === 'toprunsscorers') battingInsert.run(...values);
      else bowlingInsert.run(...values);
    });
  }
}

async function main() {
  fs.mkdirSync(RAW_ROOT, { recursive: true });
  const db = new Database(DB_PATH);
  setup(db);
  const catalogUrl = `${BASE}/competition.js`;
  const catalog = await fetchFeed(catalogUrl);
  const catalogPath = path.join(RAW_ROOT, 'competition.js');
  fs.writeFileSync(catalogPath, catalog.text);
  recordFeed(db, catalogUrl, 'success', catalogPath);
  const competitions = catalog.data.competition.filter(item => Object.values(YEARS).includes(String(item.SeasonID)));
  const teams = new Map(catalog.data.teams.map(item => [String(item.TeamId), item]));
  const insertSeason = db.prepare('INSERT OR REPLACE INTO seasons VALUES (?, ?)');
  Object.entries(YEARS).forEach(([year, seasonId]) => insertSeason.run(seasonId, Number(year)));
  const insertTournament = db.prepare('INSERT OR REPLACE INTO tournaments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertTeam = db.prepare('INSERT OR REPLACE INTO teams VALUES (?, ?, ?)');
  const insertMembership = db.prepare('INSERT OR IGNORE INTO tournament_teams VALUES (?, ?)');
  for (const item of competitions) {
    const competitionId = Number(item.CompetitionID);
    insertTournament.run(competitionId, String(item.SeasonID), item.CompetitionName, item.CompetitionType,
      item.DivisionName, item.CategoryId, item.MatchTypeName, item.MatchStartDate, item.MatchEndDate, json(item));
    for (const [teamId, team] of teams) {
      if (!String(team.CompetitionID || '').split(',').includes(String(competitionId))) continue;
      insertTeam.run(Number(teamId), team.TeamName, json(team));
      insertMembership.run(competitionId, Number(teamId));
    }
  }

  const jobs = [];
  for (const item of competitions) {
    const competitionId = Number(item.CompetitionID);
    jobs.push({ kind: 'team', competitionId, teamId: null, url: feedUrl(competitionId, 'teamoverallstats') });
    for (const [teamId, team] of teams) {
      if (String(team.CompetitionID || '').split(',').includes(String(competitionId))) {
        jobs.push({ kind: 'player', competitionId, teamId: Number(teamId), url: feedUrl(competitionId, `${teamId}-playerstats`) });
      }
    }
  }

  const results = [];
  for (let index = 0; index < jobs.length; index += 16) {
    const batch = jobs.slice(index, index + 16);
    results.push(...await Promise.all(batch.map(async job => {
      try {
        const response = await fetchFeed(job.url);
        const directory = path.join(RAW_ROOT, String(job.competitionId));
        fs.mkdirSync(directory, { recursive: true });
        const rawPath = path.join(directory, job.kind === 'team' ? 'teamoverallstats.json' : `${job.teamId}-playerstats.json`);
        fs.writeFileSync(rawPath, json(response.data));
        return { job, payload: response.data, rawPath, error: null };
      } catch (error) {
        return { job, payload: null, rawPath: null, error: error.message };
      }
    })));
    process.stdout.write(`Fetched ${Math.min(index + 16, jobs.length)}/${jobs.length}\r`);
  }
  console.log();

  const insertTeamStats = db.prepare('INSERT OR REPLACE INTO team_stats VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertPlayerStats = db.prepare('INSERT OR REPLACE INTO player_stats VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const result of results) {
    const { job, payload, rawPath, error } = result;
    recordFeed(db, job.url, payload ? 'success' : 'failed', rawPath, error);
    if (!payload) continue;
    if (job.kind === 'team') {
      for (const row of payload.teamstats || []) {
        insertTeamStats.run(job.competitionId, row.TeamID, row.TeamName, row.Matches, row.Innings, row.Wins, row.Loss,
          row.Tied, row.Draw, row.Aban, row.Points, row.RunsScored, row.RunsConceded, row.WicketsTaken,
          row.WicketLost, row.BowlingAverage, json(row), job.url);
      }
    } else {
      for (const row of payload.playerstats || []) {
        insertPlayerStats.run(job.competitionId, job.teamId, String(row.PlayerID ?? ''), row.PlayerName, row.TeamName,
          row.BattingType, row.BowlingType, row.Matches, row.Innings, row.TotalRuns, row.BallsFaced, row.BattingAverage,
          row.StrikeRate, row.HighestScore, row.MatchesBowled, row.TotalRunsConceeded, row.TotalLegalBallsBowled,
          row.BowlingAverage, row.EconomyRate, row.WicketsTaken, row.Maidens, json(row), job.url);
      }
    }
  }
  for (const [year, seasonId] of Object.entries(YEARS)) loadLeaderboards(db, year, seasonId);
  const counts = {};
  for (const table of ['tournaments', 'teams', 'tournament_teams', 'team_stats', 'player_stats', 'batting_leaderboard', 'bowling_leaderboard', 'source_feeds']) {
    counts[table] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  }
  const failed = db.prepare("SELECT COUNT(*) AS count FROM source_feeds WHERE status = 'failed'").get().count;
  db.close();
  console.log(JSON.stringify({ database: DB_PATH, jobs: jobs.length, failed_feeds: failed, counts }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });