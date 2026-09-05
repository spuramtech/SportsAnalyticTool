const state = { year: 'all', tournament: 'all', search: '', role: localStorage.getItem('hca-dev-role') || 'analyst', loaded: new Set() };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const number = value => value === null || value === undefined ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmt1 = v => { const n = parseFloat(v); return isNaN(n) ? '—' : n.toFixed(1); };
const fmt2 = v => { const n = parseFloat(v); return isNaN(n) ? '—' : n.toFixed(2); };

async function api(endpoint) {
  const response = await fetch(endpoint, { headers: { 'X-Dev-Role': state.role } });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function setLoading(message) {
  $('#loading-status').textContent = message;
  $('#loading-status').dataset.state = message === 'Ready' ? 'ready' : 'loading';
}

async function loadWithStatus(message, work) {
  setLoading(message);
  try {
    const result = await work();
    setLoading('Ready');
    return result;
  } catch (error) {
    setLoading(`Unable to load: ${error.message}`);
    throw error;
  }
}

function query() {
  const params = new URLSearchParams({ year: state.year, tournament: state.tournament });
  if (state.search) params.set('search', state.search);
  return params.toString();
}

function showSection(section) {
  $$('.content-section').forEach(item => item.classList.toggle('active-section', item.id === `${section}-section`));
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.section === section));
  const titles = { overview: 'Performance overview', players: 'Player pool', teams: 'Team performance', quality: 'Data quality', compare: 'Compare players' };
  $('#page-title').textContent = titles[section] || section;
  if (section === 'players' && !state.loaded.has('players')) loadPlayers();
  if (section === 'teams' && !state.loaded.has('teams')) loadTeams();
  if (section === 'quality' && !state.loaded.has('quality')) loadQuality();
  if (section === 'compare' && !cpoolState.opts) initComparePool();
}

