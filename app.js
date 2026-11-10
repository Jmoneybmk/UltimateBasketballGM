const app = document.querySelector('#app');
const teams = new Map(league.teams.map(team => [team.code, team]));
const playersById = playerTools.registry;
const realPlayersById = new Map(playersById);
let uiYear = 0;
const simDate = (day, year = uiYear) => seasonSim.date(day, year);
const seasonLabel = (year = uiYear) => `${Number(league.snapshot.slice(0, 4)) + year}–${String(Number(league.snapshot.slice(0, 4)) + year + 1).slice(-2)}`;
const gameStage = game => game.playoffRound === -1 ? 'Play-In Tournament' : postseason.rounds[game.playoffRound];
const overtimeLabel = game => game.overtime ? ` · ${game.overtime === 1 ? '' : game.overtime}OT` : '';
const groups = {
  Scoring: ['Inside', 'Close', 'Mid', '3PT', 'FT'],
  Playmaking: ['Pass Acc', 'Handles'],
  Defense: ['Interior Defense', 'Perimeter Defense', 'Steal', 'Block'],
  Rebounding: ['Offensive Rebound', 'Defensive Rebound', 'Box Out'],
  Physical: ['Speed', 'Agility', 'Strength', 'Durability'],
  Mental: ['Offensive IQ', 'Defensive IQ', 'Offensive Consistency', 'Defensive Consistency', 'Marketability'],
};
const e = value => String(value ?? '—').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const age = dob => dob ? Number(league.snapshot.slice(0, 4)) - Number(dob.slice(0, 4))
  - Number(league.snapshot.slice(5) < dob.slice(5)) : null;
const teamLink = team => `<a href="#team/${e(team.code)}">${e(team.name)}</a>`;
const logo = team => `<img class="logo" src="${e(team.logo)}" alt="" loading="lazy">`;
let renderedRoute;
const routeScroll = new Map();
const rosterFilters = new Map();
const statsColumns = ['GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG%', '3P%', 'FT%'];
const formatStat = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—';
const jerseyInput = (value = '', required = false) => `<input name="jersey" type="text" inputmode="numeric"
  pattern="(?:00|0|[1-9][0-9]?)" maxlength="2" placeholder="00–99" value="${e(value)}" ${required ? 'required' : ''}>`;
const overallText = value => `${formatStat(value, 2)} OVR`;
const statCells = stats => statsColumns.map(key => {
  const value = key === 'FG%' ? stats?.[key] ?? seasonSim.percentage(stats?.FGM, stats?.FGA) : stats?.[key];
  return `<td>${formatStat(value, key === 'GP' ? 0 : 1)}</td>`;
}).join('');
const emptySeason = { GP: 0 };

function currentSeason(year) {
  try {
    const current = seasonSim.load();
    const save = year === undefined || Number(year) === current?.year
      ? current : current?.pastSeasons.find(entry => entry.year === Number(year));
    return save ? { ...seasonSim.history(save), save } : null;
  } catch {
    return null;
  }
}

function directory() {
  const season = currentSeason();
  app.innerHTML = `<section class="hero">
    <div class="eyebrow">LEAGUE OFFICE · ${seasonLabel()}</div>
    <h1>NBA league directory</h1>
    <p>Explore every franchise, scout the roster, and open individual player profiles.</p>
    <div class="metrics"><span><b>${teams.size}</b> Franchises</span><span><b>${league.players.length}</b> Players</span><span><b>23</b> Attributes</span></div>
  </section>
  ${['East', 'West'].map(conference => {
    const clubs = league.teams.filter(team => team.conference === conference);
    const divisions = [...new Set(clubs.map(team => team.division))].sort();
    return `<section><h2>${conference === 'East' ? 'Eastern' : 'Western'} Conference</h2>
      <div class="division-grid">${divisions.map(division => `<article class="panel">
        <h3>${e(division)}</h3>
        ${clubs.filter(team => team.division === division).map(team => `<a class="team-row" href="#team/${e(team.code)}">
          ${logo(team)}<strong>${e(team.name)}</strong><span>${season
            ? `${season.records[team.code].wins}–${season.records[team.code].losses}` : e(liveNBA.current()?.records[team.code] ? liveNBA.current().records[team.code].wins + '–' + liveNBA.current().records[team.code].losses : team.record)}
            · ${overallText(season ? season.teamOveralls.get(team.code) : seasonSim.baseTeamOverall(team.code))}</span>
        </a>`).join('')}</article>`).join('')}</div></section>`;
  }).join('')}
  <p class="note">Roster snapshot · ${e(league.snapshot)} · <a href="https://www.espn.com/nba/teams">ESPN</a></p>
  <p class="note">Season statistics · <a href="https://www.boxscorelab.com/downloads/">BoxScore Lab</a> · November 5, 2026 build · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>`;
}

