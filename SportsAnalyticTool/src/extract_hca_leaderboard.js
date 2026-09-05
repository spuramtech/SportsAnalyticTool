const fs = require('fs');
const path = require('path');

const BASE = 'https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds';
const SITE = 'https://hcamatchcentre.sportsmechanics.in/';
const YEAR = process.argv[2] || '2026';
const SEASON_ID = process.argv[3] || '115';
const OUTPUT = path.join(__dirname, '..', 'exports', `hca_${YEAR}_leaderboard_extract.md`);
const RAW_DIR = path.join(__dirname, '..', 'data', 'leaderboards', `hca_${YEAR}_raw`);

function parseJsonp(text) {
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  return JSON.parse(text.slice(start + 1, end));
}

function markdownValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function markdownTable(rows, preferred) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  keys.sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  if (!rows.length) return '_No leaderboard data returned._';
  return [
    `| ${keys.join(' | ')} |`,
    `| ${keys.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${keys.map(key => markdownValue(row[key])).join(' | ')} |`),
  ].join('\n');
}

async function fetchFeed(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const text = await response.text();
  return { text, data: parseJsonp(text) };
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const competitionUrl = `${BASE}/competition.js`;
  const competitionFeed = await fetchFeed(competitionUrl);
  fs.writeFileSync(path.join(RAW_DIR, 'competition.js'), competitionFeed.text);
  const tournaments = competitionFeed.data.competition.filter(item => String(item.SeasonID) === SEASON_ID);
  const processed = [];
  const failures = [];
  const sections = [];
  const battingOrder = ['TournamentName', 'Season', 'LeaderboardType', 'Rank', 'PlayerName', 'PlayerID', 'TeamName', 'TeamID', 'MatchID', 'SourceURL', 'RawObjectKeyPath', 'StrikerName', 'PlayerId', 'CompetitionID', 'Matches', 'Innings', 'TotalRuns', 'Balls', 'HighestScore', 'BattingAverage', 'StrikeRate', 'Centuries', 'FiftyPlusRuns', 'Fours', 'Sixes'];
  const bowlingOrder = ['TournamentName', 'Season', 'LeaderboardType', 'Rank', 'PlayerName', 'PlayerID', 'TeamName', 'TeamID', 'MatchID', 'SourceURL', 'RawObjectKeyPath', 'BowlerName', 'BowlerID', 'CompetitionID', 'Matches', 'Innings', 'OversBowled', 'Maidens', 'TotalRunsConceded', 'Wickets', 'BBIW', 'BowlingAverage', 'EconomyRate', 'FiveWickets'];

  for (const tournament of tournaments) {
    const id = tournament.CompetitionID;
    const battingUrl = `${BASE}/stats/${id}-toprunsscorers.js`;
    const bowlingUrl = `${BASE}/stats/${id}-mostwickets.js`;
    try {
      const [battingFeed, bowlingFeed] = await Promise.all([fetchFeed(battingUrl), fetchFeed(bowlingUrl)]);
      fs.writeFileSync(path.join(RAW_DIR, `${id}-toprunsscorers.json`), JSON.stringify(battingFeed.data, null, 2));
      fs.writeFileSync(path.join(RAW_DIR, `${id}-mostwickets.json`), JSON.stringify(bowlingFeed.data, null, 2));
      const batting = battingFeed.data.toprunsscorers || [];
      const bowling = bowlingFeed.data.mostwickets || [];
      const decorate = (rows, type, sourceUrl, rawKey) => rows.map((row, index) => ({
        TournamentName: tournament.CompetitionName,
        Season: tournament.SeasonID,
        LeaderboardType: type,
        Rank: index + 1,
        PlayerName: row.StrikerName || row.BowlerName || '',
        PlayerID: row.PlayerId || row.BowlerID || row.PlayerID || '',
        MatchID: row.MatchID || '',
        SourceURL: sourceUrl,
        RawObjectKeyPath: rawKey,
        ...row,
      }));
      const unique = rows => [...new Map(rows.map(row => [JSON.stringify(row), row])).values()];
      const batRows = unique(decorate(batting, 'Batting', battingUrl, 'toprunsscorers'));
      const bowlRows = unique(decorate(bowling, 'Bowling', bowlingUrl, 'mostwickets'));
      processed.push({ tournament, batting: batRows.length, bowling: bowlRows.length });
      sections.push(`## Tournament: ${tournament.CompetitionName.trim()}
### Metadata
- Tournament/Event: ${tournament.CompetitionName}
- Year: ${YEAR} (SeasonID ${tournament.SeasonID})
- Data source: JSONP feed response
- Endpoint(s): [Batting](${battingUrl}), [Bowling](${bowlingUrl})
- Notes: Rows were read from the full feed arrays, decorated with normalized tournament, season, leaderboard type, and rank fields, then deduplicated by complete row content.

### Batting Leaderboard
${markdownTable(batRows, battingOrder)}

### Bowling Leaderboard
${markdownTable(bowlRows, bowlingOrder)}

### Raw Data Notes
- Batting object key path: \`toprunsscorers\`.
- Bowling object key path: \`mostwickets\`.
- Player IDs, team IDs, competition IDs, and the bowling-specific match fields came from the feed response, not only the rendered DOM.
- Raw snapshots: \`hca_${YEAR}_raw/${id}-toprunsscorers.json\` and \`hca_${YEAR}_raw/${id}-mostwickets.json\`.
`);
    } catch (error) {
      failures.push({ tournament, error: error.message, endpoints: [battingUrl, bowlingUrl] });
      sections.push(`## Tournament: ${tournament.CompetitionName.trim()}
### Metadata
- Tournament/Event: ${tournament.CompetitionName}
- Year: ${YEAR} (SeasonID ${tournament.SeasonID})
- Data source: JSONP feed response
- Endpoint(s): ${battingUrl}; ${bowlingUrl}
- Notes: Extraction failed before both feeds could be read.

### Batting Leaderboard
_Unavailable._

### Bowling Leaderboard
_Unavailable._

### Raw Data Notes
- No complete raw snapshot was available: ${error.message}
`);
    }
  }

  const extractedAt = new Date().toISOString();
  const index = tournaments.map((item, index) => `${index + 1}. ${item.CompetitionName.trim()}`).join('\n');
  const log = processed.map(item => `- ${item.tournament.CompetitionName.trim()}: processed successfully (${item.batting} batting rows, ${item.bowling} bowling rows).`).concat(failures.map(item => `- ${item.tournament.CompetitionName.trim()}: FAILED (${item.error}).`)).join('\n');
  const markdown = `# HCA ${YEAR} Leaderboard Extract

## Extraction Summary
- Date/time of extraction: ${extractedAt}
- Site URL: ${SITE}
- Year selected: ${YEAR} (SeasonID ${SEASON_ID})
- Number of tournaments discovered: ${tournaments.length}
- Number processed successfully: ${processed.length}
- Number failed: ${failures.length}
- Notes on data source type: The Leader Board page was inspected in a browser; its network resources expose JSONP feeds. Full batting and bowling arrays were fetched from those feeds and saved as raw JSON snapshots before Markdown transformation.

## Tournament Index
${index}

${sections.join('\n')}
## Failures / Missing Data
${failures.length ? failures.map(item => `- ${item.tournament.CompetitionName.trim()}: ${item.error}. Endpoints: ${item.endpoints.join(', ')}`).join('\n') : '- None.'}

## Extraction Log
${log}
`;
  fs.writeFileSync(OUTPUT, markdown);
  console.log(`Wrote ${OUTPUT}`);
  console.log(`Processed ${processed.length}/${tournaments.length}; failures ${failures.length}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});