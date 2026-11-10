const gmCareer = (() => {
  const roll = seed => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  function offers(preferred, seed, max = 7, min = 1, includePreferred = false) {
    const next = roll(seed);
    const pool = league.teams.map(team => team.code).filter(code => code !== preferred);
    const result = next() < 0.25 || includePreferred ? [preferred] : [];
    while (result.length < 5) result.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
    return result.map(team => ({ team, salary: Math.round((min + next() * (max - min)) * 10) * 100000,
      years: 1 + Math.floor(next() * 3) }));
  }
  const expiring = save => Boolean(save.gm && save.year + 1 >= save.gm.contract.startYear + save.gm.contract.years);
  function honors(save, state = seasonSim.history(save)) {
    return [...(save.pastSeasons ?? []).map(season => [season, seasonSim.history(season)]), [save, state]]
      .flatMap(([season, result]) => [
        ...(result.awards?.executive?.includes(season.team) ? [[season.year, 'Executive of the Year']] : []),
        ...(result.bracket?.champion === season.team ? [[season.year, 'NBA Championship · ' + season.team]] : []),
      ]);
  }
  function renewals(save, state) {
    if (!expiring(save) || !state.bracket?.champion) return [];
    const wins = state.records[save.team].wins;
    const previousWins = save.previousWins?.[save.team] ?? 41;
    const report = teamFinance.report(save, state, save.team);
    const profit = report.bank - (save.startingBanks?.[save.team] ?? teamFinance.openingCash);
    const rounds = postseason.roundsWon(state.bracket, save.team);
    const careerBonus = Math.min(0.2, honors(save, state).reduce((sum, [, label]) =>
      sum + (label === 'Executive of the Year' ? 0.05 : 0.04), 0));
    const rating = Math.max(0, Math.min(1, 0.25 + (wins - 41) / 110 + (wins - previousWins) / 160
      + rounds * 0.08 + careerBonus + Math.max(-0.15, Math.min(0.15, profit / 400000000))));
    const center = 1 + 14 * rating;
    return offers(save.team, save.seed ^ 0x71882, Math.min(15, center + 3), Math.max(1, center - 3), true);
  }
  return { offers, expiring, renewals, honors };
})();

