import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

// Isolated browser storage keeps the audit away from a player's franchise.
function runtime() {
  const storage = new Map();
  const context = vm.createContext({
    console, structuredClone, setTimeout, clearTimeout, crypto, AbortSignal,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
      get length() { return storage.size; }, key: index => [...storage.keys()][index] },
  });
  const files = [...fs.readFileSync(new URL('index.html', import.meta.url), 'utf8')
    .matchAll(/<script src="([^"?]+)(?:\?[^"]*)?" defer/g)].map(match => match[1]);
  for (const file of files.filter(file => (!file.includes('ui') || file === 'career-ui.js') && file !== 'app.js' && (!file.startsWith('nba-') || ['nba-honors-data.js', 'nba-profile-data.js', 'nba-career-data.js', 'nba-game-log-index.js'].includes(file))
    && file !== 'nba2k-reference-data.js' && file !== 'staff-honors-data.js')) {
    vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), context, { filename: file });
  }
  const api = vm.runInContext('({ seasonSim, teamFinance, freeAgency, relationships, arenaOps, staffSim, playerDevelopment, postseason, draftOps, tradeValues, league, worldRelationships, gmCareer, liveNBA, nbaAwards, awardOverrideEntries })', context);
  api.exerciseDraftScoutingScreens = save => {
    const source = fs.readFileSync(new URL('franchise-ui.js', import.meta.url), 'utf8');
    context.scoutingScreenSave = save;
    vm.runInContext(`(() => {
      const teams = new Map(league.teams.map(team => [team.code, team]));
      const e = String;
      function renderScouting(title, description, body) { scoutingMarkup.push(title + ' ' + body); }
      ${source}
      operationsPage = renderScouting;
      for (const view of ['reports', 'big', 'mock', 'needs']) draftScoutingScreen(scoutingScreenSave, view);
    })()`, Object.assign(context, { scoutingMarkup: [] }));
    for (const [index, label] of ['Scouted OVR', 'Big board', 'Projected player', 'Roster depth'].entries()) {
      assert.ok(context.scoutingMarkup[index].includes(label));
    }
    assert.doesNotMatch(context.scoutingMarkup[1], /Scouted OVR|Modeled OVR/);
  };
  api.exerciseFanAndPressScreens = save => {
    const source = fs.readFileSync(new URL('franchise-ui.js', import.meta.url), 'utf8');
    const view = source.slice(source.indexOf('function chatThread('), source.indexOf('function playerScouting('));
    context.fanScreenSave = save;
    const markup = vm.runInContext(`(() => {
      const teams = new Map(league.teams.map(team => [team.code, team]));
      const e = String, money = String;
      const document = { querySelectorAll: () => [] };
      const pages = [];
      const operationsPage = (title, description, body) => pages.push(title + body);
      ${view}
      const fan = relationships.fans.find(item => item.code === fanScreenSave.team && item.name === 'Away');
      fanConversation(fanScreenSave, fan.id);
      relationshipTalk(fanScreenSave, 'reporter-' + fanScreenSave.team);
      return pages;
    })()`, context);
    assert.match(markup[0], /Away fans.*75000/s);
    assert.match(markup[1], /Give a team update/);
  };
  api.exerciseStaffScreens = save => {
    const app = fs.readFileSync(new URL('app.js', import.meta.url), 'utf8');
    const view = app.slice(app.indexOf('const staffDepartments ='), app.indexOf('function facilities()'));
    context.staffScreenSave = save;
    vm.runInContext(`(() => {
      const e = String, money = String;
      const castTable = (headers, rows) => headers.join(' ') + rows.flat().join(' ');
      const document = { querySelector: () => ({}) };
      ${view}
      operationsPage = (title, description, body) => staffMarkup.push(title + body);
      for (const index of staffSim.roles.keys()) staffWorkspace(staffScreenSave, index);
      assignStaffScreen(staffScreenSave, 11, staffSim.pool(staffScreenSave, staffSim.roles)[0].id);
    })()`, Object.assign(context, { staffMarkup: [] }));
    assert.equal(context.staffMarkup.length, 13);
    assert.match(context.staffMarkup[11], /Find and offer an extension/);
    assert.match(context.staffMarkup[12], /Submit staff contract/);
  };
  api.exerciseAwardScreens = save => {
    const nodes = new Map();
    context.document = { querySelectorAll: () => [], querySelector(id) {
      if (id === '#award-restore') return null;
      if (!nodes.has(id)) nodes.set(id, { value: id === '#award-slot' ? '0' : '', querySelectorAll: () => [], addEventListener() {} });
      return nodes.get(id);
    } };
    context.awardScreenSave = save;
    const source = fs.readFileSync(new URL('franchise-ui.js', import.meta.url), 'utf8');
    const screen = source.slice(source.indexOf('function franchiseAwardCenter('));
    vm.runInContext(`(() => {
      const teams = new Map(league.teams.map(team => [team.code, team]));
      const e = String, simDate = seasonSim.date, seasonLabel = String;
      const castTable = (headers, rows) => rows.flat().join(' ');
      const operationsPage = (title, description, body) => { awardMarkup = title + body; };
      ${screen}
      franchiseAwardCenter(awardScreenSave, 'race');
      awardRaceMarkup = awardMarkup;
      franchiseAwardCenter(awardScreenSave, 'override');
    })()`, Object.assign(context, { awardMarkup: '', awardRaceMarkup: '' }));
    assert.match(context.awardRaceMarkup, /Award Race.*Finals MVP/s);
    assert.match(context.awardMarkup, /Award Overrides.*Slam Dunk Contest/s);
    assert.match(nodes.get('#award-current').innerHTML, /Current recipient/);
    assert.match(nodes.get('#award-candidates').innerHTML, /data-award-candidate/);
  };
  api.exerciseCareerScreens = () => {
    const nodes = new Map();
    const node = key => {
      if (!nodes.has(key)) nodes.set(key, { innerHTML: '', addEventListener() {},
        insertAdjacentHTML(_, markup) { this.innerHTML = markup + this.innerHTML; } });
      return nodes.get(key);
    };
    context.document = { querySelector: node, querySelectorAll: () => [] };
    context.location = { hash: '' };
    context.window = { addEventListener() {}, scrollTo() {} };
    for (const file of ['franchise-ui.js', 'app.js']) {
      vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), context, { filename: file });
    }
    const go = hash => {
      context.location.hash = hash;
      vm.runInContext('render()', context);
      return node('#app').innerHTML;
    };
    assert.match(node('#app').innerHTML, /NBA Main Menu/);
    assert.match(go('#franchise'), /Continue game/);
    assert.match(go('#franchise/new'), /Preferred team/);
    assert.match(go('#franchise/load'), /Second GM/);
    node('#career-continue').onclick();
    assert.match(go(context.location.hash), /FRANCHISE MODE/);
    assert.match(node('.top nav').innerHTML, /Quit to main menu/);
    assert.match(go('#front-office-inbox'), /Ownership season goals/);
    assert.match(node('#app').innerHTML, /100% guaranteed/);
    const ownerSave = api.seasonSim.load();
    api.seasonSim.answerOwnerGoal(ownerSave, 'wins', 0);
    assert.match(go('#front-office-inbox'), /\+8 trust/);
    api.seasonSim.answerOwnerGoal(api.seasonSim.load(), 'budget', 2);
    assert.match(go('#front-office-inbox'), /I cannot make that promise · \+0 trust/);
    const current = api.seasonSim.load();
    const slot = api.seasonSim.saveSlots().find(entry => entry.team === current.team && entry.day === current.day);
    storage.set(slot.key, JSON.stringify({ ...current, market: { ...current.market, open: false } }));
    assert.match(go('#transactions'), /Propose trade/);
    assert.match(node('#app').innerHTML, /Free agents/);
    const active = api.seasonSim.load();
    const roster = api.seasonSim.history(active).rosters.get(active.team);
    assert.match(go('#relationship-talk/' + roster[0].id), /dialogue-thread.*What can I do for you/s);
    for (const count of [5, 8, 10]) {
      let plan;
      try { plan = api.seasonSim.rebuildRotation(active, count); }
      catch (error) {
        assert.match(error.message, /fewer available players|cannot cover 240 minutes/);
        continue;
      }
      assert.equal(Object.values(plan.minutes).filter(minutes => minutes > 0).length, count);
      assert.equal(Object.values(plan.minutes).reduce((sum, minutes) => sum + minutes, 0), 240);
    }

    assert.match(go('#quit-franchise'), /NBA Main Menu/);
    assert.equal(api.seasonSim.load(), null);
  };
  api.setFetch = fetch => { context.fetch = fetch; };
  api.fresh = (team = 'PHI', seed = 1024) => {
    storage.clear();
    api.seasonSim.start(team);
    const save = api.seasonSim.load();
    save.seed = seed;
    save.staffSeed = seed;
    api.put(save);
    return api.seasonSim.load();
  };
  api.exerciseAllStar = () => {
    const save = { ...api.fresh(), allStarFormat: 1 };
    const day = api.seasonSim.allStarDayFor(save) - 1;
    assert.equal(api.seasonSim.date(day), '2027-02-20');
    assert.equal(api.seasonSim.date(api.seasonSim.allStarDayFor({ ...save, scheduleVersion: 3 })), '2027-02-19');
    assert.equal(api.seasonSim.history({ ...save, day: day - 2 }).risingStars, undefined);
    assert.equal(api.seasonSim.history({ ...save, day: day - 1 }).allStarSaturday, undefined);
    const state = api.seasonSim.history({ ...save, day });
    const { threePoint, dunk } = state.allStarSaturday;
    assert.deepEqual([threePoint.opening.length, threePoint.final.length, dunk.opening.length, dunk.final.length], [8, 3, 4, 2]);
    assert.ok(threePoint.opening.every(row => row.attempts.length === 27 && row.score <= 40));
    assert.ok(dunk.opening.every(row => row.attempts.length === 2 && row.score >= 80 && row.score <= 100));
    const sunday = api.seasonSim.history({ ...save, day: day + 1 });
    assert.deepEqual(sunday.allStarSaturday, state.allStarSaturday);
    assert.equal(sunday.selections.allStar.length, 24);
    assert.equal(sunday.allStarGame.games.length, 4);
    assert.equal(sunday.risingStars.games.length, 3);
    assert.ok(sunday.risingStars.games.every((game, i) => Math.max(...game.scores) >= (i === 2 ? 25 : 40)));
    assert.equal(state.allStarSaturday.shootingStars.opening.length, 4);
    assert.equal(state.allStarSaturday.shootingStars.final.length, 2);
    for (const event of [sunday.risingStars, sunday.allStarGame]) {
      assert.ok(event.mvp.id);
      assert.ok(event.teams.find(team => team.name === event.champion).roster.some(player => player.id === event.mvp.id));
      for (const game of event.games) assert.deepEqual(game.boxes.map(box => box.reduce((sum, line) => sum + line.points, 0)), game.scores);
    }
    context.allStarTestState = { ...sunday, save };
    const source = fs.readFileSync(new URL('franchise-ui.js', import.meta.url), 'utf8');
    const screen = source.slice(source.indexOf('function allStarWeekend('), source.indexOf('function franchiseCalendar('));
    const markup = vm.runInContext(`(() => {
      const teams = new Map(league.teams.map(team => [team.code, team]));
      const e = String, simDate = seasonSim.date, seasonLabel = String;
      let markup;
      const allStarDraftMarkup = () => '';
      const bindAllStarActions = () => {};
      const operationsPage = (title, description, body) => { markup = body; };
      ${screen}
      allStarWeekend(allStarTestState);
      return markup;
    })()`, context);
    assert.ok(markup.includes(threePoint.winner.name) && markup.includes(dunk.winner.name));
    assert.ok(markup.includes('Historical NBA contest winners'));
    assert.ok(markup.includes(sunday.allStarGame.mvp.name) && markup.includes(sunday.risingStars.mvp.name));
    assert.ok(markup.includes(state.allStarSaturday.shootingStars.winner.name));
    const awardScreen = source.slice(source.indexOf('function leagueAwardHistory('), source.indexOf('function clinicUpgrades('));
    const historyMarkup = vm.runInContext(`(() => {
      const teams = new Map(league.teams.map(team => [team.code, team]));
      const e = value => String(value ?? ''), seasonLabel = String;
      const castTable = (headers, rows) => rows.flat().join(' ');
      const periodAwardLink = () => '#league-news/awards';
      ${awardScreen}
      return leagueAwardHistory(allStarTestState.save, allStarTestState, true);
    })()`, context);
    assert.ok(historyMarkup.includes(sunday.allStarGame.mvp.name));
    assert.ok(historyMarkup.includes('Shooting Stars champion') && historyMarkup.includes('#all-star/0'));
    const honors = vm.runInContext('careerHonors(allStarTestState, allStarTestState.allStarGame.mvp.id)', context);
    assert.ok(honors.includes('All-Star Game MVP'));
    const bonus = api.teamFinance.clubAchievements(sunday, sunday.allStarGame.mvp.team)
      .find(item => item.label.startsWith('All-Star Game MVP ·'));
    assert.equal(bonus.amount, 250000);
    assert.equal(bonus.day, day + 1);
    assert.equal(sunday.results.filter(game => game.day >= day - 1 && game.day <= day + 1).length, 0);
    const replay = api.seasonSim.history(JSON.parse(JSON.stringify({ ...save, day: day + 2 })));
    assert.deepEqual(replay.allStarGame, sunday.allStarGame);
  };
  api.exerciseHandoff = save => {
    const nodes = new Map();
    context.document = { getElementById: id => {
      if (!nodes.has(id)) nodes.set(id, { value: '', hidden: id === 'handoff-editor', querySelector: () => null, closest: () => null });
      return nodes.get(id);
    } };
    context.location = { hash: '#season-handoff' };
    context.window = { confirm: () => true };
    context.testHandoffSave = save;
    const source = fs.readFileSync(new URL('app.js', import.meta.url), 'utf8');
    const screen = source.slice(source.indexOf('function seasonHandoff('), source.indexOf('function render()'));
    vm.runInContext("const teams = new Map(league.teams.map(team => [team.code, team])); const e = String; let handoffMarkup; function operationsPage(title, desc, content) { handoffMarkup = content; } " +
      screen + " seasonHandoff(testHandoffSave);", context);
    assert.match(nodes.get('handoff-ratings').innerHTML, /#player\//);
    nodes.get('handoff-team').value = '';
    nodes.get('handoff-team').onchange();
    assert.match(nodes.get('handoff-ratings').innerHTML, /<details>/);
    nodes.get('handoff-edit').onclick();
    assert.match(nodes.get('handoff-class').innerHTML, /Rating for prospect 1/);
    nodes.get('handoff-reset').onclick();
    nodes.get('handoff-source').value = '1978';
    nodes.get('handoff-source').onchange();
    nodes.get('handoff-edit').onclick();
    assert.match(nodes.get('handoff-class').innerHTML, /Mychal Thompson/);
    nodes.get('handoff-source').onchange();
    nodes.get('handoff-host').value = 'PHX';
    nodes.get('handoff-finish').onclick();
    assert.equal(context.location.hash, '#calendar');
    assert.equal(api.draftOps.prospects(api.seasonSim.load())[0].name, 'Mychal Thompson');
  };
  api.exerciseOfferEditor = player => {
    const source = fs.readFileSync(new URL('app.js', import.meta.url), 'utf8');
    const screen = source.slice(source.indexOf('function offerEditor('), source.indexOf('function freeAgentMarket('));
    context.offerTestPlayer = player;
    const markup = vm.runInContext("(function () { const e = String, money = String; const contractFields = () => '<input name=\"salary\">'; " +
      screen + " return offerEditor('contract-form', offerTestPlayer, {}, null, 0, 10000000, true, [{ kind: 'teammate', label: 'Sign teammate' }], '2026-11-08'); })()", context);
    assert.match(markup, /Contract extension/);
    assert.match(markup, /type="date".*min="2026-11-09"/);
    assert.match(markup, /data-offer-request="teammate"/);
  };
  api.put = save => storage.set(api.seasonSim.storageKey, JSON.stringify(save));
  api.state = () => api.seasonSim.history(api.seasonSim.load());
  return api;
}

