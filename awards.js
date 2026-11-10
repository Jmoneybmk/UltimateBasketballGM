const nbaContestHistory = {
  threePoint: { title: '3-Point Contest', source: 'https://www.nba.com/news/history-3-point-contest', winners: [
    [2026,"Damian Lillard","Trail Blazers"],
    [2025,"Tyler Herro","Heat"],
    [2024,"Damian Lillard","Bucks"],
    [2023,"Damian Lillard","Trail Blazers"],
    [2022,"Karl-Anthony Towns","Timberwolves"],
    [2021,"Stephen Curry","Warriors"],
    [2020,"Buddy Hield","Kings"],
    [2019,"Joe Harris","Nets"],
    [2018,"Devin Booker","Suns"],
    [2017,"Eric Gordon","Rockets"],
    [2016,"Klay Thompson","Warriors"],
    [2015,"Stephen Curry","Warriors"],
    [2014,"Marco Belinelli","Spurs"],
    [2013,"Kyrie Irving","Cavaliers"],
    [2012,"Kevin Love","Timberwolves"],
    [2011,"James Jones","Heat"],
    [2010,"Paul Pierce","Celtics"],
    [2009,"Daequan Cook","Heat"],
    [2008,"Jason Kapono","Raptors"],
    [2007,"Jason Kapono","Heat"],
    [2006,"Dirk Nowitzki","Mavs"],
    [2005,"Quentin Richardson","Suns"],
    [2004,"Voshon Lenard","Nuggets"],
    [2003,"Peja Stojakovic","Kings"],
    [2002,"Peja Stojakovic","Kings"],
    [2001,"Ray Allen","Bucks"],
    [2000,"Jeff Hornacek","Jazz"],
    [1998,"Jeff Hornacek","Jazz"],
    [1997,"Steve Kerr","Bulls"],
    [1996,"Tim Legler","Wizards"],
    [1995,"Glen Rice","Heat"],
    [1994,"Mark Price","Cavs"],
    [1993,"Mark Price","Cavs"],
    [1992,"Craig Hodges","Bulls"],
    [1991,"Craig Hodges","Bulls"],
    [1990,"Craig Hodges","Bulls"],
    [1989,"Dale Ellis","Sonics"],
    [1988,"Larry Bird","Celtics"],
    [1987,"Larry Bird","Celtics"],
    [1986,"Larry Bird","Celtics"],
  ] },
  dunk: { title: 'Slam Dunk Contest', source: 'https://www.nba.com/news/history-slam-dunk-contest', winners: [
    [2026,"Keshad Johnson","Heat"],
    [2025,"Mac McClung","Magic"],
    [2024,"Mac McClung","Magic"],
    [2023,"Mac McClung","76ers"],
    [2022,"Obi Toppin","Knicks"],
    [2021,"Anfernee Simons","Trail Blazers"],
    [2020,"Derrick Jones Jr.","Heat"],
    [2019,"Hamidou Diallo","Thunder"],
    [2018,"Donovan Mitchell","Jazz"],
    [2017,"Glenn Robinson III","Pacers"],
    [2016,"Zach LaVine","Timberwolves"],
    [2015,"Zach LaVine","Timberwolves"],
    [2014,"John Wall","Wizards"],
    [2013,"Terrence Ross","Raptors"],
    [2012,"Jeremy Evans","Jazz"],
    [2011,"Blake Griffin","Clippers"],
    [2010,"Nate Robinson","Knicks"],
    [2009,"Nate Robinson","Knicks"],
    [2008,"Dwight Howard","Magic"],
    [2007,"Gerald Green","Celtics"],
    [2006,"Nate Robinson","Knicks"],
    [2005,"Josh Smith","Hawks"],
    [2004,"Fred Jones","Pacers"],
    [2003,"Jason Richardson","Warriors"],
    [2002,"Jason Richardson","Warriors"],
    [2001,"Desmond Mason","Sonics"],
    [2000,"Vince Carter","Raptors"],
    [1997,"Kobe Bryant","Lakers"],
    [1996,"Brent Barry","Clippers"],
    [1995,"Harold Miner","Heat"],
    [1994,"Isiah Rider","Timberwolves"],
    [1993,"Harold Miner","Heat"],
    [1992,"Cedric Ceballos","Suns"],
    [1991,"Dee Brown","Celtics"],
    [1990,"Dominique Wilkins","Hawks"],
    [1989,"Kenny Walker","Knicks"],
    [1988,"Michael Jordan","Bulls"],
    [1987,"Michael Jordan","Bulls"],
    [1986,"Spud Webb","Hawks"],
    [1985,"Dominique Wilkins","Hawks"],
    [1984,"Larry Nance","Suns"],
  ] },
};