function renderKpis(summary) {
  const cards = [['tournaments', 'Tournaments', 'Competition set'], ['teams', 'Teams', 'Distinct team records'], ['players', 'Players', 'Indexed player records'], ['matches', 'Matches', 'Aggregated match appearances'], ['failed_feeds', 'Feed gaps', 'Needs analyst review']];
  $('#kpis').innerHTML = cards.map(([key, label, foot]) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${number(summary[key])}</div><div class="kpi-foot">${foot}</div></div>`).join('');
}

function renderBatting(rows) {
  $('#batting-preview').innerHTML = rows.slice(0, 5).map((row, index) => `<div class="mini-row"><span class="mini-rank">0${index + 1}</span><div><div class="mini-name">${row.player_name || 'Unknown'}</div><div class="mini-meta">${row.team_name || 'Unknown team'} · ${number(row.matches)} matches</div></div><span class="mini-value">${number(row.runs)} runs</span></div>`).join('') || '<p class="lede">No qualifying records.</p>';
}

function renderTeams(rows) {
  $('#team-preview').innerHTML = rows.slice(0, 5).map((row, index) => `<div class="mini-row"><span class="mini-rank">0${index + 1}</span><div><div class="mini-name">${row.team_name || 'Unknown'}</div><div class="mini-meta">${number(row.wins)} wins · ${number(row.matches)} matches</div></div><span class="mini-value">${number(row.win_rate)}%</span></div>`).join('') || '<p class="lede">No team records.</p>';
}

function renderPlayers(rows) {
  playerMap.clear();
  rows.forEach(r => playerMap.set(String(r.player_id), r));
  $('#players-table').innerHTML = rows.map(row => {
    const id = String(row.player_id);
    const isSel = compare.selected.some(p => p.id === id);
    const dis = !isSel && compare.selected.length >= 2 ? ' disabled' : '';
    return `<tr data-player="${id}">
      <td><div class="player-name">${row.player_name || 'Unknown'}</div><div class="sub-cell">${id || 'No ID'}</div></td>
      <td>${row.team_name || '—'}</td>
      <td>${number(row.matches)}</td>
      <td>${number(row.innings)}</td>
      <td>${number(row.runs)}</td>
      <td>${number(row.strike_rate)}</td>
      <td>${number(row.wickets)}</td>
      <td>${number(row.economy)}</td>
      <td><span class="pill ${row.confidence === 'Limited' ? 'limited' : ''}">${row.confidence}</span></td>
      <td><button class="cmp-btn${isSel ? ' cmp-active' : ''}" data-cmp="${id}" title="${isSel ? 'Remove from compare' : 'Add to compare'}"${dis}>${isSel ? '✓' : '+'}</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="10">No records found.</td></tr>';

}

function renderTeamsTable(rows) {
  $('#teams-table').innerHTML = rows.map(row => `<tr><td class="player-name">${row.team_name || 'Unknown'}</td><td>${number(row.matches)}</td><td>${number(row.wins)}</td><td>${number(row.losses)}</td><td>${number(row.win_rate)}%</td><td>${number(row.points)}</td><td>${number(row.run_ratio)}</td></tr>`).join('') || '<tr><td colspan="7">No records found.</td></tr>';
}

async function loadOverview() {
  const requests = [api(`/api/summary?${query()}`)];
  if (state.user?.permissions.includes('read:players')) requests.push(api(`/api/players?${query()}`));
  if (state.user?.permissions.includes('read:teams')) requests.push(api(`/api/teams?${query()}`));
  const results = await loadWithStatus('Loading overview…', () => Promise.all(requests));
  renderKpis(results[0]);
  const players = state.user?.permissions.includes('read:players') ? results[1].rows : [];
  const teams = state.user?.permissions.includes('read:teams') ? results[state.user?.permissions.includes('read:players') ? 2 : 1].rows : [];
  renderBatting(players); renderTeams(teams);
}

async function loadPlayers() {
  const result = await loadWithStatus('Loading player pool…', () => api(`/api/players?${query()}`));
  renderPlayers(result.rows);
  state.loaded.add('players');
}
async function loadTeams() {
  const result = await loadWithStatus('Loading team performance…', () => api(`/api/teams?${query()}`));
  renderTeamsTable(result.rows);
  state.loaded.add('teams');
}
async function loadQuality() {
  const quality = await loadWithStatus('Checking source quality…', () => api('/api/quality'));
  $('#quality-checks').innerHTML = quality.checks.map(item => `<div class="quality-card"><div class="label">${item.name}</div><div class="value">${number(item.value)}</div><div class="kpi-foot">${item.status === 'pass' ? 'Validated' : 'Review required'}</div></div>`).join('');
  $('#failures-table').innerHTML = quality.failed.map(item => `<tr><td>${item.source_url}</td><td class="error-cell">${item.error || 'Unavailable'}</td></tr>`).join('') || '<tr><td colspan="2">No failed feeds.</td></tr>';
  state.loaded.add('quality');
}

function applyRoleCapabilities(user) {
  state.user = user;
  const sectionPermission = { players: 'read:players', teams: 'read:teams', quality: 'read:quality', compare: 'read:players' };
  $$('.nav-item').forEach(item => {
    const perm = sectionPermission[item.dataset.section];
    item.hidden = Boolean(perm && !user.permissions.includes(perm));
  });
  $('#last-updated').textContent = `${user.label} · authentication disabled · local RBAC simulation`;
}

// ── Player comparison ─────────────────────────────────────────────────────────

const playerMap = new Map();
const compare = { selected: [] };
const cmpCharts = [];

function destroyCmpCharts() {
  cmpCharts.forEach(c => c.destroy());
  cmpCharts.length = 0;
}

function computeCareer(rows) {
  const c = {
    matches:  rows.reduce((s, r) => s + (r.matches || 0), 0),
    innings:  rows.reduce((s, r) => s + (r.innings || 0), 0),
    runs:     rows.reduce((s, r) => s + (r.runs || 0), 0),
    balls:    rows.reduce((s, r) => s + (r.balls || 0), 0),
    notOuts:  rows.reduce((s, r) => s + (r.not_outs || 0), 0),
    fifties:  rows.reduce((s, r) => s + (r.fifties || 0), 0),
    hundreds: rows.reduce((s, r) => s + (r.hundreds || 0), 0),
    thirties: rows.reduce((s, r) => s + (r.thirties || 0), 0),
    fours:    rows.reduce((s, r) => s + (r.fours || 0), 0),
    sixes:    rows.reduce((s, r) => s + (r.sixes || 0), 0),
    wickets:  rows.reduce((s, r) => s + (r.wickets_taken || 0), 0),
    runsConc: rows.reduce((s, r) => s + (r.total_runs_conceded || 0), 0),
    legalBalls: rows.reduce((s, r) => s + (r.legal_balls || 0), 0),
    mBowled:  rows.reduce((s, r) => s + (r.matches_bowled || 0), 0),
    maidens:  rows.reduce((s, r) => s + (r.maidens || 0), 0),
    dotBalls: rows.reduce((s, r) => s + (r.dot_balls || 0), 0),
  };
  const outs = c.innings - c.notOuts;
  c.avg      = outs > 0 ? c.runs / outs : 0;
  c.sr       = c.balls > 0 ? (c.runs / c.balls) * 100 : 0;
  c.econ     = c.legalBalls > 0 ? (c.runsConc / c.legalBalls) * 6 : 0;
  c.bowlAvg  = c.wickets > 0 ? c.runsConc / c.wickets : 0;
  c.dotPct   = c.legalBalls > 0 ? (c.dotBalls / c.legalBalls) * 100 : 0;
  c.bdryRuns = c.fours * 4 + c.sixes * 6;
  c.bdryPct  = c.runs > 0 ? (c.bdryRuns / c.runs) * 100 : 0;
  c.hs       = rows.reduce((best, r) => Math.max(best, parseInt(r.highest_score) || 0), 0);
  return c;
}

function syncCompareBtns() {
  $$('.cmp-btn[data-cmp]').forEach(btn => {
    const sel = compare.selected.some(p => p.id === btn.dataset.cmp);
    btn.classList.toggle('cmp-active', sel);
    btn.textContent = sel ? '✓' : '+';
    btn.title = sel ? 'Remove from compare' : 'Add to compare';
    btn.disabled = !sel && compare.selected.length >= 2;
  });
}

function toggleCompare(id, name, team) {
  const idx = compare.selected.findIndex(p => p.id === id);
  if (idx >= 0) {
    compare.selected.splice(idx, 1);
  } else {
    if (compare.selected.length >= 2) return;
    compare.selected.push({ id, name, team });
  }
  syncCompareBtns();
  renderCompareBanner();
}

function renderCompareBanner() {
  const banner = $('#compare-banner');
  if (!banner) return;
  if (compare.selected.length === 0) { banner.hidden = true; return; }
  banner.hidden = false;
  const [p1, p2] = compare.selected;
  $('#compare-banner-names').innerHTML = p2
    ? `<strong>${p1.name}</strong> vs <strong>${p2.name}</strong>`
    : `<strong>${p1.name}</strong> &mdash; select one more player to compare`;
  $('#btn-cmp-go').disabled = compare.selected.length < 2;
}

async function openCompare() {
  if (compare.selected.length < 2) return;
  const [p1, p2] = compare.selected;
  setLoading('Loading comparison…');
  let rows1, rows2;
  try {
    [rows1, rows2] = await Promise.all([
      api(`/api/players/${encodeURIComponent(p1.id)}`),
      api(`/api/players/${encodeURIComponent(p2.id)}`),
    ]);
    setLoading('Ready');
  } catch (err) { setLoading(`Error: ${err.message}`); return; }
  destroyCmpCharts();
  buildCompareContent(rows1, rows2, p1, p2);
  $('#compare-dialog').showModal();
}

function buildCompareContent(rows1, rows2, p1, p2) {
  const c1 = computeCareer(rows1);
  const c2 = computeCareer(rows2);
  const hasBowling = c1.mBowled > 0 || c2.mBowled > 0;
  const n1 = p1.name.split(' ')[0];
  const n2 = p2.name.split(' ')[0];

  function hRow(label, v1, v2, lowerBetter = false, fmt = v => number(v)) {
    const n1 = Number(v1), n2 = Number(v2);
    const valid = isFinite(n1) && isFinite(n2) && (n1 !== 0 || n2 !== 0);
    const p1wins = valid && (lowerBetter ? n1 < n2 : n1 > n2);
    const p2wins = valid && (lowerBetter ? n2 < n1 : n2 > n1);
    return `<tr>
      <td class="h2h-label">${label}</td>
      <td class="h2h-val${p1wins ? ' h2h-win p1' : ''}">${fmt(v1)}</td>
      <td class="h2h-val${p2wins ? ' h2h-win p2' : ''}">${fmt(v2)}</td>
    </tr>`;
  }
  const pct = v => (v || 0) === 0 ? '—' : v.toFixed(1) + '%';
  const dec2 = v => (v || 0) === 0 ? '—' : Number(v).toFixed(2);

  const battingRows = [
    hRow('Matches', c1.matches, c2.matches),
    hRow('Innings', c1.innings, c2.innings),
    hRow('Runs', c1.runs, c2.runs),
    hRow('Not Outs', c1.notOuts, c2.notOuts),
    hRow('Batting Average', c1.avg, c2.avg, false, dec2),
    hRow('Strike Rate', c1.sr, c2.sr, false, dec2),
    hRow('Highest Score', c1.hs, c2.hs),
    hRow('30s', c1.thirties, c2.thirties),
    hRow('50s', c1.fifties, c2.fifties),
    hRow('100s', c1.hundreds, c2.hundreds),
    hRow('4s', c1.fours, c2.fours),
    hRow('6s', c1.sixes, c2.sixes),
    hRow('Boundary %', c1.bdryPct, c2.bdryPct, false, pct),
  ].join('');

  const bowlingRows = hasBowling ? [
    hRow('Matches Bowled', c1.mBowled, c2.mBowled),
    hRow('Wickets', c1.wickets, c2.wickets),
    hRow('Runs Conceded', c1.runsConc, c2.runsConc, true),
    hRow('Economy', c1.econ || 0, c2.econ || 0, true, dec2),
    hRow('Bowling Average', c1.bowlAvg || 0, c2.bowlAvg || 0, true, dec2),
    hRow('Maidens', c1.maidens, c2.maidens),
    hRow('Dot Ball %', c1.dotPct, c2.dotPct, false, pct),
  ].join('') : '';

  $('#compare-content').innerHTML = `
    <div class="cmp-players">
      <div class="cmp-player-card p1">
        <strong>${p1.name}</strong>
        <small>${p1.team}</small>
      </div>
      <div class="cmp-vs">vs</div>
      <div class="cmp-player-card p2">
        <strong>${p2.name}</strong>
        <small>${p2.team}</small>
      </div>
    </div>
    <div class="cmp-body">
      <div>
        <table class="h2h-table">
          <thead><tr><th>Metric</th><th class="p1-head">${n1}</th><th class="p2-head">${n2}</th></tr></thead>
          <tbody>
            <tr class="h2h-section-row"><td colspan="3">Batting</td></tr>
            ${battingRows}
            ${hasBowling ? `<tr class="h2h-section-row"><td colspan="3">Bowling</td></tr>${bowlingRows}` : ''}
          </tbody>
        </table>
      </div>
      <div class="cmp-charts">
        <div class="cmp-chart-box">
          <p class="cmp-chart-lbl">Performance radar — normalized to 100 = better player</p>
          <canvas id="cmp-radar"></canvas>
        </div>
        <div class="cmp-chart-box">
          <p class="cmp-chart-lbl">Batting metrics comparison</p>
          <canvas id="cmp-bat-bar"></canvas>
        </div>
        ${hasBowling ? `<div class="cmp-chart-box"><p class="cmp-chart-lbl">Bowling metrics comparison</p><canvas id="cmp-bowl-bar"></canvas></div>` : ''}
      </div>
    </div>`;

  renderCmpCharts(c1, c2, n1, n2, hasBowling);
}

function renderCmpCharts(c1, c2, n1, n2, hasBowling) {
  const mono = "'DM Mono', monospace";
  const col1 = C.green, col2 = '#e07020';

  function norm(v1, v2) {
    const mx = Math.max(v1 || 0, v2 || 0);
    if (mx === 0) return [0, 0];
    return [Math.round((v1 || 0) / mx * 100), Math.round((v2 || 0) / mx * 100)];
  }

  // Radar data
  const radarLabels = ['Avg', 'Strike Rate', 'Runs/Match', 'Milestone\nRate', 'Boundary %'];
  const rd1 = [], rd2 = [];
  const push = (v1, v2) => { const [a, b] = norm(v1, v2); rd1.push(a); rd2.push(b); };
  push(c1.avg, c2.avg);
  push(c1.sr, c2.sr);
  push(c1.matches ? c1.runs / c1.matches : 0, c2.matches ? c2.runs / c2.matches : 0);
  push(
    c1.innings ? (c1.fifties + c1.hundreds) / c1.innings : 0,
    c2.innings ? (c2.fifties + c2.hundreds) / c2.innings : 0
  );
  push(c1.bdryPct, c2.bdryPct);
  if (hasBowling) {
    radarLabels.push('Wkts/Match', 'Dot Ball %', 'Economy\n(inv)');
    push(
      c1.mBowled ? c1.wickets / c1.mBowled : 0,
      c2.mBowled ? c2.wickets / c2.mBowled : 0
    );
    push(c1.dotPct, c2.dotPct);
    // Economy inverted: lower is better → invert so higher score = better
    const maxE = Math.max(c1.econ || 0, c2.econ || 0) || 1;
    push(maxE - (c1.econ || maxE), maxE - (c2.econ || maxE));
  }

  cmpCharts.push(new Chart(document.getElementById('cmp-radar'), {
    type: 'radar',
    data: {
      labels: radarLabels,
      datasets: [
        { label: n1, data: rd1, borderColor: col1, backgroundColor: col1 + '28', pointBackgroundColor: col1, pointRadius: 3 },
        { label: n2, data: rd2, borderColor: col2, backgroundColor: col2 + '28', pointBackgroundColor: col2, pointRadius: 3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true, aspectRatio: 1.35,
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: '#dce4df' },
          pointLabels: { font: { size: 9, family: mono }, color: C.muted },
        },
      },
      plugins: {
        legend: { labels: { font: { size: 10, family: mono }, color: C.muted, boxWidth: 10 } },
        tooltip: {
          callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}` },
          titleFont: { size: 10, family: mono }, bodyFont: { size: 10, family: mono },
        },
      },
    },
  }));

  // Batting grouped bar
  const batLabels = ['Avg', 'Strike Rate', 'Bdry %', '50s/10 Inns', '100s/10 Inns'];
  const inns1 = c1.innings || 1, inns2 = c2.innings || 1;
  cmpCharts.push(new Chart(document.getElementById('cmp-bat-bar'), {
    type: 'bar',
    data: {
      labels: batLabels,
      datasets: [
        {
          label: n1, backgroundColor: col1 + 'bb', borderColor: col1, borderWidth: 1,
          data: [+c1.avg.toFixed(2), +c1.sr.toFixed(2), +c1.bdryPct.toFixed(1),
                 +(c1.fifties / inns1 * 10).toFixed(2), +(c1.hundreds / inns1 * 10).toFixed(2)],
        },
        {
          label: n2, backgroundColor: col2 + 'bb', borderColor: col2, borderWidth: 1,
          data: [+c2.avg.toFixed(2), +c2.sr.toFixed(2), +c2.bdryPct.toFixed(1),
                 +(c2.fifties / inns2 * 10).toFixed(2), +(c2.hundreds / inns2 * 10).toFixed(2)],
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true, aspectRatio: 1.6,
      plugins: {
        legend: { labels: { font: { size: 10, family: mono }, color: C.muted, boxWidth: 10 } },
        tooltip: { titleFont: { size: 10, family: mono }, bodyFont: { size: 10, family: mono } },
      },
      scales: {
        x: { ticks: { font: { size: 9, family: mono }, color: C.muted }, grid: { color: '#e8ede9' } },
        y: { beginAtZero: true, ticks: { font: { size: 9, family: mono }, color: C.muted }, grid: { color: '#e8ede9' } },
      },
    },
  }));

  if (hasBowling) {
    const mb1 = c1.mBowled || 1, mb2 = c2.mBowled || 1;
    cmpCharts.push(new Chart(document.getElementById('cmp-bowl-bar'), {
      type: 'bar',
      data: {
        labels: ['Economy', 'Bowl Avg', 'Wkts/Match', 'Dot Ball %'],
        datasets: [
          {
            label: n1, backgroundColor: col1 + 'bb', borderColor: col1, borderWidth: 1,
            data: [+c1.econ.toFixed(2), +(c1.bowlAvg || 0).toFixed(2),
                   +(c1.wickets / mb1).toFixed(2), +c1.dotPct.toFixed(1)],
          },
          {
            label: n2, backgroundColor: col2 + 'bb', borderColor: col2, borderWidth: 1,
            data: [+c2.econ.toFixed(2), +(c2.bowlAvg || 0).toFixed(2),
                   +(c2.wickets / mb2).toFixed(2), +c2.dotPct.toFixed(1)],
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: true, aspectRatio: 1.6,
        plugins: {
          legend: { labels: { font: { size: 10, family: mono }, color: C.muted, boxWidth: 10 } },
          tooltip: { titleFont: { size: 10, family: mono }, bodyFont: { size: 10, family: mono } },
        },
        scales: {
          x: { ticks: { font: { size: 9, family: mono }, color: C.muted }, grid: { color: '#e8ede9' } },
          y: { beginAtZero: true, ticks: { font: { size: 9, family: mono }, color: C.muted }, grid: { color: '#e8ede9' } },
        },
      },
    }));
  }
}

// ── Compare pool screen ───────────────────────────────────────────────────────

const CPOOL_COLORS = ['#0e4b3b', '#e07020', '#2d9e91', '#7357c8', '#1a6fa8', '#df755f'];

const cpoolState = {
  opts: null,
  pool: [],
  selected: [],   // { id, name, team }
};

const mcmpCharts = [];

function destroyMcmpCharts() {
  mcmpCharts.forEach(c => c.destroy());
  mcmpCharts.length = 0;
}

function getPlayerRole(row) {
  const hasBowl = (row.matches_bowled || 0) > 2 && (row.wickets || 0) > 0;
  const hasBat  = (row.innings || 0) > 3 && (row.runs || 0) > 50;
  if (hasBat && hasBowl) return 'All-Rounder';
  if (hasBowl) return 'Bowler';
  return 'Batter';
}

async function initComparePool() {
  if (cpoolState.opts) return;
  try {
    cpoolState.opts = await api('/api/compare-options');
  } catch (err) {
    setLoading(`Compare pool init failed: ${err.message}`);
    return;
  }

  // Year pills
  const yearDiv = $('#cpool-years');
  yearDiv.innerHTML = cpoolState.opts.years.map(y =>
    `<button class="cpool-pill" data-year="${y.year}" type="button">${y.year}</button>`
  ).join('');
  yearDiv.addEventListener('click', e => {
    const pill = e.target.closest('.cpool-pill');
    if (pill) pill.classList.toggle('cpool-pill-on');
  });

  // Tournament dropdown
  const tournSel = $('#cpool-tournament');
  (cpoolState.opts.tournaments || []).forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    tournSel.appendChild(opt);
  });

  // Team dropdown
  const teamSel = $('#cpool-team');
  cpoolState.opts.teams.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.team_name;
    opt.textContent = t.team_name;
    teamSel.appendChild(opt);
  });

  // Bowling type dropdown — group into Pace / Leg Spin / Off Spin-Orthodox
  const bowlSel = $('#cpool-bowl-type');
  const bgroups = { Pace: [], 'Leg Spin': [], 'Off Spin / Orthodox': [], Other: [] };
  (cpoolState.opts.bowlingTypes || []).forEach(({ t }) => {
    if (/fast/i.test(t))                              bgroups['Pace'].push(t);
    else if (/leg.spin|leg.spinner|chinaman/i.test(t)) bgroups['Leg Spin'].push(t);
    else if (/off.spin|off.spinner|orthodox/i.test(t)) bgroups['Off Spin / Orthodox'].push(t);
    else                                               bgroups['Other'].push(t);
  });
  Object.entries(bgroups).forEach(([label, types]) => {
    if (!types.length) return;
    const grp = document.createElement('optgroup');
    grp.label = label;
    types.forEach(t => {
      const o = document.createElement('option');
      o.value = t;
      o.textContent = t;
      grp.appendChild(o);
    });
    bowlSel.appendChild(grp);
  });

  await loadComparePool();
}

async function loadComparePool() {
  const years = $$('#cpool-years .cpool-pill-on').map(p => p.dataset.year).join(',');
  const params = new URLSearchParams();
  if (years) params.set('years', years);
  const tourn = $('#cpool-tournament')?.value;
  if (tourn && tourn !== 'all') params.set('tournament', tourn);
  const team = $('#cpool-team')?.value;
  if (team && team !== 'all') params.set('team', team);
  const mm = Number($('#cpool-min-matches')?.value);
  if (mm > 0) params.set('minMatches', mm);
  const mr = Number($('#cpool-min-runs')?.value);
  if (mr > 0) params.set('minRuns', mr);
  const srch = $('#cpool-search')?.value?.trim();
  if (srch) params.set('search', srch);

  let poolData;
  try {
    poolData = await loadWithStatus('Loading player pool…', () => api(`/api/compare-pool?${params}`));
  } catch (err) {
    setLoading(`Pool error: ${err.message}`);
    return;
  }
  let rows = poolData.rows;
  const poolTotal = poolData.total;
  const poolCapped = poolData.capped;

  // Client-side filters
  const role      = $('#cpool-role')?.value;
  const batHand   = $('#cpool-bat-hand')?.value;
  const bowlType  = $('#cpool-bowl-type')?.value;

  if (role === 'batter')     rows = rows.filter(r => getPlayerRole(r) === 'Batter');
  if (role === 'bowler')     rows = rows.filter(r => getPlayerRole(r) === 'Bowler');
  if (role === 'allrounder') rows = rows.filter(r => getPlayerRole(r) === 'All-Rounder');
  if (batHand === 'right')   rows = rows.filter(r => /right/i.test(r.batting_type || ''));
  if (batHand === 'left')    rows = rows.filter(r => /left/i.test(r.batting_type || ''));
  if (bowlType)              rows = rows.filter(r => (r.bowling_type || '').trim() === bowlType);

  cpoolState.pool = rows;
  renderCpoolTable(rows, poolTotal, poolCapped);
}

function renderCpoolTable(rows, total = rows.length, capped = false) {
  const shown = rows.length;
  const countEl = $('#cpool-count');
  if (capped) {
    countEl.innerHTML = `${total.toLocaleString()} players in pool &mdash; showing top ${shown.toLocaleString()} by runs &nbsp;<span style="color:var(--orange);font-weight:700">&#9888; Use search to find specific players</span>`;
  } else {
    countEl.textContent = `${shown.toLocaleString()} player${shown !== 1 ? 's' : ''} in pool`;
  }
  $('#cpool-table').innerHTML = rows.map(row => {
    const id = String(row.player_id);
    const sel = cpoolState.selected.some(p => p.id === id);
    const dis = !sel && cpoolState.selected.length >= 6 ? ' disabled' : '';
    const role = getPlayerRole(row);
    const roleClass = role === 'All-Rounder' ? 'role-ar' : role === 'Bowler' ? 'role-bowl' : 'role-bat';
    const roleLbl   = role === 'All-Rounder' ? 'AR' : role === 'Bowler' ? 'BOWL' : 'BAT';
    const batShort  = (row.batting_type || '').replace('Hand Bat', '').trim() || '—';
    const bowlShort = (row.bowling_type || '').replace('Arm ', '').trim().slice(0, 14) || '—';
    return `<tr>
      <td class="td-name">${row.player_name || 'Unknown'}<span class="td-sub">${id}</span></td>
      <td>${row.team_name || '—'}</td>
      <td><span class="role-badge ${roleClass}">${roleLbl}</span></td>
      <td style="font:10px var(--mono);color:var(--muted);white-space:nowrap">${batShort}</td>
      <td style="font:10px var(--mono);color:var(--muted);white-space:nowrap">${bowlShort}</td>
      <td>${row.matches || 0}</td>
      <td>${row.innings || 0}</td>
      <td>${number(row.runs)}</td>
      <td>${fmt2(row.batting_avg)}</td>
      <td>${fmt2(row.strike_rate)}</td>
      <td>${row.highest_score || '—'}</td>
      <td>${row.fifties || 0}</td>
      <td>${row.hundreds || 0}</td>
      <td>${row.wickets || 0}</td>
      <td>${row.economy ? fmt2(row.economy) : '—'}</td>
      <td><button class="cmp-btn${sel ? ' cmp-active' : ''}" data-cpool-cmp="${id}" title="${sel ? 'Remove' : 'Add to compare'}"${dis}>${sel ? '✓' : '+'}</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="16" style="text-align:center;padding:20px;color:var(--muted)">No players match the current filters.</td></tr>';
}

function cpoolToggle(id) {
  const row = cpoolState.pool.find(r => String(r.player_id) === id);
  if (!row) return;
  const idx = cpoolState.selected.findIndex(p => p.id === id);
  if (idx >= 0) {
    cpoolState.selected.splice(idx, 1);
  } else {
    if (cpoolState.selected.length >= 6) return;
    cpoolState.selected.push({ id, name: row.player_name || 'Unknown', team: row.team_name || '—' });
  }
  syncCpoolBtns();
  renderCpoolSelBar();
}

function syncCpoolBtns() {
  $$('#cpool-table .cmp-btn[data-cpool-cmp]').forEach(btn => {
    const id = btn.dataset.cpoolCmp;
    const sel = cpoolState.selected.some(p => p.id === id);
    btn.classList.toggle('cmp-active', sel);
    btn.textContent = sel ? '✓' : '+';
    btn.title = sel ? 'Remove from compare' : 'Add to compare';
    btn.disabled = !sel && cpoolState.selected.length >= 6;
  });
}

function renderCpoolSelBar() {
  const bar = $('#cpool-selbar');
  if (!bar) return;
  if (cpoolState.selected.length === 0) { bar.hidden = true; return; }
  bar.hidden = false;
  $('#cpool-chips').innerHTML = cpoolState.selected.map((p, i) => {
    const col = CPOOL_COLORS[i];
    return `<span class="cpool-chip" style="background:${col}22;border-color:${col};color:${col}">
      ${p.name.split(' ')[0]}
      <button onclick="cpoolToggle('${p.id}')" title="Remove">×</button>
    </span>`;
  }).join('');
  $('#cpool-run-cmp').disabled = cpoolState.selected.length < 2;
}

async function runComparison() {
  if (cpoolState.selected.length < 2) return;
  destroyMcmpCharts();
  let dataArr;
  try {
    dataArr = await loadWithStatus('Loading player data…', () =>
      Promise.all(cpoolState.selected.map(p => api(`/api/players/${encodeURIComponent(p.id)}`)))
    );
  } catch (err) {
    alert(`Unable to load player detail.\n\nYou may need the Coach or Admin role.\n\n${err.message}`);
    return;
  }
  buildMultiCompare(dataArr, cpoolState.selected);
  $('#cpool-results').hidden = false;
  document.getElementById('cpool-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildMultiCompare(dataArr, players) {
  const careers = dataArr.map(rows => computeCareer(rows));
  const hasBowling = careers.some(c => c.mBowled > 0);
  const n = players.length;

  function bestIdx(vals, lowerBetter) {
    let best = null, bestVal = null;
    vals.forEach((v, i) => {
      const num = parseFloat(v);
      if (!isFinite(num) || num === 0) return;
      if (bestVal === null || (lowerBetter ? num < bestVal : num > bestVal)) { bestVal = num; best = i; }
    });
    return best;
  }

  function mRow(label, vals, lowerBetter = false, fmt = v => number(v)) {
    const bi = bestIdx(vals, lowerBetter);
    const cells = vals.map((v, i) => {
      const num = parseFloat(v);
      const empty = !isFinite(num) || (num === 0 && lowerBetter);
      const isBest = i === bi && !empty;
      const style = isBest ? `color:${CPOOL_COLORS[i]};` : '';
      return `<td class="mcmp-val${isBest ? ' mcmp-best' : ''}" style="${style}">${empty ? '—' : fmt(v)}</td>`;
    }).join('');
    return `<tr><td class="mcmp-metric">${label}</td>${cells}</tr>`;
  }

  function sHdr(label) {
    return `<tr class="mcmp-section-hdr"><td colspan="${n + 1}">${label}</td></tr>`;
  }

  const pct = v => { const n = parseFloat(v); return (!isFinite(n) || n === 0) ? '—' : n.toFixed(1) + '%'; };
  const d2  = v => { const n = parseFloat(v); return (!isFinite(n) || n === 0) ? '—' : n.toFixed(2); };

  const headerCells = players.map((p, i) =>
    `<th class="mcmp-player-head" style="border-top:3px solid ${CPOOL_COLORS[i]}">
      <strong style="color:${CPOOL_COLORS[i]}">${p.name}</strong>
      <small>${p.team}</small>
    </th>`
  ).join('');

  const batRows = [
    sHdr('Batting'),
    mRow('Matches',         careers.map(c => c.matches)),
    mRow('Innings',         careers.map(c => c.innings)),
    mRow('Runs',            careers.map(c => c.runs)),
    mRow('Not Outs',        careers.map(c => c.notOuts)),
    mRow('Batting Avg',     careers.map(c => c.avg || 0),    false, d2),
    mRow('Strike Rate',     careers.map(c => c.sr || 0),     false, d2),
    mRow('Highest Score',   careers.map(c => c.hs || 0)),
    mRow('30s',             careers.map(c => c.thirties || 0)),
    mRow('50s',             careers.map(c => c.fifties || 0)),
    mRow('100s',            careers.map(c => c.hundreds || 0)),
    mRow('4s',              careers.map(c => c.fours || 0)),
    mRow('6s',              careers.map(c => c.sixes || 0)),
    mRow('Boundary %',      careers.map(c => c.bdryPct || 0), false, pct),
  ].join('');

  const bowlRows = hasBowling ? [
    sHdr('Bowling'),
    mRow('Matches Bowled',  careers.map(c => c.mBowled || 0)),
    mRow('Wickets',         careers.map(c => c.wickets || 0)),
    mRow('Economy',         careers.map(c => c.econ || 0),    true,  d2),
    mRow('Bowling Avg',     careers.map(c => c.bowlAvg || 0), true,  d2),
    mRow('Maidens',         careers.map(c => c.maidens || 0)),
    mRow('Dot Ball %',      careers.map(c => c.dotPct || 0),  false, pct),
  ].join('') : '';

  const chartHtml = `
    <div class="mcmp-charts">
      <div class="mcmp-chart-box">
        <p class="cmp-chart-lbl">Performance radar — normalized (100 = best in group)</p>
        <canvas id="mcmp-radar"></canvas>
      </div>
      <div class="mcmp-chart-box">
        <p class="cmp-chart-lbl">Batting comparison</p>
        <canvas id="mcmp-bat"></canvas>
      </div>
      ${hasBowling ? `<div class="mcmp-chart-box"><p class="cmp-chart-lbl">Bowling comparison</p><canvas id="mcmp-bowl"></canvas></div>` : ''}
    </div>`;

  const playerChips = players.map((p, i) =>
    `<div class="mcmp-pchip" style="border-top:3px solid ${CPOOL_COLORS[i]}">
      <strong style="color:${CPOOL_COLORS[i]}">${p.name}</strong>
      <small>${p.team}</small>
    </div>`
  ).join('');

  $('#cpool-results-title').textContent = `Comparing ${n} player${n !== 1 ? 's' : ''}`;
  $('#cpool-results-inner').innerHTML = `
    <div class="mcmp-player-chips">${playerChips}</div>
    <div class="mcmp-layout">
      <div class="mcmp-tbl-wrap">
        <table class="mcmp-table">
          <thead><tr><th class="mcmp-metric-head">Metric</th>${headerCells}</tr></thead>
          <tbody>${batRows}${bowlRows}</tbody>
        </table>
      </div>
      ${chartHtml}
    </div>`;

  renderMcmpCharts(careers, players, hasBowling);
}

function renderMcmpCharts(careers, players, hasBowling) {
  const mono = "'DM Mono', monospace";

  function normAxis(vals) {
    const mx = Math.max(...vals.map(v => v || 0));
    return mx === 0 ? vals.map(() => 0) : vals.map(v => Math.round((v || 0) / mx * 100));
  }

  // Build radar: one array per player, one value per axis
  const axes = [
    { label: 'Avg',           get: c => c.avg || 0 },
    { label: 'Strike Rate',   get: c => c.sr || 0 },
    { label: 'Runs/Match',    get: c => c.matches ? c.runs / c.matches : 0 },
    { label: 'Mile/10 Inns',  get: c => c.innings ? (c.fifties + c.hundreds) / c.innings * 10 : 0 },
    { label: 'Boundary %',    get: c => c.bdryPct || 0 },
  ];
  if (hasBowling) {
    const maxEco = Math.max(...careers.map(c => c.econ || 0)) || 1;
    axes.push(
      { label: 'Wkts/Match',  get: c => c.mBowled ? c.wickets / c.mBowled * 10 : 0 },
      { label: 'Dot Ball %',  get: c => c.dotPct || 0 },
      { label: 'Economy inv', get: c => maxEco - (c.econ || maxEco), inv: true },
    );
  }

  const radarDatasets = players.map((p, i) => ({
    label: p.name.split(' ')[0],
    data: axes.map((ax, ai) => {
      const colVals = careers.map(c => ax.get(c));
      return normAxis(colVals)[i];
    }),
    borderColor: CPOOL_COLORS[i],
    backgroundColor: CPOOL_COLORS[i] + '22',
    pointBackgroundColor: CPOOL_COLORS[i],
    pointRadius: 3,
  }));

  mcmpCharts.push(new Chart(document.getElementById('mcmp-radar'), {
    type: 'radar',
    data: { labels: axes.map(a => a.label), datasets: radarDatasets },
    options: {
      responsive: true, maintainAspectRatio: true, aspectRatio: 1.4,
      scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: '#dce4df' }, pointLabels: { font: { size: 9, family: mono }, color: C.muted } } },
      plugins: {
        legend: { labels: { font: { size: 10, family: mono }, color: C.muted, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}` }, titleFont: { size: 10, family: mono }, bodyFont: { size: 10, family: mono } },
      },
    },
  }));

  // Batting grouped bar
  const batLabels = ['Avg', 'SR', 'Bdry%', '50s/10I', '100s/10I'];
  mcmpCharts.push(new Chart(document.getElementById('mcmp-bat'), {
    type: 'bar',
    data: {
      labels: batLabels,
      datasets: players.map((p, i) => {
        const c = careers[i];
        const inns = c.innings || 1;
        return {
          label: p.name.split(' ')[0],
          backgroundColor: CPOOL_COLORS[i] + 'bb',
          borderColor: CPOOL_COLORS[i],
          borderWidth: 1,
          data: [+(c.avg || 0).toFixed(2), +(c.sr || 0).toFixed(2), +(c.bdryPct || 0).toFixed(1), +(c.fifties / inns * 10).toFixed(2), +(c.hundreds / inns * 10).toFixed(2)],
        };
      }),
    },
    options: {
      responsive: true, maintainAspectRatio: true, aspectRatio: 1.6,
      plugins: { legend: { labels: { font: { size: 10, family: mono }, color: C.muted, boxWidth: 10 } }, tooltip: { titleFont: { size: 10, family: mono }, bodyFont: { size: 10, family: mono } } },
      scales: { x: { ticks: { font: { size: 9, family: mono }, color: C.muted }, grid: { color: '#e8ede9' } }, y: { beginAtZero: true, ticks: { font: { size: 9, family: mono }, color: C.muted }, grid: { color: '#e8ede9' } } },
    },
  }));

  if (hasBowling) {
    mcmpCharts.push(new Chart(document.getElementById('mcmp-bowl'), {
      type: 'bar',
      data: {
        labels: ['Economy', 'Bowl Avg', 'Wkts/Match', 'Dot %'],
        datasets: players.map((p, i) => {
          const c = careers[i];
          const mb = c.mBowled || 1;
          return {
            label: p.name.split(' ')[0],
            backgroundColor: CPOOL_COLORS[i] + 'bb',
            borderColor: CPOOL_COLORS[i],
            borderWidth: 1,
            data: [+(c.econ || 0).toFixed(2), +(c.bowlAvg || 0).toFixed(2), +(c.wickets / mb).toFixed(2), +(c.dotPct || 0).toFixed(1)],
          };
        }),
      },
      options: {
        responsive: true, maintainAspectRatio: true, aspectRatio: 1.6,
        plugins: { legend: { labels: { font: { size: 10, family: mono }, color: C.muted, boxWidth: 10 } }, tooltip: { titleFont: { size: 10, family: mono }, bodyFont: { size: 10, family: mono } } },
        scales: { x: { ticks: { font: { size: 9, family: mono }, color: C.muted }, grid: { color: '#e8ede9' } }, y: { beginAtZero: true, ticks: { font: { size: 9, family: mono }, color: C.muted }, grid: { color: '#e8ede9' } } },
      },
    }));
  }
}

