const relationships = (() => {
  const players = playerTools.registry;
  const reporters = league.teams.map((team, i) => ({ id: 'reporter-' + team.code, code: team.code,
    name: ['Alex Reed', 'Morgan Ellis', 'Taylor Ward', 'Jamie Quinn', 'Drew Carter', 'Riley Hayes'][i % 6] + ' · ' + team.code }));
  const hash = text => [...text].reduce((value, letter) => Math.imul(value, 31) + letter.charCodeAt(0) >>> 0, 7);
  const fans = league.teams.flatMap(team => ['Local', 'Away', 'League'].map((name, index) =>
    ({ id: 'fan-' + team.code + '-' + index, code: team.code, name })));
  const fanActivities = {
    meet: { label: 'Meet with supporters', cost: 0, reach: 0 },
    event: { label: 'Host a supporter event', cost: 75000, reach: 12 },
    gift: { label: 'Share team memorabilia', cost: 25000, reach: 5 },
  };
  const read = save => save.relationships ?? { contacts: {}, promises: [], jerseys: {}, log: [] };
  const phase = save => save.market?.open ? 'offseason' : 'season';
  const clock = save => save.market?.open ? save.market.round : save.day;
  const stamp = save => [save.year, phase(save), clock(save)].join('/');
  const score = (save, id, base) => read(save).contacts[id]?.score ?? base;
  const services = {
    Housing: 'Confirm housing arrangements',
    Transportation: 'Assign transportation',
    'Security Detail': 'Assign a security detail',
    'PR Team': 'Assign a PR team',
  };
  const endorsements = { 'Local retail': 45000, 'Sportswear': 90000 };
  const familyJobs = { 'Community outreach assistant': 65000, 'Game-day guest services assistant': 55000 };
  const external = kind => kind === 'endorsement' || kind === 'familyJob';
  const delivered = (save, id, kind, value) => {
    const record = arenaOps.settings(save).playerSupport[id];
    return Boolean(record?.[kind]?.includes(value) || kind === 'endorsement' && record?.brand?.includes(value));
  };
  const playerScore = (save, state, id) => score(save, id, state.owners.get(id) === save.team ? 43 : 29);
  const agent = id => nbaAgents[id] ?? { id: 'unlisted-agent-' + id, name: 'Unlisted representative' };
  const direct = (save, state, id) => playerScore(save, state, id) >= 55;
  const jersey = (save, id) => read(save).jerseys[id] ?? players.get(id)?.jersey ?? null;
  const jerseyNumber = value => /^(?:00|0|[1-9]\d?)$/.test(String(value ?? '')) ? String(value) : null;
  function historicalJerseyRetired(save, team, number) {
    const rows = typeof nbaTeamHistory === 'undefined' ? [] : nbaTeamHistory[team]?.jerseys ?? [];
    return number === '6' || !save.unretiredHistoricalJerseys?.[team]?.[number]
      && rows.some(([numbers]) => String(numbers).split(',').map(value => value.trim()).includes(number));
  }
  function jerseyOpen(save, state, id, number) {
    const requested = jerseyNumber(number);
    if (requested === null || (historicalJerseyRetired(save, save.team, requested) && jerseyNumber(jersey(save, id)) !== requested)
      || save.retiredJerseys?.[save.team]?.[requested]) return false;
    return !state.rosters.get(save.team).some(player => player.id !== id && jersey(save, player.id) != null
      && jerseyNumber(jersey(save, player.id)) === requested) &&
      !Object.entries(save.market?.open ? save.market.offers : {}).some(([other, offer]) =>
        other !== id && jerseyNumber(offer.jersey) === requested);
  }

  function demands(save, state, player) {
    const seed = hash(player.id);
    const trust = playerScore(save, state, player.id);
    const contender = (state.teamOveralls.get(save.team) ?? 60) >= 64 || (save.previousWins?.[save.team] ?? 41) >= 48;
    const upfront = Math.max(15, 25 + seed % 4 * 5 + (contender ? -5 : 10) - (trust >= 60 ? 10 : 0));
    const available = league.players.filter(candidate => candidate.id !== player.id && candidate.team && candidate.team === player.team
      && !state.owners.has(candidate.id));
    const family = player.name === 'LeBron James' ? league.players.find(candidate => candidate.name === 'Bronny James') : null;
    const familiar = worldRelationships.strongest(save, state, player.id, candidate => {
      const owner = state.owners.get(candidate.id);
      return !save.draftRights?.[candidate.id] && owner !== save.team
        && (!owner || !save.market?.open && save.day <= seasonSim.tradeDeadlineFor(save));
    })[0];
    const teammate = family ?? (familiar?.familiarity >= 12 ? familiar.player : null) ?? available[seed % available.length];
    const extra = (family || teammate && (seed % 3 === 0 || familiar?.familiarity >= 40)) ? { kind: 'teammate', value: teammate.id, label: `Sign ${teammate.name}` }
      : seed % 3 === 1 ? { kind: 'perk', value: Object.keys(teamFinance.perks)[Math.floor(seed / 3) % 6],
        label: 'Provide ' + Object.keys(teamFinance.perks)[Math.floor(seed / 3) % 6] }
        : { kind: 'jersey', value: jerseyNumber(player.jersey) ?? String(1 + seed % 33),
          label: 'Assign jersey #' + (jerseyNumber(player.jersey) ?? String(1 + seed % 33)) };
    const brands = arenaOps.settings(save).playerSupport[player.id]?.brand ?? [];
    const offers = sponsorCatalog.filter(item => player.attributes.Marketability >= item.marketability
      && !brands.some(name => sponsorCatalog.find(brand => brand.name === name)?.category === item.category));
    const endorsement = brands.length < 3 && offers.length ? offers[Math.floor(seed / 4) % offers.length].name
      : Object.keys(endorsements)[Math.floor(seed / 4) % 2];
    return [{ kind: 'upfront', value: upfront, label: `Pay at least ${upfront}% of guaranteed salary upfront` }, extra,
      ...(seed % 4 === 0 ? [{ kind: 'endorsement', value: endorsement,
        label: 'Arrange an endorsement with ' + endorsement }] : seed % 4 === 1 ? [{ kind: 'familyJob',
        value: Object.keys(familyJobs)[Math.floor(seed / 4) % 2], label: 'Hire a family member as ' + Object.keys(familyJobs)[Math.floor(seed / 4) % 2] }] : [])];
  }

  function meets(save, state, id, demand, deal) {
    if (external(demand.kind)) return delivered(save, id, demand.kind, demand.value);
    if (demand.kind === 'teammate') return state.owners.get(demand.value) === save.team;
    if (demand.kind === 'jersey') return deal
      ? jerseyNumber(deal.jersey) === jerseyNumber(demand.value) && jerseyOpen(save, state, id, demand.value)
      : state.owners.get(id) === save.team && jerseyNumber(jersey(save, id)) === jerseyNumber(demand.value);
    if (!deal && state.owners.get(id) === save.team) {
      if (Object.hasOwn(services, demand.value)) return delivered(save, id, 'service', demand.value);
      if (demand.value === 'Team Panel Ad') return Boolean(arenaOps.settings(save).ads.team?.players.includes(id));
      if (demand.value === 'Solo Panel Ad') return Boolean(arenaOps.settings(save).ads.solo?.players.includes(id));
      deal = teamFinance.report(save, state).contracts.get(id)?.deal;
    }
    if (demand.kind === 'upfront') return Boolean(deal && deal.guaranteed > 0 && deal.upfront >= demand.value);
    return Boolean(deal?.perks.includes(demand.value));
  }

  function fulfillment(save, state, id, demand) {
    if (state.unavailable.has(id) || demand.kind === "teammate" && state.unavailable.has(demand.value)) {
      return { blocked: "A player involved in this request has left the league." };
    }
    if (meets(save, state, id, demand)) return { ready: true, links: [] };
    const right = save.draftRights?.[id];
    if (right) return { blocked: right.team === save.team ? 'Use the fixed rookie contract on the Development Division screen.'
      : 'Another NBA team holds this player’s draft rights.' };
    const owner = state.owners.get(id);
    const market = Boolean(save.market?.open);
    const regular = save.day <= seasonSim.lastDay && !market;
    if (owner && owner !== save.team) return { blocked: 'This player is under contract with another team.' };
    const canSign = regular || market;
    if (!owner && !canSign) return { blocked: 'This player can sign when free agency opens.' };
    if (external(demand.kind)) {
      if (state.bracket?.champion) return { blocked: 'Player services reopen next season.' };
      return { links: [[demand.kind === 'endorsement' ? 'Arrange sponsor introduction' : 'Hire for the requested role', '#player-support/' + id]] };
    }
    if (demand.kind === 'perk' && owner && Object.hasOwn(services, demand.value)) {
      if (state.bracket?.champion) return { blocked: 'Player services reopen next season.' };
      const included = teamFinance.report(save, state).contracts.get(id)?.deal.perks.includes(demand.value);
      if (!included && !regular) return { blocked: 'Add this perk when contract revisions reopen.' };
      return { links: [included ? [services[demand.value], '#player-support/' + id] : ['Add the perk to the contract', '#contracts/' + id]] };
    }
    if (demand.kind === 'teammate') {
      const teammate = state.owners.get(demand.value);
      if (!teammate) return canSign ? { links: [['Offer the requested player a deal', '#free-agency/' + demand.value]] }
        : { blocked: 'The requested player can sign when free agency opens.' };
      if (!regular || save.day > seasonSim.tradeDeadlineFor(save)) return { blocked: 'The requested player is on another team and trades are closed.' };
      if (teamFinance.report(save, state, teammate).contracts.get(demand.value)?.deal.noTrade) {
        return { blocked: 'The requested player has a no-trade clause.' };
      }
      return { links: [['Choose a trade package', '#pick/send/' + teammate + '/' + demand.value]] };
    }
    if (demand.kind === 'jersey') {
      const number = jerseyNumber(demand.value);
      const holder = state.rosters.get(save.team).find(player => player.id !== id && jerseyNumber(jersey(save, player.id)) === number);
      const reservedBy = Object.entries(market ? save.market.offers : {}).find(([other, deal]) =>
        other !== id && jerseyNumber(deal.jersey) === number)?.[0];
      return { links: [
        ...(holder ? [[`Change ${holder.name}’s number`, '#jersey/' + holder.id]] : []),
        ...(reservedBy ? [['Edit the offer reserving this number', '#free-agency/' + reservedBy]] : []),
        owner ? ['Assign jersey number', '#jersey/' + id] : ['Include the number in an offer', '#free-agency/' + id],
      ] };
    }
    if (owner && ['Team Panel Ad', 'Solo Panel Ad'].includes(demand.value)) {
      const type = demand.value === 'Team Panel Ad' ? 'team' : 'solo';
      const featured = arenaOps.settings(save).ads[type]?.players ?? [];
      if (state.bracket?.champion) return { blocked: 'Campaigns reopen next season.' };
      return { links: [['Set up the required panel', '#ads/' + type + '/' + [...new Set([...featured, id])].join(',')]] };
    }
    if (owner && !regular) return { blocked: 'Revised roster contracts open during the regular season.' };
    return { links: [owner ? ['Revise contract terms', '#contracts/' + id] : ['Include the terms in an offer', '#free-agency/' + id]] };
  }

  function commitment(save, state, player) {
    const requests = read(save).contacts[player.id]?.demands ?? demands(save, state, player);
    const discount = ((state.teamOveralls.get(save.team) ?? 60) - 60) * 0.02
      + (playerScore(save, state, player.id) - 29) * 0.004;
    return { salary: Math.max(250000, Math.ceil(freeAgency.askingSalary(player) * Math.max(0.9, 1.4 - discount) / 10000) * 10000),
      upfront: requests.find(item => item.kind === 'upfront')?.value ?? 25, requests };
  }

  function validateOfferRequests(save, state, player, deal) {
    const requested = deal.requests ?? [];
    const available = commitment(save, state, player).requests;
    const seen = new Set();
    for (const { kind, days } of requested) {
      const demand = available.find(item => item.kind === kind);
      if (!demand || !['teammate', 'endorsement', 'familyJob', 'perk'].includes(kind)
        || seen.has(kind) || !Number.isInteger(days) || days < 1 || days > 30) {
        throw new Error('Choose a valid player request and a delivery window of 1–30 days.');
      }
      const path = fulfillment(save, state, player.id, demand);
      if (path.blocked) throw new Error(path.blocked);
      seen.add(kind);
    }
    return requested.map(({ kind, days }) => ({ ...available.find(item => item.kind === kind), days }));
  }

  function committed(save, state, player, deal) {
    const quote = commitment(save, state, player);
    return deal.years === 1 && deal.guaranteed === 100 && deal.salary >= quote.salary
      && quote.requests.every(item => meets(save, state, player.id, item, deal));
  }

  function verbal(save, id, demand) {
    const agreement = read(save).contacts[id]?.verbal?.[demand.kind];
    return agreement?.year === save.year && agreement.phase === phase(save) && agreement.value === demand.value;
  }

  function offerAdjustment(save, state, player, deal) {
    const data = read(save);
    const trust = playerScore(save, state, player.id);
    const preferences = data.contacts[player.id]?.demands ?? (deal.requests?.length ? demands(save, state, player) : []);
    const promises = data.promises.filter(promise => promise.id === player.id && promise.status !== 'broken');
    if (promises.some(promise => promise.status === 'pending' && promise.kind !== 'teammate'
      && !promise.fromSigning && !meets(save, state, player.id, promise, deal))) return -Infinity;
    const boost = preferences.reduce((value, demand) => {
      if (meets(save, state, player.id, demand, deal)) return value + 0.10;
      return value + (deal.requests?.some(item => item.kind === demand.kind && item.value === demand.value) ? 0.03 : -0.055);
    }, 0);
    const pending = promises.some(promise => promise.status === 'pending' &&
      (promise.kind === 'teammate' || meets(save, state, player.id, promise, deal)));
    const history = data.promises.filter(promise => promise.id === player.id && promise.status !== 'pending');
    const memory = history.slice(-4).reduce((value, promise) => value + (promise.status === 'kept' ? 0.025 : -0.04), 0);
    return (trust - 29) * 0.005 + boost + memory + (pending ? 0.08 : 0);
  }

  function copy(save) {
    const existing = read(save);
    return { ...existing, contacts: { ...existing.contacts }, promises: existing.promises.map(promise => ({ ...promise })),
      jerseys: { ...existing.jerseys }, log: [...existing.log] };
  }
  const log = (data, save, text) => data.log.push({ year: save.year, day: save.day, phase: phase(save), tick: clock(save), text });
  const bump = (data, id, base, amount) => {
    const previous = data.contacts[id] ?? {};
    data.contacts[id] = { ...previous, score: Math.max(0, Math.min(100, (previous.score ?? base) + amount)) };
  };

  const interviewAnswers = {
    respect: { label: 'Credit both organizations', gm: 5, fans: 1, team: 2 },
    team: { label: 'Credit our players and supporters', gm: 0, fans: 4, team: 3 },
    criticize: { label: 'Criticize the other front office', gm: -8, fans: 2, team: -2 },
  };

  function interview(save, state) {
    if (save.day >= seasonSim.playoffStart) {
      const interviews = read(save).interviews ?? {};
      const prefix = [save.year, save.team].join('/') + '/';
      const previousTrade = Object.keys(interviews).findLast(key => key.startsWith(prefix) && key.split('/')[3] === 'trade');
      const key = prefix + 'postseason-review';
      if (previousTrade && !interviews[key]) {
        const other = previousTrade.split('/')[4];
        const result = state.bracket?.rounds?.[0]?.some(series => [series.home, series.away].includes(save.team))
          ? 'as the playoffs begin' : 'now that the regular season is over';
        return { key, other, question: 'You spoke about the ' + other + ' trade earlier this year. How do you assess it ' + result + '?' };
      }
    }
    const games = state.results.filter(game => game.home === save.team || game.away === save.team);
    const game = games.findLast((entry, index) =>
      (index + 1) % 5 === 0 || Math.abs(entry.homeScore - entry.awayScore) >= 25);
    const trade = [...save.financeActions].reverse().find(action =>
      action.type === 'trade' && action.otherTeam && (action.team ?? save.team) === save.team);
    const isTrade = trade && (!game || trade.day >= game.day);
    const event = isTrade ? trade : game;
    if (!event || save.day - event.day > 7) return null;
    const other = isTrade ? trade.otherTeam : game.home === save.team ? game.away : game.home;
    const key = [save.year, save.team, event.day, isTrade ? 'trade' : 'game', other].join('/');
    if (read(save).interviews?.[key]) return null;
    const club = league.teams.find(team => team.code === other)?.name ?? other;
    return { key, other, question: (isTrade ? 'How do you assess the trade with ' :
      'What did you take away from the game against ') + club + '?' };
  }

  function reporterAvailable(save, id, state = seasonSim.history(save)) {
    const reporter = reporters.find(entry => entry.id === id);
    return Boolean(reporter && (reporter.code === save.team || score(save, 'reporter-' + save.team, 42) >= 55
      && worldRelationships.reporterSource(save, state, reporter.code, save.team) >= 28));
  }

  function assessment(save, state, role, person) {
    const roster = state.rosters.get(save.team);
    const unavailable = roster.filter(player => state.health.get(player.id).durability <= 10);
    const worn = roster.filter(player => state.health.get(player.id).fatigue < 60);
    const staff = staffSim.effects(save, save.team);
    const note = ['Head Medical Staff', 'Assistant Head Medical Staff'].includes(role)
      ? unavailable.length ? `${unavailable.length} players are unavailable. Review recovery dates in the Team Clinic.` : 'The rotation has no unavailable players today.'
      : ['Head of Player Development', 'Assistant Player Development Coach'].includes(role)
        ? worn.length ? `${worn.length} players are below 60 fatigue. Consider resting them before adding drills.`
          : `The training staff can add ${staff.trainingGain.toFixed(2)} to the base drill gain.`
        : ['Head Scout', 'Assistant Head Scout'].includes(role)
          ? `Scouting evaluation is ${staff.scouting}/100. Player cards show the strongest skills your scouts can identify.`
          : role === 'CFO' ? `The bank has $${teamFinance.report(save, state).available.toLocaleString('en-US')} available after reserves.`
            : role === 'Assistant GM' ? `The roster has ${roster.length} players and a ${(state.teamOveralls.get(save.team) ?? 0).toFixed(2)} overall.`
              : worn.length ? `${worn.length} players are below 60 fatigue. Check projected minutes before simulating.`
                : `The staff’s tactical ratings adjust offense by ${staff.attack.toFixed(2)} and defense by ${staff.defense.toFixed(2)}.`;
    return `${person.name}: ${note}`;
  }

  function apply(save, state, action) {
    const data = copy(save);
    const player = state.profiles.get(action.id);
    if (player && state.unavailable.has(player.id)) throw new Error("This player has left the league.");
    if (action.type === 'talk' && player) {
      if (action.channel !== 'agent' && !direct(save, state, player.id)) throw new Error('Contact the player through their agent first.');
      const old = data.contacts[player.id];
      const sameDay = old?.last === stamp(save);
      const base = state.owners.get(player.id) === save.team ? 43 : 29;
      const representative = agent(player.id);
      if (!sameDay) {
        const bonus = action.channel === 'agent' && score(save, representative.id, 35) >= 55 ? 2 : 0;
        bump(data, player.id, base, (action.channel === 'agent' ? 5 : 8) + bonus);
        if (action.channel === 'agent') bump(data, representative.id, 35, 5);
      }
      data.contacts[player.id] = { ...data.contacts[player.id], last: stamp(save),
        demands: old?.last === stamp(save) ? old.demands : demands(save, state, player) };
      if (!sameDay) log(data, save, `Discussed terms with ${action.channel === 'agent' ? representative.name + ' for ' : ''}${player.name}.`);
    } else if (action.type === 'verbal' && player) {
      const contact = data.contacts[player.id];
      const demand = contact?.demands?.find(item => item.kind === action.kind);
      if (!demand) throw new Error('Discuss terms first.');
      const path = fulfillment(save, state, player.id, demand);
      if (path.blocked) throw new Error(path.blocked);
      if (verbal(save, player.id, demand)) throw new Error('You already have a verbal agreement.');
      data.contacts[player.id] = { ...contact, verbal: { ...contact.verbal, [action.kind]: {
        year: save.year, phase: phase(save), value: demand.value } } };
      log(data, save, 'Reached a verbal agreement with ' + player.name + ': ' + demand.label);
    } else if (action.type === 'promise' && player) {
      const demand = data.contacts[player.id]?.demands.find(item => item.kind === action.kind);
      if (!demand || !verbal(save, player.id, demand)) throw new Error('Reach a verbal agreement on this request first.');
      const path = fulfillment(save, state, player.id, demand);
      if (path.blocked) throw new Error(path.blocked);
      if (data.promises.some(item => item.id === player.id && item.kind === demand.kind && item.year === save.year)) {
        throw new Error('You already made this commitment this season.');
      }
      let due = clock(save) + (save.market?.open ? 2 : 7);
      if (demand.kind === 'teammate' && action.deadline != null) {
        const start = Date.parse(seasonSim.date(0, save.year));
        due = save.market?.open ? Number(action.deadline) : (Date.parse(action.deadline) - start) / 86400000;
        const last = save.market?.open ? clock(save) + 14 : seasonSim.lastDay;
        if (!action.deadline || !Number.isInteger(due) || due < clock(save) || due > last) {
          throw new Error('Choose a valid deadline within this negotiation period.');
        }
      }
      data.promises.push({ ...demand, id: player.id, year: save.year, phase: phase(save),
        due, status: 'pending' });
      log(data, save, `Promised ${player.name}: ${demand.label}.`);
    } else if (action.type === 'jersey' && player && state.owners.get(player.id) === save.team) {
      if (!jerseyOpen(save, state, player.id, action.number)) {
        throw new Error('Choose an unused jersey number: 00 or 0 through 99.');
      }
      data.jerseys[player.id] = jerseyNumber(action.number);
    } else if (action.type === 'fan-talk') {
      const fan = fans.find(item => item.id === action.id);
      if (!fan || !fanAvailable(save, state, fan)) throw new Error('This fan contact is still locked.');
      if (data.contacts[fan.id]?.last === stamp(save)) return save;
      const response = { meet: [5, 'Met with'], event: [7, 'Organized an event with'], gift: [4, 'Shared team memorabilia with'] }[action.value ?? 'meet'];
      if (!response) throw new Error('Choose a fan conversation response.');
      bump(data, fan.id, fan.code === save.team ? 40 : 20, response[0]);
      data.contacts[fan.id].last = stamp(save);
      log(data, save, response[1] + ' ' + fan.name.toLowerCase() + ' fans.');
    } else if (action.type === 'start-project' && player && state.owners.get(player.id) === save.team) {
      if (playerScore(save, state, player.id) < 55) throw new Error('Build at least 55 trust before proposing a project.');
      if (organizations(save, state).some(item => item.player === player.id)) throw new Error('This player already has an organization.');
      bump(data, player.id, 43, 3);
      data.contacts[player.id].project = true;
      log(data, save, player.name + ' agreed to start a community organization.');
    } else if (action.type === 'interview') {
      const prompt = interview(save, state);
      const answer = interviewAnswers[action.value];
      if (!prompt || !Object.hasOwn(interviewAnswers, action.value) || action.id !== 'reporter-' + save.team) {
        throw new Error('This interview is unavailable.');
      }
      data.interviews = { ...read(save).interviews, [prompt.key]: action.value };
      bump(data, action.id, 42, 4);
      for (const fan of fans.filter(item => item.code === save.team)) bump(data, fan.id, 40, answer.fans);
      for (const player of state.rosters.get(save.team)) bump(data, player.id, 43, answer.team);
      for (const person of Object.values(staffSim.assignments(save, save.team, staffSim.roles))) bump(data, person.id, 48, answer.team);
      log(data, save, 'Press interview · ' + answer.label);
      const trust = worldRelationships.gmTrust(save, prompt.other);
      return { ...save, relationships: data, gmTrust: { ...save.gmTrust,
        [prompt.other]: Math.max(0, Math.min(100, trust + answer.gm)) } };
    } else if (action.type === 'staff-talk' || action.type === 'reporter-talk') {
      const isStaff = action.type === 'staff-talk';
      const staffEntry = isStaff ? Object.entries(staffSim.assignments(save, save.team, staffSim.roles))
        .find(([, person]) => person.id === action.id) : null;
      const person = isStaff ? staffEntry?.[1] : reporters.find(item => item.id === action.id);
      if (!person || !isStaff && !reporterAvailable(save, action.id, state)) throw new Error('This contact is unavailable.');
      if (data.contacts[action.id]?.last === stamp(save)) return save;
      bump(data, action.id, isStaff ? 48 : person.code === save.team ? 42 : 18, isStaff ? 4 : 5);
      data.contacts[action.id].last = stamp(save);
      const advice = isStaff ? assessment(save, state, staffEntry[0], person)
        : `${person.name} covered your ${state.records[save.team].wins}–${state.records[save.team].losses} team.`;
      log(data, save, advice);
    } else throw new Error('Choose an available conversation action.');
    return { ...save, relationships: data };
  }

  function organizations(save, state) {
    const clubs = league.teams.map(team => ({ id: 'community-' + team.code, name: team.name + ' Community Program',
      team: team.code, mission: 'Local youth basketball and community programs.' }));
    const projects = [...state.profiles.values()].flatMap(player => {
      if (state.unavailable.has(player.id)) return [];
      const name = (players.get(player.id)?.name ?? player.name).normalize('NFD').replace(/\p{M}/gu, '');
      if (name === 'Luka Doncic') return [{ id: 'project-' + player.id, name: 'Luka Dončić Foundation',
        player: player.id, team: state.owners.get(player.id), source: 'https://lukadoncicfoundation.org/',
        mission: 'Youth development through sports. Donations here are simulated.' }];
      const custom = read(save).contacts[player.id]?.project;
      const featured = ['LeBron James', 'Stephen Curry'].includes(name);
      const seed = hash(player.id);
      if (!custom && !featured && (player.attributes.Marketability < 70 || seed % 6 !== 0)) return [];
      const opens = featured ? 14 : 21 + seed % 100;
      if (!custom && save.year === 0 && save.day < opens) return [];
      return [{ id: 'project-' + player.id, name: player.name + ' ' + ['Hoops Foundation', 'Youth Sports Fund', 'Community Courts Initiative', 'Basketball Access Network', 'Next Generation Academy'][seed % 5], player: player.id,
        team: state.owners.get(player.id), mission: 'Modeled player-led youth basketball and equipment grants.' }];
    });
    const partners = league.teams.flatMap(team => [
      ['clinics', 'Youth Hoops Clinics', 'Local', 'Community coaching and gym access.'],
      ['travel', 'Traveling Supporters Network', 'Away', 'Travel coordination and road meetups.'],
      ['access', 'Basketball Access Fund', 'League', 'Equipment grants and accessible basketball programs.'],
    ].map(([suffix, name, audience, mission]) => ({
      id: 'outreach-' + team.code + '-' + suffix, team: team.code, name: team.name + ' ' + name, audience, mission,
    })));
    return [...clubs, ...partners, ...projects];
  }

  function network(save, state, id) {
    const player = state.profiles.get(id);
    if (!player) return [];
    const club = state.owners.get(id);
    const representative = agent(id);
    const connections = [
      { type: 'Representative', name: representative.name, detail: representative.agency, href: '#contact/' + id },
      ...(representative.coAgent ? [{ type: 'Co-representative', name: representative.coAgent, href: '#contact/' + id }] : []),
      { type: 'Front office', name: 'Your GM', detail: playerScore(save, state, id) + '/100 trust', href: '#contact/' + id },
    ];
    for (const member of state.profiles.values()) {
      const link = worldRelationships.family(player, member);
      if (link) connections.push({ type: 'Family', name: member.name, detail: link.detail, source: link.source, href: '#player/' + member.id });
    }
    for (const client of state.profiles.values()) {
      if (client.id === id || state.unavailable.has(client.id) || agent(client.id).id !== representative.id) continue;
      connections.push({ type: 'Shared agent', name: client.name, href: '#player/' + client.id });
    }
    if (club) {
      const team = league.teams.find(item => item.code === club);
      connections.push({ type: 'Team', name: team.name, href: '#team/' + club });
      const coach = staffSim.assignments(save, club, staffSim.roles)['Head Coach'];
      if (coach) connections.push({ type: 'Staff', name: coach.name, detail: 'Head coach', href: club === save.team ? '#staff' : '#team/' + club });
      const reporter = reporters.find(item => item.code === club);
      if (reporter) connections.push({ type: 'Coverage', name: reporter.name,
        detail: reporterAvailable(save, reporter.id, state) ? 'Contact available' : 'Name known · contact locked', href: '#relationships' });
      for (const fan of fans.filter(item => item.code === club)) {
        connections.push({ type: 'Supporter', name: fan.name,
          detail: fanAvailable(save, state, fan) ? 'Contact available' : 'Contact locked', href: '#relationships' });
      }
      for (const teammate of state.rosters.get(club)) if (teammate.id !== id) {
        const familiarity = worldRelationships.familiarity(save, state, id, teammate.id);
        connections.push({ type: 'Teammate', name: teammate.name, detail: familiarity + '/100 familiarity', href: '#player/' + teammate.id });
      }
    }
    for (const entry of worldRelationships.strongest(save, state, id, candidate => !club || state.owners.get(candidate.id) !== club).slice(0, 8)) {
      connections.push({ type: 'Former teammate', name: entry.player.name, detail: entry.familiarity + '/100 familiarity', href: '#player/' + entry.player.id });
    }
    for (const organization of organizations(save, state)) {
      if (organization.player !== id && (organization.player || organization.team !== club)) continue;
      connections.push({ type: 'Organization', name: organization.name, detail: organization.player ? 'Player-led project' : 'Team community program',
        href: '#organizations/' + organization.id });
    }
    return connections;
  }

  function donationImpact(save, organization, amount) {
    const previous = save.financeActions.filter(action => action.organization === organization.id).reduce((sum, action) => sum + action.cost, 0);
    const points = total => Math.min(8, Math.floor(total / 25000));
    return points(previous + amount) - points(previous);
  }

  function recordDonation(save, state, action) {
    const organization = organizations(save, state).find(item => item.id === action.organization);
    const points = donationImpact(save, organization, action.cost);
    const data = copy(save);
    if (points) {
      bump(data, organization.id, 25, points);
      if (organization.player) bump(data, organization.player, playerScore(save, state, organization.player), points);
    }
    log(data, save, 'Donated $' + action.cost.toLocaleString('en-US') + ' to ' + organization.name + (points ? ' · +' + points + ' relationship' : ''));
    return data;
  }

  function settle(save, state, oldSave = save, closing = false, extension = null) {
    const existing = read(save);
    if (!extension && !existing.promises.some(item => item.status === 'pending') && save.financeActions.length === oldSave.financeActions.length) return save;
    const data = copy(save);
    const newActions = save.financeActions.slice(oldSave.financeActions.length);
    const agreements = extension ? [...newActions, extension] : newActions;
    for (const action of agreements) {
      if ((action.type === 'signing' || action.type === 'extension') && action.team === save.team) {
        for (const request of action.deal.requests ?? []) {
          const startsNextSeason = action.type === 'extension' && request.kind === 'perk';
          if (data.promises.some(item => item.id === action.id && item.kind === request.kind
            && item.value === request.value && item.status === 'pending')) continue;
          data.promises.push({ ...request, id: action.id, year: save.year, phase: phase(save),
            due: clock(save) + request.days, status: 'pending', fromSigning: true,
            ...(startsNextSeason ? { startYear: save.year + 1 } : {}) });
          log(data, save, 'Contract commitment · ' + request.label);
        }
      }
      if (action.type === 'cut') delete data.jerseys[action.id];
      if (action.type === 'trade') for (const id of seasonSim.tradePlayers(action)[0]) delete data.jerseys[id];
    }
    const arrivals = newActions.flatMap(action => action.type === 'signing' && action.team === save.team
      ? [{ id: action.id, number: jerseyNumber(action.deal.jersey) }]
      : action.type === 'trade' ? seasonSim.tradePlayers(action)[1].map(id => ({ id, number: null })) : []);
    const arrivalIds = new Set(arrivals.map(entry => entry.id));
    const reserved = new Set(state.rosters.get(save.team).filter(player => !arrivalIds.has(player.id))
      .map(player => jerseyNumber(data.jerseys[player.id] ?? player.jersey)));
    for (const entry of arrivals.filter(entry => entry.number !== null)) {
      if (reserved.has(entry.number)) throw new Error(`Jersey #${entry.number} became unavailable. Revise the signing.`);
      data.jerseys[entry.id] = entry.number;
      reserved.add(entry.number);
    }
    for (const entry of arrivals.filter(entry => entry.number === null)) {
      const preferred = jerseyNumber(state.profiles.get(entry.id)?.jersey);
      const number = preferred !== null && !reserved.has(preferred) ? preferred
        : Array.from({ length: 100 }, (_, i) => String(i)).find(value => !reserved.has(value));
      data.jerseys[entry.id] = number;
      reserved.add(number);
    }
    for (const action of newActions) {
      if (action.type === 'contract' && action.deal.jersey != null) data.jerseys[action.id] = jerseyNumber(action.deal.jersey);
    }
    for (const [team, roster] of state.rosters) {
      const used = new Set();
      const incoming = new Set(newActions.flatMap(action => {
        if (action.type === 'signing' && action.team === team) return [action.id];
        if (action.type === 'trade') {
          if (action.otherTeam === team) return seasonSim.tradePlayers(action)[0];
          if ((action.team ?? save.team) === team) return seasonSim.tradePlayers(action)[1];
        }
        return [];
      }));
      const needsNumber = [];
      const retired = number => historicalJerseyRetired(save, team, number) || save.retiredJerseys?.[team]?.[number];
      for (const player of roster) {
        const number = jerseyNumber(data.jerseys[player.id] ?? player.jersey);
        if (number === null || used.has(number) || (incoming.has(player.id) && retired(number))) needsNumber.push(player);
        else used.add(number);
      }
      for (const player of needsNumber) {
        const number = Array.from({ length: 101 }, (_, i) => i === 100 ? '00' : String(i))
          .find(value => !used.has(value) && !retired(value));
        if (number === undefined) continue;
        data.jerseys[player.id] = number;
        used.add(number);
      }
    }
    for (const promise of data.promises) {
      if (promise.status !== 'pending' || promise.startYear > save.year) continue;
      if (promise.startYear && promise.year < save.year) {
        promise.year = save.year;
        promise.phase = phase(save);
        promise.due = clock(save) + promise.days;
      }
      if (promise.fromSigning && promise.year === save.year && promise.phase === 'offseason'
        && oldSave.market?.open && !save.market?.open) {
        promise.phase = 'season';
        promise.due = save.day + Math.max(0, promise.due - clock(oldSave));
      }
      const periodChanged = promise.year !== save.year || promise.phase !== phase(save);
      const expired = closing || periodChanged || clock(save) > promise.due;
      const kept = meets({ ...save, relationships: data }, state, promise.id, promise);
      if (!kept && !expired) continue;
      promise.status = kept ? 'kept' : 'broken';
      const base = state.owners.get(promise.id) === save.team ? 43 : 29;
      bump(data, promise.id, base, kept ? 16 : -28);
      bump(data, agent(promise.id).id, 35, kept ? 4 : -7);
      log(data, save, `${kept ? 'Kept' : 'Broke'} promise to ${players.get(promise.id).name}: ${promise.label}.`);
    }
    return { ...save, relationships: data };
  }

  function fanAvailable(save, state, fan) {
    return fan.code === save.team || reporterAvailable(save, 'reporter-' + fan.code, state);
  }

  return { read, apply, settle, organizations, network, donationImpact, recordDonation, services, endorsements, familyJobs, delivered, verbal, commitment, committed, validateOfferRequests, score, playerScore, agent, direct, jersey, jerseyNumber, historicalJerseyRetired, jerseyOpen, fans, fanAvailable,
    reporterAvailable, reporters, fanActivities, assessment, interview, interviewAnswers, offerAdjustment, fulfillment };
})();