const liveNBA = (() => {
  const key = 'ultimate-basketball:live:v1';
  const endpoint = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/';
  const abbreviations = { GS: 'GSW', NY: 'NYK', NO: 'NOP', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS' };
  const code = value => abbreviations[value] ?? value;
  let cache;
  try { cache = JSON.parse(localStorage.getItem(key)); } catch { cache = null; }
  const current = () => cache;
  async function json(url) {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('The NBA data feed returned HTTP ' + response.status + '.');
    return response.json();
  }
  async function refresh(date) {
    const [scoreboard, standings] = await Promise.all([
      json(endpoint + 'scoreboard?dates=' + date.replaceAll('-', '')),
      json('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings'),
    ]);
    const clubs = (standings.children ?? []).flatMap(group => group.standings?.entries ?? []);
    if (clubs.length !== 30 || !Array.isArray(scoreboard.events)) throw new Error('The feed returned an incomplete league snapshot.');
    const records = Object.fromEntries(clubs.map(entry => {
      const stats = Object.fromEntries(entry.stats.map(stat => [stat.name, stat.value]));
      return [code(entry.team.abbreviation), { wins: stats.wins, losses: stats.losses }];
    }));
    if (league.teams.some(team => !Number.isFinite(records[team.code]?.wins) || !Number.isFinite(records[team.code]?.losses))) {
      throw new Error('The standings feed did not include all 30 teams.');
    }
    const rosters = {};
    for (let i = 0; i < clubs.length; i += 6) {
      await Promise.all(clubs.slice(i, i + 6).map(async ({ team }) => {
        const response = await json(endpoint + 'teams/' + team.id + '/roster');
        const players = Array.isArray(response.athletes) ? response.athletes.flatMap(row => row.items ?? [row]) : [];
        if (!players.length || players.some(player => !player.id || !player.fullName)) throw new Error('Incomplete roster for ' + team.displayName + '.');
        rosters[code(team.abbreviation)] = players.map(player => ({ id: String(player.id), name: player.fullName,
          position: player.position?.abbreviation, jersey: player.jersey, dob: player.dateOfBirth?.slice(0, 10),
          height: player.displayHeight, weight: player.displayWeight, experience: player.experience?.years }));
      }));
    }
    if (league.teams.some(team => !rosters[team.code])) throw new Error('The roster feed did not include all 30 teams.');
    const games = scoreboard.events.map(event => ({
      id: event.id, name: event.name, status: event.status?.type?.detail, state: event.status?.type?.state,
      teams: (event.competitions?.[0]?.competitors ?? []).map(entry => ({ code: code(entry.team.abbreviation), score: entry.score, home: entry.homeAway === 'home' })),
    }));
    const next = { date, updatedAt: new Date().toISOString(), rosters, records, games };
    localStorage.setItem(key, JSON.stringify(next));
    cache = next;
    return next;
  }
  const box = id => json(endpoint + 'summary?event=' + encodeURIComponent(id));
  const normalize = name => name.normalize('NFD').toLowerCase().replace(/\p{M}|[^a-z0-9 ]/gu, '').replace(/ (jr|ii|iii)$/, '');
  function currentProfile(player) {
    if (!cache || !player) return player;
    for (const [team, roster] of Object.entries(cache.rosters)) {
      const entry = roster.find(row => row.id === String(player.id) || normalize(row.name) === normalize(player.name));
      if (entry) return { ...player, team, jersey: entry.jersey ?? player.jersey };
    }
    return { ...player, team: null };
  }
  function startingSnapshot() {
    if (!cache) return {};
    const byId = new Map(league.players.map(player => [String(player.id), player]));
    const byName = new Map(league.players.map(player => [normalize(player.name), player]));
    const seen = new Set();
    const startingRosters = {}, openingContracts = {}, customPlayers = [], playerEdits = [];
    for (const [team, roster] of Object.entries(cache.rosters)) {
      startingRosters[team] = [];
      for (const entry of roster) {
        const base = byId.get(entry.id) ?? byName.get(normalize(entry.name));
        const player = base ?? { ...entry, id: 'live-' + entry.id, team: null,
          position: entry.position ?? 'F', attributes: Object.fromEntries(playerTools.attributes.map(key => [key, 60])) };
        if (seen.has(player.id)) throw new Error('A player appears on multiple refreshed rosters. Refresh again before starting.');
        seen.add(player.id);
        startingRosters[team].push(player.id);
        openingContracts[player.id] = { team, deal: teamFinance.publishedDeal(player) };
        if (!base) customPlayers.push(player);
        playerEdits.push({ day: 0, id: player.id, type: base ? 'edit' : 'create',
          profile: Object.fromEntries(Object.entries({ jersey: entry.jersey, position: entry.position }).filter(([, value]) => value != null)) });
      }
    }
    return { startingRosters, openingContracts, customPlayers, playerEdits, rosterSnapshot: cache.updatedAt };
  }
  return { current, currentProfile, refresh, box, startingSnapshot };
})();

let gmApplication;

function nbaMenuPage(title, description, content) {
  app.innerHTML = `<a class="back" href="#main">← NBA main menu</a>
    <section class="hero"><div class="eyebrow">ULTIMATE BASKETBALL</div><h1>${e(title)}</h1><p>${e(description)}</p></section>
    ${content}`;
}
function mainMenu() {
  directory();
  const snapshot = liveNBA.current();
  app.insertAdjacentHTML('afterbegin', `<section class="panel facility-card"><h1>NBA Main Menu</h1>
    <p>Real-life NBA data · ${snapshot ? 'Refreshed ' + e(new Date(snapshot.updatedAt).toLocaleString()) : 'Bundled snapshot ' + e(league.snapshot)}</p>
    <div class="franchise-actions"><a class="primary-link" href="#franchise">Franchise</a>
      <a href="#scores">NBA scores and box scores</a><a href="#standings">NBA standings</a>
      <label>Score date <input id="nba-live-date" type="date" value="${e(nbaToday())}"></label>
      <button id="nba-refresh">Refresh NBA data</button></div><p id="nba-refresh-status" role="status"></p></section>`);
  document.querySelector('#nba-refresh').onclick = async event => {
    const button = event.currentTarget;
    const status = document.querySelector('#nba-refresh-status');
    const date = document.querySelector('#nba-live-date').value;
    if (!date) { status.textContent = 'Choose a score date.'; return; }
    button.disabled = true;
    status.textContent = 'Updating rosters, scores and standings…';
    try { await liveNBA.refresh(date); if (button.isConnected) mainMenu(); }
    catch (error) { status.textContent = 'Refresh failed. The last snapshot is still available. ' + error.message; }
    finally { button.disabled = false; }
  };
}

function nbaToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
}

