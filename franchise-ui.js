function franchiseMenu(team) {
  const groups = [
    ['Team', [['Roster', 'team/' + team.code], ['Rotation', 'coaching'], ['Staff', 'staff'], ['Player editor', 'player-editor']]],
    ['Front office', [['Contracts', 'contracts'], ['Trades & roster moves', 'transactions'], ['Trade Finder', 'trade-finder'], ['Free agency', 'free-agency'], ['NBA Draft', 'draft'], ['Relationships', 'relationships'], ['Organizations', 'organizations'], ['Finances', 'finances'], ['GM wallet', 'gm-wallet']]],
    ['League', [['Calendar', 'calendar'], ['Standings', 'standings'], ['League leaders', 'leaders'], ['Award Race', 'award-race'], ['NBA & team records', 'records'], ['NBA league history', 'nba-history'], ['Scores', 'scores'], ['Trades & rumors', 'league-news'], ['Playoffs & awards', 'playoffs']]],
    ['Operations', [['Facilities', 'facilities'], ['Development Division', 'development-division'], ['Arena', 'arena/arena'], ['Advertisement Center', 'ads'], ['Player Services', 'player-support'], ['Restart franchise', 'restart-franchise']]],
  ];
  return `<nav class="franchise-hub" aria-label="Franchise departments">${groups.map(([name, links]) =>
    `<section class="panel"><h3>${name}</h3>${links.map(([label, route]) =>
      `<a href="#${e(route)}">${e(label)} <span aria-hidden="true">›</span></a>`).join('')}</section>`).join('')}</nav>`;
}

function relationshipScreen(save, id) {
  const state = seasonSim.history(save);
  const data = relationships.read(save);
  const player = state.profiles.get(id);
  const name = id => state.profiles.get(id)?.name ?? id;
  const playerLink = id => `<a href="#contact/${e(id)}">${e(name(id))}</a>`;
  const dateFor = item => item.startYear > save.year ? item.days + ' days after the extension begins' : item.phase === 'offseason' ? 'Offer round ' + item.due : simDate(item.due, item.year);
  const pathText = path => path.ready ? 'Already fulfilled' : path.blocked ? e(path.blocked)
    : path.links.map(([label, href]) => `<a href="${e(href)}">${e(label)} →</a>`).join(' · ');
  const promiseTable = list => `<section><h2>Promises</h2><div class="panel table-wrap"><table>
    <thead><tr><th>Player</th><th>Commitment</th><th>Due</th><th>Status</th><th>How to fulfill</th></tr></thead>
    <tbody>${list.map(item => `<tr><td>${playerLink(item.id)}</td><td>${e(item.label)}</td><td>${e(dateFor(item))}</td>
      <td><strong class="promise-${e(item.status)}">${e(item.status)}</strong></td>
      <td>${item.status === 'pending' ? pathText(relationships.fulfillment(save, state, item.id, item)) : '—'}</td></tr>`).join('')
      || '<tr><td colspan="5">No commitments recorded.</td></tr>'}</tbody></table></div></section>`;
  const button = (label, type, target, value = '', disabled = false) => `<button type="button"
    data-contact-action="${e(type)}" data-contact-id="${e(target)}" data-contact-value="${e(value)}" ${disabled ? 'disabled' : ''}>${e(label)}</button>`;
  const recent = data.log.slice(-20).reverse();
  const log = `<section><h2>Conversation log</h2><div class="panel"><ul class="slate">${recent.map(entry =>
    `<li>${e(entry.phase === 'offseason' ? 'Offer round ' + entry.tick : simDate(entry.day, entry.year))} · ${e(entry.text)}</li>`).join('')
    || '<li>No conversations yet.</li>'}</ul></div></section>`;
  if (player) {
    const trust = relationships.playerScore(save, state, player.id);
    const agent = relationships.agent(player.id);
    const open = relationships.direct(save, state, player.id);
    const preferences = data.contacts[player.id]?.demands ?? [];
    const owner = state.owners.get(id);
    const deal = owner ? teamFinance.report(save, state, owner).contracts.get(id)?.deal : null;
    const quote = relationships.commitment(save, state, player);
    operationsPage(player.name, open ? 'Direct conversations are available.' : 'Contact the player through their representative to build trust.',
      `<a class="back" href="#relationships">← Relationships</a>
      <dl class="panel bio"><div><dt>Player trust</dt><dd>${trust} / 100</dd></div>
        <div><dt>Reported representative</dt><dd>${agent.source ? `<a href="${e(agent.source)}">${e(agent.name)}</a>` : e(agent.name)}
          ${agent.agency ? '<br>' + e(agent.agency) : ''}${agent.coAgent ? '<br>Also reported · ' + e(agent.coAgent) : ''}</dd></div>
        <div><dt>Agent relationship with your team</dt><dd>${worldRelationships.agentReputation(save, player.id, save.team)} / 100</dd></div>
        <div><dt>Contact access</dt><dd>${open ? 'Direct and agent' : 'Agent only · direct at 55 trust'}</dd></div></dl>
      <div class="franchise-actions">${button('Talk to agent', 'talk', id, 'agent')}
        ${button('Talk directly', 'talk', id, 'direct', !open)}
        <a href="#relationship-talk/${e(id)}">Open conversation →</a><a href="#player/${e(id)}">Player card →</a>
        ${!state.owners.has(id) ? `<a href="#free-agency/${e(id)}">Make an offer →</a>` : ''}</div>
      <p id="contact-feedback" role="status"></p>
      <section><h2>Contract discussion</h2><dl class="panel bio">
        <div><dt>${owner ? 'Current contract' : 'Current asking price'}</dt><dd>${deal
          ? money(deal.salary) + ' / year · ' + deal.years + ' years · ' + deal.guaranteed + '% guaranteed'
          : owner ? 'Unavailable' : money(freeAgency.askingSalary(player)) + ' / year'}</dd></div>
        <div><dt>100% commitment to your team</dt><dd>${money(quote.salary)} / year · 1 year · 100% guaranteed · ${quote.upfront}% upfront
          <br>${quote.requests.filter(item => item.kind !== "upfront").map(item =>
            e(item.label) + ' · ' + pathText(relationships.fulfillment(save, state, id, item))).join(' · ')}
          <br>${owner === save.team && freeAgency.extensionStatus(save, state, id, { deal }) === 'Ready to negotiate'
            ? `<a href="#contracts/${e(id)}/commit">Edit extension terms and counter →</a>` : owner ? 'Signing requires free-agent eligibility.' : `<a href="#free-agency/${e(id)}/commit">Edit terms and counter →</a>`}</dd></div>
      </dl></section>
      <section><h2>Current requests</h2><div class="panel facility-card">${preferences.length
        ? preferences.map(demand => {
          const path = relationships.fulfillment(save, state, id, demand);
          const promised = data.promises.some(item => item.id === id && item.kind === demand.kind && item.year === save.year);
          return `<p><strong>${e(demand.label)}</strong> · ${pathText(path)}
            ${path.blocked || promised ? '' : relationships.verbal(save, id, demand) ? 'Verbal agreement reached · ' + button('Make a promise', 'promise', id, demand.kind) : button('Reach verbal agreement', 'verbal', id, demand.kind)}</p>`;
        }).join('')
        : '<p>Discuss terms to find out what this player is looking for.</p>'}
      ${preferences.some(item => item.kind === 'teammate') ? `<p><label>Teammate promise deadline <input id="promise-deadline" type="${save.market?.open ? 'number' : 'date'}"
        min="${save.market?.open ? save.market.round : simDate(save.day, save.year)}"
        value="${save.market?.open ? save.market.round + 2 : simDate(Math.min(save.day + 7, seasonSim.lastDay), save.year)}"
        ${save.market?.open ? 'max="' + (save.market.round + 14) + '" step="1"' : 'max="' + simDate(seasonSim.lastDay, save.year) + '"'}></label></p>` : ''}
      <p class="note">Promises are checked against actual contract terms, jersey assignments, or roster moves.
        The default deadline is seven calendar days or two offseason rounds. You can set a deadline for teammate promises. Keeping a promise adds 16 trust points. Breaking it costs 28.</p></div></section>
      ${state.owners.get(id) === save.team ? `<p><a class="back" href="#jersey/${e(id)}">Change jersey number →</a></p>` : ''}
      ${relationshipNetwork(relationships.network(save, state, id))}
      ${promiseTable(data.promises.filter(item => item.id === id))}${log}`);
  } else {
    const staff = staffSim.assignments(save, save.team, staffSim.roles);
    const contacts = [...new Set([...state.rosters.get(save.team).map(player => player.id),
      ...Object.keys(data.contacts).filter(key => state.profiles.has(key))])];
    operationsPage('Relationships', 'Talk to players, representatives, team staff, and reporters. Keep track of commitments and trust.',
      `<div class="franchise-actions"><a href="#network">Explore relationship network →</a><a href="#team-intel">Talk to other GMs →</a><a href="#organizations">Supporter organizations →</a><a href="#players">Find a player →</a><a href="#free-agency">Find a free agent →</a></div>
      <p id="contact-feedback" role="status"></p>
      ${contacts.length ? `<section><h2>Player contacts</h2><p>${contacts.map(key => '<a href="#relationship-talk/' + e(key) + '">' + e(name(key)) + '</a> (' + relationships.playerScore(save, state, key) + ')').join(' · ')}</p></section>` : ''}
      ${promiseTable(data.promises)}
      <section><h2>Staff conversations</h2><div class="panel table-wrap"><table><thead><tr><th>Role</th><th>Staff member</th><th>Relationship</th><th></th></tr></thead>
        <tbody>${Object.entries(staff).map(([role, person]) => `<tr><td>${e(role)}</td><td>${e(person.name)}</td>
          <td>${relationships.score(save, person.id, 48)}</td><td><a href="#relationship-talk/${e(person.id)}">Open conversation</a></td></tr>`).join('')}</tbody></table></div></section>
      <section><h2>Fan communities</h2><div class="division-grid">
        ${relationships.fans.filter(fan => fan.code === save.team).map(fan => `<article class="panel facility-card">
          <h3>${e(fan.name)} fans</h3><p>${arenaOps.fanPopulation(save.team, arenaOps.fanMood(save, state, save.team), arenaOps.popularity(arenaOps.settings(save)))[fan.name.toLowerCase()].toLocaleString()} modeled fans · Trust ${relationships.score(save, fan.id, 40)} / 100</p>
          <a class="primary-link" href="#fan-conversation/${e(fan.id)}">Talk with fans</a></article>`).join('')}</div></section>
      <section><h2>Reporters</h2><p class="note">Build local trust and let matchups create cross-market familiarity. Other reporters open at 55 local trust and 28 source familiarity.</p>
        <div class="panel table-wrap"><table><thead><tr><th>Reporter</th><th>Relationship</th><th>Source familiarity</th><th></th></tr></thead>
        <tbody>${[...relationships.reporters].sort((a,b) => Number(b.code === save.team) - Number(a.code === save.team)).map(person =>
          `<tr><td>${e(person.name)}</td><td>${relationships.score(save, person.id, person.code === save.team ? 42 : 18)}</td>
          <td>${worldRelationships.reporterSource(save, state, person.code, save.team)} / 100</td>
          <td>${relationships.reporterAvailable(save, person.id, state) ? '<a href="#relationship-talk/' + e(person.id) + '">Open conversation</a>' : 'Locked'}</td></tr>`).join('')}</tbody></table></div></section>${log}`);
  }
  function apply(action) {
    try {
      seasonSim.conversation(save, action);
      render();
      document.querySelector('#contact-feedback').textContent = 'Franchise updated.';
    } catch (error) { document.querySelector('#contact-feedback').textContent = error.message; }
  }
  document.querySelectorAll('[data-contact-action]').forEach(element => element.addEventListener('click', () => apply({
    deadline: document.querySelector('#promise-deadline')?.value,
    type: element.dataset.contactAction, id: element.dataset.contactId, channel: element.dataset.contactValue, kind: element.dataset.contactValue,
  })));
}

function jerseyScreen(save, id) {
  const state = seasonSim.history(save);
  const player = playersById.get(id);
  const rosterLink = '#team/' + e(save.team);
  if (!player || state.owners.get(id) !== save.team) {
    operationsPage('Jersey numbers', 'Choose a player on your roster.', `<p><a href="${rosterLink}">Open roster →</a></p>`);
    return;
  }
  const current = relationships.jersey(save, id);
  const available = ['00', ...Array.from({ length: 100 }, (_, i) => String(i))]
    .filter(number => relationships.jerseyOpen(save, state, id, number));
  operationsPage('Change jersey number', player.name + (current == null ? ' · No number assigned' : ' · Current number #' + current),
    `<p><a class="back" href="${rosterLink}">← Team roster</a> · <a href="#player/${e(id)}">Player card</a> ·
      <a href="#contact/${e(id)}">Promises and contact</a></p>
    <form id="jersey-form" class="panel toolbar"><label>Jersey number ${jerseyInput(current ?? '', true)}</label>
      <button type="submit">Save jersey number</button><span id="jersey-feedback" role="status"></span></form>
    <p class="note">Available numbers · ${available.join(', ')}</p>`);
  document.querySelector('#jersey-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const number = new FormData(event.currentTarget).get('jersey');
      seasonSim.conversation(save, { type: 'jersey', id, number });
      render();
      document.querySelector('#jersey-feedback').textContent = 'Assigned #' + number + ' to ' + player.name + '.';
    } catch (error) {
      document.querySelector('#jersey-feedback').textContent = error.message;
    }
  });
}

function postseasonLanding(save) {
  location.hash = save.day === seasonSim.playoffStart && !save.awardsReviewed
    ? '#performance-awards/regular/' + save.year : '#playoffs';
}

function performanceAwards(season, stage) {
  const post = stage === 'postseason';
  const awards = post ? season?.playoffAwards : season?.awards;
  if (!awards || post && !season.bracket?.champion) {
    operationsPage('Performance awards', 'Awards are available when this stage ends.', '<a href="#playoffs">Open playoffs →</a>');
    return;
  }
  const { save } = season;
  const labels = teamFinance.clubAwardRates;
  const keys = post ? ['eastFinals', 'westFinals', 'finals']
    : ['mvp', 'rookie', 'sixthMan', 'dpoy', 'mostImproved', 'clutch', 'coach', 'executive'];
  const pages = keys.flatMap(key => (awards[key] ?? []).map(id => ({
    key, ids: [id], title: ({ mvp: 'Most Valuable Player', eastFinals: 'Larry Bird Eastern Conference Finals MVP',
      westFinals: 'Magic Johnson Western Conference Finals MVP', finals: 'Bill Russell NBA Finals MVP' })[key] ?? labels[key][0],
  })));
  if (!post) for (const [key, label, count] of [['allNBA', 'All-NBA', 3], ['allDefense', 'All-Defensive', 2], ['allRookie', 'All-Rookie', 2]]) {
    for (let index = 0; index < count; index++) pages.push({ key, group: true, ids: (awards[key] ?? []).slice(index * 5, index * 5 + 5),
      title: label + ' ' + ['First', 'Second', 'Third'][index] + ' Team' });
  }
  operationsPage(seasonLabel(save.year) + ' Performance Awards', post ? 'Conference Finals and NBA Finals' : 'Regular-season winners and All-Team selections', `
    <p><a href="#award-race">Award Race</a>${save.year === uiYear ? ' · <a href="#award-overrides">Award Overrides</a>' : ''}</p>
    <section class="trade-board"><div id="award-feature"></div>
    <div class="trade-controls"><button type="button" id="award-prev">Previous</button>
    <span id="award-position" aria-live="polite"></span><button type="button" id="award-next">Next</button>
    <button type="button" id="award-continue">${post ? 'Return to bracket and offseason' : 'Continue to playoffs'}</button></div></section>`);
  let index = 0;
  const get = id => document.querySelector('#award-' + id);
  const draw = () => {
    const item = pages[index];
    get('prev').disabled = index === 0;
    get('next').disabled = index + 1 >= pages.length;
    get('position').textContent = pages.length ? (index + 1) + ' of ' + pages.length : 'No selections';
    if (!item) return;
    const id = item.ids[0];
    const player = season.profiles.get(id);
    const code = teams.has(id) ? id : post ? season.owners.get(id) : season.awardOwners?.get(id) ?? season.owners.get(id);
    const club = teams.get(code);
    const staffing = save.staffTimeline?.findLast(entry => entry.day < seasonSim.playoffStart)?.staffing ?? save.staffBaseline;
    const coach = item.key === 'coach' && club ? staffSim.assignments({ ...save, staffing }, code, staffSim.roles)['Head Coach'] : null;
    const winner = player?.name ?? coach?.name ?? (club ? club.name + ' front office' : 'No eligible selection');
    const stats = post ? season.results.filter(game => game.playoffRound === (item.key === 'finals' ? 3 : 2))
      .flatMap(game => [...game.homeBox, ...game.awayBox]).filter(line => line.id === id && line.MIN > 0) : [];
    const average = key => post ? stats.length ? stats.reduce((sum, line) => sum + (key === 'REB' ? line.OREB + line.DREB : line[key]), 0) / stats.length : null
      : season.averages.get(id)?.[key];
    const values = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%', 'FT%', '3P%'].map(key => {
      const pct = key.endsWith('%');
      const base = key.slice(0, -1);
      const value = post && pct ? seasonSim.percentage(average(base + 'M'), average(base + 'A')) : average(key);
      return `<div><dt>${key}</dt><dd>${value == null ? '—' : formatStat(value, 1) + (pct ? '%' : '')}</dd></div>`;
    }).join('');
    get('feature').innerHTML = `<div class="award-feature"><div>${club ? logo(club) : ''}
      ${player?.photo ? `<img class="award-portrait" src="${e(player.photo)}" alt="">` : ''}</div>
      <div><div class="eyebrow">${e(item.title)}</div><h2>${e(winner)}</h2>
      ${player ? `<a href="#player/${e(id)}">Player card →</a>` : coach ? `<a href="#staff-career/${e(code)}/0">Staff profile →</a>` : ''}
      ${player && !item.group ? `<dl class="bio">${values}</dl>` : club && !player ? `<p>${season.records[code].wins}–${season.records[code].losses} regular season</p>` : ''}</div></div>
      ${item.group ? castTable(['Player', 'Position', 'Team'], item.ids.map(id => {
        const selection = season.profiles.get(id);
        return [`<a href="#player/${e(id)}">${e(selection?.name ?? id)}</a>`, e(selection && playerTools.positionText(selection)),
          e(teams.get(season.awardOwners?.get(id) ?? season.owners.get(id))?.name)];
      })) : ''}`;
  };
  get('prev').addEventListener('click', () => { index--; draw(); });
  get('next').addEventListener('click', () => { index++; draw(); });
  get('continue').addEventListener('click', () => {
    if (!post && save.year === uiYear && !save.awardsReviewed) seasonSim.postseasonAction(save, 'review');
    location.hash = '#playoffs/' + save.year;
  });
  draw();
}

function bindPlayoffActions(season, archived) {
  const { save, bracket } = season;
  if (!bracket || archived) return;
  if (bracket.champion && !save.championshipReviewed) {
    const team = teams.get(bracket.champion);
    app.insertAdjacentHTML('beforeend', `<dialog id="championship-reveal" class="panel facility-card">
      <div class="eyebrow">NBA Champions</div>${logo(team)}<h2>${e(team.name)}</h2>
      <button type="button">Continue to postseason MVPs</button></dialog>`);
    const dialog = document.querySelector('#championship-reveal');
    dialog.addEventListener('cancel', event => event.preventDefault());
    dialog.querySelector('button').addEventListener('click', () => {
      seasonSim.postseasonAction(save, 'champion');
      dialog.close();
      location.hash = '#performance-awards/postseason/' + save.year;
    });
    dialog.showModal();
    return;
  }
  if (bracket.champion) return;
  const first = seasonSim.firstPlayoffGame + (seasonSim.revisedRules(save) ? postseason.playInDays : 0);
  const current = Math.max(0, Math.floor((save.day - first) / 14));
  for (const button of app.querySelectorAll('[data-playoff-round]')) button.addEventListener('click', () => {
    const round = Number(button.dataset.playoffRound);
    const code = button.dataset.playoffTeam;
    const series = bracket.rounds[round]?.find(match => [match.high, match.low].includes(code));
    const next = round < 0 ? save.day : first + round * 14 + 2 * (series ? series.highWins + series.lowWins : 0);
    const pair = round < 0 ? season.today.find(pair => pair.includes(code)) : series ? [series.high, series.low] : null;
    const playable = pair && next >= save.day;
    app.insertAdjacentHTML('beforeend', `<dialog id="playoff-actions" class="panel facility-card">
      <h2>${playable ? pair.map(code => e(teams.get(code).name)).join(' vs. ') : 'NBA Playoffs'}</h2>
      <div class="playoff-actions">${playable ? `
        ${pair.includes(save.team) ? '<button data-post-action="standard">SimCast</button><button data-post-action="live">SimCast Live</button>' : ''}
        <button data-post-action="game">Simulate through game</button>
        ${pair.map(code => `<button data-post-action="force" data-winner="${e(code)}">Force win · ${e(code)}</button>`).join('')}` : ''}
        <button data-post-action="round">${save.day < first ? 'Simulate Play-In' : 'Simulate current round'}</button>
        <button data-post-action="all">Simulate playoffs</button></div>
      <p role="alert" id="playoff-action-feedback"></p><form method="dialog"><button>Cancel</button></form></dialog>`);
    const dialog = document.querySelector('#playoff-actions');
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelectorAll('[data-post-action]').forEach(control => control.addEventListener('click', () => {
      try {
        const action = control.dataset.postAction;
        if (['round', 'all', 'game'].includes(action)) {
          seasonSim.advanceTo(save, action === 'all' ? first + 56 : action === 'game' ? next + 1 : save.day < first ? first : first + (current + 1) * 14);
        } else {
          if (next > save.day) seasonSim.advanceTo(save, next);
          const advanced = seasonSim.load();
          if (advanced.day === next && !advanced.rotationAlert) {
            if (action === 'force') {
              const scheduled = seasonSim.history(advanced).today.find(match => pair.every(code => match.includes(code)));
              if (!scheduled) throw new Error('This game is no longer scheduled.');
              seasonSim.postseasonAction(advanced, 'force', { home: scheduled[0], winner: control.dataset.winner });
            } else {
              seasonSim.simcastAction(advanced, 'start');
              const started = seasonSim.load();
              if (started.simcast) {
                seasonSim.simcastAction(started, 'view', { view: action });
                location.hash = '#simcast';
              }
            }
          }
        }
        dialog.close();
        render();
      } catch (error) { dialog.querySelector('#playoff-action-feedback').textContent = error.message; }
    }));
    dialog.showModal();
  });
}

