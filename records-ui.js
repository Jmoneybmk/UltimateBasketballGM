
const recordStats = { PTS: 'Points', FGM: 'Field goals made', '3PM': 'Three-pointers made', FTM: 'Free throws made',
  REB: 'Rebounds', AST: 'Assists', BLK: 'Blocks', STL: 'Steals', MIN: 'Minutes', TO: 'Turnovers' };
const recordViews = { game: 'Regular-season game', playoffs: 'Playoff game', season: 'Season total', career: 'Career total' };
const nbaRecordSources = {
  brefSeason: 'https://www.basketball-reference.com/leaders/pts_season.html',
  brefCareer: 'https://www.basketball-reference.com/leaders/pts_career_c.html',
  game: 'https://www.nba.com/news/every-70-point-game-in-nba-history',
  playoffs: 'https://www.nba.com/news/most-points-scored-nba-playoff-game',
  season: 'https://cdn-uat.nba.com/news/embiid-70-highest-per-minute-scoring-average',
  career: 'https://www.nba.com/stats/alltime-leaders?PerMode=Totals&SeasonType=Regular+Season',
  lebron: 'https://api-hub.nba.com/news/19-playoff-stats-lebron-james-2026-playoffs',
  miami: 'https://www.nba.com/heat/news/bam-adebayo-named-eastern-conference-player-of-the-week-3',
  heatGuide: 'https://cdn.nba.com/teams/uploads/sites/1610612748/2023/11/2023-24-Miami-Heat-Media-Guide_39884007.pdf',
  bamFT: 'https://www.nba.com/news/live-updates-jayson-tatums-celtics-take-on-victor-wembanyamas-spurs-on-nbc-and-peacock',
  stockton: 'https://www.nba.com/news/history-nba-legend-john-stockton',
  stocktonSeason: 'https://www.nba.com/news/the-five-everything-to-know-for-week-6',
  careerBlocks: 'https://www.nba.com/stats/alltime-leaders?PerMode=Totals&SeasonType=Regular+Season&StatCategory=BLK',
  careerRebounds: 'https://www.nba.com/stats/alltime-leaders?PerMode=Totals&SeasonType=Regular+Season&StatCategory=REB',
  careerMakes: 'https://www.nba.com/stats/alltime-leaders?SeasonType=Regular+Season&StatCategory=FGM',
  blocks: 'https://www.nba.com/news/the-most-blocks-by-a-player-in-an-nba-game',
  steals: 'https://www.nba.com/news/most-steals-by-a-player-in-a-single-nba-game',
  assists: 'https://www.nba.com/news/most-assists-by-a-player-in-a-single-nba-game',
  threes: 'https://www.nba.com/news/most-3-pointers-made-single-game-nba-history',
  rebounds: 'https://jr.nba.com/wilt-chamberlain-rebounding-machine/',
};