const deal = overrides => ({
  salary: 40_000_000, years: 5, raise: 0, guaranteed: 100, upfront: 25,
  bonus: 0, incentive: 0, option: 'None', noTrade: false, kicker: 0, perks: [], ...overrides,
});

function runTo(api, end) {
  for (let attempts = 0; attempts < 500; attempts++) {
    const save = api.seasonSim.load();
    const state = api.seasonSim.history(save);
    if (save.day >= end || state.bracket?.champion) return state;
    if (save.rotationAlert) {
      api.rotationPauses = (api.rotationPauses ?? 0) + 1;
      if (save.rotationAlert.shortHanded) api.seasonSim.acknowledgeForfeit(save);
      else {
        const repaired = api.seasonSim.repairRotation(save);
        api.seasonSim.setPlan(save, repaired.minutes, repaired.order);
      }
    } else if (state.allStarVotePending) {
      api.seasonSim.allStarAction(save, 'vote', { East: state.allStarVotes.East[0].id, West: state.allStarVotes.West[0].id });
    } else if (state.allStarDraft?.pending) {
      api.seasonSim.allStarAction(save, 'delegate');
    } else api.seasonSim.advanceTo(save, end);
  }
  throw new Error('Simulation failed to reach its destination.');
}

function contracts() {
  const api = runtime();
  const { seasonSim: sim, teamFinance: finance, relationships: relations } = api;
  let save = api.fresh();
  let state = api.state();
  const id = state.rosters.get(save.team)[0].id;
  sim.saveFinanceAction(save, { type: 'contract', id, deal: deal() });
  save = sim.load();
  let ledger = finance.report(save, api.state());
  assert.equal(ledger.contracts.get(id).pay.upfront, 10_000_000);
  assert.equal(ledger.contracts.get(id).pay.rollover, 30_000_000);
  assert.equal(ledger.contracts.get(id).pay.salary, 40_000_000);
  const terms = finance.nextSeason(save, api.state(), new Set());
  const next = { ...save, ...terms, day: 0, financeActions: [], mediaDistribution: true };
  const nextLedger = finance.report(next, sim.history(next));
  assert.equal(nextLedger.contracts.get(id).deal.years, 4);
  assert.equal(nextLedger.contracts.get(id).pay.upfront, 10_000_000);
  assert.equal(nextLedger.contracts.get(id).pay.rollover, 30_000_000);
  assert.throws(() => finance.validateDeal(deal({ guaranteed: 50 })), /requirement/);
  assert.throws(() => finance.validateDeal(deal({ years: 1, option: 'Team option' })), /final-year/);
  sim.conversation(save, { type: 'talk', id, channel: 'agent' });
  save = sim.load();
  const demand = relations.read(save).contacts[id].demands.find(item => item.kind === 'upfront');
  assert.throws(() => sim.conversation(save, { type: 'promise', id, kind: demand.kind }), /verbal/);
  sim.conversation(save, { type: 'verbal', id, kind: demand.kind });
  sim.conversation(sim.load(), { type: 'promise', id, kind: demand.kind });
  const promised = sim.load();
  const oldScore = relations.playerScore(promised, api.state(), id);
  const number = ['00', ...Array.from({ length: 100 }, (_, index) => String(index))]
    .find(value => relations.jerseyOpen(promised, api.state(), id, value));
  sim.saveFinanceAction(promised, { type: 'contract', id, deal: deal({ upfront: demand.value, jersey: number }) });
  save = sim.load();
  assert.equal(relations.jersey(save, id), number);
  assert.equal(relations.read(save).promises.at(-1).status, 'kept');
  assert.ok(relations.playerScore(save, api.state(), id) >= oldScore);
  state = api.state();
  for (const player of state.profiles.values()) {
    const demands = relations.commitment(save, state, player).requests;
    for (const request of demands) {
      const path = relations.fulfillment(save, state, player.id, request);
      assert.ok(path.ready || path.blocked || path.links?.every(link => link[1].startsWith('#')));
    }
  }
  const before = JSON.stringify(finance.report(save, state));
  assert.equal(JSON.stringify(finance.report(save, sim.history(save))), before);
  const pending = state.profiles.values().find(player => !state.owners.has(player.id));
  sim.conversation(save, { type: 'talk', id: pending.id, channel: 'agent' });
  sim.conversation(sim.load(), { type: 'verbal', id: pending.id, kind: 'upfront' });
  sim.conversation(sim.load(), { type: 'promise', id: pending.id, kind: 'upfront' });
  const waiting = sim.load();
  const expired = relations.settle({ ...waiting, day: waiting.day + 8 }, state, waiting);
  assert.equal(relations.read(expired).promises.at(-1).status, 'broken');
  const settled = relations.settle(expired, state, expired);
  assert.equal(relations.playerScore(settled, state, pending.id), relations.playerScore(expired, state, pending.id));
  const legacy = api.fresh();
  legacy.day = 12;
  delete legacy.staffPayrollStart;
  delete legacy.cpuLogicStart;
  const priorBank = finance.report(legacy, sim.history(legacy)).bank;
  api.put(legacy);
  const migrated = sim.load();
  assert.equal(migrated.staffPayrollStart, 12);
  assert.equal(finance.report(migrated, sim.history(migrated)).bank, priorBank);
  for (const [kind, value] of [
    ...Object.keys(relations.services).map(value => ['perk', value]),
    ['perk', 'Team Panel Ad'], ['perk', 'Solo Panel Ad'],
    ['endorsement', 'Local retail'], ['endorsement', 'Nike'], ['familyJob', 'Community outreach assistant'], ['jersey', '99'],
  ]) {
    const fixture = api.fresh();
    const player = api.state().activeRoster[0];
    const requested = kind === 'jersey' ? Array.from({ length: 100 }, (_, index) => String(index))
      .find(number => relations.jerseyOpen(fixture, api.state(), player.id, number)) : value;
    fixture.relationships = { contacts: { [player.id]: { score: 43,
      demands: [{ kind, value: requested, label: String(requested) }] } }, promises: [], jerseys: {}, log: [] };
    api.put(fixture);
    sim.conversation(sim.load(), { type: 'verbal', id: player.id, kind });
    sim.conversation(sim.load(), { type: 'promise', id: player.id, kind });
    if (kind === 'jersey') sim.conversation(sim.load(), { type: 'jersey', id: player.id, number: requested });
    else if (kind === 'perk' && Object.hasOwn(relations.services, value)) {
      sim.saveFinanceAction(sim.load(), { type: 'contract', id: player.id, deal: deal({ perks: [value] }) });
      assert.equal(relations.read(sim.load()).promises.at(-1).status, 'pending');
      sim.saveFinanceAction(sim.load(), { type: 'facility', facility: 'support', command: 'service', index: player.id, value });
    } else if (kind === 'perk') sim.saveFinanceAction(sim.load(), { type: 'facility', facility: 'ads',
      command: 'campaign', index: value === 'Team Panel Ad' ? 'team' : 'solo', value: { players: [player.id] } });
    else sim.saveFinanceAction(sim.load(), { type: 'facility', facility: 'support',
      command: kind === 'endorsement' && value === 'Nike' ? 'brand' : kind, index: player.id, value });
    assert.equal(relations.read(sim.load()).promises.at(-1).status, 'kept', kind + ' ' + value);
  }
  save = api.fresh();
  state = api.state();
  const outgoing = state.activeRoster[0].id;
  sim.saveFinanceAction(save, { type: 'contract', id: outgoing,
    deal: deal({ guaranteed: 50, kicker: 10, requirement: { kind: 'games', target: 0 } }) });
  save = sim.load();
  state = api.state();
  finance.validateDeal(deal({ raise: -1_000_000 }));
  assert.throws(() => finance.validateDeal(deal({ raise: -10_000_000 })), /salary/);
  const market = api.tradeValues.market(save, state, code => finance.report(save, state, code).contracts);
  const incoming = state.rosters.get('ATL').find(player => !finance.report(save, state, 'ATL').contracts.get(player.id)?.deal.noTrade
    && market.accepts([outgoing], [player.id], 'ATL', true, 250000));
  sim.saveFinanceAction(save, { type: 'trade', id: outgoing, otherTeam: 'ATL', incoming: incoming.id, cash: 250000 });
  const moved = sim.load();
  const movedState = api.state();
  assert.equal(finance.report(moved, movedState).contracts.has(outgoing), false);
  assert.equal(finance.report(moved, movedState, 'ATL').contracts.get(outgoing).pay.rollover, 15_000_000);
  assert.equal(finance.report(moved, movedState, 'ATL').contracts.get(outgoing).pay.conditional, 20_000_000);
  assert.equal(-finance.report(moved, movedState).entries.find(entry => entry.description.endsWith('trade kicker')).amount, 3_500_000);
  const extension = deal({ salary: 20_000_000, years: 3, raise: -1_000_000 });
  const extended = finance.nextSeason({ ...moved, extensions: { [outgoing]: extension } }, movedState, new Set());
  assert.equal(extended.openingContracts[outgoing].deal, extension);
  assert.equal(extended.optionResults.some(result => result.id === outgoing), false);
  assert.equal(api.draftOps.libraryYears.length, 53);
  assert.equal(api.draftOps.defaultClassYear(2031), 1978);
  assert.equal(api.draftOps.defaultClassYear(2032), 1979);
  assert.equal(api.draftOps.defaultClassYear(2079), 2026);
  for (const sourceYear of api.draftOps.libraryYears) {
    const board = api.draftOps.prospects(moved, sourceYear);
    assert.ok(board.some(prospect => prospect.classYear === sourceYear));
    assert.equal(new Set(board.map(prospect => prospect.id)).size, board.length);
    api.draftOps.validateClass(moved, { year: api.draftOps.draftYear(moved),
      players: board.map(prospect => ({ ...prospect, age: Math.floor(Number(prospect.age)) })) });
  }
  const fictional = api.draftOps.prospects({ ...moved, year: 1 }, 0);
  assert.equal(new Set(fictional.map(prospect => prospect.name)).size, fictional.length);
  assert.ok(new Set(fictional.map(prospect => prospect.name.split(' ').at(-1))).size > 50);

  const beforeCut = finance.report(moved, movedState);
  assert.equal(beforeCut.entries.find(entry => entry.description === 'Trade cash consideration').amount, -250000);
  assert.equal(finance.report(moved, movedState, 'ATL').entries.find(entry => entry.description === 'Trade cash consideration').amount, 250000);
  sim.saveFinanceAction(moved, { type: 'cut', id: incoming.id });
  const settlement = Math.round(beforeCut.contracts.get(incoming.id).pay.rollover / 2);
  assert.equal(beforeCut.bank - finance.report(sim.load(), api.state()).bank, settlement);
  assert.equal(api.state().owners.has(incoming.id), false);
  assert.equal(finance.report(sim.load(), api.state()).contracts.has(incoming.id), false);
  save = api.fresh('BOS');
  state = api.state();
  const recipient = state.activeRoster[0];
  const teammate = [...state.profiles.values()].find(player => !state.owners.has(player.id));
  save.relationships = { contacts: { [recipient.id]: { score: 43, demands: [
    { kind: 'teammate', value: teammate.id, label: 'Sign ' + teammate.name },
  ] } }, promises: [], jerseys: {}, log: [] };
  api.put(save);
  sim.conversation(sim.load(), { type: 'verbal', id: recipient.id, kind: 'teammate' });
  sim.conversation(sim.load(), { type: 'promise', id: recipient.id, kind: 'teammate' });
  sim.saveFinanceAction(sim.load(), { type: 'signing', inSeason: true, id: teammate.id, deal: deal({ years: 1 }) });
  assert.equal(relations.read(sim.load()).promises.at(-1).status, 'kept');
  save = api.fresh('BOS');
  state = api.state();
  const recruit = [...state.profiles.values()].find(player => !state.owners.has(player.id) && !state.unavailable.has(player.id));
  const teammateDemand = { kind: 'teammate', value: state.activeRoster[0].id, label: 'Keep a current teammate' };
  save.relationships = { contacts: { [recruit.id]: { score: 60, demands: [
    { kind: 'upfront', value: 25 }, teammateDemand,
  ] } }, promises: [], jerseys: {}, log: [] };
  api.put(save);
  const offer = deal({ years: 1, salary: 40_000_000, requests: [{ kind: 'teammate', days: 12 }] });
  assert.throws(() => sim.negotiateContract(sim.load(), 'free-agent', recruit.id,
    { ...offer, requests: [{ kind: 'teammate', days: 0 }] }), /delivery window/);
  const accepted = sim.negotiateContract(sim.load(), 'free-agent', recruit.id, offer);
  assert.equal(accepted.accepted, true);
  assert.equal(relations.read(sim.load()).promises.at(-1).status, 'kept');
  assert.equal(relations.read(sim.load()).promises.at(-1).due, save.day + 12);
  save = api.fresh('BOS');
  state = api.state();
  const veteran = state.activeRoster[0];
  api.exerciseOfferEditor(veteran);
  const network = api.worldRelationships;
  const opponent = state.rosters.get('ATL')[0];
  const matchup = { home: 'BOS', away: 'ATL', homeBox: [{ id: veteran.id }], awayBox: [{ id: opponent.id }] };
  const from = { kind: 'Player', code: 'BOS', id: veteran.id };
  const to = { kind: 'Player', code: 'ATL', id: opponent.id };
  assert.equal(network.connection(save, state, from, to).score, 5);
  assert.equal(network.connection(save, { ...state, results: [matchup] }, from, to).score, 9);
  const current = finance.report(save, state).contracts.get(veteran.id).deal;
  save.openingContracts = { [veteran.id]: { team: save.team, deal: { ...current, years: 2 } } };
  save.relationships = { contacts: { [veteran.id]: { score: 70, demands: [
    { kind: 'upfront', value: 25 }, teammateDemand,
  ] } }, promises: [], jerseys: {}, log: [] };
  api.put(save);
  const low = sim.negotiateContract(sim.load(), 'extension', veteran.id, { ...offer, salary: 250000 });
  assert.equal(low.accepted, false);
  assert.equal(relations.read(sim.load()).promises.length, 0);
  const high = sim.negotiateContract(sim.load(), 'extension', veteran.id, offer);
  assert.equal(high.accepted, true);
  assert.equal(high.attempts, 2);
  assert.equal(relations.read(sim.load()).promises.at(-1).status, 'kept');
  save = api.fresh('BOS');
  state = api.state();
  const unsigned = [...state.profiles.values()].filter(player => !state.owners.has(player.id) && !state.unavailable.has(player.id));
  const [signing, wanted] = unsigned;
  save.relationships = { contacts: { [signing.id]: { score: 60, demands: [
    { kind: 'upfront', value: 25 }, { kind: 'teammate', value: wanted.id, label: 'Sign ' + wanted.name },
  ] } }, promises: [], jerseys: {}, log: [] };
  api.put(save);
  assert.equal(sim.negotiateContract(sim.load(), 'free-agent', signing.id,
    { ...offer, requests: [{ kind: 'teammate', days: 1 }] }).accepted, true);
  const signed = sim.load();
  assert.equal(relations.read(signed).promises.at(-1).status, 'pending');
  const failedOfferPromise = relations.settle({ ...signed, day: signed.day + 2 }, api.state(), signed);
  assert.equal(relations.read(failedOfferPromise).promises.at(-1).status, 'broken');
  assert.equal(relations.read(failedOfferPromise).contacts[signing.id].score, 32);
  console.log('Annual payments, conditional validation, verbal agreements, promise delivery, jersey assignment, and replay passed.');
}

