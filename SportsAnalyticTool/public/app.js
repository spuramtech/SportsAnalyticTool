const state = { year: 'all', tournament: 'all', search: '', role: localStorage.getItem('hca-dev-role') || 'analyst' };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const number = value => value === null || value === undefined ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

async function api(endpoint) {
  const response = await fetch(endpoint, { headers: { 'X-Dev-Role': state.role } });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function query() {
  const params = new URLSearchParams({ year: state.year, tournament: state.tournament });
  if (state.search) params.set('search', state.search);
  return params.toString();
}

function showSection(section) {
  $$('.content-section').forEach(item => item.classList.toggle('active-section', item.id === `${section}-section`));
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.section === section));
  const titles = { overview: 'Performance overview', players: 'Player pool', teams: 'Team performance', quality: 'Data quality' };
  $('#page-title').textContent = titles[section];
  if (section === 'players') loadPlayers();
  if (section === 'teams') loadTeams();
  if (section === 'quality') loadQuality();
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
  $('#players-table').innerHTML = rows.map(row => `<tr data-player="${row.player_id}"><td><div class="player-name">${row.player_name || 'Unknown'}</div><div class="sub-cell">${row.player_id || 'No ID'}</div></td><td>${row.team_name || '—'}</td><td>${number(row.matches)}</td><td>${number(row.runs)}</td><td>${number(row.strike_rate)}</td><td>${number(row.wickets)}</td><td>${number(row.economy)}</td><td><span class="pill ${row.confidence === 'Limited' ? 'limited' : ''}">${row.confidence}</span></td></tr>`).join('') || '<tr><td colspan="8">No records found.</td></tr>';
  $$('#players-table tr[data-player]').forEach(row => row.addEventListener('click', () => openPlayer(row.dataset.player)));
}

function renderTeamsTable(rows) {
  $('#teams-table').innerHTML = rows.map(row => `<tr><td class="player-name">${row.team_name || 'Unknown'}</td><td>${number(row.matches)}</td><td>${number(row.wins)}</td><td>${number(row.losses)}</td><td>${number(row.win_rate)}%</td><td>${number(row.points)}</td><td>${number(row.run_ratio)}</td></tr>`).join('') || '<tr><td colspan="7">No records found.</td></tr>';
}

async function loadOverview() {
  const requests = [api(`/api/summary?${query()}`)];
  if (state.user?.permissions.includes('read:players')) requests.push(api(`/api/players?${query()}`));
  if (state.user?.permissions.includes('read:teams')) requests.push(api(`/api/teams?${query()}`));
  const results = await Promise.all(requests);
  renderKpis(results[0]);
  const players = state.user?.permissions.includes('read:players') ? results[1] : [];
  const teams = state.user?.permissions.includes('read:teams') ? results[state.user?.permissions.includes('read:players') ? 2 : 1] : [];
  renderBatting(players); renderTeams(teams);
}

async function loadPlayers() { renderPlayers(await api(`/api/players?${query()}`)); }
async function loadTeams() { renderTeamsTable(await api(`/api/teams?${query()}`)); }
async function loadQuality() {
  const quality = await api('/api/quality');
  $('#quality-checks').innerHTML = quality.checks.map(item => `<div class="quality-card"><div class="label">${item.name}</div><div class="value">${number(item.value)}</div><div class="kpi-foot">${item.status === 'pass' ? 'Validated' : 'Review required'}</div></div>`).join('');
  $('#failures-table').innerHTML = quality.failed.map(item => `<tr><td>${item.source_url}</td><td class="error-cell">${item.error || 'Unavailable'}</td></tr>`).join('') || '<tr><td colspan="2">No failed feeds.</td></tr>';
}

function applyRoleCapabilities(user) {
  state.user = user;
  const permissionToSection = { 'read:players': 'players', 'read:teams': 'teams', 'read:quality': 'quality' };
  $$('.nav-item').forEach(item => {
    const permission = Object.entries(permissionToSection).find(([, section]) => section === item.dataset.section)?.[0];
    item.hidden = Boolean(permission && !user.permissions.includes(permission));
  });
  $('#last-updated').textContent = `${user.label} · authentication disabled · local RBAC simulation`;
}

async function openPlayer(playerId) {
  const rows = await api(`/api/players/${encodeURIComponent(playerId)}`);
  if (!rows.length) return;
  $('#dialog-player-name').textContent = rows[0].player_name || 'Player detail';
  $('#player-detail').innerHTML = `<div class="detail-grid"><div class="detail-card"><small>Records</small><strong>${rows.length}</strong></div><div class="detail-card"><small>Teams</small><strong>${new Set(rows.map(row => row.team_name)).size}</strong></div><div class="detail-card"><small>Runs</small><strong>${number(rows.reduce((sum, row) => sum + (row.runs || 0), 0))}</strong></div><div class="detail-card"><small>Wickets</small><strong>${number(rows.reduce((sum, row) => sum + (row.wickets || 0), 0))}</strong></div></div>${rows.map(row => `<div class="detail-row"><strong>${row.season_year} · ${row.tournament_name}</strong><span>${number(row.runs)} runs · ${number(row.wickets_taken)} wickets</span></div>`).join('')}`;
  $('#player-dialog').showModal();
}

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

$$('.nav-item').forEach(item => item.addEventListener('click', () => showSection(item.dataset.section)));
$$('[data-jump]').forEach(item => item.addEventListener('click', () => showSection(item.dataset.jump)));
$('#apply-filter').addEventListener('click', async () => { state.year = $('#year-filter').value; state.tournament = $('#tournament-filter').value; state.search = $('#search-filter').value.trim(); await loadOverview(); const active = $('.nav-item.active').dataset.section; if (active === 'players') await loadPlayers(); if (active === 'teams') await loadTeams(); });
$('#search-filter').addEventListener('keydown', event => { if (event.key === 'Enter') $('#apply-filter').click(); });
$('#role-filter').addEventListener('change', async event => { state.role = event.target.value; localStorage.setItem('hca-dev-role', state.role); const session = await api('/api/session'); applyRoleCapabilities(session.user); await loadOverview(); });
$('.dialog-close').addEventListener('click', () => $('#player-dialog').close());
init().catch(error => { document.body.innerHTML = `<main style="padding:40px;font-family:system-ui"><h1>Analytics unavailable</h1><p>${error.message}</p></main>`; });