function standings(season) {
  const rows = new Map(league.teams.map(team => {
    const real = !season && liveNBA.current()?.records[team.code];
    const [wins, losses] = real ? [real.wins, real.losses] : (team.record ?? '0-0').split('-').map(Number);
    return [team.code, { team, wins: season ? season.records[team.code].wins : wins,
      losses: season ? season.records[team.code].losses : losses,
      home: [0, 0], away: [0, 0], division: [0, 0], conference: [0, 0], results: [], for: 0, against: 0,
      overall: season ? season.teamOveralls.get(team.code) : seasonSim.baseTeamOverall(team.code) }];
  }));
  for (const game of season?.results ?? []) {
    if (game.playoffRound != null) continue;
    for (const [code, rival, venue, scored, allowed] of [
      [game.home, game.away, 'home', game.homeScore, game.awayScore],
      [game.away, game.home, 'away', game.awayScore, game.homeScore],
    ]) {
      const row = rows.get(code);
      const opponent = teams.get(rival);
      const result = scored > allowed ? 0 : 1;
      row[venue][result]++;
      if (row.team.division === opponent.division) row.division[result]++;
      if (row.team.conference === opponent.conference) row.conference[result]++;
      row.results.push(result);
      row.for += scored;
      row.against += allowed;
    }
  }
  const pct = (w, l) => w + l ? w / (w + l) : null;
  const record = ([w, l]) => w + l ? `${w}–${l}` : '—';
  const best = (a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.wins - a.wins || a.team.name.localeCompare(b.team.name);
  const conferenceRanks = {};
  for (const row of rows.values()) {
    const count = row.results.length;
    row.pct = pct(row.wins, row.losses);
    row.lastTen = [row.results.slice(-10).filter(result => result === 0).length, row.results.slice(-10).filter(result => result === 1).length];
    const streak = row.results.at(-1);
    const breakAt = row.results.findLastIndex(result => result !== streak);
    row.streak = count ? (streak ? -1 : 1) * (count - breakAt - 1) : null;
    row.points = count ? row.for / count : null;
    row.allowed = count ? row.against / count : null;
    row.margin = count ? (row.for - row.against) / count : null;
  }
  for (const conference of ['East', 'West']) {
    const ranked = season?.bracket?.order?.[conference] ?? [...rows.values()].filter(row => row.team.conference === conference)
      .sort(best).map(row => row.team.code);
    ranked.forEach((code, index) => { conferenceRanks[code] = index + 1; });
  }
  const sorts = { pct: 'Best record', wins: 'Wins', losses: 'Losses', overall: 'Roster overall', home: 'Home win percentage',
    away: 'Away win percentage', division: 'Division win percentage', conference: 'Conference win percentage',
    lastTen: 'Last 10 win percentage', streak: 'Current streak', points: 'Points scored per game',
    allowed: 'Points allowed per game', margin: 'Point differential per game', name: 'Team name' };
  const select = (id, label, options) => `<label>${label}<select id="standings-${id}">${options.map(([value, text]) =>
    `<option value="${e(value)}">${e(text)}</option>`).join('')}</select></label>`;
  operationsPage('Standings', `${seasonLabel()} regular season · compare the league, conferences, and divisions.`,
    `<section class="panel standings-panel"><div class="toolbar">
      ${select('group', 'Group by', [['conference', 'Conference'], ['division', 'Division'], ['league', 'Entire league']])}
      ${select('conference', 'Conference', [['', 'Both conferences'], ['East', 'East'], ['West', 'West']])}
      ${select('division', 'Division', [['', 'All divisions'], ...[...new Set(league.teams.map(team => team.division))].sort().map(value => [value, value])])}
      ${select('zone', 'Postseason position', [['', 'All teams'], ['direct', 'Top six'], ['playin', 'Play-in positions (7–10)'], ['outside', 'Outside top ten']])}
      ${select('record', 'Record', [['', 'All records'], ['winning', 'Above .500'], ['even', '.500'], ['losing', 'Below .500']])}
      ${select('sort', 'Sort by', Object.entries(sorts))}
      ${select('direction', 'Order', [['default', 'Best first'], ['reverse', 'Reverse']])}
      <label>Team name <input id="standings-search" type="search" placeholder="Search teams"></label>
      </div></section><div id="standings-results"></div>
      ${season ? '' : '<p class="note">The roster snapshot provides wins and losses. Detailed splits appear after you simulate games.</p>'}`);
  const ids = ['group', 'conference', 'division', 'zone', 'record', 'sort', 'direction', 'search'];
  const controls = Object.fromEntries(ids.map(id => [id, document.querySelector('#standings-' + id)]));
  const zoneOf = rank => rank <= 6 ? 'direct' : rank <= 10 ? 'playin' : 'outside';
  function update() {
    const filters = Object.fromEntries(ids.map(id => [id, controls[id].value]));
    const selected = [...rows.values()].filter(row => {
      const name = row.team.name.toLowerCase();
      const recordClass = row.pct === null ? '' : row.pct > 0.5 ? 'winning' : row.pct < 0.5 ? 'losing' : 'even';
      return (!filters.conference || row.team.conference === filters.conference)
        && (!filters.division || row.team.division === filters.division)
        && (!filters.zone || zoneOf(conferenceRanks[row.team.code]) === filters.zone)
        && (!filters.record || recordClass === filters.record)
        && (name.includes(filters.search.toLowerCase().trim()) || row.team.code.toLowerCase() === filters.search.toLowerCase().trim());
    });
    const groupKey = row => filters.group === 'league' ? 'NBA' : row.team[filters.group];
    const groupNames = [...new Set(selected.map(groupKey))].sort();
    const key = filters.sort;
    const score = row => Array.isArray(row[key]) ? pct(...row[key]) : row[key];
    const compare = (a, b) => {
      if (key === 'name') return a.team.name.localeCompare(b.team.name);
      const x = score(a), y = score(b);
      if (x == null || y == null) return Number(x == null) - Number(y == null) || best(a, b);
      if (key === 'pct' && x === y && a.team.conference === b.team.conference) {
        return conferenceRanks[a.team.code] - conferenceRanks[b.team.code];
      }
      return (key === 'allowed' || key === 'losses' ? x - y : y - x) || best(a, b);
    };
    document.querySelector('#standings-results').innerHTML = groupNames.map(name => {
      const leader = [...rows.values()].filter(row => groupKey(row) === name).sort(best)[0];
      const group = selected.filter(row => groupKey(row) === name).sort((a, b) => filters.direction === 'reverse' ? compare(b, a) : compare(a, b));
      const columns = ['Conf. rank', 'Team', 'W', 'L', 'PCT', 'GB', 'HOME', 'AWAY', 'DIV', 'CONF', 'PPG', 'OPP PPG', 'DIFF', 'L10', 'STRK', 'OVR'];
      return `<section><h2>${e(name)}</h2><div class="panel table-wrap"><table><thead><tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr></thead>
        <tbody>${group.map(row => {
          const behind = (leader.wins - row.wins + row.losses - leader.losses) / 2;
          return `<tr><td>${conferenceRanks[row.team.code]}</td><td>${teamLink(row.team)}</td>
            <td>${row.wins}</td><td>${row.losses}</td><td>${formatStat(row.pct, 3)}</td><td>${behind || '—'}</td>
            <td>${record(row.home)}</td><td>${record(row.away)}</td><td>${record(row.division)}</td><td>${record(row.conference)}</td>
            <td>${formatStat(row.points)}</td><td>${formatStat(row.allowed)}</td><td>${formatStat(row.margin)}</td><td>${record(row.lastTen)}</td>
            <td>${row.streak == null ? '—' : (row.streak > 0 ? 'W' : 'L') + Math.abs(row.streak)}</td><td>${formatStat(row.overall, 2)}</td></tr>`;
        }).join('')}</tbody></table></div></section>`;
    }).join('') || '<p class="note">No teams match those filters.</p>';
  }
  for (const control of Object.values(controls)) control.addEventListener(control === controls.search ? 'input' : 'change', update);
  update();
}

function roster(team, picker) {
  const season = currentSeason();
  const columns = season ? [...new Set([...statsColumns, ...seasonSim.boxFields])] : statsColumns;
  const contracts = picker?.contracts;
  let priorSeason;
  let showingPrior = Boolean(season && picker);
  const statsFor = player => {
    if (!season) return player.stats;
    if (!showingPrior) return season.averages.get(player.id) ?? emptySeason;
    const archive = season.save.pastSeasons?.at(-1);
    if (!archive) return previousNbaSeasonStats(player);
    priorSeason ??= seasonSim.history(archive).averages;
    return priorSeason.get(player.id);
  };
  const overall = player => season ? season.playerOveralls.get(player.id) : seasonSim.baseOverall(player);
  const players = team ? season?.rosters.get(team.code) ?? league.players.filter(player => player.team === team.code) : season ? [...season.profiles.values()].filter(player => !season.unavailable.has(player.id)) : league.players;
  const playerTeam = player => season ? season.owners.get(player.id) : player.team;
  app.innerHTML = `<a class="back" href="#${picker?.back ?? 'league'}">← ${picker ? 'Cancel selection' : 'League directory'}</a>
    <section class="hero roster-hero">
      ${team ? logo(team) : ''}
      <div><div class="eyebrow">${team ? e(team.conference + ' · ' + team.division) : 'LEAGUE SCOUTING'}</div>
      <h1>${team ? e(team.name) : 'Player directory'}</h1>
      <p>${picker ? e(picker.label) + ' · ' : ''}${players.length} players · ${team ? overallText(season ? season.teamOveralls.get(team.code) : seasonSim.baseTeamOverall(team.code)) + ' · ' : ''}
      ${seasonLabel()} roster · ${season ? simDate(season.day) : league.snapshot}</p></div>
    </section>
    <section class="panel roster-table">
      <div class="toolbar"><label>Find a player <input id="search" type="search" placeholder="Search by name"></label>
      <label>Sort by <select id="sort"><option value="OVR">Overall</option><option value="name">Name</option>
      <option value="age">Age</option><option value="position">Position</option><option value="jersey">Jersey number</option>${columns.map(key => `<option value="${key}">${key === 'DNK' ? 'Dunks per game' : key}</option>`).join('')}${contracts ? '<option value="salary">Annual salary</option><option value="years">Years left</option>' : ''}</select></label><label>Order <select id="roster-order"><option value="default">Default</option><option value="asc">Ascending</option><option value="desc">Descending</option></select></label><label>Position <select id="roster-position"><option value="">All positions</option>${[...playerTools.positions, 'G', 'F'].map(position => `<option>${position}</option>`).join('')}</select></label></div>
      <p class="note table-note" id="roster-stats-label">${season ? '' : '2025–26 regular-season averages'}</p>
      ${season ? '<div class="toolbar"><label>Stats <select id="roster-season"><option value="current">Current season</option><option value="prior">Previous season</option></select></label></div>' : ''}
      <div class="table-wrap"><table><thead><tr><th>Player</th>${contracts ? '<th>Contract</th>' : ''}<th>Team</th><th>Pos</th><th>Jersey</th><th>Age</th><th>OVR</th>
        ${contracts ? '<th>Years left</th><th>Annual salary</th>' : ''}${columns.map(key => `<th>${key}</th>`).join('')}${picker && !contracts ? '<th>Choose</th>' : ''}</tr></thead><tbody></tbody></table></div>
    </section>`;
  const search = document.querySelector('#search');
  const sort = document.querySelector('#sort');
  const order = document.querySelector('#roster-order');
  const position = document.querySelector('#roster-position');
  const seasonFilter = document.querySelector('#roster-season');
  const tableWrap = app.querySelector('.roster-table .table-wrap');
  const route = location.hash;
  const filters = rosterFilters.get(route);
  if (filters) {
    search.value = filters.search;
    sort.value = filters.sort;
    order.value = filters.order;
    position.value = filters.position ?? '';
    showingPrior = filters.showingPrior ?? showingPrior;

  }
  if (seasonFilter) seasonFilter.value = showingPrior ? 'prior' : 'current';
  function update() {
    if (season) document.querySelector('#roster-stats-label').textContent = showingPrior
      ? (season.save.pastSeasons?.length ? seasonLabel(season.save.pastSeasons.at(-1).year) + ' franchise averages' : 'Previous NBA regular-season averages')
      : seasonLabel() + ' franchise regular-season averages';
    const key = sort.value;
    rosterFilters.set(route, { showingPrior, search: search.value, sort: key, order: order.value, position: position.value, scrollLeft: tableWrap.scrollLeft });
    const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const query = normalize(search.value.trim());
    const matches = players.filter(player => (!picker?.eligible || picker.eligible(player)) && normalize(player.name).includes(query)
      && (!position.value || playerTools.positionText(player).split(/\s*\/\s*/).includes(position.value)));
    const sortValue = player => {
      if (key === 'age') return age(player.dob) ?? player.listedAge ?? -1;
      if (key === 'jersey') return Number(relationships.jerseyNumber(season ? relationships.jersey(season.save, player.id) : player.jersey) ?? -1);
      if (key === 'OVR') return overall(player);
      if (key === 'salary' || key === 'years') return contracts?.get(player.id)?.deal[key] ?? -1;
      return statsFor(player)?.[key] ?? -1;
    };
    const alphabetical = key === 'name' || key === 'position';
    const direction = order.value === 'default' ? (alphabetical ? 1 : -1) : order.value === 'asc' ? 1 : -1;
    matches.sort((a, b) => {
      const difference = key === 'position' ? playerTools.positionText(a).localeCompare(playerTools.positionText(b))
        : key === 'name' ? a.name.localeCompare(b.name) : sortValue(a) - sortValue(b);
      return direction * difference || a.name.localeCompare(b.name);
    });
    document.querySelector('tbody').innerHTML = matches.map(player => {
      const code = playerTeam(player);
      const deal = contracts?.get(player.id)?.deal;
      const action = picker ? `<td><a class="primary-link" href="#${e(picker.select(player.id))}">${e(picker.actionLabel?.(player.id) ?? 'Select')}</a></td>` : '';
      return `<tr>
      <td><a href="#player/${e(player.id)}${team ? '/' + e(team.code) : ''}">${e(player.name)}</a>${picker?.marker?.(player.id) ?? ''}</td>${contracts ? action : ''}
      <td>${code ? `<a href="#team/${e(code)}">${e(code)}</a>` : 'Free agent'}</td>
      <td>${e(playerTools.positionText(player))}</td><td>${season && code === season.save.team
        ? `<a href="#jersey/${e(player.id)}">${e(relationships.jersey(season.save, player.id) ?? 'Assign')}</a>`
        : e(season ? relationships.jersey(season.save, player.id) : player.jersey)}</td>
      <td>${e(age(player.dob) ?? player.listedAge)}</td><td>${formatStat(overall(player), 2)}</td>
      ${contracts ? `<td>${deal?.years ?? '—'}</td><td>${deal ? money(deal.salary) : '—'}</td>` : ''}${columns.map(stat => `<td>${formatStat(statsFor(player)?.[stat] ?? (stat === 'FG%' ? seasonSim.percentage(statsFor(player)?.FGM, statsFor(player)?.FGA) : null), stat === 'GP' ? 0 : 1)}</td>`).join('')}
      ${contracts ? '' : action}
    </tr>`;
    }).join('') || `<tr><td colspan="${6 + columns.length + (contracts ? 2 : 0) + Number(Boolean(picker))}">No players match your search.</td></tr>`;
  }
  search.addEventListener('input', update);
  sort.addEventListener('change', update);
  order.addEventListener('change', update);
  position.addEventListener('change', update);
  seasonFilter?.addEventListener('change', () => {
    showingPrior = seasonFilter.value === 'prior';
    update();
  });
  tableWrap.addEventListener('scroll', () => { rosterFilters.get(route).scrollLeft = tableWrap.scrollLeft; });
  update();
  tableWrap.scrollLeft = filters?.scrollLeft ?? 0;
}

function profile(player, fromTeam) {
  const franchise = currentSeason();
  const health = franchise?.health.get(player.id);
  const attributes = franchise ? seasonSim.effectiveRatings(franchise.save, franchise.development, player) : player.attributes;
  const connections = franchise ? relationships.network(franchise.save, franchise, player.id) : [];
  const promotion = franchise ? teamFinance.promotionBoost(franchise.save, player.id) : 0;
  const curve = player.progression ?? playerDevelopment.profiles.get(player.id) ?? playerDevelopment.curve(player);
  const games = franchise ? careerGames(franchise.results, player.id).filter(row => row.line) : [];
  const archives = (franchise?.save.pastSeasons ?? []).map(save => ({ ...seasonSim.history(save), save }));
  const tabs = ['Career Stats', 'Split Stats', 'Attributes', 'Contract', 'Award History', 'Game Highs',
    'Recent Games', 'Wear and Tear', 'Social Media', 'Overview & Ambition'];
  const team = teams.get(franchise ? franchise.owners.get(player.id) : player.team);
  const extensionReadiness = franchise && team?.code === franchise.save.team
    ? freeAgency.extensionStatus(franchise.save, franchise, player.id, teamFinance.report(franchise.save, franchise).contracts.get(player.id))
    : null;
  const jersey = franchise ? relationships.jersey(franchise.save, player.id) : player.jersey;
  const overall = franchise ? franchise.playerOveralls.get(player.id) : seasonSim.baseOverall(player);
  const scouting = franchise ? staffSim.effects(franchise.save, franchise.save.team).scouting : null;
  const birthplace = player.birthplace ? [player.birthplace.city, player.birthplace.state, player.birthplace.country].filter(Boolean).join(', ') : null;
  const official = nbaProfileData[player.id];
  const combine = official?.combine;
  const draft = player.draft ?? official?.draft;
  const bio = {
    Position: playerTools.slots(player)[0], Secondary: playerTools.slots(player)[1], Third: playerTools.slots(player)[2], Jersey: jersey,
    Age: (franchise ? playerDevelopment.ageAt(player, simDate(franchise.day)) : age(player.dob)) ?? player.listedAge, Born: player.dob,
    Birthplace: birthplace, Height: player.height, Weight: player.weight, 'Pre-draft program': player.college || official?.school,
    'NBA profile country': official?.country,
    Wingspan: player.wingspan || nbaCombineLength(combine?.wingspan) || 'Unverified',
    'Standing reach': player.standingReach || nbaCombineLength(combine?.standingReach) || 'Unverified',
    Handedness: player.handedness || nbaShootingHand[player.id]?.hand || 'Unverified',
    Draft: draft?.undrafted ? 'Undrafted' : draft ? [draft.year, draft.round && 'Round ' + draft.round,
      draft.pick && 'Pick ' + draft.pick, draft.team ?? (player.id === '1966' ? 'CLE' : null)].filter(Boolean).join(' · ') : undefined,
    Experience: franchise ? seasonSim.serviceYears(franchise.save, player) : player.experience,
    Status: franchise && Object.hasOwn(arenaOps.settings(franchise.save).affiliate, player.id) ? "On G League assignment" : player.status,
    ...(franchise ? { 'Agent': relationships.agent(player.id).name,
      'Relationship with GM': `${relationships.playerScore(franchise.save, franchise, player.id)} / 100` } : {}),
    ...(promotion ? { 'Team advertising boost': `+${promotion} marketability before cap` } : {}),
  };
  app.innerHTML = `<a class="back" href="#${teams.has(fromTeam) ? 'team/' + e(fromTeam) : 'players'}">← Back to players</a>
    <section class="hero roster-hero player-card-header">
      <div class="player-card-portrait">${jersey != null ? `<span aria-hidden="true">${e(jersey)}</span>` : ''}
        ${player.photo ? `<img class="headshot" src="${e(player.photo)}" alt="">` : ''}</div>
      <div><div class="eyebrow">PLAYER PROFILE · ${e(team?.code ?? 'FREE AGENT')}</div><h1>${e(player.name)}</h1>
      <p>${team ? teamLink(team) : 'Free agent'} · ${e(playerTools.positionText(player))}${jersey != null ? ' · #' + e(jersey) : ''}
      </p><p>${[bio.Height, bio.Weight, bio.Age == null ? null : 'Age ' + bio.Age, bio.Draft].filter(Boolean).map(e).join(' · ')}</p>
      ${franchise ? `<div class="franchise-actions"><a href="#relationship-talk/${e(player.id)}">Contact player or agent →</a>
        ${!team && !franchise.unavailable.has(player.id) ? (franchise.save.draftRights?.[player.id]?.team === franchise.save.team
          ? `<a href="#development-division">View draft rights and sign rookie →</a>` : franchise.save.draftRights?.[player.id]
            ? 'Draft rights held by ' + e(franchise.save.draftRights[player.id].team)
            : `<a href="#free-agency/${e(player.id)}">Open free-agent offer →</a>`) : ""}
        ${!franchise.unavailable.has(player.id) ? `<a href="#player-editor/${e(player.id)}">Edit player →</a>` : ""}
        ${team?.code === franchise.save.team ? `<a href="#jersey/${e(player.id)}">Change jersey number →</a>` : ''}</div>` : ''}</div>
      <div class="player-card-overall"><small>OVR</small><strong>${formatStat(overall, 2)}</strong></div>
    </section>
    <div class="player-card-tabs" aria-label="Player card sections">${tabs.map((label, index) =>
      `<button type="button" data-player-tab="${index}" aria-controls="player-section-${index}" aria-pressed="${index === 0}">${e(label)}</button>`).join('')}</div>
    <section id="player-section-0" class="player-card-section">
      ${playerCardCareer(player, franchise, games, archives)}</section>
    <section id="player-section-1" class="player-card-section" hidden>
      ${franchise ? playerCardSplits(games.filter(row => row.segment === 'Regular season'), franchise.save) : '<p>Start a franchise to track splits.</p>'}</section>
    <section id="player-section-2" class="player-card-section" hidden>
    <details class="panel facility-card player-detail" open><summary><strong>${franchise ? "Current attributes" : "Scouting attributes"}</strong></summary><p class="note">${e(player.ratingSeason
      ? 'Simulator estimates seeded from ' + player.ratingSeason + ' performance and player measurements.'
      : 'Provisional estimates from position and measurements.')}</p>
      <div class="division-grid">${Object.entries(groups).map(([group, groupAttributes]) => `<article class="panel">
        <h3>${group}</h3>${groupAttributes.map(attribute => {
          const value = attributes[attribute];
          const change = value - player.attributes[attribute];
          const delta = Math.abs(change) >= 0.005 ? `<small class="attribute-change">${change > 0 ? '+' : ''}${change.toFixed(2)}</small>` : '';
          return `<div class="attribute"><span>${attribute} ${delta}</span><meter min="0" max="100" value="${value}" aria-label="${attribute}"></meter><strong>${value.toFixed(2)}</strong></div>`;
        }).join('')}</article>`).join('')}</div>
    </details></section>
    <section id="player-section-3" class="player-card-section" hidden>${playerCardContract(player, franchise)}</section>
    <section id="player-section-4" class="player-card-section" hidden>${nbaHonorsSummary(nbaPlayerHonors(player.id))}
      ${franchise ? franchiseHonorsSummary([...archives, franchise].map(state => ({
        year: state.save.year, honors: careerHonors(state, player.id),
      }))) : ''}
      <p><a href="#career/${e(player.id)}">Full résumé and franchise honors →</a></p></section>
    <section id="player-section-5" class="player-card-section" hidden><div id="player-card-highs">${playerCardHighs(player, franchise, games, archives)}</div>
      ${nbaHistoricalGameLogYears[player.id]?.length ? '<button type="button" id="load-player-highs">Include older NBA game logs</button><p role="status" id="player-highs-status"></p>' : ''}</section>
    <section id="player-section-6" class="player-card-section" hidden>${playerCardRecent(player, franchise, games)}</section>
    <section id="player-section-7" class="player-card-section" hidden>
    ${health ? `<dl class="panel bio"><div><dt>Availability</dt><dd>${e(seasonSim.tier(health.durability))}</dd></div><div><dt>Fatigue remaining</dt><dd><meter min="0" max="100" value="${health.fatigue}"></meter> ${health.fatigue}%</dd></div><div><dt>Durability</dt><dd>${health.durability}%</dd></div>${health.injury ? `<div><dt>${e(health.injury.name)}</dt><dd>${e(injuryDetails(health, franchise.day, franchise.save.year))}</dd></div>` : ""}</dl>` : '<p>Franchise health tracking starts with a save.</p>'}
    ${health ? playerCardInjuryMap(health) : ''}${playerCardInjuries(player, franchise, archives)}</section>
    <section id="player-section-8" class="player-card-section" hidden></section>
    <section id="player-section-9" class="player-card-section" hidden>
    ${franchise ? `<h2>Overview & ambition</h2><dl class="panel bio">
      <div><dt>Relationship with your GM</dt><dd>${relationships.playerScore(franchise.save, franchise, player.id)}/100</dd></div>
      <div><dt>Market salary baseline</dt><dd>${money(freeAgency.askingSalary(player))}</dd></div>
      <div><dt>Offer priorities</dt><dd>Guaranteed pay, team contention, and familiarity</dd></div>
      ${extensionReadiness ? `<div><dt>Contract extension</dt><dd><a href="#contracts/${e(player.id)}">${e(extensionReadiness)}</a></dd></div>` : ''}
    </dl><p><a href="#contact/${e(player.id)}">Ask about contract and team preferences →</a></p>` : ''}
    <p class="franchise-actions"><a class="primary-link" href="#career/${e(player.id)}">Career résumé →</a>
    <a href="#nba-games/${e(player.id)}">Real NBA game log →</a>
    ${official ? `<a href="${e(official.source)}">Official NBA profile →</a>` : ''}
    ${combine ? '<a href="https://www.nba.com/stats/draft/combine-anthro">NBA combine measurements →</a>' : ''}
    ${franchise && !franchise.unavailable.has(player.id) && !franchise.save.draftRights?.[player.id] && (!team || team.code === franchise.save.team)
      ? '<a href="#player-support/' + e(player.id) + '">Player services and endorsements →</a>' : ''}</p>
    <details class="panel facility-card player-detail"><summary><strong>Biography and measurements</strong></summary><dl class="bio">${Object.entries(bio).filter(([, value]) => value != null && value !== "").map(([label, value]) =>
      `<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>
      <p class="note">${[official?.source && ['NBA player profile', official.source],
        combine && ['NBA combine measurements', combine.source ?? 'https://combine.nba.com/insights'],
        player.biographySource && ['Birthplace and shooting hand source', player.biographySource],
        !player.handedness && nbaShootingHand[player.id] && ['Shooting hand source', nbaShootingHand[player.id].source]]
        .filter(Boolean).map(([label, url]) => `<a href="${e(url)}">${e(label)}</a>`).join(' · ')}</p></details>
    ${connections.length ? `<details class="panel facility-card player-detail"><summary><strong>Relationships and organizations</strong></summary>
      <p><a href="#network/Player:${e(player.id)}">Explore this player's connections →</a></p>${relationshipNetwork(connections)}</details>` : ""}
    ${scouting == null ? '' : `<section><h2>Staff scouting report</h2><div class="panel facility-card">
      <p>Scout evaluation ${scouting} / 100</p><p>Top skills · ${Object.entries(attributes).sort((a,b) => b[1] - a[1])
        .slice(0, scouting >= 83 ? 5 : scouting >= 72 ? 3 : 1).map(([skill, value]) => `${e(skill)} ${value.toFixed(2)}`).join(' · ')}</p>
    </div></section>`}
    ${franchise ? `<section><h2>Development curve</h2><dl class="panel bio">
      <div><dt>Peak ages</dt><dd>${curve.peakStart}–${curve.peakEnd}</dd></div>
      <div><dt>Yearly gain during peak</dt><dd>+${curve.gain.toFixed(2)}</dd></div>
      <div><dt>Yearly decline after peak</dt><dd>−${curve.loss.toFixed(2)}</dd></div>
    </dl></section>` : ''}</section>
`;
  const buttons = [...app.querySelectorAll('[data-player-tab]')];
  for (const button of buttons) button.addEventListener('click', () => {
    const social = document.getElementById('player-section-8');
    if (button.getAttribute('aria-controls') === social.id && !social.hasChildNodes()) {
      social.innerHTML = playerCardSocial(player, franchise);
    }
    for (const tab of buttons) {
      const active = tab === button;
      tab.setAttribute('aria-pressed', String(active));
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    }
  });
  const loadHighs = app.querySelector('#load-player-highs');
  loadHighs?.addEventListener('click', async () => {
    const status = app.querySelector('#player-highs-status');
    const table = app.querySelector('#player-card-highs');
    loadHighs.disabled = true;
    status.textContent = 'Opening NBA season archives…';
    const years = nbaHistoricalGameLogYears[player.id];
    const results = await Promise.allSettled(years.map(loadNbaHistoricalGames));
    if (!table.isConnected) return;
    const loaded = results.filter(result => result.status === 'fulfilled');
    const coverage = `NBA highs use available game rows from ${loaded.length} of ${years.length} older season archives plus recent logs. Some seasons have incomplete game coverage.`;
    table.innerHTML = playerCardHighs(player, franchise, games, archives, loaded.flatMap(result => result.value[player.id] ?? []), coverage);
    status.textContent = loaded.length === years.length ? 'NBA archives loaded.' : 'Some NBA archives could not open. You can retry.';
    loadHighs.disabled = loaded.length === years.length;
  });
}

function resultOutcome(game, team) {
  const winner = game.homeScore > game.awayScore ? game.home : game.away;
  if (team !== game.home && team !== game.away) return { winner, label: '', style: '' };
  return { winner, label: winner === team ? 'W' : 'L', style: winner === team ? 'outcome-win' : 'outcome-loss' };
}

function gameLink(game, year = uiYear, team) {
  const result = resultOutcome(game, team);
  const score = (code, points) => `<span class="${code === result.winner ? 'score-winner' : 'score-loser'}">${e(code)} ${points}</span>`;
  return `<a class="game-result" href="#game/${e(game.id)}/${year}">
    <span>${result.label ? `<b class="result-badge ${result.style}" aria-label="${result.label === 'W' ? 'Win' : 'Loss'}">${result.label}</b>` : ''}
    ${simDate(game.day, year)} · ${score(game.away, game.awayScore)} at ${score(game.home, game.homeScore)}${game.forfeit ? ' · Forfeit' : ''}
    ${gameStage(game) ? ' · ' + gameStage(game) : ''}${overtimeLabel(game)}</span>
    <span>Box score →</span></a>`;
}

function scores(season) {
  const games = season?.results ?? [];
  const year = season?.save.year ?? uiYear;
  const days = [...new Set(games.map(game => game.day))].reverse();
  app.innerHTML = `<a class="back" href="#franchise">← Franchise</a>
    <section class="hero"><div class="eyebrow">FRANCHISE · ${seasonLabel(year)}</div>
    <h1>League scores</h1><p>Browse every completed game by date.</p></section>
    <section class="panel scores-panel">${days.length ? `<div class="toolbar"><label>Game date
      <select id="score-date">${days.map(day => `<option value="${day}">${simDate(day, year)}</option>`).join('')}</select>
      </label></div><div id="score-list"></div>` : '<p class="franchise-note">Simulate a game day from Franchise to see results.</p>'}</section>`;
  const date = document.querySelector('#score-date');
  if (!date) return;
  const update = () => {
    document.querySelector('#score-list').innerHTML = games.filter(game => game.day === Number(date.value)).map(game => gameLink(game, year)).join('');
  };
  date.addEventListener('change', update);
  update();
}

function gameBox(game, year, season) {
  const gate = season && teamFinance.report(season.save, season, game.home).attendance.find(entry => entry.day === game.day);
  const columns = ['MIN', 'PTS', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%', 'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', 'DNK'];
  const cells = line => {
    const values = {
      ...line,
      FG: `${line.FGM}-${line.FGA}`, 'FG%': formatStat(seasonSim.percentage(line.FGM, line.FGA)),
      '3PT': `${line['3PM']}-${line['3PA']}`, '3P%': formatStat(seasonSim.percentage(line['3PM'], line['3PA'])),
      FT: `${line.FTM}-${line.FTA}`, 'FT%': formatStat(seasonSim.percentage(line.FTM, line.FTA)),
      REB: line.OREB + line.DREB,
    };
    return columns.map(key => `<td>${e(values[key])}</td>`).join('');
  };
  const box = (code, lines, rosterIds) => {
    const club = teams.get(code);
    const active = new Set(lines.map(line => line.id));
    const totals = Object.fromEntries(seasonSim.boxFields.map(key => [key, lines.reduce((sum, line) => sum + (line[key] ?? 0), 0)]));
    const playerLink = id => `<a href="#player/${e(id)}/${e(code)}">${e(state.profiles.get(id)?.name ?? id)}</a>`;
    return `<section><h2>${teamLink(club)}</h2><div class="panel table-wrap"><table>
      <thead><tr><th>Player</th>${columns.map(key => `<th>${key}</th>`).join('')}</tr></thead>
      <tbody>${lines.map(line => `<tr><td>${playerLink(line.id)}</td>${cells(line)}</tr>`).join('')}
      ${rosterIds.filter(id => !active.has(id)).map(id => playersById.get(id)).map(player =>
        `<tr><td>${playerLink(player.id)}</td><td class="dnp" colspan="${columns.length}">Did not play</td></tr>`).join('')}</tbody>
      <tfoot><tr><th>Team totals</th>${cells(totals)}</tr></tfoot></table></div></section>`;
  };
  app.innerHTML = `<div class="game-box-screen"><div class="box-navigation"><a class="back" href="#franchise">← Franchise</a>
    <a class="back" href="#scores/${year}">League scores</a></div>
    <section class="hero"><div class="eyebrow">FINAL · ${simDate(game.day, year)}
    ${gameStage(game) ? ' · ' + gameStage(game) : ''}${overtimeLabel(game)}</div>
    <h1>${e(game.away)} ${game.awayScore} · ${e(game.home)} ${game.homeScore}</h1>
    <p>${teamLink(teams.get(game.away))} at ${teamLink(teams.get(game.home))}</p>
    ${gate ? `<p>Attendance ${gate.fans.toLocaleString()} · ${gate.parking.toLocaleString()} vehicles · ${gate.vip.toLocaleString()} VIP guests</p>` : ''}</section>
    ${game.quarters ? `<section><h2>Score by period</h2><div class="panel table-wrap"><table><thead><tr><th>Team</th>
      ${game.quarters.map((_, index) => `<th>${index < 4 ? 'Q' + (index + 1) : 'OT' + (index - 3)}</th>`).join('')}</tr></thead>
      <tbody><tr><td>${e(game.away)}</td>${game.quarters.map(([away]) => `<td>${away}</td>`).join('')}</tr>
      <tr><td>${e(game.home)}</td>${game.quarters.map(([, home]) => `<td>${home}</td>`).join('')}</tr></tbody></table></div></section>` : ''}
    ${game.forfeit ? '<p class="note">Forfeit. At least one team could not field an eligible rotation. No player stats were recorded.</p>'
      : box(game.away, game.awayBox, game.awayRoster) + box(game.home, game.homeBox, game.homeRoster)}</div>`;
}

const staffDepartments = [
  { name: 'Coaching', route: 'coaching', roles: [
    ['Head Coach', 'Owns the rotation, minutes, and game plan.'],
    ['Assistant Head Coach', 'Helps prepare rotations and adjust the lineup for availability.'],
    ['Offensive Coach', 'Develops the offensive system and prepares matchup plans.'],
    ['Defensive Coach', 'Develops coverages, assignments, and defensive matchup plans.'],
  ] },
  { name: 'Player Development', route: 'training', roles: [
    ['Head of Player Development', 'Sets individual development goals and oversees training plans.'],
    ['Assistant Player Development Coach', 'Runs individual drills and tracks player progress.'],
  ] },
  { name: 'Scouting', route: 'development-division', roles: [
    ['Head Scout', 'Sets scouting priorities and reviews reports on players and prospects.'],
    ['Assistant Head Scout', 'Evaluates players and compiles scouting reports.'],
  ] },
  { name: 'Medical', route: 'clinic', roles: [
    ['Head Medical Staff', 'Oversees injury evaluation, recovery plans, and return-to-play decisions.'],
    ['Assistant Head Medical Staff', 'Tracks daily recovery, runs rehab sessions, and flags setbacks.'],
  ] },
  { name: 'Front Office', roles: [
    ['CFO', 'Oversees the team bank balance, payroll, facility expenses, and game-day revenue.'],
    ['Assistant GM', 'Supports roster planning, contract preparation, and negotiations.'],
  ] },
];

const arenaFacilities = [
  { id: 'arena', name: 'Arena', activity: 'Set ticket prices, increase seating capacity, and schedule fan nights.' },
  { id: 'parking', name: 'Parking Lot', activity: 'Parking for fans attending home games.' },
  { id: 'merch', name: 'Merch Stalls', activity: 'Team merchandise sales on home game days.' },
  { id: 'food', name: 'Food Stalls', activity: 'Food and beverage service on home game days.' },
  { id: 'vip', name: 'VIP', activity: 'Premium seating and hospitality on home game days.' },
];

function operationsPage(title, description, content, back = 'franchise') {
  app.innerHTML = `<a class="back" href="#${back}">← ${back === 'facilities' ? 'Facilities' : 'Franchise'}</a>
    <section class="hero"><div class="eyebrow">FRANCHISE OPERATIONS</div><h1>${e(title)}</h1><p>${e(description)}</p></section>
    ${content}`;
}

function staff(code) {
  let save;
  try { save = seasonSim.load(); } catch {}
  if (!teams.has(code)) {
    try { code = seasonSim.load()?.team; } catch { /* League coaching listings are still available. */ }
  }
  code = teams.has(code) ? code : league.teams[0].code;
  const roles = staffSim.roles;
  const assignments = staffSim.assignments(save, code, roles);
  const effects = staffSim.effects(save, code);
  const collaboration = staffSim.collaboration(save, code);
  operationsPage('Staff', 'The franchise org chart. Position listings describe each role’s responsibilities.',
    `${save?.team === code ? '<p><a class="primary-link" href="#cfo-budget">Meet with the CFO</a></p>' : ''}<section class="staff-directory"><h2>Franchise positions</h2>
      ${staffDepartments.map(({ name, route, roles: slots }) => `<section class="staff-department">
        <h3>${e(name)}${route ? ` <a href="#${route}">Open department →</a>` : ''}</h3>
        ${castTable(['Position', 'Staff member', 'Skill', 'Evaluation', 'Communication', 'Annual salary', 'GM trust', 'Action'],
          slots.map(([title, duty]) => {
            const person = assignments[title];
            const index = roles.indexOf(title);
            return [
              `<strong>${e(title)}</strong><br><small>${e(duty)}</small>`,
              `<a href="#staff-career/${e(code)}/${index}">${e(person.name)}</a>`,
              person.skill, person.evaluation, person.communication, money(staffSim.salary(person, title)) + (person.contract ? " / yr · " + Math.max(0, person.contract.startYear + person.contract.years - (save.year ?? 0)) + " yrs left" : ""),
              save?.team === code ? collaboration.trust[person.id] + '/100' : '—',
              save?.team === code ? `<a class="primary-link" href="#staff-assign/${index}">Assign or hire</a> <a href="#staff-workspace/${index}">Meet</a> ${title === "CFO" ? '<a href="#cfo-budget">Set allocations</a>' : title === "Assistant GM" ? '<a href="#contracts">Extensions</a> · <a href="#free-agency">Signings</a>' : route ? `<a href="#${route}">Open workspace</a>` : ""}` : '—',
            ];
          }))}</section>`).join('')}</section>
      <section><h2>Staff collaboration</h2><dl class="panel bio">
        ${["coaching", "development", "scouting", "medical"].map(key => `<div><dt>${key[0].toUpperCase() + key.slice(1)}</dt><dd>${collaboration[key]} / 100</dd></div>`).join("")}</dl>
        <p class="note">Time working together, communication, and GM trust influence department performance. Changing a staff pairing resets that department’s shared tenure bonus.</p></section>
      <section><h2>Staff effects</h2><dl class="panel bio"><div><dt>Offense / defense</dt>
      <dd>${effects.attack.toFixed(2)} / ${effects.defense.toFixed(2)}</dd></div>
      <div><dt>Training gain bonus</dt><dd>+${effects.trainingGain.toFixed(2)} per drill</dd></div>
      <div><dt>Training fatigue reduction</dt><dd>${effects.trainingRecovery} per drill</dd></div>
      <div><dt>Medical recovery bonus</dt><dd>+${effects.recovery} durability on recovery days</dd></div>
      <div><dt>Scouting evaluation</dt><dd>${effects.scouting} / 100</dd></div></dl></section>
      <p><a class="back" href="#relationships">Talk to staff or reporters →</a> · <a href="#staff-honors">NBA coach and executive honors →</a></p>
      <p class="note">Game assignments, fictional staff, ratings, and salaries are simulated. Staff payroll is paid during the season.</p>`);

}

function staffWorkspace(save, index) {
  const role = staffSim.roles[Number(index)];
  if (!role) return staff(save.team);
  if (role === 'CFO') return cfoBudgetScreen(save);
  const person = staffSim.assignments(save, save.team, staffSim.roles)[role];
  const department = staffDepartments.find(entry => entry.roles.some(([name]) => name === role));
  const actions = {
    'Head Coach': 'Build a new rotation',
    'Assistant Head Coach': 'Adjust rotation for availability',
    'Offensive Coach': 'Apply offensive scheme',
    'Defensive Coach': 'Apply defensive scheme',
    'Head of Player Development': 'Switch automatic practice on or off',
    'Assistant Player Development Coach': 'Fill open drill assignments',
    'Head Scout': 'Switch automatic prospect scouting on or off',
    'Assistant Head Scout': 'Scout selected prospect',
    'Head Medical Staff': 'Apply medical minute limits',
    'Assistant Head Medical Staff': 'Clear drills for players needing recovery',
    'Assistant GM': 'Delegate selected task',
  };
  const options = {
    'Offensive Coach': Object.entries(seasonSim.castPlays),
    'Defensive Coach': Object.entries(seasonSim.castDefenses),
    'Assistant Head Scout': draftOps.prospects(save).map(item => [item.id, item.name]),
    'Assistant GM': [['rotation', 'Build rotation'], ['free-agent', 'Find and offer a free-agent contract'], ['extension', 'Find and offer an extension'], ['draft', 'Complete the draft'], ['sign-rookie', 'Sign highest unsigned draft pick']],
  }[role];
  operationsPage(role, person.name + ' · Skill ' + person.skill + ' · Evaluation ' + person.evaluation, `
    <section class="panel facility-card">
      <p>${e(department.roles.find(([name]) => name === role)[1])}</p>
      <form id="staff-workspace">
        ${options ? `<label>Assignment <select name="choice">${options.map(([key, label]) => `<option value="${e(key)}">${e(label)}</option>`).join('')}</select></label>` : ''}
        <button>${actions[role]}</button>
      </form>
      <p id="staff-action-result" role="status"></p>
      ${role === 'Assistant GM' ? '<p><a href="#team-intel">Review roster needs</a> · <a href="#draft">Open draft delegation</a> · <a href="#cfo-budget">Review allocations</a></p>' : ''}
      ${department.route ? `<a href="#${department.route}">Open ${e(department.name)}</a>` : ''}
    </section>`, 'staff');
  document.querySelector('#staff-workspace').onsubmit = event => {
    event.preventDefault();
    const choice = new FormData(event.currentTarget).get('choice');
    const feedback = document.querySelector('#staff-action-result');
    if (role === 'Assistant GM' && choice !== 'rotation' && !window.confirm('Authorize your Assistant GM to complete this task? Contract decisions are subject to your CFO allocations.')) return;
    try { feedback.textContent = seasonSim.staffAssignmentAction(seasonSim.load(), role, choice); }
    catch (error) { feedback.textContent = error.message; }
  };
}

function cfoBudgetScreen(save) {
  const usage = teamFinance.budgetUsage(save, seasonSim.history(save));
  const limits = save.cfoBudget?.[save.team] ?? {};
  const label = key => ({ players: 'Annual player salaries', upgrades: 'Facility purchases' })[key] ?? key;
  operationsPage('CFO budget', 'Set annual spending limits in dollars. Leave any allocation blank to rely on the team bank.', `
    <form class="panel facility-card" id="cfo-budget-form">
      ${castTable(['Category', 'Committed', 'Annual limit'], Object.entries(usage).map(([key, total]) => [
        e(label(key)), money(total), `<input aria-label="${e(label(key))}" name="${e(key)}" type="number" min="0" step="1" value="${limits[key] ?? ''}">`,
      ]))}
      <button>Save allocations</button><p id="cfo-feedback" role="status"></p>
    </form>`, 'staff');
  const form = document.querySelector('#cfo-budget-form');
  form.onsubmit = event => {
    event.preventDefault();
    try {
      const limits = Object.fromEntries([...new FormData(form)].filter(([, value]) => value !== '')
        .map(([key, value]) => [key, Number(value)]));
      seasonSim.setCfoBudget(save, limits);
      render();
      document.querySelector('#cfo-feedback').textContent = 'Allocations saved.';
    } catch (error) { document.querySelector('#cfo-feedback').textContent = error.message; }
  };
}

function assignStaffScreen(save, index, candidateId) {
  const roles = staffSim.roles;
  const role = roles[Number(index)];
  if (!role) { staff(save.team); return; }
  const current = staffSim.assignments(save, save.team, roles);
  const candidates = staffSim.pool(save, roles);
  const candidate = candidates.find(person => person.id === candidateId);
  if (candidate) {
    const ask = staffSim.askingSalary(candidate, role);
    operationsPage(candidate.name, role + ' · Staff contract offer', `
      <form class="panel facility-card" id="staff-offer">
        <p>Skill ${candidate.skill} · Evaluation ${candidate.evaluation} · Communication ${candidate.communication}</p>
        <p>Annual asking salary ${money(ask)}</p>
        <label>Annual salary <input name="salary" type="number" min="1" step="1" value="${ask}" required></label>
        <label>Years <input name="years" type="number" min="1" max="5" value="1" required></label>
        <button>Submit staff contract</button><p id="staff-feedback" role="status"></p>
      </form>`, 'staff-assign/' + index);
    document.querySelector('#staff-offer').onsubmit = event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        seasonSim.assignStaff(save, roles, role, candidate.id, { salary: Number(data.get('salary')), years: Number(data.get('years')) });
        location.hash = '#staff';
      } catch (error) { document.querySelector('#staff-feedback').textContent = error.message; }
    };
    return;
  }
  const table = (title, people) => `<section><h2>${title}</h2><div class="panel table-wrap"><table><thead><tr>
    <th>Name</th><th>Skill</th><th>Evaluation</th><th>Communication</th><th>Modeled annual salary</th><th></th></tr></thead><tbody>
    ${people.map(person => `<tr><td>${e(person.name)}</td><td>${person.skill}</td><td>${person.evaluation}</td>
    <td>${person.communication}</td><td>${money(staffSim.salary(person, role))}</td><td>${candidates.includes(person) ? `<a href="#staff-assign/${index}/${e(person.id)}">Offer contract</a>` : `<button type="button" data-staff-id="${e(person.id)}">Assign</button>`}</td></tr>`).join('')}
    </tbody></table></div></section>`;
  operationsPage(role, 'Swap two existing roles or hire a free agent to replace the current staff member.',
    `<a class="back" href="#staff">← Staff</a><p id="staff-feedback" role="status"></p>
    ${table('Current staff', Object.values(current).filter(person => person !== current[role]))}
    ${table('Staff free agents', candidates.sort((a,b) => b.skill - a.skill))}`);
  document.querySelectorAll('[data-staff-id]').forEach(button => button.addEventListener('click', () => {
    try { seasonSim.assignStaff(save, roles, role, button.dataset.staffId); location.hash = '#staff'; }
    catch (error) { document.querySelector('#staff-feedback').textContent = error.message; }
  }));
}

function facilityExpansions(save) {
  const config = arenaOps.settings(save);
  const effects = {
    arena: '+650 seats per tier when demand exceeds capacity', parking: '+300 vehicle spaces per tier', vip: '+20 seats per package per tier and higher demand',
    merch: '+16% unit demand per tier', food: '+8% unit demand per tier', ads: '+$0.75 in advertising per home attendee per tier',
    training: 'Adds half a training level of progression benefits per tier',
    clinic: 'Adds one clinic level of recovery benefits per tier',
    affiliate: '+0.025 to the 30-day development gain per tier, up to +0.30',
  };
  operationsPage('Facility expansions', 'Each expansion increases weekly upkeep. Purchases use your team bank and CFO upgrade allocation.', `
    <p id="expansion-feedback" role="status"></p>
    ${castTable(['Facility', 'Effect', 'Tier', 'Weekly upkeep', 'Next tier'], Object.entries(effects).map(([type, effect]) => {
      const level = arenaOps.expansion(config, type);
      return [e(arenaOps.labels[type]), e(effect), level + ' / 2', money(7 * arenaOps.expansionUpkeep(level)),
        level >= 2 ? 'Fully expanded' : type === 'vip' && !config.vip.level ? 'Unlock VIP first' :
          `<button type="button" data-expansion="${type}">Buy · ${money(arenaOps.expansionPrice(type, level))}</button>
          <small>+${money(7 * (arenaOps.expansionUpkeep(level + 1) - arenaOps.expansionUpkeep(level)))} / week</small>`];
    }))}`, 'facilities');
  document.querySelectorAll('[data-expansion]').forEach(button => button.onclick = () => {
    if (!window.confirm('Purchase this facility expansion and add its ongoing upkeep?')) return;
    try {
      seasonSim.saveFinanceAction(save, { type: 'facility', facility: button.dataset.expansion, command: 'expand' });
      render();
      document.querySelector('#expansion-feedback').textContent = 'Expansion purchased.';
    } catch (error) { document.querySelector('#expansion-feedback').textContent = error.message; }
  });
}

function facilities() {
  const teamFacilities = [
    { id: 'player-support', name: 'Player Services', activity: 'Deliver contract perks, arrange endorsements, and manage family-job requests.' },
    { id: 'ads', name: 'Advertisement Center', activity: 'Run player campaigns and manage commercial partnerships.' },
    { id: 'clinic', name: 'Team Clinic', activity: 'Review injuries, durability, and expected recovery dates.' },
    { id: 'training', name: 'Training Facility', activity: 'Assign individual drills and balance development against fatigue.' },
    { id: 'development-division', name: 'Development Division (Scouting)', activity: 'Review the league’s players, ratings, and performance.' },
  ];
  const cards = (items, prefix = '') => `<div class="division-grid">${items.map(({ id, name, activity }) => `
    <article class="panel"><h3>${e(name)}</h3><div class="facility-card"><p>${e(activity)}</p>
    <a class="back" href="#${prefix}${id}">Open ${e(name)} →</a></div></article>`).join('')}</div>`;
  operationsPage('Facilities', 'Team facilities support the roster. Arena facilities operate on home game days.',
    `<p><a class="primary-link" href="#facility-expansions">Facility expansions and upkeep</a></p><section><h2>Team facilities</h2>${cards(teamFacilities)}</section>
    <section><h2>Arena facilities</h2>${cards(arenaFacilities, 'arena/')}</section>`);
}

function injuryDetails(condition, day, year = uiYear) {
  const diagnosis = condition.injury;
  if (condition.durability === 0) return 'Durability frozen until the playoffs';
  const unlock = diagnosis?.unlockDay ?? condition.outUntil;
  if (unlock != null && unlock > day) return 'Recovery begins ' + simDate(unlock, year);
  return diagnosis ? 'Recovering' : '';
}

function clinic(save) {
  const { health, rosters } = seasonSim.history(save);
  const injured = rosters.get(save.team).filter(player => health.get(player.id).durability <= 50)
    .sort((a, b) => health.get(a.id).durability - health.get(b.id).durability);
  const rows = injured.map(player => {
    const condition = health.get(player.id);
    const availability = condition.durability === 0 ? 'Out through the regular season'
      : condition.durability <= 10 ? 'Unavailable'
        : condition.durability <= 30 ? 'Up to 20 minutes' : 'Can play through soreness';
    return `<tr><td><a href="#player/${e(player.id)}/${e(save.team)}">${e(player.name)}</a></td>
      <td>${e(condition.injury?.name ?? '—')}</td><td>${seasonSim.tier(condition.durability)}</td><td>${condition.durability}%</td>
      <td>${condition.fatigue}%</td><td>${availability}</td>
      <td>${e(injuryDetails(condition, save.day, save.year) || '—')}</td></tr>`;
  });
  operationsPage('Team Clinic', 'Injury report for the current franchise roster.',
    `${clinicUpgrades(save)}<section><h2>Injury report</h2>${rows.length ? `<div class="panel table-wrap"><table>
      <thead><tr><th>Player</th><th>Injury</th><th>Status</th><th>Durability</th><th>Fatigue</th><th>Game availability</th><th>Recovery</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div>` : '<p class="note">No players are currently listed with an injury.</p>'}</section>
    <p><a class="back" href="#coaching">View the full roster and rotation →</a></p>
    <p class="note">Related staff · Head Medical Staff and Assistant Head Medical Staff</p>`, 'facilities');
}

function savedFacility(open) {
  let save;
  try {
    save = seasonSim.load();
  } catch {
    franchise();
    return;
  }
  if (save) open(save);
  else operationsPage('Facilities', 'Start a franchise to see its injury report and home game operations.',
    '<p><a class="back" href="#franchise">Start a franchise →</a></p>', 'facilities');
}

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money = amount => dollars.format(amount);
function nbaContractCard(player) {
  const contract = nbaContracts[player.id];
  if (!contract) return '';
  const source = contract.url ?? 'https://www.basketball-reference.com/contracts/players.html';
  return `<section><h2>NBA contract snapshot</h2><div class="panel table-wrap">
    <table><thead><tr><th>Season</th><th>Published salary</th><th>Option</th></tr></thead><tbody>
    ${contract.years.map(([amount, option], index) => `<tr><td>${seasonLabel(index)}</td>
      <td>${contract.approximate ? '≈ ' : ''}${money(amount)}</td><td>${e(option)}</td></tr>`).join('')}
    </tbody></table>
    <p class="note table-note">${e(contract.code)} · November 6, 2026${contract.twoWay ? ' · Two-way' : ''}
    ${contract.guaranteed == null ? '' : ' · Reported remaining guarantee ' + money(contract.guaranteed)}
    · <a href="${e(source)}">${e(contract.source)}</a></p>
    </div></section>`;
}
const financeLinks = '<div class="box-navigation"><a class="back" href="#finances">Team finances</a><a class="back" href="#contracts">Player contracts</a><a class="back" href="#gm-wallet">GM wallet</a></div>';

function financeSummary(report) {
  return `<dl class="panel bio"><div><dt>Team bank</dt><dd>${money(report.bank)}</dd></div>
    <div><dt>Reserved for team obligations</dt><dd>${money(report.reserved)}</dd></div>
    <div><dt>Available to spend</dt><dd>${money(report.available)}</dd></div></dl>`;
}

function marketPrompt(title) {
  operationsPage(title, 'Finish the offseason market before opening this part of the franchise.',
    '<p><a class="back" href="#free-agency">Open free agency →</a></p>');
}

function contractFields(deal, minimum = 1) {
  const requirement = (label, name, rule) => `<label>${label}<select name="${name}">
    <option value="">Choose a requirement</option>${Object.entries(teamFinance.conditions).map(([key, label]) =>
      `<option value="${key}" ${rule?.kind === key ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></label>
    <label>Target (1 for an award)<input type="number" name="${name}Target" min="0" step="0.01" value="${rule?.target ?? 1}"></label>`;
  const number = (label, name, value, min = 0, max) => `<label>${label}<input type="number" name="${name}" required
    min="${min}" ${max === undefined ? '' : 'max="' + max + '"'} step="1" value="${value}"></label>`;
  return `<fieldset><legend>Salary and guarantees</legend><div class="toolbar">
      ${number('First-year annual salary ($)', 'salary', Math.max(minimum, deal.salary), minimum)}
      ${number('Years', 'years', deal.years, 1, 5)}
      ${number('Annual salary change ($, negative to decrease)', 'raise', deal.raise, -Number.MAX_SAFE_INTEGER)}
      ${number('Guaranteed salary (%)', 'guaranteed', deal.guaranteed, 0, 100)}
      ${number('Upfront share of guarantee (%)', 'upfront', deal.upfront, 0, 100)}
      ${number('Signing bonus ($)', 'bonus', deal.bonus ?? 0)}
      <label>Assign jersey with agreement ${jerseyInput(deal.jersey ?? "")}</label>
      ${requirement('Conditional salary requirement', 'requirement', deal.requirement)}
      </div></fieldset>
      <fieldset><legend>Incentives and contract clauses</legend><div class="toolbar">
      ${number('Performance incentive ($)', 'incentive', deal.incentive)}
      ${requirement('Incentive requirement', 'incentiveRequirement', deal.incentiveRequirement)}
      <label>Final-year option <select name="option">${teamFinance.choices.map(option =>
        `<option ${option === deal.option ? 'selected' : ''}>${e(option)}</option>`).join('')}</select></label>
      ${number('Trade kicker (%)', 'kicker', deal.kicker, 0, 100)}
      <label class="contract-check"><input type="checkbox" name="noTrade" ${deal.noTrade ? 'checked' : ''}> No-trade clause</label>
      </div></fieldset>
      <fieldset><legend>Team-provided perks</legend><div class="toolbar">${Object.entries(teamFinance.perks).map(([perk, cost]) =>
        `<label class="contract-check"><input type="checkbox" name="perk" value="${e(perk)}" ${deal.perks.includes(perk) ? 'checked' : ''}> ${e(perk)} · ${money(cost)}${perk === 'Team Panel Ad' ? ' · requires a team panel in Advertisement Center' : perk === 'Solo Panel Ad' ? ' · requires a solo panel in Advertisement Center' : ''}</label>`).join('')}</div></fieldset>
`;
}

function readContractFields(form) {
    const data = new FormData(form);
    const amount = name => Number(data.get(name));
    const rule = name => ({ kind: data.get(name), target: data.get(name + 'Target') === '' ? NaN : amount(name + 'Target') });
    return { salary: amount('salary'), years: amount('years'), raise: amount('raise'),
      guaranteed: amount('guaranteed'), upfront: amount('upfront'), bonus: amount('bonus'),
      requirement: rule('requirement'), incentive: amount('incentive'), incentiveRequirement: rule('incentiveRequirement'),
      option: data.get('option'), noTrade: data.has('noTrade'), kicker: amount('kicker'), perks: data.getAll('perk'),
      jersey: data.get('jersey') || null };
}

function offerEditor(id, player, deal, round, day, budget, extension = false, requests = [], signingDate = null) {
  const promiseFields = requests.filter(item => ['teammate', 'endorsement', 'familyJob', 'perk'].includes(item.kind))
    .map(item => {
      const included = deal.requests?.find(request => request.kind === item.kind);
      const calendarDeadline = signingDate && item.kind === 'teammate';
      const dateAfter = days => new Date(Date.parse(signingDate) + days * 86400000).toISOString().slice(0, 10);
      return `<div class="toolbar"><label><input type="checkbox" data-offer-request="${e(item.kind)}"
        ${included ? 'checked' : ''}> ${e(item.label)}</label>
        ${calendarDeadline ? `<label>Sign by <input type="date" min="${dateAfter(1)}" max="${dateAfter(30)}"
          value="${dateAfter(included?.days ?? 7)}" data-request-days="${e(item.kind)}" data-signing-date="${signingDate}"></label>` :
        `<label>${extension && item.kind === 'perk' ? 'Days to deliver once extension begins' : 'Days to deliver after signing'} <input type="number" min="1" max="30" value="${included?.days ?? 7}"
          data-request-days="${e(item.kind)}"></label>`}</div>`;
    }).join('');
  return `<form id="${id}" class="panel contract-form negotiation-editor">
    <header class="negotiation-header">${player.photo ? `<img class="headshot" src="${e(player.photo)}" alt="">` : ''}
      <div><div class="eyebrow">${extension ? 'Contract extension' : 'Sign contract'} · Offer ${(round?.attempts ?? 0) + 1} of 3</div>
      <h3>${e(player.name)}</h3><p>${e(playerTools.positionText(player))} · Available team budget ${money(budget)}</p></div></header>
    ${round ? `<p class="note table-note" role="status">${e(round.message)}</p>` : ''}
    <div class="negotiation-layout"><div class="${extension ? 'extension-fields' : ''}">${contractFields(deal, 250000)}${promiseFields ? '<fieldset><legend>Player requests</legend>' + promiseFields + '</fieldset>' : ''}</div>
      <aside class="negotiation-preview"><h3>Annual payment breakdown</h3><div class="table-wrap" data-offer-preview></div></aside></div>
    <div class="toolbar"><button type="submit">${round ? 'Submit revised offer' : 'Submit offer'}</button></div>
  </form>`;
}

function bindOfferEditor(id, day, submit) {
  const form = document.querySelector('#' + id);
  if (!form) return;
  const preview = form.querySelector('[data-offer-preview]');
  const update = () => {
    const deal = readContractFields(form);
    const rows = Array.from({ length: Math.max(0, Math.min(5, deal.years)) }, (_, index) => {
      const annual = { ...deal, salary: deal.salary + deal.raise * index };
      const pay = teamFinance.terms(annual, index ? 0 : day);
      return `<tr><th scope="row">${index + 1}</th><td>${money(pay.salary)}</td><td>${money(pay.upfront)}</td>
        <td>${money(pay.rollover)}</td><td>${money(pay.conditional)}</td></tr>`;
    }).join('');
    preview.innerHTML = `<table><thead><tr><th>Year</th><th>Salary</th><th>Upfront</th><th>Payroll</th><th>Conditional</th></tr></thead>
      <tbody>${rows}</tbody></table><p class="note">Signing bonus ${money(deal.bonus)} · paid once when the deal begins.</p>`;
  };
  update();
  form.addEventListener('input', update);
  form.addEventListener('submit', event => { event.preventDefault(); submit({ ...readContractFields(form), requests: [...form.querySelectorAll('[data-offer-request]:checked')].map(input => {
    const deadline = form.querySelector('[data-request-days="' + input.dataset.offerRequest + '"]');
    const days = deadline.dataset.signingDate
      ? (Date.parse(deadline.value) - Date.parse(deadline.dataset.signingDate)) / 86400000
      : Number(deadline.value);
    return { kind: input.dataset.offerRequest, days };
  }) }); });
}

function offseasonRookieSigning(save) {
  const state = seasonSim.history(save);
  const rights = Object.values(save.draftRights ?? {}).filter(pick => pick.team === save.team);
  operationsPage('Rookie signing', 'Sign your picks or release their draft rights.',
    (rights.length ? castTable(['Player', 'Pick', 'First-year salary', 'Decision'], rights.map(pick => [
      e(state.profiles.get(pick.id)?.name ?? pick.id), pick.number, money(draftOps.deal(pick).salary),
      '<button data-rookie-id="' + e(pick.id) + '">Sign rookie</button> <button data-rookie-id="' + e(pick.id) + '" data-release>Release rights</button>',
    ])) : '<p>No unsigned draft rights.</p>') +
    '<p id="rookie-feedback" role="status"></p><button id="continue-rookies">Continue to moratorium</button>');
  document.querySelectorAll('[data-rookie-id]').forEach(button => button.onclick = () => {
    try {
      if (button.hasAttribute('data-release')) {
        if (!window.confirm('Release this player’s draft rights?')) return;
        seasonSim.releaseDraftRight(save, button.dataset.rookieId);
      } else seasonSim.signDraftRight(save, button.dataset.rookieId);
      render();
    } catch (error) { document.querySelector('#rookie-feedback').textContent = error.message; }
  });
  document.querySelector('#continue-rookies').onclick = () => {
    if (window.confirm('Continue to the three-day moratorium?')) location.hash = '#free-agency';
  };
}

function offseasonOptionResults(save) {
  const state = seasonSim.history(save);
  const table = (save.optionResults ?? []).map(item => [
    e(state.profiles.get(item.id)?.name ?? item.id), e(teams.get(item.team)?.name ?? item.team),
    e(item.option), money(item.salary), item.option === 'Early termination' ? item.retained ? 'Stayed' : 'Terminated' : item.retained ? 'Exercised' : 'Declined',
  ]);
  const meeting = save.leagueMeetings?.findLast(result => result.year === save.year - 1);
  operationsPage('Leaguewide option results', 'Review team and player decisions before free agency.',
    (meeting ? '<p>League meeting · ' + e(offseasonProposalName(meeting.proposal)) + ' · ' + (meeting.passed ? 'Passed' : 'Rejected') + ' · ' + meeting.yes + '–' + meeting.no + '</p>' : '') +
    (table.length ? castTable(['Player', 'Team', 'Option', 'Salary', 'Result'], table) : '<p>No option decisions this offseason.</p>') +
    '<p><button id="continue-option-results">Continue to rookie signing</button></p>');
  document.querySelector('#continue-option-results').onclick = () => {
    if (window.confirm('Continue to rookie signing?')) location.hash = '#rookie-signing';
  };
}

function offseasonMarketRecap(save, day) {
  const market = save.market;
  const state = seasonSim.history(save);
  const moratorium = day?.startsWith('m');
  const rows = (market?.results ?? []).filter(row => !day ? row.team : !moratorium && row.round === Number(day));
  const sheets = Object.entries(market?.sheets ?? {});
  const table = entries => entries.length ? castTable(['Player', 'Team', 'Result', 'First-year salary', 'Years', 'Total salary', 'Option', 'Day'], entries.map(row => [
    e(state.profiles.get(row.id)?.name ?? row.id), e(teams.get(row.team)?.name ?? '—'), e(row.source),
    row.team ? money(row.salary) : '—', row.years ?? '—',
    row.team && row.years ? money(row.salary * row.years + (row.raise ?? 0) * row.years * (row.years - 1) / 2) : '—',
    e(row.option ?? '—'), row.round > 12 ? 'Market close' : row.round,
  ])) : '<p>No finalized results.</p>';
  const offers = Object.entries(market?.offers ?? {});
  operationsPage(!day ? 'Free agency recap' : (moratorium ? 'Moratorium · Day ' + e(day.slice(1)) : 'Free agency · Day ' + e(day)) + ' recap',
    'Review market activity before continuing.',
    (moratorium ? '<h2>Your queued offers</h2>' + (offers.length ? castTable(['Player', 'Salary', 'Years'], offers.map(([id, deal]) =>
      [e(state.profiles.get(id)?.name ?? id), money(deal.salary), deal.years])) : '<p>No queued offers.</p>') + '<h2>Entire league</h2><p>League signings begin after the moratorium.</p>'
      : '<h2>Your team</h2>' + table(rows.filter(row => row.team === save.team || row.pursued)) + '<h2>Entire league</h2>' + table(rows)) +
    (sheets.length ? '<p>' + sheets.length + ' restricted free-agent offer sheets await a decision on the market screen.</p>' : '') +
    '<p><button id="continue-market-recap">Continue</button></p>');
  document.querySelector('#continue-market-recap').onclick = () => {
    if (window.confirm('Continue to the next offseason screen?')) location.hash = day ? '#free-agency' : '#season-handoff';
  };
}

function freeAgentMarket(save, selectedId, mode) {
  const market = save.market ?? { offers: {}, results: [], formerTeams: {} };
  const inSeason = !market.open && !save.handoff && save.day <= seasonSim.lastDay;
  const canOffer = market.open ? !market.timed || market.round <= 12 : inSeason;
  const state = seasonSim.history(save);
  const roster = state.rosters.get(save.team);
  const available = teamFinance.report(save, state).available;
  const pool = [...state.profiles.values()].filter(player => !state.owners.has(player.id) && !state.unavailable.has(player.id) && !save.draftRights?.[player.id])
    .sort((a, b) => state.playerOveralls.get(b.id) - state.playerOveralls.get(a.id) || a.name.localeCompare(b.name));
  const target = pool.find(player => player.id === selectedId);
  const playerLink = id => `<a href="#player/${e(id)}">${e(state.profiles.get(id)?.name ?? id)}</a>`;
  const pending = Object.entries(market.offers);
  const offer = target ? market.offers[target.id] : null;
  const round = target ? freeAgency.talks(save, 'free-agent', target.id) : null;
  const sheets = Object.entries(market.sheets ?? {});
  const outstandingQualifying = Object.keys(market.qualifying ?? {}).some(id => !state.owners.has(id));
  const offerAllowed = canOffer && !sheets.length && (market.open || !market.qualifying?.[target?.id]) && (round?.attempts ?? 0) < 3;
  const quote = target && mode === "commit" ? relationships.commitment(save, state, target) : null;
  const requests = target ? relationships.commitment(save, state, target).requests : [];
  const commitments = target ? [...relationships.read(save).promises.filter(item => item.id === target.id && item.status === 'pending'), ...(quote?.requests ?? [])] : [];
  const promisedUpfront = commitments.find(item => item.kind === 'upfront')?.value;
  const promisedNumber = commitments.find(item => item.kind === 'jersey')?.value;
  const reserved = pending.reduce((total, [, deal]) => total + teamFinance.signingCost(deal, false), 0);
  const results = market.results.filter(result => result.team === save.team ||
    ['Negotiated', 'Declined all offers'].includes(result.source));
  const marketTitle = inSeason ? 'Regular-season free agency' : market.moratoriumDay <= 3
    ? 'Moratorium · Day ' + market.moratoriumDay + ' of 3' : market.timed && market.open && market.round <= 12
      ? 'Free agency · Day ' + market.round + ' of 12' : 'Free agency';
  operationsPage(marketTitle, market.open
    ? 'Negotiate with available players, then close the market to start the season.'
    : inSeason ? 'Browse unsigned players and offer a contract for the remainder of this season.'
      : 'Review available players and how your offers turned out.',
    `<p id="market-feedback" role="status"></p>
    <dl class="panel bio"><div><dt>Roster</dt><dd>${roster.length} / ${freeAgency.maximum}</dd></div>
      <div><dt>Current team overall</dt><dd>${overallText(state.teamOveralls.get(save.team))}</dd></div>
      <div><dt>Available budget before open offers</dt><dd>${money(available)}</dd></div>
      <div><dt>Open offers this season</dt><dd>${money(reserved)}</dd></div>
      <div><dt>Unsigned players</dt><dd>${pool.length}</dd></div></dl>
    <section><h2>Available players</h2><div class="panel">
      <div class="toolbar"><label>Search players<input id="free-agent-search" type="search" placeholder="Name or previous team"></label>
        <label>Sort by <select id="free-agent-sort"><option value="overall">Overall</option><option value="salary">Asking salary</option>
          <option value="name">Name</option><option value="experience">Experience</option></select></label></div>
      <div class="table-wrap free-agent-list"><table><thead><tr><th>Player</th><th>POS</th><th>OVR</th>
      <th>EXP</th><th>Previous team</th><th>Asking salary / year</th><th>Offer</th></tr></thead><tbody id="free-agent-rows"></tbody></table></div>
    </div></section>
    ${target ? `<section id="free-agent-actions"><h2>${e(target.name)}</h2><div class="panel">
      <div class="toolbar"><a class="back" href="#player/${e(target.id)}">View player card →</a>
      <a class="back" href="#contact/${e(target.id)}">Discuss terms →</a>
      ${offerAllowed ? '<button type="button" id="make-offer">Make an offer ↓</button> <button type="button" id="delegate-free-agent">Delegate offer to Assistant GM</button><p id="delegate-result" role="status"></p>' : ''}</div>
      <p class="note table-note">Agent relationship ${worldRelationships.agentReputation(save, target.id, save.team)}/100 ·
      ${worldRelationships.strongest(save, state, target.id, player => state.owners.get(player.id) === save.team).slice(0, 3)
        .map(entry => e(entry.player.name) + ' (' + entry.familiarity + '/100 familiarity)').join(' · ') || 'No established teammate ties on your roster'}</p>
      <p class="note table-note">Modeled asking salary ${money(freeAgency.askingSalary(target))} per year
      ${market.formerTeams[target.id] ? ' · Previous team ' + e(market.formerTeams[target.id]) : ''}</p>
      ${requests.length ? `<p class="note table-note">Requests · ${requests.map(item => e(item.label)).join(' · ')}</p>` : ''}
      ${commitments.length ? `<p class="note table-note">${quote ? "Commitment offer terms" : "Pending promises"} · ${commitments.map(item => e(item.label)).join(' · ')}</p>` : ''}
      ${offerAllowed ? offerEditor('free-agent-offer', target, { ...teamFinance.openingDeal(target),
        salary: quote?.salary ?? offer?.salary ?? freeAgency.askingSalary(target),
        years: market.qualifying?.[target.id] && market.qualifying[target.id].code !== save.team ? 2 : 1, option: 'None',
        guaranteed: 100, upfront: quote?.upfront ?? promisedUpfront ?? 25, jersey: promisedNumber,
        perks: commitments.filter(item => item.kind === 'perk').map(item => item.value), ...offer, ...round?.deal,
        ...(round?.suggestedSalary ? { salary: round.suggestedSalary, upfront: round.suggestedUpfront ?? round.deal.upfront } : {}) }, round, inSeason ? save.day : 0, available, false, requests, inSeason ? seasonSim.date(save.day, save.year) : null)
        : round ? `<p class="note table-note">${e(round.message)}</p>` : ''}</div></section>` : ''}
    ${market.open && save.optionResults?.length ? `<details class="panel"><summary>Leaguewide contract option results</summary>
      ${castTable(['Player', 'Team', 'Option', 'Salary', 'Result'], save.optionResults.map(item =>
        [playerLink(item.id), e(item.team), e(item.option), money(item.salary), item.option === 'Early termination'
          ? item.retained ? 'Stayed' : 'Terminated' : item.retained ? 'Exercised' : 'Declined']))}</details>` : ''}
    ${market.open && Object.keys(market.qualifying ?? {}).length ? `<details class="panel"><summary>Qualifying offers</summary>
      ${castTable(['Player', 'Rights holder', 'One-year salary', 'Status', 'Action'], Object.entries(market.qualifying).map(([id, item]) =>
        [playerLink(id), e(item.code), money(item.deal.salary), state.owners.has(id) ? 'Signed' : 'Restricted free agent',
          item.code === save.team && !state.owners.has(id) && !market.sheets?.[id]
            ? `<button data-withdraw-qualifying="${e(id)}">Withdraw qualifying offer</button>` : '—']))}</details>` : ''}
    ${target && market.open ? `<details class="panel" open><summary>Competing offers · ${e(target.name)}</summary>
      ${castTable(['Team', 'Years', 'Annual salary', 'Option', 'Interest'], freeAgency.competingOffers(save, state, target.id).map(item =>
        [e(item.code) + (item.qualifying ? ' · Qualifying offer' : ''), item.deal.years, money(item.deal.salary), e(item.deal.option),
          Math.min(100, Math.round(item.score * 100)) + '%']))}
      <p>CPU offers and interest reflect the current market round.</p></details>` : ''}
    ${sheets.length ? `<section><h2>Offer sheets awaiting your decision</h2>
      <p>Unanswered sheets clear when their two-day matching window ends.</p><button type="button" id="sheet-day">Advance matching day</button>
      ${castTable(['Player', 'Offering team', 'Terms', 'Decision'], sheets.map(([id, sheet]) => [
        playerLink(id), e(sheet.code), sheet.deal.years + ' years · ' + money(sheet.deal.salary) + '/year · ' + (sheet.daysRemaining ?? 2) + ' days left',
        `<button data-sheet-action="match" data-player="${e(id)}">Match</button>
         <button data-sheet-action="decline-sheet" data-player="${e(id)}">Decline</button>`]))}</section>` : ''}
    ${market.open ? `<p class="note">Players weigh annual salary, guarantees, bonuses, perks, contract length, and team contention.
      Only this season’s salary and any current-season bonuses or perks count against this year’s budget.</p>
      <section><h2>${market.moratoriumDay <= 3 ? 'Moratorium · Day ' + market.moratoriumDay + ' of 3' : market.timed && market.round > 12 ? 'Free agency complete' : 'Free agency · Day ' + market.round + (market.timed ? ' of 12' : '')}</h2>
      ${market.moratoriumDay <= 3 ? '<p>Negotiate and queue offers. Contracts can be finalized once free agency opens.</p>' : ''}
      <div class="panel table-wrap"><table><thead><tr><th>Player</th><th>Annual salary</th><th>Years</th><th>Year 1 cost</th><th>Action</th></tr></thead>
      <tbody>${pending.map(([id, deal]) => `<tr><td>${playerLink(id)}</td><td>${money(deal.salary)}</td><td>${deal.years}</td>
        <td>${money(teamFinance.signingCost(deal, false))}</td>
        <td><button type="button" class="withdraw-offer" data-player="${e(id)}">Withdraw</button></td></tr>`).join('')
        || '<tr><td colspan="5">No open offers.</td></tr>'}</tbody></table></div>
      <div class="franchise-actions"><button id="resolve-market" ${!sheets.length && (market.timed ? market.round <= 12 : pending.length || outstandingQualifying || market.moratoriumDay <= 3) ? '' : 'disabled'}>${market.moratoriumDay <= 3 ? 'Advance moratorium day' : 'Advance free-agency day'}</button>
        <button id="close-market" ${pending.length || sheets.length || market.moratoriumDay <= 3 || (market.timed && market.round <= 12) ? 'disabled' : ''}>Close market and review results</button></div>
      <p class="note">Closing fills any team below ${freeAgency.minimum} players with affordable one-year depth deals.
        ${market.timed ? 'CPU teams also make signings during the daily rounds.' : 'Other teams can then make additional signings from the remaining pool.'}</p></section>` : ''}
    ${inSeason ? '<p class="note">The initial unsigned list uses <a href="https://hoopswire.com/2026-nba-free-agents-list/">Hoops Wire’s November 5, 2026 report</a> and excludes players on the roster snapshot. Ratings for newly imported free agents are modeled. Current-year salary is prorated.</p>' : ''}
    <section><h2>Offer results and team signings</h2><div class="panel table-wrap"><table>
      <thead><tr><th>Player</th><th>Outcome</th><th>Annual salary</th></tr></thead><tbody>${[...results].reverse().map(result =>
        `<tr><td>${playerLink(result.id)}</td><td>${result.team ? teamLink(teams.get(result.team)) + ' · ' + e(result.source) : e(result.source)}</td>
          <td>${result.team ? money(result.salary) : '—'}</td></tr>`).join('') || '<tr><td colspan="3">No offers have been resolved.</td></tr>'}
      </tbody></table></div></section>`);
  function apply(action) {
    try {
      if (inSeason && action.type === 'offer') seasonSim.saveFinanceAction(save,
        { ...action, type: 'signing', inSeason: true });
      else seasonSim.marketAction(save, action);
      if (action.type === 'close' && seasonSim.load().handoff) { location.hash = market.timed ? '#market-recap' : '#season-handoff'; return; }
      if (action.type === 'resolve' && market.timed) { location.hash = '#market-recap/' + (market.moratoriumDay <= 3 ? 'm' + market.moratoriumDay : market.round); return; }
      render();
      document.querySelector('#market-feedback').textContent = {
        offer: inSeason ? 'Player signed and added to your roster.' : 'Offer saved for the next round.', withdraw: 'Offer withdrawn.', resolve: market.moratoriumDay < 3 ? 'Advanced one moratorium day.' : market.moratoriumDay === 3 ? 'Free agency is open. Resolve pending offers to finalize signings.' : 'Offers resolved.',
        'withdraw-qualifying': 'Qualifying offer withdrawn. The player is now unrestricted.',
        'sheet-day': 'Advanced one matching day.', match: 'Offer sheet matched.', 'decline-sheet': 'Offer sheet declined.',
        close: 'Market closed. Advance from Franchise to play opening day.',
      }[action.type];
    } catch (error) {
      document.querySelector('#market-feedback').textContent = error.message;
    }
  }
  const search = document.querySelector('#free-agent-search');
  const sort = document.querySelector('#free-agent-sort');
  function listPlayers() {
    const query = search.value.toLowerCase().trim();
    const salary = player => freeAgency.askingSalary(player);
    const score = player => ({ overall: state.playerOveralls.get(player.id), salary: salary(player),
      experience: player.experience ?? 0 })[sort.value] ?? 0;
    const visible = pool.filter(player => `${player.name} ${market.formerTeams[player.id] ?? ''}`.toLowerCase().includes(query))
      .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
    document.querySelector('#free-agent-rows').innerHTML = visible.map(player => `<tr>
      <td><a href="#free-agency/${e(player.id)}"${player.id === target?.id ? ' aria-current="true"' : ''}>${e(player.name)}</a></td>
      <td>${e(playerTools.positionText(player))}</td><td>${formatStat(state.playerOveralls.get(player.id), 2)}</td><td>${e(player.experience)}</td>
      <td>${e(market.formerTeams[player.id])}${market.qualifying?.[player.id] ? ' · RFA' : ' · UFA'}</td><td>${money(salary(player))}</td><td>${market.offers[player.id] ? 'Open'
        : (freeAgency.talks(save, 'free-agent', player.id)?.attempts ?? 0) >= 3 ? 'Talks closed' : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="7">No available players match.</td></tr>';
  }
  search.addEventListener('input', listPlayers);
  sort.addEventListener('change', listPlayers);
  listPlayers();
  document.querySelector('#make-offer')?.addEventListener('click', () =>
    document.querySelector('#free-agent-offer input[name="salary"]').focus());
  bindAssistantOffer(save, 'free-agent', target?.id, '#delegate-free-agent');
  bindOfferEditor('free-agent-offer', inSeason ? save.day : 0, deal => {
    try {
      const outcome = seasonSim.negotiateContract(save, 'free-agent', target.id, deal);
      render();
      document.querySelector('#market-feedback').textContent = outcome.message;
    } catch (error) { document.querySelector('#market-feedback').textContent = error.message; }
  });
  document.querySelectorAll('.withdraw-offer').forEach(button => button.addEventListener('click', () => apply({ type: 'withdraw', id: button.dataset.player })));
  document.querySelectorAll('[data-withdraw-qualifying]').forEach(button => button.addEventListener('click', () =>
    apply({ type: 'withdraw-qualifying', id: button.dataset.withdrawQualifying })));
  document.querySelector('#sheet-day')?.addEventListener('click', () => apply({ type: 'sheet-day' }));
  document.querySelectorAll('[data-sheet-action]').forEach(button => button.addEventListener('click', () =>
    apply({ type: button.dataset.sheetAction, id: button.dataset.player })));
  document.querySelector('#resolve-market')?.addEventListener('click', () => { if (window.confirm('Advance the market one day and review the results?')) apply({ type: 'resolve' }); });
  document.querySelector('#close-market')?.addEventListener('click', () => { if (window.confirm('Close free agency and review the final signing recap?')) apply({ type: 'close' }); });
}

function financePeriod(day, period) {
  const date = simDate(day);
  if (period === 'Year') return date.slice(0, 4);
  if (period === 'Month') return date.slice(0, 7);
  if (period === 'Week') {
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
    return 'Week of ' + simDate(day - (weekday + 6) % 7);
  }
  return date;
}

function finances(save) {
  const history = seasonSim.history(save);
  const report = teamFinance.report(save, history);
  const shares = teamFinance.achievementShares(history, save.team);
  const complete = save.day > seasonSim.lastDay || save.market?.open;
  operationsPage('Team finances', 'One bank balance for franchise revenue, expenses, and payroll.',
    `${financeLinks}${financeSummary(report)}
    <section class="panel facility-card"><h2>National media rights</h2>
      <p>Each team’s modeled annual share is <strong>${money(teamFinance.mediaDistribution)}</strong>.
        The team receives ${money(teamFinance.mediaUpfront)} at the start of the season and ${money(teamFinance.mediaRollover)}
        in daily installments over the regular season, including off days.</p>
      <p class="note">The model divides the reported $76 billion evenly over 11 seasons and 30 teams.</p>
      <p><a href="https://pr.nba.com/nba-walt-disney-company-nbcuniversal-amazon-prime-video-media-agreements/">NBA media agreements</a>
      · <a href="https://apnews.com/article/8d11e74bf32e77de886add0225f108ef">Associated Press deal value</a></p></section>
    <section><h2>Franchise achievement bonuses</h2><div class="panel facility-card">
      <p>Modeled club bonuses cover standings, playoff rounds, and player and staff awards.
        The league commercial credit adds ${money(teamFinance.dailyCommercialIncome)} per regular-season day.</p>
      <p><strong>Club bonuses earned · ${money(report.entries.filter(entry => entry.category === 'Franchise achievements')
        .reduce((sum, entry) => sum + entry.amount, 0))}</strong></p>
      <details><summary>Club bonus rates</summary>
        <p>NBA championship · $6.5M · Finals runner-up · $3M</p>
        <p>First round · $500K · Conference semifinals · $850K · Conference finals · $1.5M</p>
        <p>Best NBA record · $1M · Best conference record · $650K · Division champion · $350K</p>
        <ul>${Object.values(teamFinance.clubAwardRates).map(([label, rate]) => `<li>${label} ·
          ${Array.isArray(rate) ? rate.map(money).join(' / ') : money(rate)}</li>`).join('')}</ul>
      </details></div></section>
    <section><h2>Player playoff pool</h2><div class="panel facility-card">
      <p>The NBA playoff pool is allocated to players through their teams. Shares are shown separately from franchise cash.
        The club bonuses above are simulator rules. Award bonuses in player contracts are payroll expenses.</p>
      <p><strong>Earned for this team’s players · ${money(shares.reduce((sum, [, amount]) => sum + amount, 0))}</strong></p>
      ${shares.length ? `<ul>${shares.map(([name, amount]) => `<li>${e(name)} · ${money(amount)}</li>`).join('')}</ul>`
        : '<p>Regular-season standings and playoff results determine the allocation.</p>'}
      <details><summary>Player playoff pool rates</summary><ul>
        <li>Best NBA record · ${money(teamFinance.playoffPool.league)}</li>
        ${teamFinance.playoffPool.conference.map((amount, index) => `<li>Conference finish #${index + 1} · ${money(amount)}</li>`).join('')}
        ${teamFinance.playoffPool.rounds.map((amount, index) => `<li>${postseason.rounds[index]} · ${money(amount)}</li>`).join('')}
        <li>Finals runner-up · ${money(teamFinance.playoffPool.runnerUp)}</li><li>Champion · ${money(teamFinance.playoffPool.champion)}</li>
      </ul></details>
      <p class="note">The simulator uses the published 2025 rates as a baseline.
      <a href="https://cdn.nba.com/teams/uploads/sites/1610612754/2025/06/2025-Indiana-Pacers-Finals-Guide.pdf">Playoff pool source</a></p>
    </div></section>
    <section><h2>Income and expenses</h2><div class="panel">
    <div class="toolbar"><label>Group by <select id="finance-period"><option>Day</option><option>Week</option>
      <option>Month</option><option>Year</option></select></label></div>
    <div class="table-wrap"><table><thead><tr><th>Period</th><th>Revenue</th><th>Payroll</th><th>Other expenses</th><th>Net</th></tr></thead>
    <tbody id="finance-periods"></tbody></table></div></div></section>
    ${complete ? '' : `<section><h2>Team activities</h2><form id="morale-budget" class="panel facility-card">
      <fieldset><legend>Choose an off-day activity</legend>
      ${Object.entries(teamFinance.activities).map(([id, activity]) => `
        <p><label><input type="radio" name="activity" value="${id}" required> <strong>${activity.name}</strong> · ${money(activity.cost)}</label>
        <br><span class="note">${activity.recovery > 0 ? '+' + activity.recovery + ' fatigue recovery' : activity.recovery < 0 ? Math.abs(activity.recovery) + ' fatigue spent' : 'No fatigue change'}${activity.morale ? ' · +' + activity.morale + ' team offense for the next seven days' : ''}</span></p>`).join('')}
      </fieldset><button type="submit">Schedule for today</button><span id="finance-error" role="status"></span>
    </form><p class="note">One activity every seven days. Fatigue changes apply when you advance the off day.</p></section>`}
    <section><h2>Recent transactions</h2><div class="panel table-wrap"><table>
    <thead><tr><th>Date and transaction</th><th>Category</th><th>Amount</th><th>Balance</th></tr></thead>
    <tbody>${report.entries.slice(-60).reverse().map(entry => `<tr><td>${simDate(entry.day)} · ${e(entry.description)}</td>
      <td>${e(entry.category)}</td><td>${money(entry.amount)}</td><td>${money(entry.balance)}</td></tr>`).join('')
      || '<tr><td colspan="4">No transactions yet.</td></tr>'}</tbody></table></div></section>`);
  const select = document.querySelector('#finance-period');
  function updatePeriods() {
    const periods = new Map();
    for (const entry of report.entries) {
      const label = financePeriod(entry.day, select.value);
      if (!periods.has(label)) periods.set(label, { revenue: 0, payroll: 0, other: 0 });
      const row = periods.get(label);
      if (entry.amount > 0) row.revenue += entry.amount;
      else if (['Payroll', 'GM payroll', 'Staff payroll'].includes(entry.category)) row.payroll -= entry.amount;
      else row.other -= entry.amount;
    }
    document.querySelector('#finance-periods').innerHTML = [...periods].reverse().map(([label, row]) => `<tr>
      <td>${e(label)}</td><td>${money(row.revenue)}</td><td>${money(row.payroll)}</td><td>${money(row.other)}</td>
      <td>${money(row.revenue - row.payroll - row.other)}</td></tr>`).join('')
      || '<tr><td colspan="5">No transactions yet.</td></tr>';
  }
  select.addEventListener('change', updatePeriods);
  updatePeriods();
  document.querySelector('#morale-budget')?.addEventListener('submit', event => {
    event.preventDefault();
    const activity = new FormData(event.currentTarget).get('activity');
    postFinanceAction(save, { type: 'morale', activity });
  });
}

function postFinanceAction(save, action) {
  try {
    seasonSim.saveFinanceAction(save, action);
  } catch (error) {
    document.querySelector('#finance-error').textContent = error.message;
    return error;
  }
  render();
  const feedback = document.querySelector('#finance-error');
  if (feedback) feedback.textContent = {
    contract: 'Contract recorded.', morale: 'Team activity scheduled.', trade: 'Trade completed.', cut: 'Player released.',
  }[action.type];
}

function tradePackageText(action, side, formatPlayer) {
  const picks = (side === 0 ? action.sendPicks : action.receivePicks) ?? [];
  const cash = (action.cash ?? 0) * (side === 0 ? 1 : -1);
  return [...seasonSim.tradePlayers(action)[side].map(formatPlayer), ...picks.map(draftOps.pickLabel),
    ...(cash > 0 ? [money(cash) + ' cash'] : [])].join(' + ');
}

function transactions(save, selectedTeam, selection, incoming) {
  if (save.market?.open) { marketPrompt('Roster transactions'); return; }
  const history = seasonSim.history(save);
  const roster = history.rosters.get(save.team);
  const partners = league.teams.filter(team => team.code !== save.team);
  const partner = partners.find(team => team.code === selectedTeam) ?? partners[0];
  const complete = save.day > seasonSim.lastDay;
  const tradeOpen = !complete && save.day <= seasonSim.tradeDeadlineFor(save);
  const picks = new Map(draftOps.futurePicks(save).map(pick => [pick.key, pick]));
  const assets = (value, code) => [...new Set((value ?? '').split(',').filter(id =>
    history.owners.get(id) === code || picks.get(id)?.owner === code))].slice(0, 6);
  const outgoing = assets(selection, save.team);
  const receiving = selection === 'cut' ? [] : assets(incoming, partner.code);
  const route = '#transactions/' + partner.code + '/';
  const offerLink = (send, receive) => route + send.join(',') + '/' + receive.join(',');
  const cut = selection === 'cut' && history.owners.get(incoming) === save.team ? incoming : null;
  const playerLink = id => `<a href="#player/${e(id)}">${e(history.profiles.get(id)?.name ?? id)}</a>`;
  const moves = save.financeActions.filter(action => ['trade', 'cut'].includes(action.type) || action.type === 'signing' && action.inSeason).reverse();
  const freeAgents = [...history.profiles.values()].filter(player => !history.owners.has(player.id) && !history.unavailable.has(player.id));
  const ownTeam = teams.get(save.team);
  const tradeContracts = new Map();
  const contractsFor = code => {
    if (!tradeContracts.has(code)) tradeContracts.set(code, teamFinance.report(save, history, code).contracts);
    return tradeContracts.get(code);
  };
  const salary = (code, ids) => teamFinance.tradePayroll(ids.length ? contractsFor(code) : new Map(), ids, save.day);
  const valueMarket = tradeOpen && (outgoing.length || receiving.length) ? tradeValues.market(save, history, contractsFor) : null;
  const outgoingSalary = tradeOpen ? salary(save.team, outgoing) : null;
  const incomingSalary = tradeOpen ? salary(partner.code, receiving) : null;
  const tradeSide = (team, ids, pay, otherPay, own) => {
    const picker = '#pick/' + (own ? 'send' : 'receive') + '/' + partner.code + '/' + outgoing.join(',') + '~' + receiving.join(',');
    return `<section class="trade-side" aria-label="${e(team.name)} trade package">
      <header><span>${own ? 'Your team sends' : 'Partner sends'}</span><strong>${e(team.name)}</strong></header>
      <div class="trade-package"><div class="trade-crest">${logo(team)}</div><div class="trade-slot">
        ${ids.map(id => {
          const player = history.profiles.get(id);
          const remove = own ? offerLink(outgoing.filter(asset => asset !== id), receiving) : offerLink(outgoing, receiving.filter(asset => asset !== id));
          return `<div class="trade-asset trade-filled">
            ${player?.photo ? `<img src="${e(player.photo)}" alt="">` : ''}
            <span><strong>${player ? playerLink(id) : e(draftOps.pickLabel(id))}</strong><small>${player
              ? e(playerTools.positionText(player)) + ' · ' + formatStat(history.playerOveralls.get(id), 2) + ' OVR' : 'Unprotected draft pick'} · ${valueMarket.valueFor(id, partner.code).toFixed(1)} value to ${e(partner.code)}</small></span>
            <a class="trade-remove" href="${e(remove)}" aria-label="Remove ${e(player?.name ?? draftOps.pickLabel(id))}">×</a></div>`;
        }).join('')}
        ${ids.length < 6 ? `<a class="trade-asset" href="${e(picker)}"><span><strong>+ Add trade item</strong><small>Player or draft pick</small></span></a>` : ''}
      </div></div>
      <dl class="trade-totals"><div><dt>Package value to ${e(partner.code)}</dt><dd data-trade-value="${own ? "send" : "receive"}">${(valueMarket?.total(ids, partner.code) ?? 0).toFixed(1)}</dd></div><div><dt>Remaining guaranteed sent</dt><dd>${money(pay.guaranteed)}</dd></div>
        <div><dt>Remaining guaranteed received</dt><dd>${money(otherPay.guaranteed)}</dd></div>
        <div><dt>Net guaranteed payroll change</dt><dd>${money(otherPay.guaranteed - pay.guaranteed)}</dd></div>
        <div><dt>Conditional salary received</dt><dd>${money(otherPay.conditional)}</dd></div>
        ${otherPay.incentives ? `<div><dt>Potential incentives received</dt><dd>${money(otherPay.incentives)}</dd></div>` : ''}
        ${pay.kicker ? `<div><dt>Trade kicker paid by this team</dt><dd>${money(pay.kicker)}</dd></div>` : ''}
        <div><dt>Projected roster size</dt><dd>${history.rosters.get(team.code).length - ids.filter(id => !picks.has(id)).length
          + (own ? receiving : outgoing).filter(id => !picks.has(id)).length}</dd></div></dl>
    </section>`;
  };
  app.innerHTML = `<a class="back" href="#franchise">← Franchise</a>
    <section class="trade-board">
      <header class="trade-title"><div><div class="eyebrow">Front office / Trades</div><h1>Propose trade</h1></div>
        <span class="trade-deadline">${tradeOpen ? 'Trades open' : 'Trades closed'} · Deadline ${simDate(seasonSim.tradeDeadlineFor(save))}</span></header>
      ${tradeOpen ? `<form id="trade-form">
        <div class="trade-controls"><label>Trade partner <select id="trade-partner">${partners.map(team =>
          `<option value="${e(team.code)}" ${team.code === partner.code ? 'selected' : ''}>${e(team.name)}</option>`).join('')}</select></label>
          <a href="#trade-finder/${e(save.team)}">Trade Finder</a><a href="#transactions/${e(partner.code)}">Clear offer</a></div>
        <div class="trade-sides">${tradeSide(ownTeam, outgoing, outgoingSalary, incomingSalary, true)}
          ${tradeSide(partner, receiving, incomingSalary, outgoingSalary, false)}</div>
        <footer class="trade-controls"><label>Cash to partner ($, negative to receive)
          <input type="number" name="cash" value="0" step="1" min="-10000000" max="10000000"></label><span>${outgoing.length && receiving.length ? 'Ready to submit for review' : 'Select up to six assets per team'}</span>
          <button type="submit" >Propose trade</button></footer>
      </form>` : ''}
      <p id="finance-error" class="trade-feedback" role="status"></p>
    </section>
    <section><h2>Release a player</h2>
      ${!complete && roster.length > 10 ? `<form class="panel toolbar" id="cut-form">
        <a class="primary-link" href="#pick/cut/${e(partner.code)}">${cut ? e(history.profiles.get(cut)?.name ?? cut) : 'Choose player from roster'}</a>
        ${cut ? '<strong>Release settlement · ' + money(Math.round(salary(save.team, [cut]).guaranteed / 2)) + '</strong>' : ''}
        <label class="release-check"><input type="checkbox" required> Confirm release to the free-agent pool</label>
        <button type="submit" ${cut ? '' : 'disabled'}>Release player</button></form>` :
        `<p class="note">${complete ? 'The regular season is complete.' : 'Keep at least 10 players on the roster.'}</p>`}
      <p class="note">A release costs half of the remaining guaranteed salary for this season. Conditional pay ends.</p></section>
    <section><h2>Transaction history</h2><div class="panel table-wrap"><table><thead><tr><th>Date</th><th>Move</th></tr></thead>
      <tbody>${moves.map(move => `<tr><td>${simDate(move.day)}</td><td>${move.type === 'trade'
        ? `Sent ${tradePackageText(move, 0, playerLink)} to ${teamLink(teams.get(move.otherTeam))} for ${tradePackageText(move, 1, playerLink)}`
        : move.type === 'signing' ? `${teamLink(teams.get(move.team))} signed ${playerLink(move.id)}`
          : `Released ${playerLink(move.id)}`}</td></tr>`).join('') || '<tr><td colspan="2">No roster moves yet.</td></tr>'}</tbody></table></div></section>
    <section><h2>Free agents</h2><p class="note">${freeAgents.length
      ? freeAgents.map(player => playerLink(player.id)).join(' · ') : 'No players have been released in this save.'}</p></section>`;
  document.querySelector('#trade-partner')?.addEventListener('change', event => {
    location.hash = '#transactions/' + event.target.value + (outgoing.length ? '/' + outgoing.join(',') : '');
  });
  document.querySelector('#trade-form')?.addEventListener('input', event => {
    const cash = tradeValues.cashValue(Number(event.currentTarget.elements.cash.value));
    document.querySelector('[data-trade-value="send"]').textContent = ((valueMarket?.total(outgoing, partner.code) ?? 0) + Math.max(0, cash)).toFixed(1);
    document.querySelector('[data-trade-value="receive"]').textContent = ((valueMarket?.total(receiving, partner.code) ?? 0) + Math.max(0, -cash)).toFixed(1);
  });
  document.querySelector('#trade-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const cash = Number(event.currentTarget.elements.cash.value);
    const declined = postFinanceAction(save, { type: 'trade', otherTeam: partner.code, cash,
      send: outgoing.filter(id => !picks.has(id)), receive: receiving.filter(id => !picks.has(id)),
      sendPicks: outgoing.filter(id => picks.has(id)), receivePicks: receiving.filter(id => picks.has(id)) });
    if (receiving.length && declined?.message.startsWith('The other team declined')) {
      const counter = finderOffers(save, history, partner.code, receiving)[0];
      if (counter) document.querySelector('#finance-error').insertAdjacentHTML('beforeend',
        ` <a class="primary-link" href="${e(offerLink(counter.send, counter.receive))}">Review counteroffer →</a>`);
    }
  });
  document.querySelector('#cut-form')?.addEventListener('submit', event => {
    event.preventDefault();
    if (cut) postFinanceAction(save, { type: 'cut', id: cut });
  });
}

function bindAssistantOffer(save, kind, id, selector) {
  document.querySelector(selector)?.addEventListener('click', () => {
    if (!window.confirm('Let your Assistant GM choose terms and submit this offer? An accepted offer can commit payroll.')) return;
    try {
      const result = seasonSim.delegateContract(save, kind, id);
      render();
      const message = result.accepted ? 'The player accepted the delegated offer.' : 'The player declined the delegated offer.';
      const feedback = document.querySelector('#delegate-result');
      if (feedback) feedback.textContent = message;
      else window.alert(message);
    } catch (error) { document.querySelector('#delegate-result').textContent = error.message; }
  });
}

function contracts(save, selectedId) {
  if (save.market?.open) { marketPrompt('Player contracts'); return; }
  const history = seasonSim.history(save);
  const roster = [...history.rosters.get(save.team)].sort((a, b) => a.name.localeCompare(b.name));
  const player = roster.find(entry => entry.id === selectedId);
  if (!player) {
    openRosterPicker(save, 'contract');
    return;
  }
  const report = teamFinance.report(save, history);
  const active = report.contracts.get(player.id);
  const complete = save.day > seasonSim.lastDay;
  const deal = active?.deal;
  const status = freeAgency.extensionStatus(save, history, player.id, active);
  const round = freeAgency.talks(save, 'extension', player.id);
  const extension = save.extensions?.[player.id];
  const quote = location.hash.endsWith('/commit') ? relationships.commitment(save, history, player) : null;
  const payoutText = report.conditional.filter(payout => payout.id === player.id)
    .map(payout => `<li>${e(payout.label)} · ${money(payout.amount)} · ${e(payout.status)}</li>`).join('');
  operationsPage('Player contracts', 'Review payroll and negotiate extensions that start next season.',
    `${financeLinks}${financeSummary(report)}
    <section class="panel contract-panel"><div class="toolbar"><strong>${e(player.name)}</strong>
    <a class="primary-link" href="#pick/contract">Choose another player</a></div>
    ${active ? `<dl class="bio"><div><dt>Annual base salary</dt><dd>${money(deal.salary)}</dd></div>
      <div><dt>Current-season salary</dt><dd>${money(active.pay.salary)}</dd></div>
      <div><dt>Upfront guarantee paid</dt><dd>${money(active.pay.upfront)}</dd></div>
      <div><dt>Current-season rollover total</dt><dd>${money(active.pay.rollover)}</dd></div>
      <div><dt>Contract term</dt><dd>${deal.years} year${deal.years === 1 ? '' : 's'} · ${e(deal.option)}</dd></div>
      <div><dt>Annual salary change</dt><dd>${money(deal.raise)}</dd></div>
      <div><dt>Guaranteed salary share</dt><dd>${deal.guaranteed}%</dd></div>
      <div><dt>Trade terms</dt><dd>${deal.noTrade ? 'No-trade clause · ' : ''}${deal.kicker}% kicker</dd></div></dl>
      ${deal.years > 1 ? `<p class="note table-note">Annual salary schedule · ${Array.from({ length: deal.years }, (_, i) =>
        `Year ${i + 1}: ${money(deal.salarySchedule?.[i]?.[0] ?? deal.salary + i * deal.raise)}${deal.salarySchedule?.[i]?.[1] ? ' (' + e(deal.salarySchedule[i][1]) + ')' : ''}`).join(' · ')}</p>` : ''}
      ${payoutText ? `<ul class="payout-list">${payoutText}</ul>` : ''}
      <p class="note table-note">${deal.published ? 'Published salary schedule with simulator payment terms' : deal.bridge ? 'Temporary offseason renewal' : deal.modeled ? 'Opening salary estimate' : 'Franchise agreement'} · ${simDate(active.day)}
      ${deal.perks.length ? ' · ' + e(deal.perks.join(', ')) : ''}</p>` : '<p class="note table-note">No agreement was recorded in this save.</p>'}</section>
    <section><h2>Extension · ${e(status)}</h2>
    ${['Considering future', 'Ready to negotiate'].includes(status) ? `<p class="note">Talks open on franchise day 30 or at 55 player trust. Current trust: ${relationships.playerScore(save, history, player.id)}/100. Once talks are open, team contention, the offer terms, and any commitments affect acceptance.</p>` : ''}
    ${extension ? `<p>${extension.years} year(s) starting ${seasonLabel(save.year + 1)} · ${money(extension.salary)} in the first year.</p>` : ''}
    ${!complete && status === 'Ready to negotiate' ? '<p><button type="button" id="delegate-extension">Delegate extension to Assistant GM</button></p><p id="delegate-result" role="status"></p>' : ''}
    ${!complete && status === 'Ready to negotiate' ? offerEditor('contract-form', player,
      { ...teamFinance.openingDeal(player), ...(quote ? { salary: quote.salary, years: 1, guaranteed: 100, upfront: quote.upfront } : {}),
        ...round?.deal, jersey: null,
        ...(round?.suggestedSalary ? { salary: round.suggestedSalary, upfront: round.suggestedUpfront ?? round.deal.upfront } : {}) }, round, 0, report.available, true, relationships.commitment(save, history, player).requests, seasonSim.date(save.day, save.year)) : ''}
    <p id="extension-feedback" role="status">${e(round?.message ?? '')}</p></section>`);
  bindAssistantOffer(save, 'extension', player.id, '#delegate-extension');
  bindOfferEditor('contract-form', 0, updated => {
    try {
      const result = seasonSim.negotiateContract(save, 'extension', player.id, updated);
      render();
      document.querySelector('#extension-feedback').textContent = result.message;
    } catch (error) { document.querySelector('#extension-feedback').textContent = error.message; }
  });
}

function openRosterPicker(save, kind, partner, outgoing) {
  const other = teams.has(partner) ? partner : '';
  if ((kind === 'send' || kind === 'receive') && other && other !== save.team) {
    tradePlayerPicker(save, kind, other, outgoing);
    return;
  }
  const back = kind === 'contract' ? 'franchise' : 'transactions/' + other;
  const select = {
    contract: id => 'contracts/' + id,
    cut: id => 'transactions/' + other + '/cut/' + id,
  }[kind];
  if (!select) { franchise(); return; }
  const label = kind === 'contract' ? 'Choose a player to review their contract' : 'Choose a player to release';
  const state = kind === 'contract' ? seasonSim.history(save) : null;
  const contracts = state && teamFinance.report(save, state).contracts;
  roster(teams.get(save.team), { back, select, label, contracts,
    actionLabel: contracts ? () => 'Open contract' : null,
    marker: contracts ? id => `<small class="extension-status">${e(freeAgency.extensionStatus(save, state, id, contracts.get(id)))}</small>` : null });
}

function tradePlayerPicker(save, kind, other, preserved) {
  const history = seasonSim.history(save);
  const send = kind === 'send';
  const code = send ? save.team : other;
  const team = teams.get(code);
  const contracts = teamFinance.report(save, history, code).contracts;
  const players = [...history.rosters.get(code)].sort((a, b) =>
    history.playerOveralls.get(b.id) - history.playerOveralls.get(a.id) || a.name.localeCompare(b.name));
  const route = '#transactions/' + other + '/';
  const [outgoing = '', incoming = ''] = (preserved ?? '').split('~');
  const selected = (send ? outgoing : incoming).split(',').filter(Boolean);
  const destination = id => {
    const next = [...selected, id].join(',');
    return route + (send ? next + '/' + incoming : outgoing + '/' + next);
  };
  const priorSave = save.pastSeasons?.at(-1);
  const prior = priorSave ? seasonSim.history(priorSave).averages : null;
  const season = priorSave ? seasonLabel(priorSave.year) : 'Previous NBA season';
  const pickRows = draftOps.futurePicks(save).filter(pick => pick.owner === code);
  const selectAsset = (id, blocked = false) => blocked ? 'Blocked' : selected.includes(id) ? 'Added'
    : selected.length >= 6 ? 'Package full' : `<a href="${e(destination(id))}">Add</a>`;
  const preview = player => `${player.photo ? `<img src="${e(player.photo)}" alt="">` : ''}
    <div><div class="eyebrow">${e(playerTools.positionText(player))}</div><h2>${e(player.name)}</h2>
      <a href="#player/${e(player.id)}">View player card</a></div>
    <div class="trade-rating"><strong>${formatStat(history.playerOveralls.get(player.id), 2)}</strong><small>OVR</small></div>`;
  app.innerHTML = `<a class="back" href="${e(route + outgoing + '/' + incoming)}">← Trade board</a>
    <section class="trade-board"><header class="trade-title"><div><div class="eyebrow">Front office / Trades</div>
      <h1>Trade player select</h1></div><strong>${send ? 'Send from' : 'Receive from'} ${e(team.name)}</strong></header>
    <div class="trade-controls"><div class="trade-picker-tabs">
      <button type="button" id="trade-players-tab" aria-pressed="true">Players</button>
      <button type="button" id="trade-picks-tab" aria-pressed="false">Draft picks</button></div>
      <span>${selected.length} / 6 assets selected · Stats from ${e(season)}</span></div>
    <div id="trade-players-view"><div class="trade-preview"><div class="trade-crest">${logo(team)}</div><div id="trade-player-preview">${players[0] ? preview(players[0]) : 'No players available'}</div></div>
    <div class="table-wrap trade-roster"><table><thead><tr><th>Player</th><th>Position</th><th>OVR</th><th title="${e(season)}">GP</th><th title="${e(season)}">PTS</th><th title="${e(season)}">REB</th><th title="${e(season)}">AST</th><th title="${e(season)}">FG%</th><th>Salary</th><th>Option</th><th>Trade clause</th><th></th></tr></thead>
    <tbody>${players.map(player => {
      const contract = contracts.get(player.id);
      const stats = prior ? prior.get(player.id) : previousNbaSeasonStats(player);
      return `<tr><td><button type="button" class="trade-preview-button" data-trade-preview="${e(player.id)}">${e(player.name)}</button></td>
        <td>${e(playerTools.positionText(player))}</td><td>${formatStat(history.playerOveralls.get(player.id), 2)}</td>
        ${['GP', 'PTS', 'REB', 'AST', 'FG%'].map(key => `<td>${formatStat(key === 'FG%' ? stats?.[key] ?? seasonSim.percentage(stats?.FGM, stats?.FGA) : stats?.[key], key === 'GP' ? 0 : 1)}</td>`).join('')}
        <td>${contract ? money(contract.pay.salary) : '—'}</td><td>${e(contract?.deal.option)}</td>
        <td>${contract?.deal.noTrade ? 'No-trade' : '—'}</td><td>${selectAsset(player.id, contract?.deal.noTrade)}</td></tr>`;
    }).join('')}</tbody></table></div></div>
    <div id="trade-picks-view" class="table-wrap trade-roster" hidden><table><thead><tr>
      <th>Year</th><th>Round</th><th>Original team</th><th>Protection</th><th></th></tr></thead>
      <tbody>${pickRows.map(pick => `<tr><td>${pick.year}</td><td>${pick.round === 1 ? '1st' : '2nd'}</td>
        <td>${e(teams.get(pick.origin).name)}</td><td>Unprotected</td><td>${selectAsset(pick.key)}</td></tr>`).join('')}</tbody>
    </table></div></section>`;
  for (const tab of ['players', 'picks']) {
    document.querySelector('#trade-' + tab + '-tab').addEventListener('click', () => {
      for (const view of ['players', 'picks']) {
        document.querySelector('#trade-' + view + '-view').hidden = view !== tab;
        document.querySelector('#trade-' + view + '-tab').setAttribute('aria-pressed', String(view === tab));
      }
    });
  }
  document.querySelectorAll('[data-trade-preview]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelector('#trade-player-preview').innerHTML = preview(history.profiles.get(button.dataset.tradePreview));
      document.querySelector('[data-trade-preview][aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-pressed', 'true');
    });
  });
  document.querySelector('[data-trade-preview]')?.setAttribute('aria-pressed', 'true');
}

function trainingFacility() {
  let save;
  try {
    save = seasonSim.load();
  } catch {
    franchise();
    return;
  }
  if (!save) {
    app.innerHTML = '<section class="hero"><h1>Training Facility</h1><p><a class="back" href="#franchise">Start a franchise to assign drills →</a></p></section>';
    return;
  }
  if (save.market?.open) { marketPrompt('Training Facility'); return; }
  const { health, development, activeRoster } = seasonSim.history(save);
  const team = teams.get(save.team);
  const roster = [...activeRoster].sort((a, b) => a.name.localeCompare(b.name));
  const assignments = seasonSim.currentTraining(save);
  const complete = save.day > seasonSim.lastDay;
  let nextDay = save.day;
  while (nextDay <= seasonSim.lastDay && seasonSim.fixtures(nextDay, save).some(game => game.includes(save.team))) nextDay++;
  const nextSession = nextDay < seasonSim.lastDay ? simDate(nextDay) : null;
  const log = development.log.filter(entry => !entry.team || entry.team === save.team).slice(-25).reverse();
  app.innerHTML = `<a class="back" href="#facilities">← Facilities</a>
    <section class="hero roster-hero">${logo(team)}<div><div class="eyebrow">PLAYER DEVELOPMENT · ${e(team.code)}</div>
    <h1>Training Facility</h1><p>${nextSession ? 'Next scheduled session · ' + nextSession : 'No remaining training sessions this regular season'}</p></div></section>
    ${trainingUpgrades(save)}<form class="panel" id="training-form">
      <div class="toolbar rotation-toolbar">
        ${nextSession ? '<button type="submit">Save training plan</button>' : '<strong>Training closed for this season</strong>'}
        <span id="training-feedback" role="status"></span>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Player</th><th>Availability</th><th>Fatigue</th><th>Rest-day drill</th><th>Current rating</th></tr></thead>
        <tbody>${roster.map(player => {
          const condition = health.get(player.id);
          const drill = assignments[player.id];
          return `<tr><td><a href="#player/${e(player.id)}/${e(team.code)}">${e(player.name)}</a></td>
            <td>${seasonSim.tier(condition.durability)}</td><td>${condition.fatigue}%</td>
            <td><select class="drill-select" name="${e(player.id)}" aria-label="${e(player.name)} drill" ${complete || !nextSession ? 'disabled' : ''}>
              <option value="">Rest</option>${playerDevelopment.attributes.map(attribute =>
                `<option value="${e(attribute)}" ${attribute === drill ? 'selected' : ''}>${e(attribute)}</option>`).join('')}</select></td>
            <td id="drill-rating-${e(player.id)}">${formatStat(playerDevelopment.ratings(development, player)[drill], 2)}</td></tr>`;
        }).join('')}</tbody></table></div>
    </form>
    <p class="note">Saved drills repeat on team rest days. Staff ratings adjust the base gain of +${playerDevelopment.drillGain.toFixed(2)}
      and base cost of ${playerDevelopment.fatigueCost} fatigue. Players at 50 durability or below, or below 40 fatigue after recovery, skip training.</p>
    <section><h2>Recent training</h2>${log.length ? `<div class="panel table-wrap"><table><thead><tr><th>Player</th><th>Date</th><th>Drill</th><th>Outcome</th></tr></thead>
      <tbody>${log.map(entry => `<tr><td>${e(playersById.get(entry.id).name)}</td><td>${simDate(entry.day)}</td>
        <td>${e(entry.attribute)}</td><td>${entry.reason ? e(entry.reason) : '+' + entry.gain.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="note">No sessions logged yet.</p>'}</section>`;
  const form = document.querySelector('#training-form');
  const feedback = document.querySelector('#training-feedback');
  form.addEventListener('change', event => {
    const select = event.target;
    const attributes = playerDevelopment.ratings(development, playersById.get(select.name));
    document.querySelector('#drill-rating-' + select.name).textContent = formatStat(attributes[select.value], 2);
    feedback.textContent = '';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const plan = Object.fromEntries([...new FormData(form)].filter(([, drill]) => drill));
      seasonSim.setTraining(save, plan);
      save = seasonSim.load();
      feedback.textContent = 'Training plan saved.';
    } catch (error) {
      feedback.textContent = error.message;
    }
  });
}

function coaching() {
  let save;
  try {
    save = seasonSim.load();
  } catch {
    franchise();
    return;
  }
  if (!save) {
    app.innerHTML = '<section class="hero"><h1>Coaching</h1><p><a class="back" href="#franchise">Start a franchise to set your rotation →</a></p></section>';
    return;
  }
  if (save.market?.open) { marketPrompt('Coaching'); return; }
  const team = teams.get(save.team);
  const { health, activeRoster: teamRoster, bracket, playerOveralls } = seasonSim.history(save);
  const plan = seasonSim.currentPlan(save);
  const roster = new Map(teamRoster.map(player => [player.id, player]));
  const complete = Boolean(bracket?.champion);
  const labels = ['PG', 'SG', 'SF', 'PF', 'C', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th'];
  let slots = seasonSim.currentSlots(save);
  let minutes = { ...plan };
  let selected = null;
  let message = save.rotationAlert ? 'Simulation paused. Review and save your rotation.' : '';
  app.innerHTML = `<a class="back" href="#franchise">← Franchise</a>
    <header class="rotation-heading">${logo(team)}<div class="eyebrow">COACHING · ${e(team.code)}</div><h1>Rotation and minutes</h1>
    <a class="button" href="#gameplan">Gameplan →</a></header>
    <div class="rotation-workspace">
      <section class="panel rotation-lineup" aria-label="Lineup">
        <h2>Starting five</h2>
        <div class="rotation-court">
          <svg viewBox="0 0 500 470" preserveAspectRatio="none" aria-hidden="true">
            <defs><pattern id="hardwood" width="38" height="13" patternUnits="userSpaceOnUse">
              <rect width="38" height="13" fill="#926b44"/><path d="M0 0H38 M17 0V13" stroke="#795332" opacity=".55"/>
            </pattern></defs>
            <rect width="500" height="470" fill="url(#hardwood)"/>
            <g stroke="#fff2d3" stroke-width="2" fill="none" opacity=".85">
              <rect x="2" y="2" width="496" height="466"/><path d="M30 2V142 A237.5 237.5 0 0 0 470 142V2"/>
              <rect x="170" y="2" width="160" height="188" fill="#2c3c4c" fill-opacity=".72"/>
              <circle cx="250" cy="190" r="60"/><path d="M210 52.5 A40 40 0 0 0 290 52.5 M220 40H280 M190 468 A60 60 0 0 1 310 468"/>
              <circle cx="250" cy="52.5" r="7.5"/>
            </g>
          </svg><div id="court-slots"></div>
        </div>
        <h2>Bench</h2><div id="bench-slots" class="rotation-bench"></div>
        <p class="note">Drag to swap, or select a player and then a destination. Select + to add a reserve.</p>
      </section>
      <form id="rotation-form" class="panel rotation-minutes">
        <h2>Minutes <strong id="minutes-total" aria-live="polite"></strong></h2>
        <div id="rotation-rows"></div>
        <div class="toolbar">
          ${complete ? '<span>Season complete</span>' : '<button type="submit">Save rotation</button><button type="button" id="default-rotation">Reset</button><button type="button" id="repair-rotation">Build healthy rotation</button><label>Rotation size <input id="rotation-size" type="number" min="5" max="15" value="10"></label><button type="button" id="rebuild-rotation">Rebuild lineup</button>'}
          ${save.rotationAlert?.shortHanded ? '<button type="button" id="ack-forfeit">Accept forfeit</button>' : ''}
          <button type="button" id="auto-injury-rotation" aria-pressed="${Boolean(save.autoInjuryRotation)}">Auto injury rotation ${save.autoInjuryRotation ? 'on' : 'off'}</button>
        </div>
        <p id="rotation-feedback" role="status"></p>
      </form>
    </div>
    <dialog class="panel rotation-picker" id="rotation-picker"><h2>Add a player</h2><div id="rotation-reserves"></div><button type="button" data-close-rotation>Cancel</button></dialog>`;
  const form = document.querySelector('#rotation-form');
  const picker = document.querySelector('#rotation-picker');
  const depth = () => [...slots.filter(Boolean), ...[...roster.keys()].filter(id => !slots.includes(id))];
  const card = (id, index) => {
    const player = roster.get(id);
    const ovr = playerOveralls.get(id);
    return `<button type="button" class="rotation-card ${selected === index ? 'selected' : ''}" data-rotation-slot="${index}"
      aria-label="${e(labels[index])} · ${e(player?.name ?? 'Add player')}" aria-pressed="${selected === index}"
      ${id && !complete ? 'draggable="true"' : ''} ${complete ? 'disabled' : ''}>
      <span class="rotation-slot-label">${labels[index]}</span>
      ${player ? `${player.photo ? `<img src="${e(player.photo)}" alt="" draggable="false">` : '<span class="rotation-no-photo" aria-hidden="true">●</span>'}
        <strong>${e(player.name)}</strong><small>${e(playerTools.positionText(player))} · ${formatStat(ovr, 1)} OVR</small>`
        : '<span class="rotation-add" aria-hidden="true">+</span>'}
    </button>`;
  };
  function preview() {
    const sum = Object.values(minutes).reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
    document.querySelector('#minutes-total').textContent = `${sum} / 240`;
    const projected = sum === 240 && Object.values(minutes).every(value => Number.isInteger(value) && value >= 0 && value <= 48)
      ? seasonSim.allocateMinutes(team.code, minutes, health, teamRoster, depth()) : null;
    const actual = new Map(projected?.map(player => [player.id, player.minutes]));
    form.querySelectorAll('[data-projected]').forEach(node => {
      node.textContent = projected ? `Projected ${actual.get(node.dataset.projected) ?? 0}` : 'Projected —';
    });
    document.querySelector('#rotation-feedback').textContent = message;
  }
  function draw() {
    document.querySelector('#court-slots').innerHTML = slots.slice(0, 5).map(card).join('');
    document.querySelector('#bench-slots').innerHTML = slots.slice(5).map((id, i) => card(id, i + 5)).join('');
    document.querySelector('#rotation-rows').innerHTML = slots.map((id, i) => {
      const player = roster.get(id);
      if (!player) return '';
      const status = health.get(id);
      return `<div class="rotation-minute-row" data-minute-player="${e(id)}">
        <div><a href="#player/${e(id)}/${e(team.code)}">${e(player.name)}</a>
        <small>${labels[i]} · ${e(seasonSim.tier(status.durability))} · Energy ${status.fatigue}% · Durability ${status.durability}%</small>
        ${status.injury ? `<small>${e(status.injury.name)} · ${e(injuryDetails(status, save.day, save.year) ?? "")}</small>` : ""}</div>
        <div class="minutes-edit"><input type="range" min="0" max="48" value="${minutes[id]}" aria-label="${e(player.name)} minutes slider" ${complete ? 'disabled' : ''}>
        <input type="number" min="0" max="48" required value="${Number.isFinite(minutes[id]) ? minutes[id] : ''}" aria-label="${e(player.name)} planned minutes" ${complete ? 'disabled' : ''}></div>
        <small data-projected="${e(id)}"></small>
        ${i >= 5 && !complete ? `<button type="button" data-remove-slot="${i}" aria-label="Move ${e(player.name)} to reserves">Reserve</button>` : ''}
      </div>`;
    }).join('');
    preview();
  }
  function swap(from, to) {
    if (complete || !slots[from] || from === to) return;
    if (from < 5 && !slots[to]) { message = 'Swap starters with an occupied slot.'; preview(); return; }
    [slots[from], slots[to]] = [slots[to], slots[from]];
    selected = null;
    message = 'Lineup changed. Save to apply.';
    draw();
    app.querySelector(`[data-rotation-slot="${to}"]`)?.focus();
  }
  let addTo;
  app.querySelector('.rotation-lineup').addEventListener('click', event => {
    const button = event.target.closest('[data-rotation-slot]');
    if (!button || complete) return;
    const index = Number(button.dataset.rotationSlot);
    if (selected !== null && selected !== index) { swap(selected, index); return; }
    if (slots[index]) {
      selected = selected === index ? null : index;
      app.querySelectorAll('[data-rotation-slot]').forEach(card => {
        const active = Number(card.dataset.rotationSlot) === selected;
        card.classList.toggle('selected', active);
        card.setAttribute('aria-pressed', active);
      });
      return;
    }
    addTo = index;
    const reserves = [...roster.values()].filter(player => !slots.includes(player.id));
    picker.querySelector('#rotation-reserves').innerHTML = reserves.length ? reserves.map(player =>
      `<button type="button" data-add-player="${e(player.id)}">${e(player.name)} · ${e(playerTools.positionText(player))} · ${formatStat(playerOveralls.get(player.id), 1)} OVR</button>`).join('') : '<p>No reserves available.</p>';
    picker.showModal();
  });
  picker.addEventListener('click', event => {
    const id = event.target.closest('[data-add-player]')?.dataset.addPlayer;
    if (id && roster.has(id) && !slots.includes(id)) {
      slots[addTo] = id;
      minutes[id] = 0;
      message = 'Player added. Assign minutes and save.';
      picker.close();
      draw();
      app.querySelector(`[data-rotation-slot="${addTo}"]`)?.focus();
    } else if (event.target.closest('[data-close-rotation]')) picker.close();
  });
  const lineup = app.querySelector('.rotation-lineup');
  let dragging = null;
  lineup.addEventListener('dragstart', event => {
    const card = event.target.closest('[draggable="true"]');
    if (!card) return;
    dragging = Number(card.dataset.rotationSlot);
    event.dataTransfer.setData('text/plain', card.dataset.rotationSlot);
    event.dataTransfer.effectAllowed = 'move';
  });
  lineup.addEventListener('dragend', () => { dragging = null; });
  lineup.addEventListener('dragover', event => {
    if (dragging !== null && event.target.closest('[data-rotation-slot]')) event.preventDefault();
  });
  lineup.addEventListener('drop', event => {
    const target = event.target.closest('[data-rotation-slot]');
    if (dragging === null || !target) return;
    event.preventDefault();
    const from = dragging;
    dragging = null;
    swap(from, Number(target.dataset.rotationSlot));
  });
  form.addEventListener('input', event => {
    const row = event.target.closest('[data-minute-player]');
    if (!row) return;
    const value = event.target.valueAsNumber;
    minutes[row.dataset.minutePlayer] = value;
    if (event.target.validity.valid) {
      const companion = row.querySelector(event.target.type === 'range' ? 'input[type=number]' : 'input[type=range]');
      companion.value = value;
    }
    message = '';
    preview();
  });
  form.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-slot]');
    if (!button || complete) return;
    const index = Number(button.dataset.removeSlot);
    minutes[slots[index]] = 0;
    slots[index] = null;
    selected = null;
    message = 'Player moved to reserves. Reassign minutes before saving.';
    draw();
    app.querySelector(`[data-rotation-slot="${index}"]`)?.focus();
  });
  const action = (selector, run) => document.querySelector(selector)?.addEventListener('click', () => {
    try { run(); } catch (error) { message = error.message; preview(); }
  });
  action('#auto-injury-rotation', () => {
    seasonSim.setAutoInjuryRotation(save, !save.autoInjuryRotation);
    save = seasonSim.load();
    const button = document.querySelector('#auto-injury-rotation');
    button.setAttribute('aria-pressed', Boolean(save.autoInjuryRotation));
    button.textContent = `Auto injury rotation ${save.autoInjuryRotation ? 'on' : 'off'}`;
  });
  action('#ack-forfeit', () => { seasonSim.acknowledgeForfeit(save); location.hash = '#calendar'; });
  const reset = (order, targets) => {
    slots = seasonSim.positionStarters(order, teamRoster);
    minutes = { ...targets };
    selected = null;
    message = 'Rotation updated. Save to apply.';
    draw();
  };
  action('#default-rotation', () => reset([...roster.keys()], seasonSim.defaultPlan(team.code, teamRoster)));
  action('#rebuild-rotation', () => {
    const rebuilt = seasonSim.rebuildRotation(save, Number(document.querySelector('#rotation-size').value));
    reset(rebuilt.order, rebuilt.minutes);
  });
  action('#repair-rotation', () => {
    const repaired = seasonSim.repairRotation(save);
    reset(repaired.order, repaired.minutes);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      seasonSim.setPlan(save, minutes, depth(), slots);
      save = seasonSim.load();
      message = 'Rotation saved for upcoming games.';
    } catch (error) { message = error.message; }
    preview();
  });
  draw();
}

function coachingGameplan() {
  const save = seasonSim.load();
  if (!save) { coaching(); return; }
  const roster = seasonSim.history(save).activeRoster;
  const plan = seasonSim.currentGameplan(save);
  const select = (name, label, options, current) => `<label>${label}<select name="${name}">${Object.entries(options).map(([value, text]) =>
    `<option value="${e(value)}" ${value === current ? 'selected' : ''}>${e(text)}</option>`).join('')}</select></label>`;
  app.innerHTML = `<a class="back" href="#coaching">← Rotation and minutes</a>
    <header class="rotation-heading">${logo(teams.get(save.team))}<div class="eyebrow">COACHING · ${e(save.team)}</div><h1>Gameplan</h1></header>
    <form class="panel gameplan-form">
      <h2>Team strategy</h2><div class="toolbar">
        ${select('play', 'Offensive focus', seasonSim.castPlays, plan.play)}
        ${select('tempo', 'Tempo', { Slow: 'Slow', Average: 'Average', Fast: 'Fast' }, plan.tempo)}
        ${select('defense', 'Defensive focus', seasonSim.castDefenses, plan.defense)}
      </div>
      <h2>Scoring priorities</h2><p class="note">Rank up to three players to receive more scoring opportunities when they play.</p>
      ${castTable(['Player', 'First', 'Second', 'Third'], [{ id: '', name: 'No preference' }, ...roster].map(player => [
        e(player.name), ...[0, 1, 2].map(i => `<input type="radio" name="priority-${i}" value="${e(player.id)}" aria-label="${e(player.name)} · priority ${i + 1}" ${(plan.scoring[i] ?? '') === player.id ? 'checked' : ''}>`)
      ]))}
      <div class="toolbar"><button type="submit">Save gameplan</button><span role="status"></span></div>
    </form>`;
  const form = app.querySelector('form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const scoring = [0, 1, 2].map(i => data.get('priority-' + i));
    const feedback = form.querySelector('[role="status"]');
    try {
      seasonSim.setGameplan(seasonSim.load(), { play: data.get('play'), defense: data.get('defense'), tempo: data.get('tempo'), scoring });
      feedback.textContent = 'Gameplan saved.';
    } catch (error) { feedback.textContent = error.message; }
  });
}

function playoffBracket(season) {
  const { bracket, results, save } = season;
  if (!bracket?.rounds.length) return '';
  const active = save.year === uiYear && !bracket.champion;
  const card = (match, round) => {
    if (!match) return `<article class="bracket-card bracket-pending">${active
      ? `<button type="button" data-playoff-round="${round}">Awaiting matchup</button>` : 'Awaiting matchup'}</article>`;
    const games = results.filter(game => game.playoffRound === round && [game.home, game.away].includes(match.high));
    const club = (code, wins) => `<div class="bracket-team ${match.winner === code ? 'bracket-winner' : ''}">
      <span>${bracket.seeds[code]}</span>${logo(teams.get(code))}${active && !match.winner
        ? `<button type="button" data-playoff-round="${round}" data-playoff-team="${e(code)}">${e(code)}</button>`
        : `<a href="#team/${e(code)}">${e(code)}</a>`}<strong>${wins}</strong></div>`;
    return `<article class="bracket-card">${club(match.high, match.highWins)}${club(match.low, match.lowWins)}
      ${games.length ? `<details><summary>${match.winner ? e(match.winner) + ' advances' : 'Series games'}</summary>
        ${games.map(game => gameLink(game, save.year)).join('')}</details>` : '<p>Upcoming</p>'}</article>`;
  };
  const column = (conference, round, side) => {
    const matches = bracket.rounds[round]?.filter(match => match.conference === conference) ?? [];
    return `<section class="bracket-column bracket-${side}"><h3>${postseason.rounds[round]}</h3>
      <div class="bracket-matchups">${Array.from({ length: 4 >> round }, (_, i) => card(matches[i], round)).join('')}</div></section>`;
  };
  return `<section><h2>Playoff bracket</h2><p class="note">Open a series to see the completed games and box scores.</p>
    <div class="bracket-scroll panel" tabindex="0" aria-label="Scrollable playoff bracket"><div class="bracket-grid">
      <h3 class="bracket-west-label">Western Conference</h3><h3 class="bracket-finals-label">Championship</h3><h3 class="bracket-east-label">Eastern Conference</h3>
      ${[0, 1, 2].map(round => column('West', round, 'west')).join('')}
      <section class="bracket-column bracket-finals"><h3>NBA Finals</h3><div class="bracket-matchups">${card(bracket.rounds[3]?.[0], 3)}
        ${bracket.champion ? `<p class="bracket-champion">Champion · ${e(teams.get(bracket.champion).name)}</p>` : ''}</div></section>
      ${[2, 1, 0].map(round => column('East', round, 'east')).join('')}
    </div></div></section>`;
}

function offseasonProposalName(proposal) {
  const labels = {
    lottery: 'Equal lottery weights', 'standard-lottery': 'Standard lottery weights',
    deadline: 'Later trade deadline', 'earlier-deadline': 'Earlier trade deadline', 'no-deadline': 'Remove trade deadline',
    'standard-deadline': 'Standard trade deadline', 'one-challenge': 'One challenge per game',
    'two-challenges': 'Second challenge after success', 'no-award-minimum': 'Remove games-played threshold',
    'restore-award-minimum': 'Restore games-played threshold',
    'champion-last': 'Defending champion’s original pick goes last in round one', 'standard-draft-order': 'Standard draft order',
  };
  const [, round, length] = proposal.split('-');
  return labels[proposal] ?? (proposal.startsWith('playoff-')
    ? ['First round', 'Second round', 'Conference finals', 'NBA Finals'][Number(round)] + ' · Best of ' + length : proposal);
}

function offseasonHall(save, season, open = false) {
  const eligible = Object.entries(save.retirements ?? {}).filter(([, entry]) => save.year - entry.year >= 2);
  const rows = eligible.flatMap(([id, entry]) => {
    const player = season.profiles.get(id);
    if (!player) return [];
    const honorCounts = new Map();
    const add = (label, count = 1) => honorCounts.set(label, (honorCounts.get(label) ?? 0) + count);
    for (const honor of nbaPlayerHonors(id)) add(honor.label, honor.count ?? 1);
    const seasons = save.pastSeasons.slice(0, entry.year + 1).map(archive => seasonSim.history(archive));
    for (const state of seasons) for (const honor of careerHonors(state, id)) add(honor);
    const nba = nbaCareerTotals(nbaCareerRecords(player, save).regular);
    const simulated = careerTotals(seasons.flatMap(state => careerGames(state.results, id)).filter(game => game.segment === 'Regular season'));
    const totals = ['GP', 'PTS', 'REB', 'AST', 'STL', 'BLK'].map(stat => {
      if (!Number.isFinite(nba?.[stat]) && player.draft?.year < 2027) return '—';
      return ((nba?.[stat] ?? 0) + (simulated[stat] ?? 0)).toLocaleString();
    });
    if (!(honorCounts.get('MVP') || honorCounts.get('Most Valuable Player') || honorCounts.get('NBA Finals MVP') || (honorCounts.get('All-Star') ?? 0) >= 7)) return [];
    return [[`<a href="#player/${e(id)}">${e(player.name)}</a>`, seasonLabel(entry.year + 2),
      ...totals, e([...honorCounts].map(([label, count]) => count + '× ' + label).join(' · '))]];
  });
  return `<details class="panel" ${open ? 'open' : ''}><summary>Franchise Hall of Fame</summary>
    ${rows.length ? castTable(['Player', 'Class', 'GP', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'Career honors'], rows) : '<p>No franchise inductees yet.</p>'}
    <p class="note">Players become eligible after two full seasons away. Induction uses a simulator career-honors threshold.</p></details>`;
}

function playoffs(season, offseasonOnly = false, offseasonStep = '') {
  if (!season) {
    operationsPage('Playoffs and awards', 'Start a franchise to begin the regular season.', '');
    return;
  }
  const { save, bracket, awards, playoffAwards, selections } = season;
  if (offseasonOnly && (!bracket?.champion || save.market?.open)) {
    operationsPage('Offseason events', save.market?.open ? 'The free agency stage is open.' : 'Offseason events open after the Finals.',
      save.market?.open ? '<a href="#free-agency">Continue free agency →</a>' : '<a href="#playoffs">View playoffs →</a>');
    return;
  }
  const archived = save.year !== uiYear;
  const year = save.year;
  const teamName = code => e(teams.get(code).name);
  const names = { mvp: 'Most Valuable Player', rookie: 'Rookie of the Year', dpoy: 'Defensive Player of the Year',
    mostImproved: 'Most Improved Player', sixthMan: 'Sixth Man of the Year', clutch: 'Clutch Player of the Year',
    eastFinals: 'Larry Bird Eastern Conference Finals MVP', westFinals: 'Magic Johnson Western Conference Finals MVP',
    finals: 'Bill Russell NBA Finals MVP' };
  const playerLinks = ids => ids.map(id => `<a href="#player/${e(id)}">${e(playersById.get(id).name)}</a>`).join(', ');
  const awardRow = (label, value) => `<div><dt>${label}</dt><dd>${value || 'No eligible players'}</dd></div>`;
  const teamAwards = (name, ids, count) => Array.from({ length: count }, (_, i) =>
    awardRow(`${name} ${['First', 'Second', 'Third'][i]} Team`, playerLinks(ids.slice(i * 5, i * 5 + 5)))).join('');
  const playIn = bracket?.playIn;
  const title = bracket?.champion ? `${teams.get(bracket.champion).name} win the championship`
    : bracket && bracket.rounds.length ? 'Follow every best-of-seven series.'
      : playIn ? 'Four teams per conference compete for the last two playoff seeds.'
        : 'The top six teams per conference qualify directly. Teams ranked seventh through tenth enter the play-in.';
  const options = bracket?.champion && !archived ? [...teamFinance.report(save, season).contracts]
    .filter(([id, { deal }]) => !save.extensions?.[id] && teamFinance.nextOption(deal) === 'Team option') : [];
  const deadlineOffset = save.tradeDeadlineOffset ?? (save.laterTradeDeadline ? 7 : 0);
  const draftStatus = !save.draftRoom ? 'Ready' : save.draftRoom.picks.length < save.draftRoom.order.length ? 'In progress' : 'Complete';
  operationsPage(offseasonOnly ? `${seasonLabel(year)} offseason` : `${seasonLabel(year)} playoffs and awards`,
    offseasonOnly ? 'Review the offseason events before opening free agency.' : title,
    `${offseasonOnly ? '' : `${playIn ? `<section><h2>Play-In Tournament</h2><div class="division-grid">
      ${playIn.map(entry => `<article class="panel"><h3>${entry.conference}</h3><div class="table-wrap"><table>
        <thead><tr><th>Game</th><th>Matchup</th><th>Result</th></tr></thead><tbody>${entry.games.map(match => `<tr>
          <td>${match.label}</td><td>${teamName(match.away)} at ${teamName(match.home)}</td><td>${match.result
          ? `<a href="#game/${e(match.result.id)}/${year}">${teamName(match.winner)} wins · ${match.result.awayScore}–${match.result.homeScore}</a>`
          : !archived && season.today.some(([home, away]) => home === match.home && away === match.away)
            ? `<button type="button" data-playoff-round="-1" data-playoff-team="${e(match.home)}">Game options</button>` : 'Scheduled'}</td></tr>`).join('')}</tbody></table></div></article>`).join('')}</div></section>` : ''}
    ${bracket && !bracket.champion && !archived ? '<p><button type="button" data-playoff-round="">Postseason simulation options</button></p>' : ''}
    ${awards ? `<p><a href="#performance-awards/regular/${year}">Review performance awards →</a>
      ${bracket?.champion ? ` · <a href="#performance-awards/postseason/${year}">Review postseason MVPs →</a>` : ''}</p>` : ''}
    ${playoffBracket(season)}
    ${awards ? `<section><h2>Regular-season awards</h2><dl class="panel bio">
      ${Object.entries(names).filter(([key]) => awards[key]).map(([key, label]) => awardRow(label, playerLinks(awards[key]))).join('')}
      ${awards.coach?.map(code => awardRow('Coach of the Year', e(nbaCoaches[code].coaches.find(coach => coach.title === 'Head Coach').name)
        + ' · ' + teamName(code))).join('') ?? ''}
      ${awards.executive?.map(code => awardRow('Basketball Executive of the Year', teamName(code) + ' front office')).join('') ?? ''}
      ${teamAwards('All-NBA', awards.allNBA, 3)}${teamAwards('All-Defensive', awards.allDefense, 2)}
      ${awards.allRookie ? teamAwards('All-Rookie', awards.allRookie, 2) : ''}
    </dl></section>` : ''}
    ${selections.allStar.length || awards?.allStar.length ? `<section><h2>All-Star selections</h2><dl class="panel bio">
      ${selections.allStar.length ? awardRow('Starters', playerLinks(selections.allStarStarters))
        + awardRow('Reserves', playerLinks(selections.allStarReserves)) : awardRow('Selections', playerLinks(awards.allStar))}
    </dl></section>` : ''}
    ${playoffAwards && Object.values(playoffAwards).some(ids => ids.length) ? `<section><h2>Playoff awards</h2><dl class="panel bio">
      ${Object.entries(playoffAwards).filter(([, ids]) => ids.length).map(([key, ids]) => awardRow(names[key], playerLinks(ids))).join('')}
    </dl></section>` : ''}
    <details class="award-note"><summary>Awards awaiting game systems</summary><p class="note">The Hustle Award needs tracking data.
      Sportsmanship, Teammate of the Year, Citizenship, Social Justice Champion, and Community Assist need player and community activity.
      All-Star Game MVP and the NBA Cup awards need their respective events.</p></details>
    <p><a class="back" href="#scores/${year}">Browse ${seasonLabel(year)} box scores →</a></p>`}
    ${bracket?.champion && !archived && !offseasonOnly ? '<p><a class="primary-link" href="#offseason">Open offseason events →</a></p>' : ''}
    ${bracket?.champion && !archived && offseasonOnly ? `<section><h2>Offseason event list</h2>
      <p><a class="primary-link" href="#draft/lottery">Open Draft Lottery →</a> Complete or delegate the draft before submitting contract decisions.</p>
      <nav aria-label="Offseason events" class="panel">
        <ol>
          <li><button type="button" id="jump-retirements">Player and staff retirements</button> · Review before advancing</li>
          <li><a href="#nba-history/jerseys/${e(save.team)}">Jersey history</a> · Available</li>
          <li><button type="button" id="jump-meeting">League meeting</button> · Vote before advancing</li>
          <li><a href="#draft/lottery">Draft and lottery</a> · ${draftStatus}</li>
          <li><button type="button" id="jump-options">Team options</button> · ${options.length ? options.length + ' to review' : 'No pending team options'}</li>
          <li>Free agency · Opens after you advance</li>
        </ol>
      </nav>
      <p><a href="#nba-history/jerseys/${e(save.team)}">Retired jerseys →</a></p>
      ${offseasonStep ? '' : '<p><a href="#offseason/hall">Hall of Fame inductees →</a></p>'}
      ${gmCareer.expiring(save) ? `<p><a class="primary-link" href="#gm-offers">Review GM job offers</a>${save.nextGmJob ? ` · Taking over ${e(teams.get(save.nextGmJob.team).name)} when free agency opens` : ""}</p>` : ""}
      <form class="panel toolbar" id="rollover-form">
        <fieldset id="offseason-meeting"><legend>League meeting</legend>
          ${`
            <p>Approved changes take effect next season. Approval requires 23 votes.</p>
            <label>Proposal <select name="league-proposal">
              ${save.equalLotteryOdds ? '' : '<option value="lottery">Equal lottery weights for eligible teams</option>'}
              ${save.noTradeDeadline || deadlineOffset === 7 ? '' : '<option value="deadline">Set the deadline one week after the standard date</option>'}
              ${save.noTradeDeadline || deadlineOffset === -7 ? '' : '<option value="earlier-deadline">Set the deadline one week before the standard date</option>'}
              ${save.noTradeDeadline ? '' : '<option value="no-deadline">Allow trades through the end of the regular season</option>'}
              ${save.singleCoachChallenge ? '' : '<option value="one-challenge">Limit SimCast coaches to one challenge per game</option>'}
              ${save.singleCoachChallenge ? '<option value="two-challenges">Restore a second challenge after a successful first challenge</option>' : ''}
              ${save.noTradeDeadline || deadlineOffset ? '<option value="standard-deadline">Restore the standard trade deadline</option>' : ''}
              ${save.equalLotteryOdds ? '<option value="standard-lottery">Restore standard lottery weighting</option>' : ''}
              ${save.noAwardMinimum ? '<option value="restore-award-minimum">Restore the games-played threshold for major awards</option>' : '<option value="no-award-minimum">Remove the games-played threshold for major awards</option>'}
              ${save.championDraftsLast ? '<option value="standard-draft-order">Restore standard first-round draft order</option>' : '<option value="champion-last">Place the defending champion’s original pick last in round one</option>'}
              <optgroup label="Playoff series length">${['First round', 'Second round', 'Conference finals', 'NBA Finals'].flatMap((round, index) =>
                [1, 3, 5, 7].filter(length => length !== (save.seriesLengths?.[index] ?? 7)).map(length =>
                  '<option value="playoff-' + index + '-' + length + '">' + round + ' · ' + (length === 1 ? 'Single elimination' : 'Best of ' + length) + '</option>')).join('')}</optgroup>
              <option value="">Skip this meeting</option>
            </select></label>
            <label>Your vote <select name="league-vote"><option value="no">Reject</option><option value="yes">Approve</option></select></label>
            <a href="#team-intel">Contact GMs and review Team Intel →</a><label>Lobby GMs · Select any number <select name="league-lobby" multiple size="6"><option value="">No lobbying</option>
              ${league.teams.filter(team => team.code !== save.team).map(team =>
                `<option value="${e(team.code)}">${e(team.name)} · ${worldRelationships.gmTrust(save, team.code)}/100 trust</option>`).join('')}
            </select></label>`}
          ${save.leagueMeetings?.length ? `<details><summary>Previous league votes</summary>
            ${save.leagueMeetings.slice().reverse().map(result => `<details><summary>${seasonLabel(result.year)} ·
              ${offseasonProposalName(result.proposal)}
              · ${result.passed ? 'Passed' : 'Rejected'} · ${result.yes}–${result.no}</summary>
              <ul>${result.votes.map(vote => `<li>${teamName(vote.code)} · ${vote.yes ? 'Yes' : 'No'}${vote.swayed ? ' · Swayed by lobbying' : ''}</li>`).join('')}</ul></details>`).join('')}
            </details>` : ''}
        </fieldset>
        <fieldset><legend>Staff retirements</legend>
          ${staffSim.retirementCandidates(save).map(({ code, role, person }) =>
            `<label>${e(person.name)} · ${e(code)} · ${e(role)}
              <select name="retirement:${e(person.id)}"><option value="retire">Confirm retirement</option>
              <option value="override">Override retirement</option></select></label>`).join('') || '<p>No staff retirements this offseason.</p>'}
        </fieldset>
        <fieldset id="offseason-retirements"><legend>Player retirements</legend>
          ${seasonSim.retirementCandidates(save, season).map(({ player, team, age, deal, finalSeason, requestsTour }) =>
            `<label>${e(player.name)} · ${e(team)} · Age ${age}
              ${requestsTour ? ' · Requests a farewell season' : ''}
              ${`<select name="retirement:${e(player.id)}">
                <option value="retire">${finalSeason ? 'Finish farewell and retire' : 'Confirm retirement'}</option>
                ${team === save.team && relationships.jerseyNumber(relationships.jersey(save, player.id)) !== null && String(relationships.jersey(save, player.id)) !== '6' ? '<option value="retire-jersey">Retire player and jersey</option>' : ''}
                ${!finalSeason ? '<option value="override">Override retirement</option>' : ''}
                ${team === save.team && !finalSeason ? `<option value="farewell">${requestsTour ? 'Accept farewell request' : 'Offer final season'} · ${money(deal.salary)}</option>` : ''}
              </select>`}</label>`).join('') || '<p>No retirements this offseason.</p>'}
        </fieldset>
        <fieldset id="offseason-options"><legend>Team options</legend>
        ${options.map(([id, { deal }]) => `<label class="release-check"><input type="checkbox" name="decline" value="${e(id)}">
          Decline ${e(playersById.get(id).name)}’s ${money(teamFinance.nextSalary(deal))} team option</label>`).join('') || '<p>No team options due.</p>'}</fieldset>
        <fieldset><legend>Qualifying offers</legend>
          ${seasonSim.qualifyingCandidates(save, season).filter(item => item.code === save.team).map(item =>
            `<label><input type="checkbox" name="qualify" value="${e(item.id)}"> Tender ${e(season.profiles.get(item.id)?.name)}
              a one-year qualifying offer at ${money(item.deal.salary)}</label>`).join('') || '<p>No eligible expiring contracts.</p>'}
          <p>A tender grants matching rights. Qualifying salary uses the simulator’s modeled scale.</p>
        </fieldset>
        <button type="submit" ${save.draftRoom?.picks.length === save.draftRoom?.order.length && save.draftRoom ? '' : 'disabled'}>Submit options and qualifying offers</button><span id="rollover-feedback" role="alert"></span>
      </form><p class="note">Bank balances, player development, and continuing contracts carry forward. Expiring players and players whose options are declined enter free agency.</p></section>` : ''}
    ${save.pastSeasons?.length ? `<section><h2>Past seasons</h2><ul>${save.pastSeasons.map(entry =>
      `<li><a href="#playoffs/${entry.year}">${seasonLabel(entry.year)} bracket and awards →</a></li>`).join('')}</ul></section>` : ''}`);
  const offseasonForm = document.querySelector('#rollover-form');
  if (offseasonForm) {
    const steps = ['retirements', 'meeting', 'options'];
    const titles = { retirements: 'Player, staff and jersey retirements', meeting: 'League meetings', options: 'Team options and qualifying offers' };
    const fields = [...offseasonForm.querySelectorAll('fieldset')];
    const stageFields = { retirements: [fields[1], fields[2]], meeting: [fields[0]], options: [fields[3], fields[4]] };
    const key = 'offseason-decisions:' + save.team + ':' + save.year + ':' + save.seed;
    const draft = JSON.parse(sessionStorage.getItem(key) ?? '[]');
    for (const input of offseasonForm.elements) {
      if (!input.name || !draft.length) continue;
      const values = draft.filter(([name]) => name === input.name).map(([, value]) => value);
      if (input.multiple) for (const option of input.options) option.selected = values.includes(option.value);
      else if (input.type === 'checkbox') input.checked = values.includes(input.value);
      else if (values.length) input.value = values[0];
    }
    offseasonForm.addEventListener('change', () => sessionStorage.setItem(key, JSON.stringify([...new FormData(offseasonForm)])));
    const stage = steps.includes(offseasonStep) ? offseasonStep : '';
    for (const field of fields) field.hidden = !stageFields[stage]?.includes(field);
    const submit = offseasonForm.querySelector('[type="submit"]');
    submit.hidden = stage !== 'options';
    offseasonForm.hidden = !stage;
    if (stage === 'meeting') {
      const preview = document.createElement('section');
      fields[0].append(preview);
      const refreshVotes = () => {
        const form = new FormData(offseasonForm);
        const proposal = form.get('league-proposal');
        if (!proposal) { preview.innerHTML = ''; return; }
        const result = seasonSim.leagueMeeting(save, form.get('league-vote') === 'yes', form.getAll('league-lobby'), proposal);
        preview.innerHTML = '<h2>Projected vote</h2><p>' + result.yes + ' yes · ' + result.no + ' no · ' +
          (result.passed ? 'Projected to pass' : 'Projected to be rejected') + '</p>' +
          castTable(['Team', 'Vote'], result.votes.map(row => [e(teamName(row.code)), row.yes ? 'Yes' : 'No']));
      };
      offseasonForm.addEventListener('change', refreshVotes);
      refreshVotes();
    }
    if (stage === 'retirements') {
      const jerseys = Object.entries(save.retiredJerseys?.[save.team] ?? {});
      fields[2].insertAdjacentHTML('afterend', '<section><h2>Retired jerseys</h2>' +
        (jerseys.length ? castTable(['Number', 'Player', 'Action'], jerseys.map(([number, player]) =>
          [e(number), e(player.name), '<button type="button" data-offseason-jersey="' + e(number) + '">Unretire</button>'])) : '<p>No jerseys retired during this franchise.</p>') +
        '<a href="#nba-history/jerseys/' + e(save.team) + '">Manage historical retired jerseys →</a></section>');
      offseasonForm.querySelectorAll('[data-offseason-jersey]').forEach(button => button.onclick = () => {
        if (!window.confirm('Unretire this jersey number?')) return;
        seasonSim.unretireJersey(save, button.dataset.offseasonJersey);
        render();
      });
    }
    if (stage) {
      app.querySelector('h1').textContent = titles[stage];
      const eventList = app.querySelector('nav[aria-label="Offseason events"]');
      eventList.hidden = true;
      eventList.previousElementSibling.hidden = true;
      eventList.parentElement.querySelector('h2').hidden = true;
      if (stage !== 'options') {
        const next = document.createElement('button');
        next.type = 'button';
        next.textContent = stage === 'retirements' ? 'Continue to Hall of Fame' : 'Continue to Draft Lottery';
        next.onclick = () => {
          if (window.confirm('Confirm these decisions and continue?')) location.hash = stage === 'retirements' ? '#offseason/hall' : '#draft/lottery';
        };
        offseasonForm.append(next);
      }
    }
  }
  for (const section of ['retirements', 'meeting', 'options']) {
    document.querySelector('#jump-' + section)?.addEventListener('click', () => {
      if (window.confirm('Open this offseason stage?')) location.hash = '#offseason/' + section;
    });
  }
  document.querySelector('#rollover-form')?.addEventListener('submit', event => {
    event.preventDefault();
    if (!save.draftRoom || save.draftRoom.picks.length !== save.draftRoom.order.length) return;
    if (!window.confirm('Submit these decisions and review leaguewide option results?')) return;
    try {
      const form = new FormData(event.currentTarget);
      const choices = Object.fromEntries([...form].filter(([key]) => key.startsWith('retirement:'))
        .map(([key, value]) => [key.slice('retirement:'.length), value]));
      seasonSim.rollover(save, form.getAll('decline'), choices, { proposal: form.get('league-proposal'), vote: form.get('league-vote'), lobby: form.getAll('league-lobby'), timedMarket: true }, form.getAll('qualify'));
      location.hash = '#option-results';
    } catch (error) {
      document.querySelector('#rollover-feedback').textContent = error.message;
    }
  });
  bindPlayoffActions(season, archived);
}

function restartFranchise(save) {
  if (save.gm) {
    operationsPage("Start a new franchise", "Create a new GM career in a separate save slot.", '<p><a class="primary-link" href="#new-career">Create a new career</a></p>');
    return;
  }
  operationsPage('Restart franchise', `Replace your ${teams.get(save.team).name} save with a new ${seasonLabel(0)} franchise.`,
    `<section><form id="restart-franchise" class="panel toolbar">
      <label>Choose a team <select name="team" required>${[...teams.values()].sort((a, b) => a.name.localeCompare(b.name)).map(team =>
        `<option value="${e(team.code)}"${team.code === save.team ? ' selected' : ''}>${e(team.name)}</option>`).join('')}</select></label>
      <label class="release-check"><input type="checkbox" name="confirm" required> Replace my current save and its season history</label>
      <button type="submit">Restart franchise</button><span id="restart-feedback" role="alert"></span>
    </form><p class="note">This replaces the selected franchise save in this browser.</p></section>
    <p><a class="back" href="#franchise">Cancel and return to franchise</a></p>`);
  document.querySelector('#restart-franchise').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!data.has('confirm')) return;
    try {
      seasonSim.restart(save, data.get('team'));
      location.hash = '#franchise';
    } catch (error) {
      document.querySelector('#restart-feedback').textContent = error.message;
    }
  });
}

