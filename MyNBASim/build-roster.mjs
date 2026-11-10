import { readFileSync, writeFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const normalize = name => name.normalize('NFD').replace(/\p{M}|[^\p{L}\p{N}]/gu, '').toLowerCase();
const seasons = ['2026-27', '2025-26', '2024-25', '2023-24', '2022-23'];
const perGame = {
  MIN: 'minutes', PTS: 'points', REB: 'rebounds', AST: 'assists', STL: 'steals',
  BLK: 'blocks', TO: 'turnovers', FGM: 'field_goals_made', FGA: 'field_goal_attempts',
  '3PM': 'three_point_makes', '3PA': 'three_point_attempts', FTA: 'free_throw_attempts',
};
const round = value => Math.round(value * 100) / 100;
const seasonStats = seasons.map(season => {
  const [header, ...rows] = read(`stats-${season}.tmp.csv`).trim().split(/\r?\n/).map(row => row.split(','));
  return new Map(rows.map(values => {
    const row = Object.fromEntries(header.map((key, i) => [key, values[i]]));
    const games = Number(row.games_played);
    return [normalize(row.player_name), {
      GP: games,
      ...Object.fromEntries(Object.entries(perGame).map(([key, field]) => [key, round(Number(row[field]) / games)])),
      '3P%': Number(row.three_point_attempts) ? round(Number(row.three_point_pct) * 100) : null,
      'FT%': Number(row.free_throw_attempts) ? round(Number(row.free_throw_pct) * 100) : null,
    }];
  }));
});
const divisions = {
  Atlantic: 'BOS BKN NY PHI TOR', Central: 'CHI CLE DET IND MIL', Southeast: 'ATL CHA MIA ORL WSH',
  Northwest: 'DEN MIN OKC POR UTAH', Pacific: 'GS LAC LAL PHX SAC', Southwest: 'DAL HOU MEM NO SA',
};
const aliases = { GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS' };
const rating = value => Math.round(Math.max(25, Math.min(99, value)) * 100) / 100;

function scout(player, stats) {
  const guard = player.position?.abbreviation.includes('G') ? 1 : 0;
  const size = (player.height ?? 78) - 78;
  const weight = (player.weight ?? 215) - 215;
  const s = stats ?? {};
  const trust = Math.min(1, ((s.GP ?? 0) * (s.MIN ?? 0)) / 950);
  const rate = key => (s[key] ?? 0) * 36 / Math.max(s.MIN ?? 0, 10) * trust;
  const accuracy = (percent, attempts, prior, sample) => {
    const volume = (s[attempts] ?? 0) * (s.GP ?? 0);
    return ((s[percent] ?? 0) * volume + prior * sample) / (volume + sample);
  };
  const twoAttempts = (s.FGA ?? 0) - (s['3PA'] ?? 0);
  const twoPct = twoAttempts > 0 ? ((s.FGM - s['3PM']) / twoAttempts) * 100 : 49;
  const finishing = 49 + (twoPct - 49) * trust * Math.min(1, Math.max(0, twoAttempts) / 5);
  const pts = (s.PTS ?? 0) * trust;
  const reb = rate('REB');
  const ast = rate('AST');
  const blk = rate('BLK');
  const stl = rate('STL');
  const ft = accuracy('FT%', 'FTA', 69, 70);
  return Object.fromEntries(Object.entries({
    Inside: 49 + size * 2 + (finishing - 49) * 0.9 + rate('FTA') * 2,
    Close: 51 + size + (finishing - 49) * 1.3 + pts * 0.45,
    Mid: 48 + guard * 4 + (ft - 69) * 0.75 + pts * 0.6,
    '3PT': 53 + (accuracy('3P%', '3PA', 30, 110) - 30) * 2.15 + rate('3PA') * 1.75,
    FT: ft,
    'Pass Acc': 51 + ast * 3.8 + guard * 5,
    Handles: 52 + guard * 13 - size * 0.7 + ast * 1.8 + pts * 0.42,
    'Interior Defense': 52 + size * 2 + blk * 7 + reb * 0.55,
    'Perimeter Defense': 55 + guard * 5 - Math.max(0, size - 2) + stl * 7,
    Steal: 48 + stl * 16,
    Block: 40 + blk * 15 + size * 1.25,
    'Offensive Rebound': 43 + reb * 3.15 + size * 1.2,
    'Defensive Rebound': 43 + reb * 3.9 + size * 0.8,
    'Box Out': 52 + reb * 2.1 + weight * 0.24,
    Speed: 70 + guard * 9 - size * 1.55 - weight * 0.06,
    Agility: 68 + guard * 9 - size * 1.35 - weight * 0.07 + stl * 1.5,
    Strength: 61 + weight * 0.48 + size * 0.55,
    Durability: stats ? 61 + s.GP * 0.4 : 75,
    'Offensive IQ': 54 + ast * 2 + pts * 0.75 - rate('TO') * 1.3,
    'Defensive IQ': 57 + stl * 4 + blk * 3 + reb * 0.8 + Math.min(8, player.experience?.years ?? 0),
    'Offensive Consistency': 51 + pts * 1.12 + (s.GP ?? 0) * 0.12,
    'Defensive Consistency': 53 + (s.MIN ?? 0) * 0.62 + (s.GP ?? 0) * 0.14,
    Marketability: 40 + pts * 1.25 + (s.DD2 ?? 0) * 0.15 + (s.TD3 ?? 0) * 0.35,
  }).map(([name, value]) => [name, rating(value)]));
}

const teams = JSON.parse(read('espn-teams.tmp.json')).sports[0].leagues[0].teams;
const players = [];
const snapshots = new Set();
const franchises = teams.map(({ team }) => {
  const roster = JSON.parse(read(`roster-${team.id}.tmp.json`));
  snapshots.add(roster.timestamp.slice(0, 10));
  const division = Object.keys(divisions).find(key => divisions[key].split(' ').includes(team.abbreviation));
  const code = aliases[team.abbreviation] ?? team.abbreviation;
  for (const player of roster.athletes) {
    const name = normalize(player.fullName);
    const history = seasonStats.flatMap((table, i) => {
      const stats = table.get(name);
      return stats?.GP ? [{ season: seasons[i].replace('-', '–'), stats }] : [];
    });
    const baseline = history.find(entry => entry.season !== '2026–27' && entry.stats.GP * entry.stats.MIN >= 300)
      ?? history.find(entry => entry.season !== '2026–27') ?? history[0];
    const stats = history.find(entry => entry.season === '2025–26')?.stats ?? null;
    players.push({
      id: player.id, team: code, name: player.fullName, jersey: player.jersey ?? null,
      position: player.position?.abbreviation ?? null, dob: player.dateOfBirth?.slice(0, 10) ?? null,
      height: player.displayHeight ?? null, weight: player.displayWeight ?? null,
      birthplace: player.birthPlace ?? null, college: player.college?.name ?? null,
      experience: player.experience?.years ?? null, status: player.status?.name ?? null,
      photo: player.headshot?.href ?? null, source: player.links?.[0]?.href ?? null,
      stats, history, ratingSeason: baseline?.season ?? null, attributes: scout(player, baseline?.stats),
    });
  }
  return {
    code, name: team.displayName, division, conference: ['Atlantic', 'Central', 'Southeast'].includes(division) ? 'East' : 'West',
    color: '#' + team.color, logo: roster.team.logo, record: roster.team.recordSummary ?? null, source: roster.team.clubhouse,
  };
});
if (franchises.length !== 30 || franchises.some(team => !team.division || !players.some(player => player.team === team.code))) {
  throw new Error('Expected populated rosters for all 30 NBA franchises.');
}
if (snapshots.size !== 1 || new Set(players.map(player => player.id)).size !== players.length) {
  throw new Error('Roster snapshot contains inconsistent dates or duplicate players.');
}
if (players.some(player => Object.keys(player.attributes).length !== 23 || Object.values(player.attributes).some(value => !Number.isFinite(value)))) {
  throw new Error('Every player must have 23 numeric attributes.');
}
const league = { season: '2026–27', snapshot: [...snapshots][0], teams: franchises, players };
writeFileSync('league-data.js', `const league = ${JSON.stringify(league)};\n`);
console.log(`${franchises.length} teams, ${players.length} players, ${players.filter(p => p.stats).length} with 2025–26 stats`);