function franchiseEntry(view) {
  const slots = seasonSim.saveSlots();
  const open = key => {
    try {
      seasonSim.openSlot(key);
      if (location.hash === '#franchise-hub') render();
      else location.hash = '#franchise-hub';
    }
    catch (error) { document.querySelector('#career-feedback').textContent = error.message; }
  };
  nbaMenuPage('Franchise', 'Start a GM career or resume a saved league.', `
    <div class="franchise-actions"><button id="career-continue" ${slots.length ? '' : 'disabled'}>Continue game</button>
    <a class="primary-link" href="#franchise/new">New game</a><a href="#franchise/load">Load game</a></div>
    ${view === 'load' ? `<section class="panel facility-card"><h2>Saved franchises</h2>${slots.map((slot, index) => `<p>
      <button data-career-slot="${index}">Load</button> <strong>${e(slot.gm ?? 'Legacy franchise')}</strong> · ${e(teams.get(slot.team).name)}
      · ${seasonLabel(slot.year)} · ${simDate(slot.day, slot.year)} <button data-delete-career-slot="${index}">Delete</button></p>`).join('') || '<p>No saved franchises.</p>'}</section>` : ''}
    ${view === 'new' ? `<form id="gm-create" class="panel facility-card">
      <h2>Create your GM</h2><div class="toolbar">
      <label>Full name <input name="name" required maxlength="80"></label>
      <label>Birthplace <input name="birthplace" required maxlength="100"></label>
      <label>Date of birth <input type="date" name="dob" required max="${nbaToday()}"></label>
      <label>Preferred team <select name="preferred" required><option value="">Choose a team</option>
        ${league.teams.map(team => `<option value="${e(team.code)}">${e(team.name)}</option>`).join('')}</select></label>
      <button>View job offers</button></div></form>` : ''}
    <p id="career-feedback" role="alert"></p>`);
  document.querySelector('#career-continue').onclick = () => open();
  document.querySelectorAll('[data-career-slot]').forEach(button => {
    button.onclick = () => open(slots[Number(button.dataset.careerSlot)].key);
  });
  document.querySelectorAll('[data-delete-career-slot]').forEach(button => {
    button.onclick = () => {
      const slot = slots[Number(button.dataset.deleteCareerSlot)];
      const name = slot.gm ?? 'Legacy franchise';
      const team = teams.get(slot.team).name;
      if (!window.confirm(`Permanently delete ${name} · ${team} · ${seasonLabel(slot.year)} · ${simDate(slot.day, slot.year)}?`)) return;
      try {
        seasonSim.deleteSlot(slot.key);
        franchiseEntry('load');
        document.querySelector('#career-feedback').textContent = 'Franchise save deleted.';
      } catch (error) {
        document.querySelector('#career-feedback').textContent = error.message;
      }
    };
  });
  const form = document.querySelector('#gm-create');
  if (form) form.onsubmit = event => {
    event.preventDefault();
    const gm = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
    if (!gm.name || !gm.birthplace) { document.querySelector('#career-feedback').textContent = 'Enter a name and birthplace.'; return; }
    gmApplication = { gm, offers: gmCareer.offers(gm.preferred, crypto.getRandomValues(new Uint32Array(1))[0]) };
    location.hash = '#gm-offers';
  };
}