function frontOfficeInbox(save) {
  const state = seasonSim.history(save);
  const report = teamFinance.report(save, state);
  const interview = relationships.interview(save, state);
  const scoutReport = draftOps.prospects(save).filter(prospect => save.prospectNotes?.[prospect.id]?.scouted)
    .sort((a, b) => (save.prospectNotes[b.id].lastScoutedDay ?? 0) - (save.prospectNotes[a.id].lastScoutedDay ?? 0));
  const budgetLimit = save.cfoBudget?.[save.team]?.players;
  const nextPayroll = [...report.contracts].reduce((sum, [id, { deal }]) => {
    const next = save.extensions?.[id];
    return sum + (next?.salary ?? (deal.years > 1 ? deal.salarySchedule?.[1]?.[0] ?? deal.salary + (deal.raise ?? 0) : 0));
  }, 0);
  const currentMinutes = save.plans.at(-1)?.minutes ?? {};
  const reducedRoles = state.activeRoster.filter(player => {
    const stats = state.averages.get(player.id);
    return (stats?.GP ?? 0) >= 10 && (currentMinutes[player.id] ?? stats.MIN) <= stats.MIN - 10
      && (state.health.get(player.id)?.durability ?? 0) > 50;
  });
  const trustedSellers = !save.market?.open && save.day <= seasonSim.tradeDeadlineFor(save)
    ? Object.entries(save.teamDirections ?? {}).filter(([code, direction]) =>
      code !== save.team && ['Selling', 'Rebuilding'].includes(direction) && worldRelationships.gmTrust(save, code) >= 65)
    : [];
  const firstCalls = trustedSellers.length ? cpuTeams.intel(save, state, code =>
    trustedSellers.some(([seller]) => seller === code) ? teamFinance.report(save, state, code).contracts : null) : null;
  const notes = [
    save.rotationAlert && ['Coaching', 'Review the rotation after an availability change.', '#coaching'],
    save.market?.open && ['Free agency', 'Review offers and results.', '#free-agency'],
    interview && ['Press interview', interview.question, '#relationship-talk/reporter-' + save.team],
    report.available < 25_000_000 && ['CFO', 'Available cash after commitments is ' + money(report.available), '#finances'],
    budgetLimit != null && nextPayroll >= budgetLimit * 0.9 && ['CFO', 'Next season’s committed payroll is ' + money(nextPayroll) + ' against a ' + money(budgetLimit) + ' allocation.', '#cfo-budget'],
    gmCareer.expiring(save) && state.bracket?.champion && ['GM contract', 'Review your next job offers.', '#gm-offers'],
    scoutReport.length && ['Scouting', 'Recent reports near your projected picks include ' +
      scoutReport.slice(0, 3).map(prospect => prospect.name).join(', ') + '.', '#draft-scouting/reports'],
    ...reducedRoles.map(player => ['Player meeting', player.name + ' wants to discuss a reduction in minutes.', '#relationship-talk/' + player.id]),
    ...trustedSellers.flatMap(([code]) => {
      const player = firstCalls.get(code).shopping[0];
      return player ? [['First call', teams.get(code).name + ' is willing to discuss ' + player.name + '.', '#team-intel/' + code]] : [];
    }),
    ...(save.relationships?.promises ?? []).filter(item => item.year === save.year).map(item => [
      'Player commitment', (state.profiles.get(item.id)?.name ?? item.id) + ' · ' + item.kind + ' · ' + item.status,
      '#relationship-talk/' + item.id]),
  ].filter(Boolean);
  operationsPage('Front office inbox', teams.get(save.team).name, `
    <section class="panel facility-card"><h2>Decisions and updates</h2>
    ${notes.length ? notes.map(([title, message, href]) => `<p><a href="${e(href)}">${e(title)}</a> · ${e(message)}</p>`).join('') : '<p>You’re caught up.</p>'}</section>
    <section class="panel facility-card"><h2>${state.bracket?.champion ? 'Ownership season review' : 'Ownership season goals'}</h2>
    ${chatThread(save, teams.get(save.team).name + ' ownership', gmCareer.ownerTrust(save, state),
      state.bracket?.champion ? 'Let’s review our goals.' : 'Here’s what we want to see this season. What can you commit to?')}
    <p>Owner trust <strong>${gmCareer.ownerTrust(save, state)}/100</strong></p>
    ${save.day < gmCareer.goalsDeadline ? '<p class="note">Respond during the first 14 franchise days. A guarantee adds 8 trust now and costs 16 if missed. A tough commitment adds 4 now and costs 8 if missed. Declining keeps trust steady.</p>' : ''}
    ${gmCareer.goals(save, state).map(goal => `<article><h3>${e(goal.name)}</h3>
      <p>${e(goal.progress)}${goal.finished ? ' · ' + (goal.met ? 'Achieved' : 'Missed') : ''}</p>
      ${goal.choice != null ? `<p>${e(gmCareer.commitments[goal.choice])} · ${goal.delta >= 0 ? '+' : ''}${goal.delta} trust</p>` :
        save.day >= gmCareer.goalsDeadline ? '<p>No commitment made.</p>' : `<div class="franchise-actions">${gmCareer.commitments.map((label, choice) =>
          `<button data-owner-goal="${goal.id}" data-choice="${choice}">${e(label)}</button>`).join('')}</div>`}</article>`).join('')}
    <p id="save-error" role="alert"></p></section>
    <section class="panel facility-card"><h2>GM career timeline</h2>
    ${[...(save.pastSeasons ?? []), save].reverse().map(season => {
      const moves = season.financeActions.filter(action => ['trade', 'signing'].includes(action.type)
        && [action.team ?? season.team, action.otherTeam].includes(season.team));
      for (const [key, negotiation] of Object.entries(season.negotiations ?? {})) {
        if (key.startsWith('extension:') && negotiation.accepted && negotiation.team === season.team) {
          moves.push({ type: 'extension', id: key.slice('extension:'.length), day: negotiation.day });
        }
      }
      moves.sort((a, b) => b.day - a.day);
      return `<details><summary>${seasonLabel(season.year)} · ${e(season.team)} · ${moves.length} roster moves</summary>
      ${season.ownerReview ? `<p>Final owner trust ${season.ownerReview.trust}/100</p>${season.ownerReview.goals.map(goal =>
        `<p>${e(goal.name)} · ${goal.met ? 'Achieved' : 'Missed'} · ${goal.delta >= 0 ? '+' : ''}${goal.delta} trust</p>`).join('')}` : ''}
      ${moves.map(action => {
        const ids = action.type === 'trade' ? seasonSim.tradePlayers(action).flat() : [action.id];
        const names = ids.map(id => state.profiles.get(id)?.name ?? id);
        return `<p>Day ${action.day + 1} · ${e(action.type)} · ${e(names.join(', ') || action.otherTeam || '')}</p>`;
      }).join('')}</details>`;
    }).join('')}
    ${gmCareer.honors(save, state).map(([year, label]) => `<p>${seasonLabel(year)} · ${e(label)}</p>`).join('')}</section>`);
  for (const button of document.querySelectorAll('[data-owner-goal]')) {
    button.onclick = () => updateFranchise(() => seasonSim.answerOwnerGoal(save, button.dataset.ownerGoal, Number(button.dataset.choice)));
  }
}

