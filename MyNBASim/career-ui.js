const careerSegments = ['Regular season', 'Play-in', 'Playoffs'];
const careerStats = ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO'];
const careerSegment = game => game.playoffRound === -1 ? 'Play-in' : game.playoffRound == null ? 'Regular season' : 'Playoffs';
const careerStarter = ({ game, atHome, line }) => {
  const side = atHome ? 'home' : 'away';
  return game[side + 'Starters']?.includes(line.id) ?? game[side + 'Box'].slice(0, 5).includes(line);
};

const playerCardColumns = ['Team','PPG','ORPG','RPG','APG','SPG','BPG','TOPG','FG%','3P%','FT%','MPG','FPG','+/- PG',
  'PTS','REB','AST','STL','BLK','TO','FGM','FGA','3PM','3PA','FTM','FTA','MINS','FLS','GS','GP','DD','TD','+/-','OREB%','DREB%'];

function playerCardStatRow(stats, totals = {}, team, games = []) {
  const values = { ...totals, Team: team, GP: stats.GP, GS: stats.GS,
    PPG: stats.PTS, ORPG: stats.OREB, RPG: stats.REB, APG: stats.AST, SPG: stats.STL, BPG: stats.BLK,
    TOPG: stats.TO, MPG: stats.MIN, FPG: stats.PF, MINS: totals.MIN, FLS: totals.PF,
    'FG%': stats['FG%'], '3P%': stats['3P%'], 'FT%': stats['FT%'] };
  if (games.length) {
    values.GS = games.filter(careerStarter).length;
    const milestones = games.map(({ line }) => [line.PTS, line.OREB + line.DREB, line.AST, line.STL, line.BLK].filter(value => value >= 10).length);
    values.DD = milestones.filter(count => count >= 2).length;
    values.TD = milestones.filter(count => count >= 3).length;
  }
  return values;
}