function checkBox(game) {
  for (const side of ['home', 'away']) {
    const box = game[side + 'Box'];
    assert.equal(box.reduce((sum, line) => sum + line.PTS, 0), game[side + 'Score']);
    if (game.forfeit) continue;
    assert.equal(box.reduce((sum, line) => sum + line.MIN, 0), 240 + (game.overtime ?? 0) * 25);
    assert.equal(new Set(box.map(line => line.id)).size, box.length);
    for (const line of box) {
      assert.equal(line.PTS, 2 * line.FGM + line['3PM'] + line.FTM);
      assert.ok(line.FGM <= line.FGA && line['3PM'] <= line['3PA'] && line.FTM <= line.FTA);
      assert.ok(line['3PM'] <= line.FGM && line['3PA'] <= line.FGA);
      assert.ok(line.MIN > 0 && line.MIN <= 48 + (game.overtime ?? 0) * 5);
    }
  }
  assert.notEqual(game.homeScore, game.awayScore);
}

function coaching() {
  const api = runtime();
  const sim = api.seasonSim;
  let save = api.fresh();
  let state = api.state();
  const plan = sim.currentPlan(save);
  const order = sim.currentOrder(save);
  assert.equal(Object.values(plan).reduce((sum, minutes) => sum + minutes, 0), 240);
  assert.throws(() => sim.setPlan(save, { ...plan, [order[0]]: 99 }, order), /240/);
  const health = new Map([...state.health].map(([id, condition]) => [id, { ...condition }]));
  health.get(order[0]).durability = 0;
  health.get(order[1]).durability = 30;
  const allocation = sim.allocateMinutes(save.team, plan, health, state.activeRoster, order);
  assert.equal(allocation.reduce((sum, player) => sum + player.minutes, 0), 240);
  assert.ok(!allocation.some(player => player.id === order[0]));
  assert.ok(allocation.find(player => player.id === order[1]).minutes <= 20);
  assert.equal(sim.fatigueLoss(36, false), 27);
  assert.equal(sim.fatigueLoss(36, true), 33);
  for (const [testAge, multiplier] of [['young', 1.15], ['peak', 1.25], ['old', 0.9]]) {
    const date = sim.date(0);
    const player = api.league.players.find(player => {
      const age = api.playerDevelopment.ageAt(player, date);
      const curve = api.playerDevelopment.profiles.get(player.id);
      return age != null && (testAge === 'young' ? age < curve.peakStart : testAge === 'peak' ? age >= curve.peakStart && age <= curve.peakEnd : age > curve.peakEnd);
    });
    const normal = api.playerDevelopment.create(), practiced = api.playerDevelopment.create();
    const rates = { prePeakEnabled: true, prePeak: 0.15, peak: 0.25, postPeak: 0.1 };
    api.playerDevelopment.agePlayers(normal, date, [player], new Set(), rates);
    api.playerDevelopment.agePlayers(practiced, date, [player], new Set([player.id]), rates);
    assert.ok(Math.abs(practiced.aging.get(player.id) / normal.aging.get(player.id) - multiplier) < 1e-10);
  }
  while (!state.today.some(pair => pair.includes(save.team))) {
    sim.advance(save);
    save = sim.load();
    state = api.state();
  }
  sim.simcastAction(save, 'start');
  assert.ok(sim.load().simcast);
  assert.throws(() => sim.setPlan(sim.load(), plan, order), /SimCast/);
  let periods = 0;
  while (!sim.castComplete(sim.load().simcast) && periods++ < 15) {
    save = sim.load();
    const rotation = sim.castMinutes(save);
    sim.simcastAction(save, 'period', { play: 'pickRoll', defense: 'paint',
      focus: rotation.players.find(player => player.minutes > 0).id,
      minutes: Object.fromEntries(rotation.players.map(player => [player.id, player.minutes])) });
  }
  save = sim.load();
  assert.ok(sim.castComplete(save.simcast));
  const day = save.day;
  const home = save.simcast.home;
  const score = sim.castScore(save.simcast, 'home');
  sim.simcastAction(save, 'finalize');
  state = api.state();
  const game = state.results.find(game => game.id === day + '-' + home);
  assert.equal(game.homeScore, score);
  checkBox(game);
  const savedGame = JSON.stringify(game);
  const heavyOrder = state.activeRoster.map(player => player.id);
  const heavyMinutes = Object.fromEntries(heavyOrder.map((id, index) => [id, index < 5 ? 48 : 0]));
  sim.setPlan(sim.load(), heavyMinutes, heavyOrder);
  state = runTo(api, 90);
  for (const result of state.results) checkBox(result);
  assert.equal(JSON.stringify(state.results.find(game => game.id === day + '-' + home)), savedGame);
  assert.ok(state.injuries.length > 0);
  assert.ok(api.rotationPauses > 0, 'A real injury must stop the attempted simulation.');
  for (const condition of state.health.values()) {
    assert.ok(condition.fatigue >= 0 && condition.fatigue <= 100);
    assert.ok(condition.durability >= 0 && condition.durability <= 100);
  }
  console.log('Rotation limits, fatigue, injury pauses and repair, SimCast finalization, replay, and box scores passed.');
}

