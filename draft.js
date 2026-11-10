// Projected prospects from the November 5, 2026 ESPN board. Ratings are simulated.
const draftOps = (() => {
  const source = 'https://abc11.com/post/2027-nba-draft-big-board-rankings-top-100-prospects/20017483/';
  const projected = [
    ["Tyran Stokes","SF/PG","Kansas","19.1"],
    ["Stefan Joksimovic","PG","Baskonia","18.0"],
    ["Bruce Branch III","SG/SF","BYU","18.0"],
    ["Jordan Smith Jr.","SG/PG","Arkansas","19.1"],
    ["Caleb Holt","SG/PG","Arizona","18.9"],
    ["Quentin Coleman","SG/PG","Illinois","18.3"],
    ["Motiejus Krivas","C","Arizona","21.9"],
    ["Braylon Mullins","SG","UConn","20.5"],
    ["Thomas Haugh","SF/PF","Florida","23.3"],
    ["Patrick Ngongba II","C","Duke","20.7"],
    ["Ivan Kharchenkov","SF","Arizona","20.1"],
    ["Obinna Ekezie Jr.","C","Louisville","18.5"],
    ["Austin Goosby","SG/PG","Texas","19.0"],
    ["Malachi Moreno","C","Kentucky","20.0"],
    ["JJ Andrews","SG/SF","Arkansas","18.7"],
    ["Anthony Thompson","SF/PF","Ohio State","18.2"],
    ["Sayon Keita","C","North Carolina","18.7"],
    ["Dame Sarr","SG/SF","Duke","20.4"],
    ["Amari Allen","SF","Alabama","20.8"],
    ["Alijah Arenas","SG","USC","19.6"],
    ["Jason Crowe Jr.","SG/PG","Missouri","18.3"],
    ["Alex Condon","PF/C","Florida","22.3"],
    ["Caleb Gaskins","PF/SF","Miami","18.2"],
    ["Brandon McCoy","SG","Michigan","19.0"],
    ["Miikka Muurinen","PF","Arkansas","19.7"],
    ["Colben Landrew","SG/SF","UConn","18.7"],
    ["Christian Collins","SF","USC","19.1"],
    ["Hugo Yimga-Moukouri","SF","Nanterre","18.3"],
    ["Luigi Suigo","C","Villanova","19.8"],
    ["Tyler Tanner","PG","Vanderbilt","20.8"],
    ["Cameron Williams","PF","Duke","19.0"],
    ["David Mirkovic","PF/SF","Illinois","20.8"],
    ["Abdou Toure","SG","Arkansas","19.2"],
    ["Miles Sadler","PG","West Virginia","19.3"],
    ["Dash Daniels","PG/SG","South East Melbourne","18.9"],
    ["Billy Richmond III","SG/SF","Arkansas","20.6"],
    ["Baba Oladotun","SG/SF","Maryland","17.9"],
    ["Matt Able","SG","North Carolina","20.3"],
    ["Trey McKenney","SG","Michigan","20.2"],
    ["Najai Hines","C","UConn","19.6"],
    ["Milan Momcilovic","PF","Kentucky","22.1"],
    ["Juke Harris","SG","Tennessee","21.3"],
    ["Jeremy Fears Jr.","PG","Michigan State","21.5"],
    ["Tounde Yessoufou","SF","St. John's","20.5"],
    ["Davis Fogle","SG","Gonzaga","20.4"],
    ["Cheickh Niang","SG","Trento","18.1"],
    ["Rueben Chinyelu","C","Florida","23.1"],
    ["Shelton Henderson","SG/SF","Miami","20.0"],
    ["Amare Bynum","PF","Ohio State","19.8"],
    ["Nik Khamenia","SF/PF","UConn","19.9"],
    ["Miles Byrd","SG/SF","Providence","22.3"],
    ["Joseph Tugler","PF/C","Houston","21.8"],
    ["Moustapha Thiam","C","Michigan","20.7"],
    ["Eric Reibe","PF/C","USC","20.4"],
    ["Cameron Houindo","PF","Cedevita Olimpija","18.8"],
    ["Michael Ruzic","PF/C","LSU","20.1"],
    ["Stefan Vaaks","SG/PG","Illinois","21.5"],
    ["Pryce Sandfort","SG/SF","Nebraska","21.8"],
    ["Andrej Stojakovic","SG/SF","Illinois","22.2"],
    ["Paul McNeil Jr.","SG","NC State","20.5"],
    ["David Punch","F","Texas","20.3"],
    ["Matas Vokietaitis","C","Texas","22.0"],
    ["Johann Grunloh","C","Virginia","21.2"],
    ["Cayden Boozer","PG","Duke","19.3"],
    ["Flory Bidunga","C","Louisville","21.5"],
    ["John Blackwell","SG","Duke","21.9"],
    ["Neo Avdalas","SF","North Carolina","20.7"],
    ["Daniel Jacobsen","C","Purdue","20.5"],
    ["Massamba Diop","C","Gonzaga","21.8"],
    ["Jacob Cofie","PF","USC","20.7"],
    ["Xavier Edmonds","PF","TCU","22.5"],
    ["Nolan Winter","PF/C","Wisconsin","22.0"],
    ["Jaden Toombs","C","SMU","19.4"],
    ["Sam Lewis","SG","Virginia","21.8"],
    ["Collin Chandler","SG","BYU","22.7"],
    ["Jayden Ross","SG/SF","UConn","22.3"],
    ["Dillan Shaw","SG/SF","Arizona State","20.6"],
    ["Bryson Tiller","PF","Missouri","21.0"],
    ["KJ Lewis","SG","USC","22.3"],
    ["Tomislav Ivisic","C","Illinois","23.2"],
    ["Zvonimir Ivisic","C","Illinois","23.2"],
    ["Pharrel Payne","C","Maryland","22.2"],
    ["Tre Singleton","SF","Iowa State","20.0"],
    ["Jalen Haralson","SF","Tennessee","19.5"],
    ["Elliot Cadeau","PG","Michigan","22.2"],
    ["Tahaad Pettiford","PG","Auburn","21.3"],
    ["Amani Hansberry","PF","Virginia Tech","22.1"],
    ["Robert Wright III","PG","BYU","21.0"],
    ["Nigel James Jr.","PG","Marquette","20.8"],
    ["Kanon Catchings","SF","Georgia","21.2"],
    ["Kayden Mingo","PG/SG","Baylor","19.7"],
    ["Braden Huff","PF/C","Gonzaga","23.2"],
    ["Mouhamed Faye","PF/C","Paris Basket","21.7"],
    ["Pavle Backo","C","OKK Beograd","19.3"],
    ["Marc-Owen Fodzo Dada","PG/SG","ASVEL","20.0"],
    ["JT Toppin","PF/C","Texas Tech","21.4"],
    ["Aiden Tobiason","SG/SF","Syracuse","20.5"],
    ["Mason Falslev","","Utah State","25.0"],
    ["Kwame Evans Jr.","PF","Villanova","22.3"],
    ["Paulius Murauskas","PF","Arizona State","22.7"]
  ];
  const nameParts = league.players.map(player => player.name.trim().split(/\s+/));
  const first = [...new Set(nameParts.map(parts => parts[0]))];
  const suffix = /^(Jr\.?|Sr\.?|II|III|IV|V)$/i;
  const last = [...new Set(nameParts.filter(parts => parts.length > 1)
    .map(parts => parts.slice(1).filter(part => !suffix.test(part)).join(' ')).filter(Boolean))];
  const hash = value => [...value].reduce((total, ch) => (Math.imul(total, 31) + ch.charCodeAt(0)) >>> 0, 17);
  const draftYear = save => Number(seasonSim.date(0, save.year).slice(0, 4)) + 1;
  const pickKey = (year, round, origin) => `${year}-${round}-${origin}`;
  const pickLabel = key => {
    const [year, round, origin] = key.split('-');
    return `${year} ${round === '1' ? '1st' : '2nd'} round · ${origin}`;
  };
  function futurePicks(save) {
    return Array.from({ length: 7 }, (_, index) => draftYear(save) + index).flatMap(year =>
      [1, 2].flatMap(round => league.teams.map(({ code: origin }) => {
        const key = pickKey(year, round, origin);
        return { key, year, round, origin, owner: save.pickOwners?.[key] ?? origin };
      })));
  }
  function validateClass(save, draftClass) {
    const year = draftYear(save);
    if (draftClass?.year !== year || !Array.isArray(draftClass.players) || draftClass.players.length < 60 || draftClass.players.length > 150) {
      throw new Error('Provide 60–150 prospects for the ' + year + ' draft.');
    }
    const players = draftClass.players.map(row => {
      if (typeof row?.name !== 'string' || !row.name.trim() || row.name.length > 80 ||
        typeof row.origin !== 'string' || !row.origin.trim() || row.origin.length > 100 ||
        !Array.isArray(row.positions) || !row.positions.length || row.positions.length > 3 ||
        new Set(row.positions).size !== row.positions.length || !row.positions.every(pos => playerTools.positions.includes(pos)) ||
        !Number.isInteger(row.age) || row.age < 17 || row.age > 30 ||
        !Number.isFinite(row.rating) || row.rating < 25 || row.rating > 99) {
        throw new Error('Each prospect needs a name, origin, 1–3 distinct positions, age 17–30 and rating 25–99.');
      }
      return { name: row.name.trim(), origin: row.origin.trim(), positions: row.positions, age: row.age, rating: row.rating };
    });
    return { year, players };
  }
  const libraryYears = [2027, 2028, 2029, 2030, ...Object.keys(nbaDraftClasses).map(Number).filter(year => year <= 2026).reverse()];
  const defaultClassYear = year => year <= 2030 ? year : 1978 + (year - 2031) % 49;
  const selectedClassYear = save => save.draftClassSource?.year === draftYear(save)
    ? save.draftClassSource.sourceYear : defaultClassYear(draftYear(save));
  const classSource = year => year === 2027 ? source : year >= 2028
    ? 'https://nbadraftroom.com/' + year + '-nba-mock-draft/'
    : 'https://en.wikipedia.org/wiki/' + year + '_NBA_draft';
  const classLabel = year => year + (year <= 2026 ? ' historical class' : ' projected class');

  function prospects(save, classYear = selectedClassYear(save)) {
    const year = draftYear(save);
    if (save.customDraftClass?.year === year) {
      const sourceRows = new Map(prospects({ ...save, customDraftClass: null }, classYear).map(player => [player.name, player]));
      return save.customDraftClass.players.map((player, index) => {
        const id = 'draft-' + year + '-' + (index + 1);
        const notes = save.prospectNotes?.[id] ?? {};
        return { ...sourceRows.get(player.name), ...player, id, notes, rank: index + 1,
          rating: Math.min(99, player.rating + (notes.workouts ?? 0) * 0.08) };
      });
    }
    const namesFor = (pool, salt) => pool.map(name => ({ name, order: hash(year + '/' + salt + '/' + name) }))
      .sort((a, b) => a.order - b.order).map(entry => entry.name);
    const givenNames = namesFor(first, 'first');
    const surnames = namesFor(last, 'last');
    const priorEntrants = new Set((save.customPlayers ?? []).filter(player => player.id?.startsWith("draft-")).map(player => normalizedName(player.name)));
    const sourceBoard = classYear === 2027 ? projected : (nbaDraftClasses[classYear] ?? []).map(([pick, name, position, origin, age, honor]) =>
      [name, position, origin, age, pick, honor]);
    const sourced = classYear >= 2027 ? sourceBoard.filter(([name]) => !priorEntrants.has(normalizedName(name))) : sourceBoard;
    const rows = [...sourced, ...Array.from({ length: Math.max(0, (sourced.length ? 60 : 100) - sourced.length) }, (_, index) => {
      const salt = hash(year + '/' + index);
      return [givenNames[index] + ' ' + surnames[index],
        playerTools.positions[salt % 5], 'Simulated prospect', String(19 + salt % 4)];
    })];
    return rows.map(([name, position, origin, age, originalPick, honor], index) => {
      const id = 'draft-' + year + '-' + (index + 1);
      const notes = save.prospectNotes?.[id] ?? {};
      const slots = [...new Set(position.split(/\s*[/–-]\s*/).map(key => ({ G: 'SG', F: 'SF' })[key] ?? key)
        .filter(key => playerTools.positions.includes(key)))];
      const listed = index < sourced.length;
      const historical = listed && classYear <= 2026;
      const rating = 73 - index * 0.19 + hash(id) % 7 / 3 + (notes.workouts ?? 0) * 0.08;
      const modeledRating = historical ? rating + (honor ? 4 : 0) : rating;
      return { id, name, origin, age, positions: slots.length ? slots : position === 'F' ? ['SF'] : ['SG'],
        rating: modeledRating, notes, rank: index + 1,
        ...(listed ? { classYear, originalPick, honor } : {}) };
    });
  }
  function testing(prospect, privateWorkout = false) {
    const noise = stat => (hash(prospect.id + stat + privateWorkout) % 101 - 50) / 50;
    const rating = prospect.rating;
    return {
      sprint: (3.5 - (rating - 55) * 0.013 + noise('sprint') * 0.13).toFixed(2),
      agility: (12.6 - (rating - 55) * 0.065 + noise('agility') * 0.7).toFixed(2),
      vertical: (30 + (rating - 55) * 0.35 + noise('vertical') * 5).toFixed(1),
      midrange: Math.round(14 + (rating - 55) * 0.25 + noise('midrange') * 4),
      three: Math.round(11 + (rating - 55) * 0.28 + noise('three') * 5),
    };
  }

  const normalizedName = name => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const historicalPlayers = new Map(league.players.map(player => [normalizedName(player.name), player]));
  function historicalProfile(prospect) {
    if (!prospect.classYear || prospect.classYear > 2026) return null;
    const known = historicalPlayers.get(normalizedName(prospect.name));
    if (!known || nbaProfileData[known.id]?.draft?.year !== prospect.classYear) return null;
    const seasons = (nbaCareerData[known.id] ?? []).filter(row => row.stats?.GP >= 20);
    const impact = row => row.stats.PTS + row.stats.REB + row.stats.AST * 1.5 + row.stats.STL * 2 + row.stats.BLK * 2;
    const best = seasons.toSorted((a, b) => impact(b) - impact(a))[0];
    const rookie = seasons.find(row => Number(row.season.slice(0, 4)) === prospect.classYear);
    if (!best || !known.dob) return { known, rookie };
    const peak = Number(best.season.slice(0, 4)) - Number(known.dob.slice(0, 4));
    return { known, rookie, peakStart: Math.max(19, peak - 2), peakEnd: Math.min(44, peak + 2) };
  }

  function progression(prospect, historical = historicalProfile(prospect)) {
    const awards = historical?.known ? nbaProfileData[historical.known.id]?.awards ?? [] : [];
    const allNBA = awards.find(([name]) => name === 'All-NBA')?.[1] ?? 0;
    const elite = prospect.honor || allNBA >= 3;
    const topProjection = prospect.classYear >= 2027 && prospect.rank <= 10;
    return {
      peakStart: historical?.peakStart ?? (elite || topProjection ? 24 : 26),
      peakEnd: historical?.peakEnd ?? (elite ? 32 : topProjection ? 31 : 30),
      gain: elite ? 1.55 + Math.min(0.7, allNBA * 0.07) : topProjection ? 1.5 : 1.05,
      loss: elite ? 0.9 : 1.25,
    };
  }

  function player(prospect, pick) {
    const historical = historicalProfile(prospect);
    const rookieStats = historical?.rookie?.stats;
    const measuredRatings = rookieStats ? {
      FT: 25 + rookieStats['FT%'] * 0.75,
      '3PT': rookieStats['3PA'] >= 1 ? 25 + rookieStats['3P%'] * 1.5 : undefined,
      'Pass Acc': 45 + rookieStats.AST * 5,
      Block: 45 + rookieStats.BLK * 12,
      Steal: 45 + rookieStats.STL * 17,
      'Offensive Rebound': 45 + rookieStats.OREB * 10,
      'Defensive Rebound': 45 + rookieStats.DREB * 6,
    } : {};
    const age = historical?.known.dob
      ? Math.floor((Date.UTC(prospect.classYear, 5, 25) - Date.parse(historical.known.dob)) / (365.2425 * 86400000))
      : Math.floor(Number(prospect.age));

    const attributes = Object.fromEntries(playerTools.attributes.map(key => {
      const variation = (hash(prospect.id + key) % 19 - 9);
      const position = prospect.positions[0];
      const guard = ['PG', 'SG'].includes(position);
      const big = ['PF', 'C'].includes(position);
      const adjustment = ['Pass Acc', 'Handles', 'Speed', 'Agility', '3PT'].includes(key) ? (guard ? 7 : big ? -6 : 0)
        : ['Block', 'Interior Defense', 'Offensive Rebound', 'Defensive Rebound', 'Strength', 'Box Out'].includes(key) ? (big ? 7 : guard ? -6 : 0) : 0;
      const rating = Number.isFinite(measuredRatings[key]) ? measuredRatings[key] : prospect.rating + variation + adjustment;
      return [key, Math.max(25, Math.min(99, Math.round(rating * 100) / 100))];
    }));
    return { id: prospect.id, name: prospect.name, team: null, experience: 0,
      positions: prospect.positions, position: prospect.positions[0], college: prospect.origin,
      ...(prospect.age ? { listedAge: age + (Number(prospect.id.split('-')[1]) - 2027) * -1 } : {}),
      ...(prospect.notes.preference ? { preferredTeam: prospect.notes.preference } : {}),
      draft: { year: Number(prospect.id.split('-')[1]), pick: pick.number, team: pick.team },
      attributes, history: [], stats: null, status: 'Drafted rookie',
      ...(prospect.classYear ? { progression: progression(prospect, historical) } : {}) };
  }
  function lottery(save, state) {
    const reverse = league.teams.map(team => team.code).sort((a, b) => state.records[a].wins - state.records[b].wins
      || hash(save.seed + a) - hash(save.seed + b));
    const past = (save.draftHistory ?? []).slice(-2);
    const relegated = new Set(reverse.slice(0, 3));
    const weights = new Map();
    for (const conference of ['East','West']) {
      const ordered = state.bracket?.order?.[conference] ?? reverse.filter(code => league.teams.find(team => team.code === code).conference === conference).reverse();
      ordered.slice(8).forEach((code, index) => weights.set(code, index < 2 || relegated.has(code) ? 2 : 3));
      const opener = state.bracket?.playIn?.find(group => group.conference === conference)?.games[0];
      weights.set(opener?.winner ? (opener.winner === opener.home ? opener.away : opener.home) : ordered[7], 1);
    }
    if (save.equalLotteryOdds) for (const code of weights.keys()) weights.set(code, 1);
    const lastWinner = past.at(-1)?.[0] ?? (draftYear(save) === 2027 ? 'WAS' : '');
    const repeatTopFive = code => past.length >= 2 && past.every(order => order.slice(0, 5).includes(code));
    const firstWeight = code => code === lastWinner || repeatTopFive(code) ? 0 : weights.get(code);
    const total = [...weights.keys()].reduce((sum, code) => sum + firstWeight(code), 0);
    const odds = reverse.filter(code => weights.has(code)).map(origin => ({
      origin, chance: total ? firstWeight(origin) / total : weights.get(origin) / [...weights.values()].reduce((a, b) => a + b, 0),
      owner: save.pickOwners?.[pickKey(draftYear(save), 1, origin)] ?? origin
    }));
    let seed = save.seed;
    const random = max => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296 * max;
    };
    const drawn = [];
    const pool = [...weights.keys()];
    function optionsFor(pool, pick) {
      const remainingRelegated = pool.filter(code => relegated.has(code));
      const mustDraw = remainingRelegated.length >= 13 - pick && pick <= 12;
      const eligible = pool.filter(code => (!mustDraw || relegated.has(code))
        && (pick !== 1 || lastWinner !== code)
        && (pick > 5 || !repeatTopFive(code)));
      return eligible.length ? eligible : mustDraw ? remainingRelegated : pool;
    }
    while (pool.length) {
      const options = optionsFor(pool, drawn.length + 1);
      let ticket = random(options.reduce((sum, code) => sum + weights.get(code), 0));
      const selected = options.find(code => (ticket -= weights.get(code)) < 0);
      drawn.push(selected);
      pool.splice(pool.indexOf(selected), 1);
    }
    function nextOdds(revealed) {
      const suffix = drawn.slice(drawn.length - revealed);
      const candidates = drawn.filter(code => !suffix.includes(code)).sort();
      const full = (1 << candidates.length) - 1;
      const mass = new Float64Array(full + 1);
      const totals = new Float64Array(candidates.length);
      const weight = options => options.reduce((sum, code) => sum + weights.get(code), 0);
      let suffixChance = 1;
      for (let i = 0; i < suffix.length; i++) {
        const options = optionsFor(suffix.slice(i), candidates.length + i + 1);
        suffixChance *= options.includes(suffix[i]) ? weights.get(suffix[i]) / weight(options) : 0;
      }
      mass[full] = 1;
      for (let mask = full; mask > 0; mask--) {
        if (!mass[mask]) continue;
        const remaining = candidates.filter((_, index) => mask & (1 << index));
        const options = optionsFor([...remaining, ...suffix], candidates.length - remaining.length + 1);
        const total = weight(options);
        for (const code of options) {
          const index = candidates.indexOf(code);
          if (index < 0) continue;
          const probability = mass[mask] * weights.get(code) / total;
          const next = mask ^ (1 << index);
          if (next) mass[next] += probability;
          else totals[index] += probability * suffixChance;
        }
      }
      const total = totals.reduce((sum, value) => sum + value, 0);
      return candidates.map((origin, index) => ({
        ...odds.find(item => item.origin === origin), chance: total ? totals[index] / total : 0
      })).sort((a, b) => b.chance - a.chance);
    }
    const nonLottery = reverse.filter(code => !weights.has(code));
    const champion = state.bracket?.champion;
    if (save.championDraftsLast && nonLottery.includes(champion)) {
      nonLottery.splice(nonLottery.indexOf(champion), 1);
      nonLottery.push(champion);
    }
    return { odds, nextOdds, origins: [...drawn, ...nonLottery, ...reverse] };
  }

  function draftOrder(save, state, original = false) {
    const { origins } = lottery(save, state);
    return original ? origins : origins.map((code, index) => save.pickOwners?.[pickKey(draftYear(save), index < 30 ? 1 : 2, code)] ?? code);
  }

  function advance(save, state, selected, auto = false, step = false) {
    const draft = save.draftRoom ?? { order: draftOrder(save, state), picks: [] };
    const picks = [...draft.picks];
    const remaining = prospects(save).filter(prospect => !picks.some(pick => pick.id === prospect.id));
    for (let index = picks.length; index < draft.order.length; index++) {
      const team = draft.order[index];
      if (team === save.team && !selected && !auto) break;
      const ranked = team === save.team && auto
        ? (save.personalDraftBoard ?? []).map(id => remaining.find(item => item.id === id)).find(Boolean) : null;
      const prospect = ranked ?? (team === save.team && selected ? remaining.find(item => item.id === selected)
        : remaining.reduce((best, item) => item.rating > best.rating ? item : best, remaining[0]));
      if (!prospect) throw new Error('Choose an available prospect.');
      picks.push({ id: prospect.id, team, number: index + 1 });
      remaining.splice(remaining.indexOf(prospect), 1);
      if (team === save.team) selected = '';
      if (step) break;
    }
    return { ...draft, picks };
  }

  function deal(pick) {
    const firstRound = pick.number <= 30;
    const salary = firstRound ? Math.round((3 + 10 * Math.exp(-(pick.number - 1) / 9)) * 1000000) : 1500000;
    const salarySchedule = firstRound ? [[salary], [Math.round(salary * 1.05)], [Math.round(salary * 1.11), 'Team option'],
      [Math.round(salary * 1.22), 'Team option']] : null;
    return { salary, years: firstRound ? 4 : 2, raise: firstRound ? 0 : 75000, guaranteed: 100, upfront: 25,
      bonus: 0, incentive: 0, option: 'None', noTrade: false, kicker: 0, perks: [], ...(salarySchedule ? { salarySchedule } : {}) };
  }
  function keepsFutureFirsts(save, picks, owners, code) {
    const firsts = new Set(picks.filter(pick => pick.round === 1 && (owners[pick.key] ?? pick.owner) === code).map(pick => pick.year));
    for (let year = draftYear(save); year < draftYear(save) + 6; year++) {
      if (!firsts.has(year) && !firsts.has(year + 1)) return false;
    }
    return true;
  }

  function projectedOrigins(state, day) {
    const records = Object.fromEntries(Object.keys(state.records).map(code => [code, { wins: 0, games: 0 }]));
    for (const game of state.results) {
      if (game.day >= day || game.playoffRound != null) continue;
      const winner = game.homeScore > game.awayScore ? game.home : game.away;
      records[winner].wins++;
      records[game.home].games++;
      records[game.away].games++;
    }
    const winRate = code => records[code].wins / Math.max(1, records[code].games);
    return Object.keys(records).sort((a, b) => winRate(a) - winRate(b) || a.localeCompare(b));
  }

  return { source, projectedOrigins, keepsFutureFirsts, libraryYears, defaultClassYear, selectedClassYear, classSource, classLabel, progression, draftYear, futurePicks, pickLabel, prospects, validateClass, testing, lottery, draftOrder, advance, player, deal };
})();