function playerCardTable(first, columns, rows) {
  return `<div class="panel table-wrap player-card-table" tabindex="0"><table>
    <thead><tr><th scope="col">${e(first)}</th>${columns.map(key => `<th scope="col">${e(key)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label, values]) => `<tr><th scope="row">${e(label)}</th>${columns.map(key => {
      const value = values[key];
      return `<td>${e(Number.isFinite(value) ? formatStat(value, key.endsWith('%') || key.endsWith('PG') ? 1 : 0) : value)}</td>`;
    }).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length + 1}">No records available.</td></tr>`}</tbody></table></div>`;
}

function playerCardGameStats(games) {
  const totals = Object.fromEntries(seasonSim.boxFields.map(key => [key, games.reduce((sum, { line }) => sum + line[key], 0)]));
  Object.assign(totals, careerTotals(games));
  const stats = Object.fromEntries([...seasonSim.boxFields, 'REB'].map(key => [key, games.length ? totals[key] / games.length : null]));
  return playerCardStatRow({ ...stats, GP: totals.GP, 'FG%': totals['FG%'], '3P%': totals['3P%'], 'FT%': totals['FT%'] }, totals,
    [...new Set(games.map(row => row.code))].join(' / ') || null, games);
}

function nbaCardGameLine(row) {
  const [MIN, PTS, REB, AST, STL, BLK, TO] = row.slice(9, 16).map(value => value == null || value === '' ? NaN : Number(value));
  const [FGM, FGA, made3, attempts3, FTM, FTA] = row.slice(16, 19).flatMap(pair =>
    typeof pair === 'string' && /^\d+-\d+$/.test(pair) ? pair.split('-').map(Number) : [NaN, NaN]);
  return { MIN, PTS, REB, AST, STL, BLK, TO, FGM, FGA, '3PM': made3, '3PA': attempts3, FTM, FTA };
}

function playerCardCareer(player, franchise, games, archives) {
  const rows = [];
  if (franchise) {
    for (const segment of careerSegments) {
      const selected = games.filter(row => row.segment === segment);
      if (selected.length || segment === 'Regular season') rows.push([`${seasonLabel(franchise.save.year)} · Franchise ${segment}`, playerCardGameStats(selected)]);
    }
    for (const state of [...archives].reverse()) {
      const played = careerGames(state.results, player.id).filter(row => row.line);
      for (const segment of careerSegments) {
        const selected = played.filter(row => row.segment === segment);
        if (selected.length) rows.push([`${seasonLabel(state.save.year)} · Franchise ${segment}`, playerCardGameStats(selected)]);
      }
    }
  }
  for (const row of nbaCareerRecords(player, franchise?.save).regular) {
    const matching = (nbaGameLogData[player.id] ?? []).filter(game => {
      const start = Number(game[1].slice(0, 4)) - (game[1].slice(5, 7) < '09' ? 1 : 0);
      return game[8] === 'Regular season' && start === Number(row.season.slice(0, 4));
    });
    const teamsPlayed = [...new Set(matching.map(game => game[2]))].join(' / ');
    const values = playerCardStatRow(row.stats, row.totals, row.team ?? (matching.length === row.stats.GP ? teamsPlayed : null));
    if (matching.length && matching.length === row.stats.GP) {
      const lines = matching.map(nbaCardGameLine).map(({ PTS, REB, AST, STL, BLK }) => [PTS, REB, AST, STL, BLK]);
      if (lines.every(line => line.every(Number.isFinite))) {
        const counts = lines.map(line => line.filter(value => value >= 10).length);
        values.DD = counts.filter(count => count >= 2).length;
        values.TD = counts.filter(count => count >= 3).length;
      }
    }
    rows.push([row.season + ' · NBA', values]);
  }
  return playerCardTable('Season', playerCardColumns, rows) + '<p class="note">A dash marks a field unavailable in the source or simulation.</p>';
}

function playerCardSplits(games, save) {
  const won = row => (row.game.homeScore > row.game.awayScore) === row.atHome;
  const splits = new Map([['Season', games], ['Home', games.filter(row => row.atHome)], ['Road', games.filter(row => !row.atHome)],
    ['Wins', games.filter(won)], ['Losses', games.filter(row => !won(row))],
    ['Before All-Star', games.filter(row => row.game.day < seasonSim.allStarDayFor(save))], ['Since All-Star', games.filter(row => row.game.day >= seasonSim.allStarDayFor(save))],
    ['As starter', games.filter(careerStarter)], ['Off the bench', games.filter(row => !careerStarter(row))]]);
  for (const row of games) {
    const month = new Date(simDate(row.game.day, save.year) + 'T00:00:00Z').toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    for (const key of [month, 'vs ' + row.opponent]) {
      if (!splits.has(key)) splits.set(key, []);
      splits.get(key).push(row);
    }
  }
  const columns = ['GP', 'PPG', 'ORPG', 'DRPG', 'RPG', 'APG', 'SPG', 'BPG', 'TOPG', 'FGMPG', 'FGAPG', 'FG%', '3P%', 'FT%', 'MPG'];
  return playerCardTable('Split', columns, [...splits].map(([key, rows]) => {
    const stats = playerCardGameStats(rows);
    const average = stat => rows.length ? stats[stat] / rows.length : null;
    return [key, { ...stats, DRPG: rows.length ? average('REB') - average('OREB') : null, FGMPG: average('FGM'), FGAPG: average('FGA') }];
  }));
}

function playerCardContract(player, franchise) {
  const code = franchise?.owners.get(player.id);
  const contract = code && teamFinance.report(franchise.save, franchise, code).contracts.get(player.id);
  if (!contract) return (franchise ? '<p>No active franchise contract.</p>' : '') + (nbaContractCard(player) || '<p>No published NBA contract available.</p>');
  const { deal, pay } = contract;
  return `<dl class="panel bio"><div><dt>No-trade clause</dt><dd>${deal.noTrade ? 'Yes' : 'No'}</dd></div>
    <div><dt>Trade kicker</dt><dd>${e(deal.kicker)}%</dd></div><div><dt>This year upfront</dt><dd>${money(pay.upfront)}</dd></div>
    <div><dt>This year rolled into payroll</dt><dd>${money(pay.rollover)}</dd></div><div><dt>This year conditional</dt><dd>${money(pay.conditional)}</dd></div></dl>
    ${playerCardTable('Season', ['Salary', 'Option'], Array.from({ length: deal.years }, (_, index) => {
      const [amount, option] = deal.salarySchedule?.[index] ?? [deal.salary + index * deal.raise, index === deal.years - 1 ? deal.option : null];
      return [seasonLabel(franchise.save.year + index), { Salary: money(amount), Option: option }];
    }))}`;
}

function playerCardInjuries(player, franchise, archives) {
  const seasons = franchise ? [...archives, franchise] : [];
  const rows = seasons.flatMap(state => state.injuries.filter(injury => injury.id === player.id)
    .map(injury => [simDate(injury.day, state.save.year), { Team: injury.team, Injury: injury.name ?? injury.condition, Status: injury.condition }]));
  return '<h2>Franchise injury history</h2>' + playerCardTable('Date', ['Team', 'Injury', 'Status'], rows.reverse());
}

function playerCardInjuryMap(health) {
  const injury = health.injury?.name ?? '';
  const zones = [
    { label: 'Wrist', match: /wrist/i, x: 32, y: 96 },
    { label: 'Hamstring', match: /hamstring/i, x: 76, y: 112 },
    { label: 'Knee', match: /knee|meniscus|ACL/i, x: 76, y: 140 },
    { label: 'Ankle', match: /ankle/i, x: 76, y: 172 },
  ];
  const area = zones.find(zone => zone.match.test(injury));
  return `<div class="panel player-injury-map"><svg viewBox="0 0 150 190" aria-hidden="true">
    <circle cx="75" cy="20" r="13"/><path d="M56 43h38l24 52-10 6-17-36v43l11 68h-15l-12-54-12 54H48l11-68V65L42 101l-10-6z"/>
    ${area ? `<circle class="injury-highlight" cx="${area.x}" cy="${area.y}" r="9"/>` : ''}
    </svg><div><h3>Injury location</h3><p>${e(area?.label ?? (injury || 'No named injury'))}</p>
      <p class="note">Marker indicates the recorded injury region.</p></div></div>`;
}

function playerCardRecent(player, franchise, games) {
  const columns = ['Opponent', 'Result', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG', '3PT', 'FT'];
  const rows = franchise ? games.slice(-15).reverse().map(({ game, atHome, opponent, line }) => {
    const [own, other] = atHome ? [game.homeScore, game.awayScore] : [game.awayScore, game.homeScore];
    return [simDate(game.day, franchise.save.year), { ...line, Opponent: (atHome ? 'vs ' : '@ ') + opponent,
      Result: (own > other ? 'W ' : 'L ') + own + '–' + other, REB: line.OREB + line.DREB,
      FG: line.FGM + '–' + line.FGA, '3PT': line['3PM'] + '–' + line['3PA'], FT: line.FTM + '–' + line.FTA }];
  }) : (nbaGameLogData[player.id] ?? []).slice(0, 15).map(([, date, , opponent, venue, result, home, away, , ...stats]) =>
    [date, { ...Object.fromEntries(columns.slice(2).map((key, index) => [key, stats[index]])), Opponent: venue + ' ' + opponent,
      Result: result + ' ' + (venue === '@' ? [away, home] : [home, away]).join('–') }]);
  return playerCardTable('Date', columns, rows) + `<p><a href="#${franchise ? 'career' : 'nba-games'}/${e(player.id)}">Full game log →</a></p>`;
}

function playerCardHighs(player, franchise, games, archives, historicalRows = [], coverage = null) {
  const labels = { PTS: 'Points', FGM: 'Field goals made', FGA: 'Field goals attempted', '3PM': 'Three-pointers made',
    '3PA': 'Three-pointers attempted', FTM: 'Free throws made', FTA: 'Free throws attempted', REB: 'Rebounds',
    AST: 'Assists', STL: 'Steals', BLK: 'Blocks', TO: 'Turnovers', MIN: 'Minutes' };
  const season = games.filter(row => row.segment === 'Regular season').map(row => row.line);
  const career = [...season, ...archives.flatMap(state =>
    careerGames(state.results, player.id).filter(row => row.line && row.segment === 'Regular season').map(row => row.line))];
  const metric = (line, key) => key === 'REB' ? line.REB ?? line.OREB + line.DREB : line[key];
  const best = (lines, key) => {
    const values = lines.map(line => metric(line, key)).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  };
  const nba = [...(nbaGameLogData[player.id] ?? []), ...historicalRows].filter(row => row[8] === 'Regular season'
    && (!franchise || row[1] < league.snapshot.slice(0, 4) + '-09-01')).map(nbaCardGameLine);
  const nbaColumn = coverage ? 'NBA archived high' : 'NBA log sample';
  const leagueGames = franchise?.results.filter(game => careerSegment(game) === 'Regular season') ?? [];
  return playerCardTable('Statistic', [nbaColumn, 'Franchise career', 'Season', 'League leader'], Object.entries(labels).map(([key, label]) => {
    let leader;
    for (const game of leagueGames) for (const line of [...game.homeBox, ...game.awayBox]) {
      const value = metric(line, key);
      if (!leader || value > leader.value) leader = { value, line, game };
    }
    return [label, { [nbaColumn]: best(nba, key), 'Franchise career': best(career, key), Season: best(season, key), 'League leader': leader &&
      `${leader.value} · ${franchise.profiles.get(leader.line.id)?.name ?? leader.line.id} · ${simDate(leader.game.day, franchise.save.year)}` }];
  })) + `<p class="note">${coverage ? e(coverage) : 'NBA sample highs use the bundled recent game logs.'}
    Franchise highs cover regular-season games from this run. <a href="#nba-games/${e(player.id)}">Browse verified NBA game logs →</a></p>`;
}

function playerCardSocial(player, franchise) {
  if (!franchise) return '<p>League mentions appear here during your franchise.</p>';
  const seasons = [franchise.save, ...[...(franchise.save.pastSeasons ?? [])].reverse()];
  const groups = seasons.map(save => {
    const state = save === franchise.save ? franchise : seasonSim.history(save);
    const mentions = leagueNewsCards(save, state).filter(card => card.players.includes(player.id) ||
      card.href === '#player/' + player.id);
    return { year: save.year, mentions };
  }).filter(group => group.mentions.length);
  return groups.length ? groups.map(({ year, mentions }, index) => `
    <details class="panel facility-card" ${index === 0 ? 'open' : ''}>
      <summary>${e(seasonLabel(year))} · ${mentions.length} mentions</summary>
      <div class="news-feed">${mentions.map(card => newsStory(card, year)).join('')}</div>
    </details>`).join('') : '<p>No league feed mentions in this franchise.</p>';
}

function careerGames(results, id) {
  return results.flatMap(game => {
    const home = game.homeBox.find(line => line.id === id);
    const away = game.awayBox.find(line => line.id === id);
    const atHome = home || !away && game.homeRoster?.includes(id);
    if (!atHome && !away && !game.awayRoster?.includes(id)) return [];
    const line = home ?? away;
    return [{ game, code: atHome ? game.home : game.away, opponent: atHome ? game.away : game.home,
      atHome: Boolean(atHome), line, segment: careerSegment(game) }];
  });
}

function careerTotals(games) {
  const lines = games.map(row => row.line).filter(Boolean);
  const sum = key => lines.reduce((total, line) => total + line[key], 0);
  return { GP: lines.length, ...Object.fromEntries(careerStats.map(key => [key, key === 'REB' ? sum('OREB') + sum('DREB') : sum(key)])),
    'FG%': seasonSim.percentage(sum('FGM'), sum('FGA')), '3P%': seasonSim.percentage(sum('3PM'), sum('3PA')),
    'FT%': seasonSim.percentage(sum('FTM'), sum('FTA')) };
}

function importedCareerAverages(history) {
  const rows = history.map(entry => entry.stats).filter(stats => stats?.GP > 0);
  const weighted = (value, weight) => {
    let numerator = 0;
    let denominator = 0;
    for (const row of rows) {
      const rate = value(row);
      const games = weight(row);
      if (!Number.isFinite(rate) || !(games > 0)) continue;
      numerator += rate * games;
      denominator += games;
    }
    return denominator ? numerator / denominator : null;
  };
  return { GP: rows.reduce((sum, row) => sum + row.GP, 0),
    ...Object.fromEntries(careerStats.map(key => [key, weighted(row => row[key], row => row.GP)])),
    'FG%': weighted(row => row['FG%'] ?? seasonSim.percentage(row.FGM, row.FGA), row => row.GP * row.FGA),
    '3P%': weighted(row => row['3P%'], row => row.GP * row['3PA']),
    'FT%': weighted(row => row['FT%'], row => row.GP * row.FTA) };
}

function careerHonors(state, id) {
  const labels = { mvp: 'Most Valuable Player', dpoy: 'Defensive Player of the Year', rookie: 'Rookie of the Year',
    mostImproved: 'Most Improved Player', sixthMan: 'Sixth Man of the Year', clutch: 'Clutch Player of the Year',
    eastFinals: 'East Finals MVP', westFinals: 'West Finals MVP', finals: 'NBA Finals MVP' };
  const honors = Object.entries(labels).filter(([key]) => (state.awards?.[key] ?? state.playoffAwards?.[key])?.includes(id))
    .map(([, label]) => label);
  for (const [key, label] of [['allNBA','All-NBA'], ['allDefense','All-Defensive'], ['allRookie','All-Rookie']]) {
    const rank = state.awards?.[key]?.indexOf(id) ?? -1;
    if (rank >= 0) honors.push(label + ' ' + ['First', 'Second', 'Third'][Math.floor(rank / 5)] + ' Team');
  }
  if ((state.selections?.allStar?.length ? state.selections.allStar : state.awards?.allStar)?.includes(id)) honors.push('All-Star');
  if (state.allStarSaturday?.threePoint.winner?.id === id) honors.push('3-Point Contest champion');
  if (state.allStarSaturday?.dunk.winner?.id === id) honors.push('Slam Dunk Contest champion');
  if (state.allStarSaturday?.shootingStars.winner?.roster.some(player => player.id === id)) honors.push('Shooting Stars champion');
  if (state.risingStars?.teams.some(team => team.roster.some(player => player.id === id))) honors.push('Rising Stars selection');
  if (state.risingStars?.mvp?.id === id) honors.push('Rising Stars MVP');
  if (state.allStarGame?.mvp?.id === id) honors.push('All-Star Game MVP');
  if (state.bracket?.champion && state.owners.get(id) === state.bracket.champion) honors.push('NBA champion');
  for (const [key, label] of Object.entries(nbaAwards.periodLabels)) {
    if (key === 'coachMonth') continue;
    const wins = state.periodAwards.filter(period => period.key === key && period.winners.some(winner => winner?.id === id));
    if (wins.length) honors.push(label + ' ×' + wins.length + ' (' + wins.map(period => period.label).join(', ') + ')');
  }
  return honors;
}

const nbaHonorLabels = {
  'All-Defensive Team': 'All-Defensive', 'All-Rookie Team': 'All-Rookie',
  'NBA All-Star': 'All-Star', 'NBA All-Star Most Valuable Player': 'All-Star Game MVP',
  'NBA Champion': 'NBA champion', 'NBA Cup Most Valuable Player': 'NBA Cup MVP',
  'NBA Finals Most Valuable Player': 'NBA Finals MVP', 'NBA Most Valuable Player': 'MVP',
  'NBA Sporting News Most Valuable Player of the Year': 'Sporting News MVP',
  'NBA Sporting News Rookie of the Year': 'Sporting News Rookie of the Year',
  'NBA Sportsmanship': 'Sportsmanship Award',
  'Western Conference Finals Most Valuable Player': 'West Finals MVP',
  'Eastern Conference Finals Most Valuable Player': 'East Finals MVP',
  'Olympic Bronze Medal': 'Olympic bronze medal', 'Olympic Gold Medal': 'Olympic gold medal',
  'Olympic Silver Medal': 'Olympic silver medal',
};

function nbaPlayerHonors(id) {
  const playerName = playerTools.registry.get(id)?.name;
  const normalize = name => name?.toLowerCase().normalize('NFD').replace(/\p{M}|[^a-z ]/gu, '').replace(/ (jr|ii|iii)$/, '');
  const contests = Object.values(nbaContestHistory).flatMap(({ title, source, winners }) => winners
    .filter(([, name]) => normalize(name) === normalize(playerName))
    .map(([year]) => ({ label: title + ' champion', season: year + '', source })));
  const imported = [...(nbaHistoricalHonors[id] ?? []), ...(nbaVerifiedCareerExtras[id] ?? []), ...contests];
  const honors = [...new Map(imported.filter(item => item.season)
    .map(item => [item.label + '/' + item.season, item])).values()];
  for (const item of imported.filter(item => !item.season)) {
    const known = honors.filter(honor => honor.label === item.label)
      .reduce((total, honor) => total + (honor.count ?? 1), 0);
    if ((item.count ?? 1) > known) honors.push({ ...item, count: (item.count ?? 1) - known });
  }
  const profile = nbaProfileData[id];
  for (const [name, count] of profile?.awards ?? []) {
    const label = nbaHonorLabels[name] ?? name.replace(/^NBA (?=(Clutch|Sixth|Most Improved|Defensive Player of the Year|Rookie of the Year))/, '');
    const known = honors.filter(item => item.label === label ||
      item.label.replace(/ (First|Second|Third) Team$/, '') === label)
      .reduce((total, item) => total + (item.count ?? 1), 0);
    if (count > known) honors.push({ label, count: count - known, source: profile.source });
  }
  return honors;
}

function nbaCombineLength(inches) {
  if (!Number.isFinite(inches)) return null;
  return Math.floor(inches / 12) + '′ ' + (inches % 12) + '″';
}

function nbaCareerRecords(player, save) {
  const completed = nbaCareerData[player.id] ?? nbaCareerUnsigned[player.id] ?? [];
  const merged = new Map(completed.map(row => [row.season, row]));
  for (const row of player.history ?? []) if (!merged.has(row.season)) merged.set(row.season, row);
  return {
    regular: [...merged.values()].filter(row => !save || Number(row.season.slice(0, 4)) < Number(league.snapshot.slice(0, 4)))
      .sort((a, b) => b.season.localeCompare(a.season)),
    playoffs: nbaCareerPostseason[player.id] ?? [],
    honors: nbaPlayerHonors(player.id),
    source: player.source ?? nbaCareerSources[player.id],
  };
}

function previousNbaSeasonStats(player) {
  const year = Number(league.snapshot.slice(0, 4)) - 1;
  return nbaCareerRecords(player, true).regular.find(row => Number(row.season.slice(0, 4)) === year)?.stats;
}

function nbaCareerTotals(rows) {
  const exact = rows.filter(row => row.totals);
  if (!exact.length) return null;
  const sum = key => exact.every(row => Number.isFinite(row.totals[key]))
    ? exact.reduce((value, row) => value + row.totals[key], 0) : null;
  const percentage = (makes, attempts) => Number.isFinite(sum(makes)) ? seasonSim.percentage(sum(makes), sum(attempts)) : null;
  return { ...Object.fromEntries(['GP', ...careerStats].map(key => [key, sum(key)])),
    'FG%': percentage('FGM', 'FGA'), '3P%': percentage('3PM', '3PA'), 'FT%': percentage('FTM', 'FTA') };
}

function franchiseHonorsSummary(seasons) {
  const honors = seasons.flatMap(({ year, honors }) => honors.map(honor => {
    const periodic = honor.match(/^(.*?) ×(\d+) \((.*)\)$/);
    const label = periodic?.[1] ?? (honor === 'Most Valuable Player' ? 'MVP' : honor);
    return { label, season: seasonLabel(year), source: '#playoffs/' + year,
      count: periodic ? Number(periodic[2]) : 1, detail: periodic?.[3] };
  }));
  return nbaHonorsSummary(honors, 'Franchise honors', true);
}

function nbaHonorsSummary(honors, heading = "Verified NBA honors", franchise = false) {
  const priority = ['NBA champion', 'MVP', 'NBA Finals MVP', 'All-Star', 'All-NBA', 'All-Defensive', 'NBA Cup champion', 'NBA Cup MVP', 'All-Star Game MVP',
    'Defensive Player of the Year', 'Rookie of the Year', 'All-Rookie', 'Conference Finals MVP'];
  const groups = new Map();
  for (const honor of honors) {
    const selection = honor.label.match(/^(All-NBA|All-Defensive|All-Rookie) (First|Second|Third) Team$/);
    const key = selection?.[1] ?? (/^(East|West) Finals MVP$/.test(honor.label) ? 'Conference Finals MVP' : honor.label);
    if (!groups.has(key)) groups.set(key, new Map());
    const label = selection ? selection[2] + ' Team' : honor.label;
    const entries = groups.get(key);
    if (!entries.has(label)) entries.set(label, []);
    entries.get(label).push(honor);
  }
  const order = key => priority.includes(key) ? priority.indexOf(key) : priority.length;
  const count = items => items.reduce((total, item) => total + (item.count ?? 1), 0);
  const yearRanges = items => {
    const years = [...new Set(items.flatMap(item => {
      const start = Number(item.season?.slice(0, 4));
      return start ? [start + 1] : [];
    }))].sort((a, b) => a - b);
    const ranges = [];
    for (const year of years) {
      if (ranges.at(-1)?.[1] === year - 1) ranges.at(-1)[1] = year;
      else ranges.push([year, year]);
    }
    return ranges.map(([start, end]) => start === end ? start : start + '–' + end).join(', ');
  };
  const cards = [...groups].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b));
  const titleId = franchise ? "franchise-honors-title" : "nba-honors-title";
  return `<section class="career-honors" aria-labelledby="${titleId}">
    <div class="honors-heading"><h2 id="${titleId}">${e(heading)}</h2>
      ${honors.length ? `<span>${count(honors)} recorded · ${groups.size} categories</span>` : ''}</div>
    ${cards.length ? `<div class="honors-grid">${cards.map(([key, entries]) => {
      const total = [...entries.values()].reduce((sum, items) => sum + count(items), 0);
      const tier = ['First Team', 'Second Team', 'Third Team'];
      const sections = [...entries].sort(([a], [b]) => tier.indexOf(a) - tier.indexOf(b) || a.localeCompare(b));
      const summary = sections.map(([label, items]) => [count(items) + ' ' + label, yearRanges(items)].filter(Boolean).join(' · ')).join(' / ');
      const detail = entries.has(key) && entries.size === 1
        ? yearRanges(entries.get(key)) || 'Published count'
        : summary;
      return `<details class="panel honors-card" name="${titleId}">
        <summary><strong class="honors-count">${total}×</strong>
          <span><b>${e(key)}</b><small>${e(detail)}</small></span></summary>
        <div class="honors-detail">${sections.map(([label, items]) => `
          ${label === key ? '' : `<h3>${e(label)}</h3>`}
          <ul>${[...items].sort((a, b) => (b.season ?? "").localeCompare(a.season ?? "")).map(item =>
            `<li><a href="${e(item.source)}" aria-label="${e((item.season ?? 'Career count') + ' ' + item.label + ' source')}">${e(item.season ? item.season + (item.team ? ' · ' + item.team : '') + (item.detail ? ' · ' + item.detail : '') : ((item.count ?? 1) + '× · Published count without season dates'))}</a></li>`).join('')}</ul>`).join('')}</div>
      </details>`;
    }).join('')}</div>` : franchise ? '<p class="note">No franchise honors recorded yet.</p>' : '<p class="note">No honors from the verified categories are recorded for this player.</p>'}
    <p class="note">${franchise ? "Open a category to review awards by franchise season." : "Open a category for its seasons and sources. Coverage varies by player. Published career counts link to their source when individual dates are unavailable."}</p>
  </section>`;
}

function nba2kRosterComparison(player) {
  const reference = nba2kReference[player.id];
  if (!reference) return '<details class="panel facility-card"><summary>NBA 2K27 reference</summary><p>No verified 2K27 roster match for this player.</p></details>';
  const lebron = player.id === "1966";
  const curve = playerDevelopment.profiles.get(player.id) ?? playerDevelopment.curve(player);
  const rows = Object.entries(reference.ratings);
  const capture = reference.version ? `${reference.date} · ${reference.version}` : null;
  return `<details class="panel facility-card"><summary><strong>Compare with NBA 2K27 · Current NBA roster</strong></summary>
    <p>${capture ? 'MyNBA Current NBA roster capture · ' + e(capture) + '.' : reference.source ? "Public MyNBA roster table checked Nov. 6, 2026." : "Public NBA2KLab ratings table checked Nov. 6, 2026."} Simulator values below are the player’s base ratings.</p>
    <div class="table-wrap"><table><thead><tr><th>Field</th><th>Simulator</th><th>2K27</th></tr></thead><tbody>
      <tr><td>Overall</td><td>${formatStat(seasonSim.baseOverall(player), 2)}</td><td>${reference.overall}</td></tr>
      <tr><td>Position</td><td>${e(playerTools.positionText(player))}</td><td>${e(lebron ? "PF / PG" : reference.position || '—')}</td></tr>
      <tr><td>Wingspan</td><td>${e(player.wingspan || nbaCombineLength(nbaProfileData[player.id]?.combine?.wingspan) || '—')}</td><td>${lebron ? "7′0″" : "—"}</td></tr>
      <tr><td>Peak ages</td><td>${curve.peakStart}–${curve.peakEnd}</td><td>${lebron ? "25–35" : "—"}</td></tr>
      ${rows.map(([key, value]) => `<tr><td>${e(key)}</td><td>${formatStat(player.attributes[key], 2)}</td><td>${value}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="note">${lebron ? "The roster capture also lists 33 badges, tendencies, animations, and body-part durability." : rows.length ? "Attributes shown have a direct comparison in the roster source." : "This source only provides the roster fields shown here."} The simulator uses a 23-attribute average for overall and a single durability rating. The in-game Award History layout is still unverified.</p>
    <p><a href="${e(lebron ? "https://2kauction.com/mynba/players/lebron-james" : reference.source ?? "https://www.nba2klab.com/nba2k-player-ratings")}">2K27 roster reference</a> ·
      <a href="https://www.nba.com/news/nba-2k27-top-100-player-ratings-announced">Published 2K27 overall ratings</a></p>
  </details>`;
}

const nbaGameLogLoads = new Map();

function loadNbaHistoricalGames(year) {
  if (globalThis.nbaHistoricalGameLogs?.[year]) return Promise.resolve(globalThis.nbaHistoricalGameLogs[year]);
  if (!nbaGameLogLoads.has(year)) {
    const loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'nba-game-logs/' + year + '.js';
      const failed = () => {
        script.remove();
        reject(new Error('Season archive could not be opened.'));
      };
      script.onload = () => globalThis.nbaHistoricalGameLogs?.[year]
        ? resolve(globalThis.nbaHistoricalGameLogs[year]) : failed();
      script.onerror = failed;
      document.head.append(script);
    }).catch(error => { nbaGameLogLoads.delete(year); throw error; });
    nbaGameLogLoads.set(year, loading);
  }
  return nbaGameLogLoads.get(year);
}