function allStarWeekend(state) {
  if (!state) return operationsPage('All-Star Weekend', 'Start a franchise to follow league events.', '');
  const { save, allStarSaturday, selections, risingStars, allStarGame } = state;
  const day = seasonSim.allStarDayFor(save);
  const eventCard = (title, body) => `<section class="panel weekend-event"><h3>${title}</h3><div class="weekend-event-body">${body}</div></section>`;
  const scheduled = offset => `<p>Scheduled for ${simDate(day + offset, save.year)}.</p>`;
  const person = player => player.id ? `<a href="#player/${e(player.id)}">${e(player.name)}</a>` : e(player.name);
  const contest = (title, event) => {
    if (!event) return eventCard(title, scheduled(-1));
    const round = (label, rows) => `<h3>${label}</h3><div class="table-wrap"><table>
      <thead><tr><th>Rank</th><th>Player</th><th>Team</th><th>Score</th><th>Tiebreak</th></tr></thead>
      <tbody>${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.roster ? e(row.name) : person(row)}</td><td>${row.roster ? row.roster.map(person).join(' · ') : e(row.team)}</td><td>${row.score}</td>
      <td>${row.tiebreaks.join(' → ') || '—'}${row.judgeVotes == null ? '' : ' · ' + row.judgeVotes + ' judge votes'}</td></tr>`).join('')}</tbody></table></div>`;
    return eventCard(title, `<p class="weekend-honor"><strong>${e(event.winner?.name ?? 'No eligible entrants')}</strong>${event.winner ? ' · Champion' : ''}</p>
      ${round('Final', event.final)}<details><summary>Opening round</summary>${round('Opening round scores', event.opening)}</details>`);
  };
  const exhibition = (title, event, offset) => eventCard(title,
    !event ? (save.day < day + offset ? scheduled(offset) : offset === 0 && state.allStarDraft?.pending ? '<p>Complete the All-Star draft to simulate the tournament.</p>' : '<p>Insufficient eligible players.</p>') : `
      <p class="weekend-honor"><strong>${e(event.champion ?? 'No result')}</strong>${event.mvp ? ' · MVP ' + person(event.mvp) : ''}</p>
      ${event.games.map((game, i) => `<details><summary class="game-result">${i === event.games.length - 1 ? 'Final · ' : title === 'All-Star Game' && save.allStarFormat === 2 && i === 2 ? 'Third place · ' : ''}
        ${e(game.teams[0])} ${game.scores[0]} – ${game.scores[1]} ${e(game.teams[1])}</summary>
        ${game.boxes.map((box, side) => `<h4>${e(game.teams[side])}</h4><div class="table-wrap"><table>
          <thead><tr>${['Player', 'MIN', 'PTS', 'FG', 'FG%', '3PT', 'FT', 'ORB', 'DRB', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', '+/−'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead>
          <tbody>${box.map(line => `<tr><th scope="row">${person(line)}</th>${[
            Math.floor(line.seconds / 60) + ':' + String(line.seconds % 60).padStart(2, '0'), line.points,
            line.fgm + '–' + line.fga, line.fga ? (100 * line.fgm / line.fga).toFixed(1) + '%' : '—',
            line.threeMade + '–' + line.threeAttempts, line.ftm + '–' + line.fta,
            line.orb, line.drb, line.orb + line.drb, line.ast, line.stl, line.blk, line.turnovers, line.fouls, line.plusMinus,
          ].map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}</details>`).join('')}
      <details><summary>Event rosters</summary>${event.teams.map(team => `<p><strong>${e(team.name)}</strong> · ${team.roster.map(person).join(', ')}</p>`).join('')}</details>`);
  operationsPage(`${seasonLabel(save.year)} All-Star Weekend`, 'Exhibition games, contests, and honors.', `
    <div class="weekend-screen"><nav class="box-navigation screen-links" aria-label="All-Star Weekend navigation"><a class="primary-link" href="#calendar">Calendar</a><a class="primary-link" href="#award-overrides">Award Overrides</a><a class="primary-link" href="#all-star">Current Weekend</a><a class="primary-link" href="#league-news">League news</a>
    ${(save.pastSeasons ?? []).filter(season => season.year !== save.year).map(season => `<a class="primary-link" href="#all-star/${season.year}">${seasonLabel(season.year)}</a>`).join('')}</nav>
    ${allStarDraftMarkup(state)}
    ${state.risingStars?.teams.some(team => team.roster.length < 6) ? '<p class="muted">Some Rising Stars teams have fewer than six players because the eligible pool was too small.</p>' : ''}
    <h2>Exhibition games</h2><div class="weekend-events">${exhibition('Rising Stars', risingStars, -2)}${exhibition('All-Star Game', allStarGame, 0)}</div>
    <h2>Saturday contests</h2><div class="weekend-events">${contest('3-Point Contest', allStarSaturday?.threePoint)}${contest('Slam Dunk Contest', allStarSaturday?.dunk)}
    ${contest('Shooting Stars', allStarSaturday?.shootingStars)}</div>
    <section class="panel facility-card"><h2>All-Star selections</h2>
    <p class="note">${save.allStarFormat === 2 ? 'Conference selections are final on January 20. The four All-Star teams draft from the selected field, with injury replacements as needed.' : 'Conference voting honors are listed here. The exhibition rosters use USA and World eligibility.'}</p>
    ${selections.allStar.length ? ['East', 'West'].map(conference => `<h3>${conference}</h3><ul>${selections.allStar.filter(id =>
      teams.get(state.allStarOwners.get(id))?.conference === conference).map(id =>
      `<li><a href="#player/${e(id)}">${e(state.profiles.get(id)?.name ?? id)}</a>${save.allStarFormat === 2 ? '' : ' · ' + (selections.allStarStarters.includes(id) ? 'Starter' : 'Reserve')}</li>`).join('')}</ul>`).join('')
      : '<p>Selections will appear on the All-Star date.</p>'}</section>
    <section class="panel facility-card"><h2>Historical NBA contest winners</h2>
    ${Object.values(nbaContestHistory).map(({ title, source, winners }) => `<details><summary>${title}</summary>
    <p><a href="${e(source)}">NBA winner archive</a></p><div class="table-wrap"><table>
    <thead><tr><th>Year</th><th>Winner</th><th>Team</th></tr></thead><tbody>
    ${winners.map(([year, name, team]) => `<tr><td>${year}</td><td>${e(name)}</td><td>${e(team)}</td></tr>`).join('')}
    </tbody></table></div></details>`).join('')}</section></div>`);
  if (save.allStarFormat === 2) bindAllStarActions(save);
}

function franchiseCalendar(save, offset) {
  const state = seasonSim.history(save);
  const start = Date.parse(simDate(0));
  const dayOf = time => Math.round((time - start) / 86400000);
  const visibleDay = offset == null || !Number.isFinite(Number(offset)) ? save.day : Number(offset);
  const month = new Date(simDate(Math.max(0, Math.min(230, visibleDay))) + 'T00:00:00Z');
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const previous = dayOf(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
  const next = dayOf(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const today = new Date(simDate(save.day) + 'T00:00:00Z');
  const daysNextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 0)).getUTCDate();
  const monthTarget = dayOf(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, Math.min(today.getUTCDate(), daysNextMonth)));
  const closed = save.market?.open || state.bracket?.champion;
  const simulationLocked = closed || save.simcast;
  const simButton = (label, day) => `<button type="button" data-sim-day="${day}" ${simulationLocked ? 'disabled' : ''}>${label}</button>`;
  operationsPage('Calendar', 'Review home and away games, then simulate through a date or choose a time span.',
    `<section class="panel calendar-panel">${save.allStarHost ? `<div class="toolbar">All-Star host · ${e(teams.get(save.allStarHost).name)} · ${simDate(seasonSim.allStarDayFor(save))}</div>` : ""}<div class="toolbar calendar-bar">
      ${previous + 31 > 0 ? `<a href="#calendar/${Math.max(0, previous)}">‹ Previous month</a>` : ''}
      <strong>${month.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })}</strong>
      ${next <= 230 ? `<a href="#calendar/${next}">Next month ›</a>` : ''}</div>
      <div class="toolbar calendar-controls"><a href="#all-star">All-Star Weekend</a>${relationships.interview(save, state) ? `<a class="primary-link" href="#relationship-talk/reporter-${e(save.team)}">Press interview</a>` : ''}${state.today.some(pair => pair.includes(save.team)) && !closed ? `<a class="primary-link" href="#simcast">${save.simcast ? "Resume SimCast" : "SimCast today’s game"}</a>` : ""}${simButton('Sim day', save.day + 1)}${simButton('Sim week', save.day + 7)}
      ${simButton('Sim month', monthTarget)}${simButton('Sim season', 230)}
      <span id="calendar-feedback" role="status">${save.market?.open ? 'Close free agency first.' : state.bracket?.champion ? 'Season complete.' : ''}</span></div>
      <div class="calendar-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(name => `<strong>${name}</strong>`).join('')}
      ${'<div class="calendar-empty"></div>'.repeat(first.getUTCDay())}
      ${Array.from({ length: days }, (_, index) => {
        const day = dayOf(first) + index;
        const result = state.results.find(game => game.day === day && [game.home, game.away].includes(save.team));
        const match = (day === save.day ? state.today : seasonSim.fixtures(day, save)).find(game => game.includes(save.team));
        const opponent = match?.find(code => code !== save.team);
        const event = ['Rising Stars', 'All-Star Saturday', 'All-Star Game'][day - state.allStarDay + 2];
        const detail = result ? `${result.away} ${result.awayScore} · ${result.home} ${result.homeScore}`
          : opponent ? (match[0] === save.team ? 'vs ' : 'at ') + opponent : day > seasonSim.lastDay ? 'Postseason'
            : save.scheduleVersion >= 3 && Math.abs(day - seasonSim.allStarDayFor(save)) <= 2 ? 'All-Star break' : 'Off';
        const practice = !event && !opponent && day >= 0 && day <= seasonSim.lastDay &&
          arenaOps.settings(save, day).training.days.includes(new Date(simDate(day) + 'T00:00:00Z').getUTCDay());
        const content = `<b>${index + 1}</b><span>${day < 0 || day > 230 ? '' : e(event ?? (practice ? 'Practice' : detail))}</span>${opponent ? logo(teams.get(opponent)) : ''}`;
        if (result) {
          const outcome = resultOutcome(result, save.team);
          return `<a class="calendar-cell calendar-result ${outcome.style}" href="#game/${e(result.id)}/${save.year}"
            aria-label="${outcome.label === 'W' ? 'Win' : 'Loss'}, ${e(detail)}">
            <b>${index + 1} <span class="result-badge">${outcome.label}</span></b><span>${e(detail)}</span></a>`;
        }
        if (event && day < save.day) return `<a class="calendar-cell" href="#all-star/${save.year}">${content}</a>`;
        return day >= save.day && day <= 230 && !simulationLocked
          ? `<button class="calendar-cell ${day === save.day ? 'calendar-today' : ''} ${opponent
            ? (match[0] === save.team ? 'calendar-home' : 'calendar-away') : ''}" type="button" data-calendar-day="${day}"
            aria-label="Open ${simDate(day)} options">${content}</button>`
          : `<div class="calendar-cell calendar-empty">${content}</div>`;
      }).join('')}</div></section>
      <dialog id="calendar-day-menu" class="panel facility-card" aria-labelledby="calendar-menu-title">
      <h2 id="calendar-menu-title"></h2><div id="calendar-menu-body"></div><p id="calendar-menu-feedback" role="status"></p>
      <form method="dialog"><button>Cancel</button></form></dialog>`);
  document.querySelectorAll('[data-sim-day]').forEach(button => button.addEventListener('click', () => {
    try { seasonSim.advanceTo(save, Number(button.dataset.simDay)); location.hash = '#calendar'; render(); }
    catch (error) { document.querySelector('#calendar-feedback').textContent = error.message; }
  }));
  const menu = document.querySelector('#calendar-day-menu');
  document.querySelectorAll('[data-calendar-day]').forEach(button => button.addEventListener('click', () => {
    const day = Number(button.dataset.calendarDay);
    const slate = day === save.day ? state.today : seasonSim.fixtures(day, save);
    const ownGame = slate.find(pair => pair.includes(save.team));
    const title = ownGame ? 'Game day' : day > seasonSim.lastDay ? 'Postseason date' : 'Team off day';
    menu.querySelector('#calendar-menu-title').textContent = title + ' · ' + simDate(day);
    menu.querySelector('#calendar-menu-feedback').textContent = '';
    menu.querySelector('#calendar-menu-body').innerHTML = `<div class="calendar-menu-options">
      ${ownGame ? '<button data-day-action="standard">Simulate with SimCast</button><button data-day-action="live">Simulate with SimCast Live</button>'
        : day <= seasonSim.lastDay ? '<a class="primary-link" href="#training">Open training schedule</a>' : ''}
      <button data-day-action="through">Simulate through date</button>
      ${save.day <= seasonSim.lastDay ? '<button data-day-action="regular">Simulate regular season</button>' : ''}
      <details><summary>Daily view</summary><ul>${slate.map(([home, away]) => `<li>${e(away)} at ${e(home)}</li>`).join('') || '<li>No games scheduled.</li>'}</ul></details></div>`;
    menu.querySelectorAll('[data-day-action]').forEach(action => action.addEventListener('click', () => {
      try {
        const mode = action.dataset.dayAction;
        if (mode === 'through' || mode === 'regular') {
          seasonSim.advanceTo(save, mode === 'through' ? day + 1 : seasonSim.lastDay + 1);
          location.hash = '#calendar';
          render();
          return;
        }
        if (day > save.day) seasonSim.advanceTo(save, day);
        const nextSave = seasonSim.load();
        if (nextSave.day !== day || nextSave.rotationAlert) { location.hash = '#calendar'; render(); return; }
        seasonSim.simcastAction(nextSave, 'start');
        const started = seasonSim.load();
        if (started.simcast) seasonSim.simcastAction(started, 'view', { view: mode });
        location.hash = started.simcast ? '#simcast' : '#calendar';
        render();
      } catch (error) { menu.querySelector('#calendar-menu-feedback').textContent = error.message; }
    }));
    menu.showModal();
  }));
}

function leagueLeaders(season) {
  const stats = ['PTS','REB','AST','STL','BLK','MIN','GP','FG%','3P%','FT%','3PM','TO','OREB','DREB','DNK','OVR'];
  const options = values => values.map(value => `<option>${e(value)}</option>`).join('');
  operationsPage('League leaders', season ? 'Rank player performances across the franchise season.' : 'Rank players using the imported NBA season averages.',
    `<section class="panel"><div class="toolbar">
      <label>Stat<select id="leader-stat">${options(stats)}</select></label>
      <label>Season segment<select id="leader-segment">${options(season ? ['Regular season','Play-in','Playoffs'] : ['2025–26 NBA'])}</select></label>
      <label>Conference<select id="leader-conf">${options(['All','East','West'])}</select></label>
      <label>Team<select id="leader-team">${options(['All', ...teams.keys()])}</select></label>
      <label>Position<select id="leader-pos">${options(['All','G','F','C'])}</select></label>
      <label>Mode<select id="leader-mode">${options(['Per game','Totals'])}</select></label>
      <label>Order<select id="leader-order">${options(['Highest first','Lowest first'])}</select></label>
      <label>Minimum games<input id="leader-min" type="number" min="0" value="1"></label>
      <label>Find a player<input id="leader-search" type="search"></label>
    </div><div class="table-wrap"><table class="leaders-table"><thead id="leader-head"></thead><tbody id="leader-rows"></tbody></table></div></section>`);
  const get = id => document.querySelector('#leader-' + id);
  function update() {
    const stat = get('stat').value;
    const segment = { 'Play-in': season?.playInAverages, Playoffs: season?.playoffAverages }[get('segment').value] ?? season?.averages;
    const totals = get('mode').value === 'Totals';
    const rows = (season ? [...season.profiles.values()] : league.players).flatMap(player => {
      const line = season ? segment.get(player.id) : player.stats;
      const code = season ? season.owners.get(player.id) : player.team;
      const conf = teams.get(code)?.conference;
      const rawFor = stat => stat === 'OVR' ? season ? season.playerOveralls.get(player.id) : seasonSim.baseOverall(player)
        : stat === 'FG%' ? line?.[stat] ?? seasonSim.percentage(line?.FGM, line?.FGA) : line?.[stat];
      const raw = rawFor(stat);
      if (!Number.isFinite(raw) || (line?.GP ?? 0) < Number(get('min').value)
        || get('conf').value !== 'All' && get('conf').value !== conf
        || get('team').value !== 'All' && get('team').value !== code
        || get('pos').value !== 'All' && !playerTools.slots(player).some(position => position.includes(get('pos').value))
        || !player.name.toLowerCase().includes(get('search').value.toLowerCase().trim())) return [];
      const valueFor = key => {
        const raw = rawFor(key);
        return totals && !['GP','OVR'].includes(key) && !key.endsWith('%') && Number.isFinite(raw) ? Math.round(raw * line.GP) : raw;
      };
      return [{ player, code, valueFor, value: valueFor(stat) }];
    });
    const direction = get('order').value === 'Lowest first' ? -1 : 1;
    rows.sort((a,b) => direction * (b.value - a.value) || a.player.name.localeCompare(b.player.name));
    const columns = [...new Set(['GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%', '3P%', 'FT%', stat])];
    get('head').innerHTML = `<tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Team</th><th scope="col">POS</th>${columns.map(key =>
      `<th scope="col" aria-sort="${key === stat ? direction === 1 ? 'descending' : 'ascending' : 'none'}"><button type="button"
      data-stat="${key}" class="leader-sort ${key === stat ? 'selected' : ''}">${key}${key === stat ? direction === 1 ? ' ↓' : ' ↑' : ''}</button></th>`).join('')}</tr>`;
    get('rows').innerHTML = rows.map(({player, code, valueFor}, index) => `<tr><td>${index + 1}</td>
      <td><a href="#player/${e(player.id)}">${e(player.name)}</a></td><td>${e(code)}</td><td>${e(playerTools.positionText(player))}</td>
      ${columns.map(key => `<td class="${key === stat ? 'leader-selected' : ''}">${formatStat(valueFor(key), key === 'OVR' ? 2 : key.endsWith('%') ? 1 : totals || key === 'GP' ? 0 : 1)}</td>`).join('')}</tr>`).join('')
      || `<tr><td colspan="${columns.length + 4}">No players match these filters.</td></tr>`;
  }
  get('head').addEventListener('click', event => {
    const key = event.target.closest('button[data-stat]')?.dataset.stat;
    if (!key) return;
    get('order').value = key === get('stat').value && get('order').value === 'Highest first' ? 'Lowest first' : 'Highest first';
    get('stat').value = key;
    update();
  });
  for (const id of ['stat','segment','conf','team','pos','mode','order','min','search']) get(id).addEventListener('input', update);
  update();
}

function facilityManager(facility, save) {
  const type = facility.id;
  const state = seasonSim.history(save);
  const report = teamFinance.report(save, state);
  const config = arenaOps.settings(save)[type];
  const complete = Boolean(state.bracket?.champion);
  const controls = complete ? 'disabled' : '';
  const price = (amount, index = '', command = 'price') => `<form class="facility-price" data-command="${command}" data-index="${index}">
    <label>Price ($)<input name="value" type="number" min="0" max="10000" step="1" required value="${amount}" ${controls}></label>
    <button ${controls}>Save price</button></form>`;
  const action = (label, command, index = '') => `<button type="button" data-facility-action="${command}" data-index="${index}" ${controls}>${label}</button>`;
  const products = arenaOps.catalogs[type];
  const last = report.attendance.at(-1);
  const homeSchedule = type === 'arena' && !complete
    ? Array.from({ length: Math.max(1, seasonSim.lastDay - save.day + 1) }, (_, i) => save.day + i)
      .flatMap(day => (day === save.day ? state.today : seasonSim.fixtures(day, save))
        .filter(([home]) => home === save.team).map(([, away]) => [day, away])) : [];
  operationsPage(facility.name, facility.activity,
    `<dl class="panel bio"><div><dt>Available budget</dt><dd>${money(report.available)}</dd></div>
    <div><dt>Fan sentiment</dt><dd>${arenaOps.fanMood(save, state, save.team)} / 100</dd></div>
    <div><dt>Last home attendance</dt><dd>${last ? last.fans.toLocaleString() : "—"}</dd></div>
    <div><dt>Last home-game revenue here</dt><dd>${last ? money(last.sales[type === 'arena' ? 'Tickets' : facility.name]) : '—'}</dd></div></dl>
    <p id="facility-feedback" role="status"></p>
    ${products ? `<section class="panel table-wrap"><table><thead><tr><th>Product</th><th>Status</th><th>Price</th><th>Action</th></tr></thead>
      <tbody>${products.map(([name], index) => `<tr><td>${e(name)}</td><td>${config[index].unlocked ? config[index].selling ? 'Selling' : 'Off sale' : 'Locked'}</td>
      <td>${config[index].unlocked ? price(config[index].price, index) : '—'}</td><td>${config[index].unlocked
      ? action(config[index].selling ? 'Stop selling' : 'Start selling', 'toggle', index)
      : action('Unlock · ' + money(arenaOps.unlockPrice(type,index)), 'unlock', index)}</td></tr>`).join('')}</tbody></table></section>`
      : `<section class="panel facility-card"><h2>Level ${config.level}</h2><p>Capacity · ${arenaOps.capacity(type, config.level).toLocaleString()}
        ${type === 'parking' ? 'vehicles' : 'guests'}</p>
        ${type === 'vip' ? '' : price(config.price)}${config.level < arenaOps.maxLevel ? action((config.level ? 'Upgrade' : 'Unlock') + ' · ' + money(arenaOps.upgradePrice(type, config.level)), 'upgrade') : '<p>Maximum level</p>'}
        ${type === 'arena' ? `<h3>Fan night program</h3><p>Selected home games attract more fans when enabled.</p>${config.fanNightUnlocked
          ? action(config.fanNight ? 'Turn fan nights off' : 'Turn fan nights on', 'fan-toggle')
          : action('Unlock fan nights · $6,000,000', 'fan-unlock')}
          <h3>Giveaway program</h3><p>Giveaway games attract additional fans.</p>${config.giveawayUnlocked
          ? action(config.giveaway ? 'Turn giveaways off' : 'Turn giveaways on', 'giveaway-toggle')
          : action('Unlock giveaways · $8,500,000', 'giveaway-unlock')}
          <p class="note">Fan sentiment responds to recent results, ticket prices, promotions, and support for your team’s community program. It influences home attendance.</p>
          <h3>Away watch parties</h3><p>Open the arena to stream road games. Tickets are priced below standard home admission.</p>
          ${config.watchUnlocked ? action(config.watchEnabled ? 'Pause watch parties' : 'Run watch parties', 'watch-toggle')
            + price(Math.min(config.watchPrice, arenaOps.watchLimit(arenaOps.settings(save))), '', 'watch-price')
            + `<p class="note">Current watch party price limit · ${money(arenaOps.watchLimit(arenaOps.settings(save)))}</p>`
            : action('Unlock watch parties · $12,000,000', 'watch-unlock')}
          <h3>Set prices by game</h3><details><summary>${homeSchedule.length} upcoming home games</summary>
          ${homeSchedule.map(([day, away]) => `<div><strong>${simDate(day)} vs ${e(away)}</strong>
          ${price(config.gamePrices?.[day] ?? config.price, day, 'game-price')}</div>`).join('')}</details>` : ''}
        ${type === 'vip' ? `<h3>Packages</h3>${arenaOps.vipPackages.slice(0, config.level).map((name, index) =>
          `<div><strong>${e(name)}</strong>${price((config.packages ?? [config.price,260,400,550,725])[index], index, 'package-price')}</div>`).join('')
          || '<p>Unlock VIP to start offering packages.</p>'}` : ''}
      </section>`}`, 'facilities');
  const change = (command, index, value) => {
    try {
      seasonSim.saveFinanceAction(save, { type: 'facility', facility: type, command, index: Number(index), value });
      render();
      document.querySelector('#facility-feedback').textContent = 'Facility updated for upcoming games.';
    } catch (error) { document.querySelector('#facility-feedback').textContent = error.message; }
  };
  document.querySelectorAll('.facility-price').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault(); change(form.dataset.command, form.dataset.index, Number(new FormData(form).get('value')));
  }));
  document.querySelectorAll('[data-facility-action]').forEach(button => button.addEventListener('click', () =>
    change(button.dataset.facilityAction, button.dataset.index)));
}

function adRosterPicker(save, kind, ids = '') {
  if (!Object.hasOwn(arenaOps.campaigns, kind)) { advertisementCenter(save); return; }
  const state = seasonSim.history(save);
  const contracts = teamFinance.report(save, state).contracts;
  const selected = ids.split(',').filter(id => state.owners.get(id) === save.team);
  const required = kind === 'solo' ? 'Solo Panel Ad' : 'Team Panel Ad';
  const selectedRoute = '#ads/' + kind + '/' + selected.join(',');
  roster(teams.get(save.team), {
    back: selectedRoute.slice(1), label: 'Choose featured players · ★ contract requirement',
    marker: id => (kind !== 'company' && contracts.get(id)?.deal.perks.includes(required) ? ' <strong title="Contract requires this panel">★</strong>' : '')
      + (selected.includes(id) ? ' <span class="note">Selected</span>' : ''),
    actionLabel: id => selected.includes(id) ? 'Remove' : 'Feature',
    select: id => 'pick/ads/' + kind + '/' + (selected.includes(id) ? selected.filter(key => key !== id) : [...selected, id]).join(','),
  });
  app.querySelector('.back').textContent = '← Done choosing players (' + selected.length + ')';
}

function advertisementCenter(save, kind, ids) {
  const state = seasonSim.history(save);
  const report = teamFinance.report(save, state);
  const config = arenaOps.settings(save);
  const ads = config.ads;
  const selected = (ids ?? '').split(',').filter(id => state.owners.get(id) === save.team);
  const active = Object.hasOwn(arenaOps.campaigns, kind) ? arenaOps.campaigns[kind] : null;
  const blocked = state.bracket?.champion ? 'disabled' : '';
  const contractPerk = key => key === 'solo' ? 'Solo Panel Ad' : 'Team Panel Ad';
  const name = id => e(playersById.get(id)?.name ?? id);
  const required = key => [...report.contracts].filter(([, contract]) => contract.deal.perks.includes(contractPerk(key))).map(([id]) => id);
  operationsPage('Advertisement Center', 'Run campaigns to attract fans, feature players, and earn revenue from commercial partners.', `
    <dl class="panel bio"><div><dt>Available budget</dt><dd>${money(report.available)}</dd></div>
      <div><dt>Active team popularity boost</dt><dd>+${arenaOps.popularity(config)}</dd></div>
      <div><dt>Advertising and sponsorship receipts</dt><dd>${money(report.entries.filter(entry => ['Company panel', 'Sponsorships'].includes(entry.category)).reduce((sum, entry) => sum + entry.amount, 0))}</dd></div>
    </dl><p id="ads-feedback" role="status"></p>
    <section><h2>Ads</h2><p class="note">★ marks a contract requirement. Campaigns stay active until you stop or replace them.</p>
    <div class="division-grid">${Object.entries(arenaOps.campaigns).map(([key, item]) => `
      <article class="panel"><h3>${item.name}</h3><div class="facility-card">
        <p>+${item.popularity} team popularity · +${item.boost} marketability per featured player</p>
        ${key === 'company' ? '<p>Company pays $42,000 per home game.</p>' : ''}
        <p>${ads[key] ? 'Running' + (ads[key].company ? ' · ' + e(ads[key].company) : '') + ' · '
          + ads[key].players.map(id => name(id) + (key !== 'company' && required(key).includes(id) ? ' ★' : '')).join(', ') : 'No active campaign'}</p>
        ${key !== 'company' && required(key).some(id => !ads[key]?.players.includes(id))
          ? '<p>★ Needs a panel · ' + required(key).filter(id => !ads[key]?.players.includes(id)).map(name).join(', ') + '</p>' : ''}
        ${blocked ? '' : `<a class="primary-link" href="#ads/${key}/${ads[key]?.players.join(',') ?? ''}">${ads[key] ? 'Edit campaign' : 'Set up campaign'}</a>`}
        ${ads[key] ? `<button type="button" data-ad-stop="${key}" ${blocked}>Stop</button>` : ''}
      </div></article>`).join('')}</div>
    ${active && !blocked ? `<form id="ad-campaign" class="panel contract-form">
      <h3>Set up ${active.name}</h3>
      <p>${kind === 'solo' ? 'Each featured player receives a separate solo panel.' : 'Choose the players who appear in the panel.'}</p>
      <p>${selected.map(id => name(id) + (kind !== 'company' && required(kind).includes(id) ? ' ★' : '')).join(', ') || 'No players selected'}</p>
      <a class="primary-link" href="#pick/ads/${kind}/${selected.join(',')}">Choose featured players from roster →</a>
      ${kind === 'team' ? `<a href="#ads/team/${state.rosters.get(save.team).map(player => e(player.id)).join(',')}">Feature entire roster →</a>` : ''}
      ${kind === 'company' ? `<label>Company name<input name="company" maxlength="60" required value="${e(ads[kind]?.company ?? '')}"></label>` : ''}
      <button ${selected.length ? '' : 'disabled'}>Launch · ${money(active.cost * (kind === 'solo' ? Math.max(1, selected.length) : 1))}</button>
    </form>` : ''}</section>
    <section><h2>Team sponsorships</h2><p>Sign up to four brands, with one deal per category. Deals pay separately for home and away games.</p>
      <p class="note">Brand names are real. Offers, rates and eligibility are simulated. Signing the first branded deal replaces any legacy partner.</p>
      ${ads.sponsor ? `<p>Legacy partner · ${e(arenaOps.sponsors[ads.sponsor]?.name)} <button data-sponsor="none" ${blocked}>End deal</button></p>` : ''}
      ${sponsorGroups(sponsor => {
        const activeDeal = ads.deals[sponsor.category] === sponsor.name;
        const locked = ads.deals[sponsor.category] || Object.keys(ads.deals).length >= 4 || arenaOps.popularity(config) < sponsor.popularity;
        return `<li><strong>${e(sponsor.name)}</strong> · ${money(sponsor.home)} home / ${money(sponsor.away)} away
          ${sponsor.popularity ? ' · Requires +' + sponsor.popularity + ' campaign popularity' : ''}
          <button type="button" ${activeDeal ? 'data-brand-end' : 'data-brand-sign'}="${e(activeDeal ? sponsor.category : sponsor.name)}"
          ${blocked || (!activeDeal && locked) ? 'disabled' : ''}>${activeDeal ? 'End deal' : 'Sign team deal'}</button></li>`;
      }, category => ads.deals[category])}</section>`, 'facilities');
  const apply = (command, index, value) => {
    try {
      seasonSim.saveFinanceAction(save, { type: 'facility', facility: 'ads', command, index, value });
      if (location.hash === '#ads') render();
      else location.hash = '#ads';
    } catch (error) { document.querySelector('#ads-feedback').textContent = error.message; }
  };
  document.querySelector('#ad-campaign')?.addEventListener('submit', event => {
    event.preventDefault();
    apply('campaign', kind, { players: selected, company: new FormData(event.currentTarget).get('company') });
  });
  document.querySelectorAll('[data-ad-stop]').forEach(button => button.addEventListener('click', () => apply('stop', button.dataset.adStop)));
  document.querySelectorAll('[data-sponsor]').forEach(button => button.addEventListener('click', () => apply('sponsor', button.dataset.sponsor)));
  document.querySelectorAll('[data-brand-sign]').forEach(button => button.addEventListener('click', () => apply('brand-sign', button.dataset.brandSign)));
  document.querySelectorAll('[data-brand-end]').forEach(button => button.addEventListener('click', () => apply('brand-end', button.dataset.brandEnd)));
}

function showRotationAlert(save) {
  const state = seasonSim.history(save);
  const alert = save.rotationAlert;
  app.insertAdjacentHTML('beforeend', `<dialog id="rotation-alert" class="panel facility-card">
    <div class="eyebrow">Simulation paused</div><h2>Injury update</h2><p>${alert.shortHanded
      ? 'The available roster cannot cover 240 minutes. Add a healthy player if possible, or accept a forfeit in Coaching.'
      : alert.issues.length ? 'Adjust your rotation before advancing.' : 'Your current rotation is valid.'}</p><ul>${alert.issues.map(issue =>
      `<li>${e(state.profiles.get(issue.id)?.name ?? issue.id)} · ${e(state.health.get(issue.id)?.injury?.name ?? 'Injury')} · ${issue.cap === 0 ? 'Unavailable' : 'Limited to ' + issue.cap + ' minutes'}
      · ${issue.planned} planned</li>`).join('')}${(alert.recovered ?? []).map(item =>
        `<li>${e(state.profiles.get(item.id)?.name ?? item.id)} has recovered.</li>`).join('')}</ul>
    <div class="injury-choices">
      <button data-injury-choice="leave" ${alert.issues.length || alert.shortHanded ? 'disabled' : ''}>Leave rotation as-is</button>
      <a class="primary-link" id="fix-rotation" href="#coaching">Adjust rotation manually</a>
      <button data-injury-choice="cpu" ${alert.shortHanded ? 'disabled' : ''}>Have CPU adjust rotation</button>
      <button data-injury-choice="always" ${alert.shortHanded ? 'disabled' : ''}>Always have CPU adjust rotation</button>
    </div><p id="injury-feedback" role="status"></p>
    ${alert.shortHanded ? '<form method="dialog"><button>Review roster options</button></form>' : ''}
  </dialog>`);
  const dialog = document.querySelector('#rotation-alert');
  dialog.querySelector('#fix-rotation').addEventListener('click', () => dialog.close());
  dialog.querySelectorAll('[data-injury-choice]').forEach(button => button.addEventListener('click', () => {
    try { seasonSim.resolveInjuryRotation(save, button.dataset.injuryChoice); dialog.close(); render(); }
    catch (error) { dialog.querySelector('#injury-feedback').textContent = error.message; }
  }));
  dialog.showModal();
}

function playerEditor(save, id) {
  const state = seasonSim.history(save);
  const player = state.unavailable.has(id) ? null : state.profiles.get(id);
  if (id !== 'new' && !player) {
    roster(null, { back: 'franchise', label: 'Select a player to edit', select: id => 'player-editor/' + id });
    app.insertAdjacentHTML('afterbegin', '<p><a class="primary-link" href="#player-editor/new">Create player</a></p>');
    return;
  }
  const slots = player ? playerTools.slots(player) : ['PG'];
  const ratings = player ? playerDevelopment.ratings(state.development, player) : {};
  const field = (label, name, value, extra = '') => `<label>${label}<input name="${name}" value="${e(value ?? '')}" ${extra}></label>`;
  const owner = player && state.owners.get(player.id);
  const canDelete = player && (!owner || !save.market?.open && save.day <= seasonSim.lastDay && state.rosters.get(owner).length > 10);
  operationsPage(player ? 'Edit ' + player.name : 'Create player',
    'Save changes to this franchise. Created players enter the free-agent pool. Completed box scores are preserved.', `
    <a class="back" href="#player-editor">← Player editor</a><p id="editor-feedback" role="status"></p>
    <form id="player-editor-form" class="panel contract-form">
    <div class="toolbar">
      ${field('Name', 'name', player?.name, 'required maxlength="80"')}
      ${field('Date of birth', 'dob', player?.dob, 'type="date"')}
      ${field('Experience', 'experience', player?.experience, 'type="number" min="0" max="40"')}
      ${field('Height', 'height', player?.height, 'maxlength="24"')}
      ${field('Weight', 'weight', player?.weight, 'maxlength="24"')}
      ${field('College or prior team', 'college', player?.college, 'maxlength="80"')}
      ${field('Wingspan', 'wingspan', player?.wingspan, 'maxlength="24"')}
      ${field('Standing reach', 'standingReach', player?.standingReach, 'maxlength="24"')}
      <label>Handedness<select name="handedness"><option value="">Unknown</option>
        ${['Right','Left','Ambidextrous'].map(value => `<option ${player?.handedness === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      ${['Primary position','Secondary position','Third position'].map((label, index) => `<label>${label}
        <select name="position" ${index === 0 ? 'required' : ''}>${index ? '<option value="">None</option>' : '<option value="">Choose position</option>'}
        ${playerTools.positions.map(value => `<option ${slots[index] === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>`).join('')}
    </div>
    <fieldset><legend>Player progression</legend><div class="toolbar">
      ${[['Peak start age', 'peakStart'], ['Peak end age', 'peakEnd'], ['Yearly gain', 'gain'], ['Yearly loss', 'loss']].map(([label, key]) =>
        field(label, key, (player?.progression ?? (player && playerDevelopment.curve(player)))?.[key],
          'type="number" step="' + (key.startsWith('peak') ? '1' : '0.01') + '"')).join('')}
      <button type="button" id="default-progression">Use default progression</button>
    </div><small>Leave all four fields blank to use the automatic curve.</small></fieldset>
    ${Object.entries(groups).map(([group, attributes]) => `<fieldset><legend>${e(group)}</legend><div class="toolbar">${attributes.map(key =>
      field(e(key), e(key), player ? ratings[key].toFixed(2) : 65, 'type="number" min="25" max="99" step="0.01" required')).join('')}</div></fieldset>`).join('')}
    <button ${state.bracket?.champion ? 'disabled' : ''}>${player ? 'Save changes' : 'Create free agent'}</button>
    </form>
    ${canDelete && !state.bracket?.champion ? `<form id="delete-player" class="panel contract-form">
      <h2>Remove from league</h2><p>Removes this player from the active roster and free agency. Past game records remain available.</p>
      <label><input type="checkbox" required> Confirm player removal</label><button>Remove player</button></form>` : ''}
  `);
  const progressionFields = ['peakStart', 'peakEnd', 'gain', 'loss'];
  document.querySelector('#default-progression').onclick = event => {
    const defaults = player && playerDevelopment.curve(player);
    for (const key of progressionFields) event.target.form.elements[key].value = defaults?.[key] ?? '';
  };
  document.querySelector('#player-editor-form').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const target = seasonSim.editPlayer(save, player ? 'update' : 'create', id, {
        progression: progressionFields.every(key => data.get(key) === '') ? null :
          Object.fromEntries(progressionFields.map(key => [key, data.get(key) === '' ? NaN : Number(data.get(key))])),
        name: data.get('name'), dob: data.get('dob'), experience: data.get('experience') === '' ? null : Number(data.get('experience')),
        height: data.get('height'), weight: data.get('weight'), college: data.get('college'), positions: data.getAll('position'),
        wingspan: data.get('wingspan'), standingReach: data.get('standingReach'), handedness: data.get('handedness'),
        attributes: Object.fromEntries(playerTools.attributes.map(key => [key, Number(data.get(key))])),
      });
      location.hash = '#player/' + target;
    } catch (error) { document.querySelector('#editor-feedback').textContent = error.message; }
  });
  document.querySelector('#delete-player')?.addEventListener('submit', event => {
    event.preventDefault();
    try { seasonSim.editPlayer(save, 'delete', id); location.hash = '#player-editor'; }
    catch (error) { document.querySelector('#editor-feedback').textContent = error.message; }
  });
}

function periodAwardLink(period, winner) {
  return period.key === 'coachMonth'
    ? '#staff-career/' + winner.team + '/monthly-' + winner.id : '#player/' + winner.id;
}

function leagueNewsCards(save, state = seasonSim.history(save)) {
  const name = id => state.profiles.get(id)?.name ?? id;
  const cards = [];
  const post = (kind, day, clubs, headline, body, href, players = [], type = '', source = '') =>
    cards.push({ kind, day, clubs, headline, body, href, players, type, source });
  const allStarDay = seasonSim.allStarDayFor(save);
  for (const [title, event, offset] of [
    ['Rising Stars', state.risingStars, -2], ['All-Star Game', state.allStarGame, 0],
  ]) {
    if (!event?.champion) continue;
    post('Awards', allStarDay + offset, [], event.champion + ' wins ' + title,
      event.mvp ? event.mvp.name + ' named MVP' : '', '#all-star', event.mvp ? [event.mvp.id] : []);
  }
  for (const [title, event] of [
    ['3-Point Contest', state.allStarSaturday?.threePoint], ['Slam Dunk Contest', state.allStarSaturday?.dunk],
    ['Shooting Stars', state.allStarSaturday?.shootingStars],
  ]) {
    if (!event?.winner) continue;
    const winner = event.winner;
    post('Awards', allStarDay - 1, winner.team ? [winner.team] : [], winner.name + ' wins ' + title,
      'Final score · ' + winner.score, '#all-star', winner.roster ? winner.roster.flatMap(player => player.id ? [player.id] : []) : [winner.id]);
  }
  for (const leak of save.gmLeaks ?? []) {
    post('Rumors', leak.day, [save.team, leak.team], 'Private front office talks leak',
      leak.playerId ? name(leak.playerId) + ' mentioned in trade talks' : 'A private commitment to revisit trade talks became public.',
      '#team-intel/' + leak.team, leak.playerId ? [leak.playerId] : []);
  }
  for (const item of save.financeActions) {
    if (item.type === 'signing' || item.type === 'contract') {
      const team = item.team ?? save.team;
      post('Transactions', item.day, [team], name(item.id) + (item.type === 'contract' ? ' agrees to revised terms with ' : ' signs with ') + team,
        money(item.deal.salary) + ' annually · ' + item.deal.years + ' year(s)', '#player/' + item.id, [item.id],
        item.type === 'contract' ? 'Contract revisions' : 'Signings');
    } else if (item.type === 'trade') {
      const team = item.team ?? save.team;
      post('Transactions', item.day, [team, item.otherTeam], team + ' and ' + item.otherTeam + ' complete a trade',
        team + ' receives ' + tradePackageText(item, 1, name) + '\n' + item.otherTeam + ' receives ' + tradePackageText(item, 0, name),
        '#transactions', seasonSim.tradePlayers(item).flat(), 'Trades');
    } else if (item.type === 'facility' && item.team && item.team !== save.team) {
      post('Team business', item.day, [item.team], item.team + ' updates ' + item.description,
        money(item.cost) + ' investment', '#finances');
    } else if (item.type === 'facility' && item.description.startsWith('Development Division · player')) {
      const activity = item.description.endsWith('assigned') ? 'Affiliate assignment' : 'NBA recall';
      post('Transactions', item.day, [save.team], save.team + ' · ' + activity, 'Development Division roster update', '#development-division');
    } else if (item.type === 'cut') {
      const team = item.team ?? save.team;
      post('Transactions', item.day, [team], team + ' waives ' + name(item.id), 'Roster update', '#player/' + item.id, [item.id], 'Waivers');
    }
  }
  for (const [key, talk] of Object.entries(save.negotiations ?? {})) {
    if (!key.startsWith('extension:') || !talk.accepted) continue;
    const id = key.slice(10);
    const team = talk.team ?? save.team;
    post('Transactions', talk.day, [team], name(id) + ' signs an extension with ' + team,
      money(talk.deal.salary) + ' annually · ' + talk.deal.years + ' year(s)', '#player/' + id, [id], 'Extensions');
  }
  for (const pick of save.draftRoom?.picks ?? []) {
    const player = draftOps.prospects(save).find(item => item.id === pick.id);
    post('Transactions', save.day, [pick.team], pick.team + ' drafts ' + (player?.name ?? pick.id), 'Pick ' + pick.number, '#draft');
  }
  for (const edit of save.playerEdits ?? []) if (edit.type === 'delete') {
    post('Transactions', edit.day, [], name(edit.id) + ' removed from the league', 'Franchise editor', '#player/' + edit.id);
  }
  for (const injury of state.injuries) {
    post('Injuries', injury.day, [injury.team], name(injury.id) + ' · ' + (injury.name ?? injury.condition),
      injury.team + ' availability · ' + injury.condition, '#player/' + injury.id, [injury.id], '', 'Injury Report');
  }
  const records = { game: new Map(), playoffs: new Map() };
  const recordValue = (line, stat) => (stat === 'REB' ? line.OREB + line.DREB : line[stat]) || 0;
  for (const [view, board] of Object.entries(records)) {
    for (const stat of Object.keys(recordStats)) {
      const historical = brefPerformanceBoards[view]?.[stat]?.rows ?? [];
      if (historical.length) board.set(stat, Math.max(...historical.map(row => row[1])));
    }
  }
  for (const season of save.pastSeasons ?? []) {
    for (const game of seasonSim.history(season).results) {
      if (game.forfeit || game.playoffRound === -1) continue;
      const board = records[game.playoffRound == null ? 'game' : 'playoffs'];
      const lines = [...game.homeBox, ...game.awayBox];
      for (const [stat, high] of board) board.set(stat, Math.max(high, ...lines.map(line => recordValue(line, stat))));
    }
  }
  for (const game of state.results) {
    const result = resultOutcome(game);
    const loser = game.home === result.winner ? game.away : game.home;
    const winningBox = game.home === result.winner ? game.homeBox : game.awayBox;
    const standout = winningBox.reduce((leader, line) => !leader || line.PTS > leader.PTS ? line : leader, null);
    post('Results', game.day, [game.home, game.away], result.winner + ' defeats ' + loser,
      game.away + ' ' + game.awayScore + ' at ' + game.home + ' ' + game.homeScore
        + (standout ? ' · ' + name(standout.id) + ' leads the winners with ' + standout.PTS + ' points' : ''), '#game/' + game.id + '/' + save.year,
      standout ? [standout.id] : []);
    if (game.forfeit || game.playoffRound === -1) continue;
    const view = game.playoffRound == null ? 'game' : 'playoffs';
    const board = records[view];
    const entries = ['home', 'away'].flatMap(side =>
      game[side + 'Box'].map(line => ({ line, team: game[side] })));
    for (const [stat, high] of board) {
      const best = Math.max(high, ...entries.map(({ line }) => recordValue(line, stat)));
      if (best <= high) continue;
      board.set(stat, best);
      for (const { line, team } of entries.filter(entry => recordValue(entry.line, stat) === best)) {
        post('Records', game.day, [team], name(line.id) + ' sets a new NBA ' + recordViews[view].toLowerCase() + ' record',
          recordStats[stat] + ' · ' + best + ' (previous high ' + high + ')', '#game/' + game.id + '/' + save.year, [line.id]);
      }
    }
  }
  for (const period of state.periodAwards) for (const winner of period.winners.filter(Boolean)) {
    const coach = period.key === 'coachMonth';
    post('Awards', period.day, [winner.team], (winner.name ?? name(winner.id)) + ' wins ' + nbaAwards.periodLabels[period.key],
      winner.conference + ' · ' + period.label + (coach ? ' · ' + winner.wins + '–' + (winner.games - winner.wins) : ''),
      periodAwardLink(period, winner), coach ? [] : [winner.id]);
  }
  for (const [key, ids] of Object.entries(state.awards ?? {})) {
    const rate = teamFinance.clubAwardRates[key];
    if (!rate || Array.isArray(rate[1]) || key === 'allStar') continue;
    for (const id of ids) {
      const club = teams.has(id) ? id : state.awardOwners?.get(id);
      post('Awards', seasonSim.playoffStart, club ? [club] : [], rate[0] + ' · ' + (teams.has(id) ? teams.get(id).name : name(id)),
        'League award announced', '#playoffs', teams.has(id) ? [] : [id]);
    }
  }
  if (state.bracket?.champion) {
    const champion = state.bracket.champion;
    post('Awards', state.results.at(-1).day, [champion], teams.get(champion).name + ' win the NBA championship',
      'NBA Finals complete', '#playoffs');
  }
  if (!save.market?.open && save.day <= seasonSim.lastDay) {
    const bids = freeAgency.aiBids(save, state).slice(0, 3);
    for (const bid of bids) {
      const reporter = relationships.reporters.find(item => item.code === bid.team);
      if (!reporter || worldRelationships.reporterSource(save, state, reporter.code, bid.team) < 28) continue;
      post('Rumors', save.day, [bid.team], bid.team + ' monitoring ' + name(bid.id),
        'Unconfirmed interest from the team’s free-agent shortlist', '#player/' + bid.id, [bid.id], '', reporter.name);
    }
  }
  for (const id of Object.keys(save.market?.offers ?? {})) {
    post('Rumors', save.day, [save.team], save.team + ' linked with ' + name(id), 'Unconfirmed interest in a free-agent offer',
      '#free-agency/' + id, [id], '', relationships.reporters.find(item => item.code === save.team)?.name);
  }
  for (const promise of relationships.read(save).promises) {
    if (promise.year !== save.year || promise.status !== 'pending' || promise.kind !== 'teammate') continue;
    post('Rumors', save.day, [save.team, state.owners.get(promise.value)].filter(Boolean),
      save.team + ' has interest in ' + name(promise.value), 'Player recruitment discussion · no deal announced', '#contact/' + promise.id,
      [promise.value]);
  }
  cards.sort((a, b) => (b.day ?? -1) - (a.day ?? -1));
  return cards;
}

function newsStory(item, year) {
  const source = item.source || ({ Transactions: 'Transaction Wire', Injuries: 'Injury Report',
    Awards: 'League Awards', Records: 'Record Book', Results: 'Scoreboard', Rumors: 'Rumor Desk' })[item.kind] || 'League Desk';
  const date = item.day == null ? '' : simDate(item.day, year);
  return `<article class="panel news-story"><header><strong>${e(source)}</strong><time datetime="${e(date)}">${e(date || 'Date unavailable')}</time></header>
    <h3><a href="${e(item.href)}">${e(item.headline)}</a></h3><p>${e(item.body)}</p>
    <footer>${e([item.type || item.kind, ...item.clubs].join(' · '))}</footer></article>`;
}

function leagueNews(save, view) {
  const state = seasonSim.history(save);
  const cards = leagueNewsCards(save, state);
  const sections = [['', 'Trending'], ['transactions', 'Transaction report'], ['injuries', 'Injury report'],
    ['awards', 'Season awards'], ['history', 'League history']];
  const nav = `<div class="player-card-tabs news-tabs">${sections.map(([key, label]) =>
    `<a href="#league-news${key ? '/' + key : ''}" ${(view ?? '') === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}<a href="#all-star">All-Star Weekend</a></div>`;
  const awardHistory = view === 'history' || view === 'awards' ? leagueAwardHistory(save, state, view === 'history') : '';
  const activeInjuries = view === 'injuries' ? [...state.owners].flatMap(([id, code]) => {
    const health = state.health.get(id);
    if (!health || (!health.injury && health.durability > 50)) return [];
    return [{ id, code, name: state.profiles.get(id)?.name ?? id, status: seasonSim.tier(health.durability),
      injury: health.injury?.name, duration: injuryDetails(health, save.day, save.year) }];
  }) : [];
  const report = view === 'history' ? `<div class="franchise-actions"><a href="#records">NBA records →</a>
    <a href="#records/${e(save.team)}">Team records →</a>
    <a href="#nba-history">Historical award winners and Finals →</a>
    <a href="#nba-history/team/${e(save.team)}">Team history →</a>
    <a href="#nba-history/jerseys/${e(save.team)}">Retired jerseys →</a>
    <a href="https://www.nba.com/news/history-nba-champions">Official NBA champions →</a></div>
    <h2>Franchise champions</h2>${castTable(['Season', 'Finals result', 'Finals MVP'], [...(save.pastSeasons ?? []), save].reverse().flatMap(entry => {
      const history = seasonSim.history(entry);
      const series = history.bracket?.rounds.at(-1)?.[0];
      if (!history.bracket?.champion || !series) return [];
      const mvp = history.playoffAwards?.finals?.[0];
      return [[e(seasonLabel(entry.year)), e(teams.get(series.high).name + ' ' + series.highWins + ' · ' + teams.get(series.low).name + ' ' + series.lowWins),
        e(history.profiles.get(mvp)?.name)]];
    }))}` : '';
  operationsPage('League news', 'Follow completed transactions, injuries, scores, and developing stories across the league.', `
    ${nav}${report}${awardHistory}
    <div class="panel toolbar"><label>${view === 'transactions' ? 'Transaction type' : view === 'injuries' ? 'Report' : 'Coverage'}<select id="news-kind">${(view === 'transactions'
      ? ['All', 'Trades', 'Signings', 'Extensions', 'Waivers', 'Contract revisions']
      : view === 'injuries' ? ['Current injuries', 'Recovery history']
      : ['All', 'Transactions', 'Team business', 'Injuries', 'Results', 'Awards', 'Records', 'Rumors']).map(kind => `<option>${kind}</option>`).join('')}</select></label>
    <label>Team<select id="news-team"><option>All</option>${[...teams.keys()].map(code => `<option>${e(code)}</option>`).join('')}</select></label>
    <label>Search<input id="news-search" type="search"></label></div>
    <div class="news-feed" id="news-feed"></div><button id="news-more">Show more</button>`);
  const get = id => document.querySelector('#news-' + id);
  get('kind').value = { injuries: 'Current injuries', awards: 'Awards' }[view] ?? 'All';
  let limit = 40;
  let recoveries;
  const update = () => {
    const query = get('search').value.trim().toLowerCase();
    const kind = get('kind').value;
    const team = get('team').value;
    const matches = (clubs, text) => (team === 'All' || clubs.includes(team)) && text.toLowerCase().includes(query);
    let filtered = cards.filter(item => (view === 'transactions' ? item.kind === 'Transactions' && (kind === 'All' || kind === item.type)
      : kind === 'All' || kind === item.kind) && matches(item.clubs, item.headline + ' ' + item.body));
    if (view === 'injuries') {
      const current = kind === 'Current injuries';
      if (!current) recoveries ??= [save, ...[...(save.pastSeasons ?? [])].reverse()].flatMap(entry => {
        const history = entry === save ? state : seasonSim.history(entry);
        return [...history.injuries].reverse().filter(item => item.condition === 'Healthy').map(item => ({
          ...item, year: entry.year, playerName: history.profiles.get(item.id)?.name ?? item.id,
        }));
      });
      filtered = current ? activeInjuries.filter(item => matches([item.code], [item.name, item.status, item.injury].join(' ')))
        : recoveries.filter(item => matches([item.team], item.playerName + ' ' + (item.name ?? '')));
      get('feed').innerHTML = current ? castTable(['Player', 'Team', 'Status', 'Injury', 'Duration'], filtered.slice(0, limit).map(item =>
        [`<a href="#player/${e(item.id)}">${e(item.name)}</a>`, e(item.code), e(item.status), e(item.injury), e(item.duration)]))
        : castTable(['Cleared', 'Player', 'Team', 'Injury'], filtered.slice(0, limit).map(item =>
          [e(simDate(item.day, item.year)), `<a href="#player/${e(item.id)}">${e(item.playerName)}</a>`, e(item.team), e(item.name)]));
    } else get('feed').innerHTML = view === 'transactions' ? castTable(['Date', 'Teams', 'Type', 'Transaction', 'Details'],
      filtered.slice(0, limit).map(item => [e(item.day == null ? '—' : simDate(item.day, save.year)), e(item.clubs.join(' / ')),
        e(item.type || 'Other'), `<a href="${e(item.href)}">${e(item.headline)}</a>`, e(item.body).replaceAll('\n', '<br>')]))
      : filtered.slice(0, limit).map(item => newsStory(item, save.year)).join('')
      || '<p>No updates match these filters.</p>';
    get('more').hidden = filtered.length <= limit;
  };
  for (const id of ['kind','team','search']) get(id).addEventListener('input', () => { limit = 40; update(); });
  get('more').addEventListener('click', () => { limit += 40; update(); });
  update();
  document.querySelector('#league-award-type')?.addEventListener('change', event => {
    document.querySelectorAll('[data-award-type]').forEach(section => { section.hidden = section.dataset.awardType !== event.target.value; });
  });
}

function leagueAwardHistory(save, state, archived) {
  const seasons = [...(archived ? (save.pastSeasons ?? []).map(entry => ({ state: seasonSim.history(entry), save: entry })) : []),
    { state, save }].reverse();
  const periodic = Object.entries(nbaAwards.periodLabels);
  const eventAwards = {
    allStarMvp: ['All-Star Game MVP', state => [state.allStarGame?.mvp]],
    risingMvp: ['Rising Stars MVP', state => [state.risingStars?.mvp]],
    threePoint: ['3-Point Contest champion', state => [state.allStarSaturday?.threePoint.winner]],
    dunk: ['Slam Dunk Contest champion', state => [state.allStarSaturday?.dunk.winner]],
    shootingStars: ['Shooting Stars champion', state => state.allStarSaturday?.shootingStars.winner?.roster ?? []],
  };
  const categories = [...periodic.map(([key, label]) => [key, [label]]), ...Object.entries(teamFinance.clubAwardRates),
    ...Object.entries(eventAwards)];
  return `<section><h2>${archived ? 'Franchise award history' : 'Current-season awards'}</h2>
    <p><a href="#award-race">Award Race</a> · <a href="#award-overrides">Award Overrides</a></p>
    <div class="toolbar"><label>Award <select id="league-award-type">${categories.map(([key, [label]]) =>
      `<option value="${e(key)}">${e(label)}</option>`).join('')}</select></label></div>
    ${categories.map(([key]) => `<section data-award-type="${e(key)}" ${key === categories[0][0] ? '' : 'hidden'}>
      ${Object.hasOwn(nbaAwards.periodLabels, key)
        ? castTable(['Season', 'Period', 'Eastern Conference', 'Western Conference'], seasons.flatMap(({ state, save: entry }) =>
          state.periodAwards.filter(period => period.key === key).map(period => [
            e(seasonLabel(entry.year)), e(period.label), ...period.winners.map(winner => winner
              ? `<a href="${e(periodAwardLink(period, winner))}">${e(winner.name ?? state.profiles.get(winner.id)?.name ?? winner.id)}</a> · ${e(winner.team)}`
              : '—'),
          ])))
        : castTable(['Season', 'Team', 'Winner'], seasons.flatMap(({ state, save: entry }) => {
        if (eventAwards[key]) return eventAwards[key][1](state).filter(Boolean).map(player => [
          `<a href="#all-star/${entry.year}">${e(seasonLabel(entry.year))}</a>`,
          e(teams.get(player.team)?.name ?? 'Guest'), e(player.name),
        ]);
        const ids = key === 'allStar' ? state.selections?.allStar ?? state.awards?.allStar
          : state.awards?.[key] ?? state.playoffAwards?.[key];
        return (ids ?? []).map(id => {
          const code = teams.has(id) ? id : state.awardOwners?.get(id) ?? state.owners.get(id);
          const club = teams.get(code);
          const winner = key === 'coach' && club ? staffSim.assignments(entry, code, staffSim.roles)['Head Coach'].name
            : club && key === 'executive' ? club.name + ' front office' : state.profiles.get(id)?.name ?? id;
          return [e(seasonLabel(entry.year)), e(club?.name), e(winner)];
        });
      }))}</section>`).join('')}</section>`;
}

function clinicUpgrades(save) {
  const level = arenaOps.settings(save).clinic.level;
  const clinic = arenaOps.clinicEffects(level);
  const staff = staffSim.effects(save, save.team);
  return `<section class="panel facility-card"><h2>Recovery upgrades · Level ${level} / 3</h2>
    <p>Clinic adds <strong>+${clinic.fatigue}</strong> fatigue and <strong>+${clinic.durability}</strong> durability on a day without minutes.
      New injuries can begin recovery ${clinic.rehabDays} days earlier. Season-ending freezes still apply.</p>
    <p>Medical staff adds +${staff.recovery} durability per eligible rest day and up to ${staff.rehabDays} fewer days before recovery begins.
      Both bonuses are subject to the injury’s minimum recovery window.</p>
    <p class="note">Staff formula uses the average skill of the two medical roles. Durability bonus is floor((skill − 70) ÷ 9).
      Rehab days saved are floor((skill − 68) ÷ 4). Negative bonuses are zero.</p>
    ${level < arenaOps.developmentMaxLevel ? `<button type="button" data-ops="clinic" data-command="upgrade">Upgrade clinic · ${money(arenaOps.upgradeCost('clinic', level))}</button>` : ''}
    <p id="operations-feedback" role="status"></p></section>`;
}

function trainingUpgrades(save) {
  const settings = arenaOps.settings(save).training;
  const rates = arenaOps.trainingRates(settings.level);
  const staff = staffSim.effects(save, save.team);
  const lastPractice = seasonSim.history(save).development.practice.at(-1);
  const percent = rate => (rate * 100).toFixed(1).replace(/\.0$/, '') + '%';
  return `<section class="panel facility-card"><h2>Team practice · Level ${settings.level} / ${arenaOps.developmentMaxLevel}</h2>
    <p>Pre-peak gain +${percent(rates.prePeak)} · peak gain +${percent(rates.peak)} · post-peak decline reduced by ${percent(rates.postPeak)}.</p>
    <p>Scheduled days run practice when your team has no game. Healthy players with at least 40 fatigue attend.
      The percentages modify that day’s natural development rate across trainable ratings. One-on-one drills stack during the regular season.</p>
    ${lastPractice ? `<p>Last team practice · ${simDate(lastPractice.day, save.year)} · ${lastPractice.players} players</p>` : ""}
    <button type="button" data-ops="training" data-command="auto-practice">${settings.automatic ? 'Use manual practice days' : 'Delegate practice and supplemental drills'}</button>
    <form id="practice-schedule" class="toolbar"><fieldset><legend>Practice days</legend>
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, index) => `<label class="contract-check"><input type="checkbox" name="day" value="${index}"
        ${settings.days.includes(index) ? 'checked' : ''}>${day}</label>`).join('')}</fieldset><button>Save practice schedule</button></form>
    ${settings.level < arenaOps.developmentMaxLevel ? `<button type="button" data-ops="training" data-command="upgrade">Upgrade training · ${money(arenaOps.upgradeCost('training', settings.level))}</button>` : ''}
    <p class="note">The development staff currently adds ${staff.trainingGain.toFixed(2)} points to a completed individual drill.
      Drill fatigue cost is ${12 - staff.trainingRecovery} points. Gain bonus is floor((average skill − 69) ÷ 8) / 100.
      Fatigue saved is floor((average skill − 67) ÷ 8). Negative bonuses are zero.</p>
    <p id="operations-feedback" role="status"></p></section>`;
}

function bindFacilityUpgrades(save) {
  if (!save) return;
  const apply = (facility, command, index, value) => {
    try {
      seasonSim.saveFinanceAction(save, { type: 'facility', facility, command, index, value });
      render();
      const feedback = document.querySelector('#operations-feedback');
      if (feedback) feedback.textContent = 'Saved.';
    } catch (error) { document.querySelector('#operations-feedback').textContent = error.message; }
  };
  document.querySelectorAll('[data-ops]').forEach(button => button.addEventListener('click', () =>
    apply(button.dataset.ops, button.dataset.command, button.dataset.player)));
  document.querySelector('#practice-schedule')?.addEventListener('submit', event => {
    event.preventDefault();
    apply('training', 'practice', null, new FormData(event.currentTarget).getAll('day').map(Number));
  });
  document.querySelectorAll('[data-consent-assignment]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    apply('affiliate', 'assign', form.dataset.consentAssignment, new FormData(form).has('player') && new FormData(form).has('union'));
  }));
}

function draftTestingTable(items, privateWorkout) {
  return castTable(['Prospect', 'Sprint (s)', 'Lane agility (s)', 'Vertical (in)', 'Midrange', '3PT'], items.map(item => {
    const result = draftOps.testing(item, privateWorkout);
    return [e(item.name), result.sprint, result.agility, result.vertical, result.midrange + '/25', result.three + '/25'];
  }));
}

function offseasonDraftTesting(save, view) {
  const state = seasonSim.history(save);
  if (!state.bracket?.champion || save.draftRoom) {
    operationsPage('Draft testing', 'The combine and private workouts open after the Finals and close when the draft begins.', '<a href="#draft">Return to the NBA Draft</a>');
    return;
  }
  const board = draftOps.prospects(save);
  const workouts = view === 'workouts';
  const invited = board.filter(item => item.notes.privateWorkout);
  operationsPage(workouts ? 'Private workouts' : 'NBA Draft Combine',
    workouts ? invited.length + ' of 10 workouts used' : 'Simulated athletic and shooting test results.',
    (workouts ? '<p>Open a prospect to invite them to a workout.</p>' +
      (invited.length ? draftTestingTable(invited, true) : '<p>No private workouts completed.</p>') +
      castTable(['Prospect', 'Position', 'Program', 'Workout'], board.map(item => [
        '<a href="#development-division/' + e(item.id) + '">' + e(item.name) + '</a>', e(item.positions.join(' / ')), e(item.origin),
        item.notes.privateWorkout ? 'Completed' : '<button data-private-workout="' + e(item.id) + '" ' + (invited.length >= 10 ? 'disabled' : '') + '>Invite</button>',
      ])) : draftTestingTable(board, false)) +
    '<p id="draft-testing-feedback" role="status"></p><p><button id="continue-draft-testing">' + (workouts ? 'Continue to NBA Draft' : 'Continue to private workouts') + '</button></p>');
  document.querySelectorAll('[data-private-workout]').forEach(button => button.onclick = () => {
    try { seasonSim.prospectAction(save, button.dataset.privateWorkout, 'private-workout'); render(); }
    catch (error) { document.querySelector('#draft-testing-feedback').textContent = error.message; }
  });
  document.querySelector('#continue-draft-testing').onclick = () => {
    if (!window.confirm('Continue to the next draft stage?')) return;
    if (!workouts) { location.hash = '#draft-testing/workouts'; return; }
    seasonSim.draftAction(save, '', 'start');
    location.hash = '#draft';
  };
}

function draftScoutingReports(save, state, board, view) {
  const prospects = board.map(item => [`<a href="#development-division/${e(item.id)}">${e(item.name)}</a>`, e(item.positions.join(' / ')), e(item.origin)]);
  const scouting = board.flatMap((item, index) => item.notes.scouted ? [[...prospects[index], (item.notes.coverage ?? 35) >= 30 ? item.rating.toFixed(2) : '—']] : []);
  const positions = playerTools.positions.map(position => [position,
    state.rosters.get(save.team).filter(player => player.positions?.includes(position) || player.position === position).length]);

  const workouts = board.filter(item => item.notes.privateWorkout);
  const order = state.bracket?.champion ? draftOps.draftOrder(save, state) : null;
  const projectionDay = Math.floor(save.day / 7) * 7;
  const projectedOrigins = draftOps.projectedOrigins(state, projectionDay);
  const future = draftOps.futurePicks(save);
  const projectedOrder = [1, 2].flatMap(round => projectedOrigins.map(origin =>
    future.find(pick => pick.year === draftOps.draftYear(save) && pick.round === round && pick.origin === origin)?.owner ?? origin));
  const draftOrder = save.draftRoom?.order ?? order ?? projectedOrder;
  const origins = order ? draftOps.draftOrder(save, state, true) : [...projectedOrigins, ...projectedOrigins];
  const completed = save.draftRoom?.picks ?? [];
  const selected = new Set(completed.map(pick => pick.id));
  const available = board.filter(item => !selected.has(item.id)).sort((a, b) => b.rating - a.rating);
  const projection = draftOrder.map((team, index) => {
    const id = completed[index]?.id;
    const prospect = id ? board.find(item => item.id === id) : available[index - completed.length];
    return [index + 1, e(teams.get(team)?.name ?? team), e(origins[index] ?? '—'), e(prospect?.name ?? '—')];
  });
  const views = {
    reports: ['Team scouting', scouting.length ? castTable(['Prospect', 'Position', 'Program', 'Scouted OVR'], scouting) : '<p>No scouting reports yet.</p>'],
    big: ['Big board', castTable(['Rank', 'Prospect', 'Position', 'Program'], prospects.map((row, i) => [i + 1, ...row]))],
    mock: ['Mock draft', `<p class="note">${order ? 'Uses the finalized draft order.' : 'Standings snapshot · ' + seasonSim.date(projectionDay, save.year) + '. Pick ownership updates when a trade occurs.'}</p>${castTable(['Pick', 'Current owner', 'Original team', 'Projected player'], projection)}`],
    needs: ['Team needs', castTable(['Position', 'Roster depth', 'Target'], positions.map(([pos, count]) => [pos, count, 2]))],
  };
  if (view && Object.hasOwn(views, view)) return views[view];
  return `<section class="draft-scouting"><h2>Draft scouting</h2>
    <div class="franchise-actions">${Object.entries(views).map(([key, [name]]) =>
      `<a class="primary-link" href="#draft-scouting/${key}">${name}</a>`).join('')}</div>
    ${order ? `<details><summary>Draft combine · simulated results</summary>${draftTestingTable(board, false)}</details>
      <details><summary>Private workouts · ${workouts.length}/10 used</summary>
        ${workouts.length ? draftTestingTable(workouts, true) : '<p>Open a prospect to invite them to a private workout.</p>'}</details>` : ''}
  </section>`;
}

function teamIntel(save, code) {
  const state = seasonSim.history(save);
  const ledgers = new Map();
  const contracts = team => {
    if (!ledgers.has(team)) ledgers.set(team, teamFinance.report(save, state, team));
    return ledgers.get(team).contracts;
  };
  const boards = cpuTeams.intel(save, state, contracts);
  const board = boards.get(code);
  const name = id => state.profiles.get(id)?.name ?? id;
  const group = { G: 'Guards', F: 'Forwards', C: 'Centers' };
  const back = '<a href="#development-division">← Scouting</a> · <a href="#team-intel">All teams</a>';
  if (!board) {
    const directions = ['Contending', 'Buying', 'Selling', 'Rebuilding'];
    operationsPage('Team Intel', 'See each front office’s direction, trade priorities, and your relationship.', back +
      directions.map(direction => `<section><h2>${direction}</h2>${castTable(['Team', 'Record', 'Top need', 'Near-term firsts', 'GM trust'],
        [...boards.values()].filter(item => item.direction === direction).map(item => [
          `<a href="#team-intel/${e(item.code)}">${e(teams.get(item.code).name)}</a>`, item.wins + '–' + item.losses,
          group[item.needs[0]], item.nearFirsts, item.code === save.team ? 'Your team' : worldRelationships.gmTrust(save, item.code) + '/100'
        ]))}</section>`).join(''));
    return;
  }
  const trust = worldRelationships.gmTrust(save, code);
  const contact = save.gmContacts?.[code];
  const promise = contact?.promise;
  const day = seasonSim.gmContactDay(save);
  const eventOpen = save.day > seasonSim.lastDay || save.market?.open || save.handoff
    || Math.abs(save.day - seasonSim.allStarDayFor(save)) <= 2;
  const canCheckIn = day - (contact?.lastContact ?? -100) >= 14;
  const daysLeft = Math.min(21, seasonSim.tradeDeadlineFor(save) - save.day);
  const commitmentWait = Math.max(0, 14 - day + (promise?.created ?? -100));
  const contactOpen = code !== save.team && !save.simcast;
  operationsPage(teams.get(code).name, board.direction + ' · ' + board.reason, `${back}
    <section class="panel facility-card"><h2>Trade priorities</h2>
      <p>Needs · ${board.needs.map(key => group[key]).join(' → ')} · Payroll ${money(board.payroll)}</p>
      <p>${trust >= 58 || code === save.team ? 'Players they are shopping · ' + (board.shopping.map(player => e(player.name)).join(', ') || 'None') :
        'Potential trade candidates · ' + (board.shopping.map(player => e(player.name)).join(', ') || 'None')}</p>
      ${trust >= 58 || code === save.team ? `<p>Protected core · ${board.protectedIds.map(id => e(name(id))).join(', ') || 'None'}</p>` : ''}
      <p>${board.ownFirst ? 'Owns its upcoming first-round pick' : 'Upcoming own first-round pick belongs to another team'}</p>
      <a href="#trade-finder/${e(code)}">Open Trade Finder →</a>
    </section>
    ${contactOpen ? `<section class="panel facility-card"><h2>Contact GM · ${trust}/100 trust</h2>
      <p>${trust >= 58 ? 'This GM shares protected players and their trade priorities.' : 'Ask about priorities or build rapport to get a more candid answer.'}</p>
      ${chatThread(save, teams.get(code).name + ' GM', trust, 'What’s on your mind?')}
      <form id="gm-contact-form">
        <div class="toolbar"><button name="action" value="check-in" ${canCheckIn ? '' : 'disabled'}>Check in about team needs</button>
          ${eventOpen ? `<button name="action" value="event" ${canCheckIn ? '' : 'disabled'}>Meet at league event</button>` : ''}
        </div>
        ${!canCheckIn ? '<p class="note">Next rapport check-in in ' + (14 - day + contact.lastContact) + ' days.</p>' : ''}
        ${promise ? `<p>${promise.playerId ? 'First call about ' + e(name(promise.playerId)) : 'Revisit trade talks'} · ${e(promise.status)}
          ${promise.status === 'Open' ? ' · Due ' + e(seasonSim.date(promise.due - (save.year ?? 0) * 400, save.year)) : ''}</p>` : ''}
        ${promise?.status === 'Open' ? `<div class="toolbar"><button name="action" value="follow-up" ${day > promise.created ? '' : 'disabled'}>Follow up privately</button>
          <button name="action" value="break">Withdraw commitment</button><button name="action" value="leak">Leak to league news</button></div>`
          : daysLeft > 0 && !save.market?.open && commitmentWait === 0 ? `<div class="toolbar"><label>Deadline in days <input name="deadline" type="number" min="1" max="${daysLeft}" value="${Math.min(7, daysLeft)}"></label>
            <button name="action" value="promise">Promise to revisit talks</button></div>
            <details><summary>Give this GM first call on one of your players</summary>
              ${castTable(['Player', 'Position', 'Action'], state.rosters.get(save.team).map(player => [e(player.name), e(playerTools.positionText(player)),
                `<button name="action" value="first-call" data-player="${e(player.id)}">Promise first call</button>`]))}</details>` : ''}
        ${commitmentWait && promise?.status !== 'Open' ? `<p class="note">Next commitment available in ${commitmentWait} days.</p>` : ''}
        <p role="status" id="gm-contact-feedback"></p>
      </form></section>` : ''}
    <section><h2>Future picks</h2>${castTable(['Year', 'Round', 'Original team'], board.assets.map(pick => [pick.year, pick.round, e(teams.get(pick.origin).name)]))}</section>`);
  document.querySelector('#gm-contact-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const button = event.submitter;
    if (!button) return;
    if (['break', 'leak'].includes(button.value) && !window.confirm('This will lower your trust with this GM. Continue?')) return;
    try {
      seasonSim.gmContact(save, code, button.value, Number(new FormData(event.currentTarget).get('deadline')), button.dataset.player);
      const updated = seasonSim.load();
      const change = worldRelationships.gmTrust(updated, code) - trust;
      chatReply(button.textContent, teams.get(code).name + ' GM', change > 0 ? 'I appreciate you reaching out. Let’s keep talking.' :
        change < 0 ? 'That changes how I’ll approach future talks with you.' : 'I’ve noted where we stand.');
      for (const choice of event.currentTarget.querySelectorAll('button')) choice.disabled = true;
    } catch (error) { document.querySelector('#gm-contact-feedback').textContent = error.message; }
  });
}

function draftScoutingScreen(save, view) {
  const state = seasonSim.history(save);
  const [title, content] = draftScoutingReports(save, state, draftOps.prospects(save), ['reports', 'big', 'mock', 'needs'].includes(view) ? view : 'reports');
  operationsPage(title, 'Draft scouting · ' + draftOps.draftYear(save), content, 'development-division');
}

function affiliateGameLog(save, year) {
  const season = Number(year) === (save.year ?? 0) ? save : save.pastSeasons?.find(entry => (entry.year ?? 0) === Number(year));
  if (!season) {
    operationsPage('Affiliate schedule', 'Season unavailable', '<a href="#development-division">Development Division</a>');
    return;
  }
  const state = seasonSim.history(season);
  const results = new Map(state.affiliateGames.map(game => [game.day, game]));
  const columns = ['Player', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'DNK'];
  operationsPage(arenaOps.affiliates[season.team], 'Affiliate schedule · ' + seasonLabel(season.year), `
    <p class="note">Generated 50-game schedule. Untracked affiliate players contribute modeled team scoring.</p>
    ${state.affiliateSchedule.map(game => {
      const result = results.get(game.day);
      const opponent = arenaOps.affiliates[game.opponent];
      const label = seasonSim.date(game.day, season.year) + ' · ' + game.stage + ' · ' + (game.home ? 'vs ' : 'at ') + opponent;
      if (!result) return '<p>' + e(label) + ' · Scheduled</p>';
      return `<details class="panel facility-card"><summary>${e(label)} · ${result.score > result.opponentScore ? 'W' : 'L'} ${result.score}–${result.opponentScore}</summary>
        ${result.lines.length ? castTable(columns, result.lines.map(line => [e(line.name), ...columns.slice(1).map(key => line[key] ?? '—')])) : '<p>No assigned NBA players appeared.</p>'}</details>`;
    }).join('')}`, 'development-division');
}

function developmentDivision(save, id) {
  if (id?.startsWith('affiliate-')) {
    affiliateGameLog(save, id.slice('affiliate-'.length));
    return;
  }
  const state = seasonSim.history(save);
  const assigned = arenaOps.settings(save).affiliate;
  const report = teamFinance.report(save, state);
  const board = draftOps.prospects(save);
  const selected = board.find(prospect => prospect.id === id);
  const rights = Object.values(save.draftRights ?? {}).filter(pick => pick.team === save.team);
  const change = staffSim.effects(save, save.team).affiliateGain;
  const signedChange = (change >= 0 ? '+' : '') + change.toFixed(2);
  const canAssign = !save.market?.open && save.day <= seasonSim.lastDay;
  const coverage = selected?.notes.coverage ?? (selected?.notes.scouted ? 35 : 0);
  const projection = selected && coverage >= 55 ? draftOps.progression(selected) : null;
  const categories = [
    ['Scoring', ['Inside', 'Close', 'Mid', '3PT', 'FT']],
    ['Playmaking', ['Pass Acc', 'Handles']],
    ['Defense', ['Interior Defense', 'Perimeter Defense', 'Steal', 'Block']],
    ['Rebounding', ['Offensive Rebound', 'Defensive Rebound', 'Box Out']],
    ['Physical', ['Speed', 'Agility', 'Strength', 'Durability']],
    ['Mental', ['Offensive IQ', 'Defensive IQ', 'Offensive Consistency', 'Defensive Consistency', 'Marketability']],
  ];
  const ratings = selected && coverage >= 35 ? draftOps.player(selected, { number: selected.rank }).attributes : {};
  const revealed = categories.slice(0, Math.max(0, Math.floor((coverage - 22) / 13)));

  const prospectAction = (label, action) => `<button type="button" data-prospect-action="${action}">${label}</button>`;
  operationsPage('Development Division', 'Scout the upcoming class and develop young NBA players through affiliate assignments.', `
    <p id="operations-feedback" role="status"></p><div class="franchise-actions"><a href="#draft">Open NBA Draft →</a>
      <a href="#players">Browse NBA player directory →</a><a href="#team-intel">Team Intel →</a></div>
    <section><h2>Affiliate assignments · ${e(arenaOps.affiliates[save.team])}</h2><p>Players stay under NBA contract but leave the active rotation until recalled.
      Each 30 days of continuous assignment adjusts each trainable rating by ${signedChange} with your current scouts. The simulator allows −0.15 to +0.30.</p>
    <div class="panel table-wrap"><table><thead><tr><th>Player</th><th>Service years</th><th>Status</th><th>Action</th></tr></thead><tbody>
    ${state.rosters.get(save.team).filter(player => Object.hasOwn(assigned, player.id) || seasonSim.serviceYears(save, player) < 4
      && !report.contracts.get(player.id)?.deal.twoWay).map(player => {
        const service = seasonSim.serviceYears(save, player);
        const away = Object.hasOwn(assigned, player.id);
        return `<tr><td><a href="#player/${e(player.id)}">${e(player.name)}</a></td><td>${service}</td>
        <td>${away ? 'Assigned · ' + (save.day - assigned[player.id]) + ' days completed' : 'NBA roster'}</td>
        <td>${away ? `<button type="button" data-ops="affiliate" data-command="recall" data-player="${e(player.id)}">Recall</button>`
          : !canAssign ? 'Assignments closed' : service === 3 ? `<details><summary>Assign with written consent</summary>
          <form data-consent-assignment="${e(player.id)}"><label><input type="checkbox" name="player" required> Record player consent</label>
          <label><input type="checkbox" name="union" required> Record NBPA consent</label><button>Assign</button></form></details>`
          : `<button type="button" data-ops="affiliate" data-command="assign" data-player="${e(player.id)}">Assign to affiliate</button>`}</td></tr>`;
      }).join('') || '<tr><td colspan="4">No eligible standard-contract players.</td></tr>'}</tbody></table></div>
    <p class="note"><a href="https://cms.nba.com/wp-content/uploads/sites/4/2024/11/2024-25-CBA-101.pdf">NBA assignment rules</a></p></section>
    <section><h2>Affiliate season stats</h2>
    <div class="franchise-actions"><a class="primary-link" href="#development-division/affiliate-${save.year ?? 0}">Current affiliate schedule</a>
      ${(save.pastSeasons ?? []).slice().reverse().map(entry => `<a href="#development-division/affiliate-${entry.year ?? 0}">${e(seasonLabel(entry.year))} affiliate log</a>`).join('')}</div>
    ${state.affiliateAverages.size ? castTable(['Player', 'GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%', '3P%', 'FT%', 'DNK'],
      [...state.affiliateAverages].sort((a, b) => b[1].GP - a[1].GP).map(([id, stats]) => [
        e(state.profiles.get(id)?.name ?? id), stats.GP,
        ...['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%', '3P%', 'FT%', 'DNK'].map(key => formatStat(stats[key])),
      ])) : '<p>No affiliate appearances this season.</p>'}</section>
    ${rights.length ? `<section><h2>Your unsigned draft rights</h2><div class="panel facility-card">${rights.map(pick =>
      `<p><a href="#player/${e(pick.id)}">${e(state.profiles.get(pick.id)?.name ?? pick.id)}</a> · Pick ${pick.number} ·
        ${money(draftOps.deal(pick).salary)} first year <button type="button" data-sign-right="${e(pick.id)}">Sign rookie</button>
        <button type="button" data-release-right="${e(pick.id)}">Release to free agency</button></p>`).join('')}</div></section>` : ''}
    <p><a class="primary-link" href="#player-scouting">Player and free-agent scouting</a> <button type="button" id="toggle-auto-scouting">${save.autoScouting?.[save.team] ? 'Disable automatic prospect scouting' : 'Scout projected picks automatically'}</button></p>
    ${draftScoutingReports(save, state, board)}
    <section id="personal-draft-board"><h2>Personal draft board</h2>
      <p>The assistant GM selects the highest-ranked available prospect on your board when you delegate.</p>
      ${save.personalDraftBoard?.length ? castTable(['Rank', 'Prospect', 'Position', 'Program', 'Reorder'], save.personalDraftBoard.flatMap((id, index, entries) => {
        const item = board.find(prospect => prospect.id === id);
        if (!item) return [];
        return [[index + 1, `<a href="#development-division/${e(id)}">${e(item.name)}</a>`,
          e(item.positions.join(' / ')), e(item.origin), `<div class="franchise-actions">
          <button data-board-action="up" data-board-id="${e(id)}" ${index === 0 ? 'disabled' : ''}>Move up</button>
          <button data-board-action="down" data-board-id="${e(id)}" ${index === entries.length - 1 ? 'disabled' : ''}>Move down</button>
          <button data-board-action="remove" data-board-id="${e(id)}">Remove</button></div>`]];
      })) : '<p>Open a prospect to add them to your board.</p>'}</section>
    ${selected ? `<section class="panel facility-card" id="prospect-detail">
      <button data-board-action="add" data-board-id="${e(selected.id)}">Add to personal draft board</button><h2>${e(selected.name)}</h2>
      <p>${e(selected.origin)} · ${e(selected.positions.join(' / '))} · ${coverage >= 30 ? 'Modeled OVR ' + selected.rating.toFixed(2) : 'Scout to reveal your rating'}</p>
      <p>Scouting coverage · ${coverage}%</p>
      ${projection ? `<p>Peak ages ${projection.peakStart}–${projection.peakEnd}${coverage >= 75 ? ` · Annual gain +${projection.gain.toFixed(2)} · Annual loss −${projection.loss.toFixed(2)}` : ''}</p>` : ''}
      ${revealed.map(([category, keys]) => `<section><h3>${category}</h3>${castTable(['Attribute', 'Rating'], keys.map(key => [e(key), formatStat(ratings[key], 2)]))}</section>`).join('')}
      <p>Trust ${selected.notes.trust ?? 25}/100 · Development sessions ${selected.notes.workouts ?? 0}/6 ·
        ${selected.notes.preference ? 'Preferred destination ' + e(selected.notes.preference) : 'No stated preference'}</p>
      ${save.draftRoom ? '<p>Prospect activities closed for the draft.</p>' : `<div class="franchise-actions">
        ${selected.notes.scouted ? prospectAction('Interview', 'interview') + prospectAction('Development workout', 'workout')
          + (selected.notes.trust >= 55 ? prospectAction('Discuss team preference', 'preference') : '') : ''}${coverage < 100 ? prospectAction('Scout prospect', 'scout') : ''}</div>`}
      ${state.bracket?.champion && !save.draftRoom && !selected.notes.privateWorkout ? prospectAction('Invite to private workout', 'private-workout') : ''}
      <p class="note">These are simulated prospect activities. A preference is nonbinding. An NBA team must hold the player's draft rights to sign a drafted rookie.</p>
    </section>` : ''}
    <section><h2>${draftOps.draftYear(save)} prospect board</h2>
    <p class="note">${save.customDraftClass ? "Custom draft class selected during the season handoff." : `<a href="${e(draftOps.classSource(draftOps.selectedClassYear(save)))}">${e(draftOps.classLabel(draftOps.selectedClassYear(save)))}</a> · Ratings and progression are modeled. Fictional prospects fill short boards.`}</p>
    <div class="panel toolbar"><label>Find prospect<input type="search" id="prospect-search"></label></div>
    <div class="panel table-wrap"><table><thead><tr><th>Rank</th><th>Player</th><th>Position</th><th>Program</th><th>Scouting</th></tr></thead>
    <tbody id="prospect-rows"></tbody></table></div></section>`, 'facilities');
  const search = document.querySelector('#prospect-search');
  const update = () => {
    const query = search.value.trim().toLowerCase();
    document.querySelector('#prospect-rows').innerHTML = board.filter(item => (item.name + ' ' + item.origin).toLowerCase().includes(query)).map(item =>
      `<tr><td>${item.rank}</td><td><a href="#development-division/${e(item.id)}">${e(item.name)}</a></td>
      <td>${e(item.positions.join(' / '))}</td><td>${e(item.origin)}${item.classYear <= 2026 ? ' · Original pick #' + item.originalPick : ''}</td>
      <td>${(item.notes.coverage ?? (item.notes.scouted ? 35 : 0)) >= 30 ? item.rating.toFixed(2) + ' OVR' + (item.notes.coverage >= 55 ? ' · Peak ages ' +
        draftOps.progression(item).peakStart + '–' + draftOps.progression(item).peakEnd : '') : 'Unscouted'}</td></tr>`).join('');
  };
  search.addEventListener('input', update);
  update();
  if (selected) document.querySelector('#prospect-detail')?.scrollIntoView();
  const apply = callback => { try { callback(); render(); } catch (error) { document.querySelector('#operations-feedback').textContent = error.message; } };
  document.querySelector('#toggle-auto-scouting').onclick = () => apply(() =>
    seasonSim.setAutoScouting(save, !save.autoScouting?.[save.team]));
  document.querySelectorAll('[data-prospect-action]').forEach(button => button.addEventListener('click', () =>
    apply(() => seasonSim.prospectAction(save, id, button.dataset.prospectAction))));
  document.querySelectorAll('[data-board-action]').forEach(button => button.addEventListener('click', () =>
    apply(() => seasonSim.rankProspect(save, button.dataset.boardId, button.dataset.boardAction))));
  document.querySelectorAll('[data-release-right]').forEach(button => button.addEventListener('click', () =>
    apply(() => seasonSim.releaseDraftRight(save, button.dataset.releaseRight))));
  document.querySelectorAll('[data-sign-right]').forEach(button => button.addEventListener('click', () =>
    apply(() => seasonSim.signDraftRight(save, button.dataset.signRight))));
}

let lotteryAutoplay = null;

function lotteryReveal(save, state, lottery, revealed) {
  const size = lottery.odds.length;
  const complete = revealed >= size;
  const order = draftOps.draftOrder(save, state).slice(0, complete ? 30 : size);
  const club = code => teams.get(code);
  const row = (code, index) => {
    const number = index + 1;
    const origin = lottery.origins[index];
    if (!complete && number <= size - revealed) return '<li><strong>#' + number + '</strong><span>Awaiting reveal</span></li>';
    const projection = lottery.odds.findIndex(entry => entry.origin === origin) + 1;
    const detail = projection ? projection === number ? 'Held projected spot' : 'Projected No. ' + projection : 'Regular-season order';
    return '<li><strong>#' + number + '</strong>' + logo(club(code)) + '<span>' + e(club(code).name) +
      (code === origin ? '' : '<small>via ' + e(club(origin).name) + '</small>') + '<small>' + detail + '</small></span></li>';
  };
  const index = size - revealed;
  const featured = complete ? 0 : revealed ? index : -1;
  const preview = complete ? null : [...lottery.nextOdds(revealed)].sort((a, b) => b.chance - a.chance)[0];
  const featuredTeam = club(order[featured]);
  const origin = lottery.origins[featured];
  const projected = lottery.odds.findIndex(entry => entry.origin === origin) + 1;
  const movement = projected === featured + 1 ? 'holds its projected spot'
    : projected > featured + 1 ? 'moves up from the projected No. ' + projected + ' spot'
      : 'moves down from the projected No. ' + projected + ' spot';
  return '<div class="lottery-reveal">' +
    (featuredTeam ? '<div>' + logo(featuredTeam) + '<strong>No. ' + (featured + 1) + ' · ' + e(featuredTeam.name) + '</strong>' +
      '<p>' + e(complete ? featuredTeam.name + ' wins the lottery.' : club(origin).name + ' ' + movement + '.') + '</p></div>' : '') +
    (preview ? '<p>Up next · No. ' + index + ' · Most likely ' + e(club(preview.owner).name) + ' · ' + (preview.chance * 100).toFixed(2) + '%</p>' : '') +
    '</div><ol class="lottery-order" aria-label="' + (complete ? 'First-round order' : 'Lottery reveal order') + '">' +
    order.map(row).join('') + '</ol>';
}

function draftScreen(save, view) {
  const state = seasonSim.history(save);
  const draft = save.draftRoom;
  const board = draftOps.prospects(save);
  const lottery = state.bracket?.champion && !draft ? draftOps.lottery(save, state) : null;
  const count = save.lotteryRevealed ?? 0;
  const size = lottery?.odds.length ?? 0;
  const owner = item => e(item.owner) + (item.owner !== item.origin ? ' (via ' + e(item.origin) + ')' : '');
  const chance = item => (item.chance * 100).toFixed(2) + '%';
  const lotteryView = Boolean(lottery);
  const summaryView = view === 'summary' && Boolean(draft?.picks.length);
  const currentPick = (draft?.picks.length ?? 0) + 1;
  const taken = new Set(draft?.picks.map(pick => pick.id));
  const lastPick = draft?.picks.at(-1);
  const lastProspect = board.find(item => item.id === lastPick?.id);
  const recommended = board.filter(item => !taken.has(item.id)).sort((a, b) => {
    const score = item => item.rating + (item.notes.coverage ?? 0) / 100;
    return score(b) - score(a);
  });
  const scoutPicks = draft?.order.slice(currentPick - 1).flatMap((team, offset) => {
    const item = recommended[offset];
    return team === save.team && item ? [[currentPick + offset, e(item.name), e(item.positions.join(' / ')), e(item.origin)]] : [];
  }) ?? [];
  operationsPage(draftOps.draftYear(save) + (lotteryView ? ' Draft Lottery' : summaryView ? ' Draft Summary' : ' NBA Draft'), lotteryView ? 'Review the odds and reveal the lottery picks in reverse order.' : 'Two rounds. Each selection grants exclusive draft rights.', `
    <div class="franchise-actions"><a href="#development-division">Prospect board and draft rights →</a><a href="#playoffs">Season summary →</a></div>
    <p id="draft-feedback" role="status"></p>
    ${!summaryView && scoutPicks.length ? `<details class="panel"><summary>Scout recommendations for your remaining picks</summary>
      ${castTable(['Pick', 'Recommended prospect', 'Position', 'Program'], scoutPicks)}</details>` : ''}
    ${lastProspect && !summaryView ? `<section class="hero"><p>Last selection · Pick #${lastPick.number}</p>
      <h2>${e(lastPick.team)} select ${e(lastProspect.name)}</h2>
      <p>${e(lastProspect.positions.join(' / '))} · ${e(lastProspect.origin)}</p>
      <p>Up next · ${draft.order.slice(currentPick - 1, currentPick + 2).map((team, index) =>
        '#' + (currentPick + index) + ' ' + e(team)).join(' · ') || 'Draft complete'}</p></section>` : ''}
    ${!state.bracket?.champion ? '<p>The draft opens after the Finals.</p>' : !draft ? `
      <section class="panel lottery-stage">
        <h2>${count === size ? 'Lottery results' : 'Draft lottery'}</h2>
        ${lotteryReveal(save, state, lottery, count)}
        <div class="franchise-actions">${count < size ? `<button id="lottery-next">Reveal pick #${size - count}</button>
          <button id="lottery-skip">Reveal all picks</button>
          <button id="lottery-auto">${lotteryAutoplay ? 'Pause autoplay' : 'Autoplay reveals'}</button>`
          : '<button id="start-draft">Continue to Draft Combine</button>'}</div>


        ${count < size ? `<details open><summary>Odds for pick #${size - count}</summary>
          ${castTable(['Pick owner', 'Chance'], lottery.nextOdds(count).map(item => [owner(item), chance(item)]))}</details>` : ''}
        <details ${count === 0 ? 'open' : ''}><summary>Pre-draw odds of the No. 1 pick</summary>
          <div class="table-wrap"><table><thead><tr><th>Pick owner</th><th>Odds</th></tr></thead><tbody>
          ${lottery.odds.map(item => `<tr><td>${owner(item)}</td><td>${chance(item)}</td></tr>`).join('')}
          </tbody></table></div>
        </details>
      </section>`
      : summaryView ? `<p><a href="#draft">Return to draft room</a> ${currentPick > draft.order.length ? '· <a data-draft-continue href="#offseason/options">Continue to contract decisions</a>' : ''}</p>`
      : currentPick <= draft.order.length ? `<section><h2>${e(draft.order[currentPick - 1])} on the clock · Pick ${currentPick}</h2>
        <div class="franchise-actions">${draft.order[currentPick - 1] !== save.team ? '<button data-draft-mode="next">Reveal next pick</button><button data-draft-mode="user">Sim to my pick</button>' : ''}<button data-draft-mode="end">Delegate remaining picks</button></div>
        ${draft.order[currentPick - 1] === save.team ? `<p>Choose an available prospect.</p>
        <div class="panel table-wrap"><table><thead><tr><th>Prospect</th><th>Position</th><th>Program</th><th>Scouted rating</th><th>Pick</th></tr></thead><tbody>
        ${board.filter(item => !taken.has(item.id)).map(item => `<tr><td>${e(item.name)}</td><td>${e(item.positions.join(' / '))}</td>
          <td>${e(item.origin)}</td><td>${(item.notes.coverage ?? (item.notes.scouted ? 35 : 0)) >= 30 ? item.rating.toFixed(2) : '—'}</td>
          <td><button type="button" data-draft-pick="${e(item.id)}">Draft</button></td></tr>`).join('')}</tbody></table></div>` : ''}</section>`
      : '<p>Draft complete. <a data-draft-continue href="#draft/summary">Review the draft summary</a>.</p>'}
    ${draft?.picks.length && !summaryView ? '<p><a href="#draft/summary">View draft summary</a></p>' : ''}
    ${summaryView ? `<section><h2>Draft summary</h2>
      ${castTable(['Pick', 'Round', 'Team', 'Prospect', 'Position'], draft.picks.map(pick => {
        const item = board.find(prospect => prospect.id === pick.id);
        return [pick.number, pick.number <= 30 ? 1 : 2, e(pick.team), e(item?.name ?? pick.id), e(item?.positions.join(' / '))];
      }))}</section>` : ''}
    <p class="note">The 2027–29 NBA uses the <a href="https://www.nba.com/news/nba-draft-lottery-explainer">3-2-1 lottery</a>.
      This franchise starts each club with its own picks and uses modeled rookie salary figures.</p>`);
  const apply = (id, mode) => {
    if (['start', 'end', 'user'].includes(mode) && !window.confirm('Continue with this draft action?')) return;
    try {
      seasonSim.draftAction(save, id, mode);
      if (mode === 'start' && view) location.hash = '#draft';
      else render();
    }
    catch (error) { document.querySelector('#draft-feedback').textContent = error.message; }
  };
  const reveal = all => {
    if (all && !window.confirm('Reveal every lottery pick now?')) return;
    try { seasonSim.revealLottery(save, all); render(); }
    catch (error) { document.querySelector('#draft-feedback').textContent = error.message; }
  };
  document.querySelector('[data-draft-continue]')?.addEventListener('click', event => {
    if (!window.confirm('Continue to the next offseason screen?')) event.preventDefault();
  });
  const stopAutoplay = () => { clearInterval(lotteryAutoplay); lotteryAutoplay = null; };
  document.querySelector('#lottery-auto')?.addEventListener('click', () => {
    if (lotteryAutoplay) { stopAutoplay(); render(); return; }
    lotteryAutoplay = setInterval(() => {
      const current = seasonSim.load();
      if (!['#draft', '#draft/lottery'].includes(location.hash) || !current || current.year !== save.year || current.draftRoom ||
        (current.lotteryRevealed ?? 0) >= size) { stopAutoplay(); return; }
      try {
        seasonSim.revealLottery(current);
        if (seasonSim.load().lotteryRevealed >= size) stopAutoplay();
        render();
      } catch (error) {
        stopAutoplay();
        const feedback = document.querySelector('#draft-feedback');
        if (feedback) feedback.textContent = error.message;
      }
    }, 1500);
    render();
  });
  document.querySelector('#lottery-next')?.addEventListener('click', () => reveal(false));
  document.querySelector('#lottery-skip')?.addEventListener('click', () => { stopAutoplay(); reveal(true); });
  document.querySelector('#start-draft')?.addEventListener('click', () => {
    if (window.confirm('Finish the lottery and continue to the Draft Combine?')) location.hash = '#draft-testing/combine';
  });
  document.querySelectorAll('[data-draft-mode]').forEach(button => button.addEventListener('click', () => apply('', button.dataset.draftMode)));
  document.querySelectorAll('[data-draft-pick]').forEach(button => button.addEventListener('click', () => apply(button.dataset.draftPick)));
}


let castTimer;
let castRunning = false;
let castSpeed = 1;
let castTab = 0;

const castTime = seconds => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
const castPeriodName = index => index < 4 ? 'Q' + (index + 1) : 'OT' + (index - 3);

function castGameData(cast) {
  const rows = [];
  const totals = { away: new Map(), home: new Map() };
  const score = { away: 0, home: 0 };
  const lead = { away: 0, home: 0 };
  const extras = { away: { paint: 0, fastBreak: 0, secondChance: 0, possession: 0 }, home: { paint: 0, fastBreak: 0, secondChance: 0, possession: 0 } };
  const periods = [...cast.periods.map(period => ({ period, events: period.events })),
    ...(cast.pending ? [cast.pending] : [])];
  for (const [index, { period, events, elapsed }] of periods.entries()) {
    const duration = index < 4 ? 720 : 300;
    const through = elapsed ?? duration;
    const start = { ...score };
    const visible = events?.filter(event => event.second <= through) ?? [];
    for (const [eventIndex, event] of visible.entries()) {
      const side = event.side;
      const points = event.stats.PTS ?? 0;
      score[side] += points;
      lead[side] = Math.max(lead[side], score[side] - score[side === 'away' ? 'home' : 'away']);
      if (event.kind === 'paint') extras[side].paint += points;
      if (event.fastBreak) extras[side].fastBreak += points;
      if (event.secondChance) extras[side].secondChance += points;
      extras[side].possession += event.second - (visible[eventIndex - 1]?.second ?? 0);
      rows.push({ ...event, index, clock: duration - event.second, score: score.away + '–' + score.home });
    }
    if (visible.length) extras[visible.at(-1).side].possession += through - visible.at(-1).second;
    for (const side of ['away', 'home']) {
      if (elapsed == null) score[side] = start[side] + period[side + 'Score'];
      for (const line of period[side + 'Box']) {
        const total = totals[side].get(line.id) ?? Object.fromEntries(seasonSim.boxFields.map(key => [key, 0]));
        if (elapsed == null) {
          for (const key of seasonSim.boxFields) total[key] += line[key];
        } else {
          total.MIN += Math.floor(line.MIN * through / duration);
          for (const event of visible) if (event.side === side && event.id === line.id) {
            for (const [key, value] of Object.entries(event.stats)) total[key] += value;
          }
        }
        totals[side].set(line.id, total);
      }
    }
    if (elapsed == null) {
      lead.away = Math.max(lead.away, score.away - score.home);
      lead.home = Math.max(lead.home, score.home - score.away);
      rows.push({ index, clock: 0, label: 'End of period', score: score.away + '–' + score.home });
    }
  }
  for (const note of cast.notes ?? []) rows.push({ ...note, index: note.period,
    clock: (note.period < 4 ? 720 : 300) - note.second });
  rows.sort((a, b) => b.index - a.index || a.clock - b.clock);
  return { rows, totals, score, lead, extras, timelineComplete: periods.every(entry => entry.events) };
}

function castTable(headers, rows) {
  return `<div class="panel table-wrap cast-table" tabindex="0"><table><thead><tr>${headers.map(header => `<th scope="col">${e(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map((value, index) => index ? `<td>${value}</td>` : `<th scope="row">${value}</th>`).join('')}</tr>`).join('')
      || `<tr><td colspan="${headers.length}">No entries yet.</td></tr>`}</tbody></table></div>`;
}

function castBox(cast, data, name) {
  return ['away', 'home'].map(side => `<h3>${e(teams.get(cast[side]).name)}</h3>` + castTable(
    ['Player', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG', 'FG%', '3PT', 'FT', 'OREB', 'DREB', 'PF', 'DNK'],
    [...data.totals[side]].sort(([, a], [, b]) => b.PTS - a.PTS).map(([id, line]) => [
      `<a href="#player/${e(id)}/${e(cast[side])}">${e(name(id))}</a>`, line.MIN, line.PTS, line.OREB + line.DREB,
      line.AST, line.STL, line.BLK, line.TO, line.FGM + '–' + line.FGA, formatStat(seasonSim.percentage(line.FGM, line.FGA)),
      line['3PM'] + '–' + line['3PA'], line.FTM + '–' + line.FTA, line.OREB, line.DREB, line.PF, line.DNK ?? '—',
    ]))).join('');
}

function castComparison(cast, data) {
  const stats = side => {
    const lines = [...data.totals[side]];
    const sum = key => lines.reduce((value, [, line]) => value + line[key], 0);
    const rate = (made, attempted) => sum(made) + '/' + sum(attempted) + (sum(attempted) ? ' (' + formatStat(100 * sum(made) / sum(attempted)) + '%)' : '');
    const first = cast.periods[0] ?? cast.pending?.period;
    const starters = new Set(first?.[side + 'Starters'] ?? (first?.[side + 'Box'] ?? []).slice(0, 5).map(line => line.id));
    const extra = data.extras[side];
    return [data.score[side], rate('FGM', 'FGA'), rate('3PM', '3PA'), rate('FTM', 'FTA'),
      data.timelineComplete ? extra.fastBreak : '—', data.timelineComplete ? extra.paint : '—', data.timelineComplete ? extra.secondChance : '—',
      lines.reduce((sum, [id, line]) => sum + (starters.has(id) ? 0 : line.PTS), 0),
      sum('AST'), sum('OREB'), sum('DREB'), sum('STL'), sum('BLK'), sum('TO'), sum('PF'),
      data.timelineComplete ? data.lead[side] : '—', data.timelineComplete ? castTime(extra.possession) : '—'];
  };
  const away = stats('away'), home = stats('home');
  const labels = ['Points', 'Field goals', 'Three-pointers', 'Free throws', 'Fast break points', 'Points in the paint', 'Second-chance points',
    'Bench points', 'Assists', 'Offensive rebounds', 'Defensive rebounds', 'Steals', 'Blocks', 'Turnovers', 'Team fouls', 'Biggest lead', 'Time of possession'];
  return castTable(['Stat', cast.away, cast.home], labels.map((label, index) => [label, away[index], home[index]]))
    + '<p class="note">Play-type points and possession time are modeled from the SimCast event feed.</p>';
}

function castRankings(cast, state) {
  const won = (game, code) => (game.homeScore > game.awayScore ? game.home : game.away) === code;
  const record = (games, code) => games.filter(game => won(game, code)).length + '–' + games.filter(game => !won(game, code)).length;
  const winRate = ({ wins, losses }) => wins + losses ? wins / (wins + losses) : 0;
  const leagueOrder = Object.entries(state.records).sort(([, a], [, b]) => winRate(b) - winRate(a));
  return castTable(['Team', 'Win % rank', 'W–L', 'Win %', 'Streak', 'Last 10', 'Home', 'Away', 'PPG', 'FG%', '3P%', 'REB', 'AST'],
    [cast.away, cast.home].map(code => {
      const games = state.results.filter(game => game.playoffRound == null && [game.home, game.away].includes(code));
      const boxes = games.flatMap(game => game.home === code ? game.homeBox : game.awayBox);
      const sum = key => boxes.reduce((total, line) => total + line[key], 0);
      const last = games.at(-1);
      const streak = [...games].reverse().findIndex(game => won(game, code) !== won(last, code));
      const rank = 1 + leagueOrder.filter(([, entry]) => winRate(entry) > winRate(state.records[code])).length;
      return [e(code), games.length ? rank : '—', record(games, code), formatStat(games.length ? 100 * games.filter(game => won(game, code)).length / games.length : null),
        last ? (won(last, code) ? 'W' : 'L') + (streak < 0 ? games.length : streak) : '—', record(games.slice(-10), code),
        record(games.filter(game => game.home === code), code), record(games.filter(game => game.away === code), code),
        formatStat(games.length ? sum('PTS') / games.length : null), formatStat(seasonSim.percentage(sum('FGM'), sum('FGA'))),
        formatStat(seasonSim.percentage(sum('3PM'), sum('3PA'))), formatStat(games.length ? (sum('OREB') + sum('DREB')) / games.length : null),
        formatStat(games.length ? sum('AST') / games.length : null)];
    }));
}

function castCourt(cast, data, state, name, team) {
  const recent = data.rows.find(row => row.side);
  const current = cast.pending?.period ?? cast.periods.at(-1);
  const lineups = {};
  const marks = ['away', 'home'].flatMap((side, sideIndex) => {
    const code = cast[side];
    const available = (current?.[side + 'Box'] ?? []).map(line => line.id);
    const eligible = available.length ? available : state.rosters.get(code)
      .filter(player => state.health.get(player.id)?.durability > 10).map(player => player.id);
    const assigned = code === team && cast.pending?.lineup;
    const ids = assigned ? [...assigned] : eligible.slice(0, 5);
    if (!assigned && recent?.side === side && eligible.includes(recent.id) && !ids.includes(recent.id)) ids[ids.length - 1] = recent.id;
    lineups[side] = ids;
    return ids.map((id, index) => {
      const player = state.profiles.get(id);
      const attackRight = recent?.side !== 'home';
      const offset = recent ? ((recent.second + index * 13) % 9) - 4 : 0;
      const x = (attackRight ? 60 : 22) + ((index * 9 + sideIndex * 5) % 22) + offset;
      const y = 14 + index * 17 + sideIndex * 5;
      const line = data.totals[side].get(id);
      return `<div class="cast-token cast-token-${side}" style="left:${x}%;top:${y}%"
        title="${e(name(id))} · ${line?.PTS ?? 0} PTS · ${(line?.OREB ?? 0) + (line?.DREB ?? 0)} REB · ${line?.AST ?? 0} AST">
        ${player?.photo ? `<img src="${e(player.photo)}" alt="">` : '<b>' + e(code) + '</b>'}
        ${recent?.id === id ? '<i aria-label="Ball"></i>' : ''}<small>${e(name(id).split(' ').slice(-1)[0])}</small></div>`;
    });
  });
  return `<div class="cast-court" aria-label="SimCast Live court">
    <svg viewBox="0 0 940 500" preserveAspectRatio="none" aria-hidden="true"><rect x="2" y="2" width="936" height="496"/>
      <path d="M470 0v500 M0 155h190v190H0 M940 155H750v190h190 M0 32h92a255 255 0 0 1 0 436H0 M940 32h-92a255 255 0 0 0 0 436h92"/>
      <circle cx="470" cy="250" r="60"/><circle cx="190" cy="250" r="60"/><circle cx="750" cy="250" r="60"/>
      <circle cx="55" cy="250" r="8"/><circle cx="885" cy="250" r="8"/></svg>
    ${marks.join('')}</div>
    <div class="cast-on-court">${['away', 'home'].map(side => castTable([cast[side] + ' on court', 'Energy', 'PF', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO'],
      lineups[side].map(id => {
        const line = data.totals[side].get(id);
        return [e(name(id)), state.health.get(id)?.fatigue ?? '—', line?.PF ?? 0, line?.PTS ?? 0,
          (line?.OREB ?? 0) + (line?.DREB ?? 0), line?.AST ?? 0, line?.STL ?? 0, line?.BLK ?? 0, line?.TO ?? 0];
      }))).join('')}</div><p class="note">Court movement illustrates the simulated events. Energy shows pregame fatigue.</p>`;
}

function simcastScreen(save, snapshot) {
  const state = snapshot ?? seasonSim.history(save);
  const cast = save.simcast;
  const matchup = state.today.find(pair => pair.includes(save.team));
  if (!cast) {
    castTab = 0;
    operationsPage('SimCast', 'Watch the scoreboard or follow the action on the live court.', `<section class="panel facility-card">
      ${matchup && !save.market?.open && !state.bracket?.champion
        ? `<h2>${e(matchup[1])} at ${e(matchup[0])}</h2><button id="cast-tip">Open game</button>`
        : '<p>SimCast is available on the day of a scheduled game for your team.</p><a href="#calendar">Open calendar →</a>'}
      <p id="cast-feedback" role="status"></p></section>`);
    document.querySelector('#cast-tip')?.addEventListener('click', () => {
      try { seasonSim.simcastAction(save, 'start'); render(); }
      catch (error) { document.querySelector('#cast-feedback').textContent = error.message; }
    });
    return;
  }
  const complete = seasonSim.castComplete(cast);
  const live = cast.view === 'live';
  const data = castGameData(cast);
  const { players, length } = seasonSim.castMinutes(save, state);
  const shortHanded = players.reduce((sum, player) => sum + player.cap, 0) < length * 5;
  const opponent = cast.home === save.team ? cast.away : cast.home;
  const opponents = state.rosters.get(opponent);
  const name = id => state.profiles.get(id)?.name ?? id;
  const config = cast.queued ?? cast;
  const ownSide = cast.home === save.team ? 'home' : 'away';
  const onCourt = cast.pending?.lineup ?? cast.pending?.period[ownSide + 'Box'].slice(0, 5).map(line => line.id) ?? [];
  const tabs = ['Play', 'Box score', 'Team comparison', 'Ranking & stats', 'Match-ups', 'Sim points of emphasis', 'Defensive settings', 'Rotations', 'Injuries', 'Game log'];
  const injuries = [cast.away, cast.home].flatMap(code => state.rosters.get(code).flatMap(player => {
    const health = state.health.get(player.id);
    return health && (health.injury || health.durability <= 50)
      ? [[e(player.name), e(code), e(health.injury?.name ?? seasonSim.tier(health.durability)), e(injuryDetails(health, save.day, save.year))]] : [];
  }));
  const select = (key, label, entries, value) => `<label>${e(label)} <select name="${e(key)}">${entries.map(([id, text]) =>
    `<option value="${e(id)}" ${id === value ? 'selected' : ''}>${e(text)}</option>`).join('')}</select></label>`;
  const choices = (key, label, entries, value) => select(key, label, entries.map(option => [option, option]), value);
  const panel = (index, body) => `<section class="cast-tab-panel" data-cast-panel="${index}" ${index === castTab ? '' : 'hidden'}>${body}</section>`;
  const score = (code, side) => `<div>${logo(teams.get(code))}<strong>${e(teams.get(code).name)}</strong>
    <b class="${seasonSim.castScore(cast, side) > seasonSim.castScore(cast, side === 'away' ? 'home' : 'away') ? 'score-winner' : ''}">${seasonSim.castScore(cast, side)}</b></div>`;
  const play = castTable(['Team', ...cast.periods.map((_, index) => castPeriodName(index)), ...(cast.pending ? [castPeriodName(cast.periods.length)] : []), 'Total'],
    ['away', 'home'].map(side => [e(cast[side]), ...cast.periods.map(period => period[side + 'Score']),
      ...(cast.pending ? [seasonSim.castScore(cast, side) - cast.periods.reduce((sum, period) => sum + period[side + 'Score'], 0)] : []),
      seasonSim.castScore(cast, side)]));
  const log = castTable(['Period / time', cast.away, 'Score', cast.home], data.rows.map(row => {
    const message = e((row.id ? name(row.id) + ' ' : '') + row.label);
    return [castPeriodName(row.index) + ' · ' + castTime(row.clock), row.side === 'home' ? '' : message,
      e(row.score ?? ''), row.side === 'home' ? message : ''];
  }));
  app.innerHTML = `<div class="cast-shell">
    <a class="back" href="#franchise">← Franchise</a>
    <header class="trade-title"><div><div class="eyebrow">${simDate(save.day, save.year)}</div><h1>${live ? 'SimCast Live' : 'SimCast'}</h1></div>
      <div class="player-card-tabs cast-mode"><button type="button" data-cast-view="standard" aria-pressed="${!live}">SimCast</button>
      <button type="button" data-cast-view="live" aria-pressed="${live}">SimCast Live</button></div></header>
    <section class="panel cast-scoreboard" aria-label="Game score">${score(cast.away, 'away')}
      <div><strong>${complete ? 'FINAL' : castPeriodName(cast.periods.length)}</strong><b class="cast-clock">${complete ? '0:00' : castTime(seasonSim.castClock(cast))}</b></div>
      ${score(cast.home, 'home')}</section>
    ${live ? castCourt(cast, data, state, name, save.team) : ''}
    <div class="trade-controls cast-actions">
      ${complete ? '<button id="cast-final">Save result and open box score</button>' : shortHanded && !cast.pending
        ? '<button id="cast-forfeit">Record forfeit</button>' : `<button id="cast-auto">${castRunning ? 'Pause' : 'Continue simulation'}</button>
      <button id="cast-next">${cast.pending ? 'Finish period' : 'Sim next period'}</button>
      <label>Speed <select id="cast-speed">${[1, 2, 4, 6].map(speed => `<option value="${speed}" ${speed === castSpeed ? 'selected' : ''}>${speed}×</option>`).join('')}</select></label>
      ${live ? `<button id="cast-timeout">Timeout · ${7 - (cast.timeouts ?? 0)} left</button>
      <button id="cast-challenge" ${seasonSim.challengeableFoul(save, cast) ? '' : 'disabled'}>Challenge personal foul</button>
      <button id="cast-foul" ${cast.pending ? '' : 'disabled'}>Intentional foul</button>
      <button type="button" data-open-cast-tab="7">Substitutions</button>
      <button type="button" data-open-cast-tab="5">Offensive game plan</button>
      <button type="button" data-open-cast-tab="6">Defensive game plan</button>` : ''}`}
      ${!cast.periods.length && !cast.pending ? '<button id="cast-cancel">Cancel before tipoff</button>' : ''}
    </div><p id="cast-feedback" role="status"></p>
    <div class="player-card-tabs" aria-label="SimCast sections">${tabs.map((label, index) =>
      `<button type="button" data-open-cast-tab="${index}" aria-pressed="${index === castTab}">${label}${index === 8 ? ' (' + injuries.length + ')' : ''}</button>`).join('')}</div>
    <form id="cast-controls">
      ${panel(0, play + (live ? '<h3>Recent action</h3>' + castTable(['Time', 'Play', 'Score'], data.rows.slice(0, 5).map(row =>
        [castTime(row.clock), e((row.id ? name(row.id) + ' ' : '') + row.label), e(row.score ?? '')])) : ''))}
      ${panel(1, castBox(cast, data, name))}
      ${panel(2, castComparison(cast, data))}
      ${panel(3, castRankings(cast, state))}
      ${panel(4, castTable(['Opponent', 'Guarded by'], opponents.map(player => [e(player.name),
        `<details><summary>${e(config.matchups?.[player.id] ? name(config.matchups[player.id]) : 'Auto')}</summary>
        <div class="cast-radio-list">${[['', 'Auto'], ...players.filter(guard => guard.cap).map(guard => [guard.id, name(guard.id)])].map(([id, label]) =>
          `<label><input type="radio" name="guard-${e(player.id)}" value="${e(id)}" ${(config.matchups?.[player.id] ?? '') === id ? 'checked' : ''}> ${e(label)}</label>`).join('')}</div></details>`])))}
      ${panel(5, `<div class="toolbar">
        ${select('play', 'Offensive focus', Object.entries(seasonSim.castPlays), config.play)}
        ${choices('tempo', 'Offensive tempo', ['Average', 'Slow', 'Fast'], config.settings?.tempo)}
        ${choices('offReb', 'Offensive rebounding', ['Balanced', 'Crash', 'Get back'], config.settings?.offReb)}
        ${select('defense', 'Defensive focus', Object.entries(seasonSim.castDefenses), config.defense)}
        ${choices('aggression', 'Defensive aggression', ['Neutral', 'Conservative', 'Aggressive'], config.settings?.aggression)}
        ${choices('defReb', 'Defensive rebounding', ['Balanced', 'Crash', 'Run'], config.settings?.defReb)}
        </div>` + castTable(['Scoring priority', 'First', 'Second', 'Third'], [['No preference', '', true], ...players.filter(player => player.cap).map(player => [name(player.id), player.id, false])]
          .map(([label, id]) => [e(label), ...[0, 1, 2].map(index => `<input type="radio" name="score-${index}" value="${e(id)}"
            aria-label="${e(label)} scoring option ${index + 1}" ${((config.scoring ?? [config.focus])[index] ?? '') === id ? 'checked' : ''}>`)])))}
      ${panel(6, ['all', ...opponents.map(player => player.id)].map(id => `<details class="panel facility-card" ${id === 'all' ? 'open' : ''}>
        <summary><strong>${id === 'all' ? 'All opponents' : e(name(id))}</strong></summary><div class="toolbar">${Object.entries(seasonSim.castCoverage).map(([key, options]) =>
          choices('coverage-' + id + '-' + key, key, options, config.coverage?.[id]?.[key])).join('')}</div></details>`).join(''))}
      ${panel(7, (live && cast.pending ? `<h3>Live substitution</h3><div class="cast-substitution">
        <fieldset><legend>On court</legend>${onCourt.map(id => `<label><input type="radio" name="sub-out" value="${e(id)}"> ${e(name(id))}</label>`).join('')}</fieldset>
        <fieldset><legend>Available reserves</legend>${players.filter(player => player.cap && !onCourt.includes(player.id)).map(player =>
          `<label><input type="radio" name="sub-in" value="${e(player.id)}"> ${e(name(player.id))}</label>`).join('')}</fieldset>
        <button type="button" id="cast-substitute">Make substitution</button></div>` : '') + `<p>Set ${length * 5} total minutes for the next period.</p>
        <strong id="cast-minutes"></strong>` + castTable(['Player', 'OVR', 'Next period minutes', 'Limit'], players.map(player => [
          e(name(player.id)), formatStat(state.playerOveralls.get(player.id), 2),
          `<input type="number" name="min-${e(player.id)}" aria-label="${e(name(player.id))} minutes" min="0" max="${player.cap}" step="1"
          value="${Math.min(player.cap, cast.queued?.length === length ? config.minutes?.[player.id] ?? player.minutes : player.minutes)}" ${player.cap ? '' : 'disabled'}>`, player.cap])))}
      ${panel(8, castTable(['Player', 'Team', 'Injury', 'Availability'], injuries))}
      ${panel(9, log)}
      ${complete ? '' : '<div class="toolbar" id="cast-save-controls" hidden><button type="submit">Save game plan</button></div>'}
    </form></div>`;

  const form = document.querySelector('#cast-controls');
  const feedback = document.querySelector('#cast-feedback');
  function apply(action, input) {
    try {
      seasonSim.simcastAction(save, action, input);
      if (action === 'finalize' || action === 'cancel') {
        castRunning = false;
        const updated = seasonSim.load();
        if (action === 'finalize' && (updated.day === seasonSim.playoffStart || seasonSim.history(updated).bracket?.champion)) {
          postseasonLanding(updated);
        } else location.hash = action === 'finalize' ? '#game/' + save.day + '-' + cast.home + '/' + save.year : '#franchise';
      } else simcastScreen(seasonSim.load(), state);
    } catch (error) {
      clearTimeout(castTimer);
      castRunning = false;
      const auto = document.querySelector('#cast-auto');
      if (auto) auto.textContent = 'Continue simulation';
      feedback.textContent = error.message;
    }
  }
  const read = () => {
    const fields = new FormData(form);
    const settings = Object.fromEntries(['tempo', 'offReb', 'aggression', 'defReb'].map(key => [key, fields.get(key)]));
    const coverage = Object.fromEntries(['all', ...opponents.map(player => player.id)].map(id => [id, Object.fromEntries(
      Object.keys(seasonSim.castCoverage).map(key => [key, fields.get('coverage-' + id + '-' + key)]).filter(([, value]) => value && value !== 'Auto'))]));
    return { play: fields.get('play'), defense: fields.get('defense'), settings, coverage, length,
      scoring: [0, 1, 2].map(index => fields.get('score-' + index) ?? ''),
      matchups: Object.fromEntries(opponents.map(player => [player.id, fields.get('guard-' + player.id)]).filter(([, id]) => id)),
      minutes: Object.fromEntries(players.map(player => [player.id, Number(fields.get('min-' + player.id) ?? 0)])) };
  };
  const showTab = index => {
    castTab = index;
    document.querySelectorAll('[data-cast-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.castPanel) !== index; });
    document.querySelectorAll('.player-card-tabs [data-open-cast-tab]').forEach(button =>
      button.setAttribute('aria-pressed', String(Number(button.dataset.openCastTab) === index)));
    const controls = document.querySelector('#cast-save-controls');
    if (controls) controls.hidden = ![4, 5, 6, 7].includes(index);
  };
  const stop = () => {
    castRunning = false;
    clearTimeout(castTimer);
    const auto = document.querySelector('#cast-auto');
    if (auto) auto.textContent = 'Continue simulation';
  };
  const queue = () => {
    clearTimeout(castTimer);
    if (castRunning && !complete) castTimer = setTimeout(() => {
      if (location.hash === '#simcast') {
        if (cast.pending) apply('tick', { seconds: (live ? 6 : 28) * castSpeed });
        else apply('tip-period', read());
      }
    }, live ? 420 : 220);
  };
  document.querySelectorAll('[data-open-cast-tab]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.openCastTab);
    if ([4, 5, 6, 7].includes(index)) stop();
    showTab(index);
  }));
  document.querySelectorAll('[data-cast-view]').forEach(button => button.addEventListener('click', () => {
    stop();
    apply('view', { view: button.dataset.castView });
  }));
  for (const [id, action] of Object.entries({ final: 'finalize', forfeit: 'forfeit', cancel: 'cancel', timeout: 'timeout', foul: 'foul', challenge: 'challenge' })) {
    document.querySelector('#cast-' + id)?.addEventListener('click', () => { stop(); apply(action); });
  }
  document.querySelector('#cast-next')?.addEventListener('click', () => { stop(); apply(cast.pending ? 'finish-period' : 'period', read()); });
  document.querySelector('#cast-substitute')?.addEventListener('click', () => {
    stop();
    const fields = new FormData(form);
    apply('substitute', { out: fields.get('sub-out'), in: fields.get('sub-in') });
  });
  document.querySelector('#cast-auto')?.addEventListener('click', event => {
    castRunning = !castRunning;
    event.currentTarget.textContent = castRunning ? 'Pause' : 'Continue simulation';
    queue();
  });
  document.querySelector('#cast-speed')?.addEventListener('change', event => { castSpeed = Number(event.target.value); queue(); });
  const updateMinutes = () => {
    const total = players.reduce((sum, player) => sum + Number(form.elements.namedItem('min-' + player.id).value), 0);
    document.querySelector('#cast-minutes').textContent = total + ' / ' + length * 5 + ' minutes';
  };
  form.addEventListener('input', () => { stop(); updateMinutes(); });
  form.addEventListener('submit', event => { event.preventDefault(); stop(); apply('configure', read()); });
  if (complete || shortHanded && !cast.pending) stop();
  updateMinutes();
  showTab(castTab);
  queue();
}


function sponsorGroups(renderOffer, status) {
  const categories = [...new Set(sponsorCatalog.map(item => item.category))];
  return categories.map(category => {
    const active = status(category);
    return `<details class="panel facility-card" name="sponsor-category"><summary><strong>${e(category)}</strong>${active ? ' · ' + e(active) : ''}</summary>
      <ul>${sponsorCatalog.filter(item => item.category === category).map(renderOffer).join('')}</ul></details>`;
  }).join('');
}

function playerSupportScreen(save, id) {
  const state = seasonSim.history(save);
  const eligible = player => !state.unavailable.has(player.id) && !save.draftRights?.[player.id]
    && (!state.owners.has(player.id) || state.owners.get(player.id) === save.team);
  const player = state.profiles.get(id);
  if (!player || !eligible(player)) {
    roster(null, { back: 'facilities', label: 'Player Services · choose a rostered player or unsigned free agent',
      select: id => 'player-support/' + id, eligible });
    return;
  }
  const owned = state.owners.get(id) === save.team;
  const report = teamFinance.report(save, state);
  const deal = report.contracts.get(id)?.deal;
  const requests = relationships.read(save).contacts[id]?.demands ?? [];
  const disabled = state.bracket?.champion || save.simcast ? 'disabled' : '';
  const items = (kind, options) => options.map(([value, label, price]) => {
    const active = relationships.delivered(save, id, kind, value);
    const requested = requests.some(item => item.kind === kind && item.value === value);
    return `<li><strong>${e(value)}${requested ? ' ★' : ''}</strong> · ${active ? 'Active this season'
      : `<button type="button" data-support="${kind}" data-value="${e(value)}" ${disabled}>${e(label)}${price ? ' · ' + money(price) : ''}</button>`}</li>`;
  }).join('');
  const brands = arenaOps.settings(save).playerSupport[id]?.brand ?? [];
  const categoryDeal = category => brands.find(name => sponsorCatalog.find(item => item.name === name)?.category === category);
  const contracted = Object.entries(relationships.services).filter(([perk]) => deal?.perks.includes(perk));
  const roles = Object.entries(relationships.familyJobs).filter(([role]) => requests.some(item => item.kind === 'familyJob' && item.value === role));
  operationsPage('Player Services · ' + player.name, 'Fulfill player requests and deliver the perks in their deal.', `
    <div class="franchise-actions"><a href="#player-support">Choose another player →</a><a href="#contact/${e(id)}">Open conversation →</a>
    <a href="#${owned ? 'contracts/' : 'free-agency/'}${e(id)}">${owned ? 'View contract' : 'Open free-agent offer'} →</a></div>
    <p class="note">★ marks a current request. Arrangements apply to this franchise season. Available budget · ${money(report.available)}</p>
    <p id="support-feedback" role="status"></p>
    <section class="panel facility-card"><h2>Contract perk delivery</h2>
    <p>Activate services already paid for in the contract. Manage team and solo panels in the Advertisement Center.</p>
    ${contracted.length ? '<ul>' + items('service', contracted) + '</ul>' : '<p>No housing, transportation, security, or PR services are included in this player’s active deal.</p>'}
    <a href="#ads">Advertisement Center →</a></section>
    <section><h2>Branded player endorsements</h2>
    <p>Up to three season-long endorsements, one per category. The brand pays the player directly and each active deal adds 2 marketability.</p>
    <p><strong>Contracted sponsor pay · ${money(sponsorCatalog.filter(sponsor => brands.includes(sponsor.name)).reduce((sum, sponsor) => sum + sponsor.playerPay, 0))}</strong></p>
    <p class="note">★ marks a requested brand. Pay and eligibility are simulator terms. Team cash is separate.</p>
    ${sponsorGroups(sponsor => {
      const active = brands.includes(sponsor.name);
      const locked = categoryDeal(sponsor.category) || brands.length >= 3 || player.attributes.Marketability < sponsor.marketability;
      const requested = requests.some(item => item.kind === 'endorsement' && item.value === sponsor.name);
      return `<li><strong>${e(sponsor.name)}${requested ? ' ★' : ''}</strong> · ${money(sponsor.playerPay)} to player ·
        Requires ${sponsor.marketability} base marketability · ${active ? 'Active this season' : `<button type="button" data-support="brand"
        data-value="${e(sponsor.name)}" ${disabled || locked ? 'disabled' : ''}>Sign player deal</button>`}</li>`;
    }, categoryDeal)}</section>
    <section class="panel facility-card"><h2>Legacy endorsement introductions</h2>
    <p>Fund a modeled sponsor introduction. Each completed introduction adds 2 marketability points this season.</p>
    <ul>${items('endorsement', Object.entries(relationships.endorsements).map(([value, price]) => [value, 'Arrange introduction', price]))}</ul></section>
    <section class="panel facility-card"><h2>Family employment</h2>
    <p>Hire the player’s simulated family contact into the requested support job. The annual wage is charged to the team budget.</p>
    ${roles.length ? '<ul>' + items('familyJob', roles.map(([value, price]) => [value, 'Hire family contact', price])) + '</ul>'
      : '<p>No family role has been requested.</p>'}</section>`, 'facilities');
  document.querySelectorAll('[data-support]').forEach(button => button.addEventListener('click', () => {
    try {
      seasonSim.saveFinanceAction(save, { type: 'facility', facility: 'support', command: button.dataset.support, index: id, value: button.dataset.value });
      render();
      document.querySelector('#support-feedback').textContent = 'Arrangement completed.';
    } catch (error) { document.querySelector('#support-feedback').textContent = error.message; }
  }));
}

function franchiseAwardCenter(save, mode) {
  const state = seasonSim.history(save);
  const override = mode === 'override';
  const links = '<p><a href="#award-race">Award Race</a> · <a href="#award-overrides">Award Overrides</a> · <a href="#playoffs">Playoffs &amp; awards</a></p>';
  const name = id => state.profiles.get(id)?.name ?? teams.get(id)?.name ?? id;
  if (override) {
    const entries = awardOverrideEntries(state, save);
    operationsPage('Award Overrides', 'Choose a recipient for an award that has already been decided this season.',
      links + (entries.length ? `<section class="panel facility-card">
      <label>Award <select id="award-slot">${entries.map((item, index) => `<option value="${index}">${e(item.label)}</option>`).join('')}</select></label>
      <label>Find a candidate <input type="search" id="award-search"></label>
      <p id="award-current"></p><div id="award-candidates"></div></section>`
      : '<p>No awards have been decided yet.</p>') + '<p id="award-feedback" role="status"></p>');
    if (!entries.length) return;
    const select = document.querySelector('#award-slot');
    const search = document.querySelector('#award-search');
    const feedback = document.querySelector('#award-feedback');
    function apply(id) {
      try {
        seasonSim.setAwardOverride(save, entries[Number(select.value)].slot, id);
        const selected = select.value;
        franchiseAwardCenter(seasonSim.load(), mode);
        const updated = document.querySelector('#award-slot');
        updated.value = selected;
        updated.onchange();
        document.querySelector('#award-feedback').textContent = id == null ? 'Automatic recipient restored.' : 'Award override saved.';
      } catch (error) { feedback.textContent = error.message; }
    }
    function draw() {
      const item = entries[Number(select.value)];
      const candidates = item.candidates.filter(row => row.name.toLowerCase().includes(search.value.trim().toLowerCase()));
      const current = item.candidates.find(row => row.id === item.winner);
      document.querySelector('#award-current').innerHTML = `Current recipient · <strong>${e(current?.name ?? name(item.winner))}</strong>
        ${save.awardOverrides?.[item.slot] ? '<button id="award-restore">Restore automatic result</button>' : ''}`;
      document.querySelector('#award-restore')?.addEventListener('click', () => apply(null));
      const list = document.querySelector('#award-candidates');
      list.innerHTML = castTable(['Candidate', 'Team', 'Action'], candidates.map((row, index) => [
        state.profiles.has(row.id) ? `<a href="#player/${e(row.id)}">${e(row.name)}</a>` : e(row.name), e(row.team),
        row.id === item.winner ? 'Current recipient' : `<button data-award-candidate="${index}">Select</button>`,
      ]));
      list.querySelectorAll('[data-award-candidate]').forEach(button =>
        button.addEventListener('click', () => apply(candidates[Number(button.dataset.awardCandidate)].id)));
    }
    select.onchange = search.oninput = draw;
    draw();
    return;
  }
  const race = state.awardRace;
  const labels = teamFinance.clubAwardRates;
  const finalized = { ...state.awards, ...state.playoffAwards, allStar: state.selections.allStar };
  const sections = Object.entries(labels).map(([key, [label]]) => {
    const winners = finalized[key] ?? [];
    const ids = winners.length ? winners : race?.[key] ?? [];
    const rows = ids.slice(0, winners.length || (['allNBA', 'allDefense', 'allRookie', 'allStar'].includes(key) ? ids.length : 5))
      .map((id, index) => {
        const owners = key === 'allStar' ? state.allStarOwners : state.awardOwners;
        const team = teams.get(id) ?? teams.get(owners?.get(id) ?? state.owners.get(id));
        const coach = key === 'coach' && team && staffSim.assignments(save, team.code, staffSim.roles)['Head Coach'];
        const stats = state.averages.get(id);
        return [index + 1, state.profiles.has(id) ? `<a href="#player/${e(id)}">${e(name(id))}</a>` : e(coach?.name ?? name(id)),
          e(team?.code), e(stats ? stats.GP : team ? state.records[team.code].wins + '–' + state.records[team.code].losses : '—')];
      });
    return [label, winners.length ? 'Decided' : 'Projected', rows];
  });
  if (race) for (const [label, winners] of [
    ['All-Star Game MVP', [state.allStarGame?.mvp]], ['Rising Stars MVP', [state.risingStars?.mvp]],
    ['3-Point Contest', [state.allStarSaturday?.threePoint.winner]], ['Slam Dunk Contest', [state.allStarSaturday?.dunk.winner]],
    ['Shooting Stars', state.allStarSaturday?.shootingStars.winner?.roster ?? []],
  ]) {
    const rows = winners.filter(Boolean).map(player => ['—', e(player.name), e(player.team), '—']);
    sections.push([label, rows.length ? 'Decided' : 'Decided at All-Star Weekend', rows]);
  }
  if (race) for (const period of state.periodicRace) {
    const rows = period.candidates.flatMap((candidates, side) => candidates.slice(0, 5).map((row, index) =>
      [index + 1, e(row.name ?? name(row.id)), e(row.team), e(['East', 'West'][side])]));
    sections.push([nbaAwards.periodLabels[period.key], period.label, rows]);
  }
  operationsPage('Award Race', seasonLabel(save.year) + ' · ' + simDate(state.day, save.year), links + allStarVotingMarkup(state, save) + (!race
    ? `<p>Tracking opens ${save.allStarFormat === 2 ? 'December 15' : 'February 1'}.</p>`
    : `<p>Rankings reflect games played so far. Awards with a 65-game minimum use qualifying-game pace until voting. Playoff MVP races open once their series has games.</p>
      <div class="division-grid">${sections.map(([label, status, rows]) => `<section class="panel facility-card"><h2>${e(label)}</h2>
        <p>${e(status)}</p>${rows.length ? castTable(['Rank', 'Candidate', 'Team', 'GP / Record / Conf.'], rows) : '<p>Waiting for eligible results.</p>'}</section>`).join('')}</div>`));
  bindAllStarActions(save);
}




function allStarVotingMarkup(state, save) {
  if (!state.allStarVotes) return '';
  return `<section class="panel facility-card"><h2>All-Star Voting</h2>
    <p>${state.day >= state.allStarElection.close ? 'Final results' : 'Voting in progress'} · December 15 to January 20</p>
    <p>The GM shortlist contains up to 16 players per conference. Vote shares are weighted 40% fans, 20% players, 20% media, and 20% GMs.</p>
    <div class="weekend-events">${Object.entries(state.allStarVotes).map(([conference, rows]) => `<section>
      <h3>${conference}</h3>${castTable(['Rank', 'Player', 'Team', 'Fans', 'Players', 'Media', 'GMs', 'Weighted %'], rows.map((row, index) => [
        index + 1, `<a href="#player/${e(row.id)}">${e(state.profiles.get(row.id)?.name ?? row.id)}</a>`, e(row.team),
        row.fans.toLocaleString(), row.players.toLocaleString(), row.media.toLocaleString(),
        `<span title="${e(row.ballots.join(', '))}">${row.gm}${row.ballots.length ? ' · ' + e(row.ballots.join(', ')) : ''}</span>`, row.score.toFixed(1),
      ]))}</section>`).join('')}</div>
    ${state.allStarVotePending ? `<form id="all-star-ballot" class="toolbar">
      ${Object.entries(state.allStarVotes).map(([conference, rows]) => `<fieldset><legend>${conference} · Select one player</legend>
        ${rows.map(row => `<label class="release-check"><input type="radio" name="${conference}" value="${e(row.id)}" required>
          ${e(state.profiles.get(row.id)?.name ?? row.id)} · ${e(row.team)}</label>`).join('')}</fieldset>`).join('')}
      <button>Cast my ballot</button></form>` : save.allStarBallot ? '<p>Your ballot was submitted.</p>' : ''}
    <p id="all-star-feedback" role="status"></p></section>`;
}

function allStarDraftMarkup(state) {
  const draft = state.allStarDraft;
  if (!state.allStarCaptains) return '';
  return `<section class="panel facility-card"><h2>All-Star Draft</h2>
    ${castTable(['First-round order', 'All-Star team', 'Represented by', 'Head coach'], state.allStarCaptains.map((team, index) =>
      [index + 1, e(team.name), e(team.club), e(team.coach)]))}
    ${draft?.pending ? `<h3>Pick ${draft.next + 1} · ${e(draft.pending.name)} on the clock</h3>
      <button id="all-star-delegate">Let assistant GM finish the draft</button>
      ${castTable(['Player', 'NBA team', 'Action'], draft.pool.map(player => [
        `<a href="#player/${e(player.id)}">${e(player.name)}</a>`, e(player.team),
        `<button data-all-star-pick="${e(player.id)}">Draft</button>`,
      ]))}<p id="all-star-feedback" role="status"></p>` : ''}
    ${draft?.picks.length ? `<details><summary>Draft results · ${draft.picks.length} picks</summary>
      ${castTable(['Pick', 'All-Star team', 'Player', 'NBA team'], draft.picks.map(({ team, player }, index) =>
        [index + 1, e(team), e(player.name), e(player.team)]))}</details>` : ''}
    </section>`;
}

function bindAllStarActions(save) {
  const apply = (action, input) => {
    try {
      seasonSim.allStarAction(save, action, input);
      render();
    } catch (error) {
      document.querySelector('#all-star-feedback').textContent = error.message;
    }
  };
  document.querySelector('#all-star-ballot')?.addEventListener('submit', event => {
    event.preventDefault();
    apply('vote', Object.fromEntries(new FormData(event.currentTarget)));
  });
  document.querySelector('#all-star-delegate')?.addEventListener('click', () => apply('delegate'));
  document.querySelectorAll('[data-all-star-pick]').forEach(button =>
    button.addEventListener('click', () => apply('pick', button.dataset.allStarPick)));
}










function chatThread(save, speaker, trust, intro) {
  const gm = save.gm?.identity?.name ?? save.gm?.name ?? 'GM';
  const greetings = trust >= 70 ? ['Good to hear from you, ', 'Always happy to talk, ']
    : trust < 35 ? ['I have a minute, ', 'I’m listening, '] : ['Hey, ', 'Thanks for stopping by, '];
  return `<div class="dialogue-thread" role="log" aria-live="polite"><p class="dialogue-message">
    <strong>${e(speaker)}</strong><span>${e(greetings[save.day % greetings.length] + gm + '. ' + intro)}</span></p></div>`;
}

function chatReply(choice, speaker, reply) {
  const thread = document.querySelector('.dialogue-thread');
  thread.insertAdjacentHTML('beforeend', `<p class="dialogue-message dialogue-user"><strong>You</strong><span>${e(choice)}</span></p>
    <p class="dialogue-message"><strong>${e(speaker)}</strong><span>${e(reply)}</span></p>`);
  thread.scrollTop = thread.scrollHeight;
}

function playerConversation(save, state, player) {
  const trust = relationships.playerScore(save, state, player.id);
  const direct = relationships.direct(save, state, player.id);
  const speaker = direct ? player.name : relationships.agent(player.id).name;
  const own = state.owners.get(player.id) === save.team;
  const project = relationships.organizations(save, state).find(item => item.player === player.id);
  const lastPromise = save.relationships?.promises?.findLast(item => item.id === player.id
    && ['kept', 'broken'].includes(item.status));
  const stats = state.averages.get(player.id);
  const minutes = save.plans.at(-1)?.minutes?.[player.id];
  const reducedRole = own && (stats?.GP ?? 0) >= 10 && minutes <= stats.MIN - 10
    && (state.health.get(player.id)?.durability ?? 0) > 50;
  const contractReply = lastPromise
    ? (lastPromise.status === 'kept' ? 'You followed through on ' : 'I remember what happened with ') +
      lastPromise.label + '. That matters as we discuss this deal.'
    : 'We can review salary, guarantees, and commitments in the contract discussion.';
  const topics = [
    ['How do you feel about your situation?', reducedRole ? 'My minutes have dropped. What do you see my role being going forward?' :
      trust >= 65 ? 'Things are going well. I feel supported here.' :
      trust < 40 ? 'There are still questions about where I fit.' : 'Taking it day by day for now.'],
    ['What would you ask for?', relationships.commitment(save, state, player).requests.map(item => item.label).join(' · ') || 'Let’s start with the contract.'],
    ['Can we talk about a contract?', contractReply],
    ['Would you start a community organization?', project ? 'There’s already a program you can support.' :
      own && trust >= 55 ? 'Yes. Let’s start something that gives back to the community.' : 'I’d want to be on your roster and build more trust first.'],
  ];
  operationsPage(speaker, direct ? 'Player conversation' : 'Representing ' + player.name,
    chatThread(save, speaker, trust, 'What can I do for you?') +
    `<div class="franchise-actions">${topics.map(([label], index) => `<button data-player-topic="${index}">${e(label)}</button>`).join('')}
      <a href="#contact/${e(player.id)}">Contract discussion and promises</a></div>
      ${project ? `<p><a href="#organizations/${e(project.id)}">Open organization</a></p>` : ''}
      <div id="player-chat-action" hidden><button id="start-player-project">Start organization</button><p role="status"></p></div>`, 'relationships');
  document.querySelectorAll('[data-player-topic]').forEach(button => button.onclick = () => {
    const index = Number(button.dataset.playerTopic);
    chatReply(topics[index][0], speaker, topics[index][1]);
    document.querySelector('#player-chat-action').hidden = index !== 3 || Boolean(project) || !own || trust < 55;
  });
  document.querySelector('#start-player-project').onclick = () => {
    const panel = document.querySelector('#player-chat-action');
    try {
      seasonSim.conversation(save, { id: player.id, type: 'start-project' });
      panel.innerHTML = `<a href="#organizations/project-${e(player.id)}">Open your new organization</a>`;
    } catch (error) { panel.querySelector('p').textContent = error.message; }
  };
}

function relationshipTalk(save, id) {
  const state = seasonSim.history(save);
  const player = state.profiles.get(id);
  if (player) return playerConversation(save, state, player);
  const staff = Object.entries(staffSim.assignments(save, save.team, staffSim.roles)).find(([, person]) => person.id === id);
  const reporter = relationships.reporters.find(person => person.id === id);
  if (!staff && !relationships.reporterAvailable(save, id, state)) {
    return operationsPage('Conversation', 'This contact is unavailable.', '', 'relationships');
  }
  const person = staff?.[1] ?? reporter;
  const prompt = id === 'reporter-' + save.team ? relationships.interview(save, state) : null;
  const dialogue = staff ? relationships.assessment(save, state, staff[0], person) :
    prompt?.question ?? 'Do you have an update on how the team is doing?';
  const choices = prompt ? Object.entries(relationships.interviewAnswers) :
    [['update', { label: staff ? 'Discuss the assessment' : 'Give a team update' }]];
  operationsPage(person.name, staff?.[0] ?? 'Reporter', `<section class="panel facility-card">
    ${chatThread(save, person.name, relationships.score(save, id, staff ? 48 : 42), prompt?.question ?? 'What can I do for you?')}<div class="franchise-actions">
    ${choices.map(([key, answer]) => `<button data-relationship-response="${key}">${e(answer.label)}</button>`).join('')}
    </div>
    ${staff ? '<a href="#staff-workspace/' + staffSim.roles.indexOf(staff[0]) + '">Discuss department priorities</a>' : ''}
    <p id="relationship-feedback" role="status"></p></section>`, 'relationships');
  for (const button of document.querySelectorAll('[data-relationship-response]')) {
    button.onclick = () => {
      try {
        seasonSim.conversation(save, { id, value: button.dataset.relationshipResponse,
          type: staff ? 'staff-talk' : prompt ? 'interview' : 'reporter-talk' });
        chatReply(button.textContent, person.name, staff ? dialogue : 'Thanks. I’ll include that in my coverage.');
        document.querySelectorAll('[data-relationship-response]').forEach(choice => { choice.disabled = true; });
      } catch (error) { document.querySelector('#relationship-feedback').textContent = error.message; }
    };
  }
}

function fanConversation(save, id) {
  const fan = relationships.fans.find(item => item.id === id && item.code === save.team);
  if (!fan) return operationsPage('Fan conversation', 'This fan group is unavailable.', '', 'relationships');
  const dialogue = {
    Local: 'We’re here on game night and at community events. How can we get more involved?',
    Away: 'We follow the team on the road. Can you help us connect with other traveling fans?',
    League: 'Fans across the league are paying attention. What would you like them to know about the team?',
  };
  operationsPage(fan.name + ' fans', teams.get(save.team).name, `
    <section class="panel facility-card">${chatThread(save, fan.name + ' fans', relationships.score(save, id, 40), dialogue[fan.name])}
    <div class="franchise-actions">
      ${Object.entries(relationships.fanActivities).map(([key, activity]) =>
        `<button data-fan-response="${key}">${e(activity.label)} · ${activity.cost ? money(activity.cost) : 'Free'}</button>`).join('')}
    </div><p class="note">Paid activities support this audience for 21 days. Each group can run one paid activity per week.</p><p id="fan-feedback" role="status"></p></section>`, 'relationships');
  document.querySelectorAll('[data-fan-response]').forEach(button => {
    button.onclick = () => {
      try {
        seasonSim.conversation(save, { type: 'fan-talk', id, value: button.dataset.fanResponse });
        chatReply(button.textContent, fan.name + ' fans', 'Thanks for making time for us.');
        document.querySelectorAll('[data-fan-response]').forEach(choice => { choice.disabled = true; });
      } catch (error) { document.querySelector('#fan-feedback').textContent = error.message; }
    };
  });
}

function playerScouting(save) {
  const state = seasonSim.history(save);
  const priorities = new Set(save.scoutingPriorities?.[save.team] ?? []);
  const attributes = playerTools.attributes;
  operationsPage('Player scouting', 'Search the league and maintain a scouting priority list.', `
    <section class="panel toolbar">
      <label>Pool <select id="scout-pool"><option value="all">All players</option><option value="roster">NBA rosters</option><option value="free">Free agents</option><option value="priority">Priorities</option></select></label>
      <label>Attribute <select id="scout-attribute">${attributes.map(key => `<option>${e(key)}</option>`).join('')}</select></label>
      <label>Minimum rating <input id="scout-minimum" type="number" min="0" max="99" value="0"></label>
      <label>Player <input id="scout-search" type="search"></label>
    </section><p id="scout-feedback" role="status"></p><div id="scout-results"></div>`, 'development-division');
  const controls = ['pool', 'attribute', 'minimum', 'search'].map(key => document.querySelector('#scout-' + key));
  const results = document.querySelector('#scout-results');
  const update = () => {
    const [pool, attribute, minimum, query] = controls.map(control => control.value);
    const rows = [...state.profiles.values()].filter(player => {
      const owner = state.owners.get(player.id);
      return !state.unavailable.has(player.id) && !save.draftRights?.[player.id]
        && (pool !== 'priority' || priorities.has(player.id)) && (pool !== 'free' || !owner)
        && (pool !== 'roster' || owner) && player.name.toLowerCase().includes(query.trim().toLowerCase());
    }).map(player => [player, seasonSim.effectiveRatings(save, state.development, player)[attribute]])
      .filter(([, rating]) => rating >= Number(minimum)).sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name));
    results.innerHTML = rows.length ? castTable(['Player', 'Team', 'Position', e(attribute), 'Report coverage', 'Priority'], rows.map(([player, rating]) => [
      `<a href="#player/${e(player.id)}">${e(player.name)}</a>`, e(state.owners.get(player.id) ?? 'Free agent'),
      e(playerTools.positionText(player)), (save.playerScoutingReports?.[save.team]?.[player.id] ?? 0) >= 30 ? formatStat(rating, 2) : '—',
      (save.playerScoutingReports?.[save.team]?.[player.id] ?? 0) + '%',
      `<button data-scout-priority="${e(player.id)}">${priorities.has(player.id) ? 'Remove priority' : 'Prioritize'}</button>`,
    ])) : '<p>No matching players.</p>';
  };
  controls.forEach(control => control.addEventListener('input', update));
  results.addEventListener('click', event => {
    const id = event.target.closest('[data-scout-priority]')?.dataset.scoutPriority;
    if (!id) return;
    try {
      seasonSim.setScoutingPriority(seasonSim.load(), id, !priorities.has(id));
      if (priorities.has(id)) priorities.delete(id);
      else priorities.add(id);
      update();
    } catch (error) { document.querySelector('#scout-feedback').textContent = error.message; }
  });
  update();
}