// ── Player analytics dashboard ────────────────────────────────────────────────

const charts = { instances: [], rendered: new Set() };

function destroyCharts() {
  charts.instances.forEach(c => c.destroy());
  charts.instances = [];
  charts.rendered.clear();
}

function mkChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const instance = new Chart(canvas, config);
  charts.instances.push(instance);
}

function shortLabel(row) {
  const name = row.tournament_name || 'Unknown';
  return name.length > 20 ? name.slice(0, 18) + '…' : name;
}

const C = {
  lime: '#d8f36a', green: '#0e4b3b', orange: '#f09a58',
  teal: '#2d9e91', sky: '#90c8e0', muted: '#718078', red: '#df755f',
};

// Build chart options without shallow-merging nested objects.
// Pass flags via `flags` to avoid replacing scales/plugins wholesale.
function baseOpts(flags = {}) {
  const mono = "'DM Mono', monospace";
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: flags.aspectRatio ?? 2,
    plugins: {
      legend: {
        display: flags.hideLegend ? false : true,
        labels: { font: { size: 10, family: mono }, color: C.muted, boxWidth: 10 },
      },
      tooltip: { titleFont: { size: 10, family: mono }, bodyFont: { size: 10, family: mono } },
    },
    scales: {
      x: {
        stacked: flags.stacked ?? false,
        ticks: {
          font: { size: 9, family: mono }, color: C.muted, maxRotation: 45,
          callback(val) {
            const lbl = this.getLabelForValue(val);
            return lbl.length > 14 ? lbl.slice(0, 12) + '…' : lbl;
          },
        },
        grid: { color: '#e8ede9' },
      },
      y: {
        stacked: flags.stacked ?? false,
        beginAtZero: true,
        ...(flags.yMax !== undefined ? { max: flags.yMax } : {}),
        ticks: { font: { size: 9, family: mono }, color: C.muted },
        grid: { color: '#e8ede9' },
      },
    },
  };
}