const nbaAwards = (() => {
  const players = playerTools.registry;
  const impact = s => s.PTS + 1.5 * s.AST + 0.75 * s.REB + 1.1 * (s.STL + s.BLK) - (s.TO ?? 0);
  const defense = s => 3 * (s.STL + s.BLK) + 0.45 * s.DREB;
  const random = seed => {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  };
  const ordered = (entries, score) => [...entries].sort((a, b) => score(b) - score(a) || a.localeCompare(b));

  function ballots(entries, score, points, seed, voters = 100, exclude = () => false) {
    const next = random(seed);
    const totals = new Map(entries.map(id => [id, 0]));
    const baseline = new Map(entries.map(id => [id, score(id)]));
    for (let voter = 0; voter < voters; voter++) {
      const preferences = new Map(entries.map(id => [id, baseline.get(id) * (0.89 + next() * 0.22)]));
      ordered(entries.filter(id => !exclude(id, voter)), id => preferences.get(id))
        .slice(0, points.length).forEach((id, place) => totals.set(id, totals.get(id) + points[place]));
    }
    return ordered(entries, id => totals.get(id) + 1e-7 * baseline.get(id));
  }

  function allStar(averages, owners, seed) {
    const starters = [];
    const reserves = [];
    for (const conference of ['East', 'West']) {
      const codes = new Set(league.teams.filter(team => team.conference === conference).map(team => team.code));
      const pool = [...averages.keys()].filter(id => codes.has(owners.get(id)));
      const performance = id => impact(averages.get(id)) * Math.sqrt(averages.get(id).GP);
      const fan = ordered(pool, id => performance(id) * 0.35 + players.get(id).attributes.Marketability * 1.25);
      const playerVote = ordered(pool, id => performance(id) + 0.5 * averages.get(id).MIN);
      const media = ordered(pool, performance);
      const combined = ordered(pool, id => -(0.5 * fan.indexOf(id) + 0.25 * playerVote.indexOf(id) + 0.25 * media.indexOf(id))
        - fan.indexOf(id) * 1e-6);
      const five = combined.slice(0, 5);
      starters.push(...five);
      reserves.push(...ballots(pool.filter(id => !five.includes(id)), performance, [7, 6, 5, 4, 3, 2, 1], seed,
        15, (id, i) => owners.get(id) === [...codes][i]).slice(0, 7));
    }
    return { allStarStarters: starters, allStarReserves: reserves, allStar: [...starters, ...reserves] };
  }

  function clutchPoints(games, seed) {
    const totals = new Map();
    const next = random(seed);
    for (const game of games) {
      const shots = [];
      for (const [side, lines] of [game.homeBox, game.awayBox].entries()) {
        for (const line of lines) {
          for (const [points, makes] of [[1, line.FTM], [2, line.FGM - line['3PM']], [3, line['3PM']]]) {
            for (let i = 0; i < makes; i++) shots.push({ time: next() * 48, points, side, id: line.id });
          }
        }
      }
      const score = [0, 0];
      for (const shot of shots.sort((a, b) => a.time - b.time)) {
        if (shot.time >= 43 && Math.abs(score[0] - score[1]) <= 5) {
          totals.set(shot.id, (totals.get(shot.id) ?? 0) + shot.points);
        }
        score[shot.side] += shot.points;
      }
    }
    return totals;
  }

  function regular({ averages, benchGames, records, owners, games, health, save, selections, may31, projection = false, candidatesOnly = false }) {
    const minutes = new Map();
    for (const game of games) for (const line of [...game.homeBox, ...game.awayBox]) {
      if (line.MIN < 15) continue;
      if (!minutes.has(line.id)) minutes.set(line.id, []);
      minutes.get(line.id).push({ day: game.day, minutes: line.MIN });
    }
    const credits = lines => lines.filter(line => line.minutes >= 20).length +
      Math.min(2, lines.filter(line => line.minutes < 20).length);
    const pool = [...averages.keys()];
    const eligible = pool.filter(id => {
      if (save.noAwardMinimum) return true;
      const lines = minutes.get(id) ?? [];
      const count = credits(lines);
      if (projection) return count >= Math.ceil(65 * ((records[owners.get(id)]?.wins ?? 0) + (records[owners.get(id)]?.losses ?? 0)) / 82);
      if (count >= 65) return true;
      const injury = health.get(id);
      if (count < 62 || injury.outUntil == null || injury.outUntil < may31 || injury.injuryDay == null) return false;
      const team = owners.get(id);
      const teamGames = games.filter(game => game.day < injury.injuryDay && (game.home === team || game.away === team)).length;
      return credits(lines.filter(line => line.day < injury.injuryDay)) >= teamGames * 0.85;
    });
    const value = id => impact(averages.get(id)) + 0.06 * (records[owners.get(id)]?.wins ?? 0);
    const defenseValue = id => defense(averages.get(id));
    const seed = save.seed;
    const rank = (ids, score, points, salt, ...options) => (projection || candidatesOnly) ? ordered(ids, score) : ballots(ids, score, points, seed ^ salt, ...options);
    const winner = (ids, score, salt, points = [5, 3, 1]) => rank(ids, score, points, salt).slice(0, candidatesOnly ? undefined : projection ? 5 : 1);
    const teamCodes = Object.keys(records);
    const wins = code => records[code].wins;
    const previousWins = code => save.previousWins?.[code] ?? wins(code);
    const teamValue = code => wins(code) + Math.max(0, wins(code) - previousWins(code)) * 0.7;
    const teamMoves = code => save.financeActions.filter(action => action.type === 'trade' &&
      (save.team === code || action.otherTeam === code)).length;
    const rookies = pool.filter(id => save.rookiePool ? save.rookiePool.includes(id) : players.get(id).experience === 0);
    const improvement = id => {
      const previous = save.previousImpact ? save.previousImpact[id] :
        players.get(id).stats && impact(players.get(id).stats);
      return Number.isFinite(previous) ? impact(averages.get(id)) - previous : -Infinity;
    };
    const clutch = clutchPoints(games, seed ^ 15473);
    const nominees = teamCodes.flatMap(code => ordered(pool.filter(id => owners.get(id) === code && clutch.has(id)),
      id => clutch.get(id)).slice(0, 1));
    const allNBA = rank(eligible, value, [5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1], 11).slice(0, candidatesOnly ? undefined : 15);
    const twoTeams = [2, 2, 2, 2, 2, 1, 1, 1, 1, 1];
    const allDefense = rank(eligible, defenseValue, twoTeams, 13).slice(0, candidatesOnly ? undefined : 10);
    return {
      ...selections, mvp: winner(eligible, value, 17, [10, 7, 5, 3, 1]), dpoy: winner(eligible, defenseValue, 19),
      rookie: winner(rookies, value, 23), mostImproved: winner(eligible.filter(id => !rookies.includes(id) && improvement(id) > 0), improvement, 29),
      sixthMan: winner(pool.filter(id => (benchGames.get(id) ?? 0) > averages.get(id).GP / 2), value, 31),
      clutch: winner(nominees, id => clutch.get(id), 37),
      coach: winner(teamCodes, teamValue, 41),
      executive: rank(teamCodes, code => teamValue(code) + 0.5 * teamMoves(code), [5, 3, 1], 43,
        30, (code, i) => code === teamCodes[i]).slice(0, candidatesOnly ? undefined : projection ? 5 : 1),
      allNBA, allDefense, allRookie: rank(rookies, value, twoTeams, 47).slice(0, candidatesOnly ? undefined : 10),
    };
  }

  function playoffMvp(games, match, round, seed, projection = false, championBoost = 0.2) {
    if (!match || (!projection && !match.winner)) return [];
    const stats = new Map();
    for (const game of games) {
      if (game.playoffRound !== round || ![game.home, game.away].includes(match.high)) continue;
      for (const [team, box] of [[game.home, game.homeBox], [game.away, game.awayBox]]) for (const line of box) {
        if (!(line.MIN > 0)) continue;
        const boost = round === 3 && team === match.winner ? championBoost : 0;
        const contribution = impact({ ...line, REB: line.OREB + line.DREB }) * (1 + boost);
        stats.set(line.id, (stats.get(line.id) ?? 0) + contribution);
      }
    }
    const candidates = ordered([...stats.keys()], id => stats.get(id));
    return projection ? candidates : ballots(candidates, id => stats.get(id), [1], seed, 11).slice(0, 1);
  }

  const periodLabels = {
    playerWeek: 'Player of the Week',
    playerMonth: 'Player of the Month',
    rookieMonth: 'Rookie of the Month',
    defenseMonth: 'Defensive Player of the Month',
    coachMonth: 'Coach of the Month',
  };

  function periodic(games, nextDay, regularEnd, dateForDay, save, projection = false) {
    const periods = new Map();
    const clubs = new Map(league.teams.map(team => [team.code, team.conference]));
    const rookies = new Set(save.rookiePool ?? league.players.filter(player => player.experience === 0).map(player => player.id));
    const currentDate = dateForDay(nextDay);
    const finalDate = dateForDay(regularEnd);
    const coaches = new Map();
    for (const game of games) {
      if (game.day >= regularEnd) continue;
      const date = dateForDay(game.day);
      const weekday = new Date(date).getUTCDay();
      const monday = game.day - (weekday + 6) % 7;
      const month = Number(date.slice(5, 7));
      const opening = month === 10 || month === 11;
      const end = opening ? date.slice(0, 4) + '-12-01'
        : new Date(Date.UTC(Number(date.slice(0, 4)), month, 1)).toISOString().slice(0, 10);
      const windows = [
        ['week', dateForDay(monday), dateForDay(Math.min(monday + 7, regularEnd)),
          dateForDay(Math.max(0, monday)) + ' to ' + dateForDay(Math.min(monday + 7, regularEnd) - 1)],
        ['month', opening ? date.slice(0, 4) + '-10' : date.slice(0, 7),
          end < finalDate ? end : finalDate,
          opening ? 'October / November' : new Date(date).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })],
      ];
      for (const [kind, start, close, label] of windows) {
        if (projection ? currentDate >= close : currentDate < close) continue;
        const key = kind + start;
        if (!periods.has(key)) periods.set(key, { kind, start, label,
          day: nextDay - (Date.parse(currentDate) - Date.parse(close)) / 86400000,
          candidates: new Map(), coaches: new Map() });
        const period = periods.get(key);
        const { candidates } = period;
        for (const side of ['home', 'away']) {
          const team = game[side];
          const won = game[side + 'Score'] > game[(side === 'home' ? 'away' : 'home') + 'Score'];
          if (kind === 'month') {
            const assignment = save.staffTimeline?.findLast(entry => entry.day <= game.day);
            const coachKey = team + ':' + (assignment?.day ?? -1);
            if (!coaches.has(coachKey)) {
              const staffing = assignment?.staffing ?? save.staffBaseline ?? save.staffing;
              coaches.set(coachKey, staffSim.assignments({ ...save, staffing }, team, staffSim.roles)['Head Coach']);
            }
            const coach = coaches.get(coachKey);
            const key = team + ':' + coach.id;
            if (!period.coaches.has(key)) period.coaches.set(key,
              { id: coach.id, name: coach.name, conference: clubs.get(team), team, wins: 0, games: 0, margin: 0 });
            const record = period.coaches.get(key);
            record.games++;
            record.wins += Number(won);
            record.margin += game[side + 'Score'] - game[(side === 'home' ? 'away' : 'home') + 'Score'];
          }
          for (const line of game[side + 'Box']) {
            if (!(line.MIN > 0)) continue;
            const entryKey = clubs.get(team) + ':' + line.id;
            if (!candidates.has(entryKey)) candidates.set(entryKey,
              { id: line.id, conference: clubs.get(team), games: 0, score: 0, defense: 0 });
            const row = candidates.get(entryKey);
            row.team = team;
            row.games++;
            row.score += impact({ ...line, REB: line.OREB + line.DREB }) + (won ? 4 : 0);
            row.defense += 2 * (line.STL + line.BLK) + 0.5 * line.DREB;
          }
        }
      }
    }
    return [...periods.values()].sort((a, b) => a.start.localeCompare(b.start)).flatMap(period => {
      const ranked = [...period.candidates.values()].sort((a, b) =>
        b.score / b.games - a.score / a.games || b.games - a.games || String(a.id).localeCompare(String(b.id)));
      const keys = period.kind === 'week' ? ['playerWeek'] : ['playerMonth', 'rookieMonth', 'defenseMonth', 'coachMonth'];
      const defensive = [...ranked].sort((a, b) => b.defense / b.games - a.defense / a.games || b.games - a.games);
      const coaching = [...period.coaches.values()].sort((a, b) =>
        b.wins / b.games - a.wins / a.games || b.wins - a.wins || b.margin / b.games - a.margin / a.games);
      return keys.map(key => ({
        key, label: period.label, day: period.day,
        candidates: ['East', 'West'].map(conference => (key === 'coachMonth' ? coaching : key === 'defenseMonth' ? defensive : ranked).filter(row =>
          row.conference === conference && (key !== 'rookieMonth' || rookies.has(row.id)))),
      })).map(period => ({
        ...period,
        winners: period.candidates.map((rows, index) =>
          rows.find(row => row.id === save.awardOverrides?.[period.key + ':' + period.day + ':' + index]) ?? rows[0]),
      }));
    });
  }

  function exhibition(teams, seed, rising = false) {
    const next = random(seed);
    const detail = random(seed ^ 0x44bb);
    const games = [];
    const play = (a, b, target, possessions) => {
      if (!a.roster.length || !b.roster.length) return a.roster.length ? a : b;
      const boxes = [a, b].map(team => team.roster.map(({ id, name, team: club }) => ({ id, name, club, points: 0, seconds: 0, fgm: 0, fga: 0, threeMade: 0, threeAttempts: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, turnovers: 0, fouls: 0, plusMinus: 0 })));
      const scores = [0, 0];
      let overtimeStart;
      let side = 0;
      for (let turn = 0; ; turn++) {
        const roster = [a, b][side].roster;
        const index = Math.floor(next() * roster.length);
        const ratings = roster[index].ratings;
        const three = next() < 0.4;
        const chance = three ? 0.22 + ratings['3PT'] * 0.0028 : 0.32 + ratings.Inside * 0.0035;
        const offense = boxes[side];
        const defense = boxes[1 - side];
        const shift = (lines, first) => Array.from({ length: Math.min(5, lines.length) }, (_, i) => lines[(first + i) % lines.length]);
        const attack = shift(offense, index);
        const defend = shift(defense, Math.floor(detail() * defense.length));
        const pick = lines => lines[Math.floor(detail() * lines.length)];
        const shooter = attack[0];
        const seconds = target || overtimeStart !== undefined ? 13 : Math.floor(720 * (turn + 1) / possessions) - Math.floor(720 * turn / possessions);
        for (const line of [...attack, ...defend]) line.seconds += seconds;
        const roll = next();
        let points = 0;
        let retained = false;
        if (roll < 0.11) {
          shooter.turnovers++;
          if (detail() < 0.65) pick(defend).stl++;
        } else if (roll < 0.20) {
          pick(defend).fouls++;
          const attempts = three ? 3 : 2;
          shooter.fta += attempts;
          let made;
          for (let shot = 0; shot < attempts; shot++) {
            made = detail() < 0.3 + ratings.FT * 0.006;
            points += Number(made);
          }
          shooter.ftm += points;
          if (!made && detail() < 0.23) { pick(attack).orb++; retained = true; }
          else if (!made) pick(defend).drb++;
        } else {
          shooter.fga++;
          if (three) shooter.threeAttempts++;
          if ((roll - 0.20) / 0.80 < chance) {
            shooter.fgm++;
            if (three) shooter.threeMade++;
            points = three ? 3 : 2;
            if (attack.length > 1 && detail() < 0.65) pick(attack.slice(1)).ast++;
          } else {
            if (detail() < (three ? 0.03 : 0.13)) pick(defend).blk++;
            if (detail() < 0.24) { pick(attack).orb++; retained = true; }
            else pick(defend).drb++;
          }
        }
        shooter.points += points;
        scores[side] += points;
        for (const line of attack) line.plusMinus += points;
        for (const line of defend) line.plusMinus -= points;
        if (target && scores[side] >= target) break;
        if (!target && turn + 1 === possessions) {
          if (scores[0] !== scores[1]) break;
          overtimeStart = scores[0];
        }
        if (overtimeStart !== undefined && scores[side] - overtimeStart >= 5) break;
        if (!retained) side = 1 - side;
      }
      games.push({ teams: [a.name, b.name], scores, boxes });
      return scores[0] > scores[1] ? a : b;
    };
    let champion;
    if (rising && teams.length === 6) {
      const bye = play(teams[0], teams[1], 40);
      const nba = play(teams[2], teams[3], 40);
      const development = play(teams[4], teams[5], 40);
      champion = play(bye, play(nba, development, 30), 25);
    } else if (rising) {
      const first = play(teams[0], teams[3], 40);
      const second = play(teams[1], teams[2], 40);
      champion = play(first, second, 25);
    } else if (teams.length === 4) {
      const [magic, bird, jordan, kobe] = teams;
      const first = play(magic, bird, null, 52);
      const second = play(jordan, kobe, null, 52);
      play(first === magic ? bird : magic, second === jordan ? kobe : jordan, null, 52);
      champion = play(first, second, null, 52);
    } else {
      const [stars, stripes, world] = teams;
      const winner = play(stars, world, null, 52);
      play(stripes, winner, null, 52);
      play(stripes, winner === stars ? world : stars, null, 52);
      const standing = teams.map(team => {
        const rows = games.filter(game => game.teams.includes(team.name));
        const points = rows.map(game => {
          const side = game.teams.indexOf(team.name);
          return [game.scores[side], game.scores[1 - side]];
        });
        return { team, wins: points.filter(([a, b]) => a > b).length,
          diff: points.reduce((sum, [a, b]) => sum + a - b, 0), points: points.reduce((sum, [a]) => sum + a, 0), draw: next() };
      }).sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.points - a.points || b.draw - a.draw);
      champion = play(standing[0].team, standing[1].team, null, 52);
    }
    const impactByPlayer = new Map();
    for (const game of games) for (const line of game.boxes.flat()) {
      impactByPlayer.set(line.id, (impactByPlayer.get(line.id) ?? 0) + line.points + 1.5 * line.ast
        + 0.75 * (line.orb + line.drb) + 1.1 * (line.stl + line.blk) - line.turnovers);
    }
    const mvp = champion.roster.filter(player => impactByPlayer.has(player.id))
      .sort((a, b) => impactByPlayer.get(b.id) - impactByPlayer.get(a.id))[0];
    return { teams: teams.map(({ name, club, coach, roster }) => ({ name, club, coach, roster: roster.map(({ id, name, team }) => ({ id, name, team })) })),
      games, champion: games.length ? champion.name : null, mvp: mvp ? { id: mvp.id, name: mvp.name, team: mvp.team } : null };
  }

  function risingStars(entries, seed, custom = false) {
    const strength = entry => entry.stats ? impact(entry.stats) * Math.sqrt(entry.stats.GP) : 0;
    const young = entries.filter(entry => !entry.affiliate && entry.service < 2 && entry.stats)
      .sort((a, b) => strength(b) - strength(a));
    if (custom) {
      const teams = Array.from({ length: 4 }, (_, i) => ({ name: 'Team ' + (i + 1), roster: [] }));
      young.slice(0, 24).forEach((entry, index) => teams[index % 4].roster.push(entry));
      const development = entries.filter(entry => entry.affiliate)
        .sort((a, b) => b.ratings.Inside + b.ratings['3PT'] - a.ratings.Inside - a.ratings['3PT']).slice(0, 12);
      const selected = new Set(young.slice(0, 24).map(entry => entry.id));
      const alternates = entries.filter(entry => !entry.affiliate && entry.service < 2 && !selected.has(entry.id))
        .sort((a, b) => strength(b) - strength(a));
      development.push(...alternates.slice(0, 12 - development.length));
      const select = [1, 2].map(number => ({ name: 'Development Select ' + number, roster: [] }));
      development.forEach((entry, index) => select[index % 2].roster.push(entry));
      if ([...teams, ...select].some(team => !team.roster.length)) return null;
      return exhibition([...teams, ...select], seed ^ 0x3131, true);
    }
    const pool = young.slice(0, 21);
    const teams = ['Team 1', 'Team 2', 'Team 3'].map(name => ({ name, roster: [] }));
    pool.forEach((entry, index) => teams[index % 3].roster.push(entry));
    const development = entries.filter(entry => entry.affiliate)
      .sort((a, b) => b.ratings.Inside + b.ratings['3PT'] - a.ratings.Inside - a.ratings['3PT']).slice(0, 7);
    // Fill affiliate vacancies with young NBA players outside the 21 selections.
    const alternates = entries.filter(entry => !entry.affiliate && entry.service < 2 && !pool.includes(entry))
      .sort((a, b) => strength(b) - strength(a)).slice(0, 7 - development.length);
    teams.push({ name: 'Development Select', roster: [...development, ...alternates] });
    return exhibition(teams, seed ^ 0x3131, true);
  }

  function allStarGame(entries, selections, seed) {
    const eligible = entries.filter(entry => !entry.affiliate && entry.stats);
    const ranked = [...eligible].sort((a, b) =>
      Number(selections.allStar.includes(b.id)) - Number(selections.allStar.includes(a.id))
      || impact(b.stats) * Math.sqrt(b.stats.GP) - impact(a.stats) * Math.sqrt(a.stats.GP));
    const world = ranked.filter(entry => entry.allStarSide === 'World').slice(0, 8);
    const usa = ranked.filter(entry => entry.allStarSide === 'USA').slice(0, 16);
    if (world.length < 8 || usa.length < 16) return null;
    return exhibition([
      { name: 'USA Stars', roster: usa.filter((_, i) => i % 2 === 0) },
      { name: 'USA Stripes', roster: usa.filter((_, i) => i % 2 === 1) },
      { name: 'World', roster: world },
    ], seed ^ 0x2244);
  }

  function saturday(entries, seed, custom = false) {
    const next = random(seed ^ 0x5a771);
    const field = (count, score) => entries.map(entry => ({ ...entry, strength: score(entry) + next() * 8 }))
      .sort((a, b) => b.strength - a.strength).slice(0, count);
    const shoot = ({ ratings }, seconds = 70) => {
      const accuracy = 0.27 + ratings['3PT'] * 0.005;
      const rack = [1, 1, 1, 1, 2];
      const balls = [...rack, ...rack, 3, ...rack, 3, ...rack, 2, 2, 2, 2, 2];
      return balls.slice(0, Math.floor(balls.length * seconds / 70))
        .map(value => next() < accuracy - (value === 3 ? 0.19 : 0) ? value : 0);
    };
    const dunk = ({ ratings }, count = 2) => Array.from({ length: count }, () => {
      const athleticism = (ratings.Inside + ratings.Speed + ratings.Agility + ratings.Strength) / 4;
      const execution = next() < 0.06 ? 0 : 1;
      const judges = Array.from({ length: 5 }, () => Math.round(Math.min(50, 40 + execution * (athleticism / 13 + next() * 4))));
      return judges.reduce((sum, score) => sum + score, 0) / 5;
    });
    const contest = (entrants, finalists, attempt, playoff, repeat = true) => {
      const total = attempts => Math.round(attempts.reduce((sum, points) => sum + points, 0) * 10) / 10;
      const round = pool => pool.map(({ id, team, name, ratings }) => {
        const attempts = attempt({ ratings });
        return { id, team, name, attempts, score: total(attempts), tiebreaks: [] };
      }).sort((a, b) => b.score - a.score);
      const resolve = (rows, cutoff, finalRound) => {
        if (!rows[cutoff - 1] || rows[cutoff - 1].score !== rows[cutoff]?.score) return;
        const score = rows[cutoff].score;
        const start = rows.findIndex(row => row.score === score);
        const tied = rows.filter(row => row.score === score);
        for (const row of tied) row.tiebreaks.push(total(playoff(entrants.find(entry => entry.id === row.id), finalRound)));
        tied.sort((a, b) => b.tiebreaks.at(-1) - a.tiebreaks.at(-1));
        if (repeat) {
          const boundary = cutoff - start;
          const rerank = (group, places) => {
            if (group[places - 1]?.tiebreaks.at(-1) !== group[places]?.tiebreaks.at(-1)) return;
            const tiedScore = group[places].tiebreaks.at(-1);
            const offset = group.findIndex(row => row.tiebreaks.at(-1) === tiedScore);
            const tiedAgain = group.filter(row => row.tiebreaks.at(-1) === tiedScore);
            for (const row of tiedAgain) row.tiebreaks.push(total(playoff(entrants.find(entry => entry.id === row.id), finalRound)));
            tiedAgain.sort((a, b) => b.tiebreaks.at(-1) - a.tiebreaks.at(-1));
            rerank(tiedAgain, places - offset);
            group.splice(offset, tiedAgain.length, ...tiedAgain);
          };
          rerank(tied, boundary);
        } else {
          const boundary = cutoff - start;
          const score = tied[boundary - 1]?.tiebreaks.at(-1);
          if (score === tied[boundary]?.tiebreaks.at(-1)) {
            const choices = tied.filter(row => row.tiebreaks.at(-1) === score);
            for (const row of choices) row.judgeVotes = 0;
            for (let judge = 0; judge < 5; judge++) choices[Math.floor(next() * choices.length)].judgeVotes++;
            tied.sort((a, b) => b.tiebreaks.at(-1) - a.tiebreaks.at(-1) || (b.judgeVotes ?? 0) - (a.judgeVotes ?? 0));
          }
        }
        rows.splice(start, tied.length, ...tied);
      };
      const opening = round(entrants);
      resolve(opening, finalists, false);
      const final = round(opening.slice(0, finalists).map(row => entrants.find(entry => entry.id === row.id)));
      resolve(final, 1, true);
      return { opening, final, winner: final[0] ?? null };
    };
    const makes = entry => Math.round((entry.stats?.['3PM'] ?? 0) * (entry.stats?.GP ?? 0));
    const qualified = entries.filter(entry => makes(entry) >= 50);
    const threeField = [];
    if (custom) {
      const rated = qualified.map(entry => ({ entry, score: entry.stats['3PM'] * 12 + makes(entry) * 0.2 + next() * 4 }));
      threeField.push(...rated.sort((a, b) => b.score - a.score).slice(0, 8).map(row => row.entry));
      threeField.push(...entries.filter(entry => !qualified.includes(entry)).sort((a, b) => makes(b) - makes(a)).slice(0, 8 - threeField.length));
    }
    const threePoint = contest(custom ? threeField : field(8, ({ ratings, stats }) => ratings['3PT'] + Math.min(8, (stats?.['3PM'] ?? 0) * 2)),
      3, shoot, (entry, final) => shoot(entry, final ? 70 : 30));
    const slamDunk = contest(field(4, ({ ratings, stats }) => custom
      ? (ratings.Inside + ratings.Speed) / 2 + (stats?.DNK ?? 0) * (stats?.GP ?? 0) * 0.6
      : (ratings.Inside + ratings.Speed + ratings.Agility + ratings.Strength) / 4),
      2, dunk, entry => dunk(entry, 1), false);
    const legends = ['Ray Allen', 'Reggie Miller', 'Larry Bird', 'Dirk Nowitzki'];
    const shooters = field(8, ({ ratings }) => ratings['3PT'] + ratings.Mid * 0.2);
    const shootingTeams = legends.flatMap((legend, index) => {
      const roster = shooters.slice(index * 2, index * 2 + 2);
      return roster.length === 2 ? [{ id: 'shooting-team-' + index, name: 'Team ' + roster[0].name,
        roster: [...roster, { name: legend }], ratings: { shooting: (roster[0].ratings['3PT'] + roster[1].ratings['3PT'] + 90) / 3 } }] : [];
    });
    const shootTeam = ({ ratings }, seconds = 70) => {
      const values = [2, 2, 2, 3, 2, 3, 4];
      const accuracy = [0.95, 0.66, 0.64, 0.52, 0.62, 0.55, 0.32];
      const shots = [];
      let clock = seconds;
      for (let attempt = 0; clock > 0; attempt++) {
        const spot = Math.min(6, Math.floor(attempt / 3));
        clock -= 1.7 + next() * 1.2 + (attempt % 3 === 0 && attempt < 21 ? 1.8 : 0);
        if (clock >= 0) shots.push(next() < accuracy[spot] + (ratings.shooting - 80) / 300 ? values[spot] : 0);
      }
      return shots;
    };
    const shootingStars = contest(shootingTeams, 2, shootTeam, (entry, final) => shootTeam(entry, final ? 70 : 30));
    for (const row of [...shootingStars.opening, ...shootingStars.final]) {
      row.roster = shootingTeams.find(team => team.id === row.id).roster.map(({ id, name, team }) => ({ id, name, team }));
    }
    return { shootingStars, threePoint, dunk: slamDunk };
  }

  return { allStar, allStarGame, exhibition, risingStars, saturday, regular, playoffMvp, impact, periodic, periodLabels };
})();

