const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const { roles, context, requirePermission } = require('./rbac');

const app = express();
const port = Number(process.env.PORT || 3000);
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'hca_analytics.sqlite');
let db;
let dbWrite;
try {
  db = new Database(databasePath, { readonly: true });
  dbWrite = new Database(databasePath);
} catch (err) {
  console.error(`Database unavailable at ${databasePath}: ${err.message}`);
  console.error('Run "npm run build-database" to create it, or set DATABASE_PATH to an existing file.');
  process.exit(1);
}
const responseCache = new Map();
const cacheTtlMs = 30000;

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

function cached(key, read) {
  const entry = responseCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  const value = read();
  responseCache.set(key, { value, expiresAt: Date.now() + cacheTtlMs });
  return value;
}

function page(query) {
  const requested = Number.parseInt(query.page, 10);
  const size = Number.parseInt(query.pageSize, 10);
  const pageNumber = Number.isFinite(requested) && requested > 0 ? requested : 1;
  const pageSize = Number.isFinite(size) && size > 0 ? Math.min(size, 100) : 50;
  return { pageNumber, pageSize, offset: (pageNumber - 1) * pageSize };
}

app.get('/api/session', (req, res) => {
  res.json({ user: context(req), authentication: 'disabled-local-simulation' });
});

app.get('/api/roles', (req, res) => {
  res.json(Object.entries(roles).map(([id, role]) => ({ id, ...role })));
});

app.get('/api/options', requirePermission('read:overview'), (req, res) => {
  const options = cached('options', () => ({
    years: queryRows('SELECT season_year year FROM seasons ORDER BY season_year DESC'),
    tournaments: queryRows('SELECT competition_id id, name, season_id FROM tournaments ORDER BY season_id DESC, name'),
  }));
  res.set('Cache-Control', 'private, max-age=30');
  res.json(options);
});

app.get('/api/summary', requirePermission('read:overview'), (req, res) => {
  const { where, params } = filters(req.query);
  const stats = queryRows(`
    WITH selected AS (
      SELECT t.competition_id
      FROM tournaments t JOIN seasons s ON s.season_id = t.season_id
      ${where}
    )
    SELECT
      (SELECT COUNT(*) FROM selected) tournaments,
      (SELECT COUNT(DISTINCT tt.team_id) FROM tournament_teams tt JOIN selected ON selected.competition_id = tt.competition_id) teams,
      (SELECT COUNT(DISTINCT ps.player_id) FROM player_stats ps JOIN selected ON selected.competition_id = ps.competition_id) players,
      (SELECT COALESCE(SUM(ts.matches), 0) FROM team_stats ts JOIN selected ON selected.competition_id = ts.competition_id) matches
  `, params)[0];
  const quality = queryRows("SELECT COUNT(*) failed_feeds FROM source_feeds WHERE status = 'failed'")[0];
  res.json({ ...stats, failed_feeds: quality.failed_feeds, role: res.locals.user.role });
});

app.get('/api/players', requirePermission('read:players'), (req, res) => {
  const { where, params } = filters(req.query);
  const { pageNumber, pageSize, offset } = page(req.query);
  params.pageSize = pageSize;
  params.offset = offset;
  const search = req.query.search ? 'AND (LOWER(ps.player_name) LIKE @search OR LOWER(ps.team_name) LIKE @search)' : '';
  if (req.query.search) params.search = `%${String(req.query.search).toLowerCase()}%`;
  const rows = queryRows(`
    WITH failed_comps AS (
      SELECT DISTINCT CAST(SUBSTR(source_url, INSTR(source_url, '/stats/') + 7,
        INSTR(SUBSTR(source_url, INSTR(source_url, '/stats/') + 7), '-') - 1) AS INTEGER) competition_id
      FROM source_feeds WHERE status = 'failed'
    )
    SELECT TRIM(ps.player_name) player_name, ps.player_id, ps.team_name,
      SUM(ps.matches) matches, SUM(ps.innings) innings, SUM(ps.total_runs) runs,
      SUM(ps.balls_faced) balls, ROUND(100.0 * SUM(ps.total_runs) / NULLIF(SUM(ps.balls_faced), 0), 2) strike_rate,
      SUM(ps.wickets_taken) wickets, SUM(ps.total_legal_balls_bowled) legal_balls,
      ROUND(6.0 * SUM(ps.total_runs_conceded) / NULLIF(SUM(ps.total_legal_balls_bowled), 0), 2) economy,
      CASE WHEN SUM(ps.matches) >= 3 AND SUM(ps.innings) >= 3 AND SUM(ps.total_runs) >= 100 THEN 'High' ELSE 'Limited' END confidence,
      MAX(CASE WHEN fc.competition_id IS NOT NULL THEN 1 ELSE 0 END) feed_gap,
      COUNT(*) OVER () total_rows
    FROM player_stats ps JOIN tournaments t ON t.competition_id = ps.competition_id JOIN seasons s ON s.season_id = t.season_id
    LEFT JOIN failed_comps fc ON fc.competition_id = ps.competition_id
    ${where} ${where ? search.replace('AND', 'AND') : search ? `WHERE ${search.slice(4)}` : ''}
    GROUP BY ps.player_id, ps.team_id, ps.team_name
    ORDER BY runs DESC, wickets DESC LIMIT @pageSize OFFSET @offset
  `, params);
  const total = rows[0]?.total_rows || 0;
  res.json({ rows, page: pageNumber, pageSize, total });
});