function aiTeams() {
  const api = runtime();
  const sim = api.seasonSim;
  const save = api.fresh();
  const ownRoster = api.state().rosters.get(save.team).map(player => player.id).sort();
  assert.equal(Object.keys(save.teamDirections).length, 30);
  assert.equal(new Set(Object.values(save.teamDirections)).size, 4);
  sim.gmContact(save, 'ATL', 'check-in');
  assert.equal(api.worldRelationships.gmTrust(sim.load(), 'ATL'), 52);
  assert.throws(() => sim.gmContact(sim.load(), 'ATL', 'check-in'), /14 franchise days/);
  sim.gmContact(sim.load(), 'ATL', 'promise', 3);
  sim.advance(sim.load());
  sim.gmContact(sim.load(), 'ATL', 'follow-up');
  assert.equal(api.worldRelationships.gmTrust(sim.load(), 'ATL'), 58);
  assert.throws(() => sim.gmContact(sim.load(), 'ATL', 'promise', 1), /14 franchise days/);
  api.put({ ...sim.load(), gmContacts: {} });
  sim.gmContact(sim.load(), 'ATL', 'promise', 1);
  sim.advanceTo(sim.load(), 3);
  assert.equal(sim.load().gmContacts.ATL.promise.status, 'Expired');
  assert.equal(api.worldRelationships.gmTrust(sim.load(), 'ATL'), 50);
  api.put({ ...sim.load(), gmContacts: {} });
  sim.gmContact(sim.load(), 'ATL', 'promise', 3);
  sim.gmContact(sim.load(), 'ATL', 'leak');
  assert.equal(api.worldRelationships.gmTrust(sim.load(), 'ATL'), 38);
  assert.equal(sim.load().gmLeaks.at(-1).team, 'ATL');
  const trusted = { ...save, gmTrust: Object.fromEntries(api.league.teams.map(team => [team.code, 100])) };
  const voteBefore = sim.leagueMeeting(trusted, true, [], 'deadline');
  const lobby = voteBefore.votes.filter(vote => !vote.yes && vote.code !== save.team).map(vote => vote.code);
  const voteAfter = sim.leagueMeeting(trusted, true, lobby, 'deadline');
  assert.ok(voteAfter.votes.filter(vote => vote.swayed).length >= 2);
  const weekend = { ...save, day: sim.allStarDayFor(save) };
  api.put(weekend);
  sim.gmContact(sim.load(), 'ATL', 'event');
  assert.equal(api.worldRelationships.gmTrust(sim.load(), 'ATL'), 54);
  api.put(save);
  const opening = api.state();
  const firstPick = api.draftOps.futurePicks(save).find(pick => pick.round === 1);
  const market = api.tradeValues.market(save, opening, () => null);
  const contender = Object.keys(save.teamDirections).find(code => save.teamDirections[code] === 'Contending');
  const rebuilder = Object.keys(save.teamDirections).find(code => save.teamDirections[code] === 'Rebuilding');
  assert.ok(market.valueFor(firstPick.key, rebuilder) > market.valueFor(firstPick.key, contender));
  for (const roster of opening.rosters.values()) assert.ok(roster.length <= 15);
  const legacy = { ...save, cpuDepthInitialized: false, financeActions: [] };
  api.put(legacy);
  const untrimmed = api.state();
  assert.ok([...untrimmed.rosters.values()].some(roster => roster.length === 18));
  sim.openSlot(sim.storageKey);
  const normalized = sim.load();
  assert.equal(api.state().rosters.get(save.team).length, untrimmed.rosters.get(save.team).length);
  for (const [code, roster] of api.state().rosters) if (code !== save.team) assert.ok(roster.length <= 15);
  sim.openSlot(sim.storageKey);
  assert.equal(sim.load().financeActions.length, normalized.financeActions.length);

  api.put(save);
  const partner = 'ATL';
  const getRoster = code => opening.rosters.get(code);
  const incoming = getRoster(partner).at(-1).id;
  const outgoing = getRoster(save.team).slice(3, 5).map(player => player.id);
  sim.saveFinanceAction(sim.load(), { type: 'trade', otherTeam: partner, send: outgoing, receive: [incoming] });
  assert.equal(api.state().rosters.get(partner).length, getRoster(partner).length + 1);
  assert.ok(outgoing.every(id => api.state().owners.get(id) === partner));
  api.put({ ...save, financeActions: [...save.financeActions,
    { type: 'cut', team: partner, id: incoming, day: 0, cpu: true, settlement: true }] });
  const state = runTo(api, 91);
  const final = sim.load();
  const moves = final.financeActions.filter(action => action.cpu);
  const trades = moves.filter(action => action.type === 'trade');
  assert.ok(moves.some(action => action.type === 'signing'));
  assert.ok(moves.some(action => action.type === 'facility'));
  assert.ok(trades.some(trade => trade.receivePicks?.length));
  assert.deepEqual(Array.from(state.rosters.get(save.team), player => player.id).sort(), Array.from(ownRoster));
  const rostered = [...state.rosters.values()].flat().map(player => player.id);
  assert.equal(new Set(rostered).size, rostered.length);
  assert.ok(state.development.log.some(entry => entry.team && entry.team !== save.team && entry.gain));
  for (const team of api.league.teams) {
    const ledger = api.teamFinance.report(final, state, team.code);
    assert.ok(Number.isFinite(ledger.available));
    assert.equal(ledger.bank, api.teamFinance.openingCash + ledger.entries.reduce((sum, entry) => sum + entry.amount, 0));
    assert.equal(ledger.contracts.size, state.rosters.get(team.code).length);
  }
  for (const trade of trades) {
    const atTrade = sim.history({ ...final, day: trade.day });
    assert.equal(atTrade.owners.get(trade.id), trade.otherTeam);
    if (trade.incoming) assert.equal(atTrade.owners.get(trade.incoming), trade.team);
    for (const key of trade.receivePicks ?? []) assert.equal(final.pickOwners[key], trades.findLast(item => item.receivePicks?.includes(key)).team);
    assert.ok(trade.day <= sim.tradeDeadline && trade.team !== save.team && trade.otherTeam !== save.team);
  }
  const ownSettings = JSON.stringify(api.arenaOps.settings(final));
  const changedClub = moves.find(action => action.type === 'facility').team;
  assert.notEqual(JSON.stringify(api.arenaOps.settings(final, final.day, changedClub)), ownSettings);
  const pickTrade = trades.find(trade => trade.receivePicks?.length);
  console.log('CPU trade example:', pickTrade.team, state.profiles.get(pickTrade.id).name, 'to', pickTrade.otherTeam,
    'for', pickTrade.receivePicks.map(api.draftOps.pickLabel).join(', '));
  console.log('Team directions, GM contacts and lobbying, CPU signings, trades, roster ownership, and ledgers passed.');
}

