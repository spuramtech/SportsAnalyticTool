const Database = require('better-sqlite3');
const db = new Database('data/hca_analytics.sqlite', { readonly: true });

// Check raw_json field names
const rows = db.prepare('SELECT player_id, player_name, raw_json FROM player_stats LIMIT 3').all();
rows.forEach(r => {
  const j = JSON.parse(r.raw_json);
  console.log('Player:', r.player_name);
  console.log('  Fifties:', j.Fifties, '| Hundreds:', j.Hundreds, '| Thirties:', j.Thirties);
  console.log('  Bdry4Scored:', j.Bdry4Scored, '| Bdry6Scored:', j.Bdry6Scored);
  console.log('  DotBallsBowled:', j.DotBallsBowled, '| DotBallPercent:', j.DotBallPercent);
  console.log('  NotOuts:', j.NotOuts, '| Wides:', j.Wides, '| NoBalls:', j.NoBalls);
  console.log('  BdryPercent:', j.BdryPercent);
  console.log('---');
});

// Test json_extract works
const test = db.prepare(`
  SELECT player_name,
    CAST(json_extract(raw_json, '$.Fifties') AS INTEGER) fifties,
    CAST(json_extract(raw_json, '$.Bdry4Scored') AS INTEGER) fours,
    CAST(json_extract(raw_json, '$.DotBallsBowled') AS INTEGER) dot_balls,
    CAST(json_extract(raw_json, '$.NotOuts') AS INTEGER) not_outs
  FROM player_stats LIMIT 3
`).all();
console.log('\njson_extract results:');
console.log(JSON.stringify(test, null, 2));

db.close();