const verifiedRecordRows = [
  ["season","PTS","Wilt Chamberlain",4029,"1961–62",null,"brefSeason"],
  ["season","PTS","Wilt Chamberlain",3586,"1962–63",null,"brefSeason"],
  ["season","PTS","Michael Jordan",3041,"1986–87",null,"brefSeason"],
  ["season","PTS","Wilt Chamberlain",3033,"1960–61",null,"brefSeason"],
  ["season","PTS","Wilt Chamberlain",2948,"1963–64",null,"brefSeason"],
  ["season","PTS","Michael Jordan",2868,"1987–88",null,"brefSeason"],
  ["season","PTS","Kobe Bryant",2832,"2005–06",null,"brefSeason"],
  ["season","PTS","Bob McAdoo",2831,"1974–75",null,"brefSeason"],
  ["season","PTS","Kareem Abdul-Jabbar",2822,"1971–72",null,"brefSeason"],
  ["season","PTS","James Harden",2818,"2018–19",null,"brefSeason"],
  ["season","PTS","Rick Barry",2775,"1966–67",null,"brefSeason"],
  ["season","PTS","Michael Jordan",2753,"1989–90",null,"brefSeason"],
  ["season","PTS","Elgin Baylor",2719,"1962–63",null,"brefSeason"],
  ["season","PTS","Tiny Archibald",2719,"1972–73",null,"brefSeason"],
  ["season","PTS","Wilt Chamberlain",2707,"1959–60",null,"brefSeason"],
  ["season","PTS","Wilt Chamberlain",2649,"1965–66",null,"brefSeason"],
  ["season","PTS","Michael Jordan",2633,"1988–89",null,"brefSeason"],
  ["season","PTS","Kareem Abdul-Jabbar",2596,"1970–71",null,"brefSeason"],
  ["season","PTS","Kevin Durant",2593,"2013–14",null,"brefSeason"],
  ["season","PTS","George Gervin",2585,"1979–80",null,"brefSeason"],
  ["season","PTS","Michael Jordan",2580,"1990–91",null,"brefSeason"],
  ["season","PTS","Russell Westbrook",2558,"2016–17",null,"brefSeason"],
  ["season","PTS","George Gervin",2551,"1981–82",null,"brefSeason"],
  ["season","PTS","Michael Jordan",2541,"1992–93",null,"brefSeason"],
  ["season","PTS","Karl Malone",2540,"1989–90",null,"brefSeason"],
  ["season","PTS","Elgin Baylor",2538,"1960–61",null,"brefSeason"],
  ["season","PTS","Wilt Chamberlain",2534,"1964–65",null,"brefSeason"],
  ["career","PTS","Kareem Abdul-Jabbar",38387,null,null,"brefCareer"],
  ["career","PTS","Karl Malone",36928,null,null,"brefCareer"],
  ["career","PTS","Kobe Bryant",33643,null,null,"brefCareer"],
  ["career","PTS","Michael Jordan",32292,null,null,"brefCareer"],
  ["career","PTS","Dirk Nowitzki",31560,null,null,"brefCareer"],
  ["career","PTS","Wilt Chamberlain",31419,null,null,"brefCareer"],
  ["career","PTS","Shaquille O'Neal",28596,null,null,"brefCareer"],
  ["career","PTS","Carmelo Anthony",28289,null,null,"brefCareer"],
  ["career","PTS","Moses Malone",27409,null,null,"brefCareer"],
  ["career","PTS","Elvin Hayes",27313,null,null,"brefCareer"],
  ["career","PTS","Russell Westbrook",27176,null,null,"brefCareer"],
  ["career","PTS","Hakeem Olajuwon",26946,null,null,"brefCareer"],
  ["career","PTS","Oscar Robertson",26710,null,null,"brefCareer"],
  ["career","PTS","Dominique Wilkins",26668,null,null,"brefCareer"],
  ["career","PTS","Tim Duncan",26496,null,null,"brefCareer"],
  ["career","PTS","Paul Pierce",26397,null,null,"brefCareer"],
  ["career","PTS","John Havlicek",26395,null,null,"brefCareer"],
  ["career","PTS","Kevin Garnett",26071,null,null,"brefCareer"],
  ["career","PTS","Vince Carter",25728,null,null,"brefCareer"],
  ["career","PTS","Alex English",25613,null,null,"brefCareer"],
  ["playoffs","PTS","Michael Jordan",63,"1986-04-20","CHI"],
  ["playoffs","PTS","Elgin Baylor",61,"1962-04-14","LAL"],
  ["playoffs","PTS","Donovan Mitchell",57,"2020-08-17","UTA"],
  ["playoffs","PTS","Jimmy Butler",56,"2023-04-24","MIA"],
  ["playoffs","PTS","Charles Barkley",56,"1994-05-04","PHX"],
  ["playoffs","PTS","Michael Jordan",56,"1992-04-29","CHI"],
  ["playoffs","PTS","Wilt Chamberlain",56,"1962-03-22","GSW"],
  ["playoffs","PTS","Damian Lillard",55,"2021-06-01","POR"],
  ["playoffs","PTS","Allen Iverson",55,"2003-04-20","PHI"],
  ["playoffs","PTS","Michael Jordan",55,"1997-04-27","CHI"],
  ["playoffs","PTS","Michael Jordan",55,"1993-06-16","CHI"],
  ["playoffs","PTS","Michael Jordan",55,"1988-05-01","CHI"],
  ["playoffs","PTS","Rick Barry",55,"1967-04-18","GSW"],
  ["playoffs","PTS","Allen Iverson",54,"2001-05-09","PHI"],
  ["playoffs","PTS","Michael Jordan",54,"1993-05-31","CHI"],
  ["playoffs","PTS","John Havlicek",54,"1973-04-01","BOS"],
  ["playoffs","PTS","Nikola Jokic",53,"2023-05-07","DEN"],
  ["playoffs","PTS","Isaiah Thomas",53,"2017-05-02","BOS"],
  ["playoffs","PTS","Jerry West",53,"1969-04-23","LAL"],
  ["playoffs","PTS","Wilt Chamberlain",53,"1960-03-14","GSW"],
  ["game","PTS","Elgin Baylor",71,"1960-11-15","LAL"],
  ["game","PTS","Wilt Chamberlain",78,"1961-12-08","GSW"],
  ["game","PTS","Wilt Chamberlain",73,"1962-01-13","GSW"],
  ["game","PTS","Wilt Chamberlain",100,"1962-03-02","GSW"],
  ["game","PTS","Wilt Chamberlain",72,"1962-11-03","GSW"],
  ["game","PTS","Wilt Chamberlain",73,"1962-11-16","GSW"],
  ["game","PTS","Wilt Chamberlain",70,"1963-03-10","GSW"],
  ["game","PTS","David Thompson",73,"1978-04-09","DEN"],
  ["game","PTS","David Robinson",71,"1994-04-24","SAS"],
  ["game","PTS","Kobe Bryant",81,"2006-01-22","LAL"],
  ["game","PTS","Devin Booker",70,"2017-03-24","PHX"],
  ["game","PTS","Donovan Mitchell",71,"2023-01-02","CLE"],
  ["game","PTS","Damian Lillard",71,"2023-02-26","POR"],
  ["game","PTS","Joel Embiid",70,"2024-01-22","PHI"],
  ["game","PTS","Luka Doncic",73,"2024-01-26","DAL"],
  ["game","PTS","Bam Adebayo",83,"2026-03-10","MIA"],
  ['game','PTS','Wilt Chamberlain',100,'1962-03-02','GSW'],
  ['game','PTS','Bam Adebayo',83,'2026-03-10','MIA','miami'],
  ['game','PTS','Kobe Bryant',81,'2006-01-22','LAL'],
  ['game','PTS','Wilt Chamberlain',78,'1961-12-08','GSW'],
  ['game','PTS','Luka Dončić',73,'2024-01-26','DAL'],
  ['game','FGM','Wilt Chamberlain',36,'1962-03-02','GSW'],
  ['game','FTM','Bam Adebayo',36,'2026-03-10','MIA','bamFT'],
  ['game','BLK','Elmore Smith',17,'1973-10-28','LAL','blocks'],
  ['game','STL','Larry Kenon',11,'1976-12-26','SAS','steals'],
  ['game','STL','Kendall Gill',11,'1999-04-03','BKN','steals'],
  ['game','AST','Scott Skiles',30,'1990-12-30','ORL','assists'],
  ['game','3PM','Klay Thompson',14,'2018-10-29','GSW','threes'],
  ['game','REB','Wilt Chamberlain',55,'1960-11-24','GSW','rebounds'],
  ['game','REB','Bill Russell',51,'1960-02-05','BOS','rebounds'],
  ['playoffs','3PM','Damian Lillard',12,'2021-06-01','POR','threes'],
  ['game','PTS','LeBron James',61,'2014-03-03','MIA','heatGuide'],
  ['game','PTS','Glen Rice',56,'1995-04-15','MIA','heatGuide'],
  ['game','PTS','Dwyane Wade',55,'2009-04-12','MIA','heatGuide'],
  ['playoffs','PTS','Michael Jordan',63,'1986-04-20','CHI'],
  ['playoffs','PTS','Elgin Baylor',61,'1962-04-14','LAL'],
  ['playoffs','PTS','Donovan Mitchell',57,'2020-08-17','UTA'],
  ['playoffs','PTS','Jimmy Butler',56,'2023-04-24','MIA'],
  ['playoffs','PTS','Charles Barkley',56,'1994-05-04','PHX'],
  ['playoffs','PTS','Michael Jordan',56,'1992-04-29','CHI'],
  ['playoffs','PTS','Wilt Chamberlain',56,'1962-03-22','GSW'],
  ['season','PTS','Wilt Chamberlain',4029,'1961–62','GSW'],
  ['season','MIN','Wilt Chamberlain',3882,'1961–62','GSW'],
  ['season','AST','John Stockton',1164,'1990–91','UTA','stocktonSeason'],
  ['season','AST','John Stockton',1134,'1989–90','UTA','stocktonSeason'],
  ['career','PTS','LeBron James',43440,'Through 2025–26',null,'lebron','1966'],
  ['career','PTS','Kareem Abdul-Jabbar',38387,null,null],
  ['career','PTS','Karl Malone',36928,null,null],
  ['career','PTS','Kobe Bryant',33643,null,null],
  ['career','PTS','Michael Jordan',32292,null,null],
  ['career','PTS','Wilt Chamberlain',31419,null,null],
  ['career','AST','John Stockton',15806,null,null,'stockton'],
  ['career','STL','John Stockton',3265,null,null,'stockton'],
  ['career','BLK','Hakeem Olajuwon',3830,null,null,'careerBlocks'],
  ['career','REB','Wilt Chamberlain',23924,null,null,'careerRebounds'],
  ['career','FGM','Kareem Abdul-Jabbar',15837,null,null,'careerMakes'],
  ['career','FTM','Karl Malone',9787,null,null,'careerMakes'],
].map(([view, stat, name, value, date, club, source = view, id]) =>
  ({ view, stat, name, value, date, club, source: nbaRecordSources[source], id }));