function franchise() {
  let save;
  try {
    save = seasonSim.load();
  } catch {
    app.innerHTML = '<section class="hero"><h1>Franchise save unavailable</h1><p>The browser could not read the local save.</p></section>';
    return;
  }
  if (!save) return franchiseEntry();

  const team = teams.get(save.team);
  const state = seasonSim.history(save);
  const { records, results, bracket, today: slate, teamOveralls } = state;
  if (!save.market?.open && !save.rotationAlert &&
      (save.day === seasonSim.playoffStart && !save.awardsReviewed || bracket?.champion && !save.championshipReviewed)) {
    postseasonLanding(save);
    return;
  }
  const complete = Boolean(bracket?.champion);
  const canCast = slate.some(pair => pair.includes(save.team));
  const gameActions = `<a class="primary-link" href="#calendar">${bracket ? 'Open playoff bracket' : 'Open calendar'}</a>
    ${canCast ? `<a class="primary-link" href="#simcast">${save.simcast ? 'Resume SimCast' : 'SimCast game'}</a>` : ''}
    <button id="advance-day" ${save.simcast ? 'disabled' : ''}>Sim one day</button>`;
  const marketOpen = Boolean(save.market?.open);
  const day = complete ? save.day - 1 : save.day;
  const date = simDate(day);
  const lastGameDay = results.at(-1)?.day;
  const lastResults = results.filter(game => game.day === lastGameDay)
    .sort((a,b) => Number([b.home, b.away].includes(team.code)) - Number([a.home, a.away].includes(team.code))).slice(0, 5);
  const teamResults = results.filter(game => game.home === team.code || game.away === team.code).reverse();
  const record = code => `${records[code].wins}–${records[code].losses}`;
  const matchup = ([home, away]) => `${e(away)} at ${e(home)}`;
  app.innerHTML = `<section class="hero roster-hero">
    ${logo(team)}<div><div class="eyebrow">FRANCHISE MODE · ${seasonLabel()}</div>
    <h1>${e(team.name)}</h1><p>${record(team.code)} · ${overallText(teamOveralls.get(team.code))} · ${date} · ${marketOpen ? 'Offseason free agency' : complete ? 'Season complete'
      : bracket?.playIn && !bracket.rounds.length ? 'Play-In Tournament' : bracket ? 'Playoffs' : 'Regular season'}</p>
    ${save.gm ? `<p>GM · ${e(save.gm.name)} · ${money(save.gm.contract.salary)}/year · Signed through ${seasonLabel(save.gm.contract.startYear + save.gm.contract.years - 1)}</p>` : ""}
    <div class="franchise-actions">${complete ? '<a class="primary-link" href="#playoffs">Season summary</a><a href="#offseason">Offseason events →</a>'
      : marketOpen ? '<a class="primary-link" href="#free-agency">Manage free agency</a>'
        : save.handoff ? '<a class="primary-link" href="#season-handoff">Review season handoff</a>' : gameActions}
    </div><p id="save-error" role="alert"></p></div>
  </section>
  <p><a class="primary-link" href="#front-office-inbox">Front office inbox &amp; ownership goals →</a></p>
  ${franchiseMenu(team)}
  <div class="division-grid">
    <section class="panel"><h3>${complete ? 'Season complete' : 'Current day slate'}</h3>
      ${marketOpen ? '<p class="franchise-note">Close free agency to start the regular season.</p>' : slate.length ? `<ul class="slate">${slate.map(game =>
        `<li class="${game.includes(team.code) ? 'own-game' : ''}">${matchup(game)}</li>`).join('')}</ul>`
        : `<p class="franchise-note">${complete ? e(teams.get(bracket.champion).name) + ' won the championship.' :
          'League rest day. Advance to reach the next slate.'}</p>`}</section>
    ${relationships.interview(save, state) ? `<section class="panel facility-card"><h3>Press interview available</h3><a href="#relationship-talk/reporter-${e(save.team)}">Talk to the local reporter</a></section>` : ''}
    <section class="panel"><h3>${lastResults.length ? 'Latest results · ' + simDate(lastGameDay) : 'Latest results'}</h3>
      ${lastResults.length ? lastResults.map(game => gameLink(game, save.year, team.code)).join('') : '<p class="franchise-note">Advance the calendar to play the first slate.</p>'}
      <div class="facility-card"><a class="back" href="#scores">All league scores →</a></div></section>
  </div>
  ${teamResults.length ? `<h2>${e(team.code)} recent games</h2><section class="panel">${teamResults.slice(0, 5).map(game => gameLink(game, save.year, team.code)).join('')}</section>` : ''}
  <h2>Conference leaders</h2><p><a class="back" href="#standings">Full standings and filters →</a></p>
  <div class="division-grid">${['East', 'West'].map(conference =>
    `<section class="panel"><h3>${conference}</h3>${(bracket?.order ? bracket.order[conference].map(code => teams.get(code))
      : league.teams.filter(t => t.conference === conference).sort((a, b) => records[b.code].wins - records[a.code].wins || a.name.localeCompare(b.name))).slice(0, 4)
      .map(t => `<a class="team-row" href="#team/${e(t.code)}">${logo(t)}<strong>${e(t.name)}</strong>
      <span>${record(t.code)} · ${overallText(teamOveralls.get(t.code))}</span></a>`).join('')}</section>`).join('')}
  </div>`;
  document.querySelector('#advance-day')?.addEventListener('click', () =>
    updateFranchise(() => seasonSim.advance(save)));
}