function renderBattingCharts(rows, labels) {
  if (charts.rendered.has('batting')) return;

  mkChart('chart-runs', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Runs', data: rows.map(r => r.runs || 0), backgroundColor: C.lime, borderColor: C.green, borderWidth: 1 }],
    },
    options: baseOpts({ hideLegend: true }),
  });

  mkChart('chart-sr-avg', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Strike Rate',
          data: rows.map(r => { const v = parseFloat(r.strike_rate); return isNaN(v) ? null : v; }),
          borderColor: C.lime, backgroundColor: C.lime + '30', fill: false, tension: 0.3, spanGaps: true,
          pointBackgroundColor: C.lime, pointRadius: 4,
        },
        {
          label: 'Batting Avg',
          data: rows.map(r => { const v = parseFloat(r.batting_average); return isNaN(v) ? null : v; }),
          borderColor: C.orange, backgroundColor: 'transparent', fill: false, tension: 0.3, spanGaps: true,
          pointBackgroundColor: C.orange, pointRadius: 4,
        },
      ],
    },
    options: baseOpts(),
  });

  mkChart('chart-milestones', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '30s', data: rows.map(r => r.thirties || 0), backgroundColor: C.sky },
        { label: '50s', data: rows.map(r => r.fifties || 0), backgroundColor: C.teal },
        { label: '100s', data: rows.map(r => r.hundreds || 0), backgroundColor: C.lime },
      ],
    },
    options: baseOpts({ stacked: true }),
  });

  mkChart('chart-boundaries', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '4s', data: rows.map(r => r.fours || 0), backgroundColor: C.teal },
        { label: '6s', data: rows.map(r => r.sixes || 0), backgroundColor: C.lime },
      ],
    },
    options: baseOpts(),
  });

  charts.rendered.add('batting');
}