app.get('/api/teams', requirePermission('read:teams'), (req, res) => {
  const { where, params } = filters(req.query);
  const { pageNumber, pageSize, offset } = page(req.query);
  const rows = queryRows(`
    SELECT ts.team_id, ts.team_name, SUM(ts.matches) matches, SUM(ts.wins) wins, SUM(ts.losses) losses,
      ROUND(100.0 * SUM(ts.wins) / NULLIF(SUM(ts.matches), 0), 2) win_rate,
      SUM(ts.points) points, SUM(ts.runs_scored) runs_scored, SUM(ts.runs_conceded) runs_conceded,
      ROUND(1.0 * SUM(ts.runs_scored) / NULLIF(SUM(ts.runs_conceded), 0), 3) run_ratio,
      COUNT(*) OVER () total_rows
    FROM team_stats ts JOIN tournaments t ON t.competition_id = ts.competition_id JOIN seasons s ON s.season_id = t.season_id
    ${where} GROUP BY ts.team_id, ts.team_name ORDER BY win_rate DESC, points DESC LIMIT @pageSize OFFSET @offset
  `, { ...params, pageSize, offset });
  const total = rows[0]?.total_rows || 0;
  res.json({ rows, page: pageNumber, pageSize, total });
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
    SELECT s.season_year, t.name tournament_name, t.competition_id,
      ps.team_name, ps.player_id, TRIM(ps.player_name) player_name,
      ps.batting_type, ps.bowling_type,
      ps.matches, ps.innings, ps.total_runs runs, ps.balls_faced balls,
      ps.batting_average, ps.strike_rate, ps.highest_score, ps.matches_bowled,
      ps.total_runs_conceded, ps.total_legal_balls_bowled legal_balls,
      ps.wickets_taken, ps.economy_rate, ps.bowling_average, ps.maidens,
      CAST(json_extract(ps.raw_json, '$.Fifties') AS INTEGER) fifties,
      CAST(json_extract(ps.raw_json, '$.Hundreds') AS INTEGER) hundreds,
      CAST(json_extract(ps.raw_json, '$.Thirties') AS INTEGER) thirties,
      CAST(json_extract(ps.raw_json, '$.Bdry4Scored') AS INTEGER) fours,
      CAST(json_extract(ps.raw_json, '$.Bdry6Scored') AS INTEGER) sixes,
      json_extract(ps.raw_json, '$.BdryPercent') boundary_percent,
      CAST(json_extract(ps.raw_json, '$.DotBallsBowled') AS INTEGER) dot_balls,
      json_extract(ps.raw_json, '$.BowlingDotBallPercent') dot_ball_percent,
      CAST(json_extract(ps.raw_json, '$.NotOuts') AS INTEGER) not_outs,
      CAST(json_extract(ps.raw_json, '$.Wides') AS INTEGER) wides,
      CAST(json_extract(ps.raw_json, '$.NoBalls') AS INTEGER) no_balls
    FROM player_stats ps
    JOIN tournaments t ON t.competition_id = ps.competition_id
    JOIN seasons s ON s.season_id = t.season_id
    WHERE ps.player_id = @playerId
    ORDER BY s.season_year ASC, t.name
  `, { playerId: req.params.playerId });
  res.json(rows);
});

app.get('/api/compare-options', requirePermission('read:players'), (req, res) => {
  const options = cached('compare-options', () => ({
    years: queryRows('SELECT season_year year FROM seasons ORDER BY season_year DESC'),
    tournaments: queryRows('SELECT competition_id id, name FROM tournaments ORDER BY name'),
    teams: queryRows("SELECT DISTINCT team_name FROM player_stats WHERE team_name IS NOT NULL AND TRIM(team_name) != '' ORDER BY team_name"),
    bowlingTypes: queryRows("SELECT DISTINCT TRIM(bowling_type) t FROM player_stats WHERE bowling_type IS NOT NULL AND TRIM(bowling_type) != '' AND TRIM(bowling_type) != 'NONE' ORDER BY t"),
  }));
  res.set('Cache-Control', 'private, max-age=30');
  res.json(options);
});

app.get('/api/compare-pool', requirePermission('read:players'), (req, res) => {
  const clauses = [];
  const params = {};

  if (req.query.years) {
    const yrs = String(req.query.years).split(',').map(Number).filter(Number.isFinite);
    if (yrs.length > 0) {
      yrs.forEach((y, i) => { params[`y${i}`] = y; });
      clauses.push(`s.season_year IN (${yrs.map((_, i) => `@y${i}`).join(',')})`);
    }
  }
  if (req.query.tournament && req.query.tournament !== 'all') {
    clauses.push('t.competition_id = @tournament');
    params.tournament = Number(req.query.tournament);
  }
  if (req.query.team && req.query.team !== 'all') {
    clauses.push('ps.team_name = @team');
    params.team = String(req.query.team);
  }
  if (req.query.batHand === 'right') clauses.push("LOWER(ps.batting_type) LIKE '%right%'");
  if (req.query.batHand === 'left') clauses.push("LOWER(ps.batting_type) LIKE '%left%'");
  if (req.query.bowlType) {
    clauses.push('TRIM(ps.bowling_type) = @bowlType');
    params.bowlType = String(req.query.bowlType);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const hav = [];
  const mn = Number(req.query.minMatches);
  if (mn > 0) { params.minMatches = mn; hav.push('SUM(ps.matches) >= @minMatches'); }
  const mr = Number(req.query.minRuns);
  if (mr > 0) { params.minRuns = mr; hav.push('SUM(ps.total_runs) >= @minRuns'); }
  if (req.query.search) {
    params.search = `%${String(req.query.search).toLowerCase()}%`;
    hav.push('(LOWER(TRIM(ps.player_name)) LIKE @search OR LOWER(ps.team_name) LIKE @search)');
  }
  if (req.query.role === 'batter') {
    hav.push('NOT (SUM(ps.matches_bowled) > 2 AND SUM(ps.wickets_taken) > 0)');
  } else if (req.query.role === 'bowler') {
    hav.push('SUM(ps.matches_bowled) > 2 AND SUM(ps.wickets_taken) > 0 AND NOT (SUM(ps.innings) > 3 AND SUM(ps.total_runs) > 50)');
  } else if (req.query.role === 'allrounder') {
    hav.push('SUM(ps.matches_bowled) > 2 AND SUM(ps.wickets_taken) > 0 AND SUM(ps.innings) > 3 AND SUM(ps.total_runs) > 50');
  }
  const having = hav.length ? `HAVING ${hav.join(' AND ')}` : '';

  // Tournament filter: bounded to ~1000 per tournament, use 5000.
  // Year filter only: largest single year has ~6000 player-team combos, use 7000 to show all.
  // No filter: full dataset is 12k+, cap at 1000 with a warning.
  const hasTournamentFilter = Boolean(req.query.tournament && req.query.tournament !== 'all');
  const hasYearFilter = Boolean(req.query.years);
  const rowLimit = hasTournamentFilter ? 5000 : hasYearFilter ? 7000 : 1000;
  params.rowLimit = rowLimit;

  const rows = queryRows(`
    WITH failed_comps AS (
      SELECT DISTINCT CAST(SUBSTR(source_url, INSTR(source_url, '/stats/') + 7,
        INSTR(SUBSTR(source_url, INSTR(source_url, '/stats/') + 7), '-') - 1) AS INTEGER) competition_id
      FROM source_feeds WHERE status = 'failed'
    )
    SELECT TRIM(ps.player_name) player_name, ps.player_id, ps.team_name,
      MAX(TRIM(ps.batting_type)) batting_type,
      MAX(TRIM(ps.bowling_type)) bowling_type,
      SUM(ps.matches) matches, SUM(ps.innings) innings, SUM(ps.total_runs) runs,
      SUM(ps.balls_faced) balls,
      ROUND(100.0 * SUM(ps.total_runs) / NULLIF(SUM(ps.balls_faced), 0), 2) strike_rate,
      ROUND(1.0 * SUM(ps.total_runs) / NULLIF(
        SUM(ps.innings) - SUM(CAST(json_extract(ps.raw_json, '$.NotOuts') AS INTEGER)), 0
      ), 2) batting_avg,
      SUM(ps.wickets_taken) wickets,
      SUM(ps.total_legal_balls_bowled) legal_balls,
      ROUND(6.0 * SUM(ps.total_runs_conceded) / NULLIF(SUM(ps.total_legal_balls_bowled), 0), 2) economy,
      SUM(ps.matches_bowled) matches_bowled,
      SUM(CAST(json_extract(ps.raw_json, '$.Fifties') AS INTEGER)) fifties,
      SUM(CAST(json_extract(ps.raw_json, '$.Hundreds') AS INTEGER)) hundreds,
      MAX(ps.highest_score) highest_score,
      MAX(CASE WHEN fc.competition_id IS NOT NULL THEN 1 ELSE 0 END) feed_gap,
      COUNT(*) OVER () total_rows
    FROM player_stats ps
    JOIN tournaments t ON t.competition_id = ps.competition_id
    JOIN seasons s ON s.season_id = t.season_id
    LEFT JOIN failed_comps fc ON fc.competition_id = ps.competition_id
    ${where}
    GROUP BY ps.player_id, ps.team_name
    ${having}
    ORDER BY runs DESC, wickets DESC
    LIMIT @rowLimit
  `, params);

  const total = rows[0]?.total_rows || 0;
  res.json({ rows, total, capped: total > rowLimit });
});

// ── PDF Registration endpoints ────────────────────────────────────────────────

app.get('/api/registrations/summary', requirePermission('read:players'), (req, res) => {
  const total    = db.prepare('SELECT COUNT(*) cnt FROM player_registration').get().cnt;
  const accepted = db.prepare("SELECT COUNT(*) cnt FROM player_registration WHERE match_status='accepted'").get().cnt;
  const review   = db.prepare("SELECT COUNT(*) cnt FROM player_registration WHERE match_status='review'").get().cnt;
  const unmatched= db.prepare("SELECT COUNT(*) cnt FROM player_registration WHERE match_status='unmatched'").get().cnt;
  const pdfs     = db.prepare('SELECT COUNT(DISTINCT source_pdf) cnt FROM player_registration').get().cnt;
  const sources  = db.prepare('SELECT DISTINCT source_pdf FROM player_registration ORDER BY source_pdf').all().map(r => r.source_pdf);
  res.json({ total, accepted, review, unmatched, pdfs, sources });
});

app.get('/api/registrations', requirePermission('read:players'), (req, res) => {
  const { pageNumber, pageSize, offset } = page(req.query);
  const clauses = [];
  const params  = {};

  if (req.query.status && req.query.status !== 'all') {
    clauses.push('match_status = @status');
    params.status = String(req.query.status);
  }
  if (req.query.source && req.query.source !== 'all') {
    clauses.push('source_pdf = @source');
    params.source = String(req.query.source);
  }
  if (req.query.search) {
    clauses.push('(LOWER(full_name_pdf) LIKE @search OR LOWER(club_pdf) LIKE @search OR LOWER(COALESCE(db_name_match,"")) LIKE @search)');
    params.search = `%${String(req.query.search).toLowerCase()}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.pageSize = pageSize;
  params.offset   = offset;

  const rows = db.prepare(`
    SELECT hca_reg_id, full_name_pdf, club_pdf, date_of_birth,
           match_tier, match_status, match_score,
           db_name_match, db_club_match, source_pdf, player_id,
           COUNT(*) OVER () total_rows
    FROM player_registration
    ${where}
    ORDER BY
      CASE match_status WHEN 'review' THEN 0 WHEN 'unmatched' THEN 1 ELSE 2 END,
      full_name_pdf
    LIMIT @pageSize OFFSET @offset
  `).all(params);

  const total = rows[0]?.total_rows || 0;
  res.json({ rows, page: pageNumber, pageSize, total });
});

app.patch('/api/registrations/:hcaRegId', requirePermission('read:players'), (req, res) => {
  const { hcaRegId } = req.params;
  const { status } = req.body;
  const allowed = ['accepted', 'rejected', 'review', 'pending'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  const result = dbWrite.prepare(
    "UPDATE player_registration SET match_status = ? WHERE hca_reg_id = ?"
  ).run(status, hcaRegId);
  if (result.changes === 0) return res.status(404).json({ error: 'Record not found' });
  res.json({ ok: true, hca_reg_id: hcaRegId, match_status: status });
});

// ─────────────────────────────────────────────────────────────────────────────

app.use((req, res) => res.sendFile(path.join(publicPath, 'index.html')));

const server = app.listen(port, '0.0.0.0', () => console.log(`HCA Analytics running on http://0.0.0.0:${port}`));
function shutdown() { server.close(() => { db.close(); dbWrite.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