function franchiseRecordRows(seasons, view, stat, club) {
  const rows = [];
  const career = new Map();
  for (const { state, year } of seasons) {
    const season = new Map();
    for (const game of state.results) {
      if (game.forfeit || (view === 'playoffs' ? !(game.playoffRound >= 0) : game.playoffRound != null)) continue;
      for (const side of ['home', 'away']) {
        const code = game[side];
        if (club && code !== club) continue;
        for (const line of game[side + 'Box']) {
          const value = stat === 'REB' ? line.OREB + line.DREB : line[stat];
          if (!(value > 0)) continue;
          const name = state.profiles.get(line.id)?.name ?? playersById.get(line.id)?.name ?? line.id;
          const entry = { id: line.id, name, value, club: code, simulated: true };
          if (view === 'game' || view === 'playoffs') {
            rows.push({ ...entry, date: simDate(game.day, year), href: '#game/' + game.id + '/' + year });
          } else {
            const totals = view === 'career' ? career : season;
            if (!totals.has(line.id)) totals.set(line.id, { ...entry, date: view === 'season' ? seasonLabel(year) : 'Franchise run',
              club: club ?? null, href: '#player/' + line.id });
            else totals.get(line.id).value += value;
          }
        }
      }
    }
    rows.push(...season.values());
  }
  return rows.concat([...career.values()]);
}

function archivedCareerRecord(player, stat, simulated) {
  const seasons = nbaCareerData[player.id] ?? nbaCareerUnsigned[player.id] ?? [];
  const eligible = seasons.filter(row => Number(row.season.slice(0, 4)) < Number(league.snapshot.slice(0, 4)));
  if (!eligible.length || !eligible.every(row => Number.isFinite(row.totals?.[stat]))) return null;
  const value = eligible.reduce((sum, row) => sum + row.totals[stat], 0);
  if (!value && !simulated?.value) return null;
  return { id: player.id, name: player.name, value: value + (simulated?.value ?? 0),
    date: eligible.length + ' archived NBA seasons' + (simulated ? ' + franchise' : ''),
    source: nbaCareerSources[player.id] ?? player.source, href: simulated?.href, archived: true, simulated: Boolean(simulated) };
}