function renderBowlingCharts(rows, labels) {
  if (charts.rendered.has('bowling')) return;

  const br = rows.filter(r => (r.matches_bowled || 0) > 0);
  const bl = br.map((_, i) => labels[rows.indexOf(br[i])] || shortLabel(br[i]));

  mkChart('chart-wickets', {
    type: 'bar',
    data: {
      labels: bl,
      datasets: [{ label: 'Wickets', data: br.map(r => r.wickets_taken || 0), backgroundColor: C.lime, borderColor: C.green, borderWidth: 1 }],
    },
    options: baseOpts({ hideLegend: true, aspectRatio: 1.6 }),
  });

  mkChart('chart-econ-avg', {
    type: 'line',
    data: {
      labels: bl,
      datasets: [
        {
          label: 'Economy',
          data: br.map(r => { const v = parseFloat(r.economy_rate); return isNaN(v) ? null : v; }),
          borderColor: C.lime, fill: false, tension: 0.3, spanGaps: true,
          pointBackgroundColor: C.lime, pointRadius: 4,
        },
        {
          label: 'Bowl Avg',
          data: br.map(r => { const v = parseFloat(r.bowling_average); return isNaN(v) ? null : v; }),
          borderColor: C.orange, fill: false, tension: 0.3, spanGaps: true,
          pointBackgroundColor: C.orange, pointRadius: 4,
        },
      ],
    },
    options: baseOpts({ aspectRatio: 1.6 }),
  });

  mkChart('chart-dots', {
    type: 'bar',
    data: {
      labels: bl,
      datasets: [{
        label: 'Dot %',
        data: br.map(r => { const v = parseFloat(r.dot_ball_percent); return isNaN(v) ? null : v; }),
        backgroundColor: C.sky, borderColor: C.green, borderWidth: 1,
      }],
    },
    options: baseOpts({ hideLegend: true, yMax: 100, aspectRatio: 1.6 }),
  });

  charts.rendered.add('bowling');
}

