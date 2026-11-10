const worldRelationships = (() => {
  const pair = (a, b) => a < b ? a + '/' + b : b + '/' + a;
  const gameCache = new WeakMap();
  const agentCache = new WeakMap();
  const clubs = new Map(league.teams.map(team => [team.code, team]));
  function observations(state) {
    if (gameCache.has(state)) return gameCache.get(state);
    const teammates = new Map();
    const matchups = new Map();
    const opponents = new Map();
    for (const game of state.results) {
      const matchup = pair(game.home, game.away);
      matchups.set(matchup, (matchups.get(matchup) ?? 0) + 1);
      for (const home of game.homeBox) for (const away of game.awayBox) {
        const key = pair(home.id, away.id);
        opponents.set(key, (opponents.get(key) ?? 0) + 1);
      }
      for (const box of [game.homeBox, game.awayBox]) {
        for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) {
          const key = pair(box[i].id, box[j].id);
          teammates.set(key, (teammates.get(key) ?? 0) + 1);
        }
      }
    }
    const data = { teammates, matchups, opponents };
    gameCache.set(state, data);
    return data;
  }
  const familiarity = (save, state, a, b) => Math.min(100,
    (save.teammateCarry?.[pair(a, b)] ?? 0) + (observations(state).teammates.get(pair(a, b)) ?? 0));
  function strongest(save, state, id, filter = () => true) {
    return [...state.profiles.values()].filter(player => player.id !== id && !state.unavailable.has(player.id) && filter(player))
      .map(player => ({ player, familiarity: familiarity(save, state, id, player.id) }))
      .filter(entry => entry.familiarity >= 8).sort((a, b) => b.familiarity - a.familiarity || a.player.id.localeCompare(b.player.id));
  }
  function carry(save, state) {
    const prior = Object.entries(save.teammateCarry ?? {}).map(([key, value]) => [key, Math.floor(value * 0.7)]);
    const pairs = new Map(prior);
    for (const [key, games] of observations(state).teammates) pairs.set(key, Math.min(100, (pairs.get(key) ?? 0) + games));
    const counts = new Map();
    const retained = {};
    for (const [key, value] of [...pairs].sort((a, b) => b[1] - a[1])) {
      if (value < 8) break;
      const [a, b] = key.split('/');
      if ((counts.get(a) ?? 0) >= 8 || (counts.get(b) ?? 0) >= 8) continue;
      retained[key] = value;
      counts.set(a, (counts.get(a) ?? 0) + 1);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    return retained;
  }
  function agentReputation(save, id, code) {
    const representative = relationships.agent(id);
    let reputation = agentCache.get(save);
    if (!reputation) {
      reputation = new Map();
      for (const season of [...(save.pastSeasons ?? []).slice(-2), save]) for (const action of season.financeActions) {
        if (action.type !== 'signing' && action.type !== 'contract') continue;
        const team = action.team ?? season.team;
        const key = team + '/' + relationships.agent(action.id).id;
        reputation.set(key, (reputation.get(key) ?? 0) + (season === save ? 3 : 1));
      }
      agentCache.set(save, reputation);
    }
    const transactions = Math.min(20, reputation.get(code + '/' + representative.id) ?? 0);
    const direct = code === save.team ? relationships.score(save, representative.id, 35) - 35 : 0;
    return Math.max(0, Math.min(100, 35 + direct + transactions));
  }
  function offerFit(save, state, id, code) {
    const roster = state.rosters.get(code);
    const top = roster.filter(player => player.id !== id).map(player => familiarity(save, state, id, player.id))
      .sort((a, b) => b - a).slice(0, 3);
    return top.reduce((sum, value) => sum + value, 0) / 2500 + (agentReputation(save, id, code) - 35) / 1250;
  }
  function reporterSource(save, state, market, club) {
    if (market === club) return 55;
    const sameConference = clubs.get(market)?.conference === clubs.get(club)?.conference;
    const meetings = observations(state).matchups.get(pair(market, club)) ?? 0;
    const priorMeetings = save.reporterCarry?.[pair(market, club)] ?? 0;
    const local = relationships.score(save, 'reporter-' + market, market === save.team ? 42 : 18);
    const introduction = club === save.team ? relationships.score(save, 'reporter-' + club, 42) : 42;
    return Math.min(100, (sameConference ? 23 : 12) + meetings * 5 + priorMeetings * 2
      + Math.floor(Math.max(0, local - 42) / 2) + Math.floor(Math.max(0, introduction - 55) / 3));
  }
  const carryReporters = state => Object.fromEntries(observations(state).matchups);
  const siblingsSource = 'https://www.nba.com/news/nba-players-brothers-2025-national-siblings-day';
  const siblings = [
    ['Lonzo Ball', 'LaMelo Ball'], ['Max Christie', 'Cam Christie'],
    ['Julian Champagnie', 'Justin Champagnie'], ['Stephen Curry', 'Seth Curry'],
    ['Jrue Holiday', 'Aaron Holiday', 'Justin Holiday'], ['Tyus Jones', 'Tre Jones'],
    ['Caleb Martin', 'Cody Martin'], ['Emanuel Miller', 'Leonard Miller'],
    ['Keegan Murray', 'Kris Murray'], ['Amen Thompson', 'Ausar Thompson'],
    ['Franz Wagner', 'Moritz Wagner'],
  ];
  const importedNames = new Map(league.players.map(player => [player.id, player.name]));
  function family(from, to) {
    const a = importedNames.get(from.id), b = importedNames.get(to.id);
    if (!a || !b || a === b) return null;
    if ([a, b].includes('LeBron James') && [a, b].includes('Bronny James')) {
      return { detail: a === 'LeBron James' ? 'Son' : 'Father', source: 'https://www.nba.com/news/lebron-bronny-father-son-assist' };
    }
    if (siblings.some(group => group.includes(a) && group.includes(b))) return { detail: 'Brother', source: siblingsSource };
    const antetokounmpos = ['Giannis', 'Thanasis', 'Kostas', 'Alex'].map(name => name + ' Antetokounmpo');
    if (antetokounmpos.includes(a) && antetokounmpos.includes(b)) {
      return { detail: 'Brother', source: 'https://www.nba.com/news/giannis-antetokounmpo-soccer-joins-nashville-sc-ownership' };
    }
    if ([a, b].includes('Dylan Harper') && [a, b].includes('Ron Harper Jr.')) {
      return { detail: 'Brother', source: 'https://www.nba.com/news/celtics-sign-ron-harper-jr-to-extension' };
    }
    return null;
  }

  function entities(save, state) {
    const items = new Map();
    const add = (kind, id, name, code, href) => items.set(kind + ':' + id, { kind, id, name, code, href });
    for (const team of league.teams) {
      add('Team', team.code, team.name, team.code, '#team/' + team.code);
      add('GM', team.code, team.code === save.team ? 'Your GM' : team.code + ' GM', team.code);
      Object.values(staffSim.assignments(save, team.code, staffSim.roles)).forEach((person, index) =>
        add('Staff', person.id, person.name, team.code, '#staff-career/' + team.code + '/' + index));
    }
    for (const player of state.profiles.values()) {
      if (state.unavailable.has(player.id)) continue;
      add('Player', player.id, player.name, state.owners.get(player.id), '#player/' + player.id);
      const agent = relationships.agent(player.id);
      if (nbaAgents[player.id]) add('Agent', agent.id, agent.name, undefined, '#contact/' + player.id);
    }
    for (const fan of relationships.fans) add('Fan', fan.id, fan.name, fan.code);
    for (const reporter of relationships.reporters) add('Reporter', reporter.id, reporter.name, reporter.code);
    for (const org of relationships.organizations(save, state)) add('Organization', org.id, org.name, org.team, '#organizations/' + org.id);
    return items;
  }

  const gmTrust = (save, code) => save.gmTrust?.[code] ?? 50;

  function connection(save, state, from, to) {
    const fromPlayer = from.kind === 'Player' ? state.profiles.get(from.id) : null;
    const toPlayer = to.kind === 'Player' ? state.profiles.get(to.id) : null;
    const verified = fromPlayer && toPlayer && family(fromPlayer, toPlayer);
    if (verified) return { ...verified, score: 100 };
    const gmPair = from.kind === 'GM' ? [from, to] : to.kind === 'GM' ? [to, from] : [];
    const [gm, contact] = gmPair;
    if (gm?.code === save.team) {
      if (contact.kind === 'GM') return { detail: 'Front office trust', score: gmTrust(save, contact.code) };
      if (contact.kind === 'Player') return { detail: 'Player trust', score: relationships.playerScore(save, state, contact.id) };
      const baseline = { Agent: 35, Staff: contact.code === save.team ? 48 : 18, Fan: contact.code === save.team ? 40 : 20,
        Reporter: contact.code === save.team ? 42 : 18, Organization: 25 }[contact.kind];
      if (baseline !== undefined) return { detail: 'Franchise trust', score: relationships.score(save, contact.id, baseline) };
    }
    if (fromPlayer && toPlayer) {
      const games = familiarity(save, state, from.id, to.id);
      if (games || from.code && from.code === to.code) {
        return { detail: 'Teammate familiarity', score: Math.min(100, games + (from.code && from.code === to.code ? 20 : 0)) };
      }
      const meetings = observations(state).opponents.get(pair(from.id, to.id)) ?? 0;
      if (meetings) return { detail: 'On-court familiarity', score: Math.min(50, 5 + meetings * 4) };
    }
    if (from.kind === 'GM' && to.kind === 'GM') {
      const deals = (save.financeActions ?? []).filter(action => action.type === 'trade'
        && pair(action.team ?? save.team, action.otherTeam) === pair(from.code, to.code)).length;
      return { detail: 'Front office trust', score: Math.min(100, 50 + deals * 4) };
    }
    if (from.kind === 'Reporter' && to.code) return { detail: 'Media familiarity', score: reporterSource(save, state, from.code, to.code) };
    const player = fromPlayer ?? toPlayer;
    const other = fromPlayer ? to : from;
    if (player && other.kind === 'Agent' && relationships.agent(player.id).id === other.id) {
      return { detail: 'Representation', score: 75, source: nbaAgents[player.id]?.source };
    }
    if (other.kind === 'Reporter' && player && player.id === from.id && from.code) {
      return { detail: 'Media familiarity', score: reporterSource(save, state, other.code, from.code) };
    }
    if (player && other.code && ['Fan', 'Staff'].includes(other.kind)) {
      const games = state.results.filter(game => {
        const box = game.home === other.code ? game.homeBox : game.away === other.code ? game.awayBox : [];
        return box.some(line => line.id === player.id);
      }).length;
      if (games) return { detail: other.kind === 'Staff' ? 'Worked together' : 'Local fan familiarity',
        score: Math.min(85, 35 + games) };
    }
    return from.code && from.code === to.code
      ? { detail: 'Shared team or market', score: 35 }
      : { detail: 'Name recognition', score: 5 };
  }
  return { gmTrust, familiarity, strongest, carry, agentReputation, offerFit, reporterSource, carryReporters, family, entities, connection };
})();