function awardSeries(state) {
  return {
    eastFinals: [state.bracket?.rounds[2]?.[0], 2],
    westFinals: [state.bracket?.rounds[2]?.[1], 2],
    finals: [state.bracket?.rounds[3]?.[0], 3],
  };
}

function awardOverrideEntries(state, save) {
  const entries = [];
  const add = (slot, label, winner, candidates, siblings = []) => {
    entries.push({ slot, label, winner, candidates: candidates.filter(row => row.id === winner || !siblings.includes(row.id)) });
  };
  const players = ids => ids.map(id => ({ id, name: state.profiles.get(id)?.name ?? id,
    team: state.awardOwners?.get(id) ?? state.owners.get(id) }));
  const staff = (codes, key) => codes.map(code => ({ id: code, team: code, name: key === 'coach'
    ? staffSim.assignments({ ...save, staffing: save.staffTimeline?.findLast(entry => entry.day < seasonSim.playoffStart)?.staffing ?? save.staffBaseline },
      code, staffSim.roles)['Head Coach']?.name ?? code
    : league.teams.find(team => team.code === code)?.name + ' front office' }));
  const series = awardSeries(state);
  const selections = { ...state.awards, ...state.playoffAwards, allStar: state.selections.allStar };
  for (const [key, [label, tiers]] of Object.entries(teamFinance.clubAwardRates)) {
    const ids = selections[key] ?? [];
    if (!ids.length) continue;
    let candidates;
    if (key === 'allStar') candidates = [...state.allStarOwners.keys()];
    else if (series[key]) candidates = nbaAwards.playoffMvp(state.results, ...series[key], save.seed, true);
    else candidates = state.awardCandidates[key] ?? ids;
    const rows = ['coach', 'executive'].includes(key) ? staff(candidates, key) : players(candidates);
    ids.forEach((id, index) => {
      const group = Array.isArray(tiers) ? ' · Team ' + (Math.floor(index / 5) + 1) : '';
      const position = ids.length > 1 ? ' · Slot ' + (Array.isArray(tiers) ? index % 5 + 1 : index + 1) : '';
      const eligible = key === 'allStar' ? rows.filter(row => {
        const conference = player => league.teams.find(team => team.code === state.allStarOwners.get(player))?.conference;
        return conference(row.id) && conference(row.id) === conference(id);
      }) : rows;
      add(key + ':' + index, label + group + position, id, eligible, ids);
    });
  }
  for (const period of state.periodAwards) period.winners.forEach((winner, index) => {
    if (!winner) return;
    add(period.key + ':' + period.day + ':' + index,
      nbaAwards.periodLabels[period.key] + ' · ' + period.label + ' · ' + ['East', 'West'][index], winner.id,
      period.candidates[index].map(row => ({ ...row, name: row.name ?? state.profiles.get(row.id)?.name ?? row.id })));
  });
  for (const [key, label, event] of [['allStarMvp', 'All-Star Game MVP', state.allStarGame], ['risingMvp', 'Rising Stars MVP', state.risingStars]]) {
    if (event?.mvp) add(key, label, event.mvp.id, event.teams.flatMap(team => team.roster));
  }
  for (const [key, label] of [['threePoint', '3-Point Contest'], ['dunk', 'Slam Dunk Contest'], ['shootingStars', 'Shooting Stars']]) {
    const event = state.allStarSaturday?.[key];
    if (event?.winner) add(key, label, event.winner.id, event.final);
  }
  return entries;
}