async function openPlayer(playerId) {
  destroyCharts();
  setLoading('Loading player analytics…');

  let rows;
  try {
    rows = await api(`/api/players/${encodeURIComponent(playerId)}`);
    setLoading('Ready');
  } catch (err) {
    setLoading(`Unable to load: ${err.message}`);
    return;
  }
  if (!rows.length) return;

  const first = rows[0];

  // Career aggregates — computed from actual data only
  const career = {
    matches:  rows.reduce((s, r) => s + (r.matches || 0), 0),
    innings:  rows.reduce((s, r) => s + (r.innings || 0), 0),
    runs:     rows.reduce((s, r) => s + (r.runs || 0), 0),
    balls:    rows.reduce((s, r) => s + (r.balls || 0), 0),
    notOuts:  rows.reduce((s, r) => s + (r.not_outs || 0), 0),
    fifties:  rows.reduce((s, r) => s + (r.fifties || 0), 0),
    hundreds: rows.reduce((s, r) => s + (r.hundreds || 0), 0),
    thirties: rows.reduce((s, r) => s + (r.thirties || 0), 0),
    fours:    rows.reduce((s, r) => s + (r.fours || 0), 0),
    sixes:    rows.reduce((s, r) => s + (r.sixes || 0), 0),
    wickets:  rows.reduce((s, r) => s + (r.wickets_taken || 0), 0),
    runsConc: rows.reduce((s, r) => s + (r.total_runs_conceded || 0), 0),
    legalBalls: rows.reduce((s, r) => s + (r.legal_balls || 0), 0),
    mBowled:  rows.reduce((s, r) => s + (r.matches_bowled || 0), 0),
    maidens:  rows.reduce((s, r) => s + (r.maidens || 0), 0),
    wides:    rows.reduce((s, r) => s + (r.wides || 0), 0),
    noBalls:  rows.reduce((s, r) => s + (r.no_balls || 0), 0),
  };

  const outs = career.innings - career.notOuts;
  const careerAvg  = outs > 0 ? (career.runs / outs).toFixed(2) : '—';
  const careerSR   = career.balls > 0 ? ((career.runs / career.balls) * 100).toFixed(2) : '—';
  const careerEcon = career.legalBalls > 0 ? ((career.runsConc / career.legalBalls) * 6).toFixed(2) : '—';
  const careerBAvg = career.wickets > 0 ? (career.runsConc / career.wickets).toFixed(2) : '—';

  const hasBowled = career.mBowled > 0;
  const isHighConf = career.matches >= 3 && career.innings >= 3 && career.runs >= 100;

  const labels = rows.map(r => `${r.season_year} · ${shortLabel(r)}`);

  $('#dialog-player-name').textContent = first.player_name || 'Player detail';

  const bowlKpis = hasBowled
    ? `<div class="c-kpi"><small>Wickets</small><strong>${career.wickets}</strong></div>
       <div class="c-kpi"><small>Economy</small><strong>${careerEcon}</strong></div>`
    : `<div class="c-kpi"><small>4s</small><strong>${career.fours}</strong></div>
       <div class="c-kpi"><small>6s</small><strong>${career.sixes}</strong></div>`;

  const bowlingTabBtn = hasBowled ? '<button class="p-tab" data-tab="bowling">Bowling</button>' : '';

  const bowlingPanel = hasBowled ? `
    <div id="tab-bowling" class="p-panel">
      <div class="chart-grid bowling-grid">
        <div class="chart-box"><p class="chart-lbl">Wickets by Tournament</p><canvas id="chart-wickets"></canvas></div>
        <div class="chart-box"><p class="chart-lbl">Economy &amp; Bowling Average Trend</p><canvas id="chart-econ-avg"></canvas></div>
        <div class="chart-box"><p class="chart-lbl">Dot Ball Efficiency (%)</p><canvas id="chart-dots"></canvas></div>
      </div>
      <table class="stats-table" style="margin-top:16px">
        <thead>
          <tr>
            <th>Tournament</th>
            <th>M</th><th>Overs</th><th>Wickets</th><th>Runs Conceded</th>
            <th>Economy</th><th>Avg</th><th>Maidens</th><th>Wides</th><th>No Balls</th><th>Dot %</th>
          </tr>
        </thead>
        <tbody>
          ${rows.filter(r => (r.matches_bowled || 0) > 0).map(r => `
            <tr>
              <td class="td-name">
                ${r.season_year} &middot; ${r.tournament_name || 'Unknown'}
                <span class="td-sub">${r.team_name || '—'}</span>
              </td>
              <td>${r.matches_bowled || 0}</td>
              <td>${r.legal_balls > 0 ? (r.legal_balls / 6).toFixed(1) : '—'}</td>
              <td>${r.wickets_taken || 0}</td>
              <td>${r.total_runs_conceded || 0}</td>
              <td>${fmt2(r.economy_rate)}</td>
              <td>${fmt2(r.bowling_average)}</td>
              <td>${r.maidens || 0}</td>
              <td>${r.wides || 0}</td>
              <td>${r.no_balls || 0}</td>
              <td>${r.dot_ball_percent != null ? fmt1(r.dot_ball_percent) + '%' : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  $('#player-detail').innerHTML = `
    ${!isHighConf ? `<div class="conf-warn">&#9888; Limited sample — interpret with caution. High confidence requires 3+ matches, 3+ innings, 100+ runs.</div>` : ''}
    <div class="p-meta">${[first.batting_type, first.bowling_type].filter(Boolean).join('&nbsp;·&nbsp;') || 'Specialisation not recorded'}</div>

    <div class="c-kpis">
      <div class="c-kpi"><small>Matches</small><strong>${career.matches}</strong></div>
      <div class="c-kpi"><small>Innings</small><strong>${career.innings}</strong></div>
      <div class="c-kpi"><small>Runs</small><strong>${number(career.runs)}</strong></div>
      <div class="c-kpi"><small>Avg</small><strong>${careerAvg}</strong></div>
      <div class="c-kpi"><small>Strike Rate</small><strong>${careerSR}</strong></div>
      <div class="c-kpi"><small>50s / 100s</small><strong>${career.fifties}&thinsp;/&thinsp;${career.hundreds}</strong></div>
      ${bowlKpis}
    </div>

    <div class="p-tabs">
      <button class="p-tab active" data-tab="summary">Summary</button>
      <button class="p-tab" data-tab="batting">Batting</button>
      ${bowlingTabBtn}
    </div>

    <div id="tab-summary" class="p-panel active">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Tournament</th>
            <th>M</th><th>Inns</th><th>Runs</th><th>SR</th><th>Avg</th><th>HS</th><th>50s</th><th>100s</th><th>4s</th><th>6s</th>
            ${hasBowled ? '<th>Wkts</th><th>Economy</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="td-name">
                ${r.season_year} &middot; ${r.tournament_name || 'Unknown'}
                <span class="td-sub">${r.team_name || '—'}</span>
              </td>
              <td>${r.matches || 0}</td>
              <td>${r.innings || 0}</td>
              <td>${number(r.runs)}</td>
              <td>${fmt1(r.strike_rate)}</td>
              <td>${fmt1(r.batting_average)}</td>
              <td>${r.highest_score || '—'}</td>
              <td>${r.fifties || 0}</td>
              <td>${r.hundreds || 0}</td>
              <td>${r.fours || 0}</td>
              <td>${r.sixes || 0}</td>
              ${hasBowled ? `<td>${r.wickets_taken || 0}</td><td>${fmt2(r.economy_rate)}</td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div id="tab-batting" class="p-panel">
      <div class="chart-grid">
        <div class="chart-box"><p class="chart-lbl">Runs Scored by Tournament</p><canvas id="chart-runs"></canvas></div>
        <div class="chart-box"><p class="chart-lbl">Strike Rate &amp; Batting Average Trend</p><canvas id="chart-sr-avg"></canvas></div>
        <div class="chart-box"><p class="chart-lbl">Batting Milestones &mdash; 30s / 50s / 100s</p><canvas id="chart-milestones"></canvas></div>
        <div class="chart-box"><p class="chart-lbl">Boundary Scoring &mdash; 4s &amp; 6s</p><canvas id="chart-boundaries"></canvas></div>
      </div>
    </div>

    ${bowlingPanel}
  `;

  // Tab switching
  $$('#player-detail .p-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#player-detail .p-tab').forEach(t => t.classList.remove('active'));
      $$('#player-detail .p-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
      if (tab.dataset.tab === 'batting') renderBattingCharts(rows, labels);
      if (tab.dataset.tab === 'bowling') renderBowlingCharts(rows, labels);
    });
  });

  $('#player-dialog').showModal();
}