function nbaGameLog(player, save) {
  const recent = (nbaGameLogData[player.id] ?? []).filter(row => !save || row[1] < league.snapshot.slice(0, 4) + '-09-01');
  const olderYears = nbaHistoricalGameLogYears[player.id] ?? [];
  operationsPage(player.name + ' · NBA game log', 'Real NBA box scores by season. Records checked through Nov. 6, 2026.', `
    <p><a href="#career/${e(player.id)}">← Career résumé</a></p>
    <div class="panel toolbar">
      <label>Season<select id="nba-log-year">${save ? '' : '<option value="all">2025–26 + 2026–27</option><option value="2026-27">2026–27</option>'}<option value="2025-26">2025–26</option>
        ${olderYears.map(year => `<option value="${year - 1}-${String(year).slice(-2)}">${year - 1}–${String(year).slice(-2)}</option>`).join('')}</select></label>
      <label>Segment<select id="nba-log-segment"><option>All</option><option>Regular season</option><option>Play-in</option><option>Playoffs</option><option>Cup final</option></select></label>
    </div>
    <div class="panel table-wrap"><table><thead><tr>${['Date', 'Team', 'Opponent', 'Result', 'Segment', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG', '3PT', 'FT'].map(label => `<th>${label}</th>`).join('')}</tr></thead>
    <tbody id="nba-log-rows"></tbody></table></div>
    <p id="nba-log-count" aria-live="polite"></p><button id="nba-log-more">Show more games</button>
    <button id="nba-log-retry" hidden>Retry opening season</button>`);
  const year = document.querySelector('#nba-log-year');
  const segment = document.querySelector('#nba-log-segment');
  const rows = document.querySelector('#nba-log-rows');
  const count = document.querySelector('#nba-log-count');
  const more = document.querySelector('#nba-log-more');
  const retry = document.querySelector('#nba-log-retry');
  let limit = 30;
  let request = 0;
  async function update() {
    const currentRequest = ++request;
    const selectedYear = year.value;
    const historicalYear = Number(selectedYear.slice(0, 4)) + 1;
    const historical = olderYears.includes(historicalYear);
    let games = recent;
    retry.hidden = true;
    if (historical) {
      count.textContent = 'Opening season…';
      rows.innerHTML = '';
      more.hidden = true;
      try {
        const archive = await loadNbaHistoricalGames(historicalYear);
        if (currentRequest !== request) return;
        games = archive[player.id] ?? [];
      } catch {
        if (currentRequest !== request) return;
        count.textContent = 'This season could not be opened. Try again.';
        retry.hidden = false;
        return;
      }
    }
    const matching = games.filter(([, date, , , , , , , kind]) => {
      const seasonStart = Number(date.slice(0, 4)) - (date.slice(5, 7) < '09' ? 1 : 0);
      return (historical || selectedYear === 'all' || Number(selectedYear.slice(0, 4)) === seasonStart) &&
        (segment.value === 'All' || segment.value === kind);
    });
    rows.innerHTML = matching.slice(0, limit).map(([id, date, team, opponent, venue, result, home, away, kind, ...stats]) => {
      const score = venue === '@' ? [away, home] : [home, away];
      return `<tr><td><a href="https://www.espn.com/nba/boxscore/_/gameId/${e(id)}">${e(date)}</a></td>
        ${[team, [venue, opponent].filter(Boolean).join(' '), [result, score.every(v => v != null) ? score.join('–') : ''].filter(Boolean).join(' '), kind, ...stats].map(value => `<td>${e(value)}</td>`).join('')}</tr>`;
    }).join('') || '<tr><td colspan="15">No verified NBA game rows in this view.</td></tr>';
    count.textContent = 'Showing ' + Math.min(limit, matching.length) + ' of ' + matching.length + ' games';
    const coverage = historical && nbaHistoricalGameLogCoverage[player.id]?.[historicalYear];
    if (coverage) count.textContent += '. This archive has ' + coverage[0] +
      ' regular-season games. The published career summary lists ' + coverage[1] + '.';
    more.hidden = matching.length <= limit;
  }
  for (const filter of [year, segment]) filter.addEventListener('change', () => { limit = 30; update(); });
  more.addEventListener('click', () => { limit += 30; update(); });
  retry.addEventListener('click', update);
  update();
}