function transitions() {
  const api = runtime();
  const sim = api.seasonSim;
  api.fresh();
  const complete = runTo(api, sim.playoffStart + api.postseason.maxDays + 1);
  const save = sim.load();
  assert.ok(complete.bracket.champion);
  const regular = complete.results.filter(game => game.playoffRound == null);
  assert.equal(regular.length, 1230);
  assert.equal(complete.results.filter(game => game.playoffRound === -1).length, 6);
  assert.deepEqual(Array.from(complete.bracket.rounds, round => round.length), [8, 4, 2, 1]);
  for (const record of Object.values(complete.records)) assert.equal(record.wins + record.losses, 82);
  for (const team of api.league.teams) {
    assert.equal(regular.filter(game => game.home === team.code).length, 41);
    assert.equal(regular.filter(game => game.away === team.code).length, 41);
  }
  for (const [round, seriesList] of complete.bracket.rounds.entries()) for (const series of seriesList) {
    assert.ok(series.winner);
    assert.equal(Math.max(series.highWins, series.lowWins), 4);
    const games = complete.results.filter(game => game.playoffRound === round && [game.home, game.away].includes(series.high));
    games.forEach((game, index) => assert.equal(game.home, [0, 1, 4, 6].includes(index) ? series.high : series.low));
  }
  for (const game of complete.results) checkBox(game);
  for (const code of api.league.teams.map(team => team.code)) {
    const finances = api.teamFinance.report(save, complete, code);
    assert.equal(finances.entries.filter(entry => entry.category === 'League media').reduce((sum, entry) => sum + entry.amount, 0),
      api.teamFinance.mediaDistribution);
  }
  const archivedResults = JSON.stringify(complete.results);
  const bank = api.teamFinance.report(save, complete).bank;
  sim.rollover(save, []);
  let next = sim.load();
  assert.equal(next.year, 1);
  assert.equal(next.day, 0);
  assert.ok(next.market.open);
  assert.equal(next.startingBanks[next.team], bank);
  assert.equal(next.pastSeasons.length, 1);
  assert.equal(next.customPlayers.length, 60);
  assert.equal(new Set(next.customPlayers.map(player => player.id)).size, 60);
  assert.equal(JSON.stringify(sim.history(next.pastSeasons[0]).results), archivedResults);
  const picks = Object.values(next.draftRights ?? {}).length
    + Object.keys(next.openingContracts).filter(id => id.startsWith('draft-')).length;
  assert.ok(picks > 0);
  assert.equal(api.state().averages.size, 0);
  assert.throws(() => sim.advance(next), /free agency/);
  const unsigned = [...api.state().profiles.values()].filter(player => !api.state().owners.has(player.id)
    && !api.state().unavailable.has(player.id) && !next.draftRights?.[player.id])
    .sort((a, b) => api.freeAgency.askingSalary(a) - api.freeAgency.askingSalary(b))[0];
  const offer = deal({ salary: api.freeAgency.askingSalary(unsigned) * 3 });
  const beforeOffer = api.teamFinance.report(next, api.state()).bank;
  sim.marketAction(next, { type: 'offer', id: unsigned.id, deal: offer });
  assert.equal(api.teamFinance.report(sim.load(), api.state()).bank, beforeOffer);
  sim.marketAction(sim.load(), { type: 'withdraw', id: unsigned.id });
  assert.equal(Object.keys(sim.load().market.offers).length, 0);
  sim.marketAction(sim.load(), { type: 'offer', id: unsigned.id, deal: offer });
  for (let day = 1; day <= 3; day++) {
    assert.equal(sim.load().market.moratoriumDay, day);
    sim.marketAction(sim.load(), { type: 'resolve' });
    assert.equal(api.state().owners.has(unsigned.id), false);
    assert.equal(api.teamFinance.report(sim.load(), api.state()).bank, beforeOffer);
  }
  sim.marketAction(sim.load(), { type: 'resolve' });
  assert.equal(api.state().owners.get(unsigned.id), next.team);
  assert.equal(beforeOffer - api.teamFinance.report(sim.load(), api.state()).bank, offer.salary * 0.25);
  next = sim.load();
  sim.marketAction(next, { type: 'close' });
  next = sim.load();
  assert.equal(next.market.open, false);
  const afterMarket = api.state();
  for (const team of api.league.teams) assert.ok(afterMarket.rosters.get(team.code).length >= api.freeAgency.minimum);
  assert.throws(() => sim.advanceTo(next, 1), /calendar/);
  const year = api.draftOps.draftYear(next);
  const players = api.draftOps.prospects(next).map(row => ({ ...row, age: Number(row.age) }));
  players[0].name = 'Handoff Test Prospect';
  assert.throws(() => sim.finishHandoff(next, 'PHX', { year, players: [] }), /60/);
  sim.finishHandoff(next, 'PHX', { year, players });
  assert.equal(sim.load().handoff, null);
  assert.equal(api.draftOps.prospects(sim.load())[0].name, 'Handoff Test Prospect');
  const beforeHost = { ...sim.load(), day: sim.allStarDayFor(sim.load()) - 1 };
  const onHost = { ...beforeHost, day: sim.allStarDayFor(beforeHost) };
  const payouts = (save, code) => api.teamFinance.report(save, sim.history(save), code).entries
    .filter(entry => entry.description === 'All-Star host bonus').map(entry => entry.amount);
  assert.equal(payouts(beforeHost, 'PHX').length, 0);
  assert.equal(payouts(onHost, 'PHX').join(), '1000000');
  assert.equal(payouts(onHost, 'PHI').length, 0);
  const completedHandoff = sim.load();
  api.put(next);
  api.exerciseHandoff(sim.load());
  assert.equal(sim.load().customDraftClass, null);
  api.put(completedHandoff);
  runTo(api, 8);
  assert.ok(api.state().results.length > 0);
  assert.equal(JSON.stringify(sim.history(sim.load().pastSeasons[0]).results), archivedResults);
  console.log('82-game seasons, play-in, all playoff rounds, media payments, draft, rollover, free agency, and archived replay passed.');
}

