const Database = require('better-sqlite3');
const db = new Database('data/hca_analytics.sqlite', { readonly: true });

console.log('=== PLAYER ID PATTERNS — do they start with a year? ===');
const ids = db.prepare('SELECT DISTINCT player_id FROM player_stats ORDER BY player_id LIMIT 30').all();
ids.forEach(r => console.log(r.player_id, '  prefix-4:', r.player_id.slice(0, 4)));

console.log('\n=== Specialization field distinct values ===');
const specs = db.prepare("SELECT json_extract(raw_json, '$.Specialization') spec, COUNT(*) cnt FROM player_stats GROUP BY 1 ORDER BY cnt DESC LIMIT 20").all();
specs.forEach(r => console.log(JSON.stringify(r)));

console.log('\n=== TeamType values in tournaments ===');
const tt = db.prepare("SELECT json_extract(raw_json, '$.TeamType') team_type, COUNT(*) cnt FROM tournaments GROUP BY 1 ORDER BY cnt DESC").all();
tt.forEach(r => console.log(JSON.stringify(r)));

console.log('\n=== CompetitionLevel values in tournaments ===');
const cl = db.prepare("SELECT json_extract(raw_json, '$.CompetitionLevel') comp_level, COUNT(*) cnt FROM tournaments GROUP BY 1 ORDER BY cnt DESC").all();
cl.forEach(r => console.log(JSON.stringify(r)));

console.log('\n=== SubCategoryId values in tournaments ===');
const sc = db.prepare("SELECT json_extract(raw_json, '$.SubCategoryId') sub_cat, name FROM tournaments ORDER BY sub_cat").all();
sc.forEach(r => console.log(r.sub_cat, '|', r.name));

console.log('\n=== Players who appear in U16 AND U19 (same ID) ===');
const u16u19 = db.prepare(`
  SELECT DISTINCT p.player_id, p.player_name
  FROM player_stats p
  WHERE p.competition_id IN (SELECT competition_id FROM tournaments WHERE name LIKE '%U16%')
    AND p.player_id IN (
      SELECT player_id FROM player_stats WHERE competition_id IN (
        SELECT competition_id FROM tournaments WHERE name LIKE '%U19%'
      )
    )
  ORDER BY p.player_name
  LIMIT 20
`).all();
console.log('Count players in both U16 and U19:', u16u19.length, '(showing first 20)');
u16u19.forEach(r => console.log(r.player_id, '|', r.player_name));

console.log('\n=== For a cross-tier player — show all their tournaments chronologically ===');
if (u16u19.length > 0) {
  const sample = u16u19[0];
  const history = db.prepare(`
    SELECT t.name, t.start_date, ps.team_name
    FROM player_stats ps
    JOIN tournaments t ON t.competition_id = ps.competition_id
    WHERE ps.player_id = ?
    ORDER BY t.start_date
  `).all(sample.player_id);
  console.log('Player:', sample.player_name, '(ID:', sample.player_id + ')');
  history.forEach(r => console.log(' ', r.start_date, '|', r.name, '|', r.team_name));
}

console.log('\n=== Total age-group tournaments by band ===');
const bands = ['U14', 'U15', 'U16', 'U19', 'U23'];
bands.forEach(b => {
  const count = db.prepare(`SELECT COUNT(*) cnt FROM tournaments WHERE name LIKE '%${b}%'`).get();
  const players = db.prepare(`SELECT COUNT(DISTINCT player_id) cnt FROM player_stats WHERE competition_id IN (SELECT competition_id FROM tournaments WHERE name LIKE '%${b}%')`).get();
  console.log(b, '-> tournaments:', count.cnt, '| unique players:', players.cnt);
});

console.log('\n=== Total players with NO age-group tournament at all ===');
const noAge = db.prepare(`
  SELECT COUNT(DISTINCT player_id) cnt FROM player_stats
  WHERE player_id NOT IN (
    SELECT player_id FROM player_stats WHERE competition_id IN (
      SELECT competition_id FROM tournaments
      WHERE name LIKE '%U14%' OR name LIKE '%U15%' OR name LIKE '%U16%'
         OR name LIKE '%U19%' OR name LIKE '%U23%'
    )
  )
`).get();
console.log('Players with zero age-group tournament record:', noAge.cnt);

console.log('\n=== Total distinct players in DB ===');
const total = db.prepare('SELECT COUNT(DISTINCT player_id) cnt FROM player_stats').get();
console.log('Total unique players:', total.cnt);

db.close();