function playerCareer(player, save) {
  const seasons = save ? [save, ...[...save.pastSeasons].reverse()].map(entry => {
    const state = seasonSim.history(entry);
    return { year: entry.year, games: careerGames(state.results, player.id), honors: careerHonors(state, player.id) };
  }) : [];
  const imported = nbaCareerRecords(player, save);
  const statsTable = (heading, id) => `<section><h2>${heading}</h2><div class="panel table-wrap"><table>
    <thead><tr><th>Season / segment</th>${statsColumns.map(stat => `<th>${stat}</th>`).join('')}</tr></thead>
    <tbody id="${id}"></tbody></table></div></section>`;
  operationsPage(player.name + ' · Career résumé', 'Franchise results and imported NBA seasons are tracked separately.', `
    <a href="#player/${e(player.id)}">← Player card</a>
    ${nbaHonorsSummary(imported.honors)}
    ${nba2kRosterComparison(player)}
    ${save ? `<div class="panel toolbar"><label>Season<select id="career-year"><option value="all">All franchise seasons</option>
      ${seasons.map(item => `<option value="${item.year}">${seasonLabel(item.year)}</option>`).join('')}</select></label>
      <label>Segment<select id="career-segment"><option>All</option>${careerSegments.map(value => `<option>${value}</option>`).join('')}</select></label>
      <label>Stats view<select id="career-mode"><option>Per game</option><option>Totals</option></select></label></div>
      ${statsTable('Franchise season statistics', 'career-stats')}
      ${franchiseHonorsSummary(seasons)}
      <section><h2>Franchise game log</h2><div class="panel table-wrap"><table><thead><tr><th>Date</th><th>Team</th><th>Opponent</th>
        <th>Result</th><th>Segment</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG</th></tr></thead>
        <tbody id="career-log"></tbody></table></div><button id="career-more">Show more games</button></section>` : ''}
    <section><h2>Real NBA career</h2>
      <p><a href="#nba-games/${e(player.id)}">Open real NBA game log →</a></p>
      <p class="note">Completed seasons use ESPN career data. ${save ? 'Your franchise takes over from the 2026–27 season.' : 'The partial 2026–27 snapshot appears when available.'}
        Totals show source-reported counts. Fields missing from the totals feed, including minutes, are blank.</p>
      <div class="panel toolbar"><label>NBA segment<select id="nba-career-segment"><option value="regular">Regular season</option>
        <option value="playoffs">Playoffs</option></select></label><label>NBA stats view<select id="nba-career-mode"><option>Per game</option><option>Totals</option></select></label></div>
      <div class="panel table-wrap"><table><thead><tr><th>Season</th>${statsColumns.map(stat => `<th>${stat}</th>`).join('')}</tr></thead>
      <tbody id="nba-career-rows"></tbody></table></div>
      ${imported.source ? `<p><a href="${e(imported.source)}">Open ESPN player profile →</a></p>` : ''}</section>
    `);
  const nbaSegment = document.querySelector('#nba-career-segment');
  const nbaMode = document.querySelector('#nba-career-mode');
  function updateNba() {
    const totals = nbaMode.value === 'Totals';
    const selected = imported[nbaSegment.value] ?? [];
    const rows = totals ? selected.filter(row => row.totals) : selected;
    const combined = totals ? nbaCareerTotals(rows) : importedCareerAverages(rows);
    const summaryLabel = totals ? `Totals across ${rows.length} of ${selected.length} listed seasons` : 'Available seasons combined';
    const cells = stats => statsColumns.map(key => `<td>${formatStat(stats[key], totals && !key.endsWith('%') || key === 'GP' ? 0 : 1)}</td>`).join('');
    document.querySelector('#nba-career-rows').innerHTML = rows.length
      ? `<tr><th>${summaryLabel}</th>${cells(combined)}</tr>` + rows.map(row => {
        const snapshot = !row.totals ? ' · Snapshot' : '';
        const value = totals ? { ...row.totals, 'FG%': row.stats['FG%'], '3P%': row.stats['3P%'], 'FT%': row.stats['FT%'] } : row.stats;
        const normalized = totals ? value : { ...value, 'FG%': value['FG%'] ?? seasonSim.percentage(value.FGM, value.FGA) };
        return `<tr><td>${e(row.season + snapshot)}</td>${cells(normalized)}</tr>`;
      }).join('') : '<tr><td colspan="12">No source records for this view.</td></tr>';
  }
  nbaSegment.addEventListener('change', updateNba);
  nbaMode.addEventListener('change', updateNba);
  updateNba();
  if (!save) return;
  let limit = 30;
  const element = id => document.querySelector('#career-' + id);
  const update = () => {
    const year = element('year').value;
    const segment = element('segment').value;
    const selected = seasons.filter(item => year === 'all' || Number(year) === item.year);
    const segments = segment === 'All' ? careerSegments : [segment];
    const displayTotals = element('mode').value === 'Totals';
    const rows = selected.flatMap(item => segments.map(stage => ({
      label: seasonLabel(item.year) + ' · ' + stage, totals: careerTotals(item.games.filter(row => row.segment === stage)),
    })).filter(row => row.totals.GP));
    const allGames = selected.flatMap(item => item.games.filter(row => segments.includes(row.segment)).map(row => ({ ...row, year: item.year })));
    const combined = careerTotals(allGames);
    if (combined.GP) rows.unshift({ label: 'Selected games combined', totals: combined });
    element('stats').innerHTML = rows.map(({ label, totals }) => `<tr><td>${e(label)}</td>${statsColumns.map(key => {
      const rate = key.endsWith('%');
      const value = key === 'GP' || rate || displayTotals ? totals[key] : totals[key] / totals.GP;
      return `<td>${formatStat(value, key === 'GP' || displayTotals && !rate ? 0 : 1)}</td>`;
    }).join('')}</tr>`).join('') || '<tr><td colspan="12">No appearances match these filters.</td></tr>';
    allGames.sort((a, b) => b.year - a.year || b.game.day - a.game.day);
    element('log').innerHTML = allGames.slice(0, limit).map(({ game, code, opponent, atHome, line, segment, year }) => {
      const outcome = resultOutcome(game, code);
      const score = atHome ? [game.homeScore, game.awayScore] : [game.awayScore, game.homeScore];
      return `<tr><td><a href="#game/${e(game.id)}/${year}">${simDate(game.day, year)}</a></td>
      <td>${e(code)}</td><td>${atHome ? 'vs' : 'at'} ${e(opponent)}</td>
      <td><strong class="result-badge ${outcome.style}">${outcome.label}</strong> ${score.join('–')}</td><td>${segment}</td>
      ${line ? careerStats.map(key => `<td>${key === 'REB' ? line.OREB + line.DREB : line[key]}</td>`).join('') + `<td>${line.FGM}–${line.FGA}</td>`
        : '<td colspan="8">Did not play</td>'}</tr>`;
    }).join('') || '<tr><td colspan="13">No games match these filters.</td></tr>';
    element('more').hidden = allGames.length <= limit;
  };
  for (const id of ['year','segment','mode']) element(id).addEventListener('change', () => { limit = 30; update(); });
  element('more').addEventListener('click', () => { limit += 30; update(); });
  update();
}