function updateFranchise(action) {
  try {
    action();
  } catch {
    document.querySelector('#save-error').textContent = 'The browser could not save your franchise. Check that local storage is available.';
    return;
  }
  render();
}


function seasonHandoff(save) {
  if (!save.handoff || save.market?.open) {
    operationsPage('Season handoff', 'Review the handoff after closing offseason free agency.',
      '<a href="#calendar">Calendar</a> · <a href="#free-agency">Free agency</a>');
    return;
  }
  const state = seasonSim.history(save);
  const year = draftOps.draftYear(save);
  const defaultYear = draftOps.defaultClassYear(year);
  const classOptions = draftOps.libraryYears.map(sourceYear => '<option value="' + sourceYear + '"' +
    (sourceYear === defaultYear ? ' selected' : '') + '>' + e(draftOps.classLabel(sourceYear)) +
    (sourceYear === defaultYear ? ' (default)' : '') + '</option>').join('');
  const rows = [...state.profiles.values()].flatMap(player => {
    const before = save.handoff.previousRatings[player.id];
    const team = state.owners.get(player.id);
    if (!before || !team) return [];
    const after = { ...player.attributes, ...save.carriedRatings?.[player.id] };
    const changes = playerDevelopment.attributes.map(key => [key, after[key] - before[key]]);
    const delta = changes.reduce((sum, [, value]) => sum + value, 0) / changes.length;
    return [{ player, team, changes, delta, overall: seasonSim.baseOverall({ attributes: after }) }];
  });
  const change = value => (value > 0.005 ? '+' : '') + (Math.abs(value) < 0.005 ? '0.00' : value.toFixed(2));
  const teamOptions = [...teams.values()].map(team =>
    '<option value="' + e(team.code) + '">' + e(team.name) + '</option>').join('');
  operationsPage('Season handoff', 'Review the offseason changes and prepare for opening night.',
    '<section><h2>Player progression</h2><p>Changes compare last season’s opening ratings with ratings carried into this season.</p>' +
    '<label>Team <select id="handoff-team"><option value="">Entire league</option>' + teamOptions + '</select></label> ' +
    '<label>Sort <select id="handoff-sort"><option value="gain">Biggest gains</option><option value="decline">Biggest declines</option><option value="overall">Overall</option></select></label>' +
    '<div class="panel table-wrap progression-full"><table><thead><tr><th>Player</th><th>Team</th><th>OVR</th><th>Change</th><th>Attributes</th></tr></thead>' +
    '<tbody id="handoff-ratings"></tbody></table></div></section>' +
    '<section><h2>All-Star host</h2><p>The selected team earns a $1 million simulator bonus on All-Star Day.</p>' +
    '<label>Host team <select id="handoff-host">' + teamOptions + '</select></label> <button id="handoff-random-host">Random host</button></section>' +
    '<section><h2>' + year + ' draft class</h2><p>' + 'Choose a library class, edit its prospects, or import your own class.</p>' +
    '<label>Draft class <select id="handoff-source">' + classOptions + '</select></label><p id="handoff-source-note"></p><div class="franchise-actions">' +
    '<button id="handoff-edit">Edit class</button><button id="handoff-reset">Use default class</button>' +
    '<button id="handoff-export">Export class</button><label>Import class <input type="file" id="handoff-import" accept=".json,application/json"></label></div>' +
    '<div id="handoff-editor" hidden><p>Use PG, SG, SF, PF or C. Separate multiple positions with a slash.</p><div class="panel table-wrap" style="max-height:24rem"><table><thead><tr><th>Rank</th><th>Name</th><th>Origin</th><th>Positions</th><th>Age</th><th>Rating</th></tr></thead><tbody id="handoff-class"></tbody></table></div></div></section>' +
    '<div class="franchise-actions"><button id="handoff-finish">Open new season calendar</button></div><p id="handoff-feedback" role="status"></p>');
  const get = id => document.getElementById('handoff-' + id);
  const showRows = () => {
    const code = get('team').value;
    const sort = get('sort').value;
    get('ratings').innerHTML = rows.filter(row => !code || row.team === code)
      .sort((a, b) => sort === 'overall' ? b.overall - a.overall : sort === 'decline' ? a.delta - b.delta : b.delta - a.delta)
      .map(({ player, team, overall, delta, changes }) => '<tr><td><a href="#player/' + e(player.id) + '">' + e(player.name) + '</a></td><td>' + e(team) +
        '</td><td>' + overall.toFixed(2) + '</td><td>' + change(delta) + '</td><td><details><summary>View changes</summary>' +
        changes.map(([key, value]) => e(key) + ' ' + change(value)).join(' · ') + '</details></td></tr>').join('') ||
      '<tr><td colspan="5">No returning players.</td></tr>';
  };
  get('team').value = '';
  get('host').value = ({ 2027: 'PHX' })[year] ?? save.team;
  get('random-host').onclick = () => {
    const codes = [...teams.keys()].filter(code => code !== get('host').value);
    get('host').value = codes[Math.floor(Math.random() * codes.length)];
  };
  get('team').onchange = get('sort').onchange = showRows;
  showRows();
  get('source').value = String(defaultYear);
  const selectedYear = () => Number(get('source').value);
  const libraryClass = () => ({ year, players: draftOps.prospects({ ...save, customDraftClass: null }, selectedYear())
    .map(({ name, origin, positions, age, rating }) => ({ name, origin, positions, age: Number(age), rating: Math.round(rating * 100) / 100 })) });
  const selectClass = () => {
    get('editor').hidden = true;
    get('source-note').innerHTML = '<a href="' + e(draftOps.classSource(selectedYear())) + '">Source board</a> · ' +
      'Ratings and progression are modeled. Fictional prospects fill short boards.';
  };
  get('source').onchange = selectClass;
  selectClass();
  const draftSelection = () => get('editor').hidden ? null : draftOps.validateClass(save, {
    year, players: [...get('class').rows].map(row => {
      const [name, origin, positions, age, rating] = [...row.querySelectorAll('input')].map(input => input.value);
      return { name, origin, positions: positions.toUpperCase().split('/').map(position => position.trim()),
        age: Number(age), rating: Number(rating) };
    }),
  });
  const openEditor = value => {
    get('class').innerHTML = value.players.map((player, index) => {
      const fields = { Name: player.name, Origin: player.origin, Positions: player.positions.join('/'), Age: player.age, Rating: player.rating };
      return '<tr><th scope="row">' + (index + 1) + '</th>' + Object.entries(fields).map(([label, field]) =>
        '<td><input aria-label="' + label + ' for prospect ' + (index + 1) + '" value="' + e(field) + '"></td>').join('') + '</tr>';
    }).join('');
    get('editor').hidden = false;
  };
  get('edit').onclick = () => {
    if (get('editor').hidden) openEditor(libraryClass());
    get('class').querySelector('input')?.focus();
  };
  get('reset').onclick = () => {
    get('source').value = String(defaultYear);
    selectClass();
    get('import').value = '';
    get('feedback').textContent = 'Default draft class selected.';
  };
  get('import').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      openEditor(draftOps.validateClass(save, JSON.parse(await file.text())));
      get('feedback').textContent = 'Draft class loaded. Finish the handoff to apply it.';
    } catch (error) { get('feedback').textContent = error.message; }
    event.target.value = '';
  };
  get('export').onclick = () => {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(draftSelection() ?? libraryClass(), null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'draft-class-' + year + '.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { get('feedback').textContent = error.message; }
  };
  const handoffStages = ['team', 'host', 'source'].map(id => get(id).closest('section'));
  const finish = get('finish');
  if (handoffStages.every(Boolean)) {
    const headings = ['Player progression', 'All-Star host', 'Draft class'];
    let stage = 0;
    const next = document.createElement('button');
    finish.before(next);
    const show = () => {
      handoffStages.forEach((section, index) => section.hidden = index !== stage);
      app.querySelector('h1').textContent = headings[stage];
      next.textContent = 'Continue to ' + (headings[stage + 1] ?? '');
      next.hidden = stage === 2;
      finish.hidden = stage !== 2;
      window.scrollTo(0, 0);
    };
    next.onclick = () => {
      if (window.confirm('Confirm and continue to ' + headings[stage + 1] + '?')) { stage++; show(); }
    };
    show();
  }
  get('finish').onclick = () => {
    if (!window.confirm('Confirm your draft class and open the new season calendar?')) return;
    try {
      seasonSim.finishHandoff(save, get('host').value, draftSelection(), selectedYear());
      location.hash = '#calendar';
    } catch (error) { get('feedback').textContent = error.message; }
  };
}