const franchiseAllStar = (() => {
  const conferences = ['East', 'West'];
  const clubs = new Map(league.teams.map(team => [team.code, team]));
  const compare = (a, b) => b.score - a.score || a.id.localeCompare(b.id);
  const strength = stats => nbaAwards.impact(stats) * Math.sqrt(stats.GP);

  function voteNoise(seed, salt) {
    let value = (seed ^ salt) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }

  function nominate(save, state) {
    const affinity = id => [...state.owners.keys()].reduce((total, other) =>
      total + (other === id ? 0 : worldRelationships.familiarity(save, state, id, other)), 0);
    return Object.fromEntries(conferences.map(conference => {
      const pool = [...state.averages].flatMap(([id, stats]) => {
        const team = state.owners.get(id);
        const player = state.profiles.get(id);
        if (!player || clubs.get(team)?.conference !== conference || state.affiliate[id] || state.health.get(id)?.durability <= 10) return [];
        const performance = Math.max(1, strength(stats));
        const market = player.attributes.Marketability ?? 50;
        return [{ id, team, performance, market, score: performance + market }];
      }).sort(compare);
      const support = new Map();
      for (const [ballot, club] of league.teams.filter(team => team.code !== save.team).entries()) {
        const slate = pool.map((row, index) => ({
          id: row.id,
          score: row.score * (0.9 + voteNoise(save.seed ^ (ballot * 1187), index * 101) * 0.2)
            + (row.team === club.code ? 15 : 0),
        })).sort(compare).slice(0, 16);
        for (const [rank, row] of slate.entries()) support.set(row.id, (support.get(row.id) ?? 0) + 16 - rank);
      }
      pool.sort((a, b) => (support.get(b.id) ?? 0) - (support.get(a.id) ?? 0) || compare(a, b));
      return [conference, pool.map((row, index) => ({
        ...row, familiarity: index < 16 ? affinity(row.id) : 0,
      }))];
    }));
  }

  function voting(nominees, save, elapsed, dailyPerformance) {
    const cpuCount = Math.min(29, 9 + Math.floor(Math.max(0, elapsed) * 20 / 36));
    const cpu = league.teams.filter(team => team.code !== save.team);
    return Object.fromEntries(conferences.map(conference => {
      const field = nominees[conference].slice(0, 16);
      const rows = field.map(row => ({ ...row, fans: 0, players: 0, media: 0, gm: 0, ballots: [] }));
      for (let day = 0; day <= Math.min(36, elapsed); day++) for (const [index, row] of rows.entries()) {
        const jitter = 0.85 + voteNoise(save.seed + day, index * 691) * 0.3;
        const performance = dailyPerformance[day]?.get(row.id) ?? row.performance;
        row.fans += Math.round((performance * 5 + row.market * 70) * jitter);
        row.players += Math.round((row.familiarity + 1) * jitter);
        row.media += Math.round(performance * jitter);
      }
      for (let index = 0; index < cpuCount && rows.length; index++) {
        const pick = [...rows].sort((a, b) => {
          const value = row => row.score * (0.5 + voteNoise(save.seed ^ (index * 1187), field.findIndex(item => item.id === row.id) * 101))
            + (row.team === cpu[index].code ? 15 : 0);
          return value(b) - value(a);
        })[0];
        pick.gm++;
        pick.ballots.push(cpu[index].code);
      }
      const user = rows.find(row => row.id === save.allStarBallot?.[conference]);
      if (user) { user.gm++; user.ballots.push(save.team); }
      const categories = [['fans', 40], ['players', 20], ['media', 20], ['gm', 20]];
      const totals = Object.fromEntries(categories.map(([key]) => [key, rows.reduce((sum, row) => sum + row[key], 0)]));
      for (const row of rows) row.score = categories.reduce((score, [key, weight]) =>
        score + weight * row[key] / (totals[key] || 1), 0);
      return [conference, rows.sort(compare)];
    }));
  }

  function captains(save, records, results, day) {
    const order = postseason.bracket(records, results, save.seed, true).order;
    const slots = { West: ['Team Kobe', 'Team Magic'], East: ['Team Jordan', 'Team Bird'] };
    const staffing = save.staffTimeline?.findLast(entry => entry.day <= day)?.staffing ?? save.staffBaseline ?? save.staffing;
    return conferences.flatMap(conference => order[conference].slice(0, 2).map((club, index) => ({
      name: slots[conference][index], club, record: { ...records[club] },
      coach: staffSim.assignments({ ...save, staffing }, club, staffSim.roles)['Head Coach']?.name,
    }))).sort((a, b) => a.record.wins / Math.max(1, a.record.wins + a.record.losses)
      - b.record.wins / Math.max(1, b.record.wins + b.record.losses) || a.club.localeCompare(b.club));
  }

  function draft(captains, eligible, save) {
    const teams = captains.map(team => ({ ...team, roster: [] }));
    const pool = [...eligible];
    const picks = [];
    for (let pick = 0; pick < 32 && pool.length; pick++) {
      const round = Math.floor(pick / 4);
      const slot = pick % 4;
      const team = teams[round % 2 ? 3 - slot : slot];
      const manual = team.club === save.team && !save.allStarDraftDelegate;
      const requested = save.allStarDraftPicks?.[pick];
      const index = pool.findIndex(player => player.id === requested);
      if (manual && index < 0) return { teams, pool, picks, pending: team, next: pick };
      const [player] = pool.splice(index < 0 ? 0 : index, 1);
      team.roster.push(player);
      picks.push({ player, team: team.name });
    }
    return { teams, pool, picks, pending: null };
  }

  return { nominate, voting, captains, draft };
})();