function recordsScreen(save, selectedClub, selectedView, selectedStat) {
  const club = teams.has(selectedClub) ? selectedClub : '';
  const view = Object.hasOwn(recordViews, selectedView) ? selectedView : 'game';
  const stat = Object.hasOwn(recordStats, selectedStat) ? selectedStat : 'PTS';
  const route = (nextClub, nextView, nextStat) => '#records/' + (nextClub || 'nba') + '/' + nextView + '/' + nextStat;
  const seasons = save ? [...(save.pastSeasons ?? []), save].map(entry => ({ year: entry.year, state: seasonSim.history(entry) })) : [];
  const simulated = franchiseRecordRows(seasons, view, stat, club);
  const board = !club && view === 'career' ? brefCareerBoards[stat] : null;
  const performances = brefPerformanceBoards[view]?.[stat];
  const lineage = { PHW: 'GSW', SFW: 'GSW', MNL: 'LAL', PHO: 'PHX', NOJ: 'UTA', NJN: 'BKN', BRK: 'BKN',
    SEA: 'OKC', CHH: 'CHA', NOH: 'NOP', NOK: 'NOP', WSB: 'WAS', KCK: 'SAC', CIN: 'SAC', BUF: 'LAC', SDC: 'LAC',
    SDR: 'HOU', STL: 'ATL', SYR: 'PHI', FTW: 'DET', BAL: 'WAS', VAN: 'MEM' };
  const referenceRows = (performances?.rows ?? []).flatMap(([name, value, date, original]) => {
    const team = lineage[original] ?? original;
    if (club && team !== club) return [];
    if (Number(date.slice(0, 4)) >= Number(league.snapshot.slice(0, 4)) && date >= league.snapshot.slice(0, 4) + '-09') return [];
    return [{ name, value, date: view === 'season' ? date.replace('-', '–') : date, club: team, source: performances.source, bref: true }];
  });
  const historical = [...new Map([...verifiedRecordRows.filter(row => row.view === view && row.stat === stat && (!club || row.club === club)), ...referenceRows]
    .map(row => [[row.name.normalize('NFD').replace(/\p{M}/gu, ''), row.date, row.value].join('|'), row])).values()];
  if (board) {
    const fixed = save ? historical.filter(row => row.id) : [];
    historical.splice(0, historical.length, ...board.rows.map(([name, value]) =>
      fixed.find(row => row.name === name) ?? { name, value, date: 'Basketball Reference snapshot', source: board.source, bref: true }));
  }
  const teamBoard = view === 'career' && club ? brefTeamCareer[club] : null;
  if (teamBoard) {
    historical.splice(0, historical.length, ...(teamBoard.stats[stat] ?? []).map(([name, value]) =>
      ({ name, value, date: 'Basketball Reference franchise snapshot', source: teamBoard.source, bref: true })));
  }
  const combined = historical.map(row => {
    const continuation = view === 'career' && row.id && simulated.find(entry => entry.id === row.id);
    return continuation ? { ...row, value: row.value + continuation.value, date: 'NBA baseline + franchise',
      href: continuation.href, simulated: true, continued: true } : row;
  });
  const teamReference = view === 'career' && club ? nbaTeamHistory[club] : null;
  const published = teamBoard?.stats[stat]?.length ? null : teamReference?.records.find(([key]) => key === stat);
  const runs = new Map(simulated.map(row => [row.id, row]));
  const cutoff = Number(league.snapshot.slice(0, 4));
  const aliases = { NY: 'NYK', GS: 'GSW', NO: 'NOP', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS', BKN: 'BKN' };
  const archivedPerformances = view === 'career' ? [] : [...playersById.values()].flatMap(player => {
    if (view === 'season') {
      if (club) return []; // Season aggregates can cover multiple teams.
      return (nbaCareerData[player.id] ?? nbaCareerUnsigned[player.id] ?? []).flatMap(row => {
        const value = row.totals?.[stat];
        if (Number(row.season.slice(0, 4)) >= cutoff || !(value > 0)) return [];
        if (historical.some(item => item.name === player.name && item.date === row.season && item.value === value)) return [];
        return [{ name: player.name, value, date: row.season, source: nbaCareerSources[player.id] ?? player.source, archived: true }];
      });
    }
    return (nbaGameLogData[player.id] ?? []).flatMap(row => {
      const [id, date, team, , , , , , segment] = row;
      const code = aliases[team] ?? team;
      if (date >= cutoff + '-09-01' || segment !== (view === 'playoffs' ? 'Playoffs' : 'Regular season') || club && code !== club) return [];
      const value = nbaCardGameLine(row)[stat];
      if (!(value > 0) || historical.some(item => item.date === date && item.club === code && item.value === value
        && item.name.normalize('NFD').replace(/\p{M}/gu, '') === player.name.normalize('NFD').replace(/\p{M}/gu, ''))) return [];
      return [{ name: player.name, value, date, source: 'https://www.espn.com/nba/boxscore/_/gameId/' + id, archived: true }];
    });
  });
  const archivedCareer = view === 'career' && !club ? [...playersById.values()].flatMap(player => {
    if (historical.some(row => row.id === player.id || row.name === player.name)) return [];
    const row = archivedCareerRecord(player, stat, runs.get(player.id));
    return row ? [row] : [];
  }) : [];
  const withArchive = new Set(archivedCareer.map(row => row.id));
  const normalize = name => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const playersByName = new Map(league.players.map(player => [normalize(player.name), player]));
  const rankedCareer = combined.map(row => {
    const player = row.bref && playersByName.get(normalize(row.name));
    const run = player && runs.get(player.id);
    if (club) {
      if (!run || player.team === club || (nbaGameLogData[player.id] ?? []).some(([, date, team]) =>
        date >= cutoff + '-09-01' && (aliases[team] ?? team) === club)) return row;
      withArchive.add(player.id);
      return { ...row, value: row.value + run.value, href: run.href, date: 'Basketball Reference + franchise', continued: true };
    }
    const archived = run && archivedCareerRecord(player, stat, run);
    if (archived) {
      withArchive.add(player.id);
      return archived;
    }
    return row;
  });
  const ranks = rows => {
    const sorted = [...rows].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    let rank = 0;
    return sorted.slice(0, 25).map((row, index) => {
      if (!index || sorted[index - 1].value !== row.value) rank = index + 1;
      const link = row.href ?? row.source;
      return [rank, link ? '<a href="' + e(link) + '">' + e(row.name) + '</a>' : e(row.name), row.value.toLocaleString(),
        e(row.date), row.archived ? (row.source ? '<a href="' + e(row.source) + '">NBA archive</a>' : 'NBA archive') + (row.simulated ? ' + franchise' : '')
          : row.continued ? '<a href="' + e(row.source) + '">NBA baseline</a> + sim' : row.simulated ? 'Franchise' : row.bref ? 'Basketball Reference' : 'Verified NBA'];
    });
  };
  const runOnly = view === 'career' ? simulated.filter(row => !withArchive.has(row.id) && !combined.some(entry => entry.continued && entry.id === row.id)) : [];
  const baseline = published ? { name: published[1], value: published[2], date: 'Published NBA team leader', source: teamReference.source } : null;
  const merged = view === 'career' ? [...rankedCareer, ...archivedCareer, ...runOnly, ...(baseline ? [baseline] : [])]
    .sort((a, b) => b.value - a.value).filter((row, index, rows) =>
      rows.findIndex(item => normalize(item.name) === normalize(row.name)) === index)
    : combined.concat(archivedPerformances, simulated);
  const best = [...merged].sort((a, b) => b.value - a.value)[0];
  const title = club ? teams.get(club).name + ' records' : 'NBA records';
  const headers = ['Rank', 'Player', 'Value', 'Date / season', 'Source'];
  operationsPage(title, 'Cycle through four record types and ten statistics. Franchise results update as games finish.', `
    <div class="panel toolbar"><label>Scope <select id="record-club">
      <option value="">NBA</option>${league.teams.map(team => '<option value="' + e(team.code) + '"' + (team.code === club ? ' selected' : '') + '>' + e(team.name) + '</option>').join('')}
    </select></label><label>Statistic <select id="record-stat">${Object.entries(recordStats).map(([key, label]) =>
      '<option value="' + key + '"' + (key === stat ? ' selected' : '') + '>' + e(label) + '</option>').join('')}</select></label></div>
    <div class="player-card-tabs" aria-label="Record type">${Object.entries(recordViews).map(([key, label]) =>
      '<button type="button" data-record-view="' + key + '" aria-pressed="' + (key === view) + '">' + e(label) + '</button>').join('')}</div>
    <div class="trade-sides records-board"><section class="trade-side facility-card">
      <div class="eyebrow">${e(recordViews[view])} · ${e(recordStats[stat])}</div>
      ${club ? logo(teams.get(club)) : ''}
      <h2>${e(best?.name ?? 'No record rows yet')}</h2>
      ${best ? '<strong class="records-value">' + best.value.toLocaleString() + '</strong><p>' + e(best.date) + '</p>' : ''}
    </section><section class="trade-side">
      <h3>Top 25 available entries</h3>${castTable(headers, ranks(merged))}
    </section></div>
    <p class="note">Historical coverage varies by stat and team. Team career pages publish ten historical leaders per stat. The ranking can include additional franchise entries. Career rows identify whether franchise games are included.
      <a href="https://www.nba.com/news/history-all-time-records">NBA official record archive →</a>
      · <a href="#nba-history">League history →</a></p>`);
  document.querySelector('#record-club').addEventListener('change', event => { location.hash = route(event.target.value, view, stat); });
  document.querySelector('#record-stat').addEventListener('change', event => { location.hash = route(club, view, event.target.value); });
  document.querySelectorAll('[data-record-view]').forEach(button => button.addEventListener('click', () => {
    location.hash = route(club, button.dataset.recordView, stat);
  }));
}


function nbaHistoryScreen(view, selectedTeam) {
  const save = seasonSim.load();
  const code = Object.hasOwn(nbaTeamHistory, selectedTeam) ? selectedTeam : save?.team ?? 'MIA';
  const team = teams.get(code);
  const entry = nbaTeamHistory[code];
  const labels = { champions: 'Past champions', mvp: 'MVP', rookie: 'Rookie of the Year', dpoy: 'Defensive Player of the Year',
    sixthMan: 'Sixth Man', mostImproved: 'Most Improved', coach: 'Coach of the Year', executive: 'Executive of the Year',
    finals: 'Finals MVP', clutch: 'Clutch Player of the Year', sportsmanship: 'Sportsmanship Award',
    teammate: 'Teammate of the Year', hustle: 'Hustle Award', team: 'Team history', jerseys: 'Retired jerseys' };
  const mode = Object.hasOwn(labels, view) ? view : 'champions';
  const archive = nbaLeagueHistory[mode];
  const finalsMvp = new Map(nbaLeagueHistory.finals.rows);
  const teamNames = { ATL: ['St. Louis Hawks'], GSW: ['Philadelphia Warriors', 'San Francisco Warriors'],
    LAL: ['Minneapolis Lakers'], PHI: ['Syracuse Nationals'], OKC: ['Seattle SuperSonics'],
    SAC: ['Rochester Royals'], WAS: ['Washington Bullets'], UTA: ['New Orleans Jazz'], DET: ['Ft. Wayne Pistons'],
    BKN: ['New Jersey Nets'] };
  const finalsRows = nbaLeagueHistory.champions.rows;
  const names = [team.name, ...(teamNames[code] ?? [])];
  const teamFinals = finalsRows.filter(([year, result]) => {
    const participants = result.replace(/\s*,\s*\d+-\d+.*$/, '').split(' def. ');
    return participants.some(name => names.includes(name) || code === 'WAS' && name === 'Baltimore Bullets' && Number(year.slice(0, 4)) >= 1963);
  });
  const titles = teamFinals.filter(([, result]) => names.some(name => result.startsWith(name + ' def.'))).length;
  const teamPicker = ['team', 'jerseys'].includes(mode) ? `<div class="toolbar"><label>Team <select id="history-team">
    ${league.teams.map(team => `<option value="${e(team.code)}" ${team.code === code ? 'selected' : ''}>${e(team.name)}</option>`).join('')}
    </select></label><a href="${e(entry.source)}">Official NBA team profile →</a><a href="#records/${e(code)}">Team records →</a></div>` : '';
  const series = rows => castTable(['Season', 'Finals result', 'Finals MVP'], rows.map(([year, result]) =>
    [e(year), e(result), e(finalsMvp.get(year)?.split(',')[0])]));
  const jerseySave = seasonSim.load();
  const franchiseJerseys = Object.entries(jerseySave?.retiredJerseys?.[code] ?? {});
  const russell = 'https://pr.nba.com/bill-russells-no-6-jersey-to-be-retired-throughout-nba/';
  const content = mode === 'champions' ? series(finalsRows)
    : mode === 'team' ? `<div class="trade-title">${logo(team)}<h2>${e(team.name)}</h2></div>
        <dl class="panel bio"><div><dt>NBA championships</dt><dd>${titles}</dd></div>
        <div><dt>NBA Finals appearances</dt><dd>${teamFinals.length}</dd></div></dl>
        <p class="note">Finals appearances include the franchise’s previous names where applicable. Team names reflect each series.</p>${series(teamFinals)}`
      : mode === 'jerseys' ? castTable(['Number', 'Honoree', 'Seasons listed', 'Induction', 'Source', 'Action'], [
        ...entry.jerseys.filter(([number, name]) => code === 'BOS' || number !== '6' || name !== 'Bill Russell'),
        ...(code === 'BOS' && entry.jerseys.some(([number, name]) => number === '6' && name === 'Bill Russell') ? []
          : [['6', 'Bill Russell', 'League-wide retirement', '2022', russell]]),
      ].sort(([a], [b]) => Number(a.split(',')[0]) - Number(b.split(',')[0])).map(([number, name, years, date, source]) =>
        [e(number), e(name), e(years || '—'), e(date), `<a href="${e(source ?? entry.source)}">NBA source</a>`,
          String(number).split(',').map(part => part.trim()).map(part =>
            jerseySave?.unretiredHistoricalJerseys?.[code]?.[part] ? `#${e(part)} active in this save`
            : jerseySave?.team === code && part !== '6' && relationships.jerseyNumber(part) !== null
              ? `<button data-unretire-jersey="${e(part)}" data-historical="true">Unretire #${e(part)}</button>` : '').filter(Boolean).join(' ') || '—']))
        + (franchiseJerseys.length ? '<h3>Franchise save retirements</h3>' + castTable(['Number', 'Honoree', 'Season', 'Action'],
          franchiseJerseys.map(([number, entry]) => [e(number), e(entry.name), seasonLabel(entry.year),
            jerseySave.team === code ? `<button data-unretire-jersey="${e(number)}">Unretire</button>` : '—'])) : '')
        + '<p class="note">The team listings reflect published NBA profile entries and may omit recent ceremonies.</p>'
        : castTable(['Season', 'Recipient and team'], archive.rows.map(([year, winner]) => [e(year), e(winner)]));
  operationsPage('NBA league history', 'Historical NBA results through 2025–26.', `
    <div class="toolbar"><label>History view <select id="history-view">${Object.entries(labels).map(([key, label]) =>
      `<option value="${key}" ${key === mode ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></label>
      <a href="#league-news/history">Franchise award history →</a><a href="#records">NBA records →</a></div>
    ${teamPicker}<h2>${e(labels[mode])}</h2>${content}
    <p class="note"><a href="${e(archive?.source ?? nbaLeagueHistory.champions.source)}">Official NBA archive →</a>
    · <a href="https://www.nba.com/news/history-all-time-awards">All NBA award categories →</a></p>`);
  document.querySelectorAll('[data-unretire-jersey]').forEach(button => button.addEventListener('click', () => {
    seasonSim.unretireJersey(jerseySave, button.dataset.unretireJersey, button.dataset.historical === 'true');
    render();
  }));
  document.querySelector('#history-view').addEventListener('change', event => { location.hash = '#nba-history/' + event.target.value + '/' + code; });
  document.querySelector('#history-team')?.addEventListener('change', event => { location.hash = '#nba-history/' + mode + '/' + event.target.value; });
}

function finderOffers(save, state, code, selected, browse = false) {
  const picks = new Map(draftOps.futurePicks(save).map(pick => [pick.key, pick]));
  const reports = new Map();
  const contractsFor = team => {
    if (!reports.has(team)) reports.set(team, teamFinance.report(save, state, team).contracts);
    return reports.get(team);
  };
  const market = tradeValues.market(save, state, contractsFor);
  const action = (partner, send, receive) => ({ type: 'trade', otherTeam: partner, send: send.filter(id => !picks.has(id)),
    receive: receive.filter(id => !picks.has(id)), sendPicks: send.filter(id => picks.has(id)), receivePicks: receive.filter(id => picks.has(id)) });
  const hunting = code !== save.team;
  const candidates = hunting ? [save.team] : [...teams.keys()].filter(team => team !== save.team);
  const offers = [];
  for (const candidate of candidates) {
    const partner = hunting ? code : candidate;
    const value = id => market.valueFor(id, partner);
    const teamSum = ids => market.total(ids, partner);
    const target = teamSum(selected);
    const contracts = contractsFor(candidate);
    const assets = [...state.rosters.get(candidate).filter(player => !contracts.get(player.id)?.deal.noTrade).map(player => player.id),
      ...[...picks.values()].filter(pick => pick.owner === candidate).map(pick => pick.key)];
    const packages = assets.flatMap((id, index) => [[id], ...assets.slice(index + 1).map(other => [id, other])])
      .map(ids => ({ ids, total: teamSum(ids), last: assets.indexOf(ids.at(-1)) }));
    const byDistance = (a, b) => Math.abs(a.total - target) - Math.abs(b.total - target);
    if (browse) {
      // Keep a bounded frontier so a league-wide search can consider larger packages.
      let frontier = packages.filter(item => item.ids.length === 2);
      const assetValues = assets.map(value);
      for (let size = 3; size <= 6; size++) {
        frontier = frontier.flatMap(item => assets.slice(item.last + 1).map((id, offset) => ({
          ids: [...item.ids, id], total: item.total + assetValues[item.last + offset + 1], last: item.last + offset + 1,
        }))).sort(byDistance).slice(0, 96);
        packages.push(...frontier);
      }
    }
    packages.sort(byDistance);
    let count = 0;
    let checked = 0;
    for (const { ids, total } of packages) {
      if (Math.abs(total - target) > target * 0.35) break;
      const send = hunting ? ids : selected;
      const receive = hunting ? selected : ids;
      if (!market.accepts(send, receive, partner, true) || browse && !market.accepts(receive, send, save.team)) continue;
      if (++checked > (browse ? 48 : 10)) break;
      try {
        teamFinance.addAction(save, state, action(partner, send, receive));
        offers.push({ partner, send, receive, distance: Math.abs(teamSum(send) - teamSum(receive)) });
        if (++count >= (hunting ? browse ? 8 : 4 : 1)) break;
      } catch {
        // Invalid roster, budget, value or pick combinations are omitted.
      }
    }
  }
  return offers.sort((a, b) => a.distance - b.distance);
}

function tradeFinder(save, requestedTeam, assetList) {
  if (save.market?.open || save.day > seasonSim.tradeDeadlineFor(save) || save.simcast) {
    operationsPage('Trade Finder', 'Trade Finder is available during the regular-season trade window.', '<p><a href="#transactions">Open trade board →</a></p>');
    return;
  }
  const state = seasonSim.history(save);
  const code = teams.has(requestedTeam) ? requestedTeam : save.team;
  const contracts = teamFinance.report(save, state, code).contracts;
  const players = [...state.rosters.get(code)].sort((a, b) => state.playerOveralls.get(b.id) - state.playerOveralls.get(a.id));
  const picks = draftOps.futurePicks(save).filter(pick => pick.owner === code);
  const permitted = new Set([...players.filter(player => !contracts.get(player.id)?.deal.noTrade).map(player => player.id),
    ...picks.map(pick => pick.key)]);
  const selected = [...new Set((assetList ?? '').split(','))].filter(id => permitted.has(id)).slice(0, 6);
  const mark = (id, label) => '<input type="checkbox" name="asset" value="' + e(id) + '" aria-label="' + e(label) + '"'
    + (selected.includes(id) ? ' checked' : '') + (permitted.has(id) ? '' : ' disabled') + '>';
  const offers = selected.length ? finderOffers(save, state, code, selected, true) : [];
  const payByTeam = new Map([[code, contracts]]);
  const pack = (team, assets) => {
    if (!payByTeam.has(team)) payByTeam.set(team, teamFinance.report(save, state, team).contracts);
    const club = teams.get(team);
    return `<section class="trade-side finder-package"><header>${logo(club)}<strong>${e(club.name)} sends</strong></header>
      ${assets.map(id => {
        const player = state.profiles.get(id);
        const contracts = payByTeam.get(team);
        if (!player) return `<div class="trade-asset"><span><strong>${e(draftOps.pickLabel(id))}</strong><small>Draft pick</small></span></div>`;
        const pay = teamFinance.tradePayroll(contracts, [id], save.day);
        return `<div class="trade-asset">${player.photo ? `<img src="${e(player.photo)}" alt="">` : ''}
          <span><strong><a href="#player/${e(id)}">${e(player.name)}</a></strong>
          <small>${e(playerTools.positionText(player))} · ${formatStat(state.playerOveralls.get(id), 2)} OVR · ${contracts.has(id) ? money(pay.guaranteed) + ' guaranteed left' : 'Salary unavailable'}
          ${pay.conditional ? ' · ' + money(pay.conditional) + ' conditional' : ''}</small></span></div>`;
      }).join('')}</section>`;
  };
  const offerCard = index => {
    const offer = offers[index];
    return `<div class="trade-sides">${pack(save.team, offer.send)}${pack(offer.partner, offer.receive)}</div>
      <footer class="trade-controls"><strong>${e(teams.get(offer.partner).name)}</strong>
      <a class="primary-link" href="#transactions/${e(offer.partner)}/${e(offer.send.join(','))}/${e(offer.receive.join(','))}">Review on trade board →</a></footer>`;
  };
  operationsPage('Trade Finder', code === save.team ? 'Shop your assets across the league.' : 'See what this team would take for its selected assets.', `
    <div class="trade-controls"><label>Browse roster <select id="finder-team">${league.teams.map(team => '<option value="' + e(team.code) + '"'
      + (team.code === code ? ' selected' : '') + '>' + e(team.name) + '</option>').join('')}</select></label><a href="#transactions">Trade board →</a></div>
    ${selected.length ? `<h2>Trade Finder results</h2>${offers.length ? `<section class="trade-board">
      <div class="trade-controls"><button type="button" id="finder-previous" disabled>Previous offer</button>
      <strong id="finder-position" aria-live="polite">Offer 1 of ${offers.length}</strong>
      <button type="button" id="finder-next" ${offers.length < 2 ? 'disabled' : ''}>Next offer</button></div>
      <div id="finder-offer">${offerCard(0)}</div></section>` : '<p>No qualifying offers were found for this package.</p>'}` : ''}
    <form id="finder-assets"><h2>${e(teams.get(code).name)} assets</h2>
    <p id="finder-count" aria-live="polite">${selected.length} of 6 selected</p>
    ${castTable(['Player', 'POS', 'OVR', 'Guaranteed left', 'Conditional salary', 'Select'], players.map(player => {
      const contract = contracts.get(player.id);
      const pay = teamFinance.tradePayroll(contracts, [player.id], save.day);
      return ['<a href="#player/' + e(player.id) + '">' + e(player.name) + '</a>', e(playerTools.positionText(player)),
        formatStat(state.playerOveralls.get(player.id), 2), contract ? money(pay.guaranteed) : '—', contract ? money(pay.conditional) : '—',
        contract?.deal.noTrade ? 'No-trade clause' : mark(player.id, player.name)];
    }))}
    <details class="panel facility-card" ${picks.some(pick => selected.includes(pick.key)) ? 'open' : ''}><summary>Draft picks</summary>${castTable(['Pick', 'Select'], picks.map(pick =>
      [e(draftOps.pickLabel(pick.key)), mark(pick.key, draftOps.pickLabel(pick.key))]))}</details>
    <button type="submit">Find offers</button><p id="finder-feedback" role="status"></p></form>`);
  document.querySelector('#finder-team').addEventListener('change', event => { location.hash = '#trade-finder/' + event.target.value; });
  if (offers.length) {
    let index = 0;
    const previous = document.querySelector('#finder-previous');
    const next = document.querySelector('#finder-next');
    const move = step => {
      index += step;
      previous.disabled = index === 0;
      next.disabled = index === offers.length - 1;
      document.querySelector('#finder-position').textContent = 'Offer ' + (index + 1) + ' of ' + offers.length;
      document.querySelector('#finder-offer').innerHTML = offerCard(index);
    };
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
  }
  const checkboxes = [...document.querySelectorAll('#finder-assets input[name="asset"]:enabled')];
  const updateCount = () => {
    const count = checkboxes.filter(input => input.checked).length;
    document.querySelector('#finder-count').textContent = count + ' of 6 selected';
    for (const input of checkboxes) input.disabled = count >= 6 && !input.checked;
  };
  for (const input of checkboxes) input.addEventListener('change', updateCount);
  updateCount();
  document.querySelector('#finder-assets').addEventListener('submit', event => {
    event.preventDefault();
    const assets = new FormData(event.currentTarget).getAll('asset');
    if (!assets.length || assets.length > 6) {
      document.querySelector('#finder-feedback').textContent = 'Choose one to six assets.';
      return;
    }
    location.hash = '#trade-finder/' + code + '/' + assets.join(',');
  });
}