function finances() {
  const api = runtime();
  const { seasonSim: sim, teamFinance: finance, arenaOps: arena } = api;
  const summary = [];
  for (const team of ['PHI', 'GSW']) {
    api.fresh(team, team === 'PHI' ? 1024 : 7412);
    const purchase = action => sim.saveFinanceAction(sim.load(), { type: 'facility', ...action });
    purchase({ facility: 'parking', command: 'price', value: 35 });
    purchase({ facility: 'parking', command: 'upgrade' });
    purchase({ facility: 'merch', command: 'unlock', index: 9 });
    purchase({ facility: 'merch', command: 'toggle', index: 9 });
    purchase({ facility: 'vip', command: 'upgrade' });
    purchase({ facility: 'arena', command: 'watch-unlock' });
    const featured = api.state().activeRoster.slice(0, 3).map(player => player.id);
    purchase({ facility: 'ads', command: 'campaign', index: 'team', value: { players: featured } });
    purchase({ facility: 'ads', command: 'campaign', index: 'company', value: { players: featured, company: 'Kia' } });
    purchase({ facility: 'ads', command: 'brand-sign', index: 'Nike' });
    const config = arena.settings(sim.load());
    assert.equal(config.parking.price, 35);
    assert.equal(config.merch[9].selling, false);
    const sample = { day: 1 };
    const sales = arena.gameRevenue(config, team, sample, 20, 40);
    assert.ok(sales.fans <= arena.capacity('arena', config.arena.level));
    assert.ok(sales.parking <= arena.capacity('parking', config.parking.level));
    assert.ok(sales.vip <= arena.capacity('vip', config.vip.level));
    const overpriced = structuredClone(config);
    overpriced.arena.price = 10_000;
    assert.ok(arena.gameRevenue(overpriced, team, sample, 20, 40).fans < sales.fans);
    assert.ok(arena.commercialRevenue(config, false)['Watch party tickets'] > 0);
    assert.ok(arena.commercialRevenue(config, false).Sponsorships > 0);
    const seasons = process.argv[3] === 'diagnose' || team === 'GSW' ? 2 : 5;
    for (let year = 0; year < seasons; year++) {
      const state = runTo(api, sim.playoffStart + api.postseason.maxDays + 1);
      const save = sim.load();
      let minimum = Infinity, maximum = -Infinity, worstClub;
      for (const club of api.league.teams) {
        const ledger = finance.report(save, state, club.code);
        const opening = save.startingBanks?.[club.code] ?? finance.openingCash;
        assert.equal(ledger.bank, opening + ledger.entries.reduce((total, entry) => total + entry.amount, 0));
        assert.ok(ledger.bank > 0 && Number.isFinite(ledger.reserved));
        const staff = -ledger.entries.filter(entry => entry.category === 'Staff payroll').reduce((total, entry) => total + entry.amount, 0);
        assert.equal(staff, api.staffSim.annualPayroll(save, club.code));
        assert.equal(-ledger.entries.filter(entry => entry.category === 'GM payroll').reduce((total, entry) => total + entry.amount, 0), finance.gmSalary);
        const media = ledger.entries.filter(entry => entry.category === 'League media');
        assert.equal(media[0].amount, finance.mediaUpfront);
        assert.equal(media.slice(1).reduce((total, entry) => total + entry.amount, 0), finance.mediaRollover);
        for (const attendance of ledger.attendance) {
          assert.ok(attendance.fans >= 0);
          assert.equal(attendance.sales.Tickets, attendance.fans * attendance.ticket);
        }
        const profit = ledger.bank - opening;
        if (profit < minimum) {
          minimum = profit;
          const categories = new Map();
          for (const entry of ledger.entries) categories.set(entry.category, (categories.get(entry.category) ?? 0) + entry.amount);
          worstClub = { club: club.code, opening, closing: ledger.bank, categories: Object.fromEntries(categories) };
        }
        maximum = Math.max(maximum, profit);
      }
      const own = finance.report(save, state);
      assert.ok(own.entries.some(entry => entry.category === 'Watch party tickets' && entry.amount > 0));
      assert.ok(own.entries.some(entry => entry.category === 'Sponsorships' && entry.amount > 0));
      summary.push({ team, year: year + 1, smallestClubProfit: minimum, largestClubProfit: maximum });
      console.log('Financial season checked', summary.at(-1));
      if (process.argv[3] === 'diagnose') console.log(JSON.stringify(worstClub));
      if (year < seasons - 1) {
        sim.rollover(save, []);
        for (let day = 0; day < 3; day++) sim.marketAction(sim.load(), { type: 'resolve' });
        sim.marketAction(sim.load(), { type: 'close' });
        sim.finishHandoff(sim.load(), 'PHX', null);
        assert.equal(arena.settings(sim.load()).parking.price, 35);
      }
    }
    if (process.argv[3] === 'diagnose') break;
  }
  if (process.argv[3] === 'diagnose') return;
  console.log('Attendance, facility prices and upgrades, away income, salaries, media installments, and seven season ledgers passed.');
}

function careers() {
  const { seasonSim: sim, gmCareer, teamFinance, postseason, exerciseCareerScreens } = runtime();
  let preferred = 0;
  for (let index = 0; index < 1000; index++) {
    const offers = gmCareer.offers("MIA", Math.imul(index, 2654435761) >>> 0);
    assert.equal(new Set(offers.map(offer => offer.team)).size, 5);
    assert.ok(offers.every(offer => offer.salary >= 1000000 && offer.salary <= 7000000 && offer.years >= 1 && offer.years <= 3));
    if (offers.some(offer => offer.team === "MIA")) preferred++;
  }
  assert.ok(preferred >= 240 && preferred <= 260);
  const identity = { name: "Test GM", birthplace: "Miami", dob: "1990-01-01", preferred: "MIA" };
  sim.startCareer(identity, { team: "MIA", salary: 3000000, years: 1 }, {});
  const first = sim.saveSlots()[0].key;
  sim.advance(sim.load());
  sim.quitSlot();
  assert.equal(sim.load(), null);
  sim.startCareer({ ...identity, name: "Second GM" }, { team: "PHI", salary: 6000000, years: 3 }, {});
  assert.equal(sim.saveSlots().length, 2);
  sim.quitSlot();
  sim.openSlot();
  assert.equal(sim.load().gm.name, "Second GM");
  sim.openSlot(first);
  assert.equal(sim.load().day, 1);
  const state = runTo({ seasonSim: sim, state: () => sim.history(sim.load()) }, sim.playoffStart + postseason.maxDays + 1);
  const save = sim.load();
  assert.equal(teamFinance.gmWallet(save).balance, 3000000);
  assert.throws(() => sim.rollover(save, []), /Accept a GM job/);
  const offers = gmCareer.renewals(save, state);
  assert.equal(offers.length, 5);
  assert.ok(offers.every(offer => offer.salary >= 1000000 && offer.salary <= 15000000));
  const offer = offers.find(entry => entry.team !== save.team);
  sim.chooseGmJob(save, offer.team);
  sim.rollover(sim.load(), []);
  const next = sim.load();
  assert.equal(next.team, offer.team);
  assert.equal(next.gm.contract.salary, offer.salary);
  assert.equal(next.pastSeasons[0].team, save.team);
  assert.equal(next.pastSeasons[0].ownerReview.goals.length, 2);
  assert.equal(next.previousWins[save.team], state.records[save.team].wins);
  exerciseCareerScreens();
  assert.equal(sim.saveSlots().length, 2);
  sim.deleteSlot(first);
  assert.equal(sim.load(), null);
  assert.throws(() => sim.openSlot(first), /available save/);
  sim.openSlot();
  assert.equal(sim.load().gm.name, 'Second GM');
  sim.deleteSlot(sim.saveSlots()[0].key);
  assert.equal(sim.saveSlots().length, 0);
  assert.throws(() => sim.openSlot(), /available save/);
}

async function liveRefresh() {
  const { seasonSim: sim, league, liveNBA, setFetch } = runtime();
  const clubs = league.teams.map(team => ({ team: { id: team.code, abbreviation: team.code } }));
  const roster = team => league.players.filter(player => player.team === team).map(player =>
    ({ id: player.id, fullName: player.name, jersey: player.jersey, position: { abbreviation: player.position } }));
  setFetch(async url => ({ ok: true, json: async () => {
    if (url.includes('scoreboard')) return { events: [] };
    assert.ok(!url.endsWith('/teams'), 'The team directory blocks local browser requests');
    if (url.endsWith('/standings')) return { children: [{ standings: { entries: clubs.map(({ team }) => ({
      team, stats: [{ name: 'wins', value: 2 }, { name: 'losses', value: 1 }],
    })) } }] };
    const code = url.split('/').at(-2);
    const athletes = roster(code);
    if (code === 'MIA') athletes.push({ id: '900000000', fullName: 'New NBA Player', jersey: '42' });
    return { athletes };
  } }));
  const snapshot = await liveNBA.refresh('2026-11-08');
  assert.equal(Object.keys(snapshot.rosters).length, 30);
  assert.equal(snapshot.records.MIA.wins, 2);
  sim.startCareer({ name: 'Refresh GM' }, { team: 'MIA', salary: 3000000, years: 1 }, liveNBA.startingSnapshot());
  const save = sim.load();
  assert.equal(sim.history(save).rosters.get('MIA').find(player => player.name === 'New NBA Player').jersey, '42');
  assert.equal(sim.history(save).records.MIA.wins, 0);
  sim.advance(save);
  setFetch(async () => ({ ok: false, status: 503 }));
  await assert.rejects(liveNBA.refresh('2026-11-09'), /503/);
  assert.equal(liveNBA.current().date, '2026-11-08');
}

