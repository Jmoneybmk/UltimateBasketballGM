const tradeValues = (() => {
  const production = stats => (stats.PTS ?? 0) + 0.75 * (stats.REB ?? 0) + 1.35 * (stats.AST ?? 0)
    + 1.8 * ((stats.STL ?? 0) + (stats.BLK ?? 0)) - 0.7 * (stats.TO ?? 0);
  const clamp = (number, low, high) => Math.min(high, Math.max(low, number));
  const awardWeights = { MVP: 24, 'NBA Finals MVP': 12, 'Defensive Player of the Year': 12,
    'All-NBA First Team': 7, 'All-NBA Second Team': 5, 'All-NBA Third Team': 3,
    'All-NBA': 3, 'All-Defensive': 2, 'All-Defensive First Team': 3, 'All-Defensive Second Team': 2,
    'All-Star': 2, 'Rookie of the Year': 4, 'Most Improved Player': 3, 'Sixth Man of the Year': 3 };
  const archivedStates = new WeakMap();

  function archiveState(save) {
    if (!archivedStates.has(save)) archivedStates.set(save, seasonSim.history(save));
    return archivedStates.get(save);
  }

  function market(save, state, contractsFor) {
    const year = draftOps.draftYear(save);
    const today = seasonSim.date(state.day, save.year);
    const picks = new Map(draftOps.futurePicks(save).map(pick => [pick.key, pick]));
    const projectedOrder = league.teams.map(({ code }) => {
      const roster = [...state.rosters.get(code)].sort((a, b) =>
        state.playerOveralls.get(b.id) - state.playerOveralls.get(a.id)).slice(0, 8);
      const talent = roster.reduce((total, player) => total + (state.playerOveralls.get(player.id) ?? 60), 0) / Math.max(1, roster.length);
      const { wins, losses } = state.records[code];
      return { code, strength: (talent + wins * 100 / 40) / (1 + (wins + losses) / 40) };
    }).sort((a, b) => a.strength - b.strength || a.code.localeCompare(b.code));
    const ranks = new Map(projectedOrder.map(({ code }, rank) => [code, rank + 1]));
    const cache = new Map();
    const boards = cpuTeams.intel(save, state, contractsFor);
    const archives = (save.pastSeasons ?? []).map(archiveState);
    const lastSeason = archives.at(-1);
    const recent = new Map();
    for (let index = state.results.length - 1; index >= 0; index--) {
      const game = state.results[index];
      for (const line of [...game.homeBox, ...game.awayBox]) {
        if (!(line.MIN > 0)) continue;
        if (!recent.has(line.id)) recent.set(line.id, { games: 0, score: 0 });
        const row = recent.get(line.id);
        if (row.games === 10) continue;
        row.games++;
        row.score += production({ ...line, REB: (line.OREB ?? 0) + (line.DREB ?? 0) });
      }
    }

    function asset(id) {
      if (cache.has(id)) return cache.get(id);
      const pick = picks.get(id);
      let result;
      if (pick) {
        const distance = pick.year - year;
        const rank = 15.5 + ((ranks.get(pick.origin) ?? 15.5) - 15.5) * 0.72 ** distance;
        const first = pick.round === 1;
        result = { first, centerpiece: first && rank <= 9,
          value: (first ? 77 - 1.65 * rank : 15 - 0.27 * rank) * 0.95 ** distance };
      } else {
        const player = state.profiles.get(id);
        if (!player) return { value: 0 };
        const age = player.dob ? Number(today.slice(0, 4)) - Number(player.dob.slice(0, 4))
          - Number(today.slice(5) < player.dob.slice(5)) : 20 + (player.experience ?? 5);
        const prior = (lastSeason ? lastSeason.averages.get(id) : player.stats) ?? {};
        const form = recent.get(id);
        const weight = (prior.GP ? 0.4 : 1) * (form?.games ?? 0) / 10;
        const skill = state.playerOveralls.get(id) ?? 60;
        const impact = (prior.GP ? production(prior) : Math.max(4, (skill - 48) * 0.8)) * (1 - weight)
          + (form ? form.score / form.games * weight : 0);
        const honors = nbaPlayerHonors(id);
        let awards = honors.reduce((total, honor) => total + (awardWeights[honor.label] ?? 0) * (honor.count ?? 1), 0);
        let titles = honors.filter(honor => honor.label === 'NBA champion').reduce((total, honor) => total + (honor.count ?? 1), 0);
        let playoffGames = (nbaCareerPostseason[id] ?? []).reduce((total, row) => total + (row.stats?.GP ?? row.totals?.GP ?? 0), 0);
        for (const season of [...archives, state]) {
          const games = season.playoffAverages?.get(id)?.GP ?? 0;
          playoffGames += games;
          if (games && season.bracket?.champion && season.owners.get(id) === season.bracket.champion) titles++;
          for (const [key, points] of Object.entries({ mvp: 24, dpoy: 12, rookie: 4, mostImproved: 3, sixthMan: 3, allNBA: 5, allDefense: 2 })) {
            if (season.awards?.[key]?.includes(id)) awards += points;
          }
          if ((season.selections?.allStar ?? season.awards?.allStar)?.includes(id)) awards += 2;
          if (season.playoffAwards?.finals?.includes(id)) awards += 12;
        }
        const elite = impact >= 38 || (awards >= 24 && impact >= 30);
        const contract = contractsFor(state.owners.get(id))?.get(id)?.deal;
        const control = contract ? contract.years - Number(contract.option === 'Player option' || contract.option === 'Early termination') : 1;
        const ageFactor = clamp(1 + (27 - age) * 0.028, 0.62, 1.22);
        const controlFactor = clamp(0.94 + 0.06 * control, 0.94, 1.18);
        const availability = state.health.get(id)?.durability ?? 100;
        const availabilityFactor = (availability <= 10 ? 0.88 : availability <= 30 ? 0.96 : 1)
          * (prior.GP >= 1 && prior.GP < 45 ? 0.95 : 1);
        const résumé = Math.min(64, awards) + Math.min(16, Math.sqrt(playoffGames) * 1.35) + Math.min(24, titles * 12);
        const value = (8 + impact + 0.57 * Math.max(0, impact - 21) ** 2 + résumé)
          * ageFactor * controlFactor * availabilityFactor;
        result = { value, elite, age, control, skill, centerpiece: elite || impact >= 29 || age <= 24 && impact >= 21 };
      }
      cache.set(id, result);
      return result;
    }

    const weights = {
      Contending: { pick: .78, veteran: 1.04, star: 1.18, prospect: .9, fit: .12 },
      Buying: { pick: .86, veteran: 1.12, star: 1.12, prospect: .95, fit: .22 },
      Selling: { pick: 1.16, veteran: .85, star: .96, prospect: 1.17, fit: .04 },
      Rebuilding: { pick: 1.28, veteran: .70, star: .85, prospect: 1.30, fit: .02 },
    };
    const teamValues = new Map();
    function calculateValue(id, team) {
      const item = asset(id);
      const board = boards.get(team);
      if (!board) return item.value;
      const weight = weights[board.direction];
      if (picks.has(id)) return item.value * weight.pick;
      const player = state.profiles.get(id);
      if (!player) return 0;
      const group = cpuTeams.positionGroup(player);
      const need = board.needs.indexOf(group) === 0;
      const attributes = player.attributes ?? {};
      const upside = save.playerEdits?.findLast(edit => edit.id === id)?.profile?.progression ?? player.progression ?? playerDevelopment.curve(player);
      const growth = item.age <= 25 && ['Selling', 'Rebuilding'].includes(board.direction) ? clamp((upside?.gain ?? 0) * .03, 0, .15) : 0;
      const rotation = board.ranked.filter(teammate => teammate.id !== id && cpuTeams.positionGroup(teammate) === group
        && (state.health.get(teammate.id)?.durability ?? 100) > 10);
      const incumbent = rotation[group === 'C' ? 0 : 1];
      const upgrade = item.skill - (state.playerOveralls.get(incumbent?.id) ?? 50);
      const fit = need ? weight.fit * clamp(upgrade / 10, 0, 1) : 0;
      const multiplier = item.age <= 25 ? weight.prospect + growth : item.elite ? weight.star : weight.veteran;
      const skillKey = { G: 'Pass Acc', F: 'Perimeter Defense', C: 'Interior Defense' }[group];
      const skillFit = need ? clamp(((attributes[skillKey] ?? 65) - 65) / 200, 0, .08) : 0;
      return item.value * (multiplier + fit + skillFit);
    }
    function valueFor(id, team) {
      const key = team + ':' + id;
      if (!teamValues.has(key)) teamValues.set(key, calculateValue(id, team));
      return teamValues.get(key);
    }
    const total = (ids, team) => ids.reduce((sum, id) => sum + valueFor(id, team), 0);
    const payrollCache = new Map();
    function owed(id) {
      if (picks.has(id)) return 0;
      if (!payrollCache.has(id)) {
        const ledger = contractsFor(state.owners.get(id));
        payrollCache.set(id, ledger ? teamFinance.tradePayroll(ledger, [id], save.day).guaranteed : 0);
      }
      return payrollCache.get(id);
    }
    function accepts(offered, requested, team, userNegotiating = false, cash = 0) {
      const elite = requested.some(id => asset(id).elite);
      const board = boards.get(team);
      let premium = 0;
      if (board) {
        const incoming = offered.map(id => state.profiles.get(id)).filter(Boolean);
        const roster = board.ranked.filter(player => !requested.includes(player.id)).concat(incoming);
        if (roster.length < 10 || roster.length > 18) return false;
        const healthy = players => players.filter(player => (state.health.get(player.id)?.durability ?? 100) > 10);
        const capacity = players => players.reduce((sum, player) => sum + seasonSim.minuteLimit(state.health.get(player.id)?.durability ?? 100), 0);
        if (capacity(roster) < Math.min(240, capacity(board.ranked))) return false;
        const groups = players => new Set(healthy(players).map(cpuTeams.positionGroup));
        const prior = groups(board.ranked);
        const after = groups(roster);
        if ([...prior].some(group => !after.has(group))) return false;
        const core = requested.filter(id => board.protectedIds.includes(id) && (asset(id).age <= 25 || elite));
        const centerpiece = offered.some(id => asset(id).elite && asset(id).age <= 29 && asset(id).control >= 2);
        const shortTerm = offered.some(id => asset(id).age >= 35 && asset(id).control <= 1);
        const firsts = requested.filter(id => asset(id).first);
        if (shortTerm && !centerpiece) {
          if (core.length || firsts.length > 1 || firsts.some(id => asset(id).centerpiece)) return false;
          const exchangingVeteran = requested.some(id => asset(id).age >= 35 && asset(id).control <= 1);
          if (ranks.get(team) <= 14 && (firsts.length || !exchangingVeteran)) return false;
        }
        premium = total(core, team) * (centerpiece ? .08 : .30);
      }
      const payroll = ids => ids.reduce((sum, id) => sum + owed(id), 0);
      if (board && ['Selling', 'Rebuilding'].includes(board.direction)) {
        const additionalSalary = payroll(offered) - payroll(requested);
        premium += Math.max(-6, Math.min(18, additionalSalary / 1_500_000));
      }
      const trust = userNegotiating && team ? (worldRelationships.gmTrust(save, team) - 50) / 1000 : 0;
      if (total(offered, team) + cashValue(cash) < total(requested, team) * ((elite ? .95 : .85) - trust) + premium) return false;
      if (!elite || offered.some(id => asset(id).elite)) return true;
      const firsts = offered.filter(id => asset(id).first);
      const playerCenterpiece = offered.some(id => !picks.has(id) && asset(id).centerpiece);
      return playerCenterpiece || firsts.length >= 2 && firsts.some(id => asset(id).centerpiece);
    }
    return { asset, total, valueFor, accepts, boards };
  }

  const cashValue = dollars => dollars / 500_000;
  return { market, cashValue };
})();