function gmOffers(save, teamCode) {
  const gm = save?.gm ?? gmApplication?.gm;
  if (!gm) return franchiseEntry('new');
  const offers = save ? gmCareer.renewals(save, seasonSim.history(save)) : gmApplication.offers;
  const selected = !save && offers.find(offer => offer.team === teamCode);
  if (selected) {
    const team = teams.get(teamCode);
    const snapshot = liveNBA.startingSnapshot();
    const pool = new Map([...league.players, ...(snapshot.customPlayers ?? [])].map(player => [player.id, player]));
    const roster = snapshot.startingRosters?.[teamCode]?.map(id => pool.get(id)).filter(Boolean)
      ?? league.players.filter(player => player.team === teamCode);
    const staff = staffSim.assignments(null, teamCode, staffSim.roles);
    const picks = draftOps.futurePicks({ year: 0 }).filter(pick => pick.owner === teamCode);
    nbaMenuPage('Meet the ownership group', team.name, `
      <section class="panel facility-card"><h2>Ownership offer</h2>
      ${chatThread({ gm, day: 0 }, team.name + ' ownership', 50, 'We’d like you to run basketball operations. You can review our roster, picks and staff before deciding.')}
      <p><strong>${money(selected.salary)} per year</strong> · ${selected.years} year${selected.years === 1 ? '' : 's'}</p>
      <button id="accept-gm-contract">Sign GM contract</button> <a href="#gm-offers">Review other offers</a>
      <p id="career-feedback" role="alert"></p></section>
      <section><h2>Roster</h2>${castTable(['Player', 'Position', 'OVR', 'GP', 'PTS', 'REB', 'AST', 'FG%'], roster.map(player => {
        const stats = previousNbaSeasonStats(player);
        return [e(player.name), e(playerTools.positionText(player)), formatStat(seasonSim.baseOverall(player), 2),
          ...['GP', 'PTS', 'REB', 'AST', 'FG%'].map(key => formatStat(stats?.[key], key === 'GP' ? 0 : 1))];
      }))}</section>
      <section><h2>Draft assets</h2>${castTable(['Year', 'Round', 'Origin'], picks.map(pick => [pick.year, pick.round, e(pick.origin)]))}</section>
      <section><h2>Staff</h2>${castTable(['Position', 'Name', 'Skill'], Object.entries(staff).map(([role, person]) => [e(role), e(person.name), person.skill]))}</section>`);
    document.querySelector('#accept-gm-contract').onclick = () => {
      try {
        seasonSim.startCareer(gm, selected, snapshot);
        gmApplication = null;
        location.hash = '#franchise-hub';
      } catch (error) { document.querySelector('#career-feedback').textContent = error.message; }
    };
    return;
  }
  (save ? operationsPage : nbaMenuPage)('GM job offers', gm.name, `
    <div class="division-grid">${offers.map(offer => `<article class="panel facility-card">${logo(teams.get(offer.team))}
      <h2>${e(teams.get(offer.team).name)}</h2><p>${money(offer.salary)} per year · ${offer.years} year${offer.years === 1 ? '' : 's'}</p>
      <button data-gm-offer="${e(offer.team)}">${save?.nextGmJob?.team === offer.team ? 'Offer selected' : save ? 'Accept offer' : 'Meet ownership'}</button></article>`).join('')}</div>
    ${offers.length ? '' : '<p>Job offers open after the playoffs in the last year of your contract.</p>'}
    <p id="career-feedback" role="alert"></p>`);
  document.querySelectorAll('[data-gm-offer]').forEach(button => {
    button.onclick = () => {
      try {
        const offer = offers.find(entry => entry.team === button.dataset.gmOffer);
        if (save) seasonSim.chooseGmJob(save, offer.team);
        else {
          location.hash = '#gm-offers/' + offer.team;
          return;
        }
        location.hash = save ? '#offseason' : '#franchise-hub';
      } catch (error) { document.querySelector('#career-feedback').textContent = error.message; }
    };
  });
}

