const Database = require('better-sqlite3');
const db = new Database('data/hca_analytics.sqlite', { readonly: true });

console.log('=== AGE-BANDED TOURNAMENTS ===');
const aged = db.prepare(
  "SELECT competition_id, name, start_date, end_date FROM tournaments WHERE name LIKE '%U14%' OR name LIKE '%U15%' OR name LIKE '%U16%' OR name LIKE '%U19%' OR name LIKE '%U23%' ORDER BY name"
).all();
aged.forEach(r => console.log(r.competition_id, '|', r.name, '|', r.start_date, '-', r.end_date));

console.log('\n=== RAW TOURNAMENT JSON KEYS ===');
const raw = db.prepare('SELECT raw_json FROM tournaments LIMIT 1').get();
console.log(Object.keys(JSON.parse(raw.raw_json)).join(', '));

console.log('\n=== SAMPLE RAW_JSON FROM A U19 TOURNAMENT ===');
const t = db.prepare("SELECT raw_json FROM tournaments WHERE name LIKE '%U19%' LIMIT 1").get();
console.log(JSON.stringify(JSON.parse(t.raw_json), null, 2));

console.log('\n=== PLAYER RAW_JSON KEYS (from player_stats) ===');
const ps = db.prepare('SELECT raw_json FROM player_stats LIMIT 1').get();
console.log(Object.keys(JSON.parse(ps.raw_json)).join(', '));

console.log('\n=== SAMPLE PLAYER RAW_JSON ===');
const p = db.prepare('SELECT raw_json, player_name FROM player_stats LIMIT 1').get();
console.log('Player:', p.player_name);
console.log(JSON.stringify(JSON.parse(p.raw_json), null, 2));

console.log('\n=== HOW MANY PLAYERS APPEAR IN BOTH U19 AND SENIOR TOURNAMENTS ===');
const cross = db.prepare(`
  SELECT COUNT(DISTINCT ps.player_id) cnt
  FROM player_stats ps
  WHERE ps.competition_id IN (SELECT competition_id FROM tournaments WHERE name LIKE '%U19%')
    AND ps.player_id IN (
      SELECT player_id FROM player_stats
      WHERE competition_id IN (SELECT competition_id FROM tournaments WHERE name NOT LIKE '%U14%' AND name NOT LIKE '%U15%' AND name NOT LIKE '%U16%' AND name NOT LIKE '%U19%' AND name NOT LIKE '%U23%')
    )
`).get();
console.log('Players in both U19 and senior tournaments:', cross.cnt);

console.log('\n=== HOW MANY PLAYERS APPEAR IN U16 AND ABOVE ===');
const u16up = db.prepare(`
  SELECT COUNT(DISTINCT player_id) cnt
  FROM player_stats
  WHERE competition_id IN (SELECT competition_id FROM tournaments WHERE name LIKE '%U16%')
`).get();
console.log('Players in U16 tournaments:', u16up.cnt);

console.log('\n=== PLAYERS IN U19 TOURNAMENTS — SAMPLE ===');
const u19players = db.prepare(`
  SELECT DISTINCT ps.player_id, ps.player_name, ps.team_name, t.name tourn, t.start_date
  FROM player_stats ps
  JOIN tournaments t ON t.competition_id = ps.competition_id
  WHERE t.name LIKE '%U19%'
  ORDER BY ps.player_name
  LIMIT 20
`).all();
u19players.forEach(r => console.log(r.player_id, '|', r.player_name, '|', r.team_name, '|', r.tourn, '|', r.start_date));

console.log('\n=== PLAYERS WHO PLAYED U19 AND ALSO SENIOR ===');
const crossPlayers = db.prepare(`
  SELECT DISTINCT ps.player_id, ps.player_name, ps.team_name
  FROM player_stats ps
  WHERE ps.competition_id IN (SELECT competition_id FROM tournaments WHERE name LIKE '%U19%')
    AND ps.player_id IN (
      SELECT player_id FROM player_stats
      WHERE competition_id NOT IN (
        SELECT competition_id FROM tournaments
        WHERE name LIKE '%U14%' OR name LIKE '%U15%' OR name LIKE '%U16%'
           OR name LIKE '%U19%' OR name LIKE '%U23%'
      )
    )
  ORDER BY ps.player_name
  LIMIT 20
`).all();
crossPlayers.forEach(r => console.log(r.player_id, '|', r.player_name, '|', r.team_name));

db.close();
