const postseason = (() => {
  const rounds = ['First round', 'Conference semifinals', 'Conference finals', 'NBA Finals'];
  const playInDays = 4;
  const maxDays = 56 + playInDays;
  const rank = (a, b, records) => records[b].wins - records[a].wins || a.localeCompare(b);
  const teams = new Map(league.teams.map(team => [team.code, team]));
  const conferences = ['East', 'West'];
  const group = (items, score) => {
    const groups = new Map();
    for (const item of items) {
      const key = score(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups.keys()].sort((a, b) => b - a).map(key => groups.get(key));
  };

  function nbaStandings(records, games, seed) {
    const codes = [...teams.keys()];
    const own = (code, key) => teams.get(code)[key];
    const pct = (wins, losses) => wins / (wins + losses || 1);
    const overall = code => pct(records[code].wins, records[code].losses);
    const versus = new Map(codes.map(code => [code, []]));
    for (const game of games) {
      versus.get(game.home).push({ opponent: game.away, diff: game.homeScore - game.awayScore });
      versus.get(game.away).push({ opponent: game.home, diff: game.awayScore - game.homeScore });
    }
    const against = (code, filter) => {
      const matches = versus.get(code).filter(game => filter(game.opponent));
      return matches.filter(game => game.diff > 0).length / (matches.length || 1);
    };
    const conferenceTeams = conference => codes.filter(code => own(code, 'conference') === conference);
    const contenders = new Set(conferences.flatMap(conference => {
      const sorted = conferenceTeams(conference).sort((a, b) => overall(b) - overall(a));
      return sorted.filter(code => overall(code) >= overall(sorted[9]));
    }));
    const divisionWinners = new Set();
    const draw = [...codes];
    let random = seed >>> 0;
    for (let i = draw.length - 1; i > 0; i--) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const j = random % (i + 1);
      [draw[i], draw[j]] = [draw[j], draw[i]];
    }

    function breakTie(tied, divisionOnly = false) {
      if (tied.length < 2) return tied;
      const head = code => against(code, opponent => tied.includes(opponent));
      const divisionWinner = code => Number(divisionWinners.has(code));
      const division = code => against(code, opponent => own(opponent, 'division') === own(code, 'division'));
      const conference = code => against(code, opponent => own(opponent, 'conference') === own(code, 'conference'));
      const eligible = same => code => against(code, opponent => contenders.has(opponent)
        && (own(opponent, 'conference') === own(code, 'conference')) === same);
      const criteria = tied.length === 2
        ? [head, ...(divisionOnly ? [] : [divisionWinner])] : [...(divisionOnly ? [] : [divisionWinner]), head];
      if (tied.every(code => own(code, 'division') === own(tied[0], 'division'))) criteria.push(division);
      criteria.push(conference, eligible(true));
      if (tied.length === 2) criteria.push(eligible(false));
      criteria.push(code => versus.get(code).reduce((sum, game) => sum + game.diff, 0));
      for (const criterion of criteria) {
        const split = group(tied, criterion);
        if (split.length > 1) return split.flatMap(remaining => breakTie(remaining, divisionOnly));
      }
      return draw.filter(code => tied.includes(code));
    }
    for (const division of new Set(league.teams.map(team => team.division))) {
      const tied = group(codes.filter(code => own(code, 'division') === division), overall)[0];
      divisionWinners.add(breakTie(tied, true)[0]);
    }
    const order = Object.fromEntries(conferences.map(conference =>
      [conference, group(conferenceTeams(conference), overall).flatMap(tied => breakTie(tied))]));
    return { order, homeOrder: (a, b) => overall(b) - overall(a) || (breakTie([a, b])[0] === a ? -1 : 1) };
  }

  function firstRound(qualified, records, bracket) {
    return conferences.flatMap(conference => {
      const clubs = qualified[conference];
      clubs.forEach((code, index) => { bracket.seeds[code] = index + 1; });
      return [[0, 7], [3, 4], [1, 6], [2, 5]].map(([a, b]) =>
        matchup(clubs[a], clubs[b], records, conference, bracket.homeOrder));
    });
  }

  function bracket(records, games, seed, revised, seriesLengths = {}) {
    const seeds = {};
    const state = { seeds, rounds: [], champion: null, seriesLengths };
    if (!revised) {
      const order = Object.fromEntries(conferences.map(conference => [conference, league.teams.filter(team =>
        team.conference === conference).map(team => team.code).sort((a, b) => rank(a, b, records)).slice(0, 8)]));
      state.rounds.push(firstRound(order, records, state));
      return state;
    }
    const { order, homeOrder } = nbaStandings(records, games, seed);
    state.order = order;
    state.homeOrder = homeOrder;
    state.playIn = conferences.map(conference => {
      const [, , , , , , seven, eight, nine, ten] = order[conference];
      return { conference, games: [
        { home: seven, away: eight, label: '7 vs. 8', offset: 0 },
        { home: nine, away: ten, label: '9 vs. 10', offset: 1 },
      ] };
    });
    return state;
  }

  function playInSlate(bracket, offset) {
    return bracket.playIn.flatMap(({ games }) => games.filter(game => game.offset === offset)
      .map(game => [game.home, game.away]));
  }

  function recordPlayIn(bracket, results, records) {
    if (!results.length) return;
    const qualified = {};
    for (const entry of bracket.playIn) {
      const [high, low] = entry.games;
      for (const match of entry.games) {
        const result = results.find(game => game.home === match.home && game.away === match.away);
        if (!result) continue;
        match.result = result;
        match.winner = result.homeScore > result.awayScore ? result.home : result.away;
      }
      if (high.winner && low.winner && entry.games.length === 2) {
        entry.games.push({ home: high.winner === high.home ? high.away : high.home, away: low.winner,
          label: 'Final game for No. 8', offset: 3 });
      }
      if (entry.games[2]?.winner) qualified[entry.conference] =
        [...bracket.order[entry.conference].slice(0, 6), high.winner, entry.games[2].winner];
    }
    if (Object.keys(qualified).length === 2) bracket.rounds.push(firstRound(qualified, records, bracket));
  }

  function matchup(a, b, records, conference, homeOrder) {
    const [high, low] = [a, b].sort(homeOrder ?? ((a, b) => rank(a, b, records)));
    return { high, low, highWins: 0, lowWins: 0, winner: null, conference };
  }

  function slate(bracket, offset) {
    if (offset < 0 || offset % 2 !== 0 || bracket.champion) return [];
    const round = Math.floor(offset / 14);
    const series = bracket.rounds[round] ?? [];
    const length = bracket.seriesLengths?.[round] ?? 7;
    const homeGames = { 1: [0], 3: [0, 2], 5: [0, 1, 4], 7: [0, 1, 4, 6] }[length];
    return series.filter(match => !match.winner).map(match => {
      const game = match.highWins + match.lowWins;
      return homeGames.includes(game) ? [match.high, match.low] : [match.low, match.high];
    });
  }

  function record(bracket, games, offset, records) {
    const round = Math.floor(offset / 14);
    const series = bracket.rounds[round];
    if (!series || !games.length) return;
    const winsNeeded = ((bracket.seriesLengths?.[round] ?? 7) + 1) / 2;
    for (const game of games) {
      const match = series.find(entry => [entry.high, entry.low].includes(game.home));
      const winner = game.homeScore > game.awayScore ? game.home : game.away;
      if (winner === match.high) match.highWins++;
      else match.lowWins++;
      if (match.highWins === winsNeeded || match.lowWins === winsNeeded) match.winner = winner;
    }
    if (!series.every(match => match.winner)) return;
    if (round === 3) {
      bracket.champion = series[0].winner;
      return;
    }
    bracket.rounds.push(series.filter((_, i) => i % 2 === 0).map((match, i) =>
      matchup(match.winner, series[i * 2 + 1].winner, records, round === 2 ? 'Finals' : match.conference, bracket.homeOrder)));
  }

  function awards(averages, benchGames, records, owners) {
    const candidates = [...averages].filter(([, stats]) => stats.GP >= 40);
    const rankBy = score => [...candidates].sort((a, b) => score(b[1], b[0]) - score(a[1], a[0]) || a[0].localeCompare(b[0]));
    const defense = stats => stats.STL * 3 + stats.BLK * 3 + stats.DREB * 0.45;
    const impact = (stats, id) => stats.PTS + stats.AST * 1.5 + stats.REB * 0.75 + defense(stats) * 0.5
      - stats.TO + (records[owners.get(id)]?.wins ?? 0) * 0.06;
    const overall = rankBy(impact);
    const allStar = ['East', 'West'].flatMap(conference => {
      const codes = new Set(league.teams.filter(team => team.conference === conference).map(team => team.code));
      return overall.filter(([id]) => codes.has(owners.get(id))).slice(0, 12).map(([id]) => id);
    });
    const defenders = rankBy(defense);
    const sixth = overall.find(([id, stats]) => (benchGames.get(id) ?? 0) > stats.GP / 2);
    return { mvp: overall.slice(0, 1).map(([id]) => id), allNBA: overall.slice(0, 15).map(([id]) => id),
      dpoy: defenders.slice(0, 1).map(([id]) => id), allDefense: defenders.slice(0, 10).map(([id]) => id),
      sixthMan: sixth ? [sixth[0]] : [], allStar };
  }

  function roundsWon(bracket, code) {
    return bracket?.rounds.flat().filter(match => match.winner === code).length ?? 0;
  }

  return { rounds, maxDays, playInDays, bracket, slate, record, playInSlate, recordPlayIn, awards, roundsWon };
})();

