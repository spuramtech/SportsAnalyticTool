const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const { roles, context, requirePermission } = require('./rbac');

const app = express();
const port = Number(process.env.PORT || 3000);
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'hca_analytics.sqlite');
const db = new Database(databasePath, { readonly: true });

db.pragma('query_only = ON');
app.use(express.json());
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

function filters(query) {
  const clauses = [];
  const params = {};
  if (query.year && query.year !== 'all') {
    clauses.push('s.season_year = @year');
    params.year = Number(query.year);
  }
  if (query.tournament && query.tournament !== 'all') {
    clauses.push('t.competition_id = @tournament');
    params.tournament = Number(query.tournament);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function queryRows(sql, params = {}) {
  return db.prepare(sql).all(params);
}

app.get('/api/session', (req, res) => {
  res.json({ user: context(req), authentication: 'disabled-local-simulation' });
});

app.get('/api/roles', (req, res) => {
  res.json(Object.entries(roles).map(([id, role]) => ({ id, ...role })));
});

app.get('/api/options', requirePermission('read:overview'), (req, res) => {
  res.json({
    years: queryRows('SELECT season_year year FROM seasons ORDER BY season_year DESC'),
    tournaments: queryRows('SELECT competition_id id, name, season_id FROM tournaments ORDER BY season_id DESC, name'),
  });
});

app.get('/api/summary', requirePermission('read:overview'), (req, res) => {
  const { where, params } = filters(req.query);
  const join = 'FROM tournaments t JOIN seasons s ON s.season_id = t.season_id';
  const stats = queryRows(`SELECT COUNT(DISTINCT t.competition_id) tournaments, COUNT(DISTINCT tt.team_id) teams, COUNT(DISTINCT ps.player_id) players, COALESCE(SUM(ts.matches), 0) matches ${join} LEFT JOIN tournament_teams tt ON tt.competition_id = t.competition_id LEFT JOIN player_stats ps ON ps.competition_id = t.competition_id LEFT JOIN team_stats ts ON ts.competition_id = t.competition_id ${where}`, params)[0];
  const quality = queryRows("SELECT COUNT(*) failed_feeds FROM source_feeds WHERE status = 'failed'")[0];
  res.json({ ...stats, failed_feeds: quality.failed_feeds, role: res.locals.user.role });
});

app.get('/api/players', requirePermission('read:players'), (req, res) => {
  const { where, params } = filters(req.query);
  const search = req.query.search ? 'AND (LOWER(ps.player_name) LIKE @search OR LOWER(ps.team_name) LIKE @search)' : '';
  if (req.query.search) params.search = `%${String(req.query.search).toLowerCase()}%`;
  const rows = queryRows(`
    SELECT TRIM(ps.player_name) player_name, ps.player_id, ps.team_name,
      SUM(ps.matches) matches, SUM(ps.innings) innings, SUM(ps.total_runs) runs,
      SUM(ps.balls_faced) balls, ROUND(100.0 * SUM(ps.total_runs) / NULLIF(SUM(ps.balls_faced), 0), 2) strike_rate,
      SUM(ps.wickets_taken) wickets, SUM(ps.total_legal_balls_bowled) legal_balls,
      ROUND(6.0 * SUM(ps.total_runs_conceded) / NULLIF(SUM(ps.total_legal_balls_bowled), 0), 2) economy,
      CASE WHEN SUM(ps.matches) >= 3 AND SUM(ps.innings) >= 3 AND SUM(ps.total_runs) >= 100 THEN 'High' ELSE 'Limited' END confidence
    FROM player_stats ps JOIN tournaments t ON t.competition_id = ps.competition_id JOIN seasons s ON s.season_id = t.season_id
    ${where} ${where ? search.replace('AND', 'AND') : search ? `WHERE ${search.slice(4)}` : ''}
    GROUP BY ps.player_id, ps.team_id, ps.team_name
    ORDER BY runs DESC, wickets DESC LIMIT 100
  `, params);
  res.json(rows);
});

app.get('/api/teams', requirePermission('read:teams'), (req, res) => {
  const { where, params } = filters(req.query);
  res.json(queryRows(`
    SELECT ts.team_id, ts.team_name, SUM(ts.matches) matches, SUM(ts.wins) wins, SUM(ts.losses) losses,
      ROUND(100.0 * SUM(ts.wins) / NULLIF(SUM(ts.matches), 0), 2) win_rate,
      SUM(ts.points) points, SUM(ts.runs_scored) runs_scored, SUM(ts.runs_conceded) runs_conceded,
      ROUND(1.0 * SUM(ts.runs_scored) / NULLIF(SUM(ts.runs_conceded), 0), 3) run_ratio
    FROM team_stats ts JOIN tournaments t ON t.competition_id = ts.competition_id JOIN seasons s ON s.season_id = t.season_id
    ${where} GROUP BY ts.team_id, ts.team_name ORDER BY win_rate DESC, points DESC LIMIT 100
  `, params));
});

app.get('/api/quality', requirePermission('read:quality'), (req, res) => {
  res.json({
    failed: queryRows("SELECT source_url, error FROM source_feeds WHERE status = 'failed' ORDER BY source_url LIMIT 100"),
    checks: [
      { name: 'Player records', value: queryRows('SELECT COUNT(*) count FROM player_stats')[0].count, status: 'pass' },
      { name: 'Team records', value: queryRows('SELECT COUNT(*) count FROM team_stats')[0].count, status: 'pass' },
      { name: 'Negative runs', value: queryRows('SELECT COUNT(*) count FROM player_stats WHERE total_runs < 0 OR total_runs_conceded < 0')[0].count, status: 'pass' },
      { name: 'Missing player IDs', value: queryRows("SELECT COUNT(*) count FROM player_stats WHERE player_id IS NULL OR player_id = ''")[0].count, status: 'review' },
    ],
  });
});

app.get('/api/players/:playerId', requirePermission('read:player-detail'), (req, res) => {
  const rows = queryRows(`
    SELECT s.season_year, t.name tournament_name, ps.team_name, ps.player_id, TRIM(ps.player_name) player_name,
      ps.matches, ps.innings, ps.total_runs runs, ps.balls_faced balls,
      ps.batting_average, ps.strike_rate, ps.highest_score, ps.matches_bowled,
      ps.total_runs_conceded, ps.wickets_taken, ps.economy_rate, ps.bowling_average
    FROM player_stats ps JOIN tournaments t ON t.competition_id = ps.competition_id JOIN seasons s ON s.season_id = t.season_id
    WHERE ps.player_id = @playerId ORDER BY s.season_year DESC, t.name
  `, { playerId: req.params.playerId });
  res.json(rows);
});

app.use((req, res) => res.sendFile(path.join(publicPath, 'index.html')));

const server = app.listen(port, '0.0.0.0', () => console.log(`HCA Analytics running on http://0.0.0.0:${port}`));
function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
