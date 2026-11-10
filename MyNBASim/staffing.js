const staffSim = (() => {
  const roles = ['Head Coach','Assistant Head Coach','Offensive Coach','Defensive Coach','Head of Player Development',
    'Assistant Player Development Coach','Head Scout','Assistant Head Scout','Head Medical Staff','Assistant Head Medical Staff','CFO','Assistant GM'];
  const first = ['Alex', 'Morgan', 'Jordan', 'Riley', 'Taylor', 'Casey', 'Avery', 'Cameron', 'Jamie', 'Devon', 'Sydney', 'Drew'];
  const last = ['Bennett', 'Reed', 'Brooks', 'Hayes', 'Bishop', 'Ellis', 'Ford', 'Quinn', 'Carter', 'Rivera', 'Walsh', 'Ward', 'Singh'];
  const salaryBases = [7000000, 1500000, 1000000, 1000000, 700000, 350000, 500000, 250000, 600000, 300000, 1000000, 800000];
  const askingSalary = (person, role) => Math.round(salaryBases[roles.indexOf(role)] * (0.8 + (person.skill - 60) / 100) / 1000) * 1000;
  const salary = (person, role) => person.contract?.salary ?? askingSalary(person, role);
  function annualPayroll(save, code, day = save.day) {
    const staffing = save.staffTimeline?.findLast(entry => entry.day <= day)?.staffing ?? save.staffBaseline ?? save.staffing;
    const people = assignments({ ...save, staffing }, code, roles);
    return roles.reduce((total, role) => total + salary(people[role], role), 0);
  }
  const hash = text => [...text].reduce((seed, letter) => Math.imul(seed, 31) + letter.charCodeAt(0) >>> 0, 7);
  // Simulator ratings. NBA coaching records inform the named profiles.
  const coachRatings = {
    'Erik Spoelstra': [97, 96, 94],
    'Steve Kerr': [97, 94, 95],
    'Rick Carlisle': [94, 93, 89],
    'Doc Rivers': [88, 87, 91],
  };
  function rateCoach(person) {
    if (!person.published) return person;
    const head = person.published === 'Head Coach';
    const honors = typeof staffHistoricalHonors === 'undefined' ? [] : staffHistoricalHonors[person.name] ?? [];
    const baseline = Math.min(93, (head ? 82 : 75) + honors.length * 3);
    const [skill, evaluation, communication] = coachRatings[person.name] ?? [baseline, baseline - 1, baseline];
    return { ...person, skill, evaluation, communication };
  }
  const make = (id, seed, coach) => {
    const key = hash(id + seed);
    return rateCoach({ id, name: coach?.name ?? first[key % first.length] + ' ' + last[Math.floor(key / 127) % last.length],
      published: coach?.title, skill: 60 + key % 37, evaluation: 60 + Math.floor(key / 101) % 37,
      communication: 60 + Math.floor(key / 1031) % 37 });
  };
  function assignments(save, code, roles) {
    const staff = nbaCoaches[code].coaches;
    const saved = save?.staffing?.teams?.[code];
    if (saved) return Object.fromEntries(Object.entries(saved).map(([role, person]) => [role, rateCoach(person)]));
    return Object.fromEntries(roles.map((role, i) => {
      const coaches = [staff.find(coach => coach.title === 'Head Coach'), ...staff.filter(coach => coach.title !== 'Head Coach')];
      return [role, make(code + '-' + i, save?.staffSeed ?? save?.seed ?? 0, i < 4 ? coaches[i] : null)];
    }));
  }
  function retirementCandidates(save) {
    return league.teams.flatMap(({ code }) => Object.entries(assignments(save, code, roles))
      .filter(([, person]) => hash(person.id + '/' + save.year) % 97 === 0)
      .map(([role, person]) => ({ code, role, person })));
  }

  function retire(save, choices) {
    const teams = { ...save.staffing?.teams };
    const retired = { ...save.staffRetirements };
    const released = [...(save.staffing?.released ?? [])];
    const hired = new Set(save.staffing?.hired ?? []);
    for (const [code, staff] of Object.entries(teams)) {
      const expired = Object.entries(staff).filter(([, person]) => person.contract
        && person.contract.startYear + person.contract.years <= (save.year ?? 0) + 1);
      if (!expired.length) continue;
      teams[code] = { ...staff };
      for (const [role, person] of expired) {
        released.push({ ...person, contract: undefined });
        hired.delete(person.id);
        teams[code][role] = make(code + '-interim-' + save.year + '-' + roles.indexOf(role), save.staffSeed ?? save.seed);
      }
    }
    for (const { code, role, person } of retirementCandidates(save)) {
      if (choices[person.id] === 'override') continue;
      hired.delete(person.id);
      teams[code] = { ...(teams[code] ?? assignments(save, code, roles)),
        [role]: make(code + '-replacement-' + save.year + '-' + roles.indexOf(role), save.staffSeed ?? save.seed) };
      retired[person.id] = { ...person, code, role, year: save.year };
    }
    return { staffing: { ...save.staffing, teams, hired: [...hired], released }, staffRetirements: retired };
  }

  function pool(save, roles) {
    const candidates = [...Array.from({ length: 72 }, (_, i) => make('staff-fa-' + i, save.staffSeed ?? save.seed)),
      ...(save.staffing?.released ?? [])];
    return [...new Map(candidates.map(person => [person.id, person])).values()]
      .filter(person => !(save.staffing?.hired ?? []).includes(person.id) && !save.staffRetirements?.[person.id]);
  }
  function assign(save, roles, role, id, terms) {
    if (!roles.includes(role)) throw new Error('Choose an available staff position.');
    const current = { ...assignments(save, save.team, roles) };
    const previousRole = roles.find(slot => current[slot].id === id);
    const released = [...(save.staffing?.released ?? [])];
    const hired = [...(save.staffing?.hired ?? [])];
    if (previousRole) [current[previousRole], current[role]] = [current[role], current[previousRole]];
    else {
      const person = pool(save, roles).find(candidate => candidate.id === id);
      if (!person) throw new Error('This staff member is unavailable.');
      const outgoing = current[role];
      if (!released.some(candidate => candidate.id === outgoing.id)) released.push({ ...outgoing, contract: undefined });
      const wasHired = hired.indexOf(outgoing.id);
      if (wasHired >= 0) hired.splice(wasHired, 1);
      hired.push(id);
      const ask = askingSalary(person, role);
      const { salary: annual, years } = terms ?? { salary: ask, years: 1 };
      if (!Number.isSafeInteger(annual) || !Number.isInteger(years) || years < 1 || years > 5) throw new Error('Enter an annual salary and a term of 1–5 years.');
      if (annual < ask) throw new Error(person.name + ' declined. Annual asking salary is ' + ask.toLocaleString() + ' dollars.');
      current[role] = { ...person, contract: { salary: annual, years, startYear: save.year ?? 0 } };
    }
    return { teams: { ...save.staffing?.teams, [save.team]: current }, released, hired };
  }
  function collaboration(save, code, day = save?.day ?? 0) {
    const people = assignments(save, code, roles);
    const trust = Object.fromEntries(Object.values(people).map(person => {
      const event = code === save?.team ? save.staffTrustEvents?.findLast(entry => entry.id === person.id && entry.day <= day) : null;
      return [person.id, event?.score ?? save?.staffTrustCarry?.[person.id] ?? 48];
    }));
    const groups = {};
    const grade = (key, first, second) => {
      const a = people[roles[first]], b = people[roles[second]];
      const signature = a.id + '/' + b.id;
      let change = 0;
      if (code === save?.team) {
        const timeline = [{ day: 0, staffing: save.staffBaseline }, ...(save.staffTimeline ?? [])].filter(entry => entry.day <= day);
        for (let index = timeline.length - 1; index >= 0; index--) {
          const entry = timeline[index];
          const pair = assignments({ ...save, staffing: entry.staffing }, code, roles);
          if (pair[roles[first]].id !== a.id || pair[roles[second]].id !== b.id) {
            change = timeline[index + 1]?.day ?? day;
            break;
          }
        }
      }
      const previous = save?.staffCohesionCarry?.[code]?.[key];
      const tenure = Math.min(12, Math.floor((day - change) / 7) + (!change && previous?.signature === signature ? previous.tenure : 0));
      groups[key] = { signature, tenure };
      if (day < (save?.worldStaffStart ?? Infinity)) return 50;
      const communication = (a.communication + b.communication) / 2;
      return Math.max(0, Math.min(100, Math.round(50 + tenure + (communication - 75) * 0.6
        + ((trust[a.id] + trust[b.id]) / 2 - 48) * 0.55)));
    };
    return { trust, coaching: grade('coaching', 0, 1), development: grade('development', 4, 5),
      scouting: grade('scouting', 6, 7), medical: grade('medical', 8, 9), groups };
  }
  function effects(save, code, day = save?.day ?? 0) {
    const staff = assignments(save, code, roles);
    const average = (a, b, field) => (staff[a][field] + staff[b][field]) / 2;
    const cohesion = collaboration(save, code, day);
    const bonus = key => (cohesion[key] - 50) / 10;
    const medical = average(roles[8], roles[9], 'skill') + bonus('medical');
    const development = average(roles[4], roles[5], 'skill') + bonus('development');
    return {
      attack: (average(roles[0], roles[2], 'skill') + (staff[roles[1]].communication - 75) * 0.2 - 75) / 10 + bonus("coaching") * 0.2,
      defense: (average(roles[0], roles[3], 'skill') + (staff[roles[1]].communication - 75) * 0.2 - 75) / 10 + bonus("coaching") * 0.2,
      recovery: Math.max(0, Math.floor((medical - 70) / 9)),
      rehabDays: Math.max(0, Math.floor((medical - 68) / 4)),
      developmentSkill: development,
      trainingGain: Math.max(0, Math.floor((development - 69) / 8)) / 100,
      trainingRecovery: Math.max(0, Math.floor((development - 67) / 8)),
      scouting: Math.min(100, Math.round(average(roles[6], roles[7], 'evaluation') + bonus('scouting'))),
      affiliateGain: Math.round(Math.max(-0.15, Math.min(0.30,
        (average(roles[6], roles[7], 'skill') + bonus('scouting') - 70) * 0.015)) * 100) / 100,
    };
  }
  return { assignments, pool, assign, retirementCandidates, retire, roles, effects, collaboration, askingSalary, salary, annualPayroll };
})();