function awardFlow() {
  const api = runtime();
  const { seasonSim: sim, nbaAwards, awardOverrideEntries } = api;
  api.put({ ...api.fresh(), allStarFormat: 1 });
  const save = sim.load();
  const line = (id, PTS) => ({ id, PTS, MIN: 30, AST: 0, OREB: 0, DREB: 0, STL: 0, BLK: 0, TO: 0 });
  const game = { home: 'MIA', away: 'LAL', playoffRound: 3, homeBox: [line('champion', 30)], awayBox: [line('runner-up', 33)] };
  const match = { high: 'MIA', low: 'LAL', winner: 'MIA' };
  assert.equal(nbaAwards.playoffMvp([game], match, 3, 1, true)[0], 'champion');
  assert.equal(nbaAwards.playoffMvp([game], match, 3, 1, true, 0)[0], 'runner-up');
  game.awayBox[0].PTS = 45;
  assert.equal(nbaAwards.playoffMvp([game], match, 3, 1)[0], 'runner-up');
  const feb = Array.from({ length: sim.playoffStart }, (_, day) => day).find(day => sim.date(day).endsWith('-02-01'));
  assert.equal(sim.history({ ...save, day: feb - 1 }).awardRace, null);
  assert.equal(sim.history({ ...save, day: feb }).awardRace.mvp.length, 5);
  const state = runTo(api, sim.playoffStart + api.postseason.maxDays + 1);
  const current = sim.load();
  const entries = awardOverrideEntries(state, current);
  for (const slot of ['mvp:0', 'allNBA:0', 'finals:0', 'coach:0', 'dunk', 'allStarMvp', 'allStar:0']) {
    const entry = entries.find(item => item.slot === slot);
    assert.ok(entry, slot);
    const alternate = entry.candidates.find(candidate => candidate.id !== entry.winner);
    assert.ok(alternate, slot);
    sim.setAwardOverride(sim.load(), slot, alternate.id);
    assert.equal(awardOverrideEntries(sim.history(sim.load()), sim.load()).find(item => item.slot === slot).winner, alternate.id);
    if (slot === "allStarMvp") {
      const overridden = sim.history(sim.load());
      assert.ok(alternate.team);
      assert.equal(overridden.allStarGame.mvp.team, alternate.team);
      assert.ok(api.teamFinance.report(sim.load(), overridden, alternate.team).entries.some(entry =>
        entry.amount === 250000 && entry.description.includes(alternate.name)));
    }
  }
  const periodic = entries.find(entry => entry.slot.startsWith('playerWeek:') && entry.candidates.length > 1);
  const alternate = periodic.candidates.find(row => row.id !== periodic.winner);
  sim.setAwardOverride(sim.load(), periodic.slot, alternate.id);
  assert.equal(awardOverrideEntries(sim.history(sim.load()), sim.load()).find(item => item.slot === periodic.slot).winner, alternate.id);
  assert.throws(() => sim.setAwardOverride(sim.load(), 'finals:0', 'invalid-player'), /eligible/);
  api.exerciseAwardScreens(sim.load());
  const final = sim.history(sim.load()).playoffAwards.finals[0];
  sim.rollover(sim.load(), []);
  assert.equal(sim.history(sim.load().pastSeasons[0]).playoffAwards.finals[0], final);
  assert.equal(sim.load().awardOverrides, undefined);
}

function customAllStar() {
  const api = runtime();
  const sim = api.seasonSim;
  const save = api.fresh();
  const { open, close } = sim.allStarElectionDates(save);
  const sunday = sim.allStarDayFor(save);
  const ballotCount = rows => rows.reduce((sum, row) => sum + row.gm, 0);
  assert.equal(sim.date(open, save.year).slice(5), '12-15');
  assert.equal(sim.date(close, save.year).slice(5), '01-20');
  const opening = runTo(api, open);
  assert.equal(opening.allStarVotePending, true);
  assert.equal(opening.allStarVotes.East.length, 16);
  assert.equal(opening.allStarVotes.West.length, 16);
  assert.equal(ballotCount(opening.allStarVotes.East), 9);
  assert.throws(() => sim.advanceTo(sim.load(), open + 1), /votes/);
  sim.allStarAction(sim.load(), 'vote', { East: opening.allStarVotes.East[0].id, West: opening.allStarVotes.West[0].id });
  assert.equal(ballotCount(api.state().allStarVotes.East), 10);
  const voted = sim.load();
  const final = sim.history({ ...voted, day: close });
  assert.equal(ballotCount(final.allStarVotes.East), 30);
  assert.deepEqual(final.allStarVotes, sim.history({ ...voted, day: close + 1 }).allStarVotes);
  const weekend = sim.history({ ...voted, allStarDraftDelegate: true, day: sunday });
  assert.equal(weekend.selections.allStar.length, 32);
  const risingRoster = weekend.risingStars.teams.flatMap(team => team.roster);
  assert.equal(new Set(risingRoster.map(player => player.id)).size, risingRoster.length);
  assert.ok(weekend.risingStars.teams.every(team => team.roster.length <= 6));
  assert.equal(weekend.risingStars.games.length, 5);
  assert.ok(weekend.risingStars.games.every((game, i) => Math.max(...game.scores) >= [40, 40, 40, 30, 25][i]));
  assert.deepEqual(Array.from(weekend.allStarGame.teams, team => team.roster.length), [8, 8, 8, 8]);
  assert.equal(weekend.allStarGame.games.length, 4);
  const club = weekend.allStarDraft.teams[0].club;
  const manual = sim.history({ ...voted, team: club, day: sunday });
  assert.equal(manual.allStarDraft.pending.club, club);
  const choice = manual.allStarDraft.pool.at(-1).id;
  const delegated = sim.history({ ...voted, team: club, day: sunday, allStarDraftPicks: { [manual.allStarDraft.next]: choice }, allStarDraftDelegate: true });
  assert.equal(delegated.allStarDraft.picks[manual.allStarDraft.next].player.id, choice);
  assert.ok(weekend.results.flatMap(game => game.homeBox).some(line => line.DNK > 0));
}

function timedOffseason() {
  const api = runtime();
  const sim = api.seasonSim;
  api.fresh();
  const finals = runTo(api, sim.playoffStart + api.postseason.maxDays + 1);
  assert.ok(finals.bracket.champion);
  assert.equal(api.draftOps.draftOrder({ ...sim.load(), championDraftsLast: true }, finals, true)[29], finals.bracket.champion);
  const shortBracket = { rounds: [[{ high: 'PHI', low: 'BOS', highWins: 0, lowWins: 0 }]], seriesLengths: { 0: 1 } };
  shortBracket.rounds[0].push({ high: 'NYK', low: 'ATL', highWins: 0, lowWins: 0 });
  api.postseason.record(shortBracket, [{ home: 'PHI', away: 'BOS', homeScore: 100, awayScore: 90 }], 0, finals.records);
  assert.equal(shortBracket.rounds[0][0].winner, 'PHI');
  assert.equal(shortBracket.rounds.length, 1);
  sim.revealLottery(sim.load());
  assert.equal(sim.load().lotteryRevealed, 1);
  sim.revealLottery(sim.load(), true);
  sim.draftAction(sim.load(), '', 'start');
  sim.draftAction(sim.load(), '', 'end');
  assert.equal(sim.load().draftRoom.picks.length, 60);
  sim.rollover(sim.load(), [], {}, { proposal: 'no-award-minimum', vote: 'yes', lobby: ['BOS', 'NYK'], timedMarket: true });
  assert.equal(sim.load().leagueMeetings.at(-1).votes.length, 30);
  assert.equal(sim.load().noAwardMinimum, sim.load().leagueMeetings.at(-1).passed);
  for (let day = 1; day <= 3; day++) {
    assert.equal(sim.load().market.moratoriumDay, day);
    sim.marketAction(sim.load(), { type: 'resolve' });
    assert.equal(sim.load().market.results.length, 0);
  }
  assert.throws(() => sim.marketAction(sim.load(), { type: 'close' }), /12/);
  for (let day = 1; day <= 12; day++) {
    assert.equal(sim.load().market.round, day);
    sim.marketAction(sim.load(), { type: 'resolve' });
    while (Object.keys(sim.load().market.sheets).length) sim.marketAction(sim.load(), { type: 'sheet-day' });
  }
  const results = sim.load().market.results.filter(row => row.team);
  assert.ok(results.length > 0 && results.every(row => row.years > 0 && row.round <= 12));
  assert.equal(new Set(results.map(row => row.id)).size, results.length);
  assert.throws(() => sim.marketAction(sim.load(), { type: 'resolve' }), /12/);
  sim.marketAction(sim.load(), { type: 'close' });
  assert.ok(sim.load().handoff);
  sim.finishHandoff(sim.load(), 'PHX', null);
  assert.equal(sim.load().allStarHost, 'PHX');
  assert.equal(sim.load().day, 0);
}

function developmentDivision() {
  const api = runtime();
  const { seasonSim: sim, arenaOps: arena, draftOps } = api;
  api.fresh('PHI', 1024);
  sim.setAutoScouting(sim.load(), true);
  const priority = api.state().rosters.get('PHI')[0];
  sim.setScoutingPriority(sim.load(), priority.id, true);
  sim.advanceTo(sim.load(), 7);
  const scoutingSave = sim.load();
  assert.equal(scoutingSave.day, 7);
  assert.ok(scoutingSave.playerScoutingReports.PHI[priority.id] >= 12);
  const scouted = draftOps.prospects(scoutingSave).filter(item => item.notes.coverage > 0);
  assert.ok(scouted.length > 0 && scouted.length <= 2);
  assert.ok(scouted.every(item => item.notes.coverage < 100));
  api.exerciseDraftScoutingScreens(scoutingSave);
  sim.setScoutingPriority(scoutingSave, priority.id, false);
  assert.deepEqual([...sim.load().scoutingPriorities.PHI], []);
  api.fresh('PHI', 1024);
  const prospect = draftOps.prospects(sim.load())[0];
  sim.prospectAction(sim.load(), prospect.id, 'scout');
  const coverage = draftOps.prospects(sim.load())[0].notes.coverage;
  assert.ok(coverage >= 12 && coverage < 100);
  assert.throws(() => sim.prospectAction(sim.load(), prospect.id, 'scout'), /already met/);
  const initial = api.state();
  const player = initial.rosters.get('PHI').find(player => sim.serviceYears(sim.load(), player) < 3);
  assert.ok(player);
  sim.saveFinanceAction(sim.load(), { type: 'facility', facility: 'affiliate', command: 'assign', index: player.id });
  const assigned = sim.load();
  const after = sim.history({ ...assigned, day: 31 });
  assert.equal(after.affiliateSchedule.length, 50);
  assert.equal(after.affiliateSchedule.filter(game => game.stage === 'Tip-Off').length, 14);
  assert.equal(after.affiliateSchedule.filter(game => game.home).length, 25);
  const appearances = after.affiliateGames.filter(game => game.lines.some(line => line.id === player.id));
  assert.ok(appearances.length >= 10);
  assert.equal(after.affiliateAverages.get(player.id).GP, appearances.length);
  assert.ok(after.affiliateGames.every(game => game.score !== game.opponentScore));
  assert.equal(after.averages.has(player.id), false);
  assert.ok(after.development.log.some(entry => entry.id === player.id && entry.affiliate));
  assert.equal(sim.history({ ...assigned, day: 31 }).affiliateAverages.get(player.id).PTS, after.affiliateAverages.get(player.id).PTS);
  sim.setCfoBudget(sim.load(), { upgrades: 0 });
  assert.throws(() => sim.saveFinanceAction(sim.load(), { type: 'facility', facility: 'parking', command: 'upgrade' }), /CFO allocation/);
  assert.equal(arena.settings(sim.load()).parking.level, arena.settings(assigned).parking.level);
  const config = arena.settings(assigned);
  assert.equal(arena.upgradePrice('parking', 1), 18_000_000);
  const upgrade = arena.change(assigned, { facility: 'parking', command: 'upgrade' });
  assert.equal(arena.dailyUpkeep(upgrade.settings) - arena.dailyUpkeep(config), 1000);
  config.arena.price = 220;
  const base = arena.gameRevenue(config, 'PHI', { day: 5 }, 10, 20);
  assert.ok(arena.gameRevenue(config, 'PHI', { day: 5 }, 10, 20, 50, Array(6).fill(true)).fans > base.fans);
  assert.ok(arena.gameRevenue(config, 'PHI', { day: 5 }, 10, 20, 50, [], true).fans > base.fans);
}

