const db = require('better-sqlite3')('data/hca_analytics.sqlite', { readonly: true });

console.log('=== Already loaded PDFs ===');
const sources = db.prepare(`
  SELECT source_pdf, COUNT(*) cnt,
    SUM(CASE WHEN match_status='accepted' THEN 1 ELSE 0 END) accepted,
    SUM(CASE WHEN match_status='review'   THEN 1 ELSE 0 END) review,
    SUM(CASE WHEN match_status='unmatched' THEN 1 ELSE 0 END) unmatched
  FROM player_registration GROUP BY source_pdf
`).all();
sources.forEach(r => console.log(JSON.stringify(r)));

console.log('\n=== Total player_registration rows ===');
const total = db.prepare('SELECT COUNT(*) cnt FROM player_registration').get();
console.log('Total:', total.cnt);

db.close();