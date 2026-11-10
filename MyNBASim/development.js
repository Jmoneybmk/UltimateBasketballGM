const playerDevelopment = (() => {
  const attributes = Object.keys(league.players[0].attributes)
    .filter(attribute => !['Durability', 'Marketability'].includes(attribute));
  const trainable = new Set(attributes);
  const drillGain = 0.15;
  const fatigueCost = 12;

  function curve(player) {
    const id = Number(player.id) || [...player.id].reduce((sum, letter) => sum * 31 + letter.charCodeAt(0) >>> 0, 0);
    const peakStart = 23 + id % 4;
    return {
      peakStart,
      peakEnd: peakStart + 3 + Math.floor(id / 7) % 4,
      gain: (65 + Math.floor(id / 13) % 71) / 100,
      loss: (75 + Math.floor(id / 19) % 101) / 100,
    };
  }

  function ageAt(player, date) {
    if (!player.dob && !player.listedAge) return null;
    if (!player.dob) return player.listedAge + Number(date.slice(0, 4)) - Number(league.snapshot.slice(0, 4))
      - Number(date.slice(5) < league.snapshot.slice(5));
    return Number(date.slice(0, 4)) - Number(player.dob.slice(0, 4))
      - Number(date.slice(5) < player.dob.slice(5));
  }

  const profiles = new Map(league.players.map(player => [player.id, curve(player)]));
  const create = (base = {}) => ({ base: { ...base }, aging: new Map(), drills: new Map(), log: [], practice: [] });
  const clamp = value => Math.max(25, Math.min(99, value));
  const rawValue = (state, player, key) => (state.base[player.id]?.[key] ?? player.attributes[key]) + (trainable.has(key)
    ? (state.aging.get(player.id) ?? 0) + (state.drills.get(player.id)?.[key] ?? 0) : 0);

  function ratings(state, player) {
    return Object.fromEntries(Object.keys(player.attributes).map(key => [key, clamp(rawValue(state, player, key))]));
  }

  function override(state, id, attributes) {
    state.base[id] = attributes;
    state.aging.delete(id);
    state.drills.delete(id);
  }

  function agePlayers(state, date, players = league.players, practice = new Set(), rates = {}) {
    for (const player of players) {
      const age = ageAt(player, date);
      if (age === null) continue;
      const { peakStart, peakEnd, gain, loss } = player.progression ?? profiles.get(player.id) ?? curve(player);
      const attending = practice.has(player.id);
      const bonus = typeof rates === 'function' ? rates(player) : rates;
      const rate = age < peakStart ? (bonus.prePeakEnabled ? gain * 0.45 * (1 + (attending ? bonus.prePeak ?? 0 : 0)) : 0)
        : age <= peakEnd ? gain * (1 + (attending ? bonus.peak ?? 0 : 0))
        : -loss * (1 - (attending ? bonus.postPeak ?? 0 : 0));
      state.aging.set(player.id, (state.aging.get(player.id) ?? 0) + rate / 365.25);
    }
  }

  function runDrills(state, assignments, health, day, players, staff) {
    for (const [id, attribute] of Object.entries(assignments)) {
      if (!attribute) continue;
      const condition = health.get(id);
      const player = players.get(id);
      if (condition.durability <= 50) {
        state.log.push({ day, id, attribute, reason: 'Recovery day' });
        continue;
      }
      if (condition.fatigue < 40) {
        state.log.push({ day, id, attribute, reason: 'Too fatigued' });
        continue;
      }
      const raw = rawValue(state, player, attribute);
      const before = clamp(raw);
      const gain = Math.min(drillGain + (staff?.trainingGain ?? 0), 99 - before);
      if (gain < 1e-9) continue;
      if (!state.drills.has(id)) state.drills.set(id, {});
      const trained = state.drills.get(id);
      trained[attribute] = (trained[attribute] ?? 0) + (before - raw) + gain;
      condition.fatigue -= fatigueCost - (staff?.trainingRecovery ?? 0);
      state.log.push({ day, id, attribute, gain });
    }
  }

  function affiliateGain(state, player, day, staff) {
    const amount = staff?.affiliateGain ?? 0;
    const trained = state.drills.get(player.id) ?? {};
    for (const key of attributes) {
      const before = rawValue(state, player, key);
      const gain = clamp(clamp(before) + amount) - before;
      trained[key] = (trained[key] ?? 0) + gain;
    }
    state.drills.set(player.id, trained);
    state.log.push({ day, id: player.id, attribute: 'Affiliate development', gain: amount, affiliate: true });
  }

  function affiliateBox(rating, random) {
    const count = (attempts, chance) => {
      let made = 0;
      for (let i = 0; i < attempts; i++) if (random() < chance) made++;
      return made;
    };
    const threeAttempts = Math.round((rating['3PT'] - 25) / 16 + random() * 3);
    const twoAttempts = Math.round(5 + rating.Inside / 12 + random() * 5);
    const freeAttempts = Math.floor(random() * 7);
    const threes = count(threeAttempts, 0.18 + rating['3PT'] / 340);
    const twos = count(twoAttempts, 0.25 + rating.Inside / 270);
    const freeThrows = count(freeAttempts, rating.FT / 100);
    return {
      MIN: 24 + Math.floor(random() * 13), PTS: 3 * threes + 2 * twos + freeThrows,
      FGM: twos + threes, FGA: twoAttempts + threeAttempts, '3PM': threes, '3PA': threeAttempts,
      FTM: freeThrows, FTA: freeAttempts, DNK: count(twos, rating.Inside / 450),
      OREB: count(6, rating['Offensive Rebound'] / 220), DREB: count(12, rating['Defensive Rebound'] / 170),
      AST: count(12, rating['Pass Acc'] / 180), STL: count(5, rating.Steal / 220),
      BLK: count(4, rating.Block / 240), TO: count(6, (110 - rating.Handles) / 140), PF: count(6, 0.38),
    };
  }

  function seasonChange(current, previous) {
    if ((current?.GP ?? 0) < 20 || (previous?.GP ?? 0) < 20) return 0;
    const total = (stats, key) => Math.round(stats.GP * stats[key]);
    const makes = total(current, '3PM') - total(previous, '3PM');
    const misses = total(current, '3PA') - total(previous, '3PA') - makes;
    return Math.max(-2, Math.min(2, (makes - misses) * 0.015));
  }

  function carryRatings(state, current, previous, players = league.players) {
    return Object.fromEntries([...players].map(player => {
      const carried = ratings(state, player);
      carried['3PT'] = clamp(carried['3PT'] + seasonChange(current.get(player.id), previous?.get(player.id)));
      const changed = Object.fromEntries(Object.entries(carried).filter(([key, value]) => Math.abs(value - player.attributes[key]) > 1e-9)
        .map(([key, value]) => [key, Math.round(value * 1e6) / 1e6]));
      return [player.id, changed];
    }).filter(([, changed]) => Object.keys(changed).length));
  }

  return { attributes, profiles, curve, override, affiliateGain, affiliateBox, drillGain, fatigueCost, ageAt, create, ratings, agePlayers, runDrills, carryRatings };
})();