function nbaLiveScores(id) {
  const snapshot = liveNBA.current();
  const game = snapshot?.games.find(entry => String(entry.id) === id);
  const matchup = entry => {
    const clubs = [...entry.teams].sort((a, b) => Number(a.home) - Number(b.home));
    const upcoming = entry.state === 'pre' || (!entry.state && clubs.every(club => Number(club.score) === 0));
    const decided = entry.state === 'post' || /^Final\b/i.test(entry.status ?? '');
    return clubs.map(club => {
      const team = teams.get(club.code);
      const winner = decided && clubs.every(other => other === club || Number(club.score) > Number(other.score));
      return `<span class="score-team ${winner ? 'score-winner' : ''}">${team ? logo(team) : ''}<b>${e(club.code)}</b>${upcoming ? '' : ' ' + e(club.score)}</span>`;
    }).join('<span class="note">at</span>');
  };
  nbaMenuPage(game?.name ?? 'NBA scores', snapshot?.date ?? 'Refresh from the main menu to load NBA scores.', `
    <nav class="box-navigation screen-links">${game ? '<a class="primary-link" href="#scores">Scoreboard</a>' : ''}<a class="primary-link" href="https://www.nba.com/games">NBA.com scores</a></nav>
    ${game ? `<div class="panel"><div class="game-result"><span class="score-matchup">${matchup(game)}</span><span>${e(game.status)}</span></div></div>
      <div id="nba-box" class="game-box-screen" aria-live="polite"><p class="franchise-note">Loading NBA box score…</p></div>` :
      `<section class="panel scores-panel"><h3>${snapshot?.games.length ?? 0} games · ${e(snapshot?.date ?? 'Scoreboard')}</h3>${(snapshot?.games ?? []).map(entry => `
        <a class="game-result live-score-row" href="#nba-box/${e(entry.id)}">
          <span class="score-matchup">${matchup(entry)}</span><span class="live-score-status">${e(entry.status)}</span><span>Box score →</span>
        </a>`).join('') || '<p class="franchise-note">No games loaded for this date.</p>'}</section>`}`);
  if (!game) return;
  const target = document.querySelector('#nba-box');
  liveNBA.box(id).then(data => {
    if (!target.isConnected) return;
    const groups = data.boxscore?.players ?? [];
    target.innerHTML = groups.map(group => `<h2>${e(group.team.displayName)}</h2>${group.statistics.map(stat => `
      <div class="panel table-wrap"><table><thead><tr><th>Player</th>${stat.labels.map(label => `<th>${e(label)}</th>`).join('')}</tr></thead>
      <tbody>${stat.athletes.map(row => `<tr><th>${e(row.athlete.displayName)}</th>${row.didNotPlay
        ? `<td colspan="${stat.labels.length}">${e(row.reason || 'DNP')}</td>`
        : row.stats.map(value => `<td>${e(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}`).join('')
      || '<p>A player box score is unavailable for this game.</p>';
  }).catch(error => { target.textContent = error.message; });
}

function liveRoster(code) {
  const snapshot = liveNBA.current();
  const clubs = code ? [code] : Object.keys(snapshot.rosters).sort();
  const known = new Map(league.players.map(player => [String(player.id), player]));
  nbaMenuPage(code ? teams.get(code).name : 'NBA player directory', 'Roster refreshed ' + new Date(snapshot.updatedAt).toLocaleString(), `
    <p><a href="#main">Back to NBA main menu</a></p>
    <label>Find a player <input id="live-roster-search" type="search"></label>
    <div class="table-wrap"><table><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>Jersey</th></tr></thead>
    <tbody>${clubs.flatMap(team => snapshot.rosters[team].map(player => `<tr data-live-player>
      <th><a href="${known.has(player.id) ? '#player/' + e(player.id) : 'https://www.espn.com/nba/player/_/id/' + encodeURIComponent(player.id)}">${e(player.name)}</a></th>
      <td><a href="#team/${e(team)}">${e(team)}</a></td><td>${e(player.position ?? '—')}</td><td>${e(player.jersey ?? '—')}</td></tr>`)).join('')}</tbody></table></div>`);
  document.querySelector('#live-roster-search').oninput = event => {
    const query = event.currentTarget.value.trim().toLowerCase();
    document.querySelectorAll('[data-live-player]').forEach(row => {
      row.hidden = !row.cells[0].textContent.toLowerCase().includes(query);
    });
  };
}





