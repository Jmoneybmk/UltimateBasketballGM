const freeAgency = (() => {
  const minimum = 10;
  const maximum = 18;
  const cpuTarget = 15;
  const signingLimit = (save, code) => code === save.team ? maximum : cpuTarget;
  const codes = league.teams.map(team => team.code);
  const modelDeal = salary => ({
    salary, years: 1, raise: 0, guaranteed: 100, upfront: 25, bonus: 0, incentive: 0,
    option: 'None', noTrade: false, kicker: 0, perks: [],
  });
  const askingSalary = player => teamFinance.openingDeal(player).salary;
  const floor = 250_000;

  function offerValue(player, code, deal, save, history) {
    const established = (player.experience ?? 0) >= 7;
    const guaranteedValue = deal.salary * (0.48 + 0.52 * deal.guaranteed / 100)
      + deal.bonus / deal.years + deal.perks.reduce((sum, perk) => sum + teamFinance.perks[perk], 0) * 0.5;
    const rosterOverall = history.teamOveralls.get(code);
    const previousWins = save.previousWins?.[code] ?? 41;
    const contention = ((rosterOverall ?? 60) - 60) * (established ? 0.017 : 0.009)
      + (previousWins - 41) * (established ? 0.006 : 0.003);
    const relationship = code === save.team ? relationships.offerAdjustment(save, history, player, deal) : 0;
    if (relationship === -Infinity) return relationship;
    if (code === save.team && relationships.committed(save, history, player, deal)) return Infinity;
    return guaranteedValue / askingSalary(player) + contention
      + 0.018 * (deal.years - 1) + (established ? 0.10 : 0.18) * deal.upfront * deal.guaranteed / 10000
      + (save.market?.formerTeams[player.id] === code ? 0.055 : 0)
      + relationship + worldRelationships.offerFit(save, history, player.id, code) + (player.preferredTeam === code ? 0.04 : 0);
  }

  const reserve = (code, size, save) => Math.max(0, minimum - size) * teamFinance.signingCost(modelDeal(floor), code === save.team);
  function cpuDeal(code, salary, round) {
    const style = [...code].reduce((sum, letter) => sum + letter.charCodeAt(0), round);
    return { ...modelDeal(salary), upfront: [15, 20, 25, 30, 40, 100, 22, 35][style % 8],
      guaranteed: [100, 90, 100, 85, 100][style % 5], requirement: { kind: 'games', target: 35 + style % 15 } };
  }

  function checkInSeason(save, history, id, deal) {
    if (save.market?.qualifying?.[id] && !history.owners.has(id)) {
      throw new Error('This player remains restricted after the offseason market.');
    }
    const player = history.profiles.get(id);
    const value = player ? offerValue(player, save.team, deal, save, history) : -Infinity;
    if (player && value === -Infinity) throw new Error('The player declined because the offer conflicts with a pending promise.');
    if (value < 0.82) throw new Error('The player declined these terms.');
  }

  const talks = (save, kind, id) => save.negotiations?.[kind + ':' + id];
  function extensionStatus(save, history, id, contract) {
    if (history.owners.get(id) !== save.team) return 'Not eligible';
    if (save.farewellTours?.[id] === save.year) return 'Not eligible';
    if (save.extensions?.[id]) return 'Extension signed';
    if (save.market?.open || save.day > seasonSim.lastDay || ![1, 2].includes(contract?.deal.years)) return 'Not eligible';
    if (talks(save, 'extension', id)?.attempts >= 3) return 'Talks closed';
    const trust = relationships.playerScore(save, history, id);
    return save.day >= 30 || trust >= 55 ? 'Ready to negotiate' : 'Considering future';
  }

  function negotiate(save, history, kind, id, deal) {
    const player = history.profiles.get(id);
    if (!player || history.unavailable.has(id)) throw new Error('Player unavailable.');
    teamFinance.validateDeal(deal);
    if (deal.requests?.length) {
      deal = { ...deal, requests: relationships.validateOfferRequests(save, history, player, deal) };
    }
    teamFinance.enforcePlayerOffer(save, history, id, deal, kind === "extension");
    const prior = talks(save, kind, id);
    if (prior?.attempts >= 3) throw new Error('Talks are closed for this season.');
    if (kind === 'extension') {
      const report = teamFinance.report(save, history);
      if (extensionStatus(save, history, id, report.contracts.get(id)) !== 'Ready to negotiate') throw new Error('This player is not ready to extend.');
      if (deal.jersey != null) throw new Error('An extension keeps the player’s current jersey. Use the roster to change it.');
      const committed = Object.entries(save.extensions ?? {}).filter(([id]) => history.owners.get(id) === save.team)
        .reduce((sum, [, extension]) => sum + teamFinance.signingCost(extension, false), 0);
      if (committed + teamFinance.signingCost(deal, false) > report.available + teamFinance.mediaUpfront) {
        throw new Error('The projected opening budget cannot cover this extension.');
      }
    } else {
      if (history.owners.has(id) || save.draftRights?.[id] || !save.market?.open && save.day > seasonSim.lastDay) {
        throw new Error('This player is no longer available for an offer.');
      }
      if (deal.salary < floor) throw new Error('Offer at least $250,000 per year.');
      if (deal.jersey != null && !relationships.jerseyOpen(save, history, id, deal.jersey)) {
        throw new Error('That jersey number is taken or reserved in another offer.');
      }
      if (save.market?.open) submit(save, history, id, deal);
      else if (history.rosters.get(save.team).length >= maximum) throw new Error('Free up a roster spot first.');
    }
    const attempts = (prior?.attempts ?? 0) + 1;
    const value = offerValue(player, save.team, deal, save, history);
    const accepted = value >= 0.82;
    const commitment = relationships.commitment(save, history, player);
    const canCounter = !accepted && attempts < 3 && value !== -Infinity;
    const suggestedUpfront = canCounter && deal.upfront < commitment.upfront ? commitment.upfront : null;
    const counterValue = suggestedUpfront == null ? value :
      offerValue(player, save.team, { ...deal, upfront: suggestedUpfront }, save, history);
    const suggestedSalary = canCounter ? Math.max(deal.salary,
      Math.ceil((deal.salary + Math.max(0, 0.83 - counterValue) * askingSalary(player) /
        (0.48 + 0.52 * deal.guaranteed / 100)) / 1000) * 1000) : null;
    const message = accepted ? (kind === 'extension' ? 'Extension signed. It begins next season.' : save.market?.moratoriumDay <= 3
      ? 'Verbal agreement reached. The offer remains open until free agency.' : save.market?.open ? 'Offer accepted for market review.' : 'Offer accepted. Player signed.')
      : attempts === 3 ? 'Offer declined. Talks are closed for this season.'
        : value === -Infinity ? 'Offer declined. Revise the terms to honor the pending promises.'
          : `Counteroffer: ${suggestedSalary.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} per year${suggestedUpfront == null ? " on the same terms" : " with " + suggestedUpfront + "% of guaranteed salary paid upfront"}.`;
    return { attempts, accepted, message, deal, suggestedUpfront, suggestedSalary: accepted || attempts === 3 ? null : suggestedSalary };
  }

  function aiBids(save, history) {
    const unsigned = [...history.profiles.values()].filter(player => !save.market?.qualifying?.[player.id] && !history.owners.has(player.id) && !history.unavailable.has(player.id) && !save.draftRights?.[player.id]);
    if (!unsigned.length) return [];
    const need = code => {
      const roster = history.rosters.get(code);
      return Math.max(0, cpuTarget - roster.length) + roster.filter(player => history.health.get(player.id).durability <= 10).length * 0.6;
    };
    const clubs = codes.filter(code => code !== save.team && history.rosters.get(code).length < cpuTarget && need(code) >= 1)
      .sort((a,b) => need(b) - need(a) || (save.day + codes.indexOf(a)) % codes.length - (save.day + codes.indexOf(b)) % codes.length);
    const bids = [];
    for (const code of clubs.slice(0, 6)) {
      const ledger = teamFinance.report(save, history, code);
      const cash = ledger.available;
      const roster = history.rosters.get(code);
      const bestFit = unsigned.filter(player => askingSalary(player) <= cash)
        .sort((a, b) => cpuTeams.rosterValue(b, roster, history, save.teamDirections?.[code])
          - cpuTeams.rosterValue(a, roster, history, save.teamDirections?.[code])
          || a.id.localeCompare(b.id))[0];
      if (!bestFit) continue;
      const deal = cpuDeal(code, Math.min(cash, Math.round(askingSalary(bestFit) * (1 + need(code) * 0.025))), save.day);
      const score = offerValue(bestFit, code, deal, save, history);
      if (score >= 0.82 && cpuTeams.canSign(save, code, ledger, deal)) bids.push({ score, type: 'signing', inSeason: true, id: bestFit.id, team: code, deal, day: save.day });
    }
    return bids.sort((a,b) => b.score - a.score);
  }

  function aiSigning(save, history) {
    const best = aiBids(save, history)[0];
    if (!best) return null;
    const { score, ...action } = best;
    return action;
  }
  const signings = (save, history) => {
    const rosters = Object.fromEntries(Object.entries(save.startingRosters).map(([code, ids]) => [code, [...ids]]));
    const available = new Map(codes.map(code => [code, teamFinance.report(save, history, code).available]));
    const actions = [...save.financeActions];
    const results = [...save.market.results];
    const taken = new Set(history.owners.keys());
    function sign(player, code, deal, source, pursued = false) {
      rosters[code].push(player.id);
      available.set(code, available.get(code) - teamFinance.signingCost(deal, code === save.team));
      actions.push({ type: 'signing', day: 0, team: code, id: player.id, deal });
      results.push({ id: player.id, team: code, salary: deal.salary, years: deal.years, raise: deal.raise ?? 0, option: deal.option, pursued, source, round: save.market.round });
      taken.add(player.id);
    }
    return { rosters, available, actions, results, taken, sign };
  };

  function qualifyingCandidate(player, deal, service) {
    if (!deal || deal.years !== 1 || !Number.isFinite(service)) return false;
    const firstRound = player.draft?.pick > 0 && player.draft.pick <= 30;
    return deal.twoWay ? false : service <= 3 || (firstRound && service === 4);
  }

  function qualifyingDeal(deal) {
    return { ...modelDeal(Math.max(floor, Math.round(deal.salary * 1.25))), guaranteed: 100 };
  }

  function competingOffers(save, history, id, available) {
    const player = history.profiles.get(id);
    const market = save.market;
    if (!player || !market?.open || history.owners.has(id) || history.unavailable.has(id) || save.draftRights?.[id]) return [];
    const salary = askingSalary(player);
    const qualifying = market.qualifying?.[id];
    const rivals = codes.filter(code => code !== save.team && history.rosters.get(code).length < cpuTarget);
    const interested = rivals.sort((a, b) => (save.previousWins?.[b] ?? 0) - (save.previousWins?.[a] ?? 0)).slice(0, 3);
    const former = market.formerTeams[id];
    if (rivals.includes(former) && !interested.includes(former)) interested.push(former);
    const offers = market.offers[id] ? [{ code: save.team, deal: market.offers[id] }] : [];
    if (qualifying) offers.push({ ...qualifying, qualifying: true });
    for (const code of interested) {
      const room = (available ? available.get(code) : teamFinance.report(save, history, code).available)
        - reserve(code, history.rosters.get(code).length + 1, save);
      const variance = ([...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) + code.charCodeAt(0) * 7 + market.round * 13) % 21 / 100;
      const bid = Math.min(Math.floor(room), Math.round(salary * (0.87 + variance)));
      if (bid < salary * 0.7) continue;
      const deal = cpuDeal(code, bid, market.round);
      if (qualifying && code !== qualifying.code) deal.years = Math.max(2, deal.years);
      offers.push({ code, deal });
    }
    return offers.map(offer => ({ ...offer, score: offerValue(player, offer.code, offer.deal, save, history) }))
      .sort((a, b) => b.score - a.score);
  }

  function submit(save, history, id, deal) {
    if (save.market.timed && save.market.round > 12) throw new Error('All 12 free-agency days are complete.');
    if (!history.profiles.has(id) || history.unavailable.has(id) || history.owners.has(id) || save.draftRights?.[id]) throw new Error('This player is no longer a free agent.');
    teamFinance.validateDeal(deal);
    if (Object.keys(save.market.sheets ?? {}).length) throw new Error('Respond to pending offer sheets before submitting more offers.');
    const qualifying = save.market.qualifying?.[id];
    if (qualifying && qualifying.code !== save.team && deal.years < 2) throw new Error('An outside offer sheet requires at least two seasons.');
    if (deal.jersey != null && !relationships.jerseyOpen(save, history, id, deal.jersey)) {
      throw new Error('That jersey number is taken or reserved in another offer.');
    }
    if (deal.salary < floor) throw new Error('Offer at least $250,000 per year.');
    teamFinance.enforcePlayerOffer(save, history, id, deal);
    const offers = { ...save.market.offers, [id]: deal };
    const count = history.rosters.get(save.team).length;
    const total = Object.values(offers).reduce((sum, offer) => sum + teamFinance.signingCost(offer, true), 0);
    if (count + Object.keys(offers).length > maximum) throw new Error('Leave a roster spot for each open offer.');
    if (total + reserve(save.team, count + Object.keys(offers).length, save) > teamFinance.report(save, history).available) {
      throw new Error('The team cannot cover every open offer and its minimum roster budget.');
    }
    return { ...save, market: { ...save.market, offers } };
  }

  function acceptOffseason(save, history, id, deal) {
    return submit(save, history, id, deal);
  }

  function decideSheet(save, history, id, match) {
    const market = save.market;
    const sheet = market.sheets?.[id];
    if (!sheet || sheet.former !== save.team) throw new Error('Only the original team can respond to this sheet.');
    const { rosters, available, actions, results, sign } = signings(save, history);
    const code = match ? sheet.former : sheet.code;
    const deal = match ? { ...sheet.deal, jersey: undefined, requests: undefined } : sheet.deal;
    if (match) teamFinance.enforcePlayerOffer(save, history, id, deal);
    if (rosters[code].length >= signingLimit(save, code) || teamFinance.signingCost(deal, code === save.team) > available.get(code)) {
      throw new Error('The signing team needs an open roster spot and enough budget.');
    }
    sign(history.profiles.get(id), code, deal, match ? 'Offer sheet matched' : 'Offer sheet declined');
    const sheets = { ...market.sheets };
    delete sheets[id];
    return { ...save, startingRosters: rosters, financeActions: actions, market: { ...market, sheets, results } };
  }

  function resolve(save, history) {
    const market = save.market;
    if (Object.keys(market.sheets ?? {}).length) throw new Error('Respond to pending offer sheets first.');
    const ids = new Set([...Object.keys(market.offers), ...Object.keys(market.qualifying ?? {}).filter(id => !history.owners.has(id))]);
    if (!ids.size && !market.timed) throw new Error('Submit an offer before resolving the round.');
    for (const [id, deal] of Object.entries(market.offers)) teamFinance.enforcePlayerOffer(save, history, id, deal);
    const sheets = {};
    const reservedSlots = new Map();
    const marketState = signings(save, history);
    const { rosters, available, actions, results, sign } = marketState;
    const pendingCost = Object.values(market.offers).reduce((total, deal) => total + teamFinance.signingCost(deal, true), 0);
    if (pendingCost + reserve(save.team, rosters[save.team].length + Object.keys(market.offers).length, save) > available.get(save.team)) {
      throw new Error('Available cash changed. Withdraw or revise your open offers before resolving them.');
    }
    for (const id of ids) {
      const deal = market.offers[id];
      if (deal?.jersey != null && !relationships.jerseyOpen(save, history, id, deal.jersey)) {
        throw new Error('A requested jersey is unavailable. Revise the offer before resolving it.');
      }
      const player = history.profiles.get(id);
      const qualifying = market.qualifying?.[id];
      const canSign = (code, deal) => rosters[code].length + (reservedSlots.get(code) ?? 0) < signingLimit(save, code)
        && teamFinance.signingCost(deal, code === save.team) <= available.get(code)
        && (code === save.team || cpuTeams.canSign(save, code, {
          ...teamFinance.report({ ...save, financeActions: actions }, history, code), available: available.get(code),
        }, deal));
      const winner = competingOffers(save, history, id, available).find(offer => {
        if (!canSign(offer.code, offer.deal)) return false;
        if (offer.code !== save.team || deal) return true;
        try { teamFinance.enforcePlayerOffer(save, history, id, offer.deal); return true; }
        catch (error) {
          if (!error.message.startsWith('The CFO player allocation')) throw error;
          return false;
        }
      });
      if (winner && (winner.score >= 0.82 || winner.qualifying)) {
        if (qualifying && winner.code !== qualifying.code) {
          const former = qualifying.code;
          const matchedDeal = { ...winner.deal, jersey: undefined };
          if (former === save.team) {
            sheets[id] = { code: winner.code, former, deal: winner.deal, daysRemaining: 2 };
            reservedSlots.set(winner.code, (reservedSlots.get(winner.code) ?? 0) + 1);
            available.set(winner.code, available.get(winner.code) - teamFinance.signingCost(winner.deal, false));
          } else if (canSign(former, matchedDeal) && winner.deal.salary <= askingSalary(player) * 1.1) {
            sign(player, former, matchedDeal, 'Offer sheet matched');
          } else sign(player, winner.code, winner.deal, 'Offer sheet cleared');
        } else sign(player, winner.code, winner.deal, winner.qualifying ? 'Qualifying offer accepted' : 'Negotiated', Boolean(deal));
      } else results.push({ id, team: null, source: 'Declined all offers', pursued: Boolean(deal), round: market.round });
    }
    if (market.timed) signCpuFreeAgents(save, history, marketState, 5, reservedSlots);
    return { ...save, startingRosters: rosters, financeActions: actions,
      market: { ...market, round: market.round + 1, offers: {}, sheets, results } };
  }

  function close(save, history) {
    if (Object.keys(save.market.offers).length || Object.keys(save.market.sheets ?? {}).length) throw new Error('Resolve open offers and respond to offer sheets before closing the market.');
    const marketState = signings(save, history);
    const { rosters, available, actions, results, taken, sign } = marketState;
    const pool = [...history.profiles.values()].filter(player => !taken.has(player.id) && !history.unavailable.has(player.id) && !save.draftRights?.[player.id] && !save.market.qualifying?.[player.id]);
    for (const code of [save.team, ...codes.filter(code => code !== save.team)]) {
      const spots = Math.max(0, minimum - rosters[code].length);
      if (!spots) continue;
      const cashRoom = Math.floor(available.get(code) / spots) - teamFinance.signingCost(modelDeal(0), code === save.team);
      const limit = code === save.team ? save.cfoBudget?.[code]?.players : undefined;
      const budgetRoom = limit == null ? Infinity : Math.floor((limit - teamFinance.budgetUsage(save, history).players) / spots);
      const room = Math.min(cashRoom, budgetRoom);
      if (budgetRoom < floor) throw new Error('The CFO player allocation cannot cover the minimum roster.');
      if (room < floor || pool.length < spots) throw new Error('There is insufficient cash or available depth to fill every minimum roster.');
      for (let i = 0; i < spots; i++) {
        pool.sort((a, b) => (askingSalary(a) > room) - (askingSalary(b) > room)
          || Number(save.market.formerTeams[b.id] === code) - Number(save.market.formerTeams[a.id] === code)
          || askingSalary(a) - askingSalary(b));
        const player = pool.shift();
        sign(player, code, modelDeal(Math.min(room, askingSalary(player))), 'Depth signing');
      }
    }
    if (!save.market.timed) signCpuFreeAgents(save, history, marketState);
    return { ...save, startingRosters: rosters, financeActions: actions, market: { ...save.market, open: false, results } };
  }

  function signCpuFreeAgents(save, history, { rosters, available, actions, taken, sign }, limit = Infinity, reservedSlots = new Map()) {
    const ledgers = new Map(codes.filter(code => code !== save.team)
      .map(code => [code, teamFinance.report(save, history, code)]));
    const pool = [...history.profiles.values()].filter(player => !taken.has(player.id) && !history.unavailable.has(player.id)
      && !save.draftRights?.[player.id] && !save.market.qualifying?.[player.id] && !save.market.offers?.[player.id]);
    let signed = 0;
    for (const player of pool.sort((a, b) => askingSalary(b) - askingSalary(a))) {
      const salary = askingSalary(player);
      const offers = codes.filter(code => code !== save.team && rosters[code].length + (reservedSlots.get(code) ?? 0) < cpuTarget)
        .flatMap(code => {
          const bid = Math.min(salary, Math.floor(available.get(code)));
          if (bid < salary * 0.7) return [];
          const deal = cpuDeal(code, bid, save.market.round);
          return cpuTeams.canSign(save, code, ledgers.get(code), deal) ? [{ code, deal }] : [];
        });
      const score = offer => offerValue(player, offer.code, offer.deal, save, history);
      const winner = offers.sort((a, b) => score(b) - score(a))[0];
      if (winner && score(winner) >= 0.82) {
        sign(player, winner.code, winner.deal, 'Market signing');
        ledgers.set(winner.code, teamFinance.report({ ...save, financeActions: actions }, history, winner.code));
        if (++signed >= limit) break;
      }
    }
  }

  function apply(save, history, action) {
    if (!save.market?.open) throw new Error('Free agency is closed.');
    if (save.market.timed && save.market.round > 12 && ['offer', 'resolve'].includes(action.type)) throw new Error('All 12 free-agency days are complete.');
    if (save.market.timed && save.market.round <= 12 && action.type === 'close') throw new Error('Advance through all 12 free-agency days first.');
    if (action.type === 'offer') return submit(save, history, action.id, action.deal);
    if (action.type === 'withdraw-qualifying') {
      if (save.market.qualifying?.[action.id]?.code !== save.team || history.owners.has(action.id)
        || save.market.sheets?.[action.id]) throw new Error('This qualifying offer cannot be withdrawn.');
      const qualifying = { ...save.market.qualifying };
      delete qualifying[action.id];
      return { ...save, market: { ...save.market, qualifying } };
    }
    if (action.type === 'withdraw') {
      const offers = { ...save.market.offers };
      delete offers[action.id];
      return { ...save, market: { ...save.market, offers } };
    }
    if (save.market.moratoriumDay <= 3) {
      if (action.type !== 'resolve') throw new Error('Finish the three-day moratorium before closing free agency.');
      return { ...save, market: { ...save.market, moratoriumDay: save.market.moratoriumDay + 1 } };
    }
    if (action.type === 'sheet-day') {
      let next = save;
      for (const [id, sheet] of Object.entries(save.market.sheets ?? {})) {
        if ((sheet.daysRemaining ?? 2) <= 1) next = decideSheet(next, history, id, false);
      }
      const sheets = Object.fromEntries(Object.entries(next.market.sheets ?? {}).map(([id, sheet]) =>
        [id, { ...sheet, daysRemaining: (sheet.daysRemaining ?? 2) - 1 }]));
      return { ...next, market: { ...next.market, sheets } };
    }
    if (action.type === 'match' || action.type === 'decline-sheet') return decideSheet(save, history, action.id, action.type === 'match');
    if (action.type === 'resolve') return resolve(save, history);
    if (action.type === 'close') return close(save, history);
    throw new Error('Unknown free-agency action.');
  }

  return { apply, qualifyingCandidate, qualifyingDeal, competingOffers, askingSalary, minimum, maximum, cpuTarget, checkInSeason, aiSigning, aiBids, talks, extensionStatus, negotiate, acceptOffseason, modelDeal };
})();