function staffHonorsDirectory(save, index) {
  const names = Object.keys(staffHistoricalHonors).sort();
  const name = names[Number(index)];
  operationsPage('NBA staff honors', 'Verified coach and executive awards from the league archive.', `
    <a href="#staff">← Staff</a>
    ${name ? nbaHonorsSummary(staffHistoricalHonors[name], name + ' · NBA honors') : `<div class="panel table-wrap"><table>
      <thead><tr><th>Recipient</th><th>Awards</th></tr></thead><tbody>${names.map((person, i) =>
        `<tr><td><a href="#staff-honors/${i}">${e(person)}</a></td><td>${staffHistoricalHonors[person].length}</td></tr>`).join('')}
      </tbody></table></div>`}`);
}

function staffCareer(save, code, slot) {
  const club = teams.get(code);
  const gm = slot === 'gm' && save?.team === code;
  const official = slot?.startsWith('coach-') ? nbaCoaches[code]?.coaches[Number(slot.slice(6))] : null;
  const role = staffSim.roles[Number(slot)];
  const monthly = slot?.startsWith('monthly-') && save
    ? [save, ...save.pastSeasons].flatMap(season => seasonSim.history(season).periodAwards)
      .filter(period => period.key === 'coachMonth').flatMap(period => period.winners)
      .find(winner => winner?.team === code && winner.id === slot.slice(8))
    : null;
  const person = gm ? { name: save.gm?.name ?? 'Your GM' } : official ?? monthly ?? (club && role ? staffSim.assignments(save, code, staffSim.roles)[role] : null);
  if (!club || !person) { staff(code); return; }
  const key = value => value.normalize('NFD').toLowerCase().replace(/\p{M}|[^a-z0-9]/gu, '');
  const real = Object.entries(staffHistoricalHonors).find(([name]) => key(name) === key(person.name))?.[1] ?? [];
  const simulated = gm ? gmCareer.honors(save).reverse() : [];
  if (save && !gm) for (const season of [save, ...[...save.pastSeasons].reverse()]) {
    const state = seasonSim.history(season);
    const staffing = season.staffTimeline?.findLast(entry => entry.day < seasonSim.playoffStart)?.staffing ?? season.staffBaseline;
    for (const period of state.periodAwards.filter(period => period.key === 'coachMonth')) {
      for (const winner of period.winners) {
        if (winner && (winner.id === person.id || official && key(winner.name) === key(person.name))) {
          simulated.push([season.year, 'Coach of the Month · ' + period.label]);
        }
      }
    }
    for (const winner of state.awards?.coach ?? []) {
      const head = staffSim.assignments({ ...season, staffing }, winner, staffSim.roles)['Head Coach'];
      if (head.id === person.id || official && key(head.name) === key(person.name)) simulated.push([season.year, 'Coach of the Year']);
    }
  }
  const contract = !official && !monthly && role ? person.contract : null;
  const contractSection = contract ? castTable(['Season', 'Salary'], Array.from({ length: contract.years }, (_, offset) => [
    seasonLabel(contract.startYear + offset), money(contract.salary),
  ])) : role && !official && !monthly ? '<p>Modeled annual payroll · ' + money(staffSim.salary(person, role)) + '</p>' : '';
  operationsPage(person.name + ' · Staff résumé', (official?.title ?? role ?? 'General manager') + ' · ' + club.name, `
    <a href="#staff/${e(code)}">← Staff</a> · <a href="#staff-honors">NBA staff honors archive</a>
    ${contractSection ? `<section><h2>Staff contract</h2>${contractSection}</section>` : ""}
    ${nbaHonorsSummary(real)}
    <section><h2>Franchise honors</h2><div class="panel facility-card">${simulated.length ? simulated.map(([year, label]) =>
      `<p><a href="#playoffs/${year}">${seasonLabel(year)}</a> · ${e(label)}</p>`).join('') : '<p>No franchise honors recorded.</p>'}</div></section>
    <p class="note">Staff honors use NBA archive results and franchise outcomes. No verified 2K player-rating comparison applies to this role.</p>`);
}