function staffAndDelegation() {
  const api = runtime();
  const { seasonSim: sim, staffSim, teamFinance, freeAgency } = api;
  api.fresh('PHI', 1024);
  const role = 'Assistant GM';
  const candidate = staffSim.pool(sim.load(), staffSim.roles)[0];
  const salary = staffSim.askingSalary(candidate, role);
  sim.setCfoBudget(sim.load(), { [role]: salary - 1 });
  assert.throws(() => sim.assignStaff(sim.load(), staffSim.roles, role, candidate.id, { salary, years: 2 }), /CFO/);
  sim.setCfoBudget(sim.load(), {});
  sim.assignStaff(sim.load(), staffSim.roles, role, candidate.id, { salary, years: 2 });
  const save = sim.load();
  assert.equal(staffSim.assignments(save, save.team, staffSim.roles)[role].contract.years, 2);
  api.exerciseStaffScreens(save);
  sim.staffAssignmentAction(sim.load(), 'Head Coach');
  sim.staffAssignmentAction(sim.load(), 'Assistant Head Coach');
  sim.staffAssignmentAction(sim.load(), 'Offensive Coach', 'pickRoll');
  sim.staffAssignmentAction(sim.load(), 'Defensive Coach', 'paint');
  assert.equal(sim.currentGameplan(sim.load()).play, 'pickRoll');
  assert.equal(sim.currentGameplan(sim.load()).defense, 'paint');
  sim.staffAssignmentAction(sim.load(), 'Head of Player Development');
  sim.staffAssignmentAction(sim.load(), 'Assistant Player Development Coach');
  assert.ok(Object.keys(sim.currentTraining(sim.load())).length);
  sim.staffAssignmentAction(sim.load(), 'Head Scout');
  assert.equal(sim.load().autoScouting.PHI, true);
  const prospect = api.draftOps.prospects(sim.load())[0];
  sim.staffAssignmentAction(sim.load(), 'Assistant Head Scout', prospect.id);
  assert.ok(sim.load().prospectNotes[prospect.id].coverage > 0);
  sim.staffAssignmentAction(sim.load(), 'Head Medical Staff');
  sim.staffAssignmentAction(sim.load(), 'Assistant Head Medical Staff');
  sim.delegateFrontOffice(sim.load(), 'rotation');
  assert.equal(Object.values(sim.currentPlan(sim.load())).reduce((total, minutes) => total + minutes, 0), 240);
  const state = api.state();
  const player = [...state.profiles.values()].find(player => !state.owners.has(player.id) && !state.unavailable.has(player.id));
  assert.ok(player);
  sim.setCfoBudget(sim.load(), { players: 0 });
  assert.throws(() => sim.delegateContract(sim.load(), 'free-agent', player.id), /CFO player allocation/);
  assert.throws(() => teamFinance.enforcePlayerOffer(sim.load(), state, state.rosters.get(save.team)[0].id,
    freeAgency.modelDeal(1000000), true), /season 2/);
  sim.setCfoBudget(sim.load(), {});
  const signed = sim.delegateContract(sim.load(), 'free-agent', player.id);
  assert.ok(signed.accepted);
  assert.throws(() => sim.delegateFrontOffice(sim.load(), 'draft'), /Open the NBA Draft/);
  assert.equal(api.state().owners.get(player.id), 'PHI');
  const expired = staffSim.retire({ ...sim.load(), year: 1 }, {});
  assert.ok(staffSim.pool({ ...sim.load(), ...expired }, staffSim.roles).some(person => person.id === candidate.id));
  assert.notEqual(expired.staffing.teams.PHI[role].id, candidate.id);

}

function facilityExpansions() {
  const api = runtime();
  const { arenaOps: arena, seasonSim: sim, teamFinance } = api;
  const save = { team: 'PHI', day: 0, financeActions: [] };
  const baseline = arena.settings(save);
  baseline.vip.level = 1;
  for (const type of ['arena','parking','vip','merch','food','ads','training','clinic','affiliate']) {
    const before = { ...save, arenaCarry: baseline };
    const first = arena.change(before, { facility: type, command: 'expand' });
    const second = arena.change({ ...save, arenaCarry: first.settings }, { facility: type, command: 'expand' });
    assert.equal(first.cost, arena.expansionPrice(type, 0));
    assert.equal(second.cost, first.cost * 2);
    assert.equal(arena.dailyUpkeep(first.settings) - arena.dailyUpkeep(baseline), 250);
    assert.equal(arena.dailyUpkeep(second.settings) - arena.dailyUpkeep(first.settings), 500);
    assert.throws(() => arena.change({ ...save, arenaCarry: second.settings }, { facility: type, command: 'expand' }), /unavailable/);
    const revenue = config => Array.from({ length: 41 }, (_, game) => Object.values(arena.gameRevenue(config, 'PHI', { day: game * 4 }, game / 2, game).sales)
      .reduce((sum, value) => sum + value, 0)).reduce((sum, value) => sum + value, 0);
    const marginal = revenue(first.settings) - revenue(baseline);
    assert.ok(marginal >= 0);
    console.log(type, { purchase: first.cost, weeklyUpkeep: 1750, marginalHomeRevenue: marginal });
  }
  api.fresh('PHI', 1024);
  sim.setCfoBudget(sim.load(), { upgrades: 0 });
  const purchase = { type: 'facility', facility: 'ads', command: 'expand' };
  assert.throws(() => sim.saveFinanceAction(sim.load(), purchase), /CFO allocation/);
  sim.setCfoBudget(sim.load(), {});
  const original = sim.load();
  sim.saveFinanceAction(original, purchase);
  const upgraded = sim.load();
  assert.equal(arena.expansion(arena.settings(upgraded), 'ads'), 1);
  const ledger = opening => {
    const season = { ...opening, day: sim.lastDay + 1 };
    const state = sim.history(season);
    assert.equal(state.records.PHI.wins + state.records.PHI.losses, 82);
    return teamFinance.report(season, state).bank;
  };
  const before = ledger(original), after = ledger(upgraded);
  assert.ok(before - after > 0 && before - after < arena.expansionPrice('ads', 0));
  console.log({ baselineClosingBank: before, expandedClosingBank: after, netCost: before - after });

}

function fanAndPress() {
  const api = runtime();
  const { seasonSim, relationships, arenaOps, worldRelationships, teamFinance } = api;
  const save = api.fresh();
  const state = seasonSim.history(save);
  api.exerciseFanAndPressScreens(save);
  const fan = relationships.fans.find(item => item.code === save.team && item.name === 'Away');
  seasonSim.conversation(save, { type: 'fan-talk', id: fan.id, value: 'event' });
  const updated = seasonSim.load();
  assert.equal(relationships.score(updated, fan.id, 40), 47);
  assert.equal(updated.financeActions.at(-1).cost, 75000);
  assert.equal(teamFinance.report(save, state).available - teamFinance.report(updated, state).available, 75000);
  assert.deepEqual(arenaOps.settings(updated), arenaOps.settings(save));
  const opponent = api.league.teams.find(team => team.code !== save.team).code;
  const game = { day: save.day + 1, home: opponent, away: save.team };
  const revenue = (snapshot, matchup) => arenaOps.supporterRevenue(snapshot, save.team, matchup, arenaOps.settings(snapshot), []);
  assert.ok(revenue(updated, game)['Road fan merchandise'] > revenue(save, game)['Road fan merchandise']);
  assert.equal(revenue(updated, { ...game, home: save.team, away: opponent })['Road fan merchandise'], 0);
  assert.deepEqual(revenue(updated, { ...game, day: save.day + 21 }), revenue(save, { ...game, day: save.day + 21 }));
  assert.equal(relationships.organizations(save, state).filter(item => item.audience).length, 90);
  const pressState = { ...state, results: Array.from({ length: 5 }, () => ({ ...game, day: save.day })) };
  const action = { id: 'reporter-' + save.team, type: 'interview', value: 'respect' };
  const answered = relationships.apply(updated, pressState, action);
  assert.equal(worldRelationships.gmTrust(answered, opponent), worldRelationships.gmTrust(updated, opponent) + 5);
  assert.equal(relationships.interview(answered, pressState), null);
  assert.throws(() => relationships.apply(answered, pressState, action), /unavailable/);
}
const stages = { fanAndPress, facilityExpansions, staffAndDelegation, developmentDivision, timedOffseason, customAllStar, awardFlow, liveRefresh, careers, contracts, coaching, ai: aiTeams, transitions, finances, allStar: () => runtime().exerciseAllStar() };
const selected = process.argv[2] ?? 'all';
if (selected !== 'all' && !Object.hasOwn(stages, selected)) throw new Error('Choose all or one of: ' + Object.keys(stages).join(', '));
for (const [name, stage] of Object.entries(stages)) {
  if (selected !== 'all' && selected !== name) continue;
  const start = performance.now();
  await stage();
  console.log('PASS ' + name + ' (' + ((performance.now() - start) / 1000).toFixed(1) + 's)');
}