// ── Initialisation ────────────────────────────────────────────────────────────

async function init() {
  const roles = await api('/api/roles');
  $('#role-filter').innerHTML = roles.map(role => `<option value="${role.id}">${role.label}</option>`).join('');
  $('#role-filter').value = state.role;
  const session = await api('/api/session');
  applyRoleCapabilities(session.user);
  const options = await api('/api/options');
  options.years.forEach(item => $('#year-filter').insertAdjacentHTML('beforeend', `<option value="${item.year}">${item.year}</option>`));
  options.tournaments.forEach(item => $('#tournament-filter').insertAdjacentHTML('beforeend', `<option value="${item.id}">${item.name}</option>`));
  await loadOverview();
}

// Single delegated listener — handles all player row and compare-button clicks
document.getElementById('players-table').addEventListener('click', e => {
  const btn = e.target.closest('.cmp-btn');
  if (btn) {
    e.stopPropagation();
    const row = playerMap.get(btn.dataset.cmp);
    if (row) toggleCompare(String(row.player_id), row.player_name || 'Unknown', row.team_name || '—');
    return;
  }
  const tr = e.target.closest('tr[data-player]');
  if (tr) openPlayer(tr.dataset.player);
});

$$('.nav-item').forEach(item => item.addEventListener('click', () => showSection(item.dataset.section)));
$$('[data-jump]').forEach(item => item.addEventListener('click', () => showSection(item.dataset.jump)));
$('#apply-filter').addEventListener('click', async () => {
  state.year = $('#year-filter').value;
  state.tournament = $('#tournament-filter').value;
  state.search = $('#search-filter').value.trim();
  state.loaded.clear();
  await loadOverview();
  const active = $('.nav-item.active').dataset.section;
  if (active === 'players') await loadPlayers();
  if (active === 'teams') await loadTeams();
  if (active === 'quality') await loadQuality();
});
$('#search-filter').addEventListener('keydown', event => { if (event.key === 'Enter') $('#apply-filter').click(); });
$('#role-filter').addEventListener('change', async event => {
  state.role = event.target.value;
  localStorage.setItem('hca-dev-role', state.role);
  const session = await api('/api/session');
  applyRoleCapabilities(session.user);
  state.loaded.clear();
  await loadOverview();
});
$('#player-dialog .dialog-close').addEventListener('click', () => {
  destroyCharts();
  $('#player-dialog').close();
});
$('#compare-close').addEventListener('click', () => {
  destroyCmpCharts();
  $('#compare-dialog').close();
});
$('#btn-cmp-go').addEventListener('click', () => openCompare());
$('#btn-cmp-clear').addEventListener('click', () => {
  compare.selected = [];
  syncCompareBtns();
  renderCompareBanner();
});

