const playerTools = (() => {
  const registry = new Map(league.players.map(player => [player.id, player]));
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  const attributes = Object.keys(league.players[0].attributes);
  const slots = player => {
    const allowed = [...positions, 'G', 'F'];
    const explicit = (player.positions ?? []).filter(position => allowed.includes(position));
    if (explicit.length) return explicit;
    const source = player.position ?? '';
    const reference = typeof nba2kReference === 'undefined' ? null : nba2kReference[player.id]?.position;
    const parse = value => [...new Set(String(value ?? '').split(/[-/]/).map(item => item.trim()).filter(item => allowed.includes(item)))];
    const listed = parse(source);
    return listed.some(position => positions.includes(position)) ? listed : parse(reference).length ? parse(reference) : listed;
  };
  const positionText = player => slots(player).join(' / ') || player.position;
  function register(save) {
    for (const player of save.customPlayers ?? []) registry.set(player.id, player);
  }
  function validate(input) {
    const name = input.name.trim();
    const assigned = input.positions.filter(Boolean);
    if (!name || name.length > 80 || !input.positions[0] || (input.positions[2] && !input.positions[1]) || new Set(assigned).size !== assigned.length
      || assigned.some(position => !positions.includes(position))) throw new Error('Enter a name and a primary position. Choose distinct positions in order.');
    if (input.dob && (!/^\d{4}-\d{2}-\d{2}$/.test(input.dob) || !Number.isFinite(Date.parse(input.dob))
      || new Date(input.dob).toISOString().slice(0, 10) !== input.dob)) throw new Error('Enter a valid date of birth.');
    if (input.experience != null && (!Number.isInteger(input.experience) || input.experience < 0 || input.experience > 40)) {
      throw new Error('Experience must be a whole number from 0 to 40.');
    }
    if (attributes.some(key => !Number.isFinite(input.attributes[key]) || input.attributes[key] < 25 || input.attributes[key] > 99)) {
      throw new Error('Ratings must be between 25 and 99.');
    }
    const progression = input.progression ?? null;
    if (progression && (!Number.isInteger(progression.peakStart) || !Number.isInteger(progression.peakEnd) ||
      progression.peakStart < 18 || progression.peakEnd > 45 || progression.peakStart > progression.peakEnd ||
      [progression.gain, progression.loss].some(rate => !Number.isFinite(rate) || rate < 0 || rate > 10))) {
      throw new Error('Enter an ordered peak range from age 18 to 45 and rates from 0 to 10.');
    }
    const handedness = input.handedness || '';
    if (!['', 'Right', 'Left', 'Ambidextrous'].includes(handedness)) throw new Error('Choose a listed handedness.');
    return { wingspan: String(input.wingspan ?? '').trim().slice(0, 24),
      standingReach: String(input.standingReach ?? '').trim().slice(0, 24), handedness,
      progression, name, dob: input.dob || null, experience: input.experience,
      height: String(input.height ?? '').trim().slice(0, 24), weight: String(input.weight ?? '').trim().slice(0, 24),
      college: String(input.college ?? '').trim().slice(0, 80),
      positions: assigned, position: assigned[0], attributes: Object.fromEntries(attributes.map(key => [key, input.attributes[key]])) };
  }
  return { registry, positions, attributes, slots, positionText, register, validate };
})();
