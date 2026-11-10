const cpuTeams = (() => {
  const positionGroup = player => {
    const position = playerTools.slots(player)[0] ?? 'F';
    return position.includes('G') ? 'G' : position === 'C' ? 'C' : 'F';
  };

  function rosterValue(player, roster, state, direction) {
    const group = positionGroup(player);
    const depth = roster.filter(teammate => teammate.id !== player.id && positionGroup(teammate) === group
      && (state.health.get(teammate.id)?.durability ?? 100) > 10).length;
    const desired = { G: 5, F: 5, C: 2 }[group];
    const age = player.listedAge ?? 20 + (player.experience ?? 5);
    const future = ['Selling', 'Rebuilding'].includes(direction);
    const timeline = future ? Math.max(-8, Math.min(8, (26 - age) * 1.5)) : 0;
    return (state.playerOveralls.get(player.id) ?? 50) + 3 * Math.max(0, desired - depth) + timeline;
  }

  function openingDepth(save, state, includeUser = false) {
    save = updateDirections(save, state);
    const cuts = [];
    for (const [code, roster] of state.rosters) {
      if (code === save.team && !includeUser || roster.length <= freeAgency.cpuTarget) continue;
      const contracts = teamFinance.report(save, state, code).contracts;
      const remaining = [...roster];
      while (remaining.length > freeAgency.cpuTarget) {
        remaining.sort((a, b) => Number(Boolean(contracts.get(b.id)?.deal.twoWay)) - Number(Boolean(contracts.get(a.id)?.deal.twoWay))
          || rosterValue(a, remaining, state) - rosterValue(b, remaining, state) || a.id.localeCompare(b.id));
        const player = remaining.shift();
        cuts.push({ type: 'cut', team: code, id: player.id, day: save.day, settlement: true, cpu: code !== save.team });
      }
    }
    return { ...save, cpuDepthInitialized: true, financeActions: [...save.financeActions, ...cuts] };
  }

  function intel(save, state, contractsFor) {
    const picks = draftOps.futurePicks(save);
    const today = seasonSim.date(state.day, save.year);
    const clubs = [...state.rosters].map(([code, roster]) => {
      const ranked = [...roster].sort((a, b) => state.playerOveralls.get(b.id) - state.playerOveralls.get(a.id));
      const core = ranked.slice(0, 8);
      const talent = core.reduce((sum, player) => sum + state.playerOveralls.get(player.id), 0) / Math.max(1, core.length);
      const { wins, losses } = state.records[code];
      const injured = core.filter(player => (state.health.get(player.id)?.durability ?? 100) <= 10).length;
      const strength = (talent + (wins + losses ? 100 * wins / (wins + losses) : talent) * (wins + losses) / 28)
        / (1 + (wins + losses) / 28) - injured * 1.25;
      const age = player => playerDevelopment.ageAt(player, today) ?? 20 + (player.experience ?? 5);
      const youth = core.filter(player => age(player) <= 25).length;
      const assets = picks.filter(pick => pick.owner === code);
      const draftYear = draftOps.draftYear(save);
      const ownFirst = assets.some(pick => pick.round === 1 && pick.origin === code && pick.year === draftYear);
      const nearFirsts = assets.filter(pick => pick.round === 1 && pick.year <= draftYear + 2).length;
      const depth = Object.fromEntries(['G', 'F', 'C'].map(group => {
        const healthy = ranked.filter(player => positionGroup(player) === group && (state.health.get(player.id)?.durability ?? 100) > 10);
        const target = group === 'C' ? 2 : 4;
        const grade = healthy.slice(0, target).reduce((sum, player) => sum + state.playerOveralls.get(player.id), 0);
        return [group, grade / target];
      }));
      const needs = Object.keys(depth).sort((a, b) => depth[a] - depth[b]);
      const contracts = contractsFor?.(code);
      const payroll = roster.reduce((sum, player) => sum + (contracts?.get(player.id)?.deal.salary ?? 0), 0);
      return { code, ranked, strength, talent, age, assets, ownFirst, nearFirsts, youth, injured, needs, depth, wins, losses, payroll, contracts };
    }).sort((a, b) => b.strength - a.strength || a.code.localeCompare(b.code));
    return new Map(clubs.map((club, i) => {
      const { code, youth, ownFirst, nearFirsts, age, ranked } = club;
      const direction = save.teamDirections?.[code] ?? (i < 6 ? 'Contending' : i < 15 ? 'Buying'
        : i >= 22 && (ownFirst || nearFirsts >= 3 || youth >= 4) && club.payroll < 220_000_000 ? 'Rebuilding' : 'Selling');
      const future = direction === 'Selling' || direction === 'Rebuilding';
      const protectedIds = ranked.slice(0, 5).filter(player => future ? age(player) <= 25 : ranked.indexOf(player) < 2).map(player => player.id);
      const shopping = ranked.filter(player => !protectedIds.includes(player.id) && !club.contracts?.get(player.id)?.deal.noTrade && (future ? age(player) >= 28 : ranked.indexOf(player) >= 8))
        .sort((a, b) => future ? (club.contracts?.get(b.id)?.deal.salary ?? 0) - (club.contracts?.get(a.id)?.deal.salary ?? 0) : 0)
        .slice(0, 4);
      return [code, { ...club, direction, protectedIds, shopping, rank: i + 1,
        reason: `No. ${i + 1} in projected strength · ${youth} young core players · ${nearFirsts} firsts over three drafts · ${club.injured} core players out` }];
    }));
  }

  function updateDirections(save, state) {
    const deadlineWeek = Math.floor(seasonSim.tradeDeadlineFor(save) / 7) * 7;
    const checkpoint = save.day >= deadlineWeek ? 'deadline' : Math.floor(save.day / 35);
    if (save.directionCheckpoint === checkpoint && save.teamDirections) return save;
    const boards = intel({ ...save, teamDirections: null }, state, code => teamFinance.report(save, state, code).contracts);
    const directions = Object.fromEntries([...boards].map(([code, board]) => [code, board.direction]));
    return { ...save, directionCheckpoint: checkpoint, teamDirections: directions };
  }

  function trade(save, state) {
    if (save.day > seasonSim.tradeDeadlineFor(save) || save.day % 21) return null;
    const clubs = league.teams.map(team => team.code).filter(code => code !== save.team);
    const ledgers = new Map(clubs.map(code => [code, teamFinance.report(save, state, code)]));
    const market = tradeValues.market(save, state, code => ledgers.get(code)?.contracts);
    const candidates = code => [...state.rosters.get(code)]
      .sort((a, b) => state.playerOveralls.get(b.id) - state.playerOveralls.get(a.id)).slice(3, 12)
      .filter(player => !ledgers.get(code).contracts.get(player.id)?.deal.noTrade
        && state.health.get(player.id).durability > 30
        && !save.financeActions.some(action => action.type === 'signing' && action.id === player.id
          && save.day - action.day < 90));
    const futurePicks = draftOps.futurePicks(save);
    const picksFor = code => market.boards.get(code).assets.filter(pick => pick.year <= draftOps.draftYear(save) + 3);
    const depth = new Map(clubs.map(code => [code, state.rosters.get(code).reduce((counts, player) => {
      const group = positionGroup(player);
      counts[group] = (counts[group] ?? 0) + 1;
      return counts;
    }, {})]));
    const lists = new Map(clubs.map(code => [code, candidates(code)]));
    const offers = [];
    for (let first = 0; first < clubs.length; first++) for (let second = first + 1; second < clubs.length; second++) {
      const team = clubs[first], otherTeam = clubs[second];
      for (const outgoing of lists.get(team)) for (const incoming of lists.get(otherTeam)) {
        const a = positionGroup(outgoing), b = positionGroup(incoming);
        if (a === b) continue;
        if (!market.accepts([outgoing.id], [incoming.id], otherTeam) || !market.accepts([incoming.id], [outgoing.id], team)) continue;
        const quality = state.playerOveralls.get(incoming.id) - state.playerOveralls.get(outgoing.id);
        const gain = quality + 4 * ((depth.get(team)[a] ?? 0) - (depth.get(team)[b] ?? 0) - 1);
        const otherGain = -quality + 4 * ((depth.get(otherTeam)[b] ?? 0) - (depth.get(otherTeam)[a] ?? 0) - 1);
        if (gain <= 0 || otherGain <= 0) continue;
        offers.push({ type: 'trade', team, otherTeam, id: outgoing.id, incoming: incoming.id,
          day: save.day, cpu: true, gain: gain + otherGain });
      }
    }
    for (const buyer of clubs.filter(code => ['Buying', 'Contending'].includes(market.boards.get(code).direction))) {
      const needs = market.boards.get(buyer).needs.slice(0, 2);
      for (const seller of clubs.filter(code => ['Selling', 'Rebuilding'].includes(market.boards.get(code).direction))) {
        for (const player of market.boards.get(seller).shopping) {
          const id = player.id;
          if (!needs.includes(positionGroup(player)) || ledgers.get(seller).contracts.get(id)?.deal.noTrade
            || (state.health.get(id)?.durability ?? 0) <= 30
            || save.financeActions.some(action => action.type === 'signing' && action.id === id && save.day - action.day < 90)) continue;
          const assets = picksFor(buyer);
          const packages = assets.flatMap((pick, index) => [[pick], ...assets.slice(index + 1).map(second => [pick, second])]);
          for (const pack of packages) {
            const picks = pack.map(pick => pick.key);
            const owners = Object.fromEntries(picks.map(key => [key, seller]));
            if (!draftOps.keepsFutureFirsts(save, futurePicks, owners, buyer)
              || !draftOps.keepsFutureFirsts(save, futurePicks, owners, seller)) continue;
            if (!market.accepts(picks, [id], seller) || !market.accepts([id], picks, buyer)) continue;
            const gain = market.total([id], buyer) - market.total(picks, buyer)
              + market.total(picks, seller) - market.total([id], seller);
            if (gain > 0) offers.push({ type: 'trade', team: seller, otherTeam: buyer, send: [id], receive: [],
              receivePicks: picks, day: save.day, cpu: true, gain, id });
          }
        }
      }
    }
    offers.sort((a, b) => b.gain - a.gain || a.team.localeCompare(b.team) || a.id.localeCompare(b.id));
    for (const { gain, ...action } of offers.slice(0, 20)) {
      const updated = { ...save, financeActions: [...save.financeActions, action] };
      if ([action.team, action.otherTeam].every(code => teamFinance.report(updated, state, code).available >= 0)) return action;
    }
    return null;
  }

  function manage(save, state) {
    if (save.market?.open || save.day >= seasonSim.playoffStart || save.cpuManagedDay === save.day) return save;
    let updated = updateDirections({ ...save, cpuManagedDay: save.day }, state);
    const signing = freeAgency.aiSigning(updated, state);
    if (signing) {
      updated.financeActions = [...updated.financeActions, { ...signing, cpu: true }];
      state = seasonSim.history(updated);
    }
    const exchange = trade(updated, state);
    if (exchange) {
      updated.financeActions = [...updated.financeActions, exchange];
      if (exchange.receivePicks?.length) updated.pickOwners = { ...updated.pickOwners,
        ...Object.fromEntries(exchange.receivePicks.map(key => [key, exchange.team])) };
      state = seasonSim.history(updated);
    }
    const clubs = league.teams.filter(team => team.code !== save.team);
    for (let index = 0; index < 3; index++) {
      const code = clubs[(Math.floor(save.day / 7) * 3 + index) % clubs.length].code;
      const config = arenaOps.settings(updated, save.day, code);
      const sponsor = Object.keys(config.ads.deals).length < 4
        ? sponsorCatalog.find(item => item.popularity === 0 && !config.ads.deals[item.category]) : null;
      const facility = config.training.level < 2 ? 'training' : config.clinic.level < 2 ? 'clinic' : 'parking';
      const action = sponsor ? { facility: 'ads', command: 'brand-sign', index: sponsor.name }
        : { facility, command: 'upgrade' };
      if (!sponsor && config[facility].level >= 3) continue;
      const purchase = arenaOps.change(updated, action, code);
      if (teamFinance.report(updated, state, code).available < purchase.cost + 15_000_000) continue;
      if (facility === 'training' && !sponsor) purchase.settings.training.days = [2, 4];
      updated.financeActions = [...updated.financeActions, { ...purchase, team: code, day: save.day, cpu: true }];
    }
    return updated;
  }
  return { manage, positionGroup, openingDepth, rosterValue, intel, updateDirections };
})();
