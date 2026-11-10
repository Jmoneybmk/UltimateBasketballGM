const seasonSim = (() => {
  const storageKey = 'ultimate-basketball:franchise:v1';
  const slotPrefix = storageKey + ':slot:';
  const lastSlotKey = storageKey + ':last';
  let activeSlot = storageKey;

  function saveSlots() {
    const keys = [storageKey];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(slotPrefix)) keys.push(key);
    }
    return keys.flatMap(key => {
      try {
        const save = JSON.parse(localStorage.getItem(key));
        return save && codes.has(save.team) ? [{ key, team: save.team, year: save.year ?? 0, day: save.day, gm: save.gm?.name }] : [];
      } catch { return []; }
    });
  }

  function openSlot(key) {
    const slots = saveSlots();
    const recent = localStorage.getItem(lastSlotKey);
    key ??= slots.find(slot => slot.key === recent)?.key ?? slots[0]?.key;
    if (!slots.some(slot => slot.key === key)) throw new Error('Choose an available save.');
    const previous = activeSlot;
    activeSlot = key;
    try {
      const save = load();
      if (!save.cpuDepthInitialized && !save.simcast && !save.market?.open && !save.handoff && save.day < playoffStart) {
        write(cpuTeams.openingDepth(save, history(save)));
      }
    } catch (error) { activeSlot = previous; throw error; }
    localStorage.setItem(lastSlotKey, key);
  }

  function deleteSlot(key) {
    if (!saveSlots().some(slot => slot.key === key)) throw new Error('That franchise save is no longer available.');
    localStorage.removeItem(key);
    if (activeSlot === key) quitSlot();
    if (localStorage.getItem(lastSlotKey) === key) localStorage.removeItem(lastSlotKey);
  }

  function quitSlot() { activeSlot = null; }
  const codes = new Set(league.teams.map(team => team.code));
  const rotationMinutes = [34, 33, 32, 31, 30, 23, 20, 15, 12, 10];
  const players = playerTools.registry;
  const boxFields = ['MIN', 'PTS', 'FGM', 'FGA', '3PM', '3PA', 'FTM', 'FTA', 'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TO', 'PF', 'DNK'];
  const gameRatings = a => ({
    attack: (a.Inside + a.Close + a.Mid + a['3PT'] + a.Handles + a['Pass Acc'] + a['Offensive IQ']) / 7,
    defense: (a['Interior Defense'] + a['Perimeter Defense'] + a['Defensive IQ']) / 3,
  });
  const ratings = new Map(league.players.map(player => [player.id, gameRatings(player.attributes)]));
  const rotationValue = player => {
    const rating = ratings.get(player.id) ?? gameRatings(player.attributes);
    return rating.attack + rating.defense + (player.history?.[0]?.stats.MIN ?? 0);
  };
  const rotationOrder = (a, b) => rotationValue(b) - rotationValue(a);
  const rotations = new Map([...codes].map(code => [code, league.players.filter(p => p.team === code)
    .sort(rotationOrder)]));
  const defaultPlan = (code, roster = rotations.get(code)) =>
    Object.fromEntries(roster.map((player, index) => [player.id, rotationMinutes[index] ?? 0]));
  function orderedRoster(roster, order, minutes) {
    if (!order) return [...roster].sort((a, b) => minutes[b.id] - minutes[a.id]);
    const slots = new Map(order.map((id, index) => [id, index]));
    return [...roster].sort((a, b) => (slots.get(a.id) ?? Infinity) - (slots.get(b.id) ?? Infinity));
  }
  const tradeDeadline = 90;
  const tradeDeadlineFor = save => save.noTradeDeadline ? lastDay : tradeDeadline + (save.tradeDeadlineOffset ?? (save.laterTradeDeadline ? 7 : 0));
  const isTransaction = action => action.type === 'trade' || action.type === 'cut' || action.type === 'signing' && action.inSeason;
  const tradePlayers = action => [action.send ?? (action.id ? [action.id] : []),
    action.receive ?? (action.incoming ? [action.incoming] : [])];

  function movePlayers(rosters, action, team) {
    if (action.type === 'trade') {
      const [send, receive] = tradePlayers(action);
      const own = action.team ?? team;
      for (const [club, leaving, arriving] of [[own, send, receive], [action.otherTeam, receive, send]]) {
        rosters.set(club, [...rosters.get(club).filter(player => !leaving.includes(player.id)), ...arriving.map(id => players.get(id))]
          .sort(rotationOrder));
      }
      return;
    }
    const outgoing = players.get(action.id);
    if (action.type === 'signing') {
      const club = action.team ?? team;
      rosters.set(club, [...rosters.get(club), outgoing].sort(rotationOrder));
      return;
    }
    const releasing = action.team ?? team;
    rosters.set(releasing, rosters.get(releasing).filter(player => player.id !== outgoing.id));
  }

  function reconcilePlan(code, plan, roster) {
    if (!plan) return defaultPlan(code, roster);
    const minutes = Object.fromEntries(roster.map(player => [player.id, plan[player.id] ?? 0]));
    let remaining = 240 - Object.values(minutes).reduce((total, value) => total + value, 0);
    const priority = [...roster.filter(player => !Object.hasOwn(plan, player.id)), ...roster.filter(player => Object.hasOwn(plan, player.id))];
    for (const { id } of priority) {
      const added = Math.min(remaining, 48 - minutes[id]);
      minutes[id] += added;
      remaining -= added;
    }
    return minutes;
  }

  const freshHealth = () => ({ fatigue: 100, durability: 100, lastPlayed: null, outUntil: null });
  const tier = durability => durability === 0 ? 'Season' : durability <= 10 ? 'Out' :
    durability <= 30 ? 'Hurt' : durability <= 50 ? 'Sore' : 'Healthy';
  const minuteLimit = durability => durability <= 10 ? 0 : durability <= 30 ? 20 : 48;

  function validPlan(roster, minutes) {
    return minutes && roster.every(player => Number.isInteger(minutes[player.id]) &&
      minutes[player.id] >= 0 && minutes[player.id] <= 48)
      && roster.reduce((total, player) => total + minutes[player.id], 0) === 240;
  }

  function allocateMinutes(code, plan, health, roster = rotations.get(code), order) {
    const rotation = orderedRoster(roster, order, plan).map(player => {
      const target = plan[player.id];
      const cap = minuteLimit(health.get(player.id).durability);
      return { id: player.id, target, cap, minutes: Math.min(target, cap) };
    });
    let remaining = 240 - rotation.reduce((sum, player) => sum + player.minutes, 0);
    // Prefer healthy reserves before asking the existing rotation to play extra minutes.
    const reserves = [...rotation.filter(player => player.target === 0), ...rotation.filter(player => player.target > 0)];
    for (const player of reserves) {
      const added = Math.min(remaining, player.cap - player.minutes);
      player.minutes += added;
      remaining -= added;
    }
    return remaining ? null : rotation.filter(player => player.minutes > 0);
  }

  function fatigueLoss(minutes, backToBack, revised = true) {
    return revised ? Math.ceil(minutes * 0.65) + 3 + (backToBack ? 6 : 0)
      : Math.ceil(minutes * 0.8) + 4 + (backToBack ? 7 : 0);
  }

  // Gameplay recovery windows in simulation days.
  const injuryFamilies = [
    { Sore: ['Twisted ankle', 2], Hurt: ['Sprained ankle', 7], Out: ['Torn ankle ligament', 35], Season: ['Broken ankle', null] },
    { Sore: ['Sore knee', 3], Hurt: ['Knee sprain', 10], Out: ['Torn meniscus', 42], Season: ['Torn ACL', null] },
    { Sore: ['Hamstring tightness', 2], Hurt: ['Hamstring strain', 8], Out: ['Torn hamstring', 32], Season: ['Severe hamstring tear', null] },
    { Sore: ['Bruised wrist', 2], Hurt: ['Wrist sprain', 6], Out: ['Fractured wrist', 28], Season: ['Displaced wrist fracture', null] },
  ];
  const injurySeed = id => [...String(id)].reduce((value, char) => Math.imul(value, 31) + char.charCodeAt(0) >>> 0, 0);

  function diagnose(player, id, day, severity, staff, clinic) {
    const family = player.injury?.family ?? ((injurySeed(id) ^ day) >>> 0) % injuryFamilies.length;
    const [name, duration] = injuryFamilies[family][severity];
    const relief = (staff?.rehabDays ?? 0) + (clinic?.rehabDays ?? 0);
    const floor = severity === 'Out' ? (clinic?.rehabDays ? 14 : 21) : 1;
    const unlockDay = duration === null ? null : day + Math.max(floor, duration - relief) + 1;
    player.injury = { name, family, severity, day, unlockDay };
    if (severity === 'Out' || severity === 'Season') {
      player.outUntil = unlockDay;
      player.injuryDay = day;
    }
  }

  function updateHealth(health, day, played, playoffs = false, staffFor = () => undefined, revised = true, clinicFor = () => undefined, namedInjuries = false) {
    for (const [id, player] of health) {
      const staff = staffFor(id);
      const clinic = clinicFor(id);
      const minutes = played.get(id) ?? 0;
      if (!minutes) {
        player.fatigue = Math.min(100, player.fatigue + (revised ? 32 : 28) + (clinic?.fatigue ?? 0));
        const lock = player.injury?.unlockDay ?? player.outUntil;
        if (player.durability > 0 && (lock === null || day >= lock)) {
          player.durability = Math.min(100, player.durability + (player.durability <= 10 ? 5 : 2) + (staff?.recovery ?? 0) + (clinic?.durability ?? 0));
          if (player.durability > 10) player.outUntil = null;
          if (player.durability > 50) delete player.injury;
        }
        continue;
      }
      const backToBack = player.lastPlayed === day - 1;
      player.fatigue = Math.max(0, player.fatigue - fatigueLoss(minutes, backToBack, revised));
      const wear = player.fatigue >= 80 ? 0 : player.fatigue >= 50 ? 2 : player.fatigue >= 20 ? 4 : 6;
      const previousTier = tier(player.durability);
      const worsened = previousTier === 'Hurt' && wear > 0
        && randomFor(Math.imul(namedInjuries ? injurySeed(id) : Number(id), 2654435761) ^ day)() < 0.35;
      player.durability = Math.max(playoffs ? 1 : 0, player.durability - wear - (worsened ? 8 : 0));
      const severity = tier(player.durability);
      if (namedInjuries && severity !== 'Healthy' && severity !== previousTier) diagnose(player, id, day, severity, staff, clinic);
      else if (player.durability > 0 && player.durability <= 10) {
        player.outUntil = day + Math.max(clinic?.rehabDays ? 14 : 21, 21 + (10 - player.durability) * 7 - (staff?.rehabDays ?? 0) - (clinic?.rehabDays ?? 0));
        player.injuryDay = day;
      }
      player.lastPlayed = day;
    }
  }

  function roundRobin(teams) {
    const order = [...teams];
    return Array.from({ length: order.length - 1 }, (_, round) => {
      const games = order.slice(0, order.length / 2).map((code, i) => {
        const opponent = order[order.length - 1 - i];
        return (round + i) % 2 ? [opponent, code] : [code, opponent];
      });
      order.splice(1, 0, order.pop());
      return games;
    });
  }

  const full = roundRobin(codes);
  const east = roundRobin(league.teams.filter(team => team.conference === 'East').map(team => team.code).concat(null));
  const west = roundRobin(league.teams.filter(team => team.conference === 'West').map(team => team.code).concat(null));
  // Pair the two conference byes to keep 15 games and 30 distinct teams in each extra round.
  const extra = east.slice(0, 12).map((round, index) => {
    const eastBye = round.find(game => game.includes(null)).find(Boolean);
    const westBye = west[index].find(game => game.includes(null)).find(Boolean);
    return [...round, ...west[index]].filter(game => !game.includes(null)).concat([[eastBye, westBye]]);
  });
  const firstHalf = [...full, ...extra];
  const rounds = [...firstHalf, ...firstHalf.map(round => round.map(([home, away]) => [away, home]))];
  const scheduleCache = new Map();
  function variedSchedule(year) {
    if (scheduleCache.has(year)) return scheduleCache.get(year);
    const clubs = ['East', 'West'].map(conference => {
      const divisions = [...new Set(league.teams.filter(team => team.conference === conference).map(team => team.division))];
      return divisions.map(division => league.teams.filter(team => team.division === division).map(team => team.code));
    });
    const mirror = block => block.map(([home, away]) => [away, home]);
    const blocks = [...full, ...full.map(mirror)];
    const divisional = clubs.flat().map(division => roundRobin([...division, null]));
    for (let i = 0; i < 5; i++) {
      const block = divisional.flatMap(rounds => rounds[i].filter(pair => pair.every(Boolean)));
      blocks.push(block, mirror(block));
    }
    const fixedVenue = new Set();
    const pairKey = (a,b) => [a,b].sort().join('/');
    for (const [x,y] of [[0,1],[0,2],[1,2]]) {
      for (let i = 0; i < 5; i++) {
        const block = clubs.flatMap(divisions => divisions[x].map((code, n) =>
          [code, divisions[y][(n + i + year) % 5]]));
        if (i < 3) blocks.push(block, mirror(block));
        else {
          const single = i === 4 ? mirror(block) : block;
          fixedVenue.add(single);
          blocks.push(single);
        }
      }
    }
    let random = (year + 1) * 1013904223 >>> 0;
    for (let i = blocks.length - 1; i > 0; i--) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const j = random % (i + 1);
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }
    const finale = blocks.findIndex(block => block.length === 15);
    blocks.push(...blocks.splice(finale, 1));
    const venue = new Map([...codes].map(code => [code, { last: null, streak: 0, balance: 0 }]));
    const unmatched = new Map();
    const penalty = (code, home) => {
      const team = venue.get(code);
      return Math.abs(team.balance + (home ? 1 : -1)) + (team.last === home ? (team.streak + 1) ** 2 * 2 : 0);
    };
    const schedule = Array.from({ length: lastDay + 1 }, () => []);
    blocks.forEach((block, index) => {
      const day = Math.floor(index * lastDay / (blocks.length - 1));
      const next = Math.floor((index + 1) * lastDay / (blocks.length - 1));
      block.forEach(([a,b], slot) => {
        const key = pairKey(a,b);
        let home, away;
        // A third meeting has its own fixed venue. The other two or four are balanced in pairs.
        if (fixedVenue.has(block)) [home, away] = [a,b];
        else if (unmatched.has(key)) {
          [away, home] = unmatched.get(key);
          unmatched.delete(key);
        } else {
          [home, away] = penalty(a, true) + penalty(b, false) <= penalty(b, true) + penalty(a, false) ? [a,b] : [b,a];
          unmatched.set(key, [home, away]);
        }
        for (const [code, atHome] of [[home, true], [away, false]]) {
          const team = venue.get(code);
          team.streak = team.last === atHome ? team.streak + 1 : 1;
          team.last = atHome;
          team.balance += atHome ? 1 : -1;
        }
        schedule[day + Number(day < lastDay && next - day > 1 && (slot + index + year) % 2 === 1)].push([home, away]);
      });
    });
    scheduleCache.set(year, schedule);
    return schedule;
  }
  // Keep the existing season clock so saved playoff and contract dates stay valid.
  const lastDay = (rounds.length - 1) * 2;
  const playoffStart = lastDay + 1;
  const firstPlayoffGame = playoffStart + 1;
  const allStarDay = 105;
  function allStarDayFor(save) {
    if (save?.scheduleVersion !== 4) return allStarDay;
    const year = Number(date(0, save.year).slice(0, 4)) + 1;
    const feb15 = new Date(Date.UTC(year, 1, 15));
    feb15.setUTCDate(15 + (7 - feb15.getUTCDay()) % 7);
    return (feb15.getTime() - Date.parse(date(0, save.year))) / 86400000;
  }
  const revisedRules = save => save.rulesVersion === 2 || (save.rulesVersion === undefined && save.day <= firstPlayoffGame);

  const optimizedSchedules = new Map();
  const cities = {
    ATL:[34,-84], BOS:[42,-71], BKN:[41,-74], CHA:[35,-81], CHI:[42,-88], CLE:[41,-82], DAL:[33,-97], DEN:[40,-105],
    DET:[42,-83], GSW:[38,-122], HOU:[30,-95], IND:[40,-86], LAC:[34,-118], LAL:[34,-118], MEM:[35,-90],
    MIA:[26,-80], MIL:[43,-88], MIN:[45,-93], NOP:[30,-90], NYK:[41,-74], OKC:[35,-98], ORL:[28,-81],
    PHI:[40,-75], PHX:[33,-112], POR:[46,-123], SAC:[39,-121], SAS:[29,-98], TOR:[44,-79], UTA:[41,-112], WAS:[39,-77],
  };
  const distance = (a, b) => {
    const [latA, lonA] = cities[a], [latB, lonB] = cities[b];
    return Math.hypot(latA - latB, (lonA - lonB) * 0.8);
  };

  function optimizedSchedule(year, allStarDay) {
    const key = year + ":" + allStarDay;
    if (optimizedSchedules.has(key)) return optimizedSchedules.get(key);
    const random = randomFor(Math.imul(year + 3, 2654435761));
    const dates = Array.from({ length: lastDay }, (_, day) => day).filter(day => Math.abs(day - allStarDay) > 2);
    const source = variedSchedule(year);
    const slates = Array.from({ length: lastDay + 1 }, () => []);
    const occupied = new Map([...codes].map(code => [code, new Array(lastDay + 1)]));
    const venueDistances = new Map([...codes].map(a => [a, new Map([...codes].map(b => [b, distance(a, b)]))]));
    function place(game, day) {
      game.day = day;
      slates[day].push(game);
      for (const code of game.pair) occupied.get(code)[day] = game;
    }
    function remove(game) {
      slates[game.day].splice(slates[game.day].indexOf(game), 1);
      for (const code of game.pair) occupied.get(code)[game.day] = undefined;
    }

    // Start from a valid opponent and venue matrix, then move individual games and swap date slots.
    const games = source.flatMap((pairs, oldDay) => pairs.map(pair => {
      const game = { pair, day: oldDay };
      if (Math.abs(oldDay - allStarDay) > 2 && (oldDay !== 0 || slates[0].length < 3)) place(game, oldDay);
      return game;
    }));
    const movable = games.filter(game => game.day !== lastDay);
    const weekday = new Date(date(0, year) + 'T00:00:00Z').getUTCDay();
    const target = day => day === 0 ? 3 : [8, 7, 6, 9, 6, 9, 9][(weekday + day) % 7];
    const slateCost = day => (slates[day].length - target(day)) ** 2 * 0.7;
    for (const game of movable.filter(game => !slates[game.day].includes(game))) {
      const openings = dates.filter(day => day !== 0 && slates[day].length < 13 && game.pair.every(code => !occupied.get(code)[day]));
      const cost = day => slates[day].length - target(day) + Math.abs(day - game.day) * 0.05;
      openings.sort((a, b) => cost(a) - cost(b));
      if (!openings.length) throw new Error('Could not schedule a game outside the All-Star break.');
      place(game, openings[0]);
    }
    function teamCost(code) {
      const slots = occupied.get(code);
      let cost = 0, previous = -1, venue = code, consecutive = 0, backToBacks = 0, stretch = 0, lastWasHome = true;
      const recent = [];
      const opponents = new Map();
      for (let day = 0; day <= lastDay; day++) {
        const game = slots[day];
        if (!game) continue;
        const [home, away] = game.pair;
        const isHome = home === code;
        const opponent = isHome ? away : home;
        const gap = day - previous;
        const travel = venueDistances.get(venue).get(home);
        if (gap === 1 && previous >= 0) {
          backToBacks++;
          consecutive++;
          if (consecutive >= 2) cost += 280;
        } else consecutive = 0;
        if (gap >= 5 && !(previous < allStarDay - 2 && day > allStarDay + 2)) cost += (gap - 4) ** 2 * 2;
        cost += travel * (gap === 1 ? 0.46 : 0.17);
        stretch = lastWasHome === isHome ? stretch + 1 : 1;
        if (stretch >= 7) cost += (stretch - 6) ** 2 * 3;
        if (recent.length >= 3 && day - recent.at(-3) <= 4) cost += 7;
        if (recent.length === 3) recent.shift();
        recent.push(day);
        const priorMeeting = opponents.get(opponent);
        if (priorMeeting != null && day - priorMeeting < 6) cost += 1.2 * (6 - day + priorMeeting);
        opponents.set(opponent, day);
        previous = day;
        venue = home;
        lastWasHome = isHome;
      }
      return cost + (backToBacks - 14) ** 2 * 5;
    }
    const costs = new Map([...codes].map(code => [code, teamCost(code)]));
    const iterations = 110000;
    for (let iteration = 0; iteration < iterations; iteration++) {
      const game = movable[Math.floor(random() * movable.length)];
      const from = game.day;
      if (from === 0) continue;
      const to = random() < 0.5 ? from + Math.floor(random() * 21) - 10 : dates[Math.floor(random() * dates.length)];
      if (from === to || to <= 0 || to >= lastDay || Math.abs(to - allStarDay) <= 2) continue;
      const clashes = slates[to].filter(other => other.pair.some(code => game.pair.includes(code)));
      if (clashes.length > 1) continue;
      const swap = clashes[0];
      if (swap?.pair.some(code => occupied.get(code)[from] && occupied.get(code)[from] !== game)) continue;
      if (!swap && slates[to].length >= (to === 0 ? 5 : 13)) continue;
      const teams = [...new Set([...game.pair, ...(swap?.pair ?? [])])];
      const before = slateCost(from) + slateCost(to) + teams.reduce((sum, code) => sum + costs.get(code), 0);
      remove(game);
      if (swap) remove(swap);
      place(game, to);
      if (swap) place(swap, from);
      const after = teams.map(teamCost);
      const delta = slateCost(from) + slateCost(to) + after.reduce((sum, cost) => sum + cost, 0) - before;
      const temperature = 5 * (1 - iteration / iterations) + 0.1;
      if (delta <= 0 || random() < Math.exp(-delta / temperature)) {
        teams.forEach((code, index) => costs.set(code, after[index]));
      } else {
        remove(game);
        if (swap) remove(swap);
        place(game, from);
        if (swap) place(swap, to);
      }
    }
    const schedule = slates.map(slate => slate.map(game => game.pair));
    optimizedSchedules.set(key, schedule);
    return schedule;
  }

  function date(day, year = 0) {
    const start = new Date(league.snapshot + 'T00:00:00Z');
    start.setUTCFullYear(start.getUTCFullYear() + year);
    start.setUTCDate(start.getUTCDate() + day);
    return start.toISOString().slice(0, 10);
  }

  function fixtures(day, save) {
    if (save?.scheduleVersion >= 3) return optimizedSchedule(save.year ?? 0, allStarDayFor(save))[day] ?? [];
    if (save?.staggeredSchedule) return variedSchedule(save.year ?? 0)[day] ?? [];
    return day % 2 === 0 ? (rounds[day / 2] ?? []) : [];
  }

  function randomFor(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function lineup(rotation, random, attributesFor, staff) {
    return rotation.map(({ id, minutes }) => {
      const { attack, defense } = gameRatings(attributesFor(id));
      return {
        id, minutes,
        points: Math.round(minutes * (0.44 + (attack + (staff?.attack ?? 0) - 63) * 0.013 + (random() - 0.5) * 0.63)),
        defense: defense + (staff?.defense ?? 0),
      };
    });
  }

  function applyDefense(lineup, opponent, home) {
    const minutesPlayed = opponent.reduce((total, player) => total + player.minutes, 0);
    const defense = opponent.reduce((total, player) => total + player.defense * player.minutes, 0) / minutesPlayed;
    return lineup.map(({ id, minutes, points }) => ({
      id, minutes, points: Math.max(0, Math.round(points + minutes * ((66 - defense) * 0.008 + (home ? 0.012 : 0)))),
    }));
  }

  function shootingLine({ id, minutes: MIN, points: PTS }, random, attributesFor) {
    const a = attributesFor(id);
    const threeShare = Math.max(0, (a['3PT'] - 45) / 140);
    const threes = Math.min(Math.floor(PTS / 3), Math.round(PTS * threeShare * (0.6 + random() * 0.8) / 3));
    const remaining = PTS - 3 * threes;
    const FTM = Math.min(remaining, Math.round(PTS * (0.05 + random() * 0.24)));
    const freeThrows = FTM + (remaining - FTM) % 2;
    const twos = (remaining - freeThrows) / 2;
    const misses = (makes, attempts, accuracy) => Math.round(Math.max(makes, attempts) * (1 - accuracy));
    const missedThrees = misses(threes / 0.36, MIN * threeShare * 0.42, 0.24 + a['3PT'] * 0.0017);
    const missedTwos = misses(twos / 0.52, MIN * (0.27 - threeShare * 0.26), 0.37 + a.Close * 0.002);
    const missedFreeThrows = misses(freeThrows / 0.76, MIN * 0.025, a.FT / 100);
    return {
      id, MIN, PTS, FGM: twos + threes, FGA: twos + threes + missedThrees + missedTwos,
      '3PM': threes, '3PA': threes + missedThrees, FTM: freeThrows, FTA: freeThrows + missedFreeThrows,
      OREB: 0, DREB: 0, AST: 0, STL: 0, BLK: 0,
      TO: Math.round(MIN * (0.02 + random() * 0.07)), PF: Math.round(MIN * (0.02 + random() * 0.09)),
    };
  }

  function assignTeamStats(offense, defense, random, attributesFor) {
    function picker(lineup, attribute) {
      let total = 0;
      const cutoffs = lineup.map(p => (total += p.MIN * attributesFor(p.id)[attribute] ** 2));
      return () => {
        const target = random() * total;
        return lineup[cutoffs.findIndex(cutoff => target < cutoff)];
      };
    }
    const offensiveRebounder = picker(offense, 'Offensive Rebound');
    const defensiveRebounder = picker(defense, 'Defensive Rebound');
    const passer = picker(offense, 'Pass Acc');
    const stealer = picker(defense, 'Steal');
    const blocker = picker(defense, 'Block');
    for (const shooter of offense) {
      for (let i = 0; i < shooter.FGM; i++) {
        if (random() < 0.68) {
          const teammate = passer();
          if (teammate !== shooter) teammate.AST++;
        }
      }
      for (let i = shooter.FGM; i < shooter.FGA; i++) {
        if (random() < 0.10) blocker().BLK++;
        const rebound = random();
        if (rebound < 0.24) offensiveRebounder().OREB++;
        else if (rebound < 0.96) defensiveRebounder().DREB++;
      }
      for (let i = 0; i < shooter.TO; i++) {
        if (random() < 0.60) stealer().STL++;
      }
    }
  }

  function gamesForDay(save, day, health, plan, order, development, rosters, slate, playoffRound, staff, profiles, cast) {
    const activity = save.financeActions.findLast(action => action.activity && action.day < day && day - action.day <= 7);
    const morale = teamFinance.activities[activity?.activity]?.morale ?? 0;
    const coaching = code => code === save.team && morale
      ? { ...staff?.get(code), attack: (staff?.get(code)?.attack ?? 0) + morale } : staff?.get(code);
    const gameplan = currentGameplan(save, day);
    const attributesFor = (id, tactics, controlled) => {
      const player = profiles.get(id);
      const raw = development ? playerDevelopment.ratings(development, player) : player.attributes;
      return controlled ? castRatings(raw, tactics.play, tactics.defense, tactics.shotProfile ?? 0, tactics.scoring?.[0] === id) : raw;
    };
    return slate.map(([home, away], index) => {
      const rotation = code => cast ? cast.rotations.get(code) : health ? allocateMinutes(code, code === save.team ? plan : defaultPlan(code, rosters.get(code)),
        health, rosters.get(code), code === save.team ? order : undefined)
        : rotations.get(code).slice(0, rotationMinutes.length).map((p, i) => ({ id: p.id, minutes: rotationMinutes[i] }));
      const homeRotation = rotation(home);
      const awayRotation = rotation(away);
      const id = `${day}-${home}`;
      if (!homeRotation || !awayRotation) {
        return { id, day, home, away, homeScore: homeRotation || (playoffRound != null && !awayRotation) ? 2 : 0,
          awayScore: awayRotation ? 2 : 0, homeBox: [], awayBox: [], forfeit: true, playoffRound };
      }
      const periodSeed = cast ? Math.imul(cast.period + 1, 73939133) : 0;
      const random = randomFor(save.seed ^ periodSeed ^ Math.imul(day * 15 + index + 1, 2654435761));
      const userGame = home === save.team || away === save.team;
      const tactics = cast ? { ...cast, scoring: cast.scoring ?? [cast.focus] } : gameplan;
      const ratings = code => id => attributesFor(id, tactics, cast ? cast.controlled.has(id)
        : code === save.team && (tactics.play !== 'balanced' || tactics.defense !== 'balanced' || tactics.scoring.some(Boolean)));
      const homeLineup = lineup(homeRotation, random, ratings(home), coaching(home));
      const awayLineup = lineup(awayRotation, random, ratings(away), coaching(away));
      if (userGame && tactics.scoring?.some(Boolean)) {
        const unit = home === save.team ? homeLineup : awayLineup;
        for (const [index, id] of tactics.scoring.entries()) {
          const featured = unit.find(player => player.id === id);
          if (!featured) continue;
          for (const teammate of unit) {
            if (tactics.scoring.includes(teammate.id) || teammate === featured || teammate.points < 2) continue;
            const points = Math.floor(teammate.points * [0.22, 0.14, 0.08][index]);
            teammate.points -= points;
            featured.points += points;
          }
        }
      }
      if (userGame && (cast || gameplan.tempo !== 'Average')) {
        const own = home === save.team ? homeLineup : awayLineup;
        const other = home === save.team ? awayLineup : homeLineup;
        const pace = cast ? cast.settings?.tempo : gameplan.tempo;
        const tempo = pace === 'Fast' ? 1.09 : pace === 'Slow' ? 0.92 : 1;
        for (const player of [...own, ...other]) player.points = Math.round(player.points * tempo);
        for (const player of other) {
          const guard = own.find(candidate => candidate.id === cast?.matchups?.[player.id]);
          const settings = { ...cast?.coverage?.all, ...cast?.coverage?.[player.id] };
          const active = Object.values(settings).filter(value => !['Auto', 'Manual', 'No'].includes(value)).length;
          const matchup = guard ? (guard.defense - 62) * Math.min(guard.minutes, player.minutes) * 0.005 : 0;
          const coverage = active * player.minutes * 0.007;
          player.points = Math.max(0, Math.round(player.points - matchup - coverage));
        }
      }
      const homeBox = applyDefense(homeLineup, awayLineup, true);
      const awayBox = applyDefense(awayLineup, homeLineup, false);
      let homeScore = homeBox.reduce((sum, p) => sum + p.points, 0);
      let awayScore = awayBox.reduce((sum, p) => sum + p.points, 0);
      let overtime = 0;
      if (!cast && playoffRound != null && revisedRules(save)) {
        const overtimeLineup = rotation => rotation.slice(0, 5).map(({ id }) => ({ id, minutes: 5 }));
        const homeFive = overtimeLineup(homeRotation);
        const awayFive = overtimeLineup(awayRotation);
        const addPeriod = (box, period) => {
          for (const line of period) {
            const player = box.find(entry => entry.id === line.id);
            player.minutes += line.minutes;
            player.points += line.points;
          }
          return period.reduce((score, line) => score + line.points, 0);
        };
        while (homeScore === awayScore) {
          overtime++;
          const homePeriod = lineup(homeFive, random, attributesFor, coaching(home));
          const awayPeriod = lineup(awayFive, random, attributesFor, coaching(away));
          homeScore += addPeriod(homeBox, applyDefense(homePeriod, awayPeriod, true));
          awayScore += addPeriod(awayBox, applyDefense(awayPeriod, homePeriod, false));
        }
      }
      // Preserve the scoring model used by previously simulated regular-season and legacy games.
      if (!cast && homeScore === awayScore) {
        if (random() < 0.54) { homeBox[0].points += 2; homeScore += 2; }
        else { awayBox[0].points += 2; awayScore += 2; }
      }
      const boxRandom = randomFor(save.seed ^ periodSeed ^ Math.imul(day * 15 + index + 1, 1597334677));
      const homeStats = homeBox.map(player => shootingLine(player, boxRandom, attributesFor));
      const awayStats = awayBox.map(player => shootingLine(player, boxRandom, attributesFor));
      if (save.allStarFormat === 2) {
        const dunkRandom = randomFor(save.seed ^ periodSeed ^ Math.imul(day * 15 + index + 1, 479909));
        for (const line of [...homeStats, ...awayStats]) {
          const { Inside, Speed } = attributesFor(line.id);
          const chance = Math.max(0.02, (Inside + Speed - 100) / 330);
          line.DNK = 0;
          for (let shot = line['3PM']; shot < line.FGM; shot++) if (dunkRandom() < chance) line.DNK++;
        }
      }
      assignTeamStats(homeStats, awayStats, boxRandom, attributesFor);
      assignTeamStats(awayStats, homeStats, boxRandom, attributesFor);
      if (cast) {
        const own = home === save.team ? homeStats : awayStats;
        for (const line of own) {
          if (cast.settings?.aggression === 'Aggressive') {
            if (boxRandom() < line.MIN / 16) line.PF++;
            if (boxRandom() < line.MIN / 20) line.STL++;
          } else if (cast.settings?.aggression === 'Conservative' && line.PF) line.PF--;
          if (cast.settings?.offReb === 'Crash' && boxRandom() < line.MIN / 18) line.OREB++;
          if (cast.settings?.offReb === 'Get back' && line.OREB) line.OREB--;
          if (cast.settings?.defReb === 'Crash' && boxRandom() < line.MIN / 18) line.DREB++;
          if (cast.settings?.defReb === 'Run' && line.DREB) line.DREB--;
        }
      }
      return { id, day, home, away, homeScore, awayScore, homeBox: homeStats, awayBox: awayStats,
        homeRoster: rosters.get(home).map(p => p.id), awayRoster: rosters.get(away).map(p => p.id), playoffRound,
        ...(overtime ? { overtime } : {}) };
    });
  }

  const castPlays = {
    balanced: 'Balanced offense', pickRoll: 'Pick and roll', post: 'Post-up', perimeter: 'Perimeter motion', transition: 'Push the pace',
  };
  const castDefenses = { balanced: 'Balanced defense', paint: 'Protect the paint', pressure: 'Pressure perimeter' };
  const castCoverage = {
    'On-ball pressure': ['Auto', 'Gap', 'Moderate', 'Tight', 'Smother'],
    'Off-ball pressure': ['Auto', 'Gap', 'Moderate', 'Tight', 'Deny ball'],
    'Force direction': ['Auto', 'Middle', 'Baseline'],
    'On-ball screen': ['Auto', 'Go over', 'Go under', 'Switch', 'Ice'],
    'Hedge': ['Auto', 'No hedge', 'Soft hedge', 'Hard hedge', 'Trap'],
    'On-ball screen (center)': ['Auto', 'Go over', 'Go under', 'Switch', 'Ice'],
    'Hedge (center)': ['Auto', 'No hedge', 'Soft hedge', 'Hard hedge', 'Trap'],
    'Off-ball screen': ['Auto', 'Go over', 'Go under', 'Switch'],
    'Post': ['Auto', 'Behind', 'Front', 'Three-quarter top', 'Three-quarter bottom'],
    'Double team perimeter': ['Auto', 'Manual', 'On catch', 'On drive'],
    'Double team post': ['Auto', 'Manual', 'On catch', 'On dribble'],
    'Switch rules': ['Auto', 'Switch all', 'Switch guards', 'Switch bigs', 'No switch'],
    'Pre-rotate': ['Auto', 'No', 'Yes'],
    'On-ball help rules': ['Auto', 'Help', 'No help'],
    'Cutter help rules': ['Auto', 'Help', 'No help'],
    'Screen help rules': ['Auto', 'Help', 'No help'],
  };

  function castTimeline(period, length, seed) {
    const random = randomFor(seed);
    const events = [];
    for (const side of ['away', 'home']) for (const line of period[side + 'Box']) {
      const add = (count, label, stats, kind) => {
        for (let i = 0; i < count; i++) events.push({ side, id: line.id, label, stats, kind, order: random() });
      };
      for (let i = 0; i < line.FGM - line['3PM']; i++) {
        const kind = random() < 0.6 ? 'paint' : 'midrange';
        const dunk = i < (line.DNK ?? 0);
        add(1, dunk ? 'throws down a dunk' : kind === 'paint' ? 'makes a shot in the paint' : 'makes a midrange shot',
          { PTS: 2, FGM: 1, FGA: 1, ...(dunk ? { DNK: 1 } : {}) }, dunk ? 'paint' : kind);
      }
      add(line['3PM'], 'makes a three-pointer', { PTS: 3, FGM: 1, FGA: 1, '3PM': 1, '3PA': 1 }, 'three');
      add(line['3PA'] - line['3PM'], 'misses a three-pointer', { FGA: 1, '3PA': 1 });
      add(line.FGA - line.FGM - (line['3PA'] - line['3PM']), 'misses a two-pointer', { FGA: 1 });
      add(line.FTM, 'makes a free throw', { PTS: 1, FTM: 1, FTA: 1 });
      add(line.FTA - line.FTM, 'misses a free throw', { FTA: 1 });
      for (const [field, label] of Object.entries({ OREB: 'grabs an offensive rebound', DREB: 'grabs a defensive rebound',
        AST: 'records an assist', STL: 'records a steal', BLK: 'blocks a shot', TO: 'turns it over', PF: 'commits a foul' })) {
        add(line[field], label, { [field]: 1 });
      }
    }
    const ordered = events.sort((a, b) => a.order - b.order);
    return ordered.map(({ order, ...event }, index) => {
      const previous = ordered[index - 1];
      return { ...event, second: Math.floor(length * 60 * (index + 1) / (ordered.length + 1)),
        secondChance: Boolean(event.stats.PTS && previous?.side === event.side && previous.stats.OREB),
        fastBreak: Boolean(event.stats.FGM && previous && (previous.side !== event.side && previous.stats.TO
          || previous.side === event.side && previous.stats.STL)) };
    });
  }

  function challengeableFoul(save, cast) {
    const pending = cast.pending;
    const count = cast.challengeCount ?? 0;
    if (!pending || (cast.timeouts ?? 0) >= 7 || count && !cast.secondChallenge) return null;
    const event = pending.events.findLast(item => item.second <= pending.elapsed);
    const side = cast.home === save.team ? 'home' : 'away';
    return event?.side === side && event.stats.PF && !event.intentional && !event.reviewed ? event : null;
  }

  function castClock(cast) {
    const length = cast.periods.length < 4 ? 720 : 300;
    return Math.max(0, length - (cast.pending?.elapsed ?? 0));
  }
  function castRatings(attributes, play, defense, shotProfile, focus) {
    const boosts = { pickRoll: ['Handles', 'Pass Acc', 'Close'], post: ['Inside', 'Close', 'Strength'],
      perimeter: ['3PT', 'Mid', 'Offensive IQ'], transition: ['Speed', 'Handles', 'Inside'] };
    const keys = boosts[play] ?? [];
    const aptitude = keys.length ? keys.reduce((sum, key) => sum + attributes[key], 0) / keys.length : 65;
    const change = keys.length ? (aptitude - 65) * 0.27 + 1.5 : 0;
    return { ...attributes, ...Object.fromEntries(keys.map(key => [key, attributes[key] + change])),
      'Offensive IQ': attributes['Offensive IQ'] + (focus ? 9 : 0) + (keys.includes('Offensive IQ') ? change : 0),
      'Defensive IQ': attributes['Defensive IQ'] + (defense === 'pressure' ? shotProfile : defense === 'paint' ? -shotProfile : 0) * 0.18,
      'Interior Defense': attributes['Interior Defense'] + (defense === 'paint' ? 5 : defense === 'pressure' ? -3 : 0),
      'Perimeter Defense': attributes['Perimeter Defense'] + (defense === 'pressure' ? 5 : defense === 'paint' ? -3 : 0) };
  }

  function castScore(cast, side) {
    if (cast.periods.at(-1)?.forfeit) return cast.periods.at(-1)[side + 'Score'];
    return cast.periods.reduce((total, game) => total + game[side + 'Score'], 0)
      + (cast.pending?.events ?? []).filter(event => event.side === side && event.second <= cast.pending.elapsed)
        .reduce((sum, event) => sum + (event.stats.PTS ?? 0), 0);
  }

  function castComplete(cast) {
    return !cast.pending && (Boolean(cast.periods.at(-1)?.forfeit) || cast.periods.length >= 4 && castScore(cast, 'home') !== castScore(cast, 'away'));
  }

  function castMinutes(save, state = history(save), code = save.team) {
    const cast = save.simcast;
    const length = cast.periods.length < 4 ? 12 : 5;
    const roster = code === save.team ? state.activeRoster : state.rosters.get(code);
    const side = cast.home === code ? 'homeBox' : 'awayBox';
    const prior = new Map();
    for (const period of cast.periods) for (const line of period[side]) prior.set(line.id, (prior.get(line.id) ?? 0) + line.MIN);
    const plan = code === save.team ? reconcilePlan(code, save.plans.at(-1)?.minutes, roster) : defaultPlan(code, roster);
    const order = code === save.team ? save.plans.at(-1)?.order : undefined;
    const priorRotation = code === save.team ? cast.minutes : null;
    const players = orderedRoster(roster, order, plan).map(player => {
      const limit = minuteLimit(state.health.get(player.id).durability);
      const cap = limit === 48 ? length : Math.max(0, Math.min(length, limit - (prior.get(player.id) ?? 0)));
      const target = priorRotation?.[player.id] ?? Math.floor(plan[player.id] * length / 48);
      return { id: player.id, cap, minutes: Math.min(cap, target) };
    });
    let remaining = length * 5 - players.reduce((sum, player) => sum + player.minutes, 0);
    for (const player of players) {
      const change = remaining >= 0 ? Math.min(remaining, player.cap - player.minutes) : -Math.min(-remaining, player.minutes);
      player.minutes += change;
      remaining -= change;
    }
    return { players, length };
  }

  function simcastAction(expected, action, input = {}) {
    const save = load();
    if (JSON.stringify(expected) !== JSON.stringify(save)) throw new Error('The save changed. Reopen SimCast.');
    if (save.allStarFormat === 2 && save.day === allStarElectionDates(save).open && !save.allStarBallot && !save.simcast) {
      throw new Error('Submit your All-Star votes in Award Race before starting SimCast.');
    }
    if (action === 'start') {
      const state = history(save);
      if (save.simcast) return;
      const match = state.today.find(pair => pair.includes(save.team));
      if (!match || save.handoff || save.market?.open || state.bracket?.champion) throw new Error('SimCast opens on the day of your next game.');
      const check = history(save, save.day);
      if (check.rotationAlert) { write({ ...save, rotationAlert: check.rotationAlert }); return; }
      const [home, away] = match;
      const plan = currentGameplan(save);
      const scoring = plan.scoring.filter(id => state.activeRoster.some(player => player.id === id));
      write({ ...save, rotationAlert: null, simcast: { home, away, day: save.day, periods: [],
        play: plan.play, defense: plan.defense, scoring, focus: scoring[0] ?? '', settings: { tempo: plan.tempo }, minutes: null } });
      return;
    }
    const cast = save.simcast;
    if (!cast) throw new Error('Start SimCast first.');
    if (action === 'view') {
      write({ ...save, simcast: { ...cast, view: input.view === 'live' ? 'live' : 'standard' } });
      return;
    }
    if ((action === 'tick' || action === 'finish-period') && cast.pending) {
      const { period, events } = cast.pending;
      const duration = cast.pending.length * 60;
      const elapsed = action === 'finish-period' ? duration
        : Math.min(duration, cast.pending.elapsed + Math.max(1, Math.min(120, Math.floor(input.seconds) || 1)));
      const next = elapsed === cast.pending.length * 60
        ? { ...cast, pending: null, periods: [...cast.periods, { ...period, events }] }
        : { ...cast, pending: { ...cast.pending, elapsed } };
      write({ ...save, simcast: next });
      return;
    }
    if (action === 'challenge') {
      const event = challengeableFoul(save, cast);
      if (!event) throw new Error('A challenge requires a recent personal foul on your team, an available challenge, and a timeout.');
      const pending = cast.pending;
      const overturned = randomFor(save.seed ^ event.second ^ (cast.periods.length * 997))() < 0.4;
      const events = pending.events.map(item => item === event ? { ...item, reviewed: true,
        ...(overturned ? { label: 'has a personal foul overturned', stats: {} } : {}) } : item);
      const period = overturned ? { ...pending.period,
        [event.side + 'Box']: pending.period[event.side + 'Box'].map(line =>
          line.id === event.id ? { ...line, PF: line.PF - 1 } : line) } : pending.period;
      const note = { period: cast.periods.length, second: pending.elapsed,
        label: overturned ? 'Coach’s challenge successful · foul overturned' : 'Coach’s challenge unsuccessful · foul stands' };
      write({ ...save, simcast: { ...cast, challengeCount: (cast.challengeCount ?? 0) + 1,
        secondChallenge: !save.singleCoachChallenge && (cast.challengeCount ?? 0) === 0 && overturned,
        timeouts: (cast.timeouts ?? 0) + Number(!overturned),
        pending: { ...pending, events, period }, notes: [...(cast.notes ?? []), note] } });
      return;
    }
    if (action === 'timeout' && !castComplete(cast)) {
      const timeouts = cast.timeouts ?? 0;
      if (timeouts >= 7) throw new Error('You have used all seven simulated timeouts.');
      const note = { period: cast.periods.length, second: cast.pending?.elapsed ?? 0, label: 'Team timeout' };
      write({ ...save, simcast: { ...cast, timeouts: timeouts + 1, notes: [...(cast.notes ?? []), note] } });
      return;
    }
    if (action === 'configure' && !castComplete(cast)) {
      write({ ...save, simcast: { ...cast, queued: input } });
      return;
    }
    const state = history(save);
    if (action === 'substitute' && cast.pending) {
      const pending = cast.pending;
      const side = cast.home === save.team ? 'home' : 'away';
      const boxKey = side + 'Box';
      const box = pending.period[boxKey];
      const lineup = pending.lineup ?? box.slice(0, 5).map(line => line.id);
      const outgoing = box.find(line => line.id === input.out);
      if (!outgoing || !lineup.includes(input.out) || lineup.includes(input.in)
        || !state.activeRoster.some(player => player.id === input.in)) throw new Error('Select an on-court player and an eligible reserve.');
      const incoming = box.find(line => line.id === input.in);
      const remaining = pending.length - Math.floor(pending.elapsed / 60);
      const minutes = Math.min(outgoing.MIN, remaining, Math.ceil(outgoing.MIN * (1 - pending.elapsed / (pending.length * 60))));
      const limit = minuteLimit(state.health.get(input.in).durability);
      const played = cast.periods.reduce((sum, period) => sum + (period[boxKey].find(line => line.id === input.in)?.MIN ?? 0), 0);
      if (!minutes || !limit || (incoming?.MIN ?? 0) + minutes > pending.length || limit < 48 && played + (incoming?.MIN ?? 0) + minutes > limit) {
        throw new Error('This reserve cannot cover the remaining assignment within their minute limit.');
      }
      const leaving = { ...outgoing, MIN: outgoing.MIN - minutes };
      const arriving = { id: input.in, ...Object.fromEntries(boxFields.map(key => [key, 0])), ...incoming,
        MIN: (incoming?.MIN ?? 0) + minutes };
      const events = pending.events.map(event => {
        if (event.side !== side || event.id !== input.out || event.second <= pending.elapsed) return event;
        for (const [key, value] of Object.entries(event.stats)) {
          leaving[key] -= value;
          arriving[key] += value;
        }
        return { ...event, id: input.in };
      });
      const nextBox = box.flatMap(line => line.id === input.out
        ? leaving.MIN || boxFields.some(key => leaving[key]) ? [leaving] : []
        : [line.id === input.in ? arriving : line]);
      if (!incoming) nextBox.push(arriving);
      const note = { period: cast.periods.length, second: pending.elapsed,
        label: state.profiles.get(input.in).name + ' replaces ' + state.profiles.get(input.out).name };
      write({ ...save, simcast: { ...cast, notes: [...(cast.notes ?? []), note], pending: { ...pending,
        lineup: lineup.map(id => id === input.out ? input.in : id), events, period: { ...pending.period, [boxKey]: nextBox } } } });
      return;
    }
    if (action === 'foul' && cast.pending) {
      const pending = cast.pending;
      const own = cast.home === save.team ? 'home' : 'away';
      const side = own === 'home' ? 'away' : 'home';
      const nextEvent = pending.events.find(event => event.second > pending.elapsed);
      if (!nextEvent || nextEvent.side !== side) throw new Error('Wait until the opponent has the ball.');
      if (pending.events.some(event => event.intentional && event.second === pending.elapsed)) {
        throw new Error('Resume play before calling another intentional foul.');
      }
      const defender = pending.period[own + 'Box'].find(line => line.id === pending.lineup?.[0]) ?? pending.period[own + 'Box'][0];
      const shooter = pending.period[side + 'Box'].find(line => line.id === nextEvent.id);
      if (!defender || !shooter) throw new Error('No eligible players for the foul.');
      const rating = state.profiles.get(shooter.id).attributes.FT;
      const random = randomFor(save.seed ^ pending.elapsed ^ cast.periods.length ^ pending.events.length);
      const priorFouls = pending.events.filter(event => event.side === own && event.stats.PF && event.second <= pending.elapsed);
      const lastTwoMinutes = pending.length * 60 - 120;
      const penalty = priorFouls.length >= (pending.length === 12 ? 4 : 3)
        || pending.elapsed >= lastTwoMinutes && priorFouls.some(event => event.second >= lastTwoMinutes);
      const attempts = penalty ? 2 : 0;
      const made = penalty ? Number(random() * 100 < rating) + Number(random() * 100 < rating) : 0;
      const events = [...pending.events, { side: own, id: defender.id,
        label: penalty ? 'commits an intentional foul in the penalty' : 'commits an intentional foul · sideline inbound',
        stats: { PF: 1 }, intentional: true, second: pending.elapsed },
        ...(penalty ? [{ side, id: shooter.id, label: `makes ${made} of 2 free throws`,
          stats: { PTS: made, FTM: made, FTA: attempts }, second: pending.elapsed }] : [])]
        .sort((a, b) => a.second - b.second);
      const period = { ...pending.period, [side + 'Score']: pending.period[side + 'Score'] + made,
        [side + 'Box']: pending.period[side + 'Box'].map(line => line === shooter
          ? { ...line, PTS: line.PTS + made, FTM: line.FTM + made, FTA: line.FTA + attempts } : line),
        [own + 'Box']: pending.period[own + 'Box'].map(line => line === defender ? { ...line, PF: line.PF + 1 } : line) };
      write({ ...save, simcast: { ...cast, pending: { ...pending, period, events } } });
      return;
    }
    if (action === 'cancel') {
      if (cast.periods.length || cast.pending) throw new Error('Finish the game after the opening tip.');
      write({ ...save, simcast: null });
      return;
    }
    const playoffRound = !state.bracket ? null : state.bracket.playIn && !state.bracket.rounds.length ? -1
      : Math.max(0, Math.floor((save.day - firstPlayoffGame - (revisedRules(save) ? postseason.playInDays : 0)) / 14));
    if (action === 'forfeit' && !castComplete(cast)) {
      const rotation = castMinutes(save, state);
      if (rotation.players.reduce((sum, player) => sum + player.cap, 0) >= rotation.length * 5) {
        throw new Error('An eligible rotation is still available.');
      }
      const period = { id: save.day + '-' + cast.home, day: save.day, home: cast.home, away: cast.away,
        homeScore: cast.home === save.team ? 0 : 2, awayScore: cast.away === save.team ? 0 : 2,
        homeBox: [], awayBox: [], playoffRound, forfeit: true };
      write({ ...save, simcast: { ...cast, periods: [...cast.periods, period] } });
      return;
    }
    if ((action === 'period' || action === 'tip-period') && !castComplete(cast) && !cast.pending) {
      const control = castMinutes(save, state);
      const opponent = cast.home === save.team ? cast.away : cast.home;
      const other = castMinutes(save, state, opponent);
      const rotation = control.players.map(player => ({ ...player, minutes: input.minutes?.[player.id] ?? player.minutes }));
      if (rotation.some(player => !Number.isInteger(player.minutes) || player.minutes < 0 || player.minutes > player.cap)
        || rotation.reduce((sum, player) => sum + player.minutes, 0) !== control.length * 5) {
        throw new Error('Set exactly ' + control.length * 5 + ' minutes within the listed player limits.');
      }
      const available = rotation.filter(player => player.minutes > 0);
      const cpu = other.players.filter(player => player.minutes > 0);
      const play = Object.hasOwn(castPlays, input.play) ? input.play : 'balanced';
      if (input.focus && !available.some(player => player.id === input.focus)) throw new Error('Give your featured player minutes this period.');
      const defense = Object.hasOwn(castDefenses, input.defense) ? input.defense : 'balanced';
      const shotProfile = cpu.reduce((sum, player) => {
        const rating = playerDevelopment.ratings(state.development, state.profiles.get(player.id));
        return sum + (rating['3PT'] - rating.Inside) * player.minutes / (other.length * 5);
      }, 0);
      const scoring = [...new Set((input.scoring ?? [input.focus]).filter(id => available.some(player => player.id === id)))].slice(0, 3);
      const rules = { play, defense, shotProfile, focus: scoring[0], scoring, settings: input.settings ?? {}, matchups: input.matchups ?? {},
        coverage: input.coverage ?? {}, period: cast.periods.length,
        controlled: new Set(available.map(player => player.id)), rotations: new Map([[save.team, available],
          [opponent, cpu.reduce((sum, player) => sum + player.minutes, 0) === other.length * 5 ? cpu : null]]) };
      const rosters = new Map(state.rosters);
      rosters.set(save.team, state.activeRoster);
      const game = gamesForDay(save, save.day, state.health, null, null, state.development, rosters,
        [[cast.home, cast.away]], playoffRound, new Map([cast.home, cast.away].map(code => [code, staffSim.effects(save, code)])),
        state.profiles, rules)[0];
      const period = { ...game, homeStarters: game.homeBox.slice(0, 5).map(line => line.id),
        awayStarters: game.awayBox.slice(0, 5).map(line => line.id) };
      const events = castTimeline(period, control.length, save.seed ^ save.day ^ cast.periods.length);
      const next = { ...cast, queued: null, play, defense, focus: scoring[0] ?? '', scoring, settings: rules.settings, matchups: rules.matchups,
        coverage: rules.coverage, minutes: Object.fromEntries(rotation.map(p => [p.id, p.minutes])) };
      if (action === 'tip-period' && !period.forfeit) next.pending = { period, events, elapsed: 0, length: control.length };
      else next.periods = [...cast.periods, { ...period, events }];
      write({ ...save, simcast: next });
      return;
    }
    if (action !== 'finalize' || !castComplete(cast)) throw new Error('Finish every period first.');
    const last = cast.periods.at(-1);
    function box(side) {
      const lines = new Map();
      for (const period of cast.periods) for (const line of period[side + 'Box']) {
        const total = lines.get(line.id) ?? { id: line.id };
        for (const field of boxFields) total[field] = (total[field] ?? 0) + (line[field] ?? 0);
        lines.set(line.id, total);
      }
      return [...lines.values()];
    }
    const result = last.forfeit ? last : { ...last, homeScore: castScore(cast, 'home'), awayScore: castScore(cast, 'away'),
      homeBox: box('home'), awayBox: box('away'), overtime: Math.max(0, cast.periods.length - 4),
      homeStarters: cast.periods[0].homeStarters, awayStarters: cast.periods[0].awayStarters,
      quarters: cast.periods.map(period => [period.awayScore, period.homeScore]) };
    delete result.events;
    let next = { ...save, day: save.day + 1, simcast: null, simcastResults: { ...save.simcastResults, [result.id]: result } };
    let updated = history(next, next.day);
    if (!updated.rotationAlert && next.day <= lastDay && next.day % 7 === 0) {
      const managed = cpuTeams.manage(next, updated);
      if (managed !== next) {
        next = managed;
        updated = history(next, next.day);
      }
    }
    write(relationships.settle({ ...next, day: updated.day, rotationAlert: updated.rotationAlert }, updated, save));
  }

  function load() {
    const raw = activeSlot && localStorage.getItem(activeSlot);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!codes.has(save.team) || !Number.isInteger(save.day) || save.day < 0 || save.day > firstPlayoffGame + postseason.maxDays
        || !Number.isInteger(save.seed) || save.seed < 0 || save.seed > 0xffffffff) {
      throw new Error('The franchise save could not be read.');
    }
    // Start coaching and health on the next unplayed day for older saves.
    if (save.worldStaffStart == null) {
      save.worldStaffStart = save.day;
      save.staffTrustCarry = Object.fromEntries(Object.values(staffSim.assignments(save, save.team, staffSim.roles))
        .map(person => [person.id, relationships.score(save, person.id, 48)]));
    }
    save.fanSentimentStart ??= save.day;
    save.cpuLogicStart ??= save.day;
    save.staffPayrollStart ??= save.day;
    save.gmSalaryStart ??= save.day;
    save.namedInjuriesStart ??= save.day;
    save.fatigueStart ??= save.day;
    save.developmentProgramsStart ??= save.day;
    save.healthStart ??= save.day;
    save.plans ??= [];
    save.developmentStart ??= save.day;
    save.training ??= [];
    save.financeStart ??= save.day;
    save.financeActions ??= [];
    save.facilityStart ??= save.day;
    save.year ??= 0;
    save.staffSeed ??= save.seed;
    save.staffEffectStart ??= save.day;
    save.staffBaseline ??= save.staffing ?? {};
    save.staffTimeline ??= [];
    save.pastSeasons ??= [];
    save.allStarFormat ??= save.day < allStarElectionDates(save).open ? 2 : 1;
    for (const entry of save.pastSeasons) entry.finalsChampionBoost ??= 0;
    save.rulesVersion ??= revisedRules(save) ? 2 : 1;
    playerTools.register(save);
    return save;
  }

  function write(save) {
    save = settleGmCommitments(save);
    if (!activeSlot) throw new Error('Open a franchise save first.');
    localStorage.setItem(activeSlot, JSON.stringify(save));
  }

  function newFranchise(team) {
    return { team, day: 0, seed: Math.floor(Math.random() * 0x100000000), rulesVersion: 2, usePublishedContracts: true, staggeredSchedule: true, scheduleVersion: 4, allStarFormat: 2, allStarHost: "PHX",
      staffPayrollStart: 0, cpuLogicStart: 0, worldStaffStart: 0, fanSentimentStart: 0, gmSalaryStart: 0, developmentProgramsStart: 0, namedInjuriesStart: 0, fatigueStart: 0, healthStart: 0, plans: [], developmentStart: 0, training: [], financeStart: 0, facilityStart: 0,
      financeActions: [], staffEffectStart: 0 };
  }

  function start(team) {
    if (!codes.has(team) || load()) return;
    const save = newFranchise(team);
    write(cpuTeams.openingDepth(save, history(save), true));
  }

  function startCareer(gm, offer, snapshot) {
    if (!codes.has(offer.team)) throw new Error('Choose a job offer.');
    const key = slotPrefix + crypto.randomUUID();
    const initial = { ...newFranchise(offer.team), ...snapshot, gm: { ...gm, contract: { ...offer, startYear: 0 } } };
    const save = cpuTeams.openingDepth(initial, history(initial), true);
    localStorage.setItem(key, JSON.stringify(save));
    activeSlot = key;
    localStorage.setItem(lastSlotKey, key);
  }

  function chooseGmJob(expected, team) {
    const save = load();
    if (!save || JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('Reopen the GM offers screen.');
    const offer = gmCareer.renewals(save, history(save)).find(entry => entry.team === team);
    if (!offer) throw new Error('Choose an available GM offer.');
    write({ ...save, nextGmJob: offer });
  }

  function restart(expected, team) {
    if (!codes.has(team)) throw new Error('Choose a team for the new franchise.');
    const save = load();
    if (!save || JSON.stringify(save) !== JSON.stringify(expected)) {
      throw new Error('The save changed. Reopen the restart screen and confirm again.');
    }
    const initial = newFranchise(team);
    write(cpuTeams.openingDepth(initial, history(initial), true));
  }

  function advance(expected) {
    const save = load();
    if (save?.market?.open) throw new Error('Close free agency before starting the regular season.');
    if (save?.seed === expected.seed && save.team === expected.team && save.day === expected.day && save.year === expected.year
        && (save.day < playoffStart || !history(save).bracket.champion)) {
      advanceTo(save, save.day + 1);
    }
  }

  function allStarElectionDates(save) {
    const first = Date.parse(date(0, save.year));
    const year = Number(date(0, save.year).slice(0, 4));
    return { open: (Date.UTC(year, 11, 15) - first) / 86400000, close: (Date.UTC(year + 1, 0, 20) - first) / 86400000 };
  }

  function allStarAction(expected, action, input) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('Reopen the All-Star voting screen.');
    const state = history(save);
    if (action === 'vote' && state.allStarVotePending) {
      for (const conference of ['East', 'West']) {
        if (!state.allStarVotes[conference].some(row => row.id === input[conference])) throw new Error('Choose one candidate per conference.');
      }
      write({ ...save, allStarBallot: input });
    } else if (action === 'pick' && state.allStarDraft?.pending && state.allStarDraft.pool.some(player => player.id === input)) {
      write({ ...save, allStarDraftPicks: { ...save.allStarDraftPicks, [state.allStarDraft.next]: input } });
    } else if (action === 'delegate' && state.allStarDraft?.pending) {
      write({ ...save, allStarDraftDelegate: true });
    } else throw new Error('That All-Star action is unavailable.');
  }

  function setScoutingPriority(expected, id, enabled) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the scouting office.');
    const state = history(save);
    if (!state.profiles.has(id) || state.unavailable.has(id)) throw new Error('Choose an available player.');
    const priorities = new Set(save.scoutingPriorities?.[save.team] ?? []);
    if (enabled) priorities.add(id);
    else priorities.delete(id);
    write({ ...save, scoutingPriorities: { ...save.scoutingPriorities, [save.team]: [...priorities] } });
  }

  function setAutoScouting(expected, enabled) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the scouting office.');
    write({ ...save, autoScouting: { ...save.autoScouting, [save.team]: Boolean(enabled) } });
  }

  function scoutProjectedPicks(save, state, previousDay) {
    if (!save.autoScouting?.[save.team] || save.draftRoom) return save;
    const through = Math.min(state.day, allStarDayFor(save));
    const firstWeek = Math.floor(previousDay / 7) + 1;
    const finalWeek = Math.floor(through / 7);
    if (firstWeek > finalWeek) return save;
    const owned = draftOps.futurePicks(save).filter(pick => pick.owner === save.team && pick.year === draftOps.draftYear(save));
    if (!owned.length) return save;
    const board = draftOps.prospects(save);
    const notes = { ...save.prospectNotes };
    const gain = Math.max(12, Math.round(staffSim.effects(save, save.team).scouting / 3));
    for (let week = firstWeek; week <= finalWeek; week++) {
      const origins = draftOps.projectedOrigins(state, week * 7);
      for (const asset of owned) {
        const pick = origins.indexOf(asset.origin) + 1 + 30 * (asset.round - 1);
        const prospect = board.filter(item => (notes[item.id]?.coverage ?? 0) < 100)
          .sort((a, b) => Math.abs(a.rank - pick) - Math.abs(b.rank - pick))[0];
        if (!prospect) continue;
        const prior = notes[prospect.id] ?? {};
        notes[prospect.id] = { ...prior, scouted: true,
          coverage: Math.min(100, (prior.coverage ?? (prior.scouted ? 35 : 0)) + gain) };
      }
    }
    return { ...save, prospectNotes: notes };
  }

  function advanceTo(expected, day) {
    const save = load();
    if (save.simcast) throw new Error("Finish the game in SimCast first.");
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.market?.open || save.handoff) throw new Error('The calendar is unavailable for this save.');
    if (!Number.isInteger(day) || day <= save.day) return;
    let eventLimit = Infinity;
    if (save.allStarFormat === 2) {
      const { open } = allStarElectionDates(save);
      const sunday = allStarDayFor(save);
      if (save.day >= open && !save.allStarBallot) throw new Error('Submit your All-Star votes in Award Race before advancing.');
      if (save.day < open) eventLimit = open;
      else if (save.day < sunday) eventLimit = sunday;
      else if (save.day === sunday && history(save).allStarDraft?.pending) throw new Error('Finish the All-Star draft before advancing.');
    }
    const end = Math.min(day, eventLimit, firstPlayoffGame + postseason.maxDays,
      save.day < playoffStart ? playoffStart : Infinity);
    let progressed = save;
    const finish = (target, state) => {
      const updated = scoutProjectedPicks({ ...target, day: state.day, rotationAlert: state.rotationAlert }, state, save.day);
      const reports = { ...updated.playerScoutingReports?.[save.team] };
      const weeks = Math.floor(state.day / 7) - Math.floor(save.day / 7);
      if (weeks > 0) {
        const gain = Math.max(12, Math.round(staffSim.effects(updated, save.team).scouting / 3));
        for (const id of updated.scoutingPriorities?.[save.team] ?? []) {
          if (state.profiles.has(id) && !state.unavailable.has(id)) reports[id] = Math.min(100, (reports[id] ?? 0) + weeks * gain);
        }
        updated.playerScoutingReports = { ...updated.playerScoutingReports, [save.team]: reports };
      }
      write(relationships.settle(updated, state, save));
      const alert = state.rotationAlert;
      if (!target.autoInjuryRotation || !alert || alert.shortHanded) return;
      resolveInjuryRotation(load(), 'cpu');
      if (state.day < end) advanceTo(load(), end);
    };
    for (let checkpoint = (Math.floor(save.day / 7) + 1) * 7; checkpoint <= Math.min(lastDay, end); checkpoint += 7) {
      const beforeOffers = { ...progressed, day: checkpoint };
      const state = history(beforeOffers, save.day);
      if (state.rotationAlert || state.bracket?.champion) return finish(beforeOffers, state);
      progressed = cpuTeams.manage(beforeOffers, state);
    }
    const target = { ...progressed, day: end };
    return finish(target, history(target, save.day));
  }

  function setAwardOverride(expected, slot, id) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('Reopen Award Overrides.');
    const entry = awardOverrideEntries(history(save), save).find(item => item.slot === slot);
    if (!entry || (id != null && !entry.candidates.some(candidate => candidate.id === id))) {
      throw new Error('Choose an eligible award recipient.');
    }
    const awardOverrides = { ...save.awardOverrides };
    if (id == null) {
      const original = awardOverrideEntries(history({ ...save, awardOverrides: {} }), save).find(item => item.slot === slot)?.winner;
      if (original && !entry.candidates.some(candidate => candidate.id === original)) {
        throw new Error('Restore the slot that currently holds the original recipient first.');
      }
      delete awardOverrides[slot];
    }
    else awardOverrides[slot] = id;
    write({ ...save, awardOverrides });
  }

  function postseasonAction(expected, action, input) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('Reopen the playoff bracket.');
    const state = history(save);
    if (action === 'review') {
      if (!state.awards) throw new Error('The regular season is still in progress.');
      write({ ...save, awardsReviewed: true });
    } else if (action === 'champion') {
      if (!state.bracket?.champion) throw new Error('The Finals are still in progress.');
      write({ ...save, championshipReviewed: true });
    } else if (action === 'force') {
      const pair = state.today.find(([home, away]) => home === input.home && [home, away].includes(input.winner));
      if (!pair || !state.bracket || state.bracket.champion || save.simcast || save.rotationAlert) {
        throw new Error('Force Win requires a scheduled postseason game and an available rotation.');
      }
      const id = save.day + '-' + input.home;
      const target = { ...save, forcedPlayoffWins: { ...save.forcedPlayoffWins, [id]: input.winner }, day: save.day + 1 };
      const result = history(target, save.day);
      if (!result.results.some(game => game.id === id && !game.forfeit &&
        (game.homeScore > game.awayScore ? game.home : game.away) === input.winner)) {
        throw new Error('Unable to force this result. Review the available rotations.');
      }
      write(relationships.settle({ ...target, day: result.day, rotationAlert: result.rotationAlert }, result, save));
    }
  }

  function rotationIssues(roster, health, minutes, order) {
    const starters = orderedRoster(roster, order, minutes).slice(0, 5);
    return roster.flatMap(player => {
      const cap = minuteLimit(health.get(player.id).durability);
      const planned = minutes[player.id] ?? 0;
      return planned > cap || cap === 0 && starters.includes(player) ? [{ id: player.id, cap, planned }] : [];
    });
  }

  function rebuildRotation(save, count) {
    if (!Number.isInteger(count) || count < 5 || count > 15) throw new Error('Choose a rotation size from 5 to 15.');
    const state = history(save);
    const available = state.activeRoster.filter(player => minuteLimit(state.health.get(player.id).durability) > 0)
      .sort((a, b) => state.playerOveralls.get(b.id) - state.playerOveralls.get(a.id));
    const order = positionStarters(available.map(player => player.id), available).filter(Boolean).slice(0, count);
    const roster = order.map(id => state.profiles.get(id));
    if (roster.length !== count) throw new Error('There are fewer available players than the requested rotation size.');
    const targets = defaultPlan(save.team, roster);
    for (const id of order) targets[id] = Math.max(1, targets[id]);
    let total = Object.values(targets).reduce((sum, minutes) => sum + minutes, 0);
    while (total > 240) {
      const id = order.reduce((highest, player) => targets[player] > targets[highest] ? player : highest);
      targets[id]--;
      total--;
    }
    const projected = allocateMinutes(save.team, targets, state.health, roster, order);
    if (!projected) throw new Error('Those players cannot cover 240 minutes. Increase the rotation size.');
    return { order: [...order, ...state.activeRoster.map(player => player.id).filter(id => !order.includes(id))],
      minutes: Object.fromEntries(state.activeRoster.map(player => [player.id, projected.find(row => row.id === player.id)?.minutes ?? 0])) };
  }

  function repairRotation(save, reset = false) {
    const state = history(save);
    const roster = state.activeRoster;
    const plan = reset ? defaultPlan(save.team, roster) : currentPlan(save);
    const order = reset ? orderedRoster(roster, undefined, plan).map(player => player.id) : currentOrder(save);
    const projected = allocateMinutes(save.team, plan, state.health, roster, order);
    if (!projected) throw new Error('Available players cannot cover 240 minutes. Add a healthy player or allow time for recovery.');
    const active = new Set(projected.map(player => player.id));
    const minutes = { ...Object.fromEntries(roster.map(player => [player.id, 0])),
      ...Object.fromEntries(projected.map(player => [player.id, player.minutes])) };
    return { minutes, order: [...projected.map(player => player.id), ...order.filter(id => !active.has(id))] };
  }

  function resolveInjuryRotation(expected, choice) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The franchise changed. Reopen Coaching.');
    const alert = save.rotationAlert;
    if (!alert) throw new Error('There is no active injury update.');
    if (choice === 'leave' && !alert.issues.length && !alert.shortHanded) {
      write({ ...save, rotationAlert: null });
      return;
    }
    if (!['cpu', 'always'].includes(choice) || alert.shortHanded) throw new Error('Adjust the rotation before continuing.');
    const repaired = repairRotation(save, !alert.issues.length);
    setPlan(save, repaired.minutes, repaired.order);
    if (choice === 'always') write({ ...load(), autoInjuryRotation: true });
  }

  function setAutoInjuryRotation(expected, enabled) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The franchise changed. Reopen Coaching.');
    write({ ...save, autoInjuryRotation: Boolean(enabled) });
  }

  function acknowledgeForfeit(expected) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || !save.rotationAlert?.shortHanded) {
      throw new Error('A forfeit is available only when the healthy roster cannot cover the game.');
    }
    write({ ...save, rotationAlert: null, forfeitDays: [...(save.forfeitDays ?? []), save.day] });
  }

  function setPlan(expected, minutes, order, slots) {
    const save = load();
    if (save.simcast) throw new Error("Finish SimCast before changing the roster or facilities.");
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The save changed. Reopen Coaching and try again.');
    if (save.market?.open) throw new Error('Finish free agency before setting the rotation.');
    if (save.day >= playoffStart && history(save).bracket.champion) throw new Error('The season is complete.');
    const state = history(save);
    const roster = state.activeRoster;
    if (!validPlan(roster, minutes)) throw new Error('Assign exactly 240 minutes using whole numbers from 0 to 48.');
    if (order && (order.length !== roster.length || new Set(order).size !== roster.length
      || roster.some(player => !order.includes(player.id)))) throw new Error('Place every player in one rotation slot.');
    if (order?.slice(0, 5).some(id => minutes[id] === 0)) throw new Error('Give each of the five starters at least one planned minute.');
    if (rotationIssues(roster, state.health, minutes, order).length) throw new Error("Move unavailable starters to the bench and keep injured players within their minute limits.");
    if (slots && (slots.length !== 15 || slots.slice(0, 5).some(id => !id)
      || slots.filter(Boolean).some((id, i) => order[i] !== id)
      || roster.some(player => !slots.includes(player.id) && minutes[player.id] !== 0))) {
      throw new Error('Use the 15 lineup slots for planned minutes and fill all five starter positions.');
    }
    const plans = save.plans.filter(plan => plan.day !== save.day);
    write({ ...save, rotationAlert: null, plans: [...plans, { day: save.day, minutes, order, slots }] });
  }

  const currentPlan = save => reconcilePlan(save.team, save.plans.at(-1)?.minutes, history(save).activeRoster);
  const currentOrder = save => orderedRoster(history(save).activeRoster, save.plans.at(-1)?.order,
    currentPlan(save)).map(player => player.id);

  function positionStarters(order, roster) {
    const roles = ['PG', 'SG', 'SF', 'PF', 'C'];
    const players = new Map(roster.map(player => [player.id, playerTools.slots(player)]));
    let best = [];
    let bestFit = -1;
    function assign(remaining, lineup, fit) {
      if (!remaining.length) {
        if (fit > bestFit) { best = lineup; bestFit = fit; }
        return;
      }
      const role = roles[lineup.length];
      for (const id of remaining) {
        const positions = players.get(id) ?? [];
        const index = positions.indexOf(role);
        const broad = role.endsWith('G') ? 'G' : 'F';
        const points = index >= 0 ? 10 - index : role !== 'C' && positions.includes(broad) ? 5 : 0;
        assign(remaining.filter(player => player !== id), [...lineup, id], fit + points);
      }
    }
    assign(order.slice(0, 5), [], 0);
    const arranged = [...best, ...order.slice(5)];
    return Array.from({ length: 15 }, (_, i) => arranged[i] ?? null);
  }

  function currentSlots(save) {
    const order = currentOrder(save);
    const stored = save.plans.at(-1)?.slots;
    if (!stored || stored.slice(0, 5).some(id => !order.includes(id))) {
      return positionStarters(order, history(save).activeRoster);
    }
    return stored.map(id => order.includes(id) ? id : null);
  }

  const currentGameplan = (save, day = save.day) => (save.gameplans ?? [])
    .findLast(plan => plan.day <= day && plan.team === save.team)
    ?? { play: 'balanced', defense: 'balanced', tempo: 'Average', scoring: [] };

  function setGameplan(expected, plan) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The save changed. Reopen Gameplan.');
    if (save.simcast) throw new Error('Finish the current SimCast to change the team gameplan.');
    const roster = history(save).activeRoster;
    const picks = plan.scoring.filter(Boolean);
    if (new Set(picks).size !== picks.length || picks.some(id => !roster.some(player => player.id === id))) {
      throw new Error('Choose a different roster player for each scoring priority.');
    }
    if (!Object.hasOwn(castPlays, plan.play) || !Object.hasOwn(castDefenses, plan.defense)
      || !['Slow', 'Average', 'Fast'].includes(plan.tempo)) throw new Error('Choose valid team strategies.');
    const gameplans = (save.gameplans ?? []).filter(entry => entry.day !== save.day || entry.team !== save.team);
    write({ ...save, gameplans: [...gameplans, { ...plan, day: save.day, team: save.team }] });
  }

  function editPlayer(expected, type, id, input) {
    const save = load();
    if (save.simcast) throw new Error("Finish SimCast before changing the roster or facilities.");
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The save changed. Reopen the editor.');
    const state = history(save);
    if (state.bracket?.champion) throw new Error('Player editing reopens next season.');
    const existing = state.profiles.get(id);
    if (type !== 'create' && (!existing || state.unavailable.has(id))) throw new Error('This player is unavailable.');
    let updated = { ...save };
    let edit;
    if (type === 'delete') {
      const owner = state.owners.get(id);
      if (owner && state.rosters.get(owner).length <= freeAgency.minimum) throw new Error('Keep at least 10 players on this roster.');
      if (owner && (save.market?.open || save.day > lastDay)) throw new Error('Rostered players can be removed during the regular season.');
      if (owner) updated.financeActions = [...save.financeActions, { type: 'cut', team: owner, id, day: save.day }];
      if (save.market?.offers[id]) {
        const offers = { ...save.market.offers };
        delete offers[id];
        updated.market = { ...save.market, offers };
      }
      if (owner === save.team) {
        const plan = currentPlan(save);
        delete plan[id];
        const roster = state.rosters.get(owner).filter(player => player.id !== id);
        const minutes = reconcilePlan(owner, plan, roster);
        const order = currentOrder(save).filter(key => key !== id);
        updated.plans = [...save.plans.filter(item => item.day !== save.day), { day: save.day, minutes, order }];
        const assignments = { ...currentTraining(save) };
        delete assignments[id];
        updated.training = [...save.training.filter(item => item.day !== save.day), { day: save.day, assignments }];
      }
      edit = { type, id, day: save.day };
    } else {
      const { attributes, ...profile } = playerTools.validate(input);
      if (type === 'create') {
        id = 'custom-' + crypto.randomUUID();
        const player = { id, ...profile, attributes, team: null, history: [], stats: null, status: 'Created free agent' };
        updated.customPlayers = [...(save.customPlayers ?? []), player];
      }
      const current = existing && playerDevelopment.ratings(state.development, existing);
      const changed = !current || Object.keys(attributes).some(key => attributes[key] !== Math.round(current[key] * 100) / 100);
      edit = { type, id, day: save.day, profile, ...(changed ? { attributes } : {}) };
    }
    updated.playerEdits = [...(save.playerEdits ?? []), edit];
    playerTools.register(updated);
    write(updated);
    return id;
  }

  function setTraining(expected, assignments) {
    const save = load();
    if (save.simcast) throw new Error("Finish SimCast before changing the roster or facilities.");
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The save changed. Reopen the Training Facility and try again.');
    if (save.market?.open) throw new Error('Finish free agency before scheduling drills.');
    if (save.day > lastDay) throw new Error('The regular season is complete.');
    const owned = history(save).owners;
    for (const [id, attribute] of Object.entries(assignments)) {
      if (owned.get(id) !== save.team || Object.hasOwn(arenaOps.settings(save).affiliate, id) || !playerDevelopment.attributes.includes(attribute)) {
        throw new Error('Choose an available drill for a player on your team.');
      }
    }
    const training = save.training.filter(plan => plan.day !== save.day);
    write({ ...save, training: [...training, { day: save.day, assignments }] });
  }

  const currentTraining = save => save.training.at(-1)?.assignments ?? {};

  function saveFinanceAction(expected, action, negotiations) {
    const save = load();
    if (save.simcast) throw new Error("Finish SimCast before changing franchise operations.");
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The save changed. Reopen the page and try again.');
    const state = history(save);
    if (action.type === "signing") teamFinance.enforcePlayerOffer(save, state, action.id, action.deal);
    const updated = teamFinance.addAction(save, state, action);
    if (negotiations) updated.negotiations = negotiations;
    if (action.type === 'trade') {
      updated.gmTrust = { ...save.gmTrust, [action.otherTeam]: Math.min(100, worldRelationships.gmTrust(save, action.otherTeam) + 4) };
      const [outgoing] = tradePlayers(action);
      for (const [code, contact] of Object.entries(save.gmContacts ?? {})) {
        if (contact.promise?.status !== 'Open' || !outgoing.includes(contact.promise.playerId)) continue;
        const kept = code === action.otherTeam;
        updated.gmContacts = { ...updated.gmContacts, [code]: { ...contact, promise: { ...contact.promise, status: kept ? 'Kept' : 'Broken' } } };
        updated.gmTrust[code] = Math.max(0, Math.min(100, (updated.gmTrust[code] ?? 50) + (kept ? 6 : -8)));
      }
    }
    if (action.type === 'cut' && save.extensions?.[action.id]) {
      updated.extensions = { ...save.extensions };
      delete updated.extensions[action.id];
    }
    const posted = updated.financeActions.at(-1);
    if (posted.organization) updated.relationships = relationships.recordDonation(save, state, posted);
    if (action.draftSigning) {
      updated.draftRights = { ...save.draftRights };
      delete updated.draftRights[action.id];
    }
    if (isTransaction(action) && (action.type !== 'trade' || tradePlayers(action).some(ids => ids.length))) {
      const rosters = new Map(state.rosters);
      movePlayers(rosters, action, save.team);
      const before = currentPlan(save);
      const [leaving, arriving] = action.type === 'trade' ? tradePlayers(action)
        : action.type === 'cut' ? [[action.id], []] : [[], [action.id]];
      for (const [index, id] of leaving.entries()) {
        if (arriving[index]) before[arriving[index]] = before[id];
        delete before[id];
      }
      const minutes = reconcilePlan(save.team, before, rosters.get(save.team));
      const order = currentOrder(save).flatMap(id => {
        const index = leaving.indexOf(id);
        return index < 0 ? [id] : arriving.slice(index, index + 1);
      }).concat(arriving.slice(leaving.length));
      updated.plans = [...save.plans.filter(plan => plan.day !== save.day), { day: save.day, minutes, order }];
      const assignments = { ...currentTraining(save) };
      for (const id of leaving) delete assignments[id];
      updated.training = [...save.training.filter(plan => plan.day !== save.day), { day: save.day, assignments }];
    }
    const updatedState = history(updated);
    teamFinance.enforceBudget(save, updated, state, updatedState);
    write(relationships.settle(updated, updatedState, save));
  }

  const serviceYears = (save, player) => (player.experience ?? 0) + (save.serviceCredits?.[player.id] ?? 0);

  function prospectAction(expected, id, action) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the prospect board.');
    if (save.draftRoom) throw new Error('Prospect activities close when the draft starts.');
    const prospect = draftOps.prospects(save).find(item => item.id === id);
    if (!prospect) throw new Error('Choose an available prospect.');
    const notes = { ...prospect.notes };
    if (notes.last === save.day) throw new Error('You already met with this prospect today.');
    if (action === 'private-workout') {
      if (!history(save).bracket?.champion) throw new Error('Private workouts open after the Finals.');
      if (notes.privateWorkout) throw new Error('This prospect already completed a private workout.');
      if (Object.values(save.prospectNotes ?? {}).filter(item => item.privateWorkout).length >= 10) {
        throw new Error('All ten private workout invitations have been used.');
      }
      notes.privateWorkout = true;
      notes.scouted = true;
      notes.trust = Math.min(100, (notes.trust ?? 25) + 8);
    } else if (action === 'scout') {
      const scouting = staffSim.effects(save, save.team).scouting;
      notes.coverage = Math.min(100, (notes.coverage ?? (notes.scouted ? 35 : 0)) + Math.max(12, Math.round(scouting / 3)));
      notes.scouted = true;
    }
    else if (action === 'interview' && notes.scouted) notes.trust = Math.min(100, (notes.trust ?? 25) + 12);
    else if (action === 'workout' && notes.scouted) {
      notes.workouts = (notes.workouts ?? 0) + 1;
      if (notes.workouts > 6) throw new Error('This prospect has completed all six simulated workouts.');
      notes.trust = Math.min(100, (notes.trust ?? 25) + 6);
    } else if (action === 'preference' && notes.trust >= 55) notes.preference = save.team;
    else throw new Error('Scout the prospect first and reach 55 trust before discussing a preferred destination.');
    notes.last = save.day;
    write({ ...save, prospectNotes: { ...save.prospectNotes, [id]: notes } });
  }

  function revealLottery(expected, all = false) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.draftRoom || save.simcast) throw new Error('Reopen the draft lottery.');
    const state = history(save);
    if (!state.bracket?.champion) throw new Error('The lottery opens after the Finals.');
    const size = draftOps.lottery(save, state).odds.length;
    write({ ...save, lotteryRevealed: all ? size : Math.min(size, (save.lotteryRevealed ?? 0) + 1) });
  }

  function draftAction(expected, id = '', mode = 'user') {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the draft.');
    const state = history(save);
    if (!state.bracket?.champion) throw new Error('The draft opens after the Finals.');
    write({ ...save, draftRoom: mode === "start" && !save.draftRoom ? { order: draftOps.draftOrder(save, state), picks: [] }
      : draftOps.advance(save, state, id, mode === "end", mode === "next") });
  }

  function rankProspect(expected, id, direction) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the draft board.');
    if (!draftOps.prospects(save).some(item => item.id === id)) throw new Error('Choose a prospect in this class.');
    const board = [...(save.personalDraftBoard ?? [])];
    const index = board.indexOf(id);
    if (direction === 'add' && index < 0) board.push(id);
    if (direction === 'remove' && index >= 0) board.splice(index, 1);
    if (direction === 'up' && index > 0) [board[index - 1], board[index]] = [board[index], board[index - 1]];
    if (direction === 'down' && index >= 0 && index < board.length - 1) [board[index], board[index + 1]] = [board[index + 1], board[index]];
    write({ ...save, personalDraftBoard: board });
  }

  function releaseDraftRight(expected, id) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast || save.draftRights?.[id]?.team !== save.team) {
      throw new Error('Reopen your draft rights list.');
    }
    const draftRights = { ...save.draftRights };
    delete draftRights[id];
    write({ ...save, draftRights });
  }

  function signDraftRight(expected, id) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen your draft rights list.');
    const pick = save.draftRights?.[id];
    if (pick?.team !== save.team) throw new Error('Your team does not hold this player’s draft rights.');
    const state = history(save);
    if (state.owners.has(id) || state.unavailable.has(id) || state.rosters.get(save.team).length >= freeAgency.maximum) {
      throw new Error('Open an NBA roster spot before signing this player.');
    }
    const current = teamFinance.report(save, state);
    const deal = draftOps.deal(pick);
    teamFinance.enforcePlayerOffer(save, state, id, deal);
    const rights = { ...save.draftRights };
    delete rights[id];
    if (!save.market?.open) {
      if (save.day > lastDay) throw new Error('Rookie signings are closed until free agency.');
      saveFinanceAction(save, { type: 'signing', id, inSeason: true, deal, draftSigning: true });
      return;
    }
    const openOffers = Object.values(save.market.offers);
    if (openOffers.length + state.rosters.get(save.team).length >= freeAgency.maximum
      || teamFinance.signingCost(deal, true) + openOffers.reduce((sum, item) => sum + teamFinance.signingCost(item, true), 0) > current.available) {
      throw new Error('Leave enough budget and roster space for your pending offers.');
    }
    const next = { ...save, draftRights: rights,
      startingRosters: { ...save.startingRosters, [save.team]: [...save.startingRosters[save.team], id] },
      financeActions: [...save.financeActions, { type: 'signing', id, team: save.team, day: save.day, deal }] };
    write(relationships.settle(next, history(next), save));
  }

  function retirementCandidates(save, state) {
    const retired = new Set(Object.keys(save.retirements ?? {}));
    const candidates = [];
    for (const [team, roster] of state.rosters) {
      const contracts = teamFinance.report(save, state, team).contracts;
      for (const player of roster) {
        if (retired.has(player.id)) continue;
        const finalSeason = save.farewellTours?.[player.id] === save.year;
        const age = playerDevelopment.ageAt(player, date(save.day, save.year));
        const deal = contracts.get(player.id)?.deal;
        if (finalSeason || (age >= 39 && deal?.years === 1 && !save.extensions?.[player.id])) {
          const requestsTour = !finalSeason && team === save.team && relationships.playerScore(save, state, player.id) >= 50;
          candidates.push({ player, team, age, deal, finalSeason, requestsTour });
        }
      }
    }
    return candidates.sort((a, b) => b.age - a.age || a.player.name.localeCompare(b.player.name));
  }

  const gmContactDay = save => (save.year ?? 0) * 400 + save.day;
  function gmContact(expected, code, action, deadline, playerId) {
    const save = load();
    if (!save || JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen Team Intel to contact this GM.');
    if (!codes.has(code) || code === save.team) throw new Error('Choose another front office.');
    const day = gmContactDay(save);
    const notes = save.gmContacts ?? {};
    const current = notes[code] ?? {};
    const trust = worldRelationships.gmTrust(save, code);
    let change = 0;
    let next;
    if (action === 'check-in' || action === 'event') {
      const eventOpen = save.day > lastDay || save.market?.open || save.handoff || Math.abs(save.day - allStarDayFor(save)) <= 2;
      if (action === 'event' && !eventOpen) throw new Error('Event meetings open around All-Star Weekend and in the offseason.');
      if (day - (current.lastContact ?? -100) < 14) throw new Error('Wait 14 franchise days between rapport check-ins.');
      change = action === 'event' ? 4 : 2;
      next = { ...current, lastContact: day };
    } else if (action === 'promise' || action === 'first-call') {
      if (current.promise?.status === 'Open') throw new Error('Resolve your current commitment first.');
      if (day - (current.promise?.created ?? -100) < 14) throw new Error('Wait 14 franchise days between commitments to this GM.');
      if (save.market?.open || !Number.isInteger(deadline) || deadline < 1 || deadline > 21 || save.day + deadline > tradeDeadlineFor(save)) {
        throw new Error('Choose a deadline 1–21 days away and within the trade window.');
      }
      if (action === 'first-call') {
        if (history(save).owners.get(playerId) !== save.team) throw new Error('Choose one of your roster players.');
        if (Object.values(notes).some(note => note.promise?.status === 'Open' && note.promise.playerId === playerId)) {
          throw new Error('Another GM already has an open first-call commitment for this player.');
        }
      }
      next = { ...current, promise: { due: day + deadline, created: day, status: 'Open', playerId: action === 'first-call' ? playerId : null } };
    } else {
      const promise = current.promise;
      if (promise?.status !== 'Open' || day <= promise.created && action === 'follow-up') throw new Error('Follow up on an open commitment after advancing a day.');
      if (!['follow-up', 'break', 'leak'].includes(action)) throw new Error('Choose a valid contact action.');
      const status = action === 'follow-up' ? 'Kept' : action === 'leak' ? 'Leaked' : 'Broken';
      change = status === 'Kept' ? 6 : status === 'Leaked' ? -12 : -8;
      next = { ...current, promise: { ...promise, status } };
    }
    write({ ...save, gmContacts: { ...notes, [code]: next },
      gmTrust: { ...save.gmTrust, [code]: Math.max(0, Math.min(100, trust + change)) },
      gmLeaks: action === 'leak' ? [...(save.gmLeaks ?? []), { day: save.day, team: code, playerId: next.promise.playerId }] : save.gmLeaks });
  }

  function settleGmCommitments(save) {
    for (const [code, contact] of Object.entries(save.gmContacts ?? {})) {
      if (contact.promise?.status !== 'Open' || gmContactDay(save) <= contact.promise.due) continue;
      save = { ...save, gmContacts: { ...save.gmContacts, [code]: { ...contact, promise: { ...contact.promise, status: 'Expired' } } },
        gmTrust: { ...save.gmTrust, [code]: Math.max(0, worldRelationships.gmTrust(save, code) - 8) } };
    }
    return save;
  }

  function leagueMeeting(save, support, lobby, proposal) {
    const targets = new Set(Array.isArray(lobby) ? lobby : [lobby]);
    const boards = cpuTeams.intel(save, history(save));
    const votes = league.teams.map(({ code }, index) => {
      if (code === save.team) return { code, yes: support };
      const board = boards.get(code);
      let interest = 0;
      if (/lottery/.test(proposal) && board.ownFirst && board.rank > 20) interest = proposal === 'lottery' ? -8 : 8;
      if (['deadline', 'no-deadline', 'earlier-deadline'].includes(proposal)) {
        interest = (board.direction === 'Buying' || board.direction === 'Selling' ? 6 : -3)
          * (proposal === 'earlier-deadline' ? -1 : 1);
      }
      if (/^playoff-/.test(proposal)) interest = board.direction === 'Contending' && !proposal.endsWith('-7') ? -6 : 0;
      const base = 38 + ((save.seed >>> 8) + index * 17) % 46 + interest;
      const trust = worldRelationships.gmTrust(save, code);
      const swing = targets.has(code) ? Math.max(0, Math.floor((trust - 50) / 3)) : 0;
      const yes = base + (support ? swing : -swing) >= 50;
      return { code, yes, swayed: yes !== (base >= 50) };
    });
    const yes = votes.filter(vote => vote.yes).length;
    return { year: save.year, proposal, yes, no: votes.length - yes, passed: yes >= 23, votes };
  }

  function qualifyingCandidates(save, state) {
    return [...state.rosters].flatMap(([code, roster]) => {
      const contracts = teamFinance.report(save, state, code).contracts;
      return roster.flatMap(player => {
        const deal = contracts.get(player.id)?.deal;
        const service = serviceYears(save, player) + Number(state.serviceEarned.has(player.id));
        return !save.extensions?.[player.id] && freeAgency.qualifyingCandidate(player, deal, service)
          ? [{ id: player.id, code, deal: freeAgency.qualifyingDeal(deal) }] : [];
      });
    });
  }

  function rollover(expected, declinedOptions, retirementChoices = {}, meetingChoices = {}, qualifyingIds = []) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The save changed. Reopen the season summary.');
    const state = history(save);
    if (!state.bracket?.champion) throw new Error('Finish the playoffs before starting the next season.');
    if (save.gm && gmCareer.expiring(save) && !save.nextGmJob) throw new Error('Accept a GM job before opening free agency.');
    const nextTeam = save.nextGmJob?.team ?? save.team;
    const { pastSeasons, teammateCarry, reporterCarry, ...archived } = save;
    archived.finalsChampionBoost ??= 0.2;
    const previous = pastSeasons.length ? history(pastSeasons.at(-1)).averages : null;
    const next = teamFinance.nextSeason(save, state, new Set(declinedOptions));
    const { staffing, staffRetirements } = staffSim.retire(save, retirementChoices);
    const retirements = { ...save.retirements };
    const retiredJerseys = { ...save.retiredJerseys };
    const farewellTours = { ...save.farewellTours };
    for (const { player, team, deal, finalSeason } of retirementCandidates(save, state)) {
      const choice = retirementChoices[player.id];
      if (!finalSeason && choice === 'override') continue;
      if (!finalSeason && choice === 'farewell' && team === save.team) {
        const salary = deal.salary;
        const { years, raise, bonus, incentive, option, guaranteed, salarySchedule, ...terms } = deal;
        next.startingRosters[team].push(player.id);
        next.openingContracts[player.id] = { team, newExtension: true, deal: {
          ...terms, salary, years: 1, raise: 0, bonus: 0, incentive: 0, option: 'None', guaranteed: 100
        } };
        farewellTours[player.id] = save.year + 1;
        continue;
      }
      next.startingRosters[team] = next.startingRosters[team].filter(id => id !== player.id);
      delete next.openingContracts[player.id];
      retirements[player.id] = { team, year: save.year };
      const number = relationships.jerseyNumber(relationships.jersey(save, player.id));
      if (team === save.team && choice === 'retire-jersey' && number !== null && number !== '6'
        && !state.rosters.get(team).some(other => other.id !== player.id && relationships.jerseyNumber(relationships.jersey(save, other.id)) === number)) {
        retiredJerseys[team] = { ...retiredJerseys[team], [number]: { id: player.id, name: player.name, year: save.year } };
      }
    }
    const qualifying = Object.fromEntries(qualifyingCandidates(save, state)
      .filter(item => !next.openingContracts[item.id] && !retirements[item.id]
        && (item.code === save.team ? qualifyingIds.includes(item.id) : item.deal.salary <= freeAgency.askingSalary(state.profiles.get(item.id)) * 1.15))
      .map(({ id, ...item }) => [id, item]));
    const proposal = meetingChoices.proposal ?? 'lottery';
    const offset = save.tradeDeadlineOffset ?? (save.laterTradeDeadline ? 7 : 0);
    const availableProposal = proposal === 'lottery' && !save.equalLotteryOdds
      || proposal === 'deadline' && !save.noTradeDeadline && offset !== 7
      || proposal === 'earlier-deadline' && !save.noTradeDeadline && offset !== -7
      || proposal === 'no-deadline' && !save.noTradeDeadline
      || proposal === 'one-challenge' && !save.singleCoachChallenge
      || proposal === 'two-challenges' && save.singleCoachChallenge
      || proposal === 'standard-deadline' && (save.noTradeDeadline || offset !== 0)
      || proposal === 'standard-lottery' && save.equalLotteryOdds
      || proposal === 'no-award-minimum' && !save.noAwardMinimum
      || proposal === 'restore-award-minimum' && save.noAwardMinimum
      || proposal === 'champion-last' && !save.championDraftsLast
      || proposal === 'standard-draft-order' && save.championDraftsLast
      || /^playoff-[0-3]-[1357]$/.test(proposal);
    const meeting = availableProposal && ['yes', 'no'].includes(meetingChoices.vote)
      ? leagueMeeting(save, meetingChoices.vote === 'yes', meetingChoices.lobby, proposal) : null;
    const draft = draftOps.advance(save, state, '', true);
    const board = draftOps.prospects(save);
    const draftRights = { ...save.draftRights, ...Object.fromEntries(draft.picks.map(pick => [pick.id, pick])) };
    const entrants = draft.picks.map(pick => draftOps.player(board.find(item => item.id === pick.id), pick));
    for (const [id, pick] of Object.entries(draftRights)) {
      if (pick.team === nextTeam || next.startingRosters[pick.team].length >= freeAgency.cpuTarget
        || next.startingRosters[pick.team].filter(id => !next.openingContracts[id].deal.twoWay).length >= 15) continue;
      const deal = draftOps.deal(pick);
      const committed = Object.values(next.openingContracts).reduce((sum, contract) => sum + (contract.team === pick.team ? contract.deal.salary : 0), 0);
      if (next.startingBanks[pick.team] + teamFinance.mediaUpfront - committed < deal.salary + 5000000) continue;
      next.startingRosters[pick.team].push(id);
      next.openingContracts[id] = { team: pick.team, deal };
      delete draftRights[id];
    }
    const customPlayers = [...(save.customPlayers ?? []), ...entrants];
    playerTools.register({ customPlayers });
    const offseason = { ...state.development, aging: new Map(state.development.aging) };
    const nextDate = date(0, save.year + 1);
    for (let day = save.day; date(day, save.year) < nextDate; day++) {
      playerDevelopment.agePlayers(offseason, date(day, save.year), state.profiles.values(), undefined, { prePeakEnabled: true });
    }
    const teamRoster = next.startingRosters[nextTeam].map(id => players.get(id));
    const sameTeam = nextTeam === save.team;
    const minutes = sameTeam ? reconcilePlan(nextTeam, currentPlan(save), teamRoster) : defaultPlan(nextTeam, teamRoster);
    const owned = new Set(teamRoster.map(player => player.id));
    const assignments = sameTeam ? Object.fromEntries(Object.entries(currentTraining(save)).filter(([id]) => owned.has(id))) : {};
    const rookies = save.rookiePool ?? league.players.filter(player => player.experience === 0).map(player => player.id);
    write({
      ...next, team: nextTeam, day: 0, year: save.year + 1, seed: (Math.imul(save.seed, 1664525) + 1013904223) >>> 0,
      gm: save.nextGmJob ? { ...save.gm, contract: { ...save.nextGmJob, startYear: save.year + 1 } } : save.gm,
      rulesVersion: 2, rookiePool: [...rookies.filter(id => !state.averages.has(id)), ...entrants.map(player => player.id)],
      previousImpact: Object.fromEntries([...state.averages].map(([id, stats]) => [id, nbaAwards.impact(stats)])),
      cfoBudget: save.cfoBudget,
      autoScouting: save.autoScouting,
      scoutingPriorities: save.scoutingPriorities,
      playerScoutingReports: save.playerScoutingReports,
      defendingChampion: state.bracket?.champion ?? null,
      fanCarry: Object.fromEntries([...codes].map(code => [code, Math.round((arenaOps.fanMood(save, state, code) - 50) / 4)])),
      teammateCarry: worldRelationships.carry(save, state), reporterCarry: worldRelationships.carryReporters(state),
      previousWins: Object.fromEntries(Object.entries(state.records).map(([code, record]) => [code, record.wins])),
      staffPayrollStart: 0, cpuLogicStart: 0, worldStaffStart: 0, fanSentimentStart: 0, gmSalaryStart: 0, developmentProgramsStart: 0, namedInjuriesStart: 0, fatigueStart: 0, healthStart: 0, developmentStart: 0, financeStart: 0, financeActions: [],
      mediaDistribution: true,
      staggeredSchedule: true, scheduleVersion: 4, allStarFormat: 2,
      facilityStart: 0, arenaCarry: arenaOps.carry(save, next.startingRosters[nextTeam], nextTeam), staffing, staffSeed: save.staffSeed,
      arenaTeamCarry: Object.fromEntries([...codes].map(code => [code, arenaOps.carry(save, next.startingRosters[code], code)])),
      staffEffectStart: 0, staffBaseline: staffing, autoInjuryRotation: save.autoInjuryRotation,
      staffCohesionCarry: Object.fromEntries([...codes].map(code => [code, staffSim.collaboration(save, code).groups])),
      staffTrustCarry: { ...save.staffTrustCarry, ...Object.fromEntries((save.staffTrustEvents ?? []).map(event => [event.id, event.score])) },
      relationships: relationships.settle(save, state, save, true).relationships,
      serviceCredits: { ...save.serviceCredits, ...Object.fromEntries([...state.serviceEarned].map(id => [id, (save.serviceCredits?.[id] ?? 0) + 1])) },
      customPlayers, draftRights, retirements, farewellTours, retiredJerseys, staffRetirements,
      gmTrust: save.gmTrust, gmContacts: save.gmContacts, equalLotteryOdds: meeting?.passed && meeting.proposal === 'standard-lottery' ? false : Boolean(save.equalLotteryOdds || (meeting?.proposal === 'lottery' && meeting.passed)),
      tradeDeadlineOffset: meeting?.passed && meeting.proposal === 'deadline' ? 7
        : meeting?.passed && meeting.proposal === 'earlier-deadline' ? -7 : meeting?.passed && meeting.proposal === 'standard-deadline' ? 0 : offset,
      noTradeDeadline: meeting?.passed && meeting.proposal === 'standard-deadline' ? false : Boolean(save.noTradeDeadline || (meeting?.proposal === 'no-deadline' && meeting.passed)),
      championDraftsLast: meeting?.passed && meeting.proposal === 'standard-draft-order' ? false : Boolean(save.championDraftsLast || (meeting?.passed && meeting.proposal === 'champion-last')),
      seriesLengths: meeting?.passed && /^playoff-[0-3]-[1357]$/.test(meeting.proposal)
        ? { ...save.seriesLengths, [meeting.proposal.split('-')[1]]: Number(meeting.proposal.split('-')[2]) } : save.seriesLengths,
      noAwardMinimum: meeting?.passed && meeting.proposal === 'restore-award-minimum' ? false : Boolean(save.noAwardMinimum || (meeting?.proposal === 'no-award-minimum' && meeting.passed)),
      singleCoachChallenge: meeting?.passed && meeting.proposal === 'two-challenges' ? false : Boolean(save.singleCoachChallenge || (meeting?.proposal === 'one-challenge' && meeting.passed)),
      unretiredHistoricalJerseys: save.unretiredHistoricalJerseys,
      leagueMeetings: [...(save.leagueMeetings ?? []), ...(meeting ? [meeting] : [])],
      pickOwners: Object.fromEntries(Object.entries(save.pickOwners ?? {}).filter(([key]) => Number(key.split('-')[0]) > draftOps.draftYear(save))),
      draftHistory: [...(save.draftHistory ?? []), draftOps.draftOrder(save, state, true).slice(0, 30)],
      playerEdits: [...(save.playerEdits ?? []).map(({ attributes, ...edit }) => ({ ...edit, day: 0 })),
        ...entrants.map(player => ({ type: 'create', day: 0, id: player.id, profile: {} }))],
      carriedRatings: playerDevelopment.carryRatings(offseason, state.averages, previous, state.profiles.values()),
      handoff: { previousRatings: Object.fromEntries([...state.profiles.values()].map(player =>
        [player.id, { ...player.attributes, ...save.carriedRatings?.[player.id] }])) },
      market: { open: true, timed: Boolean(meetingChoices.timedMarket), moratoriumDay: 1, round: 1, offers: {}, sheets: {}, qualifying, results: [], formerTeams: Object.fromEntries(state.owners),
        rosterTargets: Object.fromEntries([...state.rosters].map(([code, roster]) => [code, roster.length])) },
      plans: [{ day: 0, minutes, order: sameTeam ? currentOrder(save).filter(id => owned.has(id)) : [] }],
      training: [{ day: 0, assignments }], pastSeasons: [...pastSeasons, archived],
    });
  }

  function unretireJersey(expected, number, historical = false) {
    const save = load();
    if (!save || JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('Reopen your team’s retired jerseys.');
    if (historical && number !== '6' && relationships.jerseyNumber(number) !== null
      && relationships.historicalJerseyRetired(save, save.team, number)) {
      const historicalJerseys = save.unretiredHistoricalJerseys ?? {};
      write({ ...save, unretiredHistoricalJerseys: { ...historicalJerseys,
        [save.team]: { ...historicalJerseys[save.team], [number]: true } } });
      return;
    }
    if (historical || !save.retiredJerseys?.[save.team]?.[number]) {
      throw new Error('Reopen your team’s retired jerseys.');
    }
    const teamJerseys = { ...save.retiredJerseys[save.team] };
    delete teamJerseys[number];
    write({ ...save, retiredJerseys: { ...save.retiredJerseys, [save.team]: teamJerseys } });
  }

  function finishHandoff(expected, host, draftClass, sourceYear = draftOps.defaultClassYear(draftOps.draftYear(expected))) {
    const save = load();
    if (!save?.handoff || save.market?.open || save.day !== 0 || JSON.stringify(save) !== JSON.stringify(expected)) {
      throw new Error('Reopen the season handoff.');
    }
    if (!codes.has(host)) throw new Error('Choose an All-Star host.');
    if (!draftOps.libraryYears.includes(sourceYear)) throw new Error("Choose a draft class from the library.");
    write({ ...save, handoff: null, allStarHost: host,
      draftClassSource: { year: draftOps.draftYear(save), sourceYear },
      customDraftClass: draftClass === null ? null : draftOps.validateClass(save, draftClass) });
  }

  function marketAction(expected, action) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The save changed. Reopen free agency.');
    const state = history(save);
    let updated = freeAgency.apply(save, state, action);
    if (['offer', 'match'].includes(action.type) && save.cfoBudget?.[save.team]) {
      teamFinance.enforceBudget(save, updated, state, history(updated));
    }
    if (action.type === 'close') {
      const roster = updated.startingRosters[save.team].map(id => state.profiles.get(id)).filter(Boolean).sort(rotationOrder);
      const prior = save.plans[0]?.minutes;
      const retainedMinutes = Object.values(prior ?? {}).reduce((sum, minutes) => sum + minutes, 0);
      const minutes = retainedMinutes >= 120 ? reconcilePlan(save.team, prior, roster) : defaultPlan(save.team, roster);
      const order = orderedRoster(roster, retainedMinutes >= 120 ? save.plans[0]?.order : undefined, minutes).map(player => player.id);
      updated.plans = [{ day: 0, minutes, order }];
      updated = cpuTeams.openingDepth(updated, history(updated));
    }
    write(relationships.settle(updated, history(updated), save));
  }

  function negotiateContract(expected, kind, id, deal) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the offer editor.');
    const state = history(save);
    const outcome = freeAgency.negotiate(save, state, kind, id, deal);
    deal = outcome.deal;
    const negotiations = { ...save.negotiations, [kind + ':' + id]: { ...outcome, day: save.day, team: save.team } };
    if (!outcome.accepted) write({ ...save, negotiations });
    else if (kind === 'extension') {
      const updated = { ...save, negotiations, extensions: { ...save.extensions, [id]: deal } };
      write(relationships.settle(updated, state, save, false, { type: 'extension', id, team: save.team, deal }));
    }
    else if (save.market?.open) {
      const updated = { ...freeAgency.acceptOffseason(save, state, id, deal), negotiations };
      const updatedState = history(updated);
      teamFinance.enforceBudget(save, updated, state, updatedState);
      write(relationships.settle(updated, updatedState, save));
    } else saveFinanceAction(save, { type: 'signing', id, deal, inSeason: true }, negotiations);
    return outcome;
  }

  function delegateContract(expected, kind, id) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the contract screen.');
    const state = history(save);
    const player = state.profiles.get(id);
    if (!player || state.unavailable.has(id)) throw new Error('Choose an available player.');
    const assistant = staffSim.assignments(save, save.team, staffSim.roles)['Assistant GM'];
    const salary = Math.round(freeAgency.askingSalary(player) * (1 + (100 - assistant.skill) / 200) / 1000) * 1000;
    const years = save.market?.qualifying?.[id]?.code && save.market.qualifying[id].code !== save.team ? 2 : assistant.skill >= 80 ? 2 : 1;
    return negotiateContract(save, kind, id, { ...freeAgency.modelDeal(salary), years, upfront: 25 });
  }

  function delegateFrontOffice(expected, task) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the Assistant GM office.');
    const state = history(save);
    if (task === 'rotation') {
      const { minutes, order } = repairRotation(save, true);
      setPlan(save, minutes, order);
      return 'Rotation updated.';
    }
    if (task === 'draft') {
      if (!save.draftRoom) throw new Error('Open the NBA Draft after completing the lottery and workouts.');
      if (save.draftRoom.picks.length >= save.draftRoom.order.length) return 'The draft is already complete.';
      draftAction(save, '', 'end');
      return 'Assistant GM completed the draft using your personal draft board.';
    }
    if (task === 'sign-rookie') {
      const rookie = Object.values(save.draftRights ?? {}).filter(pick => pick.team === save.team).sort((a, b) => a.number - b.number)[0];
      if (!rookie) return 'No unsigned rookies are available.';
      signDraftRight(save, rookie.id);
      return 'Signed ' + (state.profiles.get(rookie.id)?.name ?? 'the highest drafted rookie') + '.';
    }
    if (!['free-agent', 'extension'].includes(task)) throw new Error('Choose a delegation task.');
    const staff = staffSim.assignments(save, save.team, staffSim.roles)['Assistant GM'];
    const contracts = teamFinance.report(save, state).contracts;
    const roster = state.rosters.get(save.team);
    const targetSize = Math.min(18, staff.skill >= 80 ? 15 : 13);
    const priorities = roster.reduce((counts, player) => {
      counts[player.position] = (counts[player.position] ?? 0) + 1;
      return counts;
    }, {});
    const pending = save.market?.open ? save.market.offers ?? {} : {};
    if (task === 'free-agent' && roster.length + Object.keys(pending).length >= targetSize) return 'The roster already meets the Assistant GM’s depth target.';
    const candidates = [...state.profiles.values()].filter(player => !state.unavailable.has(player.id)
      && (task === 'extension' ? freeAgency.extensionStatus(save, state, player.id, contracts.get(player.id)) === 'Ready to negotiate'
        : !state.owners.has(player.id) && !pending[player.id] && !save.draftRights?.[player.id]
          && !save.market?.qualifying?.[player.id] && (freeAgency.talks(save, task, player.id)?.attempts ?? 0) === 0));
    const value = player => (state.playerOveralls.get(player.id) ?? 0) - (task === 'free-agent' ? (priorities[player.position] ?? 0) : 0);
    for (const player of candidates.sort((a, b) => value(b) - value(a))) {
      try {
        const offer = delegateContract(save, task, player.id);
        return player.name + (offer.accepted ? ' accepted the offer.' : ' declined the offer.');
      } catch (error) {
        if (!/CFO|budget|cover|salary|promise/i.test(error.message)) throw error;
      }
    }
    return 'No eligible candidate fits the current payroll plan.';
  }

  function staffAssignmentAction(expected, role, choice) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the staff office.');
    const state = history(save);
    const plan = currentGameplan(save);
    switch (role) {
      case 'Head Coach': return delegateFrontOffice(save, 'rotation');
      case 'Assistant Head Coach': {
        const { minutes, order } = repairRotation(save);
        setPlan(save, minutes, order);
        return 'Existing rotation adjusted for availability.';
      }
      case 'Offensive Coach': setGameplan(save, { ...plan, play: choice }); return 'Offensive scheme saved.';
      case 'Defensive Coach': setGameplan(save, { ...plan, defense: choice }); return 'Defensive scheme saved.';
      case 'Head of Player Development':
        saveFinanceAction(save, { type: 'facility', facility: 'training', command: 'auto-practice' });
        return 'Practice delegation changed.';
      case 'Assistant Player Development Coach': {
        const assignments = { ...currentTraining(save) };
        for (const player of state.activeRoster) {
          if (assignments[player.id] || state.health.get(player.id)?.durability <= 50) continue;
          const ratings = effectiveRatings(save, state.development, player);
          const attributes = playerDevelopment.attributes.filter(key => key !== 'Durability' && key !== 'Marketability');
          assignments[player.id] = attributes.reduce((lowest, key) => ratings[key] < ratings[lowest] ? key : lowest);
        }
        setTraining(save, assignments);
        return 'Individual drills assigned to healthy players without a plan.';
      }
      case 'Head Scout': setAutoScouting(save, !save.autoScouting?.[save.team]); return 'Automatic scouting preference changed.';
      case 'Assistant Head Scout': prospectAction(save, choice, 'scout'); return 'Prospect report updated.';
      case 'Head Medical Staff': {
        const { minutes, order } = repairRotation(save);
        setPlan(save, minutes, order);
        return 'Rotation updated using medical availability and minute limits.';
      }
      case 'Assistant Head Medical Staff': {
        const assignments = { ...currentTraining(save) };
        const resting = Object.keys(assignments).filter(id => {
          const condition = state.health.get(id);
          return condition && (condition.fatigue < 80 || condition.durability <= 50);
        });
        if (!resting.length) return 'No individual drills need to be removed for recovery.';
        for (const id of resting) delete assignments[id];
        setTraining(save, assignments);
        return 'Removed individual drills for ' + resting.length + ' players to give them recovery time.';
      }
      case 'Assistant GM': return delegateFrontOffice(save, choice);
      default: throw new Error('Choose a staff workspace.');
    }
  }

  function setCfoBudget(expected, limits) {
    const save = load();
    if (JSON.stringify(save) !== JSON.stringify(expected) || save.simcast) throw new Error('Reopen the CFO budget.');
    const categories = ['players', 'upgrades', ...staffSim.roles];
    if (Object.entries(limits).some(([key, amount]) => !categories.includes(key)
      || !Number.isSafeInteger(amount) || amount < 0)) throw new Error('Enter nonnegative whole-dollar allocations.');
    write({ ...save, cfoBudget: { ...save.cfoBudget, [save.team]: limits } });
  }

  function assignStaff(expected, roles, role, id, terms) {
    const save = load();
    if (save.simcast) throw new Error("Finish SimCast before changing the roster or facilities.");
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The save changed. Reopen Staff.');
    const staffing = staffSim.assign(save, roles, role, id, terms);
    const staffTimeline = [...save.staffTimeline.filter(entry => entry.day !== save.day), { day: save.day, staffing }];
    const updated = { ...save, staffing, staffTimeline };
    if (teamFinance.report(updated, history(updated)).available < 0) throw new Error('The team cannot cover this staff payroll and its existing obligations.');
    teamFinance.enforceBudget(save, updated, history(save), history(updated));
    write(updated);
  }

  function conversation(expected, action) {
    const save = load();
    if (save.simcast && ["staff-talk", "fan-talk", "interview"].includes(action.type)) {
      throw new Error("Finish SimCast before holding this meeting.");
    }
    if (JSON.stringify(save) !== JSON.stringify(expected)) throw new Error('The save changed. Reopen the conversation.');
    const state = history(save);
    let updated = relationships.apply(save, state, action);
    if (action.type === 'fan-talk' && updated !== save && relationships.fanActivities[action.value]?.cost) {
      updated = teamFinance.addAction(updated, state, { type: 'facility', facility: 'community',
        command: 'fan-event', index: action.id, value: action.value });
      teamFinance.enforceBudget(save, updated, state, state);
    }
    if (action.type === 'staff-talk' && updated !== save) {
      updated.staffTrustEvents = [...(save.staffTrustEvents ?? []), {
        id: action.id, day: save.day, score: relationships.score(updated, action.id, 48),
      }];
    }
    write(relationships.settle(updated, state, save));
  }

  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const baseOverall = player => mean(Object.values(player.attributes));
  const baseTeamOverall = code => mean(rotations.get(code).map(baseOverall));
  function effectiveRatings(save, development, player) {
    const attributes = playerDevelopment.ratings(development, player);
    attributes.Marketability = Math.min(99, attributes.Marketability + teamFinance.promotionBoost(save, player.id));
    return attributes;
  }

  const percentage = (made, attempted) => attempted ? 100 * made / attempted : null;
  const toAverages = totals => new Map([...totals].map(([id, player]) => [id, {
    GP: player.GP,
    ...Object.fromEntries(boxFields.map(stat => [stat, player[stat] / player.GP])),
    REB: (player.OREB + player.DREB) / player.GP,
    'FG%': percentage(player.FGM, player.FGA),
    '3P%': percentage(player['3PM'], player['3PA']),
    'FT%': percentage(player.FTM, player.FTA),
  }]));
  let cachedHistory;
  let cachedKey;
  const archiveHistory = new Map();

  function history(save, stopFrom = Infinity) {
    const key = JSON.stringify({ ...save, pastSeasons: undefined, relationships: undefined, simcast: undefined });
    if (stopFrom === Infinity && key === cachedKey) return cachedHistory;
    const archived = stopFrom === Infinity && !save.pastSeasons && Boolean(save.championshipReviewed || save.day > lastDay);
    if (archived && archiveHistory.has(key)) return archiveHistory.get(key);
    const records = Object.fromEntries([...codes].map(code => [code, { wins: 0, losses: 0 }]));
    const results = [];
    const totals = new Map();
    const affiliateTotals = new Map();
    const affiliateOpponents = Object.keys(arenaOps.affiliates).filter(code => code !== save.team);
    const affiliateSchedule = Array.from({ length: 50 }, (_, index) => ({
      day: index < 14 ? 1 + index * 3 : 43 + Math.floor((index - 14) * 98 / 35),
      opponent: affiliateOpponents[(index + (save.seed >>> 0)) % affiliateOpponents.length],
      home: index % 2 === 0,
      stage: index < 14 ? 'Tip-Off' : 'Regular season',
    }));
    const affiliateByDay = new Map(affiliateSchedule.map(game => [game.day, game]));
    const affiliateGames = [];
    const playoffTotals = new Map();
    const playInTotals = new Map();
    const benchGames = new Map();
    const injuryMisses = new Map();
    const profiles = new Map([...league.players, ...(save.customPlayers ?? [])].map(player => [player.id, player]));
    const startingIds = new Set(Object.values(save.startingRosters ?? {}).flat());
    const unavailable = new Set([...(save.customPlayers ?? []).filter(player => !startingIds.has(player.id)).map(player => player.id),
      ...Object.keys(save.retirements ?? {})]);
    const health = new Map([...profiles.keys()].map(id => [id, freshHealth()]));
    const injuries = [];
    const edits = save.playerEdits ?? [];
    let editIndex = 0;
    const development = playerDevelopment.create(save.carriedRatings);
    const rosters = save.startingRosters ? new Map(Object.entries(save.startingRosters).map(([code, ids]) =>
      [code, ids.map(id => profiles.get(id)).filter(Boolean).sort(rotationOrder)])) : new Map(rotations);
    const transactions = save.financeActions.filter(isTransaction);
    let transactionIndex = 0;
    let plan = defaultPlan(save.team, rosters.get(save.team));
    let order;
    let planIndex = 0;
    let training = {};
    let trainingIndex = 0;
    let bracket = null;
    let staff;
    let activeStaffing = save.staffBaseline;
    let staffIndex = 0;
    const staffTimeline = save.staffTimeline ?? [];
    let awards = null;
    let awardInputs;
    const allStarDay = allStarDayFor(save);
    let allStarOwners, awardOwners, allStarSaturday, risingStars, allStarGame, allStarDraft, allStarVotes, nominees, captains;
    const election = allStarElectionDates(save);
    const dailyPerformance = [];
    const customAllStar = save.allStarFormat === 2;
    let selections = { allStar: [], allStarStarters: [], allStarReserves: [] };
    const revised = revisedRules(save);
    const firstRoundDay = firstPlayoffGame + (revised ? postseason.playInDays : 0);
    const ownersFor = () => new Map([...rosters].flatMap(([code, roster]) => roster.map(player => [player.id, code])));
    const slateFor = day => {
      if (!bracket) return fixtures(day, save);
      if (revised && day < firstRoundDay) return postseason.playInSlate(bracket, day - firstPlayoffGame);
      return postseason.slate(bracket, day - firstRoundDay);
    };
    let playedThrough = save.day;
    let rotationAlert = null;
    const serviceEarned = new Set();
    for (let day = 0; day <= save.day; day++) {
      if (bracket?.champion) { playedThrough = day; break; }
      if (customAllStar && day === election.open) nominees = franchiseAllStar.nominate(save, {
        averages: toAverages(totals), owners: ownersFor(), profiles, health, results,
        affiliate: arenaOps.settings(save, day).affiliate,
      });
      if (nominees && day <= election.close) {
        const daily = new Map();
        for (const field of Object.values(nominees)) for (const { id } of field.slice(0, 16)) {
          const line = totals.get(id);
          if (!line?.GP) continue;
          const impact = nbaAwards.impact({ ...line, REB: line.OREB + line.DREB });
          daily.set(id, Math.max(1, impact / Math.sqrt(line.GP)));
        }
        dailyPerformance.push(daily);
      }
      if (nominees && (day === election.close || day === save.day && day < election.close)) {
        allStarVotes = franchiseAllStar.voting(nominees, save, day - election.open, dailyPerformance);
        if (day === election.close) {
          captains = franchiseAllStar.captains(save, records, results, day);
          const ids = ['East', 'West'].flatMap(conference => allStarVotes[conference].map(row => row.id));
          selections = { allStar: ids, allStarStarters: [], allStarReserves: [] };
          allStarOwners = new Map(Object.values(nominees).flat().map(row => [row.id, row.team]));
        }
      }
      if (day >= allStarDay - 2 && day <= allStarDay) {
        const averages = toAverages(totals);
        const affiliate = arenaOps.settings(save, day).affiliate;
        const owners = ownersFor();
        const entrants = [...owners].flatMap(([id, team]) => {
          const player = profiles.get(id);
          if (!player || unavailable.has(id) || health.get(id)?.durability <= 10) return [];
          const country = nbaProfileData[id]?.country ?? player.country ?? player.birthplace?.country;
          // The NBA placed Towns and Powell on World despite their U.S. birthplaces.
          const worldOverride = ['Karl-Anthony Towns', 'Norman Powell'].includes(player.name);
          const allStarSide = worldOverride ? 'World' : !country ? null
            : /^(USA|US|United States(?: of America)?)$/i.test(country) ? 'USA' : 'World';
          return [{ id, team, name: player.name, ratings: effectiveRatings(save, development, player), stats: averages.get(id),
            affiliate: Object.hasOwn(affiliate, id), service: serviceYears(save, player),
            allStarSide }];
        });
        const seed = save.seed ^ save.year;
        if (day === allStarDay - 2) risingStars = nbaAwards.risingStars(entrants, seed, customAllStar);
        if (day === allStarDay - 1) allStarSaturday = nbaAwards.saturday(entrants.filter(entry => !entry.affiliate), seed, customAllStar);
        if (day === allStarDay && !customAllStar) {
          allStarOwners = owners;
          selections = nbaAwards.allStar(averages, owners, save.seed);
          allStarGame = nbaAwards.allStarGame(entrants, selections, seed);
        }
        if (day === allStarDay && captains) {
          const available = new Map(entrants.filter(entry => !entry.affiliate).map(entry => [entry.id, entry]));
          const eligible = ['East', 'West'].flatMap(conference => [
            ...allStarVotes[conference], ...nominees[conference].slice(16),
          ].map(row => available.get(row.id)).filter(Boolean).slice(0, 16));
          const votingScore = new Map(Object.values(allStarVotes).flat().map(row => [row.id, row.score]));
          eligible.sort((a, b) => (votingScore.get(b.id) ?? 0) - (votingScore.get(a.id) ?? 0)
            || nbaAwards.impact(b.stats) - nbaAwards.impact(a.stats));
          if (eligible.length === 32) {
            allStarDraft = franchiseAllStar.draft(captains, eligible, save);
            if (!allStarDraft.pending) {
              const byName = new Map(allStarDraft.teams.map(team => [team.name, team]));
              allStarGame = nbaAwards.exhibition(['Team Magic', 'Team Bird', 'Team Jordan', 'Team Kobe'].map(name => byName.get(name)), seed ^ 0x2244);
            }
          }
        }
      }
      if (day === playoffStart) {
        bracket = postseason.bracket(records, results, save.seed, revised, save.seriesLengths);
        const averages = toAverages(totals);
        const owners = awardOwners = ownersFor();
        const may31 = (Date.parse(`${Number(date(0, save.year).slice(0, 4)) + 1}-05-31`)
          - Date.parse(date(0, save.year))) / 86400000;
        awardInputs = { averages, benchGames: new Map(benchGames), records, owners, games: [...results],
          health: structuredClone(health), save, selections, may31 };
        awards = revised ? nbaAwards.regular(awardInputs) : postseason.awards(averages, benchGames, records, owners);
      }
      if (day === (revised ? firstRoundDay : playoffStart)) {
        for (const condition of health.values()) {
          if (condition.durability === 0) {
            condition.durability = 1;
            if (condition.injury?.severity === 'Season') condition.injury = { ...condition.injury, unlockDay: day };
          }
        }
      }
      while (transactions[transactionIndex]?.day === day) movePlayers(rosters, transactions[transactionIndex++], save.team);
      while (edits[editIndex]?.day === day) {
        const edit = edits[editIndex++];
        if (edit.type === 'delete') { unavailable.add(edit.id); continue; }
        if (!save.retirements?.[edit.id]) unavailable.delete(edit.id);
        const player = { ...profiles.get(edit.id), ...edit.profile };
        profiles.set(edit.id, player);
        for (const [team, roster] of rosters) {
          if (roster.some(item => item.id === edit.id)) rosters.set(team, roster.map(item => item.id === edit.id ? player : item));
        }
        if (edit.attributes) playerDevelopment.override(development, edit.id, edit.attributes);
      }
      if (staffTimeline[staffIndex]?.day === day) activeStaffing = staffTimeline[staffIndex++].staffing;
      if (day >= save.staffEffectStart) {
        const staffingSave = { ...save, staffing: activeStaffing };
        if (!staff || day >= (save.worldStaffStart ?? Infinity) && day % 7 === 0) {
          staff = new Map([...codes].map(code => [code, staffSim.effects(staffingSave, code, day)]));
        }
        staff.set(save.team, staffSim.effects(staffingSave, save.team, day));
      }
      if (save.plans[planIndex]?.day === day) {
        ({ minutes: plan, order } = save.plans[planIndex++]);
      }
      if (save.training[trainingIndex]?.day === day) training = save.training[trainingIndex++].assignments;
      const facilities = arenaOps.settings(save, day);
      const clubFacilities = day >= (save.cpuLogicStart ?? Infinity)
        ? new Map([...codes].map(code => [code, code === save.team ? facilities : arenaOps.settings(save, day, code)]))
        : new Map([[save.team, facilities]]);
      const activeRoster = rosters.get(save.team).filter(player => !Object.hasOwn(facilities.affiliate, player.id));
      if (day >= stopFrom) {
        const roster = activeRoster;
        const issues = rotationIssues(roster, health, reconcilePlan(save.team, plan, roster), order);
        const capacity = roster.reduce((total, player) => total + minuteLimit(health.get(player.id).durability), 0);
        const shortHanded = capacity < 240;
        const gameToday = slateFor(day).some(game => game.includes(save.team));
        const recovered = day > stopFrom ? injuries.filter(injury => injury.day === day - 1 && injury.team === save.team && injury.condition === 'Healthy') : [];
        if (issues.length && (!shortHanded || gameToday && !(save.forfeitDays ?? []).includes(day)) || recovered.length && !shortHanded) {
          rotationAlert = { day, issues, shortHanded, recovered };
          playedThrough = day;
          break;
        }
      }
      if (day === save.day) break;
      const developmentActive = day >= save.developmentStart;
      const played = new Map();
      const playIn = Boolean(bracket && revised && day < firstRoundDay);
      const playoffRound = playIn ? -1 : bracket ? Math.max(0, Math.floor((day - firstRoundDay) / 14)) : null;
      const slate = slateFor(day);
      const gameRosters = new Map(rosters);
      gameRosters.set(save.team, activeRoster);
      if (!bracket) for (const roster of rosters.values()) for (const player of roster) serviceEarned.add(player.id);
      const games = gamesForDay(save, day, day >= save.healthStart || bracket ? health : null,
        reconcilePlan(save.team, plan, activeRoster), order, developmentActive ? development : null,
        gameRosters, slate, playoffRound, staff, profiles);
      for (const [index, generated] of games.entries()) {
        let game = save.simcastResults?.[generated.id] ?? generated;
        const forced = bracket && save.forcedPlayoffWins?.[game.id];
        for (let attempt = 1; forced && !game.forfeit && (game.homeScore > game.awayScore ? game.home : game.away) !== forced
          && attempt <= 128; attempt++) {
          [game] = gamesForDay({ ...save, seed: save.seed ^ Math.imul(attempt, 2654435761) }, day, health, plan, order,
            development, gameRosters, [[generated.home, generated.away]], playoffRound, staff, profiles);
        }
        games[index] = game;
        if (!bracket && day >= save.healthStart) {
          for (const player of [...rosters.get(game.home), ...rosters.get(game.away)]) {
            if (health.get(player.id).durability <= 10) injuryMisses.set(player.id, (injuryMisses.get(player.id) ?? 0) + 1);
          }
        }
        if (!bracket) {
          records[game.home][game.homeScore > game.awayScore ? 'wins' : 'losses']++;
          records[game.away][game.awayScore > game.homeScore ? 'wins' : 'losses']++;
          const bench = side => game[side + 'Starters'] ? game[side + 'Box'].filter(line => !game[side + 'Starters'].includes(line.id))
            : game[side + 'Box'].slice(5);
          for (const line of [...bench('home'), ...bench('away')]) {
            benchGames.set(line.id, (benchGames.get(line.id) ?? 0) + 1);
          }
        }
        results.push(game);
        for (const line of [...game.homeBox, ...game.awayBox]) {
          played.set(line.id, line.MIN);
          const table = playIn ? playInTotals : bracket ? playoffTotals : totals;
          if (!table.has(line.id)) table.set(line.id, { GP: 0, ...Object.fromEntries(boxFields.map(stat => [stat, 0])) });
          const player = table.get(line.id);
          player.GP++;
          for (const stat of boxFields) player[stat] += line[stat] ?? 0;
        }
      }
      if (playIn) postseason.recordPlayIn(bracket, games, records);
      else if (bracket) postseason.record(bracket, games, day - firstRoundDay, records);
      if (day >= save.healthStart || bracket) {
        const owner = ownersFor();
        const clinics = new Map([...clubFacilities].map(([code, config]) => [code, arenaOps.clinicEffects(config.clinic.level + arenaOps.expansion(config, "clinic"))]));
        const before = [...owner.keys()].map(id => [id, tier(health.get(id).durability), health.get(id).injury?.name]);
        updateHealth(health, day, played, Boolean(bracket && !playIn), id => staff?.get(owner.get(id)), day >= (save.fatigueStart ?? Infinity), id => clinics.get(owner.get(id)),
          day >= (save.namedInjuriesStart ?? Infinity));
        for (const [id, previous, previousName] of before) {
          const condition = tier(health.get(id).durability);
          if (condition !== previous) injuries.push({ day, id, team: owner.get(id), condition,
            name: health.get(id).injury?.name ?? previousName });
        }
      }
      const activity = save.financeActions.find(action => action.activity && action.day === day);
      const recovery = teamFinance.activities[activity?.activity]?.recovery ?? 0;
      if (recovery) for (const player of activeRoster) {
        const condition = health.get(player.id);
        condition.fatigue = Math.max(0, Math.min(100, condition.fatigue + recovery));
      }
      if (developmentActive) {
        const dateText = date(day, save.year);
        const rest = !slate.some(game => game.includes(save.team));
        const playedOn = previous => fixtures(previous, save).some(game => game.includes(save.team));
        const autoPractice = facilities.training.automatic && !bracket && rest
          && !(day >= 2 && playedOn(day - 1) && playedOn(day - 2)) && day % 2 === 0;
        const scheduledPractice = facilities.training.automatic ? autoPractice
          : rest && facilities.training.days.includes(new Date(dateText + 'T00:00:00Z').getUTCDay());
        const practice = scheduledPractice
          ? new Set(activeRoster.filter(player => health.get(player.id).fatigue >= 40 && health.get(player.id).durability > 50).map(player => player.id))
          : new Set();
        const practiceRates = new Map([[save.team, { ...arenaOps.trainingRates(facilities.training.level + arenaOps.expansion(facilities, "training") * 0.5),
          prePeakEnabled: day >= (save.developmentProgramsStart ?? Infinity) }]]);
        const owners = ownersFor();
        for (const [code, config] of clubFacilities) {
          if (code === save.team || slate.some(game => game.includes(code))) continue;
          const roster = rosters.get(code);
          if (config.training.days.includes(new Date(dateText + 'T00:00:00Z').getUTCDay())) {
            for (const player of roster) if (health.get(player.id).fatigue >= 40 && health.get(player.id).durability > 50) practice.add(player.id);
          }
          practiceRates.set(code, { ...arenaOps.trainingRates(config.training.level + arenaOps.expansion(config, "training") * 0.5), prePeakEnabled: true });
          if (bracket) continue;
          const drills = Object.fromEntries(roster.filter(player => playerDevelopment.ageAt(player, dateText)
            <= (playerDevelopment.profiles.get(player.id) ?? playerDevelopment.curve(player)).peakEnd).slice(0, 3).map(player => {
            const keys = cpuTeams.positionGroup(player) === 'G' ? ['3PT', 'Handles', 'Pass Acc']
              : ['3PT', 'Interior Defense', 'Defensive Rebound'];
            const ratings = playerDevelopment.ratings(development, player);
            keys.sort((a, b) => ratings[a] - ratings[b]);
            return [player.id, keys[0]];
          }));
          const logStart = development.log.length;
          playerDevelopment.runDrills(development, drills, health, day, profiles, staff?.get(code));
          for (const entry of development.log.slice(logStart)) entry.team = code;
        }
        const teamPractice = [...practice].filter(id => owners.get(id) === save.team).length;
        if (teamPractice) development.practice.push({ day, players: teamPractice });
        playerDevelopment.agePlayers(development, dateText, profiles.values(), practice,
          player => practiceRates.get(owners.get(player.id)) ?? { prePeakEnabled: day >= (save.developmentProgramsStart ?? Infinity) });
        if (!bracket && rest) {
          const activeDrills = Object.fromEntries(Object.entries(training).filter(([id]) => !Object.hasOwn(facilities.affiliate, id)));
          if (autoPractice) {
            const limit = Math.max(1, Math.floor((staff?.get(save.team)?.developmentSkill ?? 60) / 25));
            const candidates = activeRoster.filter(player => !activeDrills[player.id]
              && health.get(player.id).fatigue >= 65 && health.get(player.id).durability > 50
              && playerDevelopment.ageAt(player, dateText) <= (player.progression ?? playerDevelopment.curve(player)).peakEnd);
            for (const player of candidates.slice(0, limit)) {
              const ratings = playerDevelopment.ratings(development, player);
              const focus = cpuTeams.positionGroup(player) === 'G' ? ['3PT', 'Handles', 'Pass Acc']
                : ['Inside', 'Interior Defense', 'Defensive Rebound'];
              activeDrills[player.id] = focus.reduce((lowest, key) => ratings[key] < ratings[lowest] ? key : lowest);
            }
          }
          playerDevelopment.runDrills(development, activeDrills, health, day, profiles, staff?.get(save.team));
        }
        const affiliateFixture = !bracket && affiliateByDay.get(day);
        const affiliateLines = [];
        if (!bracket) for (const [id, start] of Object.entries(facilities.affiliate)) {
          const player = profiles.get(id);
          if (!player || day < start) continue;
          if ((day - start + 1) % 30 === 0) playerDevelopment.affiliateGain(development, player, day, { affiliateGain: Math.min(0.30, (staff?.get(save.team)?.affiliateGain ?? 0) + 0.025 * arenaOps.expansion(facilities, "affiliate")) });
          if (affiliateFixture && health.get(id)?.durability > 30) {
            const seed = [...id].reduce((hash, char) => Math.imul(hash, 31) + char.charCodeAt(0), save.seed ^ day);
            const line = playerDevelopment.affiliateBox(effectiveRatings(save, development, player), randomFor(seed));
            const total = affiliateTotals.get(id) ?? { GP: 0, ...Object.fromEntries(boxFields.map(stat => [stat, 0])) };
            total.GP++;
            for (const stat of boxFields) total[stat] += line[stat] ?? 0;
            affiliateTotals.set(id, total);
            affiliateLines.push({ id, name: player.name, ...line });
          }
        }
        if (affiliateFixture) {
          const random = randomFor(save.seed ^ Math.imul(day, 4109));
          const points = affiliateLines.reduce((total, line) => total + line.PTS, 0);
          const minutes = affiliateLines.reduce((total, line) => total + line.MIN, 0);
          const score = points + Math.round(Math.max(0, 240 - minutes) * (0.38 + random() * 0.12));
          const opponentScore = Math.round(94 + random() * 25);
          affiliateGames.push({ ...affiliateFixture, score: score === opponentScore ? score + 1 : score, opponentScore, lines: affiliateLines });
        }
      }
    }
    const averages = toAverages(totals);
    cachedKey = stopFrom === Infinity ? key : undefined;
    const owners = ownersFor();
    const playerOveralls = new Map([...profiles.values()].map(player =>
      [player.id, mean(Object.values(effectiveRatings(save, development, player)))]));
    const teamOveralls = new Map([...rosters].map(([code, roster]) => [code, mean(roster.map(player => playerOveralls.get(player.id)))]));
    const today = slateFor(playedThrough);
    const playoffAwards = !revised || !bracket ? null : {
      eastFinals: nbaAwards.playoffMvp(results, bracket.rounds[2]?.[0], 2, save.seed ^ 77),
      westFinals: nbaAwards.playoffMvp(results, bracket.rounds[2]?.[1], 2, save.seed ^ 79),
      finals: nbaAwards.playoffMvp(results, bracket.rounds[3]?.[0], 3, save.seed ^ 83, false, save.finalsChampionBoost ?? 0.2),
    };
    const overrides = save.awardOverrides ?? {};
    for (const [key, ids] of Object.entries({ ...awards, ...playoffAwards, allStar: selections.allStar })) {
      if (key === 'allStarStarters' || key === 'allStarReserves') continue;
      ids.forEach((id, index) => {
        const replacement = overrides[key + ':' + index];
        if (!replacement) return;
        ids[index] = replacement;
        if (key === 'allStar' && !customAllStar) {
          const group = index < selections.allStarStarters.length ? selections.allStarStarters : selections.allStarReserves;
          group[index < selections.allStarStarters.length ? index : index - selections.allStarStarters.length] = replacement;
        }
      });
    }
    for (const [key, event] of [['allStarMvp', allStarGame], ['risingMvp', risingStars]]) {
      const id = overrides[key];
      const player = event?.teams.flatMap(team => team.roster).find(row => row.id === id);
      if (player) event.mvp = { id, name: player.name, team: player.team };
    }
    for (const key of ['threePoint', 'dunk', 'shootingStars']) {
      const event = allStarSaturday?.[key];
      const winner = event?.final.find(row => row.id === overrides[key]);
      if (winner) event.winner = winner;
    }
    let race, awardCandidates, periodAwards, periodicRace;
    const awardsView = {
      get awardCandidates() {
        return awardInputs ? awardCandidates ??= nbaAwards.regular({ ...awardInputs, candidatesOnly: true }) : {};
      },
      get awardRace() {
        const month = Number(date(playedThrough, save.year).slice(5, 7));
        if ((customAllStar ? playedThrough < election.open : month < 2 || month >= 10) || !averages.size) return null;
        return race ??= { ...nbaAwards.regular({ averages, benchGames, records, owners: awardOwners ?? owners,
          games: results.filter(game => game.playoffRound == null), health, save, selections: customAllStar || allStarOwners ? selections : nbaAwards.allStar(averages, owners, save.seed), projection: true }),
          eastFinals: nbaAwards.playoffMvp(results, bracket?.rounds[2]?.[0], 2, save.seed, true),
          westFinals: nbaAwards.playoffMvp(results, bracket?.rounds[2]?.[1], 2, save.seed, true),
          finals: nbaAwards.playoffMvp(results, bracket?.rounds[3]?.[0], 3, save.seed, true, save.finalsChampionBoost ?? 0.2),
        };
      },
      get periodicRace() {
        return periodicRace ??= nbaAwards.periodic(results, playedThrough, playoffStart, day => date(day, save.year), save, true);
      },
    };
    cachedHistory = { records, results, averages, affiliateAverages: toAverages(affiliateTotals), affiliateSchedule, affiliateGames, allStarDay, playInAverages: toAverages(playInTotals),
      get periodAwards() {
        return periodAwards ??= nbaAwards.periodic(results, playedThrough, playoffStart, day => date(day, save.year), save);
      },
      playoffAverages: toAverages(playoffTotals), injuryMisses, injuries, health, development, day: playedThrough, rosters, owners, profiles, unavailable, serviceEarned,
      activeRoster: rosters.get(save.team).filter(player => !Object.hasOwn(arenaOps.settings(save, playedThrough).affiliate, player.id)),
      bracket, awards, playoffAwards, selections, awardOwners, allStarOwners, allStarSaturday, risingStars, allStarGame,
      allStarVotes, allStarDraft, allStarCaptains: captains, allStarElection: election,
      allStarVotePending: customAllStar && playedThrough >= election.open && !save.allStarBallot,
      rotationAlert, today, playerOveralls, teamOveralls };
    if (archived) {
      archiveHistory.set(key, cachedHistory);
      if (archiveHistory.size > 5) archiveHistory.delete(archiveHistory.keys().next().value);
    }
    for (const key of Object.keys(awardsView)) {
      Object.defineProperty(cachedHistory, key, { get: Object.getOwnPropertyDescriptor(awardsView, key).get });
    }
    return cachedHistory;
  }

  return { setScoutingPriority, setAutoScouting, setCfoBudget, gmContact, gmContactDay, allStarAction, allStarElectionDates, setAwardOverride, storageKey, lastDay, date, fixtures, load, start, startCareer, saveSlots, openSlot, deleteSlot, quitSlot, chooseGmJob, advance, history, boxFields, percentage,
    setPlan, rebuildRotation, currentPlan, currentSlots, positionStarters, currentGameplan, setGameplan, defaultPlan, tier, minuteLimit, allocateMinutes, setTraining, currentTraining, saveFinanceAction,
    tradeDeadline, tradeDeadlineFor, leagueMeeting, qualifyingCandidates, tradePlayers, playoffStart, allStarDay, allStarDayFor, retirementCandidates, rollover, unretireJersey, finishHandoff, marketAction, negotiateContract, delegateContract, delegateFrontOffice, staffAssignmentAction, baseOverall, baseTeamOverall, effectiveRatings, currentOrder,
    restart, advanceTo, postseasonAction, firstPlayoffGame, revisedRules, assignStaff, conversation, repairRotation, resolveInjuryRotation, setAutoInjuryRotation, fatigueLoss, editPlayer, acknowledgeForfeit, serviceYears, prospectAction, revealLottery, draftAction, rankProspect, releaseDraftRight, signDraftRight, simcastAction, castMinutes, castScore, castClock, challengeableFoul, castComplete, castPlays, castDefenses, castCoverage };
})();