// ── Compare pool event listeners ──────────────────────────────────────────────
document.getElementById('cpool-table').addEventListener('click', e => {
  const btn = e.target.closest('.cmp-btn[data-cpool-cmp]');
  if (btn && !btn.disabled) { e.stopPropagation(); cpoolToggle(btn.dataset.cpoolCmp); }
});

$('#cpool-apply').addEventListener('click', () => loadComparePool());
$('#cpool-search').addEventListener('keydown', e => { if (e.key === 'Enter') loadComparePool(); });
$('#cpool-reset').addEventListener('click', () => {
  $$('#cpool-years .cpool-pill-on').forEach(p => p.classList.remove('cpool-pill-on'));
  $('#cpool-tournament').value = 'all';
  $('#cpool-team').value = 'all';
  $('#cpool-role').value = 'all';
  $('#cpool-bat-hand').value = 'all';
  $('#cpool-bowl-type').value = '';
  $('#cpool-min-matches').value = '1';
  $('#cpool-min-runs').value = '0';
  $('#cpool-search').value = '';
  loadComparePool();
});
$('#cpool-run-cmp').addEventListener('click', () => runComparison());
$('#cpool-clear-sel').addEventListener('click', () => {
  cpoolState.selected = [];
  syncCpoolBtns();
  renderCpoolSelBar();
  destroyMcmpCharts();
  $('#cpool-results').hidden = true;
});
$('#cpool-results-close').addEventListener('click', () => {
  destroyMcmpCharts();
  $('#cpool-results').hidden = true;
});

init().catch(error => { document.body.innerHTML = `<main style="padding:40px;font-family:system-ui"><h1>Analytics unavailable</h1><p>${error.message}</p></main>`; });
