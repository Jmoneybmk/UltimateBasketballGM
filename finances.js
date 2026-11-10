const teamFinance = (() => {
  const openingCash = 330_000_000;
  const defaultUpfront = 25;
  const operationsPerDay = 32_000;
  const drillCost = 2_000;
  const mediaDistribution = Math.round(76_000_000_000 / 11 / league.teams.length);
  const mediaUpfront = Math.floor(mediaDistribution / 2);
  const mediaRollover = mediaDistribution - mediaUpfront;
  const gmSalary = 5_000_000;
  const activities = {
    dinner: { name: 'Team dinner', cost: 12000, recovery: 0, morale: 1 },
    spa: { name: 'Spa recovery day', cost: 24000, recovery: 15, morale: 0 },
    outreach: { name: 'Community basketball clinic', cost: 18000, recovery: -8, morale: 1.5 },
  };
  const dailyCommercialIncome = 85000;
  const clubAwardRates = {
    mvp: ['MVP', 1000000], dpoy: ['Defensive Player of the Year', 500000], rookie: ['Rookie of the Year', 450000],
    mostImproved: ['Most Improved Player', 350000], sixthMan: ['Sixth Man of the Year', 300000],
    clutch: ['Clutch Player of the Year', 300000], coach: ['Coach of the Year', 350000],
    executive: ['Executive of the Year', 350000], allStar: ['All-Star selection', 150000],
    allNBA: ['All-NBA', [400000, 250000, 150000]], allDefense: ['All-Defensive', [200000, 125000]],
    allRookie: ['All-Rookie', [150000, 100000]], eastFinals: ['East Finals MVP', 350000],
    westFinals: ['West Finals MVP', 350000], finals: ['Finals MVP', 750000],
  }; 
  // Published 2025 Player Playoff Pool rates, used as the franchise baseline.
  const playoffPool = {
    league: 869345,
    conference: [760816, 608648, 456480, 372276, 288072, 203869],
    rounds: [466263, 568095, 950726],
    runnerUp: 3802900,
    champion: 8805259,
  };
  const homeRevenue = { Tickets: 1_250_000, 'Parking Lot': 65_000, 'Merch Stalls': 110_000,
    'Food Stalls': 145_000, VIP: 240_000, Advertising: 95_000 };
  const perks = { Housing: 175_000, Transportation: 55_000, 'Security Detail': 120_000, 'PR Team': 95_000,
    'Team Panel Ad': 75_000, 'Solo Panel Ad': 180_000 };
  const conditions = {
    games: 'Minimum games played', injuries: 'Maximum games missed due to injury', minutes: 'Minimum minutes played',
    wins: 'Minimum team wins', points: 'Minimum points per game', rebounds: 'Minimum rebounds per game',
    assists: 'Minimum assists per game', threes: 'Minimum three-pointers made',
    allStar: 'All-Star selection', allNBA: 'All-NBA selection', allDefense: 'All-Defensive selection',
    dpoy: 'Defensive Player of the Year', sixthMan: 'Sixth Man of the Year', playoffs: 'Minimum playoff rounds won',
  };
  const awardKeys = ['allStar', 'allNBA', 'allDefense', 'dpoy', 'sixthMan'];
  const choices = ['None', 'Player option', 'Team option', 'Early termination'];
  const regularDays = () => seasonSim.lastDay + 1;
  const maxSeasonDays = () => regularDays() + postseason.maxDays;
  const prorate = (salary, day) => Math.round(salary * ((regularDays() - day) / regularDays()));
  const promotionBoost = (save, id) => arenaOps.playerBoost(save, id);

  function terms(deal, day) {
    const salary = prorate(deal.salary, day);
    const guarantee = Math.round(salary * deal.guaranteed / 100);
    const upfront = Math.round(guarantee * deal.upfront / 100);
    return { salary, guarantee, upfront, rollover: guarantee - upfront, conditional: salary - guarantee };
  }

  function openingDeal(player) {
    const stats = player.stats ?? {};
    return {
      salary: Math.round((1.4 + (stats?.PTS ?? 0) * 0.82 + (stats?.MIN ?? 0) * 0.34) * 10) * 100_000,
      years: 1, raise: 0, guaranteed: 100, upfront: defaultUpfront, bonus: 0, incentive: 0,
      option: 'None', noTrade: false, kicker: 0, perks: [], modeled: true,
    };
  }

  function publishedDeal(player) {
    const published = nbaContracts[player.id];
    if (!published) return openingDeal(player);
    return { ...openingDeal(player), salary: published.years[0][0], years: published.years.length,
      salarySchedule: published.years, option: published.years[1]?.[1] ?? 'None', modeled: false, published: true, twoWay: Boolean(published.twoWay) };
  }

  const nextSalary = deal => deal.salarySchedule?.[1]?.[0] ?? deal.salary + deal.raise;
  const nextOption = deal => deal.salarySchedule?.[1]?.[1] ??
    (deal.years === 2 && !deal.salarySchedule ? deal.option : 'None');

  function validRequirement(rule) {
    return rule && Object.hasOwn(conditions, rule.kind) && Number.isFinite(rule.target) && rule.target >= 0;
  }

  function validateDeal(deal) {
    const integer = (value, min, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
    if (!integer(deal.salary, 1) || !integer(deal.raise, -Number.MAX_SAFE_INTEGER) || !integer(deal.years, 1, 5)
        || !integer(deal.salary + (deal.years - 1) * deal.raise, 1)
        || !integer(deal.guaranteed, 0, 100) || !integer(deal.upfront, 0, 100)
        || !integer(deal.bonus, 0) || !integer(deal.incentive, 0) || !integer(deal.kicker, 0, 100)
        || !choices.includes(deal.option) || (deal.years === 1 && deal.option !== 'None')
        || deal.jersey != null && relationships.jerseyNumber(deal.jersey) === null
        || new Set(deal.perks).size !== deal.perks.length || deal.perks.some(perk => !Object.hasOwn(perks, perk))) {
      throw new Error('Check the salary, years, percentages, final-year option, and perks.');
    }
    if ((deal.guaranteed < 100 && !validRequirement(deal.requirement)) ||
        (deal.incentive > 0 && !validRequirement(deal.incentiveRequirement))) {
      throw new Error('Choose a requirement for each conditional payout.');
    }
  }

  function outcome(rule, id, code, history) {
    if (awardKeys.includes(rule.kind)) {
      if (!history.awards) return 'Pending awards';
      return history.awards[rule.kind].includes(id) ? 'Earned' : 'Condition missed';
    }
    if (rule.kind === 'playoffs') {
      if (!history.bracket?.champion) return 'Pending playoff results';
      return postseason.roundsWon(history.bracket, code) >= rule.target ? 'Earned' : 'Condition missed';
    }
    const stats = history.averages.get(id);
    const values = {
      games: stats?.GP ?? 0, injuries: history.injuryMisses.get(id) ?? 0, minutes: Math.round((stats?.MIN ?? 0) * (stats?.GP ?? 0)),
      wins: history.records[code].wins, points: stats?.PTS ?? 0, rebounds: stats?.REB ?? 0,
      assists: stats?.AST ?? 0, threes: Math.round((stats?.['3PM'] ?? 0) * (stats?.GP ?? 0)),
    };
    const met = rule.kind === 'injuries' ? values.injuries <= rule.target : values[rule.kind] >= rule.target;
    return met ? 'Earned' : 'Condition missed';
  }

  function unpaidRollover(contract, day) {
    const length = regularDays() - contract.day;
    if (length <= 0) return 0;
    const elapsed = Math.max(0, Math.min(length, day - contract.day));
    return contract.pay.rollover - Math.floor(contract.pay.rollover * elapsed / length);
  }

  function tradePayroll(contracts, ids, day) {
    const totals = { guaranteed: 0, conditional: 0, incentives: 0, kicker: 0 };
    for (const id of ids) {
      const contract = contracts.get(id);
      if (!contract) continue;
      const guaranteed = unpaidRollover(contract, day);
      totals.guaranteed += guaranteed;
      totals.conditional += contract.pay.conditional;
      totals.incentives += contract.deal.incentive ?? 0;
      totals.kicker += Math.round((guaranteed + contract.pay.conditional) * (contract.deal.kicker ?? 0) / 100);
    }
    return totals;
  }

  function achievementShares(history, code) {
    const { bracket, records } = history;
    if (!bracket) return [];
    const shares = [];
    const conference = league.teams.find(team => team.code === code).conference;
    const rank = bracket.order?.[conference].indexOf(code) ?? (bracket.seeds[code] ?? Infinity) - 1;
    const compare = bracket.homeOrder ?? ((a, b) => records[b].wins - records[a].wins || a.localeCompare(b));
    if (Object.keys(records).sort(compare)[0] === code) shares.push(['Best NBA regular-season record', playoffPool.league]);
    if (playoffPool.conference[rank]) shares.push(['Conference regular-season finish · #' + (rank + 1), playoffPool.conference[rank]]);
    playoffPool.rounds.forEach((amount, index) => {
      if (bracket.rounds[index]?.some(match => match.high === code || match.low === code)) {
        shares.push([postseason.rounds[index], amount]);
      }
    });
    const final = bracket.rounds[3]?.[0];
    if (bracket.champion === code) shares.push(['NBA champion', playoffPool.champion]);
    else if (bracket.champion && final && [final.high, final.low].includes(code)) shares.push(['NBA Finals runner-up', playoffPool.runnerUp]);
    return shares;
  }

  function clubAchievements(history, code) {
    const { awards, selections, playoffAwards, bracket, results } = history;
    const payouts = [];
    const add = (day, label, amount) => payouts.push({ day, label, amount });
    const team = league.teams.find(team => team.code === code);
    const leagueBest = bracket && Object.keys(history.records).sort(bracket.homeOrder ??
      ((a, b) => history.records[b].wins - history.records[a].wins || a.localeCompare(b)))[0];
    if (leagueBest === code) add(seasonSim.playoffStart, 'Best NBA record', 1000000);
    const conferenceOrder = bracket?.order?.[team.conference] ?? (bracket ? Object.keys(bracket.seeds)
      .filter(club => league.teams.find(item => item.code === club).conference === team.conference)
      .sort((a, b) => bracket.seeds[a] - bracket.seeds[b]) : []);
    if (conferenceOrder[0] === code) add(seasonSim.playoffStart, 'Best conference record', 650000);
    if (conferenceOrder.find(club => league.teams.find(item => item.code === club).division === team.division) === code) {
      add(seasonSim.playoffStart, 'Division champion', 350000);
    }
    const matches = bracket?.rounds ?? [];
    const matchDay = (round, match, last) => {
      const games = results.filter(game => game.playoffRound === round && [game.home, game.away].includes(match.high));
      return (last ? games.at(-1) : games[0])?.day;
    };
    [500000, 850000, 1500000].forEach((amount, round) => {
      const match = matches[round]?.find(match => [match.high, match.low].includes(code));
      const day = match && matchDay(round, match, false);
      if (day != null) add(day, postseason.rounds[round] + ' appearance', amount);
    });
    const final = matches[3]?.[0];
    if (bracket?.champion && final && [final.high, final.low].includes(code)) {
      const won = bracket.champion === code;
      add(matchDay(3, final, true) ?? history.day, won ? 'NBA championship' : 'NBA Finals runner-up', won ? 6500000 : 3000000);
    }
    const awardSets = { ...awards, ...playoffAwards, allStar: selections?.allStar?.length ? selections.allStar : awards?.allStar };
    for (const [key, [label, rate]] of Object.entries(clubAwardRates)) {
      const round = key === 'finals' ? 3 : ['eastFinals', 'westFinals'].includes(key) ? 2 : null;
      const match = round === 2 ? matches[2]?.[key === 'eastFinals' ? 0 : 1] : final;
      const day = round == null ? key === 'allStar' ? history.allStarDay ?? seasonSim.allStarDay : seasonSim.playoffStart
        : match && matchDay(round, match, true);
      if (day == null) continue;
      const owner = key === 'allStar' ? history.allStarOwners : round == null ? history.awardOwners : history.owners;
      (awardSets[key] ?? []).forEach((id, index) => {
        if (['coach', 'executive'].includes(key)) {
          if (id === code) add(day, label, rate);
        } else if ((owner ?? history.owners).get(id) === code) {
          const tier = Math.floor(index / 5);
          const name = history.profiles.get(id)?.name;
          add(day, label + (Array.isArray(rate) ? ' ' + ['First', 'Second', 'Third'][tier] + ' Team' : '') + ' · ' + name,
            Array.isArray(rate) ? rate[tier] : rate);
        }
      });
    }
    const eventDay = history.allStarDay ?? seasonSim.allStarDay;
    const weekend = history.allStarSaturday;
    const eventBonuses = [
      [eventDay - 2, 'Rising Stars MVP', 100000, [history.risingStars?.mvp]],
      [eventDay - 1, '3-Point Contest champion', 100000, [weekend?.threePoint.winner]],
      [eventDay - 1, 'Slam Dunk Contest champion', 100000, [weekend?.dunk.winner]],
      [eventDay - 1, 'Shooting Stars champion', 75000, weekend?.shootingStars.winner?.roster ?? []],
      [eventDay, 'All-Star Game MVP', 250000, [history.allStarGame?.mvp]],
    ];
    for (const [day, label, amount, winners] of eventBonuses) {
      for (const player of winners) if (player?.team === code) add(day, label + ' · ' + player.name, amount);
    }
    return payouts;
  }

  function gmEarnings(save, day = save.day) {
    const completed = Math.min(regularDays(), day);
    const start = Math.min(completed, save.gmSalaryStart ?? regularDays());
    const salary = save.gm?.contract.salary ?? gmSalary;
    return Math.floor(salary * completed / regularDays()) - Math.floor(salary * start / regularDays());
  }

  function gmWallet(save) {
    const seasons = [...(save.pastSeasons ?? []), save];
    const entries = seasons.flatMap(season => {
      const salary = Array.from({ length: Math.min(season.day, regularDays()) }, (_, day) => ({
        day, amount: gmEarnings(season, day + 1) - gmEarnings(season, day), description: 'GM salary',
      })).filter(entry => entry.amount);
      const spending = (season.financeActions ?? []).filter(action => action.funding === 'personal').map(action =>
        ({ day: action.day, amount: -action.cost, description: action.description }));
      return [...spending, ...salary].sort((a, b) => a.day - b.day).map(entry => ({ ...entry, year: season.year }));
    });
    let balance = 0;
    let earned = 0;
    let spent = 0;
    for (const entry of entries) {
      balance += entry.amount;
      entry.balance = balance;
      if (entry.amount > 0) earned += entry.amount;
      else spent -= entry.amount;
    }
    return { balance, earned, spent, entries };
  }

  function report(save, history, code = save.team) {
    const entries = [];
    const contracts = new Map();
    const conditional = [];
    const players = history.profiles;
    const startingBalance = save.startingBanks?.[code] ?? openingCash;
    const gmSave = code === save.team ? save : { ...save, gm: undefined,
      gmSalaryStart: Math.max(save.gmSalaryStart ?? regularDays(), save.cpuLogicStart ?? regularDays()) };
    let bank = startingBalance;
    const post = (day, category, description, amount) => {
      if (!amount) return;
      bank += amount;
      entries.push({ day, category, description, amount, balance: bank });
    };
    const sign = (day, id, deal, team, carried = false) => {
      const pay = terms(deal, day);
      contracts.set(id, { deal, pay, day, team });
      if (team !== code) return;
      const name = players.get(id).name;
      post(day, 'Payroll', `${name} · upfront guarantee`, -pay.upfront);
      if (carried) return;
      post(day, 'Payroll', `${name} · signing bonus`, -deal.bonus);
      for (const perk of deal.perks) post(day, 'Contract perks', `${name} · ${perk}`, -perks[perk]);
    };
    const start = save.financeStart;
    const receivesMedia = save.mediaDistribution || save.usePublishedContracts;
    if (start < regularDays()) {
      if (receivesMedia) {
        post(start, 'League media', 'National media rights · upfront share', mediaUpfront);
      }
      if (save.openingContracts) {
        for (const [id, { deal, team, newExtension }] of Object.entries(save.openingContracts)) sign(start, id, deal, team, !newExtension);
      } else {
        for (const player of league.players) if (player.team) sign(start, player.id,
          save.usePublishedContracts ? publishedDeal(player) : openingDeal(player), player.team);
      }
    }
    const trainingCounts = new Map();
    for (const entry of history.development.log) {
      if ((entry.team ?? save.team) !== code) continue;
      if (entry.gain && !entry.affiliate) trainingCounts.set(entry.day, (trainingCounts.get(entry.day) ?? 0) + 1);
    }
    let actionIndex = 0;
    for (let day = start; day <= Math.min(save.day, regularDays() - 1); day++) {
      if (day === seasonSim.allStarDayFor(save) && code === save.allStarHost) {
        post(day, 'League events', 'All-Star host bonus', 1_000_000);
      }
      while (save.financeActions[actionIndex]?.day === day) {
        const action = save.financeActions[actionIndex++];
        if (action.type === 'contract') sign(day, action.id, action.deal, save.team);
        else if (action.type === 'signing') sign(day, action.id, action.deal, action.team);
        else if (action.type === 'cut') {
          const contract = contracts.get(action.id);
          if (action.settlement && contract?.team === code) {
            post(day, 'Payroll', players.get(action.id).name + ' · release settlement',
              -Math.round(unpaidRollover(contract, day) / 2));
          }
          contracts.delete(action.id);
        }
        else if (action.type === 'trade') {
          const sendingTeam = action.team ?? save.team;
          const cash = action.cash ?? 0;
          if (code === sendingTeam || code === action.otherTeam) {
            post(day, 'Trades', 'Trade cash consideration', code === sendingTeam ? -cash : cash);
          }
          const [send, receive] = seasonSim.tradePlayers(action);
          for (const [id, receivingTeam] of [...send.map(id => [id, action.otherTeam]),
            ...receive.map(id => [id, action.team ?? save.team])]) {
            const contract = contracts.get(id);
            if (!contract) continue;
            if (contract.team === code) {
              const amount = tradePayroll(contracts, [id], day).kicker;
              post(day, 'Payroll', `${players.get(id).name} · trade kicker`, -amount);
            }
            contract.team = receivingTeam;
          }
        } else if (action.type === 'facility') {
          if ((action.team ?? save.team) === code && action.funding !== 'personal') post(day, action.organization ? 'Community outreach' : 'Facilities', action.description, -action.cost);
        } else if (code === save.team) post(day, 'Morale', activities[action.activity]?.name ?? 'Team morale budget', -action.amount);
      }
      if (day === save.day) break;
      if (receivesMedia) {
        const days = regularDays() - start;
        const elapsed = day - start;
        const installment = Math.floor(mediaRollover * (elapsed + 1) / days) - Math.floor(mediaRollover * elapsed / days);
        post(day, 'League media', 'National media rights · daily installment', installment);
      }
      const payroll = [...contracts.values()].reduce((total, contract) => {
        return contract.team === code ? total + unpaidRollover(contract, day) - unpaidRollover(contract, day + 1) : total;
      }, 0);
      post(day, 'Payroll', 'Daily guaranteed rollover', -payroll);
      if (day >= (save.staffPayrollStart ?? Infinity)) {
        const annual = staffSim.annualPayroll(save, code, day);
        const staffPay = Math.floor(annual * (day + 1) / regularDays()) - Math.floor(annual * day / regularDays());
        post(day, 'Staff payroll', 'Coaching and front-office salaries · modeled', -staffPay);
      }
      post(day, 'GM payroll', 'General manager salary', gmEarnings(gmSave, day) - gmEarnings(gmSave, day + 1));
      post(day, 'League commercial', 'Daily league commercial distribution', dailyCommercialIncome);
      post(day, 'Facilities', 'Team facilities and training operations', -operationsPerDay);
      if (day >= (save.facilityStart ?? Infinity)) post(day, 'Facilities', 'Upgraded facility upkeep', -arenaOps.dailyUpkeep(arenaOps.settings(save, day, code)));
      post(day, 'Training', 'Completed training drills', -(trainingCounts.get(day) ?? 0) * drillCost);
    }
    const nextDay = Math.max(start, save.day);
    const remainingDays = history.bracket?.champion ? 0 : Math.max(0, maxSeasonDays() - nextDay);
    let remainingRestDays = 0;
    if (code === save.team) for (let day = nextDay; day < regularDays(); day++) {
      if (!seasonSim.fixtures(day, save).some(game => game.includes(code))) remainingRestDays++;
    }
    const gmReserve = gmEarnings(gmSave, regularDays()) - gmEarnings(gmSave);
    const activeContracts = new Map([...contracts].filter(([, contract]) => contract.team === code));
    let reserved = gmReserve + remainingDays * (operationsPerDay + arenaOps.dailyUpkeep(arenaOps.settings(save, save.day, code))) + (code === save.team ? remainingRestDays * activeContracts.size * drillCost : 0);
    const staffStart = Math.max(nextDay, save.staffPayrollStart ?? regularDays());
    reserved += Math.ceil(staffSim.annualPayroll(save, code) * Math.max(0, regularDays() - staffStart) / regularDays());
    for (const [id, contract] of activeContracts) {
      const { deal, pay } = contract;
      reserved += unpaidRollover(contract, save.day);
      for (const [amount, rule, label] of [
        [pay.conditional, deal.requirement, 'Conditional salary'],
        [deal.incentive, deal.incentiveRequirement, 'Performance incentive'],
      ]) {
        if (!amount) continue;
        const status = save.day < regularDays() ? 'Pending regular-season end' : outcome(rule, id, code, history);
        conditional.push({ id, amount, label, status });
        if (status.startsWith('Pending')) reserved += amount;
        if (status === 'Earned') {
          const paidDay = rule.kind === 'playoffs' ? save.day - 1 : awardKeys.includes(rule.kind) ? regularDays() : regularDays() - 1;
          post(paidDay, 'Payroll', `${players.get(id).name} · ${label}`, -amount);
        }
      }
    }
    const attendance = [];
    let wins = 0, played = 0;
    const recent = [];
    for (const game of history.results) {
      if (game.home !== code && game.away !== code) continue;
      const day = game.day;
      const config = arenaOps.settings(save, day, code);
      if (day >= start && !game.forfeit) {
        for (const [category, amount] of Object.entries(arenaOps.supporterRevenue(save, code, game, config, recent))) {
          if (amount) post(day, category, category, amount);
        }
        for (const [category, amount] of Object.entries(arenaOps.commercialRevenue(config, game.home === code))) {
          post(day, category, (game.home === code ? 'Home' : 'Away') + ' game · ' + category, amount);
        }
      }
      if (game.home === code && !game.forfeit && day >= start) {
        const result = day >= (save.facilityStart ?? Infinity) ? arenaOps.gameRevenue(config, code, game, wins, played, arenaOps.fanSentiment(save, code, day, recent, config), recent, save.defendingChampion === code) : null;
        if (result) attendance.push({ day, ...result });
        const stage = game.playoffRound === -1 ? 'Play-in' : game.playoffRound == null ? 'Regular season' : 'Playoffs';
        for (const [category, amount] of Object.entries(result?.sales ?? homeRevenue)) post(day, category, stage + ' home game revenue', amount);
      }
      played++;
      const won = game.home === code ? game.homeScore > game.awayScore : game.awayScore > game.homeScore;
      wins += Number(won);
      recent.push(won);
      if (recent.length > 10) recent.shift();
    }
    for (let day = Math.max(start, regularDays()); day < save.day; day++) {
      post(day, 'Facilities', 'Playoff facility operations', -operationsPerDay - arenaOps.dailyUpkeep(arenaOps.settings(save, day, code)));
    }
    for (const action of save.financeActions) {
      if (action.type === 'facility' && (action.team ?? save.team) === code && action.funding !== 'personal' && action.day >= regularDays() && action.day <= save.day) {
        post(action.day, action.organization ? 'Community outreach' : 'Facilities', action.description, -action.cost);
      }
    }
    for (const item of clubAchievements(history, code)) {
      if (item.day >= start && item.day <= save.day) post(item.day, 'Franchise achievements', item.label, item.amount);
    }
    entries.sort((a, b) => a.day - b.day);
    let balance = startingBalance;
    for (const entry of entries) { balance += entry.amount; entry.balance = balance; }
    return { bank, reserved, available: bank - reserved, entries, contracts: activeContracts, conditional, attendance };
  }

  function nextSeason(save, history, declined) {
    const startingBanks = {};
    const startingRosters = {};
    const openingContracts = {};
    const optionResults = [];
    for (const { code } of league.teams) {
      const current = report(save, history, code);
      startingBanks[code] = current.bank;
      startingRosters[code] = [];
      for (const player of history.rosters.get(code)) {
        const deal = current.contracts.get(player.id)?.deal ?? openingDeal(player);
        const extension = save.extensions?.[player.id];
        if (extension) {
          openingContracts[player.id] = { team: code, deal: extension, newExtension: true };
          startingRosters[code].push(player.id);
          continue;
        }
        const benchmark = openingDeal(player);
        const salary = nextSalary(deal);
        const option = nextOption(deal);
        const teamDeclines = option === 'Team option' && (code === save.team
          ? declined.has(player.id) : salary > benchmark.salary * 1.2);
        const playerDeclines = ['Player option', 'Early termination'].includes(option) && salary < benchmark.salary * 0.9;
        if (deal.years > 1 && ['Team option', 'Player option', 'Early termination'].includes(option)) {
          optionResults.push({ id: player.id, team: code, option, salary, retained: !teamDeclines && !playerDeclines });
        }
        if (deal.years === 1 || teamDeclines || playerDeclines) continue;
        const salarySchedule = deal.salarySchedule?.slice(1);
        const nextDeal = { ...deal, years: deal.years - 1, salary, bonus: 0, salarySchedule,
          option: salarySchedule ? salarySchedule[1]?.[1] ?? 'None' : deal.years === 2 ? 'None' : deal.option };
        openingContracts[player.id] = { team: code, deal: nextDeal };
        startingRosters[code].push(player.id);
      }
    }
    return { startingBanks, startingRosters, openingContracts, optionResults };
  }

  function enforcePlayerOffer(save, history, id, deal, extension = false) {
    const limit = save.cfoBudget?.[save.team]?.players;
    if (limit == null) return;
    const annual = (contract, year) => contract && year >= 0 && year < contract.years
      ? contract.salarySchedule?.[year]?.[0] ?? contract.salary + contract.raise * year : 0;
    const active = report(save, history).contracts;
    for (let year = Number(extension); year < deal.years + Number(extension); year++) {
      let committed = 0;
      for (const [player, entry] of active) {
        if (player === id && extension) continue;
        committed += year > 0 && save.extensions?.[player] ? annual(save.extensions[player], year - 1) : annual(entry.deal, year);
      }
      for (const [player, offer] of Object.entries(save.market?.open ? save.market.offers ?? {} : {})) {
        if (player !== id && !active.has(player)) committed += annual(offer, year);
      }
      if (committed + annual(deal, year - Number(extension)) > limit) {
        throw new Error('The CFO player allocation cannot cover season ' + (year + 1) + ' of the payroll plan.');
      }
    }
  }

  function signingCost(deal, controlled) {
    return deal.salary + deal.bonus + deal.incentive
      + deal.perks.reduce((sum, perk) => sum + perks[perk], 0)
      + (controlled ? Math.floor(regularDays() / 2) * drillCost : 0);
  }

  function budgetUsage(save, history) {
    const reportForClub = report(save, history);
    const salary = [...reportForClub.contracts.values()].reduce((sum, entry) => sum + entry.deal.salary, 0);
    const pending = Object.values(save.market?.open ? save.market.offers ?? {} : {})
      .reduce((sum, deal) => sum + (deal.salary ?? deal.deal?.salary ?? 0), 0);
    const upgrades = save.financeActions.filter(action => action.type === 'facility' && !action.organization
      && action.funding !== 'personal' && (action.team ?? save.team) === save.team)
      .reduce((sum, action) => sum + action.cost, 0);
    const staff = staffSim.assignments(save, save.team, staffSim.roles);
    return { players: salary + pending, upgrades,
      ...Object.fromEntries(staffSim.roles.map(role => [role, staffSim.salary(staff[role], role)])) };
  }

  function enforceBudget(before, after, beforeHistory, afterHistory) {
    const limits = before.cfoBudget?.[before.team];
    if (!limits || before.team !== after.team || before.year !== after.year) return;
    const oldUsage = budgetUsage(before, beforeHistory);
    const newUsage = budgetUsage(after, afterHistory);
    for (const [category, limit] of Object.entries(limits)) {
      if (newUsage[category] > limit && newUsage[category] > oldUsage[category]) {
        throw new Error('The CFO allocation for ' + category + ' cannot cover this move.');
      }
    }
  }

  function addAction(save, history, action) {
    if (save.market?.open && action.type !== 'facility') throw new Error('Finish free agency before making regular-season transactions.');
    if (save.day >= regularDays() && (action.type !== 'facility' || history.bracket?.champion)) {
      throw new Error('This move is unavailable after the season closes.');
    }
    if (action.type === 'facility') {
      const games = action.index === save.day ? history.today : seasonSim.fixtures(action.index, save);
      if (action.command === 'game-price' && !games.some(([home]) => home === save.team)) {
        throw new Error('Choose an upcoming home game.');
      }
      if (action.facility === 'ads' && action.command === 'campaign') {
        const featured = action.value?.players;
        if (!Array.isArray(featured) || new Set(featured).size !== featured.length
          || featured.some(id => history.owners.get(id) !== save.team)) throw new Error('Choose players on your roster.');
      }
      if (action.facility === 'support') {
        const id = action.index;
        const owner = history.owners.get(id);
        if (!history.profiles.has(id) || history.unavailable.has(id) || owner && owner !== save.team
          || save.draftRights?.[id]) throw new Error('Choose a player on your team or an available free agent.');
        if (action.command === 'brand') {
          const sponsor = sponsorCatalog.find(item => item.name === action.value);
          if (!sponsor || history.profiles.get(id).attributes.Marketability < sponsor.marketability) {
            throw new Error('This player does not meet the sponsor’s base marketability requirement.');
          }
        }
        if (action.command === 'service' && (owner !== save.team
          || !report(save, history).contracts.get(id)?.deal.perks.includes(action.value))) {
          throw new Error('Add this perk to the player’s active contract first.');
        }
        const request = relationships.read(save).contacts[id]?.demands.some(item => item.kind === action.command && item.value === action.value);
        if (action.command === 'familyJob' && !request) throw new Error('Discuss the requested role with the player first.');
      }
      if (action.facility === 'affiliate' && action.command !== 'expand') {
        const id = action.index;
        const assigned = arenaOps.settings(save).affiliate;
        if (history.owners.get(id) !== save.team) throw new Error('Choose a player under contract with your team.');
        if (action.command === 'assign') {
          if (save.market?.open || save.day >= regularDays()) throw new Error('Assignments open during the regular season.');
          if (Object.hasOwn(assigned, id)) throw new Error('This player is already on assignment.');
          const service = seasonSim.serviceYears(save, history.profiles.get(id));
          const deal = report(save, history).contracts.get(id)?.deal;
          if (!deal || deal.twoWay || service >= 4) throw new Error('Choose a standard-contract player with fewer than four years of NBA service.');
          if (service === 3 && action.value !== true) throw new Error('Written player and NBPA consent are required.');
          const remaining = history.activeRoster.filter(player => player.id !== id);
          const healthy = remaining.filter(player => history.health.get(player.id).durability > 10);
          if (healthy.length < 8 || healthy.reduce((sum, player) => sum + seasonSim.minuteLimit(history.health.get(player.id).durability), 0) < 240) {
            throw new Error('Keep at least eight available players and enough eligible minutes for an NBA lineup.');
          }
        } else if (!Object.hasOwn(assigned, id)) throw new Error('This player is not on assignment.');
      }
      if (action.facility === 'community' && action.command === 'fan-event') {
        const fan = relationships.fans.find(item => item.id === action.index && item.code === save.team);
        const activity = relationships.fanActivities[action.value];
        if (!fan || !activity?.cost) throw new Error('Choose a paid supporter activity.');
        if (save.financeActions.some(entry => entry.fanEvent === fan.id && entry.day > save.day - 7)) {
          throw new Error('Each supporter group can host one paid activity per week.');
        }
        action = { type: 'facility', team: save.team, fanEvent: fan.id, audience: fan.name,
          reach: activity.reach, cost: activity.cost, description: activity.label + ' · ' + fan.name + ' fans' };
      } else if (action.facility === 'community' && action.command === 'donate') {
        const organization = relationships.organizations(save, history).find(item => item.id === action.index);
        if (!organization || !Number.isSafeInteger(action.value) || action.value < 1000 || action.value > 250000) {
          throw new Error('Choose an open organization and a whole-dollar donation between $1,000 and $250,000.');
        }
        const funding = action.funding ?? 'team';
        if (!['team', 'personal'].includes(funding)) throw new Error('Choose the team budget or your personal wallet.');
        if (funding === 'personal' && gmWallet(save).balance < action.value) throw new Error('Your personal wallet cannot cover this donation.');
        action = { type: 'facility', settings: arenaOps.settings(save), organization: organization.id, funding,
          cost: action.value, team: save.team, audience: organization.team === save.team ? organization.audience : undefined, reach: Math.floor(action.value / 25000), description: 'Donation · ' + organization.name };
      } else action = arenaOps.change(save, action);
    } else if (action.type === 'signing' && action.inSeason) {
      if (!history.profiles.has(action.id) || history.unavailable.has(action.id) || history.owners.has(action.id) || history.rosters.get(save.team).length >= freeAgency.maximum) {
        throw new Error('Choose an available free agent and leave an open roster slot.');
      }
      validateDeal(action.deal);
      if (action.deal.jersey != null && !relationships.jerseyOpen(save, history, action.id, action.deal.jersey)) {
        throw new Error('That jersey number is already assigned.');
      }
      if (action.draftSigning) {
        const right = save.draftRights?.[action.id];
        if (right?.team !== save.team || JSON.stringify(action.deal) !== JSON.stringify(draftOps.deal(right))) throw new Error('Use the draft rights signing screen.');
      } else {
        if (save.draftRights?.[action.id]) throw new Error('This player is subject to exclusive draft rights.');
        freeAgency.checkInSeason(save, history, action.id, action.deal);
      }
      action = { ...action, team: save.team };
    } else if (action.type === 'contract') {
      if (history.owners.get(action.id) !== save.team) throw new Error('Choose a player on your team.');
      validateDeal(action.deal);
      if (action.deal.jersey != null && !relationships.jerseyOpen(save, history, action.id, action.deal.jersey)) {
        throw new Error('That jersey number is already assigned or reserved.');
      }
    } else if (action.type === 'trade') {
      if (save.day > seasonSim.tradeDeadlineFor(save)) throw new Error('The trade deadline has passed.');
      const [send, receive] = seasonSim.tradePlayers(action);
      const { sendPicks = [], receivePicks = [], otherTeam, cash = 0 } = action;
      if (!Number.isSafeInteger(cash) || Math.abs(cash) > 10_000_000) {
        throw new Error('Trade cash must be a whole-dollar amount up to $10 million.');
      }
      if (!history.rosters.has(otherTeam) || otherTeam === save.team) throw new Error('Choose another team.');
      const cashOnlyFor = cash > 0 && !send.length && !sendPicks.length ? receivePicks
        : cash < 0 && !receive.length && !receivePicks.length ? sendPicks : [];
      if (cashOnlyFor.some(key => String(key).split('-')[1] === '1')) {
        throw new Error('A first-round pick cannot be sold for cash alone.');
      }
      const picks = draftOps.futurePicks(save);
      const byKey = new Map(picks.map(pick => [pick.key, pick]));
      const pickOwners = { ...save.pickOwners };
      const contractsByTeam = new Map();
      const contractsFor = code => {
        if (!contractsByTeam.has(code)) contractsByTeam.set(code, report(save, history, code).contracts);
        return contractsByTeam.get(code);
      };
      const validateSide = (code, destination, players, draftPicks, incomingCount) => {
        if (!players.length && !draftPicks.length && !(code === save.team ? cash > 0 : cash < 0)) throw new Error('Both teams must offer an asset.');
        if (players.length + draftPicks.length > 6) throw new Error('Each team may offer up to six assets.');
        if (new Set(players).size !== players.length || new Set(draftPicks).size !== draftPicks.length) {
          throw new Error('An asset can only appear once.');
        }
        if (players.some(id => history.owners.get(id) !== code)) throw new Error('A player is no longer on the sending team.');
        const size = history.rosters.get(code).length - players.length + incomingCount;
        if (size < 10 || size > Math.max(18, history.rosters.get(code).length)) throw new Error('The deal would put a team outside its roster limits.');
        const contracts = contractsFor(code);
        if (players.some(id => contracts.get(id)?.deal.noTrade)) throw new Error('A no-trade clause blocks this deal.');
        for (const key of draftPicks) {
          if (byKey.get(key)?.owner !== code) throw new Error('A pick is no longer owned by the sending team.');
          pickOwners[key] = destination;
        }
      };
      validateSide(save.team, otherTeam, send, sendPicks, receive.length);
      validateSide(otherTeam, save.team, receive, receivePicks, send.length);
      for (const code of [save.team, otherTeam]) {
        if (!draftOps.keepsFutureFirsts(save, picks, pickOwners, code)) {
          throw new Error('A team cannot go without first-round picks in two consecutive future drafts.');
        }
      }
      const market = tradeValues.market(save, history, contractsFor);
      if (!market.accepts([...send, ...sendPicks], [...receive, ...receivePicks], otherTeam, true, cash)) {
        throw new Error('The other team declined. It wants more value or a stronger centerpiece.');
      }
      action = { ...action, team: save.team };
      save = { ...save, pickOwners };
    } else if (action.type === 'cut') {
      if (history.owners.get(action.id) !== save.team) throw new Error('Choose a player on your team.');
      if (history.rosters.get(save.team).length <= 10) throw new Error('Keep at least 10 players on the roster.');
      action = { ...action, settlement: true };
    } else if (action.type === 'morale') {
      if (!Object.hasOwn(activities, action.activity)) throw new Error('Choose a team activity.');
      if (history.today.some(game => game.includes(save.team))) throw new Error('Schedule team activities on an off day.');
      if (save.financeActions.some(entry => entry.activity && save.day - entry.day < 7)) throw new Error('Schedule one team activity per seven days.');
      action = { type: 'morale', activity: action.activity, amount: activities[action.activity].cost };
    } else {
      throw new Error('Choose a valid finance action.');
    }
    const updated = { ...save, financeActions: [...save.financeActions, { ...action, day: save.day }] };
    if (action.funding !== 'personal' && (action.type !== 'facility' || action.cost > 0) && report(updated, history).available < 0) {
      throw new Error('The team cannot afford this while covering its existing obligations.');
    }
    if (action.type === 'trade' && !cpuTeams.canTrade(save, history, action.otherTeam, report(save, history, action.otherTeam), updated)) {
      throw new Error('The other team declined because the deal exceeds its cash reserve or payroll budget.');
    }
    return updated;
  }

  return { openingCash, homeRevenue, gmSalary, gmWallet, publishedDeal, activities, mediaDistribution, mediaUpfront, mediaRollover, playoffPool, achievementShares, clubAchievements, clubAwardRates, dailyCommercialIncome, perks, conditions, choices, promotionBoost, report, budgetUsage, enforceBudget, enforcePlayerOffer, addAction, nextSeason,
    openingDeal, validateDeal, signingCost, nextSalary, nextOption, terms, tradePayroll };
})();
