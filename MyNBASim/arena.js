const arenaOps = (() => {
  const catalogs = {
    merch: [['Team tee', 30], ['Cap', 28], ['Pennant', 15], ['Replica jersey', 110], ['Hoodie', 75],
      ['Scarf', 32], ['Signed photo', 85], ['Mini basketball', 24], ['Warm-up jacket', 125], ['Collector jersey', 190]],
    food: [['Hot dog', 7], ['Popcorn', 6], ['Soda', 5], ['Pizza', 9], ['Nachos', 8],
      ['Bottled water', 4], ['Burger', 13], ['Beer', 12], ['Wine', 16], ['Mocktail', 10]],
  };
  const affiliates = {
    ATL: 'College Park Skyhawks', BOS: 'Maine Celtics', BKN: 'Long Island Nets', CHA: 'Greensboro Swarm',
    CHI: 'Windy City Bulls', CLE: 'Cleveland Charge', DAL: 'Texas Legends', DEN: 'Grand Rapids Gold',
    DET: 'Motor City Cruise', GSW: 'Santa Cruz Warriors', HOU: 'Rio Grande Valley Vipers', IND: 'Noblesville Boom',
    LAC: 'San Diego Clippers', LAL: 'Coachella Valley Lakers', MEM: 'Memphis Hustle', MIA: 'Sioux Falls Skyforce',
    MIL: 'Wisconsin Herd', MIN: 'Iowa Wolves', NOP: 'Laketown Squadron', NYK: 'Westchester Knicks',
    OKC: 'Oklahoma City Blue', ORL: 'Osceola Magic', PHI: 'Delaware Blue Coats', PHX: 'Valley Suns',
    POR: 'Rip City Remix', SAC: 'Stockton Kings', SAS: 'Austin Spurs', TOR: 'Raptors 905',
    UTA: 'Salt Lake City Stars', WAS: 'Capital City Go-Go',
  };
  const labels = { arena: 'Arena', parking: 'Parking Lot', merch: 'Merch Stalls', food: 'Food Stalls', vip: 'VIP', ads: 'Advertisement Center', training: 'Training Facility', clinic: 'Team Clinic', affiliate: 'Development Division', support: 'Player Services' };
  const initial = () => ({
    arena: { price: 78, level: 1, fanNight: false, fanNightUnlocked: false, giveaway: false, giveawayUnlocked: false, gamePrices: {} },
    ads: { team: null, solo: null, company: null, sponsor: null },
    parking: { price: 24, level: 1 },
    vip: { price: 190, level: 0, packages: [190, 260, 400, 550, 725, 950] },
    ...Object.fromEntries(Object.entries(catalogs).map(([type, items]) => [type, items.map(([, price], i) =>
      ({ price, unlocked: i < 3, selling: i < 3 }))])),
  });
  const campaigns = {
    team: { name: 'Team panel', cost: 240000, popularity: 4, boost: 3 },
    solo: { name: 'Solo panel', cost: 180000, popularity: 3, boost: 7 },
    company: { name: 'Company panel', cost: 120000, popularity: 2, boost: 2 },
  };
  const sponsors = {
    regional: { name: 'Regional partner', home: 55000, away: 15000 },
    national: { name: 'National partner', home: 95000, away: 30000, minimumPopularity: 4 },
  };
  function settings(save, day = save.day, code = save.team) {
    const actions = save.financeActions.filter(action => (action.team ?? save.team) === code
      || action.type === 'trade' && action.otherTeam === code).flatMap(action => action.type === 'trade'
      ? seasonSim.tradePlayers(action)[action.otherTeam === code ? 1 : 0].map(id => ({ ...action, id }))
      : [action]);
    const last = actions.findLastIndex(action => action.type === 'facility' && action.settings && action.day <= day);
    const config = actions[last]?.settings ?? save.arenaTeamCarry?.[code]
      ?? (code === save.team ? save.arenaCarry : null) ?? initial();
    const ads = { ...initial().ads, ...config.ads, deals: { ...config.ads?.deals } };
    for (const action of actions.slice(last + 1)) {
      if (action.day > day || !['cut', 'trade'].includes(action.type)) continue;
      for (const key of Object.keys(campaigns)) {
        const campaign = ads[key];
        if (!campaign?.players.includes(action.id)) continue;
        const players = campaign.players.filter(id => id !== action.id);
        ads[key] = players.length ? { ...campaign, players } : null;
      }
    }
    const training = config.training ?? { level: 0, days: [] };
    const clinic = config.clinic ?? { level: 0 };
    const affiliate = { ...config.affiliate };
    const playerSupport = { ...config.playerSupport };
    for (const action of actions.slice(last + 1)) {
      if (action.day > day || !['trade', 'cut', 'contract'].includes(action.type)) continue;
      if (action.type !== 'contract') delete affiliate[action.id];
      const record = playerSupport[action.id];
      if (record?.service) playerSupport[action.id] = { ...record, service: action.type === 'contract'
        ? record.service.filter(perk => action.deal.perks.includes(perk)) : [] };
    }
    return { ...config, ads, training, clinic, affiliate, playerSupport };
  }
  const popularity = config => Object.keys(campaigns).reduce((sum, key) => sum + (config.ads?.[key] ? campaigns[key].popularity : 0), 0);
  const playerBoost = (save, id) => {
    const { ads, playerSupport } = settings(save);
    return Object.entries(campaigns).reduce((sum, [key, item]) => sum + (ads[key]?.players.includes(id) ? item.boost : 0),
      ((playerSupport[id]?.endorsement?.length ?? 0) + (playerSupport[id]?.brand?.length ?? 0)) * 2);
  };
  const watchLimit = config => Math.min(30, Math.max(0, config.arena.price - 1));
  const upgradePrice = (type, level) => ({ arena: 3_000_000, parking: 900_000, vip: 1_700_000 })[type] * (level + 1) * 10;
  const unlockPrice = (type, index) => ((type === 'merch' ? 80_000 : 55_000) + index * 12_000) * 10;
  const maxLevel = 6;
  const developmentMaxLevel = 4;
  const capacity = (type, level) => ({ arena: 16500 + level * 1600, parking: 900 + level * 625,
    vip: level ? level * 135 : 0 })[type];
  const vipPackages = ['Club seats', 'Courtside dining', 'Private suites', 'Tunnel access', 'All-access hospitality', 'Private lounge buyout'];

  const upgradeCost = (facility, level) => (facility === 'clinic' ? 1250000 : 1750000) * (level + 1) * 10;
  const clinicEffects = level => ({ fatigue: level * 3, durability: level, rehabDays: level * 2 });
  const trainingRates = level => ({ prePeak: 0.15 * level / 3, peak: 0.25 * level / 3, postPeak: 0.10 * level / 3 });

  const expansionCosts = { arena: 900000, parking: 300000, vip: 500000, merch: 220000, food: 200000,
    ads: 350000, training: 400000, clinic: 350000, affiliate: 300000 };
  const expansionPrice = (type, level) => expansionCosts[type] * (level + 1) * 10;
  const expansion = (config, type) => config.expansions?.[type] ?? 0;
  const expansionUpkeep = level => 250 * level * (level + 1) / 2;
  const dailyUpkeep = config => 1000 * (Math.max(0, config.arena.level - 1)
    + Math.max(0, config.parking.level - 1) + config.vip.level
    + config.training.level + config.clinic.level
    + Number(Boolean(config.arena.fanNightUnlocked)) + Number(Boolean(config.arena.giveawayUnlocked))
    + Number(Boolean(config.arena.watchUnlocked)))
    + Object.values(config.expansions ?? {}).reduce((total, level) => total + expansionUpkeep(level), 0)
    + 100 * [...config.merch.slice(3), ...config.food.slice(3)].filter(product => product.unlocked).length;

  function change(save, action, code = save.team) {
    const config = structuredClone(settings(save, save.day, code));
    const { facility, command, index, value } = action;
    if (!Object.hasOwn(labels, facility)) throw new Error('Choose a facility.');
    const product = catalogs[facility] && Number.isInteger(index) ? config[facility][index] : null;
    let cost = 0;
    let description = labels[facility];
    if (command === 'expand' && Object.hasOwn(expansionCosts, facility)) {
      const level = expansion(config, facility);
      if (level >= 2 || facility === 'vip' && !config.vip.level) throw new Error('This expansion is unavailable.');
      cost = expansionPrice(facility, level);
      config.expansions = { ...config.expansions, [facility]: level + 1 };
      description += ' · expansion tier ' + (level + 1);
    } else if (facility === 'support' && command === 'brand') {
      const sponsor = sponsorCatalog.find(item => item.name === value);
      if (!sponsor) throw new Error('Choose an available sponsor.');
      const record = config.playerSupport[index] ?? {};
      const brands = record.brand ?? [];
      if (brands.length >= 3 || brands.some(name => sponsorCatalog.find(item => item.name === name)?.category === sponsor.category)) {
        throw new Error('Players can sign up to three endorsements with one deal per category.');
      }
      config.playerSupport[index] = { ...record, brand: [...brands, sponsor.name] };
      description += ' · ' + sponsor.name + ' player endorsement';
    } else if (facility === 'support') {
      const catalogs = { service: relationships.services, endorsement: relationships.endorsements, familyJob: relationships.familyJobs };
      const catalog = Object.hasOwn(catalogs, command) ? catalogs[command] : null;
      if (!catalog || !Object.hasOwn(catalog, value)) throw new Error('Choose an available player service.');
      const record = config.playerSupport[index] ?? {};
      const items = record[command] ?? [];
      if (items.includes(value)) throw new Error('This arrangement is already active.');
      if (command === 'familyJob' && items.length) throw new Error('This family member already has a role for the season.');
      config.playerSupport[index] = { ...record, [command]: [...items, value] };
      cost = command === 'service' ? 0 : catalog[value];
      description += ' · ' + value;
    } else if (['training', 'clinic'].includes(facility) && command === 'upgrade') {
      const room = config[facility];
      if (room.level >= developmentMaxLevel) throw new Error('This facility is fully upgraded.');
      cost = upgradeCost(facility, room.level);
      room.level++;
      description += ' · level ' + room.level;
    } else if (facility === 'training' && command === 'auto-practice') {
      config.training = { ...config.training, automatic: !config.training.automatic };
    } else if (facility === 'training' && command === 'practice') {
      if (!Array.isArray(value) || value.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Choose valid practice days.');
      config.training.days = [...new Set(value)];
    } else if (facility === 'affiliate' && command === 'assign') {
      config.affiliate[index] = save.day;
      description += ' · player assigned';
    } else if (facility === 'affiliate' && command === 'recall') {
      delete config.affiliate[index];
      description += ' · player recalled';
    } else if (facility === 'ads') {
      if (command === 'campaign' && Object.hasOwn(campaigns, index)) {
        const company = typeof value?.company === 'string' ? value.company.trim() : '';
        if (index === 'company' && (!company || company.length > 60)) throw new Error('Enter a company name of up to 60 characters.');
        if (!value?.players?.length) throw new Error('Choose featured players from your roster.');
        config.ads[index] = { players: value.players, company };
        cost = campaigns[index].cost * (index === 'solo' ? value.players.length : 1);
        description += ' · ' + campaigns[index].name;
      } else if (command === 'stop' && Object.hasOwn(campaigns, index)) {
        config.ads[index] = null;
      } else if (command === 'brand-sign') {
        const sponsor = sponsorCatalog.find(item => item.name === index);
        if (!sponsor || popularity(config) < sponsor.popularity) throw new Error('This sponsor’s campaign requirement is unmet.');
        if (config.ads.deals[sponsor.category]) throw new Error('End the current deal in this category first.');
        if (Object.keys(config.ads.deals).length >= 4) throw new Error('All four sponsorship slots are full.');
        config.ads.deals[sponsor.category] = sponsor.name;
        config.ads.sponsor = null;
        description += ' · signed ' + sponsor.name;
      } else if (command === 'brand-end' && Object.hasOwn(config.ads.deals, index)) {
        description += ' · ended ' + config.ads.deals[index];
        delete config.ads.deals[index];
      } else if (command === 'sponsor' && (index === 'none' || Object.hasOwn(sponsors, index))) {
        if (index !== 'none' && Object.keys(config.ads.deals).length) throw new Error('Use the branded sponsorship slots.');
        if (index !== 'none' && popularity(config) < (sponsors[index].minimumPopularity ?? 0)) {
          throw new Error('Launch campaigns to reach the required team popularity first.');
        }
        config.ads.sponsor = index === 'none' ? null : index;
      } else throw new Error('Choose an advertising or sponsorship action.');
    } else if (command === 'watch-unlock' && facility === 'arena' && !config.arena.watchUnlocked) {
      config.arena.watchUnlocked = config.arena.watchEnabled = true;
      config.arena.watchPrice = Math.min(15, watchLimit(config));
      cost = 12_000_000;
      description += ' · away watch parties';
    } else if (command === 'watch-toggle' && facility === 'arena' && config.arena.watchUnlocked) {
      config.arena.watchEnabled = !config.arena.watchEnabled;
    } else if (command === 'watch-price' && facility === 'arena' && config.arena.watchUnlocked
      && Number.isSafeInteger(value) && value >= 0 && value <= watchLimit(config)) {
      config.arena.watchPrice = value;
    } else if (command === 'unlock' && product && !product.unlocked) {
      product.unlocked = product.selling = true;
      cost = unlockPrice(facility, index);
      description += ' · ' + catalogs[facility][index][0];
    } else if (command === 'upgrade' && !catalogs[facility] && config[facility].level < maxLevel) {
      cost = upgradePrice(facility, config[facility].level++);
      description += ' · level ' + config[facility].level;
    } else if (command === 'fan-unlock' && facility === 'arena' && !config.arena.fanNightUnlocked) {
      config.arena.fanNightUnlocked = config.arena.fanNight = true;
      cost = 6_000_000;
      description += ' · fan night program';
    } else if (command === 'fan-toggle' && facility === 'arena' && config.arena.fanNightUnlocked) {
      config.arena.fanNight = !config.arena.fanNight;
    } else if (command === 'giveaway-unlock' && facility === 'arena' && !config.arena.giveawayUnlocked) {
      config.arena.giveawayUnlocked = config.arena.giveaway = true;
      cost = 8_500_000;
      description += ' · giveaway program';
    } else if (command === 'giveaway-toggle' && facility === 'arena' && config.arena.giveawayUnlocked) {
      config.arena.giveaway = !config.arena.giveaway;
    } else if (command === 'game-price' && facility === 'arena' && Number.isInteger(index) && index >= save.day
      && Number.isSafeInteger(value) && value >= 0 && value <= 10000) {
      config.arena.gamePrices ??= {};
      config.arena.gamePrices[index] = value;
    } else if (command === 'toggle' && product?.unlocked) {
      product.selling = !product.selling;
    } else if (command === 'package-price' && facility === 'vip' && Number.isInteger(index) && index >= 0
      && index < config.vip.level && Number.isSafeInteger(value) && value >= 0 && value <= 10000) {
      config.vip.packages = [ ...(config.vip.packages ?? [config.vip.price, 260, 400, 550, 725, 950]) ];
      config.vip.packages[index] = value;
    } else if (command === 'price' && (product?.unlocked || !catalogs[facility])
      && Number.isSafeInteger(value) && value >= 0 && value <= 10_000) {
      (product ?? config[facility]).price = value;
    } else throw new Error('That facility change is unavailable.');
    return { type: 'facility', settings: config, cost, description };
  }

  function fanSentiment(save, code, day, recent, config = settings(save, day, code)) {
    if (day < (save.fanSentimentStart ?? Infinity)) return 50;
    const form = recent.reduce((sum, won) => sum + (won ? 1 : -1), 0);
    const price = config.arena.gamePrices?.[day] ?? config.arena.price;
    const value = Math.max(-14, Math.min(8, (78 - price) / 5));
    const events = Number(Boolean(config.arena.fanNight)) * 4 + Number(Boolean(config.arena.giveaway)) * 3;
    const support = code === save.team ? Math.min(6, Math.floor(save.financeActions.reduce((sum, action) =>
      sum + (action.day <= day && action.organization === 'community-' + code ? action.cost : 0), 0) / 50000)) : 0;
    return Math.max(0, Math.min(100, Math.round(50 + (save.fanCarry?.[code] ?? 0) + form * 2 + value + events + support + fanReach(save, code, day, "Local"))));
  }

  function fanMood(save, state, code) {
    const recent = state.results.filter(game => game.home === code || game.away === code).slice(-10)
      .map(game => game.home === code ? game.homeScore > game.awayScore : game.awayScore > game.homeScore);
    return fanSentiment(save, code, save.day, recent);
  }

  function fanPopulation(code, sentiment = 50, reach = 0) {
    const market = 15500 + [...code].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 2300;
    const local = Math.max(0, Math.round((market + (sentiment - 50) * 80) * 12));
    const away = Math.round(local * 0.18);
    const league = Math.round(local * 0.45 + reach * 2880);
    return { local, away, league };
  }

  function gameRevenue(config, code, game, priorWins, priorGames, sentiment = 50, recent = [], defendingChampion = false) {
    const population = fanPopulation(code, sentiment, popularity(config));
    const baseline = population.local / 12 + (population.league - Math.round(population.local * 0.45)) / 12;
    const winRate = (priorWins + 4) / (priorGames + 8);
    const promo = config.arena.fanNight && game.day % 7 < 2;
    const giveaway = config.arena.giveaway && game.day % 11 < 2;
    const ticket = config.arena.gamePrices?.[game.day] ?? config.arena.price;
    const streak = recent.slice(-6).reduce((count, won) => won ? count + 1 : 0, 0);
    const priceTolerance = 145 + Math.max(0, streak - 2) * 9 + (defendingChampion ? 35 : 0);
    const demand = (baseline + (winRate - 0.5) * 7300 + (promo ? 2450 : 0) + (giveaway ? 1600 : 0)) * Math.exp(-(ticket - 78) / (ticket > 78 ? priceTolerance : 145));
    const fans = Math.max(0, Math.min(capacity('arena', config.arena.level) + 650 * expansion(config, 'arena'), Math.round(demand)));
    const parking = Math.min(capacity('parking', config.parking.level) + 300 * expansion(config, 'parking'),
      Math.round(fans * 0.24 * Math.exp(-config.parking.price / 75)));
    const vipTiers = (config.vip.packages ?? [config.vip.price, 260, 400, 550, 725, 950]).slice(0, config.vip.level).map((price, i) => {
      const guests = Math.min(135 + 20 * expansion(config, 'vip'), Math.round(fans * (0.035 + 0.006 * expansion(config, 'vip')) / (1 + 0.35 * i) * Math.exp(-price / 290)));
      return { guests, revenue: guests * price };
    });
    const vip = vipTiers.reduce((sum, tier) => sum + tier.guests, 0);
    const productSales = (type, rate) => config[type].reduce((sum, product, i) => {
      if (!product.unlocked || !product.selling) return sum;
      const standard = catalogs[type][i][1];
      const units = Math.round(fans * rate * (1 + 0.16 * expansion(config, type)) / (1 + i * 0.2) * Math.exp(-product.price / (standard * 1.45)));
      return sum + units * product.price;
    }, 0);
    return { fans, population, parking, vip, promo, ticket, sentiment, sales: { Tickets: fans * ticket,
      'Parking Lot': parking * config.parking.price, 'Merch Stalls': productSales('merch', 0.09),
      'Food Stalls': productSales('food', 0.31), VIP: vipTiers.reduce((sum, tier) => sum + tier.revenue, 0),
      Advertising: Math.round(fans * (5.5 + 0.75 * expansion(config, 'ads'))) } };
  }

  function fanReach(save, code, day, audience) {
    return Math.min(24, save.financeActions.reduce((sum, action) =>
      sum + (action.team === code && action.audience === audience && action.day <= day &&
        action.day > day - 21 ? action.reach : 0), 0));
  }

  function supporterRevenue(save, code, game, config, recent) {
    const sentiment = fanSentiment(save, code, game.day, recent, config);
    const population = fanPopulation(code, sentiment, popularity(config));
    const away = fanReach(save, code, game.day, 'Away');
    const league = fanReach(save, code, game.day, 'League');
    return {
      'League fan merchandise': Math.round(population.league * (0.12 + league * 0.012)),
      'Road fan merchandise': game.away === code ? Math.round(population.away * (0.3 + away * 0.035)) : 0,
    };
  }

  function commercialRevenue(config, home) {
    const sponsor = sponsors[config.ads?.sponsor];
    const brandReceipts = sponsorCatalog.filter(item => config.ads?.deals?.[item.category] === item.name)
      .reduce((sum, item) => sum + (home ? item.home : item.away), 0);
    const watch = !home && config.arena.watchEnabled;
    const price = Math.min(config.arena.watchPrice ?? 15, watchLimit(config));
    const fans = watch ? Math.round(capacity('arena', config.arena.level) * (0.34 + popularity(config) * 0.01)
      * Math.exp(-price / 34)) : 0;
    return { 'Company panel': home && config.ads?.company ? 42000 : 0,
      Sponsorships: (sponsor?.[home ? 'home' : 'away'] ?? 0) + brandReceipts,
      'Watch party tickets': fans * price, 'Watch party concessions': fans * 5,
      'Watch party operations': watch ? -18000 : 0 };
  }

  function carry(save, roster, code = save.team) {
    const config = settings(save, save.day, code);
    for (const key of Object.keys(campaigns)) {
      if (!config.ads[key]) continue;
      const players = config.ads[key].players.filter(id => roster.includes(id));
      config.ads[key] = players.length ? { ...config.ads[key], players } : null;
    }
    return { ...config, affiliate: {}, playerSupport: {}, arena: { ...config.arena, gamePrices: {} } };
  }
  return { expansion, expansionPrice, expansionUpkeep, catalogs, labels, affiliates, initial, settings, change, capacity, maxLevel, developmentMaxLevel, dailyUpkeep, vipPackages, upgradePrice, unlockPrice, gameRevenue, fanPopulation, fanSentiment, fanMood, supporterRevenue, commercialRevenue, campaigns, sponsors, popularity, playerBoost, watchLimit, carry, upgradeCost, clinicEffects, trainingRates };
})();