function render() {
  if (renderedRoute !== undefined) routeScroll.set(renderedRoute, window.scrollY);
  const [page, id, fromTeam, extra] = location.hash.slice(1).split('/');
  if (!page || page === 'main' || ['quit-franchise', 'new-career'].includes(page)) seasonSim.quitSlot();
  let activeSave;
  try { activeSave = seasonSim.load(); uiYear = activeSave?.year ?? 0; } catch { uiYear = 0; }

  document.querySelector('.top nav').innerHTML = activeSave
    ? '<a href="#franchise">Franchise</a><a href="#league">League</a><a href="#standings">Standings</a><a href="#players">Players</a><a href="#quit-franchise">Quit to main menu</a>'
    : '<a href="#main">Main menu</a><a href="#franchise">Franchise</a><a href="#scores">Scores</a><a href="#standings">Standings</a><a href="#players">Players</a>';
  document.querySelector('.brand').href = activeSave ? '#franchise' : '#main';
  clearTimeout(castTimer);
  if (page !== "simcast") castRunning = false;
  const player = ['player', 'career', 'nba-games'].includes(page) && (activeSave
    ? seasonSim.history(activeSave).profiles.get(id) : liveNBA.currentProfile(realPlayersById.get(id)));
  if (!page || page === 'main' || page === 'quit-franchise') mainMenu();
  else if (page === 'new-career') franchiseEntry('new');
  else if (page === 'relationship-talk' && activeSave) relationshipTalk(activeSave, id);
  else if (page === 'fan-conversation' && activeSave) fanConversation(activeSave, id);
  else if (page === 'cfo-budget' && activeSave) cfoBudgetScreen(activeSave);
  else if (page === 'gm-offers') gmOffers(activeSave, id);
  else if (page === 'front-office-inbox') savedFacility(frontOfficeInbox);
  else if (['franchise', 'franchise-hub'].includes(page)) activeSave ? franchise() : franchiseEntry(id);
  else if (!activeSave && ['scores', 'nba-box'].includes(page)) nbaLiveScores(id);
  else if (!activeSave && liveNBA.current() && (page === 'players' || page === 'team' && teams.has(id))) liveRoster(page === 'team' ? id : undefined);
  else if (player && page === 'career') playerCareer(player, activeSave);
  else if (player && page === 'nba-games') nbaGameLog(player, activeSave);
  else if (player) profile(player, fromTeam);
  else if (page === 'players') roster();
  else if (page === 'player-editor') savedFacility(save => playerEditor(save, id));
  else if (page === 'league-news') savedFacility(save => leagueNews(save, id));
  else if (page === 'records') recordsScreen(activeSave, id, fromTeam, extra);
  else if (page === 'nba-history') nbaHistoryScreen(id, fromTeam);
  else if (page === 'trade-finder') savedFacility(save => tradeFinder(save, id, fromTeam));
  else if (page === 'standings') standings(currentSeason());
  else if (page === 'leaders') leagueLeaders(currentSeason());
  else if (page === 'all-star') allStarWeekend(currentSeason(id));
  else if (page === 'season-handoff') savedFacility(seasonHandoff);
  else if (page === 'calendar') savedFacility(save => {
    if (save.handoff && !save.market?.open) { seasonHandoff(save); return; }
    if (!save.market?.open && save.day >= seasonSim.playoffStart) postseasonLanding(save);
    else franchiseCalendar(save, id);
  });
  else if (page === 'team' && teams.has(id)) roster(teams.get(id));
  else if (page === 'scores') scores(currentSeason(id));
  else if (page === 'playoffs') playoffs(currentSeason(id));
  else if (page === 'offseason' && id === 'hall') savedFacility(save => {
    operationsPage('Hall of Fame inductees', 'Review the franchise induction class.', offseasonHall(save, seasonSim.history(save), true) +
      '<p><button id="continue-offseason-hall">Continue to League Meetings</button></p>');
    document.querySelector('#continue-offseason-hall').onclick = () => {
      if (window.confirm('Continue to League Meetings?')) location.hash = '#offseason/meeting';
    };
  });
  else if (page === 'offseason') playoffs(currentSeason(), true, id);
  else if (page === 'award-race' || page === 'award-overrides') savedFacility(save => franchiseAwardCenter(save, page === 'award-overrides' ? 'override' : 'race'));
  else if (page === 'performance-awards') performanceAwards(currentSeason(fromTeam), id);
  else if (page === 'coaching') coaching();
  else if (page === 'gameplan') coachingGameplan();
  else if (page === 'facilities') facilities();
  else if (page === 'gm-wallet') savedFacility(gmWalletScreen);
  else if (page === 'organizations') savedFacility(save => organizationsScreen(save, id));
  else if (page === 'player-support') savedFacility(save => playerSupportScreen(save, id));
  else if (page === 'ads') savedFacility(save => advertisementCenter(save, id, fromTeam));
  else if (page === 'staff') staff(id);
  else if (page === 'staff-career') staffCareer(activeSave, id, fromTeam);
  else if (page === 'staff-honors') staffHonorsDirectory(activeSave, id);
  else if (page === 'staff-workspace') savedFacility(save => staffWorkspace(save, id));
  else if (page === 'staff-assign') savedFacility(save => assignStaffScreen(save, id, fromTeam));
  else if (page === 'relationships' || page === 'contact') savedFacility(save => relationshipScreen(save, id));
  else if (page === 'network') savedFacility(save => relationshipDirectory(save, id));
  else if (page === 'jersey') savedFacility(save => jerseyScreen(save, id));
  else if (page === 'facility-expansions') savedFacility(facilityExpansions);
  else if (page === 'clinic') savedFacility(clinic);
  else if (page === 'team-intel') savedFacility(save => teamIntel(save, id));
  else if (page === 'player-scouting') savedFacility(playerScouting);
  else if (page === 'draft-scouting') savedFacility(save => draftScoutingScreen(save, id));
  else if (page === 'development-division') savedFacility(save => developmentDivision(save, id));
  else if (page === 'draft-testing') savedFacility(save => offseasonDraftTesting(save, id));
  else if (page === 'draft') savedFacility(save => draftScreen(save, id));
  else if (page === 'simcast') savedFacility(simcastScreen);
  else if (page === 'finances') savedFacility(finances);
  else if (page === 'contracts') savedFacility(save => contracts(save, id));
  else if (page === 'rookie-signing') savedFacility(offseasonRookieSigning);
  else if (page === 'option-results') savedFacility(offseasonOptionResults);
  else if (page === 'market-recap') savedFacility(save => offseasonMarketRecap(save, id));
  else if (page === 'free-agency') savedFacility(save => freeAgentMarket(save, id, fromTeam));
  else if (page === 'restart-franchise') savedFacility(restartFranchise);
  else if (page === 'transactions') savedFacility(save => transactions(save, id, fromTeam, extra));
  else if (page === 'pick') savedFacility(save => id === 'ads' ? adRosterPicker(save, fromTeam, extra) : openRosterPicker(save, id, fromTeam, extra));
  else if (page === 'arena') {
    const facility = arenaFacilities.find(entry => entry.id === id);
    if (facility) savedFacility(save => facilityManager(facility, save));
    else facilities();
  }
  else if (page === 'training') trainingFacility();
  else if (page === 'game') {
    const season = currentSeason(fromTeam);
    const game = season?.results.find(entry => entry.id === id);
    if (game) gameBox(game, season.save.year, season);
    else scores(season);
  }
  else if (page === 'league') directory();
  
  else directory();
  const active = (!page || page === "main" || page === "quit-franchise") ? "#main" : !activeSave && ["scores", "nba-box"].includes(page) ? "#scores" : ["franchise-hub", "gm-offers"].includes(page) || ['franchise', 'scores', 'game', 'coaching', 'gameplan', 'facilities', 'training',
    'staff', 'staff-career', 'staff-honors', 'clinic', 'gm-wallet', 'organizations', 'player-support', 'league-news', 'player-editor', 'development-division', 'team-intel', 'arena', 'finances', 'contracts', 'transactions', 'playoffs',
    'free-agency', 'restart-franchise', 'calendar', 'all-star', 'award-race', 'award-overrides', 'draft', 'simcast', 'leaders', 'staff-assign', 'pick', 'relationships', 'network', 'contact', 'jersey'].includes(page) ? '#franchise' :
    page === 'players' || (player && !fromTeam) ? '#players' : page === 'standings' ? '#standings' : '#league';
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === active) {
      link.setAttribute('aria-current', 'page');
    } else link.removeAttribute('aria-current');
  });
  if (activeSave?.allStarFormat === 2 && !['award-race', 'all-star'].includes(page)) {
    const election = seasonSim.allStarElectionDates(activeSave);
    const voting = activeSave.day === election.open && !activeSave.allStarBallot;
    const drafting = activeSave.day === seasonSim.allStarDayFor(activeSave) && seasonSim.history(activeSave).allStarDraft?.pending;
    if (voting || drafting) app.insertAdjacentHTML('afterbegin', `<div class="panel toolbar"><strong>${voting ? 'All-Star ballot due' : 'Your All-Star draft is on the clock'}</strong>
      <a class="primary-link" href="${voting ? '#award-race' : '#all-star'}">${voting ? 'Cast your two votes' : 'Open All-Star draft'}</a></div>`);
  }
  if (activeSave?.rotationAlert && page !== 'coaching') showRotationAlert(activeSave);
  bindFacilityUpgrades(activeSave);
  window.scrollTo(0, routeScroll.get(location.hash) ?? 0);
  renderedRoute = location.hash;
  if (page === 'free-agency' && id) document.querySelector('#free-agent-actions')?.scrollIntoView();
}

window.addEventListener('hashchange', render);
window.addEventListener('storage', event => {
  if (event.key === seasonSim.storageKey) render();
});
seasonSim.quitSlot();
render();


















